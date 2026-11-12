import { t } from "@lib/i18n/ar"
import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: t("Sign in"),
  description: "سجّل الدخول إلى حسابك في لمسة فون",
}

export default function Login() {
  return <LoginTemplate />
}
