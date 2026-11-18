import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorOf, enqueue, imageGate, isRunning, loadJob, rateLimited, serializeJob } from "../../../../../../lib/quick-add/ai-jobs"
import { quickAddGenerateWorkflow } from "../../../../../../workflows/quick-add-generate"
import { getGeminiSettings } from "../../../../../../lib/quick-add/gemini-settings"
import { isAngleKind } from "../../../../../../lib/quick-add/gemini"
import type { RegenerateBody } from "../../validators"

// إعادة توليد كل الصور أو صورة واحدة فقط (image_id)
export async function POST(req: MedusaRequest<RegenerateBody>, res: MedusaResponse) {
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
  const id = req.validatedBody.image_id
  if (id && !images.some((i) => i.id === id)) {
    res.status(404).json({ message: "الصورة غير موجودة في هذه المهمة" })
    return
  }
  const count = id ? 1 : images.filter((i) => !i.excluded && !isAngleKind(i.kind)).length
  const gate = await imageGate(req.scope, await getGeminiSettings(req.scope), count, req.validatedBody.confirm_cost)
  if (gate) {
    res.status(gate[0]).json(gate[1])
    return
  }
  enqueue(req.scope, { job_id: job.id, images: true, image_ids: id ? [id] : undefined, copy: false }, (input) => quickAddGenerateWorkflow(req.scope).run({ input }))
  res.json({ job: serializeJob({ ...job, status: "generating" }, images, true) })
}
