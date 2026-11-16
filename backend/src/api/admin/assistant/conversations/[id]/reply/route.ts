import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASSISTANT_MODULE } from "../../../../../../modules/assistant"
import type AssistantModuleService from "../../../../../../modules/assistant/service"
import { correctArabic } from "../../../../../../lib/assistant/brain"
import { sendToCustomer } from "../../../../../../lib/assistant/engine"
import type { ReplyBody } from "../../../validators"

// رد الموظف: يُرسل للعميل، ويوقف الرد الآلي لهذه المحادثة حتى يعيده الموظف أو تمر مدة الخمول
export async function POST(req: MedusaRequest<ReplyBody>, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  const [conv] = await s.listAssistantConversations({ id: req.params.id }, { take: 1 })
  if (!conv) {
    res.status(404).json({ message: "غير موجودة" })
    return
  }
  const text = req.validatedBody.correct ? correctArabic(req.validatedBody.text) : req.validatedBody.text
  const sent = await sendToCustomer(req.scope, conv.channel, conv.external_id, text)
  const message = await s.createAssistantMessages({
    conversation_id: conv.id,
    direction: "out",
    sender: "staff",
    text: sent.ok ? text : `${text}\n\n⚠️ لم يُرسل: ${sent.error}`,
    external_id: sent.id || null,
  })
  await s.updateAssistantConversations({
    id: conv.id,
    mode: "human",
    needs_human: false,
    unread: 0,
    last_text: text.slice(0, 300),
    last_message_at: new Date(),
  })
  res.json({ message, sent })
}
