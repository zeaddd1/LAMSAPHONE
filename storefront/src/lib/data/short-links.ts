import "server-only"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type ShortProduct = { id: string; handle: string; title: string; price?: number }

/**
 * يجد المنتج من الرمز القصير في روابط المنشورات (/p/xxxxxx و /wa/xxxxxx).
 * الرمز = آخر 6 أحرف من رقم المنتج. القائمة تُخزَّن 5 دقائق.
 */
export async function findByShortCode(code: string): Promise<ShortProduct | null> {
  const c = (code || "").toLowerCase().replace(/[^a-z0-9]/g, "")
  if (c.length < 4) return null
  try {
    const res = await fetch(`${BACKEND}/store/products?limit=500&fields=id,handle,title,variants.prices.amount,variants.prices.currency_code`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 300, tags: ["short-links"] },
    })
    if (!res.ok) return null
    const json = await res.json()
    const p = (json.products || []).find((x: any) => String(x.id).toLowerCase().endsWith(c))
    if (!p) return null
    const usd = (p.variants || []).flatMap((v: any) => v.prices || []).filter((x: any) => x.currency_code === "usd").map((x: any) => Number(x.amount))
    return { id: p.id, handle: p.handle, title: p.title, price: usd.length ? Math.min(...usd) : undefined }
  } catch {
    return null
  }
}
