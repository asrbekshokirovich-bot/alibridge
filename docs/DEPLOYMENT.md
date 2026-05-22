# ALI BRIDGE — VPS Deploy Qo'llanmasi

## Talablar

| Component | Min talabi |
|-----------|-----------|
| OS | Ubuntu 22.04 LTS |
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disk | 40 GB SSD |
| Domain | `https://` (Telegram Mini App talabi) |

---

## 1-qadam: Serverga kirish va tayyor qilish

```bash
# Server yangilash
sudo apt update && sudo apt upgrade -y

# Zarur paketlar
sudo apt install -y git curl docker.io docker-compose-plugin ufw

# Docker service
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker
```

---

## 2-qadam: Loyihani klonlash

```bash
cd /opt
sudo git clone https://github.com/YOUR_ORG/ali-bridge.git
sudo chown -R $USER:$USER ali-bridge
cd ali-bridge
```

---

## 3-qadam: Environment sozlash

```bash
cp .env.example .env
nano .env
```

**Muhim o'zgaruvchilar:**

```env
# Telegram
BOT_TOKEN=7xxxxxxxxxx:AAAAxx...  # @BotFather dan olish
WEBHOOK_URL=https://YOUR_DOMAIN/api/v1/telegram/webhook

# Database
POSTGRES_USER=ali_bridge_app
POSTGRES_PASSWORD=STRONG_RANDOM_PASSWORD_HERE
DATABASE_URL=postgresql+asyncpg://ali_bridge_app:STRONG_RANDOM_PASSWORD_HERE@db:5432/ali_bridge

# Redis
REDIS_PASSWORD=ANOTHER_STRONG_PASSWORD
REDIS_URL=redis://:ANOTHER_STRONG_PASSWORD@redis:6379/0

# Security (python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET=generate_64_char_random_string
QR_HMAC_SECRET=generate_another_64_char_random
ENCRYPTION_KEY=generate_32_byte_base64_key

# S3 (Wasabi yoki Backblaze B2)
S3_ENDPOINT_URL=https://s3.wasabisys.com
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BUCKET_NAME=ali-bridge-prod

# OCR (Google Cloud Vision)
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/google_credentials

# SMS (Eskiz.uz)
ESKIZ_EMAIL=your@email.com
ESKIZ_PASSWORD=your_password

# Domain
DOMAIN=YOUR_DOMAIN.COM
```

---

## 4-qadam: SSL sertifikat (Let's Encrypt)

```bash
# Certbot o'rnatish
sudo apt install -y certbot

# Nginx to'xtatish (agar ishlaayotgan bo'lsa)
# docker-compose down nginx

# Sertifikat olish
sudo certbot certonly --standalone \
  -d YOUR_DOMAIN.COM \
  -d www.YOUR_DOMAIN.COM \
  --email your@email.com \
  --agree-tos

# Sertifikat fayllari: /etc/letsencrypt/live/YOUR_DOMAIN.COM/
```

Nginx conf'da domenni almashtirish:
```bash
sed -i 's/YOUR_DOMAIN.COM/your-actual-domain.com/g' infra/nginx/nginx.conf
```

---

## 5-qadam: Google credentials (OCR)

```bash
mkdir -p secrets
# google_credentials.json faylini yuklab qo'yish
nano secrets/google_credentials.json
```

---

## 6-qadam: Production'ga ko'tarish

```bash
# Images build
docker compose -f docker-compose.prod.yml build

# Ko'tarish
docker compose -f docker-compose.prod.yml up -d

# Holat tekshirish
docker compose -f docker-compose.prod.yml ps
```

---

## 7-qadam: Database migration

```bash
# Migratsiya
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# DB permissions (custody_events append-only)
docker compose -f docker-compose.prod.yml exec db \
  psql -U $POSTGRES_USER -d ali_bridge \
  -c "CREATE TRIGGER enforce_append_only
      BEFORE UPDATE OR DELETE ON custody_events
      FOR EACH ROW EXECUTE FUNCTION prevent_custody_update_delete();"

docker compose -f docker-compose.prod.yml exec db \
  psql -U $POSTGRES_USER -d ali_bridge \
  -c "CREATE TRIGGER enforce_audit_append_only
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_update_delete();"
```

---

## 8-qadam: Telegram Webhook sozlash

```bash
# Webhook o'rnatish
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_DOMAIN/api/v1/telegram/webhook"}'

# Tekshirish
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

---

## 9-qadam: Mini App sozlash

1. [@BotFather](https://t.me/BotFather) ga `/newapp` buyrug'ini yuboring
2. Web App URL: `https://YOUR_DOMAIN`
3. `Menu Button` sozlash: `/setmenubutton` → URL: `https://YOUR_DOMAIN`

---

## 10-qadam: Tekshirish

```bash
# Health check
curl https://YOUR_DOMAIN/health
# Kutilgan: {"status": "ok", "service": "ali-bridge"}

# API docs (dev mode'da)
# https://YOUR_DOMAIN/api/docs

# Bot test
# Telegram'da /start yuboring
```

---

## Monitoring

```bash
# Loglar
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f worker

# Resurslar
docker stats

# DB ulanishlar
docker compose -f docker-compose.prod.yml exec db \
  psql -U $POSTGRES_USER -d ali_bridge \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## Update (yangi versiya deploy)

```bash
# Kodlarni yangilash
git pull origin main

# Images qayta build
docker compose -f docker-compose.prod.yml build backend frontend

# Zero-downtime restart
docker compose -f docker-compose.prod.yml up -d --no-deps --scale backend=2 backend
docker compose -f docker-compose.prod.yml up -d --no-deps --scale backend=1 backend

# Migration (agar kerak bo'lsa)
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

## Backup

```bash
# Database backup
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U $POSTGRES_USER ali_bridge | gzip > backup_$(date +%Y%m%d).sql.gz

# S3 tomonida fayllar avtomatik saqlanadi
```

---

## Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Xato tuzatish

### Bot webhook ishlamayapti
```bash
# Webhook info
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
# last_error_message tekshirish

# Backend loglarini ko'rish
docker compose -f docker-compose.prod.yml logs backend | grep webhook
```

### DB ulanish xatosi
```bash
docker compose -f docker-compose.prod.yml exec backend \
  python -c "from app.infra.db.session import init_db; import asyncio; asyncio.run(init_db())"
```

### SSL muammo
```bash
sudo certbot renew --dry-run
docker compose -f docker-compose.prod.yml restart nginx
```
