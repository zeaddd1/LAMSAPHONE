"use client"

import { useCurrency } from "@lib/currency/context"

/** سطر توضيحي أسفل السعر في السلة والدفع (لغير الدولار). */
export default function RateNote() {
  const { currency } = useCurrency()
  if (currency === "USD") return null
  return <p className="text-small-regular text-ui-fg-subtle mt-2">يُحتسب المبلغ بسعر الصرف المعتمد وقت تأكيد الطلب.</p>
}
