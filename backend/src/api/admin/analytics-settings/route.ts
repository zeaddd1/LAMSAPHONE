import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AnalyticsInput, getAnalyticsSettings, saveAnalyticsSettings } from "../../../lib/analytics-settings"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ settings: await getAnalyticsSettings(req.scope) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = AnalyticsInput.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" })
    return
  }
  res.json({ settings: await saveAnalyticsSettings(req.scope, parsed.data) })
}
