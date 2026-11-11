/**
 * تحويل وتقريب الأسعار من الدولار إلى عملة العرض.
 * هذه الدالة "نقية" (بدون قاعدة بيانات) حتى يسهل اختبارها، ونسخة مطابقة منها في الواجهة.
 */

export const DISPLAY_CURRENCIES = ["USD", "SAR", "YER_OLD", "YER_NEW"] as const
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]

export function isDisplayCurrency(v: unknown): v is DisplayCurrency {
  return typeof v === "string" && (DISPLAY_CURRENCIES as readonly string[]).includes(v)
}

/** عدد الخانات العشرية في رقم مثل 0.5 أو 0.01 (لتجنّب أخطاء الفاصلة العائمة). */
function decimalsOf(n: number): number {
  const s = String(n)
  if (s.includes("e-")) return Number(s.split("e-")[1])
  const i = s.indexOf(".")
  return i === -1 ? 0 : s.length - i - 1
}

/**
 * يقرّب القيمة إلى أقرب مضاعف لـ step. مثال: step=100 → 15,349 تصبح 15,300، و15,350 تصبح 15,400.
 * step <= 0 يعني بدون تقريب خاص (نقرّب لسنتين فقط).
 */
export function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value)) throw new Error("Invalid amount")
  if (!step || step <= 0) return Math.round(value * 100) / 100
  const d = Math.max(decimalsOf(step), 0)
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(d))
}

/** السعر بعملة العرض = سعر الدولار × سعر الصرف، ثم التقريب. */
export function convertFromUsd(usdAmount: number, ratePerUsd: number, roundingStep: number): number {
  if (!Number.isFinite(usdAmount) || usdAmount < 0) throw new Error("Invalid USD amount")
  if (!Number.isFinite(ratePerUsd) || ratePerUsd <= 0) throw new Error("Invalid exchange rate")
  return roundToStep(usdAmount * ratePerUsd, roundingStep)
}
