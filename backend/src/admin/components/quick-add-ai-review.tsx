import { Badge, Button, Label, Switch, Text, Textarea, toast, usePrompt } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import type { MetaPublic } from "./quick-add-meta-connect"
import PostPreview from "./quick-add-post-preview"
import { createQuickAddProduct, publishProduct, type QuickAddCtx } from "../lib/quick-add-create"
import { ProcessOptions, ProcessedImage, processImage } from "../lib/quick-add-image"
import { GeminiPublic, HONESTY_NOTE, ImageKind, Job, KIND_LABELS, STATUS_LABELS, StepResult, fetchJobImage, getGemini, isBusy, jobApi } from "../lib/quick-add-ai"
import { isAngleKind } from "../lib/quick-add-angles"
import QuickAddAiAngles from "./quick-add-ai-angles"

// مراجعة مهمة الذكاء الاصطناعي: قبل/بعد لكل صورة، تعديل النصوص، ثم "اعتماد ونشر"
// الذي يستدعي نفس دوال الإضافة السريعة (إنشاء المنتج ثم /admin/quick-add/publish).

const STORE = "https://lamsaphone.yemenbay.com/ye/products/"
type Copy = NonNullable<Job["copy"]>
type StepKey = "upload" | "product" | "facebook" | "instagram" | "catalog"
const STEP_LABELS: Record<StepKey, string> = { upload: "رفع الصور", product: "المنتج", facebook: "فيسبوك", instagram: "إنستغرام", catalog: "الكتالوج وواتساب" }

const statusColor = (s: Job["status"]) =>
  s === "published" ? "green" : s === "failed" || s === "rejected" ? "red" : s === "ready_for_review" ? "blue" : "orange"

export default function QuickAddAiReview({
  jobId,
  ctx,
  processOpts,
  onNew,
}: {
  jobId: string
  ctx: QuickAddCtx & { meta: MetaPublic }
  processOpts: ProcessOptions
  onNew?: () => void
}) {
  const [job, setJob] = useState<Job | null>(null)
  const [copy, setCopy] = useState<Copy>({ description: "", instagram: "", facebook: "", hashtags: "" })
  const [copyDirty, setCopyDirty] = useState(false)
  const metaReady = ctx.meta.has_token
  const [toFb, setToFb] = useState(metaReady && Boolean(ctx.meta.page_id))
  const [toIg, setToIg] = useState(metaReady && Boolean(ctx.meta.page_id))
  const [toCatalog, setToCatalog] = useState(metaReady && Boolean(ctx.meta.catalog_id))
  const [busy, setBusy] = useState("")
  const [steps, setSteps] = useState<Job["steps"]>({})
  const prompt = usePrompt()
  const [gemini, setGemini] = useState<GeminiPublic | null>(null)
  useEffect(() => {
    getGemini().then(setGemini).catch(() => null)
  }, [])
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const apply = (j: Job) => {
    setJob(j)
    setSteps(j.steps || {})
    if (j.copy && !copyDirty) setCopy(j.copy)
  }

  // متابعة الحالة كل 2.5 ثانية، وتتوقف عند حالة غير جارية
  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const j = await jobApi.get(jobId)
        if (stop) return
        apply(j)
        if (isBusy(j)) timer.current = setTimeout(tick, 2500)
      } catch (e: any) {
        if (!stop) toast.error(e?.message || "تعذّر تحميل المهمة")
      }
    }
    tick()
    return () => {
      stop = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [jobId])

  const poll = () => {
    if (timer.current) clearTimeout(timer.current)
    const tick = async () => {
      const j = await jobApi.get(jobId).catch(() => null)
      if (!j) return
      apply(j)
      if (isBusy(j)) timer.current = setTimeout(tick, 2500)
    }
    timer.current = setTimeout(tick, 1200)
  }

  if (!job) return <Text className="p-4">جارٍ تحميل المهمة…</Text>
  const generating = isBusy(job)
  const locked = ["published", "publishing", "rejected"].includes(job.status) || Boolean(job.product_id)
  const images = [...job.images].sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.rank - b.rank)
  // الزوايا تدخل الاعتماد فقط إن كانت جاهزة؛ الصور المرفوعة تدخل دائماً (الأصل إن فشل التحسين)
  const included = images.filter((i) => !i.excluded && (!isAngleKind(i.kind) || i.status === "done"))
  const uploads = images.filter((i) => !isAngleKind(i.kind))

  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    try {
      await fn()
      after?.()
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ")
    }
  }
  const updateImage = (id: string, patch: Record<string, unknown>) => act(async () => apply(await jobApi.update(job.id, { images: [{ id, ...patch }] })))
  const regenerate = (image_id?: string) => act(() => jobApi.action(job.id, "regenerate", image_id ? { image_id } : {}), () => (setJob({ ...job, running: true }), poll()))
  const regenerateCopy = () => act(() => jobApi.action(job.id, "regenerate-copy"), () => (setCopyDirty(false), setJob({ ...job, running: true, copy_status: "generating" }), poll()))
  const saveCopy = () => (copyDirty ? act(async () => apply(await jobApi.update(job.id, { copy })), () => setCopyDirty(false)) : Promise.resolve())

  const reject = async () => {
    const ok = await prompt({ title: "رفض المهمة؟", description: "لن يُحفظ شيء في المتجر، وتُحذف الصور المؤقتة.", confirmText: "رفض", cancelText: "إلغاء" })
    if (ok) act(async () => apply((await jobApi.action(job.id, "reject")).job))
  }

  const report = async (status: "publishing" | "published" | "failed", patch: Partial<Record<StepKey, StepResult>>, product_id?: string, error?: string) => {
    setSteps((s) => ({ ...s, ...patch }))
    const r = await jobApi.action(job.id, "published", { status, steps: patch, product_id, error }).catch(() => null)
    if (r?.job) apply(r.job)
  }

  // اعتماد ← رفع ← منتج ← فيسبوك ← إنستغرام ← الكتالوج
  const approve = async () => {
    if (!included.length) return toast.error("أبقِ صورة واحدة على الأقل")
    const noResult = included.filter((i) => i.status !== "done")
    if (noResult.length) {
      const ok = await prompt({
        title: "صور بدون تحسين",
        description: `${noResult.length} صورة لم تُحسَّن (فشلت أو لم تكتمل). ستُستخدم الصورة الأصلية لها. متابعة؟`,
        confirmText: "متابعة",
        cancelText: "رجوع",
      })
      if (!ok) return
    }
    try {
      await saveCopy()
      setBusy("اعتماد…")
      apply((await jobApi.action(job.id, "approve")).job)
      // نفس معالجة الإضافة السريعة: الشعار وWebP للمتجر وJPEG لميتا
      setBusy("تجهيز الصور…")
      const finals: ProcessedImage[] = []
      for (const img of included) {
        const file = await fetchJobImage(job.id, img.id, img.status === "done" ? "result" : "source")
        finals.push(await processImage(file, processOpts))
      }
      await report("publishing", {})
      const i = job.input || {}
      const specs: Record<string, string> = { ...(i.specs || {}) }
      if (i.battery_health) specs.battery_health = i.battery_health
      if (i.condition_note) specs.condition_note = i.condition_note
      if (i.warranty) specs.warranty = i.warranty
      const variants = (i.variants || []).filter((v) => v.storage || v.color)
      const single = variants.length === 1 && v1Simple(variants[0]) ? variants[0] : null
      let stage: StepKey = "upload"
      let product
      try {
        product = await createQuickAddProduct(
          ctx,
          {
            title: job.title,
            description: copy.description,
            categoryId: i.category_id || "",
            images: finals,
            price: Number(i.price) || 0,
            qty: i.qty || "",
            condition: job.condition,
            storage: single?.storage,
            color: single?.color,
            variants: single ? [] : variants,
            // عام فقط: الماركة والموديل والمواصفات. التكلفة والمورد وIMEI تبقى في المهمة
            extraMetadata: { ...(job.brand ? { brand: job.brand } : {}), ...(job.model_name ? { model: job.model_name } : {}), ...(Object.keys(specs).length ? { specs } : {}), ai_job_id: job.id },
          },
          (s) => {
            setBusy(s)
            if (/إنشاء المنتج/.test(s)) {
              stage = "product"
              setSteps((x) => ({ ...x, upload: { ok: true } }))
            }
          },
          (m) => toast.warning(m)
        )
      } catch (e: any) {
        const err = e?.message || "حدث خطأ"
        await report("failed", stage === "upload" ? { upload: { ok: false, error: err } } : { upload: { ok: true }, product: { ok: false, error: err } }, undefined, err)
        throw e
      }
      const okSteps = { upload: { ok: true }, product: { ok: true, url: STORE + encodeURIComponent(product.handle) } }
      await report("publishing", okSteps, product.id)
      toast.success("أُضيف المنتج إلى المتجر")
      const results = await publishTo(product.id, { facebook: toFb && metaReady, instagram: toIg && metaReady, catalog: toCatalog && metaReady })
      const failed = Object.values(results).some((r) => r && !r.ok && !r.skipped)
      await report(failed ? "failed" : "published", { ...okSteps, ...results }, product.id, failed ? "فشلت منصة أو أكثر: أعد المحاولة لها فقط" : undefined)
      failed ? toast.warning("أُضيف المنتج، وفشل النشر على منصة: أعد المحاولة لها فقط") : toast.success("تم الاعتماد والنشر ✓")
    } catch (e: any) {
      toast.error(e?.message || "فشل الاعتماد")
    } finally {
      setBusy("")
    }
  }

  const publishTo = async (productId: string, flags: { facebook: boolean; instagram: boolean; catalog: boolean }) => {
    setBusy("النشر على ميتا…")
    const out: Partial<Record<StepKey, StepResult>> = {}
    if (!flags.facebook && !flags.instagram && !flags.catalog) return out
    try {
      const r = await publishProduct({ product_id: productId, ...flags, text: copy.facebook, ig_text: copy.instagram, hashtags: copy.hashtags, use_video: false })
      for (const k of ["facebook", "instagram", "catalog"] as const) {
        const x = r.results[k] || r.results.all
        if (x && !(x.skipped && !(flags as any)[k])) out[k] = { ok: x.ok, url: x.url, error: x.error || (x as any).comment_error, skipped: x.skipped }
      }
    } catch (e: any) {
      for (const k of ["facebook", "instagram", "catalog"] as const) if (flags[k]) out[k] = { ok: false, error: e?.message || "فشل النشر" }
    }
    return out
  }

  const retry = async (k: "facebook" | "instagram" | "catalog") => {
    if (!job.product_id) return
    try {
      const r = await publishTo(job.product_id, { facebook: k === "facebook", instagram: k === "instagram", catalog: k === "catalog" })
      const merged = { ...steps, ...r }
      const failed = (["facebook", "instagram", "catalog"] as const).some((x) => merged[x] && !merged[x]!.ok && !merged[x]!.skipped)
      await report(failed ? "failed" : "published", r, job.product_id)
      r[k]?.ok ? toast.success(`تم النشر على ${STEP_LABELS[k]}`) : toast.error(r[k]?.error || "فشل")
    } finally {
      setBusy("")
    }
  }

  const stepKeys: StepKey[] = ["upload", "product", ...(["facebook", "instagram", "catalog"] as const).filter((k) => steps[k] || ({ facebook: toFb, instagram: toIg, catalog: toCatalog } as any)[k])]
  const showSteps = ["approved", "publishing", "published", "failed"].includes(job.status) && (job.product_id || Object.keys(steps).length > 0)

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-ui-border-interactive p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Text weight="plus">✨ {job.title}</Text>
          <Badge size="2xsmall" color={statusColor(job.status) as any}>{STATUS_LABELS[job.status]}</Badge>
        </div>
        {onNew && <Button size="small" variant="secondary" onClick={onNew}>إضافة جهاز آخر</Button>}
      </div>
      {generating && <Text size="small">جارٍ التحسين في الخلفية… يمكنك إضافة جهاز آخر الآن، وستجد هذه المهمة في تبويب «مهام الذكاء الاصطناعي».</Text>}
      {job.error && <Text size="small" className="text-ui-fg-error">{job.error}</Text>}
      {job.condition !== "new" && <Text size="small" className="text-ui-fg-subtle">⚠️ {HONESTY_NOTE}</Text>}

      {/* قبل / بعد */}
      <section className="grid gap-3 md:grid-cols-2">
        {uploads.map((img) => (
          <div key={img.id} className={`flex flex-col gap-2 rounded-md border p-2 ${img.excluded ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between text-xs">
              <span>
                {KIND_LABELS[img.kind as ImageKind]} {img.is_main && <Badge size="2xsmall" color="blue">الرئيسية</Badge>}
                {img.note && <span className="text-ui-fg-subtle"> · {img.note}</span>}
              </span>
              <span>{{ pending: generating ? "في الانتظار" : "بدون تحسين", generating: "جارٍ…", done: "✓ تم", failed: "✕ فشل" }[img.status]}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <figure className="flex flex-col gap-1">
                <img src={img.source_url} onError={(e) => (e.currentTarget.style.visibility = "hidden")} alt="قبل" className="aspect-[6/7] w-full rounded bg-ui-bg-subtle object-contain" />
                <figcaption className="text-center text-[11px] text-ui-fg-subtle">قبل</figcaption>
              </figure>
              <figure className="flex flex-col gap-1">
                {img.result_url ? (
                  <img src={img.result_url} alt="بعد" className="aspect-[6/7] w-full rounded bg-ui-bg-subtle object-contain" />
                ) : (
                  <div className="flex aspect-[6/7] w-full items-center justify-center rounded bg-ui-bg-subtle p-2 text-center text-xs">
                    {img.status === "failed" ? <span className="text-ui-fg-error">{img.error || "فشل"}</span> : img.status === "generating" ? "جارٍ التحسين…" : locked ? "—" : "في الانتظار"}
                  </div>
                )}
                <figcaption className="text-center text-[11px] text-ui-fg-subtle">بعد</figcaption>
              </figure>
            </div>
            {!locked && (
              <div className="flex flex-wrap gap-3 text-xs">
                <button type="button" className="text-ui-fg-interactive underline disabled:opacity-40" disabled={generating || img.excluded} onClick={() => regenerate(img.id)}>
                  إعادة توليد هذه الصورة
                </button>
                {!img.is_main && !img.excluded && (
                  <button type="button" className="underline" onClick={() => updateImage(img.id, { is_main: true })}>اجعلها الرئيسية</button>
                )}
                <button type="button" className={img.excluded ? "underline" : "text-ui-fg-error underline"} onClick={() => updateImage(img.id, { excluded: !img.excluded })}>
                  {img.excluded ? "إرجاعها" : "استبعادها"}
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* الزوايا الأربع + التوليد اليدوي */}
      <QuickAddAiAngles job={job} gemini={gemini} setGemini={setGemini} locked={locked} onJob={apply} poll={poll} />

      {/* النصوص */}
      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Text weight="plus">النصوص {job.copy_status === "generating" && <span className="text-ui-fg-subtle">(جارٍ الكتابة…)</span>}</Text>
            {!locked && (
              <Button size="small" variant="secondary" disabled={generating} onClick={regenerateCopy}>
                إعادة توليد النص
              </Button>
            )}
          </div>
          {job.copy_error && <Text size="small" className="text-ui-fg-error">{job.copy_error}</Text>}
          {([
            ["description", "وصف المتجر", 6],
            ["instagram", "كابشن إنستغرام", 4],
            ["facebook", "نص فيسبوك", 5],
            ["hashtags", "الهاشتاقات (تُنشر كأول تعليق)", 2],
          ] as const).map(([k, label, rows]) => (
            <div key={k} className="flex flex-col gap-1">
              <Label size="small">{label}</Label>
              <Textarea
                dir="auto"
                rows={rows}
                disabled={locked}
                value={copy[k]}
                onChange={(e) => {
                  setCopy({ ...copy, [k]: e.target.value })
                  setCopyDirty(true)
                }}
                onBlur={saveCopy}
              />
            </div>
          ))}
          <Text size="xsmall" className="text-ui-fg-subtle">السعر ورابط المتجر وواتساب تُضاف تلقائياً للمنشور كما في الإضافة العادية.</Text>
        </div>
        <aside className="flex flex-col gap-3">
          {!locked && (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              {!metaReady && <Text size="small" className="text-ui-fg-subtle">ميتا غير مربوطة: سيُضاف المنتج للمتجر فقط.</Text>}
              {[
                ["فيسبوك", toFb, setToFb, Boolean(ctx.meta.page_id)],
                ["إنستغرام (ألبوم عند تعدد الصور)", toIg, setToIg, Boolean(ctx.meta.page_id)],
                ["كتالوج ميتا + واتساب", toCatalog, setToCatalog, Boolean(ctx.meta.catalog_id)],
              ].map(([label, val, set, ok]: any) => (
                <div key={label} className="flex items-center justify-between">
                  <Label size="small">{label}</Label>
                  <Switch disabled={!metaReady || !ok} checked={val && metaReady && ok} onCheckedChange={set} />
                </div>
              ))}
            </div>
          )}
          <PostPreview
            caption={copy.facebook || job.title}
            igCaption={copy.instagram || job.title}
            comment={copy.hashtags}
            image={included[0]?.result_url || included[0]?.source_url}
            count={included.length}
          />
        </aside>
      </section>

      {/* تقدّم النشر */}
      {showSteps && (
        <section className="flex flex-wrap items-center gap-2">
          {stepKeys.map((k, n) => {
            const r = steps[k]
            return (
              <span key={k} className="flex items-center gap-1 text-sm">
                {n > 0 && <span className="text-ui-fg-muted">←</span>}
                <span className={r?.ok ? "text-ui-fg-interactive" : r && !r.skipped ? "text-ui-fg-error" : "text-ui-fg-subtle"}>
                  {r?.ok ? "✓" : r && !r.skipped ? "✕" : "○"} {r?.url ? <a className="underline" href={r.url} target="_blank" rel="noreferrer">{STEP_LABELS[k]}</a> : STEP_LABELS[k]}
                </span>
                {r && !r.ok && !r.skipped && (k === "facebook" || k === "instagram" || k === "catalog") && job.product_id && (
                  <Button size="small" variant="transparent" isLoading={Boolean(busy)} onClick={() => retry(k)}>إعادة</Button>
                )}
              </span>
            )
          })}
        </section>
      )}
      {Object.entries(steps).map(([k, r]) => (r && !r.ok && r.error ? <Text key={k} size="xsmall" className="text-ui-fg-error">{STEP_LABELS[k as StepKey]}: {r.error}</Text> : null))}

      <div className="flex flex-wrap items-center gap-2">
        {!locked && job.status !== "rejected" && (
          <>
            <Button size="large" isLoading={Boolean(busy)} disabled={generating || !["ready_for_review", "failed", "approved"].includes(job.status)} onClick={approve}>
              {metaReady && (toFb || toIg || toCatalog) ? "اعتماد ونشر" : "اعتماد وإضافة للمتجر"}
            </Button>
            <Button variant="secondary" disabled={generating || Boolean(busy)} onClick={() => regenerate()}>إعادة توليد الكل</Button>
            <Button variant="danger" disabled={Boolean(busy)} onClick={reject}>رفض</Button>
          </>
        )}
        {job.product_id && (
          <a className="text-sm text-ui-fg-interactive underline" href={`/app/products/${job.product_id}`}>فتح المنتج في اللوحة</a>
        )}
        {busy && <Text className="self-center">{busy}</Text>}
      </div>
    </div>
  )
}

// خيار واحد بلا SKU/مخزون/سعر خاص = منتج عادي بخيار "افتراضي" (السعة واللون في الاسم والبيانات)
function v1Simple(v: { sku?: string; stock?: number | null; price?: number | null }) {
  return !v.sku && (v.stock === null || v.stock === undefined) && (v.price === null || v.price === undefined)
}
