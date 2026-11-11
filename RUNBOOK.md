# دليل التشغيل على Coolify (لمسة فون)

خطوات مرقّمة تنفّذها مرة واحدة. السيرفر: 2 vCPU / 4GB RAM / 40GB.

## 1. إضافة Swap بحجم 4GB على السيرفر
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf && sudo sysctl -p /etc/sysctl.d/99-swap.conf
free -h
```

## 2. DNS في Cloudflare
- سجل `A` باسم `lamsaphone` وسجل `A` باسم `cp.lamsaphone`، كلاهما على IP السيرفر.
- اجعل السجلين **DNS only (رمادي)**. شهادة Cloudflare المجانية لا تغطي `cp.lamsaphone.yemenbay.com` (مستوى فرعي ثانٍ)، فيُصدر Coolify شهادة Let's Encrypt بنفسه.

## 3. GitHub
1. ادفع المستودع إلى GitHub على الفرع `main`. سيبني GitHub Actions الصورتين ويرفعهما إلى GHCR:
   - `ghcr.io/<owner>/lamsaphone-backend:latest`
   - `ghcr.io/<owner>/lamsaphone-storefront:latest`
2. في المستودع: **Settings → Secrets and variables → Actions → Variables** أضف:
   - `WHATSAPP_NUMBER` (مثل `9677XXXXXXXX` بدون +)
   - `S3_FILE_URL` (الرابط العام لـ R2)
   - `PUBLISHABLE_KEY` (يُضاف في الخطوة 6)

## 4. ربط GHCR في Coolify وإنشاء التطبيقين
1. أنشئ في GitHub توكن **classic** بصلاحية `read:packages` فقط.
2. Coolify → **Settings → Docker Registries** (أو Keys & Tokens حسب الإصدار): أضف `ghcr.io` باسم مستخدم GitHub والتوكن.
3. داخل مشروع **LAMSAPHONE → production** أنشئ تطبيقين من **Docker Image**:

| | Backend | Storefront |
|---|---|---|
| الصورة | `ghcr.io/<owner>/lamsaphone-backend:latest` | `ghcr.io/<owner>/lamsaphone-storefront:latest` |
| المنفذ | 9000 | 8000 |
| الدومين | `https://cp.lamsaphone.yemenbay.com` | `https://lamsaphone.yemenbay.com` |
| Healthcheck | `/health` | `/` |
| حد الذاكرة | 1.5GB (`1536m`) | 512MB (`512m`) |

## 5. متغيرات البيئة
ولّد الأسرار على جهازك أو السيرفر:
```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # COOKIE_SECRET
```

**Backend** (انسخ من `backend/.env.example` واملأ):
- `DATABASE_URL` و`REDIS_URL`: استخدم الرابط **الداخلي** (Internal URL) من صفحة قاعدة PostgreSQL وصفحة Redis في نفس المشروع، وليس الرابط العام.
- `JWT_SECRET`، `COOKIE_SECRET`، `MEDUSA_WORKER_MODE=shared`، `NODE_ENV=production`، `LOG_LEVEL=info`
- `MEDUSA_BACKEND_URL=https://cp.lamsaphone.yemenbay.com`
- `STORE_CORS=https://lamsaphone.yemenbay.com`
- `ADMIN_CORS=https://cp.lamsaphone.yemenbay.com`
- `AUTH_CORS=https://lamsaphone.yemenbay.com,https://cp.lamsaphone.yemenbay.com`
- متغيرات R2: `S3_FILE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ENDPOINT`

**Storefront** (وقت التشغيل):
- `MEDUSA_BACKEND_URL=https://cp.lamsaphone.yemenbay.com`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<من الخطوة 6>`

## 6. إعداد Redis/Valkey
في إعدادات Redis داخل Coolify (Custom Redis Configuration):
```
maxmemory 256mb
maxmemory-policy noeviction
```
ثم أعد تشغيل Redis.

## 7. التشغيل الأول (بالترتيب)
1. انشر **Backend** وانتظر حتى يصبح `healthy` (يطبّق الترحيلات تلقائياً).
2. من **Terminal** التطبيق في Coolify:
   ```bash
   npx medusa user -e you@example.com -p 'كلمة-سر-قوية'
   npx medusa exec ./src/scripts/setup-lamsaphone.js
   ```
3. انسخ السطر `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...` من المخرجات.
4. ضعه في GitHub Variables باسم `PUBLISHABLE_KEY`، وفي متغيرات Storefront في Coolify.
5. من GitHub → Actions → build → **Run workflow** لإعادة بناء الواجهة.
6. انشر **Storefront**.

## 8. اختبار نهائي
- `https://cp.lamsaphone.yemenbay.com/health` يرجع `OK`.
- ادخل `https://cp.lamsaphone.yemenbay.com/app`، وأدخل أسعار الصرف من صفحة **أسعار الصرف** وفعّلها.
- أضف منتجاً مع صورة (يجب أن تُرفع إلى R2).
- اطلب طلباً تجريبياً من الواجهة بالريال اليمني، وتأكد أن صفحة الطلب في اللوحة تعرض "المبلغ بعملة العميل".

## 9. نسخ احتياطي
- في صفحة PostgreSQL داخل Coolify: **Backups** → جدول يومي (مثلاً `0 3 * * *`)، ويفضّل وجهة S3/R2.
- جرّب استعادة واحدة على قاعدة مؤقتة قبل الإطلاق.

## 10. تنظيف Docker الأسبوعي
Coolify → Server → **Docker Cleanup** فعّل التنظيف التلقائي، أو أضف cron على السيرفر:
```bash
0 4 * * 0 docker system prune -af --filter "until=168h" >/dev/null 2>&1
```

## ملاحظات أمان
- لوحة التحكم هدف للهجمات: يُفضّل حمايتها بـ Cloudflare Access أو قائمة IP.
- كلمات سر قوية لكل حساب إدارة.
- توكن Coolify الذي يستخدمه Claude: صلاحيات `read`, `write`, `deploy` فقط، وليس `root`.
