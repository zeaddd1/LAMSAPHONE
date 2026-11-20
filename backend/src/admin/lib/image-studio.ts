// استوديو الصور: خطوات توليد صور المنتج يدوياً عبر Gemini وCanva، خطوة بخطوة.
// منطق بحت بلا DOM (يُختبر في jest). البرومتات تُبنى فقط من بيانات المنتج العامة:
// لا سعر تكلفة ولا مورد ولا IMEI.

export type Tool = "gemini" | "canva"
export const TOOLS: Record<Tool, { name: string; url: string; where: string }> = {
  gemini: { name: "Gemini", url: "https://gemini.google.com/app", where: "Gemini ← أداة إنشاء الصور" },
  canva: { name: "Canva", url: "https://www.canva.com/ai", where: "Canva AI" },
}

// ---------- الزوايا ----------
export const ANGLES = ["front", "back", "three_quarter", "side"] as const
export type Angle = (typeof ANGLES)[number]
export const ANGLE_ORDER: Angle[] = ["back", "front", "three_quarter", "side"]
export const ANGLE_LABELS: Record<Angle, string> = { front: "أمامي", back: "خلفي", three_quarter: "ثلاثة أرباع", side: "جانبي" }

// ---------- الأصناف (ما يبيعه المتجر) ----------
export type Category = "phone" | "tablet" | "watch" | "audio" | "charger" | "case" | "other"
type AngleText = { full: string; short: string }
type Cat = { label: string; icon: string; en: string; keep: string; partsHint: string; angles: Record<Angle, AngleText> }

const DEVICE_ANGLES: Cat["angles"] = {
  front: { full: "FRONT VIEW. The product facing straight at the camera, screen visible, perfectly centered and upright.", short: "straight from the front" },
  back: { full: "BACK VIEW. The back panel facing straight at the camera, perfectly centered and upright, camera module clearly visible.", short: "straight from the back, camera module visible" },
  three_quarter: { full: "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees so the front and one side edge are visible together, with a soft shadow.", short: "at a three-quarter angle, front and one side visible" },
  side: { full: "SIDE VIEW. Seen from its right edge, upright and centered, showing the thickness, side buttons and frame clearly.", short: "from the right side edge, buttons and thickness visible" },
}

export const CATEGORIES: Record<Category, Cat> = {
  phone: { label: "جوال", icon: "📱", en: "smartphone", keep: "model, proportions, camera module layout, buttons, ports, colors, logos and screen content", partsHint: "مثال: ثلاث عدسات عمودية أعلى اليسار، الأزرار يميناً، USB-C بالأسفل", angles: DEVICE_ANGLES },
  tablet: { label: "تابلت", icon: "📟", en: "tablet", keep: "model, proportions, bezels, camera layout, buttons, ports, colors, logos and screen content", partsHint: "مثال: كاميرا مفردة أعلى اليسار، منفذ USB-C بالأسفل", angles: DEVICE_ANGLES },
  watch: {
    label: "ساعة ذكية",
    icon: "⌚",
    en: "smartwatch",
    keep: "case shape, size, crown and buttons, strap color and texture, colors, logos and watch face",
    partsHint: "مثال: علبة دائرية، زران يميناً، حزام سيليكون أسود",
    angles: {
      front: { full: "FRONT VIEW. The watch face straight to the camera, strap neatly arranged, centered.", short: "straight from the front, watch face visible" },
      back: { full: "BACK VIEW. The back of the watch showing the sensors, centered.", short: "from the back, sensors visible" },
      three_quarter: { full: "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees showing the face and the crown side together.", short: "at a three-quarter angle, face and crown visible" },
      side: { full: "SIDE VIEW. The crown and buttons side, showing the case thickness.", short: "from the crown side" },
    },
  },
  audio: {
    label: "سماعات",
    icon: "🎧",
    en: "earbuds or headphones",
    keep: "shape, case shape, colors, materials, logos and indicator lights",
    partsHint: "مثال: علبة شحن بيضاء بيضاوية، ضوء أمامي، سماعتان بساق قصيرة",
    angles: {
      front: { full: "FRONT VIEW. The product straight to the camera, centered (earbuds beside their open case if applicable).", short: "straight from the front" },
      back: { full: "BACK VIEW. The back of the product or case, centered.", short: "from the back" },
      three_quarter: { full: "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees, with a soft shadow.", short: "at a three-quarter angle" },
      side: { full: "DETAIL VIEW. A closer view of the earbuds or ear cups and their details.", short: "as a close detail view" },
    },
  },
  charger: {
    label: "شواحن وكابلات",
    icon: "🔌",
    en: "charger or cable",
    keep: "shape, connector types, prongs, colors, printed text and logos",
    partsHint: "مثال: منفذ USB-C واحد، قابس بريطاني، لون أبيض مطفي",
    angles: {
      front: { full: "FRONT VIEW. The charger straight to the camera with the cable neatly coiled beside it, centered.", short: "straight from the front" },
      back: { full: "BACK VIEW. The prongs side, centered.", short: "from the prongs side" },
      three_quarter: { full: "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees showing the port side.", short: "at a three-quarter angle, port visible" },
      side: { full: "DETAIL VIEW. A close-up of the connectors and ports.", short: "as a close-up of the connectors" },
    },
  },
  case: {
    label: "كفرات وإكسسوارات",
    icon: "🛡️",
    en: "phone case or accessory",
    keep: "shape, cutouts, colors, materials, pattern, printed text and logos",
    partsHint: "مثال: فتحة كاميرا مربعة، حواف شفافة، ظهر مطفي",
    angles: {
      front: { full: "FRONT VIEW. The accessory straight to the camera, centered.", short: "straight from the front" },
      back: { full: "BACK VIEW. The back side, centered.", short: "from the back" },
      three_quarter: { full: "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees, with a soft shadow.", short: "at a three-quarter angle" },
      side: { full: "DETAIL VIEW. A close-up of the material and cutouts.", short: "as a close-up of the material" },
    },
  },
  other: { label: "منتج آخر", icon: "📦", en: "tech product", keep: "shape, proportions, colors, materials, logos and printed text", partsHint: "اكتب أهم ما لا يجوز أن يتغير", angles: DEVICE_ANGLES },
}

// ---------- الحالة والأنماط ----------
export type Condition = "new" | "used" | "refurbished"
export const CONDITIONS: Record<Condition, { label: string; en: string }> = {
  new: { label: "جديد", en: "Brand new" },
  used: { label: "مستعمل", en: "Used, with normal signs of wear" },
  refurbished: { label: "مجدّد", en: "Refurbished" },
}
export type Style = "studio" | "gradient" | "dark" | "lifestyle" | "clean"
export const STYLES: Record<Style, { label: string; text: string }> = {
  studio: { label: "استوديو أبيض (الأنسب للمتجر)", text: "clean pure white background, soft natural shadow, even studio light" },
  gradient: { label: "تدرّج لوني فاخر", text: "soft gradient background matching the product color, soft shadow, premium studio light" },
  dark: { label: "داكن فاخر", text: "elegant dark background, soft rim light, faint reflection below" },
  lifestyle: { label: "أجواء واقعية", text: "clean wooden desk, soft daylight, shallow depth of field, product as the hero" },
  clean: { label: "تنظيف الخلفية فقط", text: "keep the original background style, only tidy it and remove stray objects" },
}
// قاعدة الصدق: المستعمل والمجدّد = استوديو أبيض أو تنظيف فقط، ولا زوايا مولّدة
export const isStrict = (c: Condition) => c !== "new"
export function effectiveStyle(c: Condition, s: Style): Style {
  return isStrict(c) && s !== "studio" && s !== "clean" ? "studio" : s
}

export type Ratio = "4:5" | "1:1" | "9:16"
export const RATIOS: Record<Ratio, string> = { "4:5": "4:5 للمتجر وإنستغرام", "1:1": "1:1 مربع", "9:16": "9:16 ستوري" }

export type Track = "details" | "main" | "eraser" | "angles" | "story" | "copy"
export const TRACKS: Record<Track, { label: string; hint: string }> = {
  details: { label: "تفاصيل الجهاز من GSMArena", hint: "سطر يصف الكاميرات والأزرار والألوان لتعبئة الحقل تلقائياً" },
  eraser: { label: "إزالة علامة المورد أولاً", hint: "إن كانت الصورة عليها شعار أو ختم المورد" },
  main: { label: "صورة المتجر الرئيسية", hint: "تحسين الصورة الحقيقية بخلفية احترافية" },
  angles: { label: "الزوايا الأربع", hint: "للجديد فقط: أمامي، خلفي، ثلاثة أرباع، جانبي" },
  story: { label: "تصميم ستوري/إعلان", hint: "9:16 مع مساحة فارغة لتكتب السعر بنفسك في Canva" },
  copy: { label: "النصوص (وصف + إنستغرام + فيسبوك)", hint: "وصف المتجر ونص المنشور والهاشتاقات" },
}
export const TRACK_ORDER: Track[] = ["details", "eraser", "main", "angles", "story", "copy"]

// الأصناف التي لها صفحات في GSMArena: نعتمدها مرجعاً للتصميم والمواصفات
export const hasGsm = (c: Category) => c === "phone" || c === "tablet" || c === "watch"
export function gsmSearchUrl(name: string) {
  return `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(name.trim())}`
}

export type StudioInput = {
  category: Category
  name: string
  brand: string
  color: string
  condition: Condition
  parts: string
  specs: string
  price: string
  style: Style
  ratio: Ratio
  extras: string
}
export const EMPTY_INPUT: StudioInput = { category: "phone", name: "", brand: "", color: "", condition: "new", parts: "", specs: "", price: "", style: "studio", ratio: "4:5", extras: "" }

// صورة واحدة فقط مع كل برومت (أو بلا صورة)
export type Attach = "reference" | "anchor" | "main_result" | "none"
export type Step = {
  id: string
  track: Track
  title: string
  tool: Tool
  attach: Attach
  // تعليمة واحدة قصيرة قبل اللصق
  hint: string
  prompt: string
  after: string
  sameChat: boolean
  angle?: Angle
  // عند الرفض: برومت أقصر بلا اسم الماركة، وبديل Canva
  fallback?: { prompt: string; canva: string }
}

const ONE = "One single image, no collage."

function fullName(i: StudioInput) {
  const c = CATEGORIES[i.category]
  const name = i.name.trim() || c.en
  const brand = i.brand.trim()
  return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name
}
// المنتج كما هو + قاعدة الصدق + مرجع GSMArena (جملة واحدة لكل منها)
function keep(i: StudioInput) {
  const parts = i.parts.trim()
  const wear = isStrict(i.condition) ? " Do not hide any scratch or wear." : ""
  return `Keep the product exactly as in the photo${parts ? ` (${parts})` : ""}${i.color.trim() ? `, color ${i.color.trim()}` : ""}. No added text, logos or price.${wear}`
}
const gsm = (i: StudioInput) => (hasGsm(i.category) && i.name.trim() ? ` Match the real ${fullName(i)} design on gsmarena.com.` : "")
const extras = (i: StudioInput) => (i.extras.trim() ? ` ${i.extras.trim()}.` : "")
const ratioText = (r: Ratio) => (r === "9:16" ? "vertical 9:16" : r === "1:1" ? "square 1:1" : "portrait 4:5")

/** تعليمات الإعداد لمرة واحدة (Gem في Gemini أو ذاكرة Canva). */
export function buildSetup(i: StudioInput) {
  const style = STYLES[effectiveStyle(i.condition, i.style)].text
  const gem = [
    "You are the product-photo assistant of LamsaPhone, a phone and accessories store in Yemen.",
    "Rules for every image:",
    "- Never change the product: design, cameras, buttons, ports, colors and logos stay exactly as in my photo.",
    "- Change only background, lighting and shadow. Remove supplier watermarks from the background.",
    "- Never add text, prices or logos. Never hide scratches on used items.",
    "- For phones, tablets and watches, use the device page on gsmarena.com as the reference for its real design.",
    `- Default style: ${style}, product centered with margin.`,
    "- One single image per request, never a collage. Keep the same style for all images of the same product.",
  ].join("\n")
  const canva = `LamsaPhone store product photos: keep the product exactly unchanged, only change background, lighting and shadow. Default style: ${style}. No added text, prices or logos. Never hide wear on used items. One image per request.`
  return { gem, canva }
}

/** يبني خطوات العمل بالترتيب حسب المسارات المختارة. */
export function buildSteps(i: StudioInput, tracks: Track[]): Step[] {
  const c = CATEGORIES[i.category]
  const style = STYLES[effectiveStyle(i.condition, i.style)].text
  const name = fullName(i)
  const steps: Step[] = []
  const has = (t: Track) => tracks.includes(t)

  if (has("details") && hasGsm(i.category)) {
    steps.push({
      id: "details",
      track: "details",
      title: "تفاصيل الجهاز من GSMArena",
      tool: "gemini",
      attach: "none",
      sameChat: false,
      hint: "محادثة جديدة في Gemini، بلا صور.",
      prompt: `From the ${name} page on gsmarena.com, write one short English line describing its exterior: rear camera layout, button side, ports and available colors. Only that line.`,
      after: "انسخ السطر الناتج والصقه في حقل «تفاصيل يجب أن تبقى كما هي».",
    })
  }

  if (has("eraser")) {
    steps.push({
      id: "eraser",
      track: "eraser",
      title: "إزالة علامة المورد",
      tool: "canva",
      attach: "reference",
      sameChat: false,
      hint: "في Canva: ارفع الصورة ← تعديل الصورة ← Magic Eraser.",
      prompt: "Remove the watermark and stray text from the background only. Do not touch the product.",
      after: "نزّل الصورة النظيفة وضعها في خانة «الصورة المرجعية».",
    })
  }

  if (has("main")) {
    const r = ratioText(i.ratio)
    steps.push({
      id: "main",
      track: "main",
      title: "صورة المتجر الرئيسية",
      tool: "gemini",
      attach: "reference",
      sameChat: false,
      hint: "محادثة جديدة ← أداة إنشاء الصور ← أرفق الصورة المرجعية.",
      prompt: `Turn this photo of the ${name} into a professional store photo: ${style}, ${r}, centered with margin. ${keep(i)} Remove any supplier watermark.${gsm(i)}${extras(i)} ${ONE}`,
      after: "نزّل الصورة وقارنها بالمنتج الحقيقي.",
      fallback: { prompt: `Professional store photo of this product: ${style}, ${r}. Keep it exactly as is, no added text. ${ONE}`, canva: `Product photo of my uploaded item: ${style}, ${r}, centered. Keep the product unchanged, no text.` },
    })
  }

  if (has("angles") && !isStrict(i.condition)) {
    // الخلفي أولاً: يعرّف الجهاز أفضل (الكاميرات والشعار)، ثم يصبح مرجع التناسق لبقية الزوايا
    ANGLE_ORDER.forEach((a, n) => {
      const view = c.angles[a].short
      const first = n === 0
      steps.push({
        id: `angle_${a}`,
        track: "angles",
        title: `الزاوية ${n + 1}: ${ANGLE_LABELS[a]}`,
        tool: "gemini",
        // الأولى: الصورة الحقيقية (الخلفية). البقية: الخلفية الناتجة فقط (صورة واحدة) للتناسق
        attach: first ? "reference" : "anchor",
        sameChat: !first,
        angle: a,
        hint: first ? "محادثة جديدة ← أداة إنشاء الصور ← أرفق صورة الجهاز من الخلف." : "نفس المحادثة ← أرفق الخلفية الناتجة (صورة واحدة).",
        prompt: first
          ? `Professional store photo of this ${name}, ${view}: ${style}, ${ratioText(i.ratio)}, centered. ${keep(i)}${gsm(i)} ${ONE}`
          : `Same ${name}, same style and lighting as this image, now shown ${view}, ${ratioText(i.ratio)}, centered. ${keep(i).replace("as in the photo", "as in this image")}${gsm(i)} ${ONE}`,
        after: first ? "نزّلها وضعها في خانة «الخلفية الناتجة»." : n === 3 ? "نزّلها، وراجع الزوايا الأربع على الجهاز الحقيقي." : "نزّلها، ثم انسخ التالي.",
        fallback: {
          prompt: `Store photo of this product ${view}: ${style}, ${ratioText(i.ratio)}. Keep its design exactly, no added text. ${ONE}`,
          canva: `Product photo of my uploaded item ${view}, ${style}, ${ratioText(i.ratio)}, centered. Keep the product unchanged, no text.`,
        },
      })
    })
  }

  if (has("story")) {
    steps.push({
      id: "story",
      track: "story",
      title: "تصميم ستوري/إعلان 9:16",
      tool: "canva",
      attach: has("main") ? "main_result" : "reference",
      sameChat: false,
      hint: `Canva AI ← ارفع ${has("main") ? "صورة المتجر الناتجة" : "الصورة المرجعية"}.`,
      prompt: `Instagram story 9:16 for this ${c.en}: ${style}, product in the lower two thirds, top third left empty for my text. Keep the product unchanged, no added text or logos.`,
      after: "اكتب أنت الاسم والسعر ورقم واتساب في Canva، ثم نزّل PNG.",
    })
  }

  if (has("copy")) {
    const src = hasGsm(i.category) && i.name.trim() ? ` ومواصفاته من صفحته في gsmarena.com فقط` : ""
    steps.push({
      id: "copy",
      track: "copy",
      title: "النصوص بالعربية",
      tool: "gemini",
      attach: "none",
      sameChat: false,
      hint: "محادثة جديدة في Gemini، بلا صور.",
      prompt: [
        `اكتب لمتجر لمسة فون عن ${name}${i.color.trim() ? ` (${i.color.trim()})` : ""}، الحالة: ${CONDITIONS[i.condition].label}${i.price.trim() ? `، السعر: ${i.price.trim()}` : ""}${i.specs.trim() ? `، المواصفات: ${i.specs.trim()}` : ""}. اعتمد على هذه البيانات${src}، ولا تخترع شيئاً.`,
        "أعطني: 1) وصفاً للمتجر بنقاط 2) كابشن إنستغرام قصير بإيموجي 3) نص فيسبوك مع السعر 4) عشرة هاشتاقات في سطر واحد.",
      ].join("\n"),
      after: "انسخ النصوص إلى الإضافة السريعة، والهاشتاقات للتعليق الأول.",
    })
  }
  return steps
}

// عند الرفض (بالترتيب)
export const REFUSAL_HELP = [
  "«I don't have access to that content»: أرفق نفس الصورة من جديد مع البرومت وأرسل.",
  "إن تكرر: محادثة جديدة + الصورة + «البرومت المبسّط».",
  "إن رُفض كل شيء: غالباً حد الصور اليومي. نفّذها في Canva أو أكمل غداً.",
]

// ---------- تقدم المعالج ----------
export type Progress = { current: number; copied: string[]; done: string[] }
/** بعد نسخ برومت الخطوة n: تُعلَّم منسوخة وننتقل للتالية، والسابقة المنسوخة تُعتبر منفّذة. */
export function afterCopy(p: Progress, steps: Step[], n: number): Progress {
  const id = steps[n]?.id
  if (!id) return p
  const copied = p.copied.includes(id) ? p.copied : [...p.copied, id]
  const done = Array.from(new Set([...p.done, ...steps.slice(0, n).filter((s) => copied.includes(s.id)).map((s) => s.id)]))
  return { current: Math.min(n + 1, steps.length), copied, done }
}
export function markDone(p: Progress, id: string): Progress {
  return p.done.includes(id) ? p : { ...p, done: [...p.done, id] }
}
/** نفتح الأداة تلقائياً فقط عند أول خطوة أو تغيّر الأداة أو بدء محادثة جديدة. */
export function shouldOpenTool(steps: Step[], n: number) {
  const s = steps[n]
  if (!s) return false
  if (n === 0) return true
  return s.tool !== steps[n - 1].tool || !s.sameChat
}
