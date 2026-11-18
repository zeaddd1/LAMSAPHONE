import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { loadJob, quickAdd, serializeJob } from "../../../../../../lib/quick-add/ai-jobs"
import { ANGLES, angleKind, angleOf } from "../../../../../../lib/quick-add/gemini"
import type { ManualAngleBody } from "../../validators"

// التوليد اليدوي عبر حساب Gemini: المستخدم يرفع صورة الزاوية، فتُحفظ كسجل angle_* بمصدر manual
// وتدخل المعاينة والاعتماد والنشر كما هي (بدون تحسين، ويمكن تحسينها لاحقاً بإعادة التوليد)
export async function POST(req: MedusaRequest<ManualAngleBody>, res: MedusaResponse) {
  const b = req.validatedBody
  const { job, images } = await loadJob(req.scope, req.params.id)
  if (["published", "publishing", "rejected"].includes(job.status) || job.product_id) {
    res.status(400).json({ message: "المهمة منشورة أو مرفوضة" })
    return
  }
  const qa = quickAdd(req.scope)
  const rec = images.find((i) => angleOf(i.kind) === b.angle)
  const fields = {
    source: "manual",
    source_file_id: b.file_id,
    source_url: b.url,
    result_file_id: b.file_id,
    result_url: b.url,
    status: "done",
    error: null,
    excluded: false,
  }
  if (rec) {
    // الملف السابق لهذه الزاوية لم يعد مستخدماً
    const old = [rec.result_file_id, rec.source === "manual" ? rec.source_file_id : null].filter((x) => x && x !== b.file_id)
    await qa.updateQuickAddImages({ id: rec.id, ...fields })
    if (old.length) await req.scope.resolve(Modules.FILE).deleteFiles(old).catch(() => null)
  } else {
    await qa.createQuickAddImages({ job_id: job.id, kind: angleKind(b.angle), rank: 100 + ANGLES.indexOf(b.angle), ...fields } as any)
  }
  const fresh = await loadJob(req.scope, job.id)
  res.json({ job: serializeJob(fresh.job, fresh.images, true) })
}
