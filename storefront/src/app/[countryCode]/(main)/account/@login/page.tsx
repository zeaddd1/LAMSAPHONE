import { t } from "@lib/i18n/ar"
import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: t("Sign in"),
  description: "Sign in to your Medusa Store account.",
}

export default function Login() {
  return <LoginTemplate />
}
