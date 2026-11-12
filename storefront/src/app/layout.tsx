import { getExchangeRates } from "@lib/data/exchange-rates"
import { getMetaSettings } from "@lib/data/meta-settings"
import { CurrencyProvider } from "@lib/currency/context"
import { getBaseURL } from "@lib/util/env"
import WhatsAppButton from "@modules/common/components/whatsapp-button"
import MetaPixel from "@modules/common/components/meta-pixel"
import { Metadata } from "next"
import { Tajawal } from "next/font/google"
import "styles/globals.css"

// خط عربي: نحمّل الأوزان المستخدمة فقط
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700"], display: "swap", variable: "--font-tajawal" })

const baseMetadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: { default: "لمسة فون | جوالات وإكسسوارات", template: "%s | لمسة فون" },
  description: "لمسة فون: جوالات جديدة ومستعملة ومجددة، وإكسسوارات أصلية، والدفع عند الاستلام.",
}

export async function generateMetadata(): Promise<Metadata> {
  // توثيق الدومين في Meta Business (يُضبط من لوحة التحكم)
  const { domain_verification } = await getMetaSettings()
  return domain_verification
    ? { ...baseMetadata, other: { "facebook-domain-verification": domain_verification } }
    : baseMetadata
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const [rates, meta] = await Promise.all([getExchangeRates(), getMetaSettings()])
  return (
    <html lang="ar" dir="rtl" data-mode="light" className={tajawal.variable}>
      <body className={tajawal.className}>
        <CurrencyProvider rates={rates}>
          <main className="relative">{props.children}</main>
          <WhatsAppButton />
          <MetaPixel pixelId={meta.pixel_id} />
        </CurrencyProvider>
      </body>
    </html>
  )
}
