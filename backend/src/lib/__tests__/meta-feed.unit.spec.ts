import { detectBrand, itemsToRss, mapCondition, money, productToItems } from "../meta-feed"

const opts = {
  storeUrl: "https://lamsaphone.yemenbay.com",
  countryCode: "ye",
  currency: "usd",
  backendUrl: "https://cp.lamsaphone.yemenbay.com",
  available: () => true,
}

describe("meta feed", () => {
  it("maps Arabic condition values", () => {
    expect(mapCondition("جديد")).toBe("new")
    expect(mapCondition("مستعمل")).toBe("used")
    expect(mapCondition("مجدّد")).toBe("refurbished")
    expect(mapCondition(undefined)).toBe("new")
  })

  it("detects brand from Arabic title, metadata wins", () => {
    expect(detectBrand({ id: "p", title: "آيفون 15", handle: "x" })).toBe("Apple")
    expect(detectBrand({ id: "p", title: "جالكسي A55", handle: "x" })).toBe("Samsung")
    expect(detectBrand({ id: "p", title: "كفر جوال", handle: "x" })).toBe("لمسة فون")
    expect(detectBrand({ id: "p", title: "آيفون", handle: "x", metadata: { brand: "Anker" } })).toBe("Anker")
  })

  it("formats price with two decimals", () => {
    expect(money(750.5, "usd")).toBe("750.50 USD")
  })

  it("builds one item per priced variant with condition, link and sale price", () => {
    const items = productToItems(
      {
        id: "prod_1",
        title: "آيفون 15",
        handle: "iphone-15",
        thumbnail: "/static/a.jpg",
        variants: [
          {
            id: "v1",
            options: [
              { value: "128GB", option: { title: "السعة" } },
              { value: "مستعمل", option: { title: "الحالة" } },
            ],
            calculated_price: { original_amount: 600, calculated_amount: 550 },
          },
          { id: "v2", options: [], calculated_price: null },
        ],
      },
      opts
    )
    expect(items).toHaveLength(1)
    expect(items[0]["g:condition"]).toBe("used")
    expect(items[0]["g:size"]).toBe("128GB")
    expect(items[0]["g:price"]).toBe("600.00 USD")
    expect(items[0]["g:sale_price"]).toBe("550.00 USD")
    expect(items[0]["g:image_link"]).toBe("https://cp.lamsaphone.yemenbay.com/static/a.jpg")
    expect(items[0]["g:link"]).toBe("https://lamsaphone.yemenbay.com/ye/products/iphone-15?v_id=v1")
  })

  it("escapes XML", () => {
    const xml = itemsToRss([{ "g:title": "a & <b>" }], { title: "t", link: "l", description: "d" })
    expect(xml).toContain("<g:title>a &amp; &lt;b&gt;</g:title>")
  })
})
