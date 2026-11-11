import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Text } from "@medusajs/ui"

// في صفحة الطلب: المبلغ المستحق بعملة العميل + زر واتساب
const OrderDisplayAmountWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const m = (order.metadata || {}) as Record<string, any>
  const phone = (order.shipping_address?.phone || order.billing_address?.phone || "").replace(/[^\d]/g, "")
  const msg = encodeURIComponent(`مرحباً، بخصوص طلبك رقم #${order.display_id} من لمسة فون`)
  return (
    <Container className="flex flex-col gap-2 px-6 py-4" dir="rtl">
      <Heading level="h2">المبلغ بعملة العميل</Heading>
      {m.amount_due_display != null ? (
        <>
          <Text>{Number(m.amount_due_display).toLocaleString("en-US")} {m.display_currency}</Text>
          <Text size="small" className="text-ui-fg-subtle">
            سعر الصرف: {m.rate_used} · بالدولار: {m.amount_usd}$ · {m.rate_timestamp ? new Date(m.rate_timestamp).toLocaleString("ar") : ""}
          </Text>
        </>
      ) : (
        <Text size="small" className="text-ui-fg-subtle">لا يوجد (طلب بالدولار)</Text>
      )}
      {phone && (
        <Button variant="secondary" size="small" asChild>
          <a href={`https://wa.me/${phone}?text=${msg}`} target="_blank" rel="noreferrer">تواصل مع العميل عبر واتساب</a>
        </Button>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "order.details.side.after" })
export default OrderDisplayAmountWidget
