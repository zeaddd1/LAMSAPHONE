import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { POST_STYLES, autoPostText, autoStyle, buildCaption, buildThreadsText, hashtagComment, pickHook, productUrl, shortLinks } from "./caption"
import { backendUrl, buildMetaFeed, clearMetaFeedCache, storeUrl } from "../meta-feed-builder"
import { addComment, getPage, postReelToInstagram, postStoryToInstagram, postToFacebook, postToInstagram, postToTelegram, postToThreads, postVideoToFacebook, pushToCatalog } from "./meta-graph"
import { getMetaSettings, getTelegramSettings } from "./meta-settings"
import { whatsappNumber } from "../assistant/engine"
import { autoClosing, getPostTexts } from "../site-texts"
import type { PublishBody } from "../../api/admin/quick-add/validators"

// النشر على ميتا (فيسبوك، إنستغرام منشور وقصة، Threads، الكتالوج) من مكان واحد:
// زر «نشر الآن»، والمنشورات المجدولة، والنشر التلقائي اليومي (المهمة jobs/meta-autopost).
// كل وجهة مستقلة: فشل واحدة لا يوقف الباقي.

export type Result = { ok: boolean; url?: string; error?: string; skipped?: boolean; comment_error?: string }
export type PublishOutput = { status: number; message?: string; link?: string; caption?: string; results?: Record<string, Result> }
type Scope = { resolve: (key: string) => any }

export const DESTINATIONS = ["facebook", "instagram", "ig_story", "threads", "telegram", "catalog"] as const

const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : `${backendUrl().replace(/\/$/, "")}/${u.replace(/^\//, "")}`)

export async function publishToMeta(scope: Scope, b: PublishBody): Promise<PublishOutput> {
  // منشور حر من «استوديو الصور»: بلا منتج في المتجر، بصور مرفوعة واسم وسعر ونص
  const free = !b.product_id
  let p: any
  if (free) {
    if (!b.images?.length || !(b.title || "").trim()) return { status: 400, message: "أضف صورة واحدة على الأقل وعنواناً للمنشور" }
    p = { id: "", title: b.title!.trim(), handle: "", metadata: { meta_images: b.images }, images: [], variants: [] }
  } else {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "description", "thumbnail", "metadata", "categories.name", "images.url", "variants.prices.amount", "variants.prices.currency_code"],
      filters: { id: b.product_id },
    })
    p = (data as any[])[0]
    if (!p) return { status: 404, message: "المنتج غير موجود" }
  }

  const s = await getMetaSettings(scope)
  const cfg = { token: s.token, version: s.graph_version }
  const link = free ? storeUrl() : productUrl(p.handle, storeUrl())
  const prices = (p.variants || []).flatMap((v: any) => v.prices || []).filter((x: any) => x.currency_code === "usd")
  const price = free ? b.price : prices.length ? Math.min(...prices.map((x: any) => Number(x.amount))) : undefined
  const short = free ? { shop: storeUrl().replace(/^https?:\/\//, "").replace(/\/$/, ""), wa: `wa.me/${whatsappNumber()}` } : shortLinks(p.id, storeUrl())
  // بلا نص من المدير: نص جاهز من مواصفات المنتج وشارته وقسمه
  const text = free ? b.text || "" : b.text ?? autoPostText({ specs: p.metadata?.specs, badge: p.metadata?.badge, storage: p.metadata?.storage, description: p.description, categoryNames: (p.categories || []).map((c: any) => c.name) })
  // البداية التشويقية: المختارة، وإلا تلقائية حسب أسلوب المنتج (للنشر التلقائي والمجدول أيضاً)
  const style = POST_STYLES.some((x) => x.key === b.style) ? b.style! : autoStyle(p.metadata?.badge, p.metadata?.specs)
  const pt = await getPostTexts(scope)
  const hook = b.hook ?? (free ? "" : pickHook(style, p.title, p.id, pt.openings))
  // خاتمة الثقة والضمان: المختارة، وإلا التلقائية (وارد أمريكي لسامسونج)
  const closing = b.closing ?? autoClosing(pt, p.metadata?.brand)
  const caption = buildCaption({ title: p.title, price, text, hook, closing, link: short.shop, waLink: short.wa, network: "facebook" })
  const igCaption = buildCaption({ title: p.title, price, text, hook, closing, link: short.shop, waLink: short.wa, network: "instagram" })
  const threadsText = buildThreadsText({ title: p.title, price, text, hook, closing, link: short.shop, waLink: short.wa })
  // الهاشتاقات لا تدخل نص المنشور ولا المنتج: تُنشر كأول تعليق
  const comment = hashtagComment(b.hashtags)

  // ميتا تحتاج JPEG برابط عام: نسخ الإضافة السريعة، وإلا صور المنتج نفسها
  // صور مختارة من «استوديو الصور» لمنتج موجود تأخذ الأولوية على صوره المحفوظة
  const metaImages: string[] = b.images?.length ? b.images : Array.isArray(p.metadata?.meta_images) ? p.metadata.meta_images : []
  const images = (metaImages.length ? metaImages : [p.thumbnail, ...(p.images || []).map((i: any) => i.url)])
    .filter(Boolean)
    .map(abs)
    .filter((u: string, i: number, a: string[]) => a.indexOf(u) === i)
    .slice(0, 10) // منشور إنستغرام وألبوم فيسبوك: 10 صور كحد أقصى
  const local = images.some((u) => /localhost|127\.0\.0\.1/.test(u))
  // فيديو المنتج (MP4 فقط تقبله ميتا)
  const vids: any[] = Array.isArray(p.metadata?.videos) ? p.metadata.videos : []
  const vid = b.use_video ? vids.find((v) => v?.type === "mp4" && v?.url) : undefined
  const videoUrl = vid ? abs(vid.url) : ""
  const coverUrl = vid?.poster ? abs(vid.poster) : undefined

  const results: Record<string, Result> = {}
  const need = (on: boolean, ok: boolean, why: string): Result | null => (!on ? { ok: false, skipped: true } : !ok ? { ok: false, error: why } : null)

  if (!s.token && (b.facebook || b.instagram || b.ig_story || b.catalog) && !b.threads && !b.telegram) {
    return { status: 200, link, caption, results: { all: { ok: false, error: "ميتا غير مربوطة بعد: افتح صفحة ربط ميتا" } } }
  }
  if (local) return { status: 200, link, caption, results: { all: { ok: false, error: "روابط الصور محلية، ميتا لا تستطيع قراءتها" } } }

  let page: Awaited<ReturnType<typeof getPage>> | null = null
  if ((b.facebook || b.instagram || b.ig_story) && s.token && s.page_id) {
    try {
      page = await getPage(cfg, s.page_id)
    } catch (e: any) {
      results.page = { ok: false, error: e.message }
    }
  }

  results.facebook = need(b.facebook, Boolean(page), results.page?.error || "رقم صفحة فيسبوك غير مضبوط") || (await run(() => (videoUrl ? postVideoToFacebook(cfg, page!, videoUrl, caption) : postToFacebook(cfg, page!, images, caption)), (id) => addComment(cfg, id, page!.page_token, comment), comment))
  const igId = s.ig_user_id || page?.ig?.id
  results.instagram =
    need(b.instagram, Boolean(page && igId), "لا يوجد حساب إنستغرام أعمال مربوط بالصفحة") ||
    (await run(() => (videoUrl ? postReelToInstagram(cfg, igId!, page!.page_token, videoUrl, igCaption, coverUrl) : postToInstagram(cfg, igId!, page!.page_token, images, igCaption)), (id) => addComment(cfg, id, page!.page_token, comment), comment))
  // القصة: صورة القصة أو أول صورة (أو الفيديو)، بلا نص لأن القصص لا تقبل نصاً عبر الـ API
  results.ig_story =
    need(b.ig_story, Boolean(page && igId), "لا يوجد حساب إنستغرام أعمال مربوط بالصفحة") ||
    (await run(() => postStoryToInstagram(cfg, igId!, page!.page_token, videoUrl ? { videoUrl } : { imageUrl: b.story_image ? abs(b.story_image) : images[0] })))
  // Threads: الصور (حتى 10) مع نص مختصر وروابط قابلة للضغط. الفيديو لا يُنشر هنا (الصور بدلاً منه)
  results.threads =
    need(b.threads, Boolean(s.threads_token && s.threads_user_id), "Threads غير مربوط: افتح صفحة ربط ميتا ← Threads") ||
    (await run(() => postToThreads(s.threads_token, s.threads_user_id, images, threadsText)))
  // تيليجرام: الصور مع نص المنشور الكامل (روابطه قابلة للضغط) وأزرار الطلب
  const tg = b.telegram ? await getTelegramSettings(scope) : null
  const shopUrl = free ? storeUrl() : `https://${short.shop}`
  results.telegram =
    need(b.telegram, Boolean(tg?.bot_token && tg?.chat_id), "تيليجرام غير مربوط: افتح صفحة ربط ميتا ← تيليجرام") ||
    (await run(() =>
      postToTelegram(tg!.bot_token, tg!.chat_id, images, [caption, comment].filter(Boolean).join("\n\n"), [
        { text: "🛒 تسوّق", url: shopUrl },
        { text: "💬 واتساب", url: `https://${short.wa.replace(/^https?:\/\//, "")}` },
      ])
    ))
  results.catalog =
    need(b.catalog && !free, Boolean(s.token && s.catalog_id), "رقم الكتالوج غير مضبوط") ||
    (await run(async () => {
      clearMetaFeedCache()
      const { items } = await buildMetaFeed(scope, { productIds: [p.id] })
      await pushToCatalog(cfg, s.catalog_id, items)
      return { url: `https://business.facebook.com/commerce/catalogs/${s.catalog_id}/products` }
    }))
  delete results.page

  // نسجّل آخر نشر ناجح لكل وجهة في المنتج، لتظهر حالته في قائمة المنتجات (ويتخطاه النشر التلقائي)
  if (!free) {
    try {
      const prev = (p.metadata?.meta_published || {}) as Record<string, any>
      const next = { ...prev }
      for (const k of DESTINATIONS) {
        const r = results[k]
        if (r?.ok) next[k] = { at: new Date().toISOString(), url: r.url || null }
      }
      const meta = { ...(p.metadata || {}), meta_published: next }
      // طُلب «مع النشر التلقائي» ثم نُشر: يخرج من أولوية القائمة
      if (Object.values(results).some((r) => r.ok)) delete (meta as any).autopost_priority
      if (JSON.stringify(meta) !== JSON.stringify(p.metadata || {})) {
        await scope.resolve(Modules.PRODUCT).updateProducts(p.id, { metadata: meta })
      }
    } catch {
      /* لا نفشل النشر بسبب التسجيل */
    }
  }
  return { status: 200, link, caption, results }
}

// ينفّذ النشر، ثم يضيف تعليق الهاشتاقات إن وُجد (فشل التعليق لا يُفشل المنشور)
async function run(fn: () => Promise<{ id?: string; url?: string }>, commentFn?: (id: string) => Promise<unknown>, comment?: string): Promise<Result> {
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

// ---------- الجدولة والنشر التلقائي (تُحفظ في بيانات المتجر، بلا جداول جديدة) ----------
// meta_schedule: منشورات بوقت محدد. meta_autopost: إعدادات النشر التلقائي اليومي.

export type ScheduleItem = {
  id: string
  at: string // ISO
  label: string
  body: PublishBody
  status: "pending" | "running" | "done" | "failed" | "cancelled"
  created_at: string
  done_at?: string
  results?: Record<string, Result>
  error?: string
}

// خطط النشر التلقائي: كل خطة مستقلة بأيامها وساعاتها ومنصاتها (فيسبوك وحده، إنستغرام وحده، Threads وحده،
// تيليجرام وحده، أو أي مزيج). كل خطة تنشر المنتجات التي لم تُنشر بعد على منصاتها هي، فلا تتعارض الخطط.
export type Dest = (typeof DESTINATIONS)[number]
export type Plan = {
  id: string
  name: string
  enabled: boolean
  days: number[] // 0 = الأحد … 6 = السبت
  hours: number[] // بتوقيت اليمن (UTC+3)، حتى 6
  per_run: number // 1 إلى 5
  dests: Dest[]
  last_slot?: string
}

export const DEFAULT_PLAN: Plan = { id: "p_meta", name: "فيسبوك وإنستغرام", enabled: false, days: [0, 1, 2, 3, 4, 5, 6], hours: [11, 20], per_run: 1, dests: ["facebook", "instagram"] }
const YEMEN_OFFSET_H = 3
const MAX_QUEUE = 150
const MAX_PLANS = 12

async function storeOf(scope: Scope) {
  const svc = scope.resolve(Modules.STORE)
  const [store] = await svc.listStores({}, { take: 1, select: ["id", "metadata"] })
  return { svc, store }
}

const ints = (a: any, min: number, max: number) =>
  Array.from(new Set<number>((Array.isArray(a) ? a : []).map((d: any) => Math.floor(Number(d))).filter((d: number) => d >= min && d <= max))).sort((x, y) => x - y)

export function cleanPlan(x: any, i = 0): Plan {
  const per = Math.floor(Number(x?.per_run))
  const dests = (Array.isArray(x?.dests) ? x.dests : []).filter((d: any) => (DESTINATIONS as readonly string[]).includes(d))
  return {
    id: typeof x?.id === "string" && /^[\w-]{1,30}$/.test(x.id) ? x.id : `p${Date.now().toString(36)}${i}`,
    name: (typeof x?.name === "string" && x.name.trim() ? x.name.trim() : "خطة").slice(0, 40),
    enabled: Boolean(x?.enabled),
    days: Array.isArray(x?.days) ? ints(x.days, 0, 6) : DEFAULT_PLAN.days,
    hours: ints(x?.hours, 0, 23).slice(0, 6),
    per_run: per >= 1 && per <= 5 ? per : 1,
    dests: Array.from(new Set<Dest>(dests)),
    ...(typeof x?.last_slot === "string" ? { last_slot: x.last_slot } : {}),
  }
}

// أول مرة: تُنقل الإعدادات السابقة (النشر التلقائي لميتا وخطة تيليجرام) إلى خطط
function plansFrom(m: any): Plan[] {
  if (Array.isArray(m?.meta_plans)) return m.meta_plans.slice(0, MAX_PLANS).map(cleanPlan)
  const out: Plan[] = []
  const a = m?.meta_autopost
  if (a) {
    const dests = (["facebook", "instagram", "ig_story", "threads", "catalog"] as Dest[]).filter((d) => a[d])
    out.push(cleanPlan({ id: "p_meta", name: "ميتا", enabled: a.enabled, days: [0, 1, 2, 3, 4, 5, 6], hours: a.hours, per_run: a.per_run, dests: dests.length ? dests : DEFAULT_PLAN.dests }))
  }
  const t = m?.telegram?.plan
  if (t) out.push(cleanPlan({ id: "p_tg", name: "تيليجرام", enabled: t.enabled, days: t.days, hours: t.hours || (t.hour !== undefined ? [t.hour] : [20]), per_run: t.per_run, dests: ["telegram"] }))
  return out.length ? out : [{ ...DEFAULT_PLAN }]
}

export async function getScheduleState(scope: Scope): Promise<{ queue: ScheduleItem[]; plans: Plan[] }> {
  const { store } = await storeOf(scope)
  const m = (store?.metadata || {}) as any
  return { queue: Array.isArray(m.meta_schedule) ? m.meta_schedule : [], plans: plansFrom(m) }
}

// يقرأ أحدث نسخة من بيانات المتجر ثم يكتب المفتاح المطلوب فقط (حتى لا يمسح إعدادات أخرى حُفظت للتو)
async function patchStore(scope: Scope, key: "meta_schedule" | "meta_plans", fn: (cur: any, all: any) => any) {
  const { svc, store } = await storeOf(scope)
  if (!store) throw new Error("no store")
  const all = (store.metadata || {}) as any
  const next = fn(all[key], all)
  await svc.updateStores(store.id, { metadata: { ...all, [key]: next } })
  return next
}

// حفظ الخطط من اللوحة: نحافظ على آخر فترة نُشرت فيها كل خطة حتى لا تتكرر في نفس الساعة
export async function savePlans(scope: Scope, input: any[]): Promise<Plan[]> {
  return patchStore(scope, "meta_plans", (_cur, all) => {
    const prev = new Map(plansFrom(all).map((p) => [p.id, p]))
    return (Array.isArray(input) ? input : []).slice(0, MAX_PLANS).map((x, i) => {
      const p = cleanPlan(x, i)
      const old = prev.get(p.id)
      if (old?.last_slot) p.last_slot = old.last_slot
      else delete p.last_slot
      return p
    })
  })
}

export async function markPlanSlot(scope: Scope, id: string, key: string) {
  await patchStore(scope, "meta_plans", (_cur, all) => plansFrom(all).map((p) => (p.id === id ? { ...p, last_slot: key } : p)))
}

// هل حان وقت هذه الخطة الآن؟
export const planDue = (p: Plan, slot: { day: number; hour: number; key: string }) =>
  p.enabled && p.dests.length > 0 && p.days.includes(slot.day) && p.hours.includes(slot.hour) && p.last_slot !== slot.key

export async function enqueue(scope: Scope, at: Date, body: PublishBody, label: string): Promise<ScheduleItem> {
  const item: ScheduleItem = { id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: at.toISOString(), label: label.slice(0, 120), body: { ...body, schedule_at: undefined } as any, status: "pending", created_at: new Date().toISOString() }
  await patchStore(scope, "meta_schedule", (cur) => trimQueue([...(Array.isArray(cur) ? cur : []), item]))
  return item
}

// يبقي كل المنتظرة، وآخر المنتهية فقط
function trimQueue(q: ScheduleItem[]): ScheduleItem[] {
  const pending = q.filter((x) => x.status === "pending" || x.status === "running")
  const rest = q.filter((x) => !(x.status === "pending" || x.status === "running")).sort((a, b) => (b.done_at || b.at).localeCompare(a.done_at || a.at))
  return [...pending, ...rest].slice(0, Math.max(MAX_QUEUE, pending.length))
}

export async function updateItem(scope: Scope, id: string, patch: Partial<ScheduleItem>) {
  await patchStore(scope, "meta_schedule", (cur) => trimQueue((Array.isArray(cur) ? cur : []).map((x: ScheduleItem) => (x.id === id ? { ...x, ...patch } : x))))
}

export async function runItem(scope: Scope, item: ScheduleItem): Promise<void> {
  await updateItem(scope, item.id, { status: "running" })
  try {
    const out = await publishToMeta(scope, item.body)
    const ok = out.status === 200 && Object.values(out.results || {}).some((r) => r.ok)
    await updateItem(scope, item.id, { status: ok ? "done" : "failed", done_at: new Date().toISOString(), results: out.results, error: out.message })
  } catch (e: any) {
    await updateItem(scope, item.id, { status: "failed", done_at: new Date().toISOString(), error: e?.message || String(e) })
  }
}

// الساعة الحالية بتوقيت اليمن، ومفتاح الفترة (يوم + ساعة) حتى لا يتكرر النشر في نفس الساعة
export function yemenSlot(now = new Date()): { hour: number; key: string; day: number } {
  const y = new Date(now.getTime() + YEMEN_OFFSET_H * 3600_000)
  // day: 0 = الأحد … 6 = السبت
  return { hour: y.getUTCHours(), key: `${y.toISOString().slice(0, 10)}-${y.getUTCHours()}`, day: y.getUTCDay() }
}

// المنتجات التالية للنشر التلقائي: الظاهرة في المتجر، لم تُنشر بعد على أي وجهة مختارة.
// «مع النشر التلقائي» من صفحة المنتج تجعله أولاً، ثم ترتيب العرض (1، 2، 3…)، ثم الأحدث.
export async function nextAutopostProducts(scope: Scope, dests: readonly Dest[], limit: number): Promise<{ id: string; title: string }[]> {
  const products = scope.resolve(Modules.PRODUCT)
  const list = await products.listProducts({ status: "published" }, { take: 1000, select: ["id", "title", "metadata", "created_at"] })
  const fresh = list.filter((p: any) => {
    const pub = (p.metadata?.meta_published || {}) as Record<string, unknown>
    return !p.metadata?.autopost_skip && dests.length > 0 && dests.every((d) => !pub[d])
  })
  const rank = (p: any) => (typeof p.metadata?.rank === "number" ? p.metadata.rank : Number.MAX_SAFE_INTEGER)
  fresh.sort((x: any, y: any) => {
    const px = x.metadata?.autopost_priority ? 0 : 1
    const py = y.metadata?.autopost_priority ? 0 : 1
    if (px !== py) return px - py
    if (rank(x) !== rank(y)) return rank(x) - rank(y)
    return String(y.created_at).localeCompare(String(x.created_at))
  })
  return fresh.slice(0, limit).map((p: any) => ({ id: p.id, title: p.title }))
}

// نشر خطة: منتجاتها التالية على منصاتها هي فقط
export async function runPlan(scope: Scope, p: Plan, logger?: { info: (m: string) => void }) {
  const next = await nextAutopostProducts(scope, p.dests, p.per_run)
  const flags = Object.fromEntries(DESTINATIONS.map((d) => [d, p.dests.includes(d)]))
  for (const prod of next) {
    const out = await publishToMeta(scope, { product_id: prod.id, ...flags, use_video: true } as any)
    const summary = Object.entries(out.results || {})
      .filter(([, r]) => !r.skipped)
      .map(([k, r]) => `${k}:${r.ok ? "ok" : r.error}`)
      .join(" ")
    logger?.info(`meta-autopost: [${p.name}] ${prod.title} → ${summary || out.message}`)
  }
}
