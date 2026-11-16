import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { correctArabic } from "../../../../lib/assistant/brain"
import type { CorrectBody } from "../validators"

// تصحيح لغوي لرد الموظف قبل إرساله (معاينة)
export async function POST(req: MedusaRequest<CorrectBody>, res: MedusaResponse) {
  res.json({ text: correctArabic(req.validatedBody.text) })
}
