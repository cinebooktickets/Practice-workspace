"use client"
import React from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/auth"
import {
  teamApi, agentsApi, supportTeamsApi, ApiException,
  type TeamMemberResponse, type UserRole,
  type SupportTeamResponse, type SupportTeamCreateRequest,
  type AgentResponse,
} from "@/lib/api"
import { toast } from "sonner"
import { Users, Plus, Pencil, Trash2 } from "lucide-react"

type InviteForm = {
  email: string
  role:  UserRole
}

type InviteErrors = Partial<Record<keyof InviteForm, string>>

function getInitials(email: string): string {
  const prefix = email.split("@")[0] ?? email
  return prefix.slice(0, 2).toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  })
}

// ─── Support Teams Section ────────────────────────────────────────────────────

type CreateTeamForm = {
  name: string
  description: string
  is_default: boolean
}

type SupportTeamsSectionProps = {
  isAdmin: boolean
}

function SupportTeamsSection({ isAdmin }: SupportTeamsSectionProps) {
  const { getAccessTokenSilently } = useAuth()

  const [teams, setTeams] = React.useState<SupportTeamResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Create dialog
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState<CreateTeamForm>({ name: "", description: "", is_default: false })
  const [creating, setCreating] = React.useState(false)
  const [createNameError, setCreateNameError] = React.useState<string | null>(null)

  // Edit dialog
  const [editTarget, setEditTarget] = React.useState<SupportTeamResponse | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editDescription, setEditDescription] = React.useState("")
  const [editIsDefault, setEditIsDefault] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [editNameError, setEditNameError] = React.useState<string | null>(null)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = React.useState<SupportTeamResponse | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Add member / agent dialogs
  const [addMemberTarget, setAddMemberTarget] = React.useState<SupportTeamResponse | null>(null)
  const [memberUserId, setMemberUserId] = React.useState("")
  const [addingMember, setAddingMember] = React.useState(false)
  const [orgMembers, setOrgMembers] = React.useState<TeamMemberResponse[]>([])
  const [orgMembersLoading, setOrgMembersLoading] = React.useState(false)

  const [addAgentTarget, setAddAgentTarget] = React.useState<SupportTeamResponse | null>(null)
  const [agentId, setAgentId] = React.useState("")
  const [addingAgent, setAddingAgent] = React.useState(false)
  const [orgAgents, setOrgAgents] = React.useState<AgentResponse[]>([])
  const [orgAgentsLoading, setOrgAgentsLoading] = React.useState(false)

  const fetchTeams = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const list = await supportTeamsApi.list(token)
      setTeams(list)
    } catch (err: unknown) {
      setError(err instanceof ApiException ? err.message : "Failed to load support teams")
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently])

  React.useEffect(() => { fetchTeams() }, [fetchTeams])

  // ── Create ──
  const handleOpenCreate = () => {
    setCreateForm({ name: "", description: "", is_default: false })
    setCreateNameError(null)
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!createForm.name.trim()) { setCreateNameError("Name is required"); return }
    setCreating(true)
    try {
      const token = await getAccessTokenSilently()
      const body: SupportTeamCreateRequest = {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        is_default: createForm.is_default,
      }
      await supportTeamsApi.create(token, body)
      toast.success("Support team created")
      setCreateOpen(false)
      await fetchTeams()
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to create team")
    } finally {
      setCreating(false)
    }
  }

  // ── Edit ──
  const handleOpenEdit = (team: SupportTeamResponse) => {
    setEditTarget(team)
    setEditName(team.name)
    setEditDescription(team.description ?? "")
    setEditIsDefault(team.is_default)
    setEditNameError(null)
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    if (!editName.trim()) { setEditNameError("Name is required"); return }
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      await supportTeamsApi.update(token, editTarget.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        is_default: editIsDefault,
      })
      toast.success("Team updated")
      setEditTarget(null)
      await fetchTeams()
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to update team")
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const token = await getAccessTokenSilently()
      await supportTeamsApi.delete(token, deleteTarget.id)
      toast.success("Team deleted")
      setDeleteTarget(null)
      await fetchTeams()
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to delete team")
    } finally {
      setDeleting(false)
    }
  }

  // ── Load org members for dropdown ──
  const loadOrgMembers = React.useCallback(async () => {
    setOrgMembersLoading(true)
    try {
      const token = await getAccessTokenSilently()
      const list = await teamApi.list(token)
      setOrgMembers(list.filter(m => m.status === "active" && m.user_id))
    } catch {
      // non-critical — dropdown will be empty
    } finally {
      setOrgMembersLoading(false)
    }
  }, [getAccessTokenSilently])

  // ── Load agents for dropdown ──
  const loadOrgAgents = React.useCallback(async () => {
    setOrgAgentsLoading(true)
    try {
      const token = await getAccessTokenSilently()
      const res = await agentsApi.list(token, { limit: 100 })
      setOrgAgents(res.items)
    } catch {
      // non-critical — dropdown will be empty
    } finally {
      setOrgAgentsLoading(false)
    }
  }, [getAccessTokenSilently])

  // Load members + agents on mount so chip labels show names immediately
  React.useEffect(() => { loadOrgMembers(); loadOrgAgents() }, [loadOrgMembers, loadOrgAgents])

  // ── Add member ──
  const handleAddMember = async () => {
    if (!addMemberTarget || !memberUserId.trim()) return
    setAddingMember(true)
    try {
      const token = await getAccessTokenSilently()
      await supportTeamsApi.addMember(token, addMemberTarget.id, { user_id: memberUserId.trim() })
      toast.success("Member added")
      setAddMemberTarget(null)
      setMemberUserId("")
      await fetchTeams()
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to add member")
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      const token = await getAccessTokenSilently()
      await supportTeamsApi.removeMember(token, teamId, userId)
      toast.success("Member removed from team")
      await fetchTeams()
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to remove member")
    }
  }

  // ── Add agent ──
  const handleAddAgent = async () => {
    if (!addAgentTarget || !agentId.trim()) return
    setAddingAgent(true)
    try {
      const token = await getAccessTokenSilently()
      await supportTeamsApi.addAgent(token, addAgentTarget.id, { agent_id: agentId.trim() })
      toast.success("Agent assigned to team")
      setAddAgentTarget(null)
      setAgentId("")
      await fetchTeams()
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to assign agent")
    } finally {
      setAddingAgent(false)
    }
  }

  const handleRemoveAgent = async (teamId: string, aId: string) => {
    try {
      const token = await getAccessTokenSilently()
      await supportTeamsApi.removeAgent(token, teamId, aId)
      toast.success("Agent removed from team")
      await fetchTeams()
    } catch (err: unknown) {
      toast.error(err instanceof ApiException ? err.message : "Failed to remove agent")
    }
  }

  // ── Form handlers ──
  const handleCreateNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCreateForm((p) => ({ ...p, name: e.target.value }))
    if (createNameError) setCreateNameError(null)
  }
  const handleCreateDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCreateForm((p) => ({ ...p, description: e.target.value }))
  }
  const handleCreateDefaultChange = (v: boolean) => {
    setCreateForm((p) => ({ ...p, is_default: v }))
  }
  const handleEditNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditName(e.target.value)
    if (editNameError) setEditNameError(null)
  }
  const handleEditDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditDescription(e.target.value)
  }
  const handleMemberSelect = (v: string) => { setMemberUserId(v) }
  const handleAgentSelect = (v: string) => { setAgentId(v) }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden="true" />
                Support Teams
              </CardTitle>
              <CardDescription className="mt-1">
                Group members into teams for routing live-support handoffs.
              </CardDescription>
            </div>
            {isAdmin ? (
              <Button size="sm" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                New team
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span><Button size="sm" disabled><Plus className="h-4 w-4 mr-1" aria-hidden="true" />New team</Button></span>
                </TooltipTrigger>
                <TooltipContent>Only admins can create support teams</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={fetchTeams}>Retry</Button>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" aria-hidden="true" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <Users className="h-8 w-8 mb-3" aria-hidden="true" />
              <p className="font-medium text-sm">No support teams yet</p>
              <p className="text-xs mt-1">Create a team to route handoff conversations to specific agents.</p>
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-4" onClick={handleOpenCreate}>
                  Create first team
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <div key={team.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{team.name}</span>
                        {team.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                      </div>
                      {team.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {team.member_user_ids.length} member{team.member_user_ids.length !== 1 ? "s" : ""} · {team.agent_ids.length} agent{team.agent_ids.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(team)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(team)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Members */}
                  {team.member_user_ids.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Members</p>
                      <div className="flex flex-wrap gap-1">
                        {team.member_user_ids.map((uid) => {
                          const m = orgMembers.find(x => x.user_id === uid)
                          return (
                          <div key={uid} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                            <span>{m ? m.email : uid.slice(0, 8) + "…"}</span>
                            {isAdmin && (
                              <button
                                className="text-muted-foreground hover:text-destructive ml-1"
                                onClick={() => handleRemoveMember(team.id, uid)}
                                aria-label="Remove member"
                              >
                                ×
                              </button>
                            )}
                          </div>
                          )
                        })}
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 rounded-full text-xs px-2"
                            onClick={() => { setAddMemberTarget(team); setMemberUserId(""); loadOrgMembers() }}
                          >
                            + Add
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {team.member_user_ids.length === 0 && isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => { setAddMemberTarget(team); setMemberUserId(""); loadOrgMembers() }}
                    >
                      + Add member
                    </Button>
                  )}

                  {/* Agents */}
                  {team.agent_ids.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Agents</p>
                      <div className="flex flex-wrap gap-1">
                        {team.agent_ids.map((aid) => {
                          const ag = orgAgents.find(x => x.id === aid)
                          return (
                          <div key={aid} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                            <span>{ag ? ag.name : aid.slice(0, 8) + "…"}</span>
                            {isAdmin && (
                              <button
                                className="text-muted-foreground hover:text-destructive ml-1"
                                onClick={() => handleRemoveAgent(team.id, aid)}
                                aria-label="Remove agent"
                              >
                                ×
                              </button>
                            )}
                          </div>
                          )
                        })}
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 rounded-full text-xs px-2"
                            onClick={() => { setAddAgentTarget(team); setAgentId(""); loadOrgAgents() }}
                          >
                            + Assign
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {team.agent_ids.length === 0 && isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => { setAddAgentTarget(team); setAgentId(""); loadOrgAgents() }}
                    >
                      + Assign agent
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New support team</DialogTitle>
            <DialogDescription>Create a team to route handoff conversations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Team name</Label>
              <Input id="team-name" value={createForm.name} onChange={handleCreateNameChange} placeholder="e.g. Tier 1 Support" />
              {createNameError && <p className="text-xs text-destructive">{createNameError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-desc">Description (optional)</Label>
              <Textarea id="team-desc" value={createForm.description} onChange={handleCreateDescChange} rows={2} placeholder="What does this team handle?" />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="team-default" checked={createForm.is_default} onCheckedChange={handleCreateDefaultChange} />
              <Label htmlFor="team-default" className="text-sm font-normal">Set as default team</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create team"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-team-name">Team name</Label>
              <Input id="edit-team-name" value={editName} onChange={handleEditNameChange} />
              {editNameError && <p className="text-xs text-destructive">{editNameError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-team-desc">Description (optional)</Label>
              <Textarea id="edit-team-desc" value={editDescription} onChange={handleEditDescChange} rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="edit-team-default" checked={editIsDefault} onCheckedChange={setEditIsDefault} />
              <Label htmlFor="edit-team-default" className="text-sm font-normal">Default team</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete team</DialogTitle>
            <DialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add member dialog */}
      <Dialog open={!!addMemberTarget} onOpenChange={(open) => { if (!open) setAddMemberTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>Select a team member to add to <strong>{addMemberTarget?.name}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label>Member</Label>
            {orgMembersLoading ? (
              <Skeleton className="h-9 w-full" aria-hidden="true" />
            ) : (() => {
              const already = addMemberTarget?.member_user_ids ?? []
              const available = orgMembers.filter(m => m.user_id && !already.includes(m.user_id))
              return available.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">All active members are already in this team.</p>
              ) : (
                <Select value={memberUserId} onValueChange={handleMemberSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map(m => (
                      <SelectItem key={m.user_id!} value={m.user_id!}>
                        {m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberTarget(null)} disabled={addingMember}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={addingMember || !memberUserId}>
              {addingMember ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add agent dialog */}
      <Dialog open={!!addAgentTarget} onOpenChange={(open) => { if (!open) setAddAgentTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign agent</DialogTitle>
            <DialogDescription>Select an agent to route handoffs to <strong>{addAgentTarget?.name}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label>Agent</Label>
            {orgAgentsLoading ? (
              <Skeleton className="h-9 w-full" aria-hidden="true" />
            ) : (() => {
              const already = addAgentTarget?.agent_ids ?? []
              const available = orgAgents.filter(a => !already.includes(a.id))
              return available.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">All agents are already assigned to this team.</p>
              ) : (
                <Select value={agentId} onValueChange={handleAgentSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAgentTarget(null)} disabled={addingAgent}>Cancel</Button>
            <Button onClick={handleAddAgent} disabled={addingAgent || !agentId.trim()}>
              {addingAgent ? "Assigning…" : "Assign agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function TeamPage() {
  const { user, getAccessTokenSilently } = useAuth()
  const isAdmin = user?.role === "admin"

  const [members, setMembers] = React.useState<TeamMemberResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")

  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [invite, setInvite] = React.useState<InviteForm>({ email: "", role: "viewer" })
  const [inviteErrors, setInviteErrors] = React.useState<InviteErrors>({})
  const [inviting, setInviting] = React.useState(false)

  const [removingId, setRemovingId] = React.useState<string | null>(null)

  const fetchMembers = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const list = await teamApi.list(token)
      setMembers(list)
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError("Failed to load team members")
      }
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => { fetchMembers() }, [fetchMembers])

  const filtered = members.filter((m) =>
    m.email.toLowerCase().includes(search.toLowerCase())
  )

  const validateInvite = (): boolean => {
    const errors: InviteErrors = {}
    if (!invite.email.trim()) {
      errors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) {
      errors.email = "Enter a valid email address"
    }
    setInviteErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInvite = async () => {
    if (!validateInvite()) return
    setInviting(true)
    try {
      const token = await getAccessTokenSilently()
      await teamApi.invite(token, { email: invite.email.trim(), role: invite.role })
      toast.success(`Invite sent to ${invite.email}`)
      setInviteOpen(false)
      setInvite({ email: "", role: "viewer" })
      await fetchMembers()
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        toast.error(err.message)
      } else {
        toast.error("Failed to send invite")
      }
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    try {
      const token = await getAccessTokenSilently()
      const updated = await teamApi.updateRole(token, memberId, newRole)
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)))
      toast.success("Role updated")
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        toast.error(err.message)
      } else {
        toast.error("Failed to update role")
      }
    }
  }

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId)
    try {
      const token = await getAccessTokenSilently()
      await teamApi.remove(token, memberId)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      toast.success("Member removed")
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        toast.error(err.message)
      } else {
        toast.error("Failed to remove member")
      }
    } finally {
      setRemovingId(null)
    }
  }

  const handleInviteEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInvite((prev) => ({ ...prev, email: e.target.value }))
    if (inviteErrors.email) setInviteErrors((prev) => ({ ...prev, email: undefined }))
  }

  return (
    <ProtectedRoute>
      <TooltipProvider>
        <DashboardShell>
          <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Team</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your organization&apos;s members and roles.
                </p>
              </div>
              {isAdmin ? (
                <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled>Invite member</Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Only admins can invite members</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={() => { setError(null); fetchMembers() }}>
                  Retry
                </Button>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Members</CardTitle>
                    <CardDescription>
                      {loading ? "Loading…" : `${members.length} member${members.length !== 1 ? "s" : ""}`}
                    </CardDescription>
                  </div>
                  <Input
                    placeholder="Search by email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-px p-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg mb-2" aria-hidden="true" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    {search ? (
                      <p>No members match &ldquo;{search}&rdquo;</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="font-medium">No team members yet</p>
                        <p className="text-sm">Invite your first team member to collaborate.</p>
                        {isAdmin && (
                          <Button variant="outline" size="sm" className="mt-2" onClick={() => setInviteOpen(true)}>
                            Send an invite
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        {isAdmin && <TableHead className="w-24" aria-hidden="true" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((member) => {
                        const isSelf = member.email === user?.email
                        return (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">{getInitials(member.email)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">
                                    {member.email.split("@")[0]}
                                    {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{member.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {isAdmin && !isSelf ? (
                                <Select
                                  value={member.role}
                                  onValueChange={(v) => handleRoleChange(member.id, v as UserRole)}
                                >
                                  <SelectTrigger className="w-28 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="editor">Editor</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                                  {member.role}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={member.status === "active" ? "success" : "warning"}>
                                {member.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(member.created_at)}
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                {isSelf ? null : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={removingId === member.id}
                                    onClick={() => handleRemove(member.id)}
                                  >
                                    {removingId === member.id ? "Removing…" : "Remove"}
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Support Teams */}
            <SupportTeamsSection isAdmin={isAdmin} />
          </div>

          {/* Invite modal */}
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite team member</DialogTitle>
                <DialogDescription>
                  They&apos;ll receive an email with a link to join your organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={invite.email}
                    onChange={handleInviteEmailChange}
                    aria-invalid={!!inviteErrors.email}
                  />
                  {inviteErrors.email && (
                    <p className="text-xs text-destructive">{inviteErrors.email}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={invite.role}
                    onValueChange={(v) => setInvite((prev) => ({ ...prev, role: v as UserRole }))}
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                      <SelectItem value="editor">Editor — can manage agents and conversations</SelectItem>
                      <SelectItem value="admin">Admin — full organization access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={inviting}>
                  {inviting ? "Sending…" : "Send invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DashboardShell>
      </TooltipProvider>
    </ProtectedRoute>
  )
}
