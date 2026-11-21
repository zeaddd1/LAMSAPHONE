import { Badge, Button, Input, Label, Text, toast, usePrompt } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"

// تبويب "ربط ميتا" في صفحة الإضافة السريعة: الإعدادات + فحص الربط + خطوات الربط بالعربي

export type MetaPublic = {
  has_token: boolean
  token_hint: string
  page_id: string
  catalog_id: string
  ig_user_id: string
  graph_version: string
  threads_has_token?: boolean
  threads_token_hint?: string
  threads_user_id?: string
  from_env: { token: boolean; page_id: boolean; catalog_id: boolean }
}
type Check = {
  ok: boolean
  error?: string
  feed_url: string
  facebook?: { ok: boolean; name?: string; error?: string }
  instagram?: { ok: boolean; username?: string; id?: string; error?: string }
  catalog?: { ok: boolean; name?: string; product_count?: number; error?: string }
  threads?: { ok: boolean; username?: string; id?: string; error?: string }
}

const FEED = "https://cp.lamsaphone.yemenbay.com/feeds/meta.xml"

export default function MetaConnectTab({ onSaved }: { onSaved: () => void }) {
  const [s, setS] = useState<MetaPublic | null>(null)
  const [token, setToken] = useState("")
  const [pageId, setPageId] = useState("")
  const [catalogId, setCatalogId] = useState("")
  const [igId, setIgId] = useState("")
  const [saving, setSaving] = useState(false)
  const [check, setCheck] = useState<Check | null>(null)
  const [checking, setChecking] = useState(false)
  const prompt = usePrompt()

  const apply = (x: MetaPublic) => {
    setS(x)
    setPageId(x.page_id)
    setCatalogId(x.catalog_id)
    setIgId(x.ig_user_id)
  }
  useEffect(() => {
    sdk.client.fetch<{ settings: MetaPublic }>("/admin/quick-add/meta-settings").then((r) => apply(r.settings)).catch(() => {})
  }, [])

  const runCheck = async () => {
    setChecking(true)
    try {
      setCheck(await sdk.client.fetch<Check>("/admin/quick-add/meta-settings/check"))
    } catch (e: any) {
      toast.error(e?.message || "فشل الفحص")
    } finally {
      setChecking(false)
    }
  }

  const save = async (clear = false) => {
    // تحذير قبل أي تعديل على الربط: خطأ هنا يوقف النشر والكتالوج والرد الآلي
    const changes = [
      token.trim() && "رمز الوصول (سيُستبدل الرمز الحالي)",
      clear && "حذف رمز الوصول (سيتوقف النشر والرد الآلي)",
      s && pageId.trim() !== s.page_id && `رقم الصفحة: ${s.page_id || "—"} ← ${pageId.trim() || "—"}`,
      s && catalogId.trim() !== s.catalog_id && `رقم الكتالوج: ${s.catalog_id || "—"} ← ${catalogId.trim() || "—"}`,
      s && igId.trim() !== s.ig_user_id && `رقم إنستغرام: ${s.ig_user_id || "—"} ← ${igId.trim() || "—"}`,
    ].filter(Boolean) as string[]
    if (!changes.length) {
      toast.info("لا توجد تغييرات للحفظ")
      return
    }
    const ok = await prompt({
      title: "تأكيد تعديل ربط ميتا",
      description: `ستتغير الإعدادات التالية:\n• ${changes.join("\n• ")}\n\nأي خطأ هنا يوقف النشر على فيسبوك وإنستغرام والكتالوج والرد الآلي. هل أنت متأكد؟`,
      confirmText: "نعم، احفظ",
      cancelText: "إلغاء",
    })
    if (!ok) return
    setSaving(true)
    try {
      const r = await sdk.client.fetch<{ settings: MetaPublic }>("/admin/quick-add/meta-settings", {
        method: "POST",
        body: { token: token.trim() || undefined, page_id: pageId.trim(), catalog_id: catalogId.trim(), ig_user_id: igId.trim(), clear_token: clear || undefined },
      })
      apply(r.settings)
      setToken("")
      toast.success("تم الحفظ")
      onSaved()
      if (r.settings.has_token) runCheck()
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const status = (x?: { ok: boolean; error?: string }, okText?: string) =>
    !x ? null : x.ok ? <Badge size="2xsmall" color="green">{okText || "يعمل"}</Badge> : <Text size="small" className="text-ui-fg-error">{x.error}</Text>

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label>رمز الوصول (System User Token)</Label>
          <Input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={s?.has_token ? `محفوظ (${s.token_hint}) — اتركه فارغاً للإبقاء عليه` : "الصقه هنا"} />
          {s?.from_env.token && <Text size="xsmall" className="text-ui-fg-subtle">مضبوط من متغيرات السيرفر (META_ACCESS_TOKEN) وله الأولوية.</Text>}
        </div>
        <div className="flex flex-col gap-1">
          <Label>رقم صفحة فيسبوك (Page ID)</Label>
          <Input dir="ltr" inputMode="numeric" value={pageId} onChange={(e) => setPageId(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>رقم الكتالوج (Catalog ID)</Label>
          <Input dir="ltr" inputMode="numeric" value={catalogId} onChange={(e) => setCatalogId(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>رقم حساب إنستغرام (اختياري، يُكتشف تلقائياً)</Label>
          <Input dir="ltr" inputMode="numeric" value={igId} onChange={(e) => setIgId(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button isLoading={saving} onClick={() => save()}>حفظ</Button>
          <Button variant="secondary" isLoading={checking} disabled={!s?.has_token} onClick={runCheck}>فحص الربط</Button>
          {s?.has_token && !s.from_env.token && (
            <Button variant="danger" onClick={() => save(true)}>حذف الرمز</Button>
          )}
        </div>
        {check && (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            {check.error && <Text size="small" className="text-ui-fg-error">{check.error}</Text>}
            <div className="flex items-center gap-2"><Text size="small">فيسبوك:</Text>{status(check.facebook, check.facebook?.name)}</div>
            <div className="flex items-center gap-2"><Text size="small">إنستغرام:</Text>{status(check.instagram, check.instagram?.username ? `@${check.instagram.username}` : undefined)}</div>
            <div className="flex items-center gap-2"><Text size="small">الكتالوج:</Text>{status(check.catalog, check.catalog?.name)}</div>
            <div className="flex items-center gap-2"><Text size="small">Threads:</Text>{status(check.threads, check.threads?.username ? `@${check.threads.username}` : undefined)}</div>
          </div>
        )}
        <ThreadsBox s={s} onSaved={(x) => (apply(x), runCheck())} />
        <div className="flex flex-col gap-1 rounded-lg border p-3">
          <Label size="small">رابط الكتالوج التلقائي (Data feed)</Label>
          <div className="flex gap-2">
            <Input dir="ltr" readOnly value={check?.feed_url || FEED} />
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(check?.feed_url || FEED).then(() => toast.success("نُسخ"))}>نسخ</Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-7">
        <Text weight="plus">خطوات الربط (مرة واحدة فقط)</Text>
        <ol className="list-decimal ps-5">
          <li>
            افتح <a className="underline" href="https://business.facebook.com/settings" target="_blank" rel="noreferrer">إعدادات الأعمال</a> في ميتا. تأكد أن صفحة فيسبوك وحساب إنستغرام (حساب أعمال) موجودان تحت
            <b> الحسابات</b>، وأن إنستغرام مربوط بالصفحة.
          </li>
          <li>
            أنشئ الكتالوج من <a className="underline" href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer">مدير التجارة</a>: إنشاء كتالوج ← تجارة إلكترونية. ثم
            <b> مصادر البيانات ← إضافة عناصر ← خلاصة بيانات (Data feed) ← رابط</b>، والصق رابط الكتالوج الظاهر هنا، واختر التحديث <b>كل ساعة</b>، والعملة USD.
          </li>
          <li>
            أنشئ تطبيقاً من <a className="underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">مطوري ميتا</a> بنوع <b>Business</b> واربطه بحساب أعمالك، ثم حوّله إلى وضع <b>Live</b> (يطلب رابط سياسة خصوصية: ضع رابط المتجر) حتى تظهر المنشورات للجميع.
          </li>
          <li>
            في إعدادات الأعمال ← <b>المستخدمون ← مستخدمو النظام</b>: أضف مستخدماً بدور <b>مسؤول</b>، ثم «تعيين أصول»: الصفحة (تحكم كامل)، حساب إنستغرام، والكتالوج (تحكم كامل)، والتطبيق.
          </li>
          <li>
            اضغط «إنشاء رمز» لمستخدم النظام، اختر التطبيق، ومدة الصلاحية <b>أبداً</b>، وفعّل الصلاحيات:
            <span dir="ltr" className="block font-mono text-xs">pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement, instagram_basic, instagram_content_publish, instagram_manage_comments, catalog_management, business_management</span>
          </li>
          <li>
            الصق الرمز هنا. رقم الصفحة تجده في صفحتك ← <b>حول ← الشفافية</b>، ورقم الكتالوج في أعلى صفحة الكتالوج بمدير التجارة. ثم اضغط <b>حفظ</b> و<b>فحص الربط</b>.
          </li>
          <li>
            <b>واتساب:</b> من تطبيق واتساب للأعمال ← الأدوات ← الكتالوج، أو من مدير واتساب، اربط نفس الكتالوج. كل منتج يُضاف للكتالوج يظهر في واتساب تلقائياً.
          </li>
        </ol>
        <Text size="small" className="text-ui-fg-subtle">
          ملاحظات: الرمز يُحفظ في السيرفر ولا يظهر مرة أخرى. روابط إنستغرام داخل المنشور لا تُضغط (قيد من إنستغرام)، لذلك ضع رابط المتجر في البايو أيضاً؛ فيسبوك والكتالوج وواتساب روابطها تعمل.
          النشر يحتاج أن تكون الصور على رابط عام دائم.
        </Text>
      </section>
    </div>
  )
}

// ربط Threads: رمز منفصل عن رمز ميتا (Threads له واجهته الخاصة). يُجدَّد تلقائياً كل 30 يوماً.
function ThreadsBox({ s, onSaved }: { s: MetaPublic | null; onSaved: (x: MetaPublic) => void }) {
  const [token, setToken] = useState("")
  const [userId, setUserId] = useState("")
  const [saving, setSaving] = useState(false)
  const [help, setHelp] = useState(false)
  const prompt = usePrompt()
  useEffect(() => setUserId(s?.threads_user_id || ""), [s?.threads_user_id])

  const save = async (clear = false) => {
    if (!s) return
    if (!clear && !token.trim() && userId.trim() === (s.threads_user_id || "")) return toast.info("لا توجد تغييرات للحفظ")
    if (clear && !(await prompt({ title: "حذف رمز Threads؟", description: "سيتوقف النشر على Threads حتى تضع رمزاً جديداً.", confirmText: "نعم، احذف", cancelText: "إلغاء" }))) return
    setSaving(true)
    try {
      // نرسل إعدادات ميتا الحالية كما هي حتى لا تتغير
      const r = await sdk.client.fetch<{ settings: MetaPublic }>("/admin/quick-add/meta-settings", {
        method: "POST",
        body: { page_id: s.page_id, catalog_id: s.catalog_id, ig_user_id: s.ig_user_id, threads_token: token.trim() || undefined, threads_user_id: userId.trim() || undefined, clear_threads_token: clear || undefined },
      })
      setToken("")
      toast.success(clear ? "حُذف رمز Threads" : "تم حفظ Threads")
      onSaved(r.settings)
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Text weight="plus">🧵 Threads</Text>
        {s?.threads_has_token ? <Badge size="2xsmall" color="green">مربوط</Badge> : <Badge size="2xsmall" color="grey">غير مربوط</Badge>}
      </div>
      <div className="flex flex-col gap-1">
        <Label size="small">رمز Threads (Access Token)</Label>
        <Input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={s?.threads_has_token ? `محفوظ (${s.threads_token_hint}) — اتركه فارغاً للإبقاء عليه` : "الصقه هنا"} />
      </div>
      <div className="flex flex-col gap-1">
        <Label size="small">رقم حساب Threads (اختياري، يُكتشف من الرمز)</Label>
        <Input dir="ltr" inputMode="numeric" value={userId} onChange={(e) => setUserId(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="small" isLoading={saving} onClick={() => save()}>حفظ Threads</Button>
        {s?.threads_has_token && <Button size="small" variant="danger" onClick={() => save(true)}>حذف الرمز</Button>}
        <Button size="small" variant="transparent" onClick={() => setHelp((x) => !x)}>{help ? "إخفاء الخطوات" : "كيف أحصل على الرمز؟"}</Button>
      </div>
      {help && (
        <ol className="list-decimal ps-5 text-sm leading-7">
          <li>
            افتح <a className="underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">مطوري ميتا</a> ← تطبيقك (أو أنشئ تطبيقاً) ← <b>إضافة حالة استخدام</b> ← <b>Access the Threads API</b>.
          </li>
          <li>
            في إعدادات Threads فعّل الصلاحيات: <span dir="ltr" className="font-mono text-xs">threads_basic, threads_content_publish</span>.
          </li>
          <li>
            من <b>الأدوار ← مختبرو Threads</b> أضف حساب Threads الخاص بالمتجر، ثم اقبل الدعوة من تطبيق Threads ← الإعدادات ← الحساب ← أذونات المواقع.
          </li>
          <li>
            من <b>Use cases ← Threads ← Settings</b> اضغط <b>Generate access token</b> (أو من
            <a className="underline" href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer"> Graph Explorer</a> باختيار threads.net)، ثم حوّله لرمز طويل الأمد (60 يوماً).
          </li>
          <li>الصق الرمز هنا واضغط حفظ ثم «فحص الربط». النظام يجدّده تلقائياً كل 30 يوماً.</li>
        </ol>
      )}
    </div>
  )
}
