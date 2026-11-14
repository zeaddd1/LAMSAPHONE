import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runReorganize } from "../../../../scripts/reorganize-catalog"

// تشغيل لمرة واحدة من المتصفح بعد تسجيل الدخول إلى لوحة الإدارة:
//   /admin/custom/reorganize-catalog?prices={"s24-ultra":350}
// يحتاج جلسة الإدارة، فلا يعمل لأي شخص آخر.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  let prices: Record<string, number> = {}
  try {
    const raw = (req.query.prices as string) || "{}"
    prices = JSON.parse(raw)
  } catch {
    res.status(400).json({ message: "prices يجب أن يكون JSON صالحاً" })
    return
  }
  const log = await runReorganize(req.scope, prices)
  res.json({ log })
}
