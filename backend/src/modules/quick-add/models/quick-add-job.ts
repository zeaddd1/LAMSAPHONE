import { model } from "@medusajs/framework/utils"
import QuickAddImage from "./quick-add-image"

// مهمة "إضافة سريعة بالذكاء الاصطناعي": جهاز واحد، صوره، النصوص المولّدة، وحالة كل خطوة.
// البيانات الخاصة (سعر التكلفة، المورد، IMEI) تبقى هنا فقط: لا تُنسخ إلى المنتج ولا تُنشر.
const QuickAddJob = model.define("quick_add_job", {
  id: model.id({ prefix: "qaj" }).primaryKey(),
  // pending → generating → ready_for_review → approved → publishing → published | failed | rejected
  status: model.text().default("pending"),
  error: model.text().nullable(),
  title: model.text(),
  brand: model.text().default(""),
  model_name: model.text().default(""),
  condition: model.text().default("new"),
  parts: model.text().default(""),
  preset: model.text().default("studio"),
  custom_prompt: model.text().default(""),
  // مدخلات المنتج (السعر، القسم، المواصفات، الـ variants) كما أرسلتها اللوحة
  input: model.json().nullable(),
  // خاص بلوحة التحكم فقط
  private: model.json().nullable(),
  // النصوص: { description, instagram, facebook, hashtags }
  copy: model.json().nullable(),
  copy_status: model.text().default("pending"),
  copy_error: model.text().nullable(),
  // حالة كل خطوة نشر: { upload, product, facebook, instagram, catalog }
  steps: model.json().nullable(),
  product_id: model.text().nullable(),
  ai_calls: model.number().default(0),
  // وصلت حد الاستخدام المجاني: تكمل المهمة تلقائياً بعد هذا الوقت بتنفيذ wait_task
  wait_until: model.dateTime().nullable(),
  wait_task: model.json().nullable(),
  created_by: model.text().nullable(),
  images: model.hasMany(() => QuickAddImage, { mappedBy: "job" }),
})

export default QuickAddJob
