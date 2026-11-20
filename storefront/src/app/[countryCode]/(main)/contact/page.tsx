import { getSiteTexts, paragraphs } from "@lib/data/site-texts"
import { STORE, whatsappLink } from "@lib/store-info"
import StaticPage from "@modules/common/components/static-page"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: `تواصل مع ${STORE.name}: ${STORE.address}. هاتف وواتساب ${STORE.phoneDisplay}.`,
}
// النصوص من لوحة التحكم ← نصوص المتجر
export const revalidate = 60

export default async function Contact() {
  const t = await getSiteTexts()
  return (
    <StaticPage title={t.contact_title}>
      {paragraphs(t.contact_intro).map((p) => <p key={p}>{p}</p>)}
      <p>
        📲 هاتف وواتساب:{" "}
        <a className="text-brand-orange font-bold" href={whatsappLink()} target="_blank" rel="noopener noreferrer" dir="ltr">
          {STORE.phoneDisplay}
        </a>
      </p>
      <p>📍 العنوان: {STORE.address}</p>
      <p>
        📸 إنستغرام:{" "}
        <a className="text-brand-orange font-bold" href={STORE.instagram} target="_blank" rel="noopener noreferrer" dir="ltr">
          {STORE.instagramHandle}
        </a>
      </p>
      {paragraphs(t.contact_note).map((p) => <p key={p}>{p}</p>)}
    </StaticPage>
  )
}