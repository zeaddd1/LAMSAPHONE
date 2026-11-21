import type { MedusaContainer } from "@medusajs/framework/types"
import { getMetaSettings, getTelegramSettings, markTelegramSlot, saveThreadsToken } from "../lib/quick-add/meta-settings"
import { refreshThreadsToken } from "../lib/quick-add/meta-graph"
import { getScheduleState, markAutopostSlot, nextAutopostProducts, publishToMeta, runItem, yemenSlot } from "../lib/quick-add/publish"

// كل 5 دقائق: 1) ينشر المنشورات المجدولة التي حان وقتها. 2) النشر التلقائي اليومي في الساعات المختارة.
// 3) يجدّد رمز Threads قبل انتهائه (صالح 60 يوماً).
let running = false

export default async function metaAutopost(container: MedusaContainer) {
  if (running) return
  running = true
  const logger = container.resolve("logger")
  try {
    const { queue, autopost } = await getScheduleState(container)

    // 1) المجدول
    const due = queue.filter((x) => x.status === "pending" && new Date(x.at).getTime() <= Date.now()).sort((a, b) => a.at.localeCompare(b.at))
    for (const item of due.slice(0, 5)) {
      await runItem(container, item)
      logger.info(`meta-autopost: scheduled ${item.id} (${item.label}) processed`)
    }

    // 2) التلقائي اليومي
    const slot = yemenSlot()
    if (autopost.enabled && autopost.hours.includes(slot.hour) && autopost.last_slot !== slot.key) {
      // نسجّل الفترة أولاً حتى لا يتكرر النشر إن طال التنفيذ
      await markAutopostSlot(container, slot.key)
      const next = await nextAutopostProducts(container, autopost, autopost.per_run)
      for (const p of next) {
        const out = await publishToMeta(container, {
          product_id: p.id,
          facebook: autopost.facebook,
          instagram: autopost.instagram,
          ig_story: autopost.ig_story,
          threads: autopost.threads,
          catalog: autopost.catalog,
          use_video: true,
        } as any)
        const summary = Object.entries(out.results || {})
          .filter(([, r]) => !r.skipped)
          .map(([k, r]) => `${k}:${r.ok ? "ok" : r.error}`)
          .join(" ")
        logger.info(`meta-autopost: auto ${p.title} → ${summary || out.message}`)
      }
    }

    // 2ب) تيليجرام: خطة أسبوعية مستقلة (أيام وساعة)، ينشر في تيليجرام فقط ما لم يُنشر فيه بعد
    const tg = await getTelegramSettings(container)
    if (tg.plan.enabled && tg.bot_token && tg.chat_id && tg.plan.days.includes(slot.day) && tg.plan.hour === slot.hour && tg.plan.last_slot !== slot.key) {
      await markTelegramSlot(container, slot.key)
      const next = await nextAutopostProducts(container, { telegram: true } as any, tg.plan.per_run)
      for (const p of next) {
        const out = await publishToMeta(container, { product_id: p.id, telegram: true, use_video: false } as any)
        logger.info(`meta-autopost: telegram ${p.title} → ${out.results?.telegram?.ok ? "ok" : out.results?.telegram?.error || out.message}`)
      }
    }

    // 3) تجديد رمز Threads كل 30 يوماً
    const s = await getMetaSettings(container)
    if (s.threads_token && !process.env.THREADS_ACCESS_TOKEN) {
      const age = s.threads_token_at ? Date.now() - new Date(s.threads_token_at).getTime() : Infinity
      if (age > 30 * 24 * 3600_000) {
        try {
          await saveThreadsToken(container, await refreshThreadsToken(s.threads_token))
          logger.info("meta-autopost: Threads token refreshed")
        } catch (e: any) {
          logger.warn(`meta-autopost: Threads token refresh failed: ${e?.message || e}`)
        }
      }
    }
  } catch (e: any) {
    logger.error(`meta-autopost: ${e?.message || e}`)
  } finally {
    running = false
  }
}

export const config = { name: "meta-autopost", schedule: "*/5 * * * *" }
