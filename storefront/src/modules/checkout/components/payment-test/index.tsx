import { t } from "@lib/i18n/ar"
import { Badge } from "@medusajs/ui"

const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold">{t("Attention:")}</span> للتجربة فقط.
    </Badge>
  )
}

export default PaymentTest
