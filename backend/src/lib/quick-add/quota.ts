// حارس الحصص والتكلفة لطلبات Gemini.
// - النصوص: حد محلي للدقيقة واليوم = (RPM/RPD من AI Studio) × نسبة الأمان. اليوم يبدأ منتصف الليل بتوقيت America/Los_Angeles.
// - 429 من Google: تبريد متصاعد (1، 2، 4… دقائق حتى ساعة) ولا إرسال حتى ينتهي. لا إعادة محاولات سريعة.
// - الصور: ممنوعة في الوضع اليدوي. في المدفوع: سقف شهري ويومي بالدولار؛ بلوغه يوقف الصور ويحوّل إلى اليدوي.
// كل طلب يُرسل يُسجَّل (الوقت، الموديل، النوع، النتيجة، التكلفة التقديرية). المنطق نقي والتخزين يُمرَّر له.

import { GeminiSettings, imageCost } from "./gemini-settings"

export type UsageKind = "text" | "image"
export type UsageResult = "ok" | "error" | "rate_limited" | "refused"
export type UsageEntry = { model: string; kind: UsageKind; result: UsageResult; cost_usd: number; job_id?: string | null }

export type UsageStore = {
  countText: (since: Date) => Promise<number>
  spend: (since: Date) => Promise<number>
  log: (e: UsageEntry) => Promise<void>
  getSettings: () => Promise<GeminiSettings>
  patchSettings: (p: Partial<GeminiSettings>) => Promise<void>
}

export const WAIT_MESSAGE = "وصلت حد الاستخدام المجاني، ستكمل المهمة تلقائياً عند التجدد"
export const MANUAL_MESSAGE = "توليد الصور عبر API متوقف (الوضع اليدوي). استخدم بطاقة التوليد اليدوي أو فعّل الوضع المدفوع من الإعدادات"

export class QuotaWaitError extends Error {
  retryAt: Date
  reason: "minute" | "day" | "cooldown"
  constructor(retryAt: Date, reason: QuotaWaitError["reason"]) {
    super(WAIT_MESSAGE)
    this.retryAt = retryAt
    this.reason = reason
  }
}
export class ManualModeError extends Error {
  constructor() {
    super(MANUAL_MESSAGE)
  }
}
export class CapReachedError extends Error {}

// ---------- الوقت بتوقيت المحيط الهادئ ----------
const TZ = "America/Los_Angeles"
function offsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value || "GMT-8"
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return 0
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0))
}
function ptParts(at: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at)
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value)
  return { y: g("year"), m: g("month"), d: g("day") }
}
function ptMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d)
  // الإزاحة عند منتصف الليل نفسه (قد تختلف يوم تغيير التوقيت الصيفي)
  let t = guess - offsetMinutes(new Date(guess)) * 60_000
  t = guess - offsetMinutes(new Date(t)) * 60_000
  return new Date(t)
}
export function ptDayStart(now: Date): Date {
  const { y, m, d } = ptParts(now)
  return ptMidnight(y, m, d)
}
export function ptNextDayStart(now: Date): Date {
  return ptDayStart(new Date(ptDayStart(now).getTime() + 36 * 3600_000))
}
export function ptMonthStart(now: Date): Date {
  const { y, m } = ptParts(now)
  return ptMidnight(y, m, 1)
}

export const effectiveLimit = (limit: number, pct: number) => (limit > 0 ? Math.max(1, Math.floor((limit * pct) / 100)) : 0)
export const cooldownSeconds = (level: number) => Math.min(3600, 60 * 2 ** Math.max(0, level - 1))
const round = (n: number) => Math.round(n * 10000) / 10000

export class QuotaGuard {
  constructor(private store: UsageStore, private now: () => Date = () => new Date()) {}

  /** يُستدعى قبل كل طلب. يرمي إن لم يُسمح بالإرسال الآن. */
  async before(kind: UsageKind, model: string) {
    const s = await this.store.getSettings()
    const now = this.now()
    if (kind === "image") return this.checkImage(s, model, now)
    if (s.cooldown_until && new Date(s.cooldown_until) > now) throw new QuotaWaitError(new Date(s.cooldown_until), "cooldown")
    const rpm = effectiveLimit(s.rpm, s.safety_pct)
    if (rpm && (await this.store.countText(new Date(now.getTime() - 60_000))) >= rpm) throw new QuotaWaitError(new Date(now.getTime() + 60_000), "minute")
    const rpd = effectiveLimit(s.rpd, s.safety_pct)
    if (rpd && (await this.store.countText(ptDayStart(now))) >= rpd) throw new QuotaWaitError(ptNextDayStart(now), "day")
  }

  private async checkImage(s: GeminiSettings, model: string, now: Date) {
    if (s.image_mode !== "paid_api") throw new ManualModeError()
    if (s.cooldown_until && new Date(s.cooldown_until) > now) throw new QuotaWaitError(new Date(s.cooldown_until), "cooldown")
    const cost = imageCost(s, model)
    const month = await this.store.spend(ptMonthStart(now))
    if (month + cost > s.monthly_cap_usd) return this.capReached(`بلغت السقف الشهري (${s.monthly_cap_usd}$، المستهلك ${round(month)}$)`)
    if (s.daily_cap_usd > 0) {
      const day = await this.store.spend(ptDayStart(now))
      if (day + cost > s.daily_cap_usd) return this.capReached(`بلغت السقف اليومي (${s.daily_cap_usd}$، المستهلك ${round(day)}$)`)
    }
  }

  private async capReached(why: string): Promise<never> {
    const note = `${why}. أوقفنا توليد الصور عبر API وتحوّلنا إلى الوضع اليدوي`
    await this.store.patchSettings({ image_mode: "manual", cap_note: note })
    throw new CapReachedError(note)
  }

  /** يُستدعى بعد كل طلب أُرسل فعلاً. يعيد موعد انتهاء التبريد عند 429. */
  async after(kind: UsageKind, model: string, result: UsageResult, jobId?: string | null): Promise<Date | null> {
    const s = await this.store.getSettings()
    const cost = kind === "image" && result === "ok" ? imageCost(s, model) : 0
    await this.store.log({ model, kind, result, cost_usd: cost, job_id: jobId || null })
    if (result === "rate_limited") {
      const level = s.cooldown_level + 1
      const until = new Date(this.now().getTime() + cooldownSeconds(level) * 1000)
      await this.store.patchSettings({ cooldown_until: until.toISOString(), cooldown_level: level })
      return until
    }
    if (result === "ok" && (s.cooldown_level || s.cooldown_until)) await this.store.patchSettings({ cooldown_level: 0, cooldown_until: null })
    return null
  }

  /** عدّاد الاستهلاك للوحة. */
  async usage() {
    const s = await this.store.getSettings()
    const now = this.now()
    const [minute, today, month_spend, day_spend] = await Promise.all([
      this.store.countText(new Date(now.getTime() - 60_000)),
      this.store.countText(ptDayStart(now)),
      this.store.spend(ptMonthStart(now)),
      this.store.spend(ptDayStart(now)),
    ])
    return {
      text_minute: minute,
      text_today: today,
      rpm_limit: effectiveLimit(s.rpm, s.safety_pct),
      rpd_limit: effectiveLimit(s.rpd, s.safety_pct),
      month_spend: round(month_spend),
      day_spend: round(day_spend),
      monthly_cap: s.monthly_cap_usd,
      daily_cap: s.daily_cap_usd,
      day_resets_at: ptNextDayStart(now).toISOString(),
      cooldown_until: s.cooldown_until && new Date(s.cooldown_until) > now ? s.cooldown_until : null,
    }
  }
}
export type QuotaUsage = Awaited<ReturnType<QuotaGuard["usage"]>>

/** تقدير تكلفة دفعة صور قبل التأكيد. */
export function estimateImages(s: GeminiSettings, count: number, retriesUpTo = 0) {
  const per = imageCost(s)
  return { count, per_image: per, cost_usd: round(per * count), max_cost_usd: round(per * (count + retriesUpTo)) }
}
