import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { analyze, correctArabic, reply } from "../../../../lib/assistant/brain"
import { botContext } from "../../../../lib/assistant/engine"
import type { TestBody } from "../validators"

// تجربة الرد الآلي من اللوحة دون إرسال شيء لأي عميل
export async function POST(req: MedusaRequest<TestBody>, res: MedusaResponse) {
  const ctx = await botContext(req.scope)
  const r = reply(req.validatedBody.text, ctx)
  const a = analyze(req.validatedBody.text)
  res.json({ ...r, understood: [...a.concepts], corrected: a.corrected, corrected_text: correctArabic(req.validatedBody.text) })
}
