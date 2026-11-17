"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

/** شريط البحث في الهيدر: يبحث في منتجات المتجر بالاسم والموديل */
export default function SearchBox({ initial = "", className = "" }: { initial?: string; className?: string }) {
  const [q, setQ] = useState(initial)
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode?: string }

  return (
    <form
      role="search"
      className={`flex items-center ${className}`}
      onSubmit={(e) => {
        e.preventDefault()
        const term = q.trim()
        if (term) router.push(`/${countryCode || "ye"}/search?q=${encodeURIComponent(term)}`)
      }}
    >
      <input
        type="search"
        dir="auto"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث: S24 Ultra، شاحن…"
        aria-label="بحث في المنتجات"
        className="h-9 w-full rounded-full border border-ui-border-base bg-ui-bg-subtle px-4 text-sm outline-none focus:border-brand-orange"
      />
    </form>
  )
}
