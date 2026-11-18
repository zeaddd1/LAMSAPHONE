import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorOf, enqueue, fixStale, quickAdd, rateLimited, serializeJob } from "../../../../lib/quick-add/ai-jobs"
import { getGeminiSettings } from "../../../../lib/quick-add/gemini-settings"
import { quickAddGenerateWorkflow } from "../../../../workflows/quick-add-generate"
import type { CreateJobBody } from "./validators"

// قائمة آخر المهام (بدون البيانات الخاصة)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const qa = quickAdd(req.scope)
  const take = Math.min(50, Number(req.query.limit) || 20)
  const [jobs, count] = await qa.listAndCountQuickAddJobs({}, { take, order: { created_at: "DESC" }, relations: ["images"] })
  await fixStale(req.scope, jobs)
  res.json({ jobs: jobs.map((j: any) => serializeJob(j, (j.images || []).sort((a: any, b: any) => a.rank - b.rank))), count })
}

// مهمة جديدة: تُحفظ الصور الأصلية (مرفوعة مسبقاً عبر /admin/uploads)، ثم يبدأ التوليد في الخلفية
export async function POST(req: MedusaRequest<CreateJobBody>, res: MedusaResponse) {
  const b = req.validatedBody
  const s = await getGeminiSettings(req.scope)
  // بدون مفتاح: يُسمح فقط بمهمة بلا توليد (للتوليد اليدوي عبر حساب Gemini)
  if (!s.api_key && b.generate) {
    res.status(400).json({ message: "Gemini غير مربوط: أضف المفتاح من صفحة ربط ميتا ← تبويب Gemini، أو استخدم التوليد اليدوي", manual: true })
    return
  }
  if (b.generate && rateLimited(actorOf(req))) {
    res.status(429).json({ message: "طلبات كثيرة: الحد 10 طلبات توليد في الدقيقة. انتظر قليلاً" })
    return
  }
  const qa = quickAdd(req.scope)
  const job: any = await qa.createQuickAddJobs({
    // بلا توليد (يدوي): المهمة جاهزة للمراجعة مباشرة
    status: b.generate ? "pending" : "ready_for_review",
    title: b.title,
    brand: b.brand,
    model_name: b.model_name,
    condition: b.condition,
    parts: b.parts,
    preset: b.preset,
    custom_prompt: b.custom_prompt,
    input: b.input as any,
    private: b.private as any,
    copy_status: b.generate && b.generate_copy ? "pending" : "skipped",
    steps: {},
    created_by: actorOf(req),
  })
  const hasMain = b.images.some((i) => i.is_main)
  await qa.createQuickAddImages(
    b.images.map((i, k) => ({
      job_id: job.id,
      kind: i.kind,
      note: i.note,
      rank: k,
      is_main: hasMain ? i.is_main : k === 0,
      source_file_id: i.file_id,
      source_url: i.url,
      status: "pending",
    })) as any
  )
  req.scope.resolve("logger").info(`quick-add ai: job ${job.id} created (${b.images.length} images)`)
  if (b.generate) {
    enqueue(req.scope, { job_id: job.id, images: true, copy: b.generate_copy }, (input) => quickAddGenerateWorkflow(req.scope).run({ input }))
  }
  const fresh = await qa.retrieveQuickAddJob(job.id, { relations: ["images"] })
  res.json({ job: serializeJob(fresh, ((fresh as any).images || []).sort((a: any, b: any) => a.rank - b.rank), true) })
}
