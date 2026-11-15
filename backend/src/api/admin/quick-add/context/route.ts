import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMetaSettings, publicSettings } from "../../../../lib/quick-add/meta-settings"

// كل ما تحتاجه صفحة الإضافة السريعة في طلب واحد: الأقسام، قناة البيع، ملف الشحن، المخزن، العملة، وحالة ربط ميتا
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const [cats, channels, profiles, locations, regions] = await Promise.all([
    query.graph({ entity: "product_category", fields: ["id", "name", "parent_category_id", "rank", "is_active"] }),
    query.graph({ entity: "sales_channel", fields: ["id", "name", "is_disabled"] }),
    query.graph({ entity: "shipping_profile", fields: ["id", "name", "type"] }),
    query.graph({ entity: "stock_location", fields: ["id", "name"] }),
    query.graph({ entity: "region", fields: ["id", "name", "currency_code"] }),
  ])
  const channelList = (channels.data as any[]).filter((c) => !c.is_disabled)
  const profileList = profiles.data as any[]
  res.json({
    categories: (cats.data as any[])
      .filter((c) => c.is_active !== false)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_category_id })),
    sales_channels: channelList.map((c) => ({ id: c.id, name: c.name })),
    // قناة المتجر: "LamsaPhone Web" إن وُجدت، وإلا الأولى
    default_sales_channel_id: (channelList.find((c) => /web/i.test(c.name)) || channelList[0])?.id || null,
    shipping_profile_id: (profileList.find((p) => p.type === "default") || profileList[0])?.id || null,
    stock_locations: (locations.data as any[]).map((l) => ({ id: l.id, name: l.name })),
    currency_code: ((regions.data as any[])[0]?.currency_code || "usd").toLowerCase(),
    meta: publicSettings(await getMetaSettings(req.scope)),
  })
}
