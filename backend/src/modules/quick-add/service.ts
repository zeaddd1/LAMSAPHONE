import { MedusaService } from "@medusajs/framework/utils"
import QuickAddImage from "./models/quick-add-image"
import QuickAddJob from "./models/quick-add-job"
import GeminiUsageLog from "./models/gemini-usage-log"

class QuickAddModuleService extends MedusaService({
  QuickAddJob,
  QuickAddImage,
  GeminiUsageLog,
}) {}

export default QuickAddModuleService
