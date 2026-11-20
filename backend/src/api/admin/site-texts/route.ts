import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SITE_TEXT_FIELDS, getSiteTextOverrides, saveSiteTextOverrides } from "../../../lib/site-texts"

// صفحة "نصوص المتجر": الحقول مع نصوصها الافتراضية والتعديلات المحفوظة
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ fields: SITE_TEXT_FIELDS, values: await getSiteTextOverrides(req.scope) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const values = await saveSiteTextOverrides(req.scope, (req.body as any)?.values ?? {})
  res.json({ fields: SITE_TEXT_FIELDS, values })
}
