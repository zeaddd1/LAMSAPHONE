import { model } from "@medusajs/framework/utils"

// سؤال شائع: يظهر في صفحة الأسئلة الشائعة بالمتجر، ويجيب منه الرد الآلي
const AssistantFaq = model.define("assistant_faq", {
  id: model.id({ prefix: "faq" }).primaryKey(),
  question: model.text(),
  answer: model.text(),
  keywords: model.text().default(""), // كلمات إضافية يكتبها العملاء (لهجة، أخطاء)
  is_active: model.boolean().default(true),
  rank: model.number().default(0),
  hits: model.number().default(0), // كم مرة أجاب منه الرد الآلي
})

export default AssistantFaq
