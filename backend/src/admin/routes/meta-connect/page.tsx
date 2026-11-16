import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Channels } from "@medusajs/icons"
import { Container, Heading, Tabs, Text } from "@medusajs/ui"
import { useState } from "react"
import MetaConnectTab from "../../components/quick-add-meta-connect"
import BotSettings from "../../components/assistant-bot-settings"
import MetaBackups from "../../components/meta-backups"

// صفحة "ربط ميتا" المستقلة: ربط الصفحة وإنستغرام والكتالوج، وإعدادات الرد الآلي وواتساب.
// منفصلة عن إضافة المنتجات حتى لا يتغير الربط بالخطأ، وكل حفظ يطلب تأكيداً.
const MetaConnectPage = () => {
  const [tab, setTab] = useState("meta")
  return (
    <Container className="p-0" dir="rtl">
      <div className="border-b px-6 py-4">
        <Heading level="h1">ربط ميتا</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          ربط المتجر بفيسبوك وإنستغرام وكتالوج ميتا وواتساب. أي تعديل هنا يطلب منك تأكيداً قبل الحفظ.
        </Text>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto px-4 pt-3 sm:px-6">
          <Tabs.List>
            <Tabs.Trigger value="meta">الصفحة والكتالوج</Tabs.Trigger>
            <Tabs.Trigger value="bot">الرد الآلي وواتساب</Tabs.Trigger>
            <Tabs.Trigger value="backup">النسخ الاحتياطية</Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="meta">
          <MetaConnectTab onSaved={() => {}} />
        </Tabs.Content>
        <Tabs.Content value="bot">
          <BotSettings />
        </Tabs.Content>
        <Tabs.Content value="backup">
          <MetaBackups />
        </Tabs.Content>
      </Tabs>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "ربط ميتا", icon: Channels })

export default MetaConnectPage
