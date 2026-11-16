import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildMetaFeed, clearMetaFeedCache } from "../../../../lib/meta-feed-builder"
import { pushToCatalog, removeFromCatalog } from "../../../../lib/quick-add/meta-graph"
import { getMetaSettings } from "../../../../lib/quick-add/meta-settings"
import type { CatalogBody } from "../validators"

// مزامنة كتالوج ميتا فوراً بعد تعديل سعر أو حذف منتج (بدل انتظار التحديث التلقائي كل ساعة)
export async function POST(req: MedusaRequest<CatalogBody>, res: MedusaResponse) {
  const b = req.validatedBody
  const s = await getMetaSettings(req.scope)
  if (!s.token || !s.catalog_id) {
    res.json({ ok: false, skipped: true, error: "الكتالوج غير مربوط" })
    return
  }
  const cfg = { token: s.token, version: s.graph_version }
  clearMetaFeedCache()
  try {
    if (b.remove) {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({ entity: "product", fields: ["id", "variants.id"], filters: { id: b.product_ids || [] } })
      const ids = (data as any[]).flatMap((p) => (p.variants || []).map((v: any) => v.id))
      await removeFromCatalog(cfg, s.catalog_id, ids)
      res.json({ ok: true, removed: ids.length })
      return
    }
    const { items, skipped } = await buildMetaFeed(req.scope, b.product_ids?.length ? { productIds: b.product_ids } : undefined)
    if (!items.length) {
      res.json({ ok: false, error: "لا توجد منتجات صالحة للكتالوج (سعر أو صورة ناقصة)", skipped_products: skipped })
      return
    }
    // ميتا تقبل حتى 5000 طلب في الدفعة؛ نرسل 500 في كل مرة
    for (let i = 0; i < items.length; i += 500) await pushToCatalog(cfg, s.catalog_id, items.slice(i, i + 500))
    res.json({ ok: true, updated: items.length, skipped_products: skipped })
  } catch (e: any) {
    res.json({ ok: false, error: e?.message || String(e) })
  }
}
