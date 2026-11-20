import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../../lib/sdk"

// صفحة "زوار المتجر": ربط أدوات الزوار المجانية (Google Tag Manager وMicrosoft Clarity).
// المعرّفات تُحفظ في إعدادات المتجر وتُضاف تلقائياً لكل صفحات المتجر. الأرقام تُعرض في Google Analytics وClarity.

type Settings = { gtm_id: string; clarity_id: string }
const GTM_RE = /^GTM-[A-Z0-9]{4,12}$/i
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

const AnalyticsPage = () => {
  const [saved, setSaved] = useState<Settings>({ gtm_id: "", clarity_id: "" })
  const [gtm, setGtm] = useState("")
  const [clarity, setClarity] = useState("")
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    sdk.client
      .fetch<{ settings: Settings }>("/admin/analytics-settings")
      .then((r) => {
        setSaved(r.settings)
        setGtm(r.settings.gtm_id)
        setClarity(r.settings.clarity_id)
      })
      .catch((e) => toast.error(String(e?.message || e)))
      .finally(() => setLoaded(true))
  }, [])

  const gtmOk = gtm.trim() === "" || GTM_RE.test(gtm.trim())
  const clarityOk = clarity.trim() === "" || CLARITY_RE.test(clarity.trim())
  const dirty = gtm.trim() !== saved.gtm_id || clarity.trim() !== saved.clarity_id
  const connected = Boolean(saved.gtm_id || saved.clarity_id)

  const save = async (next?: Settings) => {
    const body = next ?? { gtm_id: gtm.trim(), clarity_id: clarity.trim() }
    setSaving(true)
    try {
      const r = await sdk.client.fetch<{ settings: Settings }>("/admin/analytics-settings", { method: "POST", body })
      setSaved(r.settings)
      setGtm(r.settings.gtm_id)
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

      <Container className="grid gap-4 px-6 py-4 md:grid-cols-2">
        <Field
          label="Google Tag Manager"
          hint="يدير تحليلات جوجل (Google Analytics) للمتجر. ضع أدوات جوجل داخله."
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

      <Container className="flex flex-wrap items-center justify-end gap-2 px-6 py-4">
        {connected && (
          <Button variant="secondary" disabled={saving} onClick={() => save({ gtm_id: "", clarity_id: "" })}>فصل الكل</Button>
        )}
        <Button onClick={() => save()} isLoading={saving} disabled={!dirty || !gtmOk || !clarityOk}>حفظ</Button>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "زوار المتجر", icon: ChartBar })
export default AnalyticsPage
