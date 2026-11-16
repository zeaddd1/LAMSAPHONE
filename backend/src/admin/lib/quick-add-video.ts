import { drawBranding, loadLogo } from "./quick-add-image"

// أداة الفيديو: تقبل أي فيديو يشغّله المتصفح، وتعيد ترميزه في المتصفح نفسه إلى مقاس 720×840
// (نفس نسبة صور المتجر 6:7) مع الإطار والشعار، بحجم أقل من 1MB حتى لا نرفع حد الرفع في السيرفر.
// نفضّل MP4 لأن إنستغرام وفيسبوك يقبلانه؛ وإن لم يدعمه المتصفح نستخدم WebM (للمتجر فقط).

export const VIDEO_W = 720
export const VIDEO_H = 840
export const VIDEO_MAX_SECONDS = 25
const TARGET_BYTES = 900 * 1024
const HARD_MAX = 980 * 1024

export type ProcessedVideo = {
  name: string
  preview: string
  file: File
  poster: File // صورة غلاف JPEG من أول لقطة
  type: "mp4" | "webm"
  seconds: number
  originalBytes: number
}

function pickMime(): { mime: string; type: "mp4" | "webm" } | null {
  const R: any = (window as any).MediaRecorder
  if (!R) return null
  const options: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ]
  for (const [mime, type] of options) if (R.isTypeSupported?.(mime)) return { mime, type }
  return null
}

function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video")
    v.preload = "auto"
    v.playsInline = true
    v.muted = true // نأخذ الصوت عبر AudioContext، فلا يُسمع أثناء المعالجة
    v.src = URL.createObjectURL(file)
    v.onloadeddata = () => resolve(v)
    v.onerror = () => reject(new Error("تعذّر قراءة الفيديو (جرّب MP4)"))
  })
}

// يرسم اللقطة الحالية على الإطار بملء المربع (قص الزوائد من الوسط) ثم الهوية
function drawFrame(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, logo: HTMLImageElement | null, brand: boolean) {
  const sw = v.videoWidth, sh = v.videoHeight
  const s = Math.max(VIDEO_W / sw, VIDEO_H / sh)
  const w = sw * s, h = sh * s
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  ctx.drawImage(v, (VIDEO_W - w) / 2, (VIDEO_H - h) / 2, w, h)
  if (brand) drawBranding(ctx, VIDEO_W, VIDEO_H, logo)
}

async function record(file: File, brand: boolean, factor: number, onProgress?: (p: number) => void): Promise<{ blob: Blob; poster: Blob; type: "mp4" | "webm"; seconds: number }> {
  const pick = pickMime()
  if (!pick) throw new Error("متصفحك لا يدعم معالجة الفيديو. استخدم Chrome أو Edge.")
  const v = await loadVideo(file)
  const seconds = Math.min(v.duration || 0, VIDEO_MAX_SECONDS)
  if (!(seconds > 0)) throw new Error("مدة الفيديو غير معروفة")
  const logo = brand ? await loadLogo() : null

  const canvas = document.createElement("canvas")
  canvas.width = VIDEO_W
  canvas.height = VIDEO_H
  const ctx = canvas.getContext("2d")!

  // غلاف: أول لقطة
  drawFrame(ctx, v, logo, brand)
  const poster = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85))

  const stream = (canvas as any).captureStream(30) as MediaStream
  // الصوت الأصلي (إن وُجد) بجودة منخفضة
  let audioCtx: AudioContext | null = null
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    audioCtx = new AC()
    const srcNode = audioCtx!.createMediaElementSource(v)
    const dest = audioCtx!.createMediaStreamDestination()
    srcNode.connect(dest)
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
  } catch {
    /* بلا صوت */
  }

  const audioBits = stream.getAudioTracks().length ? 48_000 : 0
  const videoBits = Math.max(220_000, Math.floor(((TARGET_BYTES * 8) / seconds - audioBits) * factor))
  const rec = new MediaRecorder(stream, { mimeType: pick.mime, videoBitsPerSecond: videoBits, audioBitsPerSecond: audioBits || undefined })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<void>((r) => (rec.onstop = () => r()))

  v.currentTime = 0
  rec.start(500)
  await v.play()
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (v.ended || v.currentTime >= seconds) return resolve()
      drawFrame(ctx, v, logo, brand)
      onProgress?.(Math.min(1, v.currentTime / seconds))
      requestAnimationFrame(tick)
    }
    tick()
  })
  v.pause()
  rec.stop()
  await done
  stream.getTracks().forEach((t) => t.stop())
  audioCtx?.close().catch(() => {})
  URL.revokeObjectURL(v.src)
  return { blob: new Blob(chunks, { type: pick.mime.split(";")[0] }), poster, type: pick.type, seconds }
}

export async function processVideo(file: File, opts: { brand: boolean }, onProgress?: (p: number) => void): Promise<ProcessedVideo> {
  let r = await record(file, opts.brand, 1, onProgress)
  // إن تجاوز الحد نعيد بجودة أقل مرة واحدة
  if (r.blob.size > HARD_MAX) r = await record(file, opts.brand, (HARD_MAX / r.blob.size) * 0.85, onProgress)
  if (r.blob.size > HARD_MAX) throw new Error("الفيديو طويل جداً بعد الضغط. قصّه إلى 20 ثانية تقريباً")
  const name = (file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "video").slice(0, 40)
  return {
    name,
    preview: URL.createObjectURL(r.blob),
    file: new File([r.blob], `${name}.${r.type}`, { type: r.blob.type }),
    poster: new File([r.poster], `${name}-poster.jpg`, { type: "image/jpeg" }),
    type: r.type,
    seconds: Math.round(r.seconds),
    originalBytes: file.size,
  }
}
