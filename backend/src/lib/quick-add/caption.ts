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
  // بداية تشويقية تسبق الاسم (من أساليب المنشور)
  hook?: string
}

// ---------- أساليب المنشور والبدايات التشويقية ----------
// كلها متوافقة مع سياسات ميتا: لا طلب إعجاب أو مشاركة أو منشن مقابل شيء، لا وعود مضللة ولا استعجال كاذب،
// لا مخاطبة لصفات شخصية للقارئ. {name} = اسم المنتج.
export const POST_STYLES: { key: string; label: string; hooks: string[] }[] = [
  { key: "offer", label: "🔥 عرض", hooks: ["🔥 عرض مميز على {name}", "💥 سعر خاص على {name} لدى لمسة فون", "🎯 فرصة جميلة تقتني {name}", "🔥 عرض هذا الأسبوع وصل"] },
  { key: "new", label: "✨ وصل حديثاً", hooks: ["✨ وصل حديثاً إلى لمسة فون", "🆕 جديدنا هذا الأسبوع: {name}", "📦 وصلت دفعة جديدة من {name}", "✨ أحدث ما وصلنا"] },
  { key: "best", label: "⭐ الأكثر طلباً", hooks: ["⭐ من الأكثر طلباً عند زبائننا", "🏆 خيار مفضّل عند زبائن لمسة فون", "⭐ ليش الكل يسأل عن {name}؟", "👌 جهاز يستاهل الاقتناء"] },
  { key: "power", label: "🚀 أداء ومواصفات", hooks: ["🚀 أداء قوي في جيبك", "📸 كاميرا تلتقط أدق التفاصيل", "⚡ سرعة وسلاسة في كل استخدام", "🔋 قوة وتحمّل ليومك"] },
  { key: "value", label: "💰 قيمة مقابل السعر", hooks: ["💰 قيمة ممتازة مقابل السعر", "💸 جودة عالية بسعر مناسب", "🤝 السعر المناسب للجهاز المناسب", "💰 جودة تثق فيها وسعر يرضيك"] },
  { key: "classic", label: "📱 احترافي هادئ", hooks: ["لمسة فون تقدّم لك: {name}", "متوفر الآن لدى لمسة فون", "📱 اختيارك الذكي", "أصلي ومفحوص من لمسة فون"] },
]

const fillName = (h: string, name: string) => h.replace(/\{name\}/g, name.trim())

// الأسلوب المناسب تلقائياً: من شارة المنتج أولاً، ثم وجود مواصفات جوال
export function autoStyle(badge?: string | null, specs?: Record<string, unknown> | null): string {
  const b = (badge || "").trim()
  if (/عرض|خصم|تخفيض|sale/i.test(b)) return "offer"
  if (/جديد|وصل|new/i.test(b)) return "new"
  if (/الأكثر|مميز|best/i.test(b)) return "best"
  const s = specs || {}
  if (["screen", "cpu", "camera"].filter((k) => typeof (s as any)[k] === "string" && (s as any)[k].trim()).length >= 2) return "power"
  return "classic"
}

export function hooksFor(style: string, name: string): string[] {
  const st = POST_STYLES.find((x) => x.key === style) || POST_STYLES[POST_STYLES.length - 1]
  return st.hooks.map((h) => fillName(h, name))
}

// بداية ثابتة لكل منتج (تختلف من منتج لآخر فلا تتكرر نفس البداية في الصفحة)
export function pickHook(style: string, name: string, seed: string): string {
  const list = hooksFor(style, name)
  let n = 0
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) >>> 0
  return list[n % list.length]
}

// تنبيهات سياسات ميتا: عبارات «طُعم التفاعل» والوعود المضللة التي تقلل الوصول أو تُرفض
const POLICY_RULES: [RegExp, string][] = [
  [/(اعمل|سوي|سوّ|اضغط)\s*(لايك|إعجاب|اعجاب)|like\s*(and|&)?\s*share/i, "طلب الإعجاب يُعد «طُعم تفاعل» عند ميتا ويقلل الوصول"],
  [/(شارك|انشر)\s*(المنشور|البوست)|share\s*this/i, "طلب مشاركة المنشور يُعد «طُعم تفاعل» عند ميتا"],
  [/(منشن|تاق|تاغ|اذكر)\s*(صديق|صاحب|اصحاب|أصحاب|\d)|tag\s*a\s*friend/i, "طلب منشن الأصدقاء ممنوع في سياسات ميتا"],
  [/(علّق|علق|اكتب)\s*(تم|نعم|أنا|انا|رقم|"|«)/i, "طلب تعليق كلمة محددة يُعد «طُعم تفاعل» عند ميتا"],
  [/(اربح|ربح|هدية|جائزة).{0,20}(لايك|شارك|منشن|تعليق|متابعة)/i, "المسابقات يجب ألا تشترط الإعجاب أو المشاركة على الحساب الشخصي، وتحتاج شروطاً واضحة"],
  [/(مضمون|ضمان)\s*100|أرخص\s*سعر\s*في\s*(العالم|اليمن)|الأرخص\s*على\s*الإطلاق/i, "تجنّب الادعاءات المطلقة غير المثبتة (مثل: الأرخص في العالم)"],
  [/(آخر|اخر)\s*(فرصة|قطعة|ساعة)|ينتهي\s*(اليوم|الليلة)|خلال\s*\d+\s*(ساعة|دقيقة)/i, "الاستعجال يجب أن يكون صحيحاً فعلاً، وإلا يُعد مضللاً"],
]
export function policyWarnings(text: string): string[] {
  const t = text || ""
  const out = POLICY_RULES.filter(([re]) => re.test(t)).map(([, w]) => w)
  const tags = (t.match(/#[\p{L}\p{N}_]+/gu) || []).length
  if (tags > 30) out.push("إنستغرام يقبل 30 هاشتاقاً كحد أقصى")
  return out
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
  const hook = (input.hook || "").trim()
  if (hook) lines.push(hook, "")
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

// نص Threads: 500 حرف كحد أقصى، والروابط تبقى كاملة دائماً (يُقصّ الوصف فقط)
export function buildThreadsText(input: CaptionInput, maxLen = 500): string {
  const head = [...((input.hook || "").trim() ? [(input.hook || "").trim().slice(0, 80), ""] : []), `📱 ${input.title.trim()}`]
  const price = formatPrice(input.price ?? 0, input.currency)
  if (price) head.push(`💰 السعر: ${price}`)
  const tail = [`🛒 ${input.link}`]
  if (input.waLink) tail.push(`💬 واتساب: ${input.waLink}`)
  const fixed = head.join("\n").length + tail.join("\n").length + 4
  let text = (input.text || "").trim()
  const room = maxLen - fixed
  if (text.length > room) text = room > 20 ? `${text.slice(0, room - 1).trim()}…` : ""
  return [head.join("\n"), text, tail.join("\n")].filter(Boolean).join("\n\n").slice(0, maxLen)
}

// ---------- نص المنشور الجاهز من بيانات المنتج ----------
// يُكتب تلقائياً لكل منتج من مواصفاته وشارته وقسمه، فلا يحتاج المدير أن يكتب شيئاً (ويستطيع تعديله قبل النشر).
const SPEC_LABELS: Record<string, string> = {
  screen: "الشاشة",
  cpu: "المعالج",
  memory: "الذاكرة",
  camera: "الكاميرا",
  front_camera: "الأمامية",
  battery: "البطارية",
  os: "النظام",
  build: "التصميم",
  connectivity: "المميزات",
  type: "النوع",
  chip: "الشريحة",
  features: "المميزات",
  resistance: "التحمل",
}
// ترتيب الأهمية: الجوالات أولاً ثم السماعات والساعات والإكسسوارات
const PHONE_ORDER = ["screen", "cpu", "memory", "camera", "battery", "front_camera", "os"]
const ACCESSORY_ORDER = ["type", "chip", "features", "battery", "connectivity", "resistance"]

// قيمة مختصرة للمنشور: أول جزء مفيد بلا تفاصيل طويلة
const brief = (v: string, max = 70) => {
  const s = v.replace(/\s+/g, " ").trim()
  if (s.length <= max) return s
  const cut = s.split(/[،,؛;(]/)[0].trim()
  return cut.length >= 8 && cut.length <= max ? cut : `${s.slice(0, max - 1).trim()}…`
}

// الحالة (جديد/مستخدم) لا تُذكر في المنشور: سياسة المتجر أن تُذكر فقط إذا سأل العميل
// منتج بلا مواصفات: نستخدم السعة (metadata.storage) وأول سطرين من وصف المنتج
export type AutoTextInput = { specs?: Record<string, unknown> | null; badge?: string | null; categoryNames?: string[]; storage?: string | null; description?: string | null }

export function autoPostText(input: AutoTextInput): string {
  const specs = (input.specs || {}) as Record<string, unknown>
  const has = (k: string) => typeof specs[k] === "string" && (specs[k] as string).trim() !== ""
  const order = PHONE_ORDER.filter(has).length >= 2 ? PHONE_ORDER : ACCESSORY_ORDER
  const lines: string[] = []
  const badge = (input.badge || "").trim()
  if (badge) lines.push(`🔥 ${badge}`)
  const specLines = order.filter(has).slice(0, 6).map((k) => `▫️ ${SPEC_LABELS[k]}: ${brief(specs[k] as string)}`)
  const storage = (input.storage || "").trim()
  if (storage && !has("memory")) specLines.unshift(`▫️ السعة: ${storage}`)
  if (specLines.length) {
    if (lines.length) lines.push("")
    lines.push("المواصفات:", ...specLines)
  } else {
    const desc = (input.description || "").split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 2).join("\n")
    if (desc) {
      if (lines.length) lines.push("")
      lines.push(desc.length > 300 ? `${desc.slice(0, 299).trim()}…` : desc)
    }
  }
  const cat = (input.categoryNames || []).find((c) => c && c.trim())
  if (cat) lines.push("", `📂 القسم: ${cat.trim()}`)
  return lines.join("\n").trim()
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
