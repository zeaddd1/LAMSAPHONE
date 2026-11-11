import "server-only"
import type { ExchangeRate } from "@lib/currency/format"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

/** أسعار الصرف من الباك إند مع كاش 60 ثانية (تغيير السعر يظهر خلال دقيقة). */
export async function getExchangeRates(): Promise<ExchangeRate[]> {
  try {
    const res = await fetch(`${BACKEND}/store/exchange-rates`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 60, tags: ["exchange-rates"] },
    })
    if (!res.ok) return []
    const json = await res.json()
    return json.exchange_rates ?? []
  } catch {
    return [] // إن تعذّر الاتصال نعرض بالدولار
  }
}
