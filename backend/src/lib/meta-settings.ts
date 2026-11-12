import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

// إعدادات ربط Meta تُحفظ في metadata المتجر (store.metadata.meta)، فلا تحتاج جدولاً ولا إعادة بناء.
export const MetaSettingsSchema = z.object({
  // رقم Pixel (Dataset) من Events Manager: أرقام فقط
  pixel_id: z.string().trim().regex(/^\d{8,20}$/, "رقم Pixel أرقام فقط").or(z.literal("")).default(""),
  // رمز meta-tag لتوثيق الدومين من Business Settings > Domains
  domain_verification: z.string().trim().regex(/^[A-Za-z0-9_-]{10,64}$/, "رمز التوثيق غير صالح").or(z.literal("")).default(""),
  // رقم الكتالوج في Commerce Manager (لتسهيل فتحه من اللوحة)
  catalog_id: z.string().trim().regex(/^\d{5,25}$/, "رقم الكتالوج أرقام فقط").or(z.literal("")).default(""),
  // رقم واتساب الأعمال المربوط بالكتالوج (بالصيغة الدولية بدون +)
  whatsapp_number: z.string().trim().regex(/^\d{8,15}$/, "رقم واتساب بالصيغة الدولية بدون +").or(z.literal("")).default(""),
  // إيقاف رابط الكتالوج مؤقتاً
  feed_enabled: z.boolean().default(true),
})
export type MetaSettings = z.infer<typeof MetaSettingsSchema>

export const DEFAULT_META_SETTINGS: MetaSettings = MetaSettingsSchema.parse({})

type Scope = { resolve: (key: string) => any }

async function getStore(scope: Scope) {
  const storeService = scope.resolve(Modules.STORE)
  const [store] = await storeService.listStores({}, { take: 1 })
  return { storeService, store }
}

export async function getMetaSettings(scope: Scope): Promise<MetaSettings> {
  const { store } = await getStore(scope)
  const raw = (store?.metadata as any)?.meta
  const parsed = MetaSettingsSchema.safeParse(raw || {})
  return parsed.success ? parsed.data : DEFAULT_META_SETTINGS
}

export async function saveMetaSettings(scope: Scope, input: MetaSettings): Promise<MetaSettings> {
  const { storeService, store } = await getStore(scope)
  if (!store) throw new Error("no store")
  const settings = MetaSettingsSchema.parse(input)
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), meta: settings } })
  return settings
}
