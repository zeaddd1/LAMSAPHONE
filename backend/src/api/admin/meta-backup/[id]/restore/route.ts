import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { clearMetaFeedCache } from "../../../../../lib/meta-feed-builder"
import { listBackups, restoreBackup } from "../../../../../lib/meta-backup"

// استرجاع نسخة: يعيد إعدادات ميتا وواتساب والرد الآلي فقط، ولا يمس المنتجات أو الطلبات أو المحادثات
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const ok = await restoreBackup(req.scope, req.params.id)
  if (!ok) {
    res.status(404).json({ message: "النسخة غير موجودة" })
    return
  }
  clearMetaFeedCache()
  res.json({ restored: true, backups: await listBackups(req.scope) })
}
