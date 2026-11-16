import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASSISTANT_MODULE } from "../../../modules/assistant"
import type AssistantModuleService from "../../../modules/assistant/service"

// الأسئلة الشائعة لصفحة المتجر العامة
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  await s.ensureDefaultFaqs()
  const faqs = await s.listAssistantFaqs({ is_active: true }, { take: 200, order: { rank: "ASC", created_at: "ASC" } })
  res.setHeader("Cache-Control", "public, max-age=300")
  res.json({ faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })) })
}
