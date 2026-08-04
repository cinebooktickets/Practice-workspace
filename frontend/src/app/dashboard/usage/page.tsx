"use client"
import React from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/context/auth"
import { toast } from "sonner"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"
import {
  creditsApi,
  reportsApi,
  OrgCreditsResponse,
  UsageReportResponse,
  ApiException,
} from "@/lib/api"

const PLAN_LABELS: Record<string, string> = {
  free:       "Free",
  pro:        "Pro",
  enterprise: "Enterprise",
}

function formatShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function UsagePage() {
  const { user, getAccessTokenSilently } = useAuth()
  const isAdmin = user?.role === "admin"

  const [credits, setCredits]             = React.useState<OrgCreditsResponse | null>(null)
  const [report, setReport]               = React.useState<UsageReportResponse | null>(null)
  const [loading, setLoading]             = React.useState(true)
  const [error, setError]                 = React.useState<string | null>(null)
  const [topupOpen, setTopupOpen]         = React.useState(false)
  const [topupAmount, setTopupAmount]     = React.useState("")
  const [topupReason, setTopupReason]     = React.useState("")
  const [topupLoading, setTopupLoading]   = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const [c, r] = await Promise.all([
        creditsApi.get(token),
        reportsApi.usageReport(token),
      ])
      setCredits(c)
      setReport(r)
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : "Failed to load usage data"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleTopup = React.useCallback(async () => {
    const amount = parseInt(topupAmount, 10)
    if (!amount || amount <= 0) {
      toast.error("Enter a positive credit amount")
      return
    }
    setTopupLoading(true)
    try {
      const token = await getAccessTokenSilently()
      const result = await creditsApi.topup(token, { amount, reason: topupReason.trim() || null })
      setCredits(prev => prev ? { ...prev, credit_balance: result.credit_balance, updated_at: result.updated_at } : prev)
      toast.success(`${amount.toLocaleString()} credits added`)
      setTopupOpen(false)
      setTopupAmount("")
      setTopupReason("")
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : "Top-up failed"
      toast.error(msg)
    } finally {
      setTopupLoading(false)
    }
  }, [topupAmount, topupReason, getAccessTokenSilently])

  const handleTopupAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => setTopupAmount(e.target.value)
  const handleTopupReasonChange = (e: React.ChangeEvent<HTMLInputElement>) => setTopupReason(e.target.value)

  const chartData = (credits?.recent_usage ?? []).map(d => ({
    date:     formatShortDate(d.usage_date),
    Messages: d.message_count,
    Tokens:   d.tokens_used,
  }))

  const totalMessages = report?.total_messages ?? 0
  const totalTokens   = report?.total_tokens   ?? 0

  return (
    <ProtectedRoute>
      <TooltipProvider>
        <DashboardShell>
          <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Usage &amp; Credits</h1>
                <p className="text-muted-foreground mt-1">
                  Monitor your credit balance and message volume.
                </p>
              </div>
              {isAdmin ? (
                <Button onClick={() => setTopupOpen(true)}>Top up credits</Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled>Top up credits</Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Only admins can manage billing</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={fetchData}>Retry</Button>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="sm:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Credit balance</CardTitle>
                    {!loading && credits && (
                      <Badge variant="secondary">{PLAN_LABELS[credits.plan] ?? credits.plan} plan</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-40" aria-hidden="true" />
                      <Skeleton className="h-2 w-full" aria-hidden="true" />
                      <Skeleton className="h-4 w-48" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">{(credits?.credit_balance ?? 0).toLocaleString()}</span>
                        <span className="text-muted-foreground text-sm">credits remaining</span>
                      </div>
                      <Progress
                        value={Math.min(100, Math.round(((credits?.credit_balance ?? 0) / 10000) * 100))}
                        className="h-2" aria-hidden="true"
                      />
                      <p className="text-xs text-muted-foreground">
                        Last updated: {credits ? new Date(credits.updated_at).toLocaleString() : "—"}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Last 7 days</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? (
                    <>
                      <Skeleton className="h-6 w-24" aria-hidden="true" />
                      <Skeleton className="h-6 w-24" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-2xl font-bold">{totalMessages.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total messages</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total tokens</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Daily chart — from credits.recent_usage (last 30 days) */}
            <Card>
              <CardHeader>
                <CardTitle>Daily messages — last 30 days</CardTitle>
                <CardDescription>Message volume per day across all agents.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-64 w-full" aria-hidden="true" />
                ) : chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                    No usage data in the last 30 days
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "hsl(var(--foreground))",
                        }}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="Messages"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#colorMessages)"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Per-agent breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Per-agent breakdown — last 7 days</CardTitle>
                <CardDescription>Token and message usage split by agent.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" aria-hidden="true" />)}
                  </div>
                ) : !report || report.per_agent.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No agent activity in the last 7 days</p>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Messages</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.per_agent.map(a => (
                        <TableRow key={a.agent_id}>
                          <TableCell className="font-medium">{a.agent_name}</TableCell>
                          <TableCell className="text-right">{a.total_messages.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{a.total_tokens.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DashboardShell>
      </TooltipProvider>

      {/* Top-up dialog */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Top up credits</DialogTitle>
            <DialogDescription>Add credits to your organization&apos;s balance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="topup-amount">Amount</Label>
              <Input
                id="topup-amount"
                type="number"
                min={1}
                placeholder="e.g. 1000"
                value={topupAmount}
                onChange={handleTopupAmountChange}
              />
              <p className="text-xs text-muted-foreground">Must be a positive integer</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topup-reason">
                Reason <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="topup-reason"
                placeholder="e.g. Monthly top-up"
                value={topupReason}
                onChange={handleTopupReasonChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopupOpen(false)} disabled={topupLoading}>
              Cancel
            </Button>
            <Button onClick={handleTopup} disabled={topupLoading}>
              {topupLoading ? "Adding…" : "Add credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}
