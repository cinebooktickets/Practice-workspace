"use client"
import React from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth"
import Link from "next/link"
import { agentsApi, creditsApi, handoffApi, ApiException } from "@/lib/api"

type OverviewStats = {
  activeAgents:     number
  totalAgents:      number
  creditsRemaining: number
  pendingHandoffs:  number
}

type StatCardProps = {
  title: string
  value: number | string
  description: string
  loading: boolean
  href?: string
  badge?: { label: string; variant: "default" | "destructive" | "warning" | "success" }
}

function StatCard({ title, value, description, loading, href, badge }: StatCardProps) {
  const content = (
    <Card className={href ? "cursor-pointer hover:border-primary transition-colors" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-20 mb-1" aria-hidden="true" />
            <Skeleton className="h-4 w-32" aria-hidden="true" />
          </>
        ) : (
          <>
            <div className="text-3xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

export default function DashboardPage() {
  const { user, getAccessTokenSilently } = useAuth()
  const [stats, setStats] = React.useState<OverviewStats>({ activeAgents: 0, totalAgents: 0, creditsRemaining: 0, pendingHandoffs: 0 })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchStats = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const [agentsRes, creditsRes, handoffRes] = await Promise.allSettled([
        agentsApi.list(token, { limit: 100 }),
        creditsApi.get(token),
        handoffApi.list(token, { unclaimed_only: true, limit: 100 }),
      ])
      const agents  = agentsRes.status  === "fulfilled" ? agentsRes.value  : null
      const credits = creditsRes.status === "fulfilled" ? creditsRes.value : null
      const handoff = handoffRes.status === "fulfilled" ? handoffRes.value : null
      setStats({
        activeAgents:     agents  ? agents.items.filter((a) => a.is_active).length : 0,
        totalAgents:      agents  ? agents.total : 0,
        creditsRemaining: credits ? credits.credit_balance : 0,
        pendingHandoffs:  handoff ? handoff.items.length : 0,
      })
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Failed to load overview")
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const firstName = user?.name?.split(" ")[0] ?? "there"

  const statCards: StatCardProps[] = [
    {
      title: "Active Agents",
      value: stats.activeAgents,
      description: stats.activeAgents === 0 ? "No agents deployed yet" : "Deployed and accepting conversations",
      loading,
      href: "/dashboard/agents",
      badge: stats.activeAgents === 0 ? { label: "None yet", variant: "warning" } : undefined,
    },
    {
      title: "Credits Remaining",
      value: stats.creditsRemaining.toLocaleString(),
      description: "Resets on your billing cycle",
      loading,
      href: "/dashboard/usage",
      badge: stats.creditsRemaining < 100 ? { label: "Low", variant: "destructive" } : undefined,
    },
    {
      title: "Pending Handoffs",
      value: stats.pendingHandoffs,
      description: stats.pendingHandoffs === 0 ? "No conversations waiting" : "Waiting for a human agent",
      loading,
      href: "/dashboard/live-support",
      badge: stats.pendingHandoffs > 0 ? { label: "Action needed", variant: "destructive" } : undefined,
    },
    {
      title: "Total Agents",
      value: stats.totalAgents,
      description: `${stats.activeAgents} active, ${stats.totalAgents - stats.activeAgents} inactive`,
      loading,
      href: "/dashboard/agents",
    },
  ]

  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className="space-y-8">
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Here&apos;s what&apos;s happening across your agents today.
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null)
                  fetchStats()
                }}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Stat cards grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>

          {/* Empty state — no agents yet */}
          {!loading && stats.activeAgents === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="rounded-full bg-muted p-4">
                  <svg
                    className="h-8 w-8 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-lg">No agents yet</p>
                  <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                    Create your first AI support agent, upload a knowledge base, and deploy it to your website in minutes.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/dashboard/agents">Create your first agent</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick links — always visible once loaded */}
          {!loading && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Quick links
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { href: "/dashboard/agents", label: "Manage Agents", description: "Configure, test and deploy" },
                  { href: "/dashboard/live-support", label: "Live Support Queue", description: "Handle handoff conversations" },
                  { href: "/dashboard/usage", label: "Usage & Credits", description: "Monitor consumption" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg border bg-card p-4 hover:border-primary hover:bg-accent transition-colors"
                  >
                    <p className="font-medium text-sm">{link.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </DashboardShell>
    </ProtectedRoute>
  )
}
