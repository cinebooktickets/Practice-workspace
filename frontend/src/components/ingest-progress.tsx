"use client"
import React from "react"
import { CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { type IngestProgressState, type IngestStage } from "@/hooks/use-ingest-progress"

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  state:     IngestProgressState
  filename?: string
  className?: string
}

// ─── Milestone definitions ───────────────────────────────────────────────────

type Milestone = {
  stage: IngestStage
  label: string
}

const MILESTONES: Milestone[] = [
  { stage: "queued",                   label: "Queued" },
  { stage: "processing",               label: "Processing" },
  { stage: "generating_presigned_url", label: "Preparing file" },
  { stage: "ingesting_to_kb",          label: "Ingesting to knowledge base" },
  { stage: "done",                     label: "Indexed" },
]

const STAGE_ORDER: IngestStage[] = [
  "queued",
  "processing",
  "generating_presigned_url",
  "ingesting_to_kb",
  "done",
]

function stageIndex(stage: IngestStage): number {
  const idx = STAGE_ORDER.indexOf(stage)
  return idx === -1 ? 0 : idx
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IngestProgress({ state, filename, className }: Props) {
  const { stage, error, done, chunkCount } = state
  const isError    = stage === "error" || error != null
  const currentIdx = isError ? -1 : stageIndex(stage)

  return (
    <div className={cn("rounded-md border bg-muted/40 px-4 py-3", className)}>
      {/* Filename header */}
      {filename && (
        <p className="text-sm font-medium text-foreground mb-3 truncate">{filename}</p>
      )}

      {/* Step checklist */}
      <div className="space-y-2">
        {!isError && MILESTONES.map((m, i) => {
          const completed = !isError && i < currentIdx
          const active    = !isError && i === currentIdx && !done
          const isDone    = !isError && stage === "done" && i === MILESTONES.length - 1
          const pending   = !isError && i > currentIdx

          return (
            <div key={m.stage} className="flex items-center gap-2.5">
              {/* Icon */}
              <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {completed || isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                ) : active ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" aria-hidden="true" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground/40" aria-hidden="true" />
                )}
              </span>

              {/* Label */}
              <span className={cn(
                "text-sm",
                (completed || isDone) && "text-emerald-600 dark:text-emerald-400",
                active                && "text-foreground font-medium",
                pending               && "text-muted-foreground/50",
              )}>
                {m.label}
                {isDone && chunkCount != null && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    — {chunkCount} chunk{chunkCount !== 1 ? "s" : ""} indexed
                  </span>
                )}
              </span>
            </div>
          )
        })}

        {/* Error row */}
        {isError && (
          <div className="flex items-start gap-2.5 mt-1">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-sm text-destructive">
              {error ?? "Ingest failed"}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
