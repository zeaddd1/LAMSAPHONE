import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMetaFeedXml } from "../../../lib/meta-feed-builder"

// رابط كتالوج ميتا العام: https://cp.lamsaphone.yemenbay.com/feeds/meta.xml
// يُضاف في Commerce Manager كـ "Data feed" بتحديث كل ساعة، فيبقى الكتالوج وكتالوج واتساب محدّثين تلقائياً.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8")
  res.setHeader("Cache-Control", "public, max-age=600")
  res.status(200).send(await getMetaFeedXml(req.scope))
}
