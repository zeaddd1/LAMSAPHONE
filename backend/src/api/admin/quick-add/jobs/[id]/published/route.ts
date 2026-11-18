import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cleanupFiles, loadJob, quickAdd, serializeJob } from "../../../../../../lib/quick-add/ai-jobs"
import type { PublishedBody } from "../../validators"

// اللوحة تُبلغ حالة كل خطوة بعد الاعتماد (رفع ← منتج ← فيسبوك ← إنستغرام ← الكتالوج)
// فشل منصة لا يلغي المنتج ولا المنصة الأخرى، وإعادة المحاولة تتم لكل منصة على حدة
export async function POST(req: MedusaRequest<PublishedBody>, res: MedusaResponse) {
  const b = req.validatedBody
  const { job } = await loadJob(req.scope, req.params.id)
  if (!["approved", "publishing", "published", "failed"].includes(job.status)) {
    res.status(400).json({ message: "اعتمد المهمة أولاً" })
    return
  }
  const steps = { ...(job.steps || {}), ...b.steps }
  await quickAdd(req.scope).updateQuickAddJobs({
    id: job.id,
    status: b.status,
    steps,
    error: b.error || null,
    ...(b.product_id ? { product_id: b.product_id } : {}),
  })
  // بعد النشر: الصور النهائية صارت ضمن المنتج، فنحذف ملفات الذكاء الاصطناعي المؤقتة (توفير مساحة التخزين)
  if (b.status === "published" && b.product_id) {
    const { images } = await loadJob(req.scope, job.id)
    await cleanupFiles(req.scope, images)
    for (const i of images) await quickAdd(req.scope).updateQuickAddImages({ id: i.id, result_url: null, result_file_id: null })
  }
  const fresh = await loadJob(req.scope, job.id)
  res.json({ job: serializeJob(fresh.job, fresh.images, true) })
}
