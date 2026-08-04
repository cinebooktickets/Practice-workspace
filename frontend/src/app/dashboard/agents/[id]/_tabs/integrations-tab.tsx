"use client"
import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/context/auth"
import {
  integrationsApi,
  integrationToolsApi,
  agentToolCallsApi,
  ApiException,
  type IntegrationAuthType,
  type IntegrationResponse,
  type IntegrationCreate,
  type IntegrationUpdate,
  type IntegrationToolResponse,
  type IntegrationToolCreate,
  type IntegrationToolUpdate,
  type BodyTemplateMode,
  type TruncationStrategy,
  type ToolExample,
  type ToolVersionResponse,
  type ToolCallLogResponse,
  type ToolTestRequest,
  type ToolTestResponse,
} from "@/lib/api"
import { toast } from "sonner"
import { Plus, RefreshCw, Globe, Lock, AlertCircle, ChevronRight, Trash2, WifiOff, Check, Wrench, ChevronDown, ChevronUp, FlaskConical, X, BookOpen } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  agentId: string
  isAdmin: boolean
}

type CreateForm = {
  name:            string
  base_url:        string
  description:     string
  auth_type:       IntegrationAuthType
  is_active:       boolean
}

type CreateErrors = Partial<Record<keyof Omit<CreateForm, "is_active" | "auth_type">, string>>

const AUTH_TYPE_LABELS: Record<IntegrationAuthType, string> = {
  none:                     "None",
  api_key:                  "API Key",
  bearer:                   "Bearer Token",
  oauth2_client_credentials: "OAuth2 Client Credentials",
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}

// ─── Create Integration Sheet ─────────────────────────────────────────────────

type CreateSheetProps = {
  open:    boolean
  agentId: string
  onClose: () => void
  onCreated: (integration: IntegrationResponse) => void
}

function CreateIntegrationSheet({ open, agentId, onClose, onCreated }: CreateSheetProps) {
  const { getAccessTokenSilently } = useAuth()

  const EMPTY_FORM: CreateForm = {
    name:        "",
    base_url:    "",
    description: "",
    auth_type:   "none",
    is_active:   true,
  }

  const [form,       setForm]       = React.useState<CreateForm>(EMPTY_FORM)
  const [errors,     setErrors]     = React.useState<CreateErrors>({})
  const [saving,     setSaving]     = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setErrors({})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const validate = (): boolean => {
    const errs: CreateErrors = {}
    if (!form.name.trim())     errs.name     = "Name is required"
    if (!form.base_url.trim()) errs.base_url = "Base URL is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const body: IntegrationCreate = {
        name:        form.name.trim(),
        base_url:    form.base_url.trim(),
        description: form.description.trim() || null,
        auth_type:   form.auth_type,
        is_active:   form.is_active,
      }
      const created = await integrationsApi.create(token, agentId, body)
      toast.success("Integration created")
      onCreated(created)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to create integration"
      toast.error(msg, { duration: Infinity })
    } finally {
      setSaving(false)
    }
  }

  const setField = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key in errors) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Integration</SheetTitle>
          <SheetDescription>
            Connect an external API to this agent. Credentials are encrypted at rest.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="int-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="int-name"
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("name", e.target.value)}
              placeholder="e.g. Salesforce CRM"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "int-name-error" : undefined}
            />
            {errors.name && <p id="int-name-error" className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <Label htmlFor="int-base-url">Base URL <span className="text-destructive">*</span></Label>
            <Input
              id="int-base-url"
              value={form.base_url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("base_url", e.target.value)}
              placeholder="https://api.example.com"
              aria-invalid={!!errors.base_url}
              aria-describedby={errors.base_url ? "int-base-url-error" : undefined}
            />
            {errors.base_url && <p id="int-base-url-error" className="text-xs text-destructive">{errors.base_url}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="int-desc">Description</Label>
            <Textarea
              id="int-desc"
              value={form.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField("description", e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          {/* Auth Type */}
          <div className="space-y-1.5">
            <Label htmlFor="int-auth-type">Auth Type</Label>
            <Select
              value={form.auth_type}
              onValueChange={(v: IntegrationAuthType) => setField("auth_type", v)}
            >
              <SelectTrigger id="int-auth-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AUTH_TYPE_LABELS) as IntegrationAuthType[]).map(t => (
                  <SelectItem key={t} value={t}>{AUTH_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active */}
          <div className="flex items-center gap-3">
            <Switch
              id="int-active"
              checked={form.is_active}
              onCheckedChange={(v: boolean) => setField("is_active", v)}
            />
            <Label htmlFor="int-active">Active</Label>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Creating…" : "Create Integration"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ─── Integrations List Row ─────────────────────────────────────────────────────

type IntegrationRowProps = {
  integration: IntegrationResponse
  onManage:    (integration: IntegrationResponse) => void
}

function IntegrationRow({ integration, onManage }: IntegrationRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Globe className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{integration.name}</p>
          <p className="text-xs text-muted-foreground truncate">{integration.base_url}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <Badge variant={integration.auth_type === "none" ? "outline" : "secondary"} className="hidden sm:inline-flex">
          <Lock className="w-3 h-3 mr-1" aria-hidden="true" />
          {AUTH_TYPE_LABELS[integration.auth_type]}
        </Badge>
        <Badge variant={integration.is_active ? "default" : "secondary"}>
          {integration.is_active ? "Active" : "Inactive"}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => onManage(integration)}
          aria-label={`Manage ${integration.name}`}
        >
          Manage <ChevronRight className="w-3 h-3" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

// ─── Tool Docs Button ─────────────────────────────────────────────────────────

function ToolDocsButton() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="How to create a tool">
        <BookOpen className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Docs
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How to Create a Tool</DialogTitle>
            <DialogDescription>
              Tools define the HTTP calls this integration makes on behalf of the agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 text-sm">

            {/* Name */}
            <section className="space-y-1">
              <h3 className="font-semibold">Name</h3>
              <p className="text-muted-foreground">
                A short, snake_case identifier shown to the LLM (e.g. <code className="bg-muted px-1 rounded text-xs">get_user_profile</code>).
                Use descriptive names — the LLM uses this to decide which tool to call.
              </p>
            </section>

            <Separator />

            {/* HTTP Method + Path Template */}
            <section className="space-y-1">
              <h3 className="font-semibold">HTTP Method &amp; Path Template</h3>
              <p className="text-muted-foreground">
                Choose the HTTP verb and enter the path relative to the integration's Base URL.
                Use <code className="bg-muted px-1 rounded text-xs">{"{variable}"}</code> placeholders for dynamic segments that the LLM will fill in.
              </p>
              <p className="text-muted-foreground">
                Example path: <code className="bg-muted px-1 rounded text-xs">/v1/users/{"{user_id}"}</code>
              </p>
            </section>

            <Separator />

            {/* Body Template */}
            <section className="space-y-1">
              <h3 className="font-semibold">Body Template (JSON)</h3>
              <p className="text-muted-foreground">
                For <code className="bg-muted px-1 rounded text-xs">POST</code> / <code className="bg-muted px-1 rounded text-xs">PUT</code> / <code className="bg-muted px-1 rounded text-xs">PATCH</code> requests,
                write a JSON body with <code className="bg-muted px-1 rounded text-xs">{"{{variable}}"}</code> placeholders.
                The agent will substitute the correct values at call time.
              </p>
              <pre className="rounded-md border bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap">{`{
  "email": "{{email}}",
  "showtime_id": "{{showtime_id}}",
  "seat_labels": "{{seat_labels}}"
}`}</pre>
              <p className="text-muted-foreground text-xs">
                <strong>Mode:</strong> <em>json-strict</em> sends a validated JSON body.{" "}
                <em>template</em> sends the body as a raw string with substitutions applied.
              </p>
            </section>

            <Separator />

            {/* Controls */}
            <section className="space-y-1">
              <h3 className="font-semibold">Controls</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Timeout (ms)</strong> — max milliseconds to wait for the API response (default 15 000).</li>
                <li><strong>Retry count</strong> — how many times to retry on failure before giving up.</li>
                <li><strong>Max response chars</strong> — truncates long API responses fed to the LLM. 0 = no limit.</li>
                <li><strong>Truncation</strong> — <em>head</em> keeps the start; <em>tail</em> keeps the end of the response.</li>
                <li><strong>Retry on</strong> — HTTP status codes that trigger a retry (e.g. 429, 503).</li>
              </ul>
            </section>

            <Separator />

            {/* Error Messages */}
            <section className="space-y-1">
              <h3 className="font-semibold">Error Messages</h3>
              <p className="text-muted-foreground">
                Map HTTP status codes to human-friendly messages shown to the LLM instead of raw API errors.
                Add one row per status code.
              </p>
              <pre className="rounded-md border bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap">{`404 → "That item doesn't exist."
409 → "A conflict occurred — try again."`}</pre>
            </section>

            <Separator />

            {/* Few-shot Examples */}
            <section className="space-y-1">
              <h3 className="font-semibold">Few-shot Examples</h3>
              <p className="text-muted-foreground">
                Provide up to 5 user message / tool args pairs. The LLM uses these to understand when and how to call the tool.
              </p>
              <p className="text-muted-foreground">
                <strong>User message:</strong> what the user might say to trigger this tool.
                <br />
                <strong>Tool args (JSON):</strong> the exact arguments the tool should be called with.
              </p>
              <pre className="rounded-md border bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap">{`User message: "Book 2 seats for Dune at 8pm, email foo@bar.com"
Tool args:
{
  "email": "foo@bar.com",
  "showtime_id": "st_dune_pt2_0",
  "seat_labels": "A1,A2"
}`}</pre>
            </section>

            <Separator />

            {/* Response Extract Path */}
            <section className="space-y-1">
              <h3 className="font-semibold">Response Extract Path</h3>
              <p className="text-muted-foreground">
                A JSONPath expression to pull a specific field out of the API response before passing it to the LLM.
                Leave as <code className="bg-muted px-1 rounded text-xs">$</code> to pass the full response.
              </p>
              <p className="text-muted-foreground">
                Example: <code className="bg-muted px-1 rounded text-xs">$.data.items</code> extracts only the{" "}
                <code className="bg-muted px-1 rounded text-xs">items</code> array from a nested response.
              </p>
            </section>

          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Agent Tool Calls Section ─────────────────────────────────────────────────

type AgentToolCallsSectionProps = {
  agentId: string
}

function AgentToolCallsSection({ agentId }: AgentToolCallsSectionProps) {
  const { getAccessTokenSilently } = useAuth()

  const [logs,     setLogs]     = React.useState<ToolCallLogResponse[]>([])
  const [loading,  setLoading]  = React.useState(true)
  const [error,    setError]    = React.useState<string | null>(null)
  const [open,     setOpen]     = React.useState(false)
  const [selected, setSelected] = React.useState<ToolCallLogResponse | null>(null)

  const fetchLogs = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const list  = await agentToolCallsApi.list(token, agentId, { limit: 50 })
      setLogs(list)
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Failed to load tool calls")
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently, agentId])

  React.useEffect(() => {
    if (open) fetchLogs()
  }, [open, fetchLogs])

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        aria-expanded={open}
      >
        {open ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        Recent Tool Calls (agent-wide)
      </button>

      {/* Detail view */}
      {selected && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                ← Back
              </button>
              <span className="text-xs text-muted-foreground">{formatDate(selected.created_at)}</span>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-4 rounded-md border p-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className={`font-mono font-semibold ${
                  selected.http_status_code != null && selected.http_status_code < 400
                    ? "text-green-600 dark:text-green-400"
                    : "text-destructive"
                }`}>
                  {selected.http_status_code ?? "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Duration</span>
                <span className="font-mono text-sm">{formatMs(selected.duration_ms)}</span>
              </div>
              {selected.is_dry_run && <Badge variant="outline" className="text-xs self-end">dry run</Badge>}
              {selected.error_message && (
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground">Error</span>
                  <span className="text-destructive text-xs break-words">{selected.error_message}</span>
                </div>
              )}
            </div>

            {/* Input params */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Input Parameters</p>
              <pre className="rounded-md border bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {selected.input_params
                  ? JSON.stringify(selected.input_params, null, 2)
                  : <span className="italic">none</span>
                }
              </pre>
            </div>

            {/* Response snapshot */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Response Snapshot</p>
              <pre className="rounded-md border bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {selected.response_snapshot
                  ? (() => {
                      try { return JSON.stringify(JSON.parse(selected.response_snapshot), null, 2) }
                      catch { return selected.response_snapshot }
                    })()
                  : <span className="italic">none</span>
                }
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List view */}
      {open && !selected && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 p-4 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
                <Button variant="ghost" size="sm" onClick={fetchLogs}>Retry</Button>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No tool calls recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground bg-muted/40">
                      <th className="text-left px-3 py-2 font-medium">When</th>
                      <th className="text-left px-3 py-2 font-medium">Tool</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Duration</th>
                      <th className="text-left px-3 py-2 font-medium">Error</th>
                      <th className="text-left px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground max-w-[140px] truncate">
                          {log.tool_name ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-mono ${
                            log.http_status_code && log.http_status_code < 400
                              ? "text-green-600 dark:text-green-400"
                              : "text-destructive"
                          }`}>
                            {log.http_status_code ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground font-mono">{formatMs(log.duration_ms)}</td>
                        <td className="px-3 py-2 text-destructive max-w-[160px] truncate">{log.error_message ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setSelected(log)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

export function IntegrationsTab({ agentId, isAdmin }: Props) {
  const { getAccessTokenSilently } = useAuth()

  const [integrations, setIntegrations] = React.useState<IntegrationResponse[]>([])
  const [loading,      setLoading]      = React.useState(true)
  const [error,        setError]        = React.useState<string | null>(null)
  const [createOpen,   setCreateOpen]   = React.useState(false)
  const [managed,      setManaged]      = React.useState<IntegrationResponse | null>(null)

  const fetchIntegrations = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const list  = await integrationsApi.list(token, agentId)
      setIntegrations(list)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to load integrations"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently, agentId])

  React.useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  const handleCreated = (integration: IntegrationResponse) => {
    setIntegrations(prev => [integration, ...prev])
    setCreateOpen(false)
    setManaged(integration)
  }

  const handleManage = (integration: IntegrationResponse) => {
    setManaged(integration)
  }

  const handleIntegrationUpdated = (updated: IntegrationResponse) => {
    setIntegrations(prev => prev.map(i => i.id === updated.id ? updated : i))
    setManaged(updated)
  }

  const handleIntegrationDeleted = (id: string) => {
    setIntegrations(prev => prev.filter(i => i.id !== id))
    setManaged(null)
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Integrations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              External APIs this agent can call during conversations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchIntegrations} aria-label="Refresh integrations">
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            </Button>
            {isAdmin ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add Integration
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" disabled>
                      <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add Integration
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Only admins can add integrations</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* List */}
        <Card>
          {loading ? (
            <CardContent className="p-0">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </CardContent>
          ) : error ? (
            <CardContent className="flex items-center gap-2 py-6">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" aria-hidden="true" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchIntegrations} className="ml-auto">
                Retry
              </Button>
            </CardContent>
          ) : integrations.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
              <Globe className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">No integrations yet</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Add an integration to let this agent call external APIs." : "No integrations have been configured for this agent."}
              </p>
              {isAdmin && (
                <Button size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add Integration
                </Button>
              )}
            </CardContent>
          ) : (
            <CardContent className="p-0">
              {integrations.map(integration => (
                <IntegrationRow
                  key={integration.id}
                  integration={integration}
                  onManage={handleManage}
                />
              ))}
            </CardContent>
          )}
        </Card>

        {/* Create sheet */}
        <CreateIntegrationSheet
          open={createOpen}
          agentId={agentId}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />

        {/* Manage sheet */}
        {managed && (
          <ManageIntegrationSheet
            open={!!managed}
            agentId={agentId}
            integration={managed}
            isAdmin={isAdmin}
            onClose={() => setManaged(null)}
            onUpdated={handleIntegrationUpdated}
            onDeleted={handleIntegrationDeleted}
          />
        )}

        {/* Agent-level tool calls */}
        <AgentToolCallsSection agentId={agentId} />
      </div>
    </TooltipProvider>
  )
}

// ─── Manage Integration Sheet (T4: edit + test + delete) ─────────────────────

type ManageSheetProps = {
  open:        boolean
  agentId:     string
  integration: IntegrationResponse
  isAdmin:     boolean
  onClose:     () => void
  onUpdated:   (updated: IntegrationResponse) => void
  onDeleted:   (id: string) => void
}

type EditForm = {
  name:        string
  base_url:    string
  description: string
  auth_type:   IntegrationAuthType
  is_active:   boolean
}

type EditErrors = Partial<Record<"name" | "base_url", string>>

// ─── HTTP Method labels ───────────────────────────────────────────────────────
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const BODY_TEMPLATE_MODES: BodyTemplateMode[] = ["json-strict", "handlebars", "passthrough"]
const TRUNCATION_OPTIONS: { value: TruncationStrategy; label: string }[] = [
  { value: "head", label: "head — keep start" },
  { value: "tail", label: "tail — keep end" },
]

// ─── Tool Form types ──────────────────────────────────────────────────────────
type ErrorMessageRow = { code: string; message: string }
type ExampleRow      = { user_message: string; tool_args: string; argsError: string }

type ToolForm = {
  name:                   string
  http_method:            string
  path_template:          string
  description:            string
  body_template_mode:     BodyTemplateMode
  body_template:          string
  response_extract_path:  string
  cache_ttl_seconds:      string   // string so input works; parsed to number on save
  is_readonly:            boolean
  fail_silent:            boolean
  fail_silent_message:    string
  // Controls (2026-05-18)
  timeout_ms:             string
  retry_count:            string
  retry_on:               number[]
  max_response_chars:     string
  truncation_strategy:    TruncationStrategy
  // complex editors kept separately
  error_message_rows:     ErrorMessageRow[]
  example_rows:           ExampleRow[]
}

type ToolFormErrors = Partial<Record<"name" | "http_method" | "path_template", string>>

// ─── ToolSheet — create / edit a single tool ──────────────────────────────────

type ToolSheetProps = {
  open:          boolean
  agentId:       string
  integrationId: string
  tool?:         IntegrationToolResponse | null   // null = create
  onClose:       () => void
  onSaved:       (tool: IntegrationToolResponse) => void
}

function ToolSheet({ open, agentId, integrationId, tool, onClose, onSaved }: ToolSheetProps) {
  const { getAccessTokenSilently } = useAuth()
  const isEdit = !!tool

  const buildErrorRows = (em: Record<string, string> | null | undefined): ErrorMessageRow[] =>
    em ? Object.entries(em).map(([code, message]) => ({ code, message })) : []

  const buildExampleRows = (ex: ToolExample[] | null | undefined): ExampleRow[] =>
    (ex ?? []).map(e => ({
      user_message: e.user_message,
      tool_args:    e.tool_args ? JSON.stringify(e.tool_args, null, 2) : "",
      argsError:    "",
    }))

  const EMPTY: ToolForm = {
    name:                  tool?.name                  ?? "",
    http_method:           tool?.http_method           ?? "GET",
    path_template:         tool?.path_template         ?? "",
    description:           tool?.description           ?? "",
    body_template_mode:    tool?.body_template_mode    ?? "json-strict",
    body_template:         tool?.body_template         ?? "",
    response_extract_path: tool?.response_extract_path ?? "",
    cache_ttl_seconds:     tool?.cache_ttl_seconds != null ? String(tool.cache_ttl_seconds) : "0",
    is_readonly:           tool?.is_readonly           ?? false,
    fail_silent:           tool?.fail_silent           ?? false,
    fail_silent_message:   tool?.fail_silent_message   ?? "",
    timeout_ms:            tool?.timeout_ms    != null ? String(tool.timeout_ms)    : "10000",
    retry_count:           tool?.retry_count   != null ? String(tool.retry_count)   : "2",
    retry_on:              tool?.retry_on      ?? [],
    max_response_chars:    tool?.max_response_chars != null ? String(tool.max_response_chars) : "0",
    truncation_strategy:   tool?.truncation_strategy ?? "head",
    error_message_rows:    buildErrorRows(tool?.error_messages),
    example_rows:          buildExampleRows(tool?.examples),
  }

  const [form,          setForm]          = React.useState<ToolForm>(EMPTY)
  const [errors,        setErrors]        = React.useState<ToolFormErrors>({})
  const [saving,        setSaving]        = React.useState(false)
  const [retryOnInput,  setRetryOnInput]  = React.useState("")
  const [ctrlOpen,      setCtrlOpen]      = React.useState(false)
  const [errMsgOpen,    setErrMsgOpen]    = React.useState(false)
  const [examplesOpen,  setExamplesOpen]  = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        name:                  tool?.name                  ?? "",
        http_method:           tool?.http_method           ?? "GET",
        path_template:         tool?.path_template         ?? "",
        description:           tool?.description           ?? "",
        body_template_mode:    tool?.body_template_mode    ?? "json-strict",
        body_template:         tool?.body_template         ?? "",
        response_extract_path: tool?.response_extract_path ?? "",
        cache_ttl_seconds:     tool?.cache_ttl_seconds != null ? String(tool.cache_ttl_seconds) : "0",
        is_readonly:           tool?.is_readonly           ?? false,
        fail_silent:           tool?.fail_silent           ?? false,
        fail_silent_message:   tool?.fail_silent_message   ?? "",
        timeout_ms:            tool?.timeout_ms    != null ? String(tool.timeout_ms)    : "10000",
        retry_count:           tool?.retry_count   != null ? String(tool.retry_count)   : "2",
        retry_on:              tool?.retry_on      ?? [],
        max_response_chars:    tool?.max_response_chars != null ? String(tool.max_response_chars) : "0",
        truncation_strategy:   tool?.truncation_strategy ?? "head",
        error_message_rows:    buildErrorRows(tool?.error_messages),
        example_rows:          buildExampleRows(tool?.examples),
      })
      setErrors({})
      setRetryOnInput("")
      setCtrlOpen(false)
      setErrMsgOpen(false)
      setExamplesOpen(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tool?.id])

  const setField = <K extends keyof ToolForm>(key: K, value: ToolForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === "name" || key === "http_method" || key === "path_template") {
      setErrors(prev => ({ ...prev, [key]: undefined }))
    }
  }

  const addRetryOnChip = () => {
    const n = parseInt(retryOnInput.trim(), 10)
    if (!isNaN(n) && n >= 100 && n <= 599 && !form.retry_on.includes(n)) {
      setField("retry_on", [...form.retry_on, n])
    }
    setRetryOnInput("")
  }

  const removeRetryOnChip = (code: number) => {
    setField("retry_on", form.retry_on.filter(c => c !== code))
  }

  const addErrorMessageRow = () => {
    setField("error_message_rows", [...form.error_message_rows, { code: "", message: "" }])
  }

  const updateErrorMessageRow = (i: number, key: "code" | "message", value: string) => {
    const rows = form.error_message_rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r)
    setField("error_message_rows", rows)
  }

  const removeErrorMessageRow = (i: number) => {
    setField("error_message_rows", form.error_message_rows.filter((_, idx) => idx !== i))
  }

  const addExampleRow = () => {
    if (form.example_rows.length >= 5) return
    setField("example_rows", [...form.example_rows, { user_message: "", tool_args: "", argsError: "" }])
  }

  const updateExampleRow = (i: number, key: "user_message" | "tool_args", value: string) => {
    const rows = form.example_rows.map((r, idx) => {
      if (idx !== i) return r
      if (key === "tool_args") {
        let argsError = ""
        if (value.trim()) {
          try { JSON.parse(value) } catch { argsError = "Invalid JSON" }
        }
        return { ...r, tool_args: value, argsError }
      }
      return { ...r, [key]: value }
    })
    setField("example_rows", rows)
  }

  const removeExampleRow = (i: number) => {
    setField("example_rows", form.example_rows.filter((_, idx) => idx !== i))
  }

  const validate = (): boolean => {
    const errs: ToolFormErrors = {}
    if (!form.name.trim())          errs.name          = "Name is required"
    if (!form.path_template.trim()) errs.path_template = "Path template is required"
    if (!form.http_method)          errs.http_method   = "HTTP method is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      let saved: IntegrationToolResponse

      const errorMessages: Record<string, string> | null =
        form.error_message_rows.filter(r => r.code.trim() && r.message.trim()).length > 0
          ? Object.fromEntries(form.error_message_rows.filter(r => r.code.trim() && r.message.trim()).map(r => [r.code.trim(), r.message.trim()]))
          : null

      const examples: ToolExample[] | null =
        form.example_rows.filter(r => r.user_message.trim() && !r.argsError).length > 0
          ? form.example_rows
              .filter(r => r.user_message.trim() && !r.argsError)
              .map(r => ({
                user_message: r.user_message.trim(),
                tool_args:    r.tool_args.trim() ? JSON.parse(r.tool_args.trim()) : null,
              }))
          : null

      const controlFields = {
        timeout_ms:          form.timeout_ms     !== "" ? Number(form.timeout_ms)    : 10000,
        retry_count:         form.retry_count    !== "" ? Number(form.retry_count)   : 2,
        retry_on:            form.retry_on,
        max_response_chars:  form.max_response_chars !== "" ? Number(form.max_response_chars) : 0,
        truncation_strategy: form.truncation_strategy,
        error_messages:      errorMessages,
        examples,
      }

      if (isEdit && tool) {
        const body: IntegrationToolUpdate = {
          name:                   form.name.trim(),
          http_method:            form.http_method as IntegrationToolCreate["http_method"],
          path_template:          form.path_template.trim(),
          description:            form.description.trim() || null,
          body_template_mode:     form.body_template_mode,
          body_template:          form.body_template.trim() || null,
          response_extract_path:  form.response_extract_path.trim() || null,
          cache_ttl_seconds:      form.cache_ttl_seconds !== "" ? Number(form.cache_ttl_seconds) : 0,
          is_readonly:            form.is_readonly,
          fail_silent:            form.fail_silent,
          fail_silent_message:    form.fail_silent ? (form.fail_silent_message.trim() || null) : null,
          ...controlFields,
        }
        saved = await integrationToolsApi.update(token, agentId, integrationId, tool.id, body)
        toast.success("Tool updated")
      } else {
        const body: IntegrationToolCreate = {
          name:                   form.name.trim(),
          http_method:            form.http_method as IntegrationToolCreate["http_method"],
          path_template:          form.path_template.trim(),
          description:            form.description.trim() || null,
          body_template_mode:     form.body_template_mode,
          body_template:          form.body_template.trim() || null,
          response_extract_path:  form.response_extract_path.trim() || null,
          cache_ttl_seconds:      form.cache_ttl_seconds !== "" ? Number(form.cache_ttl_seconds) : 0,
          is_readonly:            form.is_readonly,
          fail_silent:            form.fail_silent,
          fail_silent_message:    form.fail_silent ? (form.fail_silent_message.trim() || null) : null,
          ...controlFields,
        }
        saved = await integrationToolsApi.create(token, agentId, integrationId, body)
        toast.success("Tool created")
      }
      onSaved(saved)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : `Failed to ${isEdit ? "update" : "create"} tool`
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Tool" : "New Tool"}</SheetTitle>
          <SheetDescription>
            Tools define HTTP calls this integration can make on behalf of the agent.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="tool-name"
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("name", e.target.value)}
              placeholder="e.g. get_customer"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "tool-name-error" : undefined}
            />
            {errors.name && <p id="tool-name-error" className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* HTTP Method */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-method">HTTP Method <span className="text-destructive">*</span></Label>
            <Select value={form.http_method} onValueChange={(v: string) => setField("http_method", v)}>
              <SelectTrigger id="tool-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.http_method && <p className="text-xs text-destructive">{errors.http_method}</p>}
          </div>

          {/* Path Template */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-path">Path Template <span className="text-destructive">*</span></Label>
            <Input
              id="tool-path"
              value={form.path_template}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("path_template", e.target.value)}
              placeholder="/customers/{customer_id}"
              aria-invalid={!!errors.path_template}
              aria-describedby={errors.path_template ? "tool-path-error" : undefined}
            />
            {errors.path_template && <p id="tool-path-error" className="text-xs text-destructive">{errors.path_template}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-desc">Description</Label>
            <Textarea
              id="tool-desc"
              value={form.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField("description", e.target.value)}
              placeholder="What this tool does"
              rows={2}
            />
          </div>

          {/* Body Template Mode */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-body-mode">Body Template Mode</Label>
            <Select value={form.body_template_mode} onValueChange={(v: BodyTemplateMode) => setField("body_template_mode", v)}>
              <SelectTrigger id="tool-body-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BODY_TEMPLATE_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Body Template — only relevant for methods with a body and non-passthrough mode */}
          {(form.http_method !== "GET" && form.http_method !== "DELETE") && form.body_template_mode !== "passthrough" && (
            <div className="space-y-1.5">
              <Label htmlFor="tool-body-template">
                Body Template
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  {form.body_template_mode === "handlebars" ? "(Handlebars syntax)" : "(JSON)"}
                </span>
              </Label>
              <Textarea
                id="tool-body-template"
                value={form.body_template}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField("body_template", e.target.value)}
                placeholder={form.body_template_mode === "handlebars"
                  ? '{"query": "{{query}}", "limit": {{limit}}}'
                  : '{"query": "$query", "limit": "$limit"}'}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          )}

          {/* Response Extract Path */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-extract">
              Response Extract Path
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">(JSONPath, e.g. $.data.items)</span>
            </Label>
            <Input
              id="tool-extract"
              value={form.response_extract_path}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("response_extract_path", e.target.value)}
              placeholder="$.data"
            />
          </div>

          {/* Cache TTL */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-cache">
              Cache TTL (seconds)
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">(0 = no cache)</span>
            </Label>
            <Input
              id="tool-cache"
              type="number"
              min={0}
              value={form.cache_ttl_seconds}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("cache_ttl_seconds", e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Flags */}
          <div className="flex items-center gap-3">
            <Switch id="tool-readonly" checked={form.is_readonly} onCheckedChange={(v: boolean) => setField("is_readonly", v)} />
            <Label htmlFor="tool-readonly">Read-only (cacheable)</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="tool-failsilent" checked={form.fail_silent} onCheckedChange={(v: boolean) => setField("fail_silent", v)} />
            <Label htmlFor="tool-failsilent">Fail silently on error</Label>
          </div>

          {/* Fail silent message — only shown when fail_silent is on */}
          {form.fail_silent && (
            <div className="space-y-1.5">
              <Label htmlFor="tool-fail-msg">
                Fallback message
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">(shown to user on tool failure)</span>
              </Label>
              <Input
                id="tool-fail-msg"
                value={form.fail_silent_message}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("fail_silent_message", e.target.value)}
                placeholder="Sorry, I couldn't retrieve that information right now."
              />
            </div>
          )}

          {/* ── Controls (collapsible) ─────────────────────────────────── */}
          <div className="border rounded-md overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
              onClick={() => setCtrlOpen(v => !v)}
            >
              Controls
              {ctrlOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {ctrlOpen && (
              <div className="px-3 pb-3 space-y-3 border-t">
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tool-timeout">Timeout (ms)</Label>
                    <Input
                      id="tool-timeout"
                      type="number"
                      min={1}
                      value={form.timeout_ms}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("timeout_ms", e.target.value)}
                      placeholder="10000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tool-retry-count">Retry count</Label>
                    <Input
                      id="tool-retry-count"
                      type="number"
                      min={0}
                      max={10}
                      value={form.retry_count}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("retry_count", e.target.value)}
                      placeholder="2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tool-max-chars">
                      Max response chars
                      <span className="ml-1 text-xs text-muted-foreground font-normal">(0 = 10 KB)</span>
                    </Label>
                    <Input
                      id="tool-max-chars"
                      type="number"
                      min={0}
                      value={form.max_response_chars}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("max_response_chars", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tool-truncation">Truncation</Label>
                    <Select value={form.truncation_strategy} onValueChange={(v: TruncationStrategy) => setField("truncation_strategy", v)}>
                      <SelectTrigger id="tool-truncation"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRUNCATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* retry_on tag chips */}
                <div className="space-y-1.5">
                  <Label>
                    Retry on
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">(HTTP status codes — empty = any 5xx)</span>
                  </Label>
                  <div className="flex flex-wrap gap-1.5 min-h-8 rounded-md border px-2 py-1.5">
                    {form.retry_on.map(code => (
                      <span key={code} className="inline-flex items-center gap-0.5 rounded bg-secondary px-2 py-0.5 text-xs font-mono">
                        {code}
                        <button
                          type="button"
                          onClick={() => removeRetryOnChip(code)}
                          className="ml-0.5 rounded-full hover:bg-muted"
                          aria-label={`Remove ${code}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      className="flex-1 min-w-16 bg-transparent text-xs outline-none placeholder:text-muted-foreground font-mono"
                      value={retryOnInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRetryOnInput(e.target.value)}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addRetryOnChip() }
                        if (e.key === "Backspace" && !retryOnInput && form.retry_on.length > 0) {
                          removeRetryOnChip(form.retry_on[form.retry_on.length - 1])
                        }
                      }}
                      onBlur={addRetryOnChip}
                      placeholder={form.retry_on.length === 0 ? "429 503 … Enter to add" : ""}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Error Messages (collapsible) ───────────────────────────── */}
          <div className="border rounded-md overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
              onClick={() => setErrMsgOpen(v => !v)}
            >
              Error Messages
              <span className="flex items-center gap-1">
                {form.error_message_rows.length > 0 && (
                  <span className="rounded-full bg-secondary px-1.5 text-xs">{form.error_message_rows.length}</span>
                )}
                {errMsgOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </span>
            </button>
            {errMsgOpen && (
              <div className="px-3 pb-3 border-t">
                <p className="text-xs text-muted-foreground py-2">Map HTTP status codes to user-friendly messages shown to the LLM.</p>
                <div className="space-y-2">
                  {form.error_message_rows.map((row, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Input
                        className="w-20 font-mono text-xs"
                        maxLength={3}
                        value={row.code}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateErrorMessageRow(i, "code", e.target.value)}
                        placeholder="404"
                        aria-label="Status code"
                      />
                      <Input
                        className="flex-1 text-xs"
                        value={row.message}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateErrorMessageRow(i, "message", e.target.value)}
                        placeholder="That item wasn't found."
                        aria-label="Error message"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeErrorMessageRow(i)}
                        aria-label="Remove row"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={addErrorMessageRow}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add row
                </Button>
              </div>
            )}
          </div>

          {/* ── Few-shot Examples (collapsible) ────────────────────────── */}
          <div className="border rounded-md overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
              onClick={() => setExamplesOpen(v => !v)}
            >
              Few-shot Examples
              <span className="flex items-center gap-1">
                {form.example_rows.length > 0 && (
                  <span className="rounded-full bg-secondary px-1.5 text-xs">{form.example_rows.length}/5</span>
                )}
                {examplesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </span>
            </button>
            {examplesOpen && (
              <div className="px-3 pb-3 border-t">
                <p className="text-xs text-muted-foreground py-2">Up to 5 user message / tool args pairs to help the LLM decide when and how to call this tool.</p>
                <div className="space-y-3">
                  {form.example_rows.map((row, i) => (
                    <div key={i} className="rounded border p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Example {i + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeExampleRow(i)}
                          aria-label={`Remove example ${i + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">User message</Label>
                        <Input
                          value={row.user_message}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateExampleRow(i, "user_message", e.target.value)}
                          placeholder="e.g. What's my order status?"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tool args (JSON, optional)</Label>
                        <Textarea
                          value={row.tool_args}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateExampleRow(i, "tool_args", e.target.value)}
                          placeholder='{"order_id": "ORD-123"}'
                          rows={2}
                          className="font-mono text-xs"
                        />
                        {row.argsError && <p className="text-xs text-destructive">{row.argsError}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={addExampleRow}
                  disabled={form.example_rows.length >= 5}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {form.example_rows.length >= 5 ? "Max 5 examples" : "Add example"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Tool")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ─── ToolLogsDialog — per-tool execution log ─────────────────────────────────

type ToolLogsDialogProps = {
  open:          boolean
  agentId:       string
  integrationId: string
  tool:          IntegrationToolResponse
  onClose:       () => void
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—"
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function ToolLogsDialog({ open, agentId, integrationId, tool, onClose }: ToolLogsDialogProps) {
  const { getAccessTokenSilently } = useAuth()

  const [logs,       setLogs]       = React.useState<ToolCallLogResponse[]>([])
  const [loading,    setLoading]    = React.useState(true)
  const [error,      setError]      = React.useState<string | null>(null)
  const [selected,   setSelected]   = React.useState<ToolCallLogResponse | null>(null)

  React.useEffect(() => {
    if (!open) return
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const token = await getAccessTokenSilently()
        const list  = await integrationToolsApi.listLogs(token, agentId, integrationId, tool.id, { limit: 50 })
        setLogs(list)
      } catch (err) {
        setError(err instanceof ApiException ? err.message : "Failed to load logs")
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [open, getAccessTokenSilently, agentId, integrationId, tool.id])

  // ── detail view for a single log entry ──────────────────────────────────
  if (selected) {
    const ok = selected.http_status_code != null && selected.http_status_code < 400
    return (
      <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground transition-colors mr-1"
                aria-label="Back to list"
              >
                ← Back
              </button>
              Log Entry — {tool.name}
            </DialogTitle>
            <DialogDescription>{formatDate(selected.created_at)}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Summary row */}
            <div className="flex items-center gap-4 rounded-md border p-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className={`font-mono font-semibold ${ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {selected.http_status_code ?? "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Duration</span>
                <span className="font-mono">{formatMs(selected.duration_ms)}</span>
              </div>
              {selected.is_dry_run && (
                <Badge variant="outline" className="text-xs self-end">dry run</Badge>
              )}
              {selected.error_message && (
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground">Error</span>
                  <span className="text-destructive text-xs break-words">{selected.error_message}</span>
                </div>
              )}
            </div>

            {/* Input params */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Input Parameters</p>
              <pre className="rounded-md border bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {selected.input_params
                  ? JSON.stringify(selected.input_params, null, 2)
                  : <span className="text-muted-foreground italic">none</span>
                }
              </pre>
            </div>

            {/* Response snapshot */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Response Snapshot</p>
              <pre className="rounded-md border bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {selected.response_snapshot
                  ? (() => {
                      try { return JSON.stringify(JSON.parse(selected.response_snapshot), null, 2) }
                      catch { return selected.response_snapshot }
                    })()
                  : <span className="text-muted-foreground italic">none</span>
                }
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ── list view ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Execution Logs — {tool.name}</DialogTitle>
          <DialogDescription>Last 50 tool call log entries</DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 py-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No execution logs yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium">When</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-left py-2 pr-3 font-medium">Duration</th>
                  <th className="text-left py-2 pr-3 font-medium">Error</th>
                  <th className="text-left py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center gap-1 font-mono ${
                        log.http_status_code && log.http_status_code < 400
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive"
                      }`}>
                        {log.http_status_code ?? "—"}
                        {log.is_dry_run && <Badge variant="outline" className="text-[10px] h-4 ml-1">dry</Badge>}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground font-mono">{formatMs(log.duration_ms)}</td>
                    <td className="py-2 pr-3 text-destructive max-w-[160px] truncate">{log.error_message ?? "—"}</td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setSelected(log)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── ToolVersionsDialog — version history + restore ──────────────────────────

type ToolVersionsDialogProps = {
  open:          boolean
  agentId:       string
  integrationId: string
  tool:          IntegrationToolResponse
  onClose:       () => void
  onRestored:    (tool: IntegrationToolResponse) => void
}

function ToolVersionsDialog({ open, agentId, integrationId, tool, onClose, onRestored }: ToolVersionsDialogProps) {
  const { getAccessTokenSilently } = useAuth()

  const [versions,    setVersions]    = React.useState<ToolVersionResponse[]>([])
  const [loading,     setLoading]     = React.useState(true)
  const [error,       setError]       = React.useState<string | null>(null)
  const [restoringId, setRestoringId] = React.useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = React.useState<ToolVersionResponse | null>(null)

  React.useEffect(() => {
    if (!open) return
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const token = await getAccessTokenSilently()
        const list  = await integrationToolsApi.listVersions(token, agentId, integrationId, tool.id)
        setVersions(list)
      } catch (err) {
        setError(err instanceof ApiException ? err.message : "Failed to load versions")
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [open, getAccessTokenSilently, agentId, integrationId, tool.id])

  const handleRestore = async (version: ToolVersionResponse) => {
    setRestoringId(version.id)
    try {
      const token   = await getAccessTokenSilently()
      const restored = await integrationToolsApi.restoreVersion(token, agentId, integrationId, tool.id, version.id)
      toast.success(`Restored to v${version.version_number}`)
      onRestored(restored)
      onClose()
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Restore failed"
      toast.error(msg, { duration: Infinity })
    } finally {
      setRestoringId(null)
      setConfirmRestore(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Version History — {tool.name}</DialogTitle>
            <DialogDescription>
              Current version: v{tool.current_version}. Restore to revert to a previous snapshot.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto space-y-1">
            {loading ? (
              <div className="space-y-2 py-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No previous versions.</p>
            ) : (
              versions.map(v => (
                <div key={v.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">v{v.version_number} — {v.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      <span className="text-primary">{v.http_method}</span> {v.path_template}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(v.created_at)}</p>
                  </div>
                  {v.version_number !== tool.current_version && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmRestore(v)}
                      disabled={!!restoringId}
                    >
                      Restore
                    </Button>
                  )}
                  {v.version_number === tool.current_version && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm restore dialog */}
      {confirmRestore && (
        <Dialog open={!!confirmRestore} onOpenChange={v => { if (!v) setConfirmRestore(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore Version</DialogTitle>
              <DialogDescription>
                Restore <strong>{tool.name}</strong> to v{confirmRestore.version_number}?
                The current version will be archived.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmRestore(null)} disabled={!!restoringId}>Cancel</Button>
              <Button onClick={() => handleRestore(confirmRestore)} disabled={!!restoringId}>
                {restoringId ? "Restoring…" : "Restore"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// ─── ToolsSection — tools list + CRUD within ManageIntegrationSheet ───────────

type ToolsSectionProps = {
  agentId:       string
  integrationId: string
  isAdmin:       boolean
}

function ToolsSection({ agentId, integrationId, isAdmin }: ToolsSectionProps) {
  const { getAccessTokenSilently } = useAuth()

  const [tools,        setTools]        = React.useState<IntegrationToolResponse[]>([])
  const [loading,      setLoading]      = React.useState(true)
  const [error,        setError]        = React.useState<string | null>(null)
  const [toolSheet,    setToolSheet]    = React.useState<{ open: boolean; tool: IntegrationToolResponse | null }>({ open: false, tool: null })
  const [deletingId,   setDeletingId]   = React.useState<string | null>(null)
  const [confirmDel,   setConfirmDel]   = React.useState<IntegrationToolResponse | null>(null)
  const [versionsTool, setVersionsTool] = React.useState<IntegrationToolResponse | null>(null)
  const [logsTool,     setLogsTool]     = React.useState<IntegrationToolResponse | null>(null)
  const [testTool,     setTestTool]     = React.useState<IntegrationToolResponse | null>(null)

  const fetchTools = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const list  = await integrationToolsApi.list(token, agentId, integrationId)
      setTools(list)
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Failed to load tools")
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently, agentId, integrationId])

  React.useEffect(() => {
    fetchTools()
  }, [fetchTools])

  const handleToolSaved = (tool: IntegrationToolResponse) => {
    setTools(prev => {
      const existing = prev.findIndex(t => t.id === tool.id)
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = tool
        return next
      }
      return [tool, ...prev]
    })
    setToolSheet({ open: false, tool: null })
  }

  const handleDeleteTool = async (tool: IntegrationToolResponse) => {
    setDeletingId(tool.id)
    try {
      const token = await getAccessTokenSilently()
      await integrationToolsApi.delete(token, agentId, integrationId, tool.id)
      setTools(prev => prev.filter(t => t.id !== tool.id))
      toast.success("Tool deleted")
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to delete tool"
      toast.error(msg, { duration: Infinity })
    } finally {
      setDeletingId(null)
      setConfirmDel(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" aria-hidden="true" /> Tools
          {!loading && <span className="text-xs text-muted-foreground">({tools.length})</span>}
        </p>
        <div className="flex items-center gap-2">
          <ToolDocsButton />
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setToolSheet({ open: true, tool: null })}>
              <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Add Tool
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchTools}>Retry</Button>
        </div>
      ) : tools.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          {isAdmin ? "No tools yet — add one to define API calls." : "No tools configured."}
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          {tools.map(tool => (
            <div key={tool.id} className="flex items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{tool.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  <span className="text-primary">{tool.http_method}</span> {tool.path_template}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTestTool(tool)}
                    aria-label={`Test ${tool.name}`}
                  >
                    <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogsTool(tool)}
                    aria-label={`View logs for ${tool.name}`}
                  >
                    Logs
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVersionsTool(tool)}
                    aria-label={`View versions of ${tool.name}`}
                  >
                    v{tool.current_version}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setToolSheet({ open: true, tool })}
                    aria-label={`Edit ${tool.name}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDel(tool)}
                    disabled={deletingId === tool.id}
                    aria-label={`Delete ${tool.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tool create/edit sheet */}
      <ToolSheet
        open={toolSheet.open}
        agentId={agentId}
        integrationId={integrationId}
        tool={toolSheet.tool}
        onClose={() => setToolSheet({ open: false, tool: null })}
        onSaved={handleToolSaved}
      />

      {/* Delete confirm dialog */}
      {confirmDel && (
        <Dialog open={!!confirmDel} onOpenChange={v => { if (!v) setConfirmDel(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Tool</DialogTitle>
              <DialogDescription>
                Delete tool <strong>{confirmDel.name}</strong>? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDel(null)} disabled={!!deletingId}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDeleteTool(confirmDel)} disabled={!!deletingId}>
                {deletingId ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Tool logs dialog */}
      {logsTool && (
        <ToolLogsDialog
          open={!!logsTool}
          agentId={agentId}
          integrationId={integrationId}
          tool={logsTool}
          onClose={() => setLogsTool(null)}
        />
      )}

      {/* Tool versions dialog */}
      {versionsTool && (
        <ToolVersionsDialog
          open={!!versionsTool}
          agentId={agentId}
          integrationId={integrationId}
          tool={versionsTool}
          onClose={() => setVersionsTool(null)}
          onRestored={(updated) => {
            setTools(prev => prev.map(t => t.id === updated.id ? updated : t))
            setVersionsTool(null)
          }}
        />
      )}

      {/* Tool dry-run test dialog */}
      {testTool && (
        <ToolTestDialog
          open={!!testTool}
          agentId={agentId}
          integrationId={integrationId}
          tool={testTool}
          onClose={() => setTestTool(null)}
        />
      )}
    </div>
  )
}

// ─── Tool Test Dialog ─────────────────────────────────────────────────────────

type ToolTestDialogProps = {
  open:           boolean
  agentId:        string
  integrationId:  string
  tool:           IntegrationToolResponse
  onClose:        () => void
}

function ToolTestDialog({ open, agentId, integrationId, tool, onClose }: ToolTestDialogProps) {
  const { getAccessTokenSilently } = useAuth()
  const [paramsJson, setParamsJson] = React.useState("{}")
  const [running,    setRunning]    = React.useState(false)
  const [result,     setResult]     = React.useState<ToolTestResponse | null>(null)
  const [parseError, setParseError] = React.useState<string | null>(null)

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setParamsJson("{}")
      setResult(null)
      setParseError(null)
    }
  }, [open])

  const handleRun = async () => {
    setParseError(null)
    let input_params: Record<string, unknown> = {}
    try {
      input_params = JSON.parse(paramsJson)
    } catch {
      setParseError("Invalid JSON — fix the input params before running.")
      return
    }
    setRunning(true)
    setResult(null)
    try {
      const token = await getAccessTokenSilently()
      const res   = await integrationToolsApi.test(token, agentId, integrationId, tool.id, { input_params })
      setResult(res)
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Dry-run failed")
    } finally {
      setRunning(false)
    }
  }

  const handleParamsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setParamsJson(e.target.value)
    setParseError(null)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            Dry-run — {tool.name}
          </DialogTitle>
          <DialogDescription>
            Execute a test call against{" "}
            <span className="font-mono text-xs">{tool.http_method} {tool.path_template}</span>.
            No data will be persisted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="test-params">Input params (JSON)</Label>
            <Textarea
              id="test-params"
              value={paramsJson}
              onChange={handleParamsChange}
              rows={5}
              className="font-mono text-xs"
              placeholder='{ "key": "value" }'
              spellCheck={false}
            />
            {parseError && <p className="text-xs text-destructive">{parseError}</p>}
          </div>

          {result && (
            <div className="rounded-md border p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant={result.status === "ok" ? "default" : "destructive"}>
                  {result.status.toUpperCase()}
                </Badge>
                {result.http_status_code != null && (
                  <span className="text-muted-foreground">HTTP {result.http_status_code}</span>
                )}
                {result.latency_ms != null && (
                  <span className="text-muted-foreground">{result.latency_ms} ms</span>
                )}
              </div>
              {result.error && (
                <p className="text-destructive">{result.error}</p>
              )}
              {result.response_body && (
                <pre className="bg-muted rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                  {result.response_body}
                </pre>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={running}>Close</Button>
          <Button onClick={handleRun} disabled={running}>
            {running ? "Running…" : "Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ManageIntegrationSheet({
  open,
  agentId,
  integration,
  isAdmin,
  onClose,
  onUpdated,
  onDeleted,
}: ManageSheetProps) {
  const { getAccessTokenSilently, user } = useAuth()
  const adminRole = user?.role === "admin"

  const toEditForm = (i: IntegrationResponse): EditForm => ({
    name:        i.name,
    base_url:    i.base_url,
    description: i.description ?? "",
    auth_type:   i.auth_type,
    is_active:   i.is_active,
  })

  const [form,         setForm]         = React.useState<EditForm>(toEditForm(integration))
  const [errors,       setErrors]       = React.useState<EditErrors>({})
  const [saving,       setSaving]       = React.useState(false)
  const [testing,      setTesting]      = React.useState(false)
  const [testResult,   setTestResult]   = React.useState<{ status: "ok" | "error"; detail?: string | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [deleting,     setDeleting]     = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm(toEditForm(integration))
      setErrors({})
      setTestResult(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, integration.id])

  const setField = <K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === "name" || key === "base_url") {
      setErrors(prev => ({ ...prev, [key]: undefined }))
    }
  }

  const validate = (): boolean => {
    const errs: EditErrors = {}
    if (!form.name.trim())     errs.name     = "Name is required"
    if (!form.base_url.trim()) errs.base_url  = "Base URL is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const body: IntegrationUpdate = {
        name:        form.name.trim(),
        base_url:    form.base_url.trim(),
        description: form.description.trim() || null,
        auth_type:   form.auth_type,
        is_active:   form.is_active,
      }
      const updated = await integrationsApi.update(token, agentId, integration.id, body)
      toast.success("Integration updated")
      onUpdated(updated)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to update integration"
      toast.error(msg, { duration: Infinity })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const token  = await getAccessTokenSilently()
      const result = await integrationsApi.test(token, agentId, integration.id)
      setTestResult(result)
      if (result.status === "ok") {
        toast.success(`Connectivity OK${result.latency_ms != null ? ` (${result.latency_ms}ms)` : ""}`)
      } else {
        toast.error(result.detail ?? "Connectivity test failed", { duration: Infinity })
      }
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Test failed"
      setTestResult({ status: "error", detail: msg })
      toast.error(msg, { duration: Infinity })
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const token = await getAccessTokenSilently()
      await integrationsApi.delete(token, agentId, integration.id)
      toast.success("Integration deleted")
      onDeleted(integration.id)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to delete integration"
      toast.error(msg, { duration: Infinity })
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={v => { if (!v && !confirmDelete) onClose() }}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{integration.name}</SheetTitle>
            <SheetDescription>{integration.base_url}</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-4">
            {/* Edit fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-int-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-int-name"
                  value={form.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("name", e.target.value)}
                  disabled={!adminRole}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "edit-int-name-error" : undefined}
                />
                {errors.name && <p id="edit-int-name-error" className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-int-url">Base URL <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-int-url"
                  value={form.base_url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("base_url", e.target.value)}
                  disabled={!adminRole}
                  aria-invalid={!!errors.base_url}
                  aria-describedby={errors.base_url ? "edit-int-url-error" : undefined}
                />
                {errors.base_url && <p id="edit-int-url-error" className="text-xs text-destructive">{errors.base_url}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-int-desc">Description</Label>
                <Textarea
                  id="edit-int-desc"
                  value={form.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField("description", e.target.value)}
                  disabled={!adminRole}
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-int-auth">Auth Type</Label>
                {adminRole ? (
                  <Select value={form.auth_type} onValueChange={(v: IntegrationAuthType) => setField("auth_type", v)}>
                    <SelectTrigger id="edit-int-auth"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AUTH_TYPE_LABELS) as IntegrationAuthType[]).map(t => (
                        <SelectItem key={t} value={t}>{AUTH_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="edit-int-auth" value={AUTH_TYPE_LABELS[form.auth_type]} disabled />
                )}
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="edit-int-active"
                  checked={form.is_active}
                  onCheckedChange={(v: boolean) => setField("is_active", v)}
                  disabled={!adminRole}
                />
                <Label htmlFor="edit-int-active">Active</Label>
              </div>
            </div>

            {/* Test connectivity */}
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Connectivity Test</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                  {testing ? "Testing…" : "Test Connectivity"}
                </Button>
                {testResult && (
                  <span className={`flex items-center gap-1 text-xs font-medium ${testResult.status === "ok" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    {testResult.status === "ok"
                      ? <><Check className="w-3 h-3" aria-hidden="true" /> OK</>
                      : <><WifiOff className="w-3 h-3" aria-hidden="true" /> {testResult.detail ?? "Error"}</>
                    }
                  </span>
                )}
              </div>
            </div>

            {/* Tools */}
            <Separator />
            <ToolsSection agentId={agentId} integrationId={integration.id} isAdmin={adminRole} />

            {/* Danger zone */}
            {adminRole && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Danger Zone</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    disabled={deleting}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Delete Integration
                  </Button>
                </div>
              </>
            )}
          </div>

          {adminRole && (
            <SheetFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog */}
      <Dialog open={confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Integration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{integration.name}</strong>? This will also delete all
              tools attached to this integration and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

