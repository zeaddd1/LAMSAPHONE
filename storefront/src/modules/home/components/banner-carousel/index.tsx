"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { useEffect, useState } from "react"

type Banner = { id: string; badge: string; title: string; subtitle: string; cta: string; link: string; image: string; theme: string }

const THEME: Record<string, { bg: string; fg: string; sub: string }> = {
  navy: { bg: "linear-gradient(135deg,#0F2A47 0%,#1d4470 100%)", fg: "#fff", sub: "rgba(255,255,255,.8)" },
  orange: { bg: "linear-gradient(135deg,#FF6000 0%,#ff8a3d 100%)", fg: "#fff", sub: "rgba(255,255,255,.9)" },
  dark: { bg: "linear-gradient(135deg,#0b0b0b 0%,#2a2a2a 100%)", fg: "#fff", sub: "rgba(255,255,255,.75)" },
  light: { bg: "linear-gradient(135deg,#f6f7f9 0%,#ffffff 100%)", fg: "#0F2A47", sub: "#4b5563" },
}

const btn = "rounded-lg bg-brand-orange px-6 py-3 font-bold text-white shadow-lg hover:opacity-90"
const btnStyle = (theme: string) => (theme === "orange" ? { background: "#0F2A47" } : undefined)

/** إعلانات الصفحة الرئيسية (تُدار من صفحة "واجهة المتجر" في اللوحة): تتبدل كل 6 ثوانٍ، والصور تُحمَّل عند ظهورها فقط */
export default function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0)
  const [seen, setSeen] = useState<Set<number>>(new Set([0]))
  const [pause, setPause] = useState(false)
  const n = banners.length
  const go = (k: number) => {
    const j = (k + n) % n
    setI(j)
    setSeen((s) => new Set(Array.from(s).concat(j)))
  }
  useEffect(() => {
    if (n < 2 || pause) return
    const t = setTimeout(() => go(i + 1), 6000)
    return () => clearTimeout(t)
  }, [i, n, pause])

  return (
    <section className="relative w-full overflow-hidden" onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)} aria-roledescription="carousel">
      {banners.map((b, k) => {
        const th = THEME[b.theme] || THEME.navy
        return (
          <div key={b.id} className={k === i ? "block" : "hidden"} style={{ background: th.bg, color: th.fg }} aria-hidden={k !== i}>
            <div className="content-container grid min-h-[300px] grid-cols-1 items-center gap-6 py-10 small:min-h-[380px] small:grid-cols-[1.2fr_1fr] small:py-14">
              <div className="flex flex-col items-start gap-4">
                {b.badge && <span className="rounded-full bg-white/20 px-3 py-1 text-small-semi backdrop-blur">{b.badge}</span>}
                <h2 className="text-3xl font-bold leading-tight small:text-5xl">{b.title}</h2>
                {b.subtitle && <p className="max-w-xl text-base-regular" style={{ color: th.sub }}>{b.subtitle}</p>}
                {b.cta && b.link && (/^https:\/\//.test(b.link) ? (
                  <a href={b.link} target="_blank" rel="noopener noreferrer" className={btn} style={btnStyle(b.theme)}>
                    {b.cta}
                  </a>
                ) : (
                  <LocalizedClientLink href={b.link} className={btn} style={btnStyle(b.theme)}>
                    {b.cta}
                  </LocalizedClientLink>
                ))}
              </div>
              {b.image && seen.has(k) && (
                <div className="relative mx-auto aspect-square w-full max-w-[320px] small:max-w-[360px]">
                  <div className="absolute inset-4 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
                  <Image src={b.image} alt={b.title} fill priority={k === 0} sizes="(max-width: 1024px) 70vw, 360px" className="rounded-3xl bg-white object-contain p-4 shadow-2xl" />
                </div>
              )}
            </div>
          </div>
        )
      })}
      {n > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((b, k) => (
            <button key={b.id} type="button" aria-label={`إعلان ${k + 1}`} onClick={() => go(k)} className={`h-2 rounded-full transition-all ${k === i ? "w-7 bg-white" : "w-2 bg-white/50"}`} />
          ))}
        </div>
      )}
    </section>
  )
}
