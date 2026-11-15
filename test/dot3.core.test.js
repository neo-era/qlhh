// TDD lõi đợt 3 (v0.5.0) — viết TRƯỚC khi code: đường ra kho hàng lỗi, xuất huỷ, nhập khác, xuất sửa chữa (§19 thiết kế).
const test = require('node:test'), assert = require('node:assert');
const K = require('../core/stock.js'), SR = require('../core/serial.js'), V = require('../core/validate.js');

let stt = 0;
const P = (loai, ngay, kho, lines, x = {}) => ({ soPhieu: x.soPhieu || loai + '-' + (++stt), stt: x.stt || ++stt, loai, ngay, kho, trangThai: 'HOAN_TAT', ...x, lines: lines.map((l, i) => ({ dong: i + 1, ...l })) });
const O = { khoLoi: ['LOI'] };
const val = (r, so, dong = 1) => r.lines[so + '#' + dong];
const nhap = (ngay, sl, gia) => P('NHAP_MUA', ngay, 'K1', [{ maHang: 'A', soLuong: sl, donGia: gia }]);

test('D3 loại phiếu mới có tên, tiền tố, chiều tồn', () => {
  const t = K.TYPES;
  assert.deepEqual(['NHAP_KHAC', 'XUAT_HUY', 'GUI_NCC', 'NHAN_NCC', 'CHUYEN_SUA', 'TRA_KHACH_SUA', 'XUAT_SUA'].map(k => t[k] && t[k].pre), ['NK', 'XH', 'GN', 'NN', 'CS', 'TS', 'XR']);
  assert.equal(t.NHAP_KHAC.cost, 'PRICE'); assert.equal(t.XUAT_HUY.cost, 'AVG'); assert.equal(t.CHUYEN_SUA.cost, 'PRICE'); assert.equal(t.NHAN_NCC.cost, 'PRICE');
});

test('D3-4 xuất huỷ: giá BQ tại ngày; kho lỗi giá 0; khoá sổ; tồn âm về sau', () => {
  const v = [nhap('2026-10-01', 5, 100000), nhap('2026-10-02', 5, 110000)];
  const xh = P('XUAT_HUY', '2026-10-05', 'K1', [{ maHang: 'A', soLuong: 2 }]);
  const c = K.check(v, xh, O); assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(val(c.result, xh.soPhieu), 210000); assert.deepEqual([c.result.ton.A.pool.q, c.result.ton.A.pool.v], [8, 840000]);
  assert.equal(K.check(v, P('XUAT_HUY', '2026-10-05', 'K1', [{ maHang: 'A', soLuong: 2 }]), { ...O, ngayKhoaSo: '2026-10-31' }).code, 'PERIOD_LOCKED');
  const later = [...v, P('XUAT_BAN', '2026-10-10', 'K1', [{ maHang: 'A', soLuong: 9 }])];
  assert.equal(K.check(later, P('XUAT_HUY', '2026-10-03', 'K1', [{ maHang: 'A', soLuong: 2 }]), O).code, 'NEGATIVE_STOCK_LATER');
  // kho lỗi
  const hl = P('NHAP_HANG_LOI', '2026-10-06', 'LOI', [{ maHang: 'A', soLuong: 1 }]);
  const c2 = K.check([...v, hl], P('XUAT_HUY', '2026-10-07', 'LOI', [{ maHang: 'A', soLuong: 1 }]), O);
  assert.equal(c2.ok, true, JSON.stringify(c2)); assert.equal(c2.result.ton.A.pool.v, 1050000); assert.equal(c2.result.ton.A.kho.LOI, 0);
  // fast path trùng tính lại đầy đủ
  const r = K.replay(v, O), ton = r.ton, f = K.applyFast(ton, Object.assign({}, xh, { stt: 999 }), O);
  assert.ok(f && f.ok); assert.equal(f.result.lines[xh.soPhieu + '#1'], 210000);
});

test('D3-5 nhập khác: đơn giá bắt buộc, vào BQ; không vào kho lỗi; đảo được', () => {
  const v = [nhap('2026-10-01', 10, 100000)];
  assert.equal(K.check(v, P('NHAP_KHAC', '2026-10-02', 'K1', [{ maHang: 'A', soLuong: 1 }]), O).code, 'VALIDATION', 'thiếu đơn giá');
  const nk = P('NHAP_KHAC', '2026-10-02', 'K1', [{ maHang: 'A', soLuong: 2, donGia: 40000 }]);
  const c = K.check(v, nk, O); assert.equal(c.ok, true); assert.deepEqual([c.result.ton.A.pool.q, c.result.ton.A.pool.v], [12, 1080000]);
  assert.equal(K.check(v, P('NHAP_KHAC', '2026-10-02', 'LOI', [{ maHang: 'A', soLuong: 1, donGia: 1 }]), O).code, 'VALIDATION');
  const d = K.check([...v, nk], P('DAO', '2026-10-03', 'K1', [], { phieuGoc: nk.soPhieu }), O);
  assert.equal(d.ok, true); assert.deepEqual([d.result.ton.A.pool.q, d.result.ton.A.pool.v], [10, 1000000]);
});

test('D3-2 chuyển hàng đã sửa về kho thường: theo đơn giá, BQ 10@100.000 + 1@0 = 90.909; chỉ kho lỗi → kho thường; đảo về như cũ', () => {
  const v = [nhap('2026-10-01', 10, 100000), P('NHAP_HANG_LOI', '2026-10-02', 'LOI', [{ maHang: 'A', soLuong: 1 }])];
  const cs = P('CHUYEN_SUA', '2026-10-03', 'LOI', [{ maHang: 'A', soLuong: 1, donGia: 0 }], { khoDen: 'K1' });
  const c = K.check(v, cs, O); assert.equal(c.ok, true, JSON.stringify(c));
  assert.deepEqual([c.result.ton.A.pool.q, c.result.ton.A.pool.v, c.result.ton.A.kho.K1, c.result.ton.A.kho.LOI], [11, 1000000, 11, 0]);
  assert.equal(Math.round(c.result.ton.A.pool.v / c.result.ton.A.pool.q), 90909);
  const cs2 = P('CHUYEN_SUA', '2026-10-03', 'LOI', [{ maHang: 'A', soLuong: 1, donGia: 50000 }], { khoDen: 'K1' });
  assert.equal(val(K.check(v, cs2, O).result, cs2.soPhieu), 50000);
  assert.equal(K.check(v, P('CHUYEN_SUA', '2026-10-03', 'K1', [{ maHang: 'A', soLuong: 1, donGia: 0 }], { khoDen: 'K2' }), O).code, 'VALIDATION', 'kho đi phải là kho lỗi');
  assert.equal(K.check(v, P('CHUYEN_SUA', '2026-10-03', 'LOI', [{ maHang: 'A', soLuong: 1, donGia: 0 }], { khoDen: 'LOI' }), O).code, 'VALIDATION', 'kho đến phải là kho thường');
  assert.notEqual(K.check(v, P('CHUYEN_SUA', '2026-10-03', 'LOI', [{ maHang: 'A', soLuong: 2, donGia: 0 }], { khoDen: 'K1' }), O).ok, true, 'vượt tồn kho lỗi');
  const all = [...v, cs2], d = K.check(all, P('DAO', '2026-10-04', 'LOI', [], { phieuGoc: cs2.soPhieu }), O);
  assert.equal(d.ok, true, JSON.stringify(d)); assert.deepEqual([d.result.ton.A.pool.q, d.result.ton.A.pool.v, d.result.ton.A.kho.LOI, d.result.ton.A.kho.K1], [10, 1000000, 1, 10]);
  // N-X-T: hàng sửa về tính vào NHẬP của kho thường, có cột theo loại
  const n = K.nxt(all, '2026-10-01', '2026-10-31', O)[0];
  assert.deepEqual([n.nhapQ, n.nhapV, n.cuoiQ, n.cuoiV], [11, 1050000, 11, 1050000]);
  assert.deepEqual(n.theoLoai.CHUYEN_SUA, { q: 1, v: 50000 });
});

test('D3-1 gửi NCC / nhận NCC trả về: theo phiếu gửi, không vượt, về kho thường theo đơn giá, về kho lỗi giá 0', () => {
  const v = [nhap('2026-10-01', 2, 100000), P('NHAP_HANG_LOI', '2026-10-02', 'LOI', [{ maHang: 'A', soLuong: 2 }])];
  const gn = P('GUI_NCC', '2026-10-03', 'LOI', [{ maHang: 'A', soLuong: 2 }], { maNCC: 'N1' });
  assert.equal(K.check(v, P('GUI_NCC', '2026-10-03', 'K1', [{ maHang: 'A', soLuong: 1 }]), O).code, 'VALIDATION', 'chỉ gửi từ kho lỗi');
  const c = K.check(v, gn, O); assert.equal(c.ok, true, JSON.stringify(c)); assert.equal(c.result.ton.A.kho.LOI, 0); assert.equal(c.result.ton.A.pool.v, 200000);
  const v2 = [...v, gn];
  assert.equal(K.check(v2, P('NHAN_NCC', '2026-10-05', 'K1', [{ maHang: 'A', soLuong: 1, donGia: 0 }]), O).code, 'VALIDATION', 'phải có phiếu gửi gốc');
  assert.equal(K.check(v2, P('NHAN_NCC', '2026-10-05', 'K1', [{ maHang: 'A', soLuong: 3, donGia: 0 }], { phieuGoc: gn.soPhieu }), O).code, 'VALIDATION', 'vượt số đã gửi');
  const nn = P('NHAN_NCC', '2026-10-05', 'K1', [{ maHang: 'A', soLuong: 1, donGia: 30000 }], { phieuGoc: gn.soPhieu });
  const c2 = K.check(v2, nn, O); assert.equal(c2.ok, true, JSON.stringify(c2)); assert.deepEqual([c2.result.ton.A.pool.q, c2.result.ton.A.pool.v], [3, 230000]);
  const nn2 = P('NHAN_NCC', '2026-10-06', 'LOI', [{ maHang: 'A', soLuong: 1, donGia: 0 }], { phieuGoc: gn.soPhieu });
  const c3 = K.check([...v2, nn], nn2, O); assert.equal(c3.ok, true); assert.equal(c3.result.ton.A.kho.LOI, 1);
  assert.equal(K.check([...v2, nn, nn2], P('NHAN_NCC', '2026-10-07', 'LOI', [{ maHang: 'A', soLuong: 1, donGia: 0 }], { phieuGoc: gn.soPhieu }), O).code, 'VALIDATION', 'đã nhận đủ');
  // đảo phiếu gửi khi đã có phiếu nhận → chặn
  assert.equal(K.check([...v2, nn], P('DAO', '2026-10-08', 'LOI', [], { phieuGoc: gn.soPhieu }), O).code, 'VALIDATION');
});

test('D3-3 trả khách hàng đã sửa: theo phiếu nhận lỗi có khách, không vượt; giá 0', () => {
  const hl = P('NHAP_HANG_LOI', '2026-10-02', 'LOI', [{ maHang: 'A', soLuong: 2 }], { maKH: 'KH1' });
  const ts = P('TRA_KHACH_SUA', '2026-10-04', 'LOI', [{ maHang: 'A', soLuong: 2 }], { phieuGoc: hl.soPhieu, maKH: 'KH1' });
  const c = K.check([hl], ts, O); assert.equal(c.ok, true, JSON.stringify(c)); assert.equal(val(c.result, ts.soPhieu), 0); assert.equal(c.result.ton.A.kho.LOI, 0);
  assert.equal(K.check([hl], P('TRA_KHACH_SUA', '2026-10-04', 'LOI', [{ maHang: 'A', soLuong: 3 }], { phieuGoc: hl.soPhieu }), O).code, 'VALIDATION');
  const thuHoi = P('NHAP_HANG_LOI', '2026-10-02', 'LOI', [{ maHang: 'A', soLuong: 1 }]);
  assert.equal(K.check([thuHoi], P('TRA_KHACH_SUA', '2026-10-04', 'LOI', [{ maHang: 'A', soLuong: 1 }], { phieuGoc: thuHoi.soPhieu }), O).code, 'VALIDATION', 'hàng thu hồi bảo hành không có khách');
  assert.equal(K.check([hl, ts], P('DAO', '2026-10-05', 'LOI', [], { phieuGoc: hl.soPhieu }), O).code, 'VALIDATION', 'đảo nhận lỗi khi đã trả khách');
});

test('D3 xuất sửa chữa (thu tiền): giá BQ như xuất bán', () => {
  const v = [nhap('2026-10-01', 4, 100000)], xr = P('XUAT_SUA', '2026-10-02', 'K1', [{ maHang: 'A', soLuong: 1 }]);
  const c = K.check(v, xr, O); assert.equal(c.ok, true); assert.equal(val(c.result, xr.soPhieu), 100000);
});

test('D3 lý do bắt buộc: xuất huỷ, nhập khác, chuyển hàng đã sửa (kiểm đầu phiếu dùng chung máy khách/máy chủ)', () => {
  for (const loai of ['XUAT_HUY', 'NHAP_KHAC', 'CHUYEN_SUA']) {
    const r = V.voucherHead({ loai, ngay: '2026-10-01', kho: 'K1', lines: [] }); assert.equal(r.ok, false, loai); assert.ok(r.errors.lyDo, loai);
    assert.equal(V.voucherHead({ loai, ngay: '2026-10-01', kho: 'K1', lyDo: 'Biên bản 01', lines: [] }).ok, true);
  }
  assert.ok(V.voucherHead({ loai: 'GUI_NCC', ngay: '2026-10-01', kho: 'K1', lines: [] }).errors.maNCC);
  assert.ok(V.voucherHead({ loai: 'NHAN_NCC', ngay: '2026-10-01', kho: 'K1', maNCC: 'N', lines: [] }).errors.phieuGoc);
  assert.ok(V.voucherHead({ loai: 'TRA_KHACH_SUA', ngay: '2026-10-01', kho: 'K1', lines: [] }).errors.phieuGoc);
});

const items = { LOGO: { maHang: 'LOGO', hang: 'Siemens', quanLySerial: true } };
const S = (loai, kho, lines, x = {}) => ({ soPhieu: x.soPhieu || loai, loai, ngay: '2026-11-09', kho, ...x, lines: lines.map((l, i) => ({ dong: i + 1, ...l })) });
const ctx = (extra = {}) => ({ items, khoLoi: ['LOI'], vouchers: {}, ...extra });

test('D3 serial: xuất huỷ → XUAT_HUY và không nhập lại được số đó; gửi NCC; chuyển sửa; trả khách', () => {
  const map = SR.index([{ key: 'SIEMENS|S1', maHang: 'LOGO', trangThai: 'TRONG_KHO', kho: 'K1' }, { key: 'SIEMENS|L1', maHang: 'LOGO', trangThai: 'HANG_LOI', kho: 'LOI' }]);
  const xh = SR.apply(map, S('XUAT_HUY', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['S1'] }]), ctx());
  assert.equal(xh.ok, true); assert.deepEqual([xh.changes[0].to, xh.changes[0].kho], ['XUAT_HUY', '']);
  assert.equal(SR.apply(map, S('XUAT_HUY', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['L1'] }]), ctx()).changes[0].to, 'XUAT_HUY');
  const m2 = SR.index([{ key: 'SIEMENS|S1', maHang: 'LOGO', trangThai: 'XUAT_HUY', kho: '' }]);
  assert.equal(SR.apply(m2, S('NHAP_MUA', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['S1'] }]), ctx()).code, 'SERIAL_DUP');
  assert.equal(SR.apply(m2, S('NHAP_KHAC', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['S1'] }]), ctx()).code, 'SERIAL_DUP');
  assert.equal(SR.apply({}, S('NHAP_KHAC', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['N1'] }]), ctx()).changes[0].to, 'TRONG_KHO');
  const gn = SR.apply(map, S('GUI_NCC', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['L1'] }]), ctx());
  assert.deepEqual([gn.changes[0].to, gn.changes[0].kho], ['GUI_NCC', '']);
  assert.equal(SR.apply(map, S('GUI_NCC', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['S1'] }]), ctx()).ok, false, 'chỉ hàng ở kho lỗi');
  const cs = SR.apply(map, S('CHUYEN_SUA', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['L1'] }], { khoDen: 'K1' }), ctx());
  assert.deepEqual([cs.changes[0].to, cs.changes[0].kho], ['TRONG_KHO', 'K1']);
  const hl = S('NHAP_HANG_LOI', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['L1'] }], { soPhieu: 'HL-1', maKH: 'KH' });
  const ts = SR.apply(map, S('TRA_KHACH_SUA', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['L1'] }], { phieuGoc: 'HL-1' }), ctx({ vouchers: { 'HL-1': hl } }));
  assert.deepEqual([ts.changes[0].to, ts.changes[0].kho], ['DA_BAN', '']);
  const other = S('NHAP_HANG_LOI', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['L9'] }], { soPhieu: 'HL-2' });
  assert.equal(SR.apply(map, S('TRA_KHACH_SUA', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['L1'] }], { phieuGoc: 'HL-2' }), ctx({ vouchers: { 'HL-2': other } })).ok, false, 'serial không thuộc phiếu gốc');
});

test('D3-1 serial nhận NCC: cùng serial (sửa) hoặc serial mới đổi cho serial gửi (serialsDoi → DA_TRA_NCC)', () => {
  const map = SR.index([{ key: 'SIEMENS|G1', maHang: 'LOGO', trangThai: 'GUI_NCC', kho: '' }, { key: 'SIEMENS|G2', maHang: 'LOGO', trangThai: 'GUI_NCC', kho: '' }, { key: 'SIEMENS|X1', maHang: 'LOGO', trangThai: 'TRONG_KHO', kho: 'K1' }]);
  const gn = S('GUI_NCC', 'LOI', [{ maHang: 'LOGO', soLuong: 2, serials: ['G1', 'G2'] }], { soPhieu: 'GN-1' }), c = ctx({ vouchers: { 'GN-1': gn } });
  const r = SR.apply(map, S('NHAN_NCC', 'K1', [{ maHang: 'LOGO', soLuong: 2, serials: ['G1', 'NEW1'], serialsDoi: ['G2'] }], { phieuGoc: 'GN-1' }), c);
  assert.equal(r.ok, true, JSON.stringify(r));
  const by = Object.fromEntries(r.changes.map(x => [x.serial, [x.to, x.kho]]));
  assert.deepEqual(by, { G1: ['TRONG_KHO', 'K1'], NEW1: ['TRONG_KHO', 'K1'], G2: ['DA_TRA_NCC', ''] });
  assert.equal(SR.apply(map, S('NHAN_NCC', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['G1'] }], { phieuGoc: 'GN-1' }), c).changes[0].to, 'HANG_LOI', 'về kho lỗi');
  assert.equal(SR.apply(map, S('NHAN_NCC', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['NEW1'] }], { phieuGoc: 'GN-1' }), c).ok, false, 'serial mới phải chỉ rõ serial gửi được đổi');
  assert.equal(SR.apply(map, S('NHAN_NCC', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['X1'] }], { phieuGoc: 'GN-1' }), c).ok, false, 'serial đang trong kho');
  assert.equal(SR.apply(map, S('NHAN_NCC', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['N2'], serialsDoi: ['X1'] }], { phieuGoc: 'GN-1' }), c).ok, false, 'serial đổi phải là serial đang gửi của phiếu gốc');
  assert.equal(SR.apply(map, S('NHAN_NCC', 'K1', [{ maHang: 'LOGO', soLuong: 2, serials: ['G1', 'N3'], serialsDoi: ['G1'] }], { phieuGoc: 'GN-1' }), c).ok, false, 'không vừa nhận lại vừa đổi 1 serial');
});

test('D3-9 đảo có trạng thái thay thế được chấp nhận (linh kiện mới đang lắp trong tủ khi huỷ lần thay)', () => {
  const hist = [{ soPhieu: 'XB-1', key: 'SIEMENS|N1', maHang: 'LOGO', from: 'TRONG_KHO', to: 'DA_BAN', khoTu: 'K1', khoDen: '' }];
  const m = SR.index([{ key: 'SIEMENS|N1', maHang: 'LOGO', trangThai: 'DA_LAP', kho: '', serialCha: 'LAVIPCO|TU1' }]);
  assert.equal(SR.reverse(m, hist, 'DA-1').ok, false);
  const r = SR.reverse(m, hist, 'DA-1', { 'SIEMENS|N1': 'DA_LAP' });
  assert.equal(r.ok, true); assert.deepEqual([r.changes[0].from, r.changes[0].to, r.changes[0].kho], ['DA_LAP', 'TRONG_KHO', 'K1']);
});
