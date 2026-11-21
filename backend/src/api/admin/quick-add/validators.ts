import { z } from "@medusajs/framework/zod"

export const PreviewBody = z.object({
  title: z.string().max(300).default(""),
  handle: z.string().max(300).optional(),
  price: z.number().nonnegative().optional(),
  text: z.string().max(2000).optional(),
  hashtags: z.string().max(3000).optional(),
  category_names: z.array(z.string().max(100)).max(20).optional(),
  // لكتابة نص المنشور الجاهز: مواصفات وشارة منتج جديد، أو رقم منتج موجود فتُقرأ بياناته من المتجر
  specs: z.record(z.string(), z.string().max(1000)).optional(),
  badge: z.string().max(50).optional(),
  product_id: z.string().max(100).optional(),
  // أسلوب المنشور وبدايته التشويقية (فارغ = تلقائي)
  style: z.string().max(20).optional(),
  hook: z.string().max(150).optional(),
  closing: z.string().max(500).optional(),
  // ماركة المنتج الجديد (سامسونج = خاتمة «وارد أمريكي» تلقائياً)
  brand: z.string().max(40).optional(),
})
export type PreviewBody = z.infer<typeof PreviewBody>

export const CatalogBody = z.object({
  // فارغ = كل المنتجات المنشورة
  product_ids: z.array(z.string()).max(500).optional(),
  // حذف عناصر هذه المنتجات من الكتالوج بدل تحديثها
  remove: z.boolean().default(false),
})
export type CatalogBody = z.infer<typeof CatalogBody>

export const PublishBody = z.object({
  // فارغ = منشور حر من «استوديو الصور» لا يُضاف للمتجر (بالصور والعنوان والسعر أدناه)
  product_id: z.string().min(1).optional(),
  title: z.string().max(300).optional(),
  price: z.number().nonnegative().optional(),
  images: z.array(z.string().max(1000)).max(10).optional(),
  // صورة القصة كما هي (9:16 مثلاً)، وإلا أول صورة
  story_image: z.string().max(1000).optional(),
  facebook: z.boolean().default(false),
  instagram: z.boolean().default(false),
  catalog: z.boolean().default(false),
  // قصة إنستغرام بأول صورة (أو الفيديو) للمنتج
  ig_story: z.boolean().default(false),
  threads: z.boolean().default(false),
  telegram: z.boolean().default(false),
  // بداية المنشور: نص يكتبه/يختاره المدير. غير مُرسل = بداية تلقائية حسب أسلوب المنتج. "" = بلا بداية
  hook: z.string().max(150).optional(),
  style: z.string().max(20).optional(),
  // خاتمة الثقة والضمان: غير مُرسلة = تلقائية (وارد أمريكي لسامسونج، وإلا الأساسية)، "" = بلا خاتمة
  closing: z.string().max(500).optional(),
  // متى: فارغ = الآن. وقت ISO = يُجدول. autopost = يدخل أول قائمة النشر التلقائي (منتج موجود فقط)
  schedule_at: z.string().max(40).optional(),
  autopost: z.boolean().optional(),
  // للمنشور فقط: لا يُحفظ في المنتج
  text: z.string().max(2000).optional(),
  hashtags: z.string().max(3000).optional(),
  // إن كان للمنتج فيديو MP4: يُنشر كريلز على إنستغرام وفيديو على فيسبوك بدل الصور
  use_video: z.boolean().default(true),
})
export type PublishBody = z.infer<typeof PublishBody>
