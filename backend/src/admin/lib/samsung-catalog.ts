import data from "../data/samsung-catalog.json"

// كتالوج موديلات سامسونج جالاكسي S (من S9 إلى S26) يُستخدم داخل "إضافة سريعة":
// اختيار الموديل يعبّئ الاسم والوصف والمواصفات والصور والسعات والألوان.
// الصور ملفات ثابتة في المتجر (storefront/public/catalog) فلا تضيع عند إعادة النشر ولا تمر بحد الرفع.

export type CatalogModel = {
  handle: string
  model: string
  title: string
  subtitle: string
  storages: string[]
  ram: string
  colors: string[]
  images: { path: string; size: number }[]
  specs: Record<string, string>
}

export const CATALOG = data as CatalogModel[]
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
  return `${m.title} أصلي: ${bits.join("، ")}. الدفع عند الاستلام.`
}

export const imageUrls = (m: CatalogModel, origin = STORE_ORIGIN) => m.images.map((i) => `${origin.replace(/\/$/, "")}/${i.path}`)
