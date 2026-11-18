import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { QUICK_ADD_MODULE } from "../../modules/quick-add"
import type QuickAddModuleService from "../../modules/quick-add/service"
import { AiImage, AiJob, GenResult, QuickAddService, deviceContext, errorText } from "./ai-service"
import { Angle, GeminiApi, InlineImage, angleStyle, arabicError, createGeminiApi, isAngleKind } from "./gemini"
import { GeminiSettings, getGeminiSettings, patchGeminiSettings } from "./gemini-settings"
import { MANUAL_MESSAGE, QuotaGuard, QuotaWaitError, UsageStore, WAIT_MESSAGE, estimateImages } from "./quota"

// ربط QuickAddService بـ Medusa: قراءة الصور وحفظها عبر File Module، وتحديث جداول المهام،
// وطابور خفيف (مهمة واحدة في كل مرة) حتى لا يُثقل السيرفر المشترك.

type Scope = { resolve: (key: string) => any }

export const FINAL = ["published", "rejected", "failed"]
export const quickAdd = (scope: Scope) => scope.resolve(QUICK_ADD_MODULE) as QuickAddModuleService

// للاختبارات: استبدال Gemini بـ mock
let apiFactory: (key: string) => GeminiApi = createGeminiApi
export function setGeminiApiFactory(f: (key: string) => GeminiApi) {
  apiFactory = f
}

function sniffMime(buf: Buffer) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png"
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp"
  return "image/jpeg"
}
const EXT: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" }

// ---------- سجل الاستهلاك وحارس الحصص ----------
export function usageStore(scope: Scope): UsageStore {
  const qa = quickAdd(scope)
  return {
    countText: async (since) => {
      const [, count] = await qa.listAndCountGeminiUsageLogs({ kind: "text", created_at: { $gte: since } } as any, { take: 1, select: ["id"] })
      return count
    },
    spend: async (since) => {
      const rows: any[] = await qa.listGeminiUsageLogs({ kind: "image", created_at: { $gte: since } } as any, { select: ["cost_usd"], take: 100000 })
      return rows.reduce((a, r) => a + (Number(r.cost_usd) || 0), 0)
    },
    log: async (e) => {
      await qa.createGeminiUsageLogs(e as any)
    },
    getSettings: () => getGeminiSettings(scope),
    patchSettings: (p) => patchGeminiSettings(scope, () => p),
  }
}
export const quotaGuard = (scope: Scope) => new QuotaGuard(usageStore(scope))
export const geminiUsage = (scope: Scope) => quotaGuard(scope).usage()

/**
 * بوابة الصور قبل أي توليد عبر API: اليدوي = ممنوع، والمدفوع = يحتاج تأكيد التكلفة التقديرية.
 * تعيد null إن سُمح، أو [status, body] للرد.
 */
export async function imageGate(scope: Scope, s: GeminiSettings, count: number, confirmed?: boolean, retriesUpTo = 0): Promise<[number, any] | null> {
  if (count <= 0) return null
  if (s.image_mode !== "paid_api") return [400, { message: s.cap_note ? `${s.cap_note}. ${MANUAL_MESSAGE}` : MANUAL_MESSAGE, manual: true }]
  if (confirmed) return null
  const u = await geminiUsage(scope)
  const estimate = { ...estimateImages(s, count, retriesUpTo), month_spend: u.month_spend, monthly_cap: u.monthly_cap, day_spend: u.day_spend, daily_cap: u.daily_cap }
  return [200, { needs_confirm: true, estimate }]
}

export async function buildService(scope: Scope, jobId?: string) {
  const s = await getGeminiSettings(scope)
  if (!s.api_key) throw new Error("Gemini غير مربوط: أضف المفتاح من صفحة ربط ميتا ← Gemini")
  const files = scope.resolve(Modules.FILE)
  const qa = quickAdd(scope)
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  return new QuickAddService({
    guard: quotaGuard(scope),
    jobId,
    api: apiFactory(s.api_key),
    imageModel: s.image_model,
    textModel: s.text_model,
    concurrency: s.concurrency,
    readImage: async (fileId: string): Promise<InlineImage> => {
      const buf: Buffer = await files.getAsBuffer(fileId)
      return { data: buf.toString("base64"), mimeType: sniffMime(buf) }
    },
    saveImage: async (img, name) => {
      const f = await files.createFiles({ filename: `${name}.${EXT[img.mimeType] || "png"}`, mimeType: img.mimeType, content: img.data, access: "public" })
      return { id: f.id, url: f.url }
    },
    updateImage: async (id, patch) => {
      await qa.updateQuickAddImages({ id, ...patch })
    },
    log: (m) => logger.info(m),
  })
}

export async function loadJob(scope: Scope, id: string) {
  const qa = quickAdd(scope)
  const job = await qa.retrieveQuickAddJob(id, { relations: ["images"] })
  const images = ((job as any).images || []).filter((i: any) => !i.deleted_at).sort((a: any, b: any) => a.rank - b.rank)
  return { job: job as any, images: images as any[] }
}

export type GenerateInput = { job_id: string; images?: boolean; image_ids?: string[]; copy?: boolean; angles?: Angle[] }

// تُستدعى من workflow quick-add-generate
export async function runGeneration(scope: Scope, input: GenerateInput) {
  const qa = quickAdd(scope)
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { job, images } = await loadJob(scope, input.job_id)
  if (["published", "publishing", "rejected"].includes(job.status)) return
  await qa.updateQuickAddJobs({ id: job.id, status: "generating", error: null, wait_until: null, wait_task: null, ...(input.copy ? { copy_status: "generating", copy_error: null } : {}) })
  let svc: QuickAddService
  try {
    svc = await buildService(scope, job.id)
  } catch (e: any) {
    await qa.updateQuickAddJobs({ id: job.id, status: "failed", error: e.message, ...(input.copy ? { copy_status: "failed", copy_error: e.message } : {}) })
    return
  }
  const settings = await getGeminiSettings(scope)
  // الوضع اليدوي: لا طلبات صور للـ API إطلاقاً (تبقى الصور الأصلية، والتوليد من بطاقة الوضع اليدوي)
  const manual = settings.image_mode !== "paid_api"
  logger.info(`quick-add ai: job ${job.id} started${manual ? " (manual image mode)" : ""}`)
  const aiJob = job as AiJob
  const tasks: Promise<unknown>[] = []
  let imgResult: GenResult = { done: 0, failed: 0 }
  let copyOk = true
  let copyWait: Date | null = null
  const wantAngles = !manual && Boolean(input.angles?.length)
  const wantImages = !manual && !input.angles?.length && input.images !== false
  if (manual && input.angles?.length) {
    for (const i of images) if (input.angles.some((a) => i.kind === `angle_${a}`) && i.source !== "manual") await qa.updateQuickAddImages({ id: i.id, status: "failed", error: MANUAL_MESSAGE })
  }
  if (wantAngles) {
    // الزوايا الأربع (تُشغَّل وحدها، بعد أي توليد آخر في الطابور)
    const uploads = images.filter((i: any) => !isAngleKind(i.kind))
    const angleImgs = images.filter((i: any) => isAngleKind(i.kind))
    tasks.push(
      svc.generateAnglePack(aiJob, uploads as AiImage[], angleImgs as AiImage[], input.angles).then(
        (r) => (imgResult = r),
        async (e) => {
          imgResult = { done: 0, failed: input.angles!.length }
          for (const i of angleImgs) if (input.angles!.some((a) => i.kind === `angle_${a}`) && i.source !== "manual") await qa.updateQuickAddImages({ id: i.id, status: "failed", error: errorText(e) })
        }
      )
    )
  } else if (wantImages) {
    tasks.push(svc.enhanceImages(aiJob, images as AiImage[], input.image_ids).then((r) => (imgResult = r)))
  }
  if (input.copy) {
    tasks.push(
      svc
        .generateCopy(aiJob)
        .then((copy) => qa.updateQuickAddJobs({ id: job.id, copy, copy_status: "done", copy_error: null }))
        .catch(async (e) => {
          if (e instanceof QuotaWaitError) {
            copyWait = e.retryAt
            await qa.updateQuickAddJobs({ id: job.id, copy_status: "waiting", copy_error: WAIT_MESSAGE })
            return
          }
          copyOk = false
          await qa.updateQuickAddJobs({ id: job.id, copy_status: "failed", copy_error: errorText(e) })
        })
    )
  }
  await Promise.allSettled(tasks)
  const fresh = await qa.retrieveQuickAddJob(job.id)
  const calls = (fresh.ai_calls || 0) + svc.calls

  // حد الاستخدام: نحفظ ما تبقى ونكمل تلقائياً عند التجدد (لا تُفقد بيانات المهمة)
  const waitTimes = [imgResult.retryAt ? new Date(imgResult.retryAt) : null, copyWait as Date | null].filter(Boolean) as Date[]
  if (waitTimes.length) {
    const until = new Date(Math.max(...waitTimes.map((d) => d.getTime())))
    const task: GenerateInput = {
      job_id: job.id,
      copy: Boolean(copyWait),
      images: Boolean(imgResult.waiting?.length) && !wantAngles,
      ...(imgResult.waiting?.length && wantImages ? { image_ids: imgResult.waiting } : {}),
      ...(imgResult.waiting?.length && wantAngles ? { angles: imgResult.waiting as Angle[] } : {}),
    }
    await qa.updateQuickAddJobs({ id: job.id, status: "waiting", error: WAIT_MESSAGE, wait_until: until, wait_task: task as any, ai_calls: calls })
    scheduleResume(scope, job.id, until)
    logger.info(`quick-add ai: job ${job.id} waiting for quota until ${until.toISOString()}`)
    return
  }
  const allFailed = wantImages && imgResult.done === 0 && imgResult.failed > 0 && (!input.copy || !copyOk)
  await qa.updateQuickAddJobs({
    id: job.id,
    status: allFailed ? "failed" : "ready_for_review",
    error: allFailed ? "فشل توليد كل الصور والنصوص. راجع إعدادات Gemini ثم أعد المحاولة" : null,
    ai_calls: calls,
  })
  logger.info(`quick-add ai: job ${job.id} ready (${imgResult.done} ok, ${imgResult.failed} failed, copy ${copyOk ? "ok" : "failed"})`)
}

// ---------- الاستكمال التلقائي بعد التجدد ----------
const timers = new Map<string, ReturnType<typeof setTimeout>>()
export function scheduleResume(scope: Scope, jobId: string, at: Date) {
  clearTimeout(timers.get(jobId))
  const delay = Math.min(2_000_000_000, Math.max(1000, at.getTime() - Date.now() + 2000))
  const t = setTimeout(() => {
    timers.delete(jobId)
    resumeJob(scope, jobId).catch(() => null)
  }, delay)
  ;(t as any).unref?.()
  timers.set(jobId, t)
}
export async function resumeJob(scope: Scope, jobId: string) {
  if (running.has(jobId)) return
  const job: any = await quickAdd(scope).retrieveQuickAddJob(jobId).catch(() => null)
  if (!job || job.status !== "waiting" || !job.wait_task) return
  enqueue(scope, { ...(job.wait_task as GenerateInput), job_id: jobId }, (input) => runGeneration(scope, input))
}

// ---------- طابور خفيف ----------
const running = new Set<string>()
let chain: Promise<unknown> = Promise.resolve()

export function isRunning(jobId: string) {
  return running.has(jobId)
}

export function enqueue(scope: Scope, input: GenerateInput, runner: (input: GenerateInput) => Promise<unknown>) {
  running.add(input.job_id)
  // مهمة واحدة في كل مرة (وضع الدفعات)، وداخلها صور متوازية حسب الإعداد
  chain = chain
    .then(() => runner(input))
    .catch(async (e) => {
      scope.resolve(ContainerRegistrationKeys.LOGGER).error(`quick-add ai: job ${input.job_id} crashed: ${arabicError(e)}`)
      await quickAdd(scope).updateQuickAddJobs({ id: input.job_id, status: "failed", error: arabicError(e) }).catch(() => null)
    })
    .finally(() => running.delete(input.job_id))
}

// مهام بقيت "جاري التوليد" بعد إعادة تشغيل السيرفر: نعلّمها فاشلة حتى يعيد المستخدم المحاولة بلا فقد بيانات.
// ومهام "بانتظار التجدد": نعيد جدولتها (المؤقت يضيع عند إعادة التشغيل)
export async function fixStale(scope: Scope, jobs: any[]) {
  const qa = quickAdd(scope)
  const limit = Date.now() - 15 * 60_000
  for (const j of jobs) {
    if (j.status === "waiting" && j.wait_task && !running.has(j.id) && !timers.has(j.id)) {
      scheduleResume(scope, j.id, j.wait_until ? new Date(j.wait_until) : new Date())
      continue
    }
    if (j.status !== "generating" || running.has(j.id) || new Date(j.updated_at).getTime() > limit) continue
    await qa.updateQuickAddJobs({ id: j.id, status: "failed", error: "انقطع التوليد (ربما أُعيد تشغيل السيرفر). أعد المحاولة" })
    const imgs = await qa.listQuickAddImages({ job_id: j.id, status: "generating" } as any)
    for (const i of imgs) await qa.updateQuickAddImages({ id: i.id, status: "failed", error: "انقطع التوليد، أعد المحاولة" })
    j.status = "failed"
  }
}

// ---------- حد الطلبات: 10 طلبات توليد في الدقيقة لكل مستخدم ----------
const hits = new Map<string, number[]>()
export function rateLimited(actor: string, max = 10, windowMs = 60_000, now = Date.now()) {
  const list = (hits.get(actor) || []).filter((t) => now - t < windowMs)
  if (list.length >= max) {
    hits.set(actor, list)
    return true
  }
  list.push(now)
  hits.set(actor, list)
  return false
}

export function actorOf(req: any): string {
  return req?.auth_context?.actor_id || "admin"
}

// ---------- ما يُرسل للوحة ----------
export function serializeJob(job: any, images: any[] = [], withPrivate = false) {
  return {
    id: job.id,
    status: job.status,
    error: job.error,
    title: job.title,
    brand: job.brand,
    model_name: job.model_name,
    condition: job.condition,
    parts: job.parts,
    preset: job.preset,
    custom_prompt: job.custom_prompt,
    input: job.input || {},
    copy: job.copy || null,
    copy_status: job.copy_status,
    copy_error: job.copy_error,
    steps: job.steps || {},
    wait_until: job.wait_until || null,
    product_id: job.product_id,
    created_at: job.created_at,
    updated_at: job.updated_at,
    running: running.has(job.id),
    // لوحة التحكم فقط (مسار admin محمي)، ولا يدخل في المنتج ولا المنشورات
    ...(withPrivate ? { private: job.private || {} } : {}),
    // نص النمط الثابت (لبرومتات التوليد اليدوي في اللوحة)
    style_text: angleStyle(deviceContext(job as AiJob)),
    images: images.map((i) => ({
      id: i.id,
      kind: i.kind,
      source: i.source || "upload",
      note: i.note,
      rank: i.rank,
      is_main: i.is_main,
      excluded: i.excluded,
      source_url: i.source_url,
      result_url: i.result_url,
      status: i.status,
      error: i.error,
    })),
  }
}

// حذف ملفات الذكاء الاصطناعي المؤقتة (الأصل والنتيجة) بعد النشر أو الرفض: الصور النهائية تُرفع من جديد مع المنتج
export async function cleanupFiles(scope: Scope, images: any[]) {
  const ids = images.flatMap((i) => [i.source_file_id, i.result_file_id]).filter(Boolean)
  if (!ids.length) return
  await scope.resolve(Modules.FILE).deleteFiles(ids).catch(() => null)
}
