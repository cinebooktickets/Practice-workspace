"use client"
import React from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/context/auth"
import { toast } from "sonner"
import Link from "next/link"
import { Bot, Plus, Search, Trash2, AlertCircle, ExternalLink, Upload, ChevronDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { agentsApi, agentExportImportApi, AgentResponse, AgentExportResponse, AgentExportBundle, EmbeddingConfig, EmbeddingProviderType, ApiException } from "@/lib/api"

type CreateForm = { name: string }
type CreateErrors = Partial<Record<keyof CreateForm, string>>

type ImportEmbeddingForm = {
  provider_type: EmbeddingProviderType | ""
  model:         string
  api_key:       string
  base_url:      string
  api_version:   string
  embedding_dim: string
}

const PROVIDER_LABELS: Record<string, string> = {
  openai:       "OpenAI",
  azure_openai: "Azure OpenAI",
  anthropic:    "Anthropic",
  ollama:       "Ollama",
}

function formatProvider(value: string): string {
  return PROVIDER_LABELS[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ─── Agent card ───────────────────────────────────────────────────────────────

type AgentCardProps = {
  agent: AgentResponse
  isAdmin: boolean
  onDelete: (id: string) => void
  deleting: boolean
}

function AgentCard({ agent, isAdmin, onDelete, deleting }: AgentCardProps) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
              <Bot className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">{agent.name}</h3>
                <Badge variant={agent.is_active ? "success" : "default"} className="capitalize text-xs">
                  {agent.is_active ? "active" : "inactive"}
                </Badge>
              </div>
              {agent.system_prompt && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{agent.system_prompt}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Created {formatDate(agent.created_at)}</span>
                {agent.provider_type && (
                  <span className="capitalize">
                    {formatProvider(agent.provider_type)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/agents/${agent.id}`}>
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                Configure
              </Link>
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={isAdmin ? -1 : 0}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={!isAdmin || deleting}
                      onClick={() => onDelete(agent.id)}
                      aria-label={`Delete ${agent.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAdmin && (
                  <TooltipContent>Only admins can delete agents</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function AgentsSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading agents">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" aria-hidden="true" />
                  <Skeleton className="h-4 w-14 rounded-full" aria-hidden="true" />
                </div>
                <Skeleton className="h-3 w-64" aria-hidden="true" />
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-24" aria-hidden="true" />
                  <Skeleton className="h-3 w-28" aria-hidden="true" />
                </div>
              </div>
              <Skeleton className="h-8 w-24 flex-shrink-0" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { user, getAccessTokenSilently } = useAuth()
  const isAdmin = user?.role === "admin"

  const [agents, setAgents] = React.useState<AgentResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")

  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState<CreateForm>({ name: "" })
  const [formErrors, setFormErrors] = React.useState<CreateErrors>({})
  const [creating, setCreating] = React.useState(false)

  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)

  const [importOpen, setImportOpen] = React.useState(false)
  const [importFile, setImportFile] = React.useState<File | null>(null)
  const [importFileError, setImportFileError] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [importEmbeddingForm, setImportEmbeddingForm] = React.useState<ImportEmbeddingForm>({ provider_type: "", model: "", api_key: "", base_url: "", api_version: "", embedding_dim: "" })
  const [importEmbeddingOpen, setImportEmbeddingOpen] = React.useState(false)

  const fetchAgents = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const data = await agentsApi.list(token)
      setAgents(data.items)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to load agents"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.system_prompt ?? "").toLowerCase().includes(search.toLowerCase())
  )

  // ── Create ──────────────────────────────────────────────────────────────────

  const validateCreate = (): boolean => {
    const errors: CreateErrors = {}
    if (!form.name.trim()) errors.name = "Agent name is required"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateCreate()) return
    setCreating(true)
    try {
      const token = await getAccessTokenSilently()
      const created = await agentsApi.create(token, { name: form.name.trim() })
      setAgents((prev) => [created, ...prev])
      toast.success(`Agent "${created.name}" created`)
      setCreateOpen(false)
      setForm({ name: "" })
      setFormErrors({})
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to create agent"
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  const handleCreateOpenChange = (open: boolean) => {
    if (!open) {
      setForm({ name: "" })
      setFormErrors({})
    }
    setCreateOpen(open)
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDeleteRequest = (id: string) => {
    setConfirmDeleteId(id)
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return
    const deleted = agents.find((a) => a.id === confirmDeleteId)
    setDeletingId(confirmDeleteId)
    setConfirmDeleteId(null)
    try {
      const token = await getAccessTokenSilently()
      await agentsApi.delete(token, confirmDeleteId)
      setAgents((prev) => prev.filter((a) => a.id !== confirmDeleteId))
      if (deleted) toast.success(`Agent "${deleted.name}" deleted`)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to delete agent"
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }

  const agentToDelete = agents.find((a) => a.id === confirmDeleteId)

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImportOpenChange = (open: boolean) => {
    if (!open) {
      setImportFile(null)
      setImportFileError(null)
      setImportEmbeddingForm({ provider_type: "", model: "", api_key: "", base_url: "", api_version: "", embedding_dim: "" })
      setImportEmbeddingOpen(false)
    }
    setImportOpen(open)
  }

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setImportFile(file)
    setImportFileError(null)
  }

  const handleImport = async () => {
    if (!importFile) {
      setImportFileError("Please select a JSON file to import")
      return
    }
    setImporting(true)
    try {
      const text = await importFile.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        setImportFileError("Invalid JSON — the file could not be parsed")
        setImporting(false)
        return
      }

      // Accept either AgentExportResponse (has bundle key) or AgentExportBundle directly
      let bundle: AgentExportBundle
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "bundle" in (parsed as object) &&
        typeof (parsed as AgentExportResponse).bundle === "object"
      ) {
        bundle = (parsed as AgentExportResponse).bundle
      } else if (
        parsed !== null &&
        typeof parsed === "object" &&
        "name" in (parsed as object) &&
        "is_active" in (parsed as object)
      ) {
        bundle = parsed as AgentExportBundle
      } else {
        setImportFileError("File does not appear to be a valid agent export bundle")
        setImporting(false)
        return
      }

      if (!bundle.name || typeof bundle.name !== "string") {
        setImportFileError("Bundle is missing a required 'name' field")
        setImporting(false)
        return
      }

      const token = await getAccessTokenSilently()
      const importBody: Parameters<typeof agentExportImportApi.importAgent>[1] = { bundle }
      if (importEmbeddingForm.provider_type && importEmbeddingForm.model.trim()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cfg: any = {
          provider_type: importEmbeddingForm.provider_type,
          model:         importEmbeddingForm.model.trim(),
          base_url:      importEmbeddingForm.base_url.trim() || null,
          api_version:   importEmbeddingForm.api_version.trim() || null,
          embedding_dim: importEmbeddingForm.embedding_dim ? parseInt(importEmbeddingForm.embedding_dim, 10) : null,
        }
        if (importEmbeddingForm.api_key.trim()) cfg.api_key = importEmbeddingForm.api_key.trim()
        importBody.embedding_config = cfg as EmbeddingConfig
      }
      const created = await agentExportImportApi.importAgent(token, importBody)
      setAgents((prev) => [created, ...prev])
      toast.success(`Agent "${created.name}" imported successfully`)
      handleImportOpenChange(false)
    } catch (err) {
      if (err instanceof ApiException) {
        const embeddingErrMap: Record<string, string> = {
          embedding_provider_mismatch: "The embedding provider you selected doesn't match the one used when this agent was exported. Change the provider to match or clear the embedding config.",
          embedding_provider_missing: "This bundle doesn't have an embedding provider set, but you supplied an embedding config. Remove the embedding config to import without an override.",
        }
        const inline = embeddingErrMap[err.message] ?? embeddingErrMap[String((err as ApiException & { code?: string }).code ?? "")]
        if (inline) {
          setImportFileError(inline)
        } else {
          toast.error(err.message)
        }
      } else {
        toast.error("Failed to import agent")
      }
    } finally {
      setImporting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <DashboardShell>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Agents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create and manage your AI support agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={isAdmin ? -1 : 0}>
                    <Button
                      variant="outline"
                      disabled={!isAdmin}
                      onClick={() => setImportOpen(true)}
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      Import Agent
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAdmin && (
                  <TooltipContent>Only admins can import agents</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={isAdmin ? -1 : 0}>
                    <Button
                      disabled={!isAdmin}
                      onClick={() => setCreateOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      New Agent
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAdmin && (
                  <TooltipContent>Only admins can create agents</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Search */}
        {!loading && !error && agents.length > 0 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search agents…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Loading */}
        {loading && <AgentsSkeleton />}

        {/* Error */}
        {!loading && error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="w-8 h-8 text-destructive" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={fetchAgents}>Retry</Button>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && !error && agents.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary" aria-hidden="true" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold">No agents yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Create your first AI support agent to start handling customer queries automatically.
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={isAdmin ? -1 : 0}>
                      <Button
                        disabled={!isAdmin}
                        onClick={() => setCreateOpen(true)}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        Create your first agent
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isAdmin && (
                    <TooltipContent>Only admins can create agents</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </CardContent>
          </Card>
        )}

        {/* Agent list */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isAdmin={isAdmin}
                onDelete={handleDeleteRequest}
                deleting={deletingId === agent.id}
              />
            ))}
          </div>
        )}

        {/* No search results */}
        {!loading && !error && agents.length > 0 && filtered.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
              <Search className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                No agents match &ldquo;{search}&rdquo;
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Agent</DialogTitle>
              <DialogDescription>
                Give your agent a name. You can configure the system prompt and model after creation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="agent-name">
                  Agent name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="agent-name"
                  placeholder="e.g. Customer Support Bot"
                  value={form.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }))
                  }}
                  aria-invalid={!!formErrors.name}
                  aria-describedby={formErrors.name ? "name-error" : undefined}
                />
                {formErrors.name && (
                  <p id="name-error" className="text-xs text-destructive">{formErrors.name}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleCreateOpenChange(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Create Agent"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import dialog */}
        <Dialog open={importOpen} onOpenChange={handleImportOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import Agent</DialogTitle>
              <DialogDescription>
                Upload a <code>.json</code> file exported from another agent. A new agent will be created with the same configuration. Provider secrets are not included in exports — you can add them in Config after import.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Label htmlFor="import-file">Agent export file (.json)</Label>
              <input
                id="import-file"
                type="file"
                accept=".json,application/json"
                onChange={handleImportFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:font-medium hover:file:bg-accent cursor-pointer"
                aria-invalid={!!importFileError}
                aria-describedby={importFileError ? "import-file-error" : undefined}
              />
              {importFileError && (
                <p id="import-file-error" className="text-xs text-destructive">{importFileError}</p>
              )}

              {/* Embedding Config — optional */}
              <div className="border rounded-md">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-left"
                  onClick={() => setImportEmbeddingOpen((v) => !v)}
                >
                  <span>Embedding Config <span className="text-xs font-normal text-muted-foreground">(optional)</span></span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${importEmbeddingOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {importEmbeddingOpen && (
                  <div className="px-3 pb-3 space-y-3 border-t">
                    <p className="text-xs text-muted-foreground pt-2">Supply an embedding override only if this bundle was exported with one. Leave blank to use the org default.</p>
                    <div className="space-y-1.5">
                      <Label>Provider</Label>
                      <Select value={importEmbeddingForm.provider_type} onValueChange={(v: string) => setImportEmbeddingForm((p) => ({ ...p, provider_type: v as EmbeddingProviderType }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                          <SelectItem value="ollama">Ollama (self-hosted)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {importEmbeddingForm.provider_type && (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="imp-emb-model">Model</Label>
                          <Input id="imp-emb-model" placeholder="e.g. text-embedding-3-small" value={importEmbeddingForm.model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportEmbeddingForm((p) => ({ ...p, model: e.target.value }))} />
                        </div>
                        {importEmbeddingForm.provider_type !== "ollama" && (
                          <div className="space-y-1.5">
                            <Label htmlFor="imp-emb-key">API Key</Label>
                            <Input id="imp-emb-key" type="password" placeholder="sk-…" value={importEmbeddingForm.api_key} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportEmbeddingForm((p) => ({ ...p, api_key: e.target.value }))} autoComplete="off" />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label htmlFor="imp-emb-url">Base URL <span className="text-xs text-muted-foreground">(optional)</span></Label>
                          <Input id="imp-emb-url" placeholder={importEmbeddingForm.provider_type === "ollama" ? "http://localhost:11434" : "e.g. https://my-resource.cognitiveservices.azure.com"} value={importEmbeddingForm.base_url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportEmbeddingForm((p) => ({ ...p, base_url: e.target.value }))} />
                        </div>
                        {importEmbeddingForm.provider_type === "azure_openai" && (
                          <div className="space-y-1.5">
                            <Label htmlFor="imp-emb-ver">API Version <span className="text-xs text-muted-foreground">(optional)</span></Label>
                            <Input id="imp-emb-ver" placeholder="e.g. 2023-05-15" value={importEmbeddingForm.api_version} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportEmbeddingForm((p) => ({ ...p, api_version: e.target.value }))} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleImportOpenChange(false)} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing…" : "Import Agent"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete agent?</DialogTitle>
              <DialogDescription>
                <strong>{agentToDelete?.name}</strong> will be permanently deleted along with all its
                configuration, knowledge base documents, and API keys. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardShell>
    </ProtectedRoute>
  )
}
