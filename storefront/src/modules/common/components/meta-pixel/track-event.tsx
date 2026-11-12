"use client"

import { trackMeta } from "@lib/meta-pixel"
import { useEffect, useRef } from "react"

// يرسل حدثاً مرة واحدة عند ظهور الصفحة (مثل Purchase في صفحة تأكيد الطلب)
export default function TrackMetaEvent({
  event,
  params,
  onceKey,
}: {
  event: string
  params?: Record<string, unknown>
  onceKey?: string
}) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    // لا نكرر Purchase إذا أعاد العميل تحميل الصفحة
    if (onceKey) {
      try {
        const k = `meta_ev_${event}_${onceKey}`
        if (sessionStorage.getItem(k)) return
        sessionStorage.setItem(k, "1")
      } catch {}
    }
    trackMeta(event, params)
  }, [])
  return null
}
