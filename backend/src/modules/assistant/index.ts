import { Module } from "@medusajs/framework/utils"
import AssistantModuleService from "./service"

// الرد الآلي وإدارة المحادثات (موديول مستقل داخل المشروع، لا يعدّل Medusa)
export const ASSISTANT_MODULE = "assistant"

export default Module(ASSISTANT_MODULE, {
  service: AssistantModuleService,
})
