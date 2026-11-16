import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASSISTANT_MODULE } from "../../../../modules/assistant"
import type AssistantModuleService from "../../../../modules/assistant/service"

// ملخص خفيف للتنبيهات: كم محادثة تحتاج موظفاً، وكم طلباً ينتظر التأكيد (يُستدعى كل 20 ثانية)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  const [[latest, human], [, orders]] = await Promise.all([
    s.listAndCountAssistantConversations({ needs_human: true, status: "open" }, { take: 1, order: { last_message_at: "DESC" } }),
    s.listAndCountAssistantConversations({ order_status: "pending" }, { take: 1 }),
  ])
  res.json({ human, orders, latest: latest[0] ? { id: latest[0].id, name: latest[0].name, text: latest[0].last_text } : null })
}
