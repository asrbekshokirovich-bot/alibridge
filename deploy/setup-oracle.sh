#!/bin/bash
# ============================================
# ALI BRIDGE — Oracle Cloud VM Setup Script
# Ubuntu 22.04 ARM (Ampere A1) uchun
# Bir marta ishga tushiriladi
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
section() { echo -e "\n${GREEN}═══ $1 ═══${NC}"; }

section "1/6 — Tizim yangilash"
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl git rsync htop net-tools

section "2/6 — Docker o'rnatish"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sudo bash
    sudo usermod -aG docker ubuntu
    sudo systemctl enable docker
    sudo systemctl start docker
    info "Docker o'rnatildi"
else
    info "Docker allaqachon mavjud: $(docker --version)"
fi

section "3/6 — Oracle Cloud firewall (iptables)"
# Oracle Cloud iptables qoidalari (Security List'dan tashqari)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
# Qoidalarni saqlash
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
info "80 va 443 portlar ochildi"

section "4/6 — Loyiha papkasi"
sudo mkdir -p /opt/alibridge
sudo chown ubuntu:ubuntu /opt/alibridge
info "Papka: /opt/alibridge"

section "5/6 — DuckDNS cron (DNS yangilash)"
cat > /tmp/duckdns-update.sh << 'DUCKEOF'
#!/bin/bash
# .env faylidan DUCKDNS_TOKEN va DOMAIN o'qish
source /opt/alibridge/.env 2>/dev/null || true
SUBDOMAIN="${DOMAIN%%.*}"  # alibridge.duckdns.org → alibridge
if [ -n "$DUCKDNS_TOKEN" ] && [ -n "$SUBDOMAIN" ]; then
    curl -s "https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=" > /tmp/duckdns.log
fi
DUCKEOF
sudo mv /tmp/duckdns-update.sh /usr/local/bin/duckdns-update.sh
sudo chmod +x /usr/local/bin/duckdns-update.sh
# Har 5 daqiqada DNS yangilash
(crontab -l 2>/dev/null | grep -v duckdns; echo "*/5 * * * * /usr/local/bin/duckdns-update.sh") | crontab -
info "DuckDNS cron qo'shildi"

section "6/6 — Docker log rotation"
sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
EOF
sudo systemctl restart docker
info "Docker log rotation sozlandi"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup tugadi! Keyingi qadamlar:         ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}║  1. DuckDNS.org ga boring:               ║${NC}"
echo -e "${GREEN}║     subdomain yarating (masalan:         ║${NC}"
echo -e "${GREEN}║     alibridge.duckdns.org)               ║${NC}"
echo -e "${GREEN}║     Token'ni .env ga yozing              ║${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}║  2. Fayllarni yuklang:                   ║${NC}"
echo -e "${GREEN}║     (Windows'da PowerShell'dan)          ║${NC}"
echo -e "${GREEN}║     cd 'Telegram Mini App'               ║${NC}"
echo -e "${GREEN}║     ./deploy/upload.ps1                  ║${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}║  3. Deploy qiling:                       ║${NC}"
echo -e "${GREEN}║     cd /opt/alibridge                    ║${NC}"
echo -e "${GREEN}║     ./deploy/deploy.sh                   ║${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
