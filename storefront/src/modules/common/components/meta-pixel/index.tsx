"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"
import { useEffect, useRef } from "react"

// كود Meta Pixel الأساسي + PageView عند كل تنقّل بين الصفحات
export default function MetaPixel({ pixelId }: { pixelId?: string }) {
  const META_PIXEL_ID = (pixelId || "").trim()
  // يخبر trackMeta ألا ينتظر إن لم يُضبط Pixel
  if (typeof window !== "undefined") (window as any).__lpMetaPixel = !!META_PIXEL_ID

  const pathname = usePathname()
  // أول PageView يرسله الكود الأساسي نفسه، ثم نرسل واحداً عند كل تغيّر في المسار
  const lastPath = useRef(pathname)

  useEffect(() => {
    if (!META_PIXEL_ID || lastPath.current === pathname) return
    lastPath.current = pathname
    ;(window as any).fbq?.("track", "PageView")
  }, [pathname, META_PIXEL_ID])

  if (!META_PIXEL_ID) return null

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(META_PIXEL_ID)});
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(META_PIXEL_ID)}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}
