import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMetaFeedXml } from "../../../lib/meta-feed-builder"
import { getMetaSettings } from "../../../lib/meta-settings"

// رابط كتالوج Meta العام: https://cp.lamsaphone.yemenbay.com/feeds/meta.xml
// يُضاف في Commerce Manager كـ "Data feed" مع جدول تحديث يومي أو كل ساعة.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const settings = await getMetaSettings(req.scope)
  if (!settings.feed_enabled) {
    res.status(404).json({ message: "feed disabled" })
    return
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8")
  res.setHeader("Cache-Control", "public, max-age=600")
  res.status(200).send(await getMetaFeedXml(req.scope))
}
