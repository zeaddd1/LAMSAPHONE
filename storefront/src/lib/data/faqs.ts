import "server-only"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type StoreFaq = { id: string; question: string; answer: string }

/** الأسئلة الشائعة من الباك إند (تُدار من لوحة التحكم) مع كاش 5 دقائق. */
export async function getFaqs(): Promise<StoreFaq[]> {
  try {
    const res = await fetch(`${BACKEND}/store/faqs`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 300, tags: ["faqs"] },
    })
    if (!res.ok) return []
    const json = await res.json()
    return json.faqs ?? []
  } catch {
    return []
  }
}
