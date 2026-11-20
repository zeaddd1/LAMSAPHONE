import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

// إعدادات الزوار تُحفظ في metadata المتجر: store.metadata.analytics
// معرّفات عامة تظهر في كود الصفحات أصلاً (ليست أسراراً):
//  - GTM-XXXXXXX: حاوية Google Tag Manager (تُدار منها أدوات جوجل مثل Analytics)
//  - Clarity: معرّف مشروع Microsoft Clarity (تسجيلات وخرائط حرارية)

const GTM = /^GTM-[A-Z0-9]{4,12}$/
const CLARITY = /^[a-z0-9]{6,20}$/

export const AnalyticsInput = z.object({
  gtm_id: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || GTM.test(v), "معرّف Google Tag Manager يبدأ بـ GTM- مثل GTM-ABC123")
    .default(""),
  clarity_id: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "" || CLARITY.test(v), "معرّف Clarity أحرف وأرقام إنجليزية فقط")
    .default(""),
})
export type AnalyticsInput = z.infer<typeof AnalyticsInput>
export type AnalyticsSettings = { gtm_id: string; clarity_id: string }

type Scope = { resolve: (key: string) => any }

const clean = (s: any): AnalyticsSettings => ({
  gtm_id: typeof s?.gtm_id === "string" && GTM.test(s.gtm_id) ? s.gtm_id : "",
  clarity_id: typeof s?.clarity_id === "string" && CLARITY.test(s.clarity_id) ? s.clarity_id : "",
})

export async function getAnalyticsSettings(scope: Scope): Promise<AnalyticsSettings> {
  const [store] = await scope.resolve(Modules.STORE).listStores({}, { take: 1, select: ["id", "metadata"] })
  return clean((store?.metadata as any)?.analytics)
}

export async function saveAnalyticsSettings(scope: Scope, input: AnalyticsInput): Promise<AnalyticsSettings> {
  const storeService = scope.resolve(Modules.STORE)
  const [store] = await storeService.listStores({}, { take: 1, select: ["id", "metadata"] })
  if (!store) throw new Error("no store")
  const next = { gtm_id: input.gtm_id, clarity_id: input.clarity_id }
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), analytics: next } })
  return next
}
