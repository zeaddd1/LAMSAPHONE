import { sdk } from "./sdk"
import type { ProcessedImage } from "./quick-add-image"
import type { ProcessedVideo } from "./quick-add-video"

// إنشاء منتج الإضافة السريعة بواجهات Medusa الرسمية (upload / products / inventory).
// نفس الدالة تخدم الإضافة العادية والإضافة بالذكاء الاصطناعي، فلا يتكرر منطق الإنشاء.

export type QuickAddCtx = {
  default_sales_channel_id: string | null
  shipping_profile_id: string | null
  stock_locations: { id: string; name: string }[]
  currency_code: string
}

export type SpecVariant = { storage: string; color: string; sku?: string; stock?: number | null; price?: number | null }

export type ProductSpec = {
  title: string
  description?: string
  categoryId: string
  images: ProcessedImage[]
  video?: ProcessedVideo | null
  price: number
  // فارغ = متوفر دائماً (للمنتج بخيار واحد)
  qty: string
  condition: string
  storage?: string
  color?: string
  // إن وُجدت: خيارات السعة × اللون، لكل خيار SKU ومخزون وسعر
  variants?: SpecVariant[]
  extraMetadata?: Record<string, unknown>
}

export type CreatedProduct = { id: string; handle: string; title: string }

// نرفع كل ملف في طلب مستقل: الخادم يرفض أي طلب أكبر من 1MB،
// وعدة صور معاً في طلب واحد كانت تتجاوز الحد رغم أن كل صورة صغيرة
export const uploadFiles = async (files: File[]) => {
  const urls: string[] = []
  for (const file of files) {
    const r = await sdk.admin.upload.create({ files: [file] })
    urls.push((r.files[0] as any).url as string)
  }
  return urls
}

export const variantTitle = (v: SpecVariant) => [v.storage, v.color].filter(Boolean).join(" / ") || "افتراضي"

export async function createQuickAddProduct(
  ctx: QuickAddCtx,
  spec: ProductSpec,
  setBusy: (s: string) => void,
  warn: (msg: string) => void
): Promise<CreatedProduct> {
  const { images, video } = spec
  setBusy("رفع الصور…")
  // الفيديو: الملف + غلافه. الغلاف يصبح صورة المنتج إن لم توجد صور
  let videoMeta: { url: string; poster: string; type: string; seconds: number }[] = []
  let posterUrl = ""
  if (video) {
    setBusy("رفع الفيديو…")
    const [vu, pu] = await uploadFiles([video.file, video.poster])
    videoMeta = [{ url: vu, poster: pu, type: video.type, seconds: video.seconds }]
    posterUrl = pu
    setBusy("رفع الصور…")
  }
  const urls = images.length ? await uploadFiles(images.map((i) => i.webp)) : [posterUrl]
  // نسخ JPEG لميتا (إنستغرام لا يقبل webp)، لا تظهر في المتجر
  const metaUrls = images.length ? await uploadFiles(images.map((i) => i.jpeg)).catch(() => [] as string[]) : [posterUrl]

  setBusy("إنشاء المنتج…")
  const currency = ctx.currency_code || "usd"
  const multi = (spec.variants || []).filter((v) => v.storage || v.color)
  let options: { title: string; values: string[] }[]
  let variants: any[]
  let track: boolean
  if (multi.length) {
    const storages = [...new Set(multi.map((v) => v.storage).filter(Boolean))]
    const colors = [...new Set(multi.map((v) => v.color).filter(Boolean))]
    options = [...(storages.length ? [{ title: "السعة", values: storages }] : []), ...(colors.length ? [{ title: "اللون", values: colors }] : [])]
    track = multi.some((v) => typeof v.stock === "number")
    variants = multi.map((v) => ({
      title: variantTitle(v),
      sku: v.sku?.trim() || undefined,
      options: { ...(storages.length ? { السعة: v.storage || storages[0] } : {}), ...(colors.length ? { اللون: v.color || colors[0] } : {}) },
      prices: [{ currency_code: currency, amount: typeof v.price === "number" && v.price > 0 ? v.price : spec.price }],
      manage_inventory: typeof v.stock === "number",
      allow_backorder: false,
    }))
  } else {
    track = spec.qty.trim() !== "" && Number(spec.qty) >= 0
    options = [{ title: "الخيار", values: ["افتراضي"] }]
    variants = [
      {
        title: "افتراضي",
        options: { الخيار: "افتراضي" },
        prices: [{ currency_code: currency, amount: spec.price }],
        manage_inventory: track,
        allow_backorder: false,
      },
    ]
  }
  const { product } = await sdk.admin.product.create({
    title: spec.title,
    description: spec.description?.trim() || undefined,
    status: "published",
    thumbnail: urls[0],
    images: urls.map((url) => ({ url })),
    categories: [{ id: spec.categoryId }],
    sales_channels: ctx.default_sales_channel_id ? [{ id: ctx.default_sales_channel_id }] : undefined,
    shipping_profile_id: ctx.shipping_profile_id || undefined,
    // الحالة للكتالوج فقط (ميتا تشترطها صحيحة)، ولا تظهر في المنشور ولا في اسم المنتج
    metadata: {
      condition: spec.condition,
      ...(spec.storage ? { storage: spec.storage } : {}),
      ...(spec.color ? { color: spec.color } : {}),
      meta_images: metaUrls,
      ...(videoMeta.length ? { videos: videoMeta } : {}),
      added_by: "quick-add",
      ...(spec.extraMetadata || {}),
    },
    options,
    variants,
  } as any)

  if (track && ctx.stock_locations[0]) {
    setBusy("ضبط الكمية…")
    try {
      const { product: full } = await sdk.admin.product.retrieve(product.id, { fields: "variants.title,variants.inventory_items.inventory_item_id" } as any)
      const wanted = multi.length
        ? multi.filter((v) => typeof v.stock === "number").map((v) => ({ title: variantTitle(v), qty: v.stock as number }))
        : [{ title: "افتراضي", qty: Number(spec.qty) }]
      for (const w of wanted) {
        const fv = ((full as any).variants || []).find((x: any) => x.title === w.title) || (multi.length ? null : (full as any).variants?.[0])
        const itemId = fv?.inventory_items?.[0]?.inventory_item_id
        if (itemId)
          await sdk.client.fetch(`/admin/inventory-items/${itemId}/location-levels`, {
            method: "POST",
            body: { location_id: ctx.stock_locations[0].id, stocked_quantity: w.qty },
          })
      }
    } catch {
      warn("أُضيف المنتج، لكن تعذّر ضبط الكمية. اضبطها من صفحة المنتج.")
    }
  }
  return { id: product.id, handle: product.handle, title: product.title }
}

export type PublishResult = { ok: boolean; url?: string; error?: string; skipped?: boolean; comment_error?: string }

// النشر على ميتا عبر نفس مسار الإضافة السريعة الحالي
export function publishProduct(body: {
  product_id: string
  facebook: boolean
  instagram: boolean
  catalog: boolean
  text?: string
  ig_text?: string
  hashtags?: string
  use_video?: boolean
}) {
  return sdk.client.fetch<{ link: string; results: Record<string, PublishResult> }>("/admin/quick-add/publish", { method: "POST", body })
}
