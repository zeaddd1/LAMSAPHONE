import React from "react"
import { HttpTypes } from "@medusajs/types"

// بدون Stripe حالياً: دفع يدوي فقط. أبقينا الغلاف لإضافة مزودات دفع محلية لاحقاً.
type PaymentWrapperProps = {
  cart: HttpTypes.StoreCart
  children: React.ReactNode
}

const PaymentWrapper: React.FC<PaymentWrapperProps> = ({ children }) => {
  return <div>{children}</div>
}

export default PaymentWrapper
