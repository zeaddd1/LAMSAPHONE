import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { buildCaption, hashtagComment, productUrl } from "../../../../lib/quick-add/caption"
import { backendUrl, buildMetaFeed, clearMetaFeedCache, storeUrl } from "../../../../lib/meta-feed-builder"
import { addComment, getPage, postToFacebook, postToInstagram, pushToCatalog } from "../../../../lib/quick-add/meta-graph"
import { getMetaSettings } from "../../../../lib/quick-add/meta-settings"
import type { PublishBody } from "../validators"

type Result = { ok: boolean; url?: string; error?: string; skipped?: boolean; comment_error?: string }

const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : `${backendUrl().replace(/\/$/, "")}/${u.replace(/^\//, "")}`)

// نشر منتج موجود على ميتا. كل وجهة مستقلة: فشل واحدة لا يوقف الباقي.
export async function POST(req: MedusaRequest<PublishBody>, res: MedusaResponse) {
  const b = req.validatedBody
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "thumbnail", "metadata", "images.url", "variants.prices.amount", "variants.prices.currency_code"],
    filters: { id: b.product_id },
  })
  const p = (data as any[])[0]
  if (!p) {
    res.status(404).json({ message: "المنتج غير موجود" })
    return
  }

  const s = await getMetaSettings(req.scope)
  const cfg = { token: s.token, version: s.graph_version }
  const link = productUrl(p.handle, storeUrl())
  const prices = (p.variants || []).flatMap((v: any) => v.prices || []).filter((x: any) => x.currency_code === "usd")
  const price = prices.length ? Math.min(...prices.map((x: any) => Number(x.amount))) : undefined
  // الهاشتاقات لا تدخل نص المنشور ولا المنتج: تُنشر كأول تعليق
  const caption = buildCaption({ title: p.title, price, text: b.text, link, whatsapp: process.env.WHATSAPP_NUMBER || "967770777736" })
  const comment = hashtagComment(b.hashtags)

  // ميتا تحتاج JPEG برابط عام: نسخ الإضافة السريعة، وإلا صور المنتج نفسها
  const metaImages: string[] = Array.isArray(p.metadata?.meta_images) ? p.metadata.meta_images : []
  const images = (metaImages.length ? metaImages : [p.thumbnail, ...(p.images || []).map((i: any) => i.url)])
    .filter(Boolean)
    .map(abs)
    .filter((u: string, i: number, a: string[]) => a.indexOf(u) === i)
  const local = images.some((u) => /localhost|127\.0\.0\.1/.test(u))

  const results: Record<string, Result> = {}
  const need = (on: boolean, ok: boolean, why: string): Result | null => (!on ? { ok: false, skipped: true } : !ok ? { ok: false, error: why } : null)

  if (!s.token && (b.facebook || b.instagram || b.catalog)) {
    res.json({ link, caption, results: { all: { ok: false, error: "ميتا غير مربوطة بعد: افتح تبويب ربط ميتا" } } })
    return
  }
  if (local) {
    res.json({ link, caption, results: { all: { ok: false, error: "روابط الصور محلية، ميتا لا تستطيع قراءتها" } } })
    return
  }

  let page: Awaited<ReturnType<typeof getPage>> | null = null
  if ((b.facebook || b.instagram) && s.page_id) {
    try {
      page = await getPage(cfg, s.page_id)
    } catch (e: any) {
      results.page = { ok: false, error: e.message }
    }
  }

  results.facebook = need(b.facebook, Boolean(page), results.page?.error || "رقم صفحة فيسبوك غير مضبوط") || (await run(() => postToFacebook(cfg, page!, images, caption), (id) => addComment(cfg, id, page!.page_token, comment), comment))
  const igId = s.ig_user_id || page?.ig?.id
  results.instagram =
    need(b.instagram, Boolean(page && igId), "لا يوجد حساب إنستغرام أعمال مربوط بالصفحة") ||
    (await run(() => postToInstagram(cfg, igId!, page!.page_token, images, caption), (id) => addComment(cfg, id, page!.page_token, comment), comment))
  results.catalog =
    need(b.catalog, Boolean(s.catalog_id), "رقم الكتالوج غير مضبوط") ||
    (await run(async () => {
      clearMetaFeedCache()
      const { items } = await buildMetaFeed(req.scope, { productIds: [p.id] })
      await pushToCatalog(cfg, s.catalog_id, items)
      return { url: `https://business.facebook.com/commerce/catalogs/${s.catalog_id}/products` }
    }))
  delete results.page

  // نسجّل آخر نشر ناجح لكل وجهة في المنتج، لتظهر حالته في قائمة المنتجات
  try {
    const prev = (p.metadata?.meta_published || {}) as Record<string, any>
    const next = { ...prev }
    for (const k of ["facebook", "instagram", "catalog"]) {
      const r = results[k]
      if (r?.ok) next[k] = { at: new Date().toISOString(), url: r.url || null }
    }
    if (JSON.stringify(next) !== JSON.stringify(prev)) {
      await req.scope.resolve(Modules.PRODUCT).updateProducts(p.id, { metadata: { ...(p.metadata || {}), meta_published: next } })
    }
  } catch {
    /* لا نفشل النشر بسبب التسجيل */
  }
  res.json({ link, caption, results })
}

// ينفّذ النشر، ثم يضيف تعليق الهاشتاقات إن وُجد (فشل التعليق لا يُفشل المنشور)
async function run(
  fn: () => Promise<{ id?: string; url?: string }>,
  commentFn?: (id: string) => Promise<unknown>,
  comment?: string
): Promise<Result> {
  try {
    const r = await fn()
    const out: Result = { ok: true, url: r.url }
    if (comment && commentFn && r.id) {
      try {
        await commentFn(r.id)
      } catch (e: any) {
        out.comment_error = `نُشر المنشور، لكن تعذّر إضافة تعليق الهاشتاقات: ${e?.message || e}`
      }
    }
    return out
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}
