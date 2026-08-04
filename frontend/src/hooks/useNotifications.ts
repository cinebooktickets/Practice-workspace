"use client"
import React from "react"
import { notificationsApi } from "@/lib/api"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// ─── Types ────────────────────────────────────────────────────────────────────

export type Notification = {
  id:          string
  org_id:      string
  user_id:     string
  event_type:  string
  title:       string
  body:        string
  severity:    "info" | "warning" | "critical"
  payload?:    Record<string, unknown> | null
  is_read:     boolean
  read_at?:    string | null
  created_at:  string
  updated_at:  string
}

type NotificationsState = {
  notifications: Notification[]
  unreadCount:   number
  connected:     boolean
  error:         string | null
}

// ─── Hook ────────────────────────────────────────────────────────────────────

// TEMPORARY: notifications API is down — disable all SSE + polling until re-enabled
const NOTIFICATIONS_DISABLED = true

export function useNotifications(token: string | null) {
  if (NOTIFICATIONS_DISABLED) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return {
      notifications: [] as Notification[],
      unreadCount:   0,
      connected:     false,
      error:         null,
      markRead:      (_id: string) => {},
      markAllRead:   () => {},
    }
  }
  const [state, setState] = React.useState<NotificationsState>({
    notifications: [],
    unreadCount:   0,
    connected:     false,
    error:         null,
  })

  const esRef           = React.useRef<EventSource | null>(null)
  const pollRef         = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const addNotification = React.useCallback((n: Notification) => {
    setState(prev => ({
      ...prev,
      notifications: [n, ...prev.notifications].slice(0, 50), // keep latest 50
      unreadCount:   prev.unreadCount + (n.is_read ? 0 : 1),
      connected:     true,
      error:         null,
    }))
  }, [])

  const startPolling = React.useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/v1/notifications/?limit=20`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) return
        const data: { items: Notification[] } = await res.json()
        const unread = data.items.filter(n => !n.is_read).length
        setState(prev => ({
          ...prev,
          notifications: data.items,
          unreadCount:   unread,
          error:         null,
        }))
      } catch {
        // polling failure is silent — will retry next interval
      }
    }, 5000)
  }, [token])

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!token) return

    const url = `${BASE_URL}/api/v1/notifications/stream?access_token=${encodeURIComponent(token)}`
    const es  = new EventSource(url)
    esRef.current = es
    let receivedFirst = false

    es.addEventListener("delta", (e: MessageEvent) => {
      receivedFirst = true
      stopPolling()
      try {
        const frame: { notification: Notification } = JSON.parse(e.data)
        addNotification(frame.notification)
      } catch {
        // malformed frame — ignore
      }
    })

    es.onerror = () => {
      setState(prev => ({ ...prev, connected: false }))
      if (!receivedFirst) {
        // SSE failed before first event — fall back to polling
        es.close()
        esRef.current = null
        startPolling()
      }
    }

    return () => {
      es.close()
      esRef.current = null
      stopPolling()
    }
  }, [token, addNotification, startPolling, stopPolling])

  const markRead = React.useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }))
  }, [])

  const markAllRead = React.useCallback(async () => {
    // Optimistic local update
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, is_read: true })),
      unreadCount:   0,
    }))
    // Sync to backend
    if (token) {
      try {
        await notificationsApi.markAllRead(token)
      } catch {
        // Silently swallow — local state already updated; next list refresh will re-sync
      }
    }
  }, [token])

  return {
    notifications: state.notifications,
    unreadCount:   state.unreadCount,
    connected:     state.connected,
    error:         state.error,
    markRead,
    markAllRead,
  }
}
