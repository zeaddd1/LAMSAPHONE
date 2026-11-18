import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isRunning, loadJob, quickAdd, serializeJob } from "../../../../../../lib/quick-add/ai-jobs"

// اعتماد المهمة: بعدها فقط تُنشئ اللوحة المنتج وتنشره بنفس دوال الإضافة السريعة الحالية
// (رفع الصور ← إنشاء المنتج ← /admin/quick-add/publish)، ثم تُبلغ النتيجة إلى /published
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const qa = quickAdd(req.scope)
  const { job, images } = await loadJob(req.scope, req.params.id)
  if (isRunning(job.id) || job.status === "generating") {
    res.status(409).json({ message: "انتظر حتى ينتهي التوليد" })
    return
  }
  if (!["ready_for_review", "failed", "approved"].includes(job.status)) {
    res.status(400).json({ message: "لا يمكن اعتماد هذه المهمة الآن" })
    return
  }
  if (job.product_id) {
    res.status(400).json({ message: "أُنشئ المنتج لهذه المهمة مسبقاً" })
    return
  }
  const usable = images.filter((i) => !i.excluded)
  if (!usable.length) {
    res.status(400).json({ message: "استبعدت كل الصور: أبقِ صورة واحدة على الأقل" })
    return
  }
  await qa.updateQuickAddJobs({ id: job.id, status: "approved", error: null })
  const fresh = await loadJob(req.scope, job.id)
  res.json({ job: serializeJob(fresh.job, fresh.images, true) })
}
