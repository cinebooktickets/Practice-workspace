import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import ProfilePage from "@/app/dashboard/profile/page"

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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/api", () => ({
  profileApi: {
    update: vi.fn().mockResolvedValue({}),
  },
  ApiException: class ApiException extends Error {
    status: number
    code: string
    constructor(status: number, message: string, code = "unknown") {
      super(message)
      this.status = status
      this.code = code
    }
  },
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockGetAccessTokenSilently = vi.fn().mockResolvedValue("fake-token")

function renderWithAdminUser() {
  mockUseAuth.mockReturnValue({
    user: { id: "u1", name: "Vikram Singh", email: "vikram@test.com", role: "admin", org_id: "org1", picture: null, phone_number: null },
    accessToken: "fake-token",
    isLoading: false,
    isAuthenticated: true,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  })
  return render(<ProfilePage />)
}

function renderWithMemberUser() {
  mockUseAuth.mockReturnValue({
    user: { id: "u2", name: "Jane Doe", email: "jane@test.com", role: "viewer", org_id: "org1", picture: null, phone_number: "+1 555 000 0000" },
    accessToken: "fake-token",
    isLoading: false,
    isAuthenticated: true,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  })
  return render(<ProfilePage />)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAccessTokenSilently.mockResolvedValue("fake-token")
  })

  it("shows skeleton while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true, isAuthenticated: false, accessToken: null, getAccessTokenSilently: mockGetAccessTokenSilently })
    render(<ProfilePage />)
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("shows display name from auth user as read-only", async () => {
    renderWithAdminUser()
    await waitFor(() => {
      const input = screen.getByLabelText(/display name/i) as HTMLInputElement
      expect(input.value).toBe("Vikram Singh")
      expect(input).toBeDisabled()
    }, { timeout: 2000 })
  })

  it("shows email as read-only", () => {
    renderWithAdminUser()
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    expect(emailInput).toBeDisabled()
    expect(emailInput.value).toBe("vikram@test.com")
  })

  it("shows validation error for invalid phone number", async () => {
    const user = userEvent.setup()
    renderWithAdminUser()

    await waitFor(() => screen.getByLabelText(/phone/i), { timeout: 2000 })

    const phoneInput = screen.getByLabelText(/phone/i)
    await user.type(phoneInput, "not-a-phone")
    await user.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText("Enter a valid phone number")).toBeInTheDocument()
    })
  })

  it("shows success toast after save completes", async () => {
    const { toast } = await import("sonner")
    const user = userEvent.setup()
    renderWithAdminUser()

    await waitFor(() => screen.getByLabelText(/phone/i), { timeout: 2000 })

    await user.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Profile updated")
    }, { timeout: 2000 })
  })

  it("pre-fills phone number from auth user", async () => {
    renderWithMemberUser()
    await waitFor(() => {
      const input = screen.getByLabelText(/phone/i) as HTMLInputElement
      expect(input.value).toBe("+1 555 000 0000")
    }, { timeout: 2000 })
  })

  it("works correctly for viewer role (same form, no restrictions)", async () => {
    renderWithMemberUser()
    await waitFor(() => {
      const input = screen.getByLabelText(/display name/i) as HTMLInputElement
      expect(input.value).toBe("Jane Doe")
      expect(input).toBeDisabled()
    }, { timeout: 2000 })
  })
})
