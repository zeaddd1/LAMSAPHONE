// إعدادات واجهة المتجر (الإعلانات والمنتجات المميزة) تُحفظ في store.metadata.lamsa_home
// من صفحة "واجهة المتجر" في لوحة التحكم، وتُقرأ هنا بعد تنظيفها (لا تُرجع أي بيانات أخرى من المتجر).

export type HomeBanner = {
  id: string
  active: boolean
  badge: string
  title: string
  subtitle: string
  cta: string
  link: string
  image: string
  theme: "navy" | "orange" | "dark" | "light"
}
export type HomeConfig = { banners: HomeBanner[]; featured: string[]; featured_title: string }

const THEMES = ["navy", "orange", "dark", "light"]
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
// الروابط: داخلية تبدأ بـ / أو https فقط (لا javascript: ولا غيره)
const safeLink = (v: unknown) => {
  const s = str(v, 300)
  return s.startsWith("/") && !s.startsWith("//") ? s : /^https:\/\//i.test(s) ? s : ""
}
const safeImage = (v: unknown) => {
  const s = str(v, 500)
  return /^https?:\/\//i.test(s) ? s : ""
}

export function cleanHomeConfig(raw: any): HomeConfig {
  const banners = (Array.isArray(raw?.banners) ? raw.banners : []).slice(0, 8).map((b: any, i: number) => ({
    id: str(b?.id, 40) || `b${i}`,
    active: b?.active !== false,
    badge: str(b?.badge, 40),
    title: str(b?.title, 90),
    subtitle: str(b?.subtitle, 200),
    cta: str(b?.cta, 30),
    link: safeLink(b?.link),
    image: safeImage(b?.image),
    theme: THEMES.includes(b?.theme) ? b.theme : "navy",
  }))
  const featured = (Array.isArray(raw?.featured) ? raw.featured : [])
    .filter((id: unknown) => typeof id === "string" && /^prod_[A-Za-z0-9]+$/.test(id))
    .slice(0, 24)
  return { banners: banners.filter((b: HomeBanner) => b.title), featured, featured_title: str(raw?.featured_title, 60) }
}
