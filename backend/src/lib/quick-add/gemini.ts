// عميل Gemini للإضافة السريعة + نصوص التعليمات (prompts). بلا استيراد من Medusa حتى يُختبر وحده.
// المفتاح لا يُطبع في أي سجل ولا يُعاد في أي رسالة خطأ.

export type InlineImage = { data: string; mimeType: string } // data = base64
export type GeminiPart = { text: string } | { inlineData: InlineImage }
export type GeminiRequest = { model: string; parts: GeminiPart[]; wantImage?: boolean; json?: boolean; signal?: AbortSignal }
export type GeminiResponse = { text?: string; image?: InlineImage; finishReason?: string }

// واجهة صغيرة تسهّل استبدال Gemini بـ mock في الاختبارات
export interface GeminiApi {
  generate(req: GeminiRequest): Promise<GeminiResponse>
}

export class GeminiError extends Error {
  status?: number
  retryable: boolean
  constructor(message: string, status?: number, retryable = false) {
    super(message)
    this.status = status
    this.retryable = retryable
  }
}

// إخفاء أي شيء يشبه المفتاح من رسائل الخطأ قبل حفظها أو عرضها
export function redact(msg: string, key?: string) {
  let m = String(msg || "")
  if (key) m = m.split(key).join("***")
  return m.replace(/AIza[0-9A-Za-z_\-]{20,}/g, "***").slice(0, 400)
}

export function arabicError(e: unknown): string {
  const err = e as GeminiError
  const s = err?.status
  if (s === 400 && /api key|API_KEY/i.test(err.message)) return "مفتاح Gemini غير صحيح"
  if (s === 401 || s === 403) return "مفتاح Gemini غير صحيح أو لا يملك صلاحية لهذا الموديل"
  if (s === 404) return "اسم الموديل غير موجود: عدّله من إعدادات Gemini"
  if (s === 429) return "تجاوزت حد الاستخدام في Gemini، حاول بعد دقيقة"
  if (s && s >= 500) return "خدمة Gemini لا تستجيب الآن، أعد المحاولة"
  if (/timeout|مهلة|aborted/i.test(err?.message || "")) return "انتهت مهلة Gemini، أعد المحاولة"
  return err?.message ? `خطأ من Gemini: ${err.message}` : "خطأ غير معروف من Gemini"
}

// عميل حقيقي عبر @google/genai (يُحمَّل عند الحاجة فقط حتى لا يثقل التشغيل إن لم تُستخدم الميزة)
export function createGeminiApi(apiKey: string): GeminiApi {
  let client: any = null
  const get = async () => {
    if (!client) {
      const { GoogleGenAI } = await import("@google/genai")
      client = new GoogleGenAI({ apiKey })
    }
    return client
  }
  return {
    async generate(req) {
      const ai = await get()
      try {
        const r = await ai.models.generateContent({
          model: req.model,
          contents: [{ role: "user", parts: req.parts }],
          config: {
            ...(req.wantImage ? { responseModalities: ["IMAGE", "TEXT"] } : {}),
            ...(req.json ? { responseMimeType: "application/json" } : {}),
            ...(req.signal ? { abortSignal: req.signal } : {}),
          },
        })
        const cand = r?.candidates?.[0]
        const parts: any[] = cand?.content?.parts || []
        const img = parts.find((p) => p?.inlineData?.data)
        const text = parts.filter((p) => typeof p?.text === "string").map((p) => p.text).join("") || undefined
        return {
          text,
          image: img ? { data: img.inlineData.data, mimeType: img.inlineData.mimeType || "image/png" } : undefined,
          finishReason: cand?.finishReason,
        }
      } catch (e: any) {
        const status = Number(e?.status || e?.code) || undefined
        throw new GeminiError(redact(e?.message || String(e), apiKey), status, status === 429 || (status !== undefined && status >= 500))
      }
    },
  }
}

const sleepDefault = (ms: number) => new Promise((r) => setTimeout(r, ms))

// مهلة + إعادة المحاولة مرتين عند 429/5xx/انتهاء المهلة، مع انتظار متزايد
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: { retries?: number; timeoutMs?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<T> {
  const retries = opts.retries ?? 2
  const sleep = opts.sleep || sleepDefault
  let last: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, rej) => {
        timer = setTimeout(() => {
          ac.abort()
          rej(new GeminiError("timeout", undefined, true))
        }, opts.timeoutMs ?? 120_000)
      })
      return await Promise.race([fn(ac.signal), timeout])
    } catch (e: any) {
      last = e
      const retryable = e instanceof GeminiError ? e.retryable : false
      if (!retryable || attempt === retries) throw e
      await sleep((opts.baseMs ?? 1500) * 2 ** attempt)
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  throw last
}

// ---------- التعليمات ----------

export const PRESETS = ["studio", "floating", "dark", "lifestyle", "watermark_clean", "custom"] as const
export type Preset = (typeof PRESETS)[number]
export const IMAGE_KINDS = ["front", "back", "side", "box", "accessories", "other"] as const
export type ImageKind = (typeof IMAGE_KINDS)[number]
export const CONDITIONS = ["new", "used", "refurbished"] as const
export type Condition = (typeof CONDITIONS)[number]

export const PRESET_LABELS: Record<Preset, string> = {
  studio: "استوديو (خلفية بيضاء)",
  floating: "عائم بخلفية متدرجة",
  dark: "خلفية داكنة فاخرة",
  lifestyle: "أجواء واقعية",
  watermark_clean: "إزالة علامة المورد فقط",
  custom: "وصف مخصص",
}

const PRESET_TEXT: Record<Exclude<Preset, "custom">, string> = {
  studio: "Place the product on a clean pure white studio background with a soft natural shadow under it and even, diffused, professional lighting.",
  floating:
    "Show the product floating at a slight angle above a smooth gradient background whose colours complement the product's own colour, with a soft shadow below and clean studio lighting.",
  dark: "Place the product on a luxurious dark background with subtle rim lighting and a faint, elegant reflection beneath it.",
  lifestyle: "Place the product in a realistic, tasteful lifestyle setting (for example a clean wooden desk or a modern table) with soft natural daylight. Keep the product the clear focus.",
  watermark_clean:
    "Only remove supplier watermarks, stamps, logos and stray overlaid text from the BACKGROUND. Keep everything else in the photo as it is, including the background style.",
}

export const KEEP_SAME =
  "Keep the phone exactly the same: do not change the model, camera module layout, buttons, ports, colors, logos, or screen content. Do not add or remove any physical features. Do not invent text."

const KIND_EN: Record<ImageKind, string> = {
  front: "front view",
  back: "back view",
  side: "side view",
  box: "retail box",
  accessories: "accessories",
  other: "product photo",
}

// قاعدة الصدق: المستعمل والمجدّد = تنظيف الخلفية فقط
export function allowedPresets(condition: string): Preset[] {
  return condition === "new" ? [...PRESETS] : ["studio", "watermark_clean"]
}
export function isPresetAllowed(condition: string, preset: string) {
  return (allowedPresets(condition) as string[]).includes(preset)
}

export type DeviceContext = {
  title: string
  brand?: string
  model?: string
  condition: string
  parts?: string
  preset: Preset
  custom_prompt?: string
}

export function presetText(ctx: Pick<DeviceContext, "preset" | "custom_prompt">) {
  if (ctx.preset === "custom") return (ctx.custom_prompt || "").trim() || PRESET_TEXT.studio
  return PRESET_TEXT[ctx.preset]
}

export function buildImagePrompt(ctx: DeviceContext, image: { kind: string; note?: string }, refCount: number): string {
  const kind = (IMAGE_KINDS as readonly string[]).includes(image.kind) ? (image.kind as ImageKind) : "other"
  const lines = [
    "You are a professional e-commerce product photo retoucher for a mobile phone shop.",
    refCount > 0
      ? `The FIRST image is the photo to enhance. The other ${refCount} attached image(s) show the SAME device; use them only as reference to preserve its real details. Enhance the first image only and return one image.`
      : "Enhance the attached photo and return one image.",
    `Device: ${ctx.title}${ctx.brand ? ` | brand: ${ctx.brand}` : ""}${ctx.model ? ` | model: ${ctx.model}` : ""} | condition: ${ctx.condition}.`,
    `This photo is the ${KIND_EN[kind]}.`,
  ]
  if (ctx.parts?.trim()) lines.push(`Real physical details of this device (must stay exactly as described): ${ctx.parts.trim()}`)
  if (image.note?.trim()) lines.push(`Note about this photo: ${image.note.trim()}`)
  if (kind === "box" || kind === "accessories") {
    lines.push("This is the box/accessories: only clean up and improve the background and lighting. Do not change, redraw or re-arrange the box or accessories themselves, their printing or their contents.")
  }
  const preset: Preset = ctx.condition !== "new" && !isPresetAllowed(ctx.condition, ctx.preset) ? "watermark_clean" : ctx.preset
  if (ctx.condition !== "new") {
    lines.push("The device is pre-owned: only clean the background. Do not hide, smooth or repair scratches, dents, wear or any defects on the device.")
  }
  lines.push(`Style (same for every photo of this device so they look consistent): ${presetText({ preset, custom_prompt: ctx.custom_prompt })}`)
  lines.push("Keep a portrait composition with the product centred and fully visible.")
  lines.push(KEEP_SAME)
  return lines.join("\n")
}

export function buildPartsPrompt(ctx: Pick<DeviceContext, "title" | "brand" | "model">): string {
  return [
    "أنت تساعد متجر جوالات. انظر إلى الصور المرفقة لنفس الجهاز.",
    `الجهاز: ${ctx.title}${ctx.brand ? ` (${ctx.brand}` + (ctx.model ? ` ${ctx.model})` : ")") : ""}.`,
    "اكتب بالعربي وصفاً قصيراً لأجزاء الجهاز الظاهرة فقط: عدد عدسات الكاميرا الخلفية وترتيبها، مكان أزرار الطاقة والصوت، المنافذ الظاهرة، اللون، وجود قلم أو ملحقات.",
    "قاعدة صارمة: اذكر فقط ما يُرى بوضوح في الصور. لا تذكر أي مواصفات تقنية أو أرقام (ذاكرة، معالج، ميغابكسل…) ولا تخمّن. إن لم يظهر جزء فلا تذكره.",
    "أعد سطراً أو سطرين بدون مقدمات.",
  ].join("\n")
}

export type CopyInput = {
  title: string
  brand?: string
  model?: string
  condition: string
  parts?: string
  price?: number
  currency?: string
  in_stock?: boolean
  specs?: Record<string, string>
  variants?: { storage?: string; color?: string }[]
  battery_health?: string
  condition_note?: string
  warranty?: string
}

export type CopyResult = { description: string; instagram: string; facebook: string; hashtags: string }

const COND_AR: Record<string, string> = { new: "جديد", used: "مستعمل", refurbished: "مجدّد" }

export function buildCopyPrompt(input: CopyInput): string {
  // لا نرسل أي بيانات خاصة (تكلفة، مورد، IMEI): فقط ما يجوز نشره
  const facts: string[] = [`الاسم: ${input.title}`, `الحالة: ${COND_AR[input.condition] || input.condition}`]
  if (input.brand) facts.push(`الماركة: ${input.brand}`)
  if (input.model) facts.push(`الموديل: ${input.model}`)
  if (input.price) facts.push(`السعر: ${input.price} ${(input.currency || "").toUpperCase()}`)
  if (input.in_stock !== undefined) facts.push(`التوفر: ${input.in_stock ? "متوفر" : "حسب الطلب"}`)
  for (const [k, v] of Object.entries(input.specs || {})) if (v?.trim()) facts.push(`${k}: ${v.trim()}`)
  const vs = (input.variants || []).map((v) => [v.storage, v.color].filter(Boolean).join(" ")).filter(Boolean)
  if (vs.length) facts.push(`الخيارات المتوفرة: ${vs.join("، ")}`)
  if (input.battery_health) facts.push(`صحة البطارية: ${input.battery_health}`)
  if (input.condition_note) facts.push(`وصف الحالة: ${input.condition_note}`)
  if (input.warranty) facts.push(`الضمان: ${input.warranty}`)
  if (input.parts) facts.push(`أجزاء الجهاز: ${input.parts}`)
  return [
    "أنت كاتب محتوى لمتجر جوالات في اليمن والسعودية اسمه لمسة فون. اكتب بالعربي الفصيح المبسّط.",
    "استخدم البيانات التالية فقط. ممنوع منعاً باتاً اختراع أي مواصفات أو أرقام أو مزايا غير مذكورة. إن نقصت معلومة فلا تذكرها.",
    "البيانات:",
    ...facts.map((f) => `- ${f}`),
    "",
    "أعد JSON فقط بهذه المفاتيح:",
    '{"description": "وصف المنتج للمتجر: فقرة قصيرة ثم نقاط بالمميزات والمواصفات المذكورة فقط، كل نقطة في سطر يبدأ بـ •",',
    ' "instagram": "كابشن إنستغرام قصير (3 إلى 5 أسطر) مع إيموجي مناسبة، بدون هاشتاقات وبدون روابط وبدون السعر (يُضاف تلقائياً)",',
    ' "facebook": "نص فيسبوك أطول قليلاً (4 إلى 7 أسطر) يذكر التوفر، بدون هاشتاقات وبدون روابط وبدون السعر (يُضاف تلقائياً)",',
    ' "hashtags": "8 إلى 15 هاشتاق للجوالات مفصولة بمسافات، عربي وإنجليزي"}',
  ].join("\n")
}

export function parseCopy(text: string | undefined): CopyResult {
  if (!text) throw new GeminiError("لم يرجع Gemini أي نص")
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")
  let j: any
  try {
    j = JSON.parse(raw)
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) throw new GeminiError("رد Gemini ليس بالصيغة المتوقعة، أعد توليد النصوص")
    j = JSON.parse(m[0])
  }
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : Array.isArray(v) ? v.join(" ").trim() : "")
  return { description: s(j.description), instagram: s(j.instagram), facebook: s(j.facebook), hashtags: s(j.hashtags) }
}

// تشغيل عدة مهام بتوازي محدود. كل مهمة مستقلة: الخطأ لا يوقف الباقي.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i], i) }
      } catch (reason) {
        out[i] = { status: "rejected", reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return out
}
