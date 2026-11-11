import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Input, Label, toast } from "@medusajs/ui"
import { useState } from "react"
import { sdk } from "../lib/sdk"

// مواصفات الجوال السريعة تُحفظ في metadata.specs وتعرضها الواجهة
const FIELDS = [
  { key: "screen", label: "الشاشة" },
  { key: "cpu", label: "المعالج" },
  { key: "camera", label: "الكاميرا" },
  { key: "battery", label: "البطارية" },
] as const

const ProductSpecsWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const initial = ((product.metadata as any)?.specs || {}) as Record<string, string>
  const [specs, setSpecs] = useState<Record<string, string>>(initial)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await sdk.admin.product.update(product.id, { metadata: { ...(product.metadata || {}), specs } })
      toast.success("تم حفظ المواصفات")
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="flex flex-col gap-3 px-6 py-4" dir="rtl">
      <Heading level="h2">مواصفات سريعة</Heading>
      {FIELDS.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <Label>{f.label}</Label>
          <Input value={specs[f.key] || ""} onChange={(e) => setSpecs({ ...specs, [f.key]: e.target.value })} />
        </div>
      ))}
      <Button size="small" onClick={save} isLoading={saving}>حفظ</Button>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.after" })
export default ProductSpecsWidget
