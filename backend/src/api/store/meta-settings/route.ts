import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMetaSettings } from "../../../lib/meta-settings"

// عام للواجهة: فقط ما يلزم المتصفح (رقم Pixel ورمز توثيق الدومين)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const s = await getMetaSettings(req.scope)
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ pixel_id: s.pixel_id, domain_verification: s.domain_verification, whatsapp_number: s.whatsapp_number })
}
