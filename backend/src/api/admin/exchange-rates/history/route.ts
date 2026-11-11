import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { EXCHANGE_RATE_MODULE } from "../../../../modules/exchange-rate"
import type ExchangeRateModuleService from "../../../../modules/exchange-rate/service"

// آخر 20 تغييراً على أسعار الصرف
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc: ExchangeRateModuleService = req.scope.resolve(EXCHANGE_RATE_MODULE)
  const rows = await svc.listExchangeRateHistories({}, { order: { created_at: "DESC" }, take: 20 })
  res.json({ history: rows })
}
