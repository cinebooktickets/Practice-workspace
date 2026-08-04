"use client"
import React from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { useAuth } from "@/context/auth"
import { notificationsApi } from "@/lib/api"
import type { NotificationItem } from "@/lib/api"
import { ApiException } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Bell, Trash2, CheckCheck } from "lucide-react"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationsPage() {
  const { getAccessTokenSilently } = useAuth()

  const [items,       setItems]       = React.useState<NotificationItem[]>([])
  const [loading,     setLoading]     = React.useState(true)
  const [error,       setError]       = React.useState<string | null>(null)
  const [hasMore,     setHasMore]     = React.useState(false)
  const [offset,      setOffset]      = React.useState(0)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [deletingId,  setDeletingId]  = React.useState<string | null>(null)

  const fetchNotifications = React.useCallback(async (loadOffset = 0) => {
    try {
      const token = await getAccessTokenSilently()
      const res   = await notificationsApi.list(token, { limit: 20, offset: loadOffset })
      if (loadOffset > 0) {
        setItems(prev => [...prev, ...res.items])
      } else {
        setItems(res.items)
      }
      const nextOffset = loadOffset + res.items.length
      setOffset(nextOffset)
      setHasMore(nextOffset < res.total)
      setError(null)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to load notifications"
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkRead = async (id: string) => {
    try {
      const token = await getAccessTokenSilently()
      await notificationsApi.markRead(token, id)
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch {
      toast.error("Failed to mark notification as read")
    }
  }

  // markAllRead — Contract H: POST /api/v1/notifications/read-all
  const handleMarkAllRead = async () => {
    // Optimistic update
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    try {
      const token = await getAccessTokenSilently()
      await notificationsApi.markAllRead(token)
    } catch {
      toast.error("Failed to mark all as read")
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const token = await getAccessTokenSilently()
      await notificationsApi.delete(token, id)
      setItems(prev => prev.filter(n => n.id !== id))
    } catch {
      toast.error("Failed to delete notification")
    } finally {
      setDeletingId(null)
    }
  }

  const handleLoadMore = async () => {
    if (!hasMore) return
    setLoadingMore(true)
    await fetchNotifications(offset)
  }

  const unreadCount = items.filter(n => !n.is_read).length

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" aria-hidden="true" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border border-border rounded-lg">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" aria-hidden="true" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" aria-hidden="true" />
                  <Skeleton className="h-3 w-full" aria-hidden="true" />
                  <Skeleton className="h-3 w-24" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-center justify-between">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchNotifications() }}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/50 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll see agent events, team updates, and system alerts here.
            </p>
          </div>
        )}

        {/* List */}
        {!loading && !error && items.length > 0 && (
          <div className="space-y-2">
            {items.map(n => (
              <div
                key={n.id}
                className={`flex gap-4 p-4 border border-border rounded-lg transition-colors ${!n.is_read ? "bg-primary/5 border-primary/20" : "bg-card"}`}
              >
                {/* Unread dot */}
                <div className="flex shrink-0 pt-1">
                  {!n.is_read ? (
                    <span className="h-2 w-2 rounded-full bg-primary mt-1" />
                  ) : (
                    <span className="h-2 w-2" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{n.title}</p>
                      <Badge variant="secondary" className="text-xs font-normal">{n.event_type}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                </div>

                {/* Actions */}
                <div className="flex items-start gap-1 shrink-0">
                  {!n.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      Mark read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(n.id)}
                    disabled={deletingId === n.id}
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
