import { getExchangeRates } from "@lib/data/exchange-rates"
import { CurrencyProvider } from "@lib/currency/context"
import { getBaseURL } from "@lib/util/env"
import { STORE } from "@lib/store-info"
import WhatsAppButton from "@modules/common/components/whatsapp-button"
import GoogleAnalytics from "@modules/common/components/google-analytics"
import { Metadata } from "next"
import { Tajawal } from "next/font/google"
import "styles/globals.css"

// خط عربي: نحمّل الأوزان المستخدمة فقط
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700"], display: "swap", variable: "--font-tajawal" })

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: { default: `${STORE.name} | جوالات سامسونج وارد أمريكا في صنعاء`, template: `%s | ${STORE.shortName}` },
  description: `${STORE.name}: ${STORE.tagline}. ${STORE.address}. فحص شامل وتوصيل سريع. واتساب ${STORE.phoneDisplay}.`,
  keywords: ["لمسة فون", "جوالات صنعاء", "جوالات سامسونج وارد أمريكا", "سامسونج صنعاء", "جوالات اليمن", "S24 Ultra صنعاء", "S23 Ultra اليمن", "إكسسوارات جوال صنعاء", "Lamsa Phone"],
  openGraph: { type: "website", siteName: STORE.shortName, locale: "ar_YE", url: "/" },
  twitter: { card: "summary_large_image" },
}

// بيانات منظمة للمتجر (تظهر في نتائج البحث والخرائط)
const storeJsonLd = {
  "@context": "https://schema.org",
  "@type": "MobilePhoneStore",
  name: STORE.name,
  alternateName: STORE.nameEn,
  description: STORE.tagline,
  url: STORE.url,
  telephone: `+${STORE.whatsapp}`,
  image: `${STORE.url}/logo.png`,
  address: { "@type": "PostalAddress", streetAddress: "شارع القصر، أمام السيفي", addressLocality: STORE.city, addressCountry: STORE.country },
  areaServed: ["صنعاء", "اليمن"],
  currenciesAccepted: "USD, SAR, YER",
  paymentAccepted: "Cash",
  sameAs: [STORE.instagram, STORE.facebook],
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const rates = await getExchangeRates()
  return (
    <html lang="ar" dir="rtl" data-mode="light" className={tajawal.variable}>
      <body className={tajawal.className}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd).replace(/</g, "\\u003c") }} />
        <GoogleAnalytics />
        <CurrencyProvider rates={rates}>
          <main className="relative">{props.children}</main>
          <WhatsAppButton />
        </CurrencyProvider>
      </body>
    </html>
  )
}
