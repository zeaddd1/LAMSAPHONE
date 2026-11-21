import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { clearMetaFeedCache } from "../../../../lib/meta-feed-builder"
import { MetaSettingsInput, getMetaSettings, publicSettings, saveMetaSettings, telegramReady } from "../../../../lib/quick-add/meta-settings"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ settings: { ...publicSettings(await getMetaSettings(req.scope)), telegram_ready: await telegramReady(req.scope) } })
}

export async function POST(req: MedusaRequest<MetaSettingsInput>, res: MedusaResponse) {
  const s = await saveMetaSettings(req.scope, req.validatedBody)
  clearMetaFeedCache()
  res.json({ settings: publicSettings(s) })
}
