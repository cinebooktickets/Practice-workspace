"use client"
import React from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/context/auth"
import { auditApi, ApiException, type AuditLogEntryResponse } from "@/lib/api"

type ActionVariant = "default" | "destructive" | "warning" | "success" | "secondary"

const ACTION_VARIANTS: Record<string, ActionVariant> = {
  create: "success",
  update: "default",
  delete: "destructive",
  invite: "success",
  remove: "warning",
  login:  "secondary",
  logout: "secondary",
}

function actionBadgeVariant(action: string): ActionVariant {
  const key = action.split(".")[0]?.toLowerCase() ?? ""
  return ACTION_VARIANTS[key] ?? "default"
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month:  "short",
    day:    "numeric",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  })
}

const PAGE_SIZE = 25

export default function AuditPage() {
  const { user, getAccessTokenSilently } = useAuth()
  const isAdmin = user?.role === "admin"

  const [entries, setEntries] = React.useState<AuditLogEntryResponse[]>([])
  const [total, setTotal] = React.useState(0)
  const [offset, setOffset] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [loadingMore, setLoadingMore] = React.useState(false)

  const fetchEntries = async (reset = false) => {
    const nextOffset = reset ? 0 : offset + PAGE_SIZE
    if (reset) setLoading(true)
    else setLoadingMore(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const result = await auditApi.list(token, { limit: PAGE_SIZE, offset: nextOffset })
      setEntries((prev) => reset ? result.items : [...prev, ...result.items])
      setTotal(result.total)
      setOffset(nextOffset)
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError("Failed to load audit log")
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  React.useEffect(() => {
    if (isAdmin) fetchEntries(true)
    else setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const filtered = search
    ? entries.filter(
        (e) =>
          e.action.toLowerCase().includes(search.toLowerCase()) ||
          e.entity_type.toLowerCase().includes(search.toLowerCase()) ||
          (e.user_id ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : entries

  const hasMore = entries.length < total

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <DashboardShell>
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>The audit log is only accessible to organization admins.</AlertDescription>
          </Alert>
        </DashboardShell>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className="space-y-6">
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-muted-foreground mt-1">
              All organization actions performed by team members.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => fetchEntries(true)}>
                Retry
              </Button>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Events</CardTitle>
                  <CardDescription>
                    {loading ? "Loading…" : `${total} total event${total !== 1 ? "s" : ""}`}
                  </CardDescription>
                </div>
                <Input
                  placeholder="Filter by action or entity type…"
                  value={search}
                  onChange={handleSearchChange}
                  className="max-w-xs"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  {search ? (
                    <p>No events match &ldquo;{search}&rdquo;</p>
                  ) : (
                    <div>
                      <p className="font-medium">No audit events yet</p>
                      <p className="text-sm mt-1">Actions taken by your team will appear here.</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(entry.created_at)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {entry.user_id ? entry.user_id.slice(0, 8) + "…" : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={actionBadgeVariant(entry.action)} className="font-mono text-xs">
                              {entry.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.entity_type}
                            {entry.entity_id && (
                              <span className="ml-1 font-mono text-xs opacity-60">{entry.entity_id.slice(0, 8)}…</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                  {hasMore && (
                    <div className="p-4 flex justify-center border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loadingMore}
                        onClick={() => fetchEntries(false)}
                      >
                        {loadingMore ? "Loading…" : "Load more"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </ProtectedRoute>
  )
}
