"use client"

// ─── Backend error envelope ───────────────────────────────────────────────────
// All 4xx/5xx responses: { "error": { "code": "snake_case", "message": "...", "details": {} } }

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// ─── ApiException ─────────────────────────────────────────────────────────────

export class ApiException extends Error {
  status: number
  code:   string

  constructor(status: number, message: string, code = "unknown_error") {
    super(message)
    this.name   = "ApiException"
    this.status = status
    this.code   = code
  }
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * JSON request with Bearer auth.
 * Pass `token` as the Auth0 access token from `getAccessTokenSilently()`.
 */
export const request = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Bypass ngrok browser-warning interstitial in dev/test environments
    "ngrok-skip-browser-warning": "true",
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    let code    = "unknown_error"
    try {
      const body = await res.json()
      message = body?.error?.message ?? message
      code    = body?.error?.code    ?? code
    } catch {
      // non-JSON error body — keep defaults
    }
    throw new ApiException(res.status, message, code)
  }

  // 204 No Content — return empty
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

/**
 * Non-JSON fetch — use for 204 DELETE, blob downloads.
 */
export const rawFetch = async (
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<Response> => {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    let code    = "unknown_error"
    try {
      const body = await res.json()
      message = body?.error?.message ?? message
      code    = body?.error?.code    ?? code
    } catch {
      // non-JSON error body
    }
    throw new ApiException(res.status, message, code)
  }

  return res
}

// ─── Shared types ─────────────────────────────────────────────────────────────

// Contract: .github/api-contracts/contract-b-auth-team-apikeys-audit.json
// GET /api/v1/auth/me  |  PATCH /api/v1/auth/profile
export type UserRole = "admin" | "editor" | "viewer"

export type CurrentUserResponse = {
  id:            string
  org_id:        string
  auth0_subject: string
  email:         string
  role:          UserRole
  phone_number?: string | null
  created_at:    string
  updated_at:    string
}

export type ProfileResponse = CurrentUserResponse

export type ProfileUpdateRequest = {
  phone_number?: string | null
}

// Contract: invite endpoints
export type AcceptInviteRequest = {
  token: string
}

export type AcceptInviteResponse = {
  team_member: TeamMemberResponse
  accepted_at: string
}

// Contract: team endpoints
export type TeamMemberResponse = {
  id:                  string
  org_id:              string
  user_id?:            string | null
  email:               string
  role:                UserRole
  status:              string        // "pending" | "active"
  invited_by_user_id?: string | null
  created_at:          string
  updated_at:          string
}

export type TeamInviteCreateRequest = {
  email: string
  role:  UserRole
}

export type TeamInviteResponse = {
  id:                  string
  org_id:              string
  membership_id:       string
  email:               string
  role:                UserRole
  status:              string
  expires_at:          string
  invited_by_user_id?: string | null
  created_at:          string
  updated_at:          string
}

// Contract: audit log
export type AuditLogEntryResponse = {
  id:          string
  org_id:      string
  user_id?:    string | null
  action:      string
  entity_type: string
  entity_id?:  string | null
  details?:    Record<string, unknown>
  created_at:  string
}

export type AuditLogListResponse = {
  items:  AuditLogEntryResponse[]
  total:  number
  limit:  number
  offset: number
}

// Contract: agent API keys
export type AgentAPIKeyResponse = {
  id:                  string
  org_id:              string
  agent_id:            string
  name:                string
  key_prefix:          string       // non-secret prefix shown in UI
  created_by_user_id?: string | null
  revoked_at?:         string | null
  last_used_at?:       string | null
  created_at:          string
  updated_at:          string
}

export type AgentAPIKeyCreateRequest = {
  name: string
}

export type AgentAPIKeyCreateResponse = {
  key:     AgentAPIKeyResponse
  api_key: string   // raw value — returned once only
}

export type PaginatedResponse<T> = {
  items:       T[]
  next_cursor: string | null
  total?:      number
}

export type PaginationParams = {
  cursor?: string
  limit?:  number
  search?: string
}

// ─── API modules ──────────────────────────────────────────────────────────────

// Contract: .github/api-contracts/contract-b-auth-team-apikeys-audit.json
export const authApi = {
  /** Bootstrap backend user on first login. Returns backend UUID + org UUID. */
  me: (token: string): Promise<CurrentUserResponse> =>
    request<CurrentUserResponse>("/api/v1/auth/me", { method: "GET" }, token),
}

export const profileApi = {
  /** PATCH /api/v1/auth/profile — only phone_number is updatable */
  update: (token: string, body: ProfileUpdateRequest): Promise<ProfileResponse> =>
    request<ProfileResponse>("/api/v1/auth/profile", {
      method: "PATCH",
      body:   JSON.stringify(body),
    }, token),
}

export const inviteApi = {
  /** POST /api/v1/auth/accept-invite — accept a team invite using the opaque token from email */
  accept: (token: string, body: AcceptInviteRequest): Promise<AcceptInviteResponse> =>
    request<AcceptInviteResponse>("/api/v1/auth/accept-invite", {
      method: "POST",
      body:   JSON.stringify(body),
    }, token),
}

export const teamApi = {
  /** GET /api/v1/team/ — list all members in the org */
  list: (token: string): Promise<TeamMemberResponse[]> =>
    request<TeamMemberResponse[]>("/api/v1/team/", { method: "GET" }, token),

  /** POST /api/v1/team/invite */
  invite: (token: string, body: TeamInviteCreateRequest): Promise<TeamInviteResponse> =>
    request<TeamInviteResponse>("/api/v1/team/invite", {
      method:  "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body:    JSON.stringify(body),
    }, token),

  /** PATCH /api/v1/team/{member_id} — update role */
  updateRole: (token: string, memberId: string, role: UserRole): Promise<TeamMemberResponse> =>
    request<TeamMemberResponse>(`/api/v1/team/${memberId}`, {
      method: "PATCH",
      body:   JSON.stringify({ role }),
    }, token),

  /** DELETE /api/v1/team/{member_id} — 204 No Content */
  remove: (token: string, memberId: string): Promise<void> =>
    request<void>(`/api/v1/team/${memberId}`, { method: "DELETE" }, token),
}

export const auditApi = {
  /** GET /api/v1/org/audit-logs — offset pagination, max 100 per page */
  list: (
    token: string,
    params: { limit?: number; offset?: number; action?: string; entity_type?: string; entity_id?: string; user_id?: string } = {}
  ): Promise<AuditLogListResponse> => {
    const qs = new URLSearchParams()
    if (params.limit      != null) qs.set("limit",       String(params.limit))
    if (params.offset     != null) qs.set("offset",      String(params.offset))
    if (params.action)             qs.set("action",      params.action)
    if (params.entity_type)        qs.set("entity_type", params.entity_type)
    if (params.entity_id)          qs.set("entity_id",   params.entity_id)
    if (params.user_id)            qs.set("user_id",     params.user_id)
    const query = qs.toString()
    return request<AuditLogListResponse>(
      `/api/v1/org/audit-logs${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },
}

export const agentApiKeysApi = {
  /** GET /api/v1/agents/{agent_id}/api-keys/ */
  list: (agentId: string, token: string): Promise<AgentAPIKeyResponse[]> =>
    request<AgentAPIKeyResponse[]>(`/api/v1/agents/${agentId}/api-keys/`, { method: "GET" }, token),

  /** POST /api/v1/agents/{agent_id}/api-keys/ — response contains raw key (show once) */
  create: (agentId: string, body: AgentAPIKeyCreateRequest, token: string): Promise<AgentAPIKeyCreateResponse> =>
    request<AgentAPIKeyCreateResponse>(`/api/v1/agents/${agentId}/api-keys/`, {
      method:  "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body:    JSON.stringify(body),
    }, token),

  /** DELETE /api/v1/agents/{agent_id}/api-keys/{key_id} — 204 No Content */
  revoke: (agentId: string, keyId: string, token: string): Promise<void> =>
    request<void>(`/api/v1/agents/${agentId}/api-keys/${keyId}`, { method: "DELETE" }, token),
}

// ─── Contract C: Agents CRUD + Documents ─────────────────────────────────────
// .github/api-contracts/agents-crud-documents.json

export type ProviderType = "openai" | "azure_openai" | "anthropic" | "ollama"

export type WidgetConfig = {
  color?:             string | null
  position?:          string | null
  avatar_url?:        string | null
  greeting?:          string | null
  suggested_prompts?: string[] | null
  custom_css?:        string | null
  streaming_enabled?: boolean
}

export type AgentResponse = {
  id:                  string
  org_id:              string
  name:                string
  description?:        string | null
  system_prompt?:      string | null
  greeting?:           string | null
  allowed_topics?:     string[] | null
  blocked_topics?:     string[] | null
  provider_type?:             ProviderType | null
  provider_config_preview?:   ProviderConfig | null
  widget_config?:             WidgetConfig | null
  embedding_provider?:        string | null
  embedding_config_preview?:  EmbeddingConfig | null
  is_active:                  boolean
  created_at:          string
  updated_at:          string
}

export type AgentListResponse = {
  items:  AgentResponse[]
  total:  number
  limit:  number
  offset: number
}

export type OpenAIProviderConfig = {
  provider:     "openai"
  model:        string
  api_key:      string
  base_url?:    string | null
  api_version?: string | null
}

export type AnthropicProviderConfig = {
  provider:     "anthropic"
  model:        string
  api_key:      string
  base_url?:    string | null
  api_version?: string | null
}

export type AzureOpenAIProviderConfig = {
  provider:         "azure_openai"
  deployment_name:  string
  api_key:          string
  base_url:         string
  api_version:      string
}

export type OllamaProviderConfig = {
  provider: "ollama"
  model:    string
  base_url: string
}

export type ProviderConfig = OpenAIProviderConfig | AzureOpenAIProviderConfig | AnthropicProviderConfig | OllamaProviderConfig

export type AgentCreate = {
  name:              string
  system_prompt?:    string | null
  greeting?:         string | null
  allowed_topics?:   string[] | null
  blocked_topics?:   string[] | null
  provider_config?:  ProviderConfig | null
  widget_config?:    WidgetConfig | null
  embedding_config?: EmbeddingConfig | null
}

export type AgentUpdate = {
  name?:             string
  description?:      string | null
  system_prompt?:    string | null
  greeting?:         string | null
  allowed_topics?:   string[] | null
  blocked_topics?:   string[] | null
  provider_config?:  ProviderConfig | null
  widget_config?:    WidgetConfig | null
  embedding_config?: EmbeddingConfig | null
  is_active?:        boolean
}

export type DocumentStatus = "queued" | "processing" | "indexed" | "failed"

export type DocumentResponse = {
  id:                string
  org_id:            string
  agent_id:          string
  filename:          string
  status:            DocumentStatus
  minio_path?:       string | null
  minio_etag?:       string | null
  minio_version_id?: string | null
  file_size?:        number | null
  celery_task_id?:   string | null
  error_message?:    string | null
  created_at:        string
  updated_at:        string
}

export type DocumentListResponse = {
  documents: DocumentResponse[]
  total:     number
  limit:     number
  offset:    number
}

export type DocumentChunk = {
  chunk_index: number
  chunk_text:  string
  metadata:    Record<string, unknown>
}

export type DocumentChunksResponse = {
  items:  DocumentChunk[]
  total:  number
  limit:  number
  offset: number
}

export type StreamTicketResponse = {
  ticket:     string  // one-time UUID, consumed on first use
  expires_in: number  // TTL in seconds (always 30)
}

export type AgentDocumentCountsResponse = {
  counts: Record<string, number>  // agent_id → document count
}

// ─── Contract D: Chat ─────────────────────────────────────────────────────────
// .github/api-contracts/agents-chat-widget.json

export type Citation = {
  document_id:   string
  filename:      string
  chunk_text:    string
  score:         number
  chunk_id?:     string | null
  page_number?:  number | null
  section_title?: string | null
  doc_language?: string | null
  doc_author?:   string | null
  doc_page_count?: number | null
  chunk_type?:   string | null
}

export type EmbeddingProviderType = "openai" | "azure_openai" | "ollama"

export type EmbeddingConfig = {
  provider_type:  EmbeddingProviderType
  model:          string
  api_key?:       string | null
  base_url?:      string | null
  api_version?:   string | null
  embedding_dim?: number | null
}

export type Message = {
  id?:              string | null
  conversation_id?: string | null
  role:             "system" | "user" | "assistant"
  content:          string
  citations?:       Citation[]
  created_at?:      string | null
}

export type ChatRequest = {
  message:          string
  conversation_id?: string | null
}

export type ChatResponse = {
  conversation_id?:   string | null
  assistant_message:  Message
  handoff_requested?: boolean
  finish_reason?:     string | null
  prompt_tokens?:     number | null
  completion_tokens?: number | null
  total_tokens?:      number | null
}

// ─── API modules — Contract C ─────────────────────────────────────────────────

export const agentsApi = {
  /** GET /api/v1/agents/ — offset pagination */
  list: (token: string, params: { limit?: number; offset?: number } = {}): Promise<AgentListResponse> => {
    const qs = new URLSearchParams()
    if (params.limit  != null) qs.set("limit",  String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    const query = qs.toString()
    return request<AgentListResponse>(`/api/v1/agents/${query ? `?${query}` : ""}`, { method: "GET" }, token)
  },

  /** POST /api/v1/agents/ — 201 */
  create: (token: string, body: AgentCreate): Promise<AgentResponse> =>
    request<AgentResponse>("/api/v1/agents/", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) }, token),

  /** GET /api/v1/agents/{id} */
  get: (token: string, agentId: string): Promise<AgentResponse> =>
    request<AgentResponse>(`/api/v1/agents/${agentId}`, { method: "GET" }, token),

  /** PATCH /api/v1/agents/{id} */
  update: (token: string, agentId: string, body: AgentUpdate): Promise<AgentResponse> =>
    request<AgentResponse>(`/api/v1/agents/${agentId}`, { method: "PATCH", body: JSON.stringify(body) }, token),

  /** DELETE /api/v1/agents/{id} — 204 No Content */
  delete: (token: string, agentId: string): Promise<void> =>
    rawFetch(`/api/v1/agents/${agentId}`, { method: "DELETE" }, token).then(() => undefined),

  /** GET /api/v1/agents/document-counts — counts per agent for the org */
  getDocumentCounts: (token: string): Promise<AgentDocumentCountsResponse> =>
    request<AgentDocumentCountsResponse>("/api/v1/agents/document-counts", { method: "GET" }, token),
}

// ─── Contract H: Agent Export / Import ───────────────────────────────────────
// .github/api-contracts/agent-export-import-integrations-tools.json

export type AgentExportBundle = {
  name:                string
  is_active:           boolean
  system_prompt?:      string | null
  greeting?:           string | null
  allowed_topics?:     string[] | null
  blocked_topics?:     string[] | null
  provider_type?:      ProviderType | null
  widget_config?:      WidgetConfig | null
  embedding_provider?: string | null
}

export type AgentExportResponse = {
  agent_id:    string
  exported_at: string
  bundle:      AgentExportBundle
}

export type AgentImportRequest = {
  bundle:            AgentExportBundle
  provider_config?:  ProviderConfig | null
  embedding_config?: EmbeddingConfig | null
}

export const agentExportImportApi = {
  /** GET /api/v1/agents/{id}/export — returns bundle JSON */
  exportAgent: (token: string, agentId: string): Promise<AgentExportResponse> =>
    request<AgentExportResponse>(`/api/v1/agents/${agentId}/export`, { method: "GET" }, token),

  /** POST /api/v1/agents/import — 201 creates new agent */
  importAgent: (token: string, body: AgentImportRequest): Promise<AgentResponse> =>
    request<AgentResponse>("/api/v1/agents/import", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) }, token),
}

export const documentsApi = {
  /** POST /api/v1/agents/{id}/documents/ — multipart/form-data */
  upload: async (token: string, agentId: string, file: File, fileName?: string): Promise<DocumentResponse> => {
    const form = new FormData()
    form.append("file", file)
    if (fileName) form.append("file_name", fileName)
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
    const res = await fetch(`${BASE_URL}/api/v1/agents/${agentId}/documents/`, {
      method:  "POST",
      headers: {
        Authorization:               `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
        "Idempotency-Key":            crypto.randomUUID(),
      },
      body:    form,
    })
    if (!res.ok) {
      let message = `HTTP ${res.status}`
      let code    = "unknown_error"
      try { const b = await res.json(); message = b?.error?.message ?? message; code = b?.error?.code ?? code } catch { /* ignore */ }
      throw new ApiException(res.status, message, code)
    }
    return res.json() as Promise<DocumentResponse>
  },

  /** GET /api/v1/agents/{id}/documents/ — offset pagination */
  list: (token: string, agentId: string, params: { limit?: number; offset?: number } = {}): Promise<DocumentListResponse> => {
    const qs = new URLSearchParams()
    if (params.limit  != null) qs.set("limit",  String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    const query = qs.toString()
    return request<DocumentListResponse>(
      `/api/v1/agents/${agentId}/documents/${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },

  /** GET /api/v1/agents/{id}/documents/{doc_id} */
  get: (token: string, agentId: string, docId: string): Promise<DocumentResponse> =>
    request<DocumentResponse>(`/api/v1/agents/${agentId}/documents/${docId}`, { method: "GET" }, token),

  /** DELETE /api/v1/agents/{id}/documents/{doc_id} — 204 */
  delete: (token: string, agentId: string, docId: string): Promise<void> =>
    rawFetch(`/api/v1/agents/${agentId}/documents/${docId}`, { method: "DELETE" }, token).then(() => undefined),

  /** POST /api/v1/agents/{id}/documents/{doc_id}/reprocess */
  reprocess: (token: string, agentId: string, docId: string): Promise<DocumentResponse> =>
    request<DocumentResponse>(`/api/v1/agents/${agentId}/documents/${docId}/reprocess`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } }, token),

  /** POST /api/v1/agents/{id}/documents/{doc_id}/cancel */
  cancel: (token: string, agentId: string, docId: string): Promise<DocumentResponse> =>
    request<DocumentResponse>(`/api/v1/agents/${agentId}/documents/${docId}/cancel`, { method: "POST" }, token),

  /** POST /api/v1/agents/{id}/documents/{doc_id}/stream-ticket — FD-003 */
  streamTicket: (token: string, agentId: string, docId: string): Promise<StreamTicketResponse> =>
    request<StreamTicketResponse>(
      `/api/v1/agents/${agentId}/documents/${docId}/stream-ticket`,
      { method: "POST" },
      token
    ),

  /** GET /api/v1/agents/{id}/documents/{doc_id}/chunks */
  listChunks: (
    token: string,
    agentId: string,
    docId: string,
    params: { limit?: number; offset?: number } = {}
  ): Promise<DocumentChunksResponse> => {
    const qs = new URLSearchParams()
    if (params.limit  != null) qs.set("limit",  String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    const suffix = qs.toString() ? `?${qs.toString()}` : ""
    return request<DocumentChunksResponse>(
      `/api/v1/agents/${agentId}/documents/${docId}/chunks${suffix}`,
      { method: "GET" },
      token
    )
  },
}

// ─── API modules — Contract D ─────────────────────────────────────────────────

export const sandboxChatApi = {
  /** POST /api/v1/agents/{id}/sandbox/chat — no persistence */
  send: (token: string, agentId: string, body: ChatRequest): Promise<ChatResponse> =>
    request<ChatResponse>(`/api/v1/agents/${agentId}/sandbox/chat`, {
      method:  "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body:    JSON.stringify(body),
    }, token),
}

export const dashboardChatApi = {
  /** POST /api/v1/agents/{id}/chat — persisted conversation (Phase 5) */
  send: (token: string, agentId: string, body: ChatRequest): Promise<ChatResponse> =>
    request<ChatResponse>(`/api/v1/agents/${agentId}/chat`, {
      method:  "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body:    JSON.stringify(body),
    }, token),
}

// ─── Notifications ────────────────────────────────────────────────────────────
// Contract F: .github/api-contracts/alert-config-handoff-notifications-support-teams.json

export type NotificationSeverity = "info" | "warning" | "critical"

export type NotificationItem = {
  id:          string
  org_id:      string
  user_id:     string
  event_type:  string
  title:       string
  body:        string
  severity:    NotificationSeverity
  payload?:    Record<string, unknown> | null
  is_read:     boolean
  read_at?:    string | null
  created_at:  string
  updated_at:  string
}

export type NotificationListResponse = {
  items:  NotificationItem[]
  total:  number
  limit:  number
  offset: number
}

export type NotificationUnreadCountResponse = {
  count: number
}

export const notificationsApi = {
  /** GET /api/v1/notifications/ — offset pagination */
  list: (token: string, params: { limit?: number; offset?: number; unread_only?: boolean } = {}): Promise<NotificationListResponse> => {
    const qs = new URLSearchParams()
    if (params.limit       != null) qs.set("limit",       String(params.limit))
    if (params.offset      != null) qs.set("offset",      String(params.offset))
    if (params.unread_only != null) qs.set("unread_only", String(params.unread_only))
    const query = qs.toString()
    return request<NotificationListResponse>(
      `/api/v1/notifications/${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },

  /** GET /api/v1/notifications/unread-count */
  unreadCount: (token: string): Promise<NotificationUnreadCountResponse> =>
    request<NotificationUnreadCountResponse>("/api/v1/notifications/unread-count", { method: "GET" }, token),

  /** POST /api/v1/notifications/mark-read */
  markRead: (token: string, id: string): Promise<NotificationItem> =>
    request<NotificationItem>(`/api/v1/notifications/${id}/mark-read`, { method: "POST" }, token),

  /** POST /api/v1/notifications/read-all — marks all notifications read */
  markAllRead: (token: string): Promise<void> =>
    rawFetch("/api/v1/notifications/read-all", { method: "POST" }, token).then(() => undefined),

  /** DELETE /api/v1/notifications/{id} — 204 No Content */
  delete: (token: string, id: string): Promise<void> =>
    rawFetch(`/api/v1/notifications/${id}`, { method: "DELETE" }, token).then(() => undefined),
}

// ─── Contract E: Conversations + Feedback ────────────────────────────────────
// .github/api-contracts/agents-conversations-feedback.json

export type ConversationStatus = "open" | "handoff" | "closed"

export type ConversationItem = {
  id:         string
  org_id:     string
  agent_id:   string
  user_id?:   string | null
  status:     ConversationStatus
  title?:     string | null
  created_at: string
  updated_at: string
}

export type ConversationListResponse = {
  items:       ConversationItem[]
  next_cursor: string | null
  has_more:    boolean
}

export type FeedbackRating = "thumbs_up" | "thumbs_down"
export type FeedbackStatus = "pending" | "resolved" | "dismissed"

export type FeedbackItem = {
  id:               string
  org_id:           string
  conversation_id:  string
  message_id?:      string | null
  rating:           FeedbackRating
  comment?:         string | null
  status:           FeedbackStatus
  resolved_by?:     string | null
  resolved_at?:     string | null
  resolution_note?: string | null
  created_at:       string
  updated_at:       string
}

export type FeedbackListResponse = {
  items:       FeedbackItem[]
  next_cursor: string | null
  has_more:    boolean
}

export type FeedbackResolveRequest = {
  status:           "resolved" | "dismissed"
  resolution_note?: string | null
}

// Contract H: conversation messages + search types
export type MessageRole = "user" | "assistant" | "system"

export type MessageOut = {
  id:               string
  conversation_id:  string
  role:             MessageRole
  content:          string
  citations?:       unknown[] | null
  prompt_tokens?:   number | null
  completion_tokens?: number | null
  total_tokens?:    number | null
  finish_reason?:   string | null
  created_at:       string
  updated_at:       string
}

export type MessageListResponse = {
  items:       MessageOut[]
  next_cursor: string | null
  has_more:    boolean
}

export type ConversationSearchResult = {
  id:          string
  agent_id:    string
  status:      ConversationStatus
  title?:      string | null
  match_count: number
  created_at:  string
  updated_at:  string
}

export type ConversationSearchResponse = {
  items: ConversationSearchResult[]
  total: number
}

export const conversationsApi = {
  /** GET /api/v1/agents/{id}/conversations/ — cursor-paginated, status filter, search */
  list: (
    token: string,
    agentId: string,
    params: { cursor?: string; limit?: number; status?: ConversationStatus; search?: string } = {}
  ): Promise<ConversationListResponse> => {
    const qs = new URLSearchParams()
    if (params.cursor) qs.set("cursor", params.cursor)
    if (params.limit  != null) qs.set("limit",  String(params.limit))
    if (params.status) qs.set("status", params.status)
    if (params.search) qs.set("search", params.search)
    const query = qs.toString()
    return request<ConversationListResponse>(
      `/api/v1/agents/${agentId}/conversations/${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },

  /** DELETE /api/v1/agents/{id}/conversations/{conversation_id} — 204 No Content */
  delete: (token: string, agentId: string, conversationId: string): Promise<void> =>
    rawFetch(
      `/api/v1/agents/${agentId}/conversations/${conversationId}`,
      { method: "DELETE" },
      token
    ).then(() => undefined),

  /** GET /api/v1/agents/{id}/conversations/{conversation_id}/messages — cursor-paginated */
  listMessages: (
    token: string,
    agentId: string,
    conversationId: string,
    params: { cursor?: string; limit?: number } = {}
  ): Promise<MessageListResponse> => {
    const qs = new URLSearchParams()
    if (params.cursor)       qs.set("cursor", params.cursor)
    if (params.limit != null) qs.set("limit",  String(params.limit))
    const query = qs.toString()
    return request<MessageListResponse>(
      `/api/v1/agents/${agentId}/conversations/${conversationId}/messages${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },

  /** GET /api/v1/agents/{id}/conversations/search — offset-paginated full-text search */
  search: (
    token: string,
    agentId: string,
    params: { q: string; limit?: number; offset?: number }
  ): Promise<ConversationSearchResponse> => {
    const qs = new URLSearchParams()
    qs.set("q", params.q)
    if (params.limit  != null) qs.set("limit",  String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    return request<ConversationSearchResponse>(
      `/api/v1/agents/${agentId}/conversations/search?${qs.toString()}`,
      { method: "GET" },
      token
    )
  },
}

export const feedbackApi = {
  /** GET /api/v1/agents/{id}/feedback — cursor-paginated, status + conversation_id filters */
  list: (
    token: string,
    agentId: string,
    params: { cursor?: string; limit?: number; status?: FeedbackStatus; conversation_id?: string } = {}
  ): Promise<FeedbackListResponse> => {
    const qs = new URLSearchParams()
    if (params.cursor)          qs.set("cursor",          params.cursor)
    if (params.limit != null)   qs.set("limit",           String(params.limit))
    if (params.status)          qs.set("status",          params.status)
    if (params.conversation_id) qs.set("conversation_id", params.conversation_id)
    const query = qs.toString()
    return request<FeedbackListResponse>(
      `/api/v1/agents/${agentId}/feedback${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },

  /** PATCH /api/v1/agents/{id}/feedback/{feedback_id} — resolve or dismiss */
  resolve: (
    token: string,
    agentId: string,
    feedbackId: string,
    body: FeedbackResolveRequest
  ): Promise<FeedbackItem> =>
    request<FeedbackItem>(
      `/api/v1/agents/${agentId}/feedback/${feedbackId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      token
    ),
}

// ─── Handoff types (Contract F) ───────────────────────────────────────────────

export type HandoffItem = {
  id: string
  org_id: string
  agent_id: string
  user_id: string | null
  assigned_to: string | null
  handoff_requested_at: string | null
  title: string | null
  status: "handoff" | "closed"
  created_at: string
  updated_at: string
}

export type HandoffListResponse = {
  items: HandoffItem[]
  next_cursor: string | null
  has_more: boolean
}

export type HandoffReplyRequest = {
  content: string
}

export type HandoffReplyResponse = {
  message_id: string
  conversation_id: string
}

export type HandoffResolveRequest = {
  resolution_note?: string | null
}

export type HandoffResolveResponse = {
  conversation_id: string
  status: string
}

export type HandoffTypingRequest = {
  is_typing: boolean
}

export type HandoffTypingResponse = {
  conversation_id: string
  is_typing: boolean
  expires_at: string | null
}

export type HandoffMessageItem = {
  id:              string
  conversation_id: string
  role:            "user" | "assistant"
  content:         string
  citations:       unknown[]
  created_at:      string
}

export type HandoffMessagesResponse = {
  conversation_id:     string
  conversation_status: "open" | "handoff" | "closed"
  assigned_to:         string | null
  items:               HandoffMessageItem[]
}

// ─── handoffApi ───────────────────────────────────────────────────────────────

export const handoffApi = {
  /** GET /api/v1/handoff/ — cursor-paginated, optional unclaimed_only / status filters */
  list: (
    token: string,
    params: { cursor?: string; limit?: number; unclaimed_only?: boolean; status?: "handoff" | "closed" } = {}
  ): Promise<HandoffListResponse> => {
    const qs = new URLSearchParams()
    if (params.cursor)              qs.set("cursor",        params.cursor)
    if (params.limit != null)       qs.set("limit",         String(params.limit))
    if (params.unclaimed_only)      qs.set("unclaimed_only", "true")
    if (params.status)              qs.set("status",         params.status)
    const query = qs.toString()
    return request<HandoffListResponse>(
      `/api/v1/handoff/${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },

  /** POST /api/v1/handoff/{handoff_id}/claim — claim a pending handoff */
  claim: (token: string, handoffId: string): Promise<HandoffItem> =>
    request<HandoffItem>(
      `/api/v1/handoff/${handoffId}/claim`,
      { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } },
      token
    ),

  /** POST /api/v1/handoff/{handoff_id}/reply — send operator reply */
  reply: (
    token: string,
    handoffId: string,
    body: HandoffReplyRequest
  ): Promise<HandoffReplyResponse> =>
    request<HandoffReplyResponse>(
      `/api/v1/handoff/${handoffId}/reply`,
      { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) },
      token
    ),

  /** POST /api/v1/handoff/{handoff_id}/resolve — resolve and close handoff */
  resolve: (
    token: string,
    handoffId: string,
    body: HandoffResolveRequest = {}
  ): Promise<HandoffResolveResponse> =>
    request<HandoffResolveResponse>(
      `/api/v1/handoff/${handoffId}/resolve`,
      { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) },
      token
    ),

  /** POST /api/v1/handoff/{handoff_id}/typing — set or clear operator typing indicator */
  setTyping: (
    token: string,
    handoffId: string,
    body: HandoffTypingRequest
  ): Promise<HandoffTypingResponse> =>
    request<HandoffTypingResponse>(
      `/api/v1/handoff/${handoffId}/typing`,
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  /** GET /api/v1/handoff/{handoff_id}/typing — poll operator typing state */
  getTyping: (token: string, handoffId: string): Promise<HandoffTypingResponse> =>
    request<HandoffTypingResponse>(
      `/api/v1/handoff/${handoffId}/typing`,
      { method: "GET" },
      token
    ),

  /** GET /api/v1/handoff/{handoff_id}/messages — full conversation timeline */
  messages: (
    token: string,
    handoffId: string,
    params: { limit?: number } = {}
  ): Promise<HandoffMessagesResponse> => {
    const qs = new URLSearchParams()
    if (params.limit != null) qs.set("limit", String(params.limit))
    const query = qs.toString()
    return request<HandoffMessagesResponse>(
      `/api/v1/handoff/${handoffId}/messages${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },
}

// ─── Support Teams types (Contract F) ────────────────────────────────────────

export type SupportTeamResponse = {
  id: string
  org_id: string
  name: string
  description: string | null
  is_default: boolean
  member_user_ids: string[]
  agent_ids: string[]
  created_at: string
  updated_at: string
}

export type SupportTeamCreateRequest = {
  name: string
  description?: string | null
  is_default?: boolean
}

export type SupportTeamUpdateRequest = {
  name?: string | null
  description?: string | null
  is_default?: boolean | null
}

export type SupportTeamMemberAssignRequest = {
  user_id: string
}

export type SupportTeamAgentAssignRequest = {
  agent_id: string
}

// ─── supportTeamsApi ──────────────────────────────────────────────────────────

export const supportTeamsApi = {
  /** GET /api/v1/support-teams/ — list all support teams for the org */
  list: (token: string): Promise<SupportTeamResponse[]> =>
    request<SupportTeamResponse[]>("/api/v1/support-teams/", { method: "GET" }, token),

  /** POST /api/v1/support-teams/ — create a new support team */
  create: (token: string, body: SupportTeamCreateRequest): Promise<SupportTeamResponse> =>
    request<SupportTeamResponse>(
      "/api/v1/support-teams/",
      { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) },
      token
    ),

  /** PATCH /api/v1/support-teams/{team_id} — update team name / description / is_default */
  update: (
    token: string,
    teamId: string,
    body: SupportTeamUpdateRequest
  ): Promise<SupportTeamResponse> =>
    request<SupportTeamResponse>(
      `/api/v1/support-teams/${teamId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      token
    ),

  /** DELETE /api/v1/support-teams/{team_id} — 204 No Content */
  delete: (token: string, teamId: string): Promise<void> =>
    rawFetch(
      `/api/v1/support-teams/${teamId}`,
      { method: "DELETE" },
      token
    ).then(() => undefined),

  /** POST /api/v1/support-teams/{team_id}/members — assign a user to the team */
  addMember: (
    token: string,
    teamId: string,
    body: SupportTeamMemberAssignRequest
  ): Promise<SupportTeamResponse> =>
    request<SupportTeamResponse>(
      `/api/v1/support-teams/${teamId}/members`,
      { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) },
      token
    ),

  /** DELETE /api/v1/support-teams/{team_id}/members/{user_id} — remove a user from the team */
  removeMember: (token: string, teamId: string, userId: string): Promise<SupportTeamResponse> =>
    request<SupportTeamResponse>(
      `/api/v1/support-teams/${teamId}/members/${userId}`,
      { method: "DELETE" },
      token
    ),

  /** POST /api/v1/support-teams/{team_id}/agents — route an agent to this team */
  addAgent: (
    token: string,
    teamId: string,
    body: SupportTeamAgentAssignRequest
  ): Promise<SupportTeamResponse> =>
    request<SupportTeamResponse>(
      `/api/v1/support-teams/${teamId}/agents`,
      { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) },
      token
    ),

  /** DELETE /api/v1/support-teams/{team_id}/agents/{agent_id} — remove an agent from the team */
  removeAgent: (token: string, teamId: string, agentId: string): Promise<SupportTeamResponse> =>
    request<SupportTeamResponse>(
      `/api/v1/support-teams/${teamId}/agents/${agentId}`,
      { method: "DELETE" },
      token
    ),
}

// ─── Alert Config types (Contract F) ─────────────────────────────────────────

export type AlertConfigResponse = {
  id: string
  org_id: string
  credit_low_threshold: number
  high_volume_threshold: number
  low_feedback_threshold: number
  webhook_enabled: boolean
  webhook_url: string | null
  email_enabled: boolean
  email_to: string | null
  sms_enabled: boolean
  sms_to: string | null
  created_at: string
  updated_at: string
}

export type AlertConfigUpdateRequest = {
  credit_low_threshold: number
  high_volume_threshold: number
  low_feedback_threshold: number
  webhook_enabled: boolean
  webhook_url?: string | null
  email_enabled: boolean
  email_to?: string | null
  sms_enabled: boolean
  sms_to?: string | null
}

export type AlertConfigTestResponse = {
  queued: boolean
  task_id: string
  channels: string[]
}

// ─── alertConfigApi ───────────────────────────────────────────────────────────

export const alertConfigApi = {
  /** GET /api/v1/org/alert-config — fetch current org alert config */
  get: (token: string): Promise<AlertConfigResponse> =>
    request<AlertConfigResponse>("/api/v1/org/alert-config", { method: "GET" }, token),

  /** PUT /api/v1/org/alert-config — update alert thresholds and delivery settings */
  update: (token: string, body: AlertConfigUpdateRequest): Promise<AlertConfigResponse> =>
    request<AlertConfigResponse>(
      "/api/v1/org/alert-config",
      { method: "PUT", body: JSON.stringify(body) },
      token
    ),

  /** POST /api/v1/org/alert-config/test — trigger a test alert dispatch */
  test: (token: string): Promise<AlertConfigTestResponse> =>
    request<AlertConfigTestResponse>(
      "/api/v1/org/alert-config/test",
      { method: "POST" },
      token
    ),
}

// ─── Contract G: Analytics, Credits, Usage Reports, GDPR, Report Schedule ────
// .github/api-contracts/analytics-credits-usage-reports-gdpr.json

export type OrgPlan = "free" | "pro" | "enterprise"

export type DailyUsageStat = {
  usage_date:    string   // "YYYY-MM-DD"
  tokens_used:   number
  message_count: number
}

export type TopKeyword = {
  keyword: string
  count:   number
}

export type FeedbackSummary = {
  thumbs_up:  number
  thumbs_down: number
  pending:    number
  resolved:   number
  dismissed:  number
}

export type AgentAnalyticsResponse = {
  org_id:           string
  agent_id:         string
  start_date:       string
  end_date:         string
  total_tokens:     number
  total_messages:   number
  daily_stats:      DailyUsageStat[]
  top_keywords:     TopKeyword[]
  feedback_summary: FeedbackSummary
}

export const agentAnalyticsApi = {
  /** GET /api/v1/agents/{id}/analytics?start_date=&end_date= */
  get: (
    token: string,
    agentId: string,
    params: { start_date?: string; end_date?: string } = {}
  ): Promise<AgentAnalyticsResponse> => {
    const qs = new URLSearchParams()
    if (params.start_date) qs.set("start_date", params.start_date)
    if (params.end_date)   qs.set("end_date",   params.end_date)
    const query = qs.toString()
    return request<AgentAnalyticsResponse>(
      `/api/v1/agents/${agentId}/analytics${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },
}

// ─── Credits ──────────────────────────────────────────────────────────────────

export type OrgCreditsResponse = {
  org_id:         string
  credit_balance: number
  plan:           OrgPlan
  updated_at:     string
  recent_usage:   DailyUsageStat[]   // last 30 days across all agents
}

export type CreditTopupRequest = {
  amount: number          // positive integer
  reason?: string | null
}

export type CreditBalanceResponse = {
  org_id:         string
  credit_balance: number
  updated_at:     string
}

export const creditsApi = {
  /** GET /api/v1/org/credits */
  get: (token: string): Promise<OrgCreditsResponse> =>
    request<OrgCreditsResponse>("/api/v1/org/credits", { method: "GET" }, token),

  /** POST /api/v1/org/credits/topup — requires Idempotency-Key header */
  topup: (token: string, body: CreditTopupRequest): Promise<CreditBalanceResponse> =>
    request<CreditBalanceResponse>(
      "/api/v1/org/credits/topup",
      {
        method:  "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body:    JSON.stringify(body),
      },
      token
    ),
}

// ─── Usage Reports ────────────────────────────────────────────────────────────

export type AgentUsageSummary = {
  agent_id:       string
  agent_name:     string
  total_tokens:   number
  total_messages: number
}

export type UsageReportResponse = {
  org_id:           string
  period_start:     string
  period_end:       string
  total_tokens:     number
  total_messages:   number
  per_agent:        AgentUsageSummary[]
  top_keywords:     TopKeyword[]
  feedback_summary: FeedbackSummary
  generated_at:     string
}

export const reportsApi = {
  /** GET /api/v1/reports/usage?period_start=&period_end= — defaults to last 7 days */
  usageReport: (
    token: string,
    params: { period_start?: string; period_end?: string } = {}
  ): Promise<UsageReportResponse> => {
    const qs = new URLSearchParams()
    if (params.period_start) qs.set("period_start", params.period_start)
    if (params.period_end)   qs.set("period_end",   params.period_end)
    const query = qs.toString()
    return request<UsageReportResponse>(
      `/api/v1/reports/usage${query ? `?${query}` : ""}`,
      { method: "GET" },
      token
    )
  },
}

// ─── GDPR ─────────────────────────────────────────────────────────────────────

export const gdprApi = {
  /** GET /api/v1/org/export-data — streams a ZIP archive of all org data (admin-only) */
  exportData: (token: string): Promise<Response> =>
    rawFetch("/api/v1/org/export-data", { method: "GET" }, token),

  /** DELETE /api/v1/org/delete-data — permanently deletes all org data (admin-only) */
  deleteData: (token: string): Promise<Record<string, unknown>> =>
    request<Record<string, unknown>>("/api/v1/org/delete-data", { method: "DELETE" }, token),
}

// ─── Report Schedule ──────────────────────────────────────────────────────────

export type ReportFrequency = "weekly"

export type ReportScheduleResponse = {
  id:                string
  org_id:            string
  webhook_url?:      string | null
  email_recipients?: string[] | null
  frequency:         ReportFrequency
  day_of_week:       number   // 0=Monday … 6=Sunday
  hour_utc:          number   // 0–23
  is_active:         boolean
  created_at:        string
  updated_at:        string
}

export type ReportScheduleUpdateRequest = {
  webhook_url?:      string | null
  email_recipients?: string[] | null
  frequency?:        ReportFrequency
  day_of_week?:      number
  hour_utc?:         number
  is_active?:        boolean
}

export const reportScheduleApi = {
  /** GET /api/v1/org/reports/schedule — returns 404 if no schedule exists */
  get: (token: string): Promise<ReportScheduleResponse> =>
    request<ReportScheduleResponse>("/api/v1/org/reports/schedule", { method: "GET" }, token),

  /** PUT /api/v1/org/reports/schedule — create or update schedule */
  save: (token: string, body: ReportScheduleUpdateRequest): Promise<ReportScheduleResponse> =>
    request<ReportScheduleResponse>(
      "/api/v1/org/reports/schedule",
      { method: "PUT", body: JSON.stringify(body) },
      token
    ),

  /** DELETE /api/v1/org/reports/schedule — 204 No Content */
  delete: (token: string): Promise<void> =>
    rawFetch("/api/v1/org/reports/schedule", { method: "DELETE" }, token).then(() => undefined),
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export type IntegrationAuthType =
  | "none"
  | "api_key"
  | "bearer"
  | "oauth2_client_credentials"

export type IntegrationCreate = {
  name:             string
  base_url:         string
  description?:     string | null
  auth_type?:       IntegrationAuthType
  auth_config?:     Record<string, unknown> | null
  default_headers?: Record<string, unknown> | null
  is_active?:       boolean
}

export type IntegrationUpdate = {
  name?:            string | null
  description?:     string | null
  base_url?:        string | null
  auth_type?:       IntegrationAuthType | null
  auth_config?:     Record<string, unknown> | null
  default_headers?: Record<string, unknown> | null
  is_active?:       boolean | null
}

export type IntegrationResponse = {
  id:              string
  org_id:          string
  agent_id:        string
  name:            string
  description:     string | null
  base_url:        string
  auth_type:       IntegrationAuthType
  default_headers: Record<string, unknown> | null
  is_active:       boolean
  created_at:      string
  updated_at:      string
}

export type IntegrationConfigResponse = {
  id:          string
  auth_type:   IntegrationAuthType
  auth_config: Record<string, unknown> | null
}

export type IntegrationTestResponse = {
  status:           "ok" | "error"
  http_status_code?: number | null
  latency_ms?:       number | null
  detail?:           string | null
}

export const integrationsApi = {
  /** GET /api/v1/agents/{id}/integrations/ */
  list: (token: string, agentId: string): Promise<IntegrationResponse[]> =>
    request<IntegrationResponse[]>(`/api/v1/agents/${agentId}/integrations/`, { method: "GET" }, token),

  /** POST /api/v1/agents/{id}/integrations/ */
  create: (token: string, agentId: string, body: IntegrationCreate): Promise<IntegrationResponse> =>
    request<IntegrationResponse>(
      `/api/v1/agents/${agentId}/integrations/`,
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  /** GET /api/v1/agents/{id}/integrations/{integrationId} */
  get: (token: string, agentId: string, integrationId: string): Promise<IntegrationResponse> =>
    request<IntegrationResponse>(`/api/v1/agents/${agentId}/integrations/${integrationId}`, { method: "GET" }, token),

  /** PATCH /api/v1/agents/{id}/integrations/{integrationId} */
  update: (
    token: string,
    agentId: string,
    integrationId: string,
    body: IntegrationUpdate
  ): Promise<IntegrationResponse> =>
    request<IntegrationResponse>(
      `/api/v1/agents/${agentId}/integrations/${integrationId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      token
    ),

  /** DELETE /api/v1/agents/{id}/integrations/{integrationId} — 204 No Content */
  delete: (token: string, agentId: string, integrationId: string): Promise<void> =>
    rawFetch(`/api/v1/agents/${agentId}/integrations/${integrationId}`, { method: "DELETE" }, token).then(() => undefined),

  /** GET /api/v1/agents/{id}/integrations/{integrationId}/config — admin only */
  getConfig: (token: string, agentId: string, integrationId: string): Promise<IntegrationConfigResponse> =>
    request<IntegrationConfigResponse>(`/api/v1/agents/${agentId}/integrations/${integrationId}/config`, { method: "GET" }, token),

  /** POST /api/v1/agents/{id}/integrations/{integrationId}/test */
  test: (token: string, agentId: string, integrationId: string): Promise<IntegrationTestResponse> =>
    request<IntegrationTestResponse>(`/api/v1/agents/${agentId}/integrations/${integrationId}/test`, { method: "POST" }, token),
}

// ─── Integration Tools ────────────────────────────────────────────────────────

export type BodyTemplateMode = "json-strict" | "handlebars" | "passthrough"

// New 2026-05-18 contract
export type TruncationStrategy = "head" | "tail"

export type ToolExample = {
  user_message: string
  tool_args?:   Record<string, unknown> | null
}

export type IntegrationToolCreate = {
  name:                   string
  http_method:            "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path_template:          string
  description?:           string | null
  body_template_mode?:    BodyTemplateMode
  body_template?:         string | null
  response_extract_path?: string | null
  cache_ttl_seconds?:     number
  is_readonly?:           boolean
  fail_silent?:           boolean
  fail_silent_message?:   string | null
  // Tool controls (2026-05-18)
  max_response_chars?:    number
  truncation_strategy?:   TruncationStrategy
  timeout_ms?:            number
  retry_count?:           number
  retry_on?:              number[]
  error_messages?:        Record<string, string> | null
  examples?:              ToolExample[] | null
}

export type IntegrationToolUpdate = {
  name?:                  string | null
  description?:           string | null
  http_method?:           "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | null
  path_template?:         string | null
  body_template_mode?:    BodyTemplateMode | null
  body_template?:         string | null
  response_extract_path?: string | null
  cache_ttl_seconds?:     number | null
  is_readonly?:           boolean | null
  fail_silent?:           boolean | null
  fail_silent_message?:   string | null
  // Tool controls (2026-05-18)
  max_response_chars?:    number | null
  truncation_strategy?:   TruncationStrategy | null
  timeout_ms?:            number | null
  retry_count?:           number | null
  retry_on?:              number[] | null
  error_messages?:        Record<string, string> | null
  examples?:              ToolExample[] | null
}

export type IntegrationToolResponse = {
  id:                    string
  org_id:                string
  integration_id:        string
  name:                  string
  description:           string | null
  http_method:           string
  path_template:         string
  body_template_mode:    BodyTemplateMode
  body_template:         string | null
  response_extract_path: string | null
  cache_ttl_seconds:     number
  is_readonly:           boolean
  fail_silent:           boolean
  fail_silent_message:   string | null
  current_version:       number
  created_at:            string
  updated_at:            string
  // Tool controls (2026-05-18)
  max_response_chars:    number
  truncation_strategy:   TruncationStrategy
  timeout_ms:            number
  retry_count:           number
  retry_on:              number[]
  error_messages:        Record<string, string> | null
  examples:              ToolExample[] | null
}

export type ToolVersionResponse = {
  id:                    string
  org_id:                string
  tool_id:               string
  version_number:        number
  name:                  string
  description:           string | null
  http_method:           string
  path_template:         string
  body_template_mode:    BodyTemplateMode
  body_template:         string | null
  response_extract_path: string | null
  cache_ttl_seconds:     number
  is_readonly:           boolean
  fail_silent:           boolean
  fail_silent_message:   string | null
  created_at:            string
  // Tool controls (2026-05-18)
  max_response_chars:    number
  truncation_strategy:   TruncationStrategy
  timeout_ms:            number
  retry_count:           number
  retry_on:              number[]
  error_messages:        Record<string, string> | null
  examples:              ToolExample[] | null
}

export type ToolCallLogResponse = {
  id:                string
  org_id:            string
  tool_id:           string | null
  tool_name:         string | null
  integration_id:    string | null
  conversation_id:   string | null
  input_params:      Record<string, unknown> | null
  response_snapshot: string | null
  http_status_code:  number | null
  duration_ms:       number | null
  is_dry_run:        boolean
  error_message:     string | null
  created_at:        string
}

export type ToolLogsParams = {
  is_dry_run?:       boolean
  http_status_code?: number
  from_date?:        string
  to_date?:          string
  limit?:            number
}

export type ToolTestRequest = {
  input_params?: Record<string, unknown>
}

export type ToolTestResponse = {
  status:           "ok" | "error"
  http_status_code: number | null
  response_body:    string | null
  latency_ms:       number | null
  error:            string | null
}

export const integrationToolsApi = {
  /** GET /api/v1/agents/{id}/integrations/{integrationId}/tools/ */
  list: (token: string, agentId: string, integrationId: string): Promise<IntegrationToolResponse[]> =>
    request<IntegrationToolResponse[]>(
      `/api/v1/agents/${agentId}/integrations/${integrationId}/tools/`,
      { method: "GET" },
      token
    ),

  /** POST /api/v1/agents/{id}/integrations/{integrationId}/tools/ */
  create: (
    token: string,
    agentId: string,
    integrationId: string,
    body: IntegrationToolCreate
  ): Promise<IntegrationToolResponse> =>
    request<IntegrationToolResponse>(
      `/api/v1/agents/${agentId}/integrations/${integrationId}/tools/`,
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  /** PATCH /api/v1/agents/{id}/integrations/{integrationId}/tools/{toolId} */
  update: (
    token: string,
    agentId: string,
    integrationId: string,
    toolId: string,
    body: IntegrationToolUpdate
  ): Promise<IntegrationToolResponse> =>
    request<IntegrationToolResponse>(
      `/api/v1/agents/${agentId}/integrations/${integrationId}/tools/${toolId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      token
    ),

  /** DELETE /api/v1/agents/{id}/integrations/{integrationId}/tools/{toolId} — 204 No Content */
  delete: (token: string, agentId: string, integrationId: string, toolId: string): Promise<void> =>
    rawFetch(
      `/api/v1/agents/${agentId}/integrations/${integrationId}/tools/${toolId}`,
      { method: "DELETE" },
      token
    ).then(() => undefined),

  /** GET /api/v1/agents/{id}/integrations/{integrationId}/tools/{toolId}/versions */
  listVersions: (token: string, agentId: string, integrationId: string, toolId: string): Promise<ToolVersionResponse[]> =>
    request<ToolVersionResponse[]>(
      `/api/v1/agents/${agentId}/integrations/${integrationId}/tools/${toolId}/versions`,
      { method: "GET" },
      token
    ),

  /** POST /api/v1/agents/{id}/integrations/{integrationId}/tools/{toolId}/versions/{verId}/restore */
  restoreVersion: (
    token: string,
    agentId: string,
    integrationId: string,
    toolId: string,
    verId: string
  ): Promise<IntegrationToolResponse> =>
    request<IntegrationToolResponse>(
      `/api/v1/agents/${agentId}/integrations/${integrationId}/tools/${toolId}/versions/${verId}/restore`,
      { method: "POST" },
      token
    ),

  /** GET /api/v1/agents/{id}/integrations/{integrationId}/tools/{toolId}/logs */
  listLogs: (
    token: string,
    agentId: string,
    integrationId: string,
    toolId: string,
    params: ToolLogsParams = {}
  ): Promise<ToolCallLogResponse[]> => {
    const qs = new URLSearchParams()
    if (params.is_dry_run !== undefined) qs.set("is_dry_run", String(params.is_dry_run))
    if (params.http_status_code !== undefined) qs.set("http_status_code", String(params.http_status_code))
    if (params.from_date) qs.set("from_date", params.from_date)
    if (params.to_date) qs.set("to_date", params.to_date)
    if (params.limit) qs.set("limit", String(params.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ""
    return request<ToolCallLogResponse[]>(
      `/api/v1/agents/${agentId}/integrations/${integrationId}/tools/${toolId}/logs${suffix}`,
      { method: "GET" },
      token
    )
  },
  /** POST /api/v1/agents/{id}/integrations/{integrationId}/tools/{toolId}/test — dry-run */
  test: (
    token: string,
    agentId: string,
    integrationId: string,
    toolId: string,
    body: ToolTestRequest
  ): Promise<ToolTestResponse> =>
    request<ToolTestResponse>(
      `/api/v1/agents/${agentId}/integrations/${integrationId}/tools/${toolId}/test`,
      { method: "POST", body: JSON.stringify(body) },
      token
    ),
}

// ─── Agent Tool Calls ─────────────────────────────────────────────────────────

export type AgentToolCallsParams = {
  integration_id?:   string
  is_dry_run?:       boolean
  http_status_code?: number
  from_date?:        string
  to_date?:          string
  limit?:            number
}

export const agentToolCallsApi = {
  /** GET /api/v1/agents/{id}/tool-calls */
  list: (token: string, agentId: string, params: AgentToolCallsParams = {}): Promise<ToolCallLogResponse[]> => {
    const qs = new URLSearchParams()
    if (params.integration_id) qs.set("integration_id", params.integration_id)
    if (params.is_dry_run !== undefined) qs.set("is_dry_run", String(params.is_dry_run))
    if (params.http_status_code !== undefined) qs.set("http_status_code", String(params.http_status_code))
    if (params.from_date) qs.set("from_date", params.from_date)
    if (params.to_date) qs.set("to_date", params.to_date)
    if (params.limit) qs.set("limit", String(params.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ""
    return request<ToolCallLogResponse[]>(`/api/v1/agents/${agentId}/tool-calls${suffix}`, { method: "GET" }, token)
  },
}

// ─── Contract H: Settings — LLM + Embedding ──────────────────────────────────

export type LLMSettingsOut = {
  provider:         string
  model:            string
  api_key:          string        // "***" when set, empty string when not set
  base_url:         string | null
  api_version?:     string | null
  deployment_name?: string | null
  extra:            Record<string, unknown> | null
}

export type LLMSettingsIn = {
  provider:          string
  model?:            string | null
  api_key?:          string | null
  base_url?:         string | null
  api_version?:      string | null
  deployment_name?:  string | null
  extra?:            Record<string, unknown> | null
}

export type EmbeddingSettingsOut = {
  provider:  string
  model:     string
  api_key:   string
  base_url:  string | null
  extra:     Record<string, unknown> | null
}

export type EmbeddingSettingsIn = {
  provider:  string
  model?:    string | null
  api_key?:  string | null
  base_url?: string | null
  extra?:    Record<string, unknown> | null
}

export const llmSettingsApi = {
  /** GET /api/v1/settings/llm */
  get: (token: string): Promise<LLMSettingsOut> =>
    request<LLMSettingsOut>("/api/v1/settings/llm", { method: "GET" }, token),

  /** PUT /api/v1/settings/llm */
  update: (token: string, body: LLMSettingsIn): Promise<LLMSettingsOut> =>
    request<LLMSettingsOut>("/api/v1/settings/llm", { method: "PUT", body: JSON.stringify(body) }, token),
}

export const embeddingSettingsApi = {
  /** GET /api/v1/settings/embedding */
  get: (token: string): Promise<EmbeddingSettingsOut> =>
    request<EmbeddingSettingsOut>("/api/v1/settings/embedding", { method: "GET" }, token),

  /** PUT /api/v1/settings/embedding */
  update: (token: string, body: EmbeddingSettingsIn): Promise<EmbeddingSettingsOut> =>
    request<EmbeddingSettingsOut>("/api/v1/settings/embedding", { method: "PUT", body: JSON.stringify(body) }, token),
}

// ─── Communication Settings ──────────────────────────────────────────────────

export type SMTPSettingsOut = {
  host:         string
  port:         number
  username:     string | null
  password:     string      // "***" when set
  use_tls:      boolean
  from_address: string
}

export type SMTPSettingsIn = {
  host:          string
  port:          number
  username?:     string | null
  password?:     string | null
  use_tls?:      boolean
  from_address:  string
}

export type TwilioSettingsOut = {
  account_sid:  string
  auth_token:   string      // "***" when set
  from_number:  string
}

export type TwilioSettingsIn = {
  account_sid:  string
  auth_token?:  string | null
  from_number:  string
}

export const communicationApi = {
  /** GET /api/v1/settings/communication/smtp */
  getSMTP: (token: string): Promise<SMTPSettingsOut> =>
    request<SMTPSettingsOut>("/api/v1/settings/communication/smtp", { method: "GET" }, token),

  /** PUT /api/v1/settings/communication/smtp */
  updateSMTP: (token: string, body: SMTPSettingsIn): Promise<SMTPSettingsOut> =>
    request<SMTPSettingsOut>("/api/v1/settings/communication/smtp", { method: "PUT", body: JSON.stringify(body) }, token),

  /** GET /api/v1/settings/communication/twilio */
  getTwilio: (token: string): Promise<TwilioSettingsOut> =>
    request<TwilioSettingsOut>("/api/v1/settings/communication/twilio", { method: "GET" }, token),

  /** PUT /api/v1/settings/communication/twilio */
  updateTwilio: (token: string, body: TwilioSettingsIn): Promise<TwilioSettingsOut> =>
    request<TwilioSettingsOut>("/api/v1/settings/communication/twilio", { method: "PUT", body: JSON.stringify(body) }, token),
}
