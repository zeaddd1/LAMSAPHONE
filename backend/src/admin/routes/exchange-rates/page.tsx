import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Switch, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"

type Rate = {
  id: string
  code: string
  label_ar: string
  symbol: string
  rate_per_usd: number
  rounding_step: number
  is_active: boolean
  updated_at: string
}
type History = {
  id: string
  code: string
  old_rate: number | null
  new_rate: number
  changed_by: string | null
  created_at: string
}

// نفس منطق src/lib/currency.ts (لا يمكن استيراده من كود الخادم داخل اللوحة)
const roundToStep = (v: number, step: number) => {
  if (!step || step <= 0) return Math.round(v * 100) / 100
  const d = (String(step).split(".")[1] || "").length
  return Number((Math.round(v / step) * step).toFixed(d))
}
const DAY_MS = 24 * 60 * 60 * 1000

const ExchangeRatesPage = () => {
  const [rates, setRates] = useState<Rate[]>([])
  const [history, setHistory] = useState<History[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const r = await sdk.client.fetch<{ exchange_rates: Rate[] }>("/admin/exchange-rates")
    setRates(r.exchange_rates.map((x) => ({ ...x, rate_per_usd: Number(x.rate_per_usd), rounding_step: Number(x.rounding_step) })))
    const h = await sdk.client.fetch<{ history: History[] }>("/admin/exchange-rates/history")
    setHistory(h.history)
  }
  useEffect(() => {
    load().catch((e) => toast.error(String(e)))
  }, [])

  const edit = (code: string, patch: Partial<Rate>) =>
    setRates((rs) => rs.map((r) => (r.code === code ? { ...r, ...patch } : r)))

  const save = async () => {
    setSaving(true)
    try {
      const toSend = rates.filter((r) => r.code !== "USD" && r.rate_per_usd > 0)
      await sdk.client.fetch("/admin/exchange-rates", {
        method: "POST",
        body: { rates: toSend.map(({ code, rate_per_usd, rounding_step, is_active }) => ({ code, rate_per_usd, rounding_step, is_active })) },
      })
      toast.success("تم حفظ أسعار الصرف")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const stale = rates.filter((r) => r.is_active && r.code !== "USD" && Date.now() - new Date(r.updated_at).getTime() > DAY_MS)
  const preview = useMemo(
    () =>
      rates
        .filter((r) => r.code !== "USD" && r.rate_per_usd > 0)
        .map((r) => `${roundToStep(100 * r.rate_per_usd, r.rounding_step).toLocaleString("en-US")} ${r.symbol}`)
        .join(" / "),
    [rates]
  )

  return (
    <div className="flex flex-col gap-y-3" dir="rtl">
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading>أسعار الصرف</Heading>
          <Button onClick={save} isLoading={saving}>حفظ</Button>
        </div>
        {stale.length > 0 && (
          <div className="mx-6 mb-4 rounded-md bg-ui-tag-red-bg p-3">
            <Text className="text-ui-tag-red-text">
              تنبيه: لم تُحدَّث هذه العملات منذ أكثر من 24 ساعة: {stale.map((s) => s.label_ar).join("، ")}
            </Text>
          </div>
        )}
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>العملة</Table.HeaderCell>
              <Table.HeaderCell>سعر الدولار الواحد</Table.HeaderCell>
              <Table.HeaderCell>خطوة التقريب</Table.HeaderCell>
              <Table.HeaderCell>مفعّل</Table.HeaderCell>
              <Table.HeaderCell>آخر تحديث</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rates.map((r) => (
              <Table.Row key={r.code}>
                <Table.Cell>{r.label_ar} <Badge size="2xsmall">{r.code}</Badge></Table.Cell>
                <Table.Cell>
                  <Input type="number" min={0} step="any" disabled={r.code === "USD"} value={r.rate_per_usd}
                    onChange={(e) => edit(r.code, { rate_per_usd: Number(e.target.value) })} />
                </Table.Cell>
                <Table.Cell>
                  <Input type="number" min={0} step="any" disabled={r.code === "USD"} value={r.rounding_step}
                    onChange={(e) => edit(r.code, { rounding_step: Number(e.target.value) })} />
                </Table.Cell>
                <Table.Cell>
                  <Switch disabled={r.code === "USD"} checked={r.is_active}
                    onCheckedChange={(v) => edit(r.code, { is_active: v })} />
                </Table.Cell>
                <Table.Cell>{new Date(r.updated_at).toLocaleString("ar")}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <div className="px-6 py-4">
          <Text size="small">معاينة: منتج بسعر 100$ سيظهر: {preview || "أدخل أسعار الصرف أولاً"}</Text>
        </div>
      </Container>

      <Container className="p-0">
        <div className="px-6 py-4"><Heading level="h2">آخر 20 تغييراً</Heading></div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>العملة</Table.HeaderCell>
              <Table.HeaderCell>القديم</Table.HeaderCell>
              <Table.HeaderCell>الجديد</Table.HeaderCell>
              <Table.HeaderCell>بواسطة</Table.HeaderCell>
              <Table.HeaderCell>الوقت</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {history.map((h) => (
              <Table.Row key={h.id}>
                <Table.Cell>{h.code}</Table.Cell>
                <Table.Cell>{h.old_rate ?? "-"}</Table.Cell>
                <Table.Cell>{h.new_rate}</Table.Cell>
                <Table.Cell>{h.changed_by ?? "-"}</Table.Cell>
                <Table.Cell>{new Date(h.created_at).toLocaleString("ar")}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "أسعار الصرف", icon: CurrencyDollar })
export default ExchangeRatesPage
