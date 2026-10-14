# cloudflare/tunnel-quick.ps1
# Quick start script — chạy trong PowerShell
# Usage: .\cloudflare\tunnel-quick.ps1

Write-Host "=== CRM Construction Bot — Cloudflare Tunnel ===" -ForegroundColor Cyan
Write-Host ""

# Check cloudflared installed
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "Cloudflared chưa cài. Đang cài..." -ForegroundColor Yellow
    winget install Cloudflare.cloudflared
    Write-Host "Cài xong! Khởi động lại terminal rồi chạy lại script này." -ForegroundColor Green
    exit
}

# Check login
$configDir = "$env:USERPROFILE\.cloudflared"
if (-not (Test-Path "$configDir\cert.pem")) {
    Write-Host "Chưa đăng nhập Cloudflare. Đang mở trình duyệt..." -ForegroundColor Yellow
    cloudflared tunnel login
    Write-Host ""
}

# Check if tunnel exists
$tunnelName = "crm-construction"
$tunnelList = cloudflared tunnel list 2>&1
if ($tunnelList -notmatch $tunnelName) {
    Write-Host "Tạo tunnel '$tunnelName'..." -ForegroundColor Yellow
    cloudflared tunnel create $tunnelName
    Write-Host ""
}

# Get tunnel URL (quick mode — no custom domain)
Write-Host "Đang khởi động tunnel..." -ForegroundColor Green
Write-Host "URL sẽ xuất hiện sau vài giây (dạng https://xxx.trycloudflare.com)" -ForegroundColor Cyan
Write-Host "Copy URL đó vào tab 'Ket noi' trong Settings Chatbot." -ForegroundColor Cyan
Write-Host ""
Write-Host "Nhấn Ctrl+C để dừng tunnel." -ForegroundColor Gray
Write-Host ""

# Run tunnel (no config = quick mode, gets random subdomain)
cloudflared tunnel --url http://localhost:3000
