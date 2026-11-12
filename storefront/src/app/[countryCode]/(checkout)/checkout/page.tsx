import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import TrackMetaEvent from "@modules/common/components/meta-pixel/track-event"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "إتمام الطلب",
}

export default async function Checkout() {
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <PaymentWrapper cart={cart}>
        <CheckoutForm cart={cart} customer={customer} />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
      <TrackMetaEvent
        event="InitiateCheckout"
        onceKey={cart.id}
        params={{
          content_ids: (cart.items || []).map((i) => i.variant_id).filter(Boolean),
          content_type: "product",
          num_items: (cart.items || []).reduce((n, i) => n + i.quantity, 0),
          value: cart.total,
          currency: cart.currency_code?.toUpperCase(),
        }}
      />
    </div>
  )
}
