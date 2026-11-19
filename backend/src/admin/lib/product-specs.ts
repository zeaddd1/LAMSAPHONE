// خانة المواصفات الوحيدة للمنتج: metadata.specs (نفس خانة "مواصفات سريعة" السابقة بعد توسيعها).
// الأربعة الأولى هي المفاتيح القديمة كما هي، فلا يتأثر أي منتج سابق.
export const SPEC_FIELDS = [
  { key: "screen", label: "الشاشة" },
  { key: "cpu", label: "المعالج" },
  { key: "camera", label: "الكاميرا الخلفية" },
  { key: "battery", label: "البطارية والشحن" },
  { key: "memory", label: "الذاكرة والتخزين" },
  { key: "front_camera", label: "الكاميرا الأمامية" },
  { key: "os", label: "نظام التشغيل" },
  { key: "build", label: "التصميم والخامات" },
  { key: "dimensions", label: "الأبعاد والوزن" },
  { key: "connectivity", label: "الاتصال والمميزات" },
  { key: "release", label: "تاريخ الإطلاق" },
] as const

export type Specs = Record<string, string>

/** يحذف الحقول الفارغة والمفاتيح غير المعروفة */
export function cleanSpecs(s: Specs | null | undefined): Specs {
  const out: Specs = {}
  for (const f of SPEC_FIELDS) {
    const v = String((s || {})[f.key] || "").trim()
    if (v) out[f.key] = v
  }
  return out
}
