// تحويل منتجات Medusa إلى عناصر كتالوج Meta (فيسبوك وإنستغرام وواتساب)
// المواصفات: https://www.facebook.com/business/help/120325381656392

export type FeedVariant = {
  id: string
  sku?: string | null
  title?: string | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  options?: { value: string; option?: { title?: string | null } | null }[] | null
  images?: { url: string }[] | null
  calculated_price?: {
    original_amount?: number | null
    calculated_amount?: number | null
  } | null
}

export type FeedProduct = {
  id: string
  title: string
  handle: string
  description?: string | null
  subtitle?: string | null
  thumbnail?: string | null
  images?: { url: string }[] | null
  type?: { value?: string | null } | null
  categories?: { name?: string | null }[] | null
  metadata?: Record<string, unknown> | null
  variants?: FeedVariant[] | null
}

export type FeedItem = Record<string, string>

// عناوين خيار "الحالة" وقيمه كما تُكتب في لوحة التحكم
const CONDITION_TITLES = ["الحالة", "حالة", "condition"]
const COLOR_TITLES = ["اللون", "لون", "color", "colour"]
const SIZE_TITLES = ["السعة", "سعة", "التخزين", "الذاكرة", "storage", "capacity", "size", "المقاس"]

// الماركة من اسم المنتج إن لم تُضبط في metadata.brand أو نوع المنتج
const BRANDS: [RegExp, string][] = [
  [/(apple|iphone|ipad|airpods|آيفون|ايفون|أيفون|ابل|آبل|أبل|ايباد|آيباد)/i, "Apple"],
  [/(samsung|galaxy|سامسونج|سامسونغ|جالكسي|جالاكسي|غالاكسي)/i, "Samsung"],
  [/(xiaomi|redmi|poco|شاومي|ريدمي|بوكو)/i, "Xiaomi"],
  [/(huawei|هواوي)/i, "Huawei"],
  [/(honor|هونر)/i, "Honor"],
  [/(oppo|أوبو|اوبو)/i, "Oppo"],
  [/(realme|ريلمي)/i, "Realme"],
  [/(vivo|فيفو)/i, "Vivo"],
  [/(oneplus|ون بلس|وان بلس)/i, "OnePlus"],
  [/(infinix|إنفينكس|انفينكس)/i, "Infinix"],
  [/(tecno|تكنو|تيكنو)/i, "Tecno"],
  [/(itel|آيتل|ايتل)/i, "itel"],
  [/(google|pixel|جوجل|بكسل)/i, "Google"],
  [/(nokia|نوكيا)/i, "Nokia"],
  [/(motorola|موتورولا)/i, "Motorola"],
  [/(anker|أنكر|انكر)/i, "Anker"],
]
export const STORE_BRAND = "لمسة فون"

const norm = (s?: string | null) => (s || "").trim().toLowerCase()

export function optionValue(variant: FeedVariant, titles: string[]): string | undefined {
  const o = (variant.options || []).find((x) => titles.includes(norm(x.option?.title)))
  return o?.value?.trim() || undefined
}

export function mapCondition(value?: string | null): "new" | "used" | "refurbished" {
  const v = norm(value)
  if (!v) return "new"
  if (/(مجدد|مجدّد|refurb|renew)/.test(v)) return "refurbished"
  if (/(مستعمل|مستخدم|used|pre-owned)/.test(v)) return "used"
  return "new"
}

export function detectBrand(product: FeedProduct): string {
  const meta = product.metadata?.brand
  if (typeof meta === "string" && meta.trim()) return meta.trim()
  const text = [product.type?.value, product.title, product.subtitle].filter(Boolean).join(" ")
  for (const [re, name] of BRANDS) if (re.test(text)) return name
  if (product.type?.value?.trim()) return product.type.value.trim()
  return STORE_BRAND
}

export function stripHtml(s?: string | null): string {
  return (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function money(amount: number, currency: string): string {
  return `${(Math.round(amount * 100) / 100).toFixed(2)} ${currency.toUpperCase()}`
}

const absUrl = (url: string | undefined | null, base: string) => {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`
}

/**
 * يحوّل منتجاً إلى عناصر (عنصر لكل متغيّر). المتغيّرات بلا سعر تُتخطّى لأن Meta ترفضها.
 * available: هل المتغيّر متوفر (يُحسب من المخزون خارج هذه الدالة).
 */
export function productToItems(
  product: FeedProduct,
  opts: {
    storeUrl: string
    countryCode: string
    currency: string
    backendUrl: string
    available: (v: FeedVariant) => boolean
  }
): FeedItem[] {
  const brand = detectBrand(product)
  const description = (stripHtml(product.description) || stripHtml(product.subtitle) || product.title).slice(0, 9999)
  const productImages = [product.thumbnail, ...(product.images || []).map((i) => i.url)]
    .map((u) => absUrl(u, opts.backendUrl))
    .filter((u): u is string => Boolean(u))
  const category = product.categories?.find((c) => c?.name)?.name || product.type?.value || ""
  const variants = product.variants || []
  const metaCondition = typeof product.metadata?.condition === "string" ? (product.metadata.condition as string) : undefined

  const items: FeedItem[] = []
  for (const v of variants) {
    const original = v.calculated_price?.original_amount
    const calculated = v.calculated_price?.calculated_amount
    const price = original ?? calculated
    if (price == null || !(Number(price) > 0)) continue

    const variantImages = (v.images || []).map((i) => absUrl(i.url, opts.backendUrl)).filter(Boolean) as string[]
    // صور خاصة بالمتغيّر (مثل اللون) أولاً، وإلا فالصورة الرئيسية للمنتج
    const ownImages = variantImages.filter((u) => !productImages.includes(u))
    const images = Array.from(new Set([...ownImages, ...productImages, ...variantImages])).filter((u) =>
      /^https?:\/\//i.test(u)
    )
    if (!images.length) continue // Meta تشترط صورة برابط كامل

    const optionText = (v.options || [])
      .map((o) => o.value)
      .filter((x) => x && !/default/i.test(x))
      .join(" ")
    const title = (variants.length > 1 && optionText ? `${product.title} ${optionText}` : product.title).slice(0, 200)

    const item: FeedItem = {
      "g:id": v.id,
      "g:item_group_id": product.id,
      "g:title": title,
      "g:description": description,
      "g:availability": opts.available(v) ? "in stock" : "out of stock",
      "g:condition": mapCondition(optionValue(v, CONDITION_TITLES) || metaCondition || product.title),
      "g:price": money(Number(price), opts.currency),
      "g:link": `${opts.storeUrl.replace(/\/$/, "")}/${opts.countryCode}/products/${encodeURIComponent(product.handle)}?v_id=${encodeURIComponent(v.id)}`,
      "g:image_link": images[0],
      "g:brand": brand,
    }
    if (images.length > 1) item["g:additional_image_link"] = images.slice(1, 11).join(",")
    if (calculated != null && original != null && Number(calculated) < Number(original)) {
      item["g:sale_price"] = money(Number(calculated), opts.currency)
    }
    if (v.sku) item["g:mpn"] = v.sku
    if (category) item["g:product_type"] = category
    const color = optionValue(v, COLOR_TITLES)
    if (color) item["g:color"] = color
    const size = optionValue(v, SIZE_TITLES)
    if (size) item["g:size"] = size
    items.push(item)
  }
  return items
}

const xmlEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // محارف تحكم غير مسموحة في XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")

export function itemsToRss(items: FeedItem[], channel: { title: string; link: string; description: string }): string {
  const body = items
    .map(
      (it) =>
        "    <item>\n" +
        Object.entries(it)
          .map(([k, v]) => `      <${k}>${xmlEscape(v)}</${k}>`)
          .join("\n") +
        "\n    </item>"
    )
    .join("\n")
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n' +
    "  <channel>\n" +
    `    <title>${xmlEscape(channel.title)}</title>\n` +
    `    <link>${xmlEscape(channel.link)}</link>\n` +
    `    <description>${xmlEscape(channel.description)}</description>\n` +
    (body ? body + "\n" : "") +
    "  </channel>\n" +
    "</rss>\n"
  )
}
