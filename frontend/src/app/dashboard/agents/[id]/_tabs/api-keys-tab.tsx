"use client"
import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/context/auth"
import { agentApiKeysApi, ApiException, type AgentAPIKeyResponse } from "@/lib/api"
import { toast } from "sonner"
import { Plus, Copy, Trash2, KeyRound, Check } from "lucide-react"

type CreateForm = {
  name: string
}

type CreateErrors = Partial<Record<"name", string>>

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

type Props = {
  agentId: string
  isAdmin: boolean
}

export function ApiKeysTab({ agentId, isAdmin }: Props) {
  const { getAccessTokenSilently } = useAuth()

  const [keys, setKeys]           = React.useState<AgentAPIKeyResponse[]>([])
  const [loading, setLoading]     = React.useState(true)
  const [error, setError]         = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm]           = React.useState<CreateForm>({ name: "" })
  const [formErrors, setFormErrors] = React.useState<CreateErrors>({})
  const [creating, setCreating]   = React.useState(false)
  const [newKeyValue, setNewKeyValue] = React.useState<string | null>(null)
  const [copied, setCopied]       = React.useState(false)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)
  const [confirmRevokeId, setConfirmRevokeId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchKeys = async () => {
      setLoading(true)
      setError(null)
      try {
        const token = await getAccessTokenSilently()
        const list = await agentApiKeysApi.list(agentId, token)
        setKeys(list)
      } catch (err: unknown) {
        if (err instanceof ApiException) {
          setError(err.message)
        } else {
          setError("Failed to load API keys")
        }
      } finally {
        setLoading(false)
      }
    }
    fetchKeys()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId])

  const validate = (): boolean => {
    const errs: CreateErrors = {}
    if (!form.name.trim()) errs.name = "Key name is required"
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async () => {
    if (!validate()) return
    setCreating(true)
    try {
      const token = await getAccessTokenSilently()
      const result = await agentApiKeysApi.create(agentId, { name: form.name.trim() }, token)
      setKeys((prev) => [result.key, ...prev])
      setNewKeyValue(result.api_key)
      setCreateOpen(false)
      setForm({ name: "" })
      setFormErrors({})
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        toast.error(err.message)
      } else {
        toast.error("Failed to create API key. Please try again.")
      }
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!newKeyValue) return
    await navigator.clipboard.writeText(newKeyValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRevoke = async () => {
    if (!confirmRevokeId) return
    const idToRevoke = confirmRevokeId
    setRevokingId(idToRevoke)
    setConfirmRevokeId(null)
    try {
      const token = await getAccessTokenSilently()
      await agentApiKeysApi.revoke(agentId, idToRevoke, token)
      setKeys((prev) => prev.filter((k) => k.id !== idToRevoke))
      toast.success("API key revoked")
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        toast.error(err.message)
      } else {
        toast.error("Failed to revoke key. Please try again.")
      }
    } finally {
      setRevokingId(null)
    }
  }

  const keyToRevoke = keys.find((k) => k.id === confirmRevokeId)

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-32" aria-hidden="true" />
        <Skeleton className="h-12 w-full" aria-hidden="true" />
        <Skeleton className="h-12 w-full" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-semibold">API Keys</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Keys grant programmatic access to this agent. Never share them publicly.
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={isAdmin ? -1 : 0}>
                <Button size="sm" disabled={!isAdmin} onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  New Key
                </Button>
              </span>
            </TooltipTrigger>
            {!isAdmin && <TooltipContent>Only admins can create API keys</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && keys.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <KeyRound className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          </CardContent>
        </Card>
      )}

      {/* Keys table */}
      {keys.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key prefix</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id} className={key.revoked_at ? "opacity-50" : undefined}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {key.key_prefix}…
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.last_used_at ? formatDate(key.last_used_at) : "Never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(key.created_at)}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {!key.revoked_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={revokingId === key.id}
                          onClick={() => setConfirmRevokeId(key.id)}
                          aria-label={`Revoke ${key.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        if (!open) { setForm({ name: "" }); setFormErrors({}) }
        setCreateOpen(open)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>The full key is shown only once after creation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Key name <span className="text-destructive">*</span></Label>
              <Input
                id="key-name"
                placeholder="e.g. Production Widget"
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }))
                }}
                aria-invalid={!!formErrors.name}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create Key"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time key reveal dialog */}
      <Dialog open={!!newKeyValue} onOpenChange={(open) => { if (!open) setNewKeyValue(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
            <span className="flex-1">{newKeyValue}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleCopy} aria-label="Copy key">
              {copied ? <Check className="w-4 h-4 text-green-500" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyValue(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={!!confirmRevokeId} onOpenChange={(open) => { if (!open) setConfirmRevokeId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke API key?</DialogTitle>
            <DialogDescription>
              <strong>{keyToRevoke?.name}</strong> will stop working immediately. Any integrations using it will break.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevokeId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke}>Revoke</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
