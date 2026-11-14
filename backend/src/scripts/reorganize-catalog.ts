// إعادة تنظيم الأقسام وتسعير المنتجات. آمن للتكرار (idempotent).
// التشغيل من Terminal الباك إند في Coolify:
//   CATALOG_PRICES='{"s24-ultra":350}' npx medusa exec ./src/scripts/reorganize-catalog.ts
// CATALOG_PRICES اختياري: مفتاحه handle المنتج، وقيمته السعر بالدولار (وحدة كاملة).
import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

// الشجرة: قسم رئيسي -> أقسام فرعية (بالماركة)
const TREE: Record<string, string[]> = {
  "جوالات": ["سامسونج", "آيفون", "شاومي", "هواوي", "أونر"],
  "إكسسوارات": ["سماعات", "شواحن وكابلات", "حماية الشاشة", "كفرات", "باور بانك"],
  "أجهزة لوحية": [],
}

// قواعد التصنيف: أول قاعدة تطابق عنوان المنتج تحدد القسم الفرعي
const RULES: [RegExp, string][] = [
  [/سماعة|سماعات|earbud|headphone|airpods|buds/i, "سماعات"],
  [/شاحن|شاحنة|charger|كابل|cable|adapter/i, "شواحن وكابلات"],
  [/حماية|protector|tempered|زجاج/i, "حماية الشاشة"],
  [/كفر|case|cover/i, "كفرات"],
  [/باور|power ?bank/i, "باور بانك"],
  [/تاب|tab|ipad|لوحي|لوحية/i, "أجهزة لوحية"],
  [/samsung|galaxy|سامسونج|\bs\d{2}\b|\ba\d{2}\b/i, "سامسونج"],
  [/iphone|آيفون|ايفون/i, "آيفون"],
  [/xiaomi|redmi|poco|شاومي/i, "شاومي"],
  [/huawei|هواوي/i, "هواوي"],
  [/honor|أونر|اونر/i, "أونر"],
]

export default async function reorganizeCatalog({ container }: ExecArgs) {
  const productSvc = container.resolve(Modules.PRODUCT)
  const prices: Record<string, number> = JSON.parse(process.env.CATALOG_PRICES || "{}")

  // 1) الأقسام الرئيسية والفرعية
  const existing = await productSvc.listProductCategories({}, { take: 200 })
  const byName = new Map(existing.map((c) => [c.name, c]))

  for (const [parentName, children] of Object.entries(TREE)) {
    let parent = byName.get(parentName)
    if (!parent) {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: { product_categories: [{ name: parentName, is_active: true }] },
      })
      parent = result[0]
      byName.set(parentName, parent)
    }
    const missing = children.filter((c) => !byName.has(c))
    if (missing.length) {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: missing.map((name) => ({
            name,
            is_active: true,
            parent_category_id: parent!.id,
          })),
        },
      })
      result.forEach((c) => byName.set(c.name, c))
    }
  }

  // 2) تعيين كل منتج لقسمه الفرعي، وتسعير المنتجات المحددة في CATALOG_PRICES
  const products = await productSvc.listProducts(
    {},
    { take: 500, relations: ["variants"] }
  )
  for (const p of products) {
    const text = `${p.title} ${p.handle}`
    const rule = RULES.find(([re]) => re.test(text))
    const target = rule ? byName.get(rule[1]) : byName.get("جوالات")
    if (target) {
      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: [p.id] },
          update: { category_ids: [target.id] },
        },
      })
    }

    const amount = prices[p.handle]
    if (amount !== undefined && p.variants?.length) {
      await updateProductVariantsWorkflow(container).run({
        input: {
          product_variants: p.variants.map((v) => ({
            id: v.id,
            prices: [{ currency_code: "usd", amount }],
          })),
        },
      })
    }
    console.log(`${p.handle} -> ${rule ? rule[1] : "جوالات"}${amount !== undefined ? ` | USD ${amount}` : ""}`)
  }
  console.log("تم تنظيم الأقسام والمنتجات.")
}
