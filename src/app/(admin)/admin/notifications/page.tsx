"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils/format"
import { Bell, Mail, MessageSquare } from "lucide-react"

interface NotificationLog {
  id: string
  type: string
  channel: string
  recipient: string
  status: string
  subject: string | null
  error_message: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  sent: "border-green-500/50 text-green-400",
  delivered: "border-green-500/50 text-green-400",
  pending: "border-yellow-500/50 text-yellow-400",
  failed: "border-red-500/50 text-red-400",
  bounced: "border-red-500/50 text-red-400",
}

const CHANNEL_ICONS: Record<string, typeof Bell> = {
  email: Mail,
  sms: MessageSquare,
}

export default function AdminNotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("notification_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      setLogs(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = logs.filter((l) => {
    if (filter === "all") return true
    return l.status === filter
  })

  const statuses = Array.from(new Set(logs.map((l) => l.status)))

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${logs.length} notification log entries`}
      />

      <div className="mb-6">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-bg-secondary">
            <TabsTrigger value="all">All</TabsTrigger>
            {statuses.map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize">
                {s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const ChannelIcon = CHANNEL_ICONS[log.channel] || Bell
            return (
              <Card
                key={log.id}
                className="bg-bg-secondary border-border"
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0">
                        <ChannelIcon className="h-4 w-4 text-brand-orange" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {log.subject || log.type}
                        </p>
                        <p className="text-xs text-text-secondary truncate">
                          {log.recipient}
                        </p>
                        {log.error_message && (
                          <p className="text-xs text-red-400 truncate mt-0.5">
                            {log.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        variant="outline"
                        className="capitalize text-xs border-border"
                      >
                        {log.channel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="capitalize text-xs border-border"
                      >
                        {log.type}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`capitalize text-xs ${
                          STATUS_COLORS[log.status] || "border-border"
                        }`}
                      >
                        {log.status}
                      </Badge>
                      <span className="text-xs text-text-muted w-36 text-right">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {filtered.length === 0 && (
            <p className="text-text-secondary text-center py-8">
              No notifications found
            </p>
          )}
        </div>
      )}
    </div>
  )
}
