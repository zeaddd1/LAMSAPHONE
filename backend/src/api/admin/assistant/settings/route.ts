import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { backendUrl } from "../../../../lib/meta-feed-builder"
import {
  AssistantSettingsInput,
  getAssistantSettings,
  publicAssistantSettings,
  saveAssistantSettings,
} from "../../../../lib/assistant/settings"

const hook = () => `${backendUrl().replace(/\/$/, "")}/webhooks/meta`

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ settings: publicAssistantSettings(await getAssistantSettings(req.scope), hook()) })
}

export async function POST(req: MedusaRequest<AssistantSettingsInput>, res: MedusaResponse) {
  res.json({ settings: publicAssistantSettings(await saveAssistantSettings(req.scope, req.validatedBody), hook()) })
}
