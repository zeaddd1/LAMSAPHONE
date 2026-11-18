import { AiImage, AiJob, QuickAddService } from "../ai-service"
import { GeminiApi, GeminiError, GeminiRequest, KEEP_SAME, buildImagePrompt, isPresetAllowed, mapLimit, parseCopy } from "../gemini"
import { rateLimited } from "../ai-jobs"

// Gemini وهمي: لا اتصال بالإنترنت في الاختبارات
type Handler = (req: GeminiRequest, n: number) => Promise<{ text?: string; image?: { data: string; mimeType: string }; finishReason?: string }>
const mockApi = (h: Handler) => {
  const calls: GeminiRequest[] = []
  const api: GeminiApi = {
    generate: (req) => {
      calls.push(req)
      return h(req, calls.length)
    },
  }
  return { api, calls }
}

const job: AiJob = {
  id: "qaj_1",
  title: "Samsung Galaxy S24 Ultra",
  brand: "Samsung",
  model_name: "S24 Ultra",
  condition: "new",
  parts: "الكاميرا الخلفية 4 عدسات بشكل عمودي، زر الطاقة على اليمين",
  preset: "studio",
  custom_prompt: "",
  input: { price: 900, currency_code: "usd", specs_labeled: { "الرام (RAM)": "12GB" }, variants: [{ storage: "256GB", color: "أسود" }] },
}
const imgs: AiImage[] = (["front", "back", "side", "box"] as const).map((kind, i) => ({
  id: `qai_${i}`,
  kind,
  note: i === 1 ? "اللون الأسود" : "",
  rank: i,
  is_main: i === 0,
  excluded: false,
  source_file_id: `file_${i}`,
}))

function makeService(api: GeminiApi) {
  const updates: Record<string, any[]> = {}
  const svc = new QuickAddService({
    api,
    imageModel: "img-model",
    textModel: "text-model",
    concurrency: 2,
    readImage: async (id) => ({ data: Buffer.from(id).toString("base64"), mimeType: "image/jpeg" }),
    saveImage: async (_img, name) => ({ id: `saved_${name}`, url: `https://x/static/${name}.png` }),
    updateImage: async (id, patch) => {
      ;(updates[id] ||= []).push(patch)
    },
    sleep: async () => {},
  })
  return { svc, updates }
}
const last = (u: Record<string, any[]>, id: string) => u[id][u[id].length - 1]
const promptOf = (r: GeminiRequest) => (r.parts[r.parts.length - 1] as { text: string }).text

describe("QuickAddService: images", () => {
  it("enhances several images, sends the others as references and keeps the device details", async () => {
    const { api, calls } = mockApi(async () => ({ image: { data: "AAAA", mimeType: "image/png" } }))
    const { svc, updates } = makeService(api)
    const r = await svc.enhanceImages(job, imgs)
    expect(r).toEqual({ done: 4, failed: 0 })
    expect(calls).toHaveLength(4)
    for (const c of calls) {
      expect(c.model).toBe("img-model")
      expect(c.wantImage).toBe(true)
      const p = promptOf(c)
      expect(p).toContain("4 عدسات بشكل عمودي")
      expect(p).toContain(KEEP_SAME)
    }
    // الصورة الأمامية: هي نفسها أولاً ثم 2 مرجع (الخلفي والجانبي، بدون العلبة)
    expect(calls[0].parts.filter((p) => "inlineData" in p)).toHaveLength(3)
    expect(promptOf(calls.find((c) => /retail box/.test(promptOf(c)))!)).toMatch(/Do not change, redraw/)
    for (const i of imgs) expect(last(updates, i.id)).toMatchObject({ status: "done", result_url: expect.stringContaining(i.id) })
  })

  it("one failing image does not fail the others, and gets a clear Arabic error", async () => {
    const { api } = mockApi(async (req) => {
      const first = (req.parts[0] as any).inlineData.data
      if (first === Buffer.from("file_2").toString("base64")) return { text: "sorry", finishReason: "STOP" }
      return { image: { data: "AAAA", mimeType: "image/png" } }
    })
    const { svc, updates } = makeService(api)
    const r = await svc.enhanceImages(job, imgs)
    expect(r).toEqual({ done: 3, failed: 1 })
    expect(last(updates, "qai_2")).toMatchObject({ status: "failed" })
    expect(last(updates, "qai_2").error).toMatch(/بدون صورة/)
    expect(last(updates, "qai_0").status).toBe("done")
  })

  it("retries twice on 5xx then succeeds", async () => {
    const { api, calls } = mockApi(async (_r, n) => {
      if (n <= 2) throw new GeminiError("busy", 503, true)
      return { image: { data: "AAAA", mimeType: "image/png" } }
    })
    const { svc } = makeService(api)
    const r = await svc.enhanceImages(job, imgs, ["qai_0"])
    expect(r.done).toBe(1)
    expect(calls).toHaveLength(3)
  })

  it("never retries a 429 quickly (handed to the quota guard), Arabic message", async () => {
    const { api, calls } = mockApi(async () => {
      throw new GeminiError("quota", 429, true)
    })
    const { svc, updates } = makeService(api)
    const r = await svc.enhanceImages(job, imgs, ["qai_1"])
    expect(r.failed).toBe(1)
    expect(calls).toHaveLength(1)
    expect(last(updates, "qai_1").error).toMatch(/حد الاستخدام/)
  })

  it("regenerates only the requested image and skips excluded ones", async () => {
    const { api, calls } = mockApi(async () => ({ image: { data: "AAAA", mimeType: "image/png" } }))
    const { svc } = makeService(api)
    await svc.enhanceImages(job, imgs.map((i) => (i.id === "qai_3" ? { ...i, excluded: true } : i)))
    expect(calls).toHaveLength(3)
    calls.length = 0
    await svc.enhanceImages(job, imgs, ["qai_1"])
    expect(calls).toHaveLength(1)
  })
})

describe("honesty rule", () => {
  it("used and refurbished devices only allow background cleaning", () => {
    expect(isPresetAllowed("used", "floating")).toBe(false)
    expect(isPresetAllowed("refurbished", "lifestyle")).toBe(false)
    expect(isPresetAllowed("used", "studio")).toBe(true)
    expect(isPresetAllowed("used", "watermark_clean")).toBe(true)
    expect(isPresetAllowed("new", "dark")).toBe(true)
  })
  it("forces background-only even if a used job slipped through with another preset", async () => {
    const { api, calls } = mockApi(async () => ({ image: { data: "AAAA", mimeType: "image/png" } }))
    const { svc } = makeService(api)
    await svc.enhanceImages({ ...job, condition: "used", preset: "floating" }, imgs, ["qai_0"])
    const p = promptOf(calls[0])
    expect(p).toMatch(/Only remove supplier watermarks/)
    expect(p).toMatch(/Do not hide, smooth or repair scratches/)
    expect(p).not.toMatch(/floating/)
  })
  it("prompt mentions the note of the photo", () => {
    expect(buildImagePrompt({ title: "X", condition: "new", preset: "studio" }, { kind: "back", note: "اللون الأسود" }, 1)).toContain("اللون الأسود")
  })
})

describe("QuickAddService: texts", () => {
  it("generates the store description and posts from the entered data only (no cost/IMEI)", async () => {
    const { api, calls } = mockApi(async () => ({
      text: '```json\n{"description":"وصف","instagram":"📱 جديد","facebook":"متوفر الآن","hashtags":["#سامسونج","#S24"]}\n```',
    }))
    const { svc } = makeService(api)
    const c = await svc.generateCopy({ ...job, input: { ...job.input, cost: 777, imei: "356938035643809" } as any })
    expect(c).toEqual({ description: "وصف", instagram: "📱 جديد", facebook: "متوفر الآن", hashtags: "#سامسونج #S24" })
    const p = promptOf(calls[0])
    expect(calls[0].json).toBe(true)
    expect(p).toContain("12GB")
    expect(p).toContain("256GB أسود")
    expect(p).not.toContain("777")
    expect(p).not.toContain("356938035643809")
    expect(p).toMatch(/ممنوع منعاً باتاً اختراع/)
  })
  it("rejects a reply that is not JSON with a clear message", () => {
    expect(() => parseCopy("hello")).toThrow(/الصيغة المتوقعة/)
  })
  it("suggests parts from the images with a no-invention rule", async () => {
    const { api, calls } = mockApi(async () => ({ text: "4 عدسات عمودية" }))
    const { svc } = makeService(api)
    expect(await svc.suggestParts(job, imgs)).toBe("4 عدسات عمودية")
    expect(promptOf(calls[0])).toMatch(/فقط ما يُرى بوضوح/)
    expect(calls[0].parts.filter((p) => "inlineData" in p)).toHaveLength(4)
  })
})

describe("helpers", () => {
  it("mapLimit respects the concurrency limit and isolates failures", async () => {
    let active = 0
    let peak = 0
    const r = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((res) => setTimeout(res, 5))
      active--
      if (n === 3) throw new Error("x")
      return n
    })
    expect(peak).toBe(2)
    expect(r.filter((x) => x.status === "rejected")).toHaveLength(1)
  })
  it("rate limit: 10 per minute per user", () => {
    const now = 1_000_000
    for (let i = 0; i < 10; i++) expect(rateLimited("u1", 10, 60_000, now + i)).toBe(false)
    expect(rateLimited("u1", 10, 60_000, now + 20)).toBe(true)
    expect(rateLimited("u2", 10, 60_000, now + 20)).toBe(false)
    expect(rateLimited("u1", 10, 60_000, now + 61_000)).toBe(false)
  })
})
