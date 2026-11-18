import { Text } from "@medusajs/ui"
import { useState } from "react"
import { STORE_LOGO } from "../lib/store-logo"

// معاينة المنشور قبل النشر: كما سيظهر على إنستغرام أو فيسبوك (الصورة/الفيديو + النص + أول تعليق)
export default function PostPreview({
  caption,
  igCaption,
  comment,
  image,
  video,
  count,
}: {
  caption: string
  igCaption?: string
  comment?: string
  image?: string
  video?: string
  count: number
}) {
  const [net, setNet] = useState<"ig" | "fb">("ig")
  const [more, setMore] = useState(false)
  // إنستغرام يعرض أول سطرين ثم "المزيد"
  const igText = igCaption || caption
  const lines = igText.split("\n")
  const short = lines.slice(0, 2).join("\n")
  const isLink = (w: string) => /^[a-z0-9.-]+\.[a-z]{2,}\/\S*$/i.test(w) || /^https?:\/\//i.test(w)

  const renderText = (text: string, linkable: boolean) =>
    text.split(/(\s+)/).map((w, i) =>
      isLink(w) ? (
        <span key={i} className={linkable ? "text-[#385898]" : ""}>{w}</span>
      ) : w.startsWith("#") ? (
        <span key={i} className="text-[#00376b]">{w}</span>
      ) : (
        <span key={i}>{w}</span>
      )
    )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Text size="small" weight="plus">معاينة المنشور قبل النشر</Text>
        <div className="flex overflow-hidden rounded-md border text-[11px]">
          {(["ig", "fb"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setNet(k)} className={`px-2 py-0.5 ${net === k ? "bg-ui-bg-interactive text-ui-fg-on-color" : ""}`}>
              {k === "ig" ? "إنستغرام" : "فيسبوك"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white text-[13px] text-black shadow-sm" dir="auto">
        <div className="flex items-center gap-2 px-3 py-2">
          <img src={STORE_LOGO} alt="" className="h-8 w-8 rounded-full border bg-white object-contain p-0.5" />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold">{net === "ig" ? "lamsaphone7" : "LamsaPhone"}</span>
            <span className="text-[11px] text-gray-500">{net === "ig" ? "صنعاء" : "الآن · 🌐"}</span>
          </div>
        </div>
        {net === "fb" && <div className="whitespace-pre-wrap px-3 pb-2">{renderText(caption, true)}</div>}
        <div className="relative aspect-[4/5] w-full bg-gray-100">
          {video ? (
            <video src={video} className="h-full w-full object-cover" muted playsInline loop autoPlay />
          ) : image ? (
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">أضف صورة أو فيديو</div>
          )}
          {!video && count > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">1/{count}</span>}
          {video && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">▶ ريلز</span>}
        </div>
        {net === "ig" && (
          <div className="flex flex-col gap-1 px-3 py-2">
            <div className="flex gap-3 text-lg">♡ 💬 ➤</div>
            <div className="whitespace-pre-wrap">
              <span className="font-semibold">lamsaphone7 </span>
              {renderText(more ? igText : short, false)}
              {!more && lines.length > 2 && (
                <button type="button" className="text-gray-500" onClick={() => setMore(true)}> … المزيد</button>
              )}
            </div>
            {comment && (
              <div className="whitespace-pre-wrap text-gray-600">
                <span className="font-semibold text-black">lamsaphone7 </span>
                {renderText(comment, false)}
              </div>
            )}
          </div>
        )}
        {net === "fb" && comment && (
          <div className="border-t px-3 py-2 text-gray-600">
            <span className="font-semibold text-black">LamsaPhone </span>
            {renderText(comment, true)}
          </div>
        )}
      </div>
      {net === "ig" && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          إنستغرام لا يجعل الروابط قابلة للضغط داخل المنشورات، لذلك يكتب المنشور «الرابط في البايو»، ويجد العميل كل المنتجات في صفحة الروابط.
        </Text>
      )}
    </div>
  )
}
