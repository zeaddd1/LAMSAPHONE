import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorOf, geminiUsage as usage, quotaGuard, rateLimited, usageStore } from "../../../../../../lib/quick-add/ai-jobs"
import { GeminiError, arabicError, createGeminiApi, isPaidOnly, withRetry } from "../../../../../../lib/quick-add/gemini"
import { ModelTest, getGeminiSettings, publicGeminiSettings, recordGeminiTest } from "../../../../../../lib/quick-add/gemini-settings"
import { QuotaWaitError } from "../../../../../../lib/quick-add/quota"

const at = () => new Date().toISOString()
const PING = [{ text: "Reply with the single word: OK" }]

// تصنيف نتيجة اختبار موديل: يعمل / مدفوع فقط / تجاوز الحد / خطأ
export function classifyTest(e: unknown): ModelTest {
  if (e instanceof QuotaWaitError) return { state: "rate_limited", message: "تجاوز الحد المحلي أو في فترة تبريد: انتظر التجدد", at: at() }
  const status = (e as any)?.status
  if (status === 429 && isPaidOnly(e)) return { state: "paid_only", message: "مدفوع فقط: الحصة المجانية لهذا الموديل صفر", at: at() }
  if (status === 429) return { state: "rate_limited", message: "تجاوز الحد في Google، حاول لاحقاً", at: at() }
  if (status === 403 && /billing|paid|free tier/i.test((e as any)?.message || "")) return { state: "paid_only", message: "مدفوع فقط: يحتاج حساباً مفوتراً", at: at() }
  return { state: "error", message: (e as any)?.message && !status && /موديل/.test((e as any).message) ? (e as any).message : arabicError(e), at: at() }
}

// اختبار الاتصال: كل موديل على حدة.
// النصوص: طلب صغير عبر حارس الحصص. الصور: في اليدوي نتأكد من وجود الموديل فقط (بلا توليد)،
// وفي المدفوع طلب نصي صغير لموديل الصور (بلا صورة) ليكشف «مدفوع فقط» أو تجاوز الحد.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (rateLimited(actorOf(req))) {
    res.status(429).json({ message: "طلبات كثيرة، انتظر دقيقة" })
    return
  }
  const s = await getGeminiSettings(req.scope)
  if (!s.api_key) {
    res.json({ ok: false, error: "أضف مفتاح Gemini أولاً", settings: publicGeminiSettings(s, await usage(req.scope)) })
    return
  }
  const api = createGeminiApi(s.api_key)
  const guard = quotaGuard(req.scope)

  let text: ModelTest
  try {
    await guard.before("text", s.text_model)
    try {
      const r = await withRetry((signal) => api.generate({ model: s.text_model, parts: PING, signal }), { retries: 1, timeoutMs: 30_000 })
      await guard.after("text", s.text_model, "ok")
      if (!r.text) throw new Error("لم يرجع موديل النصوص أي رد")
    } catch (e) {
      if (e instanceof GeminiError) await guard.after("text", s.text_model, e.status === 429 && !isPaidOnly(e) ? "rate_limited" : "error")
      throw e
    }
    text = { state: "works", message: "يعمل", at: at() }
  } catch (e) {
    text = classifyTest(e)
  }

  let image: ModelTest
  try {
    if (s.image_mode === "paid_api") {
      try {
        await withRetry((signal) => api.generate({ model: s.image_model, parts: PING, signal }), { retries: 0, timeoutMs: 30_000 })
        await usageStore(req.scope).log({ model: s.image_model, kind: "image", result: "ok", cost_usd: 0 })
      } catch (e) {
        await usageStore(req.scope).log({ model: s.image_model, kind: "image", result: (e as any)?.status === 429 ? "rate_limited" : "error", cost_usd: 0 })
        throw e
      }
      image = { state: "works", message: "يعمل", at: at() }
    } else {
      const { GoogleGenAI } = await import("@google/genai")
      await new GoogleGenAI({ apiKey: s.api_key }).models.get({ model: s.image_model }).catch((e: any) => {
        throw Object.assign(new Error(`موديل الصور «${s.image_model}» غير متاح لهذا المفتاح`), { status: e?.status === 429 ? 429 : undefined, message: e?.status === 429 ? e.message : `موديل الصور «${s.image_model}» غير متاح لهذا المفتاح` })
      })
      image = { state: "available", message: "موجود (لا يُستدعى في الوضع اليدوي)", at: at() }
    }
  } catch (e) {
    image = classifyTest(e)
  }

  await recordGeminiTest(req.scope, text, image)
  const ok = text.state === "works"
  req.scope.resolve("logger").info(`quick-add ai: gemini test text=${text.state} image=${image.state}`)
  res.json({ ok, error: ok ? undefined : text.message, text, image, settings: publicGeminiSettings(await getGeminiSettings(req.scope), await usage(req.scope)) })
}
