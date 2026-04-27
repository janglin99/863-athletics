import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt"
import { TOOLS, executeTool } from "@/lib/ai/tools"

const MAX_ITERATIONS = 8

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY_863Ath) {
    return NextResponse.json(
      { error: "AI assistant is not configured" },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as {
    messages: Anthropic.MessageParam[]
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_863Ath })
  const messages: Anthropic.MessageParam[] = [...body.messages]

  const todayContext = (() => {
    const tz = "America/New_York"
    const now = new Date()
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const iso = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now)
    return `Today is ${fmt.format(now)} (${iso} in ISO format). Local timezone: ${tz}.`
  })()

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: todayContext },
      ],
      tools: TOOLS,
      messages,
    })

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim()
      return NextResponse.json({
        reply: text,
        usage: response.usage,
      })
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tool of toolUses) {
      try {
        const result = await executeTool(
          tool.name,
          tool.input as Record<string, unknown>,
          { userId: user.id, supabase }
        )
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: result,
        })
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: JSON.stringify({
            error: err instanceof Error ? err.message : "tool failed",
          }),
          is_error: true,
        })
      }
    }

    messages.push({ role: "user", content: toolResults })
  }

  return NextResponse.json(
    {
      error:
        "I got stuck mid-thought — please try rephrasing or contact 863 Athletics directly.",
    },
    { status: 500 }
  )
}
