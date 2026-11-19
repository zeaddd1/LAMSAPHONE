import data from "../data/samsung-catalog.json"

// كتالوج موديلات سامسونج جالاكسي S (من S9 إلى S26): الأسماء العربية والمواصفات والسعات والألوان والصور.
// الصور ملفات ثابتة في المتجر (storefront/public/catalog) فلا تضيع عند إعادة النشر ولا تمر بحد الرفع.

export type CatalogSpec = { key: string; label: string; value: string }
export type CatalogModel = {
  handle: string
  model: string
  title: string
  subtitle: string
  storages: string[]
  ram: string
  colors: string[]
  images: { path: string; size: number }[]
  specs: CatalogSpec[]
}

export const CATALOG = data as CatalogModel[]
export const STORE_ORIGIN = "https://lamsaphone.yemenbay.com"

const spec = (m: CatalogModel, key: string) => m.specs.find((s) => s.key === key)?.value || ""

// وصف عربي قصير من أهم المواصفات (الجدول الكامل يظهر في صفحة المنتج تحت الصور)
const first = (s: string) => s.split(/[،—(+]/)[0].trim()
export function describe(m: CatalogModel): string {
  const bits = [
    spec(m, "display") && `شاشة ${first(spec(m, "display"))}`,
    spec(m, "cpu") && `معالج ${first(spec(m, "cpu")).replace(/^معالج\s*/, "")}`,
    spec(m, "rear_camera") && `كاميرا ${first(spec(m, "rear_camera"))}`,
    spec(m, "battery") && `بطارية ${first(spec(m, "battery"))}`,
  ].filter(Boolean)
  return `${m.title} أصلي: ${bits.join("، ")}. متوفر بسعات ${m.storages.map(storageLabel).join(" و")}. الدفع عند الاستلام.`
}

export const storageLabel = (s: string) => s.replace(/(\d+)GB/, "$1 جيجابايت").replace(/(\d+)TB/, "$1 تيرابايت")

// الخيارات: السعة دائماً، واللون إن كانت الألوان معروفة. كل متغير بلا سعر (يظهر "السعر عبر واتساب" حتى يُضاف السعر)
export function buildVariants(m: CatalogModel) {
  const storages = m.storages.map(storageLabel)
  const colors = m.colors
  const options = [{ title: "السعة", values: storages }, ...(colors.length ? [{ title: "اللون", values: colors }] : [])]
  const variants = storages.flatMap((s) =>
    (colors.length ? colors : [""]).map((c) => ({
      title: c ? `${s} / ${c}` : s,
      options: c ? { السعة: s, اللون: c } : { السعة: s },
      prices: [] as any[],
      manage_inventory: false,
      allow_backorder: false,
    }))
  )
  return { options, variants }
}

export const imageUrls = (m: CatalogModel, origin = STORE_ORIGIN) => m.images.map((i) => `${origin.replace(/\/$/, "")}/${i.path}`)

export function productPayload(
  m: CatalogModel,
  ctx: { category_id?: string; sales_channel_id?: string | null; shipping_profile_id?: string | null },
  origin = STORE_ORIGIN
) {
  const urls = imageUrls(m, origin)
  const { options, variants } = buildVariants(m)
  return {
    title: m.title,
    subtitle: m.subtitle,
    handle: m.handle,
    description: describe(m),
    status: "published",
    thumbnail: urls[0],
    images: urls.map((url) => ({ url })),
    categories: ctx.category_id ? [{ id: ctx.category_id }] : undefined,
    sales_channels: ctx.sales_channel_id ? [{ id: ctx.sales_channel_id }] : undefined,
    shipping_profile_id: ctx.shipping_profile_id || undefined,
    metadata: { condition: "new", model: m.model, brand: "Samsung", specs_ar: m.specs, added_by: "samsung-catalog" },
    options,
    variants,
  }
}

// تحديث منتج موجود: الصور والوصف والمواصفات فقط، دون لمس الأسعار أو المتغيرات
export function refreshPayload(m: CatalogModel, oldMeta: Record<string, any> | null | undefined, origin = STORE_ORIGIN) {
  const urls = imageUrls(m, origin)
  return {
    subtitle: m.subtitle,
    description: describe(m),
    ...(urls.length ? { thumbnail: urls[0], images: urls.map((url) => ({ url })) } : {}),
    metadata: { ...(oldMeta || {}), model: m.model, brand: "Samsung", specs_ar: m.specs },
  }
}
