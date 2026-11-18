import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const norm = (s: unknown) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim()

// تنبيه التكرار: منتج بنفس الماركة + الموديل + السعة + اللون موجود مسبقاً؟
// ?brand=&model=&combos=256GB|أسود,512GB|أزرق
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brand = norm(req.query.brand)
  const model = norm(req.query.model)
  if (!model) {
    res.json({ duplicates: [] })
    return
  }
  const combos = String(req.query.combos || "")
    .split(",")
    .map((c) => c.split("|").map(norm))
    .filter((c) => c[0] || c[1])
  const products: any[] = await req.scope
    .resolve(Modules.PRODUCT)
    .listProducts({ q: String(req.query.model).slice(0, 100) }, { take: 50, relations: ["variants", "variants.options"], select: ["id", "title", "handle", "metadata"] })
  const out: { id: string; title: string; match: string }[] = []
  for (const p of products) {
    const m = p.metadata || {}
    const sameModel = norm(m.model) === model || norm(p.title).includes(model)
    const sameBrand = !brand || !m.brand || norm(m.brand) === brand || norm(p.title).includes(brand)
    if (!sameModel || !sameBrand) continue
    const values = new Set<string>([norm(m.storage), norm(m.color)])
    const have = (p.variants || []).map((v: any) => (v.options || []).map((o: any) => norm(o.value)))
    const hit = combos.length
      ? combos.find(([st, co]) => have.some((vals: string[]) => (!st || vals.includes(st)) && (!co || vals.includes(co))) || ((!st || values.has(st)) && (!co || values.has(co))))
      : []
    if (hit) out.push({ id: p.id, title: p.title, match: hit.filter(Boolean).join(" ") })
  }
  res.json({ duplicates: out.slice(0, 10) })
}
