import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"

// صفحة "واجهة المتجر": الإعلانات أعلى الصفحة الرئيسية والمنتجات المميزة، تُحفظ في بيانات المتجر (metadata) بلا أي تعديل على قاعدة البيانات.

type Banner = { id: string; active: boolean; badge: string; title: string; subtitle: string; cta: string; link: string; image: string; theme: string }
type Cfg = { banners: Banner[]; featured: string[]; featured_title: string }
type P = { id: string; title: string; handle: string; thumbnail?: string | null }

const THEMES = [
  { v: "navy", l: "كحلي (هوية المتجر)" },
  { v: "orange", l: "برتقالي" },
  { v: "dark", l: "داكن" },
  { v: "light", l: "فاتح" },
]
const newBanner = (): Banner => ({ id: `b${Date.now().toString(36)}`, active: true, badge: "عرض خاص", title: "", subtitle: "", cta: "اطلب الآن", link: "/store", image: "", theme: "navy" })

const ProductPicker = ({ onPick, placeholder }: { onPick: (p: P) => void; placeholder: string }) => {
  const [q, setQ] = useState("")
  const [res, setRes] = useState<P[]>([])
  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) return setRes([])
      sdk.admin.product
        .list({ q, limit: 8, fields: "id,title,handle,thumbnail" } as any)
        .then((r: any) => setRes(r.products))
        .catch(() => setRes([]))
    }, 300)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="relative">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      {res.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-ui-bg-base shadow-lg">
          {res.map((p) => (
            <button key={p.id} type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-start hover:bg-ui-bg-subtle" onClick={() => (onPick(p), setQ(""), setRes([]))}>
              {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-8 w-8 rounded object-contain bg-white" /> : <span className="h-8 w-8 rounded bg-ui-bg-subtle" />}
              <span className="text-sm">{p.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const BannerPreview = ({ b }: { b: Banner }) => {
  const bg = { navy: "#14213d", orange: "#ff6000", dark: "#111111", light: "#f4f4f5" }[b.theme] || "#14213d"
  const fg = b.theme === "light" ? "#14213d" : "#ffffff"
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-lg p-4" style={{ background: bg, color: fg }} dir="rtl">
      <div className="flex-1">
        {b.badge && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{b.badge}</span>}
        <div className="mt-1 text-lg font-bold">{b.title || "عنوان الإعلان"}</div>
        <div className="text-xs opacity-80">{b.subtitle}</div>
        {b.cta && <span className="mt-2 inline-block rounded bg-[#ff6000] px-3 py-1 text-xs font-bold text-white">{b.cta}</span>}
      </div>
      {b.image && <img src={b.image} alt="" className="h-24 w-24 rounded bg-white object-contain" />}
    </div>
  )
}

const StorefrontHomePage = () => {
  const [storeId, setStoreId] = useState("")
  const [meta, setMeta] = useState<Record<string, any>>({})
  const [cfg, setCfg] = useState<Cfg>({ banners: [], featured: [], featured_title: "" })
  const [featuredInfo, setFeaturedInfo] = useState<Record<string, P>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    sdk.admin.store
      .list({ fields: "id,metadata" } as any)
      .then(async (r: any) => {
        const s = r.stores?.[0]
        if (!s) return
        setStoreId(s.id)
        setMeta(s.metadata || {})
        const h = s.metadata?.lamsa_home || {}
        const c: Cfg = { banners: h.banners || [], featured: h.featured || [], featured_title: h.featured_title || "" }
        setCfg(c)
        if (c.featured.length) {
          const pr: any = await sdk.admin.product.list({ id: c.featured, limit: 50, fields: "id,title,handle,thumbnail" } as any)
          setFeaturedInfo(Object.fromEntries(pr.products.map((p: P) => [p.id, p])))
        }
      })
      .catch((e) => toast.error(String(e?.message || e)))
  }, [])

  const update = (f: (c: Cfg) => Cfg) => (setCfg(f), setDirty(true))
  const setBanner = (i: number, patch: Partial<Banner>) => update((c) => ({ ...c, banners: c.banners.map((b, k) => (k === i ? { ...b, ...patch } : b)) }))
  const move = <T,>(xs: T[], i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= xs.length) return xs
    const c = [...xs]
    ;[c[i], c[j]] = [c[j], c[i]]
    return c
  }

  const save = async () => {
    setSaving(true)
    try {
      const lamsa_home = { ...cfg, banners: cfg.banners.filter((b) => b.title.trim()) }
      await sdk.admin.store.update(storeId, { metadata: { ...meta, lamsa_home } } as any)
      setMeta((m) => ({ ...m, lamsa_home }))
      setDirty(false)
      toast.success("حُفظت واجهة المتجر، وتظهر للزبائن خلال دقيقة")
    } catch (e: any) {
      toast.error(String(e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  const featured = useMemo(() => cfg.featured.map((id) => featuredInfo[id] || { id, title: id, handle: "" }), [cfg.featured, featuredInfo])

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading>واجهة المتجر</Heading>
          <Text size="small" className="text-ui-fg-subtle">الإعلانات أعلى الصفحة الرئيسية والمنتجات المميزة. أي تعديل يظهر للزبائن بعد الحفظ خلال دقيقة.</Text>
        </div>
        <Button onClick={save} isLoading={saving} disabled={!dirty || !storeId}>حفظ التغييرات</Button>
      </Container>

      <Container className="flex flex-col gap-4 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2">الإعلانات (شريط متحرك)</Heading>
            <Text size="small" className="text-ui-fg-subtle">حتى 8 إعلانات. اختر منتجاً فتؤخذ صورته ورابطه تلقائياً، ثم عدّل النصوص. بلا إعلانات يظهر الشريط الافتراضي.</Text>
          </div>
          <Button variant="secondary" size="small" disabled={cfg.banners.length >= 8} onClick={() => update((c) => ({ ...c, banners: [...c.banners, newBanner()] }))}>
            + إعلان جديد
          </Button>
        </div>
        {cfg.banners.map((b, i) => (
          <div key={b.id} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Badge size="2xsmall">{i + 1}</Badge>
                <div className="flex items-center gap-2">
                  <Switch checked={b.active} onCheckedChange={(v) => setBanner(i, { active: v })} />
                  <Label size="small">{b.active ? "ظاهر" : "مخفي"}</Label>
                </div>
                <div className="ms-auto flex gap-1">
                  <Button variant="transparent" size="small" onClick={() => update((c) => ({ ...c, banners: move(c.banners, i, -1) }))}>↑</Button>
                  <Button variant="transparent" size="small" onClick={() => update((c) => ({ ...c, banners: move(c.banners, i, 1) }))}>↓</Button>
                  <Button variant="transparent" size="small" className="text-ui-fg-error" onClick={() => update((c) => ({ ...c, banners: c.banners.filter((_, k) => k !== i) }))}>حذف</Button>
                </div>
              </div>
              <ProductPicker placeholder="اختر منتجاً للإعلان (ابحث بالاسم)…" onPick={(p) => setBanner(i, { image: p.thumbnail || b.image, link: `/products/${p.handle}`, title: b.title || p.title })} />
              <div className="grid grid-cols-2 gap-2">
                <Input value={b.badge} onChange={(e) => setBanner(i, { badge: e.target.value })} placeholder="الشارة (مثل: عرض خاص)" />
                <Select value={b.theme} onValueChange={(v) => setBanner(i, { theme: v })}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>{THEMES.map((t) => <Select.Item key={t.v} value={t.v}>{t.l}</Select.Item>)}</Select.Content>
                </Select>
              </div>
              <Input value={b.title} onChange={(e) => setBanner(i, { title: e.target.value })} placeholder="العنوان *" />
              <Textarea rows={2} value={b.subtitle} onChange={(e) => setBanner(i, { subtitle: e.target.value })} placeholder="الوصف المختصر" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={b.cta} onChange={(e) => setBanner(i, { cta: e.target.value })} placeholder="نص الزر" />
                <Input value={b.link} onChange={(e) => setBanner(i, { link: e.target.value })} placeholder="/products/... أو /store" dir="ltr" />
              </div>
              <Input value={b.image} onChange={(e) => setBanner(i, { image: e.target.value })} placeholder="رابط الصورة (يُملأ من المنتج)" dir="ltr" />
            </div>
            <BannerPreview b={b} />
          </div>
        ))}
      </Container>

      <Container className="flex flex-col gap-3 px-6 py-4">
        <Heading level="h2">العروض والمنتجات المميزة</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          تظهر بعد الإعلانات: أول 8 منتجات في «ترتيب العرض» (1، 2، 3…) من «إضافة سريعة ← المنتجات». نفس الترتيب يجعلها أول ما يظهر في المتجر وفي أقسامها.
        </Text>
        <Input value={cfg.featured_title} onChange={(e) => update((c) => ({ ...c, featured_title: e.target.value }))} placeholder="عنوان القسم (افتراضي: عروض ومنتجات مميزة)" />
        <a href="/app/quick-add#list" className="self-start text-sm text-ui-fg-interactive underline">إدارة ترتيب العرض ←</a>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "واجهة المتجر", icon: BuildingStorefront })
export default StorefrontHomePage
