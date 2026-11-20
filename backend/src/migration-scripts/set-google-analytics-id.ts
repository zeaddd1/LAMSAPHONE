import type { ExecArgs } from "@medusajs/framework/types"
import { getAnalyticsSettings, saveAnalyticsSettings } from "../lib/analytics-settings"

// يعمل مرة واحدة عند النشر: يضع معرّف القياس لمصدر بيانات "متجر لمسة فون" في Google Analytics
// إن لم يكن هناك معرّف G- محفوظ. يمكن تغييره أو حذفه بعدها من صفحة "زوار المتجر".
export default async function setGoogleAnalyticsId({ container }: ExecArgs) {
  const current = await getAnalyticsSettings(container)
  if (current.ga_id) return
  await saveAnalyticsSettings(container, { ...current, ga_id: "G-JDTY0ZN3SE" })
}
