import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createBackup } from "../meta-backup"

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
})
export type MetaSettingsInput = z.infer<typeof MetaSettingsInput>

export type MetaSettings = {
  token: string
  page_id: string
  catalog_id: string
  ig_user_id: string
  graph_version: string
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
  }
}

export async function saveMetaSettings(scope: Scope, input: MetaSettingsInput): Promise<MetaSettings> {
  await createBackup(scope, "تلقائي: قبل تعديل ربط ميتا").catch(() => null)
  const { storeService, store } = await getStore(scope)
  if (!store) throw new Error("no store")
  const prev = ((store.metadata as any)?.[KEY] || {}) as Partial<MetaSettings>
  const next = {
    token: input.clear_token ? "" : input.token ? input.token : prev.token || "",
    page_id: input.page_id,
    catalog_id: input.catalog_id,
    ig_user_id: input.ig_user_id,
  }
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), [KEY]: next } })
  return getMetaSettings(scope)
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
    from_env: {
      token: Boolean(process.env.META_ACCESS_TOKEN),
      page_id: Boolean(process.env.META_PAGE_ID),
      catalog_id: Boolean(process.env.META_CATALOG_ID),
    },
  }
}
