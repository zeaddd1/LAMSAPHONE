import samsung from "../data/samsung-catalog.json"
import apple from "../data/apple-catalog.json"

// كتالوج الموديلات الجاهزة (سامسونج جالاكسي S9..S26، وأبل آيفون 11..18 مع السماعات والإكسسوارات) داخل "إضافة سريعة":
// اختيار الموديل يعبّئ الاسم والوصف والمواصفات والصور والسعات والألوان.
// الصور ملفات ثابتة في المتجر (storefront/public/catalog) فلا تضيع عند إعادة النشر ولا تمر بحد الرفع.

export type CatalogModel = {
  handle: string
  brand: string
  /** مسار القسم: القسم الرئيسي ثم الماركة، مثل ["جوالات","آبل"] */
  category: string[]
  model: string
  title: string
  subtitle: string
  storages: string[]
  ram: string
  colors: string[]
  images: { path: string; size: number }[]
  specs: Record<string, string>
}

export const CATALOG: CatalogModel[] = [
  ...(samsung as any[]).map((m) => ({ ...m, brand: "Samsung", category: ["جوالات", "سامسونج"] })),
  ...(apple as unknown as CatalogModel[]),
]
export const BRANDS = [
  { key: "Samsung", label: "سامسونج" },
  { key: "Apple", label: "آبل" },
]
export const STORE_ORIGIN = "https://lamsaphone.yemenbay.com"

// وصف عربي قصير من أهم المواصفات (الجدول الكامل يظهر في صفحة المنتج)
const first = (s = "") => s.split(/[،—(+]/)[0].trim()
export function describe(m: CatalogModel): string {
  const s = m.specs
  const bits = [
    s.screen && `شاشة ${first(s.screen)}`,
    s.cpu && `معالج ${first(s.cpu).replace(/^معالج\s*/, "")}`,
    s.camera && `كاميرا ${first(s.camera)}`,
    s.battery && `بطارية ${first(s.battery)}`,
  ].filter(Boolean)
  if (!s.screen && !s.cpu && s.type) return `${m.title} أصلي: ${first(s.type)}${s.features ? `، ${first(s.features)}` : ""}.`
  return `${m.title} أصلي: ${bits.join("، ")}.`
}

export const imageUrls = (m: CatalogModel, origin = STORE_ORIGIN) => m.images.map((i) => `${origin.replace(/\/$/, "")}/${i.path}`)
