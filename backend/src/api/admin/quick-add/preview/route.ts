import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { buildCaption, hashtagComment, suggestHashtags } from "../../../../lib/quick-add/caption"
import { storeUrl } from "../../../../lib/meta-feed-builder"
import type { PreviewBody } from "../validators"

// معاينة نص المنشور واقتراح هاشتاقات (لا يحفظ شيئاً)
export async function POST(req: MedusaRequest<PreviewBody>, res: MedusaResponse) {
  const b = req.validatedBody
  // الروابط القصيرة تُعرف بعد إنشاء المنتج، فنعرض شكلها فقط في المعاينة
  const host = storeUrl().replace(/^https?:\/\//, "").replace(/\/$/, "")
  res.json({
    suggested: suggestHashtags(b.title, b.category_names || []),
    // نص المنشور بلا هاشتاقات، والهاشتاقات في أول تعليق
    ig_caption: buildCaption({ title: b.title || "اسم المنتج", price: b.price, text: b.text, link: `${host}/p/…`, waLink: `${host}/wa/…`, network: "instagram" }),
    caption: buildCaption({ title: b.title || "اسم المنتج", price: b.price, text: b.text, link: `${host}/p/…`, waLink: `${host}/wa/…` }),
    comment: hashtagComment(b.hashtags),
  })
}
