import { t } from "@lib/i18n/ar"
import { Metadata } from "next"

import InteractiveLink from "@modules/common/components/interactive-link"

export const metadata: Metadata = {
  title: "404",
  description: "الصفحة غير موجودة",
}

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">{t("Page not found")}</h1>
      <p className="text-small-regular text-ui-fg-base">
        السلة التي تحاول فتحها غير موجودة. امسح ملفات تعريف الارتباط وحاول مرة أخرى.
      </p>
      <InteractiveLink href="/">{t("Go to frontpage")}</InteractiveLink>
    </div>
  )
}
