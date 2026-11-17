import { whatsappNumber } from "@lib/store-info"
import { getFaqs } from "@lib/data/faqs"
import StaticPage from "@modules/common/components/static-page"
import { Metadata } from "next"

export const metadata: Metadata = { title: "الأسئلة الشائعة" }
export const revalidate = 300

// الأسئلة الشائعة: تُدار من لوحة التحكم (الأسئلة الشائعة)، ونفسها يجيب منها الرد الآلي
export default async function Faq() {
  const faqs = await getFaqs()
  const wa = whatsappNumber()
  return (
    <StaticPage title="الأسئلة الشائعة">
      {faqs.length === 0 && <p>لا توجد أسئلة حالياً.</p>}
      <div className="flex flex-col divide-y divide-ui-border-base rounded-lg border border-ui-border-base">
        {faqs.map((f) => (
          <details key={f.id} className="group px-4 py-3">
            <summary className="cursor-pointer list-none font-semibold" dir="auto">
              <span className="me-2 inline-block transition group-open:rotate-90">‹</span>
              {f.question}
            </summary>
            <p className="mt-2 whitespace-pre-line text-ui-fg-subtle" dir="auto">{f.answer}</p>
          </details>
        ))}
      </div>
      {wa && (
        <p>
          لم تجد جوابك؟{" "}
          <a className="font-semibold text-[#128C7E] underline" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
            اسألنا عبر واتساب
          </a>
        </p>
      )}
    </StaticPage>
  )
}
