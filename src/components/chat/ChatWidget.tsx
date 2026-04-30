"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, X, Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/store/cartStore"

const MARKDOWN_PATTERN = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g

function MarkdownText({
  text,
  onLinkClick,
}: {
  text: string
  onLinkClick: () => void
}) {
  const parts = text.split(MARKDOWN_PATTERN)
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (linkMatch) {
          const [, label, href] = linkMatch
          if (href.startsWith("/")) {
            return (
              <Link
                key={i}
                href={href}
                onClick={onLinkClick}
                className="text-brand-orange underline underline-offset-2 hover:text-brand-orange-dark"
              >
                {label}
              </Link>
            )
          }
          if (href.startsWith("http://") || href.startsWith("https://")) {
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-orange underline underline-offset-2 hover:text-brand-orange-dark"
              >
                {label}
              </a>
            )
          }
          return label
        }
        const boldMatch = /^\*\*([^*]+)\*\*$/.exec(part)
        if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>
        const codeMatch = /^`([^`]+)`$/.exec(part)
        if (codeMatch)
          return (
            <code
              key={i}
              className="bg-bg-primary border border-border rounded px-1 text-xs"
            >
              {codeMatch[1]}
            </code>
          )
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

interface ChatTurn {
  role: "user" | "assistant"
  text: string
}

interface ApiMessage {
  role: "user" | "assistant"
  content: string
}

const INTRO: ChatTurn = {
  role: "assistant",
  text: "Hey — I'm the 863 Athletics assistant. I can look up your bookings, credit balance, our rates and hours, and what's available to [book](/book). What can I help with?",
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([INTRO])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Lift the chat bubble above the floating cart banner so it doesn't sit on
  // top of the cart drawer trigger. Mirrors FloatingCartButton's hide rules
  // so we don't lift when the banner isn't actually visible.
  const pathname = usePathname()
  const cartCount = useCartStore((s) => s.getItemCount())
  const cartBannerVisible =
    cartCount > 0 &&
    !pathname.startsWith("/book/checkout") &&
    !pathname.startsWith("/book/confirmation")

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [turns, sending, open])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    const next: ChatTurn[] = [...turns, { role: "user", text }]
    setTurns(next)
    setSending(true)

    try {
      const apiMessages: ApiMessage[] = next
        .filter((t) => t !== INTRO)
        .map((t) => ({ role: t.role, content: t.text }))

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            text:
              data.error ||
              "Something went wrong on my end — please try again.",
          },
        ])
      } else {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", text: data.reply || "(no response)" },
        ])
      }
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I couldn't reach the server. Please try again in a moment.",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat assistant"
          className={cn(
            "fixed right-4 z-40 h-14 w-14 rounded-full bg-brand-orange hover:bg-brand-orange-dark text-white shadow-lg flex items-center justify-center transition-all hover:scale-105",
            cartBannerVisible ? "bottom-36" : "bottom-20",
            "lg:bottom-6 lg:right-6"
          )}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div
          className={cn(
            "fixed z-50 bg-bg-secondary border border-border rounded-lg shadow-2xl flex flex-col",
            "inset-x-2 bottom-2 top-16",
            "sm:inset-x-auto sm:right-4 sm:bottom-4 sm:top-auto sm:w-[380px] sm:h-[560px]",
            "lg:right-6 lg:bottom-6"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="font-display font-bold uppercase tracking-wide text-sm">
                Assistant
              </p>
              <p className="text-xs text-text-muted">863 Athletics</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="p-1 rounded hover:bg-bg-elevated text-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {turns.map((t, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  t.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    t.role === "user"
                      ? "bg-brand-orange text-white"
                      : "bg-bg-elevated text-text-primary border border-border"
                  )}
                >
                  {t.role === "assistant" ? (
                    <MarkdownText
                      text={t.text}
                      onLinkClick={() => setOpen(false)}
                    />
                  ) : (
                    t.text
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-bg-elevated text-text-secondary border border-border rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about bookings, rates, hours…"
              disabled={sending}
              className="bg-bg-elevated border-border flex-1"
            />
            <Button
              onClick={send}
              disabled={sending || !input.trim()}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white"
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
