import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fixStale, loadJob, quickAdd, serializeJob } from "../../../../../lib/quick-add/ai-jobs"
import { isPresetAllowed } from "../../../../../lib/quick-add/gemini"
import type { UpdateJobBody } from "../validators"

// تفاصيل مهمة (للمتابعة كل 2-3 ثوانٍ)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { job, images } = await loadJob(req.scope, req.params.id)
  await fixStale(req.scope, [job])
  res.json({ job: serializeJob(job, images, true) })
}

// تعديل المهمة قبل الاعتماد: النصوص، وصف الأجزاء، استبعاد صورة، الصورة الرئيسية، الترتيب…
export async function POST(req: MedusaRequest<UpdateJobBody>, res: MedusaResponse) {
  const b = req.validatedBody
  const qa = quickAdd(req.scope)
  const { job, images } = await loadJob(req.scope, req.params.id)
  if (["published", "publishing", "rejected"].includes(job.status)) {
    res.status(400).json({ message: "لا يمكن تعديل مهمة منشورة أو مرفوضة" })
    return
  }
  // قاعدة الصدق على القيم النهائية (المحفوظة + المعدّلة)
  if (!isPresetAllowed(b.condition || job.condition, b.preset || job.preset)) {
    res.status(400).json({ message: "الأجهزة المستعملة والمجدّدة: يُسمح فقط بتنظيف الخلفية (استوديو أو إزالة علامة المورد)" })
    return
  }
  const { images: imgPatch, ...rest } = b
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v
  if (b.private) patch.private = { ...(job.private || {}), ...b.private }
  if (b.input) patch.input = { ...(job.input || {}), ...b.input }
  if (Object.keys(patch).length) await qa.updateQuickAddJobs({ id: job.id, ...patch })
  if (imgPatch?.length) {
    const ids = new Set(images.map((i) => i.id))
    const mainId = imgPatch.find((i) => i.is_main)?.id
    for (const p of imgPatch) {
      if (!ids.has(p.id)) continue
      const { id, ...fields } = p
      await qa.updateQuickAddImages({ id, ...fields })
    }
    // صورة رئيسية واحدة فقط
    if (mainId) for (const i of images) if (i.id !== mainId && i.is_main) await qa.updateQuickAddImages({ id: i.id, is_main: false })
  }
  const fresh = await loadJob(req.scope, job.id)
  res.json({ job: serializeJob(fresh.job, fresh.images, true) })
}
