import { Badge, Button, Checkbox, Drawer, Input, Label, Switch, Text, Textarea, toast, usePrompt } from "@medusajs/ui"
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useEffect, useMemo, useState } from "react"
import { sdk } from "../lib/sdk"
import { ProcessedImage, processImage } from "../lib/quick-add-image"
import { SPEC_FIELDS, cleanSpecs } from "../lib/product-specs"

// تبويب "المنتجات" في الإضافة السريعة: لوحة بصرية لكل منتجات المتجر.
// ترتيب العرض: تعطي المنتج رقماً (1، 2، 3…) بالسحب أو بكتابة الرقم، فيظهر بهذا الترتيب أولاً في المتجر وأقسامه،
// وأول 8 منها في أعلى الصفحة الرئيسية. المنتجات بلا رقم تأتي بعدها، الأحدث أولاً.
// تعديل كامل لكل منتج (الاسم، السعر، الظهور، الشارة، الصور، المواصفات، ميتا، الحذف) وتحديد جماعي.
// كله عبر واجهات Medusa الرسمية، والبيانات الإضافية في metadata فلا يتأثر كود Medusa.
type Price = { id?: string; amount: number; currency_code: string }
type Product = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  status: string
  created_at: string
  metadata: Record<string, any> | null
  variants: { id: string; title?: string; prices?: Price[] }[]
  categories?: { id?: string; name: string }[]
  images?: { id?: string; url: string }[]
}
type MetaFlags = { has_token: boolean; page_id: string; catalog_id: string; threads_has_token?: boolean; telegram_ready?: boolean }

// ---------- أسلوب المنشور وبدايته التشويقية (مشترك بين المنتج والإضافة السريعة والاستوديو) ----------
export type StyleInfo = { styles: { key: string; label: string }[]; style: string; hooks: string[]; hook: string; warnings?: string[] }

export function StylePicker({ info, hook, onStyle, onHook }: { info: StyleInfo | null; hook: string | undefined; onStyle: (s: string) => void; onHook: (h: string) => void }) {
  if (!info) return null
  const cur = hook ?? info.hook
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Label size="small">أسلوب المنشور:</Label>
        {info.styles.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onStyle(s.key)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${info.style === s.key ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Label size="small">البداية (أول سطر يراه الزبون):</Label>
        <div className="flex flex-wrap gap-1">
          {info.hooks.map((h) => (
            <button key={h} type="button" onClick={() => onHook(h)} className={`rounded-md border px-2 py-1 text-start text-xs ${cur === h ? "border-ui-fg-interactive bg-ui-bg-highlight" : "hover:bg-ui-bg-subtle-hover"}`} dir="auto">
              {h}
            </button>
          ))}
          <button type="button" onClick={() => onHook("")} className={`rounded-md border px-2 py-1 text-xs ${cur === "" ? "border-ui-fg-interactive bg-ui-bg-highlight" : "hover:bg-ui-bg-subtle-hover"}`}>
            بلا بداية
          </button>
        </div>
        <Input dir="auto" size="small" maxLength={150} value={cur} onChange={(e) => onHook(e.target.value)} placeholder="أو اكتب بدايتك بنفسك" />
      </div>
      {info.warnings?.length ? (
        <div className="rounded-md border border-ui-tag-orange-border bg-ui-tag-orange-bg p-2 text-xs text-ui-tag-orange-text">
          ⚠️ سياسات ميتا: {info.warnings.join(" · ")}
        </div>
      ) : (
        <Text size="xsmall" className="text-ui-fg-subtle">✅ النص متوافق مع سياسات ميتا (بلا طلب إعجاب أو مشاركة أو منشن، وبلا وعود مضللة).</Text>
      )}
    </div>
  )
}

// «متى ينشر؟»: الآن، أو في وقت تحدده (يُجدول)، أو مع النشر التلقائي اليومي (أول القائمة)
export type When = { mode: "now" | "at" | "auto"; at: string }
export const NOW: When = { mode: "now", at: "" }
const pad = (n: number) => String(n).padStart(2, "0")
// قيمة datetime-local بعد ساعة من الآن (بتوقيت الجهاز)
const inAnHour = () => {
  const d = new Date(Date.now() + 3600_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// يحوّل الاختيار إلى حقول الطلب
export const whenBody = (w: When) => (w.mode === "at" && w.at ? { schedule_at: new Date(w.at).toISOString() } : w.mode === "auto" ? { autopost: true } : {})
export const whenLabel = (w: When) => (w.mode === "at" ? "جدولة النشر" : w.mode === "auto" ? "أضفه للنشر التلقائي" : "نشر الآن")

export function WhenPicker({ value, onChange, allowAuto = false }: { value: When; onChange: (w: When) => void; allowAuto?: boolean }) {
  const opts: [When["mode"], string][] = [["now", "الآن"], ["at", "في وقت محدد"], ...(allowAuto ? ([["auto", "مع النشر التلقائي"]] as [When["mode"], string][]) : [])]
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Label size="small">متى؟</Label>
        {opts.map(([m, l]) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ mode: m, at: m === "at" ? value.at || inAnHour() : value.at })}
            className={`rounded-full border px-3 py-1 text-xs ${value.mode === m ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {value.mode === "at" && (
        <input type="datetime-local" className="w-fit rounded-md border bg-ui-bg-field px-2 py-1 text-sm" value={value.at} onChange={(e) => onChange({ ...value, at: e.target.value })} />
      )}
      {value.mode === "auto" && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          يدخل أول قائمة النشر التلقائي، ويُنشر في الساعة التالية المحددة بوجهاتها (صفحة ربط ميتا ← الجدولة والنشر التلقائي).
        </Text>
      )}
      {value.mode === "at" && <Text size="xsmall" className="text-ui-fg-subtle">تراه وتلغيه من: ربط ميتا ← الجدولة والنشر التلقائي.</Text>}
    </div>
  )
}
type PublishResult = { ok: boolean; url?: string; error?: string; skipped?: boolean; comment_error?: string }

const STORE = "https://lamsaphone.yemenbay.com/ye/products/"
const FIELDS =
  "id,title,handle,thumbnail,status,created_at,metadata,variants.id,variants.title,variants.prices.id,variants.prices.amount,variants.prices.currency_code,categories.id,categories.name,images.id,images.url"
const NAMES: Record<string, string> = { facebook: "فيسبوك", instagram: "إنستغرام", ig_story: "قصة إنستغرام", threads: "Threads", telegram: "تيليجرام", catalog: "الكتالوج", all: "ميتا" }
// شارات جاهزة للعروض (أو اكتب شارتك)
const BADGES = ["عرض خاص", "تخفيض", "الأكثر طلباً", "وصل حديثاً", "كمية محدودة", "سعر مميز"]

const usdOf = (v?: { prices?: Price[] }) => v?.prices?.find((x) => x.currency_code === "usd")
const rankOf = (p: Product) => {
  const r = p.metadata?.rank
  return r === null || r === undefined || r === "" || !Number.isFinite(Number(r)) ? Infinity : Number(r)
}
const isRanked = (p: Product) => rankOf(p) !== Infinity
// نفس ترتيب المتجر: المرقّمة بالترتيب، ثم الباقي الأحدث أولاً
const byOrder = (a: Product, b: Product) => rankOf(a) - rankOf(b) || +new Date(b.created_at) - +new Date(a.created_at)
const priceLabel = (p: Product) => {
  const xs = (p.variants || []).map((v) => usdOf(v)?.amount).filter((x): x is number => typeof x === "number")
  if (!xs.length) return "واتساب"
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  return lo === hi ? `$${lo}` : `$${lo}–${hi}`
}
const HOME_COUNT = 8

type Filter = "all" | "hidden" | "noprice" | "badge"

export default function QuickAddProducts({ meta, currency }: { meta: MetaFlags; currency: string }) {
  const [items, setItems] = useState<Product[] | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [cat, setCat] = useState("")
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const prompt = usePrompt()
  // السحب بالماوس وباللمس (جوال/تابلت) وبلوحة المفاتيح
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const load = async () => {
    try {
      const r = await sdk.admin.product.list({ limit: 300, order: "-created_at", fields: FIELDS } as any)
      setItems(r.products as any)
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تحميل المنتجات")
    }
  }
  useEffect(() => {
    load()
  }, [])

  const all = useMemo(() => [...(items || [])].sort(byOrder), [items])
  const ordered = useMemo(() => all.filter(isRanked), [all])
  const cats = useMemo(() => Array.from(new Set(all.flatMap((p) => (p.categories || []).map((c) => c.name)))), [all])
  const match = (p: Product) => {
    const s = q.trim().toLowerCase()
    return (
      (!s || p.title.toLowerCase().includes(s) || p.handle.includes(s)) &&
      (!cat || (p.categories || []).some((c) => c.name === cat)) &&
      (filter === "all" ||
        (filter === "hidden" && p.status !== "published") ||
        (filter === "noprice" && priceLabel(p) === "واتساب") ||
        (filter === "badge" && Boolean(p.metadata?.badge)))
    )
  }
  const rest = useMemo(() => all.filter((p) => !isRanked(p) && match(p)), [all, q, cat, filter])
  const shownOrdered = useMemo(() => ordered.filter(match), [ordered, q, cat, filter])
  const canDrag = !q.trim() && !cat && filter === "all"
  const stats = {
    total: all.length,
    hidden: all.filter((p) => p.status !== "published").length,
    noprice: all.filter((p) => priceLabel(p) === "واتساب").length,
    badge: all.filter((p) => p.metadata?.badge).length,
  }

  const patch = (np: Product) => setItems((xs) => (xs || []).map((x) => (x.id === np.id ? np : x)))

  const syncCatalog = async (ids?: string[], remove = false) => {
    if (!meta.has_token || !meta.catalog_id) return null
    return sdk.client
      .fetch<{ ok: boolean; error?: string; updated?: number }>("/admin/quick-add/catalog", { method: "POST", body: { product_ids: ids, remove } })
      .catch((e) => ({ ok: false, error: String(e?.message || e) } as any))
  }

  // يحفظ ترتيب العرض: القائمة المرقّمة تأخذ 1..n، ومن خرج منها يُحذف رقمه. لا يحدّث إلا ما تغيّر
  const saveOrder = async (list: Product[], removed: Product[] = []) => {
    const before = items
    const next = new Map<string, number | null>()
    list.forEach((p, k) => next.set(p.id, k + 1))
    removed.forEach((p) => next.set(p.id, null))
    setItems((xs) => (xs || []).map((x) => (next.has(x.id) ? { ...x, metadata: { ...(x.metadata || {}), rank: next.get(x.id) } } : x)))
    setBusy("order")
    try {
      for (const p of [...list, ...removed]) {
        const r = next.get(p.id)!
        if ((isRanked(p) ? rankOf(p) : null) === r) continue
        await sdk.admin.product.update(p.id, { metadata: { ...(p.metadata || {}), rank: r } } as any)
      }
      toast.success("حُفظ ترتيب العرض. يظهر في المتجر خلال دقيقة")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر حفظ الترتيب")
      setItems(before)
      load()
    } finally {
      setBusy("")
    }
  }
  // يضع المنتج في الموضع n (1 = الأول). n فارغ = إزالته من الترتيب
  // latest: نسخة المنتج بعد آخر حفظ (حتى لا يرجع الترتيب بيانات قديمة)
  const placeAt = (p: Product, n: number | null, latest: Product = p) => {
    const list = ordered.filter((x) => x.id !== p.id)
    if (n === null) return saveOrder(list, isRanked(p) ? [latest] : [])
    const i = Math.max(0, Math.min(list.length, Math.round(n) - 1))
    list.splice(i, 0, latest)
    return saveOrder(list)
  }
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = ordered.findIndex((p) => p.id === active.id)
    const to = ordered.findIndex((p) => p.id === over.id)
    if (from < 0 || to < 0) return
    saveOrder(arrayMove(ordered, from, to))
  }

  const bulk = async (action: "order" | "unorder" | "show" | "hide" | "delete") => {
    const list = all.filter((p) => sel.has(p.id))
    if (!list.length) return
    if (action === "order") return (await saveOrder([...ordered, ...list.filter((p) => !isRanked(p))]), setSel(new Set()))
    if (action === "unorder") return (await saveOrder(ordered.filter((p) => !sel.has(p.id)), list.filter(isRanked)), setSel(new Set()))
    if (action === "delete") {
      const ok = await prompt({
        title: "حذف المنتجات المحددة",
        description: `سيُحذف ${list.length} منتج من المتجر ومن كتالوج ميتا نهائياً. المنشورات السابقة على فيسبوك وإنستغرام لا تُحذف. هل أنت متأكد؟`,
        confirmText: "نعم، احذف",
        cancelText: "إلغاء",
      })
      if (!ok) return
    }
    setBusy("bulk")
    let done = 0
    try {
      for (const p of list) {
        if (action === "delete") {
          await syncCatalog([p.id], true)
          await sdk.admin.product.delete(p.id)
        } else {
          await sdk.admin.product.update(p.id, { status: action === "show" ? "published" : "draft" } as any)
        }
        done++
      }
      if (action === "show" || action === "hide") await syncCatalog(list.map((p) => p.id), action === "hide")
      toast.success(`تم على ${done} منتج`)
    } catch (e: any) {
      toast.error(`تم على ${done} فقط: ${e?.message || e}`)
    } finally {
      setSel(new Set())
      setBusy("")
      load()
    }
  }

  const syncAll = async () => {
    setBusy("sync")
    const r = await syncCatalog()
    setBusy("")
    if (!r) toast.info("الكتالوج غير مربوط")
    else r.ok ? toast.success(`حُدّث الكتالوج: ${r.updated} عنصر`) : toast.error(r.error || "فشل تحديث الكتالوج")
  }

  if (items === null) return <Text className="p-6">جارٍ التحميل…</Text>
  const editP = editing ? all.find((p) => p.id === editing) : null
  const toggleSel = (id: string) => setSel((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))))
  const cardProps = (p: Product) => ({
    p,
    selected: sel.has(p.id),
    onSelect: () => toggleSel(p.id),
    onEdit: () => setEditing(p.id),
    onPlace: (n: number | null) => placeAt(p, n),
    disabled: Boolean(busy),
    position: isRanked(p) ? ordered.indexOf(p) + 1 : null,
  })

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* ملخص سريع */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {([
          ["كل المنتجات", stats.total, "all"],
          ["في ترتيب العرض", ordered.length, "all"],
          ["عليها شارة عرض", stats.badge, "badge"],
          ["بدون سعر (واتساب)", stats.noprice, "noprice"],
          ["مخفية", stats.hidden, "hidden"],
        ] as [string, number, Filter][]).map(([l, n, f], i) => (
          <button
            key={l}
            type="button"
            onClick={() => setFilter(i === 0 ? "all" : f)}
            className={`rounded-xl border p-3 text-start transition hover:shadow-sm ${i > 1 && filter === f ? "border-ui-border-interactive bg-ui-bg-highlight" : "bg-ui-bg-base"}`}
          >
            <div className="text-2xl font-bold">{n}</div>
            <div className="text-xs text-ui-fg-subtle">{l}</div>
          </button>
        ))}
      </div>

      {/* البحث والتصفية */}
      <div className="flex flex-wrap items-center gap-2">
        <Input className="min-w-0 flex-1" dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المنتج" />
        <Button variant="secondary" size="small" isLoading={busy === "sync"} onClick={syncAll} disabled={!meta.has_token || !meta.catalog_id}>
          تحديث كتالوج ميتا
        </Button>
      </div>
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip on={!cat} onClick={() => setCat("")}>كل الأقسام</Chip>
          {cats.map((c) => (
            <Chip key={c} on={cat === c} onClick={() => setCat(cat === c ? "" : c)}>{c}</Chip>
          ))}
          {filter !== "all" && <Chip on onClick={() => setFilter("all")}>إلغاء التصفية ✕</Chip>}
        </div>
      )}

      {/* التحديد الجماعي */}
      {sel.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-ui-bg-base p-2 shadow-sm">
          <Text size="small" weight="plus">محدد: {sel.size}</Text>
          <Button size="small" isLoading={busy === "order"} onClick={() => bulk("order")}>＋ إلى ترتيب العرض</Button>
          <Button size="small" variant="secondary" isLoading={busy === "order"} onClick={() => bulk("unorder")}>إزالة من الترتيب</Button>
          <Button size="small" variant="secondary" isLoading={busy === "bulk"} onClick={() => bulk("show")}>إظهار</Button>
          <Button size="small" variant="secondary" isLoading={busy === "bulk"} onClick={() => bulk("hide")}>إخفاء</Button>
          <Button size="small" variant="danger" isLoading={busy === "bulk"} onClick={() => bulk("delete")}>حذف</Button>
          <Button size="small" variant="transparent" onClick={() => setSel(new Set())}>إلغاء التحديد</Button>
        </div>
      )}

      {/* 1. ترتيب العرض */}
      <section className="flex flex-col gap-3 rounded-2xl border-2 border-[#FF6000]/40 bg-[#fff8f2] p-3 sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">ترتيب العرض في المتجر ({ordered.length})</h2>
            <Text size="small" className="text-ui-fg-subtle">
              أول ما يراه الزائر عند فتح المتجر أو الرجوع إليه. اسحب البطاقة (أو اضغطها مطولاً على الجوال) لتغيير مكانها، أو اكتب رقمها. أول {HOME_COUNT} تظهر أيضاً في أعلى الصفحة الرئيسية.
            </Text>
          </div>
          {!canDrag && <Badge color="orange" size="small">السحب يعمل بدون بحث أو تصفية</Badge>}
        </div>
        {!ordered.length ? (
          <div className="rounded-xl border-2 border-dashed border-[#FF6000]/40 p-6 text-center text-sm text-ui-fg-subtle">
            لا توجد منتجات في الترتيب بعد. اضغط «＋ للترتيب» على أي منتج بالأسفل، أو حدد عدة منتجات وأضفها دفعة واحدة.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={shownOrdered.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {shownOrdered.map((p) => (
                  <SortableCard key={p.id} draggable={canDrag && !busy} home={ordered.indexOf(p) < HOME_COUNT} total={ordered.length} {...cardProps(p)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {/* 2. باقي المنتجات */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">باقي المنتجات ({rest.length}) <span className="text-sm font-normal text-ui-fg-subtle">تظهر بعد المرتّبة، الأحدث أولاً</span></h2>
          <Button variant="secondary" size="small" onClick={() => setSel(sel.size ? new Set() : new Set(rest.map((p) => p.id)))}>
            {sel.size ? "إلغاء التحديد" : `تحديد الكل (${rest.length})`}
          </Button>
        </div>
        {!rest.length && <Text className="text-ui-fg-subtle">لا توجد منتجات.</Text>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {rest.map((p) => (
            <Card key={p.id} total={ordered.length} {...cardProps(p)} />
          ))}
        </div>
      </section>

      {editP && (
        <EditDrawer
          key={editP.id}
          p={editP}
          meta={meta}
          currency={currency}
          position={isRanked(editP) ? ordered.indexOf(editP) + 1 : null}
          onPlace={(n, latest) => placeAt(editP, n, latest)}
          onClose={() => setEditing(null)}
          onSaved={patch}
          onDeleted={() => (setItems((xs) => (xs || []).filter((x) => x.id !== editP.id)), setEditing(null))}
          syncCatalog={syncCatalog}
        />
      )}
    </div>
  )
}

type CardProps = {
  p: Product
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onPlace: (n: number | null) => void
  disabled: boolean
  total: number
  position: number | null
  home?: boolean
  dragHandle?: React.ReactNode
}

function SortableCard(props: CardProps & { draggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.p.id, disabled: !props.draggable })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      className={isDragging ? "scale-105 opacity-90 shadow-xl" : ""}
    >
      <Card
        {...props}
        dragHandle={
          props.draggable ? (
            <span {...attributes} {...listeners} className="cursor-grab touch-none select-none rounded px-1.5 text-lg leading-none text-ui-fg-muted active:cursor-grabbing" title="اسحب لتغيير الترتيب" aria-label="اسحب لتغيير الترتيب">
              ⠿
            </span>
          ) : null
        }
      />
    </div>
  )
}

function Card({ p, selected, onSelect, onEdit, onPlace, disabled, total, position, home, dragHandle }: CardProps) {
  const ranked = isRanked(p)
  const [num, setNum] = useState("")
  const pub = (p.metadata?.meta_published || {}) as Record<string, any>
  const commit = () => {
    const t = num.trim()
    setNum("")
    if (!t) return
    const n = Number(t)
    if (Number.isFinite(n) && n >= 1) onPlace(n)
  }
  return (
    <div
      className={`group flex h-full flex-col gap-2 rounded-xl border bg-ui-bg-base p-2.5 shadow-sm transition hover:shadow-md ${selected ? "ring-2 ring-ui-fg-interactive" : ""} ${p.status === "published" ? "" : "opacity-60"}`}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <Checkbox checked={selected} onCheckedChange={onSelect} />
          {dragHandle}
        </div>
        {ranked ? (
          <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold text-white ${home ? "bg-[#FF6000]" : "bg-ui-fg-base"}`} title={home ? "يظهر في أعلى الصفحة الرئيسية" : "ترتيبه في المتجر"}>
            {position}
          </span>
        ) : (
          <span className="text-[11px] text-ui-fg-muted">بلا ترتيب</span>
        )}
      </div>
      <button type="button" onClick={onEdit} className="relative overflow-hidden rounded-lg bg-white">
        {p.thumbnail ? (
          <img src={p.thumbnail} alt="" loading="lazy" className="aspect-square w-full object-contain transition group-hover:scale-105" />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-ui-bg-subtle text-xs text-ui-fg-muted">بلا صورة</div>
        )}
        {p.metadata?.badge && (
          <span className="absolute right-1 top-1 rounded-full bg-[#FF6000] px-2 py-0.5 text-[10px] font-bold text-white shadow">{p.metadata.badge}</span>
        )}
        {home && <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] shadow">🏠 الرئيسية</span>}
      </button>
      <button type="button" onClick={onEdit} className="text-start">
        <Text size="small" weight="plus" className="line-clamp-2" dir="auto">{p.title}</Text>
      </button>
      <div className="flex flex-wrap items-center gap-1">
        <Badge size="2xsmall" color={priceLabel(p) === "واتساب" ? "green" : "blue"}>{priceLabel(p)}</Badge>
        {p.status !== "published" && <Badge size="2xsmall" color="grey">مخفي</Badge>}
        {p.metadata?.condition === "used" && <Badge size="2xsmall" color="orange">مستخدم</Badge>}
        {(p.variants?.length || 0) > 1 && <Badge size="2xsmall">{p.variants.length} خيار</Badge>}
        {["facebook", "instagram", "ig_story", "threads", "telegram", "catalog"].some((k) => pub[k]) && <Badge size="2xsmall" color="purple">ميتا ✓</Badge>}
          {p.metadata?.autopost_priority && !["facebook", "instagram", "threads"].some((k) => pub[k]) && <Badge size="2xsmall" color="blue">🤖 تلقائي</Badge>}
      </div>
      <div className="mt-auto flex items-center gap-1">
        {ranked ? (
          <>
            <Input
              size="small"
              className="w-14"
              type="number"
              min={1}
              max={total}
              disabled={disabled}
              value={num}
              placeholder={String(position)}
              onChange={(e) => setNum(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              aria-label="رقم الترتيب"
              title="اكتب رقماً جديداً ثم Enter"
            />
            <button type="button" disabled={disabled} onClick={() => onPlace(null)} className="rounded px-1.5 text-xs text-ui-fg-muted hover:text-ui-fg-error" title="إزالة من ترتيب العرض">
              ✕
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={disabled} onClick={() => onPlace(total + 1)} className="rounded-md border px-2 py-1 text-xs hover:bg-ui-bg-subtle-hover" title="إضافة لآخر ترتيب العرض">
              ＋ ترتيب
            </button>
            <button type="button" disabled={disabled} onClick={() => onPlace(1)} className="rounded-md border px-2 py-1 text-xs hover:bg-ui-bg-subtle-hover" title="اجعله الأول">
              الأول
            </button>
          </>
        )}
        <Button size="small" variant="secondary" className="ms-auto" onClick={onEdit}>تعديل</Button>
      </div>
    </div>
  )
}

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3 py-1 text-xs ${on ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : "hover:bg-ui-bg-subtle-hover"}`}
  >
    {children}
  </button>
)

// لوحة تعديل منتج كاملة: الأساسيات وأولوية العرض، الصور، المواصفات، النشر على ميتا، الحذف
function EditDrawer({
  p,
  meta,
  currency,
  position,
  onPlace,
  onClose,
  onSaved,
  onDeleted,
  syncCatalog,
}: {
  p: Product
  meta: MetaFlags
  currency: string
  position: number | null
  onPlace: (n: number | null, latest?: Product) => void | Promise<void>
  onClose: () => void
  onSaved: (p: Product) => void
  onDeleted: () => void
  syncCatalog: (ids?: string[], remove?: boolean) => Promise<any>
}) {
  const [tab, setTab] = useState<"main" | "images" | "specs" | "meta">("main")
  const prompt = usePrompt()
  const multi = (p.variants?.length || 0) > 1
  // الأساسيات
  const [title, setTitle] = useState(p.title)
  const [published, setPublished] = useState(p.status === "published")
  const [pos, setPos] = useState(position ? String(position) : "")
  const [badge, setBadge] = useState<string>(p.metadata?.badge || "")
  const [samePrice, setSamePrice] = useState(() => {
    const a = usdOf(p.variants?.[0])?.amount
    return (p.variants || []).every((v) => usdOf(v)?.amount === a)
  })
  const [price, setPrice] = useState(() => String(usdOf(p.variants?.[0])?.amount ?? ""))
  const [vPrices, setVPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries((p.variants || []).map((v) => [v.id, String(usdOf(v)?.amount ?? "")]))
  )
  const [specs, setSpecs] = useState<Record<string, string>>(() => ({ ...(p.metadata?.specs || {}) }))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return toast.error("الاسم مطلوب")
    const wanted: Record<string, number | null> = {}
    for (const v of p.variants || []) {
      const raw = (samePrice ? price : vPrices[v.id] || "").trim()
      const n = raw === "" ? null : Number(raw)
      if (n !== null && !(n > 0)) return toast.error("سعر غير صحيح")
      wanted[v.id] = n
    }
    setSaving(true)
    try {
      const { pin: _pin, ...oldMeta } = (p.metadata || {}) as Record<string, any>
      const metadata = { ...oldMeta, badge: badge.trim().slice(0, 24), specs: cleanSpecs(specs) }
      await sdk.admin.product.update(p.id, { title: title.trim(), status: published ? "published" : "draft", metadata } as any)
      // السعر اختياري: فارغ = "السعر عبر واتساب"
      const variants = [...(p.variants || [])]
      for (const [k, v] of variants.entries()) {
        const cur = usdOf(v)
        if ((cur?.amount ?? null) === wanted[v.id]) continue
        const others = (v.prices || []).filter((x) => x.currency_code !== "usd").map((x) => ({ id: x.id, currency_code: x.currency_code, amount: x.amount }))
        const prices = wanted[v.id] === null ? others : [...others, { ...(cur?.id ? { id: cur.id } : {}), currency_code: currency || "usd", amount: wanted[v.id]! }]
        await sdk.admin.product.updateVariant(p.id, v.id, { prices } as any)
        variants[k] = { ...v, prices: prices as Price[] }
      }
      onSaved({ ...p, title: title.trim(), status: published ? "published" : "draft", metadata, variants })
      // ترتيب العرض (إن تغيّر)
      const n = pos.trim() === "" ? null : Number(pos)
      if (n !== position && (n === null || (Number.isFinite(n) && n >= 1))) await onPlace(n, { ...p, title: title.trim(), metadata, variants })
      const r = await syncCatalog([p.id], !published)
      toast.success(r && !r.ok && !r.skipped ? `حُفظ في المتجر، لكن الكتالوج: ${r.error}` : "تم الحفظ")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const ok = await prompt({
      title: "حذف المنتج",
      description: `سيُحذف «${p.title}» من المتجر ومن كتالوج ميتا نهائياً. المنشورات السابقة على فيسبوك وإنستغرام لا تُحذف. هل أنت متأكد؟`,
      confirmText: "نعم، احذف",
      cancelText: "إلغاء",
    })
    if (!ok) return
    try {
      await syncCatalog([p.id], true)
      await sdk.admin.product.delete(p.id)
      toast.success("حُذف المنتج")
      onDeleted()
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحذف")
    }
  }

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content dir="rtl" className="sm:max-w-[640px]">
        <Drawer.Header>
          <Drawer.Title className="line-clamp-1">{p.title}</Drawer.Title>
        </Drawer.Header>
        <div className="flex gap-1 border-b px-4 py-2">
          {([
            ["main", "الأساسيات والعرض"],
            ["images", `الصور (${p.images?.length || 0})`],
            ["specs", "المواصفات"],
            ["meta", "النشر على ميتا"],
          ] as const).map(([k, l]) => (
            <Chip key={k} on={tab === k} onClick={() => setTab(k)}>{l}</Chip>
          ))}
        </div>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          {tab === "main" && (
            <>
              <div className="flex flex-col gap-1">
                <Label>اسم المنتج</Label>
                <Input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>السعر بالدولار (فارغ = السعر عبر واتساب)</Label>
                  {multi && (
                    <div className="flex items-center gap-2">
                      <Switch checked={samePrice} onCheckedChange={setSamePrice} />
                      <Text size="small">سعر واحد لكل الخيارات</Text>
                    </div>
                  )}
                </div>
                {!multi || samePrice ? (
                  <Input type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="واتساب" />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {p.variants.map((v) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <Text size="small" className="min-w-0 flex-1 truncate">{v.title}</Text>
                        <Input className="w-28" type="number" min="0" step="0.01" value={vPrices[v.id] || ""} onChange={(e) => setVPrices({ ...vPrices, [v.id]: e.target.value })} placeholder="واتساب" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <Text weight="plus">أولوية العرض</Text>
                <div className="flex items-center gap-2">
                  <Switch checked={published} onCheckedChange={setPublished} />
                  <Text size="small">{published ? "ظاهر في المتجر" : "مخفي من المتجر"}</Text>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label size="small">رقم ترتيب العرض</Label>
                  <Input className="w-20" type="number" min={1} value={pos} onChange={(e) => setPos(e.target.value)} placeholder="بلا" />
                  <Text size="xsmall" className="text-ui-fg-subtle">1 = أول منتج في المتجر. فارغ = بعد المرتّبة (الأحدث أولاً). أول {HOME_COUNT} تظهر في الرئيسية.</Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Label size="small">شارة العرض على الصورة (اختياري)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {BADGES.map((b) => (
                      <Chip key={b} on={badge === b} onClick={() => setBadge(badge === b ? "" : b)}>{b}</Chip>
                    ))}
                  </div>
                  <Input dir="auto" maxLength={24} value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="أو اكتب شارتك، مثل: خصم 10%" />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a className="text-ui-fg-interactive underline" href={STORE + encodeURIComponent(p.handle)} target="_blank" rel="noreferrer">عرض في المتجر</a>
                <a className="text-ui-fg-interactive underline" href={`/app/products/${p.id}`}>صفحة Medusa الكاملة (الخيارات والمخزون)</a>
                <button type="button" className="text-ui-fg-error underline" onClick={remove}>حذف المنتج</button>
              </div>
            </>
          )}
          {tab === "specs" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {SPEC_FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-0.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">{f.label}</Label>
                  <Textarea dir="auto" rows={2} value={specs[f.key] || ""} onChange={(e) => setSpecs({ ...specs, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
          )}
          {tab === "images" && <ImagesEditor p={p} onSaved={onSaved} />}
          {tab === "meta" && <MetaPublish p={p} meta={meta} onSaved={onSaved} />}
        </Drawer.Body>
        {(tab === "main" || tab === "specs") && (
          <Drawer.Footer>
            <Button variant="secondary" onClick={onClose}>إغلاق</Button>
            <Button isLoading={saving} onClick={save}>حفظ</Button>
          </Drawer.Footer>
        )}
      </Drawer.Content>
    </Drawer>
  )
}

function MetaPublish({ p, meta, onSaved }: { p: Product; meta: MetaFlags; onSaved: (p: Product) => void }) {
  const [toFb, setToFb] = useState(Boolean(meta.page_id))
  const [toIg, setToIg] = useState(Boolean(meta.page_id))
  const [toCat, setToCat] = useState(Boolean(meta.catalog_id))
  const [toStory, setToStory] = useState(false)
  const [toThreads, setToThreads] = useState(Boolean(meta.threads_has_token))
  const [toTg, setToTg] = useState(false)
  const [when, setWhen] = useState<When>(NOW)
  const [text, setText] = useState("")
  const [tags, setTags] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<Record<string, PublishResult> | null>(null)
  const [auto, setAuto] = useState("")
  const [preview, setPreview] = useState<({ caption: string; ig_caption?: string; threads?: string } & StyleInfo) | null>(null)
  const [style, setStyle] = useState<string>("")
  const [hook, setHook] = useState<string | undefined>(undefined)
  const [net, setNet] = useState<"caption" | "ig_caption" | "threads">("caption")
  const pub = (p.metadata?.meta_published || {}) as Record<string, { at: string; url?: string }>

  // المنشور جاهز من بيانات المنتج (المواصفات والشارة والقسم والسعر) مع هاشتاقات مقترحة، ويمكن تعديله قبل النشر
  useEffect(() => {
    sdk.client
      .fetch<{ auto_text: string; suggested: string[] }>("/admin/quick-add/preview", { method: "POST", body: { product_id: p.id } })
      .then((r) => {
        setAuto(r.auto_text)
        setText(r.auto_text)
        setTags(r.suggested.join(" "))
      })
      .catch(() => {})
  }, [p.id])
  useEffect(() => {
    const t = setTimeout(() => {
      sdk.client
        .fetch<{ caption: string; ig_caption?: string; threads?: string } & StyleInfo>("/admin/quick-add/preview", {
          method: "POST",
          body: { product_id: p.id, text, style: style || undefined, hook, hashtags: tags },
        })
        .then(setPreview)
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [p.id, text, style, hook, tags])

  if (!meta.has_token && !meta.threads_has_token && !meta.telegram_ready) return <Text size="small">ميتا غير مربوطة. <a className="underline" href="/app/meta-connect">اربطها من هنا</a>.</Text>

  const publish = async () => {
    if (when.mode === "at" && !when.at) return toast.error("اختر وقت النشر")
    setPublishing(true)
    try {
      const r = await sdk.client.fetch<{ results?: Record<string, PublishResult>; scheduled?: { at: string }; autopost?: boolean }>("/admin/quick-add/publish", {
        method: "POST",
        body: { product_id: p.id, facebook: toFb, instagram: toIg, ig_story: toStory, threads: toThreads, telegram: toTg, catalog: toCat, text, hashtags: tags, style: preview?.style, hook: hook ?? preview?.hook, ...whenBody(when) },
      })
      if (r.scheduled) {
        toast.success(`جُدول النشر: ${new Date(r.scheduled.at).toLocaleString("ar")}`)
        return
      }
      if (r.autopost) {
        toast.success("أُضيف لأول قائمة النشر التلقائي")
        onSaved({ ...p, metadata: { ...(p.metadata || {}), autopost_priority: new Date().toISOString() } })
        return
      }
      if (!r.results) return
      setResults(r.results)
      const failed = Object.values(r.results).filter((x) => !x.ok && !x.skipped).length
      failed ? toast.warning("نُشر جزئياً، راجع النتائج") : toast.success("تم النشر على ميتا")
      const next = { ...pub }
      for (const [k, v] of Object.entries(r.results!)) if (v.ok) next[k] = { at: new Date().toISOString(), url: v.url }
      onSaved({ ...p, metadata: { ...(p.metadata || {}), meta_published: next } })
    } catch (e: any) {
      toast.error(e?.message || "فشل النشر")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {Object.keys(pub).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(pub).map(([k, v]) => (
            <a key={k} href={v.url || undefined} target="_blank" rel="noreferrer">
              <Badge size="2xsmall" color="green">{NAMES[k] || k} ✓ {new Date(v.at).toLocaleDateString("ar")}</Badge>
            </a>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {([["فيسبوك", toFb, setToFb, meta.has_token && meta.page_id], ["إنستغرام (منشور)", toIg, setToIg, meta.has_token && meta.page_id], ["قصة إنستغرام", toStory, setToStory, meta.has_token && meta.page_id], ["Threads", toThreads, setToThreads, meta.threads_has_token], ["تيليجرام", toTg, setToTg, meta.telegram_ready], ["الكتالوج + واتساب", toCat, setToCat, meta.has_token && meta.catalog_id]] as any[]).map(([l, v, set, ok]) => (
          <div key={l} className="flex items-center gap-2">
            <Switch disabled={!ok} checked={Boolean(v && ok)} onCheckedChange={set} />
            <Label size="small">{l}</Label>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ui-bg-subtle px-3 py-2">
        <Text size="small">🎨 تريد صوراً أو تصميماً جديداً لهذا المنتج؟</Text>
        <a className="text-sm font-medium text-ui-fg-interactive underline" href={`/app/quick-add?tab=post&product=${p.id}`}>افتحه في الاستوديو الإبداعي ←</a>
      </div>
      <StylePicker info={preview} hook={hook} onStyle={(s) => (setStyle(s), setHook(undefined))} onHook={setHook} />
      <div className="flex items-center justify-between gap-2">
        <Label size="small">نص المنشور (جاهز من بيانات المنتج، عدّله إن شئت)</Label>
        {auto && text !== auto && (
          <button type="button" className="text-xs text-ui-fg-interactive hover:underline" onClick={() => setText(auto)}>إرجاع النص الجاهز</button>
        )}
      </div>
      <Textarea dir="auto" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="نص المنشور" />
      <Input dir="auto" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="هاشتاقات (تُنشر كأول تعليق): #سامسونج #صنعاء" />
      {preview && (
        <details className="rounded-lg border p-2" open>
          <summary className="cursor-pointer text-sm font-medium">معاينة المنشور</summary>
          <div className="mt-2 flex gap-1">
            {([["caption", "فيسبوك وتيليجرام"], ["ig_caption", "إنستغرام"], ["threads", "Threads"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setNet(k)} className={`rounded-full border px-2.5 py-0.5 text-xs ${net === k ? "border-ui-fg-interactive bg-ui-bg-interactive text-ui-fg-on-color" : ""}`}>
                {l}
              </button>
            ))}
          </div>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-ui-bg-subtle p-2 font-sans text-sm" dir="auto">{(preview as any)[net] || preview.caption}</pre>
        </details>
      )}
      <WhenPicker value={when} onChange={setWhen} allowAuto />
      <Button className="self-start" isLoading={publishing} disabled={(when.mode !== "auto" && !(toFb || toIg || toStory || toThreads || toTg || toCat)) || p.status !== "published"} onClick={publish}>{whenLabel(when)}</Button>
      {toStory && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          القصة تُنشر بأول صورة للمنتج (أو الفيديو) بلا نص، وتبقى 24 ساعة. لتبقى دائماً: افتحها في تطبيق إنستغرام ← «تمييز» (Highlight) ← اختر «أبرز القصص». إنستغرام لا يسمح بإضافتها لأبرز القصص من خارج التطبيق.
        </Text>
      )}
      {p.status !== "published" && <Text size="xsmall" className="text-ui-fg-subtle">أظهر المنتج في المتجر أولاً حتى يُنشر.</Text>}
      {results &&
        Object.entries(results).map(([k, r]) =>
          r.skipped ? null : (
            <Text key={k} size="small">
              {NAMES[k] || k}: {r.ok ? (r.url ? <a className="underline" href={r.url} target="_blank" rel="noreferrer">تم ✓</a> : "تم ✓") : <span className="text-ui-fg-error">{r.error}</span>}
              {r.comment_error && <span className="block text-ui-fg-subtle">{r.comment_error}</span>}
            </Text>
          )
        )}
    </div>
  )
}

// تعديل صور منتج موجود: اختيار الرئيسية، الترتيب، الحذف، والإضافة، ثم حفظ وتحديث فوري
type EditImg = { url?: string; file?: ProcessedImage; preview: string }
function ImagesEditor({ p, onSaved }: { p: Product; onSaved: (p: Product) => void }) {
  const start = (): EditImg[] => {
    const list = (p.images || []).map((i) => i.url)
    // الصورة الرئيسية الحالية أولاً
    if (p.thumbnail && list.includes(p.thumbnail)) list.splice(list.indexOf(p.thumbnail), 1), list.unshift(p.thumbnail)
    return list.map((url) => ({ url, preview: url }))
  }
  const [imgs, setImgs] = useState<EditImg[]>(start)
  const [adding, setAdding] = useState(0)
  const [saving, setSaving] = useState(false)
  const changed = JSON.stringify(imgs.map((i) => i.url || i.preview)) !== JSON.stringify(start().map((i) => i.url))

  const add = async (files: FileList | null) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif|avif|webp|jpe?g|png)$/i.test(f.name)).slice(0, Math.max(0, 20 - imgs.length))
    setAdding((n) => n + list.length)
    for (const f of list) {
      try {
        const file = await processImage(f, { mode: "contain", autoTrim: true, background: "auto", brand: false, storeBrand: false })
        setImgs((xs) => [...xs, { file, preview: file.preview }])
      } catch {
        toast.error(`تعذّر قراءة الصورة ${f.name}`)
      } finally {
        setAdding((n) => n - 1)
      }
    }
  }
  const move = (i: number, d: number) =>
    setImgs((xs) => {
      const j = i + d
      if (j < 0 || j >= xs.length) return xs
      const c = [...xs]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  const save = async () => {
    if (!imgs.length) return toast.error("اترك صورة واحدة على الأقل")
    setSaving(true)
    try {
      const urls: string[] = []
      for (const i of imgs) {
        if (i.url) urls.push(i.url)
        else {
          // صورة في كل طلب (حد الخادم 1MB)
          const r = await sdk.admin.upload.create({ files: [i.file!.webp] })
          urls.push((r.files[0] as any).url)
        }
      }
      await sdk.admin.product.update(p.id, { thumbnail: urls[0], images: urls.map((url) => ({ url })) } as any)
      const { product } = await sdk.admin.product.retrieve(p.id, { fields: "id,thumbnail,images.id,images.url" } as any)
      onSaved({ ...p, thumbnail: (product as any).thumbnail, images: (product as any).images })
      toast.success("حُفظت الصور وتحدّث المتجر")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر حفظ الصور")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {imgs.map((img, i) => (
          <div key={img.preview + i} className={`relative overflow-hidden rounded-md border bg-white ${i === 0 ? "ring-2 ring-ui-fg-interactive" : ""}`}>
            <img src={img.preview} alt="" loading="lazy" className="aspect-square w-full object-contain" />
            {i === 0 && <Badge size="2xsmall" color="blue" className="absolute top-1 right-1">الرئيسية</Badge>}
            {!img.url && <Badge size="2xsmall" color="orange" className="absolute top-1 left-1">جديدة</Badge>}
            <div className="flex justify-between border-t px-1 py-0.5 text-[13px]">
              {i > 0 ? <button type="button" title="اجعلها الرئيسية" onClick={() => setImgs((xs) => [xs[i], ...xs.filter((_, k) => k !== i)])}>★</button> : <span />}
              <span className="flex gap-1.5">
                <button type="button" onClick={() => move(i, -1)} aria-label="تقديم">→</button>
                <button type="button" onClick={() => move(i, 1)} aria-label="تأخير">←</button>
                <button type="button" className="text-ui-fg-error" onClick={() => setImgs((xs) => xs.filter((_, k) => k !== i))} aria-label="حذف">✕</button>
              </span>
            </div>
          </div>
        ))}
        <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-center text-xs hover:bg-ui-bg-base">
          {adding ? `جارٍ التجهيز ${adding}…` : "+ إضافة صور"}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button size="small" isLoading={saving} disabled={!changed || adding > 0} onClick={save}>حفظ الصور</Button>
        <Text size="xsmall" className="text-ui-fg-subtle">★ تجعل الصورة رئيسية (تظهر أولاً في المتجر). الحفظ يحدّث المتجر مباشرة.</Text>
      </div>
    </div>
  )
}
