"use client"
import React, { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/context/auth"
import { alertConfigApi, reportScheduleApi, gdprApi, llmSettingsApi, embeddingSettingsApi, communicationApi, ApiException, type AlertConfigResponse, type AlertConfigUpdateRequest, type ReportScheduleResponse, type ReportScheduleUpdateRequest, type LLMSettingsOut, type LLMSettingsIn, type EmbeddingSettingsOut, type EmbeddingSettingsIn, type SMTPSettingsOut, type TwilioSettingsOut } from "@/lib/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { Lock, Brain, Bell, Database, CreditCard, AlertTriangle, RefreshCw, Mail, Info } from "lucide-react"

// ─── AI Models Tab ────────────────────────────────────────────────────────────

type ModelFormState = {
  provider:        string
  model:           string
  api_key:         string
  base_url:        string
  api_version:     string
  deployment_name: string
}

type ModelSectionProps = {
  title:       string
  description: string
  data:        LLMSettingsOut | EmbeddingSettingsOut | null
  loading:     boolean
  saving:      boolean
  isAdmin:     boolean
  form:        ModelFormState
  setForm:     (fn: (prev: ModelFormState) => ModelFormState) => void
  onSave:      () => void
}

function ModelSection({ title, description, data, loading, saving, isAdmin, form, setForm, onSave }: ModelSectionProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  const saveButton = (
    <Button onClick={onSave} disabled={saving || !isAdmin}>
      {saving ? "Saving\u2026" : "Save"}
    </Button>
  )

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>This is the <strong>organisation-wide default</strong>. All agents use this model unless they configure their own override in <strong>Agent → Config → LLM Provider</strong>.</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${title}-provider`}>Provider</Label>
          <Select
            value={form.provider}
            onValueChange={(v: string) => setForm(p => ({ ...p, provider: v }))}
            disabled={!isAdmin}
          >
            <SelectTrigger id={`${title}-provider`}>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="ollama">Ollama (self-hosted)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${title}-model`}>Model</Label>
          <Input
            id={`${title}-model`}
            value={form.model}
            onChange={(e) => setForm(p => ({ ...p, model: e.target.value }))}
            disabled={!isAdmin}
            placeholder={form.provider === "anthropic" ? "e.g. claude-3-5-sonnet-20241022" : form.provider === "ollama" ? "e.g. llama3" : "e.g. gpt-4o"}
          />
        </div>
      </div>

      {form.provider && (
        <div className="grid gap-3 sm:grid-cols-2">
          {form.provider === "azure_openai" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`${title}-api-key`}>
                  API Key
                  {data?.api_key === "***" && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(set — enter new value to replace)</span>
                  )}
                </Label>
                <Input
                  id={`${title}-api-key`}
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm(p => ({ ...p, api_key: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder={data?.api_key === "***" ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "Azure API key"}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${title}-base-url`}>Base URL</Label>
                <Input
                  id={`${title}-base-url`}
                  value={form.base_url}
                  onChange={(e) => setForm(p => ({ ...p, base_url: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder="e.g. https://my-resource.cognitiveservices.azure.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${title}-api-version`}>API Version</Label>
                <Input
                  id={`${title}-api-version`}
                  value={form.api_version}
                  onChange={(e) => setForm(p => ({ ...p, api_version: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder="e.g. 2025-04-01-preview"
                />
              </div>
            </>
          ) : form.provider === "ollama" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${title}-base-url`}>Base URL <span className="text-destructive">*</span></Label>
              <Input
                id={`${title}-base-url`}
                value={form.base_url}
                onChange={(e) => setForm(p => ({ ...p, base_url: e.target.value }))}
                disabled={!isAdmin}
                placeholder="e.g. http://localhost:11434"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`${title}-api-key`}>
                  API Key
                  {data?.api_key === "***" && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(set — enter new value to replace)</span>
                  )}
                </Label>
                <Input
                  id={`${title}-api-key`}
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm(p => ({ ...p, api_key: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder={data?.api_key === "***" ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : form.provider === "anthropic" ? "sk-ant-…" : "sk-…"}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${title}-base-url`}>Base URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id={`${title}-base-url`}
                  value={form.base_url}
                  onChange={(e) => setForm(p => ({ ...p, base_url: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder={form.provider === "anthropic" ? "e.g. https://api.anthropic.com" : "e.g. https://api.openai.com/v1"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${title}-api-version`}>API Version <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id={`${title}-api-version`}
                  value={form.api_version}
                  onChange={(e) => setForm(p => ({ ...p, api_version: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder={form.provider === "anthropic" ? "e.g. 2023-06-01" : "e.g. 2024-02-01"}
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end">
        {isAdmin ? (
          saveButton
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{saveButton}</span>
              </TooltipTrigger>
              <TooltipContent>Admin access required</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}

function AIModelsTab() {
  const { getAccessTokenSilently, user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [llmData,    setLlmData]    = React.useState<LLMSettingsOut | null>(null)
  const [embData,    setEmbData]    = React.useState<EmbeddingSettingsOut | null>(null)
  const [llmLoading, setLlmLoading] = React.useState(true)
  const [embLoading, setEmbLoading] = React.useState(true)
  const [llmError,   setLlmError]   = React.useState<string | null>(null)
  const [embError,   setEmbError]   = React.useState<string | null>(null)
  const [llmSaving,  setLlmSaving]  = React.useState(false)
  const [embSaving,  setEmbSaving]  = React.useState(false)

  const [llmForm, setLlmForm] = React.useState<ModelFormState>({ provider: "", model: "", api_key: "", base_url: "", api_version: "", deployment_name: "" })
  const [embForm, setEmbForm] = React.useState<ModelFormState>({ provider: "", model: "", api_key: "", base_url: "", api_version: "", deployment_name: "" })

  const loadLLM = React.useCallback(async () => {
    setLlmLoading(true)
    setLlmError(null)
    try {
      const token = await getAccessTokenSilently()
      const data  = await llmSettingsApi.get(token)
      setLlmData(data)
      setLlmForm({ provider: data.provider, model: data.deployment_name ?? data.model, api_key: "", base_url: data.base_url ?? "", api_version: data.api_version ?? "", deployment_name: data.deployment_name ?? "" })
    } catch (err) {
      setLlmError(err instanceof ApiException ? err.message : "Failed to load LLM settings")
    } finally {
      setLlmLoading(false)
    }
  }, [getAccessTokenSilently])

  const loadEmbedding = React.useCallback(async () => {
    setEmbLoading(true)
    setEmbError(null)
    try {
      const token = await getAccessTokenSilently()
      const data  = await embeddingSettingsApi.get(token)
      setEmbData(data)
      setEmbForm({ provider: data.provider, model: data.model, api_key: "", base_url: data.base_url ?? "", api_version: (data.extra as Record<string, string> | null)?.api_version ?? "", deployment_name: (data.extra as Record<string, string> | null)?.deployment_name ?? "" })
    } catch (err) {
      setEmbError(err instanceof ApiException ? err.message : "Failed to load embedding settings")
    } finally {
      setEmbLoading(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => { loadLLM() }, [loadLLM])
  React.useEffect(() => { loadEmbedding() }, [loadEmbedding])

  const handleSaveLLM = async () => {
    setLlmSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const body: Record<string, unknown> = { provider: llmForm.provider }
      if (llmForm.provider === "azure_openai") {
        body.deployment_name = llmForm.model
        body.api_version     = llmForm.api_version
        body.base_url        = llmForm.base_url
        if (llmForm.api_key) body.api_key = llmForm.api_key
      } else {
        body.model = llmForm.model
        if (llmForm.api_key)     body.api_key  = llmForm.api_key
        if (llmForm.base_url)    body.base_url = llmForm.base_url
        if (llmForm.provider !== "ollama" && llmForm.api_version)
          body.api_version = llmForm.api_version
      }
      const updated = await llmSettingsApi.update(token, body as LLMSettingsIn)
      setLlmData(updated)
      setLlmForm(p => ({ ...p, api_key: "" }))
      toast.success("LLM settings saved")
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Failed to save LLM settings")
    } finally {
      setLlmSaving(false)
    }
  }

  const handleSaveEmbedding = async () => {
    setEmbSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const body: Record<string, unknown> = { provider: embForm.provider }
      body.model = embForm.model
      if (embForm.api_key)  body.api_key  = embForm.api_key
      if (embForm.base_url) body.base_url = embForm.base_url
      const updated = await embeddingSettingsApi.update(token, body as EmbeddingSettingsIn)
      setEmbData(updated)
      setEmbForm(p => ({ ...p, api_key: "" }))
      toast.success("Embedding settings saved")
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Failed to save embedding settings")
    } finally {
      setEmbSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4" aria-hidden="true" />
          AI Models
        </CardTitle>
        <CardDescription>Configure LLM providers and embedding models for your organization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {llmError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className="text-sm text-destructive">{llmError}</p>
            <Button variant="outline" size="sm" onClick={loadLLM}>
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />Retry
            </Button>
          </div>
        ) : (
          <ModelSection
            title="LLM"
            description="The language model used for chat responses and agent reasoning."
            data={llmData}
            loading={llmLoading}
            saving={llmSaving}
            isAdmin={isAdmin}
            form={llmForm}
            setForm={setLlmForm}
            onSave={handleSaveLLM}
          />
        )}

        <Separator />

        {embError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className="text-sm text-destructive">{embError}</p>
            <Button variant="outline" size="sm" onClick={loadEmbedding}>
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />Retry
            </Button>
          </div>
        ) : (
          <ModelSection
            title="Embedding"
            description="The embedding model used for knowledge base indexing and retrieval."
            data={embData}
            loading={embLoading}
            saving={embSaving}
            isAdmin={isAdmin}
            form={embForm}
            setForm={setEmbForm}
            onSave={handleSaveEmbedding}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Communication Tab ──────────────────────────────────────────────────────

type CommFormState = {
  smtp_host:         string
  smtp_port:         string
  smtp_username:     string
  smtp_password:     string
  smtp_use_tls:      boolean
  smtp_from_address: string
}

type TwilioFormState = {
  account_sid:  string
  auth_token:   string
  from_number:  string
}

function CommunicationTab() {
  const { getAccessTokenSilently, user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [smtpData,     setSmtpData]     = React.useState<SMTPSettingsOut | null>(null)
  const [twilioData,   setTwilioData]   = React.useState<TwilioSettingsOut | null>(null)
  const [smtpLoading,  setSmtpLoading]  = React.useState(true)
  const [twilioLoading,setTwilioLoading]= React.useState(true)
  const [smtpError,    setSmtpError]    = React.useState<string | null>(null)
  const [twilioError,  setTwilioError]  = React.useState<string | null>(null)
  const [smtpSaving,   setSmtpSaving]   = React.useState(false)
  const [twilioSaving, setTwilioSaving] = React.useState(false)

  const [smtpForm, setSmtpForm] = React.useState<CommFormState>({
    smtp_host: "", smtp_port: "587", smtp_username: "",
    smtp_password: "", smtp_use_tls: true, smtp_from_address: "",
  })
  const [twilioForm, setTwilioForm] = React.useState<TwilioFormState>({
    account_sid: "", auth_token: "", from_number: "",
  })

  const loadSMTP = React.useCallback(async () => {
    setSmtpLoading(true)
    setSmtpError(null)
    try {
      const token = await getAccessTokenSilently()
      const data  = await communicationApi.getSMTP(token)
      setSmtpData(data)
      setSmtpForm({
        smtp_host:         data.host,
        smtp_port:         String(data.port),
        smtp_username:     data.username ?? "",
        smtp_password:     "",
        smtp_use_tls:      data.use_tls,
        smtp_from_address: data.from_address,
      })
    } catch (err) {
      setSmtpError(err instanceof ApiException ? err.message : "Failed to load SMTP settings")
    } finally {
      setSmtpLoading(false)
    }
  }, [getAccessTokenSilently])

  const loadTwilio = React.useCallback(async () => {
    setTwilioLoading(true)
    setTwilioError(null)
    try {
      const token = await getAccessTokenSilently()
      const data  = await communicationApi.getTwilio(token)
      setTwilioData(data)
      setTwilioForm({
        account_sid: data.account_sid,
        auth_token:  "",
        from_number: data.from_number,
      })
    } catch (err) {
      setTwilioError(err instanceof ApiException ? err.message : "Failed to load Twilio settings")
    } finally {
      setTwilioLoading(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => { loadSMTP()   }, [loadSMTP])
  React.useEffect(() => { loadTwilio() }, [loadTwilio])

  const handleSaveSMTP = async () => {
    setSmtpSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const body = {
        host:         smtpForm.smtp_host,
        port:         parseInt(smtpForm.smtp_port, 10) || 587,
        use_tls:      smtpForm.smtp_use_tls,
        from_address: smtpForm.smtp_from_address,
        ...(smtpForm.smtp_username ? { username: smtpForm.smtp_username } : {}),
        ...(smtpForm.smtp_password ? { password: smtpForm.smtp_password } : {}),
      }
      const updated = await communicationApi.updateSMTP(token, body)
      setSmtpData(updated)
      setSmtpForm(p => ({ ...p, smtp_password: "" }))
      toast.success("SMTP settings saved")
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Failed to save SMTP settings")
    } finally {
      setSmtpSaving(false)
    }
  }

  const handleSaveTwilio = async () => {
    setTwilioSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const body = {
        account_sid: twilioForm.account_sid,
        from_number: twilioForm.from_number,
        ...(twilioForm.auth_token ? { auth_token: twilioForm.auth_token } : {}),
      }
      const updated = await communicationApi.updateTwilio(token, body)
      setTwilioData(updated)
      setTwilioForm(p => ({ ...p, auth_token: "" }))
      toast.success("Twilio settings saved")
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Failed to save Twilio settings")
    } finally {
      setTwilioSaving(false)
    }
  }

  const saveBtn = (label: string, saving: boolean, onSave: () => void) => {
    const btn = (
      <Button onClick={onSave} disabled={saving || !isAdmin}>
        {saving ? "Saving\u2026" : label}
      </Button>
    )
    return isAdmin ? btn : (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span tabIndex={0}>{btn}</span></TooltipTrigger>
          <TooltipContent>Admin access required</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" aria-hidden="true" />
          Communication
        </CardTitle>
        <CardDescription>Configure outbound email (SMTP) and SMS (Twilio) for your organization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">

        {/* SMTP */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">SMTP</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Outbound email settings for alerts and notifications.</p>
          </div>

          {smtpError ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <p className="text-sm text-destructive">{smtpError}</p>
              <Button variant="outline" size="sm" onClick={loadSMTP}>
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />Retry
              </Button>
            </div>
          ) : smtpLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-host">Host</Label>
                  <Input id="smtp-host" value={smtpForm.smtp_host}
                    onChange={(e) => setSmtpForm(p => ({ ...p, smtp_host: e.target.value }))}
                    disabled={!isAdmin} placeholder="smtp.example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input id="smtp-port" type="number" value={smtpForm.smtp_port}
                    onChange={(e) => setSmtpForm(p => ({ ...p, smtp_port: e.target.value }))}
                    disabled={!isAdmin} placeholder="587" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-username">Username <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="smtp-username" value={smtpForm.smtp_username}
                    onChange={(e) => setSmtpForm(p => ({ ...p, smtp_username: e.target.value }))}
                    disabled={!isAdmin} placeholder="user@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-password">
                    Password
                    {smtpData?.password === "***" && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(set — enter new value to replace)</span>
                    )}
                  </Label>
                  <Input id="smtp-password" type="password" value={smtpForm.smtp_password}
                    onChange={(e) => setSmtpForm(p => ({ ...p, smtp_password: e.target.value }))}
                    disabled={!isAdmin}
                    placeholder={smtpData?.password === "***" ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "Password"}
                    autoComplete="new-password" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="smtp-from">From address</Label>
                  <Input id="smtp-from" type="email" value={smtpForm.smtp_from_address}
                    onChange={(e) => setSmtpForm(p => ({ ...p, smtp_from_address: e.target.value }))}
                    disabled={!isAdmin} placeholder="noreply@yourcompany.com" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="smtp-tls" checked={smtpForm.smtp_use_tls}
                  onCheckedChange={(v) => setSmtpForm(p => ({ ...p, smtp_use_tls: v }))}
                  disabled={!isAdmin} />
                <Label htmlFor="smtp-tls">Use TLS</Label>
              </div>
              <div className="flex justify-end">
                {saveBtn("Save SMTP", smtpSaving, handleSaveSMTP)}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Twilio */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Twilio</h3>
            <p className="text-xs text-muted-foreground mt-0.5">SMS delivery credentials for alert notifications.</p>
          </div>

          {twilioError ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <p className="text-sm text-destructive">{twilioError}</p>
              <Button variant="outline" size="sm" onClick={loadTwilio}>
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />Retry
              </Button>
            </div>
          ) : twilioLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="twilio-sid">Account SID</Label>
                  <Input id="twilio-sid" value={twilioForm.account_sid}
                    onChange={(e) => setTwilioForm(p => ({ ...p, account_sid: e.target.value }))}
                    disabled={!isAdmin} placeholder="ACxxxxxxxx" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="twilio-token">
                    Auth Token
                    {twilioData?.auth_token === "***" && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(set — enter new value to replace)</span>
                    )}
                  </Label>
                  <Input id="twilio-token" type="password" value={twilioForm.auth_token}
                    onChange={(e) => setTwilioForm(p => ({ ...p, auth_token: e.target.value }))}
                    disabled={!isAdmin}
                    placeholder={twilioData?.auth_token === "***" ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "Auth token"}
                    autoComplete="new-password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="twilio-from">From number</Label>
                  <Input id="twilio-from" value={twilioForm.from_number}
                    onChange={(e) => setTwilioForm(p => ({ ...p, from_number: e.target.value }))}
                    disabled={!isAdmin} placeholder="+1 555 000 0000" />
                </div>
              </div>
              <div className="flex justify-end">
                {saveBtn("Save Twilio", twilioSaving, handleSaveTwilio)}
              </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  )
}

// ─── Contract-pending placeholder ────────────────────────────────────────────

type PendingTabProps = {
  icon: React.ReactNode
  label: string
  description: string
}

function PendingTab({ icon, label, description }: PendingTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {label}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
          <AlertTriangle className="h-8 w-8 opacity-40" aria-hidden="true" />
          <p className="text-sm font-medium">No backend contract yet</p>
          <p className="text-xs max-w-sm">
            This tab will be enabled when the backend team shares the API contract for {label.toLowerCase()} configuration.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Notifications tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const { getAccessTokenSilently } = useAuth()

  const [config, setConfig] = React.useState<AlertConfigResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)

  // Form state — mirrors AlertConfigUpdateRequest fields
  const [creditLow, setCreditLow] = React.useState("")
  const [highVolume, setHighVolume] = React.useState("")
  const [lowFeedback, setLowFeedback] = React.useState("")
  const [webhookEnabled, setWebhookEnabled] = React.useState(false)
  const [webhookUrl, setWebhookUrl] = React.useState("")
  const [emailEnabled, setEmailEnabled] = React.useState(false)
  const [emailTo, setEmailTo] = React.useState("")
  const [smsEnabled, setSmsEnabled] = React.useState(false)
  const [smsTo, setSmsTo] = React.useState("")

  const fetchConfig = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const data = await alertConfigApi.get(token)
      setConfig(data)
      // Populate form
      setCreditLow(String(data.credit_low_threshold))
      setHighVolume(String(data.high_volume_threshold))
      setLowFeedback(String(data.low_feedback_threshold))
      setWebhookEnabled(data.webhook_enabled)
      setWebhookUrl(data.webhook_url ?? "")
      setEmailEnabled(data.email_enabled)
      setEmailTo(data.email_to ?? "")
      setSmsEnabled(data.sms_enabled)
      setSmsTo(data.sms_to ?? "")
    } catch (err: unknown) {
      setError(err instanceof ApiException ? err.message : "Failed to load alert configuration")
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const body: AlertConfigUpdateRequest = {
        credit_low_threshold:   parseInt(creditLow,   10) || 0,
        high_volume_threshold:  parseInt(highVolume,  10) || 0,
        low_feedback_threshold: parseInt(lowFeedback, 10) || 0,
        webhook_enabled: webhookEnabled,
        webhook_url: webhookEnabled && webhookUrl.trim() ? webhookUrl.trim() : null,
        email_enabled: emailEnabled,
        email_to: emailEnabled && emailTo.trim() ? emailTo.trim() : null,
        sms_enabled: smsEnabled,
        sms_to: smsEnabled && smsTo.trim() ? smsTo.trim() : null,
      }
      const updated = await alertConfigApi.update(token, body)
      setConfig(updated)
      toast.success("Alert configuration saved")
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to save configuration")
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const token = await getAccessTokenSilently()
      const res = await alertConfigApi.test(token)
      toast.success(`Test dispatch queued — channels: ${res.channels.join(", ") || "none"}`)
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to trigger test dispatch")
    } finally {
      setTesting(false)
    }
  }

  const handleCreditLowChange    = (e: React.ChangeEvent<HTMLInputElement>) => { setCreditLow(e.target.value) }
  const handleHighVolumeChange   = (e: React.ChangeEvent<HTMLInputElement>) => { setHighVolume(e.target.value) }
  const handleLowFeedbackChange  = (e: React.ChangeEvent<HTMLInputElement>) => { setLowFeedback(e.target.value) }
  const handleWebhookUrlChange   = (e: React.ChangeEvent<HTMLInputElement>) => { setWebhookUrl(e.target.value) }
  const handleEmailToChange      = (e: React.ChangeEvent<HTMLInputElement>) => { setEmailTo(e.target.value) }
  const handleSmsToChange        = (e: React.ChangeEvent<HTMLInputElement>) => { setSmsTo(e.target.value) }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchConfig}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" aria-hidden="true" />
            Notifications &amp; Alerts
          </CardTitle>
          <CardDescription className="mt-1">
            Configure alert thresholds and delivery channels for your organization.
          </CardDescription>
        </div>
        {!loading && config && (
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? "Sending…" : "Test dispatch"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <>
            {/* Alert thresholds */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Alert Thresholds</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="credit-low">Low credit balance</Label>
                  <Input
                    id="credit-low"
                    type="number"
                    min={0}
                    value={creditLow}
                    onChange={handleCreditLowChange}
                    placeholder="e.g. 100"
                  />
                  <p className="text-xs text-muted-foreground">Alert when credits drop below this amount</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="high-volume">High message volume</Label>
                  <Input
                    id="high-volume"
                    type="number"
                    min={0}
                    value={highVolume}
                    onChange={handleHighVolumeChange}
                    placeholder="e.g. 1000"
                  />
                  <p className="text-xs text-muted-foreground">Alert when hourly messages exceed this</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="low-feedback">Low feedback rate</Label>
                  <Input
                    id="low-feedback"
                    type="number"
                    min={0}
                    value={lowFeedback}
                    onChange={handleLowFeedbackChange}
                    placeholder="e.g. 50"
                  />
                  <p className="text-xs text-muted-foreground">Alert when positive rate drops below this %</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Delivery channels */}
            <div className="space-y-6">
              <h3 className="text-sm font-semibold">Delivery Channels</h3>

              {/* Webhook */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch id="webhook-enabled" checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
                  <Label htmlFor="webhook-enabled" className="font-medium">Webhook</Label>
                </div>
                {webhookEnabled && (
                  <div className="ml-9 space-y-1.5">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      type="url"
                      value={webhookUrl}
                      onChange={handleWebhookUrlChange}
                      placeholder="https://your-server.com/hooks/alerts"
                    />
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch id="email-enabled" checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                  <Label htmlFor="email-enabled" className="font-medium">Email</Label>
                </div>
                {emailEnabled && (
                  <div className="ml-9 space-y-1.5">
                    <Label htmlFor="email-to">Recipient address</Label>
                    <Input
                      id="email-to"
                      type="email"
                      value={emailTo}
                      onChange={handleEmailToChange}
                      placeholder="alerts@yourcompany.com"
                    />
                  </div>
                )}
              </div>

              {/* SMS */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch id="sms-enabled" checked={smsEnabled} onCheckedChange={setSmsEnabled} />
                  <Label htmlFor="sms-enabled" className="font-medium">SMS</Label>
                </div>
                {smsEnabled && (
                  <div className="ml-9 space-y-1.5">
                    <Label htmlFor="sms-to">Phone number</Label>
                    <Input
                      id="sms-to"
                      type="tel"
                      value={smsTo}
                      onChange={handleSmsToChange}
                      placeholder="+1 555 000 0000"
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Report schedule section ──────────────────────────────────────────────────

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function ReportScheduleSection() {
  const { getAccessTokenSilently } = useAuth()

  const [schedule, setSchedule]       = React.useState<ReportScheduleResponse | null>(null)
  const [loading, setLoading]         = React.useState(true)
  const [saving, setSaving]           = React.useState(false)
  const [deleting, setDeleting]       = React.useState(false)

  // Form state
  const [dayOfWeek, setDayOfWeek]     = React.useState("0")
  const [hourUtc, setHourUtc]         = React.useState("8")
  const [webhookUrl, setWebhookUrl]   = React.useState("")
  const [emailList, setEmailList]     = React.useState("")   // comma-separated
  const [isActive, setIsActive]       = React.useState(true)

  const fetchSchedule = React.useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessTokenSilently()
      const data  = await reportScheduleApi.get(token)
      setSchedule(data)
      setDayOfWeek(String(data.day_of_week))
      setHourUtc(String(data.hour_utc))
      setWebhookUrl(data.webhook_url ?? "")
      setEmailList((data.email_recipients ?? []).join(", "))
      setIsActive(data.is_active)
    } catch (e) {
      // 404 = no schedule yet — that's fine
      if (!(e instanceof ApiException && e.status === 404)) {
        toast.error("Failed to load report schedule")
      }
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => { fetchSchedule() }, [fetchSchedule])

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const body: ReportScheduleUpdateRequest = {
        frequency:         "weekly",
        day_of_week:       parseInt(dayOfWeek, 10),
        hour_utc:          parseInt(hourUtc, 10),
        webhook_url:       webhookUrl.trim() || null,
        email_recipients:  emailList.trim()
          ? emailList.split(",").map(s => s.trim()).filter(Boolean)
          : null,
        is_active: isActive,
      }
      const saved = await reportScheduleApi.save(token, body)
      setSchedule(saved)
      toast.success("Report schedule saved")
    } catch (e) {
      toast.error(e instanceof ApiException ? e.message : "Failed to save schedule")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const token = await getAccessTokenSilently()
      await reportScheduleApi.delete(token)
      setSchedule(null)
      setWebhookUrl("")
      setEmailList("")
      toast.success("Report schedule removed")
    } catch (e) {
      toast.error(e instanceof ApiException ? e.message : "Failed to remove schedule")
    } finally {
      setDeleting(false)
    }
  }

  const handleDayOfWeekChange  = (e: React.ChangeEvent<HTMLSelectElement>) => setDayOfWeek(e.target.value)
  const handleHourUtcChange    = (e: React.ChangeEvent<HTMLInputElement>)   => setHourUtc(e.target.value)
  const handleWebhookUrlChange = (e: React.ChangeEvent<HTMLInputElement>)   => setWebhookUrl(e.target.value)
  const handleEmailListChange  = (e: React.ChangeEvent<HTMLInputElement>)   => setEmailList(e.target.value)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Report Digest Schedule</h3>
        {schedule && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Removing…" : "Remove schedule"}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Send a weekly usage digest to configured recipients.
      </p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" aria-hidden="true" />)}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="day-of-week">Day of week</Label>
              <select
                id="day-of-week"
                value={dayOfWeek}
                onChange={handleDayOfWeekChange}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {DAY_LABELS.map((label, i) => (
                  <option key={i} value={String(i)}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hour-utc">Hour (UTC)</Label>
              <Input
                id="hour-utc"
                type="number"
                min={0}
                max={23}
                value={hourUtc}
                onChange={handleHourUtcChange}
                placeholder="8"
              />
              <p className="text-xs text-muted-foreground">0–23</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-webhook">Webhook URL <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="report-webhook"
              type="url"
              placeholder="https://hooks.example.com/digest"
              value={webhookUrl}
              onChange={handleWebhookUrlChange}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-emails">Email recipients <span className="text-muted-foreground">(comma-separated)</span></Label>
            <Input
              id="report-emails"
              type="text"
              placeholder="admin@company.com, team@company.com"
              value={emailList}
              onChange={handleEmailListChange}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="schedule-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="schedule-active">Active</Label>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Data tab (GDPR) ──────────────────────────────────────────────────────────

function DataTab() {
  const { getAccessTokenSilently } = useAuth()
  const [exporting, setExporting]   = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteConfirm, setDeleteConfirm] = React.useState("")
  const [deleting, setDeleting]     = React.useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const token = await getAccessTokenSilently()
      const res   = await gdprApi.exportData(token)
      if (!res.ok) throw new ApiException(res.status, "Export failed")
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = `primeassist-export-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Export downloaded")
    } catch (e) {
      toast.error(e instanceof ApiException ? e.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const token = await getAccessTokenSilently()
      await gdprApi.deleteData(token)
      toast.success("All organization data permanently deleted")
      setDeleteOpen(false)
      setDeleteConfirm("")
    } catch (e) {
      toast.error(e instanceof ApiException ? e.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => setDeleteConfirm(e.target.value)

  return (
    <>
      <div className="space-y-6">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" aria-hidden="true" />
              Export organization data
            </CardTitle>
            <CardDescription>
              Download a ZIP archive of all your organization&apos;s data: users, agents, conversations, messages, feedback, audit logs, and document metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={exporting} variant="outline">
              {exporting ? "Preparing export…" : "Download ZIP"}
            </Button>
          </CardContent>
        </Card>

        {/* Permanent delete */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Permanently delete all data
            </CardTitle>
            <CardDescription>
              Irreversibly deletes all organization data including agents, conversations, knowledge base documents, and user records. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete all data
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently delete all data?</DialogTitle>
            <DialogDescription>
              This will delete all agents, conversations, documents, feedback, and user records for your organization. This action <strong>cannot be undone</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Type <strong>DELETE</strong> to confirm:
            </p>
            <Input
              value={deleteConfirm}
              onChange={handleDeleteConfirmChange}
              placeholder="DELETE"
              className="border-destructive focus-visible:ring-destructive"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirm("") }} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== "DELETE"}
            >
              {deleting ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Settings page ────────────────────────────────────────────────────────────

const TABS = ["ai-models", "security", "communication", "notifications", "data", "plan"] as const
type SettingsTab = (typeof TABS)[number]

function SettingsPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdmin = user?.role === "admin"

  const tabParam = searchParams.get("tab") as SettingsTab | null
  const activeTab: SettingsTab = tabParam && TABS.includes(tabParam) ? tabParam : "ai-models"

  const handleTabChange = (value: string) => {
    router.replace(`/dashboard/settings?tab=${value}`)
  }

  // Non-admins: show access-denied inline (sidebar already hides the nav item, but guard the route too)
  if (!isAdmin && user !== null) {
    return (
      <ProtectedRoute>
        <DashboardShell>
          <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
            <Lock className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold text-lg">Admin access required</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Settings are only accessible to organization admins.
            </p>
          </div>
        </DashboardShell>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage organization-wide configuration.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="ai-models">AI Models</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="communication">Communication</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
            </TabsList>

            <TabsContent value="ai-models" className="mt-4">
              <AIModelsTab />
            </TabsContent>

            <TabsContent value="security" className="mt-4">
              <PendingTab
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
                label="Security"
                description="SAML IdP configuration and single sign-on settings."
              />
            </TabsContent>

            <TabsContent value="communication" className="mt-4">
              <CommunicationTab />
            </TabsContent>

            <TabsContent value="notifications" className="mt-4">
              <div className="space-y-8">
                <NotificationsTab />
                <Card>
                  <CardContent className="pt-6">
                    <Separator className="mb-6" />
                    <ReportScheduleSection />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-4">
              <DataTab />
            </TabsContent>

            <TabsContent value="plan" className="mt-4">
              <PendingTab
                icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
                label="Plan"
                description="Manage your subscription tier and billing details."
              />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardShell>
    </ProtectedRoute>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContent />
    </Suspense>
  )
}
