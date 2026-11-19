import "server-only"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type HomeBanner = { id: string; badge: string; title: string; subtitle: string; cta: string; link: string; image: string; theme: string }
export type HomeConfig = { banners: HomeBanner[]; featured: string[]; featured_title: string }

/** إعدادات الصفحة الرئيسية (الإعلانات والمنتجات المميزة) من لوحة التحكم، كاش دقيقة */
export async function getHomeConfig(): Promise<HomeConfig> {
  const empty = { banners: [], featured: [], featured_title: "" }
  try {
    const res = await fetch(`${BACKEND}/store/home-config`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 60, tags: ["home-config"] },
    })
    if (!res.ok) return empty
    const j = await res.json()
    return { banners: j.banners ?? [], featured: j.featured ?? [], featured_title: j.featured_title ?? "" }
  } catch {
    return empty
  }
}
