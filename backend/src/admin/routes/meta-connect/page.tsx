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

// ---------- الجدولة والنشر التلقائي: خطط مستقلة لكل منصة أو مجتمعة ----------
type Res = { ok: boolean; url?: string; error?: string; skipped?: boolean }
type Item = { id: string; at: string; label: string; status: string; done_at?: string; results?: Record<string, Res>; error?: string; body: Record<string, any> }
type Plan = { id: string; name: string; enabled: boolean; days: number[]; hours: number[]; per_run: number; dests: string[] }
type State = { queue: Item[]; plans: Plan[]; upcoming: Record<string, { id: string; title: string }[]>; now: { hour: number; key: string; day: number } }

const DEST: [string, string][] = [
  ["facebook", "فيسبوك"],
  ["instagram", "إنستغرام (منشور)"],
  ["ig_story", "قصة إنستغرام"],
  ["threads", "Threads"],
  ["telegram", "تيليجرام"],
  ["catalog", "الكتالوج + واتساب"],
]
const DEST_NAMES: Record<string, string> = { facebook: "فيسبوك", instagram: "إنستغرام", ig_story: "قصة", threads: "Threads", telegram: "تيليجرام", catalog: "الكتالوج", all: "ميتا" }
const STATUS: Record<string, [string, "green" | "orange" | "red" | "grey" | "blue"]> = {
  pending: ["مجدول", "blue"],
  running: ["يُنشر الآن", "orange"],
  done: ["نُشر", "green"],
  failed: ["فشل", "red"],
  cancelled: ["أُلغي", "grey"],
}
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const fmt = (iso: string) => new Date(iso).toLocaleString("ar", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "صباحاً" : "مساءً"}`
const newId = () => `p${Date.now().toString(36)}`

// قوالب جاهزة: كل منصة لحالها، أو الكل معاً
const TEMPLATES: { label: string; plan: Omit<Plan, "id"> }[] = [
  { label: "فيسبوك وحده", plan: { name: "فيسبوك", enabled: false, days: ALL_DAYS, hours: [12], per_run: 1, dests: ["facebook"] } },
  { label: "إنستغرام وحده", plan: { name: "إنستغرام", enabled: false, days: ALL_DAYS, hours: [20], per_run: 1, dests: ["instagram"] } },
  { label: "قصص إنستغرام", plan: { name: "قصص إنستغرام", enabled: false, days: ALL_DAYS, hours: [10, 18], per_run: 1, dests: ["ig_story"] } },
  { label: "Threads وحده", plan: { name: "Threads", enabled: false, days: ALL_DAYS, hours: [14], per_run: 1, dests: ["threads"] } },
  { label: "تيليجرام وحده", plan: { name: "تيليجرام", enabled: false, days: [0, 2, 4], hours: [20], per_run: 1, dests: ["telegram"] } },
  { label: "الكتالوج وواتساب", plan: { name: "الكتالوج وواتساب", enabled: false, days: ALL_DAYS, hours: [9], per_run: 3, dests: ["catalog"] } },
  { label: "الكل معاً", plan: { name: "الكل معاً", enabled: false, days: ALL_DAYS, hours: [20], per_run: 1, dests: ["facebook", "instagram", "threads", "telegram"] } },
]

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`
const toggle = (a: number[], v: number, max = 7) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v].sort((x, y) => x - y).slice(0, max))

function PlanCard({ p, onChange, onDelete, upcoming }: { p: Plan; onChange: (p: Plan) => void; onDelete: () => void; upcoming: { id: string; title: string }[] }) {
  const perWeek = p.days.length * p.hours.length * p.per_run
  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-4 ${p.enabled ? "border-ui-fg-interactive" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <input className="min-w-0 flex-1 rounded-md border bg-ui-bg-field px-2 py-1 text-sm font-medium" value={p.name} maxLength={40} onChange={(e) => onChange({ ...p, name: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={p.enabled} onCheckedChange={(v) => onChange({ ...p, enabled: v })} />
          {p.enabled ? "تعمل" : "متوقفة"}
        </label>
        <button type="button" className="text-xs text-ui-fg-error hover:underline" onClick={onDelete}>حذف</button>
      </div>
      <div className="flex flex-col gap-1">
        <Text size="xsmall" weight="plus">المنصات</Text>
        <div className="flex flex-wrap gap-1">
          {DEST.map(([k, l]) => (
            <button key={k} type="button" className={chip(p.dests.includes(k))} onClick={() => onChange({ ...p, dests: p.dests.includes(k) ? p.dests.filter((x) => x !== k) : [...p.dests, k] })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Text size="xsmall" weight="plus">الأيام</Text>
          <button type="button" className="text-[11px] text-ui-fg-interactive hover:underline" onClick={() => onChange({ ...p, days: p.days.length === 7 ? [] : ALL_DAYS })}>
            {p.days.length === 7 ? "إلغاء الكل" : "كل يوم"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {DAYS.map((d, i) => (
            <button key={d} type="button" className={chip(p.days.includes(i))} onClick={() => onChange({ ...p, days: toggle(p.days, i) })}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Text size="xsmall" weight="plus">الساعات (توقيت صنعاء، حتى 6)</Text>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 24 }, (_, h) => h).map((h) => (
            <button key={h} type="button" className={`min-w-[60px] ${chip(p.hours.includes(h))}`} onClick={() => onChange({ ...p, hours: toggle(p.hours, h, 6) })}>
              {hourLabel(h)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Text size="xsmall" weight="plus">منتجات كل مرة:</Text>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={chip(p.per_run === n)} onClick={() => onChange({ ...p, per_run: n })}>
            {n}
          </button>
        ))}
        <Text size="xsmall" className="text-ui-fg-subtle">= {perWeek} منشور أسبوعياً</Text>
      </div>
      {p.enabled && (!p.dests.length || !p.days.length || !p.hours.length) && <Text size="xsmall" className="text-ui-fg-error">اختر منصة ويوماً وساعة على الأقل حتى تعمل.</Text>}
      {upcoming.length > 0 && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          التالي: {upcoming.map((x) => x.title).join(" ← ")}
        </Text>
      )}
    </div>
  )
}

function SchedulePanel() {
  const [st, setSt] = useState<State | null>(null)
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState("")

  const apply = (r: State) => (setSt(r), setPlans(r.plans))
  const load = () => sdk.client.fetch<State>("/admin/quick-add/schedule").then(apply).catch((e) => toast.error(String(e?.message || e)))
  useEffect(() => {
    load()
  }, [])

  if (!st || !plans) return <Text className="p-6">جارٍ التحميل…</Text>
  const strip = (x: Plan[]) => JSON.stringify(x.map(({ id, name, enabled, days, hours, per_run, dests }) => ({ id, name, enabled, days, hours, per_run, dests })))
  const dirty = strip(plans) !== strip(st.plans)

  const savePlans = async () => {
    setSaving(true)
    try {
      apply(await sdk.client.fetch<State>("/admin/quick-add/schedule", { method: "POST", body: { action: "plans", plans } }))
      toast.success("حُفظت خطط النشر")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }
  const act = async (id: string, action: "cancel" | "run_now") => {
    setBusyId(id)
    try {
      apply(await sdk.client.fetch<State>("/admin/quick-add/schedule", { method: "POST", body: { action, id } }))
      toast.success(action === "cancel" ? "أُلغي المنشور" : "تم التنفيذ، راجع النتيجة")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر التنفيذ")
    } finally {
      setBusyId("")
    }
  }

  const pending = st.queue.filter((x) => x.status === "pending" || x.status === "running").sort((a, b) => a.at.localeCompare(b.at))
  const past = st.queue.filter((x) => !(x.status === "pending" || x.status === "running")).slice(0, 30)
  const active = st.plans.filter((p) => p.enabled)

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-lg border bg-ui-bg-subtle p-4">
          <Text weight="plus">🤖 خطط النشر التلقائي</Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            كل خطة مستقلة بمنصاتها وأيامها وساعاتها: فيسبوك وحده، إنستغرام وحده، Threads وحده، تيليجرام وحده، أو أي مزيج. كل خطة تنشر بالنص الجاهز منتجات المتجر التي لم
            تُنشر بعد على منصاتها هي، ولا يتكرر منتج على نفس المنصة.
          </Text>
          <div className="flex flex-wrap items-center gap-1">
            <Text size="xsmall" weight="plus">+ خطة جديدة:</Text>
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" className={chip(false)} onClick={() => setPlans([...plans, { ...t.plan, id: newId() }])}>
                {t.label}
              </button>
            ))}
          </div>
          <Text size="xsmall">
            {active.length ? `يعمل الآن ${active.length}: ${active.map((p) => p.name).join("، ")}` : "لا توجد خطة تعمل."} · الوقت في صنعاء الآن: {DAYS[st.now.day]} {hourLabel(st.now.hour)}
          </Text>
        </div>
        {plans.map((p, i) => (
          <PlanCard
            key={p.id}
            p={p}
            upcoming={st.upcoming[p.id] || []}
            onChange={(n) => setPlans(plans.map((x, k) => (k === i ? n : x)))}
            onDelete={() => confirm(`حذف خطة «${p.name}»؟`) && setPlans(plans.filter((_, k) => k !== i))}
          />
        ))}
        {!plans.length && <Text size="small" className="text-ui-fg-subtle">لا توجد خطط. أضف خطة من القوالب أعلاه.</Text>}
        <div className="sticky bottom-2 flex items-center gap-2">
          <Button isLoading={saving} disabled={!dirty} onClick={savePlans}>حفظ الخطط</Button>
          {dirty && <Text size="xsmall" className="text-ui-fg-subtle">لديك تغييرات غير محفوظة</Text>}
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          واتساب: لا تسمح ميتا بالنشر الآلي في «الحالة» أو «قنوات واتساب». المتاح «الكتالوج + واتساب»: يحدّث منتجاتك في كتالوج واتساب للأعمال تلقائياً.
          الترتيب في كل خطة: ما اخترت له «مع النشر التلقائي» أولاً، ثم ترتيب العرض في المتجر، ثم الأحدث.
        </Text>
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

// ---------- تيليجرام: مستقل عن ميتا، بوت ينشر في قناتك أو مجموعتك (مواعيده في خطط الجدولة) ----------
type TgPlan = { enabled: boolean; days: number[]; hours: number[]; per_run: number }
type TgPublic = { has_token: boolean; token_hint: string; chat_id: string; chat_title: string; bot_username: string; plan: TgPlan; from_env: boolean }
type TgChat = { id: string; title: string; type: string }
const CHAT_TYPE: Record<string, string> = { channel: "قناة", supergroup: "مجموعة", group: "مجموعة" }

function TelegramPanel() {
  const [s, setS] = useState<TgPublic | null>(null)
  const [upcoming, setUpcoming] = useState<{ id: string; title: string }[]>([])
  const [token, setToken] = useState("")
  const [chats, setChats] = useState<TgChat[] | null>(null)
  const [manual, setManual] = useState("")
  const [busy, setBusy] = useState("")

  const load = () =>
    sdk.client
      .fetch<{ settings: TgPublic; upcoming: { id: string; title: string }[] }>("/admin/quick-add/telegram")
      .then((r) => (setS(r.settings), setUpcoming(r.upcoming)))
      .catch((e) => toast.error(String(e?.message || e)))
  useEffect(() => {
    load()
  }, [])

  const call = async (key: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(key)
    try {
      const r = await sdk.client.fetch<any>("/admin/quick-add/telegram", { method: "POST", body })
      if (r.settings) setS(r.settings)
      if (r.chats) setChats(r.chats)
      if (ok) toast.success(ok)
      return r
    } catch (e: any) {
      toast.error(e?.message || "تعذّر التنفيذ")
    } finally {
      setBusy("")
    }
  }

  if (!s) return <Text className="p-6">جارٍ التحميل…</Text>

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

        <div className="flex flex-col gap-2 rounded-lg border bg-ui-bg-subtle p-4">
          <Text weight="plus">📆 مواعيد النشر في تيليجرام</Text>
          <Text size="small">
            تُضبط من تبويب «الجدولة والنشر التلقائي» ← «+ خطة جديدة» ← «تيليجرام وحده» (أو ضمّه لخطة مع ميتا). تختار الأيام والساعات وعدد المنتجات، بلا حد من تيليجرام.
          </Text>
          {upcoming.length > 0 && <Text size="xsmall" className="text-ui-fg-subtle">التالي في تيليجرام: {upcoming.map((x) => x.title).join(" ← ")}</Text>}
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
          <li>من تبويب «الجدولة والنشر التلقائي» أضف خطة «تيليجرام وحده» واختر الأيام والساعات وعدد المنتجات (بلا حد من تيليجرام)، أو ضمّ تيليجرام لخطة مع ميتا.</li>
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
