import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { ConfigTab } from "@/app/dashboard/agents/[id]/_tabs/config-tab"
import { agentsApi } from "@/lib/api"

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  agentsApi: {
    get:    vi.fn().mockResolvedValue({ id: "agent-123", name: "Test Agent", is_active: true, org_id: "org1", system_prompt: "", greeting: null, allowed_topics: [], blocked_topics: [], provider_type: null, widget_config: null, created_at: "", updated_at: "" }),
    update: vi.fn().mockResolvedValue({ id: "agent-123", name: "Test Agent", is_active: true, org_id: "org1", system_prompt: "You are a helpful support agent.", greeting: null, allowed_topics: [], blocked_topics: [], provider_type: null, widget_config: null, created_at: "", updated_at: "" }),
    list:   vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  ApiException: class ApiException extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderConfigTab(isAdmin = true) {
  return render(<ConfigTab agentId="agent-123" isAdmin={isAdmin} />)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Config tab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(agentsApi.get).mockResolvedValue({ id: "agent-123", name: "Test Agent", is_active: true, org_id: "org1", system_prompt: "", greeting: null, allowed_topics: [], blocked_topics: [], provider_type: null, widget_config: null, created_at: "", updated_at: "" })
    vi.mocked(agentsApi.update).mockResolvedValue({ id: "agent-123", name: "Test Agent", is_active: true, org_id: "org1", system_prompt: "You are a helpful support agent.", greeting: null, allowed_topics: [], blocked_topics: [], provider_type: null, widget_config: null, created_at: "", updated_at: "" })
  })

  it("shows skeleton while loading", () => {
    renderConfigTab()
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("shows system prompt textarea after loading", async () => {
    renderConfigTab()
    await waitFor(() => {
      expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("Save Changes button is disabled when form is unmodified", async () => {
    renderConfigTab()
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /save changes/i })
      expect(btn).toBeDisabled()
    }, { timeout: 2000 })
  })

  it("Save Changes button enables when system prompt is changed", async () => {
    const user = userEvent.setup()
    renderConfigTab()
    await waitFor(() => screen.getByLabelText(/system prompt/i), { timeout: 2000 })
    await user.type(screen.getByLabelText(/system prompt/i), "You are a helpful agent.")
    const btn = screen.getByRole("button", { name: /save changes/i })
    expect(btn).not.toBeDisabled()
  })

  it("shows validation error when system prompt is empty on save", async () => {
    const user = userEvent.setup()
    renderConfigTab()
    // Make it dirty without a real value — type then clear
    await waitFor(() => screen.getByLabelText(/system prompt/i), { timeout: 2000 })
    const textarea = screen.getByLabelText(/system prompt/i)
    await user.type(textarea, "x")
    await user.clear(textarea)
    await user.click(screen.getByRole("button", { name: /save changes/i }))
    expect(await screen.findByText("System prompt is required")).toBeInTheDocument()
  })

  it("shows success toast and disables save button after successful save", async () => {
    const user = userEvent.setup()
    renderConfigTab()
    await waitFor(() => screen.getByLabelText(/system prompt/i), { timeout: 2000 })
    await user.type(screen.getByLabelText(/system prompt/i), "You are a helpful support agent.")
    await user.click(screen.getByRole("button", { name: /save changes/i }))
    const { toast } = await import("sonner")
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Configuration saved")
    }, { timeout: 3000 })
    // After save, form is clean — button re-disables
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled()
    }, { timeout: 1000 })
  })

  it("shows 'Unsaved changes' label when form is dirty", async () => {
    const user = userEvent.setup()
    renderConfigTab()
    await waitFor(() => screen.getByLabelText(/system prompt/i), { timeout: 2000 })
    await user.type(screen.getByLabelText(/system prompt/i), "Draft prompt")
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
  })
})
