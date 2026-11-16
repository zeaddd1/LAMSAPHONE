"use client"
import { HttpTypes } from "@medusajs/types"

/**
 * زر "اطلب عبر واتساب" في صفحة المنتج: يفتح محادثة واتساب برسالة جاهزة فيها اسم المنتج والخيار والسعر والرابط.
 * الرقم من NEXT_PUBLIC_WHATSAPP_NUMBER (بصيغة دولية بدون +).
 */
export default function WhatsAppOrder({
  product,
  variant,
  disabled,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  disabled?: boolean
}) {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/[^\d]/g, "")
  if (!number) return null

  const options = (variant?.options || [])
    .map((o: any) => o?.value)
    .filter((v: string) => v && !/default|افتراضي/i.test(v))
    .join(" / ")
  const amount = (variant as any)?.calculated_price?.calculated_amount
  const price = typeof amount === "number" && amount > 0 ? `${Number.isInteger(amount) ? amount : amount.toFixed(2)}$` : ""
  const link = typeof window !== "undefined" ? window.location.href.split("#")[0] : ""
  const text = [
    "مرحباً لمسة فون، أريد طلب:",
    `• ${product.title}${options ? ` (${options})` : ""}`,
    price && `• السعر: ${price}`,
    link && `• الرابط: ${link}`,
  ]
    .filter(Boolean)
    .join("\n")

  return (
    <a
      href={disabled ? undefined : `https://wa.me/${number}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled}
      data-testid="whatsapp-order-button"
      className={`flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#25D366] text-sm font-semibold text-white transition hover:brightness-95 ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <svg viewBox="0 0 32 32" width="18" height="18" fill="#fff" aria-hidden="true">
        <path d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.2.6 4.4 1.7 6.3L3 29l7.3-1.9c1.8 1 3.8 1.5 5.8 1.5 7 0 12.7-5.6 12.7-12.6S23 3 16 3z" />
      </svg>
      اطلب عبر واتساب
    </a>
  )
}
