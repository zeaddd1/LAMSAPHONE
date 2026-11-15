import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import LatestProducts from "@modules/home/components/latest-products"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: "لمسة فون | جوالات وإكسسوارات",
  description: "جوالات جديدة ومستعملة ومجددة وإكسسوارات أصلية، مع الدفع عند الاستلام.",
}

// إعادة توليد الصفحة كل 5 دقائق (ISR) لتخفيف الطلبات على الباك إند
export const revalidate = 300

export default async function Home(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params
  const region = await getRegion(countryCode)
  if (!region) return null

  const { collections } = await listCollections({ fields: "id, handle, title" })

  return (
    <>
      <Hero />
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
