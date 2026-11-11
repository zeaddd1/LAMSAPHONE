import StaticPage from "@modules/common/components/static-page"
import { Metadata } from "next"

export const metadata: Metadata = { title: "تواصل معنا" }
export const revalidate = 86400

export default function Contact() {
  const wa = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/[^\d]/g, "")
  return (
    <StaticPage title="تواصل معنا">
      <p>يسعدنا تواصلك معنا لأي استفسار عن المنتجات أو الطلبات.</p>
      {wa && (
        <p>
          واتساب:{" "}
          <a className="text-brand-orange font-bold" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" dir="ltr">
            +{wa}
          </a>
        </p>
      )}
    </StaticPage>
  )
}
