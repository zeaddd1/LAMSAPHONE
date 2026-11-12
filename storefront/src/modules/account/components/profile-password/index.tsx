"use client"
import { t } from "@lib/i18n/ar"

import React, { useEffect, useActionState } from "react"
import Input from "@modules/common/components/input"
import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { toast } from "@medusajs/ui"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfilePassword: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false)

  // TODO: Add support for password updates
  const updatePassword = async () => {
    toast.info("تغيير كلمة المرور غير متاح حالياً، تواصل معنا")
  }

  const clearState = () => {
    setSuccessState(false)
  }

  return (
    <form
      action={updatePassword}
      onReset={() => clearState()}
      className="w-full"
    >
      <AccountInfo
        label={t("Password")}
        currentInfo={
          <span>{t("The password is not shown for security reasons")}</span>
        }
        isSuccess={successState}
        isError={false}
        errorMessage={undefined}
        clearState={clearState}
        data-testid="account-password-editor"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t("Old password")}
            name="old_password"
            required
            type="password"
            data-testid="old-password-input"
          />
          <Input
            label={t("New password")}
            type="password"
            name="new_password"
            required
            data-testid="new-password-input"
          />
          <Input
            label={t("Confirm password")}
            type="password"
            name="confirm_password"
            required
            data-testid="confirm-password-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfilePassword
