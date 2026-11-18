import { Module } from "@medusajs/framework/utils"
import QuickAddModuleService from "./service"

// مهام الإضافة السريعة بالذكاء الاصطناعي (اختيارية، موديول مستقل داخل المشروع)
export const QUICK_ADD_MODULE = "quick_add"

export default Module(QUICK_ADD_MODULE, {
  service: QuickAddModuleService,
})
