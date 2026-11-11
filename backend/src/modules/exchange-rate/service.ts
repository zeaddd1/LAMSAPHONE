import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import ExchangeRate from "./models/exchange-rate"
import ExchangeRateHistory from "./models/exchange-rate-history"
import { DisplayCurrency } from "../../lib/currency"

export type RateUpdate = {
  code: DisplayCurrency
  rate_per_usd: number
  rounding_step: number
  is_active: boolean
}

// العملات الأربع وقيمها الأولية. الأسعار صفر وغير فعّالة: المدير هو من يدخلها.
export const DEFAULT_RATES = [
  { code: "USD", label_ar: "دولار", symbol: "$", rate_per_usd: 1, rounding_step: 0.01, is_active: true },
  { code: "SAR", label_ar: "ريال سعودي", symbol: "ر.س", rate_per_usd: 0, rounding_step: 0.5, is_active: false },
  { code: "YER_OLD", label_ar: "ريال يمني (قديم)", symbol: "ر.ي (قديم)", rate_per_usd: 0, rounding_step: 100, is_active: false },
  { code: "YER_NEW", label_ar: "ريال يمني (جديد)", symbol: "ر.ي (جديد)", rate_per_usd: 0, rounding_step: 100, is_active: false },
] as const

class ExchangeRateModuleService extends MedusaService({
  ExchangeRate,
  ExchangeRateHistory,
}) {
  /** ينشئ العملات الناقصة فقط (آمن لإعادة التشغيل). */
  async ensureDefaults() {
    const existing = await this.listExchangeRates({})
    const have = new Set(existing.map((r) => r.code))
    const missing = DEFAULT_RATES.filter((r) => !have.has(r.code)).map((r) => ({ ...r }))
    if (missing.length) await this.createExchangeRates(missing)
    return missing.length
  }

  /** يحدّث عدة أسعار ويحفظ كل تغيير في السجل. */
  async updateRatesWithHistory(updates: RateUpdate[], changedBy?: string) {
    const current = await this.listExchangeRates({ code: updates.map((u) => u.code) })
    const byCode = new Map(current.map((r) => [r.code, r]))
    const toUpdate: any[] = []
    const history: any[] = []

    for (const u of updates) {
      const row = byCode.get(u.code)
      if (!row) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Unknown currency ${u.code}`)
      // الدولار ثابت = 1 ولا يُعدّل
      const next = u.code === "USD" ? { ...u, rate_per_usd: 1, is_active: true } : u
      const same =
        Number(row.rate_per_usd) === next.rate_per_usd &&
        Number(row.rounding_step) === next.rounding_step &&
        row.is_active === next.is_active
      if (same) continue
      toUpdate.push({ id: row.id, rate_per_usd: next.rate_per_usd, rounding_step: next.rounding_step, is_active: next.is_active })
      history.push({
        code: u.code,
        old_rate: Number(row.rate_per_usd),
        new_rate: next.rate_per_usd,
        old_rounding_step: Number(row.rounding_step),
        new_rounding_step: next.rounding_step,
        old_is_active: row.is_active,
        new_is_active: next.is_active,
        changed_by: changedBy ?? null,
      })
    }

    if (toUpdate.length) {
      await this.updateExchangeRates(toUpdate)
      await this.createExchangeRateHistories(history)
    }
    return toUpdate.length
  }
}

export default ExchangeRateModuleService
