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
            <Tabs.Trigger value="telegram">تيليجرام</Tabs.Trigger>
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
        <Tabs.Content value="telegram">
          <TelegramPanel />
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

// ---------- تيليجرام: مستقل عن ميتا، بوت ينشر في قناتك أو مجموعتك بخطة أسبوعية ----------
type TgPlan = { enabled: boolean; days: number[]; hours: number[]; per_run: number }
type TgPublic = { has_token: boolean; token_hint: string; chat_id: string; chat_title: string; bot_username: string; plan: TgPlan; from_env: boolean }
type TgChat = { id: string; title: string; type: string }
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const CHAT_TYPE: Record<string, string> = { channel: "قناة", supergroup: "مجموعة", group: "مجموعة" }

function TelegramPanel() {
  const [s, setS] = useState<TgPublic | null>(null)
  const [plan, setPlan] = useState<TgPlan | null>(null)
  const [upcoming, setUpcoming] = useState<{ id: string; title: string }[]>([])
  const [token, setToken] = useState("")
  const [chats, setChats] = useState<TgChat[] | null>(null)
  const [manual, setManual] = useState("")
  const [busy, setBusy] = useState("")

  const load = () =>
    sdk.client
      .fetch<{ settings: TgPublic; upcoming: { id: string; title: string }[] }>("/admin/quick-add/telegram")
      .then((r) => (setS(r.settings), setPlan(r.settings.plan), setUpcoming(r.upcoming)))
      .catch((e) => toast.error(String(e?.message || e)))
  useEffect(() => {
    load()
  }, [])

  const call = async (key: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(key)
    try {
      const r = await sdk.client.fetch<any>("/admin/quick-add/telegram", { method: "POST", body })
      if (r.settings) (setS(r.settings), setPlan(r.settings.plan))
      if (r.chats) setChats(r.chats)
      if (ok) toast.success(ok)
      return r
    } catch (e: any) {
      toast.error(e?.message || "تعذّر التنفيذ")
    } finally {
      setBusy("")
    }
  }

  if (!s || !plan) return <Text className="p-6">جارٍ التحميل…</Text>
  const planDirty = JSON.stringify(plan) !== JSON.stringify(s.plan)
  const perWeek = plan.days.length * plan.hours.length * plan.per_run
  const perDay = plan.hours.length * plan.per_run

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <Text weight="plus">✈️ بوت تيليجرام</Text>
            {s.has_token ? <Badge size="2xsmall" color="green">@{s.bot_username || "bot"}</Badge> : <Badge size="2xsmall" color="grey">غير مربوط</Badge>}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              autoComplete="off"
              className="flex-1 rounded-md border bg-ui-bg-field px-2 py-1.5 text-sm"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={s.has_token ? `محفوظ (${s.token_hint}) — الصق رمزاً جديداً لاستبداله` : "رمز البوت من BotFather"}
              dir="ltr"
            />
            <Button size="small" isLoading={busy === "token"} disabled={!token.trim()} onClick={() => call("token", { action: "save_token", token }, "تم ربط البوت").then(() => setToken(""))}>
              حفظ
            </Button>
          </div>
          {s.has_token && (
            <>
              <div className="flex flex-col gap-1.5 border-t pt-3">
                <div className="flex items-center justify-between gap-2">
                  <Text size="small" weight="plus">أين ينشر؟</Text>
                  {s.chat_id ? <Badge size="2xsmall" color="green">{s.chat_title}</Badge> : <Badge size="2xsmall" color="orange">لم تُختر قناة</Badge>}
                </div>
                <Button size="small" variant="secondary" className="self-start" isLoading={busy === "find"} onClick={() => call("find", { action: "find_chats" })}>
                  🔎 ابحث عن قنواتي ومجموعاتي
                </Button>
                {chats && !chats.length && <Text size="xsmall" className="text-ui-fg-error">لم يُعثر على شيء. أضف البوت مشرفاً في القناة أو المجموعة، ثم انشر فيها أي رسالة، ثم ابحث مرة أخرى.</Text>}
                {chats?.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <Text size="small">{CHAT_TYPE[c.type] || c.type}: {c.title}</Text>
                    <Button size="small" variant={s.chat_id === c.id ? "primary" : "secondary"} isLoading={busy === `set${c.id}`} onClick={() => call(`set${c.id}`, { action: "set_chat", chat_id: c.id }, "تم الاختيار")}>
                      {s.chat_id === c.id ? "مختارة ✓" : "اختر"}
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input className="flex-1 rounded-md border bg-ui-bg-field px-2 py-1 text-sm" dir="ltr" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="أو اكتب @اسم_القناة" />
                  <Button size="small" variant="secondary" disabled={!manual.trim()} isLoading={busy === "manual"} onClick={() => call("manual", { action: "set_chat", chat_id: manual.trim() }, "تم الاختيار")}>
                    اختر
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="small" variant="secondary" disabled={!s.chat_id} isLoading={busy === "test"} onClick={() => call("test", { action: "test" }, "أُرسلت رسالة تجربة")}>
                  إرسال رسالة تجربة
                </Button>
                {!s.from_env && (
                  <Button size="small" variant="danger" isLoading={busy === "clear"} onClick={() => confirm("فصل تيليجرام؟ سيتوقف النشر فيه.") && call("clear", { action: "clear" }, "فُصل تيليجرام")}>
                    فصل
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Text weight="plus">📆 الخطة الأسبوعية لتيليجرام</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">مستقلة عن ميتا. ينشر في تيليجرام فقط منتجات المتجر التي لم تُنشر فيه بعد، بالنص الجاهز وأزرار «تسوّق» و«واتساب».</Text>
            </div>
            <Switch checked={plan.enabled} disabled={!s.chat_id} onCheckedChange={(v) => setPlan({ ...plan, enabled: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Text size="small" weight="plus">الأيام</Text>
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPlan({ ...plan, days: plan.days.includes(i) ? plan.days.filter((x) => x !== i) : [...plan.days, i].sort() })}
                  className={`rounded-full border px-3 py-1 text-xs ${plan.days.includes(i) ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Text size="small" weight="plus">الساعات في كل يوم (توقيت صنعاء، حتى 6)</Text>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setPlan({ ...plan, hours: plan.hours.includes(h) ? plan.hours.filter((x) => x !== h) : [...plan.hours, h].sort((a, b) => a - b).slice(0, 6) })}
                  className={`min-w-[64px] rounded-md border px-2 py-1 text-xs ${plan.hours.includes(h) ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`}
                >
                  {hourLabel(h)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Text size="small" weight="plus">منتجات كل مرة:</Text>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setPlan({ ...plan, per_run: n })} className={`rounded-full border px-3 py-0.5 text-sm ${plan.per_run === n ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : ""}`}>
                {n}
              </button>
            ))}
          </div>
          <Text size="small">
            المجموع: <b>{perWeek}</b> منشور في الأسبوع ({perDay} في كل يوم مختار). تيليجرام لا يحدد عدد المنشورات، فاختر ما يناسب جمهورك.
          </Text>
          {perDay > 6 && <Text size="xsmall" className="text-ui-fg-subtle">تنبيه: أكثر من 6 منشورات يومياً قد يجعل بعض المشتركين يكتمون القناة. الأفضل توزيعها على ساعات متباعدة.</Text>}
          <div className="flex items-center gap-2">
            <Button size="small" disabled={!planDirty || (plan.enabled && (!plan.days.length || !plan.hours.length))} isLoading={busy === "plan"} onClick={() => call("plan", { action: "plan", plan }, plan.enabled ? "تم تشغيل الخطة" : "تم الحفظ").then(load)}>
              حفظ الخطة
            </Button>
            {s.plan.enabled ? <Badge size="2xsmall" color="green">تعمل: {s.plan.days.map((d) => DAYS[d]).join("، ")} · {s.plan.hours.map(hourLabel).join("، ")}</Badge> : <Badge size="2xsmall" color="grey">متوقفة</Badge>}
          </div>
          {upcoming.length > 0 && (
            <div className="flex flex-col gap-1 border-t pt-2">
              <Text size="small" weight="plus">التالي في تيليجرام:</Text>
              <ol className="list-decimal ps-5 text-sm">
                {upcoming.map((p) => (
                  <li key={p.id}>{p.title}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-7">
        <Text weight="plus">خطوات الربط (مرة واحدة، 5 دقائق)</Text>
        <ol className="list-decimal ps-5">
          <li>
            <b>أنشئ القناة:</b> في تيليجرام ← قلم الكتابة ← <b>قناة جديدة</b> باسم «لمسة فون» واجعلها <b>عامة</b> برابط مثل <span dir="ltr">t.me/lamsaphone</span>. القناة للعروض، ينشر فيها المتجر فقط.
          </li>
          <li>
            <b>مجتمع للنقاش (اختياري ومفيد):</b> من إعدادات القناة ← <b>النقاش</b> ← أنشئ مجموعة «مجتمع لمسة فون». يعلّق الزبائن ويسألون تحت كل منشور، وتبقى القناة نظيفة.
          </li>
          <li>
            <b>أنشئ البوت:</b> افتح <a className="underline" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> ← <span dir="ltr">/newbot</span> ← اسم مثل «Lamsa Phone Bot» ← يعطيك <b>رمزاً</b>: الصقه هنا واضغط حفظ.
          </li>
          <li>
            <b>أضف البوت مشرفاً</b> في القناة (الإعدادات ← المشرفون ← إضافة مشرف ← ابحث باسم البوت) مع صلاحية <b>نشر الرسائل</b>.
          </li>
          <li>انشر أي رسالة في القناة، ثم اضغط «ابحث عن قنواتي ومجموعاتي» واختر القناة، ثم «إرسال رسالة تجربة».</li>
          <li>شغّل الخطة الأسبوعية واختر الأيام والساعات وعدد المنتجات. العدد مفتوح بلا حد من تيليجرام، مثلاً: كل يوم × 3 ساعات (12 ظهراً، 6 و9 مساءً) × منتج = 21 منشوراً أسبوعياً.</li>
        </ol>
        <Text size="small" className="text-ui-fg-subtle">
          تستطيع أيضاً النشر في تيليجرام يدوياً أو بوقت محدد من تبويب «النشر على ميتا» لأي منتج، ومن الإضافة السريعة واستوديو الصور (مفتاح «تيليجرام»). الروابط في تيليجرام قابلة للضغط، ويُضاف تحت كل منشور زرّا «تسوّق» و«واتساب».
        </Text>
      </section>
    </div>
  )
}

export const config = defineRouteConfig({ label: "ربط ميتا", icon: Channels })

export default MetaConnectPage
