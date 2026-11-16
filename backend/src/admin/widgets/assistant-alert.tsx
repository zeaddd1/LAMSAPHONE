import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useRef, useState } from "react"
import { sdk } from "../lib/sdk"
import { AlertSummary, askNotifyPermission, handleSummary } from "../lib/assistant-alerts"

// شريط تنبيه أعلى صفحات الطلبات والمنتجات: يظهر عند وجود عميل يحتاج موظفاً أو طلب ينتظر التأكيد.
// ويجعل "المحادثات" أول صفحة تُفتح بعد الدخول للوحة (مرة واحدة في كل جلسة).
const AssistantAlert = () => {
  const [s, setS] = useState<AlertSummary | null>(null)
  const prev = useRef<AlertSummary | null>(null)

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("lamsa_home_done") && /\/orders\/?$/.test(location.pathname)) {
        sessionStorage.setItem("lamsa_home_done", "1")
        location.replace("/app/conversations")
        return
      }
      sessionStorage.setItem("lamsa_home_done", "1")
    } catch {
      /* التخزين غير متاح */
    }
    askNotifyPermission()
    const tick = () =>
      sdk.client
        .fetch<AlertSummary>("/admin/assistant/summary")
        .then((n) => {
          handleSummary(prev.current, n)
          prev.current = n
          setS(n)
        })
        .catch(() => {})
    tick()
    const t = setInterval(tick, 20000)
    return () => clearInterval(t)
  }, [])

  if (!s || (!s.human && !s.orders)) return null
  return (
    <a
      href="/app/conversations"
      dir="rtl"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-ui-tag-red-border bg-ui-tag-red-bg px-4 py-3 text-sm font-medium text-ui-tag-red-text"
    >
      <span>
        🔔 {s.human > 0 && `${s.human} محادثة تحتاج موظفاً`}
        {s.human > 0 && s.orders > 0 && " · "}
        {s.orders > 0 && `${s.orders} طلب ينتظر التأكيد`}
      </span>
      <span className="underline">فتح المحادثات</span>
    </a>
  )
}

export const config = defineWidgetConfig({ zone: ["order.list.before", "product.list.before"] })

export default AssistantAlert
