"use client"
import React from "react"
import { useParams } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/auth"
import Link from "next/link"
import { ArrowLeft, Bot, FlaskConical, Send, Trash2, User } from "lucide-react"
import { sandboxChatApi, ApiException } from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant"

type LocalMessage = {
  id:        string
  role:      Role
  content:   string
  timestamp: Date
  citations?: { document_id: string; filename: string; chunk_text: string; score: number }[]
}

// ─── Message bubble ───────────────────────────────────────────────────────────

type BubbleProps = {
  message: LocalMessage
}

function Bubble({ message }: BubbleProps) {
  const isUser = message.role === "user"
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white ${isUser ? "bg-primary" : "bg-muted-foreground/20"}`}>
        {isUser
          ? <User className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
          : <Bot className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-muted text-foreground rounded-tl-sm"
      }`}>
        {message.content}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-muted-foreground/20 space-y-1">
            {message.citations.map((c) => (
              <div key={c.document_id + c.chunk_text.slice(0, 10)} className="text-[10px] opacity-70 truncate">
                📄 {c.filename} <span className="opacity-60">({Math.round(c.score * 100)}%)</span>
              </div>
            ))}
          </div>
        )}
        <div className={`text-[10px] mt-1 opacity-60 ${isUser ? "text-right" : "text-left"}`}>
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted-foreground/20 flex items-center justify-center">
        <Bot className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SandboxPage() {
  const params  = useParams()
  const agentId = params.id as string
  const { getAccessTokenSilently } = useAuth()

  const [messages, setMessages]     = React.useState<LocalMessage[]>([])
  const [input, setInput]           = React.useState("")
  const [responding, setResponding] = React.useState(false)

  const bottomRef  = React.useRef<HTMLDivElement>(null)
  const inputRef   = React.useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages change
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, responding])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || responding) return

    const userMsg: LocalMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setResponding(true)

    try {
      const token = await getAccessTokenSilently()
      const res   = await sandboxChatApi.send(token, agentId, { message: text })
      const assistantMsg: LocalMessage = {
        id:        `${Date.now()}-assistant`,
        role:      "assistant",
        content:   res.assistant_message.content,
        timestamp: new Date(),
        citations: res.assistant_message.citations,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : "Failed to get response"
      const errorMsg: LocalMessage = {
        id:        `${Date.now()}-error`,
        role:      "assistant",
        content:   `⚠️ ${msg}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setResponding(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([])
    inputRef.current?.focus()
  }

  return (
    <ProtectedRoute>
      {/* Full-screen layout — no DashboardShell */}
      <div className="flex flex-col h-screen bg-background">

        {/* ── Header ── */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2" asChild>
              <Link href={`/dashboard/agents/${agentId}`}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Back
              </Link>
            </Button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" aria-hidden="true" />
              <span className="text-sm font-semibold">Agent Sandbox</span>
              <Badge variant="outline" className="text-xs">No persistence</Badge>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleClear}
            disabled={messages.length === 0 && !responding}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </Button>
        </header>

        {/* ── Notice banner ── */}
        <div className="flex-shrink-0 flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400">
          <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          Sandbox — responses use your real agent config and knowledge base. Conversations are not saved.
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.length === 0 && !responding && (
              <div className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium">Start a conversation</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Type a message below to test how your agent responds. Shift+Enter for a new line.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <Bubble key={msg.id} message={msg} />
            ))}

            {responding && <TypingIndicator />}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input ── */}
        <div className="flex-shrink-0 border-t bg-background px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              rows={1}
              disabled={responding}
              className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50 min-h-[44px] max-h-36 overflow-y-auto leading-relaxed"
              style={{ height: "auto" }}
              onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = `${Math.min(el.scrollHeight, 144)}px`
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || responding}
              size="icon"
              className="h-[44px] w-[44px] rounded-xl flex-shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-2">
            Conversations are not saved in sandbox mode.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
