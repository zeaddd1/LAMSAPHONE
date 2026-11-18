// استوديو الصور: بناء الخطوات والبرومتات وتقدّم المعالج
import { EMPTY_INPUT, StudioInput, afterCopy, buildSetup, buildSteps, effectiveStyle, markDone, shouldOpenTool } from "../../../admin/lib/image-studio"
import { buildManualPrompts } from "../../../admin/lib/quick-add-angles"

const phone: StudioInput = { ...EMPTY_INPUT, name: "Galaxy S24 Ultra", brand: "Samsung", color: "Titanium Black", parts: "4 vertical lenses", style: "dark" }

describe("image studio", () => {
  it("builds main + 4 angles in order, angles chained in the same chat", () => {
    const s = buildSteps(phone, ["main", "angles"])
    expect(s.map((x) => x.id)).toEqual(["main", "angle_front", "angle_back", "angle_three_quarter", "angle_side"])
    expect(s[1].sameChat).toBe(false)
    expect(s.slice(2).every((x) => x.sameChat)).toBe(true)
    expect(s[1].attach).toBe("reference")
    for (const x of s.filter((y) => y.track !== "copy")) expect(x.prompt).toContain("Output exactly one single image, not a collage or grid.")
    expect(s[0].prompt).toContain("Details to keep exactly: 4 vertical lenses")
    expect(s[0].prompt).toContain("Do not add any store logo")
    // الجوالات تستخدم نفس برومتات بطاقة التوليد اليدوي (تناسق مع الإضافة السريعة)
    const same = buildManualPrompts({ deviceName: "Galaxy S24 Ultra", color: "Titanium Black", parts: "4 vertical lenses", styleText: expect.any(String) as any })
    expect(s[1].prompt.split("\n")[0]).toBe(same[0].split("\n")[0])
  })

  it("honesty: used devices get no generated angles and a forced white studio style", () => {
    const used = { ...phone, condition: "used" as const }
    const s = buildSteps(used, ["main", "angles", "story"])
    expect(s.some((x) => x.track === "angles")).toBe(false)
    expect(effectiveStyle("used", "dark")).toBe("studio")
    expect(effectiveStyle("used", "clean")).toBe("clean")
    expect(s[0].prompt).toMatch(/never hide, smooth or remove any scratch/)
    expect(s[0].prompt).toContain("clean pure white background")
  })

  it("other categories get their own angle wording", () => {
    const s = buildSteps({ ...EMPTY_INPUT, category: "watch", name: "Galaxy Watch 6" }, ["angles"])
    expect(s).toHaveLength(4)
    expect(s[0].prompt).toMatch(/same smartwatch/)
    expect(s[3].prompt).toMatch(/crown and buttons side/)
  })

  it("never puts private data in prompts", () => {
    const s = buildSteps(phone, ["eraser", "main", "angles", "story", "copy"])
    const setup = buildSetup(phone)
    const all = s.map((x) => x.prompt).join("\n") + setup.gem + setup.canva
    expect(all).not.toMatch(/IMEI|supplier name|cost price|سعر التكلفة|المورد:/i)
    expect(s.find((x) => x.id === "copy")!.prompt).toContain("Galaxy S24 Ultra")
  })

  it("copying a prompt moves to the next step and marks the previous copied ones done", () => {
    const s = buildSteps(phone, ["main", "angles"])
    let p = afterCopy({ current: 0, copied: [], done: [] }, s, 0)
    expect(p).toEqual({ current: 1, copied: ["main"], done: [] })
    p = afterCopy(p, s, 1)
    expect(p.current).toBe(2)
    expect(p.done).toEqual(["main"])
    expect(markDone(p, "angle_front").done).toContain("angle_front")
    // آخر خطوة: ينتهي المعالج
    expect(afterCopy(p, s, 4).current).toBe(5)
  })

  it("opens the tool only for a new chat or a different tool", () => {
    const s = buildSteps(phone, ["main", "angles", "story"])
    expect(s.map((_, n) => shouldOpenTool(s, n))).toEqual([true, true, false, false, false, true])
  })
})
