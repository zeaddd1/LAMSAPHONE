import { stripCod } from "../../strip-cod"
import { cleanSiteTexts, mergeSiteTexts, SITE_TEXT_FIELDS } from "../../site-texts"

describe("stripCod", () => {
  it("removes the phrase and keeps the sentence clean", () => {
    expect(stripCod("Galaxy S24 Ultra أصلي: شاشة 6.8، معالج قوي. الدفع عند الاستلام.")).toBe("Galaxy S24 Ultra أصلي: شاشة 6.8، معالج قوي.")
    expect(stripCod("أصلي ومفحوص، توصيل سريع في صنعاء والدفع عند الاستلام.")).toBe("أصلي ومفحوص، توصيل سريع في صنعاء.")
    expect(stripCod("جوالات وإكسسوارات لمسة فون، الدفع عند الاستلام")).toBe("جوالات وإكسسوارات لمسة فون")
    expect(stripCod("توصيل سريع · الدفع عند الاستلام")).toBe("توصيل سريع")
    expect(stripCod("💵 الدفع عند الاستلام: تستلم جهازك، تفحصه بنفسك أمام المندوب، ثم تدفع.")).toBe("💵 تستلم جهازك، تفحصه بنفسك أمام المندوب، ثم تدفع.")
  })
  it("leaves other text untouched", () => {
    expect(stripCod("تستبدل خلال 3 أيام من الاستلام.")).toBe("تستبدل خلال 3 أيام من الاستلام.")
    expect(stripCod("")).toBe("")
  })
})

describe("site texts", () => {
  it("keeps only known keys and falls back to defaults", () => {
    const clean = cleanSiteTexts({ hero_title: "  عروض رمضان ", evil: "x", contact_note: "", footer_faq: 5 })
    expect(clean).toEqual({ hero_title: "عروض رمضان" })
    const merged = mergeSiteTexts(clean)
    expect(merged.hero_title).toBe("عروض رمضان")
    expect(merged.contact_title).toBe("تواصل معنا")
    expect(Object.keys(merged)).toHaveLength(SITE_TEXT_FIELDS.length)
  })
  it("defaults no longer mention cash on delivery", () => {
    SITE_TEXT_FIELDS.forEach((f) => expect(f.default).not.toContain("الدفع عند الاستلام"))
  })
})
