import { Badge, Button, Checkbox, Container, Heading, Input, Label, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Attach,
  CATEGORIES,
  CONDITIONS,
  Category,
  Condition,
  EMPTY_INPUT,
  Progress,
  RATIOS,
  REFUSAL_HELP,
  Ratio,
  STYLES,
  Step,
  Style,
  StudioInput,
  TOOLS,
  TRACKS,
  TRACK_ORDER,
  gsmSearchUrl,
  hasGsm,
  Track,
  afterCopy,
  buildSetup,
  buildSteps,
  effectiveStyle,
  isStrict,
  markDone,
  shouldOpenTool,
} from "../lib/image-studio"
import { processImage } from "../lib/quick-add-image"
import { sdk } from "../lib/sdk"
import { NOW, StyleInfo, StylePicker, When, WhenPicker, whenBody, whenLabel } from "./quick-add-products"

// استوديو الصور: معالج خطوة بخطوة لتوليد صور المنتج يدوياً عبر Gemini وCanva (بلا API ولا تكلفة).
// انسخ البرومت ← تُفتح الأداة وينتقل للخطوة التالية ← نفّذ ما نسخته ← نزّل الصورة ← انسخ التالي.

const STORE_KEY = "lp-image-studio-v3"
const EMPTY_PROGRESS: Progress = { current: 0, copied: [], done: [] }
const DEFAULT_TRACKS: Track[] = ["details", "main", "angles"]

// خانات الصور (في الذاكرة فقط، لا تُرفع لأي مكان)
type SlotKey = "reference" | "anchor" | "main"
const SLOT_LABELS: Record<SlotKey, string> = { reference: "الصورة المرجعية (الخلفية أفضل)", anchor: "الخلفية الناتجة (للزوايا)", main: "صورة المتجر الناتجة" }
const ATTACH_SLOTS: Record<Attach, SlotKey[]> = { reference: ["reference"], anchor: ["anchor"], main_result: ["main"], none: [] }

type Saved = { input: StudioInput; tracks: Track[]; progress: Progress; autoOpen: boolean }
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
// نسخ صورة للحافظة (PNG) لتلصقها مباشرة في Gemini أو Canva بـ Ctrl+V
async function copyImage(file: File) {
  const toPng = async () => {
    if (file.type === "image/png") return file
    const bmp = await createImageBitmap(file)
    const c = document.createElement("canvas")
    c.width = bmp.width
    c.height = bmp.height
    c.getContext("2d")!.drawImage(bmp, 0, 0)
    bmp.close()
    return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"))
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": toPng() })])
    return true
  } catch {
    return false
  }
}
const openTool = (s: Step) => window.open(TOOLS[s.tool].url, `lp-${s.tool}`)

// تبويب «تصميم الصور» في الاستوديو الإبداعي: onShare يشارك بيانات المنتج وصورة المتجر الناتجة مع تبويبَي «منتج جديد» و«منشور»
export function StudioDesign({ onShare, onGoAdd }: { onShare?: (input: StudioInput, mainImage?: File) => void; onGoAdd?: () => void }) {
  const saved = useMemo(loadSaved, [])
  const [input, setInput] = useState<StudioInput>({ ...EMPTY_INPUT, ...(saved.input || {}) })
  const [tracks, setTracks] = useState<Track[]>(saved.tracks?.length ? saved.tracks : DEFAULT_TRACKS)
  const [progress, setProgress] = useState<Progress>(saved.progress || EMPTY_PROGRESS)
  const [autoOpen, setAutoOpen] = useState(saved.autoOpen ?? true)
  const [slots, setSlots] = useState<Partial<Record<SlotKey, { file: File; url: string }>>>({})
  const [showSetup, setShowSetup] = useState(false)
  const [checks, setChecks] = useState<number[]>([])
  const stepRef = useRef<HTMLDivElement>(null)

  const steps = useMemo(() => buildSteps(input, tracks), [input, tracks])
  const setup = useMemo(() => buildSetup(input), [input])
  const strict = isStrict(input.condition)
  const styleUsed = effectiveStyle(input.condition, input.style)
  const cur = Math.min(progress.current, steps.length)
  const step = steps[cur]
  const prev = cur > 0 ? steps[cur - 1] : undefined
  const pending = prev && progress.copied.includes(prev.id) && !progress.done.includes(prev.id) ? prev : undefined
  const usedSlots = Array.from(new Set(steps.flatMap((s) => ATTACH_SLOTS[s.attach])))

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ input, tracks, progress, autoOpen }))
    } catch {}
  }, [input, tracks, progress, autoOpen])
  // يشارك اسم المنتج وبياناته وصورة المتجر الناتجة مع تبويبَي «منتج جديد» و«منشور»
  useEffect(() => onShare?.(input, slots.main?.file), [input, slots.main])
  // تحرير روابط الصور عند الخروج
  useEffect(() => () => Object.values(slots).forEach((s) => s && URL.revokeObjectURL(s.url)), [])

  const set = <K extends keyof StudioInput>(k: K, v: StudioInput[K]) => setInput((x) => ({ ...x, [k]: v }))
  const toggleTrack = (t: Track) => {
    setTracks((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
    setProgress(EMPTY_PROGRESS)
  }
  const scrollToStep = () => setTimeout(() => stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  const goto = (n: number) => (setProgress((p) => ({ ...p, current: n })), scrollToStep())

  const putSlot = (k: SlotKey, f: File) => {
    if (!/^image\//.test(f.type)) return toast.error("اختر صورة JPG أو PNG أو WebP")
    setSlots((s) => {
      if (s[k]) URL.revokeObjectURL(s[k]!.url)
      return { ...s, [k]: { file: f, url: URL.createObjectURL(f) } }
    })
  }
  const copySlot = async (k: SlotKey) => {
    const s = slots[k]
    if (!s) return toast.error(`ضع ${SLOT_LABELS[k]} في خانتها أولاً`)
    ;(await copyImage(s.file)) ? toast.success(`نُسخت ${SLOT_LABELS[k]}: الصقها في المحادثة (Ctrl+V)`) : toast.error("المتصفح لم يسمح بنسخ الصورة: اسحبها أو أرفقها يدوياً")
  }

  const copyStep = async (n: number, open = autoOpen) => {
    const s = steps[n]
    if (!(await copyText(s.prompt))) return toast.error("تعذّر النسخ: اعرض البرومت وانسخه يدوياً")
    toast.success(`نُسخ: ${s.title}. الصقه في ${TOOLS[s.tool].name}`)
    if (open && shouldOpenTool(steps, n)) openTool(s)
    setProgress((p) => afterCopy({ ...p, current: n }, steps, n))
    scrollToStep()
  }

  const restart = () => (setProgress(EMPTY_PROGRESS), setChecks([]))
  const newProduct = () => {
    setInput({ ...EMPTY_INPUT, category: input.category, style: input.style, ratio: input.ratio })
    Object.values(slots).forEach((s) => s && URL.revokeObjectURL(s.url))
    setSlots({})
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
    <div className="flex flex-col gap-4" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-4">
        <div>
          <Heading level="h1">استوديو الصور</Heading>
          <Text size="small" className="text-ui-fg-subtle">صور منتجات احترافية بحسابك في Gemini وCanva، خطوة بخطوة: انسخ البرومت، نفّذه، ثم انتقل للتالي.</Text>
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
          {hasGsm(input.category) && (
            <a
              href={input.name.trim() ? gsmSearchUrl(`${input.brand} ${input.name}`) : "https://www.gsmarena.com/"}
              target="_blank"
              rel="noreferrer"
              className="-mt-2 text-xs text-ui-fg-interactive underline"
            >
              🔎 ابحث عن الجهاز في GSMArena (الشكل، الألوان، المواصفات)
            </a>
          )}
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
            <Text size="xsmall" className="text-ui-fg-subtle">أهم حقل: يمنع تغيير الكاميرات والأزرار.</Text>
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
            {TRACK_ORDER.map((t) => {
              const off = (t === "angles" && strict) || (t === "details" && !hasGsm(input.category))
              return (
                <label key={t} className={`flex items-start gap-2 text-sm ${off ? "opacity-50" : ""}`}>
                  <Checkbox checked={tracks.includes(t) && !off} disabled={off} onCheckedChange={() => toggleTrack(t)} />
                  <span>
                    {TRACKS[t].label}
                    <span className="block text-xs text-ui-fg-subtle">{off ? (t === "details" ? "للجوالات والتابلت والساعات فقط" : "غير متاح للمستعمل والمجدّد") : TRACKS[t].hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={autoOpen} onCheckedChange={setAutoOpen} />
            افتح الأداة تلقائياً عند النسخ (عند الحاجة لمحادثة جديدة فقط)
          </label>
          <Text size="xsmall" className="text-ui-fg-subtle">لا تكتب هنا سعر التكلفة أو اسم المورد أو IMEI. البيانات تُحفظ في متصفحك فقط، والصور لا تُرفع لأي مكان.</Text>
        </aside>

        {/* ---------- المعالج ---------- */}
        <main className="flex min-w-0 flex-col gap-3" ref={stepRef}>
          {usedSlots.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {(["reference", "anchor", "main"] as SlotKey[])
                .filter((k) => usedSlots.includes(k))
                .map((k) => (
                  <ImageSlot key={k} label={SLOT_LABELS[k]} url={slots[k]?.url} onFile={(f) => putSlot(k, f)} onCopy={() => copySlot(k)} />
                ))}
            </div>
          )}

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
                    {ATTACH_SLOTS[pending.attach].length > 0 && <li>أرفق: {ATTACH_SLOTS[pending.attach].map((k) => SLOT_LABELS[k]).join(" + ")}.</li>}
                    <li>الصق البرومت (Ctrl+V أو ضغطة مطوّلة ← لصق) وأرسله.</li>
                    <li>{pending.after}</li>
                    {step && !pending.after.includes("البرومت التالي") && <li>ثم انسخ البرومت التالي أدناه.</li>}
                  </ol>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="small" variant="secondary" onClick={() => openTool(pending)}>فتح {TOOLS[pending.tool].name}</Button>
                    {pending.angle === "back" && <SlotUpload label="ضع الخلفية الناتجة" onFile={(f) => putSlot("anchor", f)} />}
                    {pending.id === "main" && tracks.includes("story") && <SlotUpload label="ضع صورة المتجر الناتجة" onFile={(f) => putSlot("main", f)} />}
                    <Button size="small" variant="transparent" onClick={() => setProgress((p) => markDone(p, pending.id))}>تمّت ✓</Button>
                    <Button size="small" variant="transparent" onClick={() => copyStep(cur - 1, false)}>نسخ نفس البرومت مرة أخرى</Button>
                  </div>
                  {pending.fallback && <Refusal step={pending} />}
                </div>
              )}

              {step ? (
                <StepCard step={step} index={cur} total={steps.length} copied={progress.copied.includes(step.id)} onCopy={() => copyStep(cur)} onOpen={() => openTool(step)} onCopySlot={copySlot} hasSlot={(k) => Boolean(slots[k])} onBack={cur > 0 ? () => goto(cur - 1) : undefined} onSkip={() => goto(cur + 1)} />
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <Text weight="plus">🎉 انتهت الخطوات. راجع قبل النشر:</Text>
                  {CHECKS.map((c, n) => (
                    <label key={n} className="flex items-start gap-2 text-sm">
                      <Checkbox checked={checks.includes(n)} onCheckedChange={() => setChecks((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]))} />
                      <span>{c}</span>
                    </label>
                  ))}
                  <Text size="small" className="text-ui-fg-subtle">اضغط «أضفه للمتجر الآن»: تنتقل «صورة المتجر الناتجة» وبيانات المنتج إلى تبويب «منتج جديد»، وتُقصّ لمقاس المتجر ويُضاف ختم لمسة فون تلقائياً، فلا تضف شعاراً بنفسك. أو انشرها بلا إضافة من تبويب «منشور فقط».</Text>
                  <div className="flex flex-wrap gap-2">
                    <Button size="small" disabled={checks.length < CHECKS.length} onClick={() => onGoAdd?.()}>أضفه للمتجر الآن</Button>
                    <Button size="small" variant="secondary" onClick={restart}>إعادة الخطوات</Button>
                    <Button size="small" variant="secondary" onClick={newProduct}>منتج جديد</Button>
                  </div>
                </div>
              )}

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

    </div>
  )
}

// ---------- نشر حر على ميتا من الاستوديو: منشور أو قصة بلا إضافة منتج للمتجر ----------
type MetaFlags = { has_token: boolean; page_id: string; threads_has_token?: boolean; telegram_ready?: boolean }
// صورة جديدة من الجهاز (ملفات تُرفع عند النشر)، أو صورة محفوظة لمنتج من المتجر (رابط جاهز)
type PubImg = { post?: File; story?: File; url?: string; preview: string }
type PubResult = { ok: boolean; url?: string; error?: string; skipped?: boolean; comment_error?: string }
const PUB_NAMES: Record<string, string> = { facebook: "فيسبوك", instagram: "إنستغرام", ig_story: "قصة إنستغرام", threads: "Threads", telegram: "تيليجرام", all: "ميتا" }

// صورة القصة: كما هي (بلا قص) بصيغة JPEG أقل من 1MB (حد الرفع في السيرفر)
async function toStoryJpeg(file: File): Promise<File> {
  const bmp = await createImageBitmap(file)
  for (const [max, q] of [[1600, 0.88], [1280, 0.82], [1080, 0.75]] as const) {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement("canvas")
    c.width = Math.round(bmp.width * s)
    c.height = Math.round(bmp.height * s)
    const ctx = c.getContext("2d")!
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", q))
    if (blob.size < 950 * 1024 || max === 1080) return new File([blob], `${file.name.replace(/\.\w+$/, "")}-story.jpg`, { type: "image/jpeg" })
  }
  throw new Error("تعذّر تجهيز صورة القصة")
}

// نص جاهز من بيانات الاستوديو (المواصفات واللون)
const studioText = (i: StudioInput) =>
  [i.specs.trim() && `▫️ المواصفات: ${i.specs.trim()}`, i.color.trim() && `🎨 اللون: ${i.color.trim()}`].filter(Boolean).join("\n")

export function StudioPublish({ input = EMPTY_INPUT, mainImage }: { input?: StudioInput; mainImage?: File }) {
  const [meta, setMeta] = useState<MetaFlags | null>(null)
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")
  const [text, setText] = useState("")
  const [tags, setTags] = useState("")
  const [imgs, setImgs] = useState<PubImg[]>([])
  const [adding, setAdding] = useState(0)
  const [toFb, setToFb] = useState(true)
  const [toIg, setToIg] = useState(true)
  const [toStory, setToStory] = useState(false)
  const [toThreads, setToThreads] = useState(false)
  const [toTg, setToTg] = useState(false)
  const [when, setWhen] = useState<When>(NOW)
  const [busy, setBusy] = useState("")
  const [results, setResults] = useState<Record<string, PubResult> | null>(null)
  // منتج من المتجر فُتح من تبويب «النشر على ميتا» (?product=…): يُنشر باسمه ويُسجَّل في المنتج
  const [product, setProduct] = useState<{ id: string; title: string } | null>(null)
  const [postStyle, setPostStyle] = useState("")
  const [hook, setHook] = useState<string | undefined>(undefined)
  const [info, setInfo] = useState<(StyleInfo & { caption: string }) | null>(null)

  useEffect(() => {
    sdk.client.fetch<{ settings: MetaFlags }>("/admin/quick-add/meta-settings").then((r) => setMeta(r.settings)).catch(() => setMeta({ has_token: false, page_id: "" }))
    const id = new URLSearchParams(window.location.search).get("product")
    if (!id) return
    sdk.admin.product
      .retrieve(id, { fields: "id,title,thumbnail,metadata,images.url,variants.prices.amount,variants.prices.currency_code" } as any)
      .then(({ product: p }: any) => {
        setProduct({ id: p.id, title: p.title })
        setTitle(p.title)
        const usd = (p.variants || []).flatMap((v: any) => v.prices || []).filter((x: any) => x.currency_code === "usd").map((x: any) => Number(x.amount))
        setPrice(usd.length ? String(Math.min(...usd)) : "")
        const urls: string[] = Array.isArray(p.metadata?.meta_images) && p.metadata.meta_images.length ? p.metadata.meta_images : [p.thumbnail, ...(p.images || []).map((i: any) => i.url)].filter(Boolean)
        setImgs(Array.from(new Set(urls)).slice(0, 10).map((u) => ({ url: u, preview: u })))
        return sdk.client.fetch<{ auto_text: string; suggested: string[] }>("/admin/quick-add/preview", { method: "POST", body: { product_id: p.id } })
      })
      .then((r: any) => r && (setText(r.auto_text), setTags(r.suggested.join(" "))))
      .catch(() => toast.error("تعذّر تحميل المنتج"))
  }, [])
  // معاينة المنشور مع الأسلوب والبداية وتنبيهات سياسات ميتا
  useEffect(() => {
    const t = setTimeout(() => {
      const n = Number(price)
      sdk.client
        .fetch<StyleInfo & { caption: string }>("/admin/quick-add/preview", {
          method: "POST",
          body: { title: title || "منشور", price: n > 0 ? n : undefined, text, hashtags: tags, style: postStyle || undefined, hook, product_id: product?.id },
        })
        .then(setInfo)
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [title, price, text, tags, postStyle, hook, product?.id])
  // يملأ العنوان والسعر والنص من بيانات المنتج في الاستوديو (ويمكن تعديلها)
  const fill = () => {
    setTitle([input.brand, input.name].map((x) => x.trim()).filter(Boolean).join(" "))
    setPrice(input.price.replace(/[^\d.]/g, ""))
    setText(studioText(input))
  }
  useEffect(() => {
    if (!title && !text && !new URLSearchParams(window.location.search).get("product")) fill()
  }, [input.name])

  const add = async (files: File[]) => {
    const list = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif|avif|webp|jpe?g|png)$/i.test(f.name)).slice(0, Math.max(0, 10 - imgs.length))
    setAdding((n) => n + list.length)
    for (const f of list) {
      try {
        // المنشور: قص 4:5 مع ختم لمسة فون (مثل الإضافة السريعة). القصة: الصورة كما هي
        const pr = await processImage(f, { mode: "contain", autoTrim: true, background: "auto", brand: true })
        const story = await toStoryJpeg(f)
        setImgs((xs) => [...xs, { post: pr.jpeg, story, preview: pr.postPreview || pr.preview }])
      } catch {
        toast.error(`تعذّر قراءة الصورة ${f.name}`)
      } finally {
        setAdding((n) => n - 1)
      }
    }
  }

  const ready = Boolean(meta?.has_token && meta.page_id)
  const threadsReady = Boolean(meta?.threads_has_token)
  const tgReady = Boolean(meta?.telegram_ready)
  const any = (ready && (toFb || toIg || toStory)) || (threadsReady && toThreads) || (tgReady && toTg)
  const publish = async () => {
    if (!imgs.length) return toast.error("أضف صورة واحدة على الأقل")
    if (!title.trim()) return toast.error("اكتب عنوان المنشور")
    setResults(null)
    try {
      setBusy("رفع الصور…")
      const upload = async (f: File) => ((await sdk.admin.upload.create({ files: [f] })).files[0] as any).url as string
      const images: string[] = []
      if (toFb || toIg || toThreads || toTg) for (const i of imgs) images.push(i.post ? await upload(i.post) : i.url!)
      const story_image = toStory ? (imgs[0].story ? await upload(imgs[0].story) : imgs[0].url) : undefined
      if (when.mode === "at" && !when.at) throw new Error("اختر وقت النشر")
      setBusy(when.mode === "at" ? "الجدولة…" : "النشر على ميتا…")
      const n = Number(price)
      const r = await sdk.client.fetch<{ results?: Record<string, PubResult>; scheduled?: { at: string } }>("/admin/quick-add/publish", {
        method: "POST",
        body: { ...(product ? { product_id: product.id } : {}), title: title.trim(), price: n > 0 ? n : undefined, text, hashtags: tags, style: info?.style, hook: hook ?? info?.hook ?? "", images: images.length ? images : [story_image], story_image, facebook: ready && toFb, instagram: ready && toIg, ig_story: ready && toStory, threads: threadsReady && toThreads, telegram: tgReady && toTg, catalog: false, use_video: false, ...whenBody(when) },
      })
      if (r.scheduled) {
        toast.success(`جُدول النشر: ${new Date(r.scheduled.at).toLocaleString("ar")}`)
        return
      }
      if (!r.results) return
      setResults(r.results)
      const failed = Object.values(r.results).filter((x) => !x.ok && !x.skipped).length
      failed ? toast.warning("نُشر جزئياً، راجع النتائج") : toast.success("تم النشر على ميتا")
    } catch (e: any) {
      toast.error(e?.message || "فشل النشر")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="mx-6 mb-6 flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Text weight="plus">{product ? `📣 نشر «${product.title}»` : "📣 نشر على ميتا بدون إضافة للمتجر"}</Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {product
              ? "منتج من المتجر: صمّم صوره هنا (أو استبدلها) ثم انشره، ويُسجَّل النشر في المنتج."
              : "منشور أو قصة لعرض أو إعلان أو صنف لا تريد إضافته للمتجر. لا يُحفظ أي منتج."}
            {product && (
              <>
                {" "}
                <a className="text-ui-fg-interactive underline" href="/app/quick-add?tab=list">رجوع للمنتجات</a> ·{" "}
                <a className="text-ui-fg-interactive underline" href="/app/quick-add?tab=post">منشور حر جديد</a>
              </>
            )}
          </Text>
        </div>
        <Button size="small" variant="transparent" onClick={fill}>تعبئة من بيانات الاستوديو</Button>
      </div>
      {meta && !ready && !threadsReady && !tgReady && (
        <Text size="small" className="text-ui-fg-error">
          ميتا غير مربوطة. <a className="underline" href="/app/meta-connect">اربطها من صفحة ربط ميتا</a>.
        </Text>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Field label="عنوان المنشور" value={title} onChange={setTitle} placeholder="عروض نهاية الأسبوع" />
            <Field label="السعر $ (اختياري)" value={price} onChange={setPrice} placeholder="450" ltr />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">نص المنشور</Label>
            <Textarea dir="auto" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب العرض أو التفاصيل…" />
          </div>
          <Field label="هاشتاقات (تُنشر كأول تعليق)" value={tags} onChange={setTags} placeholder="#لمسة_فون #صنعاء #عروض" />
          <StylePicker info={info} hook={hook} onStyle={(s) => (setPostStyle(s), setHook(undefined))} onHook={setHook} />
          {info?.caption && (
            <details className="rounded-lg border p-2">
              <summary className="cursor-pointer text-sm font-medium">معاينة المنشور</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm" dir="auto">{info.caption}</pre>
            </details>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label size="small">الصور ({imgs.length}/10) — الأولى للقصة</Label>
          <div className="grid grid-cols-4 gap-2">
            {imgs.map((im, i) => (
              <div key={im.preview} className={`relative overflow-hidden rounded-md border bg-white ${i === 0 ? "ring-2 ring-ui-fg-interactive" : ""}`}>
                <img src={im.preview} alt="" className="aspect-[4/5] w-full object-contain" />
                <button type="button" className="absolute left-1 top-1 rounded bg-white/90 px-1 text-xs text-ui-fg-error" onClick={() => setImgs((xs) => xs.filter((_, k) => k !== i))} aria-label="حذف">✕</button>
                {i > 0 && (
                  <button type="button" className="absolute right-1 top-1 rounded bg-white/90 px-1 text-xs" title="اجعلها الأولى" onClick={() => setImgs((xs) => [xs[i], ...xs.filter((_, k) => k !== i)])}>★</button>
                )}
              </div>
            ))}
            {imgs.length < 10 && (
              <label className="flex aspect-[4/5] cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-center text-xs hover:bg-ui-bg-base">
                {adding ? `جارٍ التجهيز ${adding}…` : "+ صور"}
                <input type="file" accept="image/*" multiple hidden onChange={(e) => (add(Array.from(e.target.files || [])), (e.target.value = ""))} />
              </label>
            )}
          </div>
          {mainImage && (
            <Button size="small" variant="secondary" className="self-start" onClick={() => add([mainImage])}>
              🎨 استخدم صورة الاستوديو
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3">
        {([["فيسبوك (منشور)", toFb, setToFb, ready], ["إنستغرام (منشور)", toIg, setToIg, ready], ["قصة إنستغرام", toStory, setToStory, ready], ["Threads", toThreads, setToThreads, threadsReady], ["تيليجرام", toTg, setToTg, tgReady]] as const).map(([l, v, set, ok]) => (
          <label key={l} className="flex items-center gap-2 text-sm">
            <Switch disabled={!ok} checked={v && ok} onCheckedChange={set} />
            {l}
          </label>
        ))}
        <Button isLoading={Boolean(busy)} disabled={!any || adding > 0 || !imgs.length} onClick={publish}>
          {busy || (when.mode === "at" ? whenLabel(when) : toStory && !toFb && !toIg && !toThreads && !toTg ? "نشر كقصة فقط" : "نشر الآن")}
        </Button>
      </div>
      <WhenPicker value={when} onChange={setWhen} />
      {toStory && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          القصة تُنشر بالصورة الأولى كما هي (يفضّل 9:16 من خطوة «تصميم ستوري»)، بلا نص، وتبقى 24 ساعة. لتبقى دائماً: افتحها في تطبيق إنستغرام ← «تمييز» ← «أبرز القصص».
        </Text>
      )}
      {results &&
        Object.entries(results).map(([k, r]) =>
          r.skipped ? null : (
            <Text key={k} size="small">
              {PUB_NAMES[k] || k}: {r.ok ? (r.url ? <a className="underline" href={r.url} target="_blank" rel="noreferrer">تم ✓</a> : "تم ✓") : <span className="text-ui-fg-error">{r.error}</span>}
              {r.comment_error && <span className="block text-ui-fg-subtle">{r.comment_error}</span>}
            </Text>
          )
        )}
    </div>
  )
}

function StepCard(p: {
  step: Step
  index: number
  total: number
  copied: boolean
  onCopy: () => void
  onOpen: () => void
  onCopySlot: (k: SlotKey) => void
  hasSlot: (k: SlotKey) => boolean
  onBack?: () => void
  onSkip: () => void
}) {
  const s = p.step
  const [showPrompt, setShowPrompt] = useState(false)
  useEffect(() => setShowPrompt(false), [s.id])
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-interactive p-4 shadow-elevation-card-rest">
      <div className="flex flex-wrap items-center gap-2">
        <Badge size="2xsmall" color="blue">{p.index + 1}/{p.total}</Badge>
        <Text weight="plus" className="flex-1">{s.title}</Text>
        <Badge size="2xsmall" color={s.tool === "gemini" ? "purple" : "green"}>{TOOLS[s.tool].where}</Badge>
        {s.sameChat && <Badge size="2xsmall" color="orange">نفس المحادثة أو جديدة</Badge>}
      </div>
      <ol className="list-decimal space-y-1 ps-5 text-sm">
        <li>{s.hint}</li>
        <li>انسخ البرومت ← الصقه ← أرسل.</li>
      </ol>
      {ATTACH_SLOTS[s.attach].length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ATTACH_SLOTS[s.attach].map((k) => (
            <Button key={k} size="small" variant="secondary" disabled={!p.hasSlot(k)} onClick={() => p.onCopySlot(k)}>🖼️ نسخ {SLOT_LABELS[k]}</Button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={p.onCopy}>📋 {p.copied ? "نسخ مرة أخرى والانتقال" : "نسخ البرومت والانتقال للتالي"}</Button>
        <Button variant="secondary" onClick={p.onOpen}>فتح {TOOLS[s.tool].name}</Button>
      </div>
      <div>
        <button type="button" className="text-xs text-ui-fg-interactive underline" onClick={() => setShowPrompt((x) => !x)}>
          {showPrompt ? "إخفاء البرومت" : "عرض البرومت"}
        </button>
        {showPrompt && <pre dir="ltr" className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-ui-bg-subtle p-2 text-start text-[11px] leading-4">{s.prompt}</pre>}
      </div>
      <Text size="xsmall" className="text-ui-fg-subtle">بعد ظهور الصورة: {s.after}</Text>
      {s.fallback && <Refusal step={s} />}
      <div className="flex gap-2">
        {p.onBack && <Button size="small" variant="transparent" onClick={p.onBack}>→ السابق</Button>}
        <Button size="small" variant="transparent" onClick={p.onSkip}>تخطّي ←</Button>
      </div>
    </div>
  )
}

// رفض Gemini أو «لا أملك وصولاً»: الحلول بالترتيب مع برومت مبسّط وبديل Canva
function Refusal({ step }: { step: Step }) {
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [step.id])
  const copy = async (t: string, m: string) => ((await copyText(t)) ? toast.success(m) : toast.error("تعذّر النسخ"))
  if (!step.fallback) return null
  return (
    <div className="text-ui-fg-base">
      <button type="button" className="text-xs text-ui-fg-error underline" onClick={() => setOpen((x) => !x)}>
        {open ? "إخفاء الحلول" : "رفض Gemini أو قال «I don't have access to that content»؟"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded border bg-ui-bg-base p-3 text-sm">
          <ol className="list-decimal space-y-1 ps-5">
            {REFUSAL_HELP.map((h, n) => (
              <li key={n}>{h}</li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" onClick={() => copy(step.fallback!.prompt, "نُسخ البرومت المبسّط: الصقه في محادثة جديدة مع الصور")}>📋 البرومت المبسّط (محادثة جديدة)</Button>
            <Button size="small" variant="secondary" onClick={() => (copy(step.fallback!.canva, "نُسخ برومت Canva"), window.open(TOOLS.canva.url, "lp-canva"))}>🎨 نفّذها في Canva بدلاً من ذلك</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ImageSlot({ label, url, onFile, onCopy }: { label: string; url?: string; onFile: (f: File) => void; onCopy: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <div
        className={`relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-center text-xs text-ui-fg-subtle ${over ? "border-ui-fg-interactive" : ""}`}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) onFile(f)
        }}
        onPaste={(e) => {
          const f = Array.from(e.clipboardData.files)[0]
          if (f) onFile(f)
        }}
        tabIndex={0}
      >
        {url ? <img src={url} alt={label} className="h-full w-full object-contain" /> : <span className="p-2">{label}<br />اسحب الصورة أو اضغط</span>}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => (e.target.files?.[0] && onFile(e.target.files[0]), (e.target.value = ""))} />
      </div>
      <div className="flex items-center justify-between gap-1 text-xs">
        <span className="truncate">{label}</span>
        {url && <button type="button" className="shrink-0 text-ui-fg-interactive underline" onClick={onCopy}>نسخ</button>}
      </div>
    </div>
  )
}

function SlotUpload({ label, onFile }: { label: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button size="small" variant="secondary" onClick={() => ref.current?.click()}>🖼️ {label}</Button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => (e.target.files?.[0] && onFile(e.target.files[0]), (e.target.value = ""))} />
    </>
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
            <li>ابدأ كل منتج من هذا الـ Gem.</li>
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

