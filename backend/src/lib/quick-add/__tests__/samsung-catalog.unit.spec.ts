import { CATALOG, buildVariants, describe as describeModel, productPayload, refreshPayload } from "../../../admin/lib/samsung-catalog"
import { cleanHomeConfig } from "../../home-config"

describe("samsung catalog", () => {
  it("covers S9 to S26 in order, with Arabic names and unique handles", () => {
    expect(CATALOG[0].model).toBe("Galaxy S9")
    expect(CATALOG[CATALOG.length - 1].model).toMatch(/S26/)
    expect(new Set(CATALOG.map((m) => m.handle)).size).toBe(CATALOG.length)
    for (const m of CATALOG) {
      expect(m.title).toMatch(/^سامسونج جالاكسي S\d/)
      expect(m.storages.length).toBeGreaterThan(0)
      expect(m.specs.length).toBeGreaterThanOrEqual(8)
    }
  })
  it("short Arabic description", () => {
    for (const m of CATALOG) {
      const d = describeModel(m)
      expect(d.length).toBeLessThan(330)
      expect(d).toContain(m.title)
    }
  })
  it("variants: storage x color, no prices, no inventory tracking", () => {
    const m = CATALOG.find((x) => x.model === "Galaxy S24 Ultra")!
    const { options, variants } = buildVariants(m)
    expect(options.map((o) => o.title)).toEqual(["السعة", "اللون"])
    expect(variants.length).toBe(m.storages.length * m.colors.length)
    expect(variants.every((v) => v.prices.length === 0 && v.manage_inventory === false)).toBe(true)
  })
  it("payload uses static store images and keeps prices untouched on refresh", () => {
    const m = CATALOG.find((x) => x.images.length)!
    const p = productPayload(m, { category_id: "pcat_1" }, "https://shop.test")
    expect(p.thumbnail).toBe(`https://shop.test/${m.images[0].path}`)
    expect(p.status).toBe("published")
    const r: any = refreshPayload(m, { condition: "new", meta_images: ["x"] })
    expect(r.variants).toBeUndefined()
    expect(r.metadata.meta_images).toEqual(["x"])
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
    expect(c.banners[0]).toMatchObject({ link: "", image: "", theme: "navy" })
    expect(c.banners[1]).toMatchObject({ link: "/products/a", theme: "orange" })
    expect(c.featured).toEqual(["prod_01ABC"])
  })
})
