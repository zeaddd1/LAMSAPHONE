import { z } from "@medusajs/framework/zod"

export const FaqBody = z.object({
  question: z.string().trim().min(2).max(300),
  answer: z.string().trim().min(1).max(2000),
  keywords: z.string().trim().max(1000).default(""),
  is_active: z.boolean().default(true),
  rank: z.number().int().default(0),
})
export type FaqBody = z.infer<typeof FaqBody>

export const ReplyBody = z.object({
  text: z.string().trim().min(1).max(2000),
  correct: z.boolean().default(false), // تصحيح لغوي قبل الإرسال
})
export type ReplyBody = z.infer<typeof ReplyBody>

export const ConversationPatch = z.object({
  mode: z.enum(["bot", "human"]).optional(),
  status: z.enum(["open", "closed"]).optional(),
  order_status: z.enum(["pending", "confirmed", "cancelled"]).nullable().optional(),
  order_note: z.string().max(1000).nullable().optional(),
  // عند تأكيد الطلب أو إلغائه نرسل للعميل رسالة جاهزة
  notify: z.boolean().default(true),
})
export type ConversationPatch = z.infer<typeof ConversationPatch>

export const TestBody = z.object({ text: z.string().trim().min(1).max(1000) })
export type TestBody = z.infer<typeof TestBody>

export const CorrectBody = z.object({ text: z.string().max(2000) })
export type CorrectBody = z.infer<typeof CorrectBody>
