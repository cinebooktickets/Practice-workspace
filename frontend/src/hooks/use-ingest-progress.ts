"use client"
import React from "react"
import { documentsApi } from "@/lib/api"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// ─── Types ────────────────────────────────────────────────────────────────────

// Backend status values from FD-003
export type IngestStage =
  | "queued"
  | "processing"
  | "generating_presigned_url"
  | "ingesting_to_kb"
  | "done"
  | "error"

export type IngestProgressState = {
  stage:      IngestStage
  message:    string | null
  progress:   number          // 0–100
  error:      string | null
  done:       boolean
  chunkCount: number | null   // populated on successful end event
}

// ─── Status → progress mapping (FD-003) ──────────────────────────────────────

function stageToProgress(stage: IngestStage): number {
  switch (stage) {
    case "queued":                   return 0
    case "processing":               return 25
    case "generating_presigned_url": return 50
    case "ingesting_to_kb":          return 75
    case "done":                     return 100
    default:                         return 0
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Streams ingest progress for a single document via SSE using FD-003 ticket auth.
 *
 * Auth flow (FD-003):
 *   1. POST .../stream-ticket with Bearer token → one-time UUID ticket (30s TTL)
 *   2. Open EventSource with ?ticket=<uuid> — no Authorization header needed
 *   3. On EventSource error before first event: fetch a fresh ticket and re-open
 *
 * SSE events: start | delta | end | error
 * Use SSE event name — ignore data.event field (redundant per backend notes).
 *
 * @param token   - Bearer token (null = do not open stream)
 * @param agentId - UUID of the agent
 * @param docId   - UUID of the document (null = do not open stream)
 */
export function useIngestProgress(
  token:   string | null,
  agentId: string,
  docId:   string | null,
): IngestProgressState {
  const [state, setState] = React.useState<IngestProgressState>({
    stage:      "queued",
    message:    null,
    progress:   0,
    error:      null,
    done:       false,
    chunkCount: null,
  })

  const esRef        = React.useRef<EventSource | null>(null)
  const destroyedRef = React.useRef(false)
  const reconnectRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeEs = React.useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null }
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
  }, [])

  const openStream = React.useCallback(async (t: string, aId: string, dId: string) => {
    if (destroyedRef.current) return
    closeEs()

    let ticket: string
    try {
      const res = await documentsApi.streamTicket(t, aId, dId)
      ticket = res.ticket
    } catch {
      setState(prev => ({ ...prev, stage: "error", error: "Failed to open progress stream", done: true }))
      return
    }

    if (destroyedRef.current) return

    const url = `${BASE_URL}/api/v1/agents/${aId}/documents/${dId}/progress/stream?ticket=${encodeURIComponent(ticket)}`
    const es  = new EventSource(url)
    esRef.current = es

    let receivedFirst = false

    es.addEventListener("start", (e: MessageEvent) => {
      receivedFirst = true
      try {
        const data  = JSON.parse(e.data)
        const stage: IngestStage = data.status ?? "processing"
        setState(prev => ({ ...prev, stage, progress: stageToProgress(stage), message: null, error: null }))
      } catch { /* malformed */ }
    })

    es.addEventListener("delta", (e: MessageEvent) => {
      receivedFirst = true
      try {
        const data  = JSON.parse(e.data)
        const stage: IngestStage = data.status ?? "processing"
        setState(prev => ({ ...prev, stage, progress: stageToProgress(stage), message: null, error: null }))
      } catch { /* malformed */ }
    })

    es.addEventListener("end", (e: MessageEvent) => {
      receivedFirst = true
      try {
        const data = JSON.parse(e.data)
        setState(prev => ({
          ...prev,
          stage:      "done",
          progress:   100,
          message:    null,
          error:      null,
          done:       true,
          chunkCount: typeof data.chunk_count === "number" ? data.chunk_count : null,
        }))
      } catch {
        setState(prev => ({ ...prev, stage: "done", progress: 100, done: true }))
      }
      es.close()
      esRef.current = null
    })

    es.addEventListener("error", (e: MessageEvent) => {
      receivedFirst = true
      try {
        const data = JSON.parse(e.data)
        setState(prev => ({ ...prev, stage: "error", error: data.error ?? "Ingest failed", done: true }))
      } catch {
        setState(prev => ({ ...prev, stage: "error", error: "Ingest failed", done: true }))
      }
      es.close()
      esRef.current = null
    })

    es.onerror = () => {
      if (destroyedRef.current) return
      if (!receivedFirst) {
        // SSE failed before first event — ticket may be expired or network blip.
        // Re-issue a fresh ticket and reconnect after 2s.
        es.close()
        esRef.current = null
        reconnectRef.current = setTimeout(() => {
          if (!destroyedRef.current) openStream(t, aId, dId)
        }, 2000)
      }
      // If first event already received: terminal state handlers (end/error)
      // already set done=true and closed the stream — no action needed.
    }
  }, [closeEs])

  React.useEffect(() => {
    if (!token || !docId) return
    destroyedRef.current = false
    setState({ stage: "queued", message: null, progress: 0, error: null, done: false, chunkCount: null })
    openStream(token, agentId, docId)

    return () => {
      destroyedRef.current = true
      closeEs()
    }
  }, [token, agentId, docId, openStream, closeEs])

  return state
}
