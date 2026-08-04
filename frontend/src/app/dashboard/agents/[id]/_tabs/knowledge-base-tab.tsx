"use client"
import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useAuth } from "@/context/auth"
import { toast } from "sonner"
import { Upload, FileText, AlertCircle, RefreshCw, Trash2, XCircle, Eye, ChevronLeft, ChevronRight } from "lucide-react"
import { documentsApi, DocumentResponse, DocumentStatus, DocumentChunk, ApiException } from "@/lib/api"
import { useIngestProgress } from "@/hooks/use-ingest-progress"
import { IngestProgress } from "@/components/ingest-progress"

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function statusVariant(status: DocumentStatus): "default" | "success" | "warning" | "destructive" {
  if (status === "indexed")    return "success"
  if (status === "processing") return "warning"
  if (status === "failed")     return "destructive"
  return "default"  // queued
}

function statusLabel(status: DocumentStatus): string {
  if (status === "indexed") return "indexed"
  if (status === "queued")  return "queued"
  return status
}

const ACCEPTED_TYPES = ".pdf,.docx,.txt,.md,.html"
const MAX_SIZE_MB = 25

type Props = {
  agentId: string
  isAdmin: boolean
}

// One progress row per document being ingested
type IngestRowProps = {
  agentId:  string
  docId:    string
  filename: string
  token:    string
  onDone:   (docId: string) => void
}

function IngestRow({ agentId, docId, filename, token, onDone }: IngestRowProps) {
  const state = useIngestProgress(token, agentId, docId)

  React.useEffect(() => {
    if (state.done) {
      const t = setTimeout(() => onDone(docId), 2000)
      return () => clearTimeout(t)
    }
  }, [state.done, docId, onDone])

  return <IngestProgress state={state} filename={filename} />
}

export function KnowledgeBaseTab({ agentId, isAdmin }: Props) {
  const { getAccessTokenSilently } = useAuth()

  const [docs, setDocs]         = React.useState<DocumentResponse[]>([])
  const [loading, setLoading]   = React.useState(true)
  const [error, setError]       = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [uploading, setUploading] = React.useState(false)
  const [actingId, setActingId]   = React.useState<string | null>(null)
  const [ingestingDocs, setIngestingDocs] = React.useState<{ id: string; filename: string }[]>([])
  const [ssToken, setSsToken]   = React.useState<string | null>(null)
  const [errorDocId, setErrorDocId] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [chunksDoc, setChunksDoc] = React.useState<DocumentResponse | null>(null)
  const [chunks, setChunks] = React.useState<DocumentChunk[]>([])
  const [chunksTotal, setChunksTotal] = React.useState(0)
  const [chunksOffset, setChunksOffset] = React.useState(0)
  const [chunksLoading, setChunksLoading] = React.useState(false)
  const CHUNKS_LIMIT = 10
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const fetchDocs = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const data  = await documentsApi.list(token, agentId)
      setDocs(data.documents)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to load documents"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [agentId, getAccessTokenSilently])

  React.useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  // Keep a fresh token available for SSE streams (no headers — passed as query param)
  React.useEffect(() => {
    getAccessTokenSilently().then(setSsToken).catch(() => { /* silent */ })
  }, [getAccessTokenSilently])

  const dismissIngest = React.useCallback((docId: string) => {
    setIngestingDocs((prev) => prev.filter((d) => d.id !== docId))
  }, [])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const invalid = Array.from(files).filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024)
    if (invalid.length > 0) {
      toast.error(`Files exceed ${MAX_SIZE_MB} MB limit: ${invalid.map((f) => f.name).join(", ")}`)
      return
    }
    setUploading(true)
    let uploaded = 0
    const results: DocumentResponse[] = []
    for (const file of Array.from(files)) {
      try {
        const token = await getAccessTokenSilently()
        const doc   = await documentsApi.upload(token, agentId, file)
        results.push(doc)
        uploaded++
      } catch (err) {
        const msg = err instanceof ApiException ? err.message : `Failed to upload "${file.name}"`
        toast.error(msg)
      }
    }
    if (uploaded > 0) {
      setDocs((prev) => [...results, ...prev])
      toast.success(`${uploaded} file${uploaded > 1 ? "s" : ""} uploaded`)
      setIngestingDocs((prev) => [
        ...prev,
        ...results.map((d) => ({ id: d.id, filename: d.filename })),
      ])
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selected)
    setSelected(new Set())
    let deleted = 0
    for (const id of ids) {
      try {
        const token = await getAccessTokenSilently()
        await documentsApi.delete(token, agentId, id)
        setDocs((prev) => prev.filter((d) => d.id !== id))
        deleted++
      } catch (err) {
        const msg = err instanceof ApiException ? err.message : "Failed to delete document"
        toast.error(msg)
      }
    }
    if (deleted > 0) toast.success(`${deleted} document${deleted > 1 ? "s" : ""} deleted`)
  }

  const handleDelete = async (doc: DocumentResponse) => {
    setActingId(doc.id)
    try {
      const token = await getAccessTokenSilently()
      await documentsApi.delete(token, agentId, doc.id)
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      toast.success(`"${doc.filename}" deleted`)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to delete document"
      toast.error(msg)
    } finally {
      setActingId(null)
    }
  }

  const handleReprocess = async (doc: DocumentResponse) => {
    setActingId(doc.id)
    try {
      const token   = await getAccessTokenSilently()
      const updated = await documentsApi.reprocess(token, agentId, doc.id)
      setDocs((prev) => prev.map((d) => d.id === doc.id ? updated : d))
      toast.success(`Reprocessing "${doc.filename}"`)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to reprocess document"
      toast.error(msg)
    } finally {
      setActingId(null)
    }
  }

  const openChunks = async (doc: DocumentResponse, offset = 0) => {
    setChunksDoc(doc)
    setChunksOffset(offset)
    setChunksLoading(true)
    setChunks([])
    try {
      const token = await getAccessTokenSilently()
      const res = await documentsApi.listChunks(token, agentId, doc.id, { limit: CHUNKS_LIMIT, offset })
      setChunks(res.items)
      setChunksTotal(res.total)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to load chunks"
      toast.error(msg)
      setChunksDoc(null)
    } finally {
      setChunksLoading(false)
    }
  }

  const handleCancel = async (doc: DocumentResponse) => {
    setActingId(doc.id)
    try {
      const token   = await getAccessTokenSilently()
      const updated = await documentsApi.cancel(token, agentId, doc.id)
      setDocs((prev) => prev.map((d) => d.id === doc.id ? updated : d))
      toast.success(`Ingest cancelled for "${doc.filename}"`)
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to cancel ingest"
      toast.error(msg)
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-lg" aria-hidden="true" />
        <Skeleton className="h-10 w-full" aria-hidden="true" />
        <Skeleton className="h-10 w-full" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        aria-label="Upload documents"
      >
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
        <p className="text-sm font-medium">{uploading ? "Uploading…" : "Drag files here or click to upload"}</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT, MD, HTML — max {MAX_SIZE_MB} MB per file</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
        />
      </div>

      {/* Ingest progress rows — one per recently uploaded document */}
      {ingestingDocs.length > 0 && ssToken && (
        <div className="space-y-2">
          {ingestingDocs.map((d) => (
            <IngestRow
              key={d.id}
              agentId={agentId}
              docId={d.id}
              filename={d.filename}
              token={ssToken}
              onDone={dismissIngest}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertCircle className="w-7 h-7 text-destructive" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchDocs}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Bulk actions */}
      {isAdmin && selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            Delete selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Empty state */}
      {!error && docs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <FileText className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No documents yet. Upload files to build the knowledge base.</p>
          </CardContent>
        </Card>
      )}

      {/* Document table */}
      {!error && docs.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead className="w-10" aria-hidden="true" />}
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id} className={selected.has(doc.id) ? "bg-muted/30" : ""}>
                  {isAdmin && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="accent-primary"
                        aria-label={`Select ${doc.filename}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium max-w-xs">
                    <div className="truncate">{doc.filename}</div>
                    {doc.error_message && (
                      <p className="text-xs text-destructive mt-0.5 truncate">{doc.error_message}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatBytes(doc.file_size)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(doc.status)} className="capitalize text-xs">
                      {statusLabel(doc.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(doc.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(doc.status === "queued" || doc.status === "processing") && isAdmin && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-warning"
                                onClick={() => handleCancel(doc)}
                                disabled={actingId === doc.id}
                                aria-label="Cancel ingest"
                              >
                                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancel ingest</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {doc.status === "failed" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => handleReprocess(doc)}
                                disabled={actingId === doc.id}
                                aria-label="Reprocess"
                              >
                                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reprocess</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {doc.status === "indexed" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => openChunks(doc)}
                                aria-label={`View chunks for ${doc.filename}`}
                              >
                                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View chunks</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {isAdmin && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(doc)}
                                disabled={actingId === doc.id}
                                aria-label={`Delete ${doc.filename}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete document</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      {/* Chunks viewer dialog */}
      <Dialog open={!!chunksDoc} onOpenChange={(open) => { if (!open) setChunksDoc(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chunks — {chunksDoc?.filename}</DialogTitle>
            <DialogDescription>
              {chunksTotal} chunk{chunksTotal !== 1 ? "s" : ""} total
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {chunksLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : chunks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No chunks found.</p>
            ) : (
              chunks.map((chunk) => (
                <div key={chunk.chunk_index} className="rounded-md border p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Chunk #{chunk.chunk_index + 1}</p>
                  <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{chunk.chunk_text}</p>
                </div>
              ))
            )}
          </div>
          {chunksTotal > CHUNKS_LIMIT && (
            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-xs text-muted-foreground">
                {chunksOffset + 1}–{Math.min(chunksOffset + CHUNKS_LIMIT, chunksTotal)} of {chunksTotal}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={chunksOffset === 0 || chunksLoading}
                  onClick={() => chunksDoc && openChunks(chunksDoc, chunksOffset - CHUNKS_LIMIT)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={chunksOffset + CHUNKS_LIMIT >= chunksTotal || chunksLoading}
                  onClick={() => chunksDoc && openChunks(chunksDoc, chunksOffset + CHUNKS_LIMIT)}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Error doc detail dialog */}
      <Dialog open={!!errorDocId} onOpenChange={(open) => { if (!open) setErrorDocId(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ingest Error</DialogTitle>
            <DialogDescription>
              {docs.find((d) => d.id === errorDocId)?.error_message ?? "Unknown error"}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}

