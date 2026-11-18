import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { geminiUsage as usage } from "../../../../../lib/quick-add/ai-jobs"
import { GeminiSettingsInput, getGeminiSettings, publicGeminiSettings, saveGeminiSettings } from "../../../../../lib/quick-add/gemini-settings"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ settings: publicGeminiSettings(await getGeminiSettings(req.scope), await usage(req.scope)) })
}

export async function POST(req: MedusaRequest<GeminiSettingsInput>, res: MedusaResponse) {
  const s = await saveGeminiSettings(req.scope, req.validatedBody)
  res.json({ settings: publicGeminiSettings(s, await usage(req.scope)) })
}
