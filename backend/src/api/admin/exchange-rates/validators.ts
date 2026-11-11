import { z } from "@medusajs/framework/zod"
import { DISPLAY_CURRENCIES } from "../../../lib/currency"

export const PostAdminExchangeRates = z.object({
  rates: z
    .array(
      z.object({
        code: z.enum(DISPLAY_CURRENCIES),
        rate_per_usd: z.number().positive(), // السعر يجب أن يكون > 0
        rounding_step: z.number().min(0),
        is_active: z.boolean(),
      })
    )
    .min(1),
})
export type PostAdminExchangeRatesType = z.infer<typeof PostAdminExchangeRates>
