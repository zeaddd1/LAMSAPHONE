import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import BannerCarousel from "@modules/home/components/banner-carousel"
import FeaturedPicks from "@modules/home/components/featured-picks"
import { getHomeConfig } from "@lib/data/home-config"
import LatestProducts from "@modules/home/components/latest-products"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: "لمسة فون | جوالات وإكسسوارات",
  description: "جوالات جديدة ومستعملة ومجددة وإكسسوارات أصلية، مع الدفع عند الاستلام.",
}

// الصفحة تقرأ الكوكيز فتُعرض ديناميكياً، وبيانات المنتجات مخزّنة 60 ثانية
export const dynamic = "force-dynamic"

export default async function Home(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params
  const region = await getRegion(countryCode)
  if (!region) return null

  const [{ collections }, home] = await Promise.all([listCollections({ fields: "id, handle, title" }), getHomeConfig()])

  return (
    <>
      {/* الإعلانات من "واجهة المتجر" في اللوحة، وإن لم توجد يظهر الشريط الافتراضي */}
      {home.banners.length ? <BannerCarousel banners={home.banners} /> : <Hero />}
      <FeaturedPicks title={home.featured_title} region={region} />
      <LatestProducts region={region} />
      {collections?.length ? (
        <div className="py-12">
          <ul className="flex flex-col gap-x-6">
            <FeaturedProducts collections={collections} region={region} />
          </ul>
        </div>
      ) : null}
    </>
  )
}
