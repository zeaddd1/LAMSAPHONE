import type { NextRequest } from "next/server"

/**
 * العنوان العام للمتجر كما يراه الزائر. داخل الحاوية يكون req.nextUrl.origin عنواناً داخلياً
 * (مثل 0.0.0.0:8000)، فنأخذ الدومين من ترويسات البروكسي أو من متغير البيئة.
 */
export function publicOrigin(req: NextRequest): string {
  const env = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "")
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim()
  if (host && !/^(0\.0\.0\.0|127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return `${proto}://${host.split(",")[0].trim()}`
  return env || "https://lamsaphone.yemenbay.com"
}
