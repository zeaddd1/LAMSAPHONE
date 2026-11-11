import { model } from "@medusajs/framework/utils"

// سجل كل تعديل على سعر الصرف: من عدّله، ومتى، والقيم قبل وبعد.
const ExchangeRateHistory = model.define("exchange_rate_history", {
  id: model.id({ prefix: "exrh" }).primaryKey(),
  code: model.text().index(),
  old_rate: model.bigNumber().nullable(),
  new_rate: model.bigNumber(),
  old_rounding_step: model.bigNumber().nullable(),
  new_rounding_step: model.bigNumber(),
  old_is_active: model.boolean().nullable(),
  new_is_active: model.boolean(),
  changed_by: model.text().nullable(), // معرّف مستخدم الإدارة
})

export default ExchangeRateHistory
