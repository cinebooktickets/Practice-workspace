"use client"
import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Copy, Download, Info } from "lucide-react"
import { useAuth } from "@/context/auth"
import { toast } from "sonner"
import { agentsApi, agentExportImportApi, AgentResponse, AgentUpdate, ProviderType, ProviderConfig, EmbeddingConfig, EmbeddingProviderType, ApiException } from "@/lib/api"

// Local form state — maps to AgentUpdate fields
type ConfigForm = {
  name:            string
  system_prompt:   string
  greeting:        string
  allowed_topics:  string[]
  blocked_topics:  string[]
}

// Provider config form — write-only (secrets never returned by API)
type ProviderForm = {
  provider:         ProviderType | ""
  model:            string
  api_key:          string    // openai / anthropic / azure_openai
  base_url:         string    // openai (optional) / anthropic (optional) / ollama (required) / azure_openai (required)
  api_version:      string    // openai / anthropic (optional) / azure_openai (required)
  deployment_name:  string    // azure_openai only
}

// Embedding config form — write-only (api_key never returned by API)
type EmbeddingForm = {
  provider_type:  EmbeddingProviderType | ""
  model:          string
  api_key:        string
  base_url:       string
  api_version:    string
  embedding_dim:  string
}

type ConfigErrors = {
  system_prompt?: string
  provider_model?: string
  provider_api_key?: string
  provider_base_url?: string
}

const PROVIDER_LABELS: Record<ProviderType, string> = {
  openai:       "OpenAI",
  azure_openai: "Azure OpenAI",
  anthropic:    "Anthropic",
  ollama:       "Ollama (self-hosted)",
}

type Props = {
  agentId: string
  isAdmin: boolean
  onAgentUpdate?: (updated: { name?: string; is_active?: boolean }) => void
}

export function ConfigTab({ agentId, isAdmin, onAgentUpdate }: Props) {
  const { getAccessTokenSilently } = useAuth()

  const [form, setForm]           = React.useState<ConfigForm>({ name: "", system_prompt: "", greeting: "", allowed_topics: [], blocked_topics: [] })
  const [providerForm, setProviderForm] = React.useState<ProviderForm>({ provider: "", model: "", api_key: "", base_url: "", api_version: "", deployment_name: "" })
  const [currentProviderType, setCurrentProviderType] = React.useState<ProviderType | null>(null)
  // tracks whether backend already has an API key stored (so blank = keep existing, not remove)
  const [existingKeySet, setExistingKeySet] = React.useState(false)
  const [embeddingProvider, setEmbeddingProvider] = React.useState<string | null>(null)
  const [embeddingForm, setEmbeddingForm] = React.useState<EmbeddingForm>({ provider_type: "", model: "", api_key: "", base_url: "", api_version: "", embedding_dim: "" })
  const [existingEmbeddingKeySet, setExistingEmbeddingKeySet] = React.useState(false)
  const [isEmbeddingDirty, setIsEmbeddingDirty] = React.useState(false)

  const [description, setDescription] = React.useState("")

  const [loading, setLoading]     = React.useState(true)
  const [saving, setSaving]       = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [errors, setErrors]     = React.useState<ConfigErrors>({})
  const [isDirty, setIsDirty]   = React.useState(false)
  const [isProviderDirty, setIsProviderDirty] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const token = await getAccessTokenSilently()
        const agent: AgentResponse = await agentsApi.get(token, agentId)
        if (cancelled) return
        setForm({
          name:           agent.name           ?? "",
          system_prompt:  agent.system_prompt  ?? "",
          greeting:       agent.greeting       ?? "",
          allowed_topics: agent.allowed_topics ?? [],
          blocked_topics: agent.blocked_topics ?? [],
        })
        setDescription(agent.description ?? "")
        const embProvider = agent.embedding_config_preview?.provider_type ?? agent.embedding_provider ?? null
        setEmbeddingProvider(embProvider)
        if (embProvider && agent.embedding_config_preview) {
          const ec = agent.embedding_config_preview
          setEmbeddingForm({
            provider_type:  ec.provider_type,
            model:          ec.model          ?? "",
            api_key:        "",
            base_url:       ec.base_url       ?? "",
            api_version:    ec.api_version    ?? "",
            embedding_dim:  ec.embedding_dim  != null ? String(ec.embedding_dim) : "",
          })
          setExistingEmbeddingKeySet(true)
        } else if (embProvider) {
          setEmbeddingForm((prev) => ({ ...prev, provider_type: embProvider as EmbeddingProviderType }))
          setExistingEmbeddingKeySet(true)
        }
        setCurrentProviderType(agent.provider_type ?? null)
        if (agent.provider_config_preview) {
          const cfg = agent.provider_config_preview
          if (cfg.provider === "azure_openai") {
            setProviderForm({ provider: "azure_openai", model: "", api_key: "", base_url: cfg.base_url ?? "", api_version: cfg.api_version ?? "", deployment_name: cfg.deployment_name ?? "" })
          } else if (cfg.provider === "ollama") {
            setProviderForm({ provider: "ollama", model: cfg.model ?? "", api_key: "", base_url: cfg.base_url ?? "", api_version: "", deployment_name: "" })
          } else {
            setProviderForm({ provider: cfg.provider, model: cfg.model ?? "", api_key: "", base_url: cfg.base_url ?? "", api_version: cfg.api_version ?? "", deployment_name: "" })
          }
          setExistingKeySet(true)
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiException ? err.message : "Failed to load agent config"
          toast.error(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [agentId, getAccessTokenSilently])

  const updateForm = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
    if (key === "system_prompt" && errors.system_prompt) {
      setErrors((prev) => ({ ...prev, system_prompt: undefined }))
    }
  }

  const updateProvider = <K extends keyof ProviderForm>(key: K, value: ProviderForm[K]) => {
    setProviderForm((prev) => ({
      ...prev,
      [key]: value,
      // clear api_key + model fields when switching provider so old values don't bleed across
      ...(key === "provider" ? { api_key: "", model: "", deployment_name: "" } : {}),
    }))
    if (key === "provider") setExistingKeySet(false)
    setIsProviderDirty(true)
    setErrors((prev) => ({ ...prev, provider_model: undefined, provider_api_key: undefined, provider_base_url: undefined }))
  }

  const validate = (): boolean => {
    const errs: ConfigErrors = {}
    if (!form.system_prompt.trim()) errs.system_prompt = "System prompt is required"
    if (isProviderDirty && providerForm.provider) {
      if (providerForm.provider === "azure_openai") {
        if (!providerForm.deployment_name.trim()) errs.provider_model = "Deployment name is required"
        if (!existingKeySet && !providerForm.api_key.trim()) errs.provider_api_key = "API key is required"
        if (!providerForm.base_url.trim())        errs.provider_base_url = "Base URL is required"
      } else {
        if (providerForm.provider !== "ollama" && !providerForm.model.trim())    errs.provider_model = "Model is required"
        if (providerForm.provider !== "ollama" && !existingKeySet && !providerForm.api_key.trim()) errs.provider_api_key = "API key is required"
        if (providerForm.provider === "ollama" && !providerForm.base_url.trim()) errs.provider_base_url = "Base URL is required"
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const updateEmbedding = <K extends keyof EmbeddingForm>(key: K, value: EmbeddingForm[K]) => {
    setEmbeddingForm((prev) => ({ ...prev, [key]: value }))
    setIsEmbeddingDirty(true)
  }

  const handleResetEmbedding = async () => {
    try {
      const token = await getAccessTokenSilently()
      await agentsApi.update(token, agentId, { embedding_config: null })
      setEmbeddingProvider(null)
      setEmbeddingForm({ provider_type: "", model: "", api_key: "", base_url: "", api_version: "", embedding_dim: "" })
      setExistingEmbeddingKeySet(false)
      setIsEmbeddingDirty(false)
      toast.success("Embedding reset to org default")
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to reset embedding"
      toast.error(msg)
    }
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const body: AgentUpdate = {
        name:           form.name.trim()    || undefined,
        description:    description.trim()  || null,
        system_prompt:  form.system_prompt  || null,
        greeting:       form.greeting       || null,
        allowed_topics: form.allowed_topics.length ? form.allowed_topics : null,
        blocked_topics: form.blocked_topics.length ? form.blocked_topics : null,
      }
      // Only include provider_config if the user filled it in
      if (isProviderDirty && providerForm.provider) {
        const apiKey = providerForm.api_key.trim()
        if (providerForm.provider === "openai") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cfg: any = { provider: "openai", model: providerForm.model, base_url: providerForm.base_url || null, api_version: providerForm.api_version || null }
          if (apiKey) cfg.api_key = apiKey
          body.provider_config = cfg as ProviderConfig
        } else if (providerForm.provider === "azure_openai") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cfg: any = { provider: "azure_openai", deployment_name: providerForm.deployment_name, base_url: providerForm.base_url, api_version: providerForm.api_version }
          if (apiKey) cfg.api_key = apiKey
          body.provider_config = cfg as ProviderConfig
        } else if (providerForm.provider === "anthropic") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cfg: any = { provider: "anthropic", model: providerForm.model, base_url: providerForm.base_url || null, api_version: providerForm.api_version || null }
          if (apiKey) cfg.api_key = apiKey
          body.provider_config = cfg as ProviderConfig
        } else if (providerForm.provider === "ollama") {
          body.provider_config = { provider: "ollama", model: providerForm.model, base_url: providerForm.base_url }
        }
      }
      // Only include embedding_config if the user filled it in
      if (isEmbeddingDirty && embeddingForm.provider_type) {
        const embKey = embeddingForm.api_key.trim()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cfg: any = {
          provider_type: embeddingForm.provider_type,
          model:         embeddingForm.model.trim() || undefined,
          base_url:      embeddingForm.base_url.trim() || null,
          api_version:   embeddingForm.api_version.trim() || null,
          embedding_dim: embeddingForm.embedding_dim ? parseInt(embeddingForm.embedding_dim, 10) : null,
        }
        if (embKey) cfg.api_key = embKey
        body.embedding_config = cfg as EmbeddingConfig
      }
      const saved = await agentsApi.update(token, agentId, body)
      setIsDirty(false)
      setIsProviderDirty(false)
      setIsEmbeddingDirty(false)
      if (isEmbeddingDirty && embeddingForm.provider_type) {
        setEmbeddingProvider(embeddingForm.provider_type)
        setExistingEmbeddingKeySet(true)
        setEmbeddingForm((prev) => ({ ...prev, api_key: "" }))
      }
      if (isProviderDirty && providerForm.provider) {
        setCurrentProviderType(providerForm.provider as ProviderType)
        if (saved.provider_config_preview) {
          const cfg = saved.provider_config_preview
          if (cfg.provider === "azure_openai") {
            setProviderForm({ provider: "azure_openai", model: "", api_key: "", base_url: cfg.base_url ?? "", api_version: cfg.api_version ?? "", deployment_name: cfg.deployment_name ?? "" })
          } else if (cfg.provider === "ollama") {
            setProviderForm({ provider: "ollama", model: cfg.model ?? "", api_key: "", base_url: cfg.base_url ?? "", api_version: "", deployment_name: "" })
          } else {
            setProviderForm({ provider: cfg.provider, model: cfg.model ?? "", api_key: "", base_url: cfg.base_url ?? "", api_version: cfg.api_version ?? "", deployment_name: "" })
          }
          setExistingKeySet(true)
        } else {
          setProviderForm({ provider: "", model: "", api_key: "", base_url: "", api_version: "", deployment_name: "" })
          setExistingKeySet(false)
        }
      }
      onAgentUpdate?.({ name: saved.name })
      toast.success("Configuration saved")
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to save configuration"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const token = await getAccessTokenSilently()
      const result = await agentExportImportApi.exportAgent(token, agentId)
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `agent-${agentId}-export.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Agent exported successfully")
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to export agent"
      toast.error(msg)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Agent Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Name</CardTitle>
          <CardDescription>The display name for this agent.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="agent-name">Name</Label>
          <Input
            id="agent-name"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateForm("name", e.target.value)}
            disabled={!isAdmin}
            placeholder="e.g. PeopleBot"
            className="mt-1.5"
          />
        </CardContent>
      </Card>

      {/* Description — local only, not persisted to backend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
          <CardDescription>A short description of what this agent does.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            placeholder="e.g. Handles customer billing and account questions for Acme Inc."
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setDescription(e.target.value); setIsDirty(true) }}
            className="min-h-[80px] resize-y"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!description.trim()}
            onClick={() => {
              navigator.clipboard.writeText(description)
              toast.success("Copied to clipboard")
            }}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy
          </Button>
        </CardContent>
      </Card>

      {/* System prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Prompt</CardTitle>
          <CardDescription>
            Instructions that define your agent&apos;s behaviour, persona, and boundaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="system-prompt">
              System prompt <span className="text-destructive">*</span>
            </Label>
            <span className="text-xs text-muted-foreground">
              {form.system_prompt.length} chars
            </span>
          </div>
          <Textarea
            id="system-prompt"
            placeholder="You are a helpful customer support agent for Acme Inc. You help customers with billing, account, and product questions..."
            value={form.system_prompt}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateForm("system_prompt", e.target.value)}
            className="min-h-[160px] font-mono text-sm resize-y"
            aria-invalid={!!errors.system_prompt}
            aria-describedby={errors.system_prompt ? "prompt-error" : undefined}
          />
          {errors.system_prompt && (
            <p id="prompt-error" className="text-xs text-destructive">{errors.system_prompt}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!form.system_prompt.trim()}
            onClick={() => {
              navigator.clipboard.writeText(form.system_prompt)
              toast.success("Copied to clipboard")
            }}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy
          </Button>
        </CardContent>
      </Card>

      {/* Greeting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Greeting Message</CardTitle>
          <CardDescription>The first message your agent sends when a conversation starts.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Hi! How can I help you today?"
            value={form.greeting}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateForm("greeting", e.target.value)}
            className="min-h-[80px] resize-y"
          />
        </CardContent>
      </Card>

      {/* Provider config — write-only (secrets never returned) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LLM Provider Config</CardTitle>
          <CardDescription>
            {currentProviderType
              ? <>Current provider: <span className="font-medium capitalize">{PROVIDER_LABELS[currentProviderType]}</span>. Non-secret fields are pre-filled. Enter a new API key only to replace the current one.</>
              : "No provider configured. Fill in fields below to set one."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span><strong>Optional override.</strong> Leave all fields blank to use the organisation-wide default set in <strong>Settings → AI Models</strong>. Fill in only if this agent needs a different model or API key.</span>
          </div>
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={providerForm.provider} onValueChange={(v: string) => updateProvider("provider", v as ProviderType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider…" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PROVIDER_LABELS) as [ProviderType, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {providerForm.provider && (
            <>
              {providerForm.provider === "azure_openai" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="provider-deployment">Deployment Name</Label>
                    <Input
                      id="provider-deployment"
                      placeholder="e.g. gpt-4o-prod"
                      value={providerForm.deployment_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProvider("deployment_name", e.target.value)}
                      aria-invalid={!!errors.provider_model}
                    />
                    {errors.provider_model && <p className="text-xs text-destructive">{errors.provider_model}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="provider-key">API Key</Label>
                    <Input
                      id="provider-key"
                      type="password"
                      placeholder={existingKeySet ? "Leave blank to keep current key" : "Azure API key"}
                      value={providerForm.api_key}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProvider("api_key", e.target.value)}
                      aria-invalid={!!errors.provider_api_key}
                      autoComplete="off"
                    />
                    {errors.provider_api_key && <p className="text-xs text-destructive">{errors.provider_api_key}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="provider-base-url">Base URL</Label>
                    <Input
                      id="provider-base-url"
                      placeholder="e.g. https://my-resource.cognitiveservices.azure.com"
                      value={providerForm.base_url}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProvider("base_url", e.target.value)}
                      aria-invalid={!!errors.provider_base_url}
                    />
                    {errors.provider_base_url && <p className="text-xs text-destructive">{errors.provider_base_url}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="provider-api-version">API Version</Label>
                    <Input
                      id="provider-api-version"
                      placeholder="e.g. 2025-04-01-preview"
                      value={providerForm.api_version}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProvider("api_version", e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="provider-model">Model identifier</Label>
                    <Input
                      id="provider-model"
                      placeholder={providerForm.provider === "openai" ? "e.g. gpt-4o" : providerForm.provider === "anthropic" ? "e.g. claude-3-5-sonnet" : "e.g. llama3"}
                      value={providerForm.model}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProvider("model", e.target.value)}
                      aria-invalid={!!errors.provider_model}
                    />
                    {errors.provider_model && <p className="text-xs text-destructive">{errors.provider_model}</p>}
                  </div>

                  {providerForm.provider !== "ollama" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="provider-key">API Key</Label>
                      <Input
                        id="provider-key"
                        type="password"
                        placeholder={existingKeySet ? "Leave blank to keep current key" : providerForm.provider === "anthropic" ? "sk-ant-…" : "sk-…"}
                        value={providerForm.api_key}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProvider("api_key", e.target.value)}
                        aria-invalid={!!errors.provider_api_key}
                        autoComplete="off"
                      />
                      {errors.provider_api_key && <p className="text-xs text-destructive">{errors.provider_api_key}</p>}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="provider-url">Base URL</Label>
                      <Input
                        id="provider-url"
                        placeholder="http://localhost:11434"
                        value={providerForm.base_url}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProvider("base_url", e.target.value)}
                        aria-invalid={!!errors.provider_base_url}
                      />
                      {errors.provider_base_url && <p className="text-xs text-destructive">{errors.provider_base_url}</p>}
                    </div>
                  )}

                  {(providerForm.provider === "openai" || providerForm.provider === "anthropic") && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="provider-base-url">
                          Base URL <span className="text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="provider-base-url"
                          placeholder={providerForm.provider === "openai" ? "e.g. https://api.openai.com/v1" : "e.g. https://api.anthropic.com"}
                          value={providerForm.base_url}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProvider("base_url", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="provider-api-version">
                          API Version <span className="text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="provider-api-version"
                          placeholder={providerForm.provider === "openai" ? "e.g. 2024-02-01" : "e.g. 2023-06-01"}
                          value={providerForm.api_version}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProvider("api_version", e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Embedding Config — full form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embedding Config</CardTitle>
          <CardDescription>
            {embeddingProvider
              ? <>Active embedding: <span className="font-medium capitalize">{embeddingProvider.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>. Enter a new API key only to replace the current one.</>  
              : "No agent-level override active. Fill in fields below to set one, or leave blank to use the org default in Settings → AI Models."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span><strong>Optional override.</strong> Leave all fields blank to use the organisation-wide embedding config from <strong>Settings → AI Models</strong>.</span>
          </div>
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={embeddingForm.provider_type} onValueChange={(v: string) => updateEmbedding("provider_type", v as EmbeddingProviderType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select embedding provider…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                <SelectItem value="ollama">Ollama (self-hosted)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {embeddingForm.provider_type && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="emb-model">Model</Label>
                <Input
                  id="emb-model"
                  placeholder={embeddingForm.provider_type === "openai" ? "e.g. text-embedding-3-small" : embeddingForm.provider_type === "azure_openai" ? "e.g. text-embedding-ada-002" : "e.g. nomic-embed-text"}
                  value={embeddingForm.model}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEmbedding("model", e.target.value)}
                />
              </div>
              {embeddingForm.provider_type !== "ollama" && (
                <div className="space-y-1.5">
                  <Label htmlFor="emb-key">API Key</Label>
                  <Input
                    id="emb-key"
                    type="password"
                    placeholder={existingEmbeddingKeySet ? "Leave blank to keep current key" : "sk-…"}
                    value={embeddingForm.api_key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEmbedding("api_key", e.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="emb-base-url">
                  Base URL <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="emb-base-url"
                  placeholder={embeddingForm.provider_type === "ollama" ? "http://localhost:11434" : "e.g. https://my-resource.cognitiveservices.azure.com"}
                  value={embeddingForm.base_url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEmbedding("base_url", e.target.value)}
                />
              </div>
              {embeddingForm.provider_type === "azure_openai" && (
                <div className="space-y-1.5">
                  <Label htmlFor="emb-api-version">
                    API Version <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="emb-api-version"
                    placeholder="e.g. 2023-05-15"
                    value={embeddingForm.api_version}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEmbedding("api_version", e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="emb-dim">
                  Embedding Dimension <span className="text-xs text-muted-foreground">(optional — must match ingest time)</span>
                </Label>
                <Input
                  id="emb-dim"
                  type="number"
                  placeholder="e.g. 1536"
                  value={embeddingForm.embedding_dim}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEmbedding("embedding_dim", e.target.value)}
                />
              </div>
            </>
          )}

          {embeddingProvider && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetEmbedding}
              disabled={!isAdmin}
              className="text-destructive hover:text-destructive"
            >
              Reset to org default
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Save / Export */}
      <div className="flex justify-between items-center gap-3 pb-4">
        <Button variant="outline" onClick={handleExport} disabled={exporting} aria-label="Export agent as JSON bundle">
          <Download className="h-4 w-4 mr-2" aria-hidden="true" />
          {exporting ? "Exporting…" : "Export Agent"}
        </Button>
        <div className="flex items-center gap-3">
          {(isDirty || isProviderDirty || isEmbeddingDirty) && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          <Button onClick={handleSave} disabled={saving || (!isDirty && !isProviderDirty && !isEmbeddingDirty) || !isAdmin}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
