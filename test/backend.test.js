// Test máy chủ v0.1 (Code.gs thật + lõi) trên Sheet giả lập. Viết TRƯỚC khi code backend.
const test = require('node:test'), assert = require('node:assert');
const { env, google, ready, rid } = require('./gas-mock.js');
const ADMIN = 'maivulam2020@gmail.com', NV = 'nv@gmail.com', XEM = 'xem@gmail.com';
const item = (o = {}) => ({ maHang: 'DL-STR-100', ten: 'Đèn LED đường phố 100W', dvt: 'bộ', nhom: '', giaBan: 3850000, thangBH: 24, ...o });

// ---------- cài đặt & schema ----------
test('setup: tạo đủ sheet đợt ①, chủ là QUAN_TRI, chạy lại không nhân đôi', () => {
  const a = env(google({})); a.setup(); a.setup();
  for (const s of ['HangHoa', 'NhomHang', 'NhaCungCap', 'BangGia', 'NguoiDung', 'NhatKy', 'Request', 'GopY', 'CauHinh']) assert.ok(a.sheets[s], s);
  assert.deepEqual(a.sheets.NguoiDung.d.slice(1).map(r => [r[0], r[2]]), [['maivulam2020@gmail.com', 'QUAN_TRI']]);
});
test('schemaCheck: QT xem được lỗi tiêu đề; sheet sai tiêu đề → lệnh ghi bị chặn với mã SCHEMA', () => {
  const a = ready(); const s = a.login();
  assert.deepEqual(a.post({ action: 'admin.schemaCheck', session: s }).data.errors, []);
  a.sheets.HangHoa.d[0][10] = 'gia_ban';
  assert.ok(a.post({ action: 'admin.schemaCheck', session: s }).data.errors.some(e => e.sheet === 'HangHoa'));
  const r = a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item() });
  assert.equal(r.code, 'SCHEMA');
});

// ---------- xác thực (giữ nguyên hành vi đã duyệt) ----------
test('đăng nhập: nonce máy chủ, phiên HMAC, phiên giả bị từ chối, email lạ FORBIDDEN', () => {
  const a = ready(); const s = a.login();
  assert.equal(a.post({ action: 'auth.me', session: s }).data.vaiTro, 'QUAN_TRI');
  assert.equal(a.post({ action: 'auth.me', session: 'abc.def' }).code, 'AUTH_INVALID');
  assert.equal(a.login('la@gmail.com').code, 'FORBIDDEN');
});
test('gửi lại cùng token trong 2 phút → cùng phiên', () => {
  const a = ready(); a.st.nonce = a.post({ action: 'auth.nonce' }).data.nonce;
  const r1 = a.post({ action: 'auth.login', idToken: 'T1' }), r2 = a.post({ action: 'auth.login', idToken: 'T1' });
  assert.equal(r2.data.session, r1.data.session);
});

// ---------- phân quyền ----------
test('quyền: XEM không sửa được hàng; NHAP_LIEU không quản lý người dùng', () => {
  const a = ready({ [NV]: 'NHAP_LIEU', [XEM]: 'XEM' });
  assert.equal(a.post({ action: 'item.upsert', session: a.login(XEM), requestId: rid(), isNew: true, item: item() }).code, 'FORBIDDEN');
  assert.equal(a.post({ action: 'user.upsert', session: a.login(NV), requestId: rid(), user: { email: 'z@gmail.com', vaiTro: 'XEM' } }).code, 'FORBIDDEN');
});

// ---------- hàng hoá ----------
test('thêm hàng → đọc lại qua sync.pull; dataVersion tăng; mã trùng bị chặn; ghi nhật ký', () => {
  const a = ready(); const s = a.login();
  const v0 = a.post({ action: 'sync.pull', session: s }).data.version;
  const r = a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item({ maHang: 'dl-str-100' }) });
  assert.equal(r.ok, true, JSON.stringify(r));
  const p = a.post({ action: 'sync.pull', session: s });
  assert.ok(p.data.version > v0);
  const it = p.data.data.items.find(i => i.maHang === 'DL-STR-100');
  assert.equal(it.ten, 'Đèn LED đường phố 100W'); assert.equal(it.giaBan, 3850000); assert.equal(it.trangThai, 'KD');
  assert.equal(a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item() }).code, 'VALIDATION');
  assert.ok(a.sheets.NhatKy.d.some(r => r[2] === 'item.upsert' && r[4] === 'DL-STR-100'));
});
test('mã hàng toàn số (00012) không bị Sheets đổi thành số 12', () => {
  const a = ready(); const s = a.login();
  a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item({ maHang: '00012' }) });
  assert.ok(a.post({ action: 'sync.pull', session: s }).data.data.items.some(i => i.maHang === '00012'));
  assert.equal(a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item({ maHang: '00012' }) }).code, 'VALIDATION', 'vẫn nhận ra trùng');
});
test('sửa hàng: không có thì NOT_FOUND; giữ giaVon hệ thống; sync không đổi thì unchanged', () => {
  const a = ready(); const s = a.login();
  assert.equal(a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: false, item: item() }).code, 'NOT_FOUND');
  a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item() });
  const row = a.sheets.HangHoa.d.findIndex(r => r[0] === 'DL-STR-100'); a.sheets.HangHoa.d[row][11] = 2900000; // giaVon do hệ thống
  a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: false, item: item({ ten: 'Đèn mới', giaVon: 1 }) });
  const p = a.post({ action: 'sync.pull', session: s }).data;
  const it = p.data.items[0]; assert.equal(it.ten, 'Đèn mới'); assert.equal(it.giaVon, 2900000);
  assert.equal(a.post({ action: 'sync.pull', session: s, since: p.version }).data.unchanged, true);
});
test('nhóm phải tồn tại; ngừng KD / kinh doanh lại; KHÔNG có lệnh xoá', () => {
  const a = ready(); const s = a.login();
  assert.equal(a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item({ nhom: 'DEN' }) }).code, 'VALIDATION');
  a.post({ action: 'group.upsert', session: s, requestId: rid(), group: { maNhom: 'den', ten: 'Đèn LED' } });
  assert.equal(a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item({ nhom: 'DEN' }) }).ok, true);
  a.post({ action: 'item.stop', session: s, requestId: rid(), maHang: 'DL-STR-100', ngung: true });
  assert.equal(a.post({ action: 'sync.pull', session: s }).data.data.items[0].trangThai, 'NGUNG');
  a.post({ action: 'item.stop', session: s, requestId: rid(), maHang: 'DL-STR-100', ngung: false });
  assert.equal(a.post({ action: 'sync.pull', session: s }).data.data.items[0].trangThai, 'KD');
  assert.equal(a.post({ action: 'item.delete', session: s, requestId: rid(), maHang: 'DL-STR-100' }).ok, false);
});
test('gửi lặp cùng requestId → chỉ ghi 1 lần', () => {
  const a = ready(); const s = a.login(); const id = rid();
  const r = [1, 2, 3].map(() => a.post({ action: 'group.upsert', session: s, requestId: id, group: { maNhom: 'TU', ten: 'Tủ' } }));
  assert.deepEqual(r.map(x => x.replay), [false, true, true]);
  assert.equal(a.sheets.NhomHang.d.length, 2); assert.equal(a.sheets.NhatKy.d.length, 2);
});

// ---------- NCC & giá ----------
test('NCC + giá: giá NHAP cần NCC tồn tại; giá BAN hiệu lực cập nhật giá bán của hàng', () => {
  const a = ready(); const s = a.login();
  a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item({ giaBan: '' }) });
  assert.equal(a.post({ action: 'price.add', session: s, requestId: rid(), price: { maHang: 'DL-STR-100', loai: 'NHAP', gia: 2900000, tuNgay: '2026-01-01', maNCC: 'NCC01' } }).code, 'VALIDATION');
  assert.equal(a.post({ action: 'supplier.upsert', session: s, requestId: rid(), supplier: { maNCC: 'ncc01', ten: 'Cty Đèn A', mst: '0312345678' } }).ok, true);
  assert.equal(a.post({ action: 'price.add', session: s, requestId: rid(), price: { maHang: 'DL-STR-100', loai: 'NHAP', gia: 2900000, tuNgay: '2026-01-01', maNCC: 'NCC01' } }).ok, true);
  assert.equal(a.post({ action: 'price.add', session: s, requestId: rid(), price: { maHang: 'DL-STR-100', loai: 'BAN', gia: 3900000, tuNgay: '2026-01-01' } }).ok, true);
  assert.equal(a.post({ action: 'price.add', session: s, requestId: rid(), price: { maHang: 'DL-STR-100', loai: 'BAN', gia: 9999999, tuNgay: '2099-01-01' } }).ok, true);
  const d = a.post({ action: 'sync.pull', session: s }).data.data;
  assert.equal(d.items[0].giaBan, 3900000, 'giá tương lai chưa áp dụng'); assert.equal(d.prices.length, 3);
  assert.equal(a.post({ action: 'price.add', session: s, requestId: rid(), price: { maHang: 'KHONG-CO', loai: 'BAN', gia: 1, tuNgay: '2026-01-01' } }).code, 'VALIDATION');
});
test('BẢO MẬT GIÁ: NHAP_LIEU nhập được giá NHAP nhưng sync không trả giá NHAP/giaVon; phản hồi không lộ giá', () => {
  const a = ready({ [NV]: 'NHAP_LIEU' }); const qt = a.login(); const nv = a.login(NV);
  a.post({ action: 'item.upsert', session: qt, requestId: rid(), isNew: true, item: item() });
  a.post({ action: 'supplier.upsert', session: qt, requestId: rid(), supplier: { maNCC: 'NCC01', ten: 'A' } });
  const r = a.post({ action: 'price.add', session: nv, requestId: rid(), price: { maHang: 'DL-STR-100', loai: 'NHAP', gia: 2900000, tuNgay: '2026-01-01', maNCC: 'NCC01' } });
  assert.equal(r.ok, true); assert.equal(JSON.stringify(r).includes('2900000'), false);
  const row = a.sheets.HangHoa.d.findIndex(x => x[0] === 'DL-STR-100'); a.sheets.HangHoa.d[row][11] = 2900000;
  const raw = JSON.stringify(a.post({ action: 'sync.pull', session: nv }));
  assert.equal(raw.includes('2900000'), false, 'không lộ giá nhập/giá vốn cho NHAP_LIEU');
  assert.equal(JSON.stringify(a.post({ action: 'sync.pull', session: qt })).includes('2900000'), true);
});

// ---------- người dùng ----------
test('QT thêm/sửa người dùng; không được khoá/hạ quyền QUAN_TRI cuối cùng', () => {
  const a = ready(); const s = a.login();
  assert.equal(a.post({ action: 'user.upsert', session: s, requestId: rid(), user: { email: 'NV@gmail.com', hoTen: 'NV', vaiTro: 'NHAP_LIEU' } }).ok, true);
  assert.equal(a.login(NV).length > 20, true, 'người mới đăng nhập được ngay');
  assert.equal(a.post({ action: 'user.upsert', session: s, requestId: rid(), user: { email: ADMIN, vaiTro: 'XEM' } }).code, 'VALIDATION');
  assert.equal(a.post({ action: 'user.upsert', session: s, requestId: rid(), user: { email: ADMIN, vaiTro: 'QUAN_TRI', trangThai: 'KHOA' } }).code, 'VALIDATION');
  a.post({ action: 'user.upsert', session: s, requestId: rid(), user: { email: NV, vaiTro: 'NHAP_LIEU', trangThai: 'KHOA' } });
  assert.equal(a.login(NV).code, 'FORBIDDEN', 'bị khoá thì không vào được');
});

// ---------- góp ý ----------
test('góp ý: XEM gửi được; chỉ thấy góp ý của mình; QT thấy hết và đánh dấu đã xử lý', () => {
  const a = ready({ [XEM]: 'XEM' }); const qt = a.login(); const x = a.login(XEM);
  assert.equal(a.post({ action: 'feedback.add', session: x, requestId: rid(), feedback: { sao: 4, loai: 'DE_XUAT', noiDung: 'Thêm lọc theo hãng', banDung: '0.1.0' } }).ok, true);
  assert.equal(a.post({ action: 'feedback.add', session: x, requestId: rid(), feedback: { sao: 0, loai: 'KHAC', noiDung: '' } }).code, 'VALIDATION');
  a.post({ action: 'feedback.add', session: qt, requestId: rid(), feedback: { sao: 5, loai: 'KHAC', noiDung: 'ok' } });
  assert.equal(a.post({ action: 'sync.pull', session: x }).data.data.feedback.length, 1);
  const all = a.post({ action: 'sync.pull', session: qt }).data.data.feedback; assert.equal(all.length, 2);
  const id = all.find(f => f.email === XEM).id;
  assert.equal(a.post({ action: 'feedback.update', session: qt, requestId: rid(), id, trangThai: 'DA_XU_LY', note: 'Đã thêm ở 0.2' }).ok, true);
  assert.equal(a.post({ action: 'sync.pull', session: qt }).data.data.feedback.find(f => f.id === id).trangThai, 'DA_XU_LY');
});

// ---------- chịu lỗi ----------
test('dòng sheet sửa tay sai kiểu → sync vẫn chạy, QT nhận cảnh báo kèm vị trí', () => {
  const a = ready(); const s = a.login();
  a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item() });
  a.sheets.HangHoa.d[1][10] = 'ba triệu';
  const p = a.post({ action: 'sync.pull', session: s });
  assert.equal(p.ok, true); assert.ok(p.data.warnings.some(w => /HangHoa!2/.test(w)));
});
test('JSON rác / action lạ → lỗi gọn, không lộ chi tiết', () => {
  const a = ready(); const o = JSON.parse(a.doPost({ postData: { contents: '{rác' } }).t);
  assert.equal(o.code, 'INTERNAL'); assert.equal(o.error, 'Lỗi máy chủ, thử lại');
  assert.equal(a.post({ action: 'xoa.het', session: a.login() }).code, 'VALIDATION');
});
test('giá bán ban đầu khi tạo hàng → có trong lịch sử giá; sửa hàng không đổi được giá bán', () => {
  const a = ready(); const s = a.login();
  a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item() });
  let d = a.post({ action: 'sync.pull', session: s }).data.data;
  assert.deepEqual(d.prices.map(p => [p.loai, p.gia, p.ghiChu]), [['BAN', 3850000, 'Giá ban đầu']]);
  a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: false, item: item({ giaBan: 1 }) });
  d = a.post({ action: 'sync.pull', session: s }).data.data; assert.equal(d.items[0].giaBan, 3850000);
});

// ---------- các lỗi chuyên gia bảo mật phát hiện (phải luôn đạt) ----------
test('BẢO MẬT: chèn công thức (=, +, -, @) vào ô chữ → lưu nguyên văn, KHÔNG chạy công thức', () => {
  const a = ready({ [XEM]: 'XEM' }); const qt = a.login(); const x = a.login(XEM);
  const evil = '=TEXTJOIN(",",TRUE,BangGia!E2:E5000,HangHoa!L2:L5000)';
  assert.equal(a.post({ action: 'feedback.add', session: x, requestId: rid(), feedback: { sao: 1, loai: 'KHAC', noiDung: evil } }).ok, true);
  a.post({ action: 'item.upsert', session: qt, requestId: rid(), isNew: true, item: item({ ten: '+IMPORTXML("http://x")', quyCach: '-5', hang: '@SUM(1)' }) });
  assert.equal(JSON.stringify(a.sheets).includes('CONG_THUC_DA_CHAY'), false, 'không ô nào chạy công thức');
  assert.equal(a.post({ action: 'sync.pull', session: x }).data.data.feedback[0].noiDung, evil);
  const it = a.post({ action: 'sync.pull', session: qt }).data.data.items[0];
  assert.deepEqual([it.ten, it.quyCach, it.hang], ['+IMPORTXML("http://x")', '-5', '@SUM(1)']);
});
test('BẢO MẬT: link tài liệu javascript:/data: bị từ chối, chỉ nhận http(s)', () => {
  const a = ready(); const s = a.login();
  for (const u of ['javascript:alert(1)', 'JaVaScRiPt:fetch(1)', 'data:text/html,x', 'http://a b']) assert.equal(a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item({ maHang: 'X' + Math.random().toString(36).slice(2, 6).toUpperCase(), taiLieuUrl: u }) }).code, 'VALIDATION', u);
  assert.equal(a.post({ action: 'item.upsert', session: s, requestId: rid(), isNew: true, item: item({ taiLieuUrl: 'https://drive.google.com/file/d/abc' }) }).ok, true);
});
test('nhóm cha không được tạo vòng lặp', () => {
  const a = ready(); const s = a.login();
  a.post({ action: 'group.upsert', session: s, requestId: rid(), group: { maNhom: 'A', ten: 'A' } });
  a.post({ action: 'group.upsert', session: s, requestId: rid(), group: { maNhom: 'B', ten: 'B', cha: 'A' } });
  assert.equal(a.post({ action: 'group.upsert', session: s, requestId: rid(), group: { maNhom: 'A', ten: 'A', cha: 'B' } }).code, 'VALIDATION');
});
test('feedback.update thiếu id → VALIDATION (không lỗi máy chủ); sync trả vai trò hiện tại', () => {
  const a = ready(); const s = a.login();
  assert.equal(a.post({ action: 'feedback.update', session: s, requestId: rid(), id: '', trangThai: 'DA_XU_LY' }).code, 'VALIDATION');
  assert.equal(a.post({ action: 'sync.pull', session: s }).data.me.vaiTro, 'QUAN_TRI');
});
test('ngày lưu dạng Date trong Sheet được đọc đúng ngày theo giờ Việt Nam', () => {
  const SC = require('../core/schema.js'); const cols = SC.SHEETS.BangGia.cols;
  const row = cols.map(c => ({ id: 'G1', maHang: 'A', loai: 'BAN', gia: 5, tuNgay: new Date('2026-11-04T17:00:00Z') })[c] ?? '');   // 00:00 ngày 05/11 giờ VN
  assert.equal(SC.toObjects('BangGia', [cols, row]).rows[0].tuNgay, '2026-11-05');
});
