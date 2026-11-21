import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { POST_STYLES, autoPostText, autoStyle, buildCaption, buildThreadsText, hashtagComment, hooksFor, pickHook, policyWarnings, shortLinks, suggestHashtags } from "../../../../lib/quick-add/caption"
import { storeUrl } from "../../../../lib/meta-feed-builder"
import type { PreviewBody } from "../validators"

// معاينة نص المنشور، ونص جاهز من بيانات المنتج (auto_text)، واقتراح هاشتاقات (لا يحفظ شيئاً)
export async function POST(req: MedusaRequest<PreviewBody>, res: MedusaResponse) {
  const b = req.validatedBody
  let title = b.title
  let price = b.price
  let specs = b.specs
  let badge = b.badge
  let categoryNames = b.category_names || []
  let productId: string | undefined
  let storage: string | undefined
  let description: string | undefined
  // منتج موجود: نقرأ بياناته الحالية (بعد آخر تعديل للمواصفات والقوائم)
  if (b.product_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "description", "metadata", "categories.name", "variants.prices.amount", "variants.prices.currency_code"],
      filters: { id: b.product_id },
    })
    const p = (data as any[])[0]
    if (p) {
      productId = p.id
      title = title || p.title
      const usd = (p.variants || []).flatMap((v: any) => v.prices || []).filter((x: any) => x.currency_code === "usd").map((x: any) => Number(x.amount))
      price = price ?? (usd.length ? Math.min(...usd) : undefined)
      specs = specs ?? p.metadata?.specs
      badge = badge ?? p.metadata?.badge
      storage = p.metadata?.storage
      description = p.description
      if (!categoryNames.length) categoryNames = (p.categories || []).map((c: any) => c.name).filter(Boolean)
    }
  }
  const auto_text = autoPostText({ specs, badge, storage, description, categoryNames })
  // الروابط القصيرة تُعرف بعد إنشاء المنتج، فنعرض شكلها فقط في المعاينة
  const host = storeUrl().replace(/^https?:\/\//, "").replace(/\/$/, "")
  const links = productId ? shortLinks(productId, storeUrl()) : { shop: `${host}/p/…`, wa: `${host}/wa/…` }
  const text = b.text ?? auto_text
  // الأسلوب والبداية: المختار، وإلا التلقائي حسب الشارة والمواصفات
  const name = title || "المنتج"
  const style = POST_STYLES.some((s) => s.key === b.style) ? b.style! : autoStyle(badge, specs)
  const hooks = hooksFor(style, name)
  const hook = b.hook ?? pickHook(style, name, productId || name)
  res.json({
    auto_text,
    styles: POST_STYLES.map((s) => ({ key: s.key, label: s.label })),
    style,
    hooks,
    hook,
    suggested: suggestHashtags(title, categoryNames),
    // نص المنشور بلا هاشتاقات، والهاشتاقات في أول تعليق
    ig_caption: buildCaption({ title: title || "اسم المنتج", price, text, hook, link: links.shop, waLink: links.wa, network: "instagram" }),
    caption: buildCaption({ title: title || "اسم المنتج", price, text, hook, link: links.shop, waLink: links.wa }),
    threads: buildThreadsText({ title: title || "اسم المنتج", price, text, hook, link: links.shop, waLink: links.wa }),
    comment: hashtagComment(b.hashtags),
    warnings: policyWarnings([hook, text, b.hashtags || ""].join("\n")),
  })
}
