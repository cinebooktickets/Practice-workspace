"use client"
import React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/context/auth"
import { feedbackApi, conversationsApi, ApiException } from "@/lib/api"
import type { FeedbackItem, FeedbackStatus, MessageOut } from "@/lib/api"
import { toast } from "sonner"
import { ThumbsUp, ThumbsDown, CheckCircle, XCircle, RefreshCw, MessageSquare, Bot, User, ChevronDown } from "lucide-react"

type Props = {
  agentId: string
}

type ResolveDialogState = {
  feedbackId: string
  action:     "resolved" | "dismissed"
} | null

type ThreadDialogState = {
  convId:    string
  messageId: string | null
} | null

const ROLE_ICON: Record<string, React.ReactNode> = {
  user:      <User className="w-3.5 h-3.5" aria-hidden="true" />,
  assistant: <Bot  className="w-3.5 h-3.5" aria-hidden="true" />,
  system:    <span className="text-[10px] font-bold">SYS</span>,
}

const ROLE_CLASS: Record<string, string> = {
  user:      "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  assistant: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  system:    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

const STATUS_VARIANT: Record<FeedbackStatus, "default" | "secondary" | "outline"> = {
  pending:   "outline",
  resolved:  "default",
  dismissed: "secondary",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function FeedbackTab({ agentId }: Props) {
  const { getAccessTokenSilently } = useAuth()

  const [items,          setItems]          = React.useState<FeedbackItem[]>([])
  const [loading,        setLoading]        = React.useState(true)
  const [error,          setError]          = React.useState<string | null>(null)
  const [nextCursor,     setNextCursor]     = React.useState<string | null>(null)
  const [loadingMore,    setLoadingMore]    = React.useState(false)
  const [statusFilter,   setStatusFilter]   = React.useState<FeedbackStatus | "">("")
  const [resolveDialog,  setResolveDialog]  = React.useState<ResolveDialogState>(null)
  const [resolutionNote, setResolutionNote] = React.useState("")
  const [resolving,      setResolving]      = React.useState(false)
  const [threadDialog,   setThreadDialog]   = React.useState<ThreadDialogState>(null)
  const [ratedMessage,   setRatedMessage]   = React.useState<MessageOut | null>(null)
  const [threadLoading,  setThreadLoading]  = React.useState(false)
  const [threadError,    setThreadError]    = React.useState<string | null>(null)

  const fetchFeedback = React.useCallback(async (cursor?: string) => {
    try {
      const token = await getAccessTokenSilently()
      const res   = await feedbackApi.list(token, agentId, {
        limit:  20,
        cursor,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      if (cursor) {
        setItems(prev => [...prev, ...res.items])
      } else {
        setItems(res.items)
      }
      setNextCursor(res.next_cursor)
      setError(null)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to load feedback"
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [getAccessTokenSilently, agentId, statusFilter])

  React.useEffect(() => {
    setLoading(true)
    fetchFeedback()
  }, [fetchFeedback])

  const handleLoadMore = () => {
    if (!nextCursor) return
    setLoadingMore(true)
    fetchFeedback(nextCursor)
  }

  const openResolveDialog = (feedbackId: string, action: "resolved" | "dismissed") => {
    setResolutionNote("")
    setResolveDialog({ feedbackId, action })
  }

  const openThreadDialog = React.useCallback(async (convId: string, messageId: string | null) => {
    setThreadDialog({ convId, messageId })
    setRatedMessage(null)
    setThreadError(null)
    setThreadLoading(true)
    try {
      const token = await getAccessTokenSilently()
      // Page through messages until we find the one with the matching messageId
      let cursor: string | undefined = undefined
      let found: MessageOut | null = null
      do {
        const res = await conversationsApi.listMessages(token, agentId, convId, { limit: 50, cursor })
        if (messageId) {
          found = res.items.find(m => m.id === messageId) ?? null
        } else {
          // No messageId — show the last assistant message as best guess
          const assistantMsgs = res.items.filter(m => m.role === "assistant")
          if (assistantMsgs.length) found = assistantMsgs[assistantMsgs.length - 1]
        }
        cursor = res.next_cursor ?? undefined
        if (found || !res.has_more) break
      } while (cursor)
      setRatedMessage(found)
    } catch (err) {
      setThreadError(err instanceof ApiException ? err.message : "Failed to load message")
    } finally {
      setThreadLoading(false)
    }
  }, [getAccessTokenSilently, agentId])

  const handleResolve = async () => {
    if (!resolveDialog) return
    setResolving(true)
    try {
      const token   = await getAccessTokenSilently()
      const updated = await feedbackApi.resolve(token, agentId, resolveDialog.feedbackId, {
        status:          resolveDialog.action,
        resolution_note: resolutionNote.trim() || null,
      })
      setItems(prev => prev.map(f => f.id === updated.id ? updated : f))
      toast.success(resolveDialog.action === "resolved" ? "Feedback resolved" : "Feedback dismissed")
      setResolveDialog(null)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to update feedback"
      toast.error(msg)
    } finally {
      setResolving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-end">
            <Select
              value={statusFilter || "all"}
              onValueChange={(v) => setStatusFilter(v === "all" ? "" : v as FeedbackStatus)}
            >
              <SelectTrigger className="w-[120px] sm:w-[160px]">
                <SelectValue placeholder="All feedback" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All feedback</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-5 w-5 rounded-full" aria-hidden="true" />
                  <Skeleton className="h-4 w-56" aria-hidden="true" />
                  <Skeleton className="h-5 w-16 ml-auto" aria-hidden="true" />
                  <Skeleton className="h-8 w-20" aria-hidden="true" />
                  <Skeleton className="h-8 w-20" aria-hidden="true" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchFeedback() }}>
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ThumbsUp className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">
                {statusFilter ? "No feedback matches this filter" : "No feedback yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs text-center">
                {statusFilter
                  ? "Try a different status filter."
                  : "Thumbs up / down ratings from visitors will appear here once users interact with this agent."}
              </p>
              {statusFilter && (
                <Button variant="outline" size="sm" onClick={() => setStatusFilter("")}>
                  Clear filter
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Rating</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Rated Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[160px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((fb) => (
                    <TableRow key={fb.id}>
                      <TableCell>
                        {fb.rating === "thumbs_up" ? (
                          <ThumbsUp className="w-4 h-4 text-green-500" aria-label="Thumbs up" />
                        ) : (
                          <ThumbsDown className="w-4 h-4 text-red-500" aria-label="Thumbs down" />
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        {fb.comment ? (
                          <span className="text-sm line-clamp-2">{fb.comment}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No comment</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => openThreadDialog(fb.conversation_id, fb.message_id ?? null)}
                          aria-label="View conversation thread"
                        >
                          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                          View
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[fb.status]} className="capitalize">
                          {fb.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(fb.created_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(fb.updated_at)}
                      </TableCell>
                      <TableCell>
                        {fb.status === "pending" && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openResolveDialog(fb.id, "resolved")}
                              className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                              Resolve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openResolveDialog(fb.id, "dismissed")}
                              className="text-muted-foreground"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                              Dismiss
                            </Button>
                          </div>
                        )}
                        {fb.status !== "pending" && fb.resolution_note && (
                          <span className="text-xs text-muted-foreground italic line-clamp-1 max-w-[140px]">
                            {fb.resolution_note}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              {nextCursor && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Resolve / dismiss dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={(open) => { if (!open) setResolveDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveDialog?.action === "resolved" ? "Resolve feedback" : "Dismiss feedback"}
            </DialogTitle>
            <DialogDescription>
              {resolveDialog?.action === "resolved"
                ? "Mark this feedback as resolved. Optionally add a note explaining the action taken."
                : "Dismiss this feedback. Optionally add a note explaining why it was dismissed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="resolution-note">Resolution note (optional)</Label>
            <Textarea
              id="resolution-note"
              placeholder="Add a note…"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={3}
              maxLength={1024}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(null)} disabled={resolving}>
              Cancel
            </Button>
            <Button
              variant={resolveDialog?.action === "resolved" ? "default" : "secondary"}
              onClick={handleResolve}
              disabled={resolving}
            >
              {resolving
                ? "Saving…"
                : resolveDialog?.action === "resolved" ? "Resolve" : "Dismiss"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rated message dialog — shows only the single message that was rated */}
      <Dialog open={!!threadDialog} onOpenChange={(open) => { if (!open) setThreadDialog(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              Rated message
            </DialogTitle>
            <DialogDescription>
              The assistant message the visitor rated.
            </DialogDescription>
          </DialogHeader>

          <div className="py-1">
            {threadLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : threadError ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-destructive">{threadError}</p>
                <Button variant="outline" size="sm" onClick={() => threadDialog && openThreadDialog(threadDialog.convId, threadDialog.messageId ?? null)}>
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Retry
                </Button>
              </div>
            ) : !ratedMessage ? (
              <p className="text-sm text-muted-foreground text-center py-6">Message not found.</p>
            ) : (
              <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CLASS[ratedMessage.role] ?? ROLE_CLASS.system}`}>
                    {ROLE_ICON[ratedMessage.role] ?? null}
                    {ratedMessage.role}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ratedMessage.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{ratedMessage.content}</p>
                {((ratedMessage.total_tokens != null) || (ratedMessage.citations?.length ?? 0) > 0) && (
                  <div className="flex gap-3 text-xs text-muted-foreground pt-1 border-t">
                    {ratedMessage.total_tokens != null && <span>{ratedMessage.total_tokens} tokens</span>}
                    {(ratedMessage.citations?.length ?? 0) > 0 && <span>{ratedMessage.citations!.length} citation{ratedMessage.citations!.length !== 1 ? "s" : ""}</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setThreadDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
