#!/bin/bash
# ============================================
# ALI BRIDGE — Deploy script (Oracle Cloud'da ishga tushiriladi)
# ============================================

set -e
cd /opt/alibridge

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }

# 1. .env tekshirish
if [ ! -f ".env" ]; then
    echo "❌ .env fayli topilmadi!"
    echo "   cp .env.example .env && nano .env"
    exit 1
fi

source .env

# 2. Majburiy o'zgaruvchilar tekshirish
for var in DOMAIN BOT_TOKEN JWT_SECRET POSTGRES_PASSWORD REDIS_PASSWORD QR_HMAC_SECRET ENCRYPTION_KEY; do
    if [ -z "${!var}" ]; then
        echo "❌ .env da $var bo'sh!"
        exit 1
    fi
done

info ".env tekshirildi"

# 3. DuckDNS IP yangilash
/usr/local/bin/duckdns-update.sh 2>/dev/null || true
info "DuckDNS yangilandi: $DOMAIN"

# 4. Docker image'larni build qilish
info "Docker image'lar build qilinmoqda..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache backend worker frontend

# 5. Servislarni ishga tushirish
info "Servislar ishga tushirilmoqda..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 6. Sog'liq tekshiruvi
info "Sog'liq tekshiruvi (30 sekund kutilmoqda)..."
sleep 30

HEALTH=$(curl -sf "http://localhost:8000/health" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "unreachable")

if [ "$HEALTH" = "ok" ]; then
    info "Backend: OK"
else
    warn "Backend sog'liq tekshiruvi: $HEALTH"
fi

# 7. SSL sertifikat holati
CERT_STATUS=$(docker exec alibridge-caddy caddy list-certificates 2>/dev/null | grep -c "$DOMAIN" || echo "0")
if [ "$CERT_STATUS" -gt 0 ]; then
    info "SSL sertifikat: mavjud"
else
    warn "SSL sertifikat hali yuklanmoqda (bir necha daqiqa kuting)"
fi

# 8. Webhook holati
info "Telegram webhook tekshirilmoqda..."
sleep 5
WEBHOOK_INFO=$(curl -sf "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" 2>/dev/null)
WEBHOOK_URL=$(echo "$WEBHOOK_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('url',''))" 2>/dev/null || echo "")

if [ -n "$WEBHOOK_URL" ]; then
    info "Webhook: $WEBHOOK_URL"
else
    warn "Webhook hali o'rnatilmagan — backend'ni tekshiring"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Deploy muvaffaqiyatli tugadi!            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Mini App:  https://$DOMAIN              ║${NC}"
echo -e "${GREEN}║  Webhook:   https://$DOMAIN/api/v1/...   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "Loglarni ko'rish: docker compose logs -f backend"
