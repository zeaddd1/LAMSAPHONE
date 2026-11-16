import { model } from "@medusajs/framework/utils"

// محادثة عميل من ماسنجر أو إنستغرام أو واتساب
const AssistantConversation = model.define("assistant_conversation", {
  id: model.id({ prefix: "conv" }).primaryKey(),
  channel: model.text(), // messenger | instagram | whatsapp | test
  external_id: model.text().index(), // رقم العميل في القناة
  name: model.text().nullable(),
  mode: model.text().default("bot"), // bot = يرد الآلي، human = الموظف فقط
  status: model.text().default("open"), // open | closed
  needs_human: model.boolean().default(false),
  unread: model.number().default(0),
  last_text: model.text().nullable(),
  last_message_at: model.dateTime().nullable(),
  order_status: model.text().nullable(), // pending | confirmed | cancelled
  order_note: model.text().nullable(),
})

export default AssistantConversation
