import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import InteractiveLink from "@modules/common/components/interactive-link"
import ProductPreview from "@modules/products/components/product-preview"

/** أحدث المنتجات في الصفحة الرئيسية */
export default async function LatestProducts({ region }: { region: HttpTypes.StoreRegion }) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: { limit: 8, order: "-created_at", fields: "*variants.calculated_price" } as any,
  })
  if (!products.length) return null
  return (
    <div className="content-container py-12">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-brand-navy">أحدث الجوالات</h2>
        <InteractiveLink href="/store">عرض الكل</InteractiveLink>
      </div>
      <ul className="grid grid-cols-2 small:grid-cols-4 gap-x-6 gap-y-10">
        {products.map((p) => (
          <li key={p.id}>
            <ProductPreview product={p} region={region} isFeatured />
          </li>
        ))}
      </ul>
    </div>
  )
}
