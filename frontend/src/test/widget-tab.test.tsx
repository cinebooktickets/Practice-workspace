"use client"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { WidgetTab } from "@/app/dashboard/agents/[id]/_tabs/widget-tab"
import { agentsApi } from "@/lib/api"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  agentsApi: {
    get:    vi.fn(),
    update: vi.fn(),
  },
  ApiException: class ApiException extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

const mockUseAuth = vi.fn()

vi.mock("@/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const AGENT_DATA = {
  id: "agent-1",
  name: "Test Agent",
  widget_config: {
    color:             "#6366f1",
    position:          "bottom_right",
    avatar_url:        "",
    greeting:          "Hello! How can I help?",
    suggested_prompts: ["Track my order", "Return policy"],
    custom_css:        "",
    streaming_enabled: true,
  },
}

const getAccessTokenSilently = () => Promise.resolve("fake-token")

const adminAuth = {
  user: { id: "u1", name: "Vikram", email: "v@test.com", role: "admin" as const, org_id: "org1" },
  isLoading: false,
  isAuthenticated: true,
  getAccessTokenSilently,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WidgetTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(adminAuth)
    vi.mocked(agentsApi.get).mockResolvedValue(AGENT_DATA as never)
    vi.mocked(agentsApi.update).mockResolvedValue(AGENT_DATA as never)
  })

  it("shows skeletons while loading", () => {
    // Make get() never resolve so loading state persists
    vi.mocked(agentsApi.get).mockReturnValue(new Promise(() => {}))
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)
    const skeletons = document.querySelectorAll(".animate-pulse, [data-slot='skeleton']")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders Appearance section after load", async () => {
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)
    await waitFor(() => expect(screen.getByText("Appearance")).toBeInTheDocument())
  })

  it("renders Conversation section after load", async () => {
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)
    await waitFor(() => expect(screen.getByText("Conversation")).toBeInTheDocument())
  })

  it("shows greeting value from agent config", async () => {
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)
    await waitFor(() => {
      const input = screen.getByPlaceholderText("Hi! How can I help you today?") as HTMLInputElement
      expect(input.value).toBe("Hello! How can I help?")
    })
  })

  it("shows suggested prompts as chips", async () => {
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getAllByText("Track my order").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("Return policy").length).toBeGreaterThanOrEqual(1)
    })
  })

  it("renders live preview panel", async () => {
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByTestId("live-widget-preview")).toBeInTheDocument()
    })
  })

  it("live preview shows greeting text", async () => {
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)
    await waitFor(() => {
      const preview = screen.getByTestId("live-widget-preview")
      expect(within(preview).getByText("Hello! How can I help?")).toBeInTheDocument()
    })
  })

  it("live preview updates when greeting changes", async () => {
    const user = userEvent.setup()
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)

    await waitFor(() => screen.getByPlaceholderText("Hi! How can I help you today?"))

    const greetingInput = screen.getByPlaceholderText("Hi! How can I help you today?")
    await user.clear(greetingInput)
    await user.type(greetingInput, "New greeting!")

    const preview = screen.getByTestId("live-widget-preview")
    expect(within(preview).getByText("New greeting!")).toBeInTheDocument()
  })

  it("live preview shows suggested prompt chips", async () => {
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)
    await waitFor(() => {
      const preview = screen.getByTestId("live-widget-preview")
      expect(within(preview).getByText("Track my order")).toBeInTheDocument()
    })
  })

  it("calls agentsApi.update on save", async () => {
    const user = userEvent.setup()
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)

    await waitFor(() => screen.getByPlaceholderText("Hi! How can I help you today?"))

    // make a change to enable save
    const greetingInput = screen.getByPlaceholderText("Hi! How can I help you today?")
    await user.clear(greetingInput)
    await user.type(greetingInput, "Updated greeting")

    const saveBtn = screen.getByRole("button", { name: /save changes/i })
    await user.click(saveBtn)

    await waitFor(() => expect(vi.mocked(agentsApi.update)).toHaveBeenCalledOnce())
  })

  it("shows success toast after save", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    render(<WidgetTab agentId="agent-1" isAdmin={true} />)

    await waitFor(() => screen.getByPlaceholderText("Hi! How can I help you today?"))

    const greetingInput = screen.getByPlaceholderText("Hi! How can I help you today?")
    await user.clear(greetingInput)
    await user.type(greetingInput, "Changed")

    await user.click(screen.getByRole("button", { name: /save changes/i }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Widget configuration saved"))
  })

  it("Save Changes button is absent for non-admin", async () => {
    mockUseAuth.mockReturnValue({
      ...adminAuth,
      user: { ...adminAuth.user, role: "viewer" as const },
    })
    render(<WidgetTab agentId="agent-1" isAdmin={false} />)
    await waitFor(() => screen.getByText("Appearance"))
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument()
  })
})
