/**
 * إعداد متجر لمسة فون. آمن لإعادة التشغيل: كل خطوة تتحقق أولاً هل الشيء موجود.
 * التشغيل:  npx medusa exec ./src/scripts/setup-lamsaphone.ts
 * لا يُنشئ منتجات تجريبية.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createProductCategoriesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { EXCHANGE_RATE_MODULE } from "../modules/exchange-rate"
import type ExchangeRateModuleService from "../modules/exchange-rate/service"

const CHANNEL_NAME = "LamsaPhone Web"
const REGION_NAME = "اليمن والسعودية"
const COUNTRIES = ["ye", "sa"]
const LOCATION_NAME = "محل لمسة فون"
const CATEGORIES = ["جوالات", "إكسسوارات", "سماعات", "شواحن", "حماية الشاشة", "أجهزة لوحية"]

export default async function setupLamsaPhone({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const storeSvc = container.resolve(Modules.STORE)
  const channelSvc = container.resolve(Modules.SALES_CHANNEL)
  const regionSvc = container.resolve(Modules.REGION)
  const taxSvc = container.resolve(Modules.TAX)
  const stockSvc = container.resolve(Modules.STOCK_LOCATION)
  const fulfillSvc = container.resolve(Modules.FULFILLMENT)
  const categorySvc = container.resolve(Modules.PRODUCT)
  const rateSvc: ExchangeRateModuleService = container.resolve(EXCHANGE_RATE_MODULE)

  const [store] = await storeSvc.listStores()

  // 1) قناة البيع
  let [channel] = await channelSvc.listSalesChannels({ name: CHANNEL_NAME })
  if (!channel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: CHANNEL_NAME }] },
    })
    channel = result[0]
    logger.info(`created sales channel ${CHANNEL_NAME}`)
  }

  // 2) العملات: USD أساسية + SAR وYER مدعومة. الأسعار تُدخل بالدولار فقط.
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "لمسة فون",
        default_sales_channel_id: channel.id,
        supported_currencies: [
          { currency_code: "usd", is_default: true },
          { currency_code: "sar" },
          { currency_code: "yer" },
        ],
      },
    },
  })

  // المنطقة
  let [region] = await regionSvc.listRegions({ name: REGION_NAME })
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: "usd",
            countries: COUNTRIES,
            payment_providers: ["pp_system_default"], // الدفع عند الاستلام
          },
        ],
      },
    })
    region = result[0]
    logger.info(`created region ${REGION_NAME}`)
  }

  const taxRegions = await taxSvc.listTaxRegions({ country_code: COUNTRIES })
  const missingTax = COUNTRIES.filter((c) => !taxRegions.some((t) => t.country_code === c))
  if (missingTax.length) {
    await createTaxRegionsWorkflow(container).run({
      input: missingTax.map((country_code) => ({ country_code, provider_id: "tp_system" })),
    })
  }

  // 3) المخزن والشحن
  let [location] = await stockSvc.listStockLocations({ name: LOCATION_NAME })
  if (!location) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: { locations: [{ name: LOCATION_NAME, address: { city: "Sana'a", country_code: "YE", address_1: "" } }] },
    })
    location = result[0]
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add: [channel.id] },
    })
    logger.info(`created stock location ${LOCATION_NAME}`)
  }
  await updateStoresWorkflow(container).run({
    input: { selector: { id: store.id }, update: { default_location_id: location.id } },
  })

  let [profile] = await fulfillSvc.listShippingProfiles({ type: "default" })
  if (!profile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    })
    profile = result[0]
  }

  const setName = "لمسة فون - توصيل واستلام"
  let [fset] = await fulfillSvc.listFulfillmentSets({ name: setName }, { relations: ["service_zones"] })
  if (!fset) {
    fset = await fulfillSvc.createFulfillmentSets({
      name: setName,
      type: "shipping",
      service_zones: [
        { name: REGION_NAME, geo_zones: COUNTRIES.map((country_code) => ({ country_code, type: "country" as const })) },
      ],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fset.id },
    })
    const rules = [
      { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
      { attribute: "is_return", value: "false", operator: "eq" as const },
    ]
    // الأسعار صفر مبدئياً؛ عدّلها من اللوحة (Settings → Locations & Shipping).
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "شحن محلي",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fset.service_zones[0].id,
          shipping_profile_id: profile.id,
          type: { label: "شحن محلي", description: "توصيل داخل المدينة", code: "local" },
          prices: [{ currency_code: "usd", amount: 0 }, { region_id: region.id, amount: 0 }],
          rules,
        },
        {
          name: "استلام من المحل",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fset.service_zones[0].id,
          shipping_profile_id: profile.id,
          type: { label: "استلام من المحل", description: "بدون رسوم", code: "pickup" },
          prices: [{ currency_code: "usd", amount: 0 }, { region_id: region.id, amount: 0 }],
          rules,
        },
      ],
    })
    logger.info("created shipping options")
  }

  // 5) المفتاح العام للواجهة
  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "title"],
    filters: { type: "publishable", title: CHANNEL_NAME },
  })
  let key = keys[0]
  if (!key) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: CHANNEL_NAME, type: "publishable", created_by: "" }] },
    })
    key = result[0] as any
    await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: key.id, add: [channel.id] } })
  }

  // 6) التصنيفات
  const existingCats = await categorySvc.listProductCategories({ name: CATEGORIES })
  const missingCats = CATEGORIES.filter((n) => !existingCats.some((c) => c.name === n))
  if (missingCats.length) {
    await createProductCategoriesWorkflow(container).run({
      input: { product_categories: missingCats.map((name) => ({ name, is_active: true })) },
    })
  }

  // أسعار الصرف: تُنشأ فارغة وغير فعّالة
  await rateSvc.ensureDefaults()

  // 7) خيارات الجوالات المقترحة تُضاف لكل منتج عند إنشائه في Medusa v2:
  logger.info("خيارات الجوال المقترحة عند إنشاء منتج: السعة، الرام، اللون، الحالة (جديد / مستعمل / مجدّد)")

  logger.info("========================================")
  logger.info(`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${key.token}`)
  logger.info("========================================")
}
