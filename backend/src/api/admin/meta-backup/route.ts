import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createBackup, listBackups } from "../../../lib/meta-backup"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ backups: await listBackups(req.scope) })
}

// نسخة يدوية الآن
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const label = String((req.body as any)?.label || "").trim() || "نسخة يدوية"
  const b = await createBackup(req.scope, label)
  res.json({ created: Boolean(b), backups: await listBackups(req.scope) })
}
