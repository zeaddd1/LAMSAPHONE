import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAnalyticsSettings } from "../../../lib/analytics-settings"

// المعرّفات العامة فقط للواجهة
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const s = await getAnalyticsSettings(req.scope)
  res.setHeader("Cache-Control", "public, max-age=300")
  res.json(s)
}
