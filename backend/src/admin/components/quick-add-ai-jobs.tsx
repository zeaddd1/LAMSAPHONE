import { Badge, Button, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import type { MetaPublic } from "./quick-add-meta-connect"
import QuickAddAiReview from "./quick-add-ai-review"
import type { QuickAddCtx } from "../lib/quick-add-create"
import type { ProcessOptions } from "../lib/quick-add-image"
import { Job, STATUS_LABELS, isBusy, jobApi } from "../lib/quick-add-ai"

// تبويب "مهام الذكاء الاصطناعي": آخر المهام (وضع الدفعات: كل جهاز مهمة مستقلة تُعالج بالتتابع)
export default function QuickAddAiJobs({ ctx, processOpts }: { ctx: QuickAddCtx & { meta: MetaPublic }; processOpts: ProcessOptions }) {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = () =>
    jobApi
      .list()
      .then((r) => setJobs(r.jobs))
      .catch((e) => toast.error(e?.message || "تعذّر تحميل المهام"))

  useEffect(() => {
    load()
  }, [])
  // تحديث تلقائي ما دامت هناك مهمة جارية
  useEffect(() => {
    if (open || !jobs?.some(isBusy)) return
    const t = setTimeout(load, 3000)
    return () => clearTimeout(t)
  }, [jobs, open])

  if (open) {
    return (
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <Button size="small" variant="secondary" className="self-start" onClick={() => (setOpen(null), load())}>
          → رجوع للمهام
        </Button>
        <QuickAddAiReview jobId={open} ctx={ctx} processOpts={processOpts} />
      </div>
    )
  }
  if (!jobs) return <Text className="p-6">جارٍ التحميل…</Text>
  if (!jobs.length)
    return (
      <Text className="p-6 text-ui-fg-subtle">
        لا توجد مهام بعد. فعّل «تحسين بالذكاء الاصطناعي» في تبويب إضافة منتج. لإضافة عدة أجهزة دفعة واحدة: ابدأ التوليد لجهاز ثم اضغط «إضافة جهاز آخر»، وستُعالج بالتتابع هنا.
      </Text>
    )
  return (
    <div className="flex flex-col divide-y">
      {jobs.map((j) => {
        const thumb = j.images.find((i) => i.is_main) || j.images[0]
        const done = j.images.filter((i) => i.status === "done").length
        return (
          <button key={j.id} type="button" onClick={() => setOpen(j.id)} className="flex items-center gap-3 px-4 py-3 text-start hover:bg-ui-bg-subtle-hover sm:px-6">
            {thumb ? <img src={thumb.result_url || thumb.source_url} onError={(e) => (e.currentTarget.style.visibility = "hidden")} alt="" className="h-14 w-12 rounded bg-ui-bg-subtle object-cover" /> : <div className="h-14 w-12 rounded bg-ui-bg-subtle" />}
            <div className="flex min-w-0 flex-1 flex-col">
              <Text weight="plus" className="truncate">{j.title}</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {new Date(j.created_at).toLocaleString("ar")} · {done}/{j.images.length} صور محسّنة
              </Text>
            </div>
            <Badge size="2xsmall" color={j.status === "published" ? "green" : j.status === "failed" || j.status === "rejected" ? "red" : j.status === "ready_for_review" ? "blue" : "orange"}>
              {isBusy(j) ? "جارٍ التوليد" : STATUS_LABELS[j.status]}
            </Badge>
          </button>
        )
      })}
    </div>
  )
}
