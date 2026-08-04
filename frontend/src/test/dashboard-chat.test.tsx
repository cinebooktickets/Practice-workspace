import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "agent-123" }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/lib/api", () => ({
  dashboardChatApi: {
    send: vi.fn(),
  },
  ApiException: class ApiException extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

vi.mock("@/context/auth", () => {
  const getAccessTokenSilently = () => Promise.resolve("fake-token")
  return { useAuth: () => ({ getAccessTokenSilently }) }
})

vi.mock("@/components/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import ChatPage from "@/app/dashboard/agents/[id]/chat/page"
import { dashboardChatApi } from "@/lib/api"

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders empty state with start conversation prompt", () => {
    render(<ChatPage />)
    expect(screen.getByText("Start a conversation")).toBeTruthy()
  })

  it("renders header with Agent Chat label and Live badge", () => {
    render(<ChatPage />)
    expect(screen.getByText("Agent Chat")).toBeTruthy()
    expect(screen.getByText("Live")).toBeTruthy()
  })

  it("renders back link to agent detail", () => {
    render(<ChatPage />)
    expect(screen.getByText("Back")).toBeTruthy()
  })

  it("sends message and displays user bubble", async () => {
    vi.mocked(dashboardChatApi.send).mockResolvedValue({
      assistant_message: { role: "assistant" as const, content: "Hello! How can I help?", citations: [] },
      conversation_id: "conv-1",
    })

    render(<ChatPage />)
    const textarea = screen.getByPlaceholderText(/Type a message/)
    await userEvent.type(textarea, "Hello agent")
    await userEvent.click(screen.getByRole("button", { name: /send message/i }))

    expect(screen.getByText("Hello agent")).toBeTruthy()
  })

  it("displays assistant reply after send", async () => {
    vi.mocked(dashboardChatApi.send).mockResolvedValue({
      assistant_message: { role: "assistant" as const, content: "Hello! How can I help?", citations: [] },
      conversation_id: "conv-1",
    })

    render(<ChatPage />)
    const textarea = screen.getByPlaceholderText(/Type a message/)
    await userEvent.type(textarea, "Hello")
    await userEvent.click(screen.getByRole("button", { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText("Hello! How can I help?")).toBeTruthy()
    })
  })

  it("shows citation source when assistant reply includes citations", async () => {
    vi.mocked(dashboardChatApi.send).mockResolvedValue({
      assistant_message: {
        role: "assistant" as const,
        content: "Based on the docs…",
        citations: [
          { document_id: "doc-1", filename: "guide.pdf", chunk_text: "Some relevant text", score: 0.92 },
        ],
      },
      conversation_id: "conv-1",
    })

    render(<ChatPage />)
    const textarea = screen.getByPlaceholderText(/Type a message/)
    await userEvent.type(textarea, "Tell me about the guide")
    await userEvent.click(screen.getByRole("button", { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/guide\.pdf/)).toBeTruthy()
    })
  })

  it("shows error message when API call fails", async () => {
    vi.mocked(dashboardChatApi.send).mockRejectedValue(
      new Error("Service unavailable")
    )

    render(<ChatPage />)
    const textarea = screen.getByPlaceholderText(/Type a message/)
    await userEvent.type(textarea, "Test error")
    await userEvent.click(screen.getByRole("button", { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/⚠️/)).toBeTruthy()
    })
  })

  it("clears messages when Clear button is clicked", async () => {
    vi.mocked(dashboardChatApi.send).mockResolvedValue({
      assistant_message: { role: "assistant" as const, content: "Hello!", citations: [] },
      conversation_id: "conv-1",
    })

    render(<ChatPage />)
    const textarea = screen.getByPlaceholderText(/Type a message/)
    await userEvent.type(textarea, "Hi")
    await userEvent.click(screen.getByRole("button", { name: /send message/i }))

    await waitFor(() => { expect(screen.getByText("Hello!")).toBeTruthy() })

    await userEvent.click(screen.getByRole("button", { name: /clear/i }))
    expect(screen.getByText("Start a conversation")).toBeTruthy()
  })
})
