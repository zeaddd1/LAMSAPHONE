import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getSiteTextOverrides, mergeSiteTexts } from "../../../lib/site-texts"

// نصوص واجهة المتجر النهائية (المعدّل من لوحة التحكم أو الافتراضي)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ texts: mergeSiteTexts(await getSiteTextOverrides(req.scope)) })
}
