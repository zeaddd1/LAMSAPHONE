import { getExchangeRates } from "@lib/data/exchange-rates"
import { CurrencyProvider } from "@lib/currency/context"
import { getBaseURL } from "@lib/util/env"
import WhatsAppButton from "@modules/common/components/whatsapp-button"
import { Metadata } from "next"
import { Tajawal } from "next/font/google"
import "styles/globals.css"

// خط عربي: نحمّل الأوزان المستخدمة فقط
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700"], display: "swap", variable: "--font-tajawal" })

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: { default: "لمسة فون | جوالات وإكسسوارات", template: "%s | لمسة فون" },
  description: "لمسة فون: جوالات جديدة ومستعملة ومجددة، وإكسسوارات أصلية، والدفع عند الاستلام.",
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const rates = await getExchangeRates()
  return (
    <html lang="ar" dir="rtl" data-mode="light" className={tajawal.variable}>
      <body className={tajawal.className}>
        <CurrencyProvider rates={rates}>
          <main className="relative">{props.children}</main>
          <WhatsAppButton />
        </CurrencyProvider>
      </body>
    </html>
  )
}
