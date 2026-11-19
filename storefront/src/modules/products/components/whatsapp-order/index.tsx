"use client"
import { whatsappNumber } from "@lib/store-info"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useState } from "react"

/**
 * زر واتساب في صفحة المنتج: ضغطة واحدة تفتح محادثة المتجر برسالة جاهزة فيها
 * اسم المنتج والموديل والخيارات المختارة (السعة/اللون) والسعر أو طلب السعر، ثم رابط المنتج في سطر وحده
 * (واتساب يعرضه كبطاقة فيها صورة المنتج واسمه). الرقم من NEXT_PUBLIC_WHATSAPP_NUMBER.
 */
export function whatsappText(opts: { title: string; subtitle?: string | null; chosen: string[]; price: string; askPrice: boolean; link: string }) {
  const { title, subtitle, chosen, price, askPrice, link } = opts
  return [
    askPrice ? "مرحباً لمسة فون، أريد معرفة سعر:" : "مرحباً لمسة فون، أريد طلب:",
    `• ${title}`,
    subtitle && subtitle !== title ? `• الموديل: ${subtitle}` : "",
    chosen.length ? `• الخيار: ${chosen.join(" / ")}` : "",
    !askPrice && price ? `• السعر: ${price}` : "",
    link ? `\n${link}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export default function WhatsAppOrder({
  product,
  variant,
  chosen,
  askPrice = false,
  disabled,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  chosen?: string[]
  askPrice?: boolean
  disabled?: boolean
}) {
  const number = whatsappNumber()
  // رابط الصفحة يُقرأ في المتصفح بعد التحميل (أثناء التصيير في الخادم لا يوجد window)
  const [link, setLink] = useState("")
  useEffect(() => setLink(window.location.href.split("#")[0].split("?")[0]), [])
  if (!number) return null

  const picked = (
    chosen && chosen.length ? chosen : (variant?.options || []).map((o: any) => o?.value as string)
  ).filter((v) => v && !/default|افتراضي/i.test(v))
  const amount = (variant as any)?.calculated_price?.calculated_amount
  const price = typeof amount === "number" && amount > 0 ? `${Number.isInteger(amount) ? amount : amount.toFixed(2)}$` : ""
  const text = whatsappText({ title: product.title || "", subtitle: product.subtitle, chosen: picked, price, askPrice, link })

  return (
    <a
      href={disabled ? undefined : `https://wa.me/${number}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled}
      data-testid="whatsapp-order-button"
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#25D366] text-sm font-semibold text-white transition hover:brightness-95 ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <svg viewBox="0 0 32 32" width="18" height="18" fill="#fff" aria-hidden="true">
        <path d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.2.6 4.4 1.7 6.3L3 29l7.3-1.9c1.8 1 3.8 1.5 5.8 1.5 7 0 12.7-5.6 12.7-12.6S23 3 16 3z" />
      </svg>
      {askPrice ? "اسأل عن السعر عبر واتساب" : "اطلب عبر واتساب"}
    </a>
  )
}
