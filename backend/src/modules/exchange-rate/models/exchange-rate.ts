import { model } from "@medusajs/framework/utils"

// سعر صرف واحد لكل عملة عرض. الأسعار في المتجر بالدولار، وهذا الجدول يحوّلها للعرض.
const ExchangeRate = model.define("exchange_rate", {
  id: model.id({ prefix: "exr" }).primaryKey(),
  code: model.text().unique(), // USD | SAR | YER_OLD | YER_NEW
  rate_per_usd: model.bigNumber().default(0), // كم وحدة من العملة = 1 دولار
  rounding_step: model.bigNumber().default(0), // مثل 0.5 للسعودي و100 لليمني
  label_ar: model.text(),
  symbol: model.text(),
  is_active: model.boolean().default(false),
})

export default ExchangeRate
