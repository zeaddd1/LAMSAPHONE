import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * تنبيه المخزون المنخفض: بعد كل طلب نفحص أصناف الطلب ونكتب تحذيراً في السجل
 * إذا نزلت الكمية المتاحة عن LOW_STOCK_THRESHOLD (افتراضياً 3). لاحقاً يمكن تحويله لإشعار واتساب/بريد.
 */
export default async function lowStock({ event, container }: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 3)

  const { data } = await query.graph({
    entity: "order",
    fields: ["items.variant.sku", "items.variant.title", "items.variant.inventory_items.inventory.location_levels.available_quantity"],
    filters: { id: event.data.id },
  })
  for (const item of (data[0]?.items ?? []) as any[]) {
    const levels = item?.variant?.inventory_items?.flatMap((i: any) => i?.inventory?.location_levels ?? []) ?? []
    const available = levels.reduce((s: number, l: any) => s + Number(l?.available_quantity ?? 0), 0)
    if (levels.length && available <= threshold) {
      logger.warn(`LOW STOCK: ${item.variant.sku || item.variant.title} — available ${available}`)
    }
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
