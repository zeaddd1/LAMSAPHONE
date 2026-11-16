import { Button, Input, Label, Switch, Text, toast, usePrompt } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"

// إعدادات الرد الآلي (Webhook ميتا + واتساب API) داخل صفحة "ربط ميتا"

const CHN: Record<string, string> = { messenger: "ماسنجر", instagram: "إنستغرام", whatsapp: "واتساب" }

type BotPublic = {
  webhook_url: string
  verify_token: string
  has_app_secret: boolean
  wa_phone_number_id: string
  messenger: boolean
  instagram: boolean
  whatsapp: boolean
  human_timeout_min: number
}

export default function BotSettings() {
  const [s, setS] = useState<BotPublic | null>(null)
  const [secret, setSecret] = useState("")
  const [saving, setSaving] = useState(false)
  const prompt = usePrompt()
  useEffect(() => {
    sdk.client.fetch<{ settings: BotPublic }>("/admin/assistant/settings").then((r) => setS(r.settings)).catch(() => {})
  }, [])
  if (!s) return <Text className="p-6">جارٍ التحميل…</Text>

  const save = async () => {
    const ok = await prompt({
      title: "تأكيد تعديل الرد الآلي",
      description: "سيتغير ربط الرد الآلي مع ميتا وواتساب. إعداد خاطئ يوقف الرد على العملاء. هل أنت متأكد؟",
      confirmText: "نعم، احفظ",
      cancelText: "إلغاء",
    })
    if (!ok) return
    setSaving(true)
    try {
      const r = await sdk.client.fetch<{ settings: BotPublic }>("/admin/assistant/settings", {
        method: "POST",
        body: {
          app_secret: secret.trim() || undefined,
          wa_phone_number_id: s.wa_phone_number_id,
          messenger: s.messenger,
          instagram: s.instagram,
          whatsapp: s.whatsapp,
          human_timeout_min: Number(s.human_timeout_min) || 0,
        },
      })
      setS(r.settings)
      setSecret("")
      toast.success("تم الحفظ")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast.success("نُسخ"))

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-2">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label>رابط Webhook (Callback URL)</Label>
          <div className="flex gap-2">
            <Input dir="ltr" readOnly value={s.webhook_url} />
            <Button variant="secondary" onClick={() => copy(s.webhook_url)}>نسخ</Button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label>رمز التحقق (Verify token)</Label>
          <div className="flex gap-2">
            <Input dir="ltr" readOnly value={s.verify_token} />
            <Button variant="secondary" onClick={() => copy(s.verify_token)}>نسخ</Button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label>سر التطبيق (App Secret)</Label>
          <Input type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={s.has_app_secret ? "محفوظ — اتركه فارغاً للإبقاء عليه" : "من إعدادات التطبيق ← أساسي"} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>رقم هاتف واتساب في Cloud API (Phone number ID)</Label>
          <Input dir="ltr" inputMode="numeric" value={s.wa_phone_number_id} onChange={(e) => setS({ ...s, wa_phone_number_id: e.target.value })} />
        </div>
        {(["messenger", "instagram", "whatsapp"] as const).map((k) => (
          <div key={k} className="flex items-center justify-between">
            <Label>الرد الآلي في {CHN[k]}</Label>
            <Switch checked={s[k]} onCheckedChange={(v) => setS({ ...s, [k]: v })} />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <Label>يعود الرد الآلي بعد خمول الموظف (دقائق، 0 = لا يعود)</Label>
          <Input type="number" min="0" value={s.human_timeout_min} onChange={(e) => setS({ ...s, human_timeout_min: Number(e.target.value) })} />
        </div>
        <Button isLoading={saving} onClick={save} className="self-start">حفظ</Button>
      </section>
      <section className="flex flex-col gap-2 text-sm leading-7">
        <Text weight="plus">ربط الرد الآلي بميتا (مرة واحدة)</Text>
        <ol className="list-decimal ps-5">
          <li>اربط ميتا أولاً من تبويب «الصفحة والكتالوج» في هذه الصفحة (الرمز ورقم الصفحة).</li>
          <li>في <a className="underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">تطبيقك على ميتا</a> أضف منتجات: <b>Messenger</b> و<b>Instagram</b> و<b>WhatsApp</b>.</li>
          <li>في كل منتج ← Webhooks: الصق الرابط ورمز التحقق أعلاه، واشترك في <b>messages</b>.</li>
          <li>في Messenger اختر صفحتك واضغط «اشتراك». في Instagram فعّل «السماح بالوصول إلى الرسائل» من إعدادات الحساب على الجوال.</li>
          <li>انسخ <b>App Secret</b> من إعدادات التطبيق ← أساسي، والصقه هنا.</li>
          <li>واتساب: من WhatsApp ← API Setup انسخ <b>Phone number ID</b> والصقه هنا، وأضف لمستخدم النظام صلاحيتي whatsapp_business_messaging و whatsapp_business_management.</li>
          <li>للرد على كل العملاء (وليس فقط حسابات المطورين): اطلب من ميتا <b>Advanced Access</b> لصلاحيتي pages_messaging و instagram_manage_messages عبر App Review، مع توثيق النشاط التجاري.</li>
        </ol>
        <Text size="small" className="text-ui-fg-subtle">جرّب الرد الآلي في أي وقت من صفحة «الأسئلة الشائعة» دون إرسال شيء لأي عميل.</Text>
      </section>
    </div>
  )
}

