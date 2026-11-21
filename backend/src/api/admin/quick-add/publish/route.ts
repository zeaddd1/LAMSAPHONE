import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { enqueue, publishToMeta } from "../../../../lib/quick-add/publish"
import type { PublishBody } from "../validators"

// النشر على ميتا: الآن، أو في وقت محدد (يُضاف لقائمة المجدول)، أو «مع النشر التلقائي» (أول القائمة اليومية)
export async function POST(req: MedusaRequest<PublishBody>, res: MedusaResponse) {
  const b = req.validatedBody

  if (b.autopost) {
    if (!b.product_id) {
      res.status(400).json({ message: "النشر التلقائي للمنتجات الموجودة في المتجر فقط" })
      return
    }
    const products = req.scope.resolve(Modules.PRODUCT)
    const p = await products.retrieveProduct(b.product_id, { select: ["id", "metadata"] }).catch(() => null)
    if (!p) {
      res.status(404).json({ message: "المنتج غير موجود" })
      return
    }
    await products.updateProducts(p.id, { metadata: { ...(p.metadata || {}), autopost_priority: new Date().toISOString(), autopost_skip: false } })
    res.json({ autopost: true })
    return
  }

  if (b.schedule_at) {
    const at = new Date(b.schedule_at)
    if (isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000) {
      res.status(400).json({ message: "اختر وقتاً صحيحاً في المستقبل" })
      return
    }
    let label = (b.title || "").trim()
    if (b.product_id) {
      const p = await req.scope.resolve(Modules.PRODUCT).retrieveProduct(b.product_id, { select: ["title"] }).catch(() => null)
      label = p?.title || label
    }
    const item = await enqueue(req.scope, at, b, label || "منشور")
    res.json({ scheduled: item })
    return
  }

  const out = await publishToMeta(req.scope, b)
  if (out.status !== 200) {
    res.status(out.status).json({ message: out.message })
    return
  }
  res.json({ link: out.link, caption: out.caption, results: out.results })
}
