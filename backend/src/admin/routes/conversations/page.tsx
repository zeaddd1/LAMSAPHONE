import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { sdk } from "../../lib/sdk"

// صفحة "المحادثات": رسائل ماسنجر وإنستغرام وواتساب في مكان واحد.
// الرد الآلي يجيب أولاً، والموظف يتدخل وقت الحاجة، ويؤكد الطلبات بضغطة.

type Conv = {
  id: string
  channel: string
  external_id: string
  name: string | null
  mode: "bot" | "human"
  status: "open" | "closed"
  needs_human: boolean
  unread: number
  last_text: string | null
  last_message_at: string | null
  order_status: "pending" | "confirmed" | "cancelled" | null
  order_note: string | null
}
type Msg = { id: string; direction: "in" | "out"; sender: "customer" | "bot" | "staff"; text: string; created_at: string; intent?: string | null }

const CH: Record<string, { label: string; color: "blue" | "purple" | "green" | "grey" }> = {
  messenger: { label: "ماسنجر", color: "blue" },
  instagram: { label: "إنستغرام", color: "purple" },
  whatsapp: { label: "واتساب", color: "green" },
  test: { label: "تجربة", color: "grey" },
}
const time = (s?: string | null) => (s ? new Date(s).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" }) : "")

const ConversationsPage = () => {
  return (
    <Container className="p-0" dir="rtl">
      <div className="border-b px-6 py-4">
        <Heading level="h1">المحادثات</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          الرد الآلي يجيب العملاء فوراً، وأنت تتدخل عند الحاجة وتؤكد الطلبات من هنا. إعدادات الرد الآلي في صفحة{" "}
          <a className="underline" href="/app/meta-connect">ربط ميتا</a>.
        </Text>
      </div>
      <Inbox />
    </Container>
  )
}

function Inbox() {
  const [filter, setFilter] = useState("open")
  const [list, setList] = useState<Conv[]>([])
  const [counts, setCounts] = useState({ human: 0, orders: 0 })
  const [selId, setSelId] = useState<string | null>(null)
  const [conv, setConv] = useState<Conv | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const loadList = () =>
    sdk.client
      .fetch<{ conversations: Conv[]; counts: { human: number; orders: number } }>("/admin/assistant/conversations", { query: { filter } })
      .then((r) => {
        setList(r.conversations)
        setCounts(r.counts)
      })
      .catch(() => {})
  const loadConv = (id: string) =>
    sdk.client.fetch<{ conversation: Conv; messages: Msg[] }>(`/admin/assistant/conversations/${id}`).then((r) => {
      setConv(r.conversation)
      setMsgs(r.messages)
    })

  // تحديث تلقائي كل 10 ثوانٍ
  useEffect(() => {
    loadList()
    const t = setInterval(loadList, 10000)
    return () => clearInterval(t)
  }, [filter])
  useEffect(() => {
    if (!selId) return
    loadConv(selId).catch(() => {})
    const t = setInterval(() => loadConv(selId).catch(() => {}), 10000)
    return () => clearInterval(t)
  }, [selId])
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [msgs.length])

  const patch = async (body: Record<string, unknown>, ok: string) => {
    if (!conv) return
    setBusy(true)
    try {
      const r = await sdk.client.fetch<{ sent: { ok: boolean; error?: string } | null }>(`/admin/assistant/conversations/${conv.id}`, { method: "POST", body })
      if (r.sent && !r.sent.ok) toast.warning(`حُفظ، لكن لم تُرسل الرسالة: ${r.sent.error}`)
      else toast.success(ok)
      await Promise.all([loadConv(conv.id), loadList()])
    } catch (e: any) {
      toast.error(e?.message || "خطأ")
    } finally {
      setBusy(false)
    }
  }

  const send = async (correct: boolean) => {
    if (!conv || !text.trim()) return
    setBusy(true)
    try {
      const r = await sdk.client.fetch<{ sent: { ok: boolean; error?: string } }>(`/admin/assistant/conversations/${conv.id}/reply`, {
        method: "POST",
        body: { text, correct },
      })
      if (!r.sent.ok) toast.warning(`لم تُرسل: ${r.sent.error}`)
      setText("")
      await Promise.all([loadConv(conv.id), loadList()])
    } catch (e: any) {
      toast.error(e?.message || "خطأ")
    } finally {
      setBusy(false)
    }
  }

  const fix = async () => {
    const r = await sdk.client.fetch<{ text: string }>("/admin/assistant/correct", { method: "POST", body: { text } })
    setText(r.text)
  }

  const filters: [string, string, number?][] = [
    ["open", "المفتوحة"],
    ["human", "تحتاج موظف", counts.human],
    ["orders", "طلبات تنتظر التأكيد", counts.orders],
    ["closed", "المغلقة"],
  ]

  return (
    <div className="grid min-h-[70vh] gap-0 lg:grid-cols-[340px_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-e">
        <div className="flex flex-wrap gap-1 p-3">
          {filters.map(([k, label, n]) => (
            <Button key={k} size="small" variant={filter === k ? "primary" : "transparent"} onClick={() => setFilter(k)}>
              {label}
              {n ? <Badge size="2xsmall" color="red" className="ms-1">{n}</Badge> : null}
            </Button>
          ))}
        </div>
        <div className="max-h-[65vh] overflow-auto">
          {!list.length && <Text size="small" className="p-4 text-ui-fg-subtle">لا توجد محادثات هنا.</Text>}
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelId(c.id)}
              className={`flex w-full flex-col gap-1 border-b px-4 py-3 text-start hover:bg-ui-bg-subtle-hover ${selId === c.id ? "bg-ui-bg-subtle" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.name || c.external_id}</span>
                <Badge size="2xsmall" color={CH[c.channel]?.color || "grey"}>{CH[c.channel]?.label || c.channel}</Badge>
              </div>
              <span className="truncate text-xs text-ui-fg-subtle" dir="auto">{c.last_text}</span>
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-ui-fg-muted">
                {time(c.last_message_at)}
                {c.unread > 0 && <Badge size="2xsmall" color="blue">{c.unread} جديدة</Badge>}
                {c.needs_human && <Badge size="2xsmall" color="red">تحتاج موظف</Badge>}
                {c.order_status === "pending" && <Badge size="2xsmall" color="orange">طلب</Badge>}
                {c.mode === "bot" ? <Badge size="2xsmall" color="green">آلي</Badge> : <Badge size="2xsmall" color="grey">موظف</Badge>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[60vh] flex-col">
        {!conv ? (
          <Text className="m-auto text-ui-fg-subtle">اختر محادثة من القائمة</Text>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <Text weight="plus">{conv.name || conv.external_id}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {CH[conv.channel]?.label} · {conv.mode === "bot" ? "الرد الآلي يعمل" : "الموظف يرد (الآلي متوقف)"}
                </Text>
              </div>
              <div className="flex flex-wrap gap-2">
                {conv.mode === "human" ? (
                  <Button size="small" variant="secondary" isLoading={busy} onClick={() => patch({ mode: "bot" }, "عاد الرد الآلي")}>إعادة للرد الآلي</Button>
                ) : (
                  <Button size="small" variant="secondary" isLoading={busy} onClick={() => patch({ mode: "human" }, "أوقفت الرد الآلي لهذه المحادثة")}>أتولى المحادثة</Button>
                )}
                {conv.status === "open" ? (
                  <Button size="small" variant="transparent" isLoading={busy} onClick={() => patch({ status: "closed" }, "أُغلقت")}>إغلاق</Button>
                ) : (
                  <Button size="small" variant="transparent" isLoading={busy} onClick={() => patch({ status: "open" }, "أُعيد فتحها")}>إعادة فتح</Button>
                )}
              </div>
            </div>

            {conv.order_status && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-ui-bg-subtle px-4 py-2">
                <Text size="small">
                  طلب: <b>{conv.order_note || "—"}</b>{" "}
                  {conv.order_status === "pending" ? <Badge size="2xsmall" color="orange">ينتظر التأكيد</Badge> : conv.order_status === "confirmed" ? <Badge size="2xsmall" color="green">مؤكد</Badge> : <Badge size="2xsmall" color="grey">ملغي</Badge>}
                </Text>
                {conv.order_status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="small" isLoading={busy} onClick={() => patch({ order_status: "confirmed" }, "تم تأكيد الطلب وإبلاغ العميل")}>تأكيد الطلب ✓</Button>
                    <Button size="small" variant="danger" isLoading={busy} onClick={() => patch({ order_status: "cancelled" }, "أُلغي الطلب")}>إلغاء</Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 space-y-2 overflow-auto p-4" style={{ maxHeight: "50vh" }}>
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
                  <div
                    dir="auto"
                    className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                      m.direction === "in" ? "bg-ui-bg-subtle" : m.sender === "bot" ? "bg-ui-tag-green-bg" : "bg-ui-tag-blue-bg"
                    }`}
                  >
                    {m.text}
                    <div className="mt-1 text-[10px] text-ui-fg-muted">
                      {m.sender === "bot" ? "🤖 آلي" : m.sender === "staff" ? "👤 موظف" : "العميل"} · {time(m.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="flex flex-col gap-2 border-t p-3">
              <Textarea dir="auto" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب ردك… (يوقف الرد الآلي لهذه المحادثة)" />
              <div className="flex flex-wrap gap-2">
                <Button isLoading={busy} disabled={!text.trim()} onClick={() => send(true)}>إرسال مع تصحيح اللغة</Button>
                <Button variant="secondary" isLoading={busy} disabled={!text.trim()} onClick={() => send(false)}>إرسال كما هو</Button>
                <Button variant="transparent" disabled={!text.trim()} onClick={fix}>معاينة التصحيح</Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export const config = defineRouteConfig({ label: "المحادثات", icon: ChatBubbleLeftRight })

export default ConversationsPage
