import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// يجلب صورة من رابط عام (للإضافة السريعة: "رابط صورة")، لأن المتصفح لا يستطيع جلب صور المواقع الأخرى مباشرة.
// للمدير فقط. نقبل https وصيغ الصور فقط، ونرفض العناوين الداخلية والملفات الكبيرة.
const MAX = 15 * 1024 * 1024

function blockedHost(host: string): boolean {
  const h = host.toLowerCase()
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return true // عناوين IP مباشرة
  return false
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  let url: URL
  try {
    url = new URL(String(req.query.url || ""))
  } catch {
    res.status(400).json({ message: "رابط غير صالح" })
    return
  }
  if (url.protocol !== "https:" || blockedHost(url.hostname)) {
    res.status(400).json({ message: "يُقبل رابط https عام فقط" })
    return
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 LamsaPhoneQuickAdd", Accept: "image/*" } })
    const type = (r.headers.get("content-type") || "").split(";")[0].trim()
    if (!r.ok || !type.startsWith("image/")) {
      res.status(400).json({ message: "الرابط لا يعيد صورة" })
      return
    }
    const len = Number(r.headers.get("content-length") || 0)
    if (len > MAX) {
      res.status(400).json({ message: "الصورة أكبر من 15MB" })
      return
    }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX) {
      res.status(400).json({ message: "الصورة أكبر من 15MB" })
      return
    }
    res.setHeader("Content-Type", type)
    res.setHeader("Cache-Control", "no-store")
    res.status(200).send(buf)
  } catch {
    res.status(400).json({ message: "تعذّر تحميل الصورة" })
  } finally {
    clearTimeout(timer)
  }
}
