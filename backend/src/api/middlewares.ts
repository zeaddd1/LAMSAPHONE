import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { PostAdminExchangeRates } from "./admin/exchange-rates/validators"
import { PreviewBody, PublishBody } from "./admin/quick-add/validators"
import { MetaSettingsInput } from "../lib/quick-add/meta-settings"

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
    { matcher: "/admin/quick-add/meta-settings", method: "POST", middlewares: [validateAndTransformBody(MetaSettingsInput)] },
  ],
})
