import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { FeedbackTab } from "@/app/dashboard/agents/[id]/_tabs/feedback-tab"
import { feedbackApi } from "@/lib/api"
import type { FeedbackItem } from "@/lib/api"

// ─── Mocks ────────────────────────────────────────────────────────────────────

const FEEDBACK_ITEMS: FeedbackItem[] = [
  {
    id: "fb-1",
    org_id: "org1",
    conversation_id: "conv-1",
    message_id: null,
    rating: "thumbs_up" as const,
    comment: "Very helpful!",
    status: "pending" as const,
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
  },
  {
    id: "fb-2",
    org_id: "org1",
    conversation_id: "conv-2",
    message_id: null,
    rating: "thumbs_down" as const,
    comment: null,
    status: "resolved" as const,
    resolved_by: "user-abc",
    resolved_at: "2026-05-02T09:00:00Z",
    resolution_note: "Issue was fixed",
    created_at: "2026-05-01T11:00:00Z",
    updated_at: "2026-05-02T09:00:00Z",
  },
]

vi.mock("@/lib/api", () => ({
  feedbackApi: {
    list:    vi.fn(),
    resolve: vi.fn(),
  },
  ApiException: class ApiException extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

vi.mock("@/context/auth", () => {
  const getAccessTokenSilently = () => Promise.resolve("fake-token")
  return { useAuth: () => ({ getAccessTokenSilently }) }
})

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("FeedbackTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(feedbackApi.list).mockResolvedValue({
      items: FEEDBACK_ITEMS,
      next_cursor: null,
      has_more: false,
    })
  })

  it("shows skeleton while loading", () => {
    render(<FeedbackTab agentId="agent-123" />)
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders feedback comment after loading", async () => {
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByText("Very helpful!")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows 'No comment' for feedback without a comment", async () => {
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByText("No comment")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows status badges", async () => {
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByText("pending")).toBeInTheDocument()
      expect(screen.getByText("resolved")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows Resolve and Dismiss buttons only for pending feedback", async () => {
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Very helpful!"), { timeout: 2000 })
    expect(screen.getByRole("button", { name: /resolve/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument()
  })

  it("does not show action buttons for non-pending feedback", async () => {
    vi.mocked(feedbackApi.list).mockResolvedValueOnce({
      items: [FEEDBACK_ITEMS[1]], // resolved item only
      next_cursor: null,
      has_more: false,
    })
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("No comment"), { timeout: 2000 })
    expect(screen.queryByRole("button", { name: /resolve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument()
  })

  it("opens resolve dialog when Resolve is clicked", async () => {
    const user = userEvent.setup()
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => screen.getByRole("button", { name: /resolve/i }), { timeout: 2000 })
    await user.click(screen.getByRole("button", { name: /resolve/i }))
    await waitFor(() => {
      expect(screen.getByText("Resolve feedback")).toBeInTheDocument()
    })
  })

  it("calls resolve API with 'resolved' status and shows toast", async () => {
    const user = userEvent.setup()
    vi.mocked(feedbackApi.resolve).mockResolvedValueOnce({
      ...FEEDBACK_ITEMS[0],
      status: "resolved",
    })
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => screen.getByRole("button", { name: /resolve/i }), { timeout: 2000 })
    await user.click(screen.getByRole("button", { name: /resolve/i }))
    await waitFor(() => screen.getByText("Resolve feedback"))
    await user.click(screen.getByRole("button", { name: /^resolve$/i }))
    await waitFor(() => {
      expect(feedbackApi.resolve).toHaveBeenCalledWith(
        "fake-token",
        "agent-123",
        "fb-1",
        { status: "resolved", resolution_note: null }
      )
    })
    const { toast } = await import("sonner")
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Feedback resolved")
    })
  })

  it("calls resolve API with 'dismissed' status when Dismiss is clicked", async () => {
    const user = userEvent.setup()
    vi.mocked(feedbackApi.resolve).mockResolvedValueOnce({
      ...FEEDBACK_ITEMS[0],
      status: "dismissed",
    })
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => screen.getByRole("button", { name: /dismiss/i }), { timeout: 2000 })
    await user.click(screen.getByRole("button", { name: /dismiss/i }))
    await waitFor(() => screen.getByText("Dismiss feedback"))
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }))
    await waitFor(() => {
      expect(feedbackApi.resolve).toHaveBeenCalledWith(
        "fake-token",
        "agent-123",
        "fb-1",
        { status: "dismissed", resolution_note: null }
      )
    })
  })

  it("shows empty state when no feedback", async () => {
    vi.mocked(feedbackApi.list).mockResolvedValueOnce({
      items: [],
      next_cursor: null,
      has_more: false,
    })
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByText("No feedback yet")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows error state and retry button on API failure", async () => {
    vi.mocked(feedbackApi.list).mockRejectedValueOnce(new Error("Network error"))
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows 'Load more' button when has_more is true", async () => {
    vi.mocked(feedbackApi.list).mockResolvedValueOnce({
      items: FEEDBACK_ITEMS,
      next_cursor: "cursor-xyz",
      has_more: true,
    })
    render(<FeedbackTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument()
    }, { timeout: 2000 })
  })
})
