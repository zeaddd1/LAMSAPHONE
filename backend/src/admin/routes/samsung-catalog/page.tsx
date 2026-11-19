import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Phone } from "@medusajs/icons"
import { Badge, Button, Checkbox, Container, Heading, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"
import { CATALOG, CatalogModel, STORE_ORIGIN, productPayload, refreshPayload, storageLabel } from "../../lib/samsung-catalog"

// صفحة "موديلات سامسونج": نشر موديلات جالاكسي S (من S9 إلى S26) في المتجر فقط (بلا فيسبوك ولا إنستغرام).
// كل موديل: اسم عربي، مواصفات كاملة، السعات والألوان كخيارات، والصور الرسمية. المنتج يُنشر بلا سعر
// فيظهر "السعر عبر واتساب" حتى تضيف السعر من صفحة المنتج.

type Existing = Record<string, { id: string; metadata?: Record<string, any> | null }>
type Ctx = { categories: { id: string; name: string }[]; default_sales_channel_id: string | null; shipping_profile_id: string | null }

// للتجربة المحلية فقط: يمكن تغيير مصدر الصور من المتصفح
const origin = () => {
  try {
    return localStorage.getItem("lp-store-origin") || STORE_ORIGIN
  } catch {
    return STORE_ORIGIN
  }
}

const SamsungCatalogPage = () => {
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [existing, setExisting] = useState<Existing>({})
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState("")
  const [log, setLog] = useState<string[]>([])

  const loadExisting = async () => {
    const r: any = await sdk.admin.product.list({ handle: CATALOG.map((m) => m.handle), limit: 100, fields: "id,handle,metadata" } as any)
    setExisting(Object.fromEntries(r.products.map((p: any) => [p.handle, { id: p.id, metadata: p.metadata }])))
  }
  useEffect(() => {
    sdk.client.fetch<Ctx>("/admin/quick-add/context").then(setCtx).catch((e) => toast.error(String(e?.message || e)))
    loadExisting().catch((e) => toast.error(String(e?.message || e)))
  }, [])

  const category = useMemo(() => ctx?.categories.find((c) => c.name === "جوالات") || ctx?.categories[0], [ctx])
  const fresh = CATALOG.filter((m) => !existing[m.handle])
  const selected = CATALOG.filter((m) => sel.has(m.handle))
  const toggle = (h: string) => setSel((s) => (s.has(h) ? (s.delete(h), new Set(s)) : new Set(s.add(h))))

  const run = async (mode: "create" | "refresh") => {
    const list = selected.filter((m) => (mode === "create" ? !existing[m.handle] : !!existing[m.handle]))
    if (!list.length) return toast.warning(mode === "create" ? "اختر موديلات غير منشورة" : "اختر موديلات منشورة لتحديثها")
    setLog([])
    let ok = 0
    for (const [i, m] of list.entries()) {
      setBusy(`${i + 1} / ${list.length}: ${m.title}`)
      try {
        if (mode === "create") {
          await sdk.admin.product.create(
            productPayload(m, { category_id: category?.id, sales_channel_id: ctx?.default_sales_channel_id, shipping_profile_id: ctx?.shipping_profile_id }, origin()) as any
          )
        } else {
          const ex = existing[m.handle]
          await sdk.admin.product.update(ex.id, refreshPayload(m, ex.metadata, origin()) as any)
        }
        ok++
        setLog((l) => [...l, `✓ ${m.title}`])
      } catch (e: any) {
        setLog((l) => [...l, `✗ ${m.title}: ${e?.message || e}`])
      }
    }
    setBusy("")
    setSel(new Set())
    await loadExisting().catch(() => {})
    toast.success(mode === "create" ? `نُشر ${ok} موديل في المتجر` : `حُدّث ${ok} موديل`)
  }

  const Card = ({ m }: { m: CatalogModel }) => {
    const ex = !!existing[m.handle]
    const img = m.images[0] ? `${origin()}/${m.images[0].path}` : ""
    return (
      <label className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition ${sel.has(m.handle) ? "border-ui-border-interactive bg-ui-bg-highlight" : ""}`}>
        <div className="flex items-center justify-between">
          <Checkbox checked={sel.has(m.handle)} onCheckedChange={() => toggle(m.handle)} />
          {ex ? <Badge size="2xsmall" color="green">منشور</Badge> : <Badge size="2xsmall">جديد</Badge>}
        </div>
        {img ? <img src={img} alt="" loading="lazy" className="aspect-square w-full rounded bg-white object-contain" /> : <div className="flex aspect-square items-center justify-center rounded bg-ui-bg-subtle text-xs text-ui-fg-muted">بلا صور بعد</div>}
        <div>
          <Text size="small" weight="plus">{m.title}</Text>
          <Text size="xsmall" className="text-ui-fg-subtle" dir="ltr">{m.subtitle}</Text>
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {m.storages.map(storageLabel).join(" · ")}
          <br />
          {m.colors.length ? `${m.colors.length} ألوان` : "الألوان تُضاف لاحقاً"} · {m.images.length} صور
        </Text>
      </label>
    )
  }

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <Container className="flex flex-col gap-3 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Heading>موديلات سامسونج جالاكسي S</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {CATALOG.length} موديلاً من S9 إلى S26، منشور منها {CATALOG.length - fresh.length}. النشر في المتجر فقط، بلا فيسبوك ولا إنستغرام. المنتجات تُنشر بلا سعر فيظهر "السعر عبر واتساب" حتى تضيف السعر.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="small" onClick={() => setSel(new Set(fresh.filter((m) => m.images.length).map((m) => m.handle)))}>تحديد كل الجديد</Button>
            <Button variant="secondary" size="small" onClick={() => setSel(new Set())}>إلغاء التحديد</Button>
            <Button size="small" isLoading={!!busy} disabled={!ctx || !selected.length} onClick={() => run("create")}>نشر المحدد ({selected.filter((m) => !existing[m.handle]).length})</Button>
            <Button variant="secondary" size="small" isLoading={!!busy} disabled={!selected.some((m) => existing[m.handle])} onClick={() => run("refresh")}>تحديث الصور والمواصفات</Button>
          </div>
        </div>
        {busy && <Text size="small">جارٍ: {busy}</Text>}
        {log.length > 0 && <pre className="max-h-40 overflow-auto rounded bg-ui-bg-subtle p-2 text-xs">{log.join("\n")}</pre>}
      </Container>
      <Container className="grid grid-cols-2 gap-3 px-6 py-4 sm:grid-cols-3 lg:grid-cols-5">
        {CATALOG.map((m) => <Card key={m.handle} m={m} />)}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "موديلات سامسونج", icon: Phone })
export default SamsungCatalogPage
