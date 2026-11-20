// إزالة عبارة "الدفع عند الاستلام" (طلب صاحب المتجر) من النصوص المحفوظة، مع تنظيف الفواصل حولها.
const PHRASE = /\s*(?:[،,·\-]\s*)?(?:و\s*)?الدفع\s+عند\s+الاستلام\s*[.،,:]?/g

export function stripCod(text: string): string {
  if (!text || !text.includes("الدفع")) return text
  return text
    .replace(PHRASE, (m) => (/[.]\s*$/.test(m) ? "." : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.،,])/g, "$1")
    .replace(/([.،,])\1+/g, "$1")
    .replace(/[،,]\s*\./g, ".")
    .replace(/:\s*\./g, ".")
    .trim()
}
