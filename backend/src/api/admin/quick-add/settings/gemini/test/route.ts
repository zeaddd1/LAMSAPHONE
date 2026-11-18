import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorOf, geminiUsage as usage, rateLimited } from "../../../../../../lib/quick-add/ai-jobs"
import { arabicError, createGeminiApi, withRetry } from "../../../../../../lib/quick-add/gemini"
import { getGeminiSettings, publicGeminiSettings, recordGeminiTest } from "../../../../../../lib/quick-add/gemini-settings"

// اختبار الاتصال: طلب نصي صغير بموديل النصوص، والتأكد أن موديل الصور موجود
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
  let ok = true
  let error = ""
  try {
    const api = createGeminiApi(s.api_key)
    const r = await withRetry((signal) => api.generate({ model: s.text_model, parts: [{ text: "Reply with the single word: OK" }], signal }), { retries: 1, timeoutMs: 30_000 })
    if (!r.text) throw new Error("لم يرجع موديل النصوص أي رد")
    const { GoogleGenAI } = await import("@google/genai")
    await new GoogleGenAI({ apiKey: s.api_key }).models.get({ model: s.image_model }).catch((e: any) => {
      throw Object.assign(new Error(`موديل الصور «${s.image_model}» غير متاح لهذا المفتاح`), { status: e?.status })
    })
  } catch (e: any) {
    ok = false
    error = /موديل/.test(e?.message || "") ? e.message : arabicError(e)
  }
  await recordGeminiTest(req.scope, ok, error)
  req.scope.resolve("logger").info(`quick-add ai: gemini test ${ok ? "ok" : "failed"}`)
  res.json({ ok, error: error || undefined, settings: publicGeminiSettings(await getGeminiSettings(req.scope), await usage(req.scope)) })
}
