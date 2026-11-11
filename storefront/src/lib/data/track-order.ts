"use server"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type TrackResult =
  | { ok: true; order: { display_id: number; status: string; fulfillment_status: string; payment_status: string; total_usd: number; created_at: string; display_currency: string; amount_due_display: number } }
  | { ok: false; error: string }

export async function trackOrder(_prev: TrackResult | null, form: FormData): Promise<TrackResult> {
  const orderId = String(form.get("order_id") || "").replace(/[^\d]/g, "")
  const contact = String(form.get("contact") || "").trim()
  if (!orderId || contact.length < 4) return { ok: false, error: "أدخل رقم الطلب والبريد أو رقم الجوال" }
  const url = `${BACKEND}/store/order-tracking?order_id=${encodeURIComponent(orderId)}&contact=${encodeURIComponent(contact)}`
  const res = await fetch(url, {
    headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
    cache: "no-store",
  })
  if (res.status === 404) return { ok: false, error: "لم نجد طلباً بهذه البيانات" }
  if (!res.ok) return { ok: false, error: "حدث خطأ، حاول مرة أخرى" }
  return { ok: true, order: (await res.json()).order }
}
