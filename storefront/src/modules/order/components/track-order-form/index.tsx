"use client"

import { SUFFIX, isDisplayCurrency } from "@lib/currency/format"
import { trackOrder, type TrackResult } from "@lib/data/track-order"
import { Button } from "@medusajs/ui"
import { useActionState } from "react"

const STATUS: Record<string, string> = {
  pending: "قيد المراجعة",
  completed: "مكتمل",
  canceled: "ملغي",
  not_fulfilled: "قيد التجهيز",
  partially_fulfilled: "جُهّز جزئياً",
  fulfilled: "جاهز",
  shipped: "تم الشحن",
  partially_shipped: "شُحن جزئياً",
  delivered: "تم التسليم",
  partially_delivered: "سُلّم جزئياً",
}
const s = (k: string) => STATUS[k] || k

export default function TrackOrderForm() {
  const [state, action, pending] = useActionState<TrackResult | null, FormData>(trackOrder, null)
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-3 max-w-md">
        <input name="order_id" inputMode="numeric" required placeholder="رقم الطلب (مثلاً 1024)" className="border rounded-md px-3 py-2" />
        <input name="contact" required placeholder="البريد أو رقم الجوال المستخدم في الطلب" className="border rounded-md px-3 py-2" />
        <Button type="submit" isLoading={pending}>تتبع الطلب</Button>
      </form>
      {state && !state.ok && <p className="text-rose-600">{state.error}</p>}
      {state?.ok && (
        <div className="border rounded-lg p-4 flex flex-col gap-2 max-w-md">
          <p className="font-bold">طلب رقم #{state.order.display_id}</p>
          <p>الحالة: {s(state.order.status)}</p>
          <p>التجهيز: {s(state.order.fulfillment_status)}</p>
          <p>
            المبلغ المستحق:{" "}
            <span dir="ltr">
              {Number(state.order.amount_due_display).toLocaleString("en-US")}{" "}
              {isDisplayCurrency(state.order.display_currency) ? SUFFIX[state.order.display_currency] : "$"}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
