// "عقل" الرد الآلي للمسة فون: يفهم الفصحى واللهجة اليمنية والأخطاء الإملائية الشائعة،
// ويجيب من الأسئلة الشائعة وقائمة المنتجات، ويحوّل للموظف عند الحاجة.
// بلا ذكاء اصطناعي خارجي: خفيف جداً على السيرفر وبلا تكلفة. يستورد فقط معجم اللهجات (ملف بيانات).
import { LEX_PHRASES, LEX_SYNONYMS } from "./lexicon"

export type Faq = { id: string; question: string; answer: string; keywords?: string | null }
export type Product = { title: string; handle: string; price?: number | null; category?: string | null }
export type Intent = "greeting" | "thanks" | "handoff" | "order" | "faq" | "product" | "price_list" | "fallback"
export type BotReply = {
  intent: Intent
  text: string
  handoff: boolean // يحتاج موظفاً
  order: boolean // نية طلب: الموظف يؤكد
  faq_id?: string
  products?: Product[]
  confidence: number
}
export type BotContext = {
  storeUrl: string
  whatsapp?: string
  products: Product[]
  faqs: Faq[]
  productUrl?: (handle: string) => string
}

// ---------- 1) توحيد النص ----------
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"
export function normalize(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[ً-ٰٟـ]/g, "") // تشكيل وتطويل
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة(?=\s|$)/g, "ه")
    .replace(/(.)\1{2,}/g, "$1") // تكرار الحروف: سلاااام → سلام
    .replace(/([a-z])(\d)/g, "$1 $2") // s25 → s 25 (يسهل المطابقة)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// كلمات لا معنى لها في المطابقة
const STOP = new Set(
  "في من على الى عن هل يا لو ما ماذا مع او و ثم هذا هذه ذا ذي اللي الي التي الذي انا انت احنا نحن عندكم عندك لكم لك لي فيه فيها هو هي كان يكون اذا ايش وش شو ليش كيف عشان علشان بس طيب اوكي ok please pls the a an is of for".split(" ")
)

// ---------- 2) اللهجات والمرادفات ← مفهوم موحّد ----------
// المفتاح: كلمة كما يكتبها العميل (بعد التوحيد)، القيمة: المفهوم
const CONCEPTS: Record<string, string> = {}
const add = (concept: string, words: string) => words.split(/\s+/).forEach((w) => (CONCEPTS[normalize(w)] = concept))
add("price", "سعر السعر سعره سعرها بكم بكام كم قيمه قيمته حقه حقها يطلع يطلعلي تكلفه ثمن price cost")
add("available", "متوفر متوفره موجود موجوده توفر يتوفر متاح متاحه فيه بقي باقي available stock")
add("delivery", "توصيل التوصيل توصلون توصلوا يوصل توصل شحن الشحن مندوب delivery shipping")
add("payment", "دفع الدفع ادفع الحساب حساب كاش تحويل استلام الاستلام payment cash")
add("warranty", "ضمان الضمان مضمون كفاله warranty guarantee")
add("return", "استرجاع ارجاع ارجع ترجيع استبدال ابدل تبديل return refund exchange")
add("location", "وين فين اين مكانكم مكان عنوانكم العنوان عنوان موقعكم محل المحل location address")
add("hours", "دوام الدوام دوامكم تفتحون تفتحوا تقفلون تشتغلون مفتوحين مفتوح ساعات hours open")
add("order", "اطلب طلب ابغى ابغي ابي ابا اشتي اشتيه اشتيها اريد اريده اريدها ودي احجز اشتري اخذ ناخذ order buy want")
add("used", "مستعمل مستخدم نظيف كسر used")
add("new", "جديد جديده مختوم كرتونه new sealed")
add("installment", "تقسيط اقساط قسط installment")
add("human", "موظف الموظف شخص انسان مسؤول المسؤول الاداره خدمه العملاء كلمني اتصل اتصلوا agent human")
add("complaint", "مشكله مشاكل شكوى اشتكي خربان خربت خراب عطل عطلان تالف متاخر تاخر تاخير زعلان غلط خطا مغشوش ماوصل")
add("greeting", "السلام سلام مرحبا مرحبتين هلا اهلا صباح مساء hi hello hey")
add("thanks", "شكرا مشكور مشكورين يعطيك تسلم تسلمون الله يعافيك thanks thank")
add("list", "قائمه الاسعار عروض العروض المنتجات الجوالات الموجود منتجاتكم list offers")

// أسماء الماركات بالعربي ← الإنجليزي (لمطابقة أسماء المنتجات)
const BRANDS: Record<string, string> = {}
const brand = (en: string, ar: string) => ar.split(/\s+/).forEach((w) => (BRANDS[normalize(w)] = en))
brand("samsung", "سامسونج سامسونق سامسنج سامسونغ جالكسي جلاكسي galaxy")
brand("iphone", "ايفون آيفون ايفوون ابل ايبل")
brand("xiaomi", "شاومي شاومى ريدمي redmi")
brand("redmi", "ريدمي")
brand("huawei", "هواوي هواوى")
brand("honor", "هونر اونر")
brand("ultra", "الترا اولترا الترى")
brand("pro", "برو")
brand("max", "ماكس")
brand("plus", "بلس")
brand("note", "نوت نوتس")
brand("airpods", "ايربودز ايربود")

// ---------- 3) تصحيح الأخطاء الإملائية بالمسافة ----------
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  if (!m || !n) return m || n
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}
// يصحح كلمة إلى أقرب كلمة معروفة (خطأ حرف واحد للكلمات القصيرة، حرفين للطويلة)
function closest(word: string, vocab: Iterable<string>): string | null {
  if (word.length < 3) return null
  const max = word.length >= 7 ? 2 : 1
  let best: string | null = null
  let bestD = max + 1
  for (const v of vocab) {
    if (Math.abs(v.length - word.length) > max) continue
    const d = editDistance(word, v)
    if (d < bestD) {
      bestD = d
      best = v
    }
  }
  return bestD <= max ? best : null
}

// تجريد بادئات/لواحق عربية شائعة: الـ، و، ب، ل، ف + ه ها كم
function stems(w: string): string[] {
  const out = new Set([w])
  let s = w
  if (/^(و|ف|ب|ل|ك)ال/.test(s)) s = s.slice(1)
  if (s.startsWith("ال") && s.length > 4) out.add(s.slice(2))
  if (/^(و|ف|ب|ل)/.test(w) && w.length > 4) out.add(w.slice(1))
  for (const suf of ["ها", "هم", "كم", "ه", "ات", "ين"]) if (s.endsWith(suf) && s.length - suf.length >= 3) out.add(s.slice(0, -suf.length))
  out.add(s)
  return [...out]
}

// ---------- 3-ب) معجم اللهجات (مستخرج من معجم YBHub، يُحمَّل مرة واحدة عند التشغيل) ----------
// كلمة لهجة ← كلمة فصحى، ثم عبارات كل مفهوم بعد توحيدها. الكلمة المفردة تُضاف للمفاهيم دون استبدال ما عندنا.
const SYN = new Map<string, string>()
for (const [v, c] of Object.entries(LEX_SYNONYMS)) {
  const nv = normalize(v)
  const nc = normalize(c)
  if (nv && nc && nv !== nc && !nv.includes(" ")) SYN.set(nv, nc)
}
const canon = (w: string) => SYN.get(w) || w
const PHRASES: { concept: string; seq: string }[] = []
for (const [concept, list] of Object.entries(LEX_PHRASES)) {
  for (const ph of list) {
    const toks = normalize(ph).split(" ").filter(Boolean).map(canon)
    if (!toks.length) continue
    if (toks.length === 1) {
      if (!CONCEPTS[toks[0]] && !STOP.has(toks[0]) && toks[0].length >= 3) CONCEPTS[toks[0]] = concept
    } else PHRASES.push({ concept, seq: ` ${toks.join(" ")} ` })
  }
}
const BASE_VOCAB = [...new Set([...Object.keys(CONCEPTS), ...Object.keys(BRANDS), ...SYN.keys()])]

export type Analysis = { tokens: string[]; concepts: Set<string>; corrected: string[] }

export function analyze(text: string, extraVocab: string[] = [], fuzzy = true): Analysis {
  const raw = normalize(text).split(" ").filter(Boolean)
  const concepts = new Set<string>()
  const tokens: string[] = []
  const corrected: string[] = []
  const vocab = extraVocab.length ? new Set([...BASE_VOCAB, ...extraVocab]) : BASE_VOCAB
  // عبارات المعجم متعددة الكلمات (مثل: "متى تفتحوا" ، "كم حق") على النص بعد تحويل اللهجة
  const canonText = ` ${raw.map(canon).join(" ")} `
  for (const p of PHRASES) if (canonText.includes(p.seq)) concepts.add(p.concept)
  for (const w0 of raw) {
    let hit = false
    const w = canon(w0)
    for (const s of new Set([...stems(w0), ...stems(w)])) {
      if (CONCEPTS[s]) {
        concepts.add(CONCEPTS[s])
        hit = true
      }
      if (BRANDS[s]) {
        tokens.push(BRANDS[s])
        hit = true
      }
    }
    if (fuzzy && !hit && !/^\d+$/.test(w) && !STOP.has(w)) {
      const c0 = closest(w, vocab)
      const c = c0 ? canon(c0) : null
      if (c) {
        corrected.push(`${w0}→${c0}`)
        if (CONCEPTS[c]) concepts.add(CONCEPTS[c])
        if (BRANDS[c]) tokens.push(BRANDS[c])
        if (!CONCEPTS[c] && !BRANDS[c]) tokens.push(c)
        hit = true
      }
    }
    if (!STOP.has(w)) tokens.push(w)
  }
  return { tokens: [...new Set(tokens)], concepts, corrected }
}

// ---------- 4) المطابقة ----------
const words = (s: string) => normalize(s).split(" ").filter((w) => w && !STOP.has(w))

export function productTokens(p: Product): string[] {
  const t = new Set<string>()
  for (const w of words(`${p.title} ${p.category || ""}`)) {
    t.add(w)
    if (BRANDS[w]) t.add(BRANDS[w])
  }
  return [...t]
}

export function matchProducts(a: Analysis, products: Product[], limit = 3): { product: Product; score: number }[] {
  const q = new Set(a.tokens)
  if (!q.size) return []
  const scored = products.map((p) => {
    const pt = productTokens(p)
    let score = 0
    for (const w of pt) {
      if (q.has(w)) score += /^\d+$/.test(w) ? 2 : w.length >= 3 ? 1.5 : 0.5
    }
    // الأرقام (مثل 25 أو 15) قوية جداً في أسماء الجوالات
    return { product: p, score: score / Math.max(2, Math.sqrt(pt.length)) }
  })
  return scored.filter((s) => s.score >= 0.6).sort((x, y) => y.score - x.score).slice(0, limit)
}

export function matchFaq(a: Analysis, faqs: Faq[]): { faq: Faq; score: number } | null {
  let best: { faq: Faq; score: number } | null = null
  for (const f of faqs) {
    const kw = words(`${f.question} ${f.keywords || ""}`)
    // نص السؤال نفسه يُحلَّل بلا تصحيح إملائي حتى لا تتغير كلماته
    const fa = analyze(`${f.question} ${f.keywords || ""}`, [], false)
    let score = 0
    for (const c of fa.concepts) if (a.concepts.has(c)) score += 2
    for (const w of kw) if (a.tokens.includes(w) && !CONCEPTS[w]) score += 1
    const norm = score / Math.max(2, Math.sqrt(fa.concepts.size * 2 + kw.length))
    if (!best || norm > best.score) best = { faq: f, score: norm }
  }
  return best && best.score >= 0.5 ? best : null
}

// ---------- 5) صياغة الرد ----------
const fmt = (n?: number | null) => (n && n > 0 ? `${Number.isInteger(n) ? n : n.toFixed(2)}$` : "")

// وعود المتجر الثابتة: تُذكر في آخر ردود البيع (صادقة ومختصرة)
const PROMISE = "✅ نظافة وكالة وفحص شامل · 🚚 توصيل صنعاء والمحافظات · 🔍 تفحص جهازك بنفسك"

export function reply(text: string, ctx: BotContext): BotReply {
  const url = ctx.productUrl || ((h: string) => `${ctx.storeUrl.replace(/\/$/, "")}/ye/products/${encodeURIComponent(h)}`)
  const wa = ctx.whatsapp ? `https://wa.me/${ctx.whatsapp.replace(/[^\d]/g, "")}` : ""
  const vocab = ctx.products.flatMap(productTokens).filter((w) => w.length >= 3 && !/^\d+$/.test(w))
  const a = analyze(text, vocab)
  const c = a.concepts
  const norm = normalize(text)
  const products = matchProducts(a, ctx.products)
  const line = (p: Product) => `📱 ${p.title}${fmt(p.price) ? `\n💰 ${fmt(p.price)}` : ""}\n🔗 ${url(p.handle)}`
  const orderCta = `🛒 للحجز اكتب «اطلب» مع اسم الجهاز${wa ? `، أو راسلنا واتساب: ${wa}` : ""}`

  if (c.has("human")) {
    return { intent: "handoff", handoff: true, order: false, confidence: 1, text: "أبشر 🌹 حوّلت محادثتك الآن لأحد موظفي لمسة فون، وسيرد عليك في أقرب وقت." }
  }
  // شكوى أو مشكلة: لا يرد الآلي بإجابة جاهزة، بل يحوّل للموظف مباشرة
  if (c.has("complaint")) {
    return { intent: "handoff", handoff: true, order: false, confidence: 1, text: "نعتذر منك عن أي إزعاج 🙏 رضاك يهمنا. حوّلت رسالتك لموظف لمسة فون ليتابعها معك شخصياً حالاً." }
  }
  // سؤال عن طلب سابق للعميل نفسه ("وين طلبي"، "متى توصل طلبيتي"): موظف يتابعه
  if (/(^| )(طلبي|طلبيتي|طلبنا|طلبيتنا|شحنتي|اوردري)( |$)/.test(norm) && !products.length) {
    return { intent: "handoff", handoff: true, order: false, confidence: 0.9, text: "حاضر 🌹 حوّلت استفسارك لموظف لمسة فون ليتابع طلبك ويطمئنك عليه حالاً." }
  }

  if (c.has("order") && products.length) {
    const p = products[0].product
    // اقتراح إكسسوار مناسب مع الجوال (بيع إضافي لطيف، مرة واحدة)
    const extra =
      Number(p.price) >= 100
        ? ctx.products.find((x) => x.handle !== p.handle && Number(x.price) > 0 && Number(x.price) <= 60 && /شاحن|كفر|حمايه|سماع|باور|كيبل|وصل/.test(normalize(`${x.title} ${x.category || ""}`)))
        : undefined
    return {
      intent: "order",
      handoff: true,
      order: true,
      products: [p],
      confidence: products[0].score,
      text:
        `اختيار ممتاز 👌\n${line(p)}\n\nلتأكيد الحجز أرسل لنا:\n1️⃣ الاسم\n2️⃣ العنوان بالتفصيل\n3️⃣ رقم الجوال\n\n${PROMISE}\nوسيؤكد موظفنا طلبك خلال دقائق.` +
        (extra ? `\n\n🎁 كثير من عملائنا يضيفون معه: ${extra.title}${fmt(extra.price) ? ` بـ ${fmt(extra.price)}` : ""}. اذكره لموظفنا إن رغبت.` : ""),
    }
  }

  // ميزانية: "ميزانيتي 300" / "جوال بحدود 250" ← أفضل الخيارات ضمن المبلغ
  const budget = /(ميزاني|حدود|بحدود|تحت|اقل من|ما يزيد|لا يزيد|معي|budget)/.test(norm) ? Number((norm.match(/(^| )(\d{2,4})( |$)/) || [])[2]) : NaN
  if (Number.isFinite(budget) && budget >= 20 && !products.length) {
    const priced = ctx.products.filter((x) => Number(x.price) > 0)
    const within = priced.filter((x) => Number(x.price) <= budget).sort((x, y) => Number(y.price) - Number(x.price)).slice(0, 3)
    const pick = within.length ? within : [...priced].sort((x, y) => Number(x.price) - Number(y.price)).slice(0, 2)
    if (pick.length) {
      return {
        intent: "product",
        handoff: false,
        order: false,
        products: pick,
        confidence: 0.7,
        text: `${within.length ? `أفضل اختياراتنا ضمن ${fmt(budget)} 👇` : `الأقرب لميزانيتك حالياً 👇`}\n\n${pick.map(line).join("\n\n")}\n\n${PROMISE}\n${orderCta}`,
      }
    }
  }

  // سؤال عن منتج معيّن (سعر / توفر / بدون كلمة)
  if (products.length && (c.has("price") || c.has("available") || !matchFaq(a, ctx.faqs))) {
    const top = products.filter((p) => p.score >= products[0].score * 0.7)
    const head = c.has("available") ? "نعم متوفر الآن ✅" : top.length > 1 ? "هذه الأقرب لطلبك 👇" : "تفضل 🌹"
    return {
      intent: "product",
      handoff: false,
      order: false,
      products: top.map((x) => x.product),
      confidence: products[0].score,
      text: `${head}\n\n${top.map((x) => line(x.product)).join("\n\n")}\n\n${PROMISE}\n${orderCta}`,
    }
  }

  const faq = matchFaq(a, ctx.faqs)
  if (faq) {
    // جواب السؤال ثم دعوة لطيفة للخطوة التالية
    return {
      intent: "faq",
      handoff: false,
      order: false,
      faq_id: faq.faq.id,
      confidence: faq.score,
      text: `${faq.faq.answer}\n\nتحب أساعدك تختار جهازك؟ اكتب اسمه أو ميزانيتك 📱`,
    }
  }

  if (c.has("price") || c.has("list")) {
    // نعرض أحدث ثلاثة منتجات بدل رابط فقط
    const picks = ctx.products.filter((x) => Number(x.price) > 0).slice(0, 3)
    return {
      intent: "price_list",
      handoff: false,
      order: false,
      products: picks,
      confidence: 0.6,
      text:
        (picks.length ? `من أحدث ما وصلنا 👇\n\n${picks.map(line).join("\n\n")}\n\n` : "") +
        `🛍️ كل المنتجات والأسعار محدّثة هنا: ${ctx.storeUrl}\nأو اكتب اسم الجهاز (مثل: سامسونج S24) وأرسل لك سعره فوراً.`,
    }
  }
  // متابعة طلب سابق ("وين طلبي"، "تأخر"): موظف يتابع
  if (c.has("followup")) {
    return { intent: "handoff", handoff: true, order: false, confidence: 0.8, text: "حاضر 🌹 حوّلت استفسارك لموظف لمسة فون ليتابع طلبك ويطمئنك عليه حالاً." }
  }
  if (c.has("thanks") && !c.has("greeting")) {
    return { intent: "thanks", handoff: false, order: false, confidence: 1, text: "العفو 🌹 سعدنا بخدمتك، ولمسة فون دائماً في خدمتك." }
  }
  if (c.has("greeting") && a.tokens.length <= 3) {
    return {
      intent: "greeting",
      handoff: false,
      order: false,
      confidence: 1,
      text: `وعليكم السلام ورحمة الله، حيّاك الله في لمسة فون 📱✨\nجوالات سامسونج وارد أمريكا بنظافة وكالة وفحص شامل، وإكسسوارات أصلية.\n📍 صنعاء - شارع القصر، أمام السيفي.\n\nاكتب اسم الجهاز الذي تبحث عنه أو ميزانيتك، وأرسل لك السعر فوراً.\n🛍️ المتجر: ${ctx.storeUrl}`,
    }
  }
  return {
    intent: "fallback",
    handoff: true,
    order: false,
    confidence: 0,
    text: `وصلتنا رسالتك 🌹 وسيرد عليك أحد موظفي لمسة فون في أقرب وقت.\nوإلى ذلك الحين تقدر تتصفح المنتجات والأسعار: ${ctx.storeUrl}`,
  }
}

// ---------- 6) تصحيح لغة رد الموظف ----------
const FIXES: [RegExp, string][] = [
  [/\bانشاء الله\b/g, "إن شاء الله"],
  [/\bان شاء الله\b/g, "إن شاء الله"],
  [/\bلاكن\b/g, "لكن"],
  [/\bهاذا\b/g, "هذا"],
  [/\bهاذه\b/g, "هذه"],
  [/\bذالك\b/g, "ذلك"],
  [/\bالذى\b/g, "الذي"],
  [/\bمسئول\b/g, "مسؤول"],
  [/\bالى\b/g, "إلى"],
  [/\bالا\b/g, "إلا"],
  [/\bاذا\b/g, "إذا"],
  [/\bانت\b/g, "أنت"],
  [/\bانا\b/g, "أنا"],
  [/\bاو\b/g, "أو"],
  [/\bاي\b/g, "أي"],
  [/\bاهلا\b/g, "أهلاً"],
  [/\bشكرا\b/g, "شكراً"],
  [/\bطبعا\b/g, "طبعاً"],
  [/\bحاليا\b/g, "حالياً"],
  [/\bايضا\b/g, "أيضاً"],
  [/\bسعرة\b/g, "سعره"],
]
// \b لا يعمل مع العربية في JS، فنحوّله إلى حدود كلمات Unicode
const FIXES_U: [RegExp, string][] = FIXES.map(([re, to]) => {
  const src = re.source
  const body = src.replace(/^\\b/, "").replace(/\\b$/, "")
  return [new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "gu"), to]
})

export function correctArabic(text: string): string {
  let s = text
  for (const [re, to] of FIXES_U) s = s.replace(re, to)
  return s
    .replace(/[ \t]+([،,.!؟?:])/g, "$1") // لا مسافة قبل علامات الترقيم
    .replace(/([،,!؟?])(?=[^\s\d])/g, "$1 ") // مسافة بعدها
    .replace(/\?/g, "؟")
    .replace(/,/g, "،")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/(.)\1{3,}/g, "$1$1")
    .trim()
}

// ---------- 7) الأسئلة الشائعة الافتراضية (تُعدَّل من اللوحة) ----------
export const DEFAULT_FAQS: { question: string; answer: string; keywords: string }[] = [
  { question: "كيف التوصيل وكم يأخذ؟", answer: "🚚 نوصل لك إلى باب البيت في صنعاء بسرعة وبرسوم رمزية. بعد تأكيد الطلب يتواصل معك المندوب لتحديد الوقت المناسب لك.", keywords: "توصيل شحن مندوب يوصل متى" },
  { question: "كيف الدفع؟", answer: "💵 تستلم جهازك، تفحصه بنفسك أمام المندوب، ثم تدفع. بلا أي مخاطرة عليك.", keywords: "دفع كاش حساب استلام" },
  { question: "هل في ضمان؟", answer: "🛡️ نعم، كل جهاز له ضمان مذكور في صفحته، ومعه استبدال خلال 3 أيام حسب سياسة الاسترجاع. تشتري وأنت مطمئن.", keywords: "ضمان كفالة مضمون" },
  { question: "سياسة الاسترجاع والاستبدال", answer: "🔄 تقدر تستبدل أو تسترجع خلال 3 أيام من الاستلام، بشرط أن يكون الجهاز بحالته الأصلية مع كامل ملحقاته وعلبته.", keywords: "استرجاع استبدال ارجاع تبديل" },
  { question: "وين مكانكم؟", answer: "📍 موقعنا: صنعاء - شارع القصر، أمام السيفي. ونوصل لك داخل صنعاء وإلى المحافظات برسوم رمزية.\n📲 هاتف وواتساب: +967777128281", keywords: "مكان عنوان موقع وين محل" },
  { question: "متى الدوام؟", answer: "🕘 نرد على رسائلك طوال اليوم، والتوصيل خلال ساعات العمل.", keywords: "دوام ساعات وقت تفتحون" },
  { question: "هل الأجهزة أصلية؟", answer: "✅ نعم، كل أجهزتنا أصلية 100% ومفحوصة قبل التسليم، وتفحصها بنفسك قبل الدفع.", keywords: "اصلي اصليه تقليد مقلد كوبي" },
  // الحالة لا تُذكر إلا إذا سأل العميل
  { question: "الجهاز جديد ولا مستخدم؟", answer: "أجهزة سامسونج (النسخة الأمريكية) عندنا أغلبها مستخدمة بحالة شبه جديدة ومفحوصة بعناية، وبعضها جديد، والأجهزة الصينية والماركات الأخرى جديدة. اكتب لنا اسم الجهاز ونؤكد لك حالته بالضبط.", keywords: "جديد مستعمل مستخدم نظيف مختوم كرتونه حالته حالة شبه" },
  { question: "هل يوجد تقسيط؟", answer: "حالياً الدفع كاش عند الاستلام. ولأي ترتيب خاص اكتب «موظف» ونخدمك بما نقدر عليه 🌹", keywords: "تقسيط اقساط قسط" },
]
