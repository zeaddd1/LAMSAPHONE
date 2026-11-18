import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

// إعدادات Gemini لصفحة الإضافة السريعة (اختيارية).
// تُحفظ في metadata المتجر (store.metadata.quick_add_gemini) بنفس طريقة رمز ميتا: لا جدول ولا ترحيل.
// المفتاح لا يُرسل للوحة أبداً. GEMINI_API_KEY في متغيرات البيئة احتياطي إن لم يُحفظ مفتاح في اللوحة.

export const DEFAULT_TEXT_MODEL = "gemini-3.5-flash-lite"
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-lite-image"
// موديلات متوقفة: تُستبدل بالافتراضي تلقائياً
const DEPRECATED_TEXT = ["gemini-2.5-flash"]
// موديلات صور ستتوقف: تحذير في الإعدادات
export const IMAGE_SUNSET: Record<string, string> = { "gemini-2.5-flash-image": "15 مارس 2027" }
export const DEFAULT_IMAGE_COST = 0.0336 // دولار لصورة 1K

const modelName = z.string().trim().max(100).regex(/^[a-zA-Z0-9._\-/]*$/, "اسم الموديل: حروف إنجليزية وأرقام فقط")

export const GeminiSettingsInput = z
  .object({
    // فارغ = لا تغيير على المفتاح المحفوظ
    api_key: z.string().trim().max(300).optional(),
    clear_key: z.boolean().optional(),
    image_model: modelName.default(DEFAULT_IMAGE_MODEL),
    text_model: modelName.default(DEFAULT_TEXT_MODEL),
    margin_type: z.enum(["percent", "fixed"]).default("percent"),
    margin_value: z.number().min(0).max(100000).default(10),
    concurrency: z.number().int().min(1).max(4).default(2),
    // وضع توليد الصور: manual (الافتراضي، لا طلبات صور للـ API) أو paid_api
    image_mode: z.enum(["manual", "paid_api"]).default("manual"),
    paid_confirmed: z.boolean().default(false),
    monthly_cap_usd: z.number().min(0).max(10000).default(0),
    daily_cap_usd: z.number().min(0).max(10000).default(0),
    // تكلفة الصورة الواحدة لكل موديل (قابلة للتعديل)
    image_costs: z.record(modelName, z.number().min(0).max(10)).default({}),
    use_batch: z.boolean().default(false),
    // حارس الحصص للنصوص (من صفحة Rate limits في AI Studio). 0 = غير محدد
    rpm: z.number().int().min(0).max(100000).default(0),
    rpd: z.number().int().min(0).max(10000000).default(0),
    safety_pct: z.number().int().min(10).max(100).default(80),
  })
  .refine((v) => v.image_mode !== "paid_api" || v.paid_confirmed, {
    message: "الوضع المدفوع يحتاج تأكيد «الربط بحساب مفوتر»",
    path: ["paid_confirmed"],
  })
  .refine((v) => v.image_mode !== "paid_api" || v.monthly_cap_usd > 0, {
    message: "الوضع المدفوع يحتاج سقفاً شهرياً بالدولار أكبر من صفر",
    path: ["monthly_cap_usd"],
  })
export type GeminiSettingsInput = z.infer<typeof GeminiSettingsInput>

export type ModelTest = { state: "works" | "paid_only" | "rate_limited" | "error" | "available"; message: string; at: string }

export type GeminiSettings = {
  api_key: string
  image_model: string
  text_model: string
  margin_type: "percent" | "fixed"
  margin_value: number
  concurrency: number
  image_mode: "manual" | "paid_api"
  paid_confirmed: boolean
  monthly_cap_usd: number
  daily_cap_usd: number
  image_costs: Record<string, number>
  use_batch: boolean
  rpm: number
  rpd: number
  safety_pct: number
  // تبريد بعد 429 من Google
  cooldown_until: string | null
  cooldown_level: number
  // آخر اختبار اتصال
  status: "connected" | "disconnected" | "error"
  last_success_at: string | null
  last_error: string | null
  text_test: ModelTest | null
  image_test: ModelTest | null
  // سبب آخر تحويل تلقائي من المدفوع إلى اليدوي (بلوغ السقف)
  cap_note: string | null
}

const KEY = "quick_add_gemini"
type Scope = { resolve: (key: string) => any }

async function getStore(scope: Scope) {
  const storeService = scope.resolve(Modules.STORE)
  const [store] = await storeService.listStores({}, { take: 1 })
  return { storeService, store }
}

export function imageCost(s: Pick<GeminiSettings, "image_costs" | "image_model">, model = s.image_model) {
  const c = s.image_costs?.[model]
  return typeof c === "number" ? c : DEFAULT_IMAGE_COST
}

export function normalizeSettings(saved: Partial<GeminiSettings>, envKey = process.env.GEMINI_API_KEY): GeminiSettings {
  const api_key = saved.api_key || envKey || ""
  const text = saved.text_model && !DEPRECATED_TEXT.includes(saved.text_model) ? saved.text_model : DEFAULT_TEXT_MODEL
  const paid = saved.image_mode === "paid_api" && Boolean(saved.paid_confirmed) && Number(saved.monthly_cap_usd) > 0
  return {
    api_key,
    image_model: saved.image_model || DEFAULT_IMAGE_MODEL,
    text_model: text,
    margin_type: saved.margin_type === "fixed" ? "fixed" : "percent",
    margin_value: typeof saved.margin_value === "number" ? saved.margin_value : 10,
    concurrency: Math.min(4, Math.max(1, Number(saved.concurrency) || 2)),
    // لا انتقال تلقائي إلى المدفوع: أي إعداد ناقص = يدوي
    image_mode: paid ? "paid_api" : "manual",
    paid_confirmed: Boolean(saved.paid_confirmed),
    monthly_cap_usd: Number(saved.monthly_cap_usd) || 0,
    daily_cap_usd: Number(saved.daily_cap_usd) || 0,
    image_costs: saved.image_costs || {},
    use_batch: Boolean(saved.use_batch),
    rpm: Number(saved.rpm) || 0,
    rpd: Number(saved.rpd) || 0,
    safety_pct: Math.min(100, Math.max(10, Number(saved.safety_pct) || 80)),
    cooldown_until: saved.cooldown_until || null,
    cooldown_level: Number(saved.cooldown_level) || 0,
    status: !api_key ? "disconnected" : saved.status || "disconnected",
    last_success_at: saved.last_success_at || null,
    last_error: saved.last_error || null,
    text_test: saved.text_test || null,
    image_test: saved.image_test || null,
    cap_note: saved.cap_note || null,
  }
}

export async function getGeminiSettings(scope: Scope): Promise<GeminiSettings> {
  const { store } = await getStore(scope)
  return normalizeSettings(((store?.metadata as any)?.[KEY] || {}) as Partial<GeminiSettings>)
}

export async function patchGeminiSettings(scope: Scope, fn: (prev: Partial<GeminiSettings>) => Partial<GeminiSettings>) {
  const { storeService, store } = await getStore(scope)
  if (!store) throw new Error("no store")
  const prev = ((store.metadata as any)?.[KEY] || {}) as Partial<GeminiSettings>
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), [KEY]: { ...prev, ...fn(prev) } } })
}

export async function saveGeminiSettings(scope: Scope, input: GeminiSettingsInput): Promise<GeminiSettings> {
  await patchGeminiSettings(scope, (prev) => {
    const api_key = input.clear_key ? "" : input.api_key ? input.api_key : prev.api_key || ""
    const keyChanged = api_key !== (prev.api_key || "")
    return {
      api_key,
      image_model: input.image_model || DEFAULT_IMAGE_MODEL,
      text_model: input.text_model || DEFAULT_TEXT_MODEL,
      margin_type: input.margin_type,
      margin_value: input.margin_value,
      concurrency: input.concurrency,
      image_mode: input.image_mode,
      paid_confirmed: input.paid_confirmed,
      monthly_cap_usd: input.monthly_cap_usd,
      daily_cap_usd: input.daily_cap_usd,
      image_costs: input.image_costs,
      use_batch: input.use_batch,
      rpm: input.rpm,
      rpd: input.rpd,
      safety_pct: input.safety_pct,
      ...(input.image_mode === "paid_api" ? { cap_note: null } : {}),
      // تغيير موديل: نتيجة اختباره القديمة لم تعد صالحة
      ...((input.text_model || DEFAULT_TEXT_MODEL) !== prev.text_model ? { text_test: null } : {}),
      ...((input.image_model || DEFAULT_IMAGE_MODEL) !== prev.image_model ? { image_test: null } : {}),
      // مفتاح جديد: نعيد الحالة حتى يُختبر
      ...(keyChanged ? { status: "disconnected" as const, last_error: null, text_test: null, image_test: null, cooldown_until: null, cooldown_level: 0 } : {}),
    }
  })
  return getGeminiSettings(scope)
}

export async function recordGeminiTest(scope: Scope, text: ModelTest, image: ModelTest) {
  const ok = text.state === "works"
  await patchGeminiSettings(scope, () => ({
    text_test: text,
    image_test: image,
    ...(ok ? { status: "connected", last_success_at: new Date().toISOString(), last_error: null } : { status: "error", last_error: text.message.slice(0, 300) }),
  }))
}

// ما يُرسل للوحة: لا نعيد المفتاح أبداً، فقط آخر 4 أحرف
export function publicGeminiSettings(s: GeminiSettings, usage?: Record<string, unknown>) {
  const { api_key, ...rest } = s
  return {
    ...rest,
    has_key: Boolean(api_key),
    key_hint: api_key ? `…${api_key.slice(-4)}` : "",
    from_env: !api_key ? false : Boolean(process.env.GEMINI_API_KEY) && api_key === process.env.GEMINI_API_KEY,
    image_cost: imageCost(s),
    image_sunset: IMAGE_SUNSET[s.image_model] || null,
    usage: usage || {},
  }
}
export type GeminiPublic = ReturnType<typeof publicGeminiSettings>
