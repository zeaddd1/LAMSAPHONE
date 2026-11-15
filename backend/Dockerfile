# ---- مرحلة البناء (تعمل على GitHub Actions، ليس على السيرفر) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- صورة التشغيل: فقط مخرجات البناء + حزم الإنتاج ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=1024
COPY --from=build /app/.medusa/server ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
# Local uploads folder, writable by node (a new Coolify volume here inherits this ownership)
RUN mkdir -p /app/static && chown -R node:node /app/static
USER node
EXPOSE 9000
# تطبيق الترحيلات (migrations) ثم التشغيل
CMD ["sh", "-c", "npx medusa db:migrate && npm run start"]
