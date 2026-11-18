import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorOf, enqueue, isRunning, loadJob, quickAdd, rateLimited, serializeJob } from "../../../../../../lib/quick-add/ai-jobs"
import { ANGLES, Angle, angleKind, angleOf, isAngleKind } from "../../../../../../lib/quick-add/gemini"
import { getGeminiSettings } from "../../../../../../lib/quick-add/gemini-settings"
import { quickAddGenerateWorkflow } from "../../../../../../workflows/quick-add-generate"
import type { AnglesBody } from "../../validators"

// "ولّد الزوايا الأربع" (أو زاوية واحدة): تُنشأ سجلات الزوايا فوراً ثم يعمل التوليد في الخلفية
export async function POST(req: MedusaRequest<AnglesBody>, res: MedusaResponse) {
  const { job, images } = await loadJob(req.scope, req.params.id)
  if (["published", "publishing", "rejected"].includes(job.status) || job.product_id) {
    res.status(400).json({ message: "المهمة منشورة أو مرفوضة" })
    return
  }
  // قاعدة الصدق: لا زوايا مولّدة للمستعمل والمجدّد
  if (job.condition !== "new") {
    res.status(400).json({ message: "الأجهزة المستعملة: استخدم صوراً حقيقية للجهاز" })
    return
  }
  const s = await getGeminiSettings(req.scope)
  if (!s.api_key) {
    res.status(400).json({ message: "Gemini غير مربوط: استخدم التوليد اليدوي أو أضف المفتاح", manual: true })
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
  const uploads = images.filter((i) => !isAngleKind(i.kind) && !i.excluded)
  const primary = uploads.find((i) => i.is_main) || uploads[0]
  if (!primary) {
    res.status(400).json({ message: "أضف صورة مرجعية واحدة على الأقل" })
    return
  }
  const qa = quickAdd(req.scope)
  const only = req.validatedBody.angle
  const wanted: Angle[] = only ? [only] : [...ANGLES]
  for (const a of wanted) {
    const rec = images.find((i) => angleOf(i.kind) === a)
    if (!rec) {
      await qa.createQuickAddImages({
        job_id: job.id,
        kind: angleKind(a),
        source: "api",
        rank: 100 + ANGLES.indexOf(a),
        source_file_id: primary.source_file_id,
        source_url: primary.source_url,
        status: "pending",
      } as any)
    } else if (rec.source !== "manual" || only) {
      // زاوية محددة تُعاد بالذكاء الاصطناعي حتى لو كانت يدوية، و"الكل" لا يلمس الصور اليدوية
      await qa.updateQuickAddImages({ id: rec.id, source: "api", status: "pending", error: null, source_file_id: primary.source_file_id, source_url: primary.source_url })
    }
  }
  enqueue(req.scope, { job_id: job.id, images: false, copy: false, angles: wanted }, (input) => quickAddGenerateWorkflow(req.scope).run({ input }))
  const fresh = await loadJob(req.scope, job.id)
  res.json({ job: serializeJob({ ...fresh.job, status: "generating" }, fresh.images, true) })
}
