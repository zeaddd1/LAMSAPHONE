import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { PostAdminExchangeRates } from "./admin/exchange-rates/validators"
import { MetaSettingsSchema } from "../lib/meta-settings"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/exchange-rates",
      method: "POST",
      middlewares: [validateAndTransformBody(PostAdminExchangeRates)],
    },
    {
      matcher: "/admin/meta-settings",
      method: "POST",
      middlewares: [validateAndTransformBody(MetaSettingsSchema)],
    },
  ],
})
