import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import React from "react"
import DashboardPage from "@/app/dashboard/page"
import { agentsApi, creditsApi, handoffApi } from "@/lib/api"

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
  agentsApi:  { list: vi.fn() },
  creditsApi: { get:  vi.fn() },
  handoffApi: { list: vi.fn() },
  ApiException: class ApiException extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    user: { id: "u1", name: "Vikram Singh", email: "vikram@test.com", role: "admin", org_id: "org1" },
    isLoading: false,
    isAuthenticated: true,
    getAccessTokenSilently: vi.fn().mockResolvedValue("fake-token"),
  })
  // Default: resolve with empty data so loading=false after effects
  vi.mocked(agentsApi.list).mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 } as never)
  vi.mocked(creditsApi.get).mockResolvedValue({ org_id: "org1", credit_balance: 500, plan: "free", updated_at: "", recent_usage: [] } as never)
  vi.mocked(handoffApi.list).mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 } as never)
})

describe("Dashboard overview page", () => {
  it("shows skeleton stat cards while loading", () => {
    // Never-resolving API keeps loading=true so skeletons stay in DOM
    vi.mocked(agentsApi.list).mockImplementation(() => new Promise(() => {}))
    vi.mocked(creditsApi.get).mockImplementation(() => new Promise(() => {}))
    vi.mocked(handoffApi.list).mockImplementation(() => new Promise(() => {}))
    render(<DashboardPage />)
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("shows welcome message with user first name after loading", async () => {
    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText(/welcome back, vikram/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows stat card titles after loading", async () => {
    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText("Active Agents")).toBeInTheDocument()
      expect(screen.getByText("Credits Remaining")).toBeInTheDocument()
      expect(screen.getByText("Pending Handoffs")).toBeInTheDocument()
      expect(screen.getByText("Total Agents")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows empty state with create agent button when no agents", async () => {
    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText("No agents yet")).toBeInTheDocument()
      expect(screen.getByRole("link", { name: /create your first agent/i })).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows quick links section after loading", async () => {
    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText("Manage Agents")).toBeInTheDocument()
      expect(screen.getByText("Live Support Queue")).toBeInTheDocument()
      expect(screen.getByText("Usage & Credits")).toBeInTheDocument()
    }, { timeout: 2000 })
  })
})
