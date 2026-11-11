import Medusa from "@medusajs/js-sdk"

// عميل API للوحة التحكم (يستخدم جلسة المدير الحالية)
export const sdk = new Medusa({
  baseUrl: "/", // اللوحة تُخدَم من نفس دومين الباك إند
  debug: false,
  auth: { type: "session" },
})
