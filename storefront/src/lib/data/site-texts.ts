import "server-only"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

// احتياط فقط إن تعذّر الوصول للباك إند. المصدر الأصلي: backend/src/lib/site-texts.ts (عدّلهما معاً)
const DEFAULTS = {
  hero_badge: "لمسة فون",
  hero_title: "عروض الأسبوع",
  hero_text: "أفضل الأسعار على الجوالات والسماعات والإكسسوارات الأصلية. التوصيل داخل المدينة أو الاستلام من المحل.",
  hero_cta: "تسوّق الآن",
  hero_cta2: "الجوالات",
  contact_title: "تواصل معنا",
  contact_intro: "يسعدنا تواصلك معنا لأي استفسار عن المنتجات أو الطلبات.",
  contact_note: "🚚 نوصل داخل صنعاء وإلى المحافظات.",
  about_title: "من نحن",
  about_text: "لمسة فون للهواتف الذكية متجر متخصص في جوالات سامسونج وارد أمريكا بنظافة وكالة وفحص شامل، مع إكسسوارات أصلية.\nكل جهاز يُفحص قبل التسليم، وتفحصه بنفسك. نوفر التوصيل داخل صنعاء وإلى المحافظات.",
  returns_title: "سياسة الاسترجاع والاستبدال",
  returns_text: "يمكن استبدال أو استرجاع المنتج خلال 3 أيام من الاستلام إذا كان بحالته الأصلية ومع كامل ملحقاته وعلبته.\nالأجهزة المستعملة والمجدّدة تُفحص أمامك عند الاستلام، ويُذكر ضمانها في صفحة المنتج.\nلا يشمل الاسترجاع الأضرار الناتجة عن سوء الاستخدام.\nللطلب تواصل معنا عبر واتساب مع رقم الطلب.",
  links_tagline: "جوالات وإكسسوارات أصلية في صنعاء · توصيل سريع",
  footer_title: "لمسة فون",
  footer_about: "من نحن",
  footer_contact: "تواصل معنا",
  footer_returns: "سياسة الاسترجاع",
  footer_faq: "الأسئلة الشائعة",
  footer_privacy: "سياسة الخصوصية",
  footer_track: "تتبع الطلب",
  footer_copyright: "لمسة فون للهواتف الذكية. جميع الحقوق محفوظة.",
}
export type SiteTexts = typeof DEFAULTS

/** نصوص الواجهة من صفحة "نصوص المتجر" في لوحة التحكم، كاش دقيقة */
export async function getSiteTexts(): Promise<SiteTexts> {
  try {
    const res = await fetch(`${BACKEND}/store/site-texts`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 60, tags: ["site-texts"] },
    })
    if (!res.ok) return DEFAULTS
    const j = await res.json()
    const out = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS) as (keyof SiteTexts)[]) {
      if (typeof j?.texts?.[k] === "string" && j.texts[k].trim()) out[k] = j.texts[k]
    }
    return out
  } catch {
    return DEFAULTS
  }
}

/** نص متعدد الأسطر ← فقرات */
export const paragraphs = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean)
