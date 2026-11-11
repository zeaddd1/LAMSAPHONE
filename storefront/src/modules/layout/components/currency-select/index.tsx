"use client"

import { useCurrency } from "@lib/currency/context"
import { DISPLAY_CURRENCIES, LABEL, type DisplayCurrency } from "@lib/currency/format"

/** محدد العملة في الهيدر. يظهر الدولار دائماً، وبقية العملات إذا فعّلها المدير. */
export default function CurrencySelect() {
  const { currency, rates, setCurrency } = useCurrency()
  const available = DISPLAY_CURRENCIES.filter((c) => c === "USD" || rates.some((r) => r.code === c))

  return (
    <select
      aria-label="العملة"
      className="bg-transparent text-xsmall-regular small:text-small-regular border border-ui-border-base rounded-md px-1 py-1 max-w-[110px] small:max-w-none"
      value={currency}
      onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
      data-testid="currency-select"
    >
      {available.map((c) => (
        <option key={c} value={c}>{LABEL[c]}</option>
      ))}
    </select>
  )
}
