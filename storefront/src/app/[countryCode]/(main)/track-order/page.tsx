import StaticPage from "@modules/common/components/static-page"
import TrackOrderForm from "@modules/order/components/track-order-form"
import { Metadata } from "next"

export const metadata: Metadata = { title: "تتبع الطلب" }

export default function TrackOrder() {
  return (
    <StaticPage title="تتبع الطلب">
      <TrackOrderForm />
    </StaticPage>
  )
}
