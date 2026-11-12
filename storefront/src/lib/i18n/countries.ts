/** أسماء الدول بالعربية (Medusa يرجعها بالإنجليزية). */
const AR_COUNTRIES: Record<string, string> = {
  ye: "اليمن", sa: "السعودية", ae: "الإمارات", om: "عُمان", kw: "الكويت",
  qa: "قطر", bh: "البحرين", eg: "مصر", jo: "الأردن", iq: "العراق",
  us: "الولايات المتحدة", gb: "المملكة المتحدة", tr: "تركيا",
}

export function countryName(iso2?: string | null, fallback?: string | null) {
  return (iso2 && AR_COUNTRIES[iso2.toLowerCase()]) || fallback || iso2 || ""
}
