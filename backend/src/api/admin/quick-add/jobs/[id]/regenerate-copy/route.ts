import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorOf, enqueue, isRunning, loadJob, rateLimited, serializeJob } from "../../../../../../lib/quick-add/ai-jobs"
import { quickAddGenerateWorkflow } from "../../../../../../workflows/quick-add-generate"

// إعادة توليد النصوص فقط (الصور كما هي)
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { job, images } = await loadJob(req.scope, req.params.id)
  if (["published", "publishing", "rejected"].includes(job.status)) {
    res.status(400).json({ message: "المهمة منشورة أو مرفوضة" })
    return
  }
  if (isRunning(job.id)) {
    res.status(409).json({ message: "التوليد جارٍ لهذه المهمة، انتظر حتى ينتهي" })
    return
  }
  if (rateLimited(actorOf(req))) {
    res.status(429).json({ message: "طلبات كثيرة: الحد 10 طلبات توليد في الدقيقة" })
    return
  }
  enqueue(req.scope, { job_id: job.id, images: false, copy: true }, (input) => quickAddGenerateWorkflow(req.scope).run({ input }))
  res.json({ job: serializeJob({ ...job, status: "generating", copy_status: "generating" }, images, true) })
}
