#!/bin/sh
# Đóng gói backend: lõi đã test được chép nguyên văn sang .gs (lõi chạy = lõi đã test)
set -e; cd "$(dirname "$0")"; mkdir -p dist/backend
cp backend/Code.gs dist/backend/Code.gs
cp core/auth.js dist/backend/auth.gs; cp core/idem.js dist/backend/idem.gs
cp backend/appsscript.json dist/backend/
echo "Đã tạo dist/backend/ (Code.gs, auth.gs, idem.gs, appsscript.json)"
