// QuickAddService: كل منطق الذكاء الاصطناعي لمهمة جهاز واحد (تحسين الصور، اقتراح الأجزاء، النصوص).
// لا يعرف شيئاً عن Medusa: القراءة والحفظ والتحديث تُمرَّر له، فيُختبر بـ mock كامل.

import {
  CopyInput,
  CopyResult,
  DeviceContext,
  GeminiApi,
  GeminiError,
  InlineImage,
  Preset,
  arabicError,
  buildCopyPrompt,
  buildImagePrompt,
  buildPartsPrompt,
  isPresetAllowed,
  mapLimit,
  parseCopy,
  withRetry,
} from "./gemini"

export type AiJob = {
  id: string
  title: string
  brand: string
  model_name: string
  condition: string
  parts: string
  preset: string
  custom_prompt: string
  input?: Record<string, any> | null
}
export type AiImage = {
  id: string
  kind: string
  note: string
  rank: number
  is_main: boolean
  excluded: boolean
  source_file_id: string
}
export type ImagePatch = { status: "generating" | "done" | "failed"; error?: string | null; result_file_id?: string | null; result_url?: string | null }

export type AiDeps = {
  api: GeminiApi
  imageModel: string
  textModel: string
  concurrency: number
  readImage: (fileId: string) => Promise<InlineImage>
  saveImage: (img: InlineImage, name: string) => Promise<{ id: string; url: string }>
  updateImage: (id: string, patch: ImagePatch) => Promise<void>
  log?: (msg: string) => void
  timeoutMs?: number
  sleep?: (ms: number) => Promise<void>
}

const MAX_REFS = 4
const KIND_ORDER = ["front", "back", "side", "other", "box", "accessories"]

export function deviceContext(job: AiJob): DeviceContext {
  // قاعدة الصدق تُطبَّق هنا أيضاً حتى لو تجاوزتها اللوحة
  const preset = (isPresetAllowed(job.condition, job.preset) ? job.preset : "watermark_clean") as Preset
  return { title: job.title, brand: job.brand, model: job.model_name, condition: job.condition, parts: job.parts, preset, custom_prompt: job.custom_prompt }
}

export class QuickAddService {
  calls = 0
  constructor(private deps: AiDeps) {}

  private log(m: string) {
    this.deps.log?.(m)
  }

  private call(req: Parameters<GeminiApi["generate"]>[0]) {
    return withRetry(
      (signal) => {
        this.calls++
        return this.deps.api.generate({ ...req, signal })
      },
      { timeoutMs: this.deps.timeoutMs, sleep: this.deps.sleep }
    )
  }

  /** يحسّن صور المهمة (كلها أو المحددة فقط). فشل صورة لا يوقف البقية. */
  async enhanceImages(job: AiJob, images: AiImage[], onlyIds?: string[]) {
    const ctx = deviceContext(job)
    const active = images.filter((i) => !i.excluded).sort((a, b) => a.rank - b.rank)
    const targets = onlyIds?.length ? active.filter((i) => onlyIds.includes(i.id)) : active
    // نقرأ كل صورة مرة واحدة (الأصل < 1MB)
    const cache = new Map<string, Promise<InlineImage>>()
    const read = (img: AiImage) => {
      if (!cache.has(img.source_file_id)) cache.set(img.source_file_id, this.deps.readImage(img.source_file_id))
      return cache.get(img.source_file_id)!
    }
    for (const t of targets) await this.deps.updateImage(t.id, { status: "generating", error: null })

    const results = await mapLimit(targets, this.deps.concurrency, async (target) => {
      const refs = active
        .filter((i) => i.id !== target.id && !["box", "accessories"].includes(i.kind))
        .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
        .slice(0, MAX_REFS)
      try {
        const [main, ...refData] = await Promise.all([read(target), ...refs.map(read)])
        const prompt = buildImagePrompt(ctx, target, refData.length)
        const r = await this.call({
          model: this.deps.imageModel,
          wantImage: true,
          parts: [{ inlineData: main }, ...refData.map((d) => ({ inlineData: d })), { text: prompt }],
        })
        if (!r.image) {
          throw new GeminiError(
            r.finishReason && /SAFETY|PROHIBITED|BLOCK/i.test(r.finishReason)
              ? "رفض Gemini تعديل هذه الصورة (فلتر الأمان). جرّب صورة أخرى أو نمطاً مختلفاً"
              : "رجع Gemini بدون صورة لهذه اللقطة. اضغط إعادة التوليد"
          )
        }
        const saved = await this.deps.saveImage(r.image, `ai-${job.id}-${target.id}`)
        await this.deps.updateImage(target.id, { status: "done", error: null, result_file_id: saved.id, result_url: saved.url })
        this.log(`quick-add ai: image ${target.id} done`)
        return saved
      } catch (e) {
        const msg = e instanceof GeminiError && !e.status && !/timeout/.test(e.message) ? e.message : arabicError(e)
        await this.deps.updateImage(target.id, { status: "failed", error: msg })
        this.log(`quick-add ai: image ${target.id} failed (${(e as any)?.status || "-"})`)
        throw e
      }
    })
    return {
      done: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    }
  }

  /** يقترح وصف الأجزاء الظاهرة من الصور فقط (مسودة يراجعها المستخدم). */
  async suggestParts(job: AiJob, images: AiImage[]): Promise<string> {
    const active = images.filter((i) => !i.excluded).sort((a, b) => a.rank - b.rank).slice(0, 6)
    if (!active.length) throw new GeminiError("أضف صورة واحدة على الأقل")
    const data = await Promise.all(active.map((i) => this.deps.readImage(i.source_file_id)))
    const r = await this.call({
      model: this.deps.textModel,
      parts: [...data.map((d) => ({ inlineData: d })), { text: buildPartsPrompt({ title: job.title, brand: job.brand, model: job.model_name }) }],
    })
    const t = (r.text || "").trim()
    if (!t) throw new GeminiError("لم يرجع Gemini أي اقتراح")
    return t.slice(0, 1500)
  }

  /** يولّد وصف المتجر ونص إنستغرام وفيسبوك والهاشتاقات من البيانات المدخلة فقط. */
  async generateCopy(job: AiJob): Promise<CopyResult> {
    const i = job.input || {}
    const input: CopyInput = {
      title: job.title,
      brand: job.brand,
      model: job.model_name,
      condition: job.condition,
      parts: job.parts,
      price: typeof i.price === "number" ? i.price : undefined,
      currency: i.currency_code,
      in_stock: i.in_stock,
      specs: i.specs_labeled || {},
      variants: i.variants || [],
      battery_health: i.battery_health,
      condition_note: i.condition_note,
      warranty: i.warranty,
    }
    const r = await this.call({ model: this.deps.textModel, json: true, parts: [{ text: buildCopyPrompt(input) }] })
    return parseCopy(r.text)
  }
}
