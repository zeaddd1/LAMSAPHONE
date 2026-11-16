import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ASSISTANT_MODULE } from "../../modules/assistant"
import type AssistantModuleService from "../../modules/assistant/service"
import { storeUrl } from "../meta-feed-builder"
import { productUrl } from "../quick-add/caption"
import { getMetaSettings } from "../quick-add/meta-settings"
import { Product, reply } from "./brain"
import { Channel, Incoming, sendRequest } from "./channels"
import { getAssistantSettings } from "./settings"

type Scope = { resolve: (key: string) => any }

export const whatsappNumber = () => process.env.WHATSAPP_NUMBER || "967770777736"
const svc = (scope: Scope) => scope.resolve(ASSISTANT_MODULE) as AssistantModuleService

// قائمة المنتجات للرد الآلي: كاش 5 دقائق حتى لا نثقل قاعدة البيانات
let productCache: { at: number; items: Product[] } | null = null
export async function loadProducts(scope: Scope): Promise<Product[]> {
  if (productCache && Date.now() - productCache.at < 5 * 60 * 1000) return productCache.items
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["title", "handle", "categories.name", "variants.prices.amount", "variants.prices.currency_code"],
    filters: { status: "published" },
    pagination: { take: 500, skip: 0 },
  })
  const items = (data as any[]).map((p) => {
    const usd = (p.variants || []).flatMap((v: any) => v.prices || []).filter((x: any) => x.currency_code === "usd").map((x: any) => Number(x.amount))
    return { title: p.title, handle: p.handle, price: usd.length ? Math.min(...usd) : null, category: (p.categories || []).map((c: any) => c?.name).filter(Boolean).join(" ") }
  })
  productCache = { at: Date.now(), items }
  return items
}
export const clearProductCache = () => (productCache = null)

export async function botContext(scope: Scope) {
  const [products, faqs] = await Promise.all([loadProducts(scope), svc(scope).listAssistantFaqs({ is_active: true }, { take: 500 })])
  return { storeUrl: storeUrl(), whatsapp: whatsappNumber(), products, faqs, productUrl: (h: string) => productUrl(h, storeUrl()) }
}

// إرسال رسالة نصية إلى العميل عبر قناته
export async function sendToCustomer(scope: Scope, channel: string, to: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (channel === "test") return { ok: true }
  const meta = await getMetaSettings(scope)
  const s = await getAssistantSettings(scope)
  if (!meta.token) return { ok: false, error: "ميتا غير مربوطة (لا يوجد رمز وصول)" }
  const { path, body } = sendRequest(channel as Channel, { page_id: meta.page_id, wa_phone_number_id: s.wa_phone_number_id }, to, text)
  if (path.startsWith("undefined") || path.startsWith("/")) return { ok: false, error: "رقم الصفحة أو رقم هاتف واتساب غير مضبوط" }
  try {
    // رمز الصفحة لماسنجر وإنستغرام، ورمز مستخدم النظام لواتساب
    let token = meta.token
    if (channel !== "whatsapp") {
      const r = await fetch(`https://graph.facebook.com/${meta.graph_version}/${meta.page_id}?fields=access_token`, { headers: { Authorization: `Bearer ${meta.token}` } })
      const j: any = await r.json().catch(() => ({}))
      if (j.access_token) token = j.access_token
    }
    const res = await fetch(`https://graph.facebook.com/${meta.graph_version}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const j: any = await res.json().catch(() => ({}))
    if (!res.ok || j.error) return { ok: false, error: j.error?.error_user_msg || j.error?.message || `HTTP ${res.status}` }
    return { ok: true, id: j.message_id || j.messages?.[0]?.id }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

// معالجة رسالة واردة: حفظها، ثم الرد الآلي إن كانت المحادثة في وضع الآلي
export async function handleIncoming(scope: Scope, m: Incoming | (Omit<Incoming, "channel"> & { channel: "test" })) {
  const s = svc(scope)
  const settings = await getAssistantSettings(scope)

  // منع التكرار: ميتا قد ترسل نفس الرسالة مرتين
  if (m.mid) {
    const dup = await s.listAssistantMessages({ external_id: m.mid }, { take: 1 })
    if (dup.length) return { duplicate: true }
  }

  let [conv] = await s.listAssistantConversations({ channel: m.channel, external_id: m.external_id }, { take: 1 })
  const now = new Date()
  if (!conv) {
    conv = await s.createAssistantConversations({ channel: m.channel, external_id: m.external_id, name: m.name || null })
  }

  await s.createAssistantMessages({ conversation_id: conv.id, direction: "in", sender: "customer", text: m.text, external_id: m.mid || null })

  // إذا مرّ وقت طويل على آخر رد للموظف، يعود الرد الآلي تلقائياً
  let mode = conv.mode
  if (mode === "human" && settings.human_timeout_min > 0) {
    const [lastStaff] = await s.listAssistantMessages(
      { conversation_id: conv.id, sender: "staff" },
      { take: 1, order: { created_at: "DESC" } }
    )
    // يعود الآلي فقط إذا رد الموظف ثم انقطع، وليس قبل أن يرد أحد، ولا أثناء طلب ينتظر التأكيد
    if (lastStaff && !conv.needs_human && conv.order_status !== "pending") {
      const idle = (now.getTime() - new Date(lastStaff.created_at as any).getTime()) / 60000
      if (idle > settings.human_timeout_min) mode = "bot"
    }
  }
  const channelOn = m.channel === "test" || (settings as any)[m.channel] !== false

  let botText: string | null = null
  let intent: string | null = null
  const patch: Record<string, unknown> = {
    id: conv.id,
    name: m.name || conv.name,
    status: "open",
    unread: (conv.unread || 0) + 1,
    last_text: m.text.slice(0, 300),
    last_message_at: now,
    mode,
  }

  if (mode === "bot" && channelOn) {
    const r = reply(m.text, await botContext(scope))
    botText = r.text
    intent = r.intent
    if (r.handoff) {
      patch.needs_human = true
      patch.mode = "human" // الموظف يكمل، والآلي يتوقف لهذه المحادثة
    }
    if (r.order) {
      patch.order_status = "pending"
      patch.order_note = (r.products || []).map((p) => `${p.title}${p.price ? ` (${p.price}$)` : ""}`).join("، ")
    }
    if (r.faq_id) {
      const [f] = await s.listAssistantFaqs({ id: r.faq_id }, { take: 1 })
      if (f) await s.updateAssistantFaqs({ id: f.id, hits: (f.hits || 0) + 1 })
    }
  } else {
    patch.needs_human = true
  }

  await s.updateAssistantConversations(patch as any)

  if (botText) {
    const sent = await sendToCustomer(scope, m.channel, m.external_id, botText)
    await s.createAssistantMessages({
      conversation_id: conv.id,
      direction: "out",
      sender: "bot",
      text: sent.ok ? botText : `${botText}\n\n⚠️ لم يُرسل: ${sent.error}`,
      external_id: sent.id || null,
      intent,
    })
  }
  return { conversation_id: conv.id, reply: botText, intent }
}
