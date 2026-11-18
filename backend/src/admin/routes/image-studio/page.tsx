import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo } from "@medusajs/icons"
import { Badge, Button, Checkbox, Container, Heading, Input, Label, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import { Job, checkSourceFile, fetchJobImage, jobApi, prepareSource, uploadOne } from "../../lib/quick-add-ai"
import { ANGLE_LABELS, MANUAL_TIP, angleOf, isAngleKind } from "../../lib/quick-add-angles"
import {
  CATEGORIES,
  CONDITIONS,
  Category,
  Condition,
  EMPTY_INPUT,
  Progress,
  RATIOS,
  Ratio,
  STYLES,
  Step,
  Style,
  StudioInput,
  TOOLS,
  TRACKS,
  Track,
  afterCopy,
  buildSetup,
  buildSteps,
  effectiveStyle,
  isStrict,
  markDone,
  shouldOpenTool,
} from "../../lib/image-studio"

// استوديو الصور: معالج خطوة بخطوة لتوليد صور المنتج يدوياً عبر Gemini وCanva.
// انسخ البرومت ← يفتح الأداة وينتقل للخطوة التالية ← نفّذ ما نسخته ← نزّل الصورة ← انسخ التالي.

const STORE_KEY = "lp-image-studio-v1"
const EMPTY_PROGRESS: Progress = { current: 0, copied: [], done: [] }
const PRESET_STYLE: Record<string, Style> = { studio: "studio", floating: "gradient", dark: "dark", lifestyle: "lifestyle", watermark_clean: "clean", custom: "studio" }
const DEFAULT_TRACKS: Track[] = ["main", "angles"]

type Saved = { input: StudioInput; tracks: Track[]; progress: Progress; jobId: string; autoOpen: boolean }
function loadSaved(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}
  } catch {
    return {}
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const a = document.createElement("textarea")
      a.value = text
      a.style.cssText = "position:fixed;opacity:0"
      document.body.appendChild(a)
      a.select()
      const ok = document.execCommand("copy")
      a.remove()
      return ok
    } catch {
      return false
    }
  }
}
const openTool = (s: Step) => window.open(TOOLS[s.tool].url, `lp-${s.tool}`)

const ImageStudioPage = () => {
  const saved = useMemo(loadSaved, [])
  const [input, setInput] = useState<StudioInput>({ ...EMPTY_INPUT, ...(saved.input || {}) })
  const [tracks, setTracks] = useState<Track[]>(saved.tracks?.length ? saved.tracks : DEFAULT_TRACKS)
  const [progress, setProgress] = useState<Progress>(saved.progress || EMPTY_PROGRESS)
  const [autoOpen, setAutoOpen] = useState(saved.autoOpen ?? true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobId, setJobId] = useState(new URLSearchParams(window.location.search).get("job") || saved.jobId || "")
  const [job, setJob] = useState<Job | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [uploading, setUploading] = useState("")
  const [checks, setChecks] = useState<number[]>([])
  const stepRef = useRef<HTMLDivElement>(null)
  // آخر مهمة عُبّئت بياناتها (لا نمسح تعديلات المستخدم عند إعادة فتح نفس المهمة)
  const filledFor = useRef(saved.input?.name ? saved.jobId || "" : "")

  const steps = useMemo(() => buildSteps(input, tracks), [input, tracks])
  const setup = useMemo(() => buildSetup(input), [input])
  const strict = isStrict(input.condition)
  const styleUsed = effectiveStyle(input.condition, input.style)
  const cur = Math.min(progress.current, steps.length)
  const step = steps[cur]
  const prev = cur > 0 ? steps[cur - 1] : undefined
  const pending = prev && progress.copied.includes(prev.id) && !progress.done.includes(prev.id) ? prev : undefined

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ input, tracks, progress, jobId, autoOpen }))
    } catch {}
  }, [input, tracks, progress, jobId, autoOpen])

  useEffect(() => {
    jobApi
      .list()
      .then((r) => setJobs(r.jobs.filter((j) => !["published", "rejected"].includes(j.status))))
      .catch(() => null)
  }, [])

  // ربط مهمة إضافة سريعة: تعبئة البيانات تلقائياً + الصور المرجعية + رفع الزوايا إليها
  useEffect(() => {
    if (!jobId) return setJob(null)
    jobApi
      .get(jobId)
      .then((j) => {
        setJob(j)
        // تعبئة فقط عند تغيير المهمة (لا نمسح تعديلات المستخدم على نفس المهمة)
        if (filledFor.current !== jobId) {
          filledFor.current = jobId
          const color = (j.input?.variants || []).find((v: any) => v.color)?.color || ""
          setInput((x) => ({
            ...x,
            category: "phone",
            name: j.title,
            brand: j.brand || "",
            color,
            condition: (["new", "used", "refurbished"].includes(j.condition) ? j.condition : "new") as Condition,
            parts: j.parts || "",
            style: PRESET_STYLE[j.preset] || "studio",
            extras: j.preset === "custom" ? j.custom_prompt || "" : x.extras,
          }))
          setProgress(EMPTY_PROGRESS)
        }
      })
      .catch(() => (toast.error("تعذّر تحميل المهمة"), setJobId("")))
  }, [jobId])

  const set = <K extends keyof StudioInput>(k: K, v: StudioInput[K]) => setInput((x) => ({ ...x, [k]: v }))
  const toggleTrack = (t: Track) => {
    setTracks((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
    setProgress(EMPTY_PROGRESS)
  }
  const goto = (n: number) => {
    setProgress((p) => ({ ...p, current: n }))
    stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const copyStep = async (n: number, open = autoOpen) => {
    const s = steps[n]
    const ok = await copyText(s.prompt)
    if (!ok) return toast.error("تعذّر النسخ: حدّد نص البرومت وانسخه يدوياً")
    toast.success(`نُسخ: ${s.title}. الصقه في ${TOOLS[s.tool].name}`)
    if (open && shouldOpenTool(steps, n)) openTool(s)
    setProgress((p) => afterCopy({ ...p, current: n }, steps, n))
    setTimeout(() => stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }

  const references = (job?.images || []).filter((i) => !isAngleKind(i.kind) && !i.excluded).sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.rank - b.rank)
  const downloadRef = async (id: string, n: number) => {
    try {
      const f = await fetchJobImage(job!.id, id, "source")
      const a = document.createElement("a")
      a.href = URL.createObjectURL(f)
      a.download = `${(input.name || "product").replace(/[^\w؀-ۿ-]+/g, "-")}-ref-${n + 1}.${f.name.split(".").pop()}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch (e: any) {
      toast.error(e?.message || "تعذّر التحميل")
    }
  }
  const uploadAngle = async (s: Step, f: File) => {
    if (!job || !s.angle) return
    const err = checkSourceFile(f)
    if (err) return toast.error(err)
    setUploading(s.id)
    try {
      const u = await uploadOne(await prepareSource(f))
      setJob((await jobApi.action(job.id, "manual-angle", { angle: s.angle, file_id: u.id, url: u.url })).job)
      setProgress((p) => markDone(p, s.id))
      toast.success(`رُفعت صورة ${ANGLE_LABELS[s.angle]} إلى المهمة`)
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الرفع")
    } finally {
      setUploading("")
    }
  }
  const angleUploaded = (s: Step) => Boolean(job && s.angle && job.images.some((i) => angleOf(i.kind) === s.angle && i.source === "manual" && i.status === "done"))

  const restart = () => {
    setProgress(EMPTY_PROGRESS)
    setChecks([])
  }
  const newProduct = () => {
    setInput({ ...EMPTY_INPUT, category: input.category, style: input.style, ratio: input.ratio })
    setJobId("")
    restart()
  }

  const finished = cur >= steps.length && steps.length > 0
  const pct = steps.length ? Math.round((progress.copied.filter((id) => steps.some((s) => s.id === id)).length / steps.length) * 100) : 0
  const CHECKS = [
    "قارنت كل صورة بالمنتج الحقيقي: اللون، الشعار، الكاميرات، الأزرار والمنافذ.",
    "لا يوجد نص أو شعار أو سعر مخترع على الصورة.",
    strict ? "العيوب الحقيقية ظاهرة ولم تُخفَ." : "الزوايا الخلفية والجانبية مطابقة للجهاز (ليست تخميناً خاطئاً).",
    "لم أرسل سعر التكلفة أو اسم المورد أو IMEI لأي أداة.",
  ]

  return (
    <Container className="flex flex-col gap-4 p-0" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-4">
        <div>
          <Heading level="h1">استوديو الصور</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            صور منتجات احترافية بحسابك في Gemini وCanva، خطوة بخطوة: انسخ البرومت، نفّذه، ثم انتقل للتالي. بلا تكلفة API.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="secondary" onClick={() => window.open(TOOLS.gemini.url, "lp-gemini")}>✨ فتح Gemini</Button>
          <Button size="small" variant="secondary" onClick={() => window.open(TOOLS.canva.url, "lp-canva")}>🎨 فتح Canva</Button>
          <Button size="small" variant="transparent" onClick={() => setShowSetup((x) => !x)}>⚙️ إعداد لمرة واحدة</Button>
        </div>
      </div>

      {showSetup && <SetupCard gem={setup.gem} canva={setup.canva} onClose={() => setShowSetup(false)} />}

      <div className="grid gap-4 px-6 pb-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* ---------- بيانات المنتج ---------- */}
        <aside className="flex flex-col gap-3 self-start rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <Label size="small">ربط بمهمة إضافة سريعة (اختياري)</Label>
            <Select value={jobId || "none"} onValueChange={(v) => setJobId(v === "none" ? "" : v)}>
              <Select.Trigger>
                <Select.Value placeholder="بدون ربط" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="none">بدون ربط (منتج حر)</Select.Item>
                {jobs.map((j) => (
                  <Select.Item key={j.id} value={j.id}>{j.title}</Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Text size="xsmall" className="text-ui-fg-subtle">مع الربط: تُعبّأ البيانات، وتنزّل الصور المرجعية بزر، وترفع الزوايا الناتجة مباشرة إلى المهمة.</Text>
          </div>

          <div className="flex flex-col gap-1">
            <Label size="small">نوع المنتج</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CATEGORIES) as Category[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("category", k)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${input.category === k ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`}
                >
                  {CATEGORIES[k].icon} {CATEGORIES[k].label}
                </button>
              ))}
            </div>
          </div>
          <Field label="اسم المنتج / الموديل" value={input.name} onChange={(v) => set("name", v)} placeholder="Samsung Galaxy S24 Ultra" ltr />
          <div className="grid grid-cols-2 gap-2">
            <Field label="الماركة" value={input.brand} onChange={(v) => set("brand", v)} ltr />
            <Field label="اللون" value={input.color} onChange={(v) => set("color", v)} placeholder="Titanium Black" ltr />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Pick label="الحالة" value={input.condition} onChange={(v) => set("condition", v as Condition)} items={Object.entries(CONDITIONS).map(([k, v]) => [k, v.label])} />
            <Pick label="النسبة" value={input.ratio} onChange={(v) => set("ratio", v as Ratio)} items={Object.entries(RATIOS)} />
          </div>
          <Pick label="الأسلوب" value={styleUsed} onChange={(v) => set("style", v as Style)} items={Object.entries(STYLES).filter(([k]) => !strict || k === "studio" || k === "clean").map(([k, v]) => [k, v.label])} />
          {strict && <Text size="xsmall" className="text-ui-fg-error">⚠️ {CONDITIONS[input.condition].label}: الاستوديو الأبيض أو التنظيف فقط، ولا تُخفى العيوب، ولا زوايا مولّدة.</Text>}
          <div className="flex flex-col gap-1">
            <Label size="small">تفاصيل يجب أن تبقى كما هي</Label>
            <Textarea rows={2} value={input.parts} onChange={(e) => set("parts", e.target.value)} placeholder={CATEGORIES[input.category].partsHint} />
            <Text size="xsmall" className="text-ui-fg-subtle">أهم حقل: يمنع الذكاء الاصطناعي من تغيير الكاميرات والأزرار.</Text>
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">ملاحظات إضافية (اختياري)</Label>
            <Textarea rows={2} value={input.extras} onChange={(e) => set("extras", e.target.value)} placeholder="مثال: الشاشة مطفأة، مع العلبة" />
          </div>
          {tracks.includes("copy") && (
            <>
              <Field label="المواصفات (للنصوص)" value={input.specs} onChange={(v) => set("specs", v)} placeholder="12GB RAM, 256GB" ltr />
              <Field label="السعر (للنصوص)" value={input.price} onChange={(v) => set("price", v)} placeholder="450$" />
            </>
          )}

          <div className="flex flex-col gap-2 border-t pt-3">
            <Label size="small">ماذا تريد اليوم؟</Label>
            {(["eraser", "main", "angles", "story", "copy"] as Track[]).map((t) => {
              const off = t === "angles" && strict
              return (
                <label key={t} className={`flex items-start gap-2 text-sm ${off ? "opacity-50" : ""}`}>
                  <Checkbox checked={tracks.includes(t) && !off} disabled={off} onCheckedChange={() => toggleTrack(t)} />
                  <span>
                    {TRACKS[t].label}
                    <span className="block text-xs text-ui-fg-subtle">{off ? "غير متاح للمستعمل والمجدّد" : TRACKS[t].hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={autoOpen} onCheckedChange={setAutoOpen} />
            افتح الأداة تلقائياً عند النسخ (عند الحاجة لمحادثة جديدة فقط)
          </label>
          <Text size="xsmall" className="text-ui-fg-subtle">لا تكتب هنا سعر التكلفة أو اسم المورد أو IMEI. البيانات تُحفظ في متصفحك فقط.</Text>
        </aside>

        {/* ---------- المعالج ---------- */}
        <main className="flex min-w-0 flex-col gap-3" ref={stepRef}>
          {!steps.length ? (
            <div className="rounded-lg border p-6 text-center text-sm text-ui-fg-subtle">اختر ما تريد إنتاجه من القائمة.</div>
          ) : (
            <>
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between text-xs">
                  <span>{finished ? "اكتملت كل الخطوات" : `الخطوة ${cur + 1} من ${steps.length}`}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ui-bg-component">
                  <div className="h-full bg-ui-fg-interactive transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {steps.map((s, n) => {
                    const st = progress.done.includes(s.id) ? "✓" : progress.copied.includes(s.id) ? "⏳" : n === cur ? "●" : "○"
                    return (
                      <button key={s.id} type="button" onClick={() => goto(n)} className={`rounded-full border px-2.5 py-0.5 text-xs ${n === cur ? "border-ui-fg-interactive text-ui-fg-interactive" : "text-ui-fg-subtle"}`}>
                        {st} {s.title}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ما نسخته للتو: نفّذه الآن */}
              {pending && (
                <div className="flex flex-col gap-2 rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg p-3 text-ui-tag-orange-text">
                  <Text weight="plus" size="small">⏳ نفّذ الآن في {TOOLS[pending.tool].name}: «{pending.title}»</Text>
                  <ol className="list-decimal space-y-0.5 ps-5 text-sm">
                    {pending.attach === "reference" && <li>تأكد أنك أرفقت الصورة المرجعية.</li>}
                    <li>الصق البرومت (Ctrl+V أو ضغطة مطوّلة ← لصق) وأرسله.</li>
                    <li>{pending.after}</li>
                    {step && <li>ثم انسخ البرومت التالي أدناه.</li>}
                  </ol>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="small" variant="secondary" onClick={() => openTool(pending)}>فتح {TOOLS[pending.tool].name}</Button>
                    {job && pending.angle && <UploadButton label={angleUploaded(pending) ? `✓ رُفعت (استبدال)` : `ارفع صورة ${ANGLE_LABELS[pending.angle]} للمهمة`} busy={uploading === pending.id} onFile={(f) => uploadAngle(pending, f)} />}
                    <Button size="small" variant="transparent" onClick={() => setProgress((p) => markDone(p, pending.id))}>تمّت ✓</Button>
                    <Button size="small" variant="transparent" onClick={() => copyStep(cur - 1, false)}>نسخ نفس البرومت مرة أخرى</Button>
                  </div>
                </div>
              )}

              {step ? (
                <StepCard
                  step={step}
                  index={cur}
                  total={steps.length}
                  copied={progress.copied.includes(step.id)}
                  references={references.slice(0, 3).map((r, n) => ({ label: `الصورة المرجعية ${n + 1}`, onClick: () => downloadRef(r.id, n) }))}
                  onCopy={() => copyStep(cur)}
                  onOpen={() => openTool(step)}
                  onBack={cur > 0 ? () => goto(cur - 1) : undefined}
                  onSkip={() => goto(cur + 1)}
                  upload={job && step.angle ? { label: angleUploaded(step) ? "✓ رُفعت للمهمة (استبدال)" : "ارفع الناتج للمهمة", busy: uploading === step.id, onFile: (f: File) => uploadAngle(step, f) } : undefined}
                />
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <Text weight="plus">🎉 انتهت الخطوات. راجع قبل النشر:</Text>
                  {CHECKS.map((c, n) => (
                    <label key={n} className="flex items-start gap-2 text-sm">
                      <Checkbox checked={checks.includes(n)} onCheckedChange={() => setChecks((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]))} />
                      <span>{c}</span>
                    </label>
                  ))}
                  <Text size="small" className="text-ui-fg-subtle">
                    ارفع الصور في صفحة الإضافة السريعة: هي تقصّها لمقاس المتجر وتضيف ختم لمسة فون تلقائياً، فلا تضف شعاراً بنفسك.
                  </Text>
                  <div className="flex flex-wrap gap-2">
                    <Button size="small" disabled={checks.length < CHECKS.length} onClick={() => (window.location.href = job ? `/app/quick-add#ai` : "/app/quick-add")}>
                      {job ? "العودة للمهمة في الإضافة السريعة" : "فتح الإضافة السريعة"}
                    </Button>
                    <Button size="small" variant="secondary" onClick={restart}>إعادة الخطوات</Button>
                    <Button size="small" variant="secondary" onClick={newProduct}>منتج جديد</Button>
                  </div>
                </div>
              )}

              <Text size="xsmall" className="text-ui-fg-subtle">💡 {MANUAL_TIP}. صورة واحدة في كل رسالة، ولا تفتح محادثة جديدة بين الزوايا.</Text>
              {!finished && (
                <div className="flex gap-2">
                  <Button size="small" variant="transparent" onClick={restart}>البدء من الخطوة الأولى</Button>
                  <Button size="small" variant="transparent" onClick={newProduct}>منتج جديد</Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </Container>
  )
}

function StepCard(p: {
  step: Step
  index: number
  total: number
  copied: boolean
  references: { label: string; onClick: () => void }[]
  onCopy: () => void
  onOpen: () => void
  onBack?: () => void
  onSkip: () => void
  upload?: { label: string; busy: boolean; onFile: (f: File) => void }
}) {
  const s = p.step
  const [showPrompt, setShowPrompt] = useState(false)
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-interactive p-4 shadow-elevation-card-rest">
      <div className="flex flex-wrap items-center gap-2">
        <Badge size="2xsmall" color="blue">{p.index + 1}/{p.total}</Badge>
        <Text weight="plus" className="flex-1">{s.title}</Text>
        <Badge size="2xsmall" color={s.tool === "gemini" ? "purple" : "green"}>{TOOLS[s.tool].where}</Badge>
        {s.sameChat && <Badge size="2xsmall" color="orange">نفس المحادثة</Badge>}
      </div>
      <ol className="list-decimal space-y-1 ps-5 text-sm">
        {s.before.map((b, n) => (
          <li key={n}>{b}</li>
        ))}
        <li>اضغط «نسخ البرومت» ثم الصقه هناك وأرسله.</li>
      </ol>
      {s.attach === "reference" && p.references.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {p.references.map((r) => (
            <Button key={r.label} size="small" variant="secondary" onClick={r.onClick}>⬇️ تحميل {r.label}</Button>
          ))}
        </div>
      )}
      {s.attach === "main_result" && <Text size="xsmall" className="text-ui-fg-subtle">استخدم صورة المتجر الناتجة من الخطوة السابقة.</Text>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={p.onCopy}>📋 {p.copied ? "نسخ مرة أخرى والانتقال" : "نسخ البرومت والانتقال للتالي"}</Button>
        <Button variant="secondary" onClick={p.onOpen}>فتح {TOOLS[s.tool].name}</Button>
        {p.upload && <UploadButton {...p.upload} />}
      </div>
      <div>
        <button type="button" className="text-xs text-ui-fg-interactive underline" onClick={() => setShowPrompt((x) => !x)}>
          {showPrompt ? "إخفاء البرومت" : "عرض البرومت"}
        </button>
        {showPrompt && <pre dir="ltr" className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-ui-bg-subtle p-2 text-start text-[11px] leading-4">{s.prompt}</pre>}
      </div>
      <Text size="xsmall" className="text-ui-fg-subtle">بعد ظهور الصورة: {s.after}</Text>
      <div className="flex gap-2">
        {p.onBack && <Button size="small" variant="transparent" onClick={p.onBack}>→ السابق</Button>}
        <Button size="small" variant="transparent" onClick={p.onSkip}>تخطّي ←</Button>
      </div>
    </div>
  )
}

function SetupCard({ gem, canva, onClose }: { gem: string; canva: string; onClose: () => void }) {
  const copy = async (t: string, m: string) => ((await copyText(t)) ? toast.success(m) : toast.error("تعذّر النسخ"))
  return (
    <div className="mx-6 flex flex-col gap-3 rounded-lg border bg-ui-bg-subtle p-4">
      <div className="flex items-center justify-between">
        <Text weight="plus">⚙️ إعداد لمرة واحدة (يوفّر عليك تكرار القواعد كل مرة)</Text>
        <Button size="small" variant="transparent" onClick={onClose}>إغلاق</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded border bg-ui-bg-base p-3 text-sm">
          <Text weight="plus" size="small">Gemini: أنشئ Gem باسم «صور لمسة فون»</Text>
          <ol className="list-decimal space-y-0.5 ps-5">
            <li>افتح صفحة إنشاء Gem.</li>
            <li>الاسم: صور لمسة فون. الصق التعليمات في خانة Instructions واحفظ.</li>
            <li>بعدها ابدأ كل منتج من هذا الـ Gem.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button size="small" onClick={() => copy(gem, "نُسخت تعليمات الـ Gem")}>📋 نسخ التعليمات</Button>
            <Button size="small" variant="secondary" onClick={() => window.open("https://gemini.google.com/gems/create", "lp-gemini")}>فتح إنشاء Gem</Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded border bg-ui-bg-base p-3 text-sm">
          <Text weight="plus" size="small">Canva: ذاكرة Canva AI</Text>
          <ol className="list-decimal space-y-0.5 ps-5">
            <li>افتح Canva AI ← الإعدادات أو «About me / Memory».</li>
            <li>الصق النص واحفظ. إن لم تجد الخيار، الصقه أول رسالة في المحادثة.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button size="small" onClick={() => copy(canva, "نُسخ نص Canva")}>📋 نسخ النص</Button>
            <Button size="small" variant="secondary" onClick={() => window.open(TOOLS.canva.url, "lp-canva")}>فتح Canva AI</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UploadButton({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button size="small" variant="secondary" isLoading={busy} onClick={() => ref.current?.click()}>⬆️ {label}</Button>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => (e.target.files?.[0] && onFile(e.target.files[0]), (e.target.value = ""))} />
    </>
  )
}

function Field({ label, value, onChange, placeholder, ltr }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Label size="small">{label}</Label>
      <Input size="small" dir={ltr ? "auto" : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  )
}

function Pick({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1">
      <Label size="small">{label}</Label>
      <Select size="small" value={value} onValueChange={onChange}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {items.map(([k, v]) => (
            <Select.Item key={k} value={k}>{v}</Select.Item>
          ))}
        </Select.Content>
      </Select>
    </div>
  )
}

export const config = defineRouteConfig({ label: "استوديو الصور", icon: Photo })
export default ImageStudioPage
