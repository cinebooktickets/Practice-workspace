"use client"
import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth"
import { toast } from "sonner"
import { Copy, Check, MessageCircle, X, Send } from "lucide-react"
import { agentsApi, WidgetConfig, AgentUpdate, ApiException } from "@/lib/api"

type WidgetForm = {
  color:              string
  position:           string
  avatar_url:         string
  greeting:           string
  suggested_prompts:  string[]
  custom_css:         string
  streaming_enabled:  boolean
}

type Props = {
  agentId: string
  isAdmin: boolean
}

// ---------------------------------------------------------------------------
// LiveWidgetPreview
// ---------------------------------------------------------------------------

type PreviewProps = {
  form: WidgetForm
}

function LiveWidgetPreview({ form }: PreviewProps) {
  const isRight = form.position?.includes("right")
  const isTop   = form.position?.includes("top")

  const bubbleClass = [
    "absolute w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white cursor-pointer transition-transform hover:scale-105",
    isRight ? "right-4" : "left-4",
    isTop   ? "top-4"   : "bottom-4",
  ].join(" ")

  const panelClass = [
    "absolute w-52 rounded-xl shadow-xl overflow-hidden border border-white/10 flex flex-col",
    isRight ? "right-4" : "left-4",
    isTop   ? "top-4"   : "bottom-20",
  ].join(" ")

  const greeting = form.greeting || "Hi! How can I help you today?"
  const prompts  = form.suggested_prompts.slice(0, 3)

  return (
    <div
      data-testid="live-widget-preview"
      className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden border"
      style={{ height: 380 }}
      aria-label="Widget live preview"
    >
      {/* Mock page lines */}
      <div className="p-5 space-y-2 pointer-events-none select-none" aria-hidden="true">
        {[75, 55, 65, 45, 70, 40].map((w, i) => (
          <div key={i} className="h-2 rounded-full bg-white/10" style={{ width: `${w}%` }} />
        ))}
      </div>

      {/* Chat panel */}
      <div className={panelClass} style={{ maxHeight: 280 }}>
        {/* Header */}
        <div className="px-3 py-2.5 flex items-center justify-between text-white" style={{ backgroundColor: form.color }}>
          <div className="flex items-center gap-2">
            {form.avatar_url ? (
              <img
                src={form.avatar_url}
                alt="avatar"
                className="w-6 h-6 rounded-full object-cover bg-white/20"
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.style.display = "none"
                }}
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-3 h-3" />
              </div>
            )}
            <span className="text-xs font-semibold">Support</span>
          </div>
          <X className="w-3 h-3 opacity-70" aria-hidden="true" />
        </div>

        {/* Body */}
        <div className="bg-slate-50 flex-1 px-2.5 py-2 space-y-2 overflow-hidden">
          {/* Greeting bubble */}
          <div className="flex gap-1.5 items-end">
            <div
              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white"
              style={{ backgroundColor: form.color }}
              aria-hidden="true"
            >
              <MessageCircle className="w-2.5 h-2.5" />
            </div>
            <div className="bg-white rounded-lg rounded-bl-sm shadow-sm px-2.5 py-1.5 max-w-[140px]">
              <p className="text-[10px] text-slate-700 leading-snug">{greeting}</p>
            </div>
          </div>

          {/* Suggested prompts */}
          {prompts.length > 0 && (
            <div className="flex flex-col gap-1 pl-7">
              {prompts.map((p) => (
                <div
                  key={p}
                  className="text-[9px] border rounded-full px-2 py-0.5 text-center truncate cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ borderColor: form.color, color: form.color }}
                >
                  {p}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="bg-white border-t px-2 py-1.5 flex items-center gap-1">
          <div className="flex-1 h-5 rounded-full bg-slate-100 text-[9px] text-slate-400 px-2 flex items-center">
            Type a message…
          </div>
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: form.color }}
            aria-hidden="true"
          >
            <Send className="w-2.5 h-2.5" />
          </div>
        </div>
      </div>

      {/* Bubble */}
      <div
        className={bubbleClass}
        style={{ backgroundColor: form.color }}
        aria-label="Chat bubble"
        role="img"
      >
        <MessageCircle className="w-5 h-5" />
      </div>

      {/* Position label */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] text-white/40 pointer-events-none select-none">
        Live Preview
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WidgetTab
// ---------------------------------------------------------------------------

export function WidgetTab({ agentId, isAdmin }: Props) {
  const { getAccessTokenSilently } = useAuth()

  const [form, setForm]       = React.useState<WidgetForm>({
    color: "#6366f1", position: "bottom_right", avatar_url: "", greeting: "",
    suggested_prompts: [], custom_css: "", streaming_enabled: true,
  })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving]   = React.useState(false)
  const [copied, setCopied]   = React.useState(false)
  const [isDirty, setIsDirty] = React.useState(false)
  const [promptInput, setPromptInput] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const token = await getAccessTokenSilently()
        const agent = await agentsApi.get(token, agentId)
        if (cancelled) return
        const wc = agent.widget_config
        if (wc) {
          setForm({
            color:             wc.color             ?? "#6366f1",
            position:          wc.position          ?? "bottom_right",
            avatar_url:        wc.avatar_url        ?? "",
            greeting:          wc.greeting          ?? "",
            suggested_prompts: wc.suggested_prompts ?? [],
            custom_css:        wc.custom_css        ?? "",
            streaming_enabled: wc.streaming_enabled ?? true,
          })
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiException ? err.message : "Failed to load widget config"
          toast.error(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [agentId, getAccessTokenSilently])

  const update = <K extends keyof WidgetForm>(key: K, value: WidgetForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  const addPrompt = () => {
    const p = promptInput.trim()
    if (!p || form.suggested_prompts.includes(p)) return
    update("suggested_prompts", [...form.suggested_prompts, p])
    setPromptInput("")
  }

  const removePrompt = (p: string) => {
    update("suggested_prompts", form.suggested_prompts.filter((x) => x !== p))
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  const embedSnippet = `<script\n  src="${apiUrl}/widget.js"\n  data-agent-id="${agentId}"\n  data-api-key="YOUR_API_KEY"\n></script>`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const widgetConfig: WidgetConfig = {
        color:             form.color             || null,
        position:          form.position          || null,
        avatar_url:        form.avatar_url        || null,
        greeting:          form.greeting          || null,
        suggested_prompts: form.suggested_prompts.length ? form.suggested_prompts : null,
        custom_css:        form.custom_css        || null,
        streaming_enabled: form.streaming_enabled,
      }
      const body: AgentUpdate = { widget_config: widgetConfig }
      await agentsApi.update(token, agentId, body)
      setIsDirty(false)
      toast.success("Widget configuration saved")
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to save widget config"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
      {/* ── Left column: config ── */}
      <div className="space-y-6 min-w-0">

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Customise how the chat widget looks on your website.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="color">Primary colour</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="color"
                    type="color"
                    value={form.color}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("color", e.target.value)}
                    className="h-9 w-14 rounded border border-input cursor-pointer bg-transparent p-0.5"
                    disabled={!isAdmin}
                  />
                  <Input
                    value={form.color}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("color", e.target.value)}
                    className="font-mono text-sm"
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Position</Label>
                <Select value={form.position} onValueChange={(v) => update("position", v)} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom_right">Bottom right</SelectItem>
                    <SelectItem value="bottom_left">Bottom left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avatar-url">Avatar URL <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input
                id="avatar-url"
                placeholder="https://example.com/avatar.png"
                value={form.avatar_url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("avatar_url", e.target.value)}
                disabled={!isAdmin}
              />
            </div>
          </CardContent>
        </Card>

        {/* Conversation settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversation</CardTitle>
            <CardDescription>Greeting and suggested prompts shown to visitors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="greeting">Greeting message</Label>
              <Input
                id="greeting"
                placeholder="Hi! How can I help you today?"
                value={form.greeting}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("greeting", e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label>Suggested prompts</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. How do I reset my password?"
                  value={promptInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPromptInput(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") { e.preventDefault(); addPrompt() }
                  }}
                  disabled={!isAdmin}
                />
                <Button type="button" variant="outline" size="sm" onClick={addPrompt} disabled={!isAdmin}>Add</Button>
              </div>
              {form.suggested_prompts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.suggested_prompts.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-0.5">
                      {p}
                      {isAdmin && <button onClick={() => removePrompt(p)} className="hover:text-destructive leading-none" aria-label={`Remove "${p}"`}>×</button>}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Streaming responses</p>
                <p className="text-xs text-muted-foreground">Send reply tokens as they are generated (SSE)</p>
              </div>
              <Switch
                checked={form.streaming_enabled}
                onCheckedChange={(v) => update("streaming_enabled", v)}
                disabled={!isAdmin}
              />
            </div>
          </CardContent>
        </Card>

        {/* Custom CSS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custom CSS <span className="text-xs text-muted-foreground font-normal ml-1">(optional)</span></CardTitle>
            <CardDescription>CSS injected into the widget iframe. Max 4096 chars.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder=".pa-widget-button { border-radius: 8px; }"
              value={form.custom_css}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update("custom_css", e.target.value)}
              className="font-mono text-xs min-h-[100px] resize-y"
              maxLength={4096}
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{form.custom_css.length} / 4096</p>
          </CardContent>
        </Card>

        {/* Embed code */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Embed Code</CardTitle>
            <CardDescription>
              Paste this snippet before the closing &lt;/body&gt; tag on your website.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="text-xs font-mono bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                {embedSnippet}
              </pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={handleCopy}
                aria-label="Copy embed code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        {isAdmin && (
          <div className="flex justify-end gap-3 pb-4">
            {isDirty && <span className="text-xs text-muted-foreground self-center">Unsaved changes</span>}
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Right column: live preview ── */}
      <div className="xl:sticky xl:top-6 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Live Preview</p>
        <LiveWidgetPreview form={form} />
        <p className="text-xs text-muted-foreground text-center">
          Updates as you change settings. Not pixel-perfect — for positioning reference only.
        </p>
      </div>
    </div>
  )
}
