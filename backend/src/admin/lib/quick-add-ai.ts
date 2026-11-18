import { sdk } from "./sdk"

// أدوات اللوحة للإضافة السريعة بالذكاء الاصطناعي (اختيارية)

export type ImageKind = "front" | "back" | "side" | "box" | "accessories" | "other"
export type Preset = "studio" | "floating" | "dark" | "lifestyle" | "watermark_clean" | "custom"
export type AiCondition = "new" | "used" | "refurbished"

export const KIND_LABELS: Record<ImageKind, string> = {
  front: "أمامي",
  back: "خلفي",
  side: "جانبي",
  box: "العلبة",
  accessories: "الملحقات",
  other: "أخرى",
}
export const PRESET_LABELS: Record<Preset, string> = {
  studio: "استوديو: خلفية بيضاء وظل ناعم",
  floating: "عائم بزاوية وخلفية متدرجة",
  dark: "خلفية داكنة فاخرة",
  lifestyle: "أجواء واقعية بإضاءة طبيعية",
  watermark_clean: "إزالة علامة المورد فقط",
  custom: "وصف مخصص",
}
export const allowedPresets = (condition: string): Preset[] =>
  condition === "new" ? ["studio", "floating", "dark", "lifestyle", "watermark_clean", "custom"] : ["studio", "watermark_clean"]

export const HONESTY_NOTE = "الأجهزة المستعملة: لا تُخفِ العيوب بالذكاء الاصطناعي، استخدم صورة حقيقية للجهاز"

export const SPEC_FIELDS = [
  ["ram", "الرام (RAM)"],
  ["screen", "الشاشة"],
  ["cpu", "المعالج"],
  ["camera", "الكاميرا"],
  ["battery", "البطارية"],
  ["network", "الشبكة (4G/5G)"],
  ["sim", "الشريحة (SIM/eSIM)"],
  ["region", "النسخة الإقليمية"],
] as const

export type AiVariant = { storage: string; color: string; sku: string; stock: number | null; price: number | null }

export type JobImage = {
  id: string
  // ImageKind أو angle_front | angle_back | angle_three_quarter | angle_side
  kind: ImageKind | `angle_${string}`
  source: "upload" | "api" | "manual"
  note: string
  rank: number
  is_main: boolean
  excluded: boolean
  source_url: string
  result_url: string | null
  status: "pending" | "generating" | "done" | "failed"
  error: string | null
}
export type StepResult = { ok: boolean; url?: string; error?: string; skipped?: boolean }
export type Job = {
  id: string
  status: "pending" | "generating" | "ready_for_review" | "approved" | "publishing" | "published" | "failed" | "rejected"
  error: string | null
  title: string
  brand: string
  model_name: string
  condition: AiCondition
  parts: string
  preset: Preset
  custom_prompt: string
  input: {
    price?: number
    currency_code?: string
    category_id?: string
    in_stock?: boolean
    specs?: Record<string, string>
    variants?: AiVariant[]
    battery_health?: string
    condition_note?: string
    warranty?: string
    qty?: string
  }
  private?: { cost?: number | null; supplier?: string; imei?: string; margin_type?: "percent" | "fixed"; margin_value?: number }
  copy: { description: string; instagram: string; facebook: string; hashtags: string } | null
  copy_status: string
  copy_error: string | null
  steps: Partial<Record<"upload" | "product" | "facebook" | "instagram" | "catalog", StepResult>>
  product_id: string | null
  created_at: string
  updated_at: string
  running: boolean
  style_text: string
  images: JobImage[]
}

export const STATUS_LABELS: Record<Job["status"], string> = {
  pending: "في الانتظار",
  generating: "جارٍ التوليد",
  ready_for_review: "جاهزة للمراجعة",
  approved: "معتمدة",
  publishing: "جارٍ النشر",
  published: "منشورة",
  failed: "فشلت",
  rejected: "مرفوضة",
}
export const isBusy = (j: Job) => j.running || j.status === "pending" || j.status === "generating"

export const AI_MAX_IMAGES = 8
const MAX_INPUT = 10 * 1024 * 1024
const MAX_UPLOAD = 950 * 1024
const OK_TYPES = /^image\/(jpeg|png|webp)$/

export function checkSourceFile(f: File): string | null {
  if (!OK_TYPES.test(f.type) && !/\.(jpe?g|png|webp)$/i.test(f.name)) return `${f.name}: المسموح JPG أو PNG أو WebP فقط`
  if (f.size > MAX_INPUT) return `${f.name}: الحد 10MB للصورة`
  return null
}

// نسخة للذكاء الاصطناعي: بدون شعار وبدون قص، أطول ضلع 2048، JPEG أقل من 1MB (حد الرفع في الخادم)
export async function prepareSource(file: File): Promise<File> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any)
  try {
    for (const side of [2048, 1600, 1280]) {
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height))
      const c = document.createElement("canvas")
      c.width = Math.round(bmp.width * scale)
      c.height = Math.round(bmp.height * scale)
      const ctx = c.getContext("2d")!
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(bmp, 0, 0, c.width, c.height)
      for (const q of [0.92, 0.85, 0.78, 0.7]) {
        const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q))
        if (b && b.size <= MAX_UPLOAD) return new File([b], `ai-source-${Date.now()}.jpg`, { type: "image/jpeg" })
      }
    }
  } finally {
    bmp.close()
  }
  throw new Error("تعذّر تصغير الصورة لأقل من 1MB")
}

export async function uploadOne(file: File): Promise<{ id: string; url: string }> {
  const r = await sdk.admin.upload.create({ files: [file] })
  const f = r.files[0] as any
  return { id: f.id, url: f.url }
}

// الصورة المحسّنة (أو الأصل) كملف، لتعالجها اللوحة بالشعار وWebP قبل إنشاء المنتج
export async function fetchJobImage(jobId: string, imageId: string, which: "result" | "source"): Promise<File> {
  const r = await fetch(`/admin/quick-add/jobs/${jobId}/images/${imageId}?which=${which}`, { credentials: "include" })
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "تعذّر تحميل الصورة")
  const blob = await r.blob()
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"
  return new File([blob], `${which}-${imageId}.${ext}`, { type: blob.type || "image/png" })
}

export function salePrice(cost: number, type: "percent" | "fixed", value: number) {
  if (!(cost > 0)) return 0
  const p = type === "fixed" ? cost + value : cost * (1 + value / 100)
  return Math.round(p * 100) / 100
}

export const jobApi = {
  get: (id: string) => sdk.client.fetch<{ job: Job }>(`/admin/quick-add/jobs/${id}`).then((r) => r.job),
  list: () => sdk.client.fetch<{ jobs: Job[]; count: number }>("/admin/quick-add/jobs?limit=30"),
  create: (body: Record<string, any>) => sdk.client.fetch<{ job: Job }>("/admin/quick-add/jobs", { method: "POST", body }).then((r) => r.job),
  update: (id: string, body: Record<string, any>) => sdk.client.fetch<{ job: Job }>(`/admin/quick-add/jobs/${id}`, { method: "POST", body }).then((r) => r.job),
  action: (id: string, action: "analyze-parts" | "regenerate" | "regenerate-copy" | "approve" | "reject" | "published" | "angles" | "manual-angle", body: Record<string, any> = {}) =>
    sdk.client.fetch<any>(`/admin/quick-add/jobs/${id}/${action}`, { method: "POST", body }),
}

export type GeminiPublic = {
  has_key: boolean
  key_hint: string
  from_env: boolean
  image_model: string
  text_model: string
  margin_type: "percent" | "fixed"
  margin_value: number
  concurrency: number
  status: "connected" | "disconnected" | "error"
  last_success_at: string | null
  last_error: string | null
  usage: { month_calls: number; total_calls: number; month_jobs: number }
}
export const getGemini = () => sdk.client.fetch<{ settings: GeminiPublic }>("/admin/quick-add/settings/gemini").then((r) => r.settings)

export const testGemini = () =>
  sdk.client.fetch<{ ok: boolean; error?: string; settings: GeminiPublic }>("/admin/quick-add/settings/gemini/test", { method: "POST" })
