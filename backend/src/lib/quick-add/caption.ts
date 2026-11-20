// نص منشورات ميتا لصفحة "الإضافة السريعة".
// ملف مستقل بلا أي استيراد، يُستخدم في الخادم ويُختبر مباشرة.
// الهاشتاقات والكلمات المفتاحية هنا للمنشور فقط، ولا تُحفظ في المنتج ولا تظهر في المتجر.

export const STORE_URL_DEFAULT = "https://lamsaphone.yemenbay.com"
export const STORE_COUNTRY = "ye"

// رابط المنتج في المتجر (الـ handle قد يكون عربياً فيُرمَّز)
export function productUrl(handle: string, storeUrl = STORE_URL_DEFAULT, country = STORE_COUNTRY): string {
  return `${storeUrl.replace(/\/$/, "")}/${country}/products/${encodeURIComponent(handle)}`
}

// يحوّل أي نص (مفصول بمسافات أو فواصل أو أسطر، بعلامة # أو بدونها) إلى هاشتاقات نظيفة بلا تكرار
export function normalizeHashtags(input: string | string[] | undefined | null, max = 30): string[] {
  const raw = Array.isArray(input) ? input.join(" ") : input || ""
  const out: string[] = []
  const seen = new Set<string>()
  for (const part of raw.split(/[\s,،؛;]+/)) {
    // نبقي الحروف (أي لغة) والأرقام و _ فقط
    const word = part.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")
    if (!word || /^\d+$/.test(word)) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(`#${word}`)
    if (out.length >= max) break
  }
  return out
}

// الهاشتاقات والكلمات الرائجة تُنشر كأول تعليق على المنشور، فتساعد في الوصول ولا تظهر في نص المنشور ولا في المنتج
export function hashtagComment(input: string | string[] | undefined | null, maxLen = 2200): string {
  let out = ""
  for (const t of normalizeHashtags(input, 30)) {
    const next = out ? `${out} ${t}` : t
    if (next.length > maxLen) break
    out = next
  }
  return out
}

export function formatPrice(amount: number, currency = "usd"): string {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return ""
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2)
  return currency.toLowerCase() === "usd" ? `${s}$` : `${s} ${currency.toUpperCase()}`
}

export type CaptionInput = {
  title: string
  price?: number
  currency?: string
  text?: string // وصف المنشور الذي يكتبه المدير (اختياري)
  hashtags?: string | string[]
  link: string
  whatsapp?: string // رقم واتساب بصيغة دولية بدون +
  waLink?: string // رابط واتساب قصير باسم المتجر (يفتح محادثة برسالة جاهزة عن المنتج)
  // إنستغرام لا يجعل الروابط قابلة للضغط داخل المنشور: نكتب «الرابط في البايو» بدلها
  network?: "facebook" | "instagram"
}

// رمز قصير للمنتج من آخر 6 أحرف في رقمه: يُستخدم في الروابط القصيرة /p/xxxxxx و /wa/xxxxxx
export function shortCode(productId: string): string {
  return productId.slice(-6).toLowerCase()
}

// روابط قصيرة أنيقة باسم المتجر بدل الروابط الطويلة (بلا https:// حتى يبقى المنشور نظيفاً)
export function shortLinks(productId: string, storeUrl = STORE_URL_DEFAULT): { shop: string; wa: string } {
  const host = storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const code = shortCode(productId)
  return { shop: `${host}/p/${code}`, wa: `${host}/wa/${code}` }
}

// رابط واتساب برسالة طلب جاهزة
export function whatsappOrderUrl(number: string, title: string, link: string): string {
  const n = number.replace(/[^\d]/g, "")
  return `https://wa.me/${n}?text=${encodeURIComponent(`مرحباً لمسة فون، أريد طلب: ${title}
${link}`)}`
}

// نص المنشور: الاسم، السعر، الوصف، ثم "تسوق من متجرنا" مع الرابط، ثم الهاشتاقات
export function buildCaption(input: CaptionInput, maxLen = 2200): string {
  const lines: string[] = []
  lines.push(`📱 ${input.title.trim()}`)
  const price = formatPrice(input.price ?? 0, input.currency)
  if (price) lines.push(`💰 السعر: ${price}`)
  const text = (input.text || "").trim()
  if (text) lines.push("", text)
  lines.push("")
  if (input.network === "instagram") {
    // لا روابط في إنستغرام لأنها لا تُضغط داخل المنشور
    lines.push("🛒 للطلب: اضغط الرابط في البايو 👆 أو راسلنا على الخاص")
  } else if (input.waLink) {
    lines.push(`🛒 تسوّق من متجرنا 👈 ${input.link}`)
    lines.push(`💬 اطلب عبر واتساب 👈 ${input.waLink}`)
  } else {
    lines.push(`🛒 تسوّق من متجرنا 👈 ${input.link}`)
    if (input.whatsapp && input.whatsapp.replace(/[^\d]/g, "").length >= 8) {
      lines.push(`💬 اطلب عبر واتساب 👈 wa.me/${input.whatsapp.replace(/[^\d]/g, "")}`)
    }
  }
  lines.push("📍 صنعاء - شارع القصر | 🚚 توصيل للمحافظات | ✅ ضمان فحص")

  // إنستغرام: 30 هاشتاق كحد أقصى و2200 حرف للنص كاملاً
  const tags = normalizeHashtags(input.hashtags, 30)
  let caption = lines.join("\n")
  if (tags.length) {
    let tagLine = ""
    for (const t of tags) {
      const next = tagLine ? `${tagLine} ${t}` : t
      if (caption.length + 2 + next.length > maxLen) break
      tagLine = next
    }
    if (tagLine) caption += `\n\n${tagLine}`
  }
  // لا نقص الرابط أبداً: نقص الوصف إن لزم
  if (caption.length > maxLen && text) {
    const over = caption.length - maxLen
    return buildCaption({ ...input, text: text.slice(0, Math.max(0, text.length - over - 1)) + "…" }, maxLen)
  }
  return caption
}

// اقتراحات هاشتاقات لسوق الجوالات: صنعاء أولاً ثم اليمن، حسب القسم، تُكمَّل بكلمات من اسم المنتج.
// ميتا لا تقدّم قائمة "ترند" رسمية، فهذه نقطة بداية يعدّلها المدير.
const BASE_TAGS = ["لمسة_فون", "صنعاء", "جوالات_صنعاء", "اليمن", "جوالات_اليمن", "جوالات", "عروض"]
const CATEGORY_TAGS: Record<string, string[]> = {
  "جوالات": ["جوالات_جديدة", "هواتف_ذكية", "smartphone", "جوال"],
  "سامسونج": ["سامسونج", "Samsung", "جالكسي", "Galaxy"],
  "آيفون": ["ايفون", "iPhone", "ابل", "Apple"],
  "شاومي": ["شاومي", "Xiaomi", "ريدمي", "Redmi"],
  "هواوي": ["هواوي", "Huawei"],
  "أونر": ["هونر", "Honor"],
  "إكسسوارات": ["اكسسوارات_جوال", "اكسسوارات"],
  "سماعات": ["سماعات", "سماعات_بلوتوث", "earbuds"],
  "شواحن": ["شواحن", "شاحن_سريع", "charger"],
  "شواحن وكابلات": ["شواحن", "كيبل", "شاحن_سريع"],
  "باور بانك": ["باور_بانك", "powerbank"],
  "كفرات": ["كفرات", "جرابات", "كفر_جوال"],
  "حماية الشاشة": ["حماية_الشاشة", "اسكرينه", "لزقة_شاشة"],
  "أجهزة لوحية": ["تابلت", "ايباد", "tablet"],
}

export function suggestHashtags(title: string, categoryNames: string[] = []): string[] {
  const fromCats = categoryNames.flatMap((c) => CATEGORY_TAGS[c.trim()] || [])
  // كلمات الاسم اللاتينية/العربية الطويلة (مثل S25، Ultra) تصبح هاشتاقات، ودمج الاسم كاملاً بلا مسافات
  const words = title.split(/\s+/).filter((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length >= 3)
  const joined = title.replace(/[^\p{L}\p{N}]+/gu, "")
  const all = [...(joined.length >= 4 && joined.length <= 30 ? [joined] : []), ...words, ...fromCats, ...BASE_TAGS]
  return normalizeHashtags(all, 20)
}
