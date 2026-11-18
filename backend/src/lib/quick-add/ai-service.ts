// QuickAddService: كل منطق الذكاء الاصطناعي لمهمة جهاز واحد (تحسين الصور، اقتراح الأجزاء، النصوص).
// لا يعرف شيئاً عن Medusa: القراءة والحفظ والتحديث تُمرَّر له، فيُختبر بـ mock كامل.

import {
  ANGLES,
  Angle,
  CopyInput,
  CopyResult,
  DeviceContext,
  GeminiApi,
  GeminiError,
  InlineImage,
  Preset,
  angleOf,
  arabicError,
  buildAnglePrompt,
  buildCopyPrompt,
  buildImagePrompt,
  buildPartsPrompt,
  isAngleKind,
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
  source?: string
  result_file_id?: string | null
  status?: string
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
    // صور الزوايا لا تُعاد معالجتها مع "إعادة توليد الكل": لها مسارها الخاص (أو تُحسَّن يدوياً بتحديدها)
    const active = images.filter((i) => !i.excluded).sort((a, b) => a.rank - b.rank)
    const targets = onlyIds?.length ? active.filter((i) => onlyIds.includes(i.id)) : active.filter((i) => !isAngleKind(i.kind))
    // نقرأ كل صورة مرة واحدة (الأصل < 1MB)
    const cache = new Map<string, Promise<InlineImage>>()
    const read = (img: AiImage) => {
      if (!cache.has(img.source_file_id)) cache.set(img.source_file_id, this.deps.readImage(img.source_file_id))
      return cache.get(img.source_file_id)!
    }
    for (const t of targets) await this.deps.updateImage(t.id, { status: "generating", error: null })

    const results = await mapLimit(targets, this.deps.concurrency, async (target) => {
      const refs = active
        .filter((i) => i.id !== target.id && !["box", "accessories"].includes(i.kind) && !isAngleKind(i.kind))
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

  /**
   * الزوايا الأربع: صورة منفصلة لكل زاوية (أمامي، خلفي، ثلاثة أرباع، جانبي) بنفس النمط.
   * الأمامي أولاً، ثم يُمرَّر مع المرجع الأصلي لبقية الزوايا (بتوازي محدود). فشل زاوية لا يوقف البقية.
   * angleImages: سجلات angle_* الموجودة للمهمة. only: زوايا محددة فقط.
   */
  async generateAnglePack(job: AiJob, images: AiImage[], angleImages: AiImage[], only?: Angle[]) {
    if (job.condition !== "new") throw new GeminiError("الأجهزة المستعملة: استخدم صوراً حقيقية للجهاز")
    const ctx = deviceContext(job)
    const uploads = images.filter((i) => !i.excluded && !isAngleKind(i.kind)).sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.rank - b.rank)
    if (!uploads.length) throw new GeminiError("أضف صورة مرجعية واحدة على الأقل للجهاز")
    const primary = uploads.find((i) => i.kind === "front") || uploads[0]
    const realRef: Partial<Record<Angle, AiImage>> = {
      front: uploads.find((i) => i.kind === "front"),
      back: uploads.find((i) => i.kind === "back"),
      side: uploads.find((i) => i.kind === "side"),
    }
    const record = (a: Angle) => angleImages.find((i) => angleOf(i.kind) === a)
    const wanted = (only?.length ? only : [...ANGLES]).filter((a) => record(a) && record(a)!.source !== "manual")
    const read = (fileId: string) => this.deps.readImage(fileId)
    const primaryData = await read(primary.source_file_id)

    for (const a of wanted) await this.deps.updateImage(record(a)!.id, { status: "generating", error: null })

    const runAngle = async (a: Angle, frontResult?: InlineImage) => {
      const rec = record(a)!
      const real = realRef[a] && realRef[a]!.id !== primary.id ? realRef[a] : undefined
      try {
        const extra = [real ? await read(real.source_file_id) : null, frontResult || null].filter(Boolean) as InlineImage[]
        const full = buildAnglePrompt(ctx, a, { realAngleRef: Boolean(real) || (a === "front" && primary.kind === "front"), frontResult: Boolean(frontResult) })
        let r = await this.call({ model: this.deps.imageModel, wantImage: true, aspectRatio: "1:1", parts: [{ inlineData: primaryData }, ...extra.map((d) => ({ inlineData: d })), { text: full }] })
        if (!r.image) {
          // رفض أو رجوع بدون صورة: نسجّل السبب ونعيد مرة واحدة ببرومت مبسّط بلا مراجع إضافية
          this.log(`quick-add ai: angle ${a} refused (${r.blockReason || r.finishReason || "no image"}), retrying simplified`)
          const simple = buildAnglePrompt(ctx, a, { realAngleRef: false, frontResult: false, simplified: true })
          r = await this.call({ model: this.deps.imageModel, wantImage: true, aspectRatio: "1:1", parts: [{ inlineData: primaryData }, { text: simple }] })
        }
        if (!r.image) {
          throw new GeminiError(
            `رفض Gemini توليد هذه الزاوية${r.blockReason || r.finishReason ? ` (${r.blockReason || r.finishReason})` : ""}. أعد المحاولة أو استخدم الوضع اليدوي`
          )
        }
        const saved = await this.deps.saveImage(r.image, `angle-${job.id}-${a}`)
        await this.deps.updateImage(rec.id, { status: "done", error: null, result_file_id: saved.id, result_url: saved.url })
        this.log(`quick-add ai: angle ${a} done`)
        return r.image
      } catch (e) {
        const msg = e instanceof GeminiError && !e.status && !/timeout/.test(e.message) ? e.message : arabicError(e)
        await this.deps.updateImage(rec.id, { status: "failed", error: msg })
        this.log(`quick-add ai: angle ${a} failed (${(e as any)?.status || "-"})`)
        throw e
      }
    }

    // 1) الأمامي أولاً (أو نتيجته السابقة إن كانت موجودة ولم تُطلب)
    let front: InlineImage | undefined
    let done = 0
    let failed = 0
    if (wanted.includes("front")) {
      try {
        front = await runAngle("front")
        done++
      } catch {
        failed++
      }
    } else {
      const prev = record("front")
      if (prev?.status === "done" && prev.result_file_id) front = await read(prev.result_file_id).catch(() => undefined)
    }
    // 2) البقية بتوازي محدود، مع الأمامي كمرجع للتناسق
    const rest = wanted.filter((a) => a !== "front")
    const results = await mapLimit(rest, this.deps.concurrency, (a) => runAngle(a, front))
    done += results.filter((r) => r.status === "fulfilled").length
    failed += results.filter((r) => r.status === "rejected").length
    return { done, failed }
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
