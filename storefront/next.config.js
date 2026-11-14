const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

// دومين صور R2 العام (مثل https://pub-xxxx.r2.dev أو دومين مخصص)
const fileUrl = process.env.S3_FILE_URL || process.env.NEXT_PUBLIC_S3_FILE_URL
const r2 = fileUrl ? new URL(fileUrl) : null

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone: صورة Docker أصغر ورام أقل
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // أخطاء أنواع موروثة من الـ starter مع إصدار types الأحدث؛ نفحص ملفاتنا بـ tsc يدوياً
  typescript: { ignoreBuildErrors: true },
  images: {
    // WebP فقط: ترميز AVIF على السيرفر بطيء ويستهلك رام كثيرة، والصور مضغوطة WebP من اللوحة أصلاً
    formats: ["image/webp"],
    // أسماء الصور المرفوعة فريدة، فنخزّن النسخ المحسّنة 30 يوماً بدل إعادة معالجتها
    minimumCacheTTL: 2592000,
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "cp.lamsaphone.yemenbay.com" },
      ...(r2 ? [{ protocol: r2.protocol.replace(":", ""), hostname: r2.hostname }] : []),
    ],
  },
}

module.exports = nextConfig
