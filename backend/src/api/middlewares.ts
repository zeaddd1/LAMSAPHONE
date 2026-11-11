import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { PostAdminExchangeRates } from "./admin/exchange-rates/validators"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/exchange-rates",
      method: "POST",
      middlewares: [validateAndTransformBody(PostAdminExchangeRates)],
    },
  ],
})
