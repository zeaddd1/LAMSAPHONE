import { Badge, Button, Input, Label, Switch, Text, Textarea, toast, usePrompt } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { sdk } from "../lib/sdk"

// تبويب "المنتجات" في الإضافة السريعة: كل منتجات المتجر (القديمة والجديدة) في قائمة واحدة.
// تعديل الاسم والسعر والحالة، الترتيب، الحذف، والنشر على ميتا لأي منتج. كله عبر واجهات Medusa الرسمية.

type Price = { id?: string; amount: number; currency_code: string }
type Product = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  status: string
  created_at: string
  metadata: Record<string, any> | null
  variants: { id: string; prices?: Price[] }[]
  categories?: { name: string }[]
}
type MetaFlags = { has_token: boolean; page_id: string; catalog_id: string }
type PublishResult = { ok: boolean; url?: string; error?: string; skipped?: boolean; comment_error?: string }

const STORE = "https://lamsaphone.yemenbay.com/ye/products/"
const usd = (p: Product) => p.variants?.[0]?.prices?.find((x) => x.currency_code === "usd")
const rankOf = (p: Product) => {
  const r = p.metadata?.rank
  return r === null || r === undefined || r === "" || !Number.isFinite(Number(r)) ? Infinity : Number(r)
}
const NAMES: Record<string, string> = { facebook: "فيسبوك", instagram: "إنستغرام", catalog: "الكتالوج", all: "ميتا" }

export default function QuickAddProducts({ meta, currency }: { meta: MetaFlags; currency: string }) {
  const [items, setItems] = useState<Product[] | null>(null)
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const prompt = usePrompt()

  const load = async () => {
    try {
      const r = await sdk.admin.product.list({
        limit: 200,
        order: "-created_at",
        fields: "id,title,handle,thumbnail,status,created_at,metadata,variants.id,variants.prices.id,variants.prices.amount,variants.prices.currency_code,categories.name",
      } as any)
      setItems(r.products as any)
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تحميل المنتجات")
    }
  }
  useEffect(() => {
    load()
  }, [])

  const sorted = useMemo(() => {
    const list = [...(items || [])].sort((a, b) => rankOf(a) - rankOf(b) || +new Date(b.created_at) - +new Date(a.created_at))
    const s = q.trim().toLowerCase()
    return s ? list.filter((p) => p.title.toLowerCase().includes(s) || (p.categories || []).some((c) => c.name.includes(q.trim()))) : list
  }, [items, q])

  const syncCatalog = async (ids?: string[], remove = false) => {
    if (!meta.has_token || !meta.catalog_id) return null
    return sdk.client
      .fetch<{ ok: boolean; error?: string; updated?: number }>("/admin/quick-add/catalog", { method: "POST", body: { product_ids: ids, remove } })
      .catch((e) => ({ ok: false, error: String(e?.message || e) } as any))
  }

  const syncAll = async () => {
    setBusy("sync")
    const r = await syncCatalog()
    setBusy("")
    if (!r) toast.info("الكتالوج غير مربوط")
    else r.ok ? toast.success(`حُدّث الكتالوج: ${r.updated} عنصر`) : toast.error(r.error || "فشل تحديث الكتالوج")
  }

  // حفظ ترتيب جديد: نرقّم القائمة كلها حتى يثبت الترتيب في المتجر
  const move = async (id: string, d: number) => {
    if (!items || q.trim()) return
    const list = [...sorted]
    const i = list.findIndex((p) => p.id === id)
    const j = i + d
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    setBusy("order")
    try {
      const changed = list.map((p, k) => ({ p, rank: k })).filter(({ p, rank }) => rankOf(p) !== rank)
      for (const { p, rank } of changed) {
        await sdk.admin.product.update(p.id, { metadata: { ...(p.metadata || {}), rank } } as any)
      }
      setItems(list.map((p, k) => ({ ...p, metadata: { ...(p.metadata || {}), rank: k } })))
    } catch (e: any) {
      toast.error(e?.message || "تعذّر حفظ الترتيب")
      load()
    } finally {
      setBusy("")
    }
  }

  const remove = async (p: Product) => {
    const ok = await prompt({
      title: "حذف المنتج",
      description: `سيُحذف «${p.title}» من المتجر ومن كتالوج ميتا نهائياً. المنشورات السابقة على فيسبوك وإنستغرام لا تُحذف. هل أنت متأكد؟`,
      confirmText: "نعم، احذف",
      cancelText: "إلغاء",
    })
    if (!ok) return
    setBusy(p.id)
    try {
      await syncCatalog([p.id], true)
      await sdk.admin.product.delete(p.id)
      setItems((xs) => (xs || []).filter((x) => x.id !== p.id))
      toast.success("حُذف المنتج")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحذف")
    } finally {
      setBusy("")
    }
  }

  if (items === null) return <Text className="p-6">جارٍ التحميل…</Text>

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="min-w-0 flex-1" dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المنتج أو القسم" />
        <Button variant="secondary" isLoading={busy === "sync"} onClick={syncAll} disabled={!meta.has_token || !meta.catalog_id}>
          تحديث كتالوج ميتا الآن
        </Button>
      </div>
      <Text size="xsmall" className="text-ui-fg-subtle">
        {sorted.length} منتج. الأسهم تغيّر ترتيب الظهور في صفحة المتجر{q.trim() ? " (ألغِ البحث لتغيير الترتيب)" : ""}. أي تعديل في السعر يُرسل لكتالوج ميتا فوراً.
      </Text>
      {!sorted.length && <Text className="text-ui-fg-subtle">لا توجد منتجات.</Text>}
      {sorted.map((p, i) => (
        <Row
          key={p.id}
          p={p}
          meta={meta}
          currency={currency}
          busy={busy === p.id || busy === "order"}
          isOpen={open === p.id}
          onToggle={() => setOpen(open === p.id ? null : p.id)}
          canUp={!q.trim() && i > 0}
          canDown={!q.trim() && i < sorted.length - 1}
          onMove={(d) => move(p.id, d)}
          onDelete={() => remove(p)}
          onSaved={(np) => setItems((xs) => (xs || []).map((x) => (x.id === np.id ? np : x)))}
          syncCatalog={syncCatalog}
        />
      ))}
    </div>
  )
}

function Row({
  p,
  meta,
  currency,
  busy,
  isOpen,
  onToggle,
  canUp,
  canDown,
  onMove,
  onDelete,
  onSaved,
  syncCatalog,
}: {
  p: Product
  meta: MetaFlags
  currency: string
  busy: boolean
  isOpen: boolean
  onToggle: () => void
  canUp: boolean
  canDown: boolean
  onMove: (d: number) => void
  onDelete: () => void
  onSaved: (p: Product) => void
  syncCatalog: (ids?: string[], remove?: boolean) => Promise<any>
}) {
  const price0 = usd(p)
  const [title, setTitle] = useState(p.title)
  const [price, setPrice] = useState(price0 ? String(price0.amount) : "")
  const [published, setPublished] = useState(p.status === "published")
  const [saving, setSaving] = useState(false)
  // النشر على ميتا
  const [toFb, setToFb] = useState(Boolean(meta.page_id))
  const [toIg, setToIg] = useState(Boolean(meta.page_id))
  const [toCat, setToCat] = useState(Boolean(meta.catalog_id))
  const [text, setText] = useState("")
  const [tags, setTags] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<Record<string, PublishResult> | null>(null)

  const dirty = title.trim() !== p.title || Number(price) !== Number(price0?.amount ?? NaN) || published !== (p.status === "published")
  const pub = (p.metadata?.meta_published || {}) as Record<string, { at: string; url?: string }>

  const save = async () => {
    const amount = Number(price)
    if (!title.trim() || !(amount > 0)) {
      toast.error("الاسم والسعر مطلوبان")
      return
    }
    setSaving(true)
    try {
      if (title.trim() !== p.title || published !== (p.status === "published")) {
        await sdk.admin.product.update(p.id, { title: title.trim(), status: published ? "published" : "draft" } as any)
      }
      const v = p.variants?.[0]
      if (v && amount !== Number(price0?.amount ?? NaN)) {
        const others = (v.prices || []).filter((x) => x.currency_code !== "usd").map((x) => ({ id: x.id, currency_code: x.currency_code, amount: x.amount }))
        await sdk.admin.product.updateVariant(p.id, v.id, {
          prices: [...others, { ...(price0?.id ? { id: price0.id } : {}), currency_code: currency || "usd", amount }],
        } as any)
      }
      const np: Product = {
        ...p,
        title: title.trim(),
        status: published ? "published" : "draft",
        variants: p.variants.map((x, k) => (k === 0 ? { ...x, prices: [...(x.prices || []).filter((y) => y.currency_code !== "usd"), { ...(price0 || {}), currency_code: "usd", amount }] } : x)),
      }
      onSaved(np)
      // الكتالوج: تحديث إن كان منشوراً، وحذف إن صار مسودة
      const r = await syncCatalog([p.id], !published)
      toast.success(r && !r.ok && !r.skipped ? `حُفظ في المتجر، لكن الكتالوج: ${r.error}` : "تم الحفظ")
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    setPublishing(true)
    try {
      const r = await sdk.client.fetch<{ results: Record<string, PublishResult> }>("/admin/quick-add/publish", {
        method: "POST",
        body: { product_id: p.id, facebook: toFb, instagram: toIg, catalog: toCat, text, hashtags: tags },
      })
      setResults(r.results)
      const failed = Object.values(r.results).filter((x) => !x.ok && !x.skipped).length
      failed ? toast.warning("نُشر جزئياً، راجع النتائج") : toast.success("تم النشر على ميتا")
      const next = { ...pub }
      for (const [k, v] of Object.entries(r.results)) if (v.ok) next[k] = { at: new Date().toISOString(), url: v.url }
      onSaved({ ...p, metadata: { ...(p.metadata || {}), meta_published: next } })
    } catch (e: any) {
      toast.error(e?.message || "فشل النشر")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className={`rounded-lg border ${p.status === "published" ? "" : "opacity-70"}`}>
      <div className="flex items-start gap-3 p-3">
        <div className="flex shrink-0 flex-col items-center gap-1">
          {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-16 w-14 rounded object-cover" /> : <div className="h-16 w-14 rounded bg-ui-bg-subtle" />}
          <div className="flex gap-1 text-sm">
            <button type="button" disabled={!canUp || busy} onClick={() => onMove(-1)} className="disabled:opacity-30" aria-label="تقديم">▲</button>
            <button type="button" disabled={!canDown || busy} onClick={() => onMove(1)} className="disabled:opacity-30" aria-label="تأخير">▼</button>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="اسم المنتج" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Input className="w-24" type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="السعر بالدولار" />
              <Text size="small">$</Text>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={published} onCheckedChange={setPublished} />
              <Text size="small">{published ? "ظاهر في المتجر" : "مخفي"}</Text>
            </div>
            {dirty && <Button size="small" isLoading={saving} onClick={save}>حفظ</Button>}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(p.categories || []).slice(0, 2).map((c) => <Badge key={c.name} size="2xsmall" color="grey">{c.name}</Badge>)}
            {p.metadata?.condition === "used" && <Badge size="2xsmall" color="orange">مستخدم</Badge>}
            {["facebook", "instagram", "catalog"].map((k) =>
              pub[k] ? (
                <a key={k} href={pub[k].url || undefined} target="_blank" rel="noreferrer">
                  <Badge size="2xsmall" color="green">{NAMES[k]} ✓</Badge>
                </a>
              ) : null
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <button type="button" className="text-ui-fg-interactive underline" onClick={onToggle}>{isOpen ? "إغلاق" : "نشر على ميتا"}</button>
            <a className="text-ui-fg-interactive underline" href={STORE + encodeURIComponent(p.handle)} target="_blank" rel="noreferrer">عرض</a>
            <a className="text-ui-fg-interactive underline" href={`/app/products/${p.id}`}>تعديل كامل</a>
            <button type="button" className="text-ui-fg-error underline" disabled={busy} onClick={onDelete}>حذف</button>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="flex flex-col gap-3 border-t bg-ui-bg-subtle p-3">
          {!meta.has_token ? (
            <Text size="small">ميتا غير مربوطة. <a className="underline" href="/app/meta-connect">اربطها من هنا</a>.</Text>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {([["فيسبوك", toFb, setToFb, meta.page_id], ["إنستغرام", toIg, setToIg, meta.page_id], ["الكتالوج + واتساب", toCat, setToCat, meta.catalog_id]] as any[]).map(([l, v, set, ok]) => (
                  <div key={l} className="flex items-center gap-2">
                    <Switch disabled={!ok} checked={Boolean(v && ok)} onCheckedChange={set} />
                    <Label size="small">{l}</Label>
                  </div>
                ))}
              </div>
              <Textarea dir="auto" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="نص المنشور (اختياري)" />
              <Input dir="auto" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="هاشتاقات (تُنشر كأول تعليق): #سامسونج #صنعاء" />
              <Button className="self-start" isLoading={publishing} disabled={!(toFb || toIg || toCat) || p.status !== "published"} onClick={publish}>
                نشر الآن
              </Button>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
