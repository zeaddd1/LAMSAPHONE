// فشل منصة واحدة لا يلغي المنتج ولا المنصة الأخرى (مسار النشر الذي يستدعيه الاعتماد في الوضعين)
jest.mock("../meta-settings", () => ({
  getMetaSettings: async () => ({ token: "t", page_id: "123456", catalog_id: "", ig_user_id: "", graph_version: "v24.0" }),
}))
jest.mock("../../meta-feed-builder", () => ({
  backendUrl: () => "https://cp.example.com",
  storeUrl: () => "https://shop.example.com",
  buildMetaFeed: async () => ({ items: [] }),
  clearMetaFeedCache: () => {},
}))
jest.mock("../meta-graph", () => ({
  getPage: async () => ({ id: "123456", name: "P", page_token: "pt", ig: { id: "999" } }),
  postToFacebook: jest.fn(async () => {
    throw new Error("فيسبوك رفض المنشور")
  }),
  postToInstagram: jest.fn(async () => ({ id: "ig1", url: "https://instagram.com/p/1" })),
  addComment: jest.fn(async () => ({ id: "c1" })),
  postVideoToFacebook: jest.fn(),
  postReelToInstagram: jest.fn(),
  pushToCatalog: jest.fn(),
}))

import { POST } from "../../../api/admin/quick-add/publish/route"
import { postToInstagram } from "../meta-graph"

describe("publish route", () => {
  it("records Instagram success even when Facebook fails, and uses the Instagram text", async () => {
    const updateProducts = jest.fn(async () => ({}))
    const product = {
      id: "prod_1",
      title: "S24 Ultra",
      handle: "s24-ultra",
      thumbnail: "https://cp.example.com/static/a.webp",
      metadata: { meta_images: ["https://cp.example.com/static/a.jpg", "https://cp.example.com/static/b.jpg"] },
      images: [],
      variants: [{ prices: [{ amount: 900, currency_code: "usd" }] }],
    }
    const scope = {
      resolve: (k: string) => (k === "query" ? { graph: async () => ({ data: [product] }) } : { updateProducts }),
    }
    let body: any
    const res: any = { status: () => res, json: (b: any) => (body = b) }
    await POST({ scope, validatedBody: { product_id: "prod_1", facebook: true, instagram: true, catalog: false, text: "نص فيسبوك", ig_text: "نص إنستغرام", hashtags: "#سامسونج", use_video: true } } as any, res)
    expect(body.results.facebook).toMatchObject({ ok: false, error: "فيسبوك رفض المنشور" })
    expect(body.results.instagram).toMatchObject({ ok: true, url: "https://instagram.com/p/1" })
    expect(body.results.catalog).toMatchObject({ skipped: true })
    // ألبوم إنستغرام بكل الصور، ونصه الخاص
    const call = (postToInstagram as jest.Mock).mock.calls[0]
    expect(call[3]).toHaveLength(2)
    expect(call[4]).toContain("نص إنستغرام")
    // يُسجَّل نجاح إنستغرام فقط في المنتج
    const saved = (updateProducts.mock.calls[0] as any[])[1].metadata.meta_published
    expect(Object.keys(saved)).toEqual(["instagram"])
  })
})
