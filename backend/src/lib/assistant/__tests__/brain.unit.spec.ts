import { DEFAULT_FAQS, analyze, correctArabic, normalize, reply } from "../brain"

const products = [
  { title: "SAMSUNG S 25 ULTRA", handle: "samsung-s-25-ultra", price: 700, category: "سامسونج" },
  { title: "iPhone 15 Pro Max 256GB", handle: "iphone-15-pro-max", price: 950, category: "آيفون" },
  { title: "سماعة AirPods Pro 2", handle: "airpods-pro-2", price: 180, category: "سماعات" },
  { title: "شاحن سامسونج 45 واط", handle: "samsung-charger-45w", price: 25, category: "شواحن" },
]
const faqs = DEFAULT_FAQS.map((f, i) => ({ id: `faq${i}`, ...f }))
const ctx = { storeUrl: "https://lamsaphone.yemenbay.com", whatsapp: "967770777736", products, faqs }

describe("normalize", () => {
  it("unifies Arabic letters, digits and repeats", () => {
    expect(normalize("إستراااحة ٢٥ آيفونٌ")).toBe("استراحه 25 ايفون")
  })
})

describe("dialects", () => {
  it("Yemeni want and price words", () => {
    const a = analyze("اشتي جوال كم حقه")
    expect(a.concepts.has("order")).toBe(true)
    expect(a.concepts.has("price")).toBe(true)
  })
  it("typos are corrected", () => {
    const a = analyze("سامسونق التوصيال")
    expect(a.tokens).toContain("samsung")
    expect(a.concepts.has("delivery")).toBe(true)
  })
})

describe("reply", () => {
  it("prices a product asked in Arabic", () => {
    const r = reply("بكم سامسونج اس 25 الترا؟", ctx)
    expect(r.intent).toBe("product")
    expect(r.text).toContain("700$")
    expect(r.text).toContain("/ye/products/samsung-s-25-ultra")
  })
  it("prices iPhone 15 pro max in Yemeni dialect", () => {
    const r = reply("كم يطلع ايفون 15 برو ماكس", ctx)
    expect(r.products?.[0].handle).toBe("iphone-15-pro-max")
  })
  it("order intent asks for details and flags staff", () => {
    const r = reply("اشتي ايفون 15 برو ماكس", ctx)
    expect(r.intent).toBe("order")
    expect(r.order).toBe(true)
    expect(r.handoff).toBe(true)
    expect(r.text).toContain("الاسم")
  })
  it("answers FAQs in dialect", () => {
    expect(reply("متى توصلون؟", ctx).faq_id).toBe("faq0")
    expect(reply("الدفع كيف يكون", ctx).faq_id).toBe("faq1")
    expect(reply("في ضمان؟", ctx).faq_id).toBe("faq2")
    expect(reply("وين محلكم", ctx).faq_id).toBe("faq4")
  })
  it("hands off to a human on request", () => {
    const r = reply("ابغى اكلم موظف", ctx)
    expect(r.intent).toBe("handoff")
    expect(r.handoff).toBe(true)
  })
  it("greets", () => {
    expect(reply("السلام عليكم", ctx).intent).toBe("greeting")
  })
  it("falls back to a human for unknown text", () => {
    const r = reply("عندي مشكلة في الطلب رقم 1234 لم يصل", ctx)
    expect(r.handoff).toBe(true)
  })
  it("accessory search", () => {
    const r = reply("عندكم شاحن سامسونج؟", ctx)
    expect(r.products?.[0].handle).toBe("samsung-charger-45w")
  })
})

describe("correctArabic", () => {
  it("fixes common mistakes and punctuation", () => {
    expect(correctArabic("انشاء الله يوصلك بكرة , شكرا")).toBe("إن شاء الله يوصلك بكرة، شكراً")
    expect(correctArabic("هل تريد اللون الاسود ?")).toBe("هل تريد اللون الاسود؟")
  })
})

describe("dialect lexicon (from YBHub packs)", () => {
  it("Yemeni opening-hours phrases", () => {
    expect(analyze("عادكم فاتحين هسع؟").concepts.has("hours")).toBe(true)
  })
  it("Saudi and Gulf price/want words", () => {
    const a = analyze("وش السعر ابغاه")
    expect(a.concepts.has("price")).toBe(true)
  })
  it("asks for a human in dialect", () => {
    expect(reply("حولني على موظف", ctx).intent).toBe("handoff")
  })
  it("order status goes to staff", () => {
    expect(reply("طلبي تاخر وين وصل", ctx).handoff).toBe(true)
  })
})

describe("order follow-up", () => {
  it("where is my order goes to staff, delivery question to FAQ", () => {
    expect(reply("فين طلبي", ctx).intent).toBe("handoff")
    expect(reply("متى توصلون؟", ctx).faq_id).toBe("faq0")
  })
})
