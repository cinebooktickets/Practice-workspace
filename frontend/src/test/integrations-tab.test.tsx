import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { IntegrationsTab } from "@/app/dashboard/agents/[id]/_tabs/integrations-tab"
import {
  integrationsApi,
  integrationToolsApi,
  agentToolCallsApi,
  ApiException,
} from "@/lib/api"
import type { IntegrationResponse, IntegrationToolResponse } from "@/lib/api"

// ─── Fixtures ────────────────────────────────────────────────────────────────

const INTEGRATION: IntegrationResponse = {
  id: "int-1",
  org_id: "org1",
  agent_id: "agent-123",
  name: "My Integration",
  description: "desc",
  base_url: "https://api.example.com",
  auth_type: "api_key",
  default_headers: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

const TOOL: IntegrationToolResponse = {
  id: "tool-1",
  org_id: "org1",
  integration_id: "int-1",
  name: "get_data",
  description: "fetch data",
  http_method: "GET",
  path_template: "/data",
  body_template_mode: "passthrough",
  body_template: null,
  response_extract_path: null,
  cache_ttl_seconds: 0,
  is_readonly: true,
  fail_silent: false,
  fail_silent_message: null,
  current_version: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  max_response_chars: 0,
  truncation_strategy: "head" as const,
  timeout_ms: 10000,
  retry_count: 2,
  retry_on: [],
  error_messages: null,
  examples: null,
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  integrationsApi: {
    list:   vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    test:   vi.fn(),
  },
  integrationToolsApi: {
    list:           vi.fn(),
    create:         vi.fn(),
    update:         vi.fn(),
    delete:         vi.fn(),
    listVersions:   vi.fn(),
    restoreVersion: vi.fn(),
    listLogs:       vi.fn(),
  },
  agentToolCallsApi: {
    list: vi.fn(),
  },
  ApiException: class ApiException extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

vi.mock("@/context/auth", () => {
  const getAccessTokenSilently = () => Promise.resolve("fake-token")
  const authValue = { getAccessTokenSilently, user: { role: "admin" } }
  return { useAuth: () => authValue }
})

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("IntegrationsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(integrationsApi.list).mockResolvedValue([])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([])
    vi.mocked(integrationToolsApi.listVersions).mockResolvedValue([])
    vi.mocked(integrationToolsApi.listLogs).mockResolvedValue([])
    vi.mocked(agentToolCallsApi.list).mockResolvedValue([])
  })

  // ── List ─────────────────────────────────────────────────────────────────

  it("shows skeleton while loading", () => {
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0)
  })

  it("renders integration name after loading", async () => {
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => expect(screen.getByText("My Integration")).toBeInTheDocument(), { timeout: 3000 })
  })

  it("shows empty state when no integrations", async () => {
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => expect(screen.getByText("No integrations yet")).toBeInTheDocument(), { timeout: 3000 })
  })

  it("shows error state with retry when list fails", async () => {
    vi.mocked(integrationsApi.list).mockRejectedValue(new Error("Failed to load integrations"))
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => expect(screen.getByText("Failed to load integrations")).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })

  // ── Create ────────────────────────────────────────────────────────────────

  it("opens create sheet when Add Integration is clicked", async () => {
    const user = userEvent.setup()
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.queryByText(/loading/i))
    const addBtns = screen.getAllByRole("button", { name: /add integration/i })
    await user.click(addBtns[0])
    expect(screen.getByText(/new integration/i)).toBeInTheDocument()
  })

  it("creates integration successfully", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.create).mockResolvedValue(INTEGRATION)
    vi.mocked(integrationsApi.list)
      .mockResolvedValueOnce([])
      .mockResolvedValue([INTEGRATION])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByRole("button", { name: /add integration/i }))

    const addBtns = screen.getAllByRole("button", { name: /add integration/i })
    await user.click(addBtns[0])
    await user.type(screen.getByLabelText(/^name/i), "My Integration")
    await user.type(screen.getByLabelText(/base url/i), "https://api.example.com")
    await user.click(screen.getByRole("button", { name: /create integration/i }))

    await waitFor(() => expect(integrationsApi.create).toHaveBeenCalledOnce())
  })

  it("shows error toast when create fails", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    vi.mocked(integrationsApi.create).mockRejectedValue(
      new (ApiException as any)(422, "Name is required")
    )
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.queryByText(/no integrations/i))

    const addBtns = screen.getAllByRole("button", { name: /add integration/i })
    await user.click(addBtns[0])
    await user.type(screen.getByLabelText(/^name/i), "X")
    await user.type(screen.getByLabelText(/base url/i), "https://x.com")
    await user.click(screen.getByRole("button", { name: /create integration/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  // ── Manage / Edit ─────────────────────────────────────────────────────────

  it("opens manage sheet when Manage is clicked", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    // Sheet opens — integration name appears as sheet title
    await waitFor(() => expect(screen.getAllByText("My Integration").length).toBeGreaterThan(1))
  })

  it("calls update when Save is clicked in manage sheet", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationsApi.update).mockResolvedValue({ ...INTEGRATION, name: "Updated" })
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByDisplayValue("My Integration"))

    const nameInput = screen.getByDisplayValue("My Integration")
    await user.clear(nameInput)
    await user.type(nameInput, "Updated")
    await user.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => expect(integrationsApi.update).toHaveBeenCalledOnce())
  })

  // ── Test Connectivity ─────────────────────────────────────────────────────

  it("shows success when test connectivity passes", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationsApi.test).mockResolvedValue({ status: "ok", latency_ms: 42 })
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /test connectivity/i }))
    await user.click(screen.getByRole("button", { name: /test connectivity/i }))

    await waitFor(() => {
      const span = document.querySelector(".text-green-600, .text-green-400")
      expect(span).not.toBeNull()
    }, { timeout: 3000 })
  })

  it("shows failure when test connectivity fails", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationsApi.test).mockResolvedValue({ status: "error", detail: "Connection refused", latency_ms: null })
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /test connectivity/i }))
    await user.click(screen.getByRole("button", { name: /test connectivity/i }))

    await waitFor(() => expect(screen.getByText("Connection refused")).toBeInTheDocument())
  })

  // ── Delete Integration ────────────────────────────────────────────────────

  it("deletes integration after confirm dialog", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationsApi.delete).mockResolvedValue(undefined)
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /delete integration/i }))
    await user.click(screen.getByRole("button", { name: /delete integration/i }))

    // confirm dialog
    await waitFor(() => screen.getByRole("button", { name: /^delete$/i }))
    await user.click(screen.getByRole("button", { name: /^delete$/i }))

    await waitFor(() => expect(integrationsApi.delete).toHaveBeenCalledOnce())
  })

  // ── Tools within Integration ──────────────────────────────────────────────

  it("renders tool name inside manage sheet", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([TOOL])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage/i }))
    await waitFor(() => expect(screen.getByText("get_data")).toBeInTheDocument())
  })

  it("opens add tool sheet when Add Tool is clicked", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))

    await waitFor(() => expect(screen.getByText(/new tool/i)).toBeInTheDocument())
  })

  it("creates tool successfully", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list)
      .mockResolvedValueOnce([])
      .mockResolvedValue([TOOL])
    vi.mocked(integrationToolsApi.create).mockResolvedValue(TOOL)
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))

    await waitFor(() => screen.getByText(/new tool/i))
    await user.type(screen.getByLabelText(/^name/i, { selector: "#tool-name" }), "get_data")
    await user.type(screen.getByLabelText(/path/i, { selector: "#tool-path" }), "/data")
    await user.click(screen.getByRole("button", { name: /create tool/i }))

    await waitFor(() => expect(integrationToolsApi.create).toHaveBeenCalledOnce())
  })

  it("deletes tool after confirm", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([TOOL])
    vi.mocked(integrationToolsApi.delete).mockResolvedValue(undefined)
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByText("get_data"))

    await user.click(screen.getByRole("button", { name: /delete get_data/i }))
    await waitFor(() => screen.getByRole("button", { name: /^delete$/i }))
    await user.click(screen.getByRole("button", { name: /^delete$/i }))

    await waitFor(() => expect(integrationToolsApi.delete).toHaveBeenCalledOnce())
  })

  // ── Phase 12: Controls section ────────────────────────────────────────────

  it("ToolSheet shows Controls section toggle", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))
    await waitFor(() => screen.getByText(/new tool/i))

    expect(screen.getByRole("button", { name: /controls/i })).toBeInTheDocument()
  })

  it("Controls section expands and shows timeout + retry count fields", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))
    await waitFor(() => screen.getByText(/new tool/i))

    await user.click(screen.getByRole("button", { name: /controls/i }))
    expect(screen.getByLabelText(/timeout/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/retry count/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max response chars/i)).toBeInTheDocument()
  })

  it("retry_on chip is added on Enter and removed on × click", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))
    await waitFor(() => screen.getByText(/new tool/i))

    await user.click(screen.getByRole("button", { name: /controls/i }))

    const chipInput = document.querySelector("input[placeholder*='429']") as HTMLInputElement
    expect(chipInput).not.toBeNull()
    await user.type(chipInput!, "429")
    await user.keyboard("{Enter}")

    expect(screen.getByText("429")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /remove 429/i }))
    expect(screen.queryByText("429")).toBeNull()
  })

  it("Controls section sends timeout_ms and retry_on in create payload", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([TOOL])
    vi.mocked(integrationToolsApi.create).mockResolvedValue(TOOL)
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))
    await waitFor(() => screen.getByText(/new tool/i))

    await user.type(screen.getByLabelText(/^name/i, { selector: "#tool-name" }), "my_tool")
    await user.type(screen.getByLabelText(/path/i, { selector: "#tool-path" }), "/endpoint")

    await user.click(screen.getByRole("button", { name: /controls/i }))
    const timeoutInput = screen.getByLabelText(/timeout/i) as HTMLInputElement
    await user.clear(timeoutInput)
    await user.type(timeoutInput, "5000")

    const chipInput = document.querySelector("input[placeholder*='429']") as HTMLInputElement
    await user.type(chipInput!, "503")
    await user.keyboard("{Enter}")

    await user.click(screen.getByRole("button", { name: /create tool/i }))

    await waitFor(() => {
      const call = vi.mocked(integrationToolsApi.create).mock.calls[0]?.[3]
      expect(call?.timeout_ms).toBe(5000)
      expect(call?.retry_on).toContain(503)
    })
  })

  // ── Phase 12: Error Messages section ─────────────────────────────────────

  it("Error Messages section expands and allows adding a row", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))
    await waitFor(() => screen.getByText(/new tool/i))

    await user.click(screen.getByRole("button", { name: /error messages/i }))
    await user.click(screen.getByRole("button", { name: /add row/i }))

    expect(screen.getByPlaceholderText("404")).toBeInTheDocument()
  })

  it("Error Messages rows are sent as error_messages map in payload", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([TOOL])
    vi.mocked(integrationToolsApi.create).mockResolvedValue(TOOL)
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))
    await waitFor(() => screen.getByText(/new tool/i))

    await user.type(screen.getByLabelText(/^name/i, { selector: "#tool-name" }), "my_tool")
    await user.type(screen.getByLabelText(/path/i, { selector: "#tool-path" }), "/endpoint")

    await user.click(screen.getByRole("button", { name: /error messages/i }))
    await user.click(screen.getByRole("button", { name: /add row/i }))

    const codeInput = screen.getByPlaceholderText("404") as HTMLInputElement
    const msgInput = screen.getByPlaceholderText(/that item/i) as HTMLInputElement
    await user.type(codeInput, "404")
    await user.type(msgInput, "Not found")

    await user.click(screen.getByRole("button", { name: /create tool/i }))

    await waitFor(() => {
      const call = vi.mocked(integrationToolsApi.create).mock.calls[0]?.[3]
      expect(call?.error_messages).toEqual({ "404": "Not found" })
    })
  })

  // ── Phase 12: Few-shot Examples section ───────────────────────────────────

  it("Examples section expands and shows Add example button", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))
    await waitFor(() => screen.getByText(/new tool/i))

    await user.click(screen.getByRole("button", { name: /few-shot examples/i }))
    expect(screen.getByRole("button", { name: /add example/i })).toBeInTheDocument()
  })

  it("Add example button is disabled after 5 examples", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))
    await waitFor(() => screen.getByText(/new tool/i))

    await user.click(screen.getByRole("button", { name: /few-shot examples/i }))
    const addBtn = screen.getByRole("button", { name: /add example/i })
    await user.click(addBtn)
    await user.click(addBtn)
    await user.click(addBtn)
    await user.click(addBtn)
    await user.click(addBtn)

    expect(screen.getByRole("button", { name: /max 5/i })).toBeDisabled()
  })

  it("tool_args JSON parse error shown inline", async () => {
    const user = userEvent.setup()
    vi.mocked(integrationsApi.list).mockResolvedValue([INTEGRATION])
    vi.mocked(integrationToolsApi.list).mockResolvedValue([])
    render(<IntegrationsTab agentId="agent-123" isAdmin />)
    await waitFor(() => screen.getByText("My Integration"))

    await user.click(screen.getByRole("button", { name: /manage my integration/i }))
    await waitFor(() => screen.getByRole("button", { name: /add tool/i }))
    await user.click(screen.getByRole("button", { name: /add tool/i }))
    await waitFor(() => screen.getByText(/new tool/i))

    await user.click(screen.getByRole("button", { name: /few-shot examples/i }))
    await user.click(screen.getByRole("button", { name: /add example/i }))

    const argsTextarea = screen.getByPlaceholderText(/order_id/i) as HTMLTextAreaElement
    await user.type(argsTextarea, "not valid json{{")
    argsTextarea.blur()

    await waitFor(() => expect(screen.getByText("Invalid JSON")).toBeInTheDocument())
  })
})
