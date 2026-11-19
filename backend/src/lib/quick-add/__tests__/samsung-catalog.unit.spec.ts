import { CATALOG, describe as describeModel, imageUrls } from "../../../admin/lib/samsung-catalog"
import { SPEC_FIELDS, cleanSpecs } from "../../../admin/lib/product-specs"
import { buildOptions, optionMode, titleWith } from "../../../admin/lib/product-options"
import { cleanHomeConfig } from "../../home-config"

describe("samsung catalog", () => {
  it("covers S9 to S26 in order, with Arabic names, colors and keyed specs", () => {
    const sam = CATALOG.filter((m) => m.brand === "Samsung")
    expect(sam[0].model).toBe("Galaxy S9")
    expect(sam[sam.length - 1].model).toMatch(/S26/)
    expect(new Set(CATALOG.map((m) => m.handle)).size).toBe(CATALOG.length)
    const keys = SPEC_FIELDS.map((f) => f.key) as string[]
    for (const m of sam) {
      expect(m.category).toEqual(["جوالات", "سامسونج"])
      expect(m.title).toMatch(/^سامسونج جالاكسي S\d/)
      expect(m.storages.length).toBeGreaterThan(0)
      expect(Object.keys(m.specs).length).toBeGreaterThanOrEqual(8)
      expect(Object.keys(m.specs).every((k) => keys.includes(k))).toBe(true)
      for (const c of m.colors) expect(c).toMatch(/[\u0600-\u06FF]/)
    }
  })
  it("apple: iPhones 11..18 under جوالات › آبل, AirPods under سماعات, the rest under إكسسوارات", () => {
    const keys = SPEC_FIELDS.map((f) => f.key) as string[]
    const ap = CATALOG.filter((m) => m.brand === "Apple")
    expect(ap.length).toBe(41)
    for (const m of ap) {
      expect(m.title).toMatch(/[\u0600-\u06FF]/)
      expect(Object.keys(m.specs).every((k) => keys.includes(k))).toBe(true)
      expect(m.category[1]).toBe("آبل")
      for (const i of m.images) expect(i.path).toMatch(/^catalog\/apple\/[\w-]+\/\d+\.webp$/)
    }
    const phones = ap.filter((m) => m.category[0] === "جوالات")
    expect(phones.length).toBe(33)
    for (const m of phones) expect(m.storages.length).toBeGreaterThan(0)
    expect(ap.find((m) => m.handle === "apple-iphone-15-pro-max")!.title).toBe("آبل آيفون 15 برو ماكس")
    expect(ap.filter((m) => m.category[0] === "سماعات").length).toBe(4)
    expect(describeModel(ap.find((m) => m.handle === "apple-airtag")!)).toContain("جهاز التتبع")
  })
  it("short Arabic description", () => {
    for (const m of CATALOG) {
      const d = describeModel(m)
      expect(d.length).toBeLessThan(300)
      expect(d).toContain(m.title)
    }
  })
  it("static image urls", () => {
    const m = CATALOG.find((x) => x.images.length)!
    expect(imageUrls(m, "https://shop.test/")[0]).toBe(`https://shop.test/${m.images[0].path}`)
  })
})

describe("product options", () => {
  it("none / fixed / customer choice", () => {
    expect(optionMode([])).toBe("none")
    expect(optionMode(["256GB"])).toBe("fixed")
    expect(optionMode(["256GB", "512GB"])).toBe("choice")
    const a = buildOptions([], [], null)
    expect(a.variants).toHaveLength(1)
    expect(a.variants[0].prices).toEqual([])
    const b = buildOptions(["256GB"], ["أسود"], 500)
    expect(b.options[0].title).toBe("الخيار")
    expect(b.variants[0].prices).toEqual([{ currency_code: "usd", amount: 500 }])
    const c = buildOptions(["256GB", "512GB"], ["أسود", "أبيض", "أزرق"], null)
    expect(c.options.map((o) => o.title)).toEqual(["السعة", "اللون"])
    expect(c.variants).toHaveLength(6)
    expect(c.variants[5].options).toEqual({ السعة: "512GB", اللون: "أزرق" })
    const d = buildOptions(["256GB"], ["أسود", "أبيض"], null)
    expect(d.options.map((o) => o.title)).toEqual(["اللون"])
    expect(titleWith("سامسونج S24", ["256GB", "أسود", ""])).toBe("سامسونج S24 256GB أسود")
    expect(titleWith("S24 256GB", ["256gb"])).toBe("S24 256GB")
  })
  it("cleanSpecs keeps known non-empty fields only", () => {
    expect(cleanSpecs({ screen: " 6.8 ", cpu: "", hack: "x" } as any)).toEqual({ screen: "6.8" })
  })
})

describe("home config", () => {
  it("keeps only safe links and images, drops untitled banners", () => {
    const c = cleanHomeConfig({
      banners: [
        { title: "عرض", link: "javascript:alert(1)", image: "data:x", theme: "pink" },
        { title: "", link: "/store" },
        { title: "S24", link: "/products/a", image: "https://x.test/a.webp", theme: "orange" },
      ],
      featured: ["prod_01ABC", "bad id", 5],
    })
    expect(c.banners.length).toBe(2)
    expect(c.banners[0]).toMatchObject({ link: "", image: "", theme: "light" })
    expect(c.banners[1]).toMatchObject({ link: "/products/a", theme: "orange" })
    expect(c.featured).toEqual(["prod_01ABC"])
  })
})
