import { Badge, Button, Input, Label, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import { GeminiPublic, Job, checkSourceFile, fetchJobImage, isBusy, jobApi, prepareSource, testGemini, uploadOne, withCostConfirm } from "../lib/quick-add-ai"
import {
  ANGLES,
  ANGLE_LABELS,
  Angle,
  GUESS_WARNING,
  MANUAL_TIP,
  USED_ANGLES_NOTE,
  angleOf,
  buildManualPrompts,
  isAngleKind,
  isGuessedAngle,
  shouldOfferManual,
} from "../lib/quick-add-angles"

// قسم "الزوايا الأربع" في مراجعة المهمة + بطاقة "التوليد اليدوي عبر Gemini" (بديل عند تعطل الربط، ومتاح دائماً)

type Props = {
  job: Job
  gemini: GeminiPublic | null
  setGemini: (g: GeminiPublic) => void
  locked: boolean
  onJob: (j: Job) => void
  poll: () => void
}

const STATUS_AR: Record<string, string> = { pending: "في الانتظار", generating: "جارٍ التوليد…", done: "جاهزة", failed: "فشلت" }

export default function QuickAddAiAngles({ job, gemini, setGemini, locked, onJob, poll }: Props) {
  const isNew = job.condition === "new"
  const uploadKinds = job.images.filter((i) => !isAngleKind(i.kind) && !i.excluded).map((i) => i.kind as string)
  const byAngle = (a: Angle) => job.images.find((i) => angleOf(i.kind) === a)
  const auto = shouldOfferManual(gemini, job)
  const [manualOpen, setManualOpen] = useState(false)
  const showManual = !locked && (auto || manualOpen)
  const generating = isBusy(job)

  const generate = async (angle?: Angle) => {
    try {
      // الوضع المدفوع: تأكيد التكلفة التقديرية قبل الزوايا
      const r = await withCostConfirm<any>((x) => jobApi.action(job.id, "angles", { ...(angle ? { angle } : {}), ...x }))
      if (!r) return
      onJob(r.job)
      poll()
    } catch (e: any) {
      toast.error(e?.message || "تعذّر بدء توليد الزوايا")
      if (/يدوي|غير مربوط/.test(e?.message || "")) setManualOpen(true)
    }
  }
  const toggleExclude = async (id: string, excluded: boolean) => {
    try {
      onJob(await jobApi.update(job.id, { images: [{ id, excluded }] }))
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ")
    }
  }
  const enhanceManual = async (id: string) => {
    try {
      const r = await withCostConfirm<any>((x) => jobApi.action(job.id, "regenerate", { image_id: id, ...x }))
      if (!r) return
      poll()
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ")
    }
  }

  const hasAngles = ANGLES.some((a) => byAngle(a))

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text weight="plus">الزوايا الأربع (أمامي، خلفي، ثلاثة أرباع، جانبي)</Text>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <Button size="small" disabled={!isNew || generating || !gemini?.has_key || gemini?.image_mode !== "paid_api"} onClick={() => generate()}>
              ولّد الزوايا الأربع
            </Button>
            {!showManual && (
              <Button size="small" variant="secondary" onClick={() => setManualOpen(true)}>
                توليد يدوي
              </Button>
            )}
          </div>
        )}
      </div>
      {!isNew && <Text size="small" className="text-ui-fg-error">⚠️ {USED_ANGLES_NOTE}</Text>}
      {isNew && gemini?.has_key && gemini.image_mode !== "paid_api" && (
        <Text size="xsmall" className="text-ui-fg-subtle">توليد الصور عبر API متوقف (الوضع اليدوي){gemini.cap_note ? `: ${gemini.cap_note}` : ""}. استخدم التوليد اليدوي أدناه، أو فعّل الوضع المدفوع من إعدادات Gemini.</Text>
      )}
      {isNew && !hasAngles && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          صورة منفصلة لكل زاوية بنفس الجهاز والخلفية (1:1). الأمامي يُولَّد أولاً ثم يُستخدم مرجعاً لبقية الزوايا.
        </Text>
      )}

      {hasAngles && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {ANGLES.map((a) => {
            const img = byAngle(a)
            if (!img) return <div key={a} className="flex aspect-square items-center justify-center rounded border border-dashed text-xs text-ui-fg-subtle">{ANGLE_LABELS[a]}</div>
            const guessed = img.source !== "manual" && isGuessedAngle(a, uploadKinds)
            return (
              <div key={a} className={`flex flex-col gap-1 rounded border p-2 ${img.excluded ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between text-xs">
                  <span>
                    {ANGLE_LABELS[a]} {img.source === "manual" && <Badge size="2xsmall">يدوي</Badge>}
                  </span>
                  <span className={img.status === "failed" ? "text-ui-fg-error" : ""}>{STATUS_AR[img.status]}</span>
                </div>
                {img.result_url ? (
                  <img src={img.result_url} onError={(e) => (e.currentTarget.style.visibility = "hidden")} alt={ANGLE_LABELS[a]} className="aspect-square w-full rounded bg-ui-bg-subtle object-contain" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded bg-ui-bg-subtle p-2 text-center text-xs">
                    {img.status === "failed" ? <span className="text-ui-fg-error">{img.error || "فشلت"}</span> : STATUS_AR[img.status]}
                  </div>
                )}
                {guessed && img.status === "done" && <Text size="xsmall" className="text-ui-fg-error">⚠️ {GUESS_WARNING}</Text>}
                {!locked && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {img.source === "manual" ? (
                      gemini?.has_key && (
                        <button type="button" className="underline disabled:opacity-40" disabled={generating} onClick={() => enhanceManual(img.id)}>
                          حسّنها بالذكاء الاصطناعي
                        </button>
                      )
                    ) : (
                      <button type="button" className="text-ui-fg-interactive underline disabled:opacity-40" disabled={!isNew || generating} onClick={() => generate(a)}>
                        إعادة توليدها
                      </button>
                    )}
                    {img.status === "failed" && (
                      <button type="button" className="underline" onClick={() => setManualOpen(true)}>استخدام الوضع اليدوي</button>
                    )}
                    <button type="button" className={img.excluded ? "underline" : "text-ui-fg-error underline"} onClick={() => toggleExclude(img.id, !img.excluded)}>
                      {img.excluded ? "إرجاعها" : "استبعادها"}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showManual && <ManualCard job={job} gemini={gemini} setGemini={setGemini} onJob={onJob} onClose={auto ? undefined : () => setManualOpen(false)} />}
    </section>
  )
}

// ---------- بطاقة التوليد اليدوي عبر Gemini ----------

function ManualCard({
  job,
  gemini,
  setGemini,
  onJob,
  onClose,
}: {
  job: Job
  gemini: GeminiPublic | null
  setGemini: (g: GeminiPublic) => void
  onJob: (j: Job) => void
  onClose?: () => void
}) {
  const variantColor = (job.input.variants || []).find((v) => v.color)?.color || ""
  const [deviceName, setDeviceName] = useState(job.title)
  const [color, setColor] = useState(variantColor)
  const [current, setCurrent] = useState(0)
  const [testing, setTesting] = useState(false)
  const [uploading, setUploading] = useState<Angle | null>(null)
  // البرومتات تتحدث لحظياً مع الاسم واللون (بلا أي بيانات خاصة)
  const prompts = useMemo(() => buildManualPrompts({ deviceName, color, parts: job.parts, styleText: job.style_text }), [deviceName, color, job.parts, job.style_text])
  const refs = job.images.filter((i) => !isAngleKind(i.kind) && !i.excluded).sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.rank - b.rank)

  const copy = async (text: string, msg = "نُسخ") => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(msg)
    } catch {
      toast.error("تعذّر النسخ، انسخه يدوياً من المعاينة")
    }
  }
  const downloadRef = async (id: string) => {
    try {
      const f = await fetchJobImage(job.id, id, "source")
      const a = document.createElement("a")
      a.href = URL.createObjectURL(f)
      a.download = `reference-${id.slice(-6)}.${f.name.split(".").pop()}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch (e: any) {
      toast.error(e?.message || "تعذّر التحميل")
    }
  }
  const retryApi = async () => {
    setTesting(true)
    try {
      const r = await testGemini()
      setGemini(r.settings)
      r.ok ? toast.success("الربط يعمل: يمكنك التوليد الآلي الآن") : toast.error(r.error || "ما زال الربط لا يعمل")
    } catch (e: any) {
      toast.error(e?.message || "فشل الاختبار")
    } finally {
      setTesting(false)
    }
  }
  const upload = async (a: Angle, f: File) => {
    const err = checkSourceFile(f)
    if (err) return toast.error(err)
    setUploading(a)
    try {
      // نصغّرها لأقل من 1MB (حد الرفع في السيرفر) ثم نربطها بالزاوية
      const u = await uploadOne(await prepareSource(f))
      onJob((await jobApi.action(job.id, "manual-angle", { angle: a, file_id: u.id, url: u.url })).job)
      toast.success(`رُفعت صورة ${ANGLE_LABELS[a]}`)
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الرفع")
    } finally {
      setUploading(null)
    }
  }
  const manualCount = ANGLES.filter((a) => job.images.some((i) => angleOf(i.kind) === a && i.source === "manual" && i.status === "done")).length

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-ui-tag-purple-border bg-ui-bg-subtle p-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text weight="plus">التوليد اليدوي عبر Gemini</Text>
        <div className="flex gap-2">
          <Button size="small" onClick={() => (window.location.href = `/app/image-studio?job=${job.id}`)}>افتح في استوديو الصور</Button>
          <Button size="small" variant="secondary" isLoading={testing} onClick={retryApi}>تجربة الربط من جديد</Button>
          {onClose && <Button size="small" variant="transparent" onClick={onClose}>إغلاق</Button>}
        </div>
      </div>
      {(!gemini?.has_key || gemini?.status === "error") && (
        <Text size="small" className="text-ui-fg-subtle">الربط الآلي مع Gemini لا يعمل الآن{gemini?.last_error ? ` (${gemini.last_error})` : ""}. يمكنك توليد الصور بحسابك Pro ورفعها هنا.</Text>
      )}
      <ol className="list-decimal space-y-1 ps-5 text-sm">
        <li>افتح تطبيق أو موقع Gemini بحسابك Pro (<a className="text-ui-fg-interactive underline" href="https://gemini.google.com" target="_blank" rel="noreferrer">gemini.google.com</a>).</li>
        <li>اختر أداة إنشاء الصور (Nano Banana). المسمى قد يتغير، فاختر خيار توليد/تعديل الصور الظاهر عندك.</li>
        <li>ارفق صورة الجهاز المرجعية (الأمامية أو الخلفية) من الأزرار أدناه.</li>
        <li>انسخ البرومت الأول وأرسله، وبعد نجاح الصورة أرسل بقية البرومتات واحداً تلو الآخر في نفس المحادثة للحفاظ على تناسق الجهاز.</li>
        <li>نزّل الصور الأربع، وارفعها هنا في الخانات المخصصة لكل زاوية.</li>
      </ol>

      <div className="flex flex-wrap gap-2">
        {refs.slice(0, 3).map((r, n) => (
          <Button key={r.id} size="small" variant="secondary" onClick={() => downloadRef(r.id)}>
            تحميل الصورة المرجعية {n + 1}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label size="small">اسم الجهاز في البرومت</Label>
          <Input size="small" dir="ltr" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">اللون</Label>
          <Input size="small" dir="auto" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Titanium Black" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="small" onClick={() => (copy(prompts[current], `نُسخ البرومت ${current + 1}`), setCurrent((c) => Math.min(3, c + 1)))}>
          نسخ البرومت الحالي ({current + 1} من 4)
        </Button>
        <Button size="small" variant="secondary" onClick={() => copy(prompts.map((p, n) => `— ${n + 1} —\n${p}`).join("\n\n"), "نُسخت كل البرومتات")}>
          نسخ كل البرومتات
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {prompts.map((p, n) => (
          <div key={n} className={`rounded border bg-ui-bg-base p-2 ${n === current ? "border-ui-border-interactive" : ""}`}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span>البرومت {n + 1}: {ANGLE_LABELS[ANGLES[n]]}{n === 0 ? " (أرسله مع الصورة المرجعية)" : ""}</span>
              <button type="button" className="text-ui-fg-interactive underline" onClick={() => (copy(p, `نُسخ البرومت ${n + 1}`), setCurrent(Math.min(3, n + 1)))}>نسخ</button>
            </div>
            <pre dir="ltr" className="max-h-28 overflow-auto whitespace-pre-wrap text-start text-[11px] leading-4">{p}</pre>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ANGLES.map((a) => (
          <DropSlot key={a} label={ANGLE_LABELS[a]} busy={uploading === a} done={job.images.some((i) => angleOf(i.kind) === a && i.source === "manual")} onFile={(f) => upload(a, f)} />
        ))}
      </div>
      {manualCount === 4 && <Text size="small" className="text-ui-fg-interactive">✓ رُفعت الزوايا الأربع: تُستخدم كما هي (بدون تحسين). راجعها أعلاه ثم «اعتماد ونشر».</Text>}
      <Text size="xsmall" className="text-ui-fg-subtle">💡 {MANUAL_TIP}</Text>
    </div>
  )
}

function DropSlot({ label, busy, done, onFile }: { label: string; busy: boolean; done: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  useEffect(() => setOver(false), [busy])
  return (
    <div
      className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed p-2 text-center text-xs ${over ? "border-ui-fg-interactive" : ""}`}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
    >
      <span className="font-medium">{label}</span>
      <span className="text-ui-fg-subtle">{busy ? "جارٍ الرفع…" : done ? "✓ مرفوعة (اضغط للاستبدال)" : "اسحب الصورة هنا أو اضغط"}</span>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => (e.target.files?.[0] && onFile(e.target.files[0]), (e.target.value = ""))} />
    </div>
  )
}
