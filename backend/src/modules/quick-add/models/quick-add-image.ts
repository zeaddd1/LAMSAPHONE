import { model } from "@medusajs/framework/utils"
import QuickAddJob from "./quick-add-job"

// صورة واحدة داخل مهمة: الأصل المرفوع، والنتيجة المحسّنة، وحالتها
const QuickAddImage = model.define("quick_add_image", {
  id: model.id({ prefix: "qai" }).primaryKey(),
  // front | back | side | box | accessories | other
  // وصور الزوايا الأربع: angle_front | angle_back | angle_three_quarter | angle_side
  kind: model.text().default("other"),
  // upload = صورة رفعها المستخدم، api = زاوية ولّدها Gemini، manual = زاوية رفعها المستخدم من التوليد اليدوي
  source: model.text().default("upload"),
  note: model.text().default(""),
  rank: model.number().default(0),
  is_main: model.boolean().default(false),
  excluded: model.boolean().default(false),
  source_file_id: model.text(),
  source_url: model.text(),
  result_file_id: model.text().nullable(),
  result_url: model.text().nullable(),
  // pending | generating | done | failed
  status: model.text().default("pending"),
  error: model.text().nullable(),
  job: model.belongsTo(() => QuickAddJob, { mappedBy: "images" }),
})

export default QuickAddImage
