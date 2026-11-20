import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../../lib/sdk"

// صفحة "زوار المتجر": ربط أدوات الزوار المجانية (Google Tag Manager وMicrosoft Clarity).
// المعرّفات تُحفظ في إعدادات المتجر وتُضاف تلقائياً لكل صفحات المتجر. الأرقام تُعرض في Google Analytics وClarity.

type Settings = { gtm_id: string; ga_id: string; clarity_id: string }
const GTM_RE = /^GTM-[A-Z0-9]{4,12}$/i
const GA_RE = /^G-[A-Z0-9]{4,15}$/i
const CLARITY_RE = /^[a-z0-9]{6,20}$/i

const Field = ({ label, hint, value, onChange, placeholder, ok, help }: { label: string; hint: string; value: string; onChange: (v: string) => void; placeholder: string; ok: boolean; help: string }) => (
  <div className="flex flex-col gap-1.5 rounded-lg border p-4">
    <div className="flex items-center justify-between gap-2">
      <Text weight="plus">{label}</Text>
      {value ? <Badge color={ok ? "green" : "red"}>{ok ? "صحيح" : "غير صحيح"}</Badge> : <Badge color="grey">غير مربوط</Badge>}
    </div>
    <Text size="small" className="text-ui-fg-subtle">{hint}</Text>
    <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir="ltr" aria-invalid={Boolean(value) && !ok} />
    <Text size="xsmall" className="text-ui-fg-subtle">{help}</Text>
  </div>
)

type ExtLink = { text: string; href: string }

// شرح الربط وروابط فتح الأرقام في مواقع جوجل ومايكروسوفت نفسها (تفتح في نافذة جديدة)
const Guide = ({ title, steps, links }: { title: string; steps: string[]; links: ExtLink[] }) => (
  <div className="flex flex-col gap-3 rounded-lg border p-4">
    <Text weight="plus">{title}</Text>
    <ol className="list-decimal flex flex-col gap-1 pr-5">
      {steps.map((s) => (
        <li key={s}><Text size="small" className="text-ui-fg-subtle">{s}</Text></li>
      ))}
    </ol>
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
          <Button size="small" variant="secondary" type="button">{l.text} ↗</Button>
        </a>
      ))}
    </div>
  </div>
)

const AnalyticsPage = () => {
  const [saved, setSaved] = useState<Settings>({ gtm_id: "", ga_id: "", clarity_id: "" })
  const [gtm, setGtm] = useState("")
  const [ga, setGa] = useState("")
  const [clarity, setClarity] = useState("")
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    sdk.client
      .fetch<{ settings: Settings }>("/admin/analytics-settings")
      .then((r) => {
        setSaved(r.settings)
        setGtm(r.settings.gtm_id)
        setGa(r.settings.ga_id || "")
        setClarity(r.settings.clarity_id)
      })
      .catch((e) => toast.error(String(e?.message || e)))
      .finally(() => setLoaded(true))
  }, [])

  const gtmOk = gtm.trim() === "" || GTM_RE.test(gtm.trim())
  const gaOk = ga.trim() === "" || GA_RE.test(ga.trim())
  const clarityOk = clarity.trim() === "" || CLARITY_RE.test(clarity.trim())
  const dirty = gtm.trim() !== saved.gtm_id || ga.trim() !== (saved.ga_id || "") || clarity.trim() !== saved.clarity_id
  const connected = Boolean(saved.gtm_id || saved.ga_id || saved.clarity_id)

  const save = async (next?: Settings) => {
    const body = next ?? { gtm_id: gtm.trim(), ga_id: ga.trim(), clarity_id: clarity.trim() }
    setSaving(true)
    try {
      const r = await sdk.client.fetch<{ settings: Settings }>("/admin/analytics-settings", { method: "POST", body })
      setSaved(r.settings)
      setGtm(r.settings.gtm_id)
      setGa(r.settings.ga_id || "")
      setClarity(r.settings.clarity_id)
      toast.success("تم الحفظ، وتبدأ الزيارات بالظهور خلال دقائق")
    } catch (e: any) {
      toast.error(String(e?.message || "تعذّر الحفظ"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading>زوار المتجر</Heading>
          <Text size="small" className="text-ui-fg-subtle">متابعة الزوار مجاناً: من أين جاءوا، وماذا شاهدوا، وأين توقفوا.</Text>
        </div>
        <Badge color={connected ? "green" : "grey"}>{loaded ? (connected ? "متصل" : "غير متصل") : "…"}</Badge>
      </Container>

      <Container className="grid gap-4 px-6 py-4 md:grid-cols-3">
        <Field
          label="Google Analytics"
          hint="أسهل طريقة: معرّف القياس من Google Analytics مباشرة، بدون Tag Manager."
          value={ga.trim()}
          onChange={setGa}
          placeholder="G-XXXXXXXXXX"
          ok={gaOk}
          help="من Google Analytics: المشرف ← مصادر البيانات ← الموقع ← معرّف القياس."
        />
        <Field
          label="Google Tag Manager (اختياري)"
          hint="اختياري للمتقدمين. لا تضع Google Analytics داخله لأنه مربوط مباشرة في الخانة الأولى، حتى لا تُحسب الزيارة مرتين."
          value={gtm.trim()}
          onChange={setGtm}
          placeholder="GTM-XXXXXXX"
          ok={gtmOk}
          help="يُضاف تلقائياً إلى كل صفحات المتجر بعد الحفظ."
        />
        <Field
          label="Microsoft Clarity"
          hint="تسجيلات لجلسات الزوار وخرائط حرارية لمعرفة ما يفعله الزبون."
          value={clarity.trim()}
          onChange={setClarity}
          placeholder="مثل: zgdomw1kza"
          ok={clarityOk}
          help="يُضاف تلقائياً إلى كل صفحات المتجر بعد الحفظ."
        />
      </Container>

      <Container className="grid gap-4 px-6 py-4 md:grid-cols-2">
        <Guide
          title="كيف أربط جوجل، وأين أشاهد الأرقام"
          steps={[
            "افتح Google Analytics وسجّل بحساب جوجل، وأنشئ Property للمتجر، ومنها مصدر بيانات (Data Stream) نوع Web برابط المتجر.",
            "انسخ معرّف القياس الذي يبدأ بـ G- والصقه في خانة Google Analytics أعلاه ثم اضغط حفظ. هذا يكفي.",
            "خلال دقائق تظهر الزيارات في Google Analytics ← التقارير ← الوقت الفعلي (Realtime). تنبيه «جمع البيانات غير نشط» يختفي خلال 48 ساعة.",
            "Tag Manager اختياري للمتقدمين فقط: لا تضع فيه Google Analytics إن وضعت معرّف G- هنا حتى لا تُحسب الزيارة مرتين.",
          ]}
          links={[
            { text: "فتح Google Tag Manager", href: "https://tagmanager.google.com/" },
            { text: "فتح Google Analytics (الأرقام)", href: "https://analytics.google.com/" },
          ]}
        />
        <Guide
          title="كيف أربط مايكروسوفت كلاريتي، وأين أشاهد التسجيلات"
          steps={[
            "افتح موقع Microsoft Clarity وسجّل بحساب مايكروسوفت أو جوجل.",
            "اضغط New project، واكتب اسم المتجر ورابطه https://lamsaphone.yemenbay.com.",
            "من Settings ← Overview انسخ Project ID (حروف وأرقام صغيرة) والصقه في الخانة أعلاه ثم اضغط حفظ.",
            "خلال ساعة تقريباً تظهر الجلسات في Dashboard وRecordings وHeatmaps داخل موقع Clarity.",
          ]}
          links={[
            saved.clarity_id
              ? { text: "فتح لوحة Clarity للمتجر", href: `https://clarity.microsoft.com/projects/view/${saved.clarity_id}/dashboard` }
              : { text: "فتح Microsoft Clarity", href: "https://clarity.microsoft.com/projects" },
          ]}
        />
      </Container>

      <Container className="flex flex-wrap items-center justify-end gap-2 px-6 py-4">
        {connected && (
          <Button variant="secondary" disabled={saving} onClick={() => save({ gtm_id: "", ga_id: "", clarity_id: "" })}>فصل الكل</Button>
        )}
        <Button onClick={() => save()} isLoading={saving} disabled={!dirty || !gtmOk || !gaOk || !clarityOk}>حفظ</Button>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "زوار المتجر", icon: ChartBar })
export default AnalyticsPage
