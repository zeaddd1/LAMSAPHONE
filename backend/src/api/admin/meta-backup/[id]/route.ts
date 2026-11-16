import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteBackup, listBackups } from "../../../../lib/meta-backup"

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await deleteBackup(req.scope, req.params.id)
  res.json({ backups: await listBackups(req.scope) })
}
