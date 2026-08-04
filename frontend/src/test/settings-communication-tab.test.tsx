import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import SettingsPage from "@/app/dashboard/settings/page"
import { communicationApi, alertConfigApi, reportScheduleApi, llmSettingsApi, embeddingSettingsApi } from "@/lib/api"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter:       () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: (key: string) => key === "tab" ? "communication" : null }),
}))

vi.mock("@/components/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/layout/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

vi.mock("@/lib/api", () => ({
  communicationApi: {
    getSMTP:      vi.fn(),
    updateSMTP:   vi.fn(),
    getTwilio:    vi.fn(),
    updateTwilio: vi.fn(),
  },
  llmSettingsApi:       { get: vi.fn(), update: vi.fn() },
  embeddingSettingsApi: { get: vi.fn(), update: vi.fn() },
  alertConfigApi:       { get: vi.fn(), update: vi.fn(), test: vi.fn() },
  reportScheduleApi:    { get: vi.fn(), update: vi.fn() },
  gdprApi:              { exportData: vi.fn(), deleteData: vi.fn() },
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

const SMTP_DATA = {
  host:         "smtp.example.com",
  port:         587,
  username:     "user@example.com",
  password:     "***",
  use_tls:      true,
  from_address: "noreply@example.com",
}

const TWILIO_DATA = {
  account_sid:  "ACabc123",
  auth_token:   "***",
  from_number:  "+15550001234",
}

const getAccessTokenSilently = () => Promise.resolve("fake-token")

const adminAuth = {
  user: { id: "u1", name: "Vikram", email: "v@test.com", role: "admin" as const, org_id: "org1" },
  isLoading: false,
  isAuthenticated: true,
  getAccessTokenSilently,
}

const viewerAuth = {
  user: { id: "u2", name: "Member", email: "m@test.com", role: "viewer" as const, org_id: "org1" },
  isLoading: false,
  isAuthenticated: true,
  getAccessTokenSilently,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Settings Communication tab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(adminAuth)
    vi.mocked(communicationApi.getSMTP).mockResolvedValue(SMTP_DATA)
    vi.mocked(communicationApi.getTwilio).mockResolvedValue(TWILIO_DATA)
    vi.mocked(communicationApi.updateSMTP).mockResolvedValue({ ...SMTP_DATA })
    vi.mocked(communicationApi.updateTwilio).mockResolvedValue({ ...TWILIO_DATA })
    vi.mocked(llmSettingsApi.get).mockResolvedValue(null as unknown as never)
    vi.mocked(embeddingSettingsApi.get).mockResolvedValue(null as unknown as never)
    vi.mocked(alertConfigApi.get).mockResolvedValue(null as unknown as never)
    vi.mocked(reportScheduleApi.get).mockResolvedValue(null as unknown as never)
  })

  it("shows skeleton while loading", () => {
    render(<SettingsPage />)
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders SMTP section headings", async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByText("SMTP")).toBeInTheDocument()
      expect(screen.getByText("Twilio")).toBeInTheDocument()
    })
  })

  it("renders Communication card heading", async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      // tab trigger + card title both contain "Communication" — assert at least 2 instances
      const matches = screen.getAllByText("Communication")
      expect(matches.length).toBeGreaterThanOrEqual(2)
    })
  })

  it("populates SMTP form fields with loaded data", async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByDisplayValue("smtp.example.com")).toBeInTheDocument()
      expect(screen.getByDisplayValue("587")).toBeInTheDocument()
      expect(screen.getByDisplayValue("noreply@example.com")).toBeInTheDocument()
    })
  })

  it("populates Twilio account_sid with loaded data", async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByDisplayValue("ACabc123")).toBeInTheDocument()
      expect(screen.getByDisplayValue("+15550001234")).toBeInTheDocument()
    })
  })

  it("calls communicationApi.updateSMTP on Save SMTP click", async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await waitFor(() => screen.getByDisplayValue("smtp.example.com"))

    const saveSMTPBtn = screen.getByRole("button", { name: /save smtp/i })
    await user.click(saveSMTPBtn)

    await waitFor(() => {
      expect(vi.mocked(communicationApi.updateSMTP)).toHaveBeenCalledWith(
        "fake-token",
        expect.objectContaining({ host: "smtp.example.com", from_address: "noreply@example.com" })
      )
    })
  })

  it("calls communicationApi.updateTwilio on Save Twilio click", async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await waitFor(() => screen.getByDisplayValue("ACabc123"))

    const saveTwilioBtn = screen.getByRole("button", { name: /save twilio/i })
    await user.click(saveTwilioBtn)

    await waitFor(() => {
      expect(vi.mocked(communicationApi.updateTwilio)).toHaveBeenCalledWith(
        "fake-token",
        expect.objectContaining({ account_sid: "ACabc123", from_number: "+15550001234" })
      )
    })
  })

  it("shows success toast after saving SMTP", async () => {
    const { toast } = await import("sonner")
    const user = userEvent.setup()
    render(<SettingsPage />)
    await waitFor(() => screen.getByDisplayValue("smtp.example.com"))

    await user.click(screen.getByRole("button", { name: /save smtp/i }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("SMTP settings saved")
    })
  })

  it("shows admin-required block for non-admin user", async () => {
    mockUseAuth.mockReturnValue(viewerAuth)
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByText("Admin access required")).toBeInTheDocument()
    })
  })
})
