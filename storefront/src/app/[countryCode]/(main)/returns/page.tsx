import StaticPage from "@modules/common/components/static-page"
import { Metadata } from "next"

export const metadata: Metadata = { title: "سياسة الاسترجاع" }
export const revalidate = 86400

// نص مبدئي: راجعه وعدّله حسب سياسة المحل الفعلية
export default function Returns() {
  return (
    <StaticPage title="سياسة الاسترجاع والاستبدال">
      <p>يمكن استبدال أو استرجاع المنتج خلال 3 أيام من الاستلام إذا كان بحالته الأصلية ومع كامل ملحقاته وعلبته.</p>
      <p>الأجهزة المستعملة والمجدّدة تُفحص أمامك عند الاستلام، ويُذكر ضمانها في صفحة المنتج.</p>
      <p>لا يشمل الاسترجاع الأضرار الناتجة عن سوء الاستخدام.</p>
      <p>للطلب تواصل معنا عبر واتساب مع رقم الطلب.</p>
    </StaticPage>
  )
}
