import "server-only"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
export type Analytics = { gtm_id: string; ga_id: string; clarity_id: string }

/** معرّفات الزوار من لوحة "زوار المتجر"، كاش 5 دقائق. الفارغ = لا أدوات */
export async function getAnalytics(): Promise<Analytics> {
  const none = { gtm_id: "", ga_id: "", clarity_id: "" }
  try {
    const res = await fetch(`${BACKEND}/store/analytics-config`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 300, tags: ["analytics-config"] },
    })
    if (!res.ok) return none
    const j = await res.json()
    const gtm_id = /^GTM-[A-Z0-9]{4,12}$/.test(j.gtm_id || "") ? j.gtm_id : ""
    const ga_id = /^G-[A-Z0-9]{4,15}$/.test(j.ga_id || "") ? j.ga_id : ""
    const clarity_id = /^[a-z0-9]{6,20}$/.test(j.clarity_id || "") ? j.clarity_id : ""
    return { gtm_id, ga_id, clarity_id }
  } catch {
    return none
  }
}
