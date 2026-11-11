/**
 * الدالة المركزية الوحيدة لعرض الأسعار: formatPrice(usdAmount, currencyCode, rates).
 * الأسعار في المتجر بالدولار، وتُحوَّل هنا لعملة العرض. لا تحسب الأسعار في أي مكان آخر.
 * منطق التقريب مطابق لـ backend/src/lib/currency.ts.
 */
export const DISPLAY_CURRENCIES = ["USD", "SAR", "YER_OLD", "YER_NEW"] as const
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]
export const CURRENCY_COOKIE = "lp_currency"

export type ExchangeRate = {
  code: DisplayCurrency
  rate_per_usd: number
  rounding_step: number
  label_ar: string
  symbol: string
}

export const SUFFIX: Record<DisplayCurrency, string> = {
  USD: "$",
  SAR: "ر.س",
  YER_OLD: "ر.ي (قديم)",
  YER_NEW: "ر.ي (جديد)",
}
export const LABEL: Record<DisplayCurrency, string> = {
  USD: "دولار",
  SAR: "ريال سعودي",
  YER_OLD: "ريال يمني قديم",
  YER_NEW: "ريال يمني جديد",
}

export function isDisplayCurrency(v: unknown): v is DisplayCurrency {
  return typeof v === "string" && (DISPLAY_CURRENCIES as readonly string[]).includes(v)
}

export function defaultCurrency(): DisplayCurrency {
  const d = process.env.NEXT_PUBLIC_DEFAULT_DISPLAY_CURRENCY
  return isDisplayCurrency(d) ? d : "USD"
}

function decimalsOf(n: number): number {
  const s = String(n)
  if (s.includes("e-")) return Number(s.split("e-")[1])
  const i = s.indexOf(".")
  return i === -1 ? 0 : s.length - i - 1
}

export function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0
  if (!step || step <= 0) return Math.round(value * 100) / 100
  return Number((Math.round(value / step) * step).toFixed(decimalsOf(step)))
}

/** يحوّل المبلغ بالدولار لعملة العرض. إن لم يتوفر سعر صرف فعّال يعود للدولار. */
export function convert(usdAmount: number, code: DisplayCurrency, rates: ExchangeRate[]) {
  const rate = rates.find((r) => r.code === code)
  if (code === "USD" || !rate || !(rate.rate_per_usd > 0)) {
    return { amount: roundToStep(usdAmount, 0.01), code: "USD" as DisplayCurrency }
  }
  return { amount: roundToStep(usdAmount * rate.rate_per_usd, rate.rounding_step), code }
}

/** التنسيق: اليمني بلا كسور مع فاصل آلاف، والسعودي والدولار بكسرين. */
export function formatPrice(usdAmount: number | null | undefined, code: DisplayCurrency, rates: ExchangeRate[]): string {
  const { amount, code: used } = convert(Number(usdAmount ?? 0), code, rates)
  const yer = used === "YER_OLD" || used === "YER_NEW"
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: yer ? 0 : 2,
    maximumFractionDigits: yer ? 0 : 2,
  }).format(amount)
  return used === "USD" ? `${n} $` : `${n} ${SUFFIX[used]}`
}
