import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cleanupFiles, loadJob, quickAdd, serializeJob } from "../../../../../../lib/quick-add/ai-jobs"

// رفض المهمة: لا يُحفظ شيء في المتجر، وتُحذف ملفات الذكاء الاصطناعي المؤقتة
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { job, images } = await loadJob(req.scope, req.params.id)
  if (["published", "publishing"].includes(job.status)) {
    res.status(400).json({ message: "المهمة منشورة" })
    return
  }
  await quickAdd(req.scope).updateQuickAddJobs({ id: job.id, status: "rejected" })
  await cleanupFiles(req.scope, images)
  res.json({ job: serializeJob({ ...job, status: "rejected" }, images, true) })
}
