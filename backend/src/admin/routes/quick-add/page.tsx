import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Plus } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import { sdk } from "../../lib/sdk"
import { ProcessedImage, kb, processImage } from "../../lib/quick-add-image"
import { ProcessedVideo, VIDEO_MAX_SECONDS, processVideo } from "../../lib/quick-add-video"
import PostPreview from "../../components/quick-add-post-preview"
import type { FitMode } from "../../lib/quick-add-geometry"
import type { MetaPublic } from "../../components/quick-add-meta-connect"
import QuickAddProducts from "../../components/quick-add-products"

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
// عدد الصور المسموح للمنتج (منشور إنستغرام يأخذ أول 10 فقط)
const MAX_IMAGES = 20

// قوائم ثابتة حقيقية بدل الكتابة الحرة
const CONDITIONS: [string, string][] = [
  ["new", "جديد"],
  ["used", "مستخدم شبه جديد"],
]
const STORAGES = ["64GB", "128GB", "256GB", "512GB", "1TB"]
const COLORS = ["أسود", "أبيض", "رمادي", "فضي", "أزرق", "أخضر", "بنفسجي", "ذهبي", "وردي", "كريمي", "تيتانيوم"]
// سامسونج الأمريكي غالباً مستخدم شبه جديد، والصيني والماركات الأخرى جديدة: نقترح الحالة من القسم ويمكن تغييرها
const suggestCondition = (categoryLabel: string) => (/سامسونج|samsung/i.test(categoryLabel) ? "used" : "new")

const QuickAddPage = () => {
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [view, setView] = useState<"add" | "list">(() => (typeof window !== "undefined" && window.location.hash === "#list" ? "list" : "add"))
  const loadCtx = () => sdk.client.fetch<Ctx>("/admin/quick-add/context").then(setCtx).catch((e) => toast.error(String(e?.message || e)))
  useEffect(() => {
    loadCtx()
  }, [])

  return (
    <Container className="p-0" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
        <div>
          <Heading level="h1">إضافة سريعة</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            أضف منتجاً للمتجر وانشره على فيسبوك وإنستغرام وكتالوج ميتا وواتساب في خطوة واحدة.
          </Text>
        </div>
        <a href="/app/image-studio" className="text-sm text-ui-fg-interactive underline">🎨 استوديو الصور</a>
        {/* ربط ميتا صار صفحة مستقلة حتى لا يتغير الربط بالخطأ أثناء إضافة المنتجات */}
        {ctx && (
          <a href="/app/meta-connect" className="text-sm text-ui-fg-interactive underline">
            ربط ميتا {ctx.meta.has_token ? <Badge size="2xsmall" color="green" className="ms-1">مربوط</Badge> : <Badge size="2xsmall" color="orange" className="ms-1">غير مربوط</Badge>}
          </a>
        )}
      </div>
      {/* تبويبان: إضافة منتج جديد، أو إدارة كل المنتجات (تعديل، ترتيب، حذف، نشر على ميتا) */}
      <div className="flex gap-2 border-b px-4 py-2 sm:px-6">
        {([["add", "إضافة منتج"], ["list", "المنتجات (تعديل ونشر)"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === k ? "bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!ctx ? (
        <Text className="p-6">جارٍ التحميل…</Text>
      ) : view === "add" ? (
        <AddForm ctx={ctx} goMeta={() => (window.location.href = "/app/meta-connect")} />
      ) : (
        <QuickAddProducts meta={ctx.meta} currency={ctx.currency_code} />
      )}
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
  // هوية المتجر على الصور والفيديو (الشعار)
  // لا ختم على الصور ولا الفيديو (طلب المتجر)
  const brand = false
  const storeBrand = false
  const [video, setVideo] = useState<ProcessedVideo | null>(null)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const [useVideo, setUseVideo] = useState(true)
  // حقول إضافية
  const [description, setDescription] = useState("")
  const [qty, setQty] = useState("")
  const [condition, setCondition] = useState("new")
  const [conditionTouched, setConditionTouched] = useState(false)
  const [storage, setStorage] = useState("")
  const [color, setColor] = useState("")
  // ميتا (للمنشور فقط)
  const [toFb, setToFb] = useState(metaReady && Boolean(ctx.meta.page_id))
  const [toIg, setToIg] = useState(metaReady && Boolean(ctx.meta.page_id))
  const [toCatalog, setToCatalog] = useState(metaReady && Boolean(ctx.meta.catalog_id))
  const [postText, setPostText] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [preview, setPreview] = useState<{ caption: string; ig_caption?: string; comment: string; suggested: string[] } | null>(null)

  const [busy, setBusy] = useState<string>("")
  const [done, setDone] = useState<Done | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cat = cats.find((c) => c.id === categoryId)
  const priceNum = Number(price)
  // اقتراح الحالة من القسم ما لم يخترها المدير بنفسه
  useEffect(() => {
    if (cat && !conditionTouched) setCondition(suggestCondition(cat.label))
  }, [categoryId])
  // الاسم النهائي: الاسم + السعة (إن لم تكن مكتوبة فيه)
  const fullTitle = storage && !title.toLowerCase().includes(storage.toLowerCase()) ? `${title.trim()} ${storage}` : title.trim()
  const missing = [!title.trim() && "الاسم", !categoryId && "القسم", !images.length && !video && "صورة أو فيديو", !(priceNum > 0) && "السعر"].filter(Boolean) as string[]

  // معاينة نص المنشور واقتراح الهاشتاقات (بعد توقف الكتابة قليلاً)
  useEffect(() => {
    const t = setTimeout(() => {
      sdk.client
        .fetch<{ caption: string; ig_caption?: string; comment: string; suggested: string[] }>("/admin/quick-add/preview", {
          method: "POST",
          body: { title: fullTitle, price: priceNum > 0 ? priceNum : undefined, text: postText, hashtags, category_names: cat?.names || [], handle: done?.handle },
        })
        .then(setPreview)
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [fullTitle, priceNum, postText, hashtags, categoryId, done?.handle])

  const addVideo = async (f: File) => {
    setVideoProgress(0)
    try {
      const v = await processVideo(f, { brand }, (x) => setVideoProgress(x))
      if (video) URL.revokeObjectURL(video.preview)
      setVideo(v)
      if (v.type !== "mp4") toast.warning("المتصفح حفظ الفيديو بصيغة WebM: يظهر في المتجر، لكن إنستغرام وفيسبوك سيأخذان الصور بدلاً منه")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تجهيز الفيديو")
    } finally {
      setVideoProgress(null)
    }
  }

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return
    const vids = Array.from(list).filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|3gp|mkv)$/i.test(f.name))
    if (vids.length) addVideo(vids[0])
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif|avif|webp|jpe?g|png|gif|bmp)$/i.test(f.name))
    const room = MAX_IMAGES - images.length
    if (files.length > room) toast.warning(`الحد ${MAX_IMAGES} صورة، أُخذت أول ${room}`)
    setProcessing((n) => n + Math.min(files.length, room))
    for (const f of files.slice(0, room)) {
      try {
        const img = await processImage(f, { mode, autoTrim, background: "auto", brand, storeBrand })
        setImages((xs) => [...xs, img])
      } catch {
        toast.error(`تعذّر قراءة الصورة ${f.name} (جرّب JPG أو PNG)`)
      } finally {
        setProcessing((n) => n - 1)
      }
    }
  }
  const [imageUrl, setImageUrl] = useState("")
  const addFromUrl = async () => {
    const u = imageUrl.trim()
    if (!u) return
    setProcessing((n) => n + 1)
    try {
      const r = await fetch(`/admin/quick-add/image-proxy?url=${encodeURIComponent(u)}`, { credentials: "include" })
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "تعذّر تحميل الصورة")
      const blob = await r.blob()
      const name = (u.split("/").pop() || "image").split("?")[0].slice(0, 40) || "image"
      const img = await processImage(new File([blob], name, { type: blob.type }), { mode, autoTrim, background: "auto", brand, storeBrand })
      setImages((xs) => [...xs, img].slice(0, MAX_IMAGES))
      setImageUrl("")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تحميل الصورة")
    } finally {
      setProcessing((n) => n - 1)
    }
  }
  // الصورة الرئيسية = الأولى (تظهر في المتجر والمنشور). نجمة على أي صورة تجعلها الأولى
  const makeMain = (i: number) => setImages((xs) => [xs[i], ...xs.filter((_, k) => k !== i)])
  const move = (i: number, d: number) =>
    setImages((xs) => {
      const j = i + d
      if (j < 0 || j >= xs.length) return xs
      const c = [...xs]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  const reset = () => {
    images.forEach((i) => (URL.revokeObjectURL(i.preview), URL.revokeObjectURL(i.postPreview)))
    setTitle("")
    setPrice("")
    setImages([])
    if (video) URL.revokeObjectURL(video.preview)
    setVideo(null)
    setDescription("")
    setQty("")
    setPostText("")
    setHashtags("")
    setStorage("")
    setColor("")
    setConditionTouched(false)
    setDone(null)
  }

  // نرفع كل ملف في طلب مستقل: الخادم يرفض أي طلب أكبر من 1MB،
  // وعدة صور معاً في طلب واحد كانت تتجاوز الحد رغم أن كل صورة صغيرة
  const upload = async (files: File[]) => {
    const urls: string[] = []
    for (const file of files) {
      const r = await sdk.admin.upload.create({ files: [file] })
      urls.push((r.files[0] as any).url as string)
    }
    return urls
  }

  const save = async (publish: boolean) => {
    if (missing.length) {
      toast.error(`أكمل: ${missing.join("، ")}`)
      return
    }
    try {
      setBusy("رفع الصور…")
      // الفيديو: الملف + غلافه. الغلاف يصبح صورة المنتج إن لم توجد صور
      let videoMeta: { url: string; poster: string; type: string; seconds: number }[] = []
      let posterUrl = ""
      if (video) {
        setBusy("رفع الفيديو…")
        const [vu, pu] = await upload([video.file, video.poster])
        videoMeta = [{ url: vu, poster: pu, type: video.type, seconds: video.seconds }]
        posterUrl = pu
        setBusy("رفع الصور…")
      }
      const urls = images.length ? await upload(images.map((i) => i.webp)) : [posterUrl]
      // نسخ JPEG لميتا (إنستغرام لا يقبل webp)، لا تظهر في المتجر
      const metaUrls = images.length ? await upload(images.map((i) => i.jpeg)).catch(() => [] as string[]) : [posterUrl]

      setBusy("إنشاء المنتج…")
      const track = qty.trim() !== "" && Number(qty) >= 0
      const { product } = await sdk.admin.product.create({
        title: fullTitle,
        description: description.trim() || undefined,
        status: "published",
        thumbnail: urls[0],
        images: urls.map((url) => ({ url })),
        categories: [{ id: categoryId }],
        sales_channels: ctx.default_sales_channel_id ? [{ id: ctx.default_sales_channel_id }] : undefined,
        shipping_profile_id: ctx.shipping_profile_id || undefined,
        // الحالة للكتالوج فقط (ميتا تشترطها صحيحة)، ولا تظهر في المنشور ولا في اسم المنتج
        metadata: { condition, ...(storage ? { storage } : {}), ...(color ? { color } : {}), meta_images: metaUrls, ...(videoMeta.length ? { videos: videoMeta } : {}), added_by: "quick-add" },
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
        body: { product_id: d.id, facebook: again("facebook", toFb), instagram: again("instagram", toIg), catalog: again("catalog", toCatalog), text: postText, hashtags, use_video: useVideo },
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
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-5">
        {/* 1. الأساسيات */}
        <section className="grid gap-4 md:grid-cols-2">
          {/* الحالة: تبويبان واضحان. تُحفظ للكتالوج (شرط ميتا)، ولا تُكتب في المنشور ولا في اسم المنتج */}
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label>حالة الجهاز *</Label>
            <div className="grid grid-cols-2 gap-2">
              {CONDITIONS.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setCondition(v)
                    setConditionTouched(true)
                  }}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
                    condition === v ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "border-ui-border-base hover:bg-ui-bg-subtle-hover"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
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
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label>السعة (تُضاف لاسم المنتج)</Label>
            <div className="flex flex-wrap gap-2">
              {STORAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStorage(storage === s ? "" : s)}
                  className={`rounded-full border px-3 py-1 text-xs ${storage === s ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 2. الصور */}
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>الصور والفيديو * (حتى {MAX_IMAGES} صورة + فيديو واحد، أي مقاس)</Label>
            <div className="flex flex-wrap items-center gap-4">
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
            <Text>اسحب الصور أو الفيديو هنا، أو اضغط للاختيار</Text>
            <Text size="small" className="text-ui-fg-subtle">
              صورة المتجر مربعة 1600×1600 على خلفية نظيفة والمنتج يملأ 85% منها (معيار أمازون ونون)، وصورة المنشور 1080×1350، بلا أي ختم. اضغط ★ على أي صورة لتصبح الرئيسية، والفيديو يُضغط إلى أقل من 1MB (حتى {VIDEO_MAX_SECONDS} ثانية) مع الحفاظ على وضوحه
            </Text>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
          </div>
          {/* أو من رابط صورة على الإنترنت (يُجلب عبر السيرفر ثم يُحوَّل مثل أي صورة) */}
          <div className="flex gap-2">
            <Input dir="ltr" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="أو الصق رابط صورة https://…" />
            <Button variant="secondary" disabled={!imageUrl.trim() || processing > 0} onClick={addFromUrl}>
              إضافة من الرابط
            </Button>
          </div>
          {processing > 0 && <Text size="small">جارٍ تجهيز {processing} صورة…</Text>}
          {videoProgress !== null && (
            <div className="flex flex-col gap-1">
              <Text size="small">جارٍ ضغط الفيديو… {Math.round(videoProgress * 100)}% (يأخذ نفس مدة الفيديو تقريباً)</Text>
              <div className="h-1.5 w-full overflow-hidden rounded bg-ui-bg-subtle">
                <div className="h-full bg-ui-fg-interactive transition-all" style={{ width: `${Math.round(videoProgress * 100)}%` }} />
              </div>
            </div>
          )}
          {video && (
            <div className="flex items-center gap-3 rounded-md border p-2">
              <video src={video.preview} className="aspect-[4/5] w-24 rounded object-cover" muted playsInline loop autoPlay />
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
                <Text size="small" weight="plus">فيديو المنتج · {video.seconds} ثانية · {video.type.toUpperCase()}</Text>
                <span>{kb(video.originalBytes)} ← {kb(video.file.size)}</span>
                <button type="button" className="self-start text-ui-fg-error underline" onClick={() => { URL.revokeObjectURL(video.preview); setVideo(null) }}>حذف الفيديو</button>
              </div>
            </div>
          )}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {images.map((img, i) => (
                <div key={img.preview} className="relative overflow-hidden rounded-md border">
                  <img src={img.preview} alt="" className="aspect-square w-full bg-white object-contain" />
                  {i === 0 && <Badge size="2xsmall" color="blue" className="absolute top-1 right-1">الرئيسية</Badge>}
                  <div className="flex items-center justify-between bg-ui-bg-subtle px-1 py-0.5 text-[11px]">
                    <span title="الحجم قبل وبعد">{kb(img.originalBytes)} ← {kb(img.webp.size)}</span>
                    <span className="flex gap-1">
                      {i > 0 && (
                        <button type="button" title="اجعلها الصورة الرئيسية" onClick={() => makeMain(i)} aria-label="اجعلها الرئيسية">★</button>
                      )}
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
              <Label>اللون</Label>
              <Select value={color} onValueChange={setColor}>
                <Select.Trigger>
                  <Select.Value placeholder="بدون" />
                </Select.Trigger>
                <Select.Content>
                  {COLORS.map((c) => (
                    <Select.Item key={c} value={c}>{c}</Select.Item>
                  ))}
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
        {video?.type === "mp4" && (
          <div className="flex items-center justify-between">
            <Label size="small">انشر الفيديو بدل الصور (ريلز)</Label>
            <Switch checked={useVideo} onCheckedChange={setUseVideo} />
          </div>
        )}
        {preview?.caption && (
          <PostPreview
            caption={preview.caption}
            igCaption={preview.ig_caption || preview.caption}
            comment={preview.comment}
            image={images[0]?.postPreview || images[0]?.preview || undefined}
            video={video && useVideo && video.type === "mp4" ? video.preview : undefined}
            count={images.length}
          />
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
