// Meta Pixel: رقمه يُضبط من لوحة التحكم (صفحة "ربط Meta") ويحمّله المكوّن MetaPixel

type Fbq = (...args: unknown[]) => void

/**
 * يرسل حدثاً إلى Meta. content_ids هي أرقام المتغيّرات نفسها الموجودة في الكتالوج (/feeds/meta.xml).
 * إذا لم يُحمَّل كود Pixel بعد (أول تحميل للصفحة) ننتظره حتى 10 ثوانٍ، وإن لم يُضبط Pixel لا يُرسل شيء.
 */
export function trackMeta(event: string, params?: Record<string, unknown>, tries = 0) {
  if (typeof window === "undefined") return
  const w = window as unknown as { fbq?: Fbq; __lpMetaPixel?: boolean }
  if (w.__lpMetaPixel === false) return
  if (typeof w.fbq === "function") {
    w.fbq("track", event, params)
  } else if (tries < 40) {
    setTimeout(() => trackMeta(event, params, tries + 1), 250)
  }
}
