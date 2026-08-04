"use client"
import React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RefreshCw, MessageSquare, Zap, ThumbsUp, ThumbsDown } from "lucide-react"
import { useAuth } from "@/context/auth"
import { toast } from "sonner"
import { agentAnalyticsApi, AgentAnalyticsResponse, ApiException } from "@/lib/api"

type Props = { agentId: string }

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function AnalyticsTab({ agentId }: Props) {
  const { getAccessTokenSilently } = useAuth()

  // Default window: last 30 days
  const defaultEnd   = React.useMemo(() => toInputDate(new Date()), [])
  const defaultStart = React.useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return toInputDate(d)
  }, [])

  const [startDate, setStartDate] = React.useState(defaultStart)
  const [endDate, setEndDate]     = React.useState(defaultEnd)
  const [data, setData]           = React.useState<AgentAnalyticsResponse | null>(null)
  const [loading, setLoading]     = React.useState(true)
  const [error, setError]         = React.useState<string | null>(null)

  const fetchAnalytics = React.useCallback(async (start: string, end: string) => {
    setLoading(true)
    setError(null)
    try {
      const token  = await getAccessTokenSilently()
      const result = await agentAnalyticsApi.get(token, agentId, { start_date: start, end_date: end })
      setData(result)
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : "Failed to load analytics"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [agentId, getAccessTokenSilently])

  React.useEffect(() => {
    fetchAnalytics(startDate, endDate)
  }, [fetchAnalytics, startDate, endDate])

  const handleApply = () => {
    if (startDate > endDate) {
      toast.error("Start date must be before end date")
      return
    }
    fetchAnalytics(startDate, endDate)
  }

  const chartData = data?.daily_stats.map(d => ({
    date:     formatDate(d.usage_date),
    Messages: d.message_count,
    Tokens:   d.tokens_used,
  })) ?? []

  const feedbackTotal = data
    ? data.feedback_summary.thumbs_up + data.feedback_summary.thumbs_down
    : 0

  const positiveRate = feedbackTotal > 0
    ? Math.round((data!.feedback_summary.thumbs_up / feedbackTotal) * 100)
    : null

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">Analytics</CardTitle>
              <CardDescription>Message volume and credit usage for this agent.</CardDescription>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={toInputDate(new Date())}
                  onChange={e => setEndDate(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" onClick={handleApply} disabled={loading} className="h-8">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Apply
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => fetchAnalytics(startDate, endDate)}>
            Retry
          </Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Total messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" aria-hidden="true" />
            ) : (
              <p className="text-3xl font-bold">{(data?.total_messages ?? 0).toLocaleString()}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-4 w-4" aria-hidden="true" />
              Total tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" aria-hidden="true" />
            ) : (
              <p className="text-3xl font-bold">{(data?.total_tokens ?? 0).toLocaleString()}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              Positive feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" aria-hidden="true" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">
                  {positiveRate !== null ? `${positiveRate}%` : "—"}
                </p>
                {feedbackTotal > 0 && (
                  <span className="text-xs text-muted-foreground">{feedbackTotal} rated</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Daily messages</CardTitle>
          <CardDescription>Message volume per day in the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" aria-hidden="true" />
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
              No data in this date range
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

      {/* Bottom row: top keywords + feedback summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Top keywords */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top keywords</CardTitle>
            <CardDescription>Most frequent terms in the last 200 assistant messages.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" aria-hidden="true" />
                ))}
              </div>
            ) : !data || data.top_keywords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No keywords yet</p>
            ) : (
              <div className="space-y-2">
                {data.top_keywords.map(kw => (
                  <div key={kw.keyword} className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{kw.keyword}</span>
                    <Badge variant="secondary" className="shrink-0">{kw.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feedback summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Feedback breakdown</CardTitle>
            <CardDescription>All feedback for this agent in the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" aria-hidden="true" />
                ))}
              </div>
            ) : !data ? null : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm">
                    <ThumbsUp className="h-4 w-4 text-green-500" aria-hidden="true" /> Thumbs up
                  </span>
                  <Badge variant="secondary">{data.feedback_summary.thumbs_up}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm">
                    <ThumbsDown className="h-4 w-4 text-destructive" aria-hidden="true" /> Thumbs down
                  </span>
                  <Badge variant="secondary">{data.feedback_summary.thumbs_down}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending review</span>
                  <Badge variant="outline">{data.feedback_summary.pending}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Resolved</span>
                  <Badge variant="outline">{data.feedback_summary.resolved}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Dismissed</span>
                  <Badge variant="outline">{data.feedback_summary.dismissed}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
