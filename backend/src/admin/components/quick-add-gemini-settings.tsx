import { Badge, Button, Checkbox, Input, Label, Select, Switch, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"
import { GeminiPublic, ModelTest, getGemini } from "../lib/quick-add-ai"

// تبويب Gemini في صفحة ربط ميتا: المفتاح (لا يرجع للواجهة أبداً)، الموديلات، وضع الصور (يدوي/مدفوع)،
// حارس الحصص للنصوص، سقوف التكلفة، عدّاد الاستهلاك، واختبار كل موديل على حدة.

const STATUS: Record<GeminiPublic["status"], [string, "green" | "orange" | "red"]> = {
  connected: ["متصل", "green"],
  disconnected: ["غير متصل", "orange"],
  error: ["خطأ", "red"],
}
const TEST: Record<ModelTest["state"], [string, "green" | "orange" | "red" | "blue"]> = {
  works: ["يعمل", "green"],
  available: ["موجود", "blue"],
  paid_only: ["مدفوع فقط", "orange"],
  rate_limited: ["تجاوز الحد", "orange"],
  error: ["خطأ", "red"],
}
const DEPRECATED_TEXT = ["gemini-2.5-flash"]

function Bar({ label, value, max, unit = "" }: { label: string; value: number; max: number; unit?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const color = pct >= 100 ? "bg-ui-tag-red-icon" : pct >= 80 ? "bg-ui-tag-orange-icon" : "bg-ui-tag-green-icon"
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span dir="ltr">
          {value}
          {unit} / {max > 0 ? `${max}${unit}` : "غير محدد"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ui-bg-component">
        <div className={`h-full ${color}`} style={{ width: `${max > 0 ? pct : 0}%` }} />
      </div>
    </div>
  )
}

const num = (v: string, d = 0) => (v.trim() === "" ? d : Number(v) || 0)

export default function GeminiSettingsTab() {
  const [s, setS] = useState<GeminiPublic | null>(null)
  const [key, setKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [imageModel, setImageModel] = useState("")
  const [textModel, setTextModel] = useState("")
  const [marginType, setMarginType] = useState<"percent" | "fixed">("percent")
  const [marginValue, setMarginValue] = useState("10")
  const [concurrency, setConcurrency] = useState("2")
  const [imageMode, setImageMode] = useState<"manual" | "paid_api">("manual")
  const [paidConfirmed, setPaidConfirmed] = useState(false)
  const [monthlyCap, setMonthlyCap] = useState("0")
  const [dailyCap, setDailyCap] = useState("0")
  const [costs, setCosts] = useState<Record<string, string>>({})
  const [newCostModel, setNewCostModel] = useState("")
  const [rpm, setRpm] = useState("0")
  const [rpd, setRpd] = useState("0")
  const [safety, setSafety] = useState("80")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const apply = (x: GeminiPublic) => {
    setS(x)
    setImageModel(x.image_model)
    setTextModel(x.text_model)
    setMarginType(x.margin_type)
    setMarginValue(String(x.margin_value))
    setConcurrency(String(x.concurrency))
    setImageMode(x.image_mode)
    setPaidConfirmed(x.paid_confirmed)
    setMonthlyCap(String(x.monthly_cap_usd))
    setDailyCap(String(x.daily_cap_usd))
    const c: Record<string, string> = Object.fromEntries(Object.entries(x.image_costs || {}).map(([k, v]) => [k, String(v)]))
    if (!(x.image_model in c)) c[x.image_model] = String(x.image_cost)
    setCosts(c)
    setRpm(String(x.rpm))
    setRpd(String(x.rpd))
    setSafety(String(x.safety_pct))
  }
  const reload = () => getGemini().then(apply)
  useEffect(() => {
    reload().catch((e) => toast.error(e?.message || "تعذّر تحميل إعدادات Gemini"))
    // تحديث العدّاد كل 30 ثانية
    const t = setInterval(() => getGemini().then(setS).catch(() => null), 30_000)
    return () => clearInterval(t)
  }, [])

  const paid = imageMode === "paid_api"
  const save = async (clear = false) => {
    if (paid && !paidConfirmed) return toast.error("أكّد أن المفتاح مربوط بحساب مفوتر قبل تفعيل الوضع المدفوع")
    if (paid && !(num(monthlyCap) > 0)) return toast.error("الوضع المدفوع يحتاج سقفاً شهرياً بالدولار أكبر من صفر")
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
          margin_value: num(marginValue),
          concurrency: num(concurrency, 2),
          image_mode: imageMode,
          paid_confirmed: paidConfirmed,
          monthly_cap_usd: num(monthlyCap),
          daily_cap_usd: num(dailyCap),
          image_costs: Object.fromEntries(Object.entries(costs).filter(([k, v]) => k.trim() && v.trim() !== "").map(([k, v]) => [k.trim(), Number(v) || 0])),
          use_batch: false,
          rpm: num(rpm),
          rpd: num(rpd),
          safety_pct: num(safety, 80),
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
      const r = await sdk.client.fetch<{ ok: boolean; error?: string; text?: ModelTest; image?: ModelTest; settings: GeminiPublic }>("/admin/quick-add/settings/gemini/test", { method: "POST" })
      setS(r.settings)
      r.ok ? toast.success(`النصوص: ${r.text?.message || "يعمل"} · الصور: ${r.image?.message || "-"}`) : toast.error(r.error || "فشل الاتصال")
    } catch (e: any) {
      toast.error(e?.message || "فشل الاختبار")
    } finally {
      setTesting(false)
    }
  }

  if (!s) return <Text className="p-6">جارٍ التحميل…</Text>
  const [label, color] = STATUS[s.status]
  const u = s.usage
  const testRow = (name: string, model: string, t: ModelTest | null) => (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-20">{name}</span>
      <code dir="ltr" className="text-xs">{model}</code>
      {t ? (
        <>
          <Badge size="2xsmall" color={TEST[t.state][1]}>{TEST[t.state][0]}</Badge>
          <span className="text-xs text-ui-fg-subtle">{t.message}</span>
        </>
      ) : (
        <span className="text-xs text-ui-fg-subtle">لم يُختبر</span>
      )}
    </div>
  )

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
        احصل على المفتاح من{" "}
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
          <Label>موديل النصوص</Label>
          <Input dir="ltr" value={textModel} onChange={(e) => setTextModel(e.target.value)} placeholder="gemini-3.5-flash-lite" />
          {DEPRECATED_TEXT.includes(textModel.trim()) && <Text size="xsmall" className="text-ui-fg-error">هذا الموديل متوقف (deprecated): سيُستخدم gemini-3.5-flash-lite بدلاً منه.</Text>}
        </div>
        <div className="flex flex-col gap-1">
          <Label>موديل الصور</Label>
          <Input dir="ltr" value={imageModel} onChange={(e) => setImageModel(e.target.value)} placeholder="gemini-3.1-flash-lite-image" />
          {s.image_sunset && imageModel.trim() === s.image_model && (
            <Text size="xsmall" className="text-ui-fg-error">⚠️ هذا الموديل سيتوقف في {s.image_sunset}. يُنصح بالانتقال إلى gemini-3.1-flash-lite-image.</Text>
          )}
          <Text size="xsmall" className="text-ui-fg-subtle">يُستدعى فقط في الوضع المدفوع.</Text>
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

      {/* وضع توليد الصور */}
      <div className="flex flex-col gap-3 rounded-md border p-3">
        <Text weight="plus">وضع توليد الصور</Text>
        <Select value={imageMode} onValueChange={(v) => setImageMode(v as "manual" | "paid_api")}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="manual">يدوي (الافتراضي): لا طلبات صور للـ API</Select.Item>
            <Select.Item value="paid_api">API مدفوع: بسقف شهري إلزامي</Select.Item>
          </Select.Content>
        </Select>
        {s.cap_note && s.image_mode === "manual" && <Text size="small" className="text-ui-fg-error">{s.cap_note}</Text>}
        {!paid ? (
          <Text size="xsmall" className="text-ui-fg-subtle">الصور تُولَّد بحسابك في Gemini عبر بطاقة «التوليد اليدوي» في المراجعة. النصوص تبقى عبر API ضمن حارس الحصص.</Text>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={paidConfirmed} onCheckedChange={(v) => setPaidConfirmed(v === true)} />
              <span>أؤكد أن هذا المفتاح مربوط بحساب مفوتر في Google Cloud، وأن كل صورة تُحتسب عليّ.</span>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label>السقف الشهري ($) *</Label>
                <Input type="number" min="0" step="0.5" dir="ltr" value={monthlyCap} onChange={(e) => setMonthlyCap(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>السقف اليومي ($)</Label>
                <Input type="number" min="0" step="0.1" dir="ltr" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
                <Text size="xsmall" className="text-ui-fg-subtle">0 = بلا سقف يومي.</Text>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>تكلفة الصورة الواحدة لكل موديل ($، دقة 1K)</Label>
              {Object.entries(costs).map(([m, v]) => (
                <div key={m} className="flex items-center gap-2">
                  <code dir="ltr" className="flex-1 truncate text-xs">{m}</code>
                  <Input className="w-28" type="number" min="0" step="0.0001" dir="ltr" value={v} onChange={(e) => setCosts((c) => ({ ...c, [m]: e.target.value }))} />
                  {m !== imageModel.trim() && (
                    <Button size="small" variant="transparent" onClick={() => setCosts(({ [m]: _, ...rest }) => rest)}>حذف</Button>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Input dir="ltr" placeholder="اسم موديل آخر" value={newCostModel} onChange={(e) => setNewCostModel(e.target.value)} />
                <Button size="small" variant="secondary" disabled={!newCostModel.trim()} onClick={() => (setCosts((c) => ({ ...c, [newCostModel.trim()]: "0.0336" })), setNewCostModel(""))}>إضافة</Button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm opacity-60">
              <Switch checked={false} disabled />
              <span>Batch (أرخص بنحو النصف): غير متاح للتوليد التفاعلي هنا، لأن نتائجه تتأخر حتى 24 ساعة.</span>
            </label>
            <Text size="xsmall" className="text-ui-fg-subtle">قبل أي توليد صور (خاصة الزوايا الأربع) تظهر التكلفة التقديرية للتأكيد. عند بلوغ أي سقف تتوقف صور API وننتقل إلى اليدوي تلقائياً.</Text>
          </div>
        )}
      </div>

      {/* حارس الحصص للنصوص */}
      <div className="flex flex-col gap-3 rounded-md border p-3">
        <Text weight="plus">حدود النصوص (من صفحة Rate limits في AI Studio)</Text>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label>RPM (طلب/دقيقة)</Label>
            <Input type="number" min="0" dir="ltr" value={rpm} onChange={(e) => setRpm(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>RPD (طلب/يوم)</Label>
            <Input type="number" min="0" dir="ltr" value={rpd} onChange={(e) => setRpd(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>نسبة الأمان %</Label>
            <Input type="number" min="10" max="100" dir="ltr" value={safety} onChange={(e) => setSafety(e.target.value)} />
          </div>
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          نتوقف عند {safety || 80}% من الحد. 0 = غير محدد. اليوم يتجدد منتصف الليل بتوقيت المحيط الهادئ (حوالي {new Date(u.day_resets_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })} بتوقيتك).
        </Text>
      </div>

      {/* الاستهلاك */}
      <div className="flex flex-col gap-3 rounded-md border p-3">
        <Text weight="plus">الاستهلاك</Text>
        <Bar label="نصوص هذه الدقيقة" value={u.text_minute} max={u.rpm_limit} />
        <Bar label="نصوص اليوم" value={u.text_today} max={u.rpd_limit} />
        {(s.image_mode === "paid_api" || u.month_spend > 0) && (
          <>
            <Bar label="صور هذا الشهر (تقديري)" value={u.month_spend} max={u.monthly_cap} unit="$" />
            {u.daily_cap > 0 && <Bar label="صور اليوم (تقديري)" value={u.day_spend} max={u.daily_cap} unit="$" />}
          </>
        )}
        {u.cooldown_until && (
          <Text size="small" className="text-ui-fg-error">
            Google أوقف الطلبات مؤقتاً (429). نتوقف عن الإرسال حتى {new Date(u.cooldown_until).toLocaleTimeString("ar")}.
          </Text>
        )}
      </div>

      {/* اختبار الاتصال */}
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Text weight="plus">اختبار الاتصال</Text>
        {testRow("النصوص", s.text_model, s.text_test)}
        {testRow("الصور", s.image_model, s.image_test)}
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
