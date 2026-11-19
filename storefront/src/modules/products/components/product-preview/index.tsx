import { Text } from "@medusajs/ui"
import { listProducts } from "@lib/data/products"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  // const pricedProduct = await listProducts({
  //   regionId: region.id,
  //   queryParams: { id: [product.id!] },
  // }).then(({ response }) => response.products[0])

  // if (!pricedProduct) {
  //   return null
  // }

  const { cheapestPrice } = getProductPrice({
    product,
  })

  // شارة العرض من لوحة التحكم (مثل: عرض خاص، الأكثر طلباً)
  const badge = String((product.metadata as any)?.badge || "").trim().slice(0, 24)
  const isSamsungPhone = /samsung|galaxy|سامسونج|جالكسي|s\d{2}|note/i.test(product.title || "") && !/شاحن|كيبل|وصل|كفر|سماع|charger|cable|case/i.test(product.title || "")

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group">
      <div data-testid="product-wrapper" className="relative">
        {badge && (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-[#FF6000] px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
            {badge}
          </span>
        )}
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          alt={`${product.title} - لمسة فون صنعاء`}
          size="full"
          isFeatured={isFeatured}
        />
        {/* شارات ثقة لجوالات سامسونج (تخصص المتجر) */}
        {isSamsungPhone && (
          <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
            <span className="rounded-full bg-[#fff1e6] px-2 py-0.5 text-[#c24e00]">وارد أمريكا 🇺🇸</span>
            <span className="rounded-full bg-[#e8f7ee] px-2 py-0.5 text-[#157a3c]">ضمان فحص</span>
          </div>
        )}
        <div className="flex txt-compact-medium mt-4 justify-between">
          <Text className="text-ui-fg-subtle text-right" dir="auto" data-testid="product-title">
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2">
            {cheapestPrice ? (
              <PreviewPrice price={cheapestPrice} />
            ) : (
              <span className="whitespace-nowrap text-xs font-semibold text-[#128C7E]">السعر عبر واتساب</span>
            )}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
