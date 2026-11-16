import { MedusaService } from "@medusajs/framework/utils"
import AssistantConversation from "./models/conversation"
import AssistantFaq from "./models/faq"
import AssistantMessage from "./models/message"
import { DEFAULT_FAQS } from "../../lib/assistant/brain"

class AssistantModuleService extends MedusaService({
  AssistantFaq,
  AssistantConversation,
  AssistantMessage,
}) {
  /** يضيف الأسئلة الشائعة الافتراضية مرة واحدة فقط (إذا كانت القائمة فارغة). */
  async ensureDefaultFaqs() {
    const [, count] = await this.listAndCountAssistantFaqs({}, { take: 1 })
    if (count === 0) await this.createAssistantFaqs(DEFAULT_FAQS.map((f, i) => ({ ...f, rank: i })))
  }
}

export default AssistantModuleService
