import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getScheduleState, nextAutopostProducts, runItem, savePlans, updateItem, yemenSlot } from "../../../../lib/quick-add/publish"

// المنشورات المجدولة وخطط النشر التلقائي (صفحة ربط ميتا ← الجدولة والنشر التلقائي)
async function state(req: MedusaRequest) {
  const st = await getScheduleState(req.scope)
  const upcoming: Record<string, { id: string; title: string }[]> = {}
  for (const p of st.plans) upcoming[p.id] = p.dests.length ? await nextAutopostProducts(req.scope, p.dests, 3) : []
  return { ...st, upcoming, now: yemenSlot() }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await state(req))
}

// action: plans (حفظ كل الخطط) | cancel | run_now
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const b = (req.body || {}) as any
  if (b.action === "plans") {
    await savePlans(req.scope, b.plans || [])
    res.json(await state(req))
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
  res.json(await state(req))
}
