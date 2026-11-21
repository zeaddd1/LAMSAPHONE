import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createBackup } from "../meta-backup"
import { getThreadsProfile } from "./meta-graph"

// إعدادات ربط ميتا لصفحة الإضافة السريعة.
// تُحفظ في metadata المتجر (store.metadata.quick_add_meta): لا جدول ولا ترحيل، فلا تتأثر بتحديثات Medusa.
// متغيرات البيئة META_* (إن ضُبطت في Coolify) لها الأولوية على المحفوظ في اللوحة.

const digits = (min: number, max: number, msg: string) =>
  z.string().trim().regex(new RegExp(`^\\d{${min},${max}}$`), msg).or(z.literal(""))

export const MetaSettingsInput = z.object({
  // رمز مستخدم النظام (System User) من إعدادات الأعمال. فارغ = لا تغيير على المحفوظ
  token: z.string().trim().max(1000).optional(),
  page_id: digits(5, 25, "رقم صفحة فيسبوك أرقام فقط").default(""),
  catalog_id: digits(5, 25, "رقم الكتالوج أرقام فقط").default(""),
  // يُكتشف تلقائياً من الصفحة، ويمكن كتابته يدوياً
  ig_user_id: digits(5, 25, "رقم حساب إنستغرام أرقام فقط").default(""),
  clear_token: z.boolean().optional(),
  // Threads: رمز مستخدم Threads (صالح 60 يوماً ويُجدَّد تلقائياً) ورقم الحساب (يُكتشف من الرمز)
  threads_token: z.string().trim().max(1000).optional(),
  threads_user_id: digits(5, 30, "رقم حساب Threads أرقام فقط").optional(),
  clear_threads_token: z.boolean().optional(),
})
export type MetaSettingsInput = z.infer<typeof MetaSettingsInput>

export type MetaSettings = {
  token: string
  page_id: string
  catalog_id: string
  ig_user_id: string
  graph_version: string
  threads_token: string
  threads_user_id: string
  threads_token_at: string
}

const KEY = "quick_add_meta"
type Scope = { resolve: (key: string) => any }

async function getStore(scope: Scope) {
  const storeService = scope.resolve(Modules.STORE)
  const [store] = await storeService.listStores({}, { take: 1 })
  return { storeService, store }
}

export async function getMetaSettings(scope: Scope): Promise<MetaSettings> {
  const { store } = await getStore(scope)
  const saved = ((store?.metadata as any)?.[KEY] || {}) as Partial<MetaSettings>
  const env = process.env
  return {
    token: env.META_ACCESS_TOKEN || saved.token || "",
    page_id: env.META_PAGE_ID || saved.page_id || "",
    catalog_id: env.META_CATALOG_ID || saved.catalog_id || "",
    ig_user_id: env.META_IG_USER_ID || saved.ig_user_id || "",
    graph_version: env.META_GRAPH_VERSION || "v24.0",
    threads_token: env.THREADS_ACCESS_TOKEN || saved.threads_token || "",
    threads_user_id: env.THREADS_USER_ID || saved.threads_user_id || "",
    threads_token_at: saved.threads_token_at || "",
  }
}

// تجديد رمز Threads يحفظ الرمز الجديد فقط (بلا نسخة احتياطية، يعمل تلقائياً من المهمة المجدولة)
export async function saveThreadsToken(scope: Scope, token: string): Promise<void> {
  const { storeService, store } = await getStore(scope)
  if (!store) return
  const prev = ((store.metadata as any)?.[KEY] || {}) as Record<string, unknown>
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), [KEY]: { ...prev, threads_token: token, threads_token_at: new Date().toISOString() } } })
}

export async function saveMetaSettings(scope: Scope, input: MetaSettingsInput): Promise<MetaSettings> {
  await createBackup(scope, "تلقائي: قبل تعديل ربط ميتا").catch(() => null)
  const { storeService, store } = await getStore(scope)
  if (!store) throw new Error("no store")
  const prev = ((store.metadata as any)?.[KEY] || {}) as Partial<MetaSettings>
  const newThreads = input.clear_threads_token ? "" : input.threads_token || ""
  // رقم حساب Threads يُكتشف من الرمز الجديد إن لم يُكتب
  if (newThreads && !input.threads_user_id) {
    input = { ...input, threads_user_id: await getThreadsProfile(newThreads).then((p) => p.id).catch(() => undefined) }
  }
  const next = {
    token: input.clear_token ? "" : input.token ? input.token : prev.token || "",
    page_id: input.page_id,
    catalog_id: input.catalog_id,
    ig_user_id: input.ig_user_id,
    threads_token: input.clear_threads_token ? "" : newThreads || prev.threads_token || "",
    threads_user_id: input.threads_user_id ?? prev.threads_user_id ?? "",
    threads_token_at: newThreads ? new Date().toISOString() : input.clear_threads_token ? "" : prev.threads_token_at || "",
  }
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), [KEY]: next } })
  return getMetaSettings(scope)
}

// ---------- تيليجرام (منفصل عن ميتا): بوت ينشر في قناة أو مجموعة، بخطة أسبوعية خاصة ----------
// يُحفظ في store.metadata.telegram. الرمز لا يُعاد للوحة أبداً.
export type TelegramPlan = { enabled: boolean; days: number[]; hour: number; per_run: number; last_slot?: string }
export type TelegramSettings = { bot_token: string; chat_id: string; chat_title: string; bot_username: string; plan: TelegramPlan }
export const DEFAULT_TG_PLAN: TelegramPlan = { enabled: false, days: [0, 2, 4], hour: 20, per_run: 1 } // الأحد والثلاثاء والخميس 8 مساءً
const TG_KEY = "telegram"

export function cleanTgPlan(x: any): TelegramPlan {
  const days = Array.isArray(x?.days) ? Array.from(new Set<number>(x.days.map((d: any) => Math.floor(Number(d))).filter((d: number) => d >= 0 && d <= 6))).sort((a, b) => a - b) : DEFAULT_TG_PLAN.days
  const hour = Math.floor(Number(x?.hour))
  const per = Math.floor(Number(x?.per_run))
  return {
    enabled: Boolean(x?.enabled),
    days,
    hour: hour >= 0 && hour <= 23 ? hour : DEFAULT_TG_PLAN.hour,
    per_run: per >= 1 && per <= 3 ? per : 1,
    ...(typeof x?.last_slot === "string" ? { last_slot: x.last_slot } : {}),
  }
}

export async function getTelegramSettings(scope: Scope): Promise<TelegramSettings> {
  const { store } = await getStore(scope)
  const t = ((store?.metadata as any)?.[TG_KEY] || {}) as Partial<TelegramSettings>
  return {
    bot_token: process.env.TELEGRAM_BOT_TOKEN || t.bot_token || "",
    chat_id: process.env.TELEGRAM_CHAT_ID || t.chat_id || "",
    chat_title: t.chat_title || "",
    bot_username: t.bot_username || "",
    plan: cleanTgPlan(t.plan || DEFAULT_TG_PLAN),
  }
}

// يقرأ أحدث نسخة ويغيّر ما أُرسل فقط
export async function patchTelegram(scope: Scope, patch: Partial<TelegramSettings> & { clear_token?: boolean }): Promise<TelegramSettings> {
  const { storeService, store } = await getStore(scope)
  if (!store) throw new Error("no store")
  const prev = ((store.metadata as any)?.[TG_KEY] || {}) as Partial<TelegramSettings>
  const { clear_token, ...rest } = patch
  const next: Partial<TelegramSettings> = { ...prev, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) }
  if (clear_token) Object.assign(next, { bot_token: "", chat_id: "", chat_title: "", bot_username: "" })
  if (patch.plan) next.plan = cleanTgPlan({ ...cleanTgPlan(prev.plan || DEFAULT_TG_PLAN), ...patch.plan, last_slot: (prev.plan as any)?.last_slot })
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), [TG_KEY]: next } })
  return getTelegramSettings(scope)
}

export async function markTelegramSlot(scope: Scope, key: string) {
  const { storeService, store } = await getStore(scope)
  if (!store) return
  const prev = ((store.metadata as any)?.[TG_KEY] || {}) as Partial<TelegramSettings>
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), [TG_KEY]: { ...prev, plan: { ...cleanTgPlan(prev.plan || DEFAULT_TG_PLAN), last_slot: key } } } })
}

export const telegramReady = async (scope: Scope) => getTelegramSettings(scope).then((t) => Boolean(t.bot_token && t.chat_id))

export function publicTelegram(t: TelegramSettings) {
  return {
    has_token: Boolean(t.bot_token),
    token_hint: t.bot_token ? `…${t.bot_token.slice(-4)}` : "",
    chat_id: t.chat_id,
    chat_title: t.chat_title,
    bot_username: t.bot_username,
    plan: t.plan,
    from_env: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  }
}

// ما يُرسل للوحة: لا نعيد الرمز أبداً، فقط آخر 4 أحرف
export function publicSettings(s: MetaSettings) {
  return {
    has_token: Boolean(s.token),
    token_hint: s.token ? `…${s.token.slice(-4)}` : "",
    page_id: s.page_id,
    catalog_id: s.catalog_id,
    ig_user_id: s.ig_user_id,
    graph_version: s.graph_version,
    threads_has_token: Boolean(s.threads_token),
    threads_token_hint: s.threads_token ? `…${s.threads_token.slice(-4)}` : "",
    threads_user_id: s.threads_user_id,
    from_env: {
      token: Boolean(process.env.META_ACCESS_TOKEN),
      page_id: Boolean(process.env.META_PAGE_ID),
      catalog_id: Boolean(process.env.META_CATALOG_ID),
    },
  }
}
