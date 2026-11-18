import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorOf, buildService, loadJob, quickAdd, rateLimited } from "../../../../../../lib/quick-add/ai-jobs"
import { errorText } from "../../../../../../lib/quick-add/ai-service"
import { QuotaWaitError } from "../../../../../../lib/quick-add/quota"

// "اقترح الأجزاء من الصور": مسودة لما يظهر في الصور فقط، يراجعها المستخدم قبل الاعتماد (لا تُحفظ تلقائياً)
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (rateLimited(actorOf(req))) {
    res.status(429).json({ message: "طلبات كثيرة: الحد 10 طلبات توليد في الدقيقة" })
    return
  }
  const { job, images } = await loadJob(req.scope, req.params.id)
  try {
    const svc = await buildService(req.scope, job.id)
    const suggestion = await svc.suggestParts(job, images)
    await quickAdd(req.scope).updateQuickAddJobs({ id: job.id, ai_calls: (job.ai_calls || 0) + svc.calls })
    res.json({ suggestion })
  } catch (e) {
    if (e instanceof QuotaWaitError) {
      res.status(429).json({ message: `${e.message} (${e.retryAt.toISOString()})`, retry_at: e.retryAt.toISOString() })
      return
    }
    res.status(400).json({ message: errorText(e) })
  }
}
