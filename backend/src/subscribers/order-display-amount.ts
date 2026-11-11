import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { EXCHANGE_RATE_MODULE } from "../modules/exchange-rate"
import type ExchangeRateModuleService from "../modules/exchange-rate/service"
import { convertFromUsd, isDisplayCurrency } from "../lib/currency"

/**
 * عند إنشاء الطلب: يحسب الخادم المبلغ المستحق بعملة العرض التي اختارها العميل ويثبّته في metadata.
 * من المتصفح نأخذ "رمز العملة" فقط (cart.metadata.display_currency)، ولا نأخذ أي مبلغ.
 * المبلغ يُحسب من إجمالي الطلب بالدولار (محسوب في الخادم) وسعر الصرف الحالي.
 */
export default async function orderDisplayAmount({ event, container }: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderService = container.resolve(Modules.ORDER)
  const rates: ExchangeRateModuleService = container.resolve(EXCHANGE_RATE_MODULE)

  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "total", "currency_code", "metadata"],
    filters: { id: event.data.id },
  })
  const order = data[0]
  if (!order) return

  const requested = (order.metadata as any)?.display_currency
  let code = isDisplayCurrency(requested) ? requested : "USD"

  const [rate] = await rates.listExchangeRates({ code, is_active: true })
  if (!rate || Number(rate.rate_per_usd) <= 0) code = "USD"

  const ratePerUsd = code === "USD" ? 1 : Number(rate!.rate_per_usd)
  const step = code === "USD" ? 0.01 : Number(rate!.rounding_step)
  const totalUsd = Number(order.total)

  await orderService.updateOrders(order.id, {
    metadata: {
      ...(order.metadata ?? {}),
      display_currency: code,
      rate_used: ratePerUsd,
      rounding_step: step,
      amount_due_display: convertFromUsd(totalUsd, ratePerUsd, step),
      amount_usd: totalUsd,
      rate_timestamp: new Date().toISOString(),
    },
  })
  logger.info(`order ${order.id}: amount due pinned in ${code}`)
}

export const config: SubscriberConfig = { event: "order.placed" }
