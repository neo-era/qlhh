// TDD lõi nghiệp vụ đợt ① — viết TRƯỚC khi code. Chạy: node --test test/*.test.js
const test = require('node:test'), assert = require('node:assert');
const V = require('../core/validate.js'), P = require('../core/perm.js'), G = require('../core/price.js');
const S = require('../core/search.js'), SC = require('../core/schema.js');

// ---------- validate ----------
test('hàng hoá hợp lệ → chuẩn hoá mã HOA, bỏ khoảng trắng, số đúng kiểu', () => {
  const r = V.item({ maHang: ' dl-str-100 ', ten: ' Đèn LED 100W ', dvt: 'bộ', giaBan: '3850000', thangBH: '24', tonToiThieu: '10', quanLySerial: 'true' });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual([r.value.maHang, r.value.ten, r.value.giaBan, r.value.thangBH, r.value.tonToiThieu, r.value.quanLySerial], ['DL-STR-100', 'Đèn LED 100W', 3850000, 24, 10, true]);
  assert.equal(r.value.trangThai, 'KD');
});
test('hàng hoá: thiếu mã/tên/ĐVT, mã sai ký tự, giá âm/lẻ, BH > 120 → lỗi từng trường', () => {
  const r = V.item({ maHang: 'có dấu', ten: '', dvt: '', giaBan: -5, thangBH: 200 });
  assert.equal(r.ok, false);
  for (const f of ['maHang', 'ten', 'dvt', 'giaBan', 'thangBH']) assert.ok(r.errors[f], 'thiếu lỗi ' + f);
  assert.ok(V.item({ maHang: 'A1', ten: 'x', dvt: 'm', giaBan: 1.5 }).errors.giaBan, 'tiền phải nguyên');
});
test('hàng hoá: giá bỏ trống được (chưa có giá)', () => {
  const r = V.item({ maHang: 'AB', ten: 'x', dvt: 'cái', giaBan: '' });
  assert.equal(r.ok, true); assert.equal(r.value.giaBan, '');
});
test('nhà cung cấp: MST 10 hoặc 13 số (có gạch), email, điện thoại', () => {
  assert.equal(V.supplier({ maNCC: 'ncc01', ten: 'Cty A', mst: '0312345678' }).ok, true);
  assert.equal(V.supplier({ maNCC: 'NCC02', ten: 'Cty B', mst: '0312345678-001' }).ok, true);
  const r = V.supplier({ maNCC: 'N3', ten: 'C', mst: '123', email: 'sai@', dienThoai: 'abc' });
  for (const f of ['mst', 'email', 'dienThoai']) assert.ok(r.errors[f], f);
  assert.equal(V.supplier({ maNCC: 'ncc01', ten: 'x' }).value.maNCC, 'NCC01');
});
test('giá: BAN/NHAP, nguyên dương, ngày ISO thật, NHAP bắt buộc NCC', () => {
  assert.equal(V.price({ maHang: 'a1', loai: 'BAN', gia: '1000', tuNgay: '2026-11-04' }).ok, true);
  assert.ok(V.price({ maHang: 'A1', loai: 'NHAP', gia: 1000, tuNgay: '2026-11-04' }).errors.maNCC);
  assert.ok(V.price({ maHang: 'A1', loai: 'BAN', gia: 0, tuNgay: '2026-11-04' }).errors.gia);
  assert.ok(V.price({ maHang: 'A1', loai: 'BAN', gia: 5, tuNgay: '2026-02-30' }).errors.tuNgay, 'ngày không tồn tại');
  assert.ok(V.price({ maHang: 'A1', loai: 'XX', gia: 5, tuNgay: '2026-02-01' }).errors.loai);
});
test('người dùng: email chuẩn hoá thường, vai trò/trạng thái hợp lệ', () => {
  const r = V.user({ email: ' Ban@Gmail.com ', vaiTro: 'NHAP_LIEU' });
  assert.equal(r.ok, true); assert.equal(r.value.email, 'ban@gmail.com'); assert.equal(r.value.trangThai, 'HOAT_DONG');
  assert.ok(V.user({ email: 'x', vaiTro: 'VUA' }).errors.email);
  assert.ok(V.user({ email: 'a@b.co', vaiTro: 'VUA' }).errors.vaiTro);
});
test('góp ý: phải có sao HOẶC nội dung; sao 1–5; ≤ 2000 ký tự', () => {
  assert.equal(V.feedback({ sao: 4, loai: 'DE_XUAT', noiDung: '' }).ok, true);
  assert.equal(V.feedback({ sao: 0, loai: 'LOI_APP', noiDung: 'Nút lưu không chạy' }).ok, true);
  assert.equal(V.feedback({ sao: 0, loai: 'KHAC', noiDung: '   ' }).ok, false);
  assert.equal(V.feedback({ sao: 7, loai: 'KHAC', noiDung: 'x' }).ok, false);
  assert.equal(V.feedback({ sao: 3, loai: 'KHAC', noiDung: 'x'.repeat(2001) }).ok, false);
  assert.equal(V.feedback({ sao: 3, loai: 'LUNG_TUNG', noiDung: 'x' }).ok, false);
});
test('nhóm hàng: mã + tên bắt buộc, không tự làm cha của mình', () => {
  assert.equal(V.group({ maNhom: 'den', ten: 'Đèn LED' }).value.maNhom, 'DEN');
  assert.ok(V.group({ maNhom: 'DEN', ten: 'x', cha: 'den' }).errors.cha);
});
test('chuỗi rác/không phải object không làm sập', () => {
  for (const f of ['item', 'supplier', 'price', 'user', 'feedback', 'group']) { assert.equal(V[f](null).ok, false); assert.equal(V[f]('abc').ok, false); }
});

// ---------- perm ----------
test('quyền: XEM chỉ đọc + góp ý; NHAP_LIEU sửa danh mục; QUAN_TRI thêm người dùng', () => {
  assert.equal(P.can('XEM', 'item.upsert'), false); assert.equal(P.can('XEM', 'feedback.add'), true);
  assert.equal(P.can('NHAP_LIEU', 'item.upsert'), true); assert.equal(P.can('NHAP_LIEU', 'user.upsert'), false);
  assert.equal(P.can('QUAN_TRI', 'user.upsert'), true); assert.equal(P.can('LA', 'sync.pull'), false);
});
test('lọc dữ liệu: không phải QUAN_TRI thì mất giaVon, mất mọi giá NHAP, không thấy góp ý người khác, không thấy nhật ký', () => {
  const data = {
    items: [{ maHang: 'A', giaBan: 10, giaVon: 7 }],
    prices: [{ id: 1, loai: 'BAN', gia: 10 }, { id: 2, loai: 'NHAP', gia: 7 }],
    feedback: [{ id: 'f1', email: 'a@x' }, { id: 'f2', email: 'b@x' }],
    logs: [{ action: 'x' }], users: [{ email: 'a@x', vaiTro: 'XEM' }]
  };
  const f = P.filterForRole('NHAP_LIEU', 'a@x', data);
  assert.equal('giaVon' in f.items[0], false); assert.deepEqual(f.prices.map(p => p.id), [1]);
  assert.deepEqual(f.feedback.map(x => x.id), ['f1']); assert.deepEqual(f.logs, []); assert.deepEqual(f.users, []);
  assert.equal(data.items[0].giaVon, 7, 'không được sửa dữ liệu gốc');
  const q = P.filterForRole('QUAN_TRI', 'a@x', data);
  assert.equal(q.items[0].giaVon, 7); assert.equal(q.prices.length, 2); assert.equal(q.feedback.length, 2);
  assert.deepEqual(P.filterForRole('VO_DANH', 'a@x', data).items, []);
});

// ---------- price ----------
const prices = [
  { maHang: 'A', loai: 'BAN', gia: 100, tuNgay: '2026-01-01', thoiGian: '2026-01-01T08:00:00+07:00' },
  { maHang: 'A', loai: 'BAN', gia: 120, tuNgay: '2026-06-01', thoiGian: '2026-05-20T08:00:00+07:00' },
  { maHang: 'A', loai: 'BAN', gia: 125, tuNgay: '2026-06-01', thoiGian: '2026-05-25T08:00:00+07:00' },
  { maHang: 'A', loai: 'NHAP', gia: 80, tuNgay: '2026-03-01', maNCC: 'N1', thoiGian: 'x' },
  { maHang: 'B', loai: 'BAN', gia: 999, tuNgay: '2025-01-01', thoiGian: 'x' }
];
test('giá hiệu lực = bản mới nhất có tuNgay ≤ ngày hỏi; trùng ngày lấy bản nhập sau', () => {
  assert.equal(G.effective(prices, 'A', 'BAN', '2026-05-31').gia, 100);
  assert.equal(G.effective(prices, 'A', 'BAN', '2026-06-01').gia, 125);
  assert.equal(G.effective(prices, 'A', 'BAN', '2025-12-31'), null);
  assert.equal(G.effective(prices, 'A', 'NHAP', '2026-12-31', 'N1').gia, 80);
  assert.equal(G.effective(prices, 'A', 'NHAP', '2026-12-31', 'N2'), null);
});
test('lịch sử giá theo mã: mới nhất trước', () => {
  assert.deepEqual(G.history(prices, 'A', 'BAN').map(p => p.gia), [125, 120, 100]);
});

// ---------- search ----------
test('chuẩn hoá tiếng Việt: bỏ dấu, đ→d, thường', () => {
  assert.equal(S.norm('Đèn LED Đường Phố'), 'den led duong pho');
});
test('tìm theo nhiều từ (AND), không dấu, mã ưu tiên trước', () => {
  const items = [
    { maHang: 'TU-DK-3P', ten: 'Tủ điều khiển 3 pha', quyCach: 'PLC LOGO' },
    { maHang: 'DL-STR-100', ten: 'Đèn LED đường phố 100W', quyCach: '4000K' },
    { maHang: 'X1', ten: 'Phụ kiện cho DL-STR-100', quyCach: '' }
  ];
  assert.deepEqual(S.search(items, 'den 100w').map(i => i.maHang), ['DL-STR-100']);
  assert.deepEqual(S.search(items, 'dl-str-100').map(i => i.maHang), ['DL-STR-100', 'X1']);
  assert.deepEqual(S.search(items, 'tu dieu').map(i => i.maHang), ['TU-DK-3P']);
  assert.equal(S.search(items, '').length, 3);
});
test('5.000 mã: tìm < 50 ms (tiêu chí < 1 s)', () => {
  const items = Array.from({ length: 5000 }, (_, i) => ({ maHang: 'HH-' + i, ten: 'Đèn LED số ' + i, quyCach: 'Quy cách ' + (i % 37) }));
  const idx = S.buildIndex(items); const t0 = performance.now();
  const r = S.search(items, 'den 4999', idx); const ms = performance.now() - t0;
  assert.equal(r[0].maHang, 'HH-4999'); assert.ok(ms < 50, ms + ' ms');
});

// ---------- schema ----------
test('schema: sheet đủ cột → ok; thiếu/sai thứ tự cột → báo tên sheet + cột', () => {
  const heads = {}; for (const [n, d] of Object.entries(SC.SHEETS)) heads[n] = d.cols.slice();
  assert.deepEqual(SC.check(heads), []);
  heads.HangHoa = heads.HangHoa.filter(c => c !== 'giaBan');
  delete heads.GopY;
  const e = SC.check(heads);
  assert.ok(e.some(x => x.sheet === 'HangHoa' && /giaBan/.test(x.msg)));
  assert.ok(e.some(x => x.sheet === 'GopY' && /không có/.test(x.msg)));
});
test('schema: đọc dòng → object, dòng trống bị bỏ, sai kiểu báo cảnh báo', () => {
  const cols = SC.SHEETS.HangHoa.cols;
  const row = cols.map(c => ({ maHang: 'A1', ten: 'X', dvt: 'cái', giaBan: 'abc', trangThai: 'KD' })[c] ?? '');
  const r = SC.toObjects('HangHoa', [cols, row, cols.map(() => '')]);
  assert.equal(r.rows.length, 1); assert.equal(r.rows[0].maHang, 'A1');
  assert.ok(r.warnings.some(w => /HangHoa!2/.test(w) && /giaBan/.test(w)));
});

test('đọc ô: bỏ dấu \' thừa trước = + - @; ô có/không đọc đúng dù Sheet trả true/"TRUE"/"false"', () => {
  const cols = SC.SHEETS.HangHoa.cols, mk = o => cols.map(c => o[c] ?? '');
  const r = SC.toObjects('HangHoa', [cols, mk({ maHang: 'A', ten: "'=1+1", quyCach: "'-40°C", hang: "'Nhà A", quanLySerial: 'TRUE' }), mk({ maHang: 'B', ten: 'x', quanLySerial: true }), mk({ maHang: 'C', ten: 'y', quanLySerial: 'false' })]).rows;
  assert.deepEqual([r[0].ten, r[0].quyCach, r[0].hang], ['=1+1', '-40°C', "'Nhà A"]);
  assert.deepEqual(r.map(x => x.quanLySerial), [true, true, false]);
});

// ---------- đợt ②: danh mục kho/khách/công trình/quy đổi + quyền ----------
test('kho / khách hàng / công trình / quy đổi ĐVT: chuẩn hoá + lỗi từng trường', () => {
  assert.deepEqual(V.warehouse({ maKho: 'kho-chinh', ten: 'Kho chính' }).value, { maKho: 'KHO-CHINH', ten: 'Kho chính', diaChi: '', loai: 'THUONG', trangThai: 'HOAT_DONG' });
  assert.ok(V.warehouse({ maKho: '*', ten: 'x' }).errors.maKho, 'mã * dành cho dòng tổng');
  assert.equal(V.warehouse({ maKho: 'L', ten: 'Lỗi', loai: 'HANG_LOI' }).value.loai, 'HANG_LOI');
  const kh = V.customer({ maKH: 'tn01', ten: 'CP QLVH Tây Ninh', mst: '3900123456', cheDoBHThayThe: 'CON_LAI' });
  assert.equal(kh.ok, true); assert.equal(kh.value.cheDoBHThayThe, 'CON_LAI');
  assert.equal(V.customer({ maKH: 'C1', ten: 'Anh A', loaiKH: 'CA_NHAN', cheDoBHThayThe: 'CON_LAI' }).value.cheDoBHThayThe, 'TINH_LAI', 'khách cá nhân luôn tính lại BH');
  assert.ok(V.project({ maCongTrinh: 'PDG', ten: 'Hẻm 20', ngayBatDau: '2026-11-01', ngayNghiemThu: '2026-10-01' }).errors.ngayNghiemThu);
  assert.equal(V.unit({ maHang: 'cap', dvtPhu: 'cuộn', heSo: '500' }).value.heSo, 500);
  assert.ok(V.unit({ maHang: 'CAP', dvtPhu: 'cuộn', heSo: 0 }).errors.heSo);
});
test('đầu phiếu: NHAP_MUA cần NCC, XUAT_BAN cần khách + công trình, KHACH_TRA cần phiếu gốc, ≤ 200 dòng', () => {
  assert.ok(V.voucherHead({ loai: 'NHAP_MUA', ngay: '2026-11-09', kho: 'K1', lines: [] }).errors.maNCC);
  const x = V.voucherHead({ loai: 'XUAT_BAN', ngay: '2026-11-09', kho: 'K1', lines: [] }).errors;
  assert.ok(x.maKH && x.maCongTrinh);
  assert.ok(V.voucherHead({ loai: 'KHACH_TRA', ngay: '2026-11-09', kho: 'K1', lines: [] }).errors.phieuGoc);
  assert.ok(V.voucherHead({ loai: 'XUAT_SX', ngay: '2026-11-09', kho: 'K1', lines: new Array(201).fill({}) }).errors.lines);
  assert.equal(V.voucherHead({ loai: 'XUAT_SX', ngay: '2026-11-09', kho: 'k1', lyDo: '=1+1', lines: [{}] }).value.kho, 'K1');
});
test('quyền đợt ②: XEM không lập phiếu; NHAP_LIEU lập phiếu nhưng không đảo/khoá sổ/tính lại; lọc giá trị kho', () => {
  assert.equal(P.can('XEM', 'voucher.create'), false); assert.equal(P.can('XEM', 'voucher.get'), true);
  assert.equal(P.can('NHAP_LIEU', 'voucher.create'), true);
  for (const a of ['voucher.reverse', 'period.lock', 'stock.rebuild', 'report.nxt', 'warehouse.upsert']) { assert.equal(P.can('NHAP_LIEU', a), false, a); assert.equal(P.can('QUAN_TRI', a), true, a); }
  const d = { vouchers: [{ soPhieu: 'PN-1', tongTien: 5 }], stock: [{ maHang: 'A', kho: '*', soLuong: 1, giaTri: 9 }], config: { ngayKhoaSo: '2026-09-30' } };
  const nl = P.filterForRole('NHAP_LIEU', 'x@y.z', d);
  assert.equal('tongTien' in nl.vouchers[0], false); assert.equal('giaTri' in nl.stock[0], false); assert.equal(nl.config.ngayKhoaSo, '2026-09-30');
  assert.equal(P.filterForRole('QUAN_TRI', 'x@y.z', d).stock[0].giaTri, 9);
  const l = P.filterLines('NHAP_LIEU', [{ maHang: 'A', soLuong: 1, donGia: 5, thanhTien: 5, giaTriKho: 5 }])[0];
  assert.deepEqual(Object.keys(l).sort(), ['maHang', 'soLuong']);
});
