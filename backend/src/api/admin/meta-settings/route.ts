import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { clearMetaFeedCache } from "../../../lib/meta-feed-builder"
import { MetaSettings, getMetaSettings, saveMetaSettings } from "../../../lib/meta-settings"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ settings: await getMetaSettings(req.scope) })
}

export async function POST(req: MedusaRequest<MetaSettings>, res: MedusaResponse) {
  const settings = await saveMetaSettings(req.scope, req.validatedBody)
  clearMetaFeedCache()
  res.json({ settings })
}
