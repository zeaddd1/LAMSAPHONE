import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { EXCHANGE_RATE_MODULE } from "../../../modules/exchange-rate"
import type ExchangeRateModuleService from "../../../modules/exchange-rate/service"

// عام: العملات الفعّالة فقط، مع كاش دقيقة واحدة لتخفيف الضغط على الخادم.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: ExchangeRateModuleService = req.scope.resolve(EXCHANGE_RATE_MODULE)
  const rows = await svc.listExchangeRates({ is_active: true })
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({
    exchange_rates: rows
      .filter((r) => Number(r.rate_per_usd) > 0)
      .map((r) => ({
        code: r.code,
        rate_per_usd: Number(r.rate_per_usd),
        rounding_step: Number(r.rounding_step),
        label_ar: r.label_ar,
        symbol: r.symbol,
        updated_at: r.updated_at,
      })),
  })
}
