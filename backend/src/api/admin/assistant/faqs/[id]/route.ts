import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASSISTANT_MODULE } from "../../../../../modules/assistant"
import type AssistantModuleService from "../../../../../modules/assistant/service"
import type { FaqBody } from "../../validators"

export async function POST(req: MedusaRequest<FaqBody>, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  const [faq] = await s.updateAssistantFaqs([{ id: req.params.id, ...req.validatedBody }])
  res.json({ faq })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const s = req.scope.resolve(ASSISTANT_MODULE) as AssistantModuleService
  await s.deleteAssistantFaqs(req.params.id)
  res.json({ id: req.params.id, deleted: true })
}
