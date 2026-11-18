import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

// إعدادات Gemini لصفحة الإضافة السريعة (اختيارية).
// تُحفظ في metadata المتجر (store.metadata.quick_add_gemini) بنفس طريقة رمز ميتا: لا جدول ولا ترحيل.
// المفتاح لا يُرسل للوحة أبداً. GEMINI_API_KEY في متغيرات البيئة احتياطي إن لم يُحفظ مفتاح في اللوحة.

export const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image"
export const DEFAULT_TEXT_MODEL = "gemini-2.5-flash"

const modelName = z.string().trim().max(100).regex(/^[a-zA-Z0-9._\-/]*$/, "اسم الموديل: حروف إنجليزية وأرقام فقط")

export const GeminiSettingsInput = z.object({
  // فارغ = لا تغيير على المفتاح المحفوظ
  api_key: z.string().trim().max(300).optional(),
  clear_key: z.boolean().optional(),
  image_model: modelName.default(DEFAULT_IMAGE_MODEL),
  text_model: modelName.default(DEFAULT_TEXT_MODEL),
  margin_type: z.enum(["percent", "fixed"]).default("percent"),
  margin_value: z.number().min(0).max(100000).default(10),
  concurrency: z.number().int().min(1).max(4).default(2),
})
export type GeminiSettingsInput = z.infer<typeof GeminiSettingsInput>

export type GeminiSettings = {
  api_key: string
  image_model: string
  text_model: string
  margin_type: "percent" | "fixed"
  margin_value: number
  concurrency: number
  // آخر اختبار اتصال
  status: "connected" | "disconnected" | "error"
  last_success_at: string | null
  last_error: string | null
}

const KEY = "quick_add_gemini"
type Scope = { resolve: (key: string) => any }

async function getStore(scope: Scope) {
  const storeService = scope.resolve(Modules.STORE)
  const [store] = await storeService.listStores({}, { take: 1 })
  return { storeService, store }
}

export async function getGeminiSettings(scope: Scope): Promise<GeminiSettings> {
  const { store } = await getStore(scope)
  const saved = ((store?.metadata as any)?.[KEY] || {}) as Partial<GeminiSettings>
  const api_key = saved.api_key || process.env.GEMINI_API_KEY || ""
  return {
    api_key,
    image_model: saved.image_model || DEFAULT_IMAGE_MODEL,
    text_model: saved.text_model || DEFAULT_TEXT_MODEL,
    margin_type: saved.margin_type === "fixed" ? "fixed" : "percent",
    margin_value: typeof saved.margin_value === "number" ? saved.margin_value : 10,
    concurrency: Math.min(4, Math.max(1, Number(saved.concurrency) || 2)),
    status: !api_key ? "disconnected" : saved.status || "disconnected",
    last_success_at: saved.last_success_at || null,
    last_error: saved.last_error || null,
  }
}

async function patch(scope: Scope, fn: (prev: Partial<GeminiSettings>) => Partial<GeminiSettings>) {
  const { storeService, store } = await getStore(scope)
  if (!store) throw new Error("no store")
  const prev = ((store.metadata as any)?.[KEY] || {}) as Partial<GeminiSettings>
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), [KEY]: { ...prev, ...fn(prev) } } })
}

export async function saveGeminiSettings(scope: Scope, input: GeminiSettingsInput): Promise<GeminiSettings> {
  await patch(scope, (prev) => {
    const api_key = input.clear_key ? "" : input.api_key ? input.api_key : prev.api_key || ""
    const keyChanged = api_key !== (prev.api_key || "")
    return {
      api_key,
      image_model: input.image_model || DEFAULT_IMAGE_MODEL,
      text_model: input.text_model || DEFAULT_TEXT_MODEL,
      margin_type: input.margin_type,
      margin_value: input.margin_value,
      concurrency: input.concurrency,
      // مفتاح جديد: نعيد الحالة حتى يُختبر
      ...(keyChanged ? { status: "disconnected" as const, last_error: null } : {}),
    }
  })
  return getGeminiSettings(scope)
}

export async function recordGeminiTest(scope: Scope, ok: boolean, error?: string) {
  await patch(scope, () =>
    ok ? { status: "connected", last_success_at: new Date().toISOString(), last_error: null } : { status: "error", last_error: (error || "").slice(0, 300) }
  )
}

// ما يُرسل للوحة: لا نعيد المفتاح أبداً، فقط آخر 4 أحرف
export function publicGeminiSettings(s: GeminiSettings, usage?: { month_calls: number; total_calls: number; month_jobs: number }) {
  return {
    has_key: Boolean(s.api_key),
    key_hint: s.api_key ? `…${s.api_key.slice(-4)}` : "",
    from_env: !s.api_key ? false : Boolean(process.env.GEMINI_API_KEY) && s.api_key === process.env.GEMINI_API_KEY,
    image_model: s.image_model,
    text_model: s.text_model,
    margin_type: s.margin_type,
    margin_value: s.margin_value,
    concurrency: s.concurrency,
    status: s.status,
    last_success_at: s.last_success_at,
    last_error: s.last_error,
    usage: usage || { month_calls: 0, total_calls: 0, month_jobs: 0 },
  }
}
export type GeminiPublic = ReturnType<typeof publicGeminiSettings>
