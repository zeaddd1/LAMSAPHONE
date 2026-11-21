import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Channels } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Switch, Tabs, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import MetaConnectTab from "../../components/quick-add-meta-connect"
import BotSettings from "../../components/assistant-bot-settings"
import MetaBackups from "../../components/meta-backups"
import { sdk } from "../../lib/sdk"

// صفحة "ربط ميتا" المستقلة: ربط الصفحة وإنستغرام والكتالوج وThreads، والجدولة والنشر التلقائي، وإعدادات الرد الآلي وواتساب.
// منفصلة عن إضافة المنتجات حتى لا يتغير الربط بالخطأ، وكل حفظ يطلب تأكيداً.
const MetaConnectPage = () => {
  const [tab, setTab] = useState("meta")
  return (
    <Container className="p-0" dir="rtl">
      <div className="border-b px-6 py-4">
        <Heading level="h1">ربط ميتا</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          ربط المتجر بفيسبوك وإنستغرام وThreads وكتالوج ميتا وواتساب، والنشر المجدول والتلقائي. أي تعديل في الربط يطلب منك تأكيداً قبل الحفظ.
        </Text>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto px-4 pt-3 sm:px-6">
          <Tabs.List>
            <Tabs.Trigger value="meta">الصفحة والكتالوج وThreads</Tabs.Trigger>
            <Tabs.Trigger value="schedule">الجدولة والنشر التلقائي</Tabs.Trigger>
            <Tabs.Trigger value="bot">الرد الآلي وواتساب</Tabs.Trigger>
            <Tabs.Trigger value="backup">النسخ الاحتياطية</Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="meta">
          <MetaConnectTab onSaved={() => {}} />
        </Tabs.Content>
        <Tabs.Content value="schedule">
          <SchedulePanel />
        </Tabs.Content>
        <Tabs.Content value="bot">
          <BotSettings />
        </Tabs.Content>
        <Tabs.Content value="backup">
          <MetaBackups />
        </Tabs.Content>
      </Tabs>
    </Container>
  )
}

// ---------- الجدولة والنشر التلقائي ----------
type Res = { ok: boolean; url?: string; error?: string; skipped?: boolean }
type Item = { id: string; at: string; label: string; status: string; done_at?: string; results?: Record<string, Res>; error?: string; body: Record<string, any> }
type Auto = { enabled: boolean; hours: number[]; per_run: number; facebook: boolean; instagram: boolean; ig_story: boolean; threads: boolean; catalog: boolean; last_slot?: string }
type State = { queue: Item[]; autopost: Auto; upcoming: { id: string; title: string }[]; now: { hour: number; key: string } }

const DEST: [keyof Auto, string][] = [
  ["facebook", "فيسبوك"],
  ["instagram", "إنستغرام (منشور)"],
  ["ig_story", "قصة إنستغرام"],
  ["threads", "Threads"],
  ["catalog", "الكتالوج + واتساب"],
]
const DEST_NAMES: Record<string, string> = { facebook: "فيسبوك", instagram: "إنستغرام", ig_story: "قصة", threads: "Threads", catalog: "الكتالوج", all: "ميتا" }
const STATUS: Record<string, [string, "green" | "orange" | "red" | "grey" | "blue"]> = {
  pending: ["مجدول", "blue"],
  running: ["يُنشر الآن", "orange"],
  done: ["نُشر", "green"],
  failed: ["فشل", "red"],
  cancelled: ["أُلغي", "grey"],
}
const fmt = (iso: string) => new Date(iso).toLocaleString("ar", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "صباحاً" : "مساءً"}`

function SchedulePanel() {
  const [st, setSt] = useState<State | null>(null)
  const [auto, setAuto] = useState<Auto | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState("")

  const load = () =>
    sdk.client
      .fetch<State>("/admin/quick-add/schedule")
      .then((r) => (setSt(r), setAuto(r.autopost)))
      .catch((e) => toast.error(String(e?.message || e)))
  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  if (!st || !auto) return <Text className="p-6">جارٍ التحميل…</Text>
  const dirty = JSON.stringify({ ...auto, last_slot: undefined }) !== JSON.stringify({ ...st.autopost, last_slot: undefined })
  const toggleHour = (h: number) => setAuto({ ...auto, hours: auto.hours.includes(h) ? auto.hours.filter((x) => x !== h) : [...auto.hours, h].sort((a, b) => a - b).slice(0, 6) })

  const saveAuto = async () => {
    if (auto.enabled && (!auto.hours.length || !DEST.some(([k]) => auto[k]))) return toast.error("اختر ساعة واحدة ووجهة واحدة على الأقل")
    setSaving(true)
    try {
      await sdk.client.fetch("/admin/quick-add/schedule", { method: "POST", body: { action: "autopost", settings: auto } })
      toast.success(auto.enabled ? "تم تشغيل النشر التلقائي" : "تم الحفظ")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }
  const act = async (id: string, action: "cancel" | "run_now") => {
    setBusyId(id)
    try {
      await sdk.client.fetch("/admin/quick-add/schedule", { method: "POST", body: { action, id } })
      toast.success(action === "cancel" ? "أُلغي المنشور" : "تم التنفيذ، راجع النتيجة")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "تعذّر التنفيذ")
    } finally {
      setBusyId("")
    }
  }

  const pending = st.queue.filter((x) => x.status === "pending" || x.status === "running").sort((a, b) => a.at.localeCompare(b.at))
  const past = st.queue.filter((x) => !(x.status === "pending" || x.status === "running")).slice(0, 30)

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Text weight="plus">🤖 النشر التلقائي اليومي</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">ينشر بنفسه منتجات المتجر التي لم تُنشر بعد، في الساعات التي تختارها، بالنص الجاهز من بيانات كل منتج. لا يكرر أي منتج.</Text>
            </div>
            <Switch checked={auto.enabled} onCheckedChange={(v) => setAuto({ ...auto, enabled: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Text size="small" weight="plus">الساعات (بتوقيت صنعاء، حتى 6)</Text>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleHour(h)}
                  className={`min-w-[64px] rounded-md border px-2 py-1 text-xs ${auto.hours.includes(h) ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`}
                >
                  {hourLabel(h)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Text size="small" weight="plus">عدد المنتجات في كل مرة:</Text>
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" onClick={() => setAuto({ ...auto, per_run: n })} className={`rounded-full border px-3 py-0.5 text-sm ${auto.per_run === n ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : ""}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Text size="small" weight="plus">أين ينشر:</Text>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {DEST.map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Switch checked={Boolean(auto[k])} onCheckedChange={(v) => setAuto({ ...auto, [k]: v })} />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="small" isLoading={saving} disabled={!dirty} onClick={saveAuto}>حفظ</Button>
            {st.autopost.enabled ? <Badge size="2xsmall" color="green">يعمل: {st.autopost.hours.map(hourLabel).join("، ")}</Badge> : <Badge size="2xsmall" color="grey">متوقف</Badge>}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <Text weight="plus">التالي في النشر التلقائي</Text>
          {st.upcoming.length ? (
            <ol className="list-decimal ps-5 text-sm">
              {st.upcoming.map((p) => (
                <li key={p.id}>{p.title}</li>
              ))}
            </ol>
          ) : (
            <Text size="small" className="text-ui-fg-subtle">كل المنتجات الظاهرة نُشرت على الوجهات المختارة.</Text>
          )}
          <Text size="xsmall" className="text-ui-fg-subtle">
            الترتيب: المنتجات التي اخترت لها «مع النشر التلقائي» أولاً، ثم ترتيب العرض في المتجر (1، 2، 3…)، ثم الأحدث.
          </Text>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <Text weight="plus">📅 المنشورات المجدولة ({pending.length})</Text>
          <Text size="xsmall" className="text-ui-fg-subtle">تُجدول من تبويب «النشر على ميتا» لأي منتج، أو من الإضافة السريعة، أو من استوديو الصور، باختيار «في وقت محدد».</Text>
          {!pending.length && <Text size="small" className="text-ui-fg-subtle">لا توجد منشورات مجدولة.</Text>}
          {pending.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">{x.label}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {fmt(x.at)} · {DEST.filter(([k]) => x.body[k]).map(([, l]) => l).join("، ")}
                </Text>
              </div>
              <div className="flex items-center gap-1">
                <Badge size="2xsmall" color={STATUS[x.status]?.[1] || "grey"}>{STATUS[x.status]?.[0] || x.status}</Badge>
                {x.status === "pending" && (
                  <>
                    <Button size="small" variant="secondary" isLoading={busyId === x.id} onClick={() => act(x.id, "run_now")}>انشر الآن</Button>
                    <Button size="small" variant="transparent" disabled={busyId === x.id} onClick={() => act(x.id, "cancel")}>إلغاء</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {past.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <Text weight="plus">السجل</Text>
            {past.map((x) => (
              <div key={x.id} className="flex flex-col gap-0.5 border-b pb-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <Text size="small" className="truncate">{x.label}</Text>
                  <div className="flex items-center gap-1">
                    <Badge size="2xsmall" color={STATUS[x.status]?.[1] || "grey"}>{STATUS[x.status]?.[0] || x.status}</Badge>
                    {x.status === "failed" && <Button size="small" variant="transparent" isLoading={busyId === x.id} onClick={() => act(x.id, "run_now")}>إعادة</Button>}
                  </div>
                </div>
                <Text size="xsmall" className="text-ui-fg-subtle">{fmt(x.done_at || x.at)}</Text>
                {x.error && <Text size="xsmall" className="text-ui-fg-error">{x.error}</Text>}
                {x.results && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(x.results)
                      .filter(([, r]) => !r.skipped)
                      .map(([k, r]) =>
                        r.ok ? (
                          <a key={k} href={r.url || undefined} target="_blank" rel="noreferrer">
                            <Badge size="2xsmall" color="green">{DEST_NAMES[k] || k} ✓</Badge>
                          </a>
                        ) : (
                          <Badge key={k} size="2xsmall" color="red">{DEST_NAMES[k] || k}: {r.error?.slice(0, 60)}</Badge>
                        )
                      )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export const config = defineRouteConfig({ label: "ربط ميتا", icon: Channels })

export default MetaConnectPage
