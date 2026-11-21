import { autoPostText, autoStyle, buildCaption, buildThreadsText, hashtagComment, hooksFor, pickHook, policyWarnings, normalizeHashtags, productUrl, shortCode, shortLinks, suggestHashtags } from "../caption"
import { addComment, feedItemToBatch, postToFacebook, postToInstagram, pushToCatalog } from "../meta-graph"
import { POST_H, POST_MARGIN, POST_W, STORE_MARGIN, STORE_SIZE, fitBox, trimBox } from "../../../admin/lib/quick-add-geometry"

describe("caption", () => {
  it("encodes Arabic handles in the store link", () => {
    expect(productUrl("حماية-الشاشة")).toBe("https://lamsaphone.yemenbay.com/ye/products/%D8%AD%D9%85%D8%A7%D9%8A%D8%A9-%D8%A7%D9%84%D8%B4%D8%A7%D8%B4%D8%A9")
  })
  it("cleans and dedupes hashtags", () => {
    expect(normalizeHashtags("#سامسونج, سامسونج  #Galaxy،galaxy 123 #عروض!")).toEqual(["#سامسونج", "#Galaxy", "#عروض"])
  })
  it("always contains the shop link and hashtags last", () => {
    const c = buildCaption({ title: "S25 Ultra", price: 700, text: "عرض", hashtags: "سامسونج", link: "https://x/ye/products/s25" })
    expect(c).toContain("🛒 تسوّق من متجرنا 👈 https://x/ye/products/s25")
    expect(c).toContain("700$")
    expect(c.trim().endsWith("#سامسونج")).toBe(true)
  })
  it("never cuts the link when the text is too long", () => {
    const c = buildCaption({ title: "T", text: "ا".repeat(5000), link: "https://x/l" })
    expect(c.length).toBeLessThanOrEqual(2200)
    expect(c).toContain("https://x/l")
  })
  it("caps hashtags at 30", () => {
    const tags = Array.from({ length: 50 }, (_, i) => `tag${i}x`).join(" ")
    expect(normalizeHashtags(tags).length).toBe(30)
  })
  it("suggests category hashtags", () => {
    const s = suggestHashtags("Samsung Galaxy S25 Ultra", ["جوالات", "سامسونج"])
    expect(s).toContain("#سامسونج")
    expect(s).toContain("#لمسة_فون")
  })
})

describe("image geometry", () => {
  it("contain keeps the whole image centred", () => {
    const b = fitBox(4000, 3000, 1200, 1400, "contain", 0.06)
    expect(b.w).toBeLessThanOrEqual(1128)
    expect(b.x + b.w / 2).toBeCloseTo(600, 0)
    expect(b.y + b.h / 2).toBeCloseTo(700, 0)
  })
  it("cover fills the frame", () => {
    const b = fitBox(1000, 1000, 1200, 1400, "cover")
    expect(b.w).toBeGreaterThanOrEqual(1200)
    expect(b.h).toBeGreaterThanOrEqual(1400)
  })
  it("trims a uniform white border", () => {
    const w = 100, h = 100
    const d = new Uint8ClampedArray(w * h * 4).fill(255)
    for (let y = 30; y < 70; y++) for (let x = 20; x < 50; x++) d.set([10, 10, 10, 255], (y * w + x) * 4)
    const t = trimBox(d, w, h)
    expect([t.x, t.y, t.w, t.h]).toEqual([20, 30, 30, 40])
    expect(t.bg).toEqual([255, 255, 255])
  })
  it("does not trim busy backgrounds", () => {
    const w = 10, h = 10
    const d = new Uint8ClampedArray(w * h * 4).fill(255)
    d.set([0, 0, 0, 255], 0)
    expect(trimBox(d, w, h).w).toBe(10)
  })
})

describe("meta graph", () => {
  const mock = () => {
    const calls: { url: string; body: Record<string, string> }[] = []
    let n = 0
    const fetchImpl = (async (url: string, init?: any) => {
      const body = init?.body ? Object.fromEntries(new URLSearchParams(init.body.toString())) : {}
      calls.push({ url, body })
      let json: any = { id: `id${++n}` }
      if (url.includes("fields=status_code")) json = { status_code: "FINISHED" }
      if (url.includes("fields=permalink")) json = { permalink: "https://instagram.com/p/x" }
      if (url.includes("items_batch")) json = { handles: ["h1"] }
      return { ok: true, status: 200, json: async () => json } as any
    }) as any
    return { calls, cfg: { token: "T", version: "v24.0", fetchImpl, sleep: async () => {} } }
  }

  it("facebook: unpublished photos then one post", async () => {
    const { calls, cfg } = mock()
    const r = await postToFacebook(cfg, { id: "P", name: "n", page_token: "PT" }, ["https://a/1.jpg", "https://a/2.jpg"], "msg")
    expect(calls.map((c) => c.url.split("v24.0/")[1])).toEqual(["P/photos", "P/photos", "P/feed"])
    expect(calls[2].body.access_token).toBe("PT")
    expect(JSON.parse(calls[2].body.attached_media)).toHaveLength(2)
    expect(r.url).toContain("facebook.com")
  })
  it("instagram: carousel for several images", async () => {
    const { calls, cfg } = mock()
    const r = await postToInstagram(cfg, "IG", "PT", ["https://a/1.jpg", "https://a/2.jpg"], "cap")
    const carousel = calls.find((c) => c.body.media_type === "CAROUSEL")!
    expect(carousel.body.children.split(",")).toHaveLength(2)
    expect(calls.some((c) => c.url.endsWith("IG/media_publish"))).toBe(true)
    expect(r.url).toBe("https://instagram.com/p/x")
  })
  it("instagram: single image", async () => {
    const { calls, cfg } = mock()
    await postToInstagram(cfg, "IG", "PT", ["https://a/1.jpg"], "cap")
    expect(calls[0].body.image_url).toBe("https://a/1.jpg")
    expect(calls[0].body.caption).toBe("cap")
  })
  it("catalog batch keeps feed field names", async () => {
    const { calls, cfg } = mock()
    await pushToCatalog(cfg, "C", [{ "g:id": "v1", "g:price": "700.00 USD", "g:additional_image_link": "a,b" }])
    expect(calls[0].url).toContain("C/items_batch")
    const req = JSON.parse(calls[0].body.requests)[0]
    expect(req).toEqual({ method: "UPDATE", data: { id: "v1", price: "700.00 USD", additional_image_link: ["a", "b"] } })
    expect(feedItemToBatch({ "g:id": "x" }).data).toEqual({ id: "x" })
  })
  it("surfaces Meta error messages", async () => {
    const cfg = { token: "T", version: "v24.0", fetchImpl: (async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid token" } }) })) as any }
    await expect(pushToCatalog(cfg, "C", [{ "g:id": "1" }])).rejects.toThrow("Invalid token")
  })
})

describe("hashtags stay out of the post", () => {
  it("builds the first-comment text separately", () => {
    expect(hashtagComment("سامسونج عروض #عروض")).toBe("#سامسونج #عروض")
    expect(hashtagComment("")).toBe("")
  })
  it("comments on a post", async () => {
    const calls: any[] = []
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, body: Object.fromEntries(new URLSearchParams(init.body.toString())) })
      return { ok: true, status: 200, json: async () => ({ id: "c1" }) }
    }) as any
    await addComment({ token: "T", version: "v24.0", fetchImpl }, "M1", "PT", "#a")
    expect(calls[0].url).toContain("M1/comments")
    expect(calls[0].body.message).toBe("#a")
    expect(calls[0].body.access_token).toBe("PT")
  })
})

describe("short branded links", () => {
  it("builds store and WhatsApp short links from the product id", () => {
    expect(shortCode("prod_01M7HDZ8QET6TF67BD7DFQPWCZ")).toBe("fqpwcz")
    expect(shortLinks("prod_01M7HDZ8QET6TF67BD7DFQPWCZ")).toEqual({ shop: "lamsaphone.yemenbay.com/p/fqpwcz", wa: "lamsaphone.yemenbay.com/wa/fqpwcz" })
  })
  it("posts show the short links, not long URLs", () => {
    const c = buildCaption({ title: "T", link: "lamsaphone.yemenbay.com/p/abc123", waLink: "lamsaphone.yemenbay.com/wa/abc123" })
    expect(c).toContain("🛒 تسوّق من متجرنا 👈 lamsaphone.yemenbay.com/p/abc123")
    expect(c).toContain("💬 اطلب عبر واتساب 👈 lamsaphone.yemenbay.com/wa/abc123")
    expect(c.includes("https://")).toBe(false)
  })
})

describe("instagram captions", () => {
  it("never puts unclickable links in Instagram posts", () => {
    const c = buildCaption({ title: "T", link: "lamsaphone.yemenbay.com/p/abc123", waLink: "lamsaphone.yemenbay.com/wa/abc123", network: "instagram" })
    expect(c).toContain("الرابط في البايو")
    expect(c.includes("lamsaphone.yemenbay.com")).toBe(false)
  })
  it("Facebook posts keep both short links", () => {
    const c = buildCaption({ title: "T", link: "lamsaphone.yemenbay.com/p/abc123", waLink: "lamsaphone.yemenbay.com/wa/abc123", network: "facebook" })
    expect(c).toContain("/p/abc123")
    expect(c).toContain("/wa/abc123")
  })
})

describe("global store image standard", () => {
  it("store image is square 1600, post image is 1080x1350", () => {
    expect(STORE_SIZE).toBe(1600)
    expect([POST_W, POST_H]).toEqual([1080, 1350])
  })
  it("a trimmed product fills about 85% of the store frame", () => {
    for (const [w, h] of [[400, 900], [900, 400], [700, 700]]) {
      const b = fitBox(w, h, STORE_SIZE, STORE_SIZE, "contain", STORE_MARGIN)
      expect(Math.max(b.w, b.h)).toBe(Math.round(STORE_SIZE * 0.85))
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
    }
  })
  it("post frame keeps the whole product with a small margin", () => {
    const b = fitBox(400, 900, POST_W, POST_H, "contain", POST_MARGIN)
    expect(b.h).toBeLessThanOrEqual(POST_H)
    expect(b.h).toBeGreaterThan(POST_H * 0.85)
  })
})

describe("autoPostText", () => {
  it("writes a ready post from phone specs, badge and category", () => {
    const t = autoPostText({
      specs: { screen: "6.8 بوصة Dynamic AMOLED 2X، 120Hz", cpu: "Snapdragon 8 Gen 3", memory: "12GB / 256GB", battery: "5000mAh شحن 45W" },
      badge: "عرض",
      categoryNames: ["سامسونج"],
    })
    expect(t).toContain("🔥 عرض")
    expect(t).toContain("▫️ الشاشة: 6.8 بوصة Dynamic AMOLED 2X، 120Hz")
    expect(t).toContain("▫️ المعالج: Snapdragon 8 Gen 3")
    expect(t).toContain("📂 القسم: سامسونج")
    expect(t).not.toMatch(/مستخدم|جديد/)
  })
  it("uses accessory fields when there are no phone specs, and is empty with no data", () => {
    expect(autoPostText({ specs: { type: "سماعة لاسلكية", features: "عزل ضوضاء" } })).toContain("▫️ النوع: سماعة لاسلكية")
    expect(autoPostText({})).toBe("")
  })
})

import { cleanPlan, planDue, yemenSlot } from "../publish"

describe("threads and schedule", () => {
  it("keeps Threads text within 500 chars and never cuts the links", () => {
    const t = buildThreadsText({ title: "S24 Ultra", price: 700, text: "x".repeat(900), link: "lamsaphone.yemenbay.com/p/abc123", waLink: "lamsaphone.yemenbay.com/wa/abc123" })
    expect(t.length).toBeLessThanOrEqual(500)
    expect(t).toContain("lamsaphone.yemenbay.com/p/abc123")
    expect(t).toContain("lamsaphone.yemenbay.com/wa/abc123")
    expect(t).toContain("💰 السعر: 700$")
  })
  it("cleans plans and runs each one only at its own day and hour", () => {
    const p = cleanPlan({ id: "p1", name: "إنستغرام وحده", enabled: true, days: [6, 6, 9], hours: [25, 11, "20", -1], per_run: 9, dests: ["instagram", "whatsapp_status"] })
    expect(p.days).toEqual([6])
    expect(p.hours).toEqual([11, 20])
    expect(p.per_run).toBe(1)
    expect(p.dests).toEqual(["instagram"])
    const sat11 = yemenSlot(new Date("2026-11-21T08:30:00Z"))
    expect(planDue(p, sat11)).toBe(true)
    expect(planDue({ ...p, last_slot: sat11.key }, sat11)).toBe(false)
    expect(planDue({ ...p, days: [0] }, sat11)).toBe(false)
    expect(planDue({ ...p, enabled: false }, sat11)).toBe(false)
  })
  it("uses Sanaa time for the slot", () => {
    expect(yemenSlot(new Date("2026-11-21T08:30:00Z"))).toEqual({ hour: 11, key: "2026-11-21-11", day: 6 })
    expect(yemenSlot(new Date("2026-11-21T22:10:00Z"))).toEqual({ hour: 1, key: "2026-11-22-1", day: 0 })
  })
})

describe("post styles and Meta policy", () => {
  it("picks a style from the badge or specs, and a stable hook per product", () => {
    expect(autoStyle("عرض")).toBe("offer")
    expect(autoStyle("وصل حديثاً")).toBe("new")
    expect(autoStyle("", { screen: "6.8", cpu: "Snapdragon" })).toBe("power")
    expect(autoStyle("", {})).toBe("classic")
    const h = pickHook("offer", "S24 Ultra", "prod_1")
    expect(hooksFor("offer", "S24 Ultra")).toContain(h)
    expect(pickHook("offer", "S24 Ultra", "prod_1")).toBe(h)
    expect(hooksFor("new", "S24").some((x) => x.includes("S24"))).toBe(true)
  })
  it("puts the hook above the title on every network", () => {
    const c = buildCaption({ title: "S24", hook: "🔥 عرض مميز", link: "x/p/1", waLink: "x/wa/1" })
    expect(c.startsWith("🔥 عرض مميز\n\n📱 S24")).toBe(true)
    expect(buildThreadsText({ title: "S24", hook: "🔥 عرض مميز", link: "x/p/1" }).startsWith("🔥 عرض مميز")).toBe(true)
  })
  it("warns about engagement bait and misleading claims, and passes clean text", () => {
    expect(policyWarnings("اعمل لايك وشارك المنشور ومنشن صديق").length).toBeGreaterThanOrEqual(3)
    expect(policyWarnings("أرخص سعر في العالم").length).toBe(1)
    expect(policyWarnings("✨ وصل حديثاً إلى لمسة فون\nشاشة 6.8 ومعالج قوي")).toEqual([])
    for (const s of ["offer", "new", "best", "power", "value", "classic"]) expect(policyWarnings(hooksFor(s, "S24").join("\n"))).toEqual([])
  })
})

import { autoClosing, mergeSiteTexts, postTextsFrom } from "../../site-texts"

describe("openings and closings from store texts", () => {
  const pt = postTextsFrom(mergeSiteTexts({}))
  it("adds Lamsa Phone openings to every style", () => {
    expect(pt.openings.length).toBeGreaterThan(0)
    expect(hooksFor("classic", "S24", pt.openings).some((h) => h.includes("جديدنا") && h.includes("S24"))).toBe(true)
  })
  it("picks the US-import closing for Samsung, the main one otherwise, and honours an empty closing", () => {
    expect(autoClosing(pt, "Samsung")).toContain("وارد أمريكي")
    expect(autoClosing(pt, "Apple")).toContain("أصلي ومفحوص")
    const withClosing = buildCaption({ title: "S24", link: "x", closing: autoClosing(pt, "Samsung") })
    expect(withClosing).toContain("وارد أمريكي")
    expect(buildCaption({ title: "S24", link: "x", closing: "" })).not.toContain("📍")
    expect(buildCaption({ title: "S24", link: "x" })).toContain("📍")
    expect(policyWarnings(pt.closings.map((c) => c.text).concat(pt.openings).join("\n"))).toEqual([])
  })
})