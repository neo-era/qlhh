# QLHH — Hướng dẫn cài bộ thử nghiệm đợt ① (khoảng 20 phút)

Mục đích: chứng minh 4 điều **trước khi** xây app thật:
1. Đăng nhập Google chạy được trên **iPhone** (Safari và khi cài lên màn hình chính) — mục tiêu 10/10 lần.
2. Trang trên GitHub Pages gọi được máy chủ Apps Script (Chrome, Safari, iPhone).
3. Ghi đồng thời 20 lệnh → 20/20 thành công, số không trùng; gửi lặp → chỉ 1 phiếu.
4. Tốc độ đọc 5.000 mã + 50.000 dòng ≤ 3 giây.

Tài khoản dùng cho mọi bước: **maivulam2020@gmail.com** (bật xác minh 2 bước trước: myaccount.google.com → Bảo mật).

---

## Bước 1 — Bật trang web (GitHub Pages)
1. Repo `neo-era/qlhh` (em đã đẩy code) → **Settings → Pages** → Source: **Deploy from a branch** → Branch **main**, thư mục **/docs** → **Save**.
2. Chờ 1–2 phút, địa chỉ trang: `https://neo-era.github.io/qlhh/`

## Bước 2 — Tạo Google Sheet + máy chủ Apps Script
1. Vào sheets.new → đặt tên **`QLHH-LAVIPCO-THUNGHIEM`**.
2. Menu **Tiện ích mở rộng → Apps Script**.
3. Xoá nội dung `Mã.gs`, dán toàn bộ `Code.gs` (trong gói `QLHH-spike-backend`).
4. Bấm **＋ → Tập lệnh**, tạo `auth` và dán `auth.gs`; tạo `idem` và dán `idem.gs`.
5. Bánh răng **Cài đặt dự án** → tích *Hiển thị tệp kê khai "appsscript.json"* → mở `appsscript.json`, dán nội dung file cùng tên.
6. Chọn hàm **`setup`** (ở `Code.gs`) → **Chạy** → cấp quyền (chọn tài khoản → Nâng cao → Đi tới… → Cho phép).
   Sheet sẽ có các trang NguoiDung (đã có anh là QUAN_TRI), Request, SpikeGhi, CauHinh.
7. **Triển khai → Tùy chọn triển khai mới** → loại **Ứng dụng web** → Thực thi với tư cách: **Tôi** → Người có quyền truy cập: **Bất kỳ ai** → Triển khai → **sao chép URL kết thúc bằng `/exec`**.
8. **Không chia sẻ** Google Sheet này cho ai.

## Bước 3 — Tạo mã đăng nhập Google (OAuth Client ID)
1. Vào console.cloud.google.com → thanh trên cùng **Chọn dự án → Dự án mới** → tên `QLHH` → Tạo.
2. Menu ☰ → **APIs & Services → OAuth consent screen** (Google Auth Platform) → Bắt đầu:
   - App name: `QLHH`, email hỗ trợ: maivulam2020@gmail.com
   - Audience / User type: **External**
   - Email liên hệ: maivulam2020@gmail.com → Tạo.
   - Mục **Audience** → **Publish app** (chuyển sang *In production*). Chỉ dùng phạm vi openid/email/profile nên **không cần Google thẩm định**.
3. **Clients → Create client** → Application type: **Web application** → Name `QLHH Web`:
   - Authorized JavaScript origins: `https://neo-era.github.io`
   - Authorized redirect URIs: `https://neo-era.github.io/qlhh/` (đúng dấu `/` cuối)
   - Create → **sao chép Client ID** (dạng `…apps.googleusercontent.com`). Client secret **không cần**.
4. Quay lại Apps Script → **Cài đặt dự án → Thuộc tính tập lệnh** → sửa `CLIENT_ID` = Client ID vừa chép → Lưu.

## Bước 4 — Chạy thử (máy tính trước, rồi iPhone)
1. Mở `https://neo-era.github.io/qlhh/` → dán **Client ID** và **URL /exec** → *Lưu cấu hình* → *Kiểm tra máy chủ* (phải ra `OK`).
2. *Đăng nhập bằng Google* → chọn maivulam2020@gmail.com → quay về thấy **ĐĂNG NHẬP THÀNH CÔNG**.
3. Bấm lần lượt: *Kiểm tra phiên* · *Thử phiên giả* (phải **bị từ chối**) · *Ghi đồng thời 20 lệnh* · *Gửi lặp 1 lệnh × 3* · *Tạo dữ liệu đo (1 lần)* · *Đo tốc độ đọc*.
4. **iPhone – Safari:** mở cùng địa chỉ, nhập cấu hình, đăng nhập **10 lần** (Đăng xuất → Đăng nhập), ghi lại số lần thành công.
5. **iPhone – app cài:** Safari → nút Chia sẻ → **Thêm vào MH chính** → mở biểu tượng QLHH (dòng "Đang chạy dạng APP đã cài") → nhập lại cấu hình → đăng nhập **10 lần**.
6. Bấm **Sao chép kết quả** trên từng máy → dán gửi em.

## Kết quả em cần nhận
| Kiểm tra | Đạt khi |
|---|---|
| Đăng nhập máy tính | thành công |
| iPhone Safari | 10/10 |
| iPhone app cài | 10/10 |
| Phiên giả | bị từ chối |
| Ghi 20 lệnh | 20/20, số không trùng 20/20 |
| Gửi lặp × 3 | 1 phiếu |
| Đọc 5.000 + 50.000 dòng | tổng ≤ 3.000 ms |

Không đạt mục nào → em đổi phương án đã ghi sẵn trong thiết kế (đăng nhập iPhone: chuyển trang nhận token sang Web App; tốc độ: tách sheet theo năm / chuyển Supabase).
