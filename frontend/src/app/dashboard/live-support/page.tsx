"use client"
import React from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/context/auth"
import { handoffApi, HandoffItem, HandoffMessageItem, ApiException } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Headphones, RefreshCw, MessageSquare, CheckCircle, ScrollText } from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatWaitTime = (requestedAt: string | null): string => {
  if (!requestedAt) return "—"
  const diff = Date.now() - new Date(requestedAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "< 1 min"
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ─── Row skeleton ─────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-40" aria-hidden="true" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" aria-hidden="true" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" aria-hidden="true" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" aria-hidden="true" /></TableCell>
      <TableCell><Skeleton className="h-8 w-32" aria-hidden="true" /></TableCell>
    </TableRow>
  )
}

// ─── Reply Dialog ─────────────────────────────────────────────────────────────

type ReplyDialogProps = {
  handoff: HandoffItem | null
  onClose: () => void
  onSent: () => void
}

function ReplyDialog({ handoff, onClose, onSent }: ReplyDialogProps) {
  const { getAccessTokenSilently } = useAuth()
  const [content, setContent] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [history, setHistory] = React.useState<HandoffMessageItem[]>([])
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [visitorTyping, setVisitorTyping] = React.useState(false)
  const historyEndRef = React.useRef<HTMLDivElement>(null)
  const typingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingSentRef = React.useRef(false)
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const typingPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  React.useEffect(() => {
    if (handoff) {
      setContent("")
      setHistory([])
      setLoadingHistory(true)
      getAccessTokenSilently()
        .then((token) => handoffApi.messages(token, handoff.id, { limit: 200 }))
        .then((res) => setHistory(res.items))
        .catch(() => { /* non-critical — show empty */ })
        .finally(() => setLoadingHistory(false))

      // Poll for new visitor messages every 3 s while the dialog is open
      pollTimerRef.current = setInterval(async () => {
        try {
          const token = await getAccessTokenSilently()
          const res = await handoffApi.messages(token, handoff.id, { limit: 200 })
          setHistory((prev) => {
            // Remove all optimistic messages — real data from the server is the source of truth
            const withoutOptimistic = prev.filter((m) => !m.id.startsWith("optimistic-"))
            const existingIds = new Set(withoutOptimistic.map((m) => m.id))
            const incoming = res.items.filter((m) => !existingIds.has(m.id))
            if (incoming.length > 0) return [...withoutOptimistic, ...incoming]
            if (withoutOptimistic.length !== prev.length) return withoutOptimistic
            return prev
          })
        } catch {
          // best-effort — silent
        }
      }, 3000)
      // Poll GET /api/v1/handoff/{id}/typing every 3 s — reads visitor typing state
      // (set by widget's POST /widget/typing, stored as typing:{conv_id}:visitor in Redis)
      typingPollRef.current = setInterval(async () => {
        try {
          const token = await getAccessTokenSilently()
          const res = await handoffApi.getTyping(token, handoff.id)
          setVisitorTyping(res.is_typing)
        } catch {
          // best-effort — silent
        }
      }, 3000)
    }
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null }
      if (typingPollRef.current) { clearInterval(typingPollRef.current); typingPollRef.current = null }
      setVisitorTyping(false)
    }
  }, [handoff, getAccessTokenSilently])

  // Scroll to bottom of history when it loads
  React.useEffect(() => {
    if (history.length > 0) {
      historyEndRef.current?.scrollIntoView({ behavior: "instant" })
    }
  }, [history])

  const clearTyping = React.useCallback(async (token: string, handoffId: string) => {
    try {
      await handoffApi.setTyping(token, handoffId, { is_typing: false })
    } catch {
      // best-effort — don't surface typing errors to user
    }
  }, [])

  const handleContentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    if (!handoff) return

    // Only send is_typing=true once per burst — same pattern as widget visitor typing.
    // The 3 s idle timer resets on each keystroke; when it fires it sends false and
    // resets the guard so the next burst triggers a fresh is_typing=true.
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    try {
      const token = await getAccessTokenSilently()
      if (!typingSentRef.current) {
        typingSentRef.current = true
        await handoffApi.setTyping(token, handoff.id, { is_typing: true })
      }
      typingTimerRef.current = setTimeout(() => {
        typingSentRef.current = false
        clearTyping(token, handoff.id)
      }, 3000)
    } catch {
      // best-effort
    }
  }

  const handleSend = async () => {
    if (!handoff || !content.trim()) return
    setSending(true)
    const sentContent = content.trim()
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingSentRef.current = false
    try {
      const token = await getAccessTokenSilently()
      await clearTyping(token, handoff.id)
      await handoffApi.reply(token, handoff.id, { content: sentContent })
      setHistory((prev) => [
        ...prev,
        {
          id: `optimistic-${Date.now()}`,
          conversation_id: handoff.id,
          role: "assistant",
          content: sentContent,
          citations: [],
          created_at: new Date().toISOString(),
        } as HandoffMessageItem,
      ])
      setContent("")
      toast.success("Reply sent")
      onSent()
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to send reply")
    } finally {
      setSending(false)
    }
  }

  const handleCancel = async () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    if (handoff) {
      try {
        const token = await getAccessTokenSilently()
        await clearTyping(token, handoff.id)
      } catch {
        // best-effort
      }
    }
    onClose()
  }

  return (
    <Dialog open={!!handoff} onOpenChange={(open) => { if (!open) handleCancel() }}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Reply to conversation</DialogTitle>
          <DialogDescription>
            {handoff?.title ?? "Untitled conversation"}
          </DialogDescription>
        </DialogHeader>

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto border rounded-md bg-muted/30 p-3 space-y-2 min-h-[120px] max-h-[340px]">
          {loadingHistory ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">No messages yet.</p>
          ) : (
            history.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-background border text-foreground"
                    : "bg-primary text-primary-foreground"
                }`}>
                  <p className="text-xs font-medium mb-0.5 opacity-70">
                    {msg.role === "user" ? "Visitor" : "Agent / AI"}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className="text-[10px] opacity-60 mt-1 text-right">
                    {new Date(msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={historyEndRef} />
        </div>


        {visitorTyping && (
          <div className="flex items-center gap-1.5 px-1 py-0.5">
            <span className="text-xs text-muted-foreground">Visitor is typing</span>
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reply-content">Your reply</Label>
          <Textarea
            id="reply-content"
            placeholder="Type your reply…"
            rows={3}
            value={content}
            onChange={handleContentChange}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !content.trim()}>
            {sending ? "Sending…" : "Send reply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Transcript Dialog (read-only, resolved conversations) ──────────────────

type TranscriptDialogProps = {
  handoff: HandoffItem | null
  onClose: () => void
}

function TranscriptDialog({ handoff, onClose }: TranscriptDialogProps) {
  const { getAccessTokenSilently } = useAuth()
  const [history, setHistory] = React.useState<HandoffMessageItem[]>([])  
  const [loading, setLoading] = React.useState(false)
  const endRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!handoff) return
    setHistory([])
    setLoading(true)
    getAccessTokenSilently()
      .then((token) => handoffApi.messages(token, handoff.id, { limit: 500 }))
      .then((res) => setHistory(res.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [handoff, getAccessTokenSilently])

  React.useEffect(() => {
    if (history.length > 0) endRef.current?.scrollIntoView({ behavior: "instant" })
  }, [history])

  return (
    <Dialog open={!!handoff} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Conversation transcript</DialogTitle>
          <DialogDescription>{handoff?.title ?? "Untitled conversation"}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto border rounded-md bg-muted/30 p-3 space-y-2 min-h-[120px] max-h-[500px]">
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">No messages in transcript.</p>
          ) : (
            history.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-background border text-foreground"
                    : "bg-primary text-primary-foreground"
                }`}>
                  <p className="text-xs font-medium mb-0.5 opacity-70">
                    {msg.role === "user" ? "Visitor" : "Agent / AI"}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className="text-[10px] opacity-60 mt-1 text-right">
                    {new Date(msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Resolved row ─────────────────────────────────────────────────────────────

type ResolvedRowProps = {
  item: HandoffItem
  onView: (item: HandoffItem) => void
}

function ResolvedRow({ item, onView }: ResolvedRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {item.title ?? <span className="text-muted-foreground italic">Untitled conversation</span>}
      </TableCell>
      <TableCell>
        <span className="font-mono text-xs text-muted-foreground">{item.agent_id.slice(0, 8)}…</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-green-600 border-green-300">Resolved</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(item.updated_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" onClick={() => onView(item)}>
          <ScrollText className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          View transcript
        </Button>
      </TableCell>
    </TableRow>
  )
}

// ─── Resolve Dialog ───────────────────────────────────────────────────────────

type ResolveDialogProps = {
  handoff: HandoffItem | null
  onClose: () => void
  onResolved: () => void
}

function ResolveDialog({ handoff, onClose, onResolved }: ResolveDialogProps) {
  const { getAccessTokenSilently } = useAuth()
  const [note, setNote] = React.useState("")
  const [resolving, setResolving] = React.useState(false)

  React.useEffect(() => {
    if (handoff) setNote("")
  }, [handoff])

  const handleResolve = async () => {
    if (!handoff) return
    setResolving(true)
    try {
      const token = await getAccessTokenSilently()
      await handoffApi.resolve(token, handoff.id, { resolution_note: note.trim() || null })
      toast.success("Conversation resolved")
      onResolved()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to resolve conversation")
    } finally {
      setResolving(false)
    }
  }

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value)
  }

  return (
    <Dialog open={!!handoff} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve conversation</DialogTitle>
          <DialogDescription>
            This will close the conversation and remove it from the queue.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="resolution-note">Resolution note (optional)</Label>
          <Textarea
            id="resolution-note"
            placeholder="Briefly describe how this was resolved…"
            rows={3}
            value={note}
            onChange={handleNoteChange}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={resolving}>
            Cancel
          </Button>
          <Button onClick={handleResolve} disabled={resolving}>
            {resolving ? "Resolving…" : "Resolve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Handoff row (pending) ────────────────────────────────────────────────────

type PendingRowProps = {
  item: HandoffItem
  onClaim: (id: string) => void
  claiming: string | null
}

function PendingRow({ item, onClaim, claiming }: PendingRowProps) {
  const isClaiming = claiming === item.id

  return (
    <TableRow>
      <TableCell className="font-medium">
        {item.title ?? <span className="text-muted-foreground italic">Untitled conversation</span>}
      </TableCell>
      <TableCell>
        <span className="font-mono text-xs text-muted-foreground">
          {item.agent_id.slice(0, 8)}…
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">Pending</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatWaitTime(item.handoff_requested_at)}
      </TableCell>
      <TableCell>
        <Button size="sm" disabled={isClaiming} onClick={() => onClaim(item.id)}>
          {isClaiming ? "Claiming…" : "Claim"}
        </Button>
      </TableCell>
    </TableRow>
  )
}

// ─── Handoff row (in-progress) ────────────────────────────────────────────────

type InProgressRowProps = {
  item: HandoffItem
  onReply: (item: HandoffItem) => void
  onResolve: (item: HandoffItem) => void
}

function InProgressRow({ item, onReply, onResolve }: InProgressRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {item.title ?? <span className="text-muted-foreground italic">Untitled conversation</span>}
      </TableCell>
      <TableCell>
        <span className="font-mono text-xs text-muted-foreground">
          {item.agent_id.slice(0, 8)}…
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">In progress</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatWaitTime(item.handoff_requested_at)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onReply(item)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Reply
          </Button>
          <Button size="sm" variant="outline" onClick={() => onResolve(item)}>
            <CheckCircle className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Resolve
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

type EmptyStateProps = {
  label: string
}

function EmptyState({ label }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Headphones className="h-10 w-10 text-muted-foreground mb-4" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LiveSupportPage() {
  const { getAccessTokenSilently } = useAuth()

  const [pending, setPending] = React.useState<HandoffItem[]>([])
  const [inProgress, setInProgress] = React.useState<HandoffItem[]>([])
  const [loadingPending, setLoadingPending] = React.useState(true)
  const [loadingInProgress, setLoadingInProgress] = React.useState(true)
  const [errorPending, setErrorPending] = React.useState<string | null>(null)
  const [errorInProgress, setErrorInProgress] = React.useState<string | null>(null)
  const [claiming, setClaiming] = React.useState<string | null>(null)
  const [replyTarget, setReplyTarget] = React.useState<HandoffItem | null>(null)
  const [resolveTarget, setResolveTarget] = React.useState<HandoffItem | null>(null)
  const [resolved, setResolved] = React.useState<HandoffItem[]>([])
  const [loadingResolved, setLoadingResolved] = React.useState(false)
  const [errorResolved, setErrorResolved] = React.useState<string | null>(null)
  const [transcriptTarget, setTranscriptTarget] = React.useState<HandoffItem | null>(null)

  const fetchPending = React.useCallback(async () => {
    setLoadingPending(true)
    setErrorPending(null)
    try {
      const token = await getAccessTokenSilently()
      const res = await handoffApi.list(token, { unclaimed_only: true, limit: 50 })
      setPending(res.items)
    } catch (err: unknown) {
      setErrorPending(err instanceof ApiException ? err.message : "Failed to load pending queue")
    } finally {
      setLoadingPending(false)
    }
  }, [getAccessTokenSilently])

  const fetchInProgress = React.useCallback(async () => {
    setLoadingInProgress(true)
    setErrorInProgress(null)
    try {
      const token = await getAccessTokenSilently()
      const res = await handoffApi.list(token, { unclaimed_only: false, limit: 50 })
      setInProgress(res.items.filter((h) => !!h.assigned_to))
    } catch (err: unknown) {
      setErrorInProgress(err instanceof ApiException ? err.message : "Failed to load in-progress queue")
    } finally {
      setLoadingInProgress(false)
    }
  }, [getAccessTokenSilently])

  const fetchResolved = React.useCallback(async () => {
    setLoadingResolved(true)
    setErrorResolved(null)
    try {
      const token = await getAccessTokenSilently()
      const res = await handoffApi.list(token, { status: "closed", limit: 50 })
      setResolved(res.items)
    } catch (err: unknown) {
      setErrorResolved(err instanceof ApiException ? err.message : "Failed to load resolved conversations")
    } finally {
      setLoadingResolved(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => {
    fetchPending()
    fetchInProgress()
    fetchResolved()
  }, [fetchPending, fetchInProgress, fetchResolved])

  const handleClaim = async (handoffId: string) => {
    setClaiming(handoffId)
    try {
      const token = await getAccessTokenSilently()
      await handoffApi.claim(token, handoffId)
      toast.success("Conversation claimed")
      await Promise.all([fetchPending(), fetchInProgress()])
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to claim conversation")
    } finally {
      setClaiming(null)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([fetchPending(), fetchInProgress(), fetchResolved()])
  }

  const handleReplyTarget = (item: HandoffItem) => { setReplyTarget(item) }
  const handleResolveTarget = (item: HandoffItem) => { setResolveTarget(item) }
  const handleReplyClose = () => { setReplyTarget(null) }
  const handleResolveClose = () => { setResolveTarget(null) }
  const handleReplySent = () => { fetchInProgress() }
  const handleResolved = () => { fetchInProgress(); fetchResolved() }

  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Live Support</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Claim and manage conversations waiting for human support.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pending
                {!loadingPending && pending.length > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0">
                    {pending.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="in-progress">
                In Progress
                {!loadingInProgress && inProgress.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                    {inProgress.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>

            {/* Pending tab */}
            <TabsContent value="pending" className="mt-4">
              {errorPending ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-destructive">{errorPending}</p>
                  <Button variant="outline" size="sm" onClick={fetchPending}>Retry</Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conversation</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Wait time</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingPending ? (
                        Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)
                      ) : pending.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="p-0">
                            <EmptyState label="No conversations waiting for support." />
                          </TableCell>
                        </TableRow>
                      ) : (
                        pending.map((item) => (
                          <PendingRow
                            key={item.id}
                            item={item}
                            onClaim={handleClaim}
                            claiming={claiming}
                          />
                        ))
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* In Progress tab */}
            <TabsContent value="in-progress" className="mt-4">
              {errorInProgress ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-destructive">{errorInProgress}</p>
                  <Button variant="outline" size="sm" onClick={fetchInProgress}>Retry</Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conversation</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Wait time</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingInProgress ? (
                        Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)
                      ) : inProgress.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="p-0">
                            <EmptyState label="No conversations in progress." />
                          </TableCell>
                        </TableRow>
                      ) : (
                        inProgress.map((item) => (
                          <InProgressRow
                            key={item.id}
                            item={item}
                            onReply={handleReplyTarget}
                            onResolve={handleResolveTarget}
                          />
                        ))
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Resolved tab */}
            <TabsContent value="resolved" className="mt-4">
              {errorResolved ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-destructive">{errorResolved}</p>
                  <Button variant="outline" size="sm" onClick={fetchResolved}>Retry</Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conversation</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Resolved at</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingResolved ? (
                        Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)
                      ) : resolved.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="p-0">
                            <EmptyState label="No resolved conversations yet." />
                          </TableCell>
                        </TableRow>
                      ) : (
                        resolved.map((item) => (
                          <ResolvedRow
                            key={item.id}
                            item={item}
                            onView={(i) => setTranscriptTarget(i)}
                          />
                        ))
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialogs */}
        <ReplyDialog
          handoff={replyTarget}
          onClose={handleReplyClose}
          onSent={handleReplySent}
        />
        <ResolveDialog
          handoff={resolveTarget}
          onClose={handleResolveClose}
          onResolved={handleResolved}
        />
        <TranscriptDialog
          handoff={transcriptTarget}
          onClose={() => setTranscriptTarget(null)}
        />
      </DashboardShell>
    </ProtectedRoute>
  )
}
