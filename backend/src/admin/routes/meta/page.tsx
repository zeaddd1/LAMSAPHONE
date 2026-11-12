import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, ArrowUpRightOnBox, CheckCircleSolid, Channels, ExclamationCircle } from "@medusajs/icons"
import { Badge, Button, Container, Copy, Heading, Input, Label, Switch, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../../lib/sdk"

// صفحة ربط المتجر مع Meta: فيسبوك وإنستغرام وكتالوج واتساب للأعمال

type Settings = {
  pixel_id: string
  domain_verification: string
  catalog_id: string
  whatsapp_number: string
  feed_enabled: boolean
}
type Check = {
  feed_url: string
  currency: string
  products: number
  items: number
  in_stock: number
  out_of_stock: number
  condition: { new: number; used: number; refurbished: number }
  skipped: { id: string; title: string; reason: "no_channel" | "no_price" | "no_image" }[]
  sample: {
    id: string
    title: string
    price: string
    availability: string
    condition: string
    brand: string
    image: string
    link: string
  }[]
}

const EMPTY: Settings = { pixel_id: "", domain_verification: "", catalog_id: "", whatsapp_number: "", feed_enabled: true }

const REASONS: Record<Check["skipped"][number]["reason"], string> = {
  no_channel: "غير مضاف لقناة بيع المتجر",
  no_price: "بدون سعر بالدولار",
  no_image: "بدون صورة",
}
const CONDITIONS: Record<string, string> = { new: "جديد", used: "مستعمل", refurbished: "مجدّد" }

const STORE_DOMAIN = "lamsaphone.yemenbay.com"

// يقبل رمز التوثيق كما هو أو الوسم الكامل الذي تعطيه Meta
const extractVerification = (v: string) => v.match(/content=["']([^"']+)["']/)?.[1] || v.trim()

const Step = ({
  n,
  done,
  title,
  children,
}: {
  n: number
  done?: boolean
  title: string
  children: React.ReactNode
}) => (
  <div className="flex gap-x-3 py-3">
    <div className="pt-0.5">
      {done ? (
        <CheckCircleSolid className="text-ui-tag-green-icon" />
      ) : (
        <span className="txt-compact-small-plus bg-ui-bg-component text-ui-fg-subtle flex h-5 w-5 items-center justify-center rounded-full border">
          {n}
        </span>
      )}
    </div>
    <div className="flex flex-1 flex-col gap-y-2">
      <Text weight="plus">{title}</Text>
      <div className="text-ui-fg-subtle txt-small flex flex-col gap-y-2">{children}</div>
    </div>
  </div>
)

const LinkButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="w-fit">
    <Button size="small" variant="secondary" type="button">
      {children}
      <ArrowUpRightOnBox />
    </Button>
  </a>
)

const MetaPage = () => {
  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [saved, setSaved] = useState<Settings>(EMPTY)
  const [check, setCheck] = useState<Check | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)

  const runCheck = async () => {
    setChecking(true)
    try {
      setCheck(await sdk.client.fetch<Check>("/admin/meta-settings/check"))
    } catch (e: any) {
      toast.error(e?.message || "تعذّر فحص الكتالوج")
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    sdk.client
      .fetch<{ settings: Settings }>("/admin/meta-settings")
      .then(({ settings }) => {
        setSettings(settings)
        setSaved(settings)
      })
      .catch((e) => toast.error(String(e)))
    runCheck()
  }, [])

  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved)

  const save = async () => {
    setSaving(true)
    try {
      const body = { ...settings, domain_verification: extractVerification(settings.domain_verification) }
      const { settings: s } = await sdk.client.fetch<{ settings: Settings }>("/admin/meta-settings", {
        method: "POST",
        body,
      })
      setSettings(s)
      setSaved(s)
      toast.success("تم الحفظ. يظهر في المتجر خلال 5 دقائق")
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const feedUrl = check?.feed_url || `${window.location.origin}/feeds/meta.xml`
  const catalogUrl = saved.catalog_id
    ? `https://business.facebook.com/commerce/catalogs/${saved.catalog_id}/data_sources`
    : "https://business.facebook.com/commerce/"
  const feedOk = !!check && check.items > 0 && saved.feed_enabled

  return (
    <div className="flex flex-col gap-y-3" dir="rtl">
      {/* الحالة */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">ربط Meta (فيسبوك، إنستغرام، واتساب)</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              كتالوج واحد لمنتجاتك يتحدّث تلقائياً من المتجر، ويظهر في متجر فيسبوك وإنستغرام وكتالوج واتساب للأعمال.
            </Text>
          </div>
          <Button size="small" variant="secondary" onClick={runCheck} isLoading={checking}>
            <ArrowPath />
            فحص الكتالوج
          </Button>
        </div>

        <div className="flex flex-col gap-y-2 px-6 py-4">
          <Label>رابط الكتالوج (Data feed)</Label>
          <div className="flex items-center gap-x-2" dir="ltr">
            <div className="flex-1">
              <Input readOnly value={feedUrl} className="font-mono" />
            </div>
            <Copy content={feedUrl} />
            <a href={feedUrl} target="_blank" rel="noreferrer">
              <Button size="small" variant="transparent" type="button">
                <ArrowUpRightOnBox />
              </Button>
            </a>
          </div>
          {!saved.feed_enabled && (
            <Text size="small" className="text-ui-fg-error">
              الرابط متوقف الآن، ولن تقرأ Meta أي منتج حتى تفعّله من الإعدادات بالأسفل.
            </Text>
          )}
        </div>

        {check && (
          <div className="grid grid-cols-2 gap-4 px-6 py-4 md:grid-cols-5">
            <Stat label="منتجات منشورة" value={check.products} />
            <Stat label="عناصر في الكتالوج" value={check.items} />
            <Stat label="متوفر" value={check.in_stock} />
            <Stat label="غير متوفر" value={check.out_of_stock} />
            <Stat label="مستبعد" value={check.skipped.length} warn={check.skipped.length > 0} />
          </div>
        )}
        {check && (
          <div className="flex flex-wrap gap-2 px-6 py-3">
            <Badge size="small">العملة: {check.currency}</Badge>
            <Badge size="small">جديد: {check.condition.new}</Badge>
            <Badge size="small">مستعمل: {check.condition.used}</Badge>
            <Badge size="small">مجدّد: {check.condition.refurbished}</Badge>
          </div>
        )}
      </Container>

      {/* المنتجات المستبعدة */}
      {check && check.skipped.length > 0 && (
        <Container className="p-0">
          <div className="flex items-center gap-x-2 px-6 py-4">
            <ExclamationCircle className="text-ui-fg-error" />
            <Heading level="h2">منتجات لن تظهر في Meta</Heading>
          </div>
          <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>المنتج</Table.HeaderCell>
                <Table.HeaderCell>السبب</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {check.skipped.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>{p.title}</Table.Cell>
                  <Table.Cell>{REASONS[p.reason]}</Table.Cell>
                  <Table.Cell>
                    <a href={`/app/products/${p.id}`} className="text-ui-fg-interactive txt-small">
                      تعديل
                    </a>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          </div>
        </Container>
      )}

      {/* عينة */}
      {check && check.sample.length > 0 && (
        <Container className="p-0">
          <div className="px-6 py-4">
            <Heading level="h2">كيف تراها Meta</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              أول {check.sample.length} عنصر من الكتالوج. حالة الجوال تُقرأ من خيار "الحالة"، والماركة من اسم المنتج أو من
              metadata باسم brand.
            </Text>
          </div>
          <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell></Table.HeaderCell>
                <Table.HeaderCell>العنوان</Table.HeaderCell>
                <Table.HeaderCell>السعر</Table.HeaderCell>
                <Table.HeaderCell>الحالة</Table.HeaderCell>
                <Table.HeaderCell>الماركة</Table.HeaderCell>
                <Table.HeaderCell>التوفر</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {check.sample.map((i) => (
                <Table.Row key={i.id}>
                  <Table.Cell>
                    <img src={i.image} alt="" className="h-8 w-8 rounded object-cover" />
                  </Table.Cell>
                  <Table.Cell>
                    <a href={i.link} target="_blank" rel="noreferrer" className="hover:underline">
                      {i.title}
                    </a>
                  </Table.Cell>
                  <Table.Cell dir="ltr">{i.price}</Table.Cell>
                  <Table.Cell>{CONDITIONS[i.condition] || i.condition}</Table.Cell>
                  <Table.Cell>{i.brand}</Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall" color={i.availability === "in stock" ? "green" : "grey"}>
                      {i.availability === "in stock" ? "متوفر" : "غير متوفر"}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          </div>
        </Container>
      )}

      {/* الإعدادات */}
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">الإعدادات</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            تُحفظ في المتجر وتعمل مباشرة، بدون إعادة بناء أو نشر.
          </Text>
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-2">
          <Field label="رقم Pixel (من Events Manager)" hint="أرقام فقط، مثل 1234567890123456">
            <Input dir="ltr" value={settings.pixel_id} onChange={(e) => set({ pixel_id: e.target.value.trim() })} />
          </Field>
          <Field label="رمز توثيق الدومين" hint="ألصق الرمز أو وسم meta كاملاً كما تعطيك Meta">
            <Input
              dir="ltr"
              value={settings.domain_verification}
              onChange={(e) => set({ domain_verification: e.target.value })}
            />
          </Field>
          <Field label="رقم الكتالوج في Commerce Manager" hint="اختياري، لفتح الكتالوج مباشرة من هنا">
            <Input dir="ltr" value={settings.catalog_id} onChange={(e) => set({ catalog_id: e.target.value.trim() })} />
          </Field>
          <Field label="رقم واتساب الأعمال" hint="بالصيغة الدولية بدون +، مثل 967770777736">
            <Input
              dir="ltr"
              value={settings.whatsapp_number}
              onChange={(e) => set({ whatsapp_number: e.target.value.replace(/\D/g, "") })}
            />
          </Field>
          <div className="flex items-center gap-x-2">
            <span dir="ltr" className="flex">
              <Switch checked={settings.feed_enabled} onCheckedChange={(v) => set({ feed_enabled: v })} />
            </span>
            <Label>رابط الكتالوج مفعّل</Label>
          </div>
        </div>
        <div className="flex justify-end px-6 py-4">
          <Button onClick={save} isLoading={saving} disabled={!dirty}>
            حفظ
          </Button>
        </div>
      </Container>

      {/* خطوات الربط */}
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">خطوات الربط</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            الربط نفسه يتم داخل حساب Meta، وهذه الخطوات بالترتيب مع روابط مباشرة.
          </Text>
        </div>
        <div className="divide-y px-6">
          <Step n={1} title="حساب الأعمال (Business portfolio)">
            <span>أنشئ حساب أعمال، واربط به صفحة فيسبوك وحساب إنستغرام التجاري.</span>
            <LinkButton href="https://business.facebook.com/settings/">إعدادات الأعمال</LinkButton>
          </Step>
          <Step n={2} done={feedOk && !!saved.catalog_id} title="الكتالوج (Commerce Manager)">
            <span>
              أضف كتالوجاً من نوع E-commerce، ثم من Data sources اختر Data feed، وألصق رابط الكتالوج أعلاه، واجعل
              التحديث كل ساعة أو يومياً، والعملة USD. بعد ذلك انسخ رقم الكتالوج إلى الإعدادات.
            </span>
            <div className="flex flex-wrap gap-2">
              <LinkButton href={catalogUrl}>فتح Commerce Manager</LinkButton>
              <Copy content={feedUrl} asChild>
                <Button size="small" variant="secondary" type="button">
                  نسخ رابط الكتالوج
                </Button>
              </Copy>
            </div>
          </Step>
          <Step n={3} done={!!saved.pixel_id} title="Pixel (قياس الزيارات والطلبات)">
            <span>
              أنشئ Pixel (Dataset) وانسخ رقمه إلى الإعدادات. المتجر يرسل تلقائياً: مشاهدة منتج، إضافة للسلة، بدء الطلب،
              والشراء. اربط الـ Pixel بالكتالوج من إعدادات الكتالوج (Event sources).
            </span>
            <LinkButton href="https://business.facebook.com/events_manager2/">فتح Events Manager</LinkButton>
          </Step>
          <Step n={4} done={!!saved.domain_verification} title={`توثيق الدومين ${STORE_DOMAIN}`}>
            <span>أضف الدومين، واختر طريقة Meta-tag، وانسخ الرمز إلى الإعدادات واحفظ، ثم اضغط Verify في Meta بعد 5 دقائق.</span>
            <LinkButton href="https://business.facebook.com/settings/owned-domains">فتح Domains</LinkButton>
          </Step>
          <Step n={5} title="كتالوج واتساب للأعمال">
            <span>
              اربط حساب واتساب للأعمال بحساب الأعمال، ثم في Commerce Manager افتح Settings ثم Business assets، واختر حساب
              واتساب. أو من تطبيق واتساب للأعمال: الإعدادات ثم أدوات الأعمال ثم الكتالوج.
            </span>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="https://business.facebook.com/settings/whatsapp-business-accounts">
                حسابات واتساب
              </LinkButton>
              {saved.whatsapp_number && (
                <LinkButton href={`https://wa.me/${saved.whatsapp_number}`}>تجربة المحادثة</LinkButton>
              )}
            </div>
          </Step>
          <Step n={6} title="متجر فيسبوك وإنستغرام">
            <span>
              من Commerce Manager أنشئ Shop واختر الكتالوج، وطريقة الشراء "على موقعك" (Checkout on website). ميزة وسم
              المنتجات في إنستغرام تحتاج موافقة Meta لدولة الحساب، وقد لا تتوفر لحسابات اليمن.
            </span>
          </Step>
        </div>
      </Container>
    </div>
  )
}

const Stat = ({ label, value, warn }: { label: string; value: number; warn?: boolean }) => (
  <div className="flex flex-col">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Text size="xlarge" weight="plus" className={warn ? "text-ui-fg-error" : undefined}>
      {value}
    </Text>
  </div>
)

const Field = ({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-y-1">
    <Label>{label}</Label>
    {children}
    <Text size="xsmall" className="text-ui-fg-subtle">
      {hint}
    </Text>
  </div>
)

export const config = defineRouteConfig({ label: "ربط Meta", icon: Channels })
export default MetaPage
