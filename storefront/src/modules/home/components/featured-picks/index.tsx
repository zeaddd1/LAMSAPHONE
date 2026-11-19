import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"

/** المنتجات المميزة المختارة من صفحة "واجهة المتجر" في اللوحة، بنفس ترتيبها */
export default async function FeaturedPicks({ ids, title, region }: { ids: string[]; title: string; region: HttpTypes.StoreRegion }) {
  if (!ids.length) return null
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: { id: ids, limit: ids.length, fields: "*variants.calculated_price" } as any,
  })
  const ordered = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as HttpTypes.StoreProduct[]
  if (!ordered.length) return null
  return (
    <div className="content-container py-12">
      <h2 className="mb-8 text-2xl font-bold text-brand-navy">{title || "منتجات مميزة"}</h2>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 small:grid-cols-4">
        {ordered.map((p) => (
          <li key={p.id}>
            <ProductPreview product={p} region={region} isFeatured />
          </li>
        ))}
      </ul>
    </div>
  )
}
