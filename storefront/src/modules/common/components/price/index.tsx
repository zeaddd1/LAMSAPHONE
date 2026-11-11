"use client"

import { useCurrency } from "@lib/currency/context"
import { formatPrice } from "@lib/currency/format"

/**
 * يعرض مبلغاً بالدولار بعملة العرض التي اختارها العميل.
 * usdOnly: للطلبات المؤكدة نعرض الدولار فقط، والمبلغ المثبّت بعملة العميل يأتي من PinnedAmount.
 */
export default function Price({
  amount,
  usdOnly,
  className,
  "data-testid": testId,
}: {
  amount: number | null | undefined
  usdOnly?: boolean
  className?: string
  "data-testid"?: string
}) {
  const { currency, rates } = useCurrency()
  return (
    <span className={className} data-testid={testId} dir="ltr">
      {formatPrice(amount, usdOnly ? "USD" : currency, rates)}
    </span>
  )
}
