import { STORE } from "@lib/store-info"
import StaticPage from "@modules/common/components/static-page"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "من نحن",
  description: `${STORE.name}: ${STORE.tagline}. ${STORE.address}.`,
}
export const revalidate = 86400

export default function About() {
  return (
    <StaticPage title="من نحن">
      <p>
        {STORE.name} متجر متخصص في جوالات سامسونج وارد أمريكا بنظافة وكالة وفحص شامل، مع إكسسوارات أصلية.
      </p>
      <p>كل جهاز يُفحص قبل التسليم، وتفحصه بنفسك قبل الدفع. نوفر الدفع عند الاستلام والتوصيل داخل صنعاء وإلى المحافظات.</p>
      <p>📍 {STORE.address}</p>
      <p dir="ltr" className="text-right">📲 {STORE.phoneDisplay}</p>
    </StaticPage>
  )
}
