import { Badge, Button, Input, Label, Select, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"
import type { ProcessedImage } from "../lib/quick-add-image"
import {
  AI_MAX_IMAGES,
  AiCondition,
  AiVariant,
  GeminiPublic,
  HONESTY_NOTE,
  ImageKind,
  Job,
  KIND_LABELS,
  PRESET_LABELS,
  Preset,
  SPEC_FIELDS,
  allowedPresets,
  checkSourceFile,
  jobApi,
  prepareSource,
  salePrice,
  uploadOne,
} from "../lib/quick-add-ai"

// قسم "تحسين بالذكاء الاصطناعي" داخل صفحة الإضافة السريعة (يظهر فقط عند تفعيله).
// يستخدم نفس الصور والحقول الأساسية في الصفحة، ويضيف: نوع/ملاحظة كل صورة، وصف الأجزاء، النمط،
// بيانات الجوال، التسعير من التكلفة، والخيارات (السعة × اللون). لا يُحفظ شيء في المتجر قبل "اعتماد".

export type AiImageMeta = { kind: ImageKind; note: string }

const STORAGES = ["64GB", "128GB", "256GB", "512GB", "1TB"]
const COLORS = ["أسود", "أبيض", "رمادي", "فضي", "أزرق", "أخضر", "بنفسجي", "ذهبي", "وردي", "كريمي", "تيتانيوم"]
const guessKind = (i: number): ImageKind => (["front", "back", "side", "box"] as ImageKind[])[i] || "other"
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")

type Props = {
  gemini: GeminiPublic | null
  currency: string
  // من الصفحة
  title: string
  categoryId: string
  price: string
  setPrice: (v: string) => void
  qty: string
  condition: string
  setCondition: (c: string) => void
  storage: string
  color: string
  images: ProcessedImage[]
  sources: Record<string, File>
  imageMeta: Record<string, AiImageMeta>
  setImageMeta: (fn: (m: Record<string, AiImageMeta>) => Record<string, AiImageMeta>) => void
  reorder: (from: number, to: number) => void
  onCreated: (job: Job) => void
}

export default function QuickAddAiForm(p: Props) {
  const g = p.gemini
  const connected = Boolean(g?.has_key)
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [parts, setParts] = useState("")
  const [preset, setPreset] = useState<Preset>("studio")
  const [customPrompt, setCustomPrompt] = useState("")
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [warrantyTime, setWarrantyTime] = useState("")
  const [warrantyBy, setWarrantyBy] = useState("")
  const [batteryHealth, setBatteryHealth] = useState("")
  const [conditionNote, setConditionNote] = useState("")
  const [imei, setImei] = useState("")
  const [cost, setCost] = useState("")
  const [supplier, setSupplier] = useState("")
  const [marginType, setMarginType] = useState<"percent" | "fixed">(g?.margin_type || "percent")
  const [marginValue, setMarginValue] = useState(String(g?.margin_value ?? 10))
  const [vStorages, setVStorages] = useState<string[]>([])
  const [vColors, setVColors] = useState<string[]>([])
  const [variants, setVariants] = useState<AiVariant[]>([])
  const [dups, setDups] = useState<{ id: string; title: string; match: string }[]>([])
  const [busy, setBusy] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)

  useEffect(() => {
    if (g) {
      setMarginType(g.margin_type)
      setMarginValue(String(g.margin_value))
    }
  }, [g?.margin_type, g?.margin_value])

  const used = p.condition !== "new"
  const presets = allowedPresets(p.condition)
  // قاعدة الصدق: المستعمل والمجدّد = تنظيف الخلفية فقط
  useEffect(() => {
    if (!presets.includes(preset)) setPreset("studio")
  }, [p.condition])

  // سعر البيع من التكلفة + الهامش (يمكن تعديله يدوياً في حقل السعر)
  const computed = salePrice(Number(cost), marginType, Number(marginValue) || 0)
  useEffect(() => {
    if (computed > 0) p.setPrice(String(computed))
  }, [computed])

  // الخيارات: كل سعة × كل لون، مع الحفاظ على ما عُدّل في الصفوف الموجودة
  useEffect(() => {
    const st = vStorages.length ? vStorages : [""]
    const co = vColors.length ? vColors : [""]
    if (!vStorages.length && !vColors.length) {
      setVariants([])
      return
    }
    setVariants((prev) =>
      st.flatMap((s) =>
        co.map((c) => prev.find((v) => v.storage === s && v.color === c) || { storage: s, color: c, sku: [slug(model || p.title), slug(s), slug(c)].filter(Boolean).join("-").slice(0, 60), stock: null, price: null })
      )
    )
  }, [vStorages.join(","), vColors.join(",")])

  // تنبيه التكرار (نفس الماركة + الموديل + السعة + اللون)
  useEffect(() => {
    if (!model.trim()) return setDups([])
    const combos = (variants.length ? variants : [{ storage: p.storage, color: p.color }]).map((v) => `${v.storage}|${v.color}`).join(",")
    const t = setTimeout(() => {
      sdk.client
        .fetch<{ duplicates: { id: string; title: string; match: string }[] }>(
          `/admin/quick-add/duplicates?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&combos=${encodeURIComponent(combos)}`
        )
        .then((r) => setDups(r.duplicates))
        .catch(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [brand, model, variants.length, p.storage, p.color])

  const meta = (img: ProcessedImage, i: number): AiImageMeta => p.imageMeta[img.preview] || { kind: guessKind(i), note: "" }
  const setMeta = (img: ProcessedImage, i: number, patch: Partial<AiImageMeta>) =>
    p.setImageMeta((m) => ({ ...m, [img.preview]: { ...meta(img, i), ...patch } }))

  const aiImages = p.images.slice(0, AI_MAX_IMAGES)
  const missing = [
    !p.title.trim() && "اسم الجهاز",
    !p.categoryId && "القسم",
    !aiImages.length && "صورة",
    !(Number(p.price) > 0) && !variants.some((v) => (v.price || 0) > 0) && "السعر",
    preset === "custom" && !customPrompt.trim() && "الوصف المخصص",
  ].filter(Boolean) as string[]

  const fullTitle = !variants.length && p.storage && !p.title.toLowerCase().includes(p.storage.toLowerCase()) ? `${p.title.trim()} ${p.storage}` : p.title.trim()

  // يرفع الأصول (بدون شعار) واحدة في كل طلب، ثم ينشئ المهمة
  const createJob = async (generate: boolean) => {
    for (const img of aiImages) {
      const src = p.sources[img.preview]
      const err = src ? checkSourceFile(src) : null
      if (err) throw new Error(err)
    }
    const uploaded: { file_id: string; url: string; kind: ImageKind; note: string; is_main: boolean }[] = []
    for (let i = 0; i < aiImages.length; i++) {
      const img = aiImages[i]
      setBusy(`رفع الصورة ${i + 1} من ${aiImages.length}…`)
      // بلا أصل (نادر): نستخدم نسخة JPEG المعالجة
      const file = p.sources[img.preview] ? await prepareSource(p.sources[img.preview]) : img.jpeg
      const u = await uploadOne(file)
      const m = meta(img, i)
      uploaded.push({ file_id: u.id, url: u.url, kind: m.kind, note: m.note, is_main: i === 0 })
    }
    setBusy(generate ? "بدء التوليد…" : "تحليل الصور…")
    const specsLabeled: Record<string, string> = {}
    for (const [k, label] of SPEC_FIELDS) if (specs[k]?.trim()) specsLabeled[label] = specs[k].trim()
    const warranty = [warrantyTime.trim(), warrantyBy.trim() && `من ${warrantyBy.trim()}`].filter(Boolean).join(" ")
    return jobApi.create({
      title: fullTitle,
      brand: brand.trim(),
      model_name: model.trim(),
      condition: p.condition,
      parts: parts.trim(),
      preset,
      custom_prompt: preset === "custom" ? customPrompt.trim() : "",
      images: uploaded,
      generate,
      input: {
        price: Number(p.price) > 0 ? Number(p.price) : undefined,
        currency_code: p.currency,
        category_id: p.categoryId,
        qty: variants.length ? "" : p.qty.trim(),
        in_stock: variants.length ? variants.some((v) => v.stock === null || (v.stock || 0) > 0) : p.qty.trim() === "" || Number(p.qty) > 0,
        specs: Object.fromEntries(Object.entries(specs).filter(([, v]) => v.trim())),
        specs_labeled: specsLabeled,
        variants: variants.length ? variants : p.storage || p.color ? [{ storage: p.storage, color: p.color, sku: "", stock: null, price: null }] : [],
        ...(used && batteryHealth.trim() ? { battery_health: batteryHealth.trim() } : {}),
        ...(used && conditionNote.trim() ? { condition_note: conditionNote.trim() } : {}),
        ...(warranty ? { warranty } : {}),
      },
      private: {
        cost: Number(cost) > 0 ? Number(cost) : null,
        supplier: supplier.trim(),
        imei: used ? imei.trim() : "",
        margin_type: marginType,
        margin_value: Number(marginValue) || 0,
      },
    })
  }

  const generate = async () => {
    if (missing.length) return toast.error(`أكمل: ${missing.join("، ")}`)
    try {
      const job = await createJob(true)
      toast.success("بدأ التحسين في الخلفية")
      p.onCreated(job)
    } catch (e: any) {
      toast.error(e?.message || "تعذّر بدء التوليد")
    } finally {
      setBusy("")
    }
  }

  // "اقترح الأجزاء من الصور": مهمة مؤقتة بلا توليد، ثم تحليل الصور فقط
  const suggestParts = async () => {
    if (!aiImages.length) return toast.error("أضف صور الجهاز أولاً")
    if (!p.title.trim()) return toast.error("اكتب اسم الجهاز أولاً")
    setSuggesting(true)
    try {
      const job = await createJob(false)
      const r = await jobApi.action(job.id, "analyze-parts")
      await jobApi.action(job.id, "reject").catch(() => null)
      setParts(r.suggestion)
      toast.info("مسودة من الصور: راجعها وعدّلها قبل المتابعة")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الاقتراح")
    } finally {
      setSuggesting(false)
      setBusy("")
    }
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const setVar = (i: number, patch: Partial<AiVariant>) => setVariants((vs) => vs.map((v, k) => (k === i ? { ...v, ...patch } : v)))
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`

  if (!connected) {
    return (
      <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg p-4">
        <Text weight="plus">Gemini غير متصل</Text>
        <Text size="small">
          أضف مفتاح Gemini واختبره من{" "}
          <a className="text-ui-fg-interactive underline" href="/app/meta-connect#gemini">
            صفحة ربط ميتا ← تبويب Gemini
          </a>
          ، أو أوقف «تحسين بالذكاء الاصطناعي» لتكمل الإضافة العادية.
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-ui-border-interactive p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text weight="plus">✨ التحسين بالذكاء الاصطناعي</Text>
        {g?.status === "error" ? <Badge color="red" size="2xsmall">خطأ في الاتصال: افحص المفتاح</Badge> : g?.status !== "connected" && <Badge color="orange" size="2xsmall">لم يُختبر الاتصال بعد</Badge>}
      </div>

      {/* الحالة: الثالثة (مجدّد) خاصة بهذا الوضع */}
      {p.condition === "new" ? null : (
        <div className="rounded-md border border-ui-tag-orange-border bg-ui-tag-orange-bg p-3 text-sm">⚠️ {HONESTY_NOTE}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {(["new", "used", "refurbished"] as AiCondition[]).map((c) => (
          <button key={c} type="button" className={chip(p.condition === c)} onClick={() => p.setCondition(c)}>
            {{ new: "جديد", used: "مستعمل", refurbished: "مجدّد" }[c]}
          </button>
        ))}
      </div>

      {/* الصور: النوع والملاحظة والرئيسية والترتيب بالسحب */}
      <section className="flex flex-col gap-2">
        <Label>صور الجهاز للذكاء الاصطناعي (حتى {AI_MAX_IMAGES}، JPG/PNG/WebP حتى 10MB)</Label>
        {p.images.length > AI_MAX_IMAGES && <Text size="small" className="text-ui-fg-error">سيُستخدم أول {AI_MAX_IMAGES} صور فقط</Text>}
        {!aiImages.length && <Text size="small" className="text-ui-fg-subtle">أضف الصور من منطقة الصور أعلاه.</Text>}
        <div className="grid gap-2 sm:grid-cols-2">
          {aiImages.map((img, i) => {
            const m = meta(img, i)
            return (
              <div
                key={img.preview}
                draggable
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag !== null && drag !== i) p.reorder(drag, i)
                  setDrag(null)
                }}
                className="flex cursor-move gap-2 rounded-md border p-2"
              >
                <img src={img.preview} alt="" className="h-20 w-16 rounded object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Select size="small" value={m.kind} onValueChange={(v) => setMeta(img, i, { kind: v as ImageKind })}>
                      <Select.Trigger className="w-28">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {(Object.keys(KIND_LABELS) as ImageKind[]).map((k) => (
                          <Select.Item key={k} value={k}>{KIND_LABELS[k]}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                    {i === 0 ? (
                      <Badge size="2xsmall" color="blue">الرئيسية</Badge>
                    ) : (
                      <button type="button" className="text-xs text-ui-fg-interactive underline" onClick={() => p.reorder(i, 0)}>اجعلها الرئيسية</button>
                    )}
                  </div>
                  <Input size="small" dir="auto" value={m.note} onChange={(e) => setMeta(img, i, { note: e.target.value })} placeholder="ملاحظة لهذه الصورة (اختياري)" />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* اسم الجهاز ووصف الأجزاء */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>الماركة</Label>
          <Input dir="auto" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Samsung" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>الموديل</Label>
          <Input dir="auto" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Galaxy S24 Ultra" />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label>وصف أجزاء الجهاز (يحافظ على تفاصيله الحقيقية)</Label>
            <Button size="small" variant="secondary" isLoading={suggesting} disabled={Boolean(busy)} onClick={suggestParts}>
              اقترح الأجزاء من الصور
            </Button>
          </div>
          <Textarea dir="auto" rows={3} value={parts} onChange={(e) => setParts(e.target.value)} placeholder="الكاميرا الخلفية 4 عدسات بشكل عمودي، زر الطاقة والصوت على الجانب الأيمن، منفذ USB-C بالأسفل مع القلم" />
          <Text size="xsmall" className="text-ui-fg-subtle">الاقتراح مسودة لما يظهر في الصور فقط: راجعه قبل التوليد.</Text>
        </div>
      </section>

      {dups.length > 0 && (
        <div className="rounded-md border border-ui-tag-orange-border bg-ui-tag-orange-bg p-3 text-sm">
          ⚠️ يوجد منتج مشابه في المتجر:{" "}
          {dups.map((d) => (
            <a key={d.id} className="me-2 underline" href={`/app/products/${d.id}`} target="_blank" rel="noreferrer">
              {d.title} {d.match && `(${d.match})`}
            </a>
          ))}
        </div>
      )}

      {/* النمط */}
      <section className="flex flex-col gap-2">
        <Label>نمط الصور (نفس النمط لكل الصور حتى تخرج متناسقة)</Label>
        <div className="flex flex-wrap gap-2">
          {presets.map((k) => (
            <button key={k} type="button" className={chip(preset === k)} onClick={() => setPreset(k)}>
              {PRESET_LABELS[k]}
            </button>
          ))}
        </div>
        {preset === "custom" && <Textarea dir="auto" rows={2} value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="صف الخلفية والإضاءة التي تريدها…" />}
        <Text size="xsmall" className="text-ui-fg-subtle">صور العلبة والملحقات: تُحسَّن الخلفية فقط ولا يُعدَّل محتواها.</Text>
      </section>

      {/* بيانات الجوال */}
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer font-medium">المواصفات (تظهر في المتجر، اختياري)</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {SPEC_FIELDS.map(([k, label]) => (
            <div key={k} className="flex flex-col gap-1">
              <Label size="small">{label}</Label>
              <Input size="small" dir="auto" value={specs[k] || ""} onChange={(e) => setSpecs({ ...specs, [k]: e.target.value })} />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <Label size="small">الضمان: المدة</Label>
            <Input size="small" dir="auto" value={warrantyTime} onChange={(e) => setWarrantyTime(e.target.value)} placeholder="سنة" />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">الضمان: الجهة</Label>
            <Input size="small" dir="auto" value={warrantyBy} onChange={(e) => setWarrantyBy(e.target.value)} placeholder="المتجر / الوكيل" />
          </div>
          {used && (
            <>
              <div className="flex flex-col gap-1">
                <Label size="small">نسبة البطارية</Label>
                <Input size="small" value={batteryHealth} onChange={(e) => setBatteryHealth(e.target.value)} placeholder="89%" />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">IMEI / Serial (للمتجر فقط، لا يُنشر)</Label>
                <Input size="small" dir="ltr" value={imei} onChange={(e) => setImei(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label size="small">وصف الحالة</Label>
                <Input size="small" dir="auto" value={conditionNote} onChange={(e) => setConditionNote(e.target.value)} placeholder="خدش خفيف في الإطار، الشاشة سليمة" />
              </div>
            </>
          )}
        </div>
      </details>

      {/* التسعير */}
      <section className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label size="small">سعر التكلفة (خاص)</Label>
          <Input size="small" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">المورد (خاص)</Label>
          <Input size="small" dir="auto" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">الهامش</Label>
          <div className="flex gap-1">
            <Input size="small" type="number" min="0" value={marginValue} onChange={(e) => setMarginValue(e.target.value)} />
            <Select size="small" value={marginType} onValueChange={(v) => setMarginType(v as "percent" | "fixed")}>
              <Select.Trigger className="w-20">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="percent">%</Select.Item>
                <Select.Item value="fixed">مبلغ</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>
        <div className="flex flex-col justify-end gap-1">
          <Text size="small">سعر البيع: <b>{Number(p.price) > 0 ? `${p.price} ${p.currency.toUpperCase()}` : "—"}</b></Text>
          <Text size="xsmall" className="text-ui-fg-subtle">يُحسب تلقائياً ويمكن تعديله من حقل السعر. التكلفة والمورد لا يظهران خارج اللوحة.</Text>
        </div>
      </section>

      {/* الخيارات */}
      <details className="rounded-md border p-3">
        <summary className="cursor-pointer font-medium">الخيارات: السعة × اللون (اختياري)</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {STORAGES.map((s) => (
              <button key={s} type="button" className={chip(vStorages.includes(s))} onClick={() => toggle(vStorages, setVStorages, s)}>{s}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" className={chip(vColors.includes(c))} onClick={() => toggle(vColors, setVColors, c)}>{c}</button>
            ))}
          </div>
          {variants.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ui-fg-subtle">
                    <th className="p-1 text-start">الخيار</th>
                    <th className="p-1 text-start">SKU</th>
                    <th className="p-1 text-start">المخزون</th>
                    <th className="p-1 text-start">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={`${v.storage}|${v.color}`}>
                      <td className="p-1">{[v.storage, v.color].filter(Boolean).join(" / ")}</td>
                      <td className="p-1"><Input size="small" dir="ltr" value={v.sku} onChange={(e) => setVar(i, { sku: e.target.value })} /></td>
                      <td className="p-1"><Input size="small" type="number" min="0" value={v.stock ?? ""} placeholder="∞" onChange={(e) => setVar(i, { stock: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                      <td className="p-1"><Input size="small" type="number" min="0" step="0.01" value={v.price ?? ""} placeholder={p.price || "—"} onChange={(e) => setVar(i, { price: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Text size="xsmall" className="text-ui-fg-subtle">السعر الفارغ = سعر البيع الأساسي. المخزون الفارغ = متوفر دائماً.</Text>
            </div>
          )}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="large" isLoading={Boolean(busy) && !suggesting} disabled={suggesting} onClick={generate}>
          ✨ حسّن الصور واكتب النصوص
        </Button>
        {busy && <Text className="self-center">{busy}</Text>}
        {missing.length > 0 && <Text size="small" className="text-ui-fg-subtle">ناقص: {missing.join("، ")}</Text>}
      </div>
      <Text size="xsmall" className="text-ui-fg-subtle">لا يُحفظ شيء في المتجر ولا يُنشر قبل المراجعة والضغط على «اعتماد ونشر».</Text>
    </div>
  )
}
