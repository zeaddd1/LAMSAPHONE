import { createHmac } from "crypto"
import { parseWebhook, sendRequest, verifySignature } from "../channels"

describe("webhook parsing", () => {
  it("messenger text, skipping echoes", () => {
    const body = {
      object: "page",
      entry: [{ id: "PAGE", messaging: [
        { sender: { id: "U1" }, message: { mid: "m1", text: "بكم S25" } },
        { sender: { id: "PAGE" }, message: { mid: "m2", text: "رد", is_echo: true } },
      ] }],
    }
    expect(parseWebhook(body)).toEqual([{ channel: "messenger", external_id: "U1", text: "بكم S25", mid: "m1", account_id: "PAGE" }])
  })
  it("instagram image becomes a label", () => {
    const body = { object: "instagram", entry: [{ id: "IG", messaging: [{ sender: { id: "U2" }, message: { mid: "m3", attachments: [{ type: "image" }] } }] }] }
    expect(parseWebhook(body)[0]).toEqual({ channel: "instagram", external_id: "U2", text: "[صورة]", mid: "m3", account_id: "IG" })
  })
  it("whatsapp text with contact name", () => {
    const body = {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "PN" },
        contacts: [{ wa_id: "967700000000", profile: { name: "علي" } }],
        messages: [{ from: "967700000000", id: "wamid.1", type: "text", text: { body: "السلام عليكم" } }],
      } }] }],
    }
    expect(parseWebhook(body)).toEqual([{ channel: "whatsapp", external_id: "967700000000", name: "علي", text: "السلام عليكم", mid: "wamid.1", account_id: "PN" }])
  })
  it("ignores status updates and junk", () => {
    expect(parseWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([])
    expect(parseWebhook(null)).toEqual([])
  })
})

describe("signature", () => {
  it("accepts Meta's HMAC and rejects others", () => {
    const raw = Buffer.from('{"a":1}')
    const sig = "sha256=" + createHmac("sha256", "secret").update(raw).digest("hex")
    expect(verifySignature(raw, sig, "secret")).toBe(true)
    expect(verifySignature(raw, sig, "other")).toBe(false)
    expect(verifySignature(raw, undefined, "secret")).toBe(false)
    expect(verifySignature(raw, sig, "")).toBe(false)
  })
})

describe("send requests", () => {
  it("whatsapp and messenger shapes", () => {
    expect(sendRequest("whatsapp", { wa_phone_number_id: "PN" }, "967", "hi").path).toBe("PN/messages")
    const m = sendRequest("messenger", { page_id: "P" }, "U1", "hi")
    expect(m.path).toBe("P/messages")
    expect(m.body).toEqual({ recipient: { id: "U1" }, messaging_type: "RESPONSE", message: { text: "hi" } })
  })
})
