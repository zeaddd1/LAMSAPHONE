import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// هذا الدومين مخصص للإدارة، فنحوّل الجذر إلى لوحة التحكم.
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.redirect(302, "/app")
}
