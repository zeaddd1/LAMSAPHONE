import { Modules } from "@medusajs/framework/utils"
import { randomBytes } from "crypto"

// نسخ احتياطية لإعدادات ربط ميتا وواتساب والرد الآلي.
// تُحفظ في السيرفر نفسه (store.metadata.meta_backups) حتى لا تخرج الرموز السرية من السيرفر.
// نسخة تلقائية قبل كل حفظ أو استرجاع، ونحتفظ بآخر 12 نسخة.
const KEYS = ["quick_add_meta", "assistant"] as const
const BACKUPS = "meta_backups"
const MAX = 12

type Scope = { resolve: (key: string) => any }
export type MetaBackup = { id: string; at: string; label: string; data: Record<string, any> }

async function getStore(scope: Scope) {
  const storeService = scope.resolve(Modules.STORE)
  const [store] = await storeService.listStores({}, { take: 1 })
  if (!store) throw new Error("no store")
  return { storeService, store }
}

const pick = (meta: Record<string, any>) => Object.fromEntries(KEYS.map((k) => [k, meta?.[k] ?? null]))

export async function createBackup(scope: Scope, label: string): Promise<MetaBackup | null> {
  const { storeService, store } = await getStore(scope)
  const meta = (store.metadata || {}) as Record<string, any>
  const data = pick(meta)
  if (!data.quick_add_meta && !data.assistant) return null // لا شيء لحفظه بعد
  const list: MetaBackup[] = Array.isArray(meta[BACKUPS]) ? meta[BACKUPS] : []
  // لا نكرر نسخة مطابقة لآخر نسخة
  if (list[0] && JSON.stringify(list[0].data) === JSON.stringify(data) && label.startsWith("تلقائي")) return list[0]
  const backup: MetaBackup = { id: `bk_${randomBytes(6).toString("hex")}`, at: new Date().toISOString(), label: label.slice(0, 80), data }
  await storeService.updateStores(store.id, { metadata: { ...meta, [BACKUPS]: [backup, ...list].slice(0, MAX) } })
  return backup
}

// ما يُعرض في اللوحة: بلا أي رمز سري، فقط ما يكفي لتمييز النسخة
export async function listBackups(scope: Scope) {
  const { store } = await getStore(scope)
  const list: MetaBackup[] = Array.isArray((store.metadata as any)?.[BACKUPS]) ? (store.metadata as any)[BACKUPS] : []
  return list.map((b) => ({
    id: b.id,
    at: b.at,
    label: b.label,
    summary: {
      has_token: Boolean(b.data?.quick_add_meta?.token),
      page_id: b.data?.quick_add_meta?.page_id || "",
      catalog_id: b.data?.quick_add_meta?.catalog_id || "",
      ig_user_id: b.data?.quick_add_meta?.ig_user_id || "",
      has_app_secret: Boolean(b.data?.assistant?.app_secret),
      wa_phone_number_id: b.data?.assistant?.wa_phone_number_id || "",
    },
  }))
}

export async function restoreBackup(scope: Scope, id: string): Promise<boolean> {
  const { store } = await getStore(scope)
  const list: MetaBackup[] = Array.isArray((store.metadata as any)?.[BACKUPS]) ? (store.metadata as any)[BACKUPS] : []
  const target = list.find((b) => b.id === id)
  if (!target) return false
  // نحفظ الوضع الحالي أولاً حتى يمكن التراجع عن الاسترجاع
  await createBackup(scope, "قبل الاسترجاع")
  const fresh = await getStore(scope)
  const meta = { ...((fresh.store.metadata || {}) as Record<string, any>) }
  for (const k of KEYS) meta[k] = target.data?.[k] ?? null
  await fresh.storeService.updateStores(fresh.store.id, { metadata: meta })
  return true
}

export async function deleteBackup(scope: Scope, id: string) {
  const { storeService, store } = await getStore(scope)
  const meta = (store.metadata || {}) as Record<string, any>
  const list: MetaBackup[] = Array.isArray(meta[BACKUPS]) ? meta[BACKUPS] : []
  await storeService.updateStores(store.id, { metadata: { ...meta, [BACKUPS]: list.filter((b) => b.id !== id) } })
}
