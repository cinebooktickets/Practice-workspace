"use client"
import React from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth"
import { toast } from "sonner"
import Link from "next/link"
import {
  ArrowLeft,
  Bot,
  Settings2,
  BookOpen,
  KeyRound,
  Code2,
  BarChart2,
  MessageSquare,
  ThumbsUp,
  Puzzle,
  FlaskConical,
} from "lucide-react"
import { ConfigTab } from "./_tabs/config-tab"
import { KnowledgeBaseTab } from "./_tabs/knowledge-base-tab"
import { ApiKeysTab } from "./_tabs/api-keys-tab"
import { WidgetTab } from "./_tabs/widget-tab"
import { AnalyticsTab } from "./_tabs/analytics-tab"
import { ConversationsTab } from "./_tabs/conversations-tab"
import { FeedbackTab } from "./_tabs/feedback-tab"
import { IntegrationsTab } from "./_tabs/integrations-tab"
import { agentsApi, AgentResponse, ApiException } from "@/lib/api"

const TABS = [
  { value: "config",        label: "Config",         icon: Settings2   },
  { value: "knowledge-base",label: "Knowledge Base", icon: BookOpen    },
  { value: "api-keys",      label: "API Keys",       icon: KeyRound    },
  { value: "widget",        label: "Widget",         icon: Code2       },
  { value: "analytics",     label: "Analytics",      icon: BarChart2   },
  { value: "conversations", label: "Conversations",  icon: MessageSquare},
  { value: "feedback",      label: "Feedback",       icon: ThumbsUp    },
  { value: "integrations",  label: "Integrations",   icon: Puzzle      },
] as const

type TabValue = typeof TABS[number]["value"]

export default function AgentDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const { user, getAccessTokenSilently } = useAuth()
  const agentId  = params.id as string

  const [agent, setAgent]     = React.useState<AgentResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<TabValue>("config")

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const token = await getAccessTokenSilently()
        const data  = await agentsApi.get(token, agentId)
        if (!cancelled) setAgent(data)
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiException ? err.message : "Failed to load agent"
          toast.error(msg)
          router.push("/dashboard/agents")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [agentId, getAccessTokenSilently, router])

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue)
  }

  return (
    <ProtectedRoute>
      <DashboardShell>
        {/* Back nav */}
        <div className="mb-4">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground" asChild>
            <Link href="/dashboard/agents">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              All Agents
            </Link>
          </Button>
        </div>

        {/* Agent header */}
        {loading ? (
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="w-10 h-10 rounded-lg" aria-hidden="true" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" aria-hidden="true" />
              <Skeleton className="h-3.5 w-64" aria-hidden="true" />
            </div>
          </div>
        ) : agent ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{agent.name}</h1>
                  <Badge variant={agent.is_active ? "success" : "default"} className="capitalize text-xs">
                    {agent.is_active ? "active" : "inactive"}
                  </Badge>
                </div>
                {agent.system_prompt && (
                  <p className="text-sm text-muted-foreground line-clamp-1">{agent.system_prompt}</p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto" asChild>
              <Link href={`/dashboard/agents/${agentId}/sandbox`}>
                <FlaskConical className="w-4 h-4" aria-hidden="true" />
                Test in Sandbox
              </Link>
            </Button>
          </div>
        ) : null}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex w-full overflow-x-auto h-auto gap-0.5 bg-muted/50 p-1 rounded-lg mb-6 flex-wrap sm:flex-nowrap">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="config">
            <ConfigTab
              agentId={agentId}
              isAdmin={user?.role === "admin"}
              onAgentUpdate={(updated) => setAgent((prev) => prev ? { ...prev, ...updated } : prev)}
            />
          </TabsContent>

          <TabsContent value="knowledge-base">
            <KnowledgeBaseTab agentId={agentId} isAdmin={user?.role === "admin"} />
          </TabsContent>

          <TabsContent value="api-keys">
            <ApiKeysTab agentId={agentId} isAdmin={user?.role === "admin"} />
          </TabsContent>

          <TabsContent value="widget">
            <WidgetTab agentId={agentId} isAdmin={user?.role === "admin"} />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab agentId={agentId} />
          </TabsContent>

          <TabsContent value="conversations">
            <ConversationsTab agentId={agentId} />
          </TabsContent>

          <TabsContent value="feedback">
            <FeedbackTab agentId={agentId} />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsTab agentId={agentId} isAdmin={user?.role === "admin"} />
          </TabsContent>
        </Tabs>
      </DashboardShell>
    </ProtectedRoute>
  )
}
