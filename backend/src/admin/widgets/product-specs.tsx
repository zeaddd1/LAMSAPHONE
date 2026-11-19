import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Label, Textarea, toast } from "@medusajs/ui"
import { useState } from "react"
import { sdk } from "../lib/sdk"
import { SPEC_FIELDS, cleanSpecs } from "../lib/product-specs"

// مواصفات المنتج: تُحفظ في metadata.specs (نفس الخانة التي تملؤها الإضافة السريعة) وتعرضها صفحة المنتج في المتجر
const ProductSpecsWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const initial = ((product.metadata as any)?.specs || {}) as Record<string, string>
  const [specs, setSpecs] = useState<Record<string, string>>(initial)
  const [saving, setSaving] = useState(false)
  const [all, setAll] = useState(false)
  const filled = SPEC_FIELDS.filter((f) => specs[f.key]).length

  const save = async () => {
    setSaving(true)
    try {
      await sdk.admin.product.update(product.id, { metadata: { ...(product.metadata || {}), specs: cleanSpecs(specs) } })
      toast.success("تم حفظ المواصفات")
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const fields = all ? SPEC_FIELDS : SPEC_FIELDS.filter((f, i) => i < 4 || specs[f.key])
  return (
    <Container className="flex flex-col gap-3 px-6 py-4" dir="rtl">
      <Heading level="h2">المواصفات ({filled})</Heading>
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <Label size="small">{f.label}</Label>
          <Textarea dir="auto" rows={2} value={specs[f.key] || ""} onChange={(e) => setSpecs({ ...specs, [f.key]: e.target.value })} />
        </div>
      ))}
      {fields.length < SPEC_FIELDS.length && (
        <button type="button" className="self-start text-sm text-ui-fg-interactive underline" onClick={() => setAll(true)}>
          كل الحقول ({SPEC_FIELDS.length})
        </button>
      )}
      <Button size="small" onClick={save} isLoading={saving}>حفظ</Button>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.after" })
export default ProductSpecsWidget
