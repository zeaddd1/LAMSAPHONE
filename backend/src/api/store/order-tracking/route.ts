import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * تتبع الطلب بدون تسجيل دخول: رقم الطلب + البريد أو الجوال المستخدم فيه.
 * نُرجع الحالة والمبالغ فقط (لا عناوين ولا بيانات شخصية).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const displayId = Number(req.query.order_id)
  const contact = String(req.query.contact || "").trim().toLowerCase()
  if (!Number.isInteger(displayId) || displayId <= 0 || contact.length < 4) {
    return res.status(400).json({ message: "invalid input" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "status", "fulfillment_status", "payment_status", "total", "created_at", "metadata", "shipping_address.phone"],
    filters: { display_id: displayId } as any, // display_id رقمي في قاعدة البيانات
  })
  const o: any = data[0]
  const digits = (s: string) => s.replace(/[^\d]/g, "")
  const phone = digits(o?.shipping_address?.phone || "")
  const match =
    o &&
    ((o.email && o.email.toLowerCase() === contact) ||
      (phone.length >= 6 && digits(contact).length >= 6 && phone.endsWith(digits(contact).slice(-9))))

  if (!match) return res.status(404).json({ message: "not found" })

  const m = o.metadata || {}
  res.json({
    order: {
      display_id: o.display_id,
      status: o.status,
      fulfillment_status: o.fulfillment_status,
      payment_status: o.payment_status,
      total_usd: o.total,
      created_at: o.created_at,
      display_currency: m.display_currency ?? "USD",
      amount_due_display: m.amount_due_display ?? o.total,
    },
  })
}
