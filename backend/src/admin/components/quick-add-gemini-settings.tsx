import { Badge, Button, Input, Label, Select, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"
import { GeminiPublic, getGemini } from "../lib/quick-add-ai"

// تبويب Gemini في صفحة ربط ميتا: المفتاح (لا يرجع للواجهة أبداً)، الموديلات، اختبار الاتصال، الاستهلاك،
// وهامش الربح الافتراضي وعدد الصور المتوازية للإضافة السريعة بالذكاء الاصطناعي.

const STATUS: Record<GeminiPublic["status"], [string, "green" | "orange" | "red"]> = {
  connected: ["متصل", "green"],
  disconnected: ["غير متصل", "orange"],
  error: ["خطأ", "red"],
}

export default function GeminiSettingsTab() {
  const [s, setS] = useState<GeminiPublic | null>(null)
  const [key, setKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [imageModel, setImageModel] = useState("")
  const [textModel, setTextModel] = useState("")
  const [marginType, setMarginType] = useState<"percent" | "fixed">("percent")
  const [marginValue, setMarginValue] = useState("10")
  const [concurrency, setConcurrency] = useState("2")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const apply = (x: GeminiPublic) => {
    setS(x)
    setImageModel(x.image_model)
    setTextModel(x.text_model)
    setMarginType(x.margin_type)
    setMarginValue(String(x.margin_value))
    setConcurrency(String(x.concurrency))
  }
  useEffect(() => {
    getGemini().then(apply).catch((e) => toast.error(e?.message || "تعذّر تحميل إعدادات Gemini"))
  }, [])

  const save = async (clear = false) => {
    setSaving(true)
    try {
      const r = await sdk.client.fetch<{ settings: GeminiPublic }>("/admin/quick-add/settings/gemini", {
        method: "POST",
        body: {
          api_key: key.trim() || undefined,
          clear_key: clear || undefined,
          image_model: imageModel.trim(),
          text_model: textModel.trim(),
          margin_type: marginType,
          margin_value: Number(marginValue) || 0,
          concurrency: Number(concurrency) || 2,
        },
      })
      apply(r.settings)
      setKey("")
      toast.success(clear ? "حُذف المفتاح" : "تم الحفظ")
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const r = await sdk.client.fetch<{ ok: boolean; error?: string; settings: GeminiPublic }>("/admin/quick-add/settings/gemini/test", { method: "POST" })
      apply(r.settings)
      r.ok ? toast.success("Gemini متصل ✓") : toast.error(r.error || "فشل الاتصال")
    } catch (e: any) {
      toast.error(e?.message || "فشل الاختبار")
    } finally {
      setTesting(false)
    }
  }

  if (!s) return <Text className="p-6">جارٍ التحميل…</Text>
  const [label, color] = STATUS[s.status]

  return (
    <div className="flex max-w-2xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Text weight="plus">حالة Gemini:</Text>
        <Badge color={color}>{label}</Badge>
        {s.last_success_at && <Text size="small" className="text-ui-fg-subtle">آخر نجاح: {new Date(s.last_success_at).toLocaleString("ar")}</Text>}
      </div>
      {s.status === "error" && s.last_error && <Text size="small" className="text-ui-fg-error">{s.last_error}</Text>}
      <Text size="small" className="text-ui-fg-subtle">
        اختياري: يُستخدم فقط عند تفعيل «تحسين بالذكاء الاصطناعي» في صفحة الإضافة السريعة. بدونه تعمل الإضافة السريعة كالمعتاد.
        احصل على المفتاح مجاناً من{" "}
        <a className="text-ui-fg-interactive underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>
        .
      </Text>

      <div className="flex flex-col gap-1">
        <Label>مفتاح Gemini API {s.has_key && <span className="text-ui-fg-subtle">(محفوظ {s.key_hint}{s.from_env ? " من متغيرات السيرفر" : ""})</span>}</Label>
        <div className="flex gap-2">
          <Input dir="ltr" type={showKey ? "text" : "password"} autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={s.has_key ? "اتركه فارغاً لإبقاء المفتاح الحالي" : "AIza…"} />
          <Button variant="secondary" type="button" onClick={() => setShowKey((x) => !x)}>
            {showKey ? "إخفاء" : "إظهار"}
          </Button>
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">يُحفظ في السيرفر فقط ولا يُعرض هنا مرة أخرى.</Text>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>موديل الصور</Label>
          <Input dir="ltr" value={imageModel} onChange={(e) => setImageModel(e.target.value)} placeholder="gemini-2.5-flash-image" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>موديل النصوص</Label>
          <Input dir="ltr" value={textModel} onChange={(e) => setTextModel(e.target.value)} placeholder="gemini-2.5-flash" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>هامش الربح الافتراضي</Label>
          <div className="flex gap-2">
            <Input type="number" min="0" step="0.01" value={marginValue} onChange={(e) => setMarginValue(e.target.value)} />
            <Select value={marginType} onValueChange={(v) => setMarginType(v as "percent" | "fixed")}>
              <Select.Trigger className="w-36">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="percent">نسبة %</Select.Item>
                <Select.Item value="fixed">مبلغ ثابت</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label>عدد الصور المتوازية</Label>
          <Select value={concurrency} onValueChange={setConcurrency}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {["1", "2", "3", "4"].map((n) => (
                <Select.Item key={n} value={n}>{n}</Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Text size="xsmall" className="text-ui-fg-subtle">2 مناسب للسيرفر الحالي.</Text>
        </div>
      </div>

      <div className="rounded-md border p-3 text-sm">
        الاستهلاك: <b>{s.usage.month_calls}</b> طلب هذا الشهر ({s.usage.month_jobs} جهاز) · الإجمالي {s.usage.total_calls} طلب
      </div>

      <div className="flex flex-wrap gap-2">
        <Button isLoading={saving} onClick={() => save(false)}>حفظ</Button>
        <Button variant="secondary" isLoading={testing} disabled={!s.has_key} onClick={test}>
          اختبار الاتصال
        </Button>
        {s.has_key && !s.from_env && (
          <Button variant="danger" isLoading={saving} onClick={() => save(true)}>
            حذف المفتاح
          </Button>
        )}
      </div>
    </div>
  )
}
