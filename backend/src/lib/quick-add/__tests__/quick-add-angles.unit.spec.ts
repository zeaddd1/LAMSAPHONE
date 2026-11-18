// الزوايا الأربع + التوليد اليدوي
const createImages = jest.fn(async (x: any) => x)
const updateImages = jest.fn(async (x: any) => x)
let mockImages: any[] = []
jest.mock("../ai-jobs", () => ({
  loadJob: async () => ({ job: { id: "qaj_1", status: "ready_for_review", condition: "new", product_id: null }, images: mockImages }),
  quickAdd: () => ({ createQuickAddImages: createImages, updateQuickAddImages: updateImages }),
  serializeJob: (job: any, images: any[]) => ({ ...job, images }),
}))

import { AiImage, AiJob, QuickAddService } from "../ai-service"
import { GeminiApi, GeminiRequest, ONE_IMAGE } from "../gemini"
import { POST as manualAngle } from "../../../api/admin/quick-add/jobs/[id]/manual-angle/route"
import { buildManualPrompts, isGuessedAngle, shouldOfferManual } from "../../../admin/lib/quick-add-angles"

const job: AiJob = {
  id: "qaj_1",
  title: "Samsung Galaxy S24 Ultra",
  brand: "Samsung",
  model_name: "S24 Ultra",
  condition: "new",
  parts: "4 عدسات عمودية، الأزرار يميناً، USB-C بالأسفل",
  preset: "studio",
  custom_prompt: "",
  input: { private_should_not_leak: true },
}
const upload = (id: string, kind: string, main = false): AiImage => ({ id, kind, note: "", rank: 0, is_main: main, excluded: false, source_file_id: `file_${id}`, source: "upload" })
const angle = (a: string): AiImage => ({ id: `ang_${a}`, kind: `angle_${a}`, note: "", rank: 100, is_main: false, excluded: false, source_file_id: "file_u1", source: "api", status: "pending" })
const angles = ["front", "back", "three_quarter", "side"].map(angle)

const imgCount = (r: GeminiRequest) => r.parts.filter((p) => "inlineData" in p).length
const text = (r: GeminiRequest) => (r.parts[r.parts.length - 1] as { text: string }).text

function setup(h: (req: GeminiRequest) => Promise<any>) {
  const calls: GeminiRequest[] = []
  const updates: Record<string, any[]> = {}
  const api: GeminiApi = { generate: (req) => (calls.push(req), h(req)) }
  const svc = new QuickAddService({
    api,
    imageModel: "img",
    textModel: "txt",
    concurrency: 2,
    readImage: async (id) => ({ data: Buffer.from(id).toString("base64"), mimeType: "image/jpeg" }),
    saveImage: async (_i, name) => ({ id: `saved_${name}`, url: `https://x/${name}.png` }),
    updateImage: async (id, patch) => void (updates[id] ||= []).push(patch),
    sleep: async () => {},
  })
  return { svc, calls, updates }
}
const last = (u: Record<string, any[]>, id: string) => u[id][u[id].length - 1]
const ok = async () => ({ image: { data: "AAAA", mimeType: "image/png" } })

describe("angles pack", () => {
  it("generates 4 separate images: front first, then the rest with the front result as reference", async () => {
    const { svc, calls, updates } = setup(ok)
    const r = await svc.generateAnglePack(job, [upload("u1", "front", true)], angles)
    expect(r).toEqual({ done: 4, failed: 0 })
    expect(calls).toHaveLength(4)
    expect(text(calls[0])).toMatch(/image 1 of 4 now: FRONT VIEW/)
    expect(imgCount(calls[0])).toBe(1)
    for (const c of calls.slice(1)) {
      expect(imgCount(c)).toBe(2) // المرجع + الأمامي المولّد
      expect(text(c)).toMatch(/image 1 of this set \(front view\)/)
    }
    for (const c of calls) {
      expect(c.aspectRatio).toBe("1:1")
      expect(text(c)).toContain(ONE_IMAGE)
      expect(text(c)).toContain("4 عدسات عمودية")
      expect(text(c)).toContain("clean pure white background")
      expect(text(c)).not.toContain("private_should_not_leak")
    }
    for (const a of angles) expect(last(updates, a.id)).toMatchObject({ status: "done" })
  })

  it("uses a real back photo as the reference for the back angle", async () => {
    const { svc, calls } = setup(ok)
    await svc.generateAnglePack(job, [upload("u1", "front", true), upload("u2", "back")], angles)
    const back = calls.find((c) => /BACK VIEW/.test(text(c)))!
    expect(imgCount(back)).toBe(3)
    expect(text(back)).toMatch(/real photo of the device from this exact angle/)
    expect(isGuessedAngle("back", ["front", "back"])).toBe(false)
    expect(isGuessedAngle("side", ["front", "back"])).toBe(true)
  })

  it("one refused angle retries once with a simplified prompt, then fails alone", async () => {
    const { svc, calls, updates } = setup(async (req) => (/SIDE VIEW/.test(text(req)) ? { finishReason: "PROHIBITED_CONTENT" } : ok()))
    const r = await svc.generateAnglePack(job, [upload("u1", "front", true)], angles)
    expect(r).toEqual({ done: 3, failed: 1 })
    const side = calls.filter((c) => /SIDE VIEW/.test(text(c)))
    expect(side).toHaveLength(2)
    expect(imgCount(side[1])).toBe(1) // بلا مراجع إضافية
    expect(last(updates, "ang_side")).toMatchObject({ status: "failed" })
    expect(last(updates, "ang_side").error).toMatch(/الوضع اليدوي/)
    expect(last(updates, "ang_back").status).toBe("done")
  })

  it("regenerates one angle only, reusing the existing front result", async () => {
    const { svc, calls } = setup(ok)
    const done = angles.map((a) => (a.kind === "angle_front" ? { ...a, status: "done", result_file_id: "front_res" } : a))
    await svc.generateAnglePack(job, [upload("u1", "front", true)], done, ["back"])
    expect(calls).toHaveLength(1)
    expect(imgCount(calls[0])).toBe(2)
  })

  it("blocks used and refurbished devices", async () => {
    const { svc, calls } = setup(ok)
    await expect(svc.generateAnglePack({ ...job, condition: "used" }, [upload("u1", "front", true)], angles)).rejects.toThrow("الأجهزة المستعملة: استخدم صوراً حقيقية للجهاز")
    await expect(svc.generateAnglePack({ ...job, condition: "refurbished" }, [upload("u1", "front", true)], angles)).rejects.toThrow(/المستعملة/)
    expect(calls).toHaveLength(0)
  })

  it("does not overwrite manual angles when generating all", async () => {
    const { svc, calls } = setup(ok)
    await svc.generateAnglePack(job, [upload("u1", "front", true)], angles.map((a) => (a.kind === "angle_back" ? { ...a, source: "manual" } : a)))
    expect(calls.some((c) => /BACK VIEW/.test(text(c)))).toBe(false)
    expect(calls).toHaveLength(3)
  })
})

describe("manual Gemini fallback", () => {
  it("builds the 4 prompts from the device name, colour, parts and style only", () => {
    const p = buildManualPrompts({ deviceName: "Galaxy S24 Ultra", color: "Titanium Black", parts: "4 lenses", styleText: "clean pure white background" })
    expect(p).toHaveLength(4)
    expect(p[0]).toContain("Product: Galaxy S24 Ultra")
    expect(p[0]).toContain("Color: Titanium Black")
    expect(p[0]).toContain("Details to keep exactly: 4 lenses")
    expect(p[0]).toContain("Fixed style for ALL images in the set: clean pure white background")
    expect(p[0]).toMatch(/image 1 of 4 now: FRONT VIEW/)
    expect(p[1]).toMatch(/^Now generate image 2 of 4.*BACK VIEW/)
    expect(p[2]).toMatch(/THREE-QUARTER VIEW/)
    expect(p[3]).toMatch(/SIDE VIEW/)
    for (const x of p) expect(x).toContain("Output exactly one single image, not a collage or grid.")
    // الاسم قابل للتعديل: البرومتات تتغير معه
    expect(buildManualPrompts({ deviceName: "iPhone 16", styleText: "s" })[0]).toContain("Product: iPhone 16")
  })

  it("offers the manual card automatically when the API does not work", () => {
    expect(shouldOfferManual({ has_key: false, status: "disconnected" })).toBe(true)
    expect(shouldOfferManual({ has_key: true, status: "error" })).toBe(true)
    expect(shouldOfferManual({ has_key: true, status: "connected" }, { status: "ready_for_review", images: [] })).toBe(false)
    // فشل التوليد كاملاً (حد الاستخدام/شبكة)
    expect(shouldOfferManual({ has_key: true, status: "connected" }, { status: "failed", images: [{ kind: "front", status: "failed" }] })).toBe(true)
    // رفض زاوية
    expect(shouldOfferManual({ has_key: true, status: "connected" }, { status: "ready_for_review", images: [{ kind: "angle_side", status: "failed", source: "api" }] })).toBe(true)
  })

  it("links a manual upload to the right angle as a manual record", async () => {
    mockImages = [{ id: "qai_up", kind: "front", source: "upload" }]
    let body: any
    const res: any = { status: () => res, json: (b: any) => (body = b) }
    const scope = { resolve: () => ({ deleteFiles: async () => {} }) }
    await manualAngle({ scope, params: { id: "qaj_1" }, validatedBody: { angle: "back", file_id: "f_back", url: "https://x/back.jpg" } } as any, res)
    expect(createImages).toHaveBeenCalledWith(
      expect.objectContaining({ job_id: "qaj_1", kind: "angle_back", source: "manual", result_file_id: "f_back", result_url: "https://x/back.jpg", status: "done" })
    )
    // استبدال صورة يدوية موجودة لنفس الزاوية
    mockImages = [{ id: "qai_b", kind: "angle_back", source: "manual", source_file_id: "old", result_file_id: "old" }]
    await manualAngle({ scope, params: { id: "qaj_1" }, validatedBody: { angle: "back", file_id: "f2", url: "https://x/2.jpg" } } as any, res)
    expect(updateImages).toHaveBeenCalledWith(expect.objectContaining({ id: "qai_b", source: "manual", result_file_id: "f2" }))
    expect(body.job.id).toBe("qaj_1")
  })
})
