#!/bin/bash
# cloudflare/tunnel-quick.sh
# Quick start cho macOS/Linux

echo "=== CRM Construction Bot — Cloudflare Tunnel ==="
echo ""

# Check cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "Cloudflared chưa cài."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Đang cài bằng Homebrew..."
        brew install cloudflared
    else
        echo "Tải tại: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
        exit 1
    fi
fi

echo "Đang khởi động tunnel cho http://localhost:3000..."
echo "URL sẽ xuất hiện sau vài giây (dạng https://xxx.trycloudflare.com)"
echo "Copy URL đó vào tab 'Ket noi' trong Settings Chatbot."
echo ""
echo "Nhấn Ctrl+C để dừng."
echo ""

cloudflared tunnel --url http://localhost:3000
