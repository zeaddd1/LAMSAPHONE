import { MedusaService } from "@medusajs/framework/utils"
import QuickAddImage from "./models/quick-add-image"
import QuickAddJob from "./models/quick-add-job"

class QuickAddModuleService extends MedusaService({
  QuickAddJob,
  QuickAddImage,
}) {}

export default QuickAddModuleService
