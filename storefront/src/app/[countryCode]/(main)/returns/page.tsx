import { getSiteTexts, paragraphs } from "@lib/data/site-texts"
import StaticPage from "@modules/common/components/static-page"
import { Metadata } from "next"

export const metadata: Metadata = { title: "سياسة الاسترجاع" }
// النصوص من لوحة التحكم ← نصوص المتجر
export const revalidate = 60

export default async function Returns() {
  const t = await getSiteTexts()
  return (
    <StaticPage title={t.returns_title}>
      {paragraphs(t.returns_text).map((p) => <p key={p}>{p}</p>)}
    </StaticPage>
  )
}