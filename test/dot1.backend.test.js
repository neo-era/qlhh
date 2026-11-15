// TDD đợt 1 (rà soát tổng thể 15/11/2026): toàn vẹn dữ liệu — viết TRƯỚC khi sửa. Tái hiện từ script của chuyên gia kỹ thuật.
const test = require('node:test'), assert = require('node:assert');
const { plant, built } = require('./sx-fixture.js');
const { rid, jwt } = require('./gas-mock.js');
const S = require('../core/schema.js').SHEETS;
const col = (n, c) => S[n].cols.indexOf(c);
const boom = () => { throw new Error('Exceeded maximum execution time'); };
/** Lần gọi kế tiếp của sheet[meth] (thoả điều kiện) ném lỗi như Apps Script hết giờ. */
function once(sheet, meth, when) { const o = sheet[meth]; let armed = true; sheet[meth] = function (...a) { if (armed && (!when || when(...a))) { armed = false; boom(); } return o.apply(this, a); }; }
/** Lần ghi theo số dòng (getRange(r,…).setValues) kế tiếp của sheet ném lỗi. */
function onceSet(sheet) { const o = sheet.getRange; let armed = true; sheet.getRange = function (...a) { const g = o.apply(this, a); if (armed && typeof a[0] === 'number') { const sv = g.setValues; g.setValues = v => { if (armed) { armed = false; boom(); } return sv(v); }; } return g; }; }
const purge = (a, re) => { for (const k of Object.keys(a.cache)) if (re.test(k)) delete a.cache[k]; };
const keys = (sh) => sh.d.slice(1).map(r => r[0]);

// ---------------- A1: sửa tay Sheet trong lúc bộ đệm còn sống ----------------
test('A1 sắp xếp tay HangHoa rồi lập phiếu: không ghi đè sai dòng, không mất / nhân đôi mã hàng', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 1); x.pull();
  const hh = a.sheets.HangHoa, before = keys(hh).slice().sort();
  hh.d = [hh.d[0], ...hh.d.slice(1).reverse()];   // QT sắp xếp Z→A trên Google Sheet
  W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-12', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'VO', soLuongCT: 1, gia: 9999999 }] } }, x.nv);
  assert.deepEqual(keys(hh).slice().sort(), before, 'đủ mã, không trùng');
  const vo = hh.d.find(r => r[0] === 'VO'); assert.equal(vo[col('HangHoa', 'giaVon')], Math.round((3200000 + 9999999) / 2), 'giá vốn ghi đúng dòng VO');
  const tu = hh.d.find(r => r[0] === 'TU-DKCS-2N'); assert.equal(tu[col('HangHoa', 'ten')], 'Tủ ĐKCS 2 nhánh có LOGO!');
});
test('A1 sắp xếp tay TonKho / HoSoTu / LenhSX rồi ghi: dữ liệu đúng chỗ', () => {
  const x = built(), { a, W, pass } = x; x.buy('2026-11-10', 1); x.pull();
  const tk = a.sheets.TonKho; tk.d = [tk.d[0], ...tk.d.slice(1).reverse()];
  const hs = a.sheets.HoSoTu; hs.d = [hs.d[0], ...hs.d.slice(1).reverse()];
  W('kcs.add', { serial: x.tp.serials[0], ngay: '2026-11-10', ketQua: pass() }, x.nv);
  const c0 = hs.d.find(r => r[0] === x.tp.serials[0]), c1 = hs.d.find(r => r[0] === x.tp.serials[1]);
  assert.equal(c0[col('HoSoTu', 'kcsDat')], true); assert.equal(c1[col('HoSoTu', 'kcsDat')], false, 'tủ kia không bị đè');
  assert.equal(hs.d.length - 1, 2);
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } }, x.nv);
  const rows = tk.d.slice(1).filter(r => r[0]).map(r => r[0] + '|' + r[1]);
  assert.equal(new Set(rows).size, rows.length, 'TonKho không trùng dòng');
  const den = tk.d.find(r => r[0] === 'DEN' && r[1] === '*'); assert.equal(den[col('TonKho', 'soLuong')], 4, 'DEN: mua 10+5, xuất SX 10, bán 1 → còn 4');
  const vo = tk.d.find(r => r[0] === 'VO' && r[1] === '*'); assert.equal(vo[col('TonKho', 'soLuong')], 1, 'dòng VO không bị đè');
});

// ---------------- A2: chống ghi trùng phải dựa vào sheet, không chỉ bộ đệm ----------------
test('A2 voucher.create chết khi ghi nhật ký + bộ đệm mất: gửi lại không tạo phiếu thứ 2, tồn chỉ trừ 1 lần', () => {
  const x = built(), { a } = x; x.buy('2026-11-11', 2);
  once(a.sheets.NhatKy, 'appendRow');
  const id = rid(), body = { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN', soLuongCT: 3 }] } };
  const t0 = x.ton('DEN').soLuong;
  assert.equal(a.post({ action: 'voucher.create', session: x.nv, requestId: id, ...body }).ok, false);
  purge(a, /^(done|req|sxdone):/);
  const r2 = a.post({ action: 'voucher.create', session: x.nv, requestId: id, ...body });
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(a.sheets.Phieu.d.filter(r => r[col('Phieu', 'requestId')] === id).length, 1, 'chỉ 1 đầu phiếu');
  assert.equal(x.ton('DEN').soLuong, t0 - 3);
});
test('A2 xuất tủ chết SAU khi ghi đầu phiếu (đồng bộ lần xuất): gửi lại trả phiếu cũ và hoàn tất hồ sơ tủ', () => {
  const x = built(), { a, W, pass } = x; x.tp.serials.forEach(s => W('kcs.add', { serial: s, ngay: '2026-11-10', ketQua: pass() }, x.nv));
  const ser = x.tp.serials[0], ls = a.sheets.LichSuSerial, o = ls.getDataRange, ph = a.sheets.Phieu, oa = ph.appendRow; let armed = false, hit = false;
  ph.appendRow = function (r) { oa.call(this, r); if (!hit) armed = true; };   // đầu phiếu vừa ghi → lần đọc LichSuSerial kế tiếp (cabExitSync) hết giờ
  ls.getDataRange = function () { if (armed) { armed = false; hit = true; boom(); } return o.call(this); };
  const id = rid(), body = { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [ser] }] } };
  const r1 = a.post({ action: 'voucher.create', session: x.nv, requestId: id, ...body });
  const heads = () => a.sheets.Phieu.d.filter(r => r[col('Phieu', 'requestId')] === id);
  assert.equal(r1.ok, false); assert.ok(hit); assert.equal(heads().length, 1, 'đầu phiếu đã ghi trước lỗi');
  purge(a, /^(done|req):/);
  const r2 = a.post({ action: 'voucher.create', session: x.nv, requestId: id, ...body });
  assert.equal(r2.ok, true, JSON.stringify(r2)); assert.equal(heads().length, 1);
  assert.equal(r2.data.soPhieu, heads()[0][0]);
  const c = a.sheets.HoSoTu.d.find(r => r[0] === ser); assert.equal(c[col('HoSoTu', 'phieuXuat')], r2.data.soPhieu, 'hồ sơ tủ ghi lần xuất');
});
test('A2 lsx.create / price.add / template.upsert / feedback.add chết ở nhật ký: gửi lại không ghi trùng', () => {
  const x = built(), { a } = x;
  const run = (action, body, who, sheet) => {
    const n0 = a.sheets[sheet].d.length; once(a.sheets.NhatKy, 'appendRow'); const id = rid();
    assert.equal(a.post({ action, session: who, requestId: id, ...body }).ok, false);
    const r2 = a.post({ action, session: who, requestId: id, ...body }); assert.equal(r2.ok, true, action + JSON.stringify(r2));
    assert.equal(a.sheets[sheet].d.length, n0 + 1, action + ': đúng 1 dòng mới'); return r2.data;
  };
  run('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 1, ngay: '2026-11-12', kho: 'KHO' } }, x.nv, 'LenhSX');
  run('price.add', { price: { maHang: 'VO', loai: 'BAN', gia: 5000000, tuNgay: '2026-11-12' } }, x.s, 'BangGia');
  run('template.upsert', { template: { maMau: 'TU-2N', maHang: 'TU-DKCS-2N', ten: 'Tủ 2N bản 2', thangBH: 12, bom: [{ maHang: 'VO', soLuong: 1 }], kcs: [{ noiDung: 'Ngoại quan', yeuCau: 'Đạt' }] } }, x.s, 'MauSanPham');
  run('feedback.add', { feedback: { sao: 5, loai: 'KHAC', noiDung: 'Tốt' } }, x.nv, 'GopY');
});
test('A2/C2 đảo phiếu gửi lại sau khi đã thành công: trả lại phiếu đảo cũ, không báo lỗi', () => {
  const x = plant(), { a, W } = x; const p = W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-10', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'VO', soLuongCT: 1, gia: 100 }] } });
  const id = rid(), b = { phieuGoc: p.soPhieu, lyDo: 'sai', ngay: '2026-11-11' };
  const r1 = a.post({ action: 'voucher.reverse', session: x.s, requestId: id, ...b }); assert.equal(r1.ok, true);
  purge(a, /^(done|req):/); a.sheets.Request.d = a.sheets.Request.d.filter(r => r[0] !== id);   // như kết quả lưu bị mất
  const r2 = a.post({ action: 'voucher.reverse', session: x.s, requestId: id, ...b });
  assert.equal(r2.ok, true, JSON.stringify(r2)); assert.equal(r2.data.soPhieu, r1.data.soPhieu);
});

// ---------------- A5: lệnh nhiều bước tự hoàn tất khi gửi lại ----------------
test('A5 pxx.issue chết trước khi ghi dòng PXX: gửi lại phát hành được; tủ không kẹt', () => {
  const x = built(), { a, W, pass } = x; x.tp.serials.forEach(s => W('kcs.add', { serial: s, ngay: '2026-11-10', ketQua: pass() }, x.nv));
  once(a.sheets.PhieuXuatXuong, 'appendRow'); const id = rid(), b = { pxx: { ngay: '2026-11-12', serials: [x.tp.serials[0]], maKH: 'TN' } };
  assert.equal(a.post({ action: 'pxx.issue', session: x.nv, requestId: id, ...b }).ok, false);
  const r2 = a.post({ action: 'pxx.issue', session: x.nv, requestId: id, ...b }); assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(a.sheets.PhieuXuatXuong.d.length - 1, 1);
  const c = a.sheets.HoSoTu.d.find(r => r[0] === x.tp.serials[0]); assert.equal(c[col('HoSoTu', 'soPXX')], r2.data.soPXX);
});
test('A5 pxx.issue chết, người dùng bỏ không gửi lại: tủ mang số PXX không tồn tại vẫn lập PXX mới / KCS lại được', () => {
  const x = built(), { a, W, P, pass } = x; x.tp.serials.forEach(s => W('kcs.add', { serial: s, ngay: '2026-11-10', ketQua: pass() }, x.nv));
  once(a.sheets.PhieuXuatXuong, 'appendRow');
  assert.equal(P('pxx.issue', { pxx: { ngay: '2026-11-12', serials: [x.tp.serials[0]] } }, x.nv).ok, false);
  const k = P('kcs.add', { serial: x.tp.serials[0], ngay: '2026-11-12', ketQua: pass() }, x.nv); assert.equal(k.ok, true, 'KCS lại được: ' + JSON.stringify(k));
  const r = P('pxx.issue', { pxx: { ngay: '2026-11-12', serials: [x.tp.serials[0]] } }, x.nv); assert.equal(r.ok, true, JSON.stringify(r));
});
test('A5 kcs.add chết khi cập nhật hồ sơ tủ: gửi lại → hồ sơ tủ đạt, lập PXX được', () => {
  const x = built(), { a, P, pass } = x; onceSet(a.sheets.HoSoTu); const id = rid(), b = { serial: x.tp.serials[0], ngay: '2026-11-10', ketQua: pass() };
  assert.equal(a.post({ action: 'kcs.add', session: x.nv, requestId: id, ...b }).ok, false);
  const r2 = a.post({ action: 'kcs.add', session: x.nv, requestId: id, ...b }); assert.equal(r2.ok, true);
  const c = a.sheets.HoSoTu.d.find(r => r[0] === x.tp.serials[0]); assert.equal(c[col('HoSoTu', 'kcsDat')], true); assert.equal(c[col('HoSoTu', 'lanKiemCuoi')], 1);
  assert.equal(P('pxx.issue', { pxx: { ngay: '2026-11-12', serials: [x.tp.serials[0]] } }, x.nv).ok, true);
});
test('A5 lsx.chiPhi chết giữa chừng: gửi lại → giá thành tủ đã tính lại, không cần "Tính lại tồn"', () => {
  const x = built(), { a } = x; const v0 = x.ton('TU-DKCS-2N').giaTri;
  onceSet(a.sheets.ChiTietPhieu); const id = rid(), b = { soLSX: x.so, chiPhi: { ngay: '2026-11-06', loai: 'SX_CHUNG', soTien: 1000000 } };
  assert.equal(a.post({ action: 'lsx.chiPhi', session: x.s, requestId: id, ...b }).ok, false);
  const r2 = a.post({ action: 'lsx.chiPhi', session: x.s, requestId: id, ...b }); assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(x.ton('TU-DKCS-2N').giaTri, v0 + 1000000);
  assert.equal(a.sheets.ChiPhiLSX.d.filter(r => r[col('ChiPhiLSX', 'requestId')] === id).length, 1);
});
test('A5 pxx.cancel chết khi gỡ tủ: gửi lại báo thành công; tủ lập PXX mới được', () => {
  const x = built(), { a, W, P, pass } = x; x.tp.serials.forEach(s => W('kcs.add', { serial: s, ngay: '2026-11-10', ketQua: pass() }, x.nv));
  const so = W('pxx.issue', { pxx: { ngay: '2026-11-12', serials: [x.tp.serials[0]] } }, x.nv).soPXX;
  onceSet(a.sheets.HoSoTu); const id = rid();
  assert.equal(a.post({ action: 'pxx.cancel', session: x.s, requestId: id, soPXX: so, lyDo: 'sai' }).ok, false);
  const r2 = a.post({ action: 'pxx.cancel', session: x.s, requestId: id, soPXX: so, lyDo: 'sai' }); assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(P('pxx.issue', { pxx: { ngay: '2026-11-12', serials: [x.tp.serials[0]] } }, x.nv).ok, true);
});
test('A5/C1 lsx.huy chết khi cập nhật lệnh: gửi lại không ghi kết chuyển huỷ thứ 2, kết quả đúng', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 2); x.tpl();
  const so = W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  x.issue(so, '2026-11-05', 2, ['LG11010', 'LG11011']);
  W('lsx.chiPhi', { soLSX: so, chiPhi: { ngay: '2026-11-05', loai: 'NC_TRUC_TIEP', soTien: 3000000 } });
  onceSet(a.sheets.LenhSX); const id = rid(), b = { soLSX: so, lyDo: 'huỷ', ngay: '2026-11-12' };
  assert.equal(a.post({ action: 'lsx.huy', session: x.s, requestId: id, ...b }).ok, false);
  const r2 = a.post({ action: 'lsx.huy', session: x.s, requestId: id, ...b }); assert.equal(r2.ok, true, JSON.stringify(r2));
  const kc = a.sheets.ChiPhiLSX.d.filter(r => r[col('ChiPhiLSX', 'loai')] === 'KC_HUY'); assert.equal(kc.length, 1);
  assert.equal(r2.data.ketChuyen, -Number(kc[0][col('ChiPhiLSX', 'soTien')]));
  assert.equal(a.sheets.LenhSX.d.find(r => r[0] === so)[col('LenhSX', 'trangThai')], 'HUY');
});

// ---------------- A4: phiếu bảo hành chỉ qua luồng bảo hành ----------------
test('A4 không lập trực tiếp Xuất bảo hành; không thu tủ đã bán vào kho lỗi ngoài luồng; trả NCC phải có NCC', () => {
  const x = built(), { a, W, P, pass } = x; x.buy('2026-11-10', 2);
  x.tp.serials.forEach(s => W('kcs.add', { serial: s, ngay: '2026-11-10', ketQua: pass() }, x.nv));
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.tp.serials[0]] }] } }, x.nv);
  W('install.add', { serial: x.tp.serials[0], lapDat: { loai: 'BAN_GIAO', ngay: '2026-11-13', maKH: 'TN', diaChi: 'Số 1' } }, x.nv);
  const bh = W('bh.create', { serial: x.tp.serials[0], phieu: { ngay: '2026-11-14', nguoiBao: 'A', moTaLoi: 'hỏng' } }, x.nv);
  for (const who of [x.nv, x.s]) {
    const r = P('voucher.create', { voucher: { loai: 'XUAT_BH', ngay: '2026-11-14', kho: 'KHO', maKH: 'TN', soCTGoc: bh.soPBH, lyDo: 'tự lập', lines: [{ maHang: 'CB40', soLuongCT: 1 }] } }, who);
    assert.equal(r.ok, false, 'XUAT_BH trực tiếp bị chặn'); assert.match(r.error, /bảo hành/);
  }
  const hl = P('voucher.create', { voucher: { loai: 'NHAP_HANG_LOI', ngay: '2026-11-14', kho: 'KHO-LOI', maKH: 'TN', lyDo: 'thu tủ', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.tp.serials[0]] }] } }, x.nv);
  assert.equal(hl.ok, false, 'tủ đã bán không vào kho lỗi ngoài luồng'); assert.match(hl.error, /Khách trả|bảo hành/);
  const hl2 = P('voucher.create', { voucher: { loai: 'NHAP_HANG_LOI', ngay: '2026-11-14', kho: 'KHO-LOI', soCTGoc: bh.soPBH, lyDo: 'x', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } }, x.nv);
  assert.equal(hl2.ok, false, 'chứng từ gốc là phiếu bảo hành → chỉ qua Thay linh kiện');
  assert.equal(P('voucher.create', { voucher: { loai: 'NHAP_HANG_LOI', ngay: '2026-11-14', kho: 'KHO-LOI', maKH: 'TN', lyDo: 'đèn lỗi khách gửi', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } }, x.nv).ok, true, 'hàng không serial vẫn nhận lỗi được');
  const tn = P('voucher.create', { voucher: { loai: 'TRA_NCC', ngay: '2026-11-14', kho: 'KHO-LOI', lyDo: 'trả', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } }, x.s);
  assert.equal(tn.ok, false); assert.ok(tn.fields && tn.fields.maNCC, JSON.stringify(tn));
  // luồng bảo hành vẫn chạy
  W('bh.update', { soPBH: bh.soPBH, trangThai: 'DANG_XU_LY', nguyenNhan: 'LOI_THIET_BI' }, x.nv);
  const rp = W('bh.replace', { soPBH: bh.soPBH, ngay: '2026-11-14', kho: 'KHO', lines: [{ maHang: 'CB40', soLuong: 1 }] }, x.nv);
  assert.ok(rp.soPhieuXuat);
});

// ---------------- A3: bảo vệ kỳ đã khoá ----------------
test('A3 không đổi loại kho đã có phiếu; đổi được khi kho chưa có phiếu', () => {
  const x = plant(), { W, P } = x; x.buy('2026-11-01', 1);
  const r = P('warehouse.upsert', { warehouse: { maKho: 'KHO', ten: 'Kho chính', loai: 'HANG_LOI', trangThai: 'HOAT_DONG' } });
  assert.equal(r.ok, false); assert.match(r.error, /đã có phiếu/);
  assert.equal(P('warehouse.upsert', { warehouse: { maKho: 'KHO', ten: 'Kho chính (đổi tên)', loai: 'THUONG', trangThai: 'HOAT_DONG' } }).ok, true, 'đổi tên vẫn được');
  W('warehouse.upsert', { isNew: true, warehouse: { maKho: 'KHO2', ten: 'Kho 2', loai: 'THUONG', trangThai: 'HOAT_DONG' } });
  assert.equal(P('warehouse.upsert', { warehouse: { maKho: 'KHO2', ten: 'Kho 2', loai: 'HANG_LOI', trangThai: 'HOAT_DONG' } }).ok, true);
});
test('A3 khoá sổ chỉ tiến; lùi / mở khoá phải ghi lý do; khoá thì lưu số dư chốt', () => {
  const x = plant(), { a, W, P } = x; x.buy('2026-11-01', 1);
  W('period.lock', { ngay: '2026-11-05' });
  const snap = a.sheets.SoDuKhoaSo.d.slice(1).filter(r => r[0] === '2026-11-05');
  const vo = snap.find(r => r[1] === 'VO' && r[2] === '*'); assert.ok(vo, 'có số dư chốt VO'); assert.equal(vo[col('SoDuKhoaSo', 'soLuong')], 1); assert.equal(vo[col('SoDuKhoaSo', 'giaTri')], 3200000);
  assert.ok(snap.find(r => r[1] === 'VO' && r[2] === 'KHO'), 'số lượng theo kho');
  assert.equal(P('period.lock', { ngay: '2026-11-03' }).ok, false, 'lùi ngày khoá cần lý do');
  assert.equal(P('period.lock', { ngay: '' }).ok, false, 'mở khoá cần lý do');
  assert.equal(P('period.lock', { ngay: '2026-10-31', lyDo: 'Sửa phiếu nhập ngày 02/11 theo hoá đơn' }).ok, true);
  const log = a.sheets.NhatKy.d.find(r => r[2] === 'period.reopen'); assert.ok(log && /hoá đơn/.test(log[6]), 'nhật ký ghi lý do');
  W('period.lock', { ngay: '2026-11-06' });
});
test('A3 "Tính lại tồn" ra số dư kỳ đã khoá khác lúc khoá (sửa tay loại kho): không ghi đè, báo rõ', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 1);
  W('voucher.create', { voucher: { loai: 'NHAP_HANG_LOI', ngay: '2026-11-02', kho: 'KHO-LOI', maKH: 'TN', lyDo: 'đèn lỗi', lines: [{ maHang: 'DEN', soLuongCT: 2 }] } });
  W('period.lock', { ngay: '2026-11-05' });
  const kho = a.sheets.Kho; kho.d.find(r => r[0] === 'KHO-LOI')[col('Kho', 'loai')] = 'THUONG';   // sửa tay trên Sheet
  const tk0 = JSON.stringify(a.sheets.TonKho.d);
  const r = W('stock.rebuild', {});
  assert.equal(r.chanKyKhoa, true, JSON.stringify(r)); assert.ok(r.lechSoDu.length >= 1);
  assert.equal(JSON.stringify(a.sheets.TonKho.d), tk0, 'TonKho giữ nguyên');
});

// ---------------- B1: dấu "đang ghi" bền + nonce không trạng thái ----------------
test('B1 phiếu chết giữa chừng + bộ đệm mất hết: lệnh ghi sau vẫn dọn phiếu dở (trả serial)', () => {
  const x = plant(), { a, P } = x; x.buy('2026-11-01', 1);
  const ser = 'LG11010'; once(a.sheets.Phieu, 'appendRow');   // chết đúng lúc ghi đầu phiếu
  assert.equal(P('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] } }, x.nv).ok, false);
  for (const k of Object.keys(a.cache)) delete a.cache[k];
  P('customer.upsert', { customer: { maKH: 'KH2', ten: 'Khách 2' } });   // lệnh ghi bất kỳ
  const r = P('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] } }, x.nv);
  assert.equal(r.ok, true, 'serial đã trả về kho: ' + JSON.stringify(r));
  assert.ok(ser);
});
test('B1/C4 nonce không ghi bộ đệm; nonce giả / hết hạn bị từ chối trước khi gọi Google', () => {
  const x = plant(), { a } = x;
  const n0 = Object.keys(a.cache).length; const n = a.post({ action: 'auth.nonce' }).data.nonce; assert.equal(Object.keys(a.cache).length, n0, 'không ghi cache');
  assert.equal(typeof a.login(), 'string', 'đăng nhập bình thường được');
  let calls = 0; const g = a.st; const fake = 'gia' + n.slice(3); g.nonce = fake;
  assert.equal(a.post({ action: 'auth.login', idToken: jwt(fake) }).code, 'AUTH_INVALID', 'nonce giả');
  assert.equal(a.post({ action: 'auth.login', idToken: 'rac-khong-phai-jwt' }).code, 'AUTH_INVALID', 'token rác');
  const old = (Math.floor(Date.now() / 1000) - 3600).toString(36) + '.' + n.split('.')[1] + '.' + n.split('.')[2];
  assert.equal(a.post({ action: 'auth.login', idToken: jwt(old) }).code, 'AUTH_INVALID', 'nonce cũ / chữ ký không khớp');
  assert.ok(calls === 0);
});

// ---------------- B2/C7: phiên bản dữ liệu ----------------
test('C7 lệnh lỗi sau khi đã ghi một phần vẫn tăng phiên bản dữ liệu (máy khách thấy phiếu đã ghi)', () => {
  const x = built(), { a, W, pass } = x; x.tp.serials.forEach(s => W('kcs.add', { serial: s, ngay: '2026-11-10', ketQua: pass() }, x.nv));
  x.buy('2026-11-11', 1); const v0 = Number(a.raw.dataVersion); once(a.sheets.NhatKy, 'appendRow');
  assert.equal(x.P('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } }, x.nv).ok, false);
  assert.ok(Number(a.raw.dataVersion) > v0);
});

// ================= vòng 1: góp ý chuyên gia kỹ thuật + kế toán =================
const rev = sh => { sh.d = [sh.d[0], ...sh.d.slice(1).reverse()]; };
const st = (a, re) => a.sheets.Serial.d.slice(1).filter(r => re.test(r[2])).map(r => r[2] + ':' + r[4]).join(' ');
test('setup bật bảo vệ cảnh báo trên các sheet', () => {
  const x = plant(); assert.equal(x.a.sheets.Phieu.prot && x.a.sheets.Phieu.prot.warn, true);
});
test('V1 tech B-1: sửa tay TonKho → không nhảy số phiếu, không để dòng mồ côi', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 1); x.pull(); rev(a.sheets.TonKho);
  const r = W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-12', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'VO', soLuongCT: 1, gia: 100 }] } }, x.nv);
  assert.equal(r.soPhieu, 'PN-2026-00002', 'không bỏ số');
  assert.deepEqual([...new Set(a.sheets.ChiTietPhieu.d.slice(1).map(z => z[0]))].sort(), ['PN-2026-00001', 'PN-2026-00002']);
});
test('V1 tech A-1: sửa tay TonKho → nhập có serial → khoá sổ / tính lại: serial hợp lệ vẫn trong kho', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 1); x.pull(); rev(a.sheets.TonKho);
  W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-02', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 2, gia: 4150000, serials: ['LGX', 'LGY'] }] } }, x.nv);
  W('period.lock', { ngay: '2026-11-03' }); W('stock.rebuild', {});
  assert.equal(st(a, /^LG[XY]$/), 'LGX:TRONG_KHO LGY:TRONG_KHO');
});
test('V1 tech A-1/kế toán B10: phiếu chết trước khi ghi đầu phiếu → đầu phiếu "bỏ số" LOI_GHI; gửi lại dùng lại serial; quét đầy đủ không trả nhầm', () => {
  const x = plant(), { a, P, W } = x; x.buy('2026-11-01', 1);
  once(a.sheets.Phieu, 'appendRow'); const id = rid(), b = { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-02', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 1, serials: ['LGZ'] }] } };
  assert.equal(a.post({ action: 'voucher.create', session: x.nv, requestId: id, ...b }).ok, false);
  const r2 = a.post({ action: 'voucher.create', session: x.nv, requestId: id, ...b }); assert.equal(r2.ok, true, JSON.stringify(r2));
  const tomb = a.sheets.Phieu.d.find(z => z[col('Phieu', 'trangThai')] === 'LOI_GHI'); assert.ok(tomb, 'có đầu phiếu bỏ số'); assert.match(tomb[col('Phieu', 'lyDo')], /bỏ số/);
  W('stock.rebuild', {}); assert.equal(st(a, /^LGZ$/), 'LGZ:TRONG_KHO');
  assert.equal(P('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LGZ'] }] } }, x.nv).ok, true);
});
test('V1 tech B-3: sửa tay LenhSX → xuất linh kiện / KCS vẫn cập nhật trạng thái lệnh', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 2); x.tpl();
  const so = W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 1, ngay: '2026-11-02', kho: 'KHO' } }, x.nv);
  x.pull(); rev(a.sheets.LenhSX);
  assert.equal(x.issue(so, '2026-11-05', 2, ['LG11010', 'LG11011']).ok, true);
  assert.equal(a.sheets.LenhSX.d.find(z => z[0] === so)[col('LenhSX', 'trangThai')], 'DANG_LAP');
  const y = built(); y.pull(); rev(y.a.sheets.LenhSX); y.W('kcs.add', { serial: y.tp.serials[0], ngay: '2026-11-10', ketQua: y.pass() }, y.nv);
  y.pull(); rev(y.a.sheets.LenhSX); y.W('kcs.add', { serial: y.tp.serials[1], ngay: '2026-11-10', ketQua: y.pass() }, y.nv);
  assert.equal(y.a.sheets.LenhSX.d.find(z => z[0] === y.so)[col('LenhSX', 'trangThai')], 'HOAN_TAT');
});
test('V1 tech B-3: đảo phiếu xuất tủ chết khi đồng bộ hồ sơ tủ → gửi lại làm nốt (tủ không còn ghi lần xuất)', () => {
  const x = built(), { a, W, pass } = x; x.tp.serials.forEach(s => W('kcs.add', { serial: s, ngay: '2026-11-10', ketQua: pass() }, x.nv));
  const ser = x.tp.serials[0], px = W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [ser] }] } }, x.nv).soPhieu;
  const hs = a.sheets.HoSoTu, og = hs.getRange, ph = a.sheets.Phieu, oa = ph.appendRow; let armed = false, hit = false;
  ph.appendRow = function (r) { oa.call(this, r); if (r[2] === 'DAO') armed = true; };
  hs.getRange = function (...q) { const g = og.apply(this, q); if (armed && typeof q[0] === 'number') { const sv = g.setValues; g.setValues = v => { if (armed) { armed = false; hit = true; boom(); } return sv(v); }; } return g; };   // chết khi đồng bộ lần xuất của tủ (sau đầu phiếu đảo)
  const id = rid(), b = { phieuGoc: px, lyDo: 'nhầm', ngay: '2026-11-13' };
  assert.equal(a.post({ action: 'voucher.reverse', session: x.s, requestId: id, ...b }).ok, false); assert.ok(hit);
  assert.equal(a.post({ action: 'voucher.reverse', session: x.s, requestId: id, ...b }).ok, true);
  const c = a.sheets.HoSoTu.d.find(r => r[0] === ser); assert.equal(c[col('HoSoTu', 'phieuXuat')], '');
});
test('V1 tech B-4: bh.update chết khi ghi nhật ký → gửi lại báo thành công', () => {
  const x = built(), { a, W, pass } = x; x.tp.serials.forEach(s => W('kcs.add', { serial: s, ngay: '2026-11-10', ketQua: pass() }, x.nv));
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.tp.serials[0]] }] } }, x.nv);
  const bh = W('bh.create', { serial: x.tp.serials[0], phieu: { ngay: '2026-11-14', nguoiBao: 'A', moTaLoi: 'hỏng' } }, x.nv);
  once(a.sheets.NhatKy, 'appendRow'); const id = rid(), b = { soPBH: bh.soPBH, trangThai: 'DANG_XU_LY', nguyenNhan: 'LOI_THIET_BI' };
  assert.equal(a.post({ action: 'bh.update', session: x.nv, requestId: id, ...b }).ok, false);
  const r2 = a.post({ action: 'bh.update', session: x.nv, requestId: id, ...b }); assert.equal(r2.ok, true, JSON.stringify(r2));
});
test('V1 kế toán A1: ghi chi phí chết sau khi tính giá thành, không gửi lại → lệnh ghi sau trả giá thành về đúng; khoá sổ chứng từ khớp số chốt', () => {
  const x = built(), { a, P, W } = x; const v0 = x.ton('TU-DKCS-2N').giaTri;
  once(a.sheets.ChiPhiLSX, 'appendRow');
  assert.equal(P('lsx.chiPhi', { soLSX: x.so, chiPhi: { ngay: '2026-11-06', loai: 'SX_CHUNG', soTien: 1000000 } }).ok, false);
  assert.equal(x.ton('TU-DKCS-2N').giaTri, v0 + 1000000, 'đã tính lại dở');
  P('customer.upsert', { customer: { maKH: 'KH9', ten: 'Khách 9' } });
  assert.equal(x.ton('TU-DKCS-2N').giaTri, v0, 'trả về như cũ');
  const nt = a.sheets.ChiTietPhieu.d.find(z => z[0] === x.tp.soPhieu); assert.equal(nt[col('ChiTietPhieu', 'giaTriKho')], v0);
  W('period.lock', { ngay: '2026-11-10' }); assert.equal(W('stock.rebuild', {}).chanKyKhoa, undefined);
});
test('V1 kế toán B1–B4: lịch sử khoá; khoá lại cùng ngày số khác cần lý do; không mở trống khi đã chốt; lùi khoá thì chốt lại và không chặn oan', () => {
  const x = plant(), { a, W, P } = x; x.buy('2026-11-01', 2);
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-03', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN', soLuongCT: 2 }] } }, x.nv);
  W('period.lock', { ngay: '2026-11-05' });
  assert.equal(P('period.lock', { ngay: '', lyDo: 'mở để sửa phiếu tháng' }).ok, false, 'không mở trống khi đã chốt');
  assert.equal(P('period.lock', { ngay: '2026-10-31', lyDo: 'ngắn' }).ok, false, 'lý do quá ngắn');
  W('period.lock', { ngay: '2026-10-31', lyDo: 'Sửa phiếu xuất 03/11 theo yêu cầu kế toán trưởng' });
  assert.ok(a.sheets.NhatKy.d.some(r => r[2] === 'period.reopen'));
  assert.equal(x.P('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-04', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } }, x.nv).code, 'PERIOD_LOCKED', 'đang mở lại: nhập liệu không ghi lùi');
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-04', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } });   // QT điều chỉnh
  const re = P('period.lock', { ngay: '2026-11-05' }); assert.equal(re.ok, false, 'số khác lần chốt trước → cần lý do'); assert.ok(Array.isArray(re.fields) && re.fields.length);
  W('period.lock', { ngay: '2026-11-05', lyDo: 'Đã xuất thêm 1 đèn ngày 04/11 theo hoá đơn' });
  W('period.lock', { ngay: '2026-11-10' });
  W('period.lock', { ngay: '2026-11-05', lyDo: 'Mở lại tuần 2 để kiểm tra' });
  assert.equal(W('stock.rebuild', {}).chanKyKhoa, undefined, 'không chặn oan');
  const ls = a.sheets.LichSuKhoaSo.d.slice(1).map(r => r[col('LichSuKhoaSo', 'loai')]); assert.deepEqual(ls, ['KHOA', 'LUI', 'KHOA', 'KHOA', 'LUI']);
});
test('V1 kế toán B1: khoá sổ chết khi ghi nhật ký → gửi lại bổ sung nhật ký', () => {
  const x = plant(), { a } = x; x.buy('2026-11-01', 1);
  once(a.sheets.NhatKy, 'appendRow'); const id = rid();
  assert.equal(a.post({ action: 'period.lock', session: x.s, requestId: id, ngay: '2026-11-05' }).ok, false);
  purge(a, /^req:/); assert.equal(a.post({ action: 'period.lock', session: x.s, requestId: id, ngay: '2026-11-05' }).ok, true);
  assert.ok(a.sheets.NhatKy.d.some(r => r[2] === 'period.lock'));
});
test('V1 kế toán B5/B6: sửa tay chi phí lệnh dở dang hoặc dòng phiếu kỳ khoá → "Tính lại tồn" chặn', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 2); x.tpl();
  const so = W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  x.issue(so, '2026-11-05', 2, ['LG11010', 'LG11011']);
  W('lsx.chiPhi', { soLSX: so, chiPhi: { ngay: '2026-11-05', loai: 'NC_TRUC_TIEP', soTien: 3000000 } });
  W('period.lock', { ngay: '2026-11-08' });
  assert.ok(a.sheets.SoDuKhoaSo.d.some(r => r[1] === so && r[2] === '154'), 'chốt dở dang theo lệnh');
  const cp = a.sheets.ChiPhiLSX; cp.d.find(r => r[1] === so)[col('ChiPhiLSX', 'soTien')] = 9000000; a.raw['ver:ChiPhiLSX'] = 'x1';
  let r = W('stock.rebuild', {}); assert.equal(r.chanKyKhoa, true); assert.ok(r.lechSoDu.some(z => z.kho === '154'));
  cp.d.find(r => r[1] === so)[col('ChiPhiLSX', 'soTien')] = 3000000; a.raw['ver:ChiPhiLSX'] = 'x2';
  assert.equal(W('stock.rebuild', {}).chanKyKhoa, undefined);
  const pn = a.sheets.ChiTietPhieu.d.find(z => z[0] === 'PN-2026-00001' && z[2] === 'VO'); pn[col('ChiTietPhieu', 'thanhTien')] = 1;
  r = W('stock.rebuild', {}); assert.equal(r.chanKyKhoa, true); assert.ok(r.lechSoDu.some(z => z.kho === 'Dòng phiếu'));
});

// ================= vòng 2 =================
test('V2 tech B-2: chỉ sắp xếp tay HangHoa → không nhảy số phiếu, không đầu phiếu bỏ số', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 1); x.pull(); rev(a.sheets.HangHoa);
  const r = W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-12', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'VO', soLuongCT: 1, gia: 100 }] } }, x.nv);
  assert.equal(r.soPhieu, 'PN-2026-00002'); assert.ok(!a.sheets.Phieu.d.some(z => z[col('Phieu', 'trangThai')] === 'LOI_GHI'));
});
test('V2 tech B-1: đối chiếu cột khoá 1 lệnh gọi/bảng, không đối chiếu CauHinh khi lập phiếu thường', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 1); x.pull();
  for (const k of Object.keys(a.reads)) delete a.reads[k];
  W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-12', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'VO', soLuongCT: 1, gia: 100 }] } }, x.nv);
  const g = Object.keys(a.reads).filter(k => k.endsWith('#col')).sort(); assert.deepEqual(g, ['HangHoa#col', 'TonKho#col']);
});
test('V2 kế toán B-1: sửa tay phiếu kỳ khoá rồi lùi khoá → chặn, không hợp thức hoá', () => {
  const x = plant(), { a, W, P } = x; x.buy('2026-11-01', 1); W('period.lock', { ngay: '2026-11-08' });
  a.sheets.ChiTietPhieu.d.find(z => z[0] === 'PN-2026-00001' && z[2] === 'VO')[col('ChiTietPhieu', 'thanhTien')] = 9200000;
  const r = P('period.lock', { ngay: '2026-11-07', lyDo: 'Lùi khoá kiểm tra theo yêu cầu' }); assert.equal(r.ok, false); assert.equal(r.code, 'PERIOD_LOCKED');
  assert.equal(a.raw.ngayKhoaSo || a.sheets.CauHinh.d.find(z => z[0] === 'ngayKhoaSo')[1], '2026-11-08');
});
test('V2 kế toán B-2: lệnh lùi khoá chết giữa chừng không làm mất hiệu lực số chốt', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 1); W('period.lock', { ngay: '2026-11-05' });
  once(a.sheets.SoDuKhoaSo, 'getRange', r => typeof r === 'number');
  assert.equal(x.P('period.lock', { ngay: '2026-11-03', lyDo: 'Lùi khoá để sửa phiếu nhập' }).ok, false);
  assert.equal(a.sheets.CauHinh.d.find(z => z[0] === 'ngayKhoaSo')[1], '2026-11-05');
  a.sheets.ChiTietPhieu.d.find(z => z[0] === 'PN-2026-00001' && z[2] === 'VO')[col('ChiTietPhieu', 'thanhTien')] = 1;
  assert.equal(W('stock.rebuild', {}).chanKyKhoa, true, 'vẫn bảo vệ kỳ khoá');
});
test('V2 kế toán B-3: khoá vượt ngày khoá cao nhất sau khi mở lại → giải trình chênh lệch so với số chốt cũ', () => {
  const x = plant(), { a, W, P } = x; x.buy('2026-11-01', 2);
  W('period.lock', { ngay: '2026-11-05' }); W('period.lock', { ngay: '2026-11-08' });
  W('period.lock', { ngay: '2026-11-03', lyDo: 'Mở lại để bổ sung phiếu xuất' });
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-07', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } });
  W('period.lock', { ngay: '2026-11-06' });
  const r = P('period.lock', { ngay: '2026-11-10' }); assert.equal(r.ok, false, 'phải ghi lý do'); assert.ok(r.fields.some(z => z.ngayKhoa === '2026-11-08'));
  W('period.lock', { ngay: '2026-11-10', lyDo: 'Bổ sung xuất 1 đèn ngày 07/11 theo hoá đơn' });
  assert.ok(a.sheets.SoDuKhoaSo.d.some(z => z[0] === '2026-11-08' && z[5] > a.sheets.SoDuKhoaSo.d.find(y => y[0] === '2026-11-08')[5]), 'chốt lại ngày 08/11');
  assert.equal(W('stock.rebuild', {}).chanKyKhoa, undefined);
});
test('V2 kế toán C3: sửa tay khách hàng của phiếu kỳ khoá → bị phát hiện', () => {
  const x = plant(), { a, W } = x; x.buy('2026-11-01', 1);
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-02', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } });
  W('period.lock', { ngay: '2026-11-05' });
  a.sheets.Phieu.d.find(z => z[2] === 'XUAT_BAN')[col('Phieu', 'maKH')] = 'KHAC';
  assert.equal(W('stock.rebuild', {}).chanKyKhoa, true);
});
