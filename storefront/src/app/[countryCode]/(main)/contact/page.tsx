import { STORE, whatsappLink } from "@lib/store-info"
import StaticPage from "@modules/common/components/static-page"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: `تواصل مع ${STORE.name}: ${STORE.address}. هاتف وواتساب ${STORE.phoneDisplay}.`,
}
export const revalidate = 86400

export default function Contact() {
  return (
    <StaticPage title="تواصل معنا">
      <p>يسعدنا تواصلك معنا لأي استفسار عن المنتجات أو الطلبات.</p>
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
      <p>🚚 نوصل داخل صنعاء وإلى المحافظات، والدفع عند الاستلام.</p>
    </StaticPage>
  )
}
