// استوديو الصور: بناء الخطوات والبرومتات وتقدّم المعالج
import { EMPTY_INPUT, StudioInput, afterCopy, buildSetup, buildSteps, effectiveStyle, gsmSearchUrl, markDone, shouldOpenTool } from "../../../admin/lib/image-studio"

const phone: StudioInput = { ...EMPTY_INPUT, name: "Galaxy S24 Ultra", brand: "Samsung", color: "Titanium Black", parts: "4 vertical lenses", style: "dark" }

describe("image studio", () => {
  it("orders details, main, then the 4 angles with the back view first", () => {
    const s = buildSteps(phone, ["details", "main", "angles"])
    expect(s.map((x) => x.id)).toEqual(["details", "main", "angle_back", "angle_front", "angle_three_quarter", "angle_side"])
    expect(s[2].sameChat).toBe(false)
    expect(s.slice(3).every((x) => x.sameChat)).toBe(true)
  })

  it("one image per prompt: the real photo first, then only the generated back view", () => {
    const s = buildSteps(phone, ["main", "angles"])
    expect(s.map((x) => x.attach)).toEqual(["reference", "reference", "anchor", "anchor", "anchor"])
    for (const x of s.slice(2)) expect(x.prompt).toMatch(/^Same Samsung Galaxy S24 Ultra, same style and lighting as this image/)
  })

  it("prompts are short and carry the essentials", () => {
    const s = buildSteps(phone, ["details", "main", "angles", "story", "copy"])
    for (const x of s) expect(x.prompt.length).toBeLessThan(460)
    const main = s.find((x) => x.id === "main")!.prompt
    expect(main).toContain("Samsung Galaxy S24 Ultra")
    expect(main).toContain("(4 vertical lenses), color Titanium Black")
    expect(main).toContain("No added text, logos or price")
    expect(main).toContain("One single image, no collage.")
  })

  it("uses GSMArena as the reference for phones only", () => {
    const s = buildSteps(phone, ["details", "main", "copy"])
    expect(s[0].prompt).toContain("Samsung Galaxy S24 Ultra page on gsmarena.com")
    expect(s[1].prompt).toContain("Match the real Samsung Galaxy S24 Ultra design on gsmarena.com")
    expect(s[2].prompt).toContain("gsmarena.com")
    const charger = buildSteps({ ...EMPTY_INPUT, category: "charger", name: "25W charger" }, ["details", "main"])
    expect(charger.map((x) => x.id)).toEqual(["main"])
    expect(charger[0].prompt).not.toContain("gsmarena")
    expect(gsmSearchUrl("Galaxy S24")).toBe("https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=Galaxy%20S24")
  })

  it("honesty: used devices get no generated angles and a forced white studio style", () => {
    const s = buildSteps({ ...phone, condition: "used" }, ["main", "angles"])
    expect(s.map((x) => x.id)).toEqual(["main"])
    expect(effectiveStyle("used", "dark")).toBe("studio")
    expect(s[0].prompt).toContain("Do not hide any scratch or wear.")
    expect(s[0].prompt).toContain("clean pure white background")
  })

  it("never puts private data in prompts", () => {
    const s = buildSteps(phone, ["details", "eraser", "main", "angles", "story", "copy"])
    const setup = buildSetup(phone)
    const all = s.map((x) => x.prompt + (x.fallback?.prompt || "")).join("\n") + setup.gem + setup.canva
    expect(all).not.toMatch(/IMEI|supplier name|cost price|سعر التكلفة|المورد:/i)
    expect(s.find((x) => x.id === "angle_side")!.fallback!.prompt).not.toContain("Samsung")
  })

  it("copying a prompt moves to the next step and marks the previous copied ones done", () => {
    const s = buildSteps(phone, ["main", "angles"])
    let p = afterCopy({ current: 0, copied: [], done: [] }, s, 0)
    expect(p).toEqual({ current: 1, copied: ["main"], done: [] })
    p = afterCopy(p, s, 1)
    expect(p.done).toEqual(["main"])
    expect(markDone(p, "angle_back").done).toContain("angle_back")
    expect(afterCopy(p, s, 4).current).toBe(5)
  })

  it("opens the tool only for a new chat or a different tool", () => {
    const s = buildSteps(phone, ["main", "angles", "story"])
    expect(s.map((_, n) => shouldOpenTool(s, n))).toEqual([true, true, false, false, false, true])
  })
})
