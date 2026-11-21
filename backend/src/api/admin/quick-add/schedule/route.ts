import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getScheduleState, nextAutopostProducts, runItem, saveAutopost, updateItem, yemenSlot } from "../../../../lib/quick-add/publish"

// قائمة المنشورات المجدولة وإعدادات النشر التلقائي اليومي (صفحة ربط ميتا ← الجدولة)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const st = await getScheduleState(req.scope)
  const upcoming = await nextAutopostProducts(req.scope, st.autopost, 5)
  res.json({ ...st, upcoming, now: yemenSlot() })
}

// action: autopost (حفظ الإعدادات) | cancel | run_now
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const b = (req.body || {}) as any
  if (b.action === "autopost") {
    res.json({ autopost: await saveAutopost(req.scope, b.settings || {}) })
    return
  }
  const st = await getScheduleState(req.scope)
  const item = st.queue.find((x) => x.id === b.id)
  if (!item) {
    res.status(404).json({ message: "المنشور غير موجود" })
    return
  }
  if (b.action === "cancel") {
    if (item.status !== "pending") {
      res.status(400).json({ message: "لا يمكن إلغاء منشور نُشر أو يُنشر الآن" })
      return
    }
    await updateItem(req.scope, item.id, { status: "cancelled", done_at: new Date().toISOString() })
  } else if (b.action === "run_now") {
    if (item.status !== "pending" && item.status !== "failed") {
      res.status(400).json({ message: "هذا المنشور نُشر بالفعل" })
      return
    }
    await runItem(req.scope, item)
  } else {
    res.status(400).json({ message: "طلب غير معروف" })
    return
  }
  res.json(await getScheduleState(req.scope))
}
