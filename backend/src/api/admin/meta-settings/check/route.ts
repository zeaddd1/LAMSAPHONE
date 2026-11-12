import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { backendUrl, buildMetaFeed, clearMetaFeedCache } from "../../../../lib/meta-feed-builder"

// فحص الكتالوج من لوحة التحكم: عدد العناصر، المتوفر، المستبعد وسببه، وعينة من العناصر
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { items, skipped, products, currency } = await buildMetaFeed(req.scope)
  clearMetaFeedCache() // حتى تقرأ Meta آخر تعديل فوراً
  const count = (k: string, v: string) => items.filter((i) => i[k] === v).length
  res.json({
    feed_url: `${backendUrl().replace(/\/$/, "")}/feeds/meta.xml`,
    currency: currency.toUpperCase(),
    products,
    items: items.length,
    in_stock: count("g:availability", "in stock"),
    out_of_stock: count("g:availability", "out of stock"),
    condition: { new: count("g:condition", "new"), used: count("g:condition", "used"), refurbished: count("g:condition", "refurbished") },
    skipped,
    sample: items.slice(0, 20).map((i) => ({
      id: i["g:id"],
      title: i["g:title"],
      price: i["g:sale_price"] || i["g:price"],
      availability: i["g:availability"],
      condition: i["g:condition"],
      brand: i["g:brand"],
      image: i["g:image_link"],
      link: i["g:link"],
    })),
  })
}
