// حسابات قص/ملاءمة الصور لصفحة الإضافة السريعة (بلا أي استيراد، تُختبر مباشرة).

// المقاس المثالي لصور المنتج في المتجر: عمودي 1200×1400 والمنتج في المنتصف
export const TARGET_W = 1200
export const TARGET_H = 1400

export type Box = { x: number; y: number; w: number; h: number }
export type FitMode = "contain" | "cover"

// contain: الصورة كاملة داخل الإطار مع هامش (لا يُقص شيء من المنتج)
// cover: تملأ الإطار وتُقص الأطراف الزائدة من المنتصف
export function fitBox(srcW: number, srcH: number, dstW = TARGET_W, dstH = TARGET_H, mode: FitMode = "contain", margin = 0.06): Box {
  if (srcW <= 0 || srcH <= 0) return { x: 0, y: 0, w: dstW, h: dstH }
  if (mode === "cover") {
    const s = Math.max(dstW / srcW, dstH / srcH)
    const w = Math.round(srcW * s)
    const h = Math.round(srcH * s)
    return { x: Math.round((dstW - w) / 2), y: Math.round((dstH - h) / 2), w, h }
  }
  const availW = dstW * (1 - 2 * margin)
  const availH = dstH * (1 - 2 * margin)
  const s = Math.min(availW / srcW, availH / srcH)
  const w = Math.round(srcW * s)
  const h = Math.round(srcH * s)
  return { x: Math.round((dstW - w) / 2), y: Math.round((dstH - h) / 2), w, h }
}

// يجد حدود المنتج بإزالة الخلفية المتجانسة حول الصورة (مثل الأبيض في صور الموردين)
// data: بكسلات RGBA لنسخة مصغّرة من الصورة بعرض w وارتفاع h
export function trimBox(data: ArrayLike<number>, w: number, h: number, tolerance = 28): Box & { bg: [number, number, number]; uniform: boolean } {
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]
  }
  // لون الخلفية = متوسط الزوايا الأربع
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)]
  const bg: [number, number, number] = [0, 1, 2].map((k) => Math.round(corners.reduce((s, c) => s + c[k], 0) / 4)) as any
  const cornersAlike = corners.every((c) => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]) <= tolerance * 1.5)
  if (!cornersAlike) return { x: 0, y: 0, w, h, bg: [255, 255, 255], uniform: false } // خلفية غير متجانسة: لا قص

  const isBg = (x: number, y: number) => {
    const [r, g, b, a] = px(x, y)
    if (a < 16) return true
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) <= tolerance
  }
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBg(x, y)) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h, bg, uniform: true } // صورة فارغة
  const box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
  // لا نقص إن كان المنتج يملأ الصورة تقريباً أو كان صغيراً جداً (ضجيج)
  if (box.w * box.h > 0.92 * w * h || box.w < w * 0.08 || box.h < h * 0.08) return { x: 0, y: 0, w, h, bg, uniform: true }
  return { ...box, bg, uniform: true }
}

// اختيار الجودة: نبدأ عالية وننزل حتى يصبح الحجم ضمن الهدف
export const QUALITY_STEPS = [0.86, 0.8, 0.74, 0.68, 0.6, 0.5]
export const TARGET_BYTES = 300 * 1024 // هدف خفيف لسرعة الموقع
export const MAX_BYTES = 950 * 1024 // حد الرفع في الخادم 1MB، لا نتجاوزه أبداً
