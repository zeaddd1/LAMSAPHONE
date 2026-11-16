// تنبيهات المحادثات في لوحة التحكم: صوت + إشعار المتصفح + عدّاد في عنوان التبويب.
// تعمل ما دامت اللوحة مفتوحة في المتصفح (على الكمبيوتر أو الجوال).

export type AlertSummary = { human: number; orders: number; latest: { id: string; name: string | null; text: string | null } | null }

let ctx: AudioContext | null = null
// نغمة عالية متكررة (ثلاث نبضات) حتى لا تفوت الموظف
export function beep(urgent = true) {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    ctx = ctx || new AC()
    const c = ctx!
    if (c.state === "suspended") c.resume().catch(() => {})
    const pulses = urgent ? 3 : 1
    for (let i = 0; i < pulses; i++) {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = "square"
      o.frequency.value = urgent ? 980 : 660
      const t = c.currentTime + i * 0.28
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      o.connect(g).connect(c.destination)
      o.start(t)
      o.stop(t + 0.22)
    }
  } catch {
    /* المتصفح يمنع الصوت قبل أول نقرة */
  }
}

export function askNotifyPermission() {
  try {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {})
  } catch {
    /* غير مدعوم */
  }
}

export function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(title, { body, tag: "lamsa-assistant", requireInteraction: true } as any)
      n.onclick = () => {
        window.focus()
        if (!location.pathname.endsWith("/conversations")) location.href = "/app/conversations"
        n.close()
      }
    }
  } catch {
    /* غير مدعوم */
  }
}

const baseTitle = () => document.title.replace(/^\(\d+\)\s*🔔\s*/, "")
export function setTitleBadge(n: number) {
  document.title = n > 0 ? `(${n}) 🔔 ${baseTitle()}` : baseTitle()
}

// يقارن الملخص الجديد بالسابق ويطلق التنبيه عند الزيادة فقط
export function handleSummary(prev: AlertSummary | null, next: AlertSummary) {
  setTitleBadge(next.human + next.orders)
  if (!prev) return
  if (next.human > prev.human) {
    beep(true)
    notify("عميل يحتاج موظفاً 🔔", `${next.latest?.name || "عميل"}: ${next.latest?.text || ""}`.slice(0, 140))
  } else if (next.orders > prev.orders) {
    beep(true)
    notify("طلب جديد ينتظر التأكيد 🛒", "افتح المحادثات لتأكيد الطلب")
  }
}
