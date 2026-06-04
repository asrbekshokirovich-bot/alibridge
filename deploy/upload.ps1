# ============================================
# ALI BRIDGE — Oracle VM'ga fayl yuklash
# Windows PowerShell'dan ishga tushiriladi
#
# Ishlatish:
#   cd "C:\Users\Msi\Desktop\Telegram Mini App"
#   .\deploy\upload.ps1 -ServerIP 140.238.xxx.xxx -KeyPath C:\Users\Msi\.ssh\oracle_key.pem
# ============================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,      # Oracle VM public IP

    [Parameter(Mandatory=$false)]
    [string]$KeyPath = "$env:USERPROFILE\.ssh\oracle_key.pem",  # SSH key joyi

    [Parameter(Mandatory=$false)]
    [string]$RemoteDir = "/opt/alibridge"
)

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== ALI BRIDGE — Oracle VM'ga yuklash ===" -ForegroundColor Green
Write-Host "Server: ubuntu@$ServerIP" -ForegroundColor Cyan
Write-Host "Loyiha: $ProjectRoot" -ForegroundColor Cyan

# rsync mavjudligini tekshirish (Git Bash orqali)
$rsyncPath = "C:\Program Files\Git\usr\bin\rsync.exe"
$sshPath   = "C:\Program Files\Git\usr\bin\ssh.exe"

if (-not (Test-Path $rsyncPath)) {
    Write-Host "Git Bash topilmadi. SCP bilan yuklanadi..." -ForegroundColor Yellow

    # SCP bilan yuklash (sekinroq, lekin har doim ishlaydi)
    $excludes = @(".git", "node_modules", "__pycache__", ".env", "*.pyc", "dist", ".venv")

    # Asosiy fayllarni yuklash
    $items = @("backend", "frontend", "docker-compose.yml", "docker-compose.prod.yml",
               "Caddyfile", "deploy", ".env.example")

    foreach ($item in $items) {
        $fullPath = Join-Path $ProjectRoot $item
        if (Test-Path $fullPath) {
            Write-Host "  Yuklanmoqda: $item" -ForegroundColor Gray
            if (Test-Path $fullPath -PathType Container) {
                scp -i $KeyPath -r $fullPath "ubuntu@${ServerIP}:${RemoteDir}/"
            } else {
                scp -i $KeyPath $fullPath "ubuntu@${ServerIP}:${RemoteDir}/"
            }
        }
    }
} else {
    Write-Host "rsync bilan yuklanmoqda (tez)..." -ForegroundColor Cyan

    & $rsyncPath -avz --progress `
        --exclude=".git/" `
        --exclude="node_modules/" `
        --exclude="__pycache__/" `
        --exclude="*.pyc" `
        --exclude=".venv/" `
        --exclude="dist/" `
        --exclude=".env" `
        -e "$sshPath -i $KeyPath -o StrictHostKeyChecking=no" `
        "$ProjectRoot/" `
        "ubuntu@${ServerIP}:${RemoteDir}/"
}

Write-Host ""
Write-Host "=== Yuklash tugadi! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Keyingi qadamlar:" -ForegroundColor Yellow
Write-Host "  1. SSH bilan ulaning:"
Write-Host "     ssh -i $KeyPath ubuntu@$ServerIP"
Write-Host ""
Write-Host "  2. .env faylini sozlang:"
Write-Host "     cp /opt/alibridge/.env.example /opt/alibridge/.env"
Write-Host "     nano /opt/alibridge/.env"
Write-Host ""
Write-Host "  3. Deploy qiling:"
Write-Host "     cd /opt/alibridge && bash deploy/deploy.sh"
