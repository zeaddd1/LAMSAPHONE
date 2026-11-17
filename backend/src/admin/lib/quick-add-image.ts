import { FitMode, MAX_BYTES, QUALITY_STEPS, TARGET_BYTES, TARGET_H, TARGET_W, fitBox, trimBox } from "./quick-add-geometry"
import { STORE_LOGO } from "./store-logo"

// أداة الصور: تقبل أي مقاس وأي صيغة يفهمها المتصفح، وتُخرج:
// - webp بمقاس 1200×1400 للمتجر (خفيف وسريع)
// - jpeg بنفس المقاس لميتا (إنستغرام لا يقبل webp)
// كل المعالجة في المتصفح، فلا تحمّل على الخادم ولا تتجاوز حد الرفع 1MB.

export type ProcessOptions = { mode: FitMode; autoTrim: boolean; background: "auto" | "white"; brand?: boolean }

// ---------- هوية المتجر: شعار صغير شبه شفاف أسفل يمين الصورة ----------
let logoPromise: Promise<HTMLImageElement | null> | null = null
export function loadLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = STORE_LOGO
    })
  }
  return logoPromise
}

// يرسم ختم المتجر فوق الصورة أو إطار الفيديو (أسفل اليمين). نسبي للمقاس حتى يناسب أي دقة.
// ختم دائري: قرص أبيض بظل خفيف، حلقتان برتقاليتان، نص دائري، والشعار في المنتصف، بميلان خفيف.
export function drawBranding(ctx: CanvasRenderingContext2D, w: number, h: number, logo: HTMLImageElement | null) {
  if (!logo) return
  const unit = Math.min(w, h)
  const R = Math.round(unit * 0.095) // نصف قطر الختم (صغير وهادئ حتى لا يزعج)
  const margin = Math.round(unit * 0.03)
  const cx = w - margin - R
  const cy = h - margin - R
  const orange = "#FF6000"
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.17) // ميلان خفيف كختم مطبوع
  ctx.globalAlpha = 0.72 // شفافية خفيفة ليبقى الختم هادئاً فوق الصورة
  // القرص الأبيض
  ctx.save()
  ctx.shadowColor = "rgba(0, 0, 0, 0.12)"
  ctx.shadowBlur = Math.round(unit * 0.012)
  ctx.shadowOffsetY = Math.round(unit * 0.002)
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)"
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // حلقتان: خارجية سميكة وداخلية رفيعة
  ctx.strokeStyle = orange
  ctx.lineWidth = Math.max(1.5, R * 0.035)
  ctx.beginPath(); ctx.arc(0, 0, R * 0.93, 0, Math.PI * 2); ctx.stroke()
  ctx.lineWidth = Math.max(1, R * 0.014)
  ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, Math.PI * 2); ctx.stroke()
  // نص دائري بين الحلقتين
  const text = "LAMSA PHONE • lamsaphone.yemenbay.com • "
  const fs = Math.round(R * 0.12)
  ctx.fillStyle = orange
  ctx.font = `700 ${fs}px Arial, Helvetica, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const rt = R * 0.815
  // توزيع الحروف حسب عرض كل حرف حتى تبدو المسافات متساوية حول الدائرة
  const chars = Array.from(text)
  const widths = chars.map((ch) => ctx.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0)
  let a = -Math.PI / 2
  chars.forEach((ch: string, i: number) => {
    const span = (widths[i] / total) * Math.PI * 2
    ctx.save()
    ctx.rotate(a + span / 2 + Math.PI / 2)
    ctx.translate(0, -rt)
    ctx.fillText(ch, 0, 0)
    ctx.restore()
    a += span
  })
  // الشعار في المنتصف
  const lw = R * 1.0
  const lh = (logo.naturalHeight / logo.naturalWidth) * lw
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh)
  ctx.restore()
}

export type ProcessedImage = {
  name: string
  preview: string // رابط معاينة محلي
  webp: File
  jpeg: File
  originalBytes: number
}

async function loadBitmap(file: File): Promise<{ img: CanvasImageSource; w: number; h: number; close: () => void }> {
  if ("createImageBitmap" in window) {
    try {
      // يحترم اتجاه صور الجوال (EXIF)
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any)
      return { img: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() }
    } catch {
      /* نجرّب الطريقة القديمة */
    }
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = "async"
  img.src = url
  await img.decode()
  return { img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((r) => canvas.toBlob(r, type, q))
}

async function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  let last: Blob | null = null
  for (const q of QUALITY_STEPS) {
    const b = await toBlob(canvas, type, q)
    if (!b) continue
    last = b
    if (b.size <= TARGET_BYTES) return b
  }
  if (last && last.size <= MAX_BYTES) return last
  // صورة معقّدة جداً: نصغّر قليلاً حتى تدخل تحت الحد
  const small = document.createElement("canvas")
  small.width = Math.round(canvas.width * 0.8)
  small.height = Math.round(canvas.height * 0.8)
  small.getContext("2d")!.drawImage(canvas, 0, 0, small.width, small.height)
  const b = await toBlob(small, type, 0.6)
  if (!b) throw new Error("تعذّر تحويل الصورة")
  return b
}

const baseName = (n: string) =>
  (n.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "product").slice(0, 40)

export async function processImage(file: File, opts: ProcessOptions): Promise<ProcessedImage> {
  const src = await loadBitmap(file)
  try {
    // 1) تحليل نسخة مصغّرة لإيجاد حدود المنتج ولون الخلفية
    let crop = { x: 0, y: 0, w: src.w, h: src.h }
    let bg = "#ffffff"
    let uniform = true // خلفية متجانسة (صور الموردين/الاستوديو)
    if (opts.autoTrim || opts.background === "auto") {
      const scale = Math.min(1, 256 / Math.max(src.w, src.h))
      const aw = Math.max(1, Math.round(src.w * scale))
      const ah = Math.max(1, Math.round(src.h * scale))
      const a = document.createElement("canvas")
      a.width = aw
      a.height = ah
      const actx = a.getContext("2d", { willReadFrequently: true })!
      actx.drawImage(src.img, 0, 0, aw, ah)
      const t = trimBox(actx.getImageData(0, 0, aw, ah).data, aw, ah)
      uniform = t.uniform
      if (opts.background === "auto") bg = `rgb(${t.bg[0]},${t.bg[1]},${t.bg[2]})`
      if (opts.autoTrim) {
        const pad = 2
        const x = Math.max(0, (t.x - pad) / scale)
        const y = Math.max(0, (t.y - pad) / scale)
        crop = { x, y, w: Math.min(src.w - x, (t.w + 2 * pad) / scale), h: Math.min(src.h - y, (t.h + 2 * pad) / scale) }
      }
    }

    // 2) الرسم على إطار 1200×1400 والمنتج في المنتصف
    const canvas = document.createElement("canvas")
    canvas.width = TARGET_W
    canvas.height = TARGET_H
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, TARGET_W, TARGET_H)
    // صور المحل (خلفية غير متجانسة): تملأ الإطار كاملاً بلا أي فراغ (قص خفيف للأطراف)
    const photo = !uniform
    const box = fitBox(crop.w, crop.h, TARGET_W, TARGET_H, photo ? "cover" : opts.mode)
    ctx.drawImage(src.img, crop.x, crop.y, crop.w, crop.h, box.x, box.y, box.w, box.h)
    if (opts.brand) drawBranding(ctx, TARGET_W, TARGET_H, await loadLogo())

    // 3) التحويل: webp للمتجر (أو jpeg إن كان المتصفح لا يدعم webp) و jpeg لميتا
    const name = baseName(file.name)
    let webpBlob = await encode(canvas, "image/webp")
    let webpType = "image/webp"
    let ext = "webp"
    if (webpBlob.type !== "image/webp") {
      webpBlob = await encode(canvas, "image/jpeg")
      webpType = "image/jpeg"
      ext = "jpg"
    }
    const jpegBlob = await encode(canvas, "image/jpeg")
    return {
      name,
      preview: URL.createObjectURL(webpBlob),
      webp: new File([webpBlob], `${name}.${ext}`, { type: webpType }),
      jpeg: new File([jpegBlob], `${name}-meta.jpg`, { type: "image/jpeg" }),
      originalBytes: file.size,
    }
  } finally {
    src.close()
  }
}

export const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`)
