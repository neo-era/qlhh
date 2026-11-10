#!/bin/sh
# Đóng gói: (1) 1 file Code.gs = lõi đã test + máy chủ, để dán vào Apps Script; (2) chép lõi sang docs/core cho giao diện.
# Lõi chạy = lõi đã test (chép nguyên văn, không sửa tay).
set -e; cd "$(dirname "$0")"; mkdir -p dist docs/core
{ for f in core/auth.js core/idem.js core/schema.js core/validate.js core/perm.js core/price.js core/stock.js core/serial.js core/sx.js; do echo "// ===== $f (nguyên văn, đã test) ====="; cat "$f"; echo; done
  echo "// ===== backend/Code.gs ====="; cat backend/Code.gs; echo; echo "// ===== backend/Kho.gs ====="; cat backend/Kho.gs; echo; echo "// ===== backend/SanXuat.gs ====="; cat backend/SanXuat.gs; } > dist/Code.gs
cp backend/appsscript.json dist/appsscript.json
for f in validate perm price search schema stock serial vnwords sx; do cp core/$f.js docs/core/$f.js; done
echo "dist/Code.gs ($(wc -c < dist/Code.gs) byte) + docs/core/ đã cập nhật"
