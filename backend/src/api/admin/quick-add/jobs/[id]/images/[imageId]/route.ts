import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { quickAdd } from "../../../../../../../lib/quick-add/ai-jobs"

// يعيد ملف الصورة (الأصل أو الناتج) من File Module مباشرة، حتى تعالجها اللوحة (الشعار، WebP) قبل إنشاء المنتج.
// ?which=result (الافتراضي) أو source
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const qa = quickAdd(req.scope)
  const img: any = await qa.retrieveQuickAddImage(req.params.imageId).catch(() => null)
  if (!img || img.job_id !== req.params.id) {
    res.status(404).json({ message: "الصورة غير موجودة" })
    return
  }
  const fileId = req.query.which === "source" ? img.source_file_id : img.result_file_id
  if (!fileId) {
    res.status(404).json({ message: "لا توجد صورة محسّنة لهذه اللقطة" })
    return
  }
  const buf: Buffer = await req.scope.resolve(Modules.FILE).getAsBuffer(fileId)
  const type = buf[0] === 0x89 ? "image/png" : buf.slice(8, 12).toString() === "WEBP" ? "image/webp" : "image/jpeg"
  res.setHeader("Content-Type", type)
  res.setHeader("Cache-Control", "private, max-age=600")
  res.send(buf)
}
