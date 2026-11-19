"use client"

import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

type ProductVideo = { url: string; poster?: string }
type Item = { kind: "image"; url: string; key: string } | { kind: "video"; video: ProductVideo; key: string }

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  // فيديوهات المنتج من الإضافة السريعة (metadata.videos): تظهر بعد الصورة الرئيسية
  videos?: ProductVideo[]
  title?: string
}

// معرض خفيف: تُحمَّل الصورة الحالية فقط (والتالية مسبقاً بهدوء)، والباقي عند الضغط على "التالي"
// أو "عرض كل الصور". صور المنتج مربعة فالإطار مربع، والصور الأخرى تظهر كاملة بلا قص.
const ImageGallery = ({ images, videos = [], title = "" }: ImageGalleryProps) => {
  const items: Item[] = []
  images.forEach((image, index) => {
    if (image.url) items.push({ kind: "image", url: image.url, key: image.id })
    if (index === 0) videos.forEach((video, k) => items.push({ kind: "video", video, key: `v${k}` }))
  })
  if (!images.length) videos.forEach((video, k) => items.push({ kind: "video", video, key: `v${k}` }))

  const [i, setI] = useState(0)
  const [seen, setSeen] = useState<Set<number>>(new Set([0, 1]))
  const [all, setAll] = useState(false)
  const touch = useRef<number | null>(null)
  const n = items.length

  const go = useCallback(
    (to: number) => {
      if (!n) return
      const k = (to + n) % n
      setI(k)
      setSeen((s) => new Set(Array.from(s).concat([k, (k + 1) % n])))
    },
    [n]
  )

  useEffect(() => {
    if (!all) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAll(false)
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [all])

  if (!n) return <div className="aspect-square w-full rounded-large bg-gray-50" />

  const render = (it: Item, k: number, eager: boolean) =>
    it.kind === "video" ? (
      <video
        src={it.video.url}
        poster={it.video.poster}
        className="absolute inset-0 h-full w-full object-contain bg-white"
        controls
        muted
        playsInline
        loop
        autoPlay={k === i}
        preload={eager ? "metadata" : "none"}
      />
    ) : (
      <Image
        src={it.url}
        alt={`${title} - صورة ${k + 1}`}
        fill
        priority={k === 0}
        loading={k === 0 ? "eager" : "lazy"}
        sizes="(max-width: 576px) 100vw, (max-width: 992px) 60vw, 640px"
        className="object-contain"
      />
    )

  return (
    <div className="flex flex-col gap-3 small:mx-10">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-large bg-white"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          // الواجهة عربية (من اليمين لليسار): السحب لليسار = التالي
          if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1))
        }}
      >
        {items.map((it, k) =>
          seen.has(k) ? (
            <div key={it.key} className={`absolute inset-0 transition-opacity duration-300 ${k === i ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={k !== i}>
              {render(it, k, k === i)}
            </div>
          ) : null
        )}
        {n > 1 && (
          <>
            <button type="button" aria-label="السابق" onClick={() => go(i - 1)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl shadow-md hover:bg-white">
              ›
            </button>
            <button type="button" aria-label="التالي" onClick={() => go(i + 1)} className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl shadow-md hover:bg-white">
              ‹
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white">
              {i + 1} / {n}
            </span>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {items.map((it, k) => (
              <button
                key={it.key}
                type="button"
                aria-label={`صورة ${k + 1}`}
                onClick={() => go(k)}
                className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-brand-orange" : "w-2 bg-gray-300 hover:bg-gray-400"}`}
              />
            ))}
          </div>
          <button type="button" onClick={() => setAll(true)} className="shrink-0 rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold hover:bg-gray-50">
            عرض كل الصور ({n})
          </button>
        </div>
      )}

      {all && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-white" role="dialog" aria-modal="true" aria-label="كل الصور">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
            <span className="text-sm font-semibold">{title} ({n})</span>
            <button type="button" onClick={() => setAll(false)} className="rounded-full bg-gray-100 px-3 py-1 text-sm">إغلاق ✕</button>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 p-4 small:grid-cols-2">
            {items.map((it, k) => (
              <button key={it.key} type="button" onClick={() => (go(k), setAll(false))} className="relative aspect-square w-full overflow-hidden rounded-large border bg-white">
                {render(it, k, false)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageGallery
