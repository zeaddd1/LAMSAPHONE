import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASSISTANT_MODULE } from "../../../../modules/assistant"
import type AssistantModuleService from "../../../../modules/assistant/service"
import type { FaqBody } from "../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  await s.ensureDefaultFaqs()
  const faqs = await s.listAssistantFaqs({}, { take: 500, order: { rank: "ASC", created_at: "ASC" } })
  res.json({ faqs })
}

export async function POST(req: MedusaRequest<FaqBody>, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  const faq = await s.createAssistantFaqs(req.validatedBody)
  res.json({ faq })
}
