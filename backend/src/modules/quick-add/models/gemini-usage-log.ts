import { model } from "@medusajs/framework/utils"

// سجل كل طلب لـ Gemini: الوقت، الموديل، النوع، النتيجة، التكلفة المقدرة.
// منه تُحسب عدّادات الدقيقة واليوم (حارس الحصص) والصرف الشهري واليومي (الوضع المدفوع).
const GeminiUsageLog = model.define("quick_add_usage_log", {
  id: model.id({ prefix: "qau" }).primaryKey(),
  model: model.text(),
  // text | image
  kind: model.text(),
  // ok | error | rate_limited | refused | blocked_local
  result: model.text(),
  cost_usd: model.float().default(0),
  job_id: model.text().nullable(),
})

export default GeminiUsageLog
