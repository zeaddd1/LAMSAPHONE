# أداة الوصول إلى Coolify (مشروع LamsaPhone فقط)

## الإعداد مرة واحدة
1. في Coolify: **Settings → Advanced** وفعّل **API Access**.
2. **Keys & Tokens → API Tokens → Create**: اسم مثل `claude-lamsaphone`، والصلاحيات: `read` و`deploy` و`write` فقط. **لا تعطِه `root`**، ولا `read:sensitive` (حتى لا تظهر قيم الأسرار).
3. افتح المشروع في Coolify وانسخ الـ UUID من الرابط: `/project/<UUID>/...`.
4. انسخ `.coolify.env.example` إلى `.coolify.env` في نفس المجلد واملأ القيم.
5. جرّب في PowerShell:
   ```powershell
   cd D:\APP\LAMSASTORE\tools\coolify
   powershell -ExecutionPolicy Bypass -File .\coolify.ps1 test
   powershell -ExecutionPolicy Bypass -File .\coolify.ps1 list
   ```

## ملاحظة عن العزل
توكن Coolify يعمل على مستوى **الفريق (Team)** كله، لا على مشروع واحد. السكربت يرفض أي مورد خارج `COOLIFY_PROJECT_UUID`،
لكن للعزل الكامل: أنشئ **Team** جديداً باسم LamsaPhone، وأنشئ المشروع داخله، وولّد التوكن وأنت داخل ذلك الفريق.

## الأمان
- التوكن يبقى على جهازك فقط في `.coolify.env` (مُستثنى من Git). لا تلصقه في المحادثة.
- ابدأ بـ `COOLIFY_READONLY=true`، وحوّلها إلى `false` عندما تريد أن أنشر وأعيد التشغيل.
- لإلغاء الوصول: احذف التوكن من Coolify، فيتوقف فوراً.
