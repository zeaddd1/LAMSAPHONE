import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ASSISTANT_MODULE } from "../modules/assistant"
import { stripCod } from "../lib/strip-cod"

// يعمل مرة واحدة عند النشر: يزيل عبارة "الدفع عند الاستلام" من أوصاف المنتجات والأسئلة الشائعة المحفوظة
// (طلب صاحب المتجر). لا يغيّر أي شيء آخر في النص.
export default async function removeCodWording({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const products = container.resolve(Modules.PRODUCT)
  let changed = 0
  for (let skip = 0; ; skip += 200) {
    const page = await products.listProducts({}, { take: 200, skip, select: ["id", "description", "subtitle"] })
    for (const p of page) {
      const description = p.description ? stripCod(p.description) : p.description
      const subtitle = p.subtitle ? stripCod(p.subtitle) : p.subtitle
      if (description !== p.description || subtitle !== p.subtitle) {
        await products.updateProducts(p.id, { description, subtitle })
        changed++
      }
    }
    if (page.length < 200) break
  }

  const assistant = container.resolve(ASSISTANT_MODULE) as any
  let faqs = 0
  for (const f of await assistant.listAssistantFaqs({}, { take: 500 })) {
    const answer = stripCod(f.answer || "")
    if (answer && answer !== f.answer) {
      await assistant.updateAssistantFaqs({ id: f.id, answer })
      faqs++
    }
  }
  logger.info(`remove-cod-wording: ${changed} products, ${faqs} faqs updated`)
}
