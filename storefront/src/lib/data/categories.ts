import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

/**
 * الأقسام التي فيها منتجات منشورة (هي أو أحد أقسامها الفرعية).
 * الأقسام الفارغة (مثل ماركة لم يُضف لها منتج بعد) تُخفى من الواجهة تلقائياً، وتظهر وحدها عند إضافة أول منتج.
 */
export const usedCategoryIds = async (): Promise<Set<string> | null> => {
  const next = { ...(await getCacheOptions("categories")) }
  try {
    const { products } = await sdk.client.fetch<{ products: { id: string; categories?: { id: string; parent_category_id?: string | null; mpath?: string }[] }[] }>(
      "/store/products",
      { query: { fields: "id,*categories", limit: 1000 }, next: { ...next, revalidate: 60 } }
    )
    const ids = new Set<string>()
    for (const p of products) for (const c of p.categories || []) {
      ids.add(c.id)
      if (c.parent_category_id) ids.add(c.parent_category_id)
      for (const a of (c.mpath || "").split(".")) if (a) ids.add(a) // كل الأقسام الأعلى
    }
    return ids
  } catch {
    return null // عند تعذّر الفحص لا نخفي شيئاً
  }
}

type Cat = HttpTypes.StoreProductCategory
/** يحذف الأقسام الفارغة من القائمة ومن أقسامها الفرعية */
export const withoutEmpty = <T extends Cat>(cats: T[], used: Set<string> | null): T[] => {
  if (!used) return cats
  const has = (c: Cat): boolean => used.has(c.id) || (c.category_children || []).some((x) => has(x as Cat))
  return cats
    .filter(has)
    .map((c) => ({ ...c, category_children: (c.category_children || []).filter((x) => has(x as Cat)) }))
}

export const listCategories = async (query?: Record<string, any>) => {
  const next = {
    ...(await getCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next: { ...next, revalidate: 60 },
      }
    )
    .then(async ({ product_categories }) => withoutEmpty(product_categories, await usedCategoryIds()))
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  // الأسماء العربية تصل مرمَّزة (%D8...) فنفكّها قبل البحث، وإلا تظهر الصفحة 404
  const handle = categoryHandle
    .map((h) => {
      try {
        return decodeURIComponent(h)
      } catch {
        return h
      }
    })
    .join("/")

  const next = {
    ...(await getCacheOptions("categories")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        next: { ...next, revalidate: 60 },
      }
    )
    .then(async ({ product_categories }) => {
      const c = product_categories[0]
      if (!c) return c
      const used = await usedCategoryIds()
      return used ? { ...c, category_children: withoutEmpty(c.category_children as Cat[], used) } : c
    })
}
