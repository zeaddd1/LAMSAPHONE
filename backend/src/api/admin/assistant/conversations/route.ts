import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASSISTANT_MODULE } from "../../../../modules/assistant"
import type AssistantModuleService from "../../../../modules/assistant/service"

// قائمة المحادثات: الأحدث أولاً، مع فلتر (تحتاج موظف / طلبات / مغلقة)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  const f = (req.query.filter as string) || "open"
  const filters: Record<string, unknown> =
    f === "human"
      ? { needs_human: true, status: "open" }
      : f === "orders"
      ? { order_status: "pending" }
      : f === "closed"
      ? { status: "closed" }
      : f === "all"
      ? {}
      : { status: "open" }
  const [conversations, count] = await s.listAndCountAssistantConversations(filters, {
    take: Math.min(Number(req.query.limit) || 50, 200),
    skip: Number(req.query.offset) || 0,
    order: { last_message_at: "DESC" },
  })
  // عدّادات للتبويبات
  const [, human] = await s.listAndCountAssistantConversations({ needs_human: true, status: "open" }, { take: 1 })
  const [, orders] = await s.listAndCountAssistantConversations({ order_status: "pending" }, { take: 1 })
  res.json({ conversations, count, counts: { human, orders } })
}
