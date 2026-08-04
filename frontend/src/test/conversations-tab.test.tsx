import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { ConversationsTab } from "@/app/dashboard/agents/[id]/_tabs/conversations-tab"
import { conversationsApi } from "@/lib/api"
import type { ConversationItem, MessageOut, ConversationSearchResult } from "@/lib/api"

// ─── Mocks ────────────────────────────────────────────────────────────────────

const CONVERSATIONS: ConversationItem[] = [
  {
    id: "conv-1",
    org_id: "org1",
    agent_id: "agent-123",
    user_id: null,
    status: "open" as const,
    title: "Help with billing",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:30:00Z",
  },
  {
    id: "conv-2",
    org_id: "org1",
    agent_id: "agent-123",
    user_id: "user-abc",
    status: "closed" as const,
    title: null,
    created_at: "2026-05-02T09:00:00Z",
    updated_at: "2026-05-02T09:45:00Z",
  },
]

vi.mock("@/lib/api", () => ({
  conversationsApi: {
    list:         vi.fn(),
    delete:       vi.fn(),
    listMessages: vi.fn(),
    search:       vi.fn(),
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

describe("ConversationsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(conversationsApi.list).mockResolvedValue({
      items: CONVERSATIONS,
      next_cursor: null,
      has_more: false,
    })
  })

  it("shows skeleton while loading", () => {
    render(<ConversationsTab agentId="agent-123" />)
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders conversation titles after loading", async () => {
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByText("Help with billing")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows 'Untitled' for conversations without a title", async () => {
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByText("Untitled")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows status badges", async () => {
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByText("Open")).toBeInTheDocument()
      expect(screen.getByText("Closed")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows empty state when no conversations", async () => {
    vi.mocked(conversationsApi.list).mockResolvedValueOnce({
      items: [],
      next_cursor: null,
      has_more: false,
    })
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByText("No conversations yet")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows error state and retry button on API failure", async () => {
    vi.mocked(conversationsApi.list).mockRejectedValueOnce(new Error("Network error"))
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("opens delete confirmation dialog when delete button is clicked", async () => {
    const user = userEvent.setup()
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })
    const deleteButtons = screen.getAllByRole("button", { name: "" })
    // Click first trash button
    await user.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByText("Delete conversation?")).toBeInTheDocument()
    })
  })

  it("calls delete API and removes item on confirm", async () => {
    const user = userEvent.setup()
    vi.mocked(conversationsApi.delete).mockResolvedValueOnce(undefined)
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })

    const deleteButtons = screen.getAllByRole("button", { name: "" })
    await user.click(deleteButtons[0])
    await waitFor(() => screen.getByText("Delete conversation?"))

    await user.click(screen.getByRole("button", { name: /^delete$/i }))
    await waitFor(() => {
      expect(conversationsApi.delete).toHaveBeenCalledWith("fake-token", "agent-123", "conv-1")
    })
    const { toast } = await import("sonner")
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Conversation deleted")
    })
  })

  it("shows 'Load more' button when has_more is true", async () => {
    vi.mocked(conversationsApi.list).mockResolvedValueOnce({
      items: CONVERSATIONS,
      next_cursor: "cursor-abc",
      has_more: true,
    })
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument()
    }, { timeout: 2000 })
  })
})

// ─── Message thread dialog tests ──────────────────────────────────────────────

const MESSAGES: MessageOut[] = [
  {
    id: "msg-1",
    conversation_id: "conv-1",
    role: "user",
    content: "Hello, I need help",
    citations: null,
    total_tokens: null,
    prompt_tokens: null,
    completion_tokens: null,
    finish_reason: null,
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
  },
  {
    id: "msg-2",
    conversation_id: "conv-1",
    role: "assistant",
    content: "Sure, I can help you with that.",
    citations: [{} as unknown],
    total_tokens: 42,
    prompt_tokens: 10,
    completion_tokens: 32,
    finish_reason: "stop",
    created_at: "2026-05-01T10:00:05Z",
    updated_at: "2026-05-01T10:00:05Z",
  },
]

describe("ConversationsTab — message thread dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(conversationsApi.list).mockResolvedValue({
      items: CONVERSATIONS,
      next_cursor: null,
      has_more: false,
    })
    vi.mocked(conversationsApi.listMessages).mockResolvedValue({
      items: MESSAGES,
      next_cursor: null,
      has_more: false,
    })
  })

  it("opens message thread dialog when View Messages button is clicked", async () => {
    const user = userEvent.setup()
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })

    const viewButtons = screen.getAllByRole("button", { name: /view messages/i })
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText("Hello, I need help")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows message roles in the thread dialog", async () => {
    const user = userEvent.setup()
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })

    const viewButtons = screen.getAllByRole("button", { name: /view messages/i })
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText("user")).toBeInTheDocument()
      expect(screen.getByText("assistant")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows token count for messages that have it", async () => {
    const user = userEvent.setup()
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })

    const viewButtons = screen.getAllByRole("button", { name: /view messages/i })
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText("42 tokens")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows error state when listMessages fails", async () => {
    vi.mocked(conversationsApi.listMessages).mockRejectedValueOnce(new Error("Network error"))
    const user = userEvent.setup()
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })

    const viewButtons = screen.getAllByRole("button", { name: /view messages/i })
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText("Failed to load messages")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("calls conversationsApi.listMessages with correct args", async () => {
    const user = userEvent.setup()
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })

    const viewButtons = screen.getAllByRole("button", { name: /view messages/i })
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(conversationsApi.listMessages).toHaveBeenCalledWith(
        "fake-token", "agent-123", "conv-1", { limit: 50 }
      )
    }, { timeout: 2000 })
  })
})

// ─── Conversation content search tests ───────────────────────────────────────

const SEARCH_RESULTS: ConversationSearchResult[] = [
  {
    id: "conv-1",
    agent_id: "agent-123",
    status: "open",
    title: "Help with billing",
    match_count: 3,
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:30:00Z",
  },
]

describe("ConversationsTab — content search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(conversationsApi.list).mockResolvedValue({
      items: CONVERSATIONS,
      next_cursor: null,
      has_more: false,
    })
    vi.mocked(conversationsApi.search).mockResolvedValue({
      items: SEARCH_RESULTS,
      total: 1,
    })
  })

  it("toggles content search mode when 'Search messages' button is clicked", async () => {
    const user = userEvent.setup()
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })

    const toggleBtn = screen.getByRole("button", { name: /search messages/i })
    await user.click(toggleBtn)

    expect(screen.getByRole("button", { name: /content search on/i })).toBeInTheDocument()
  })

  it("calls conversationsApi.search when form is submitted in content mode", async () => {
    const user = userEvent.setup()
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })

    await user.click(screen.getByRole("button", { name: /search messages/i }))

    const input = screen.getByPlaceholderText(/search message content/i)
    await user.clear(input)
    await user.type(input, "billing")
    await user.click(screen.getByRole("button", { name: /^search$/i }))

    await waitFor(() => {
      expect(conversationsApi.search).toHaveBeenCalledWith(
        "fake-token", "agent-123", { q: "billing", limit: 20, offset: 0 }
      )
    }, { timeout: 2000 })
  })

  it("displays search results with match count", async () => {
    const user = userEvent.setup()
    render(<ConversationsTab agentId="agent-123" />)
    await waitFor(() => screen.getByText("Help with billing"), { timeout: 2000 })

    await user.click(screen.getByRole("button", { name: /search messages/i }))
    const input = screen.getByPlaceholderText(/search message content/i)
    await user.clear(input)
    await user.type(input, "billing")
    await user.click(screen.getByRole("button", { name: /^search$/i }))

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument() // match_count
    }, { timeout: 2000 })
  })
})
