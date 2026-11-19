import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { cleanHomeConfig } from "../../../lib/home-config"

// إعدادات الصفحة الرئيسية للمتجر: الإعلانات المفعّلة والمنتجات المميزة فقط
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const stores = await req.scope.resolve(Modules.STORE).listStores({}, { take: 1, select: ["id", "metadata"] })
  const cfg = cleanHomeConfig((stores[0]?.metadata as any)?.lamsa_home)
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ banners: cfg.banners.filter((b) => b.active), featured: cfg.featured, featured_title: cfg.featured_title })
}
