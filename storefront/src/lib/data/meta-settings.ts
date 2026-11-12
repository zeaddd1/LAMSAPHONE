import "server-only"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type MetaPublicSettings = { pixel_id: string; domain_verification: string; whatsapp_number: string }

/** إعدادات Meta من لوحة التحكم (صفحة "ربط Meta") مع كاش 5 دقائق. متغيرات البيئة احتياط فقط. */
export async function getMetaSettings(): Promise<MetaPublicSettings> {
  const fallback = {
    pixel_id: process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
    domain_verification: process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION || "",
    whatsapp_number: "",
  }
  try {
    const res = await fetch(`${BACKEND}/store/meta-settings`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 300, tags: ["meta-settings"] },
    })
    if (!res.ok) return fallback
    const s = (await res.json()) as Partial<MetaPublicSettings>
    return {
      pixel_id: s.pixel_id || fallback.pixel_id,
      domain_verification: s.domain_verification || fallback.domain_verification,
      whatsapp_number: s.whatsapp_number || "",
    }
  } catch {
    return fallback
  }
}
