import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useAuth } from "@/context/auth"
import { handoffApi, ApiException, HandoffItem, HandoffMessageItem } from "@/lib/api"
import { toast } from "sonner"
import LiveSupportPage from "./page"

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/context/auth", () => ({ useAuth: vi.fn() }))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    handoffApi: {
      list:       vi.fn(),
      claim:      vi.fn(),
      reply:      vi.fn(),
      resolve:    vi.fn(),
      messages:   vi.fn(),
      getTyping:  vi.fn(),
      setTyping:  vi.fn(),
    },
  }
})

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// render children only — avoids Auth0/router context requirements
vi.mock("@/components/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("@/components/layout/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ─── Factories ────────────────────────────────────────────────────────────────

function makeItem(overrides?: Partial<HandoffItem>): HandoffItem {
  return {
    id:                   "h1",
    org_id:               "org1",
    agent_id:             "agent-abc",
    user_id:              null,
    assigned_to:          null,
    handoff_requested_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    title:                "Test conversation",
    status:               "handoff",
    created_at:           new Date().toISOString(),
    updated_at:           new Date().toISOString(),
    ...overrides,
  }
}

function makeMessage(overrides?: Partial<HandoffMessageItem>): HandoffMessageItem {
  return {
    id:              "msg1",
    conversation_id: "h1",
    role:            "user",
    content:         "Hello there",
    citations:       [],
    created_at:      new Date().toISOString(),
    ...overrides,
  }
}

const emptyList = { items: [], next_cursor: null, has_more: false }

// ─── Default mock wiring ──────────────────────────────────────────────────────

beforeEach(() => {
  // jsdom does not implement scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = vi.fn()

  vi.mocked(useAuth).mockReturnValue({
    getAccessTokenSilently: vi.fn().mockResolvedValue("test-token"),
  } as any)

  vi.mocked(handoffApi.list).mockResolvedValue(emptyList)
  vi.mocked(handoffApi.claim).mockResolvedValue(makeItem({ assigned_to: "user1" }))
  vi.mocked(handoffApi.reply).mockResolvedValue({ message_id: "m1", conversation_id: "h1" })
  vi.mocked(handoffApi.resolve).mockResolvedValue({ conversation_id: "h1", status: "closed" })
  vi.mocked(handoffApi.messages).mockResolvedValue({
    conversation_id: "h1", conversation_status: "handoff", assigned_to: null, items: [],
  })
  vi.mocked(handoffApi.getTyping).mockResolvedValue({ conversation_id: "h1", is_typing: false, expires_at: null })
  vi.mocked(handoffApi.setTyping).mockResolvedValue({ conversation_id: "h1", is_typing: true, expires_at: null })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

// ─── formatWaitTime (tested via rendered PendingRow) ─────────────────────────

describe("formatWaitTime", () => {
  it("nullInput_rendersEmDash", async () => {
    const item = makeItem({ handoff_requested_at: null })
    vi.mocked(handoffApi.list).mockResolvedValue({ items: [item], next_cursor: null, has_more: false })

    render(<LiveSupportPage />)

    await waitFor(() => expect(screen.queryAllByRole("row").length).toBeGreaterThan(1))
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("lessThanOneMinute_rendersLessThan1Min", async () => {
    const item = makeItem({ handoff_requested_at: new Date(Date.now() - 30_000).toISOString() })
    vi.mocked(handoffApi.list).mockResolvedValue({ items: [item], next_cursor: null, has_more: false })

    render(<LiveSupportPage />)

    await waitFor(() => expect(screen.getByText("< 1 min")).toBeInTheDocument())
  })

  it("fiveMinutes_renders5min", async () => {
    const item = makeItem({ handoff_requested_at: new Date(Date.now() - 5 * 60_000).toISOString() })
    vi.mocked(handoffApi.list).mockResolvedValue({ items: [item], next_cursor: null, has_more: false })

    render(<LiveSupportPage />)

    await waitFor(() => expect(screen.getByText("5 min")).toBeInTheDocument())
  })

  it("over60Minutes_rendersHoursAndMinutes", async () => {
    const item = makeItem({ handoff_requested_at: new Date(Date.now() - 61 * 60_000).toISOString() })
    vi.mocked(handoffApi.list).mockResolvedValue({ items: [item], next_cursor: null, has_more: false })

    render(<LiveSupportPage />)

    await waitFor(() => expect(screen.getByText("1h 1m")).toBeInTheDocument())
  })
})

// ─── LiveSupportPage — initial load ──────────────────────────────────────────

describe("LiveSupportPage — initial load", () => {
  it("onMount_callsAllThreeListEndpoints", async () => {
    render(<LiveSupportPage />)
    await waitFor(() => expect(handoffApi.list).toHaveBeenCalledTimes(3))
  })

  it("emptyQueues_showsEmptyStateInPendingTab", async () => {
    render(<LiveSupportPage />)
    await waitFor(() => expect(handoffApi.list).toHaveBeenCalled())
    // default tab is "Pending"
    expect(await screen.findByText(/no conversations/i)).toBeInTheDocument()
  })

  it("pendingItem_rendersInPendingTab", async () => {
    vi.mocked(handoffApi.list).mockResolvedValue({
      items: [makeItem({ title: "Support needed" })], next_cursor: null, has_more: false,
    })

    render(<LiveSupportPage />)

    expect(await screen.findByText("Support needed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /claim/i })).toBeInTheDocument()
  })

  it("pendingItem_showsCountBadgeOnTab", async () => {
    vi.mocked(handoffApi.list).mockResolvedValue({
      items: [makeItem()], next_cursor: null, has_more: false,
    })

    render(<LiveSupportPage />)

    // badge shows count next to the "Pending" tab trigger
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument())
  })
})

// ─── LiveSupportPage — error states ──────────────────────────────────────────

describe("LiveSupportPage — error states", () => {
  it("pendingFetchFails_showsErrorTextAndRetryButton", async () => {
    vi.mocked(handoffApi.list).mockRejectedValue(new ApiException(500, "Server error", "server_error"))

    render(<LiveSupportPage />)

    expect(await screen.findByText("Server error")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })

  it("retryButton_refetchesPendingQueue", async () => {
    const user = userEvent.setup()
    vi.mocked(handoffApi.list)
      .mockRejectedValueOnce(new ApiException(500, "Server error", "server_error"))
      .mockRejectedValueOnce(new ApiException(500, "Server error", "server_error"))
      .mockRejectedValueOnce(new ApiException(500, "Server error", "server_error"))
      .mockResolvedValue(emptyList)

    render(<LiveSupportPage />)

    const retryBtn = await screen.findByRole("button", { name: /retry/i })
    await user.click(retryBtn)

    await waitFor(() => expect(handoffApi.list).toHaveBeenCalledTimes(4))
  })
})

// ─── LiveSupportPage — claim ──────────────────────────────────────────────────

describe("LiveSupportPage — claim", () => {
  it("claimButton_callsHandoffApiClaim", async () => {
    const user = userEvent.setup()
    vi.mocked(handoffApi.list).mockResolvedValue({
      items: [makeItem({ id: "h1", title: "Needs help" })], next_cursor: null, has_more: false,
    })

    render(<LiveSupportPage />)

    await user.click(await screen.findByRole("button", { name: /^claim$/i }))

    await waitFor(() => expect(handoffApi.claim).toHaveBeenCalledWith("test-token", "h1"))
  })

  it("claimSuccess_showsToastAndRefreshesQueues", async () => {
    const user = userEvent.setup()
    vi.mocked(handoffApi.list).mockResolvedValue({
      items: [makeItem()], next_cursor: null, has_more: false,
    })

    render(<LiveSupportPage />)

    await user.click(await screen.findByRole("button", { name: /^claim$/i }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Conversation claimed"))
    // list re-fetched for pending + in-progress after claim
    await waitFor(() => expect(handoffApi.list).toHaveBeenCalledTimes(5))
  })

  it("claimFails_showsErrorToast", async () => {
    const user = userEvent.setup()
    vi.mocked(handoffApi.list).mockResolvedValue({
      items: [makeItem()], next_cursor: null, has_more: false,
    })
    vi.mocked(handoffApi.claim).mockRejectedValue(new ApiException(409, "Already claimed", "already_claimed"))

    render(<LiveSupportPage />)

    await user.click(await screen.findByRole("button", { name: /^claim$/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Already claimed"))
  })
})

// ─── LiveSupportPage — refresh ────────────────────────────────────────────────

describe("LiveSupportPage — refresh", () => {
  it("refreshButton_callsAllThreeListEndpoints", async () => {
    const user = userEvent.setup()
    render(<LiveSupportPage />)

    await waitFor(() => expect(handoffApi.list).toHaveBeenCalledTimes(3))

    await user.click(screen.getByRole("button", { name: /refresh/i }))

    await waitFor(() => expect(handoffApi.list).toHaveBeenCalledTimes(6))
  })
})

// ─── ReplyDialog ──────────────────────────────────────────────────────────────

describe("ReplyDialog", () => {
  async function openReplyDialog() {
    const user = userEvent.setup()
    const inProgressItem = makeItem({ id: "h1", title: "Live chat", assigned_to: "user1" })

    // list(unclaimed_only: false) → in-progress item; others empty
    vi.mocked(handoffApi.list).mockImplementation((_token, params) => {
      if (params?.status === "closed") return Promise.resolve(emptyList)
      if (params?.unclaimed_only) return Promise.resolve(emptyList)
      return Promise.resolve({ items: [inProgressItem], next_cursor: null, has_more: false })
    })
    vi.mocked(handoffApi.messages).mockResolvedValue({
      conversation_id: "h1", conversation_status: "handoff", assigned_to: "user1",
      items: [makeMessage({ content: "Need help!", role: "user" })],
    })

    render(<LiveSupportPage />)

    // switch to In Progress tab
    await user.click(await screen.findByRole("tab", { name: /in progress/i }))
    await user.click(await screen.findByRole("button", { name: /reply/i }))

    return user
  }

  it("opens_andLoadsMessageHistory", async () => {
    await openReplyDialog()
    await waitFor(() => expect(screen.getByText("Need help!")).toBeInTheDocument())
  })

  it("sendButton_disabledWhenContentEmpty", async () => {
    await openReplyDialog()
    await waitFor(() => screen.getByRole("dialog"))
    expect(screen.getByRole("button", { name: /send reply/i })).toBeDisabled()
  })

  it("sendReply_callsHandoffApiReplyAndShowsToast", async () => {
    const user = await openReplyDialog()
    await waitFor(() => screen.getByRole("dialog"))

    await user.type(screen.getByLabelText(/your reply/i), "Hello visitor!")
    await user.click(screen.getByRole("button", { name: /send reply/i }))

    await waitFor(() => expect(handoffApi.reply).toHaveBeenCalledWith("test-token", "h1", { content: "Hello visitor!" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Reply sent"))
  })

  it("sendReply_optimisticMessageAppearsImmediately", async () => {
    // reply takes time — we check before it resolves
    let resolveReply!: () => void
    vi.mocked(handoffApi.reply).mockReturnValue(
      new Promise((res) => { resolveReply = () => res({ message_id: "m2", conversation_id: "h1" }) })
    )

    const user = await openReplyDialog()
    await waitFor(() => screen.getByRole("dialog"))

    await user.type(screen.getByLabelText(/your reply/i), "Optimistic message")
    await user.click(screen.getByRole("button", { name: /send reply/i }))

    // optimistic entry visible before server responds
    expect(await screen.findByText("Optimistic message")).toBeInTheDocument()

    resolveReply()
  })

  it("pollMerge_removesOptimisticAndKeepsRealMessages", async () => {
    // shouldAdvanceTime keeps waitFor polling alive while allowing manual timer jumps
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    const inProgressItem = makeItem({ id: "h1", title: "Live chat", assigned_to: "user1" })
    vi.mocked(handoffApi.list).mockImplementation((_token, params) => {
      if (params?.status === "closed") return Promise.resolve(emptyList)
      if (params?.unclaimed_only) return Promise.resolve(emptyList)
      return Promise.resolve({ items: [inProgressItem], next_cursor: null, has_more: false })
    })
    vi.mocked(handoffApi.messages).mockResolvedValue({
      conversation_id: "h1", conversation_status: "handoff", assigned_to: "user1",
      items: [makeMessage({ content: "Need help!", role: "user" })],
    })
    render(<LiveSupportPage />)
    await user.click(await screen.findByRole("tab", { name: /in progress/i }))
    await user.click(await screen.findByRole("button", { name: /reply/i }))
    await waitFor(() => screen.getByRole("dialog"))

    // send reply → optimistic appended
    vi.mocked(handoffApi.reply).mockResolvedValue({ message_id: "real-id", conversation_id: "h1" })
    await user.type(screen.getByLabelText(/your reply/i), "Optimistic reply")
    await user.click(screen.getByRole("button", { name: /send reply/i }))
    await waitFor(() => screen.getByText("Optimistic reply"))

    // poll fires — server returns the real version of the reply (no optimistic-)
    vi.mocked(handoffApi.messages).mockResolvedValue({
      conversation_id: "h1", conversation_status: "handoff", assigned_to: "user1",
      items: [
        makeMessage({ content: "Need help!", role: "user" }),
        makeMessage({ id: "real-id", content: "Optimistic reply", role: "assistant" }),
      ],
    })
    await vi.advanceTimersByTimeAsync(3000)

    // only one copy of the message — no duplicate
    await waitFor(() => {
      const msgs = screen.queryAllByText("Optimistic reply")
      expect(msgs).toHaveLength(1)
    })
  })

  it("visitorTyping_showsTypingIndicator", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(handoffApi.getTyping).mockResolvedValue({ conversation_id: "h1", is_typing: true, expires_at: null })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    const inProgressItem = makeItem({ id: "h1", title: "Live chat", assigned_to: "user1" })
    vi.mocked(handoffApi.list).mockImplementation((_token, params) => {
      if (params?.status === "closed") return Promise.resolve(emptyList)
      if (params?.unclaimed_only) return Promise.resolve(emptyList)
      return Promise.resolve({ items: [inProgressItem], next_cursor: null, has_more: false })
    })
    vi.mocked(handoffApi.messages).mockResolvedValue({
      conversation_id: "h1", conversation_status: "handoff", assigned_to: "user1", items: [],
    })
    render(<LiveSupportPage />)
    await user.click(await screen.findByRole("tab", { name: /in progress/i }))
    await user.click(await screen.findByRole("button", { name: /reply/i }))
    await waitFor(() => screen.getByRole("dialog"))
    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => expect(screen.getByText(/visitor is typing/i)).toBeInTheDocument())
  })

  it("sendFails_showsErrorToast", async () => {
    vi.mocked(handoffApi.reply).mockRejectedValue(new ApiException(400, "Cannot reply", "bad_request"))

    const user = await openReplyDialog()
    await waitFor(() => screen.getByRole("dialog"))

    await user.type(screen.getByLabelText(/your reply/i), "Hello")
    await user.click(screen.getByRole("button", { name: /send reply/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Cannot reply"))
  })
})

// ─── ResolveDialog ────────────────────────────────────────────────────────────

describe("ResolveDialog", () => {
  async function openResolveDialog() {
    const user = userEvent.setup()
    const item = makeItem({ id: "h1", title: "Chat to resolve", assigned_to: "user1" })

    vi.mocked(handoffApi.list).mockImplementation((_token, params) => {
      if (params?.status === "closed") return Promise.resolve(emptyList)
      if (params?.unclaimed_only) return Promise.resolve(emptyList)
      return Promise.resolve({ items: [item], next_cursor: null, has_more: false })
    })

    render(<LiveSupportPage />)

    await user.click(await screen.findByRole("tab", { name: /in progress/i }))
    await user.click(await screen.findByRole("button", { name: /resolve/i }))

    return user
  }

  it("resolveButton_callsHandoffApiResolveAndShowsToast", async () => {
    const user = await openResolveDialog()
    await waitFor(() => screen.getByRole("dialog"))

    await user.click(screen.getByRole("button", { name: /^resolve$/i }))

    await waitFor(() => expect(handoffApi.resolve).toHaveBeenCalledWith("test-token", "h1", expect.objectContaining({ resolution_note: null })))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Conversation resolved"))
  })

  it("resolveWithNote_passesNoteToApi", async () => {
    const user = await openResolveDialog()
    await waitFor(() => screen.getByRole("dialog"))

    await user.type(screen.getByLabelText(/resolution note/i), "Issue fixed")
    await user.click(screen.getByRole("button", { name: /^resolve$/i }))

    await waitFor(() =>
      expect(handoffApi.resolve).toHaveBeenCalledWith("test-token", "h1", { resolution_note: "Issue fixed" })
    )
  })

  it("resolveFails_showsErrorToast", async () => {
    vi.mocked(handoffApi.resolve).mockRejectedValue(new ApiException(500, "Resolve failed", "server_error"))

    const user = await openResolveDialog()
    await waitFor(() => screen.getByRole("dialog"))

    await user.click(screen.getByRole("button", { name: /^resolve$/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Resolve failed"))
  })
})

// ─── TranscriptDialog ─────────────────────────────────────────────────────────

describe("TranscriptDialog", () => {
  it("viewTranscript_loadsAndShowsMessages", async () => {
    const user = userEvent.setup()
    const item = makeItem({ id: "h1", title: "Resolved chat", status: "closed" })
    vi.mocked(handoffApi.list).mockImplementation((_token, params) => {
      if (params?.status === "closed") return Promise.resolve({ items: [item], next_cursor: null, has_more: false })
      return Promise.resolve(emptyList)
    })
    vi.mocked(handoffApi.messages).mockResolvedValue({
      conversation_id: "h1", conversation_status: "closed", assigned_to: null,
      items: [makeMessage({ content: "Transcript message" })],
    })

    render(<LiveSupportPage />)

    await user.click(await screen.findByRole("tab", { name: /resolved/i }))
    await user.click(await screen.findByRole("button", { name: /view transcript/i }))

    expect(await screen.findByText("Transcript message")).toBeInTheDocument()
  })
})
