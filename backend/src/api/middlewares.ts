import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { PostAdminExchangeRates } from "./admin/exchange-rates/validators"
import { CatalogBody, PreviewBody, PublishBody } from "./admin/quick-add/validators"
import { ConversationPatch, CorrectBody, FaqBody, ReplyBody, TestBody } from "./admin/assistant/validators"
import { MetaSettingsInput } from "../lib/quick-add/meta-settings"
import { AssistantSettingsInput } from "../lib/assistant/settings"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/exchange-rates",
      method: "POST",
      middlewares: [validateAndTransformBody(PostAdminExchangeRates)],
    },
    // صفحة الإضافة السريعة + ربط ميتا
    { matcher: "/admin/quick-add/preview", method: "POST", middlewares: [validateAndTransformBody(PreviewBody)] },
    { matcher: "/admin/quick-add/publish", method: "POST", middlewares: [validateAndTransformBody(PublishBody)] },
    { matcher: "/admin/quick-add/catalog", method: "POST", middlewares: [validateAndTransformBody(CatalogBody)] },
    { matcher: "/admin/quick-add/meta-settings", method: "POST", middlewares: [validateAndTransformBody(MetaSettingsInput)] },
    // الرد الآلي والمحادثات (نحتاج نص الطلب الخام للتحقق من توقيع ميتا)
    { matcher: "/webhooks/meta", method: ["POST"], bodyParser: { preserveRawBody: true } },
    { matcher: "/admin/assistant/faqs", method: "POST", middlewares: [validateAndTransformBody(FaqBody)] },
    { matcher: "/admin/assistant/faqs/:id", method: "POST", middlewares: [validateAndTransformBody(FaqBody)] },
    { matcher: "/admin/assistant/conversations/:id", method: "POST", middlewares: [validateAndTransformBody(ConversationPatch)] },
    { matcher: "/admin/assistant/conversations/:id/reply", method: "POST", middlewares: [validateAndTransformBody(ReplyBody)] },
    { matcher: "/admin/assistant/test", method: "POST", middlewares: [validateAndTransformBody(TestBody)] },
    { matcher: "/admin/assistant/correct", method: "POST", middlewares: [validateAndTransformBody(CorrectBody)] },
    { matcher: "/admin/assistant/settings", method: "POST", middlewares: [validateAndTransformBody(AssistantSettingsInput)] },
  ],
})
