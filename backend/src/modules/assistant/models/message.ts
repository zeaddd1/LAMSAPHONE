import { model } from "@medusajs/framework/utils"

// رسالة واحدة في محادثة
const AssistantMessage = model.define("assistant_message", {
  id: model.id({ prefix: "amsg" }).primaryKey(),
  conversation_id: model.text().index(),
  direction: model.text(), // in | out
  sender: model.text(), // customer | bot | staff
  text: model.text(),
  external_id: model.text().nullable(), // رقم الرسالة عند ميتا (لمنع التكرار)
  intent: model.text().nullable(),
})

export default AssistantMessage
