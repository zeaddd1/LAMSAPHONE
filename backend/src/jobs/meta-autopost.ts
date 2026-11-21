import type { MedusaContainer } from "@medusajs/framework/types"
import { getMetaSettings, saveThreadsToken } from "../lib/quick-add/meta-settings"
import { refreshThreadsToken } from "../lib/quick-add/meta-graph"
import { getScheduleState, markPlanSlot, planDue, runItem, runPlan, yemenSlot } from "../lib/quick-add/publish"

// كل 5 دقائق: 1) ينشر المنشورات المجدولة التي حان وقتها. 2) خطط النشر التلقائي (كل خطة بأيامها وساعاتها ومنصاتها).
// 3) يجدّد رمز Threads قبل انتهائه (صالح 60 يوماً).
let running = false

export default async function metaAutopost(container: MedusaContainer) {
  if (running) return
  running = true
  const logger = container.resolve("logger")
  try {
    const { queue, plans } = await getScheduleState(container)

    // 1) المجدول
    const due = queue.filter((x) => x.status === "pending" && new Date(x.at).getTime() <= Date.now()).sort((a, b) => a.at.localeCompare(b.at))
    for (const item of due.slice(0, 5)) {
      await runItem(container, item)
      logger.info(`meta-autopost: scheduled ${item.id} (${item.label}) processed`)
    }

    // 2) الخطط: نسجّل الفترة أولاً حتى لا يتكرر النشر إن طال التنفيذ
    const slot = yemenSlot()
    for (const p of plans.filter((x) => planDue(x, slot))) {
      await markPlanSlot(container, p.id, slot.key)
      try {
        await runPlan(container, p, logger)
      } catch (e: any) {
        logger.error(`meta-autopost: plan ${p.name}: ${e?.message || e}`)
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
