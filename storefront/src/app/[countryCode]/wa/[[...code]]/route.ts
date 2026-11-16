import { findByShortCode } from "@lib/data/short-links"
import { publicOrigin } from "@lib/util/public-origin"
import { NextRequest, NextResponse } from "next/server"

// رابط واتساب قصير: lamsaphone.yemenbay.com/wa ← محادثة المتجر
// ومع رمز المنتج (/wa/xxxxxx) يفتح المحادثة برسالة جاهزة فيها اسم المنتج وسعره ورابطه
export async function GET(req: NextRequest, { params }: { params: Promise<{ countryCode: string; code?: string[] }> }) {
  const { countryCode, code } = await params
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/[^\d]/g, "")
  if (!number) return NextResponse.redirect(new URL(`/${countryCode}/contact`, publicOrigin(req)), 307)
  const p = code?.[0] ? await findByShortCode(code[0]) : null
  if (!p) return NextResponse.redirect(`https://wa.me/${number}`, 307)
  const price = p.price && p.price > 0 ? `${Number.isInteger(p.price) ? p.price : p.price.toFixed(2)}$` : ""
  const text = ["مرحباً لمسة فون، أريد طلب:", `• ${p.title}`, price && `• السعر: ${price}`, `• الرابط: ${publicOrigin(req)}/p/${code![0]}`].filter(Boolean).join("\n")
  return NextResponse.redirect(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, 307)
}
