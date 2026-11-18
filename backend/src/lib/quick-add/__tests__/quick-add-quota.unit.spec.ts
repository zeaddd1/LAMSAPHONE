// حارس الحصص والتكلفة: الحد المحلي، 429 والتبريد، منع الصور في اليدوي، السقف الشهري، إعادة ضبط العدّادات
import { AiImage, AiJob, QuickAddService } from "../ai-service"
import { GeminiApi, GeminiError, GeminiRequest } from "../gemini"
import { DEFAULT_IMAGE_MODEL, DEFAULT_TEXT_MODEL, GeminiSettings, normalizeSettings } from "../gemini-settings"
import { CapReachedError, ManualModeError, QuotaGuard, QuotaWaitError, UsageEntry, UsageStore, cooldownSeconds, ptDayStart, ptNextDayStart } from "../quota"

type Row = UsageEntry & { at: Date }

function memStore(init: Partial<GeminiSettings>, clock: { now: Date }) {
  let saved: Partial<GeminiSettings> = { api_key: "k", ...init }
  const rows: Row[] = []
  const store: UsageStore = {
    countText: async (since) => rows.filter((r) => r.kind === "text" && r.at >= since).length,
    spend: async (since) => rows.filter((r) => r.kind === "image" && r.at >= since).reduce((a, r) => a + r.cost_usd, 0),
    log: async (e) => void rows.push({ ...e, at: new Date(clock.now) }),
    getSettings: async () => normalizeSettings(saved, ""),
    patchSettings: async (p) => void (saved = { ...saved, ...p }),
  }
  return { store, rows, settings: () => normalizeSettings(saved, "") }
}

const job: AiJob = { id: "qaj_1", title: "Galaxy S24", brand: "Samsung", model_name: "S24", condition: "new", parts: "", preset: "studio", custom_prompt: "", input: {} }
const img = (id: string): AiImage => ({ id, kind: "front", note: "", rank: 0, is_main: true, excluded: false, source_file_id: `f_${id}` })

function service(store: UsageStore, clock: { now: Date }, h: (r: GeminiRequest) => Promise<any>) {
  const calls: GeminiRequest[] = []
  const updates: Record<string, any[]> = {}
  const api: GeminiApi = { generate: (r) => (calls.push(r), h(r)) }
  const svc = new QuickAddService({
    api,
    imageModel: DEFAULT_IMAGE_MODEL,
    textModel: DEFAULT_TEXT_MODEL,
    concurrency: 1,
    readImage: async () => ({ data: "AAAA", mimeType: "image/jpeg" }),
    saveImage: async (_i, n) => ({ id: n, url: `https://x/${n}` }),
    updateImage: async (id, p) => void (updates[id] ||= []).push(p),
    sleep: async () => {},
    guard: new QuotaGuard(store, () => clock.now),
    jobId: "qaj_1",
  })
  return { svc, calls, updates }
}
const copyOk = async () => ({ text: JSON.stringify({ description: "d", instagram: "i", facebook: "f", hashtags: "#a" }) })
const PAID = { image_mode: "paid_api" as const, paid_confirmed: true, monthly_cap_usd: 0.1 }

describe("defaults", () => {
  it("uses the new default models and never the deprecated text model", () => {
    const s = normalizeSettings({ text_model: "gemini-2.5-flash" }, "")
    expect(s.text_model).toBe("gemini-3.5-flash-lite")
    expect(s.image_model).toBe("gemini-3.1-flash-lite-image")
    expect(s.image_mode).toBe("manual")
    // لا انتقال تلقائي إلى المدفوع بدون تأكيد وسقف
    expect(normalizeSettings({ image_mode: "paid_api", paid_confirmed: true }, "").image_mode).toBe("manual")
    expect(normalizeSettings({ image_mode: "paid_api", monthly_cap_usd: 5 }, "").image_mode).toBe("manual")
  })
})

describe("text quota guard", () => {
  it("stops sending when the local per-minute limit (RPM x safety %) is reached", async () => {
    const clock = { now: new Date("2026-11-18T10:00:00Z") }
    const { store, rows } = memStore({ rpm: 5, safety_pct: 80 }, clock) // 4 فعلياً
    const { svc, calls } = service(store, clock, copyOk)
    for (let i = 0; i < 4; i++) await svc.generateCopy(job)
    await expect(svc.generateCopy(job)).rejects.toBeInstanceOf(QuotaWaitError)
    await expect(svc.generateCopy(job)).rejects.toThrow("وصلت حد الاستخدام المجاني، ستكمل المهمة تلقائياً عند التجدد")
    expect(calls).toHaveLength(4)
    expect(rows.filter((r) => r.kind === "text")).toHaveLength(4)
    // بعد دقيقة يعود الإرسال
    clock.now = new Date("2026-11-18T10:01:01Z")
    await svc.generateCopy(job)
    expect(calls).toHaveLength(5)
  })

  it("daily limit waits until midnight America/Los_Angeles, then the counter resets", async () => {
    // 07:30Z = 23:30 بتوقيت المحيط الهادئ (PST، UTC-8)
    const clock = { now: new Date("2026-11-18T07:30:00Z") }
    const { store } = memStore({ rpd: 2, safety_pct: 100 }, clock)
    const { svc } = service(store, clock, copyOk)
    await svc.generateCopy(job)
    clock.now = new Date("2026-11-18T07:45:00Z")
    await svc.generateCopy(job)
    clock.now = new Date("2026-11-18T07:50:00Z")
    const err = await svc.generateCopy(job).catch((e) => e)
    expect(err).toBeInstanceOf(QuotaWaitError)
    expect(err.reason).toBe("day")
    expect(err.retryAt.toISOString()).toBe("2026-11-18T08:00:00.000Z")
    clock.now = new Date("2026-11-18T08:00:05Z")
    await expect(svc.generateCopy(job)).resolves.toMatchObject({ description: "d" })
  })

  it("PT day boundaries follow daylight saving time", () => {
    expect(ptDayStart(new Date("2026-07-01T12:00:00Z")).toISOString()).toBe("2026-07-01T07:00:00.000Z") // PDT
    expect(ptDayStart(new Date("2026-12-01T12:00:00Z")).toISOString()).toBe("2026-12-01T08:00:00.000Z") // PST
    expect(ptNextDayStart(new Date("2026-03-07T12:00:00Z")).toISOString()).toBe("2026-03-08T08:00:00.000Z")
    expect(ptNextDayStart(new Date("2026-03-08T12:00:00Z")).toISOString()).toBe("2026-03-09T07:00:00.000Z")
  })
})

describe("429 and cooldown", () => {
  it("one 429 = no fast retry, escalating cooldown, nothing sent until it ends, level resets after success", async () => {
    const clock = { now: new Date("2026-11-18T10:00:00Z") }
    const { store, rows, settings } = memStore({}, clock)
    let fail = true
    const { svc, calls } = service(store, clock, async () => {
      if (fail) throw new GeminiError("Resource exhausted", 429, true)
      return copyOk()
    })
    const e1 = await svc.generateCopy(job).catch((e) => e)
    expect(e1).toBeInstanceOf(QuotaWaitError)
    expect(calls).toHaveLength(1) // بلا إعادة سريعة
    expect(settings().cooldown_level).toBe(1)
    expect(e1.retryAt.toISOString()).toBe("2026-11-18T10:01:00.000Z")
    expect(rows[0]).toMatchObject({ kind: "text", result: "rate_limited", job_id: "qaj_1" })

    // أثناء التبريد: لا إرسال إطلاقاً
    clock.now = new Date("2026-11-18T10:00:30Z")
    await expect(svc.generateCopy(job)).rejects.toBeInstanceOf(QuotaWaitError)
    expect(calls).toHaveLength(1)

    // 429 ثانٍ بعد انتهاء التبريد: دقيقتان
    clock.now = new Date("2026-11-18T10:01:05Z")
    const e2 = await svc.generateCopy(job).catch((e) => e)
    expect(settings().cooldown_level).toBe(2)
    expect(e2.retryAt.getTime() - clock.now.getTime()).toBe(120_000)
    expect(cooldownSeconds(10)).toBe(3600)

    // نجاح بعد التبريد يعيد المستوى للصفر
    fail = false
    clock.now = new Date("2026-11-18T10:04:00Z")
    await svc.generateCopy(job)
    expect(settings().cooldown_level).toBe(0)
    expect(settings().cooldown_until).toBeNull()
  })

  it("images waiting for quota stay pending (job data kept) instead of failing", async () => {
    const clock = { now: new Date("2026-11-18T10:00:00Z") }
    const { store } = memStore(PAID, clock)
    const { svc, updates } = service(store, clock, async () => {
      throw new GeminiError("Resource exhausted", 429)
    })
    const r = await svc.enhanceImages(job, [img("a"), img("b")])
    expect(r).toMatchObject({ done: 0, failed: 0, waiting: ["a", "b"] })
    expect(updates.a[updates.a.length - 1]).toMatchObject({ status: "pending" })
  })

  it("a 429 with a zero free quota is reported as paid only, without cooldown", async () => {
    const clock = { now: new Date("2026-11-18T10:00:00Z") }
    const { store, settings } = memStore({}, clock)
    const { svc } = service(store, clock, async () => {
      throw new GeminiError("Quota exceeded for metric generate_content_free_tier_requests, limit: 0", 429)
    })
    await expect(svc.generateCopy(job)).rejects.toThrow(/المفوترة فقط/)
    expect(settings().cooldown_level).toBe(0)
  })
})

describe("image mode", () => {
  it("manual mode: no image request reaches the API", async () => {
    const clock = { now: new Date("2026-11-18T10:00:00Z") }
    const { store, rows } = memStore({}, clock)
    const { svc, calls, updates } = service(store, clock, async () => ({ image: { data: "AAAA", mimeType: "image/png" } }))
    const r = await svc.enhanceImages(job, [img("a")])
    expect(r).toEqual({ done: 0, failed: 1 })
    expect(calls).toHaveLength(0)
    expect(rows).toHaveLength(0)
    expect(updates.a[updates.a.length - 1].error).toMatch(/الوضع اليدوي/)
    await expect(new QuotaGuard(store).before("image", DEFAULT_IMAGE_MODEL)).rejects.toBeInstanceOf(ManualModeError)
  })

  it("paid_api: logs the estimated cost, stops at the monthly cap and switches to manual", async () => {
    const clock = { now: new Date("2026-11-18T10:00:00Z") }
    // سقف 0.1$ وتكلفة الصورة 0.0336$ = 2 صور فقط (الثالثة تتجاوز)
    const { store, rows, settings } = memStore(PAID, clock)
    const { svc, calls, updates } = service(store, clock, async () => ({ image: { data: "AAAA", mimeType: "image/png" } }))
    const r = await svc.enhanceImages(job, [img("a"), { ...img("b"), rank: 1 }, { ...img("c"), rank: 2 }, { ...img("d"), rank: 3 }])
    expect(r).toEqual({ done: 2, failed: 2 })
    expect(calls).toHaveLength(2)
    expect(rows.map((x) => x.cost_usd)).toEqual([0.0336, 0.0336])
    expect(rows[0]).toMatchObject({ kind: "image", result: "ok", model: DEFAULT_IMAGE_MODEL })
    expect(settings().image_mode).toBe("manual")
    expect(settings().cap_note).toMatch(/السقف الشهري/)
    expect(updates.c[updates.c.length - 1].error).toMatch(/السقف الشهري/)
    // بعد التحويل: الصور ممنوعة كلياً
    await expect(new QuotaGuard(store).before("image", DEFAULT_IMAGE_MODEL)).rejects.toBeInstanceOf(ManualModeError)
  })

  it("paid_api: the daily cap resets at PT midnight, the monthly spend does not", async () => {
    const clock = { now: new Date("2026-11-18T07:00:00Z") }
    const { store } = memStore({ ...PAID, monthly_cap_usd: 10, daily_cap_usd: 0.05, image_costs: { [DEFAULT_IMAGE_MODEL]: 0.04 } }, clock)
    const guard = new QuotaGuard(store, () => clock.now)
    await guard.before("image", DEFAULT_IMAGE_MODEL)
    await guard.after("image", DEFAULT_IMAGE_MODEL, "ok")
    await expect(guard.before("image", DEFAULT_IMAGE_MODEL)).rejects.toBeInstanceOf(CapReachedError)
    // التحويل إلى اليدوي تم؛ يعيد المستخدم تفعيل المدفوع يدوياً ثم يأتي يوم جديد
    await store.patchSettings({ image_mode: "paid_api", cap_note: null })
    clock.now = new Date("2026-11-18T08:30:00Z")
    await expect(guard.before("image", DEFAULT_IMAGE_MODEL)).resolves.toBeUndefined()
    const u = await guard.usage()
    expect(u.day_spend).toBe(0)
    expect(u.month_spend).toBe(0.04)
  })

  it("usage summary shows minute/today counts against the effective limits", async () => {
    const clock = { now: new Date("2026-11-18T10:00:00Z") }
    const { store } = memStore({ rpm: 15, rpd: 1000, safety_pct: 80 }, clock)
    const guard = new QuotaGuard(store, () => clock.now)
    await guard.after("text", DEFAULT_TEXT_MODEL, "ok")
    clock.now = new Date("2026-11-18T10:02:00Z")
    await guard.after("text", DEFAULT_TEXT_MODEL, "ok")
    const u = await guard.usage()
    expect(u).toMatchObject({ text_minute: 1, text_today: 2, rpm_limit: 12, rpd_limit: 800 })
  })
})
