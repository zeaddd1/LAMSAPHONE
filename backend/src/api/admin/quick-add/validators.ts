import { z } from "@medusajs/framework/zod"

export const PreviewBody = z.object({
  title: z.string().max(300).default(""),
  handle: z.string().max(300).optional(),
  price: z.number().nonnegative().optional(),
  text: z.string().max(2000).optional(),
  hashtags: z.string().max(3000).optional(),
  category_names: z.array(z.string().max(100)).max(20).optional(),
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
  product_id: z.string().min(1),
  facebook: z.boolean().default(false),
  instagram: z.boolean().default(false),
  catalog: z.boolean().default(false),
  // للمنشور فقط: لا يُحفظ في المنتج
  text: z.string().max(2000).optional(),
  hashtags: z.string().max(3000).optional(),
  // إن كان للمنتج فيديو MP4: يُنشر كريلز على إنستغرام وفيديو على فيسبوك بدل الصور
  use_video: z.boolean().default(true),
})
export type PublishBody = z.infer<typeof PublishBody>
