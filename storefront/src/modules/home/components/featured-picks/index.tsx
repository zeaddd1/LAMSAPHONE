import { listProducts } from "@lib/data/products"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"

const ranked = (p: HttpTypes.StoreProduct) => {
  const r = (p.metadata as any)?.rank
  return r !== null && r !== undefined && r !== "" && Number.isFinite(Number(r))
}

/** أول المنتجات في ترتيب العرض (1، 2، 3… من تبويب المنتجات في اللوحة): أول ما يراه الزائر في الصفحة الرئيسية */
export default async function FeaturedPicks({ title, region }: { title: string; region: HttpTypes.StoreRegion }) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: { limit: 100 } as any,
  })
  const top = sortProducts(products.filter(ranked), "created_at").slice(0, 8)
  if (!top.length) return null
  return (
    <div className="content-container py-12">
      <h2 className="mb-8 text-2xl font-bold text-brand-navy">{title || "عروض ومنتجات مميزة"}</h2>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 small:grid-cols-4">
        {top.map((p) => (
          <li key={p.id}>
            <ProductPreview product={p} region={region} isFeatured />
          </li>
        ))}
      </ul>
    </div>
  )
}
