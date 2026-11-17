import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import SearchBox from "@modules/layout/components/search-box"
import ProductPreview from "@modules/products/components/product-preview"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = { title: "بحث", robots: { index: false } }
export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ q?: string }>
}

// صفحة نتائج البحث: تبحث في أسماء المنتجات وأوصافها عبر Medusa
export default async function SearchPage(props: Props) {
  const { countryCode } = await props.params
  const q = ((await props.searchParams).q || "").trim().slice(0, 80)
  const region = await getRegion(countryCode)
  if (!region) notFound()

  const products = q
    ? await listProducts({ countryCode, queryParams: { q, limit: 24 } as any }).then(({ response }) => response.products)
    : []

  return (
    <div className="content-container py-8">
      <h1 className="mb-4 text-2xl font-bold text-brand-navy">{q ? `نتائج البحث عن «${q}»` : "ابحث في المتجر"}</h1>
      <SearchBox initial={q} className="mb-6 max-w-md" />
      {q && !products.length && <p className="text-ui-fg-subtle">لا توجد نتائج. جرّب اسماً أقصر مثل «S24» أو «شاحن».</p>}
      <ul className="grid grid-cols-2 gap-x-6 gap-y-8 small:grid-cols-3 medium:grid-cols-4">
        {products.map((p) => (
          <li key={p.id}>
            <ProductPreview product={p} region={region} />
          </li>
        ))}
      </ul>
    </div>
  )
}
