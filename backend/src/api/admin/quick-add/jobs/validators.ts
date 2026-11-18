import { z } from "@medusajs/framework/zod"
import { ANGLES, CONDITIONS, IMAGE_KINDS, PRESETS, isPresetAllowed } from "../../../../lib/quick-add/gemini"

const short = (n: number) => z.string().trim().max(n)

const Variant = z.object({
  storage: short(40).default(""),
  color: short(40).default(""),
  sku: short(80).default(""),
  stock: z.number().int().min(0).max(100000).nullable().optional(),
  price: z.number().nonnegative().max(10_000_000).nullable().optional(),
})

// بيانات المنتج العامة (تظهر في المتجر). لا تضع هنا التكلفة أو IMEI
const JobInput = z
  .object({
    price: z.number().nonnegative().max(10_000_000).optional(),
    currency_code: short(10).optional(),
    category_id: short(100).optional(),
    in_stock: z.boolean().optional(),
    // كمية المنتج بخيار واحد (فارغ = متوفر دائماً)
    qty: z.string().trim().max(10).regex(/^\d*$/, "الكمية أرقام فقط").optional(),
    specs: z.record(short(40), short(300)).optional(),
    specs_labeled: z.record(short(60), short(300)).optional(),
    variants: z.array(Variant).max(40).optional(),
    battery_health: short(20).optional(),
    condition_note: short(500).optional(),
    warranty: short(200).optional(),
  })
  .strict()

// خاص بلوحة التحكم فقط
const JobPrivate = z
  .object({
    cost: z.number().nonnegative().max(10_000_000).nullable().optional(),
    supplier: short(120).optional(),
    imei: short(60).optional(),
    margin_type: z.enum(["percent", "fixed"]).optional(),
    margin_value: z.number().min(0).max(100000).optional(),
  })
  .strict()

const NewImage = z.object({
  file_id: z.string().min(1).max(200),
  url: z.string().min(1).max(1000),
  kind: z.enum(IMAGE_KINDS).default("other"),
  note: short(300).default(""),
  is_main: z.boolean().default(false),
})

const honest = (v: { condition?: string; preset?: string }) => !v.condition || !v.preset || isPresetAllowed(v.condition, v.preset)
const honestMsg = { message: "الأجهزة المستعملة والمجدّدة: يُسمح فقط بتنظيف الخلفية (استوديو أو إزالة علامة المورد)", path: ["preset"] }

export const CreateJobBody = z
  .object({
    title: short(300).min(1, "اكتب اسم الجهاز"),
    brand: short(80).default(""),
    model_name: short(120).default(""),
    condition: z.enum(CONDITIONS).default("new"),
    parts: short(3000).default(""),
    preset: z.enum(PRESETS).default("studio"),
    custom_prompt: short(1000).default(""),
    images: z.array(NewImage).min(1, "أضف صورة واحدة على الأقل").max(8, "الحد 8 صور للذكاء الاصطناعي"),
    input: JobInput.default({}),
    private: JobPrivate.default({}),
    generate_copy: z.boolean().default(true),
    // false = إنشاء المهمة بدون توليد (لاقتراح الأجزاء أولاً)
    generate: z.boolean().default(true),
    // الوضع المدفوع: تأكيد التكلفة التقديرية قبل توليد الصور
    confirm_cost: z.boolean().optional(),
  })
  .refine(honest, honestMsg)
export type CreateJobBody = z.infer<typeof CreateJobBody>

export const UpdateJobBody = z
  .object({
    title: short(300).min(1).optional(),
    brand: short(80).optional(),
    model_name: short(120).optional(),
    condition: z.enum(CONDITIONS).optional(),
    parts: short(3000).optional(),
    preset: z.enum(PRESETS).optional(),
    custom_prompt: short(1000).optional(),
    copy: z.object({ description: short(5000), instagram: short(2000), facebook: short(2000), hashtags: short(3000) }).optional(),
    images: z
      .array(z.object({ id: z.string(), excluded: z.boolean().optional(), is_main: z.boolean().optional(), rank: z.number().int().min(0).max(100).optional(), note: short(300).optional(), kind: z.enum(IMAGE_KINDS).optional() }))
      .max(8)
      .optional(),
    input: JobInput.optional(),
    private: JobPrivate.optional(),
  })
  .refine(honest, honestMsg)
export type UpdateJobBody = z.infer<typeof UpdateJobBody>

export const RegenerateBody = z.object({ image_id: z.string().optional(), confirm_cost: z.boolean().optional() })
export type RegenerateBody = z.infer<typeof RegenerateBody>

const Step = z.object({ ok: z.boolean(), url: z.string().max(1000).optional(), error: z.string().max(1000).optional(), skipped: z.boolean().optional() })
export const PublishedBody = z.object({
  status: z.enum(["publishing", "published", "failed"]),
  product_id: z.string().max(200).optional(),
  steps: z.object({ upload: Step.optional(), product: Step.optional(), facebook: Step.optional(), instagram: Step.optional(), catalog: Step.optional() }).default({}),
  error: z.string().max(1000).optional(),
})
export type PublishedBody = z.infer<typeof PublishedBody>

// الزوايا الأربع: كلها، أو زاوية واحدة (إعادة توليدها فقط)
export const AnglesBody = z.object({ angle: z.enum(ANGLES).optional(), confirm_cost: z.boolean().optional() })
export type AnglesBody = z.infer<typeof AnglesBody>

// التوليد اليدوي: صورة زاوية رفعها المستخدم (مرفوعة مسبقاً عبر /admin/uploads، أقل من 1MB)
export const ManualAngleBody = z.object({
  angle: z.enum(ANGLES),
  file_id: z.string().min(1).max(200),
  url: z.string().min(1).max(1000),
})
export type ManualAngleBody = z.infer<typeof ManualAngleBody>
