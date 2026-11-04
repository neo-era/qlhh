# QLHH — Quản lý hàng hóa LAVIPCO / Đại Châu (PWA + Google Sheets/Apps Script)

Trạng thái: **đợt ① – thử nghiệm (spike)**. Thiết kế: `QLHH-thiet-ke.md` (Project Software).

| Thư mục | Nội dung |
|---|---|
| `core/` | Lõi nghiệp vụ thuần JS (chạy Node + Apps Script): `auth.js` (claims, phiên HMAC), `idem.js` (requestId) |
| `backend/` | Apps Script: `Code.gs`, `appsscript.json` |
| `docs/` | Trang PWA (GitHub Pages phục vụ từ thư mục /docs) |
| `test/` | `node --test test/*.test.js` (unit + backend giả lập) · `node test/web.e2e.js` (Playwright) |

Đóng gói backend: `./build.sh` → `dist/backend/` (lõi chép nguyên văn sang `.gs`). Cài đặt: `HUONG-DAN-SPIKE.md`.
