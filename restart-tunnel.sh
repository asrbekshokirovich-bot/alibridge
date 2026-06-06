#!/usr/bin/env bash
# ALI BRIDGE — Tunnel qayta ishga tushirish.
# Cloudflare bepul tunnel uzilganda (530 xato) ishlatiladi.
# cloudflared'ni qayta ochib, backend'ni yangi URL bilan sinxronlaydi.
#
# Ishlatish:  bash restart-tunnel.sh

set -e
cd "$(dirname "$0")"

echo "1/3 cloudflared qayta ishga tushirilmoqda..."
docker compose restart cloudflared
echo "    yangi tunnel registratsiyasi kutilmoqda (15s)..."
sleep 15

NEW_URL=$(docker compose logs cloudflared --since 18s 2>&1 | grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" | tail -1)
if [ -z "$NEW_URL" ]; then
  echo "    XATO: yangi URL topilmadi. Loglarni tekshiring: docker compose logs cloudflared"
  exit 1
fi
echo "    yangi URL: $NEW_URL"

echo "2/3 backend yangilanmoqda (URL avtomatik o'qiladi)..."
docker compose restart backend
sleep 10

echo "3/3 tekshiruv..."
curl -s -o /dev/null -w "    frontend: HTTP %{http_code}\n" "$NEW_URL/"
echo ""
echo "TAYYOR. Telegram'da @alibridgebot -> Mini App'ni qayta oching."
echo "Yangi manzil: $NEW_URL"
