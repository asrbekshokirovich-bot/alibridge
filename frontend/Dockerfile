# ============================================
# ALI BRIDGE Frontend — multi-stage (Vite build -> nginx)
# ============================================

# Vite 8 rolldown native binding glibc talab qiladi — alpine(musl) emas, slim(glibc)
FROM node:20-slim AS build

WORKDIR /app

# Faqat package.json — lock faylni nusxalamaymiz (Windows binary'larni qayd etgan).
# Linux platform uchun to'g'ri rolldown/native binding'larni toza o'rnatamiz.
COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

# Production build — real API (mock o'chiq)
ENV VITE_USE_MOCK=false
ENV VITE_API_URL=/api/v1
RUN npm run build

# ============================================
# Production: nginx
# ============================================
FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
