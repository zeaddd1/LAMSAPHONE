import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorOf, buildService, loadJob, quickAdd, rateLimited } from "../../../../../../lib/quick-add/ai-jobs"
import { arabicError } from "../../../../../../lib/quick-add/gemini"

// "اقترح الأجزاء من الصور": مسودة لما يظهر في الصور فقط، يراجعها المستخدم قبل الاعتماد (لا تُحفظ تلقائياً)
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (rateLimited(actorOf(req))) {
    res.status(429).json({ message: "طلبات كثيرة: الحد 10 طلبات توليد في الدقيقة" })
    return
  }
  const { job, images } = await loadJob(req.scope, req.params.id)
  try {
    const svc = await buildService(req.scope)
    const suggestion = await svc.suggestParts(job, images)
    await quickAdd(req.scope).updateQuickAddJobs({ id: job.id, ai_calls: (job.ai_calls || 0) + svc.calls })
    res.json({ suggestion })
  } catch (e) {
    res.status(400).json({ message: (e as any)?.status ? arabicError(e) : (e as any)?.message || arabicError(e) })
  }
}
