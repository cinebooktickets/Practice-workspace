"use client"
import React from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotifications } from "@/hooks/useNotifications"
import { useAuth } from "@/context/auth"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const { accessToken } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(accessToken)
  const [open, setOpen] = React.useState(false)

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen)
  }

  const handleMarkRead = (id: string) => {
    markRead(id)
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <ul>
              {notifications.map(n => (
                <li key={n.id} className="border-b border-border last:border-0">
                  <button
                    className={`flex gap-3 w-full px-4 py-3 text-left cursor-pointer hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                    onClick={() => handleMarkRead(n.id)}
                    aria-label={n.is_read ? n.title : `${n.title} (unread)`}
                  >
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className={`flex-1 min-w-0 ${n.is_read ? "ml-5" : ""}`}>
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <div className="border-t border-border px-4 py-2">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
