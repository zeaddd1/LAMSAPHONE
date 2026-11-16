import { defineRouteConfig } from "@medusajs/admin-sdk"
import { QuestionMarkCircle } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../../lib/sdk"

// صفحة "الأسئلة الشائعة": ما يُكتب هنا يظهر في صفحة الأسئلة الشائعة بالمتجر، ويجيب منه الرد الآلي.

type Faq = { id: string; question: string; answer: string; keywords: string; is_active: boolean; rank: number; hits: number }
type TestResult = {
  intent: string
  text: string
  handoff: boolean
  order: boolean
  faq_id?: string
  understood: string[]
  corrected: string[]
  products?: { title: string }[]
}

const INTENT: Record<string, string> = {
  greeting: "ترحيب",
  thanks: "شكر",
  handoff: "تحويل لموظف",
  order: "طلب شراء",
  faq: "سؤال شائع",
  product: "سؤال عن منتج",
  price_list: "الأسعار",
  fallback: "لم يفهم ← موظف",
}
const empty = { question: "", answer: "", keywords: "", is_active: true, rank: 0 }

const FaqsPage = () => {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [edit, setEdit] = useState<(typeof empty & { id?: string }) | null>(null)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState("")
  const [test, setTest] = useState<TestResult | null>(null)

  const load = () => sdk.client.fetch<{ faqs: Faq[] }>("/admin/assistant/faqs").then((r) => setFaqs(r.faqs)).catch((e) => toast.error(String(e?.message || e)))
  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    if (!edit) return
    setSaving(true)
    try {
      const { id, ...body } = edit
      await sdk.client.fetch(id ? `/admin/assistant/faqs/${id}` : "/admin/assistant/faqs", { method: "POST", body: { ...body, rank: Number(body.rank) || 0 } })
      toast.success("تم الحفظ")
      setEdit(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }
  const remove = async (f: Faq) => {
    if (!confirm(`حذف السؤال: ${f.question}؟`)) return
    await sdk.client.fetch(`/admin/assistant/faqs/${f.id}`, { method: "DELETE" })
    load()
  }
  const toggle = async (f: Faq) => {
    await sdk.client.fetch(`/admin/assistant/faqs/${f.id}`, {
      method: "POST",
      body: { question: f.question, answer: f.answer, keywords: f.keywords, rank: f.rank, is_active: !f.is_active },
    })
    load()
  }
  const runTest = async () => {
    if (!q.trim()) return
    setTest(await sdk.client.fetch<TestResult>("/admin/assistant/test", { method: "POST", body: { text: q } }))
  }

  return (
    <Container className="p-0" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4">
        <div>
          <Heading level="h1">الأسئلة الشائعة</Heading>
          <Text size="small" className="text-ui-fg-subtle">تظهر في صفحة «الأسئلة الشائعة» بالمتجر، ويجيب منها الرد الآلي في ماسنجر وإنستغرام وواتساب.</Text>
        </div>
        <Button onClick={() => setEdit({ ...empty, rank: faqs.length })}>إضافة سؤال</Button>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
        <section className="flex flex-col gap-3">
          {edit && (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex flex-col gap-1">
                <Label>السؤال</Label>
                <Input dir="auto" value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>الجواب</Label>
                <Textarea dir="auto" rows={3} value={edit.answer} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>كلمات يكتبها العملاء (اختياري)</Label>
                <Input dir="auto" value={edit.keywords} onChange={(e) => setEdit({ ...edit, keywords: e.target.value })} placeholder="مثل: توصيل يوصل متى مندوب" />
                <Text size="xsmall" className="text-ui-fg-subtle">الرد الآلي يفهم اللهجة والأخطاء الشائعة تلقائياً، وهذه الكلمات تزيد دقته.</Text>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
                  <Label>مفعّل</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>الترتيب</Label>
                  <Input className="w-20" type="number" value={edit.rank} onChange={(e) => setEdit({ ...edit, rank: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button isLoading={saving} onClick={save}>حفظ</Button>
                <Button variant="secondary" onClick={() => setEdit(null)}>إلغاء</Button>
              </div>
            </div>
          )}
          {faqs.map((f) => (
            <div key={f.id} className={`flex flex-col gap-1 rounded-lg border p-4 ${f.is_active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Text weight="plus" dir="auto">{f.question}</Text>
                <div className="flex items-center gap-2">
                  <Badge size="2xsmall" color="grey">أجاب {f.hits} مرة</Badge>
                  <Switch checked={f.is_active} onCheckedChange={() => toggle(f)} />
                </div>
              </div>
              <Text size="small" dir="auto" className="whitespace-pre-wrap text-ui-fg-subtle">{f.answer}</Text>
              {f.keywords && <Text size="xsmall" className="text-ui-fg-muted">كلمات: {f.keywords}</Text>}
              <div className="flex gap-2">
                <Button size="small" variant="transparent" onClick={() => setEdit({ ...f })}>تعديل</Button>
                <Button size="small" variant="transparent" className="text-ui-fg-error" onClick={() => remove(f)}>حذف</Button>
              </div>
            </div>
          ))}
        </section>

        <aside className="flex h-fit flex-col gap-3 rounded-lg border p-4">
          <Heading level="h2">جرّب الرد الآلي</Heading>
          <Text size="small" className="text-ui-fg-subtle">اكتب كما يكتب العميل، باللهجة أو بأخطاء. لا يُرسل شيء لأي أحد.</Text>
          <Textarea dir="auto" rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder="مثل: اشتي ايفون 15 كم حقه" />
          <Button onClick={runTest} disabled={!q.trim()}>جرّب</Button>
          {test && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                <Badge size="2xsmall" color="blue">{INTENT[test.intent] || test.intent}</Badge>
                {test.handoff && <Badge size="2xsmall" color="red">يُحوَّل لموظف</Badge>}
                {test.order && <Badge size="2xsmall" color="orange">طلب ينتظر تأكيدك</Badge>}
              </div>
              {test.understood.length > 0 && <Text size="xsmall" className="text-ui-fg-subtle">فهم: {test.understood.join("، ")}</Text>}
              {test.corrected.length > 0 && <Text size="xsmall" className="text-ui-fg-subtle">صحّح: {test.corrected.join("، ")}</Text>}
              <pre dir="auto" className="whitespace-pre-wrap rounded-md bg-ui-tag-green-bg p-2 font-sans text-sm">{test.text}</pre>
            </div>
          )}
        </aside>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "الأسئلة الشائعة", icon: QuestionMarkCircle })

export default FaqsPage
