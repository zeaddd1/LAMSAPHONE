# لمسة فون (LamsaPhone)

متجر جوالات وإكسسوارات: **Medusa v2.22.6** (باك إند + لوحة تحكم) و**Next.js 15** (واجهة عربية RTL)، منشور على Coolify بأقل استهلاك للموارد.

| الجزء | المجلد | الدومين | المنفذ |
|---|---|---|---|
| الباك إند + لوحة التحكم (`/app`) | `backend/` | `cp.lamsaphone.yemenbay.com` | 9000 |
| الواجهة | `storefront/` | `lamsaphone.yemenbay.com` | 8000 |

النشر خطوة بخطوة: [RUNBOOK.md](RUNBOOK.md).

## التطوير المحلي
```bash
# الباك إند (يحتاج PostgreSQL، وRedis اختياري محلياً)
cd backend && cp .env.example .env   # عدّل القيم المحلية
npm install
npx medusa db:migrate
npx medusa user -e admin@example.com -p secret
npm run setup          # إعداد المتجر (آمن لإعادة التشغيل) ويطبع المفتاح العام
npm run dev            # http://localhost:9000/app

# الواجهة
cd storefront && cp .env.example .env.local   # ضع المفتاح العام وروابط localhost
npm install && npm run dev                    # http://localhost:8000
```

اختبارات دالة التحويل والتقريب: `cd backend && npm run test:unit`

## ما يحتويه
- **أسعار الصرف** (`backend/src/modules/exchange-rate`): العملات USD / SAR / ريال يمني قديم / ريال يمني جديد. الأسعار في المتجر بالدولار فقط، والمدير يحدد سعر الصرف وخطوة التقريب من صفحة **أسعار الصرف** في اللوحة، وكل تعديل يُسجَّل.
  - `GET /store/exchange-rates` عام (كاش 60 ثانية).
  - `GET|POST /admin/exchange-rates` و`GET /admin/exchange-rates/history` للمدير فقط.
- **تثبيت المبلغ عند الطلب**: المتصفح يرسل رمز العملة فقط. عند `order.placed` يحسب الخادم المبلغ من إجمالي الطلب بالدولار وسعر الصرف الحالي، ويحفظ في `metadata`: `display_currency`, `rate_used`, `rounding_step`, `amount_due_display`, `amount_usd`, `rate_timestamp`. أي قيم من المتصفح تُستبدل.
- **ويدجت في اللوحة**: مواصفات الجوال السريعة في صفحة المنتج، والمبلغ بعملة العميل وزر واتساب في صفحة الطلب.
- **تنبيه المخزون المنخفض**: تحذير في السجل عند نزول الكمية عن `LOW_STOCK_THRESHOLD`.
- **تتبع الطلب بدون حساب**: `/track-order` (رقم الطلب + البريد أو الجوال).
- **الواجهة**: عربية RTL بخط Tajawal، الشعار الرسمي، محدد العملة (كوكي `lp_currency`)، دالة عرض مركزية `formatPrice` في `storefront/src/lib/currency/format.ts`، النصوص في `storefront/src/lib/i18n/ar.ts`، زر واتساب، `sitemap.xml` و`robots.txt` وبيانات Product المنظمة، الدفع عند الاستلام فقط.

## قيود يجب معرفتها
1. **تقارير المبيعات** المدمجة في Medusa بالدولار. للتقرير بالعملات المختارة: صدّر الطلبات واجمع `metadata.amount_due_display` حسب `metadata.display_currency` (يمكن إضافة صفحة تقرير بسيطة في اللوحة لاحقاً تقرأ نفس الحقول).
2. **سعر ثابت بعملة محلية لمنتج معيّن**: غير مدعوم الآن. الاقتراح: حقل `metadata.fixed_prices` في المتغيّر (مثل `{"YER_OLD": 50000}`) تقرأه `formatPrice` والمشترك `order-display-amount` كاستثناء قبل التحويل.
3. **أرقام التقريب** (0.5 للسعودي و100 لليمني، والتقريب لأقرب خطوة) يجب مراجعتها مع المحاسب قبل الإطلاق.
4. إذا اختار العميل عملة غير مفعّلة أو بلا سعر، يُثبَّت الطلب بالدولار.
5. في صفحات الطلبات القديمة، الإجماليات بالدولار والمبلغ المستحق من القيمة المثبّتة، لكن أسعار الأسطر المفردة تُعرض بعملة العرض الحالية وسعر اليوم (للعرض فقط).
