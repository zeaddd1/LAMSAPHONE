import { createHmac, timingSafeEqual } from "crypto"

// قراءة رسائل ميتا الواردة (Webhook) وبناء طلبات الإرسال لكل قناة. بلا Medusa، يُختبر وحده.

export type Channel = "messenger" | "instagram" | "whatsapp"
export type Incoming = { channel: Channel; external_id: string; name?: string; text: string; mid?: string; account_id?: string }

// يتحقق أن الطلب قادم من ميتا فعلاً (توقيع X-Hub-Signature-256 بسر التطبيق)
export function verifySignature(raw: Buffer | string | undefined, header: string | undefined, secret: string): boolean {
  if (!raw || !header || !secret) return false
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(header)
  return a.length === b.length && timingSafeEqual(a, b)
}

const MEDIA_LABEL: Record<string, string> = {
  image: "[صورة]",
  video: "[فيديو]",
  audio: "[رسالة صوتية]",
  file: "[ملف]",
  document: "[ملف]",
  sticker: "[ملصق]",
  location: "[موقع]",
}

export function parseWebhook(body: any): Incoming[] {
  const out: Incoming[] = []
  if (!body || typeof body !== "object") return out

  // ماسنجر (object=page) وإنستغرام (object=instagram) لهما نفس الشكل
  if (body.object === "page" || body.object === "instagram") {
    const channel: Channel = body.object === "page" ? "messenger" : "instagram"
    for (const entry of body.entry || []) {
      for (const ev of entry.messaging || []) {
        const m = ev.message
        if (!m || m.is_echo || !ev.sender?.id) continue // نتجاهل رسائلنا نحن
        const att = (m.attachments || [])[0]
        const text = (m.text || (att ? MEDIA_LABEL[att.type] || "[مرفق]" : "")).trim()
        if (!text) continue
        out.push({ channel, external_id: String(ev.sender.id), text, mid: m.mid, account_id: String(entry.id || "") })
      }
    }
  }

  // واتساب Cloud API
  if (body.object === "whatsapp_business_account") {
    for (const entry of body.entry || []) {
      for (const ch of entry.changes || []) {
        const v = ch.value || {}
        const names = new Map<string, string>((v.contacts || []).map((c: any) => [String(c.wa_id), c.profile?.name]))
        for (const m of v.messages || []) {
          const text = (
            m.text?.body ||
            m.button?.text ||
            m.interactive?.button_reply?.title ||
            m.interactive?.list_reply?.title ||
            m[m.type]?.caption ||
            MEDIA_LABEL[m.type] ||
            ""
          ).trim()
          if (!text || !m.from) continue
          out.push({ channel: "whatsapp", external_id: String(m.from), name: names.get(String(m.from)), text, mid: m.id, account_id: v.metadata?.phone_number_id })
        }
      }
    }
  }
  return out
}

// طلب الإرسال: المسار والجسم لكل قناة
export function sendRequest(channel: Channel, ids: { page_id?: string; wa_phone_number_id?: string }, to: string, text: string): { path: string; body: Record<string, unknown> } {
  const msg = text.slice(0, channel === "whatsapp" ? 4096 : 2000)
  if (channel === "whatsapp") {
    return {
      path: `${ids.wa_phone_number_id}/messages`,
      body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: msg } },
    }
  }
  // ماسنجر وإنستغرام: عبر الصفحة بنفس الشكل
  return { path: `${ids.page_id}/messages`, body: { recipient: { id: to }, messaging_type: "RESPONSE", message: { text: msg } } }
}
