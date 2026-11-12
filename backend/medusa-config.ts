import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

// هل ضُبطت متغيرات Cloudflare R2؟ إن لم تُضبط (تطوير محلي) نستخدم مزوّد الملفات المحلي.
const useR2 = Boolean(
  process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_ENDPOINT
)

// Redis اختياري محلياً، وإلزامي في الإنتاج (يُضبط في Coolify).
const redisUrl = process.env.REDIS_URL

// في الإنتاج نرفض التشغيل بدون أسرار حقيقية، حتى لا يعمل المتجر بقيمة افتراضية معروفة.
if (process.env.NODE_ENV === "production") {
  for (const key of ["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "COOKIE_SECRET"]) {
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
  }
}

const modules: Record<string, unknown>[] = [
  // تخزين الصور
  {
    resolve: "@medusajs/medusa/file",
    options: {
      providers: [
        useR2
          ? {
              resolve: "@medusajs/medusa/file-s3",
              id: "s3",
              options: {
                file_url: process.env.S3_FILE_URL,
                access_key_id: process.env.S3_ACCESS_KEY_ID,
                secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                region: process.env.S3_REGION || "auto",
                bucket: process.env.S3_BUCKET,
                endpoint: process.env.S3_ENDPOINT,
              },
            }
          : {
              resolve: "@medusajs/medusa/file-local",
              id: "local",
              // Without this, uploaded file URLs point to http://localhost:9000/static
              options: process.env.MEDUSA_BACKEND_URL
                ? { backend_url: `${process.env.MEDUSA_BACKEND_URL}/static` }
                : {},
            },
      ],
    },
  },
  // موديول أسعار الصرف الخاص بنا (القسم 6-ب)
  { resolve: "./src/modules/exchange-rate" },
]

if (redisUrl) {
  modules.push(
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: { redisUrl },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: { redis: { redisUrl } },
    }
  )
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
    // shared = الخادم والـ worker في عملية واحدة لتوفير الرام
    workerMode: (process.env.MEDUSA_WORKER_MODE || "shared") as
      | "shared"
      | "worker"
      | "server",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
    backendUrl: process.env.MEDUSA_BACKEND_URL,
  },
  modules,
})
