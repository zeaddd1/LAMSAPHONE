import { ContainerRegistrationKeys, QueryContext, getVariantAvailability } from "@medusajs/framework/utils"
import { FeedItem, FeedProduct, FeedVariant, itemsToRss, productToItems } from "./meta-feed"

// يبني عناصر كتالوج Meta من قاعدة البيانات، ويعيد معها المنتجات المستبعدة وسبب استبعادها (لصفحة الفحص في اللوحة)

export const FEED_COUNTRY = "ye"
const PAGE = 100

export type SkippedProduct = { id: string; title: string; reason: "no_channel" | "no_price" | "no_image" }

export const storeUrl = () =>
  process.env.STOREFRONT_URL ||
  (process.env.STORE_CORS || "").split(",").map((s) => s.trim()).find((s) => s.startsWith("https://")) ||
  "https://lamsaphone.yemenbay.com"

export const backendUrl = () => process.env.MEDUSA_BACKEND_URL || "https://cp.lamsaphone.yemenbay.com"

export async function buildMetaFeed(scope: { resolve: (key: string) => any }): Promise<{
  items: FeedItem[]
  skipped: SkippedProduct[]
  products: number
  currency: string
}> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  // المنطقة التي تضم اليمن (اليمن والسعودية بالدولار)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code", "countries.iso_2"],
  })
  const region =
    (regions as any[]).find((r) => (r.countries || []).some((c: any) => c?.iso_2 === FEED_COUNTRY)) ||
    (regions as any[])[0]
  if (!region) return { items: [], skipped: [], products: 0, currency: "usd" }

  // قنوات البيع المربوطة بمفتاح المتجر: منتج خارجها لا يظهر في الموقع، فلا نرسله لـ Meta
  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id", "type", "revoked_at", "sales_channels.id"],
    filters: { type: "publishable" },
  })
  const storeChannels = new Set<string>(
    (keys as any[])
      .filter((k) => !k.revoked_at)
      .flatMap((k) => (k.sales_channels || []).map((sc: any) => sc?.id))
      .filter(Boolean)
  )
  const channelOf = (p: any): string | undefined =>
    (p.sales_channels || []).map((sc: any) => sc?.id).find((id: string) => storeChannels.has(id))

  const items: FeedItem[] = []
  const skipped: SkippedProduct[] = []
  let count = 0

  for (let skip = 0; ; skip += PAGE) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "subtitle",
        "handle",
        "description",
        "thumbnail",
        "metadata",
        "images.url",
        "type.value",
        "categories.name",
        "sales_channels.id",
        "variants.id",
        "variants.sku",
        "variants.title",
        "variants.manage_inventory",
        "variants.allow_backorder",
        "variants.images.url",
        "variants.options.value",
        "variants.options.option.title",
        "variants.calculated_price.*",
      ],
      filters: { status: "published" },
      pagination: { skip, take: PAGE, order: { created_at: "DESC" } },
      context: {
        variants: {
          calculated_price: QueryContext({ region_id: region.id, currency_code: region.currency_code }),
        },
      },
    })
    if (!products.length) break
    count += products.length

    // المخزون: نحسب المتوفر لكل قناة بيع للمتغيّرات التي تتبع المخزون فقط
    const stock = new Map<string, number>()
    const byChannel = new Map<string, string[]>()
    for (const p of products as any[]) {
      const sc = channelOf(p)
      if (!sc) continue
      const ids = (p.variants || []).filter((v: any) => v.manage_inventory && !v.allow_backorder).map((v: any) => v.id)
      if (ids.length) byChannel.set(sc, [...(byChannel.get(sc) || []), ...ids])
    }
    for (const [sales_channel_id, variant_ids] of byChannel) {
      const res = await getVariantAvailability(query as any, { variant_ids, sales_channel_id })
      for (const [id, r] of Object.entries(res)) stock.set(id, Number((r as any)?.availability || 0))
    }

    for (const p of products as any[]) {
      if (!channelOf(p)) {
        skipped.push({ id: p.id, title: p.title, reason: "no_channel" })
        continue
      }
      const productItems = productToItems(p as FeedProduct, {
        storeUrl: storeUrl(),
        countryCode: FEED_COUNTRY,
        currency: region.currency_code,
        backendUrl: backendUrl(),
        available: (v: FeedVariant) => !v.manage_inventory || !!v.allow_backorder || (stock.get(v.id) || 0) > 0,
      })
      if (!productItems.length) {
        const priced = (p.variants || []).some((v: any) => Number(v.calculated_price?.calculated_amount) > 0)
        skipped.push({ id: p.id, title: p.title, reason: priced ? "no_image" : "no_price" })
        continue
      }
      items.push(...productItems)
    }
    if (products.length < PAGE) break
  }

  return { items, skipped, products: count, currency: region.currency_code }
}

// كاش 10 دقائق لملف XML حتى لا يُبنى الكتالوج مع كل زيارة من Meta
const CACHE_MS = 10 * 60 * 1000
let cache: { at: number; xml: string } | null = null

export function clearMetaFeedCache() {
  cache = null
}

export async function getMetaFeedXml(scope: { resolve: (key: string) => any }): Promise<string> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const { items } = await buildMetaFeed(scope)
    cache = {
      at: Date.now(),
      xml: itemsToRss(items, {
        title: "لمسة فون",
        link: storeUrl(),
        description: "جوالات وإكسسوارات لمسة فون، الدفع عند الاستلام",
      }),
    }
  }
  return cache.xml
}
