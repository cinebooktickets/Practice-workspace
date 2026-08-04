import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import AgentsPage from "@/app/dashboard/agents/page"
import { agentsApi } from "@/lib/api"

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn()

vi.mock("@/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/components/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/layout/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

vi.mock("@/lib/api", () => ({
  agentsApi: {
    list:   vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
    create: vi.fn().mockResolvedValue({ id: "a1", name: "Test", is_active: true, org_id: "org1", created_at: "", updated_at: "" }),
    get:    vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  ApiException: class ApiException extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// next/link stub
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderAsAdmin() {
  mockUseAuth.mockReturnValue({
    user: { id: "u1", name: "Vikram Singh", email: "vikram@test.com", role: "admin", org_id: "org1" },
    accessToken: "fake-token",
    isLoading: false,
    isAuthenticated: true,
    getAccessTokenSilently: vi.fn().mockResolvedValue("fake-token"),
  })
  return render(<AgentsPage />)
}

function renderAsMember() {
  mockUseAuth.mockReturnValue({
    user: { id: "u2", name: "Jane Doe", email: "jane@test.com", role: "viewer", org_id: "org1" },
    accessToken: "fake-token",
    isLoading: false,
    isAuthenticated: true,
    getAccessTokenSilently: vi.fn().mockResolvedValue("fake-token"),
  })
  return render(<AgentsPage />)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Agents list page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(agentsApi.list).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    vi.mocked(agentsApi.create).mockResolvedValue({ id: "a1", name: "Test", is_active: true, org_id: "org1", created_at: "", updated_at: "" })
  })

  it("shows skeleton cards while loading", () => {
    renderAsAdmin()
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("shows page heading", () => {
    renderAsAdmin()
    expect(screen.getByRole("heading", { name: /agents/i })).toBeInTheDocument()
  })

  it("shows empty state with CTA after loading", async () => {
    renderAsAdmin()
    await waitFor(() => {
      expect(screen.getByText("No agents yet")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /create your first agent/i })).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("Create Agent button is enabled for admin", async () => {
    renderAsAdmin()
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /new agent/i })
      expect(btn).not.toBeDisabled()
    }, { timeout: 2000 })
  })

  it("Create Agent button is disabled for member", async () => {
    renderAsMember()
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /new agent/i })
      expect(btn).toBeDisabled()
    }, { timeout: 2000 })
  })

  it("opens create dialog when New Agent is clicked", async () => {
    const user = userEvent.setup()
    renderAsAdmin()
    await waitFor(() => screen.getByRole("button", { name: /new agent/i }), { timeout: 2000 })
    await user.click(screen.getByRole("button", { name: /new agent/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Create Agent" })).toBeInTheDocument()
  })

  it("shows validation error when name is empty on create", async () => {
    const user = userEvent.setup()
    renderAsAdmin()
    await waitFor(() => screen.getByRole("button", { name: /new agent/i }), { timeout: 2000 })
    await user.click(screen.getByRole("button", { name: /new agent/i }))
    // Click Create Agent inside dialog
    const createBtns = screen.getAllByRole("button", { name: /create agent/i })
    await user.click(createBtns[createBtns.length - 1])
    expect(await screen.findByText("Agent name is required")).toBeInTheDocument()
  })

  it("closes create dialog and clears form on cancel", async () => {
    const user = userEvent.setup()
    renderAsAdmin()
    await waitFor(() => screen.getByRole("button", { name: /new agent/i }), { timeout: 2000 })
    await user.click(screen.getByRole("button", { name: /new agent/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    }, { timeout: 1000 })
  })
})
