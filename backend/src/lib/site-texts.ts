import { Modules } from "@medusajs/framework/utils"

// نصوص واجهة المتجر القابلة للتعديل من صفحة "نصوص المتجر" في لوحة التحكم.
// تُحفظ التعديلات فقط في store.metadata.site_texts؛ الخانة الفارغة = النص الافتراضي أدناه.
// نسخة من النصوص الافتراضية موجودة أيضاً في storefront/src/lib/data/site-texts.ts (احتياط إن تعذّر الوصول للباك إند): عدّلهما معاً.

export type SiteTextField = { key: string; group: string; label: string; default: string; multiline?: boolean }

export const SITE_TEXT_FIELDS: SiteTextField[] = [
  { key: "hero_badge", group: "الصفحة الرئيسية", label: "الشارة الصغيرة", default: "لمسة فون" },
  { key: "hero_title", group: "الصفحة الرئيسية", label: "العنوان الكبير", default: "عروض الأسبوع" },
  { key: "hero_text", group: "الصفحة الرئيسية", label: "النص تحت العنوان", default: "أفضل الأسعار على الجوالات والسماعات والإكسسوارات الأصلية. التوصيل داخل المدينة أو الاستلام من المحل.", multiline: true },
  { key: "hero_cta", group: "الصفحة الرئيسية", label: "الزر البرتقالي", default: "تسوّق الآن" },
  { key: "hero_cta2", group: "الصفحة الرئيسية", label: "الزر الثاني", default: "الجوالات" },

  { key: "contact_title", group: "صفحة تواصل معنا", label: "عنوان الصفحة", default: "تواصل معنا" },
  { key: "contact_intro", group: "صفحة تواصل معنا", label: "النص الأول", default: "يسعدنا تواصلك معنا لأي استفسار عن المنتجات أو الطلبات.", multiline: true },
  { key: "contact_note", group: "صفحة تواصل معنا", label: "النص الأخير (التوصيل)", default: "🚚 نوصل داخل صنعاء وإلى المحافظات.", multiline: true },

  { key: "about_title", group: "صفحة من نحن", label: "عنوان الصفحة", default: "من نحن" },
  { key: "about_text", group: "صفحة من نحن", label: "نص الصفحة (كل سطر فقرة)", default: "لمسة فون للهواتف الذكية متجر متخصص في جوالات سامسونج وارد أمريكا بنظافة وكالة وفحص شامل، مع إكسسوارات أصلية.\nكل جهاز يُفحص قبل التسليم، وتفحصه بنفسك. نوفر التوصيل داخل صنعاء وإلى المحافظات.", multiline: true },

  { key: "returns_title", group: "صفحة سياسة الاسترجاع", label: "عنوان الصفحة", default: "سياسة الاسترجاع والاستبدال" },
  { key: "returns_text", group: "صفحة سياسة الاسترجاع", label: "نص الصفحة (كل سطر فقرة)", default: "يمكن استبدال أو استرجاع المنتج خلال 3 أيام من الاستلام إذا كان بحالته الأصلية ومع كامل ملحقاته وعلبته.\nالأجهزة المستعملة والمجدّدة تُفحص أمامك عند الاستلام، ويُذكر ضمانها في صفحة المنتج.\nلا يشمل الاسترجاع الأضرار الناتجة عن سوء الاستخدام.\nللطلب تواصل معنا عبر واتساب مع رقم الطلب.", multiline: true },

  { key: "links_tagline", group: "صفحة الروابط (رابط إنستغرام)", label: "النص تحت الشعار", default: "جوالات وإكسسوارات أصلية في صنعاء · توصيل سريع" },

  { key: "footer_title", group: "أسفل الصفحة (الفوتر)", label: "عنوان قائمة الروابط", default: "لمسة فون" },
  { key: "footer_about", group: "أسفل الصفحة (الفوتر)", label: "رابط من نحن", default: "من نحن" },
  { key: "footer_contact", group: "أسفل الصفحة (الفوتر)", label: "رابط تواصل معنا", default: "تواصل معنا" },
  { key: "footer_returns", group: "أسفل الصفحة (الفوتر)", label: "رابط سياسة الاسترجاع", default: "سياسة الاسترجاع" },
  { key: "footer_faq", group: "أسفل الصفحة (الفوتر)", label: "رابط الأسئلة الشائعة", default: "الأسئلة الشائعة" },
  { key: "footer_privacy", group: "أسفل الصفحة (الفوتر)", label: "رابط سياسة الخصوصية", default: "سياسة الخصوصية" },
  { key: "footer_track", group: "أسفل الصفحة (الفوتر)", label: "رابط تتبع الطلب", default: "تتبع الطلب" },
  { key: "footer_copyright", group: "أسفل الصفحة (الفوتر)", label: "سطر الحقوق (بعد السنة)", default: "لمسة فون للهواتف الذكية. جميع الحقوق محفوظة." },
]

const KEYS = new Set(SITE_TEXT_FIELDS.map((f) => f.key))
const MAX = 2000

/** يقبل فقط المفاتيح المعروفة، نصوصاً عادية بطول معقول. الفارغ يُحذف فيعود الافتراضي. */
export function cleanSiteTexts(input: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!input || typeof input !== "object") return out
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!KEYS.has(k) || typeof v !== "string") continue
    const s = v.replace(/\r\n/g, "\n").trim().slice(0, MAX)
    if (s) out[k] = s
  }
  return out
}

/** النصوص النهائية للواجهة: التعديل إن وُجد، وإلا الافتراضي */
export function mergeSiteTexts(overrides: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of SITE_TEXT_FIELDS) out[f.key] = overrides[f.key] || f.default
  return out
}

type Scope = { resolve: (key: string) => any }

export async function getSiteTextOverrides(scope: Scope): Promise<Record<string, string>> {
  const [store] = await scope.resolve(Modules.STORE).listStores({}, { take: 1, select: ["id", "metadata"] })
  return cleanSiteTexts((store?.metadata as any)?.site_texts)
}

export async function saveSiteTextOverrides(scope: Scope, input: unknown): Promise<Record<string, string>> {
  const storeService = scope.resolve(Modules.STORE)
  const [store] = await storeService.listStores({}, { take: 1, select: ["id", "metadata"] })
  if (!store) throw new Error("no store")
  const next = cleanSiteTexts(input)
  await storeService.updateStores(store.id, { metadata: { ...(store.metadata || {}), site_texts: next } })
  return next
}
