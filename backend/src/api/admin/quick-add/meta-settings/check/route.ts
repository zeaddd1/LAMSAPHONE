import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { backendUrl } from "../../../../../lib/meta-feed-builder"
import { getCatalog, getPage, getThreadsProfile } from "../../../../../lib/quick-add/meta-graph"
import { getMetaSettings } from "../../../../../lib/quick-add/meta-settings"

// فحص الربط: هل الرمز صالح؟ ما اسم الصفحة؟ هل إنستغرام مربوط؟ هل الكتالوج موجود؟
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const s = await getMetaSettings(req.scope)
  const cfg = { token: s.token, version: s.graph_version }
  const out: Record<string, any> = { feed_url: `${backendUrl().replace(/\/$/, "")}/feeds/meta.xml` }
  if (!s.token && !s.threads_token) {
    res.json({ ...out, ok: false, error: "لم يُحفظ رمز الوصول بعد" })
    return
  }
  if (s.page_id && s.token) {
    try {
      const p = await getPage(cfg, s.page_id)
      out.facebook = { ok: true, name: p.name }
      const igId = s.ig_user_id || p.ig?.id
      out.instagram = igId ? { ok: true, id: igId, username: p.ig?.username } : { ok: false, error: "لا يوجد حساب إنستغرام أعمال مربوط بالصفحة" }
    } catch (e: any) {
      out.facebook = { ok: false, error: e.message }
    }
  } else out.facebook = { ok: false, error: "رقم الصفحة غير مكتوب" }
  if (s.catalog_id) {
    try {
      const c = await getCatalog(cfg, s.catalog_id)
      out.catalog = { ok: true, name: c.name, product_count: c.product_count }
    } catch (e: any) {
      out.catalog = { ok: false, error: e.message }
    }
  } else out.catalog = { ok: false, error: "رقم الكتالوج غير مكتوب" }
  if (s.threads_token) {
    try {
      const t = await getThreadsProfile(s.threads_token)
      out.threads = { ok: true, username: t.username, id: t.id, matches: !s.threads_user_id || s.threads_user_id === t.id }
    } catch (e: any) {
      out.threads = { ok: false, error: e.message }
    }
  } else out.threads = { ok: false, error: "لم يُحفظ رمز Threads" }
  out.ok = Boolean(out.facebook?.ok || out.catalog?.ok || out.threads?.ok)
  res.json(out)
}
