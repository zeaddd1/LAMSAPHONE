import { SUFFIX, isDisplayCurrency } from "@lib/currency/format"
import { HttpTypes } from "@medusajs/types"

/** المبلغ المستحق بعملة العميل كما ثبّته الخادم لحظة تأكيد الطلب (من metadata). */
export default function PinnedAmount({ order }: { order: HttpTypes.StoreOrder }) {
  const m = (order.metadata || {}) as Record<string, any>
  if (!isDisplayCurrency(m.display_currency) || m.display_currency === "USD" || m.amount_due_display == null) return null
  const yer = m.display_currency.startsWith("YER")
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: yer ? 0 : 2, maximumFractionDigits: yer ? 0 : 2 }).format(Number(m.amount_due_display))
  return (
    <div className="flex items-center justify-between text-base-semi text-ui-fg-base mt-2" data-testid="pinned-amount">
      <span>المبلغ المستحق عند الاستلام</span>
      <span dir="ltr">{n} {SUFFIX[m.display_currency]}</span>
    </div>
  )
}
