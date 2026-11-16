import { listProductsWithSort } from "@lib/data/products"
import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "روابط لمسة فون",
  description: "أحدث جوالات وإكسسوارات لمسة فون في صنعاء: اطلب مباشرة عبر واتساب أو من المتجر.",
}
export const revalidate = 300

// صفحة "الرابط في البايو" لإنستغرام: كل المنتجات بصورها وأسعارها، وزر طلب واتساب لكل منتج
export default async function Links({ params }: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await params
  const {
    response: { products },
  } = await listProductsWithSort({ page: 1, countryCode, sortBy: "created_at", queryParams: { limit: 60 } as any })
  const wa = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/[^\d]/g, "")
  const price = (p: any) => {
    const n = (p.variants || []).map((v: any) => v?.calculated_price?.calculated_amount).filter((x: any) => typeof x === "number").sort((a: number, b: number) => a - b)[0]
    return typeof n === "number" ? `${Number.isInteger(n) ? n : n.toFixed(2)}$` : ""
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8" dir="rtl">
      <div className="flex flex-col items-center gap-2 text-center">
        <Image src="/logo-mark.png" alt="لمسة فون" width={120} height={93} priority />
        <p className="text-sm text-ui-fg-subtle">جوالات وإكسسوارات أصلية في صنعاء · توصيل سريع · الدفع عند الاستلام</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#25D366] py-3 text-center font-semibold text-white">
            💬 واتساب
          </a>
        )}
        <Link href={`/${countryCode}/store`} className="rounded-xl bg-[#ff6600] py-3 text-center font-semibold text-white">
          🛍️ المتجر
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {products.map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-ui-border-base bg-white p-2">
            <Link href={`/${countryCode}/products/${p.handle}`} className="relative aspect-[6/7] w-20 shrink-0 overflow-hidden rounded-lg bg-white">
              {p.thumbnail && <Image src={p.thumbnail} alt={p.title} fill sizes="80px" className="object-cover" />}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link href={`/${countryCode}/products/${p.handle}`} className="truncate font-semibold" dir="auto">
                {p.title}
              </Link>
              {price(p) && <span className="text-sm font-bold text-[#ff6600]">{price(p)}</span>}
              {wa && (
                <a
                  href={`/wa/${String(p.id).slice(-6).toLowerCase()}`}
                  className="self-start rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white"
                >
                  اطلب عبر واتساب
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
