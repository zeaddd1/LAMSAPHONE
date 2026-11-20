import { getSiteTexts, paragraphs } from "@lib/data/site-texts"
import { STORE } from "@lib/store-info"
import StaticPage from "@modules/common/components/static-page"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "من نحن",
  description: `${STORE.name}: ${STORE.tagline}. ${STORE.address}.`,
}
// النصوص من لوحة التحكم ← نصوص المتجر
export const revalidate = 60

export default async function About() {
  const t = await getSiteTexts()
  return (
    <StaticPage title={t.about_title}>
      {paragraphs(t.about_text).map((p) => <p key={p}>{p}</p>)}
      <p>📍 {STORE.address}</p>
      <p dir="ltr" className="text-right">📲 {STORE.phoneDisplay}</p>
    </StaticPage>
  )
}