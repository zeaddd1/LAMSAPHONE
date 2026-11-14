import { toast } from "@medusajs/ui"
import { compressFiles, needsCompression, TARGET_BYTES } from "./image-compress"

// يعمل مرة واحدة عند تحميل لوحة التحكم:
// 1) عند اختيار صور (زر أو سحب وإفلات) يضغط أي صورة أكبر من الحد قبل أن تراها اللوحة.
// 2) احتياطاً: يضغط الصور داخل طلب الرفع نفسه، ويقسّم الطلب إلى ملف لكل طلب
//    إذا تجاوز مجموع الملفات الحد، ثم يدمج النتائج كما تتوقعها اللوحة.

const FLAG = "__lamsaUploadInterceptor"
const forwarded = new WeakSet<Event>()

const imageFiles = (list: FileList | null | undefined) => Array.from(list || [])

// الإشعار اختياري: أي خلل فيه لا يوقف الضغط أو الرفع
const notify = async <T>(count: number, work: Promise<T>) => {
  const t = toast as any
  let id: unknown
  try {
    const text = `جارٍ ضغط ${count > 1 ? `${count} صور` : "الصورة"} مع الحفاظ على الجودة...`
    id = typeof t.loading === "function" ? t.loading(text) : t.info?.(text)
  } catch {
    // تجاهل
  }
  try {
    return await work
  } finally {
    try {
      if (id !== undefined) t.dismiss?.(id)
    } catch {
      // تجاهل
    }
  }
}

const toFileList = (files: File[]) => {
  const dt = new DataTransfer()
  files.forEach((f) => dt.items.add(f))
  return dt
}

const onChange = (event: Event) => {
  if (forwarded.has(event)) return
  const input = event.target
  if (!(input instanceof HTMLInputElement) || input.type !== "file") return
  const files = imageFiles(input.files)
  const big = files.filter(needsCompression)
  if (!big.length) return

  event.stopImmediatePropagation()
  void notify(big.length, compressFiles(files).catch(() => files)).then((out) => {
    input.files = toFileList(out).files
    const next = new Event("change", { bubbles: true })
    forwarded.add(next)
    input.dispatchEvent(next)
  })
}

const onDrop = (event: Event) => {
  if (forwarded.has(event) || !(event instanceof DragEvent)) return
  const files = imageFiles(event.dataTransfer?.files)
  const big = files.filter(needsCompression)
  if (!big.length) return

  const target = event.target as EventTarget
  event.preventDefault()
  event.stopImmediatePropagation()
  void notify(big.length, compressFiles(files).catch(() => files)).then((out) => {
    const next = new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: event.clientX,
      clientY: event.clientY,
      dataTransfer: toFileList(out),
    })
    forwarded.add(next)
    target.dispatchEvent(next)
  })
}

const isUploadRequest = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase()
  return method === "POST" && /\/admin\/uploads\/?(\?.*)?$/.test(url) && init?.body instanceof FormData
}

const installFetch = () => {
  const original = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isUploadRequest(input, init)) return original(input, init)

    const form = init!.body as FormData
    const entries = Array.from(form.entries())
    const files = entries.filter((e): e is [string, File] => e[1] instanceof File)
    if (!files.length) return original(input, init)

    const big = files.filter(([, f]) => needsCompression(f)).length
    const work = compressFiles(files.map(([, f]) => f))
    const compressed = big ? await notify(big, work) : await work
    const others = entries.filter((e) => !(e[1] instanceof File))

    const build = (subset: Array<[string, File]>) => {
      const fd = new FormData()
      others.forEach(([k, v]) => fd.append(k, v as string))
      subset.forEach(([k, f]) => fd.append(k, f, f.name))
      return original(input, { ...init, body: fd })
    }

    const pairs = files.map(([k], i) => [k, compressed[i]] as [string, File])
    const total = pairs.reduce((s, [, f]) => s + f.size, 0)
    if (pairs.length === 1 || total <= TARGET_BYTES) return build(pairs)

    // ملف واحد في كل طلب حتى لا يتجاوز الطلب الحد، ثم ندمج { files: [...] }
    const merged: unknown[] = []
    for (const pair of pairs) {
      const res = await build([pair])
      if (!res.ok) return res
      const body = await res.clone().json()
      merged.push(...(body?.files || []))
    }
    return new Response(JSON.stringify({ files: merged }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }
}

export const installUploadInterceptor = () => {
  if (typeof window === "undefined" || (window as any)[FLAG]) return
  ;(window as any)[FLAG] = true
  document.addEventListener("change", onChange, true)
  document.addEventListener("drop", onDrop, true)
  installFetch()
}
