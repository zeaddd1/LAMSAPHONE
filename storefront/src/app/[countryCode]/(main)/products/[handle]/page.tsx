import { STORE } from "@lib/store-info"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion, listRegions } from "@lib/data/regions"
import ProductTemplate from "@modules/products/templates"
import { HttpTypes } from "@medusajs/types"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ v_id?: string }>
}

// المنتجات والأقسام المضافة بعد البناء تُعرض فوراً بدل خطأ 500 (الصفحة تقرأ الكوكيز)
export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  try {
    const countryCodes = await listRegions().then((regions) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    if (!countryCodes) {
      return []
    }

    const promises = countryCodes.map(async (country) => {
      const { response } = await listProducts({
        countryCode: country,
        queryParams: { limit: 100, fields: "handle" },
      })

      return {
        country,
        products: response.products,
      }
    })

    const countryProducts = await Promise.all(promises)

    return countryProducts
      .flatMap((countryData) =>
        countryData.products.map((product) => ({
          countryCode: countryData.country,
          handle: product.handle,
        }))
      )
      .filter((param) => param.handle)
  } catch (error) {
    console.error(
      `Failed to generate static paths for product pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }.`
    )
    return []
  }
}

function getImagesForVariant(
  product: HttpTypes.StoreProduct,
  selectedVariantId?: string
) {
  if (!selectedVariantId || !product.variants) {
    return product.images
  }

  const variant = product.variants!.find((v) => v.id === selectedVariantId)
  if (!variant || !variant.images.length) {
    return product.images
  }

  const imageIdsMap = new Map(variant.images.map((i) => [i.id, true]))
  return product.images!.filter((i) => imageIdsMap.has(i.id))
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  // الأسماء العربية تصل مرمَّزة في الرابط
  const handle = safeDecode(params.handle)
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle },
  }).then(({ response }) => response.products[0])

  if (!product) {
    notFound()
  }

  const amount = (product.variants || [])
    .map((v: any) => v?.calculated_price?.calculated_amount)
    .filter((n: any) => typeof n === "number")
    .sort((x: number, y: number) => x - y)[0]
  const price = typeof amount === "number" ? ` بسعر ${amount}$` : ""
  const description =
    (product.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) ||
    `${product.title}${price} من ${STORE.name} في ${STORE.city}: فحص شامل وتوصيل سريع. اطلب عبر واتساب ${STORE.phoneDisplay}.`
  const url = `/${params.countryCode}/products/${product.handle}`
  return {
    title: `${product.title}${price ? ` | ${amount}$` : ""}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: STORE.shortName,
      locale: "ar_YE",
      url,
      title: `${product.title}${price}`,
      description,
      images: product.thumbnail ? [{ url: product.thumbnail, width: 1600, height: 1600, alt: `${product.title} - ${STORE.shortName} ${STORE.city}` }] : [],
    },
    twitter: { card: "summary_large_image", title: `${product.title}${price}`, description, images: product.thumbnail ? [product.thumbnail] : [] },
  }
}

export default async function ProductPage(props: Props) {
  const params = await props.params
  const region = await getRegion(params.countryCode)
  const searchParams = await props.searchParams

  const selectedVariantId = searchParams.v_id

  if (!region) {
    notFound()
  }

  const pricedProduct = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle: safeDecode(params.handle) },
  }).then(({ response }) => response.products[0])

  const images = getImagesForVariant(pricedProduct, selectedVariantId)

  if (!pricedProduct) {
    notFound()
  }

  return (
    <ProductTemplate
      product={pricedProduct}
      region={region}
      countryCode={params.countryCode}
      images={images}
    />
  )
}
