// ضغط الصور في متصفح المدير قبل الرفع، حتى لا يتجاوز أي ملف حد الرفع (1 ميغا)
// بدون أي معالجة على السيرفر. الأولوية للجودة: نفس الأبعاد وجودة WebP عالية أولاً،
// ثم نخفّض الجودة تدريجياً، ولا نصغّر الأبعاد إلا إذا لم يكفِ ذلك.

// أقل قليلاً من 1 ميغا لترك هامش لترويسات الطلب
export const TARGET_BYTES = 950 * 1000
// أي صورة أطول ضلع فيها أكبر من هذا تُصغَّر إليه (أكبر بكثير مما يعرضه المتجر)
const MAX_EDGE = 4000
// لا نصغّر تحت هذا الحد مهما حصل
const MIN_EDGE = 1200
// WebP بجودة 0.92 لا يُفرّق بالعين عن الأصل؛ ننزل خطوات قليلة فقط ثم نصغّر الأبعاد
const QUALITIES = [0.92, 0.88, 0.84, 0.8]

const COMPRESSIBLE = /^image\/(jpeg|jpg|png|webp|bmp|avif|tiff)$/i

export const needsCompression = (file: File) =>
  COMPRESSIBLE.test(file.type) && file.size > TARGET_BYTES

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

const decode = async (file: File): Promise<Decoded> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" })
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      // نكمل بالطريقة القديمة
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} }
  } finally {
    URL.revokeObjectURL(url)
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

const draw = (img: Decoded, width: number, height: number, opaque: boolean) => {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas unavailable")
  if (opaque) {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img.source, 0, 0, width, height)
  return canvas
}

const renameTo = (name: string, ext: string) => {
  const base = name.replace(/\.[^./\\]+$/, "") || "image"
  return `${base}.${ext}`
}

/**
 * يعيد ملفاً أصغر من TARGET_BYTES بأعلى جودة ممكنة، أو الملف الأصلي كما هو
 * إذا لم يكن بحاجة للضغط أو تعذّر فك ترميزه (مثل HEIC في بعض المتصفحات).
 */
export const compressImage = async (file: File): Promise<File> => {
  if (!needsCompression(file)) return file

  let img: Decoded
  try {
    img = await decode(file)
  } catch {
    return file
  }

  try {
    const longest = Math.max(img.width, img.height)
    let scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
    // نجرّب WebP، وإن لم يدعمه المتصفح (Safari) نستخدم JPEG
    let type = "image/webp"
    let ext = "webp"
    let best: Blob | null = null

    for (;;) {
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      let canvas = draw(img, w, h, type === "image/jpeg")

      for (const q of QUALITIES) {
        const blob = await toBlob(canvas, type, q)
        if (!blob) break
        if (type === "image/webp" && blob.type !== "image/webp") {
          type = "image/jpeg"
          ext = "jpg"
          canvas = draw(img, w, h, true)
          const jpg = await toBlob(canvas, type, q)
          if (!jpg) break
          best = jpg
          if (jpg.size <= TARGET_BYTES) break
          continue
        }
        best = blob
        if (blob.size <= TARGET_BYTES) break
        // أكبر من ثلاثة أضعاف: خفض الجودة لن يكفي، ننتقل مباشرة لتصغير الأبعاد
        if (blob.size > TARGET_BYTES * 3) break
      }

      if (best && best.size <= TARGET_BYTES) break
      const edge = Math.max(w, h)
      if (edge <= MIN_EDGE) break
      // تصغير متناسب مع الحجم الزائد، بخطوات لا تقل عن 10%
      const ratio = best ? Math.sqrt(TARGET_BYTES / best.size) : 0.85
      scale = Math.max(scale * Math.min(ratio, 0.9), MIN_EDGE / Math.max(img.width, img.height))
    }

    if (!best || best.size >= file.size) return file
    return new File([best], renameTo(file.name, ext), {
      type: best.type || type,
      lastModified: file.lastModified,
    })
  } catch {
    return file
  } finally {
    img.close()
  }
}

export const compressFiles = (files: File[]) => Promise.all(files.map(compressImage))
