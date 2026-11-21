// عميل Graph API لميتا (فيسبوك، إنستغرام، الكتالوج). بلا استيراد من Medusa حتى يُختبر وحده.
// الرمز يُرسل في جسم الطلب وليس في الرابط.

export type GraphConfig = { token: string; version: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }

export class GraphError extends Error {
  code?: number
  constructor(message: string, code?: number) {
    super(message)
    this.code = code
  }
}

const BASE = "https://graph.facebook.com"

async function call(cfg: GraphConfig, method: "GET" | "POST", path: string, params: Record<string, unknown> = {}, token = cfg.token) {
  const f = cfg.fetchImpl || fetch
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    body.set(k, typeof v === "string" ? v : JSON.stringify(v))
  }
  body.set("access_token", token)
  const url = `${BASE}/${cfg.version}/${path.replace(/^\//, "")}`
  // GET لا يقبل جسماً، فنرسل الرمز في ترويسة Authorization
  const res =
    method === "GET"
      ? await f(`${url}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      : await f(url, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) {
    const e = json?.error || {}
    throw new GraphError(e.error_user_msg || e.message || `Meta HTTP ${res.status}`, e.code)
  }
  return json
}

export type PageInfo = { id: string; name: string; page_token: string; ig?: { id: string; username?: string } }

// يجلب رمز الصفحة وحساب إنستغرام المربوط بها من رمز مستخدم النظام
export async function getPage(cfg: GraphConfig, pageId: string): Promise<PageInfo> {
  const j = await call(cfg, "GET", pageId, { fields: "id,name,access_token,instagram_business_account{id,username}" })
  return {
    id: j.id,
    name: j.name,
    page_token: j.access_token || cfg.token,
    ig: j.instagram_business_account ? { id: j.instagram_business_account.id, username: j.instagram_business_account.username } : undefined,
  }
}

export async function getCatalog(cfg: GraphConfig, catalogId: string): Promise<{ id: string; name: string; product_count?: number }> {
  return call(cfg, "GET", catalogId, { fields: "id,name,product_count" })
}

// منشور فيسبوك بعدة صور: نرفع الصور غير منشورة ثم منشور واحد يضمها
export async function postToFacebook(cfg: GraphConfig, page: PageInfo, imageUrls: string[], message: string): Promise<{ id: string; url: string }> {
  const media: { media_fbid: string }[] = []
  for (const url of imageUrls.slice(0, 10)) {
    const p = await call(cfg, "POST", `${page.id}/photos`, { url, published: "false" }, page.page_token)
    media.push({ media_fbid: p.id })
  }
  const post = await call(cfg, "POST", `${page.id}/feed`, { message, attached_media: media }, page.page_token)
  return { id: post.id, url: `https://www.facebook.com/${post.id}` }
}

async function waitReady(cfg: GraphConfig, id: string, token: string) {
  const sleep = cfg.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  for (let i = 0; i < 20; i++) {
    const s = await call(cfg, "GET", id, { fields: "status_code" }, token)
    if (s.status_code === "FINISHED") return
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new GraphError("رفض إنستغرام الصورة (تأكد أنها JPEG ورابطها عام)")
    await sleep(1500)
  }
  throw new GraphError("انتهت مهلة تجهيز منشور إنستغرام")
}

// منشور إنستغرام: صورة واحدة أو ألبوم (2 إلى 10 صور). إنستغرام يقبل JPEG فقط.
export async function postToInstagram(cfg: GraphConfig, igUserId: string, token: string, imageUrls: string[], caption: string): Promise<{ id: string; url?: string }> {
  const urls = imageUrls.slice(0, 10)
  if (!urls.length) throw new GraphError("لا توجد صور للنشر")
  let creationId: string
  if (urls.length === 1) {
    creationId = (await call(cfg, "POST", `${igUserId}/media`, { image_url: urls[0], caption }, token)).id
  } else {
    const children: string[] = []
    for (const image_url of urls) {
      const c = await call(cfg, "POST", `${igUserId}/media`, { image_url, is_carousel_item: "true" }, token)
      children.push(c.id)
    }
    for (const c of children) await waitReady(cfg, c, token)
    creationId = (await call(cfg, "POST", `${igUserId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }, token)).id
  }
  await waitReady(cfg, creationId, token)
  const pub = await call(cfg, "POST", `${igUserId}/media_publish`, { creation_id: creationId }, token)
  const info = await call(cfg, "GET", pub.id, { fields: "permalink" }, token).catch(() => ({}))
  return { id: pub.id, url: (info as any).permalink }
}

// حذف عناصر من الكتالوج (عند حذف منتج من المتجر)
export async function removeFromCatalog(cfg: GraphConfig, catalogId: string, retailerIds: string[]): Promise<{ handles: string[] }> {
  if (!retailerIds.length) return { handles: [] }
  const r = await call(cfg, "POST", `${catalogId}/items_batch`, {
    item_type: "PRODUCT_ITEM",
    requests: retailerIds.map((id) => ({ method: "DELETE", data: { id } })),
  })
  return { handles: r.handles || [] }
}

// تعليق على منشور (فيسبوك: رقم المنشور، إنستغرام: رقم الوسائط). نستخدمه لنشر الهاشتاقات كأول تعليق.
export async function addComment(cfg: GraphConfig, objectId: string, token: string, message: string): Promise<{ id: string }> {
  return call(cfg, "POST", `${objectId}/comments`, { message }, token)
}

// فيديو على صفحة فيسبوك من رابط عام (MP4)
export async function postVideoToFacebook(cfg: GraphConfig, page: PageInfo, videoUrl: string, description: string): Promise<{ id: string; url: string }> {
  const r = await call(cfg, "POST", `${page.id}/videos`, { file_url: videoUrl, description }, page.page_token)
  return { id: r.id, url: `https://www.facebook.com/${page.id}/videos/${r.id}` }
}

// ريلز على إنستغرام من رابط فيديو عام (MP4). تجهيز الفيديو عند ميتا يأخذ وقتاً أطول من الصور.
export async function postReelToInstagram(cfg: GraphConfig, igUserId: string, token: string, videoUrl: string, caption: string, coverUrl?: string): Promise<{ id: string; url?: string }> {
  const c = await call(cfg, "POST", `${igUserId}/media`, { media_type: "REELS", video_url: videoUrl, caption, share_to_feed: "true", ...(coverUrl ? { cover_url: coverUrl } : {}) }, token)
  const sleep = cfg.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  for (let i = 0; ; i++) {
    const st = await call(cfg, "GET", c.id, { fields: "status_code" }, token)
    if (st.status_code === "FINISHED") break
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new GraphError("رفض إنستغرام الفيديو (يجب أن يكون MP4 برابط عام)")
    if (i >= 40) throw new GraphError("انتهت مهلة تجهيز الريلز عند إنستغرام")
    await sleep(3000)
  }
  const pub = await call(cfg, "POST", `${igUserId}/media_publish`, { creation_id: c.id }, token)
  const info = await call(cfg, "GET", pub.id, { fields: "permalink" }, token).catch(() => ({}))
  return { id: pub.id, url: (info as any).permalink }
}

// قصة إنستغرام (Story) بصورة JPEG أو فيديو MP4 برابط عام. القصص لا تقبل نصاً ولا روابط عبر الـ API،
// وإضافتها إلى «أبرز القصص» (Highlights) لا تتوفر عبر الـ API: تُضاف يدوياً من تطبيق إنستغرام.
export async function postStoryToInstagram(cfg: GraphConfig, igUserId: string, token: string, media: { imageUrl?: string; videoUrl?: string }): Promise<{ id: string; url?: string }> {
  if (!media.imageUrl && !media.videoUrl) throw new GraphError("لا توجد صورة للقصة")
  const c = await call(cfg, "POST", `${igUserId}/media`, { media_type: "STORIES", ...(media.videoUrl ? { video_url: media.videoUrl } : { image_url: media.imageUrl }) }, token)
  const sleep = cfg.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  for (let i = 0; ; i++) {
    const st = await call(cfg, "GET", c.id, { fields: "status_code" }, token)
    if (st.status_code === "FINISHED") break
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new GraphError("رفض إنستغرام القصة (JPEG أو MP4 برابط عام)")
    if (i >= 40) throw new GraphError("انتهت مهلة تجهيز القصة عند إنستغرام")
    await sleep(media.videoUrl ? 3000 : 1500)
  }
  const pub = await call(cfg, "POST", `${igUserId}/media_publish`, { creation_id: c.id }, token)
  return { id: pub.id }
}

// ---------- Threads (تطبيق ميتا للنصوص): واجهة مستقلة graph.threads.net برمز مستخدم Threads ----------
const THREADS = "https://graph.threads.net/v1.0"

async function threadsCall(token: string, method: "GET" | "POST", path: string, params: Record<string, string> = {}, f: typeof fetch = fetch) {
  const url = `${THREADS}/${path.replace(/^\//, "")}`
  const res =
    method === "GET"
      ? await f(`${url}?${new URLSearchParams(params).toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      : await f(url, { method: "POST", body: new URLSearchParams({ ...params, access_token: token }), headers: { "Content-Type": "application/x-www-form-urlencoded" } })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) {
    const e = json?.error || {}
    throw new GraphError(e.error_user_msg || e.message || `Threads HTTP ${res.status}`, e.code)
  }
  return json
}

export async function getThreadsProfile(token: string, f?: typeof fetch): Promise<{ id: string; username?: string }> {
  return threadsCall(token, "GET", "me", { fields: "id,username" }, f)
}

// الرمز الطويل صالح 60 يوماً، ويُجدَّد قبل انتهائه (مرة كل 24 ساعة على الأكثر بحسب ميتا)
export async function refreshThreadsToken(token: string, f: typeof fetch = fetch): Promise<string> {
  const res = await f(`https://graph.threads.net/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: token })}`)
  const j: any = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) throw new GraphError(j?.error?.message || "تعذّر تجديد رمز Threads")
  return j.access_token
}

// منشور Threads: نص (500 حرف كحد أقصى) مع صورة أو ألبوم حتى 10 صور. الروابط داخل النص قابلة للضغط.
export async function postToThreads(
  token: string,
  userId: string,
  imageUrls: string[],
  text: string,
  opts: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {}
): Promise<{ id: string; url?: string }> {
  const f = opts.fetchImpl || fetch
  const sleep = opts.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const urls = imageUrls.slice(0, 10)
  const waitReady = async (id: string) => {
    for (let i = 0; i < 30; i++) {
      const s = await threadsCall(token, "GET", id, { fields: "status,error_message" }, f)
      if (s.status === "FINISHED") return
      if (s.status === "ERROR" || s.status === "EXPIRED") throw new GraphError(s.error_message || "رفض Threads الصورة (JPEG برابط عام)")
      await sleep(2000)
    }
    throw new GraphError("انتهت مهلة تجهيز منشور Threads")
  }
  let creation: string
  if (!urls.length) {
    creation = (await threadsCall(token, "POST", `${userId}/threads`, { media_type: "TEXT", text }, f)).id
  } else if (urls.length === 1) {
    creation = (await threadsCall(token, "POST", `${userId}/threads`, { media_type: "IMAGE", image_url: urls[0], text }, f)).id
  } else {
    const children: string[] = []
    for (const image_url of urls) children.push((await threadsCall(token, "POST", `${userId}/threads`, { media_type: "IMAGE", image_url, is_carousel_item: "true" }, f)).id)
    for (const c of children) await waitReady(c)
    creation = (await threadsCall(token, "POST", `${userId}/threads`, { media_type: "CAROUSEL", children: children.join(","), text }, f)).id
  }
  await waitReady(creation)
  const pub = await threadsCall(token, "POST", `${userId}/threads_publish`, { creation_id: creation }, f)
  const info = await threadsCall(token, "GET", pub.id, { fields: "permalink" }, f).catch(() => ({}))
  return { id: pub.id, url: (info as any).permalink }
}

// تحويل عنصر الكتالوج (بصيغة g:xxx من ملف الكتالوج) إلى صيغة items_batch (نفس أسماء حقول الملف، والسعر "700.00 USD")
export function feedItemToBatch(item: Record<string, string>) {
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item)) {
    const key = k.replace(/^g:/, "")
    data[key] = key === "additional_image_link" ? v.split(",") : v
  }
  return { method: "UPDATE", data }
}

// إضافة/تحديث المنتج في كتالوج ميتا فوراً (يظهر في متجر فيسبوك وإنستغرام وكتالوج واتساب المربوط)
export async function pushToCatalog(cfg: GraphConfig, catalogId: string, items: Record<string, string>[]): Promise<{ handles: string[] }> {
  if (!items.length) throw new GraphError("المنتج غير صالح للكتالوج (سعر أو صورة أو قناة بيع ناقصة)")
  const r = await call(cfg, "POST", `${catalogId}/items_batch`, {
    item_type: "PRODUCT_ITEM",
    allow_upsert: "true",
    requests: items.map(feedItemToBatch),
  })
  return { handles: r.handles || [] }
}
