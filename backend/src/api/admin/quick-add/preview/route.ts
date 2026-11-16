import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { buildCaption, hashtagComment, productUrl, suggestHashtags } from "../../../../lib/quick-add/caption"
import { storeUrl } from "../../../../lib/meta-feed-builder"
import type { PreviewBody } from "../validators"

// معاينة نص المنشور واقتراح هاشتاقات (لا يحفظ شيئاً)
export async function POST(req: MedusaRequest<PreviewBody>, res: MedusaResponse) {
  const b = req.validatedBody
  const link = productUrl(b.handle || "…", storeUrl())
  res.json({
    suggested: suggestHashtags(b.title, b.category_names || []),
    // نص المنشور بلا هاشتاقات، والهاشتاقات في أول تعليق
    caption: buildCaption({ title: b.title || "اسم المنتج", price: b.price, text: b.text, link, whatsapp: process.env.WHATSAPP_NUMBER || "967770777736" }),
    comment: hashtagComment(b.hashtags),
  })
}
