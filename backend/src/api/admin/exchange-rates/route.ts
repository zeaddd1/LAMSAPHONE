import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { EXCHANGE_RATE_MODULE } from "../../../modules/exchange-rate"
import type ExchangeRateModuleService from "../../../modules/exchange-rate/service"
import type { PostAdminExchangeRatesType } from "./validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc: ExchangeRateModuleService = req.scope.resolve(EXCHANGE_RATE_MODULE)
  await svc.ensureDefaults()
  const rows = await svc.listExchangeRates({}, { order: { code: "ASC" } })
  res.json({ exchange_rates: rows })
}

export async function POST(
  req: AuthenticatedMedusaRequest<PostAdminExchangeRatesType>,
  res: MedusaResponse
) {
  const svc: ExchangeRateModuleService = req.scope.resolve(EXCHANGE_RATE_MODULE)
  await svc.ensureDefaults()
  const changed = await svc.updateRatesWithHistory(
    req.validatedBody.rates,
    req.auth_context?.actor_id
  )
  const rows = await svc.listExchangeRates({}, { order: { code: "ASC" } })
  res.json({ changed, exchange_rates: rows })
}
