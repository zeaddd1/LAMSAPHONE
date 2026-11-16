import { findByShortCode } from "@lib/data/short-links"
import { NextRequest, NextResponse } from "next/server"

// رابط قصير للمنتج في منشورات ميتا: lamsaphone.yemenbay.com/p/xxxxxx ← صفحة المنتج
export async function GET(req: NextRequest, { params }: { params: Promise<{ countryCode: string; code: string }> }) {
  const { countryCode, code } = await params
  const p = await findByShortCode(code)
  const path = p ? `/${countryCode}/products/${encodeURIComponent(p.handle)}` : `/${countryCode}/store`
  return NextResponse.redirect(new URL(path, req.nextUrl.origin), 307)
}
