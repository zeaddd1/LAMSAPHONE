import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Plus } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Select, Switch, Tabs, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import { sdk } from "../../lib/sdk"
import { ProcessedImage, kb, processImage } from "../../lib/quick-add-image"
import type { FitMode } from "../../lib/quick-add-geometry"
import MetaConnectTab, { MetaPublic } from "../../components/quick-add-meta-connect"

// صفحة "إضافة سريعة": منتج كامل في المتجر + نشره على ميتا من مكان واحد.
// تستخدم واجهات Medusa الرسمية فقط (upload / products / inventory) ولا تعدّل كود Medusa.

type Ctx = {
  categories: { id: string; name: string; parent_id: string | null }[]
  default_sales_channel_id: string | null
  shipping_profile_id: string | null
  stock_locations: { id: string; name: string }[]
  currency_code: string
  meta: MetaPublic
}
type PublishResult = { ok: boolean; url?: string; error?: string; skipped?: boolean; comment_error?: string }
type Done = { id: string; handle: string; title: string; link?: string; results?: Record<string, PublishResult> }

const STORE = "https://lamsaphone.yemenbay.com/ye/products/"

const QuickAddPage = () => {
  const [tab, setTab] = useState("add")
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const loadCtx = () => sdk.client.fetch<Ctx>("/admin/quick-add/context").then(setCtx).catch((e) => toast.error(String(e?.message || e)))
  useEffect(() => {
    loadCtx()
  }, [])

  return (
    <Container className="p-0" dir="rtl">
      <div className="px-6 py-4 border-b">
        <Heading level="h1">إضافة سريعة</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          أضف منتجاً للمتجر وانشره على فيسبوك وإنستغرام وكتالوج ميتا وواتساب في خطوة واحدة.
        </Text>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="px-6 pt-3">
          <Tabs.List>
            <Tabs.Trigger value="add">إضافة منتج</Tabs.Trigger>
            <Tabs.Trigger value="meta">
              ربط ميتا {ctx && (ctx.meta.has_token ? <Badge size="2xsmall" color="green" className="ms-1">مربوط</Badge> : <Badge size="2xsmall" color="orange" className="ms-1">غير مربوط</Badge>)}
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="add">{ctx ? <AddForm ctx={ctx} goMeta={() => setTab("meta")} /> : <Text className="p-6">جارٍ التحميل…</Text>}</Tabs.Content>
        <Tabs.Content value="meta">
          <MetaConnectTab onSaved={loadCtx} />
        </Tabs.Content>
      </Tabs>
    </Container>
  )
}

function useCategoryOptions(ctx: Ctx) {
  return useMemo(() => {
    const byParent = new Map<string | null, Ctx["categories"]>()
    for (const c of ctx.categories) byParent.set(c.parent_id, [...(byParent.get(c.parent_id) || []), c])
    const out: { id: string; label: string; names: string[] }[] = []
    const walk = (parent: string | null, path: string[]) => {
      for (const c of byParent.get(parent) || []) {
        const names = [...path, c.name]
        out.push({ id: c.id, label: names.join(" › "), names })
        walk(c.id, names)
      }
    }
    walk(null, [])
    return out
  }, [ctx.categories])
}

function AddForm({ ctx, goMeta }: { ctx: Ctx; goMeta: () => void }) {
  const cats = useCategoryOptions(ctx)
  const metaReady = ctx.meta.has_token
  // الحقول الأساسية أولاً
  const [title, setTitle] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [price, setPrice] = useState("")
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [processing, setProcessing] = useState(0)
  const [mode, setMode] = useState<FitMode>("contain")
  const [autoTrim, setAutoTrim] = useState(true)
  // حقول إضافية
  const [description, setDescription] = useState("")
  const [qty, setQty] = useState("")
  const [condition, setCondition] = useState("new")
  // ميتا (للمنشور فقط)
  const [toFb, setToFb] = useState(metaReady && Boolean(ctx.meta.page_id))
  const [toIg, setToIg] = useState(metaReady && Boolean(ctx.meta.page_id))
  const [toCatalog, setToCatalog] = useState(metaReady && Boolean(ctx.meta.catalog_id))
  const [postText, setPostText] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [preview, setPreview] = useState<{ caption: string; comment: string; suggested: string[] } | null>(null)

  const [busy, setBusy] = useState<string>("")
  const [done, setDone] = useState<Done | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cat = cats.find((c) => c.id === categoryId)
  const priceNum = Number(price)
  const missing = [!title.trim() && "الاسم", !categoryId && "القسم", !images.length && "صورة واحدة على الأقل", !(priceNum > 0) && "السعر"].filter(Boolean) as string[]

  // معاينة نص المنشور واقتراح الهاشتاقات (بعد توقف الكتابة قليلاً)
  useEffect(() => {
    const t = setTimeout(() => {
      sdk.client
        .fetch<{ caption: string; comment: string; suggested: string[] }>("/admin/quick-add/preview", {
          method: "POST",
          body: { title, price: priceNum > 0 ? priceNum : undefined, text: postText, hashtags, category_names: cat?.names || [], handle: done?.handle },
        })
        .then(setPreview)
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [title, priceNum, postText, hashtags, categoryId, done?.handle])

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif|avif|webp|jpe?g|png|gif|bmp)$/i.test(f.name))
    const room = 10 - images.length
    if (files.length > room) toast.warning(`الحد 10 صور، أُخذت أول ${room}`)
    setProcessing((n) => n + Math.min(files.length, room))
    for (const f of files.slice(0, room)) {
      try {
        const img = await processImage(f, { mode, autoTrim, background: "auto" })
        setImages((xs) => [...xs, img])
      } catch {
        toast.error(`تعذّر قراءة الصورة ${f.name} (جرّب JPG أو PNG)`)
      } finally {
        setProcessing((n) => n - 1)
      }
    }
  }
  const move = (i: number, d: number) =>
    setImages((xs) => {
      const j = i + d
      if (j < 0 || j >= xs.length) return xs
      const c = [...xs]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  const reset = () => {
    images.forEach((i) => URL.revokeObjectURL(i.preview))
    setTitle("")
    setPrice("")
    setImages([])
    setDescription("")
    setQty("")
    setPostText("")
    setHashtags("")
    setDone(null)
  }

  const upload = async (files: File[]) => {
    const r = await sdk.admin.upload.create({ files })
    return r.files.map((f: any) => f.url as string)
  }

  const save = async (publish: boolean) => {
    if (missing.length) {
      toast.error(`أكمل: ${missing.join("، ")}`)
      return
    }
    try {
      setBusy("رفع الصور…")
      const urls = await upload(images.map((i) => i.webp))
      // نسخ JPEG لميتا (إنستغرام لا يقبل webp)، لا تظهر في المتجر
      const metaUrls = await upload(images.map((i) => i.jpeg)).catch(() => [] as string[])

      setBusy("إنشاء المنتج…")
      const track = qty.trim() !== "" && Number(qty) >= 0
      const { product } = await sdk.admin.product.create({
        title: title.trim(),
        description: description.trim() || undefined,
        status: "published",
        thumbnail: urls[0],
        images: urls.map((url) => ({ url })),
        categories: [{ id: categoryId }],
        sales_channels: ctx.default_sales_channel_id ? [{ id: ctx.default_sales_channel_id }] : undefined,
        shipping_profile_id: ctx.shipping_profile_id || undefined,
        metadata: { condition, meta_images: metaUrls, added_by: "quick-add" },
        options: [{ title: "الخيار", values: ["افتراضي"] }],
        variants: [
          {
            title: "افتراضي",
            options: { الخيار: "افتراضي" },
            prices: [{ currency_code: ctx.currency_code || "usd", amount: priceNum }],
            manage_inventory: track,
            allow_backorder: false,
          },
        ],
      } as any)

      if (track && ctx.stock_locations[0]) {
        setBusy("ضبط الكمية…")
        try {
          const { product: full } = await sdk.admin.product.retrieve(product.id, { fields: "variants.inventory_items.inventory_item_id" } as any)
          const itemId = (full as any).variants?.[0]?.inventory_items?.[0]?.inventory_item_id
          if (itemId)
            await sdk.client.fetch(`/admin/inventory-items/${itemId}/location-levels`, {
              method: "POST",
              body: { location_id: ctx.stock_locations[0].id, stocked_quantity: Number(qty) },
            })
        } catch {
          toast.warning("أُضيف المنتج، لكن تعذّر ضبط الكمية. اضبطها من صفحة المنتج.")
        }
      }

      const d: Done = { id: product.id, handle: product.handle, title: product.title, link: STORE + encodeURIComponent(product.handle) }
      setDone(d)
      toast.success("أُضيف المنتج إلى المتجر")
      if (publish) await publishMeta(d)
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ")
    } finally {
      setBusy("")
    }
  }

  const publishMeta = async (d: Done) => {
    setBusy("النشر على ميتا…")
    // عند إعادة المحاولة: الوجهات التي فشلت فقط، حتى لا يتكرر منشور نجح
    const prev = d.results
    const again = (k: string, on: boolean) => on && (!prev || (prev[k] && !prev[k].ok && !prev[k].skipped) || Boolean(prev.all))
    try {
      const r = await sdk.client.fetch<{ link: string; results: Record<string, PublishResult> }>("/admin/quick-add/publish", {
        method: "POST",
        body: { product_id: d.id, facebook: again("facebook", toFb), instagram: again("instagram", toIg), catalog: again("catalog", toCatalog), text: postText, hashtags },
      })
      const merged = { ...(prev && !prev.all ? prev : {}) }
      for (const [k, v] of Object.entries(r.results)) if (!v.skipped) merged[k] = v
      setDone({ ...d, link: r.link, results: merged })
      const failed = Object.values(r.results).filter((x) => !x.ok && !x.skipped).length
      failed ? toast.warning("نُشر جزئياً، راجع النتائج أدناه") : toast.success("تم النشر على ميتا")
    } catch (e: any) {
      toast.error(e?.message || "فشل النشر")
    } finally {
      setBusy("")
    }
  }

  const addTag = (t: string) => setHashtags((h) => (h.includes(t) ? h : `${h} ${t}`.trim()))

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-5">
        {/* 1. الأساسيات */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label htmlFor="qa-title">اسم المنتج *</Label>
            <Input id="qa-title" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: Samsung Galaxy S25 Ultra 256GB" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>القسم *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <Select.Trigger>
                <Select.Value placeholder="اختر القسم" />
              </Select.Trigger>
              <Select.Content>
                {cats.map((c) => (
                  <Select.Item key={c.id} value={c.id}>
                    {c.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="qa-price">السعر بالدولار *</Label>
            <Input id="qa-price" type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="700" />
          </div>
        </section>

        {/* 2. الصور */}
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>الصور * (حتى 10، أي مقاس)</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="qa-trim" checked={autoTrim} onCheckedChange={setAutoTrim} />
                <Label htmlFor="qa-trim" size="small">توسيط المنتج تلقائياً</Label>
              </div>
              <Select size="small" value={mode} onValueChange={(v) => setMode(v as FitMode)}>
                <Select.Trigger className="w-40">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="contain">الصورة كاملة</Select.Item>
                  <Select.Item value="cover">ملء الإطار (قص)</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </div>
          <div
            className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ui-border-strong p-4 text-center hover:bg-ui-bg-subtle-hover"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              addFiles(e.dataTransfer.files)
            }}
          >
            <Text>اسحب الصور هنا أو اضغط للاختيار</Text>
            <Text size="small" className="text-ui-fg-subtle">
              تُحوَّل تلقائياً إلى WebP بمقاس 1200×1400 (مناسب لصفحة المنتج وبطاقات المتجر) مع الحفاظ على الجودة
            </Text>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
          </div>
          {processing > 0 && <Text size="small">جارٍ تجهيز {processing} صورة…</Text>}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {images.map((img, i) => (
                <div key={img.preview} className="relative overflow-hidden rounded-md border">
                  <img src={img.preview} alt="" className="aspect-[6/7] w-full object-cover" />
                  {i === 0 && <Badge size="2xsmall" color="blue" className="absolute top-1 right-1">الرئيسية</Badge>}
                  <div className="flex items-center justify-between bg-ui-bg-subtle px-1 py-0.5 text-[11px]">
                    <span title="الحجم قبل وبعد">{kb(img.originalBytes)} ← {kb(img.webp.size)}</span>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => move(i, -1)} aria-label="تقديم">→</button>
                      <button type="button" onClick={() => move(i, 1)} aria-label="تأخير">←</button>
                      <button type="button" className="text-ui-fg-error" onClick={() => setImages((xs) => xs.filter((_, k) => k !== i))} aria-label="حذف">✕</button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. اختياري */}
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-medium">تفاصيل إضافية (اختياري)</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label>الوصف في المتجر</Label>
              <Textarea dir="auto" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="المواصفات، الضمان، محتويات العلبة…" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الكمية المتوفرة</Label>
              <Input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="فارغ = متوفر دائماً" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>الحالة</Label>
              <Select value={condition} onValueChange={setCondition}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="new">جديد</Select.Item>
                  <Select.Item value="used">مستعمل</Select.Item>
                  <Select.Item value="refurbished">مجدّد</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </div>
        </details>
      </div>

      {/* عمود ميتا */}
      <aside className="flex flex-col gap-4 rounded-lg border p-4">
        <Heading level="h2">النشر على ميتا</Heading>
        {!metaReady && (
          <Text size="small" className="text-ui-fg-subtle">
            ميتا غير مربوطة بعد.{" "}
            <button type="button" className="text-ui-fg-interactive underline" onClick={goMeta}>
              اربطها من هنا
            </button>
          </Text>
        )}
        {[
          ["فيسبوك (منشور على الصفحة)", toFb, setToFb, Boolean(ctx.meta.page_id)],
          ["إنستغرام (منشور)", toIg, setToIg, Boolean(ctx.meta.page_id)],
          ["كتالوج ميتا + واتساب", toCatalog, setToCatalog, Boolean(ctx.meta.catalog_id)],
        ].map(([label, val, set, ok]: any) => (
          <div key={label} className="flex items-center justify-between">
            <Label size="small">{label}</Label>
            <Switch disabled={!metaReady || !ok} checked={val && metaReady && ok} onCheckedChange={set} />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <Label size="small">نص المنشور (اختياري)</Label>
          <Textarea dir="auto" rows={3} value={postText} onChange={(e) => setPostText(e.target.value)} placeholder="عرض خاص لفترة محدودة…" />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">هاشتاقات وكلمات للترويج</Label>
          <Textarea dir="auto" rows={2} value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#سامسونج #عروض" />
          <Text size="xsmall" className="text-ui-fg-subtle">لا تظهر في نص المنشور ولا في المنتج: تُنشر تلقائياً كأول تعليق على منشور فيسبوك وإنستغرام لزيادة الوصول.</Text>
          {preview?.suggested?.length ? (
            <div className="flex flex-wrap gap-1">
              {preview.suggested.map((t) => (
                <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-ui-bg-subtle-hover">
                  {t}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {preview?.caption && (
          <div className="flex flex-col gap-1">
            <Label size="small">معاينة المنشور</Label>
            <pre dir="auto" className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-ui-bg-subtle p-2 font-sans text-xs">{preview.caption}</pre>
            {preview.comment && (
              <>
                <Label size="small">أول تعليق (الهاشتاقات)</Label>
                <pre dir="auto" className="whitespace-pre-wrap rounded-md bg-ui-bg-subtle p-2 font-sans text-xs">{preview.comment}</pre>
              </>
            )}
          </div>
        )}
      </aside>

      {/* الأزرار والنتيجة */}
      <div className="flex flex-col gap-3 lg:col-span-2">
        {!done ? (
          <div className="flex flex-wrap gap-2">
            <Button size="large" isLoading={Boolean(busy)} disabled={processing > 0} onClick={() => save(metaReady && (toFb || toIg || toCatalog))}>
              {metaReady && (toFb || toIg || toCatalog) ? "إضافة للمتجر ونشر على ميتا" : "إضافة للمتجر"}
            </Button>
            {metaReady && (toFb || toIg || toCatalog) && (
              <Button size="large" variant="secondary" isLoading={Boolean(busy)} disabled={processing > 0} onClick={() => save(false)}>
                إضافة للمتجر فقط
              </Button>
            )}
            {busy && <Text className="self-center">{busy}</Text>}
            {missing.length > 0 && <Text size="small" className="self-center text-ui-fg-subtle">ناقص: {missing.join("، ")}</Text>}
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-ui-tag-green-border bg-ui-tag-green-bg p-4">
            <Text weight="plus">✓ أُضيف «{done.title}» إلى المتجر</Text>
            <div className="flex flex-wrap gap-3 text-sm">
              <a className="text-ui-fg-interactive underline" href={done.link} target="_blank" rel="noreferrer">عرضه في المتجر</a>
              <a className="text-ui-fg-interactive underline" href={`/app/products/${done.id}`}>تعديله في اللوحة</a>
            </div>
            {done.results &&
              Object.entries(done.results).map(([k, r]) =>
                r.skipped ? null : (
                  <Text key={k} size="small">
                    {({ facebook: "فيسبوك", instagram: "إنستغرام", catalog: "الكتالوج", all: "ميتا" } as any)[k] || k}:{" "}
                    {r.ok ? (r.url ? <a className="underline" href={r.url} target="_blank" rel="noreferrer">تم ✓</a> : "تم ✓") : <span className="text-ui-fg-error">{r.error}</span>}
                    {r.comment_error && <span className="block text-ui-fg-subtle">{r.comment_error}</span>}
                  </Text>
                )
              )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={reset}>إضافة منتج آخر</Button>
              {metaReady && (toFb || toIg || toCatalog) && (!done.results || Object.values(done.results).some((r) => !r.ok && !r.skipped)) && (
                <Button variant="secondary" isLoading={Boolean(busy)} onClick={() => publishMeta(done)}>
                  {done.results ? "إعادة محاولة النشر" : "نشر على ميتا الآن"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const config = defineRouteConfig({ label: "إضافة سريعة", icon: Plus })

export default QuickAddPage
