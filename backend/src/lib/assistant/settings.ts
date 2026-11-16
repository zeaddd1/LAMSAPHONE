import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { randomBytes } from "crypto"
import { createBackup } from "../meta-backup"

// إعدادات الرد الآلي (تُحفظ في store.metadata.assistant). رمز الوصول ورقم الصفحة من إعدادات "ربط ميتا".
export const AssistantSettingsInput = z.object({
  // App Secret من إعدادات التطبيق ← أساسي. فارغ = لا تغيير
  app_secret: z.string().trim().max(200).optional(),
  // رقم هاتف واتساب في Cloud API (Phone number ID)
  wa_phone_number_id: z.string().trim().regex(/^\d{5,25}$/, "أرقام فقط").or(z.literal("")).default(""),
  messenger: z.boolean().default(true),
  instagram: z.boolean().default(true),
  whatsapp: z.boolean().default(true),
  // بعد كم دقيقة من آخر رد للموظف يعود الرد الآلي (0 = لا يعود تلقائياً)
  human_timeout_min: z.number().int().min(0).max(1440).default(120),
})
export type AssistantSettingsInput = z.infer<typeof AssistantSettingsInput>

export type AssistantSettings = {
  app_secret: string
  verify_token: string
  wa_phone_number_id: string
  messenger: boolean
  instagram: boolean
  whatsapp: boolean
  human_timeout_min: number
}

const KEY = "assistant"
type Scope = { resolve: (key: string) => any }

async function getStore(scope: Scope) {
  const storeService = scope.resolve(Modules.STORE)
  const [store] = await storeService.listStores({}, { take: 1 })
  return { storeService, store }
}

export async function getAssistantSettings(scope: Scope): Promise<AssistantSettings> {
  const { storeService, store } = await getStore(scope)
  const saved = ((store?.metadata as any)?.[KEY] || {}) as Partial<AssistantSettings>
  // رمز التحقق للـ Webhook يُولَّد تلقائياً أول مرة
  if (store && !saved.verify_token) {
    saved.verify_token = `lamsa_${randomBytes(12).toString("hex")}`
    await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), [KEY]: saved } })
  }
  return {
    app_secret: process.env.META_APP_SECRET || saved.app_secret || "",
    verify_token: saved.verify_token || "",
    wa_phone_number_id: process.env.META_WA_PHONE_NUMBER_ID || saved.wa_phone_number_id || "",
    messenger: saved.messenger ?? true,
    instagram: saved.instagram ?? true,
    whatsapp: saved.whatsapp ?? true,
    human_timeout_min: saved.human_timeout_min ?? 120,
  }
}

export async function saveAssistantSettings(scope: Scope, input: AssistantSettingsInput): Promise<AssistantSettings> {
  await createBackup(scope, "تلقائي: قبل تعديل الرد الآلي").catch(() => null)
  const { storeService, store } = await getStore(scope)
  if (!store) throw new Error("no store")
  const prev = ((store.metadata as any)?.[KEY] || {}) as Partial<AssistantSettings>
  const next = {
    ...prev,
    app_secret: input.app_secret ? input.app_secret : prev.app_secret || "",
    wa_phone_number_id: input.wa_phone_number_id,
    messenger: input.messenger,
    instagram: input.instagram,
    whatsapp: input.whatsapp,
    human_timeout_min: input.human_timeout_min,
  }
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), [KEY]: next } })
  return getAssistantSettings(scope)
}

export function publicAssistantSettings(s: AssistantSettings, webhookUrl: string) {
  return {
    webhook_url: webhookUrl,
    verify_token: s.verify_token, // ليس سراً: يُلصق في إعداد Webhook عند ميتا
    has_app_secret: Boolean(s.app_secret),
    wa_phone_number_id: s.wa_phone_number_id,
    messenger: s.messenger,
    instagram: s.instagram,
    whatsapp: s.whatsapp,
    human_timeout_min: s.human_timeout_min,
  }
}
