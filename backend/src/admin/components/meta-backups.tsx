import { Badge, Button, Input, Text, toast, usePrompt } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"

// تبويب "النسخ الاحتياطية" في صفحة ربط ميتا: حفظ واسترجاع إعدادات ميتا وواتساب والرد الآلي فقط.
// النسخ تبقى في السيرفر، فلا تخرج الرموز السرية منه.

type Backup = {
  id: string
  at: string
  label: string
  summary: { has_token: boolean; page_id: string; catalog_id: string; ig_user_id: string; has_app_secret: boolean; wa_phone_number_id: string }
}

const when = (s: string) => new Date(s).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })

export default function MetaBackups() {
  const [list, setList] = useState<Backup[] | null>(null)
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const prompt = usePrompt()

  const load = () => sdk.client.fetch<{ backups: Backup[] }>("/admin/meta-backup").then((r) => setList(r.backups)).catch((e) => toast.error(String(e?.message || e)))
  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    setBusy(true)
    try {
      const r = await sdk.client.fetch<{ created: boolean; backups: Backup[] }>("/admin/meta-backup", { method: "POST", body: { label: label.trim() } })
      setList(r.backups)
      setLabel("")
      r.created ? toast.success("حُفظت نسخة احتياطية") : toast.info("لا توجد إعدادات لحفظها بعد")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ")
    } finally {
      setBusy(false)
    }
  }

  const restore = async (b: Backup) => {
    const ok = await prompt({
      title: "استرجاع نسخة احتياطية",
      description: `سترجع إعدادات ربط ميتا وواتساب والرد الآلي إلى نسخة «${b.label}» بتاريخ ${when(b.at)}.\n\nلا يتأثر شيء آخر: المنتجات والطلبات والمحادثات تبقى كما هي. وتُحفظ إعداداتك الحالية كنسخة تلقائية حتى تتراجع إن أردت.`,
      confirmText: "نعم، استرجع",
      cancelText: "إلغاء",
    })
    if (!ok) return
    setBusy(true)
    try {
      const r = await sdk.client.fetch<{ backups: Backup[] }>(`/admin/meta-backup/${b.id}/restore`, { method: "POST" })
      setList(r.backups)
      toast.success("تم الاسترجاع. افحص الربط من تبويب «الصفحة والكتالوج».")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الاسترجاع")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (b: Backup) => {
    const ok = await prompt({ title: "حذف النسخة", description: `حذف نسخة «${b.label}»؟ لا يمكن التراجع.`, confirmText: "حذف", cancelText: "إلغاء" })
    if (!ok) return
    const r = await sdk.client.fetch<{ backups: Backup[] }>(`/admin/meta-backup/${b.id}`, { method: "DELETE" })
    setList(r.backups)
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <Text size="small" className="text-ui-fg-subtle">
        تُحفظ نسخة تلقائياً قبل كل تعديل على الربط أو الرد الآلي، ونحتفظ بآخر 12 نسخة. الاسترجاع يعيد الإعدادات فقط.
      </Text>
      <div className="flex flex-wrap gap-2">
        <Input className="min-w-0 flex-1" dir="auto" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="اسم النسخة (اختياري)، مثل: قبل تغيير رقم واتساب" />
        <Button isLoading={busy} onClick={create}>حفظ نسخة الآن</Button>
      </div>
      {list === null ? (
        <Text>جارٍ التحميل…</Text>
      ) : !list.length ? (
        <Text className="text-ui-fg-subtle">لا توجد نسخ بعد.</Text>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Text weight="plus" dir="auto" className="truncate">{b.label}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">{when(b.at)}</Text>
                <div className="flex flex-wrap gap-1">
                  <Badge size="2xsmall" color={b.summary.has_token ? "green" : "grey"}>{b.summary.has_token ? "رمز ميتا ✓" : "بلا رمز"}</Badge>
                  {b.summary.page_id && <Badge size="2xsmall" color="blue">صفحة {b.summary.page_id.slice(-4)}…</Badge>}
                  {b.summary.catalog_id && <Badge size="2xsmall" color="blue">كتالوج {b.summary.catalog_id.slice(-4)}…</Badge>}
                  {b.summary.has_app_secret && <Badge size="2xsmall" color="purple">الرد الآلي ✓</Badge>}
                  {b.summary.wa_phone_number_id && <Badge size="2xsmall" color="green">واتساب ✓</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="small" variant="secondary" isLoading={busy} onClick={() => restore(b)}>استرجاع</Button>
                <Button size="small" variant="transparent" className="text-ui-fg-error" onClick={() => remove(b)}>حذف</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
