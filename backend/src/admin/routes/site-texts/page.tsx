import { defineRouteConfig } from "@medusajs/admin-sdk"
import { PencilSquare } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"

// صفحة "نصوص المتجر": تعديل نصوص واجهة المتجر (الرئيسية، تواصل معنا، من نحن، الاسترجاع، الفوتر...).
// الخانة الفارغة = النص الافتراضي. تظهر التعديلات في المتجر خلال دقيقة تقريباً.

type Field = { key: string; group: string; label: string; default: string; multiline?: boolean }

const SiteTextsPage = () => {
  const [fields, setFields] = useState<Field[]>([])
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = (r: { fields: Field[]; values: Record<string, string> }) => {
    setFields(r.fields)
    setSaved(r.values)
    // نعرض النص الحالي في كل خانة (المعدّل أو الافتراضي) ليسهل تعديله
    setValues(Object.fromEntries(r.fields.map((f) => [f.key, r.values[f.key] || f.default])))
  }

  useEffect(() => {
    sdk.client.fetch<{ fields: Field[]; values: Record<string, string> }>("/admin/site-texts").then(load).catch((e) => toast.error(String(e?.message || e)))
  }, [])

  const groups = useMemo(() => {
    const m = new Map<string, Field[]>()
    fields.forEach((f) => m.set(f.group, [...(m.get(f.group) || []), f]))
    return [...m.entries()]
  }, [fields])

  // نحفظ فقط ما يختلف عن الافتراضي
  const toSave = () => Object.fromEntries(fields.map((f) => [f.key, (values[f.key] || "").trim()]).filter(([k, v]) => v && v !== fields.find((f) => f.key === k)!.default))
  const dirty = JSON.stringify(toSave()) !== JSON.stringify(Object.fromEntries(fields.filter((f) => saved[f.key]).map((f) => [f.key, saved[f.key]])))

  const save = async () => {
    setSaving(true)
    try {
      load(await sdk.client.fetch("/admin/site-texts", { method: "POST", body: { values: toSave() } }))
      toast.success("تم الحفظ، ويظهر في المتجر خلال دقيقة")
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
          <Heading>نصوص المتجر</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            عدّل كلام واجهة المتجر: الصفحة الرئيسية، تواصل معنا، من نحن، سياسة الاسترجاع، وأسفل الصفحة. يظهر التعديل في المتجر خلال دقيقة.
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            إعلانات «عروض الأسبوع» والمنتجات المميزة من صفحة «واجهة المتجر»، والأسئلة الشائعة من صفحة «الأسئلة الشائعة».
          </Text>
        </div>
        <Button onClick={save} isLoading={saving} disabled={!dirty}>حفظ</Button>
      </Container>

      {groups.map(([group, list]) => (
        <Container key={group} className="flex flex-col gap-4 px-6 py-4">
          <Heading level="h2">{group}</Heading>
          {group === "الصفحة الرئيسية" && (
            <Text size="xsmall" className="text-ui-fg-subtle">تظهر هذه النصوص أعلى الصفحة الرئيسية عندما لا يوجد إعلان مفعّل في «واجهة المتجر».</Text>
          )}
          {list.map((f) => {
            const v = values[f.key] ?? ""
            const changed = v.trim() !== "" && v.trim() !== f.default
            return (
              <div key={f.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Text size="small" weight="plus">{f.label}</Text>
                  <div className="flex items-center gap-2">
                    {changed && <Badge size="2xsmall" color="orange">معدّل</Badge>}
                    {changed && (
                      <button type="button" className="text-xs text-ui-fg-interactive hover:underline" onClick={() => setValues((s) => ({ ...s, [f.key]: f.default }))}>
                        إرجاع الأصلي
                      </button>
                    )}
                  </div>
                </div>
                {f.multiline ? (
                  <Textarea rows={Math.min(8, Math.max(2, v.split("\n").length + 1))} value={v} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} />
                ) : (
                  <Input value={v} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} />
                )}
              </div>
            )
          })}
        </Container>
      ))}

      <Container className="flex justify-end px-6 py-4">
        <Button onClick={save} isLoading={saving} disabled={!dirty}>حفظ</Button>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "نصوص المتجر", icon: PencilSquare })
export default SiteTextsPage
