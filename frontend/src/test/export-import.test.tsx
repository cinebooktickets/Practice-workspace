import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import AgentsPage from "@/app/dashboard/agents/page"
import { ConfigTab } from "@/app/dashboard/agents/[id]/_tabs/config-tab"
import { agentsApi, agentExportImportApi } from "@/lib/api"
import { toast } from "sonner"

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/context/auth", () => {
  const getAccessTokenSilently = () => Promise.resolve("fake-token")
  const authValue = {
    user: { id: "u1", name: "Vikram Singh", email: "vikram@test.com", role: "admin", org_id: "org1" },
    accessToken: "fake-token",
    isLoading: false,
    isAuthenticated: true,
    getAccessTokenSilently,
  }
  return { useAuth: () => authValue }
})

vi.mock("@/components/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/layout/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

const mockBundle = {
  name: "Exported Agent",
  is_active: true,
  system_prompt: "You are helpful.",
  greeting: null,
  allowed_topics: null,
  blocked_topics: null,
  provider_type: null,
  widget_config: null,
}

const mockExportResponse = {
  agent_id: "agent-123",
  exported_at: "2026-05-12T00:00:00Z",
  bundle: mockBundle,
}

const mockImportedAgent = {
  id: "agent-new",
  name: "Exported Agent",
  is_active: true,
  org_id: "org1",
  created_at: "2026-05-12T00:00:00Z",
  updated_at: "2026-05-12T00:00:00Z",
}

vi.mock("@/lib/api", () => ({
  agentsApi: {
    list:   vi.fn().mockResolvedValue({ items: [], total: 0 }),
    create: vi.fn(),
    get:    vi.fn().mockResolvedValue({ id: "agent-123", name: "Test Agent", is_active: true, org_id: "org1", system_prompt: "Hello", greeting: null, allowed_topics: [], blocked_topics: [], provider_type: null, widget_config: null, created_at: "", updated_at: "" }),
    update: vi.fn(),
    delete: vi.fn(),
  },
  agentExportImportApi: {
    exportAgent: vi.fn(),
    importAgent: vi.fn(),
  },
  ApiException: class ApiException extends Error {
    status: number
    constructor(status: number, message: string) { super(message); this.status = status }
  },
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

// ─── Export button (ConfigTab) ────────────────────────────────────────────────

describe("ConfigTab — Export Agent button", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(agentExportImportApi.exportAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockExportResponse)
  })

  it("renders Export Agent button", async () => {
    render(<ConfigTab agentId="agent-123" isAdmin={true} />)
    await waitFor(() => expect(screen.queryByText("Loading")).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: /export agent/i })).toBeInTheDocument()
  })

  it("calls exportAgent and shows success toast on click", async () => {
    const user = userEvent.setup()

    // Mock URL.createObjectURL and HTMLAnchorElement.click
    const createObjectURL = vi.fn().mockReturnValue("blob:fake")
    const revokeObjectURL = vi.fn()
    const clickSpy = vi.fn()
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, writable: true })
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, writable: true })
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === "a") { vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(clickSpy) }
      return el
    })

    render(<ConfigTab agentId="agent-123" isAdmin={true} />)
    await waitFor(() => expect(screen.getByRole("button", { name: /export agent/i })).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /export agent/i }))

    await waitFor(() => {
      expect(agentExportImportApi.exportAgent).toHaveBeenCalledWith("fake-token", "agent-123")
      expect(toast.success).toHaveBeenCalledWith("Agent exported successfully")
    })

    vi.restoreAllMocks()
  })

  it("shows error toast when exportAgent fails", async () => {
    const { ApiException } = await import("@/lib/api")
    ;(agentExportImportApi.exportAgent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiException(500, "Export failed")
    )
    const user = userEvent.setup()

    render(<ConfigTab agentId="agent-123" isAdmin={true} />)
    await waitFor(() => expect(screen.getByRole("button", { name: /export agent/i })).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /export agent/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Export failed"))
  })
})

// ─── Import dialog (AgentsPage) ───────────────────────────────────────────────

describe("AgentsPage — Import Agent dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], total: 0 })
    ;(agentExportImportApi.importAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockImportedAgent)
  })

  it("renders Import Agent button for admins", async () => {
    render(<AgentsPage />)
    await waitFor(() => expect(screen.getByRole("button", { name: /import agent/i })).toBeInTheDocument())
  })

  it("opens import dialog on button click", async () => {
    const user = userEvent.setup()
    render(<AgentsPage />)
    await waitFor(() => screen.getByRole("button", { name: /import agent/i }))
    await user.click(screen.getByRole("button", { name: /import agent/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(/upload a/i)).toBeInTheDocument()
  })

  it("shows validation error if confirmed with no file", async () => {
    const user = userEvent.setup()
    render(<AgentsPage />)
    await waitFor(() => screen.getByRole("button", { name: /import agent/i }))
    await user.click(screen.getByRole("button", { name: /import agent/i }))

    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /import agent/i }))

    expect(await screen.findByText(/please select a json file/i)).toBeInTheDocument()
    expect(agentExportImportApi.importAgent).not.toHaveBeenCalled()
  })

  it("shows error for malformed JSON", async () => {
    const user = userEvent.setup()
    render(<AgentsPage />)
    await waitFor(() => screen.getByRole("button", { name: /import agent/i }))
    await user.click(screen.getByRole("button", { name: /import agent/i }))

    const badFile = new File(["{not valid json"], "bad.json", { type: "application/json" })
    const fileInput = screen.getByLabelText(/agent export file/i)
    Object.defineProperty(fileInput, "files", { value: [badFile], configurable: true })
    fireEvent.change(fileInput)

    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /import agent/i }))

    expect(await screen.findByText(/invalid json/i)).toBeInTheDocument()
    expect(agentExportImportApi.importAgent).not.toHaveBeenCalled()
  })

  it("shows error for JSON that is not a valid bundle", async () => {
    const user = userEvent.setup()
    render(<AgentsPage />)
    await waitFor(() => screen.getByRole("button", { name: /import agent/i }))
    await user.click(screen.getByRole("button", { name: /import agent/i }))

    const badBundle = new File([JSON.stringify({ foo: "bar" })], "bad.json", { type: "application/json" })
    const fileInput = screen.getByLabelText(/agent export file/i)
    Object.defineProperty(fileInput, "files", { value: [badBundle], configurable: true })
    fireEvent.change(fileInput)

    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /import agent/i }))

    expect(await screen.findByText(/does not appear to be a valid agent export bundle/i)).toBeInTheDocument()
  })

  it("calls importAgent, shows success toast, and adds agent to list", async () => {
    const user = userEvent.setup()
    render(<AgentsPage />)
    await waitFor(() => screen.getByRole("button", { name: /import agent/i }))
    await user.click(screen.getByRole("button", { name: /import agent/i }))

    const validFile = new File([JSON.stringify(mockExportResponse)], "export.json", { type: "application/json" })
    const fileInput = screen.getByLabelText(/agent export file/i)
    Object.defineProperty(fileInput, "files", { value: [validFile], configurable: true })
    fireEvent.change(fileInput)

    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /import agent/i }))

    await waitFor(() => {
      expect(agentExportImportApi.importAgent).toHaveBeenCalledWith("fake-token", { bundle: mockBundle })
      expect(toast.success).toHaveBeenCalledWith(`Agent "${mockImportedAgent.name}" imported successfully`)
    })

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("shows error toast when importAgent fails", async () => {
    const { ApiException } = await import("@/lib/api")
    ;(agentExportImportApi.importAgent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiException(400, "Import failed: invalid bundle")
    )
    const user = userEvent.setup()
    render(<AgentsPage />)
    await waitFor(() => screen.getByRole("button", { name: /import agent/i }))
    await user.click(screen.getByRole("button", { name: /import agent/i }))

    const validFile = new File([JSON.stringify(mockExportResponse)], "export.json", { type: "application/json" })
    const fileInput = screen.getByLabelText(/agent export file/i)
    Object.defineProperty(fileInput, "files", { value: [validFile], configurable: true })
    fireEvent.change(fileInput)

    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /import agent/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Import failed: invalid bundle"))
  })
})
