import { retrieveOrder } from "@lib/data/orders"
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"
import TrackMetaEvent from "@modules/common/components/meta-pixel/track-event"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}
export const metadata: Metadata = {
  title: "تم تأكيد الطلب",
  description: "تم استلام طلبك بنجاح",
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    return notFound()
  }

  return (
    <>
      <OrderCompletedTemplate order={order} />
      {/* Meta Pixel: طلب مكتمل (الدفع عند الاستلام) */}
      <TrackMetaEvent
        event="Purchase"
        onceKey={order.id}
        params={{
          content_ids: (order.items || []).map((i) => i.variant_id).filter(Boolean),
          content_type: "product",
          num_items: (order.items || []).reduce((n, i) => n + i.quantity, 0),
          value: order.total,
          currency: order.currency_code?.toUpperCase(),
        }}
      />
    </>
  )
}
