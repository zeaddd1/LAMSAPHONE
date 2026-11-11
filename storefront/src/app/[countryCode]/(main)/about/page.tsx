import StaticPage from "@modules/common/components/static-page"
import { Metadata } from "next"

export const metadata: Metadata = { title: "من نحن" }
export const revalidate = 86400

export default function About() {
  return (
    <StaticPage title="من نحن">
      <p>لمسة فون متجر متخصص في الجوالات والإكسسوارات: أجهزة جديدة ومستعملة ومجدّدة مفحوصة، وإكسسوارات أصلية.</p>
      <p>نوفر الدفع عند الاستلام، والتوصيل داخل المدينة أو الاستلام من المحل.</p>
    </StaticPage>
  )
}
