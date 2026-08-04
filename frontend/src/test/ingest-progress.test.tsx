import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act, waitFor } from "@testing-library/react"
import React from "react"

// ─── EventSource mock ────────────────────────────────────────────────────────

type ESListener = (e: MessageEvent) => void

class MockEventSource {
  static instances: MockEventSource[] = []

  url:      string
  onerror:  (() => void) | null = null
  private listeners: Record<string, ESListener[]> = {}

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(event: string, listener: ESListener) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(listener)
  }

  emit(event: string, data: unknown) {
    const msg = { data: JSON.stringify(data) } as MessageEvent
    ;(this.listeners[event] ?? []).forEach((fn) => fn(msg))
  }

  close() { /* no-op */ }

  static reset() { MockEventSource.instances = [] }
  static latest() { return MockEventSource.instances[MockEventSource.instances.length - 1] }
}

vi.stubGlobal("EventSource", MockEventSource)

// ─── API mock (ticket endpoint) ──────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  documentsApi: {
    streamTicket: vi.fn(async () => {
      return { ticket: "test-ticket-uuid", expires_in: 30 }
    }),
  },
}))

// ─── Imports (after stubs) ───────────────────────────────────────────────────

import { useIngestProgress } from "@/hooks/use-ingest-progress"
import { IngestProgress }    from "@/components/ingest-progress"
import type { IngestProgressState } from "@/hooks/use-ingest-progress"

// ─── Hook test harness ───────────────────────────────────────────────────────

function HookHarness({ token, agentId, docId }: { token: string; agentId: string; docId: string }) {
  const state = useIngestProgress(token, agentId, docId)
  return (
    <div>
      <span data-testid="stage">{state.stage}</span>
      <span data-testid="progress">{state.progress}</span>
      <span data-testid="done">{String(state.done)}</span>
      <span data-testid="error">{state.error ?? ""}</span>
      <span data-testid="chunks">{state.chunkCount ?? ""}</span>
    </div>
  )
}

// ─── Hook tests ──────────────────────────────────────────────────────────────

describe("useIngestProgress", () => {
  beforeEach(() => {
    MockEventSource.reset()
    // Not using fake timers because of the async ticket fetch interaction
  })

  it("starts in queued state", () => {
    render(<HookHarness token="tok" agentId="ag1" docId="doc1" />)
    expect(screen.getByTestId("stage").textContent).toBe("queued")
    expect(screen.getByTestId("done").textContent).toBe("false")
  })

  it("fetches ticket and opens EventSource with ?ticket= in URL", async () => {
    render(<HookHarness token="mytoken" agentId="ag1" docId="doc1" />)
    await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0))
    const es = MockEventSource.latest()
    expect(es.url).toContain("ticket=test-ticket-uuid")
    expect(es.url).toContain("/agents/ag1/documents/doc1/progress/stream")
  })

  it("transitions to processing on start event", async () => {
    render(<HookHarness token="tok" agentId="ag1" docId="doc1" />)
    await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0))
    const es = MockEventSource.latest()
    act(() => { es.emit("start", { status: "processing" }) })
    expect(screen.getByTestId("stage").textContent).toBe("processing")
    expect(screen.getByTestId("progress").textContent).toBe("25")
  })

  it("updates stage on delta event with status field", async () => {
    render(<HookHarness token="tok" agentId="ag1" docId="doc1" />)
    await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0))
    const es = MockEventSource.latest()
    act(() => { es.emit("delta", { status: "ingesting_to_kb" }) })
    expect(screen.getByTestId("stage").textContent).toBe("ingesting_to_kb")
    expect(screen.getByTestId("progress").textContent).toBe("75")
  })

  it("marks done=true on end event and captures chunk_count", async () => {
    render(<HookHarness token="tok" agentId="ag1" docId="doc1" />)
    await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0))
    const es = MockEventSource.latest()
    act(() => { es.emit("end", { status: "indexed", chunk_count: 42 }) })
    expect(screen.getByTestId("stage").textContent).toBe("done")
    expect(screen.getByTestId("progress").textContent).toBe("100")
    expect(screen.getByTestId("done").textContent).toBe("true")
    expect(screen.getByTestId("chunks").textContent).toBe("42")
  })

  it("sets error state on error event using error field", async () => {
    render(<HookHarness token="tok" agentId="ag1" docId="doc1" />)
    await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0))
    const es = MockEventSource.latest()
    act(() => { es.emit("error", { status: "failed", error: "Embedding service unavailable" }) })
    expect(screen.getByTestId("stage").textContent).toBe("error")
    expect(screen.getByTestId("error").textContent).toBe("Embedding service unavailable")
    expect(screen.getByTestId("done").textContent).toBe("true")
  })

  it("does not open EventSource when docId is null", () => {
    // @ts-expect-error testing null docId
    render(<HookHarness token="tok" agentId="ag1" docId={null} />)
    expect(MockEventSource.instances.length).toBe(0)
  })

  it("does not open EventSource when token is null", () => {
    // @ts-expect-error testing null token
    render(<HookHarness token={null} agentId="ag1" docId="doc1" />)
    expect(MockEventSource.instances.length).toBe(0)
  })
})

// ─── IngestProgress component tests ──────────────────────────────────────────

describe("IngestProgress", () => {
  const base: IngestProgressState = {
    stage: "processing", message: null, progress: 25, error: null, done: false, chunkCount: null,
  }

  it("shows all milestone labels", () => {
    render(<IngestProgress state={base} />)
    expect(screen.getByText("Queued")).toBeTruthy()
    expect(screen.getByText("Processing")).toBeTruthy()
    expect(screen.getByText("Preparing file")).toBeTruthy()
    expect(screen.getByText("Ingesting to knowledge base")).toBeTruthy()
    expect(screen.getByText("Indexed")).toBeTruthy()
  })

  it("shows filename when provided", () => {
    render(<IngestProgress state={base} filename="doc.pdf" />)
    expect(screen.getByText("doc.pdf")).toBeTruthy()
  })

  it("shows Indexed label when done", () => {
    const done: IngestProgressState = { ...base, stage: "done", progress: 100, done: true }
    render(<IngestProgress state={done} />)
    expect(screen.getByText("Indexed")).toBeTruthy()
  })

  it("shows chunk count when done and chunkCount is set", () => {
    const done: IngestProgressState = { ...base, stage: "done", progress: 100, done: true, chunkCount: 37 }
    render(<IngestProgress state={done} />)
    expect(screen.getByText(/37 chunks indexed/)).toBeTruthy()
  })

  it("shows error message on error state", () => {
    const err: IngestProgressState = { ...base, stage: "error", error: "Ingest failed", done: true }
    render(<IngestProgress state={err} />)
    expect(screen.getByText("Ingest failed")).toBeTruthy()
  })

  it("does not render milestone list on error — shows error row", () => {
    const err: IngestProgressState = { ...base, stage: "error", error: "KB unavailable", done: true }
    render(<IngestProgress state={err} />)
    expect(screen.queryByText("Processing")).toBeNull()
    expect(screen.getByText("KB unavailable")).toBeTruthy()
  })
})
