# ---- البناء (على GitHub Actions) ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# متغيرات NEXT_PUBLIC_* تُدمج وقت البناء، لذلك تُمرَّر كـ build args
ARG MEDUSA_BACKEND_URL=https://cp.lamsaphone.yemenbay.com
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://cp.lamsaphone.yemenbay.com
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL=https://lamsaphone.yemenbay.com
ARG NEXT_PUBLIC_DEFAULT_REGION=ye
ARG NEXT_PUBLIC_DEFAULT_DISPLAY_CURRENCY=USD
ARG NEXT_PUBLIC_WHATSAPP_NUMBER
ARG S3_FILE_URL
ENV MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL \
    NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION \
    NEXT_PUBLIC_DEFAULT_DISPLAY_CURRENCY=$NEXT_PUBLIC_DEFAULT_DISPLAY_CURRENCY \
    NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER \
    S3_FILE_URL=$S3_FILE_URL
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- التشغيل: وضع standalone فقط ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=384 \
    PORT=8000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 8000
CMD ["node", "server.js"]
