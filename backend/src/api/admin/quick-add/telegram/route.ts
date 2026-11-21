import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getTelegramSettings, patchTelegram, publicTelegram } from "../../../../lib/quick-add/meta-settings"
import { postToTelegram, telegramFindChats, telegramGetChat, telegramGetMe } from "../../../../lib/quick-add/meta-graph"
import { nextAutopostProducts, yemenSlot } from "../../../../lib/quick-add/publish"
import { storeUrl } from "../../../../lib/meta-feed-builder"

// تيليجرام (مستقل عن ميتا): ربط البوت والقناة/المجموعة، والخطة الأسبوعية
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const t = await getTelegramSettings(req.scope)
  const upcoming = t.bot_token && t.chat_id ? await nextAutopostProducts(req.scope, ["telegram"], 5) : []
  res.json({ settings: publicTelegram(t), upcoming, now: yemenSlot() })
}

// action: save_token | find_chats | set_chat | test | clear  (خطط النشر في تبويب الجدولة)
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const b = (req.body || {}) as any
  const cur = await getTelegramSettings(req.scope)
  try {
    if (b.action === "save_token") {
      const token = String(b.token || "").trim()
      if (!/^\d{5,15}:[\w-]{20,60}$/.test(token)) throw new Error("رمز البوت غير صحيح. شكله مثل: 123456789:AA…")
      const me = await telegramGetMe(token)
      const t = await patchTelegram(req.scope, { bot_token: token, bot_username: me.username })
      res.json({ settings: publicTelegram(t), chats: await telegramFindChats(token).catch(() => []) })
      return
    }
    if (!cur.bot_token) throw new Error("احفظ رمز البوت أولاً")
    if (b.action === "find_chats") {
      res.json({ chats: await telegramFindChats(cur.bot_token) })
      return
    }
    if (b.action === "set_chat") {
      const id = String(b.chat_id || "").trim()
      if (!/^(-?\d{5,20}|@[A-Za-z0-9_]{4,40})$/.test(id)) throw new Error("رقم القناة أو المجموعة غير صحيح (مثل -100123… أو @lamsaphone)")
      const chat = await telegramGetChat(cur.bot_token, id)
      const t = await patchTelegram(req.scope, { chat_id: String(chat.id), chat_title: chat.title || chat.username || String(chat.id) })
      res.json({ settings: publicTelegram(t) })
      return
    }
    if (b.action === "test") {
      if (!cur.chat_id) throw new Error("اختر القناة أو المجموعة أولاً")
      const r = await postToTelegram(cur.bot_token, cur.chat_id, [], "✅ تم ربط متجر لمسة فون بتيليجرام. ستصلكم هنا أحدث العروض والمنتجات.", [{ text: "🛒 المتجر", url: storeUrl() }])
      res.json({ ok: true, url: r.url })
      return
    }
    if (b.action === "clear") {
      const t = await patchTelegram(req.scope, { clear_token: true })
      res.json({ settings: publicTelegram(t) })
      return
    }
    res.status(400).json({ message: "طلب غير معروف" })
  } catch (e: any) {
    res.status(400).json({ message: e?.message || String(e) })
  }
}
