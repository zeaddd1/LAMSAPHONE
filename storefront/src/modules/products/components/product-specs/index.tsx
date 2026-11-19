import { HttpTypes } from "@medusajs/types"

type Spec = { key: string; label: string; value: string }

// نفس حقول خانة "المواصفات" في لوحة التحكم (metadata.specs)
const FIELDS: [string, string, string][] = [
  ["screen", "الشاشة", "📱"],
  ["cpu", "المعالج", "⚡"],
  ["memory", "الذاكرة والتخزين", "💾"],
  ["camera", "الكاميرا الخلفية", "📷"],
  ["front_camera", "الكاميرا الأمامية", "🤳"],
  ["battery", "البطارية والشحن", "🔋"],
  ["os", "نظام التشغيل", "🧩"],
  ["build", "التصميم والخامات", "🛡️"],
  ["dimensions", "الأبعاد والوزن", "📐"],
  ["connectivity", "الاتصال والمميزات", "📶"],
  ["release", "تاريخ الإطلاق", "📅"],
]
const ICONS: Record<string, string> = Object.fromEntries(FIELDS.map(([k, , i]) => [k, i]))
// أهم أربع مواصفات تظهر كبطاقات في الأعلى، والباقي في الجدول
const HIGHLIGHTS = ["screen", "cpu", "camera", "battery"]

/** قسم المواصفات في صفحة المنتج (من metadata.specs) */
export default function ProductSpecs({ product }: { product: HttpTypes.StoreProduct }) {
  const raw = ((product.metadata as any)?.specs || {}) as Record<string, unknown>
  const specs: Spec[] =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? FIELDS.map(([key, label]) => ({ key, label, value: typeof raw[key] === "string" ? (raw[key] as string).trim() : "" })).filter((s) => s.value)
      : []
  if (!specs.length) return null
  const top = HIGHLIGHTS.map((k) => specs.find((s) => s.key === k)).filter(Boolean) as Spec[]

  return (
    <section className="content-container my-10" aria-labelledby="specs-title">
      <div className="rounded-large border border-gray-200 bg-white p-5 small:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <h2 id="specs-title" className="text-2xl font-bold text-brand-navy">المواصفات</h2>
          {product.subtitle && <span className="text-sm text-ui-fg-subtle" dir="ltr">{product.subtitle}</span>}
        </div>

        {top.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 small:grid-cols-4">
            {top.map((s) => (
              <div key={s.label} className="rounded-xl bg-[#fff6ef] p-3">
                <div className="text-lg" aria-hidden="true">{ICONS[s.key] || "•"}</div>
                <div className="mt-1 text-xs font-semibold text-[#c24e00]">{s.label}</div>
                <div className="mt-1 line-clamp-3 text-sm leading-6 text-ui-fg-base">{s.value.split(/[،—]/)[0]}</div>
              </div>
            ))}
          </div>
        )}

        <dl className="divide-y divide-gray-100">
          {specs.map((s) => (
            <div key={s.label} className="grid grid-cols-1 gap-1 py-3 small:grid-cols-[200px_1fr] small:gap-6">
              <dt className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                <span aria-hidden="true">{ICONS[s.key] || "•"}</span>
                {s.label}
              </dt>
              <dd className="text-sm leading-7 text-ui-fg-subtle">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
