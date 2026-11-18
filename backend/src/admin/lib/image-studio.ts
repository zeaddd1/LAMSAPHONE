// استوديو الصور: خطوات توليد صور المنتج يدوياً عبر Gemini وCanva، خطوة بخطوة.
// منطق بحت بلا DOM (يُختبر في jest). البرومتات تُبنى فقط من بيانات المنتج العامة:
// لا سعر تكلفة ولا مورد ولا IMEI.

import { ANGLES, ANGLE_LABELS, Angle, buildManualPrompts } from "./quick-add-angles"

export type Tool = "gemini" | "canva"
export const TOOLS: Record<Tool, { name: string; url: string; where: string }> = {
  gemini: { name: "Gemini", url: "https://gemini.google.com/app", where: "Gemini ← أداة إنشاء الصور (Nano Banana)" },
  canva: { name: "Canva", url: "https://www.canva.com/ai", where: "Canva AI" },
}

// ---------- الأصناف (ما يبيعه المتجر) ----------
export type Category = "phone" | "tablet" | "watch" | "audio" | "charger" | "case" | "other"
type Cat = { label: string; icon: string; en: string; keep: string; partsHint: string; angles: [string, string, string, string] }

const DEVICE_ANGLES: Cat["angles"] = [
  "FRONT VIEW. The product facing straight at the camera, perfectly centered and upright.",
  "BACK VIEW. The back of the product straight to the camera, perfectly centered and upright.",
  "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees showing the front and one side together, with a soft shadow.",
  "SIDE VIEW. Seen from the side, showing the thickness, buttons and edge details clearly, upright and centered.",
]

export const CATEGORIES: Record<Category, Cat> = {
  phone: {
    label: "جوال",
    icon: "📱",
    en: "smartphone",
    keep: "model, proportions, camera module layout, buttons, ports, colors, logos and screen content",
    partsHint: "مثال: ثلاث عدسات عمودية أعلى اليسار، الأزرار يميناً، USB-C بالأسفل",
    angles: DEVICE_ANGLES,
  },
  tablet: {
    label: "تابلت",
    icon: "📟",
    en: "tablet",
    keep: "model, proportions, bezels, camera layout, buttons, ports, colors, logos and screen content",
    partsHint: "مثال: كاميرا مفردة أعلى اليسار، منفذ USB-C بالأسفل، سماعات على الجانبين",
    angles: DEVICE_ANGLES,
  },
  watch: {
    label: "ساعة ذكية",
    icon: "⌚",
    en: "smartwatch",
    keep: "case shape, size, crown and buttons, strap color and texture, colors, logos and watch face",
    partsHint: "مثال: علبة دائرية، زران يميناً، حزام سيليكون أسود",
    angles: [
      "FRONT VIEW. The watch face straight to the camera, strap neatly arranged, centered.",
      "BACK VIEW. The back of the watch showing the sensors, centered.",
      "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees showing the face and the crown side together.",
      "SIDE VIEW. The crown and buttons side, showing the case thickness.",
    ],
  },
  audio: {
    label: "سماعات",
    icon: "🎧",
    en: "earbuds or headphones",
    keep: "shape, case shape, colors, materials, logos and indicator lights",
    partsHint: "مثال: علبة شحن بيضاء بيضاوية، ضوء أمامي، سماعتان بساق قصيرة",
    angles: [
      "FRONT VIEW. The product straight to the camera, centered (earbuds beside their open case if applicable).",
      "BACK VIEW. The back of the product or case, centered.",
      "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees, with a soft shadow.",
      "DETAIL VIEW. A closer view of the earbuds or ear cups and their details.",
    ],
  },
  charger: {
    label: "شواحن وكابلات",
    icon: "🔌",
    en: "charger or cable",
    keep: "shape, connector types, prongs, colors, printed text and logos",
    partsHint: "مثال: منفذ USB-C واحد، قابس بريطاني، لون أبيض مطفي",
    angles: [
      "FRONT VIEW. The charger straight to the camera with the cable neatly coiled beside it, centered.",
      "BACK VIEW. The prongs side, centered.",
      "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees showing the port side.",
      "DETAIL VIEW. A close-up of the connectors and ports.",
    ],
  },
  case: {
    label: "كفرات وإكسسوارات",
    icon: "🛡️",
    en: "phone case or accessory",
    keep: "shape, cutouts, colors, materials, pattern, printed text and logos",
    partsHint: "مثال: فتحة كاميرا مربعة، حواف شفافة، ظهر مطفي",
    angles: [
      "FRONT VIEW. The accessory straight to the camera, centered.",
      "BACK VIEW. The back side, centered.",
      "THREE-QUARTER VIEW. Rotated about 30 to 40 degrees, with a soft shadow.",
      "DETAIL VIEW. A close-up of the material and cutouts.",
    ],
  },
  other: {
    label: "منتج آخر",
    icon: "📦",
    en: "tech product",
    keep: "shape, proportions, colors, materials, logos and printed text",
    partsHint: "اكتب أهم ما لا يجوز أن يتغير",
    angles: DEVICE_ANGLES,
  },
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
  studio: { label: "استوديو أبيض (الأنسب للمتجر)", text: "clean pure white background, soft natural shadow, even diffused studio lighting" },
  gradient: { label: "تدرّج لوني فاخر", text: "smooth light gradient background that complements the product color, soft shadow beneath, premium studio lighting" },
  dark: { label: "داكن فاخر", text: "elegant dark background with soft rim lighting and a faint reflection under the product" },
  lifestyle: { label: "أجواء واقعية", text: "realistic tasteful setting such as a clean wooden desk with soft natural daylight and shallow depth of field, the product clearly the hero" },
  clean: { label: "تنظيف الخلفية فقط", text: "keep the original photo and background style, only tidy the background and remove stray objects" },
}
// قاعدة الصدق: المستعمل والمجدّد = استوديو أبيض أو تنظيف فقط، ولا زوايا مولّدة
export const isStrict = (c: Condition) => c !== "new"
export function effectiveStyle(c: Condition, s: Style): Style {
  return isStrict(c) && s !== "studio" && s !== "clean" ? "studio" : s
}

export type Ratio = "4:5" | "1:1" | "9:16"
export const RATIOS: Record<Ratio, string> = { "4:5": "4:5 للمتجر", "1:1": "1:1 مربع", "9:16": "9:16 ستوري" }

export type Track = "main" | "eraser" | "angles" | "story" | "copy"
export const TRACKS: Record<Track, { label: string; hint: string }> = {
  eraser: { label: "إزالة علامة المورد أولاً", hint: "إن كانت الصورة عليها شعار أو ختم المورد" },
  main: { label: "صورة المتجر الرئيسية", hint: "تحسين الصورة الحقيقية بخلفية احترافية" },
  angles: { label: "الزوايا الأربع", hint: "للجديد فقط: أمامي، خلفي، ثلاثة أرباع، جانبي" },
  story: { label: "تصميم ستوري/إعلان", hint: "9:16 مع مساحة فارغة لتكتب السعر بنفسك في Canva" },
  copy: { label: "النصوص (وصف + إنستغرام + فيسبوك)", hint: "إن لم تستخدم التوليد الآلي في الإضافة السريعة" },
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

export type Attach = "reference" | "previous" | "main_result" | "none"
export type Step = {
  id: string
  track: Track
  title: string
  tool: Tool
  attach: Attach
  // تعليمات قبل اللصق
  before: string[]
  prompt: string
  // ماذا تفعل بعد ظهور الصورة
  after: string
  // نفس المحادثة السابقة؟
  sameChat: boolean
  angle?: Angle
}

const ONE = "Output exactly one single image, not a collage or grid."
const NO_BRAND = "Do not add any store logo, watermark, price or text on the image (the store adds its own stamp later)."

function productLines(i: StudioInput) {
  const c = CATEGORIES[i.category]
  const name = i.name.trim() || c.en
  return [
    `Product: ${name}${i.brand.trim() && !name.toLowerCase().includes(i.brand.trim().toLowerCase()) ? ` (${i.brand.trim()})` : ""}`,
    `Color: ${i.color.trim() || "as in the reference photo"}`,
    `Condition: ${CONDITIONS[i.condition].en}`,
    `Details to keep exactly: ${i.parts.trim() || "exactly as seen in the attached photo"}`,
  ].join("\n")
}
function keepRule(i: StudioInput) {
  const c = CATEGORIES[i.category]
  const strict = isStrict(i.condition) ? " This item is not new: never hide, smooth or remove any scratch, dent, stain or sign of wear." : ""
  return `Keep the product exactly the same: do not change its ${c.keep}. Do not add or remove any physical feature. Do not invent text, logos or badges.${strict}`
}
const extrasLine = (i: StudioInput) => (i.extras.trim() ? `\nExtra notes: ${i.extras.trim()}` : "")

/** تعليمات الإعداد لمرة واحدة (Gem في Gemini أو ذاكرة Canva). */
export function buildSetup(i: StudioInput) {
  const style = STYLES[effectiveStyle(i.condition, i.style)].text
  const gem = [
    "You are the product-photo assistant of LamsaPhone, an online store in Yemen selling phones, tablets, smartwatches and accessories.",
    "I upload real photos of products, and you turn them into clean, professional e-commerce images.",
    "",
    "NON-NEGOTIABLE RULES",
    "1. Never change the product itself: model, proportions, cameras, buttons, ports, colors, logos and screen content stay exactly as in my photo.",
    "2. Only change the background, lighting and shadow unless I clearly ask otherwise.",
    "3. Remove supplier watermarks, stamps and stray text from the background only.",
    "4. Never add prices, badges, store logos or any text on the image.",
    "5. Used or refurbished items: never hide scratches, dents or wear. Clean the background only.",
    "6. Keep the same style across all images of the same product: same background, lighting, framing and scale.",
    "",
    `DEFAULT STYLE: ${style}, product centered with a generous margin.`,
    `OUTPUT: one single image per request, never a collage. If my request is unclear, ask one short question first.`,
  ].join("\n")
  const canva = `I run LamsaPhone, an online store selling phones and tech accessories. Always keep the product exactly unchanged and only change the background, lighting and shadow. Default style: ${style}. Never invent text, prices or logos. For used items never hide scratches or wear. Remove supplier watermarks from the background only. One image per request.`
  return { gem, canva }
}

/** يبني خطوات العمل بالترتيب حسب المسارات المختارة. */
export function buildSteps(i: StudioInput, tracks: Track[]): Step[] {
  const c = CATEGORIES[i.category]
  const styleKey = effectiveStyle(i.condition, i.style)
  const style = STYLES[styleKey].text
  const lines = productLines(i)
  const keep = keepRule(i)
  const steps: Step[] = []
  const has = (t: Track) => tracks.includes(t)

  if (has("eraser")) {
    steps.push({
      id: "eraser",
      track: "eraser",
      title: "إزالة علامة المورد",
      tool: "canva",
      attach: "reference",
      sameChat: false,
      before: ["افتح Canva وارفع صورة المنتج الأصلية.", "اختر الصورة ثم «تعديل الصورة» ← Magic Eraser أو Magic Edit، وحدّد الشعار أو الختم.", "الصق البرومت إن طُلب منك وصف."],
      prompt: "Remove the watermark, supplier logo and any stray text from the background only, and fill the area with the matching clean background. Do not touch the product in any way.",
      after: "نزّل الصورة النظيفة: ستستخدمها مرجعاً في الخطوات التالية بدل الأصلية.",
    })
  }

  if (has("main")) {
    steps.push({
      id: "main",
      track: "main",
      title: "صورة المتجر الرئيسية",
      tool: "gemini",
      attach: "reference",
      sameChat: false,
      before: ["افتح محادثة جديدة في Gemini (أو الـ Gem الخاص بالمتجر إن أنشأته).", "اختر أداة إنشاء الصور.", `ارفق صورة المنتج${has("eraser") ? " النظيفة من الخطوة السابقة" : " الحقيقية"}.`],
      prompt: [
        "You are a professional e-commerce product photographer and retoucher. The attached image is the real product. Enhance it only.",
        "",
        lines + extrasLine(i),
        "",
        `Style: ${style}. ${i.ratio === "9:16" ? "Vertical 9:16" : i.ratio === "1:1" ? "Square 1:1" : "Portrait 4:5"} composition, the whole product inside the frame with a generous margin on all sides, centered, sharp, high resolution.`,
        "",
        `Rules:\n- ${keep}\n- Remove supplier watermarks and stray text from the background only.\n- ${NO_BRAND}\n- ${ONE}`,
      ].join("\n"),
      after: "نزّل الصورة (زر التنزيل في Gemini) وقارنها بالمنتج الحقيقي. إن غيّر شيئاً في المنتج، اطلب: «أعد المحاولة دون تغيير المنتج».",
    })
  }

  if (has("angles") && !isStrict(i.condition)) {
    const prompts =
      i.category === "phone"
        ? buildManualPrompts({ deviceName: i.name.trim() || c.en, color: i.color, parts: i.parts, styleText: style })
        : genericAngles(i, style)
    ANGLES.forEach((a, n) => {
      steps.push({
        id: `angle_${a}`,
        track: "angles",
        title: `الزاوية ${n + 1}: ${ANGLE_LABELS[a]}`,
        tool: "gemini",
        attach: n === 0 ? "reference" : "none",
        sameChat: n > 0,
        angle: a,
        before:
          n === 0
            ? ["افتح محادثة جديدة في Gemini واختر أداة إنشاء الصور.", "ارفق صورة المنتج المرجعية (الأمامية أفضل، وأرفق الخلفية أيضاً إن وُجدت لتقليل التخمين)."]
            : ["في نفس المحادثة (لا تفتح محادثة جديدة: هكذا يبقى المنتج متطابقاً).", "لا حاجة لإرفاق صورة."],
        prompt: prompts[n],
        after: n === 3 ? "نزّل الصورة الرابعة. راجع الزوايا الأربع على المنتج الحقيقي، خاصة الخلفي والجانبي (قد تكون بالتخمين)." : "نزّل الصورة، ثم انسخ البرومت التالي.",
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
      before: ["افتح Canva AI.", `ارفع ${has("main") ? "صورة المتجر الناتجة من Gemini" : "صورة المنتج"}.`],
      prompt: `Create a vertical 9:16 Instagram story design for this ${c.en}. Use the attached product photo exactly as it is, without changing the product. Style: ${style}. Place the product in the lower two thirds and leave the top third as clean empty space for a headline and price that I will type myself. ${NO_BRAND.replace(" (the store adds its own stamp later)", "")}`,
      after: "أضف أنت النص في Canva: اسم المنتج والسعر ورقم واتساب، ثم نزّل التصميم PNG.",
    })
  }

  if (has("copy")) {
    steps.push({
      id: "copy",
      track: "copy",
      title: "النصوص بالعربية",
      tool: "gemini",
      attach: "none",
      sameChat: false,
      before: ["افتح محادثة جديدة في Gemini (نصوص فقط، بلا أداة الصور)."],
      prompt: [
        "اكتب بالعربية لمتجر لمسة فون (جوالات وإكسسوارات في اليمن) اعتماداً على البيانات التالية فقط، دون اختراع أي مواصفة أو رقم أو ميزة غير مذكورة:",
        `المنتج: ${i.name.trim() || "[اسم المنتج]"}${i.brand.trim() ? ` (${i.brand.trim()})` : ""}`,
        `اللون: ${i.color.trim() || "غير محدد"}`,
        `الحالة: ${CONDITIONS[i.condition].label} (اذكرها بصدق ووضوح ولا تبالغ)`,
        `المواصفات: ${i.specs.trim() || "غير محددة"}`,
        `السعر: ${i.price.trim() || "غير محدد"}`,
        "",
        "أعطني:",
        "1) وصف المنتج للمتجر (مميزات ومواصفات منسقة في نقاط)",
        "2) كابشن إنستغرام قصير مع إيموجي مناسبة، بدون هاشتاقات",
        "3) نص فيسبوك أطول قليلاً مع السعر والتوفر والدفع عند الاستلام",
        "4) 10 هاشتاقات مناسبة في سطر منفصل (تُوضع في أول تعليق)",
        "إذا نقصت معلومة مهمة فاسألني عنها بدل تخمينها.",
      ].join("\n"),
      after: "انسخ النصوص إلى صفحة الإضافة السريعة (الوصف ونص المنشور)، والهاشتاقات للتعليق الأول.",
    })
  }
  return steps
}

function genericAngles(i: StudioInput, style: string): string[] {
  const c = CATEGORIES[i.category]
  const first = [
    `I am creating a consistent set of 4 separate e-commerce product photos of the same ${c.en}, one image at a time. Use the attached photo as the reference for the real product.`,
    productLines(i),
    `Fixed style for ALL images in the set: ${style}, the product centered, sharp, high resolution, same framing and scale, square 1:1 composition.`,
    `${keepRule(i)} ${ONE}`,
    `Generate image 1 of 4 now: ${c.angles[0]}`,
  ].join("\n")
  return [first, ...[1, 2, 3].map((n) => `Now generate image ${n + 1} of 4, as a separate single image, same product, same style, same background and lighting: ${c.angles[n]} ${ONE}`)]
}

// ---------- تقدم المعالج ----------
export type Progress = { current: number; copied: string[]; done: string[] }
/** بعد نسخ برومت الخطوة n: تُعلَّم منسوخة وننتقل للتالية (والسابقة تُعتبر «قيد التنفيذ» حتى تُرفع/تُعلَّم). */
export function afterCopy(p: Progress, steps: Step[], n: number): Progress {
  const id = steps[n]?.id
  if (!id) return p
  const copied = p.copied.includes(id) ? p.copied : [...p.copied, id]
  // الخطوات السابقة التي نُسخت تُعتبر منفّذة عند الانتقال
  const done = Array.from(new Set([...p.done, ...steps.slice(0, n).filter((s) => copied.includes(s.id)).map((s) => s.id)]))
  return { current: Math.min(n + 1, steps.length), copied, done }
}
export function markDone(p: Progress, id: string): Progress {
  return p.done.includes(id) ? p : { ...p, done: [...p.done, id] }
}
/** هل ننفتح الأداة تلقائياً؟ فقط عند أول خطوة أو تغيّر الأداة أو بدء محادثة جديدة. */
export function shouldOpenTool(steps: Step[], n: number) {
  const s = steps[n]
  if (!s) return false
  if (n === 0) return true
  return s.tool !== steps[n - 1].tool || !s.sameChat
}
