import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import SettingsPage from "@/app/dashboard/settings/page"
import { llmSettingsApi, embeddingSettingsApi, alertConfigApi, reportScheduleApi } from "@/lib/api"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter:       () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: (key: string) => key === "tab" ? "ai-models" : null }),
}))

vi.mock("@/components/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/layout/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

vi.mock("@/lib/api", () => ({
  llmSettingsApi: {
    get:    vi.fn(),
    update: vi.fn(),
  },
  embeddingSettingsApi: {
    get:    vi.fn(),
    update: vi.fn(),
  },
  alertConfigApi:    { get: vi.fn(), update: vi.fn(), test: vi.fn() },
  reportScheduleApi: { get: vi.fn(), update: vi.fn() },
  gdprApi:           { exportData: vi.fn(), deleteData: vi.fn() },
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

const LLM_DATA = {
  provider: "openai",
  model:    "gpt-4o",
  api_key:  "***",
  base_url: null,
  extra:    null,
}

const EMB_DATA = {
  provider: "openai",
  model:    "text-embedding-3-small",
  api_key:  "***",
  base_url: null,
  extra:    null,
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

describe("Settings AI Models tab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(adminAuth)
    vi.mocked(llmSettingsApi.get).mockResolvedValue(LLM_DATA)
    vi.mocked(embeddingSettingsApi.get).mockResolvedValue(EMB_DATA)
    vi.mocked(llmSettingsApi.update).mockResolvedValue({ ...LLM_DATA })
    vi.mocked(embeddingSettingsApi.update).mockResolvedValue(EMB_DATA)
    vi.mocked(alertConfigApi.get).mockResolvedValue(null as unknown as never)
    vi.mocked(reportScheduleApi.get).mockResolvedValue(null as unknown as never)
  })

  it("shows skeleton while loading", () => {
    render(<SettingsPage />)
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders LLM provider and model after loading", async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      // Provider uses shadcn Select (Radix) — check visible trigger text rather than displayValue
      expect(screen.getAllByText(/OpenAI/i).length).toBeGreaterThan(0)
      expect(screen.getByDisplayValue("gpt-4o")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("renders Embedding model after loading", async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByDisplayValue("text-embedding-3-small")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows both LLM and Embedding section headings", async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByText("LLM")).toBeInTheDocument()
      expect(screen.getByText("Embedding")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("calls llmSettingsApi.update when LLM Save is clicked", async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await waitFor(() => screen.getByDisplayValue("gpt-4o"), { timeout: 2000 })

    const saveButtons = screen.getAllByRole("button", { name: /^save$/i })
    await user.click(saveButtons[0])

    await waitFor(() => {
      expect(llmSettingsApi.update).toHaveBeenCalledWith(
        "fake-token",
        expect.objectContaining({ provider: "openai", model: "gpt-4o" })
      )
    }, { timeout: 2000 })
  })

  it("calls embeddingSettingsApi.update when Embedding Save is clicked", async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await waitFor(() => screen.getByDisplayValue("text-embedding-3-small"), { timeout: 2000 })

    const saveButtons = screen.getAllByRole("button", { name: /^save$/i })
    await user.click(saveButtons[1])

    await waitFor(() => {
      expect(embeddingSettingsApi.update).toHaveBeenCalledWith(
        "fake-token",
        expect.objectContaining({ provider: "openai", model: "text-embedding-3-small" })
      )
    }, { timeout: 2000 })
  })

  it("shows success toast after LLM save", async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await waitFor(() => screen.getByDisplayValue("gpt-4o"), { timeout: 2000 })

    const saveButtons = screen.getAllByRole("button", { name: /^save$/i })
    await user.click(saveButtons[0])

    const { toast } = await import("sonner")
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("LLM settings saved")
    }, { timeout: 2000 })
  })

  it("shows admin access required for non-admin users", async () => {
    mockUseAuth.mockReturnValue(viewerAuth)
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByText(/admin access required/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })
})
