import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseWebhook, verifySignature } from "../../../lib/assistant/channels"
import { handleIncoming } from "../../../lib/assistant/engine"
import { getAssistantSettings } from "../../../lib/assistant/settings"

// Webhook ميتا: https://cp.lamsaphone.yemenbay.com/webhooks/meta
// GET = تحقق ميتا عند ربط الـ Webhook، POST = رسائل ماسنجر وإنستغرام وواتساب الواردة
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const s = await getAssistantSettings(req.scope)
  const q = req.query as Record<string, string>
  if (q["hub.mode"] === "subscribe" && s.verify_token && q["hub.verify_token"] === s.verify_token) {
    res.status(200).send(String(q["hub.challenge"] || ""))
    return
  }
  res.status(403).send("forbidden")
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const s = await getAssistantSettings(req.scope)
  const raw = (req as any).rawBody as Buffer | undefined
  if (!verifySignature(raw, req.headers["x-hub-signature-256"] as string | undefined, s.app_secret)) {
    res.status(401).send("bad signature")
    return
  }
  // نرد على ميتا فوراً (تشترط الرد خلال ثوانٍ)، ثم نعالج الرسائل
  res.status(200).send("EVENT_RECEIVED")
  const logger = req.scope.resolve("logger") as any
  for (const m of parseWebhook(req.body)) {
    try {
      await handleIncoming(req.scope, m)
    } catch (e: any) {
      logger?.error?.(`assistant webhook: ${e?.message || e}`)
    }
  }
}
