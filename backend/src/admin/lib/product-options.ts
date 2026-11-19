// خيارات المنتج من السعة واللون:
// لا شيء = بدون، قيمة واحدة = ثابتة (تُضاف لاسم المنتج ولا تظهر كاختيار)، أكثر من قيمة = يختار العميل.
export type OptionMode = "none" | "fixed" | "choice"
export const optionMode = (values: string[]): OptionMode => (values.length === 0 ? "none" : values.length === 1 ? "fixed" : "choice")

export function buildOptions(storages: string[], colors: string[], amount: number | null, currency = "usd") {
  const prices = amount && amount > 0 ? [{ currency_code: currency, amount }] : []
  const axes = [
    ...(storages.length > 1 ? [{ title: "السعة", values: storages }] : []),
    ...(colors.length > 1 ? [{ title: "اللون", values: colors }] : []),
  ]
  if (!axes.length) {
    return {
      options: [{ title: "الخيار", values: ["افتراضي"] }],
      variants: [{ title: "افتراضي", options: { الخيار: "افتراضي" } as Record<string, string>, prices }],
    }
  }
  let combos: Record<string, string>[] = [{}]
  for (const a of axes) combos = combos.flatMap((c) => a.values.map((v) => ({ ...c, [a.title]: v })))
  return {
    options: axes,
    variants: combos.map((c) => ({ title: Object.values(c).join(" / "), options: c, prices })),
  }
}

/** الاسم النهائي: الاسم + القيم الثابتة غير المكتوبة فيه */
export function titleWith(title: string, fixed: string[]) {
  let t = title.trim()
  for (const v of fixed) if (v && !t.toLowerCase().includes(v.toLowerCase())) t = `${t} ${v}`
  return t
}
