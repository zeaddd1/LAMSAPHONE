import type { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "ye"

export const revalidate = 3600

async function fetchHandles(path: string, key: string): Promise<string[]> {
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    return ((await res.json())[key] || []).map((x: any) => x.handle).filter(Boolean)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = `${getBaseURL()}/${REGION}`
  const [products, categories] = await Promise.all([
    fetchHandles("/store/products?fields=handle&limit=1000", "products"),
    fetchHandles("/store/product-categories?fields=handle&limit=200", "product_categories"),
  ])
  const statics = ["", "/store", "/about", "/contact", "/returns", "/track-order"]
  return [
    ...statics.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const })),
    ...categories.map((h) => ({ url: `${base}/categories/${encodeURIComponent(h)}`, changeFrequency: "daily" as const })),
    ...products.map((h) => ({ url: `${base}/products/${encodeURIComponent(h)}`, changeFrequency: "daily" as const })),
  ]
}
