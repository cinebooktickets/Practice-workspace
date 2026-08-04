"use client"
import React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/context/auth"
import { conversationsApi, ApiException } from "@/lib/api"
import type { ConversationItem, ConversationStatus, MessageOut, ConversationSearchResult } from "@/lib/api"
import { toast } from "sonner"
import { MessageSquare, Search, Trash2, RefreshCw, ChevronDown, User, Bot } from "lucide-react"

type Props = {
  agentId: string
}

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

type MessageThreadDialogProps = {
  agentId:     string
  convId:      string | null
  convTitle:   string | null
  onClose:     () => void
}

function MessageThreadDialog({ agentId, convId, convTitle, onClose }: MessageThreadDialogProps) {
  const { getAccessTokenSilently } = useAuth()
  const [messages,    setMessages]    = React.useState<MessageOut[]>([])
  const [loading,     setLoading]     = React.useState(false)
  const [error,       setError]       = React.useState<string | null>(null)
  const [nextCursor,  setNextCursor]  = React.useState<string | null>(null)
  const [loadingMore, setLoadingMore] = React.useState(false)

  const fetchMessages = React.useCallback(async (cursor?: string) => {
    if (!convId) return
    try {
      const token = await getAccessTokenSilently()
      const res   = await conversationsApi.listMessages(token, agentId, convId, { limit: 50, cursor })
      if (cursor) {
        setMessages(prev => [...prev, ...res.items])
      } else {
        setMessages(res.items)
      }
      setNextCursor(res.next_cursor)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Failed to load messages")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [getAccessTokenSilently, agentId, convId])

  React.useEffect(() => {
    if (!convId) return
    setMessages([])
    setNextCursor(null)
    setError(null)
    setLoading(true)
    fetchMessages()
  }, [convId, fetchMessages])

  const handleLoadMore = () => {
    if (!nextCursor) return
    setLoadingMore(true)
    fetchMessages(nextCursor)
  }

  return (
    <Dialog open={!!convId} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
            {convTitle ?? "Untitled conversation"}
          </DialogTitle>
          <DialogDescription>
            Message thread — {messages.length} message{messages.length !== 1 ? "s" : ""} loaded
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchMessages() }}>
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <p className="text-sm text-muted-foreground">No messages in this conversation.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    ROLE_CLASS[msg.role] ?? ROLE_CLASS.system
                  }`}>
                    {ROLE_ICON[msg.role] ?? null}
                    {msg.role}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                {(msg.total_tokens != null || msg.citations?.length) && (
                  <div className="flex gap-3 text-xs text-muted-foreground pt-0.5">
                    {msg.total_tokens != null && (
                      <span>{msg.total_tokens} tokens</span>
                    )}
                    {msg.citations?.length ? (
                      <span>{msg.citations.length} citation{msg.citations.length !== 1 ? "s" : ""}</span>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                <ChevronDown className="w-4 h-4 mr-1" aria-hidden="true" />
                {loadingMore ? "Loading…" : "Load older messages"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const STATUS_LABELS: Record<ConversationStatus, string> = {
  open:    "Open",
  handoff: "Handoff",
  closed:  "Closed",
}

const STATUS_VARIANT: Record<ConversationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  open:    "default",
  handoff: "outline",
  closed:  "secondary",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function ConversationsTab({ agentId }: Props) {
  const { getAccessTokenSilently } = useAuth()

  const [items,         setItems]         = React.useState<ConversationItem[]>([])
  const [loading,       setLoading]       = React.useState(true)
  const [error,         setError]         = React.useState<string | null>(null)
  const [nextCursor,    setNextCursor]    = React.useState<string | null>(null)
  const [loadingMore,   setLoadingMore]   = React.useState(false)
  const [statusFilter,  setStatusFilter]  = React.useState<ConversationStatus | "">("")
  const [search,        setSearch]        = React.useState("")
  const [searchInput,   setSearchInput]   = React.useState("")
  const [deleteId,      setDeleteId]      = React.useState<string | null>(null)
  const [deleting,      setDeleting]      = React.useState(false)
  const [threadConvId,  setThreadConvId]  = React.useState<string | null>(null)
  const [threadTitle,   setThreadTitle]   = React.useState<string | null>(null)
  const [searchMode,    setSearchMode]    = React.useState<"list" | "content">("list")
  const [searchResults, setSearchResults] = React.useState<ConversationSearchResult[]>([])
  const [searchTotal,   setSearchTotal]   = React.useState(0)
  const [searching,     setSearching]     = React.useState(false)
  const [searchOffset,  setSearchOffset]  = React.useState(0)
  const SEARCH_LIMIT = 20

  const fetchConversations = React.useCallback(async (cursor?: string) => {
    try {
      const token = await getAccessTokenSilently()
      const res   = await conversationsApi.list(token, agentId, {
        limit:  20,
        cursor,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search       ? { search }               : {}),
      })
      if (cursor) {
        setItems(prev => [...prev, ...res.items])
      } else {
        setItems(res.items)
      }
      setNextCursor(res.next_cursor)
      setError(null)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to load conversations"
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [getAccessTokenSilently, agentId, statusFilter, search])

  React.useEffect(() => {
    setLoading(true)
    fetchConversations()
  }, [fetchConversations])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchMode === "content") {
      runContentSearch(searchInput, 0)
    } else {
      setSearch(searchInput)
    }
  }

  const runContentSearch = async (q: string, offset: number) => {
    if (!q.trim()) return
    setSearching(true)
    try {
      const token = await getAccessTokenSilently()
      const res   = await conversationsApi.search(token, agentId, { q, limit: SEARCH_LIMIT, offset })
      if (offset === 0) {
        setSearchResults(res.items)
      } else {
        setSearchResults(prev => [...prev, ...res.items])
      }
      setSearchTotal(res.total)
      setSearchOffset(offset)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Search failed"
      toast.error(msg)
    } finally {
      setSearching(false)
    }
  }

  const clearSearch = () => {
    setSearch("")
    setSearchInput("")
    setStatusFilter("")
    setSearchResults([])
    setSearchTotal(0)
    setSearchOffset(0)
  }

  const handleLoadMore = () => {
    if (!nextCursor) return
    setLoadingMore(true)
    fetchConversations(nextCursor)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const token = await getAccessTokenSilently()
      await conversationsApi.delete(token, agentId, deleteId)
      setItems(prev => prev.filter(c => c.id !== deleteId))
      toast.success("Conversation deleted")
      setDeleteId(null)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to delete conversation"
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const deleteTarget = items.find(c => c.id === deleteId)

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder={searchMode === "content" ? "Search message content…" : "Search conversations…"}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button type="submit" variant="outline" size="sm">Search</Button>
            </form>

            {/* Search mode toggle */}
            <Button
              variant={searchMode === "content" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                const next = searchMode === "content" ? "list" : "content"
                setSearchMode(next)
                if (next === "list") { setSearchResults([]); setSearchTotal(0) }
              }}
              title="Toggle message content search"
            >
              <MessageSquare className="w-4 h-4 mr-1.5" aria-hidden="true" />
              {searchMode === "content" ? "Content search on" : "Search messages"}
            </Button>

            {/* Status filter (only in list mode) */}
            {searchMode === "list" && (
            <Select
              value={statusFilter || "all"}
              onValueChange={(v) => setStatusFilter(v === "all" ? "" : v as ConversationStatus)}
            >
              <SelectTrigger className="w-[120px] sm:w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="handoff">Handoff</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* ── Content search results ─────────────────────────── */}
          {searchMode === "content" && (searchResults.length > 0 || searching) && (
            <div>
              {searching && searchOffset === 0 ? (
                <div className="divide-y">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-16 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="px-6 py-2 text-xs text-muted-foreground border-b">
                    {searchTotal} result{searchTotal !== 1 ? "s" : ""} for &ldquo;{searchInput}&rdquo;
                  </div>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Matches</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium max-w-[280px] truncate">
                            {r.title ?? <span className="text-muted-foreground italic">Untitled</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{r.match_count}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(r.updated_at)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="View messages"
                              onClick={() => { setThreadConvId(r.id); setThreadTitle(r.title ?? null) }}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                  {searchResults.length < searchTotal && (
                    <div className="flex justify-center py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runContentSearch(searchInput, searchOffset + SEARCH_LIMIT)}
                        disabled={searching}
                      >
                        {searching ? "Loading…" : "Load more"}
                      </Button>
                    </div>
                  )}
                  <div className="flex justify-center pb-3">
                    <Button variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Standard list ──────────────────────────────────── */}
          {(searchMode === "list" || (searchMode === "content" && searchResults.length === 0 && !searching)) && (
          <>
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-4 w-48" aria-hidden="true" />
                  <Skeleton className="h-5 w-16 ml-2" aria-hidden="true" />
                  <Skeleton className="h-4 w-24 ml-auto" aria-hidden="true" />
                  <Skeleton className="h-8 w-8" aria-hidden="true" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchConversations() }}>
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <MessageSquare className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">
                {search || statusFilter ? "No conversations match your filters" : "No conversations yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs text-center">
                {search || statusFilter
                  ? "Try adjusting the status filter or search term."
                  : "Conversations will appear here once users start chatting with this agent."}
              </p>
              {(search || statusFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearch(""); setSearchInput(""); setStatusFilter("") }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[60px]" />
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell className="font-medium max-w-[280px] truncate">
                        {conv.title ?? <span className="text-muted-foreground italic">Untitled</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[conv.status]}>
                          {STATUS_LABELS[conv.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {conv.user_id ? "Authenticated" : "Anonymous"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(conv.updated_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="View messages"
                          onClick={() => { setThreadConvId(conv.id); setThreadTitle(conv.title ?? null) }}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(conv.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
          </>
          )}
        </CardContent>
      </Card>

      {/* Message thread dialog */}
      <MessageThreadDialog
        agentId={agentId}
        convId={threadConvId}
        convTitle={threadTitle}
        onClose={() => { setThreadConvId(null); setThreadTitle(null) }}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.title
                ? <>This will permanently delete <strong>&ldquo;{deleteTarget.title}&rdquo;</strong> and all its messages. This cannot be undone.</>
                : "This will permanently delete the conversation and all its messages. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
