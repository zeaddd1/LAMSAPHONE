import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASSISTANT_MODULE } from "../../../../../modules/assistant"
import type AssistantModuleService from "../../../../../modules/assistant/service"
import { sendToCustomer } from "../../../../../lib/assistant/engine"
import type { ConversationPatch } from "../../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  const [conversation] = await s.listAssistantConversations({ id: req.params.id }, { take: 1 })
  if (!conversation) {
    res.status(404).json({ message: "غير موجودة" })
    return
  }
  const messages = await s.listAssistantMessages({ conversation_id: conversation.id }, { take: 200, order: { created_at: "DESC" } })
  // فتح المحادثة = قراءتها
  if (conversation.unread) await s.updateAssistantConversations({ id: conversation.id, unread: 0 })
  res.json({ conversation: { ...conversation, unread: 0 }, messages: messages.reverse() })
}

const NOTICE: Record<string, string> = {
  confirmed: "تم تأكيد طلبك ✅ سيتواصل معك المندوب قبل التوصيل. شكراً لثقتك بلمسة فون 🌹",
  cancelled: "تم إلغاء الطلب حسب طلبك. نحن في خدمتك في أي وقت 🌹",
}

export async function POST(req: MedusaRequest<ConversationPatch>, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  const b = req.validatedBody
  const [conv] = await s.listAssistantConversations({ id: req.params.id }, { take: 1 })
  if (!conv) {
    res.status(404).json({ message: "غير موجودة" })
    return
  }
  const patch: Record<string, unknown> = { id: conv.id }
  if (b.mode) {
    patch.mode = b.mode
    if (b.mode === "bot") patch.needs_human = false
  }
  if (b.status) {
    patch.status = b.status
    if (b.status === "closed") patch.needs_human = false
  }
  if (b.order_note !== undefined) patch.order_note = b.order_note
  let sent: { ok: boolean; error?: string } | null = null
  if (b.order_status !== undefined) {
    patch.order_status = b.order_status
    const notice = b.order_status ? NOTICE[b.order_status] : undefined
    if (notice && b.notify) {
      sent = await sendToCustomer(req.scope, conv.channel, conv.external_id, notice)
      await s.createAssistantMessages({
        conversation_id: conv.id,
        direction: "out",
        sender: "staff",
        text: sent.ok ? notice : `${notice}\n\n⚠️ لم يُرسل: ${sent.error}`,
        intent: `order_${b.order_status}`,
      })
      patch.needs_human = false
      patch.last_text = notice.slice(0, 300)
      patch.last_message_at = new Date()
    }
  }
  const [conversation] = await s.updateAssistantConversations([patch as any])
  res.json({ conversation, sent })
}
