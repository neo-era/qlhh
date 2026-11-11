// TDD máy chủ sản xuất tủ (SX-1): Code.gs + Kho.gs + SanXuat.gs thật + lõi, trên Sheet giả lập. Viết TRƯỚC khi code.
const test = require('node:test'), assert = require('node:assert');
const { ready, rid } = require('./gas-mock.js');
const { NV, XEM, BOM, KCS, plant, built } = require('./sx-fixture.js');

test('setup: đủ sheet sản xuất; Phieu có cột soLSX, Serial có serialCha; sheet cũ thiếu cột được nối thêm tiêu đề', () => {
  const { a } = plant();
  for (const n of ['MauSanPham', 'LenhSX', 'ChiPhiLSX', 'HoSoTu', 'KiemTraXX', 'PhieuXuatXuong']) assert.ok(a.sheets[n], n);
  assert.equal(a.sheets.Phieu.d[0].at(-1), 'soLSX'); assert.equal(a.sheets.Serial.d[0].at(-1), 'serialCha');
  a.sheets.Phieu.d[0].pop(); a.setup(); assert.equal(a.sheets.Phieu.d[0].at(-1), 'soLSX');
});

test('mẫu tủ: chỉ Quản trị; thành phẩm phải quản lý serial; sửa mẫu → phiên bản mới, LSX cũ giữ phiên bản cũ', () => {
  const x = plant();
  assert.equal(x.P('template.upsert', { template: {} }, x.nv).code, 'FORBIDDEN');
  assert.equal(x.P('template.upsert', { template: { maMau: 'M', maHang: 'CB40', ten: 'x', bom: [{ maHang: 'VO', soLuong: 1 }], kcs: [{ noiDung: 'a' }] } }).code, 'VALIDATION', 'CB40 không quản lý serial');
  assert.equal(x.P('template.upsert', { template: { maMau: 'M', maHang: 'TU-DKCS-2N', ten: 'x', bom: [{ maHang: 'KHONGCO', soLuong: 1 }], kcs: [{ noiDung: 'a' }] } }).code, 'VALIDATION');
  assert.deepEqual(x.tpl(), { maMau: 'TU-2N', phienBan: 1 });
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 1, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  assert.match(so, /^LSX-2026-00001$/);
  assert.equal(x.tpl().phienBan, 2);
  const d = x.pull();
  assert.equal(d.data.lsx.find(l => l.soLSX === so).phienBan, 1);
  assert.deepEqual(d.data.templates.filter(t => t.maMau === 'TU-2N').map(t => t.phienBan), [2], 'chỉ gửi phiên bản mới nhất');
  assert.equal(JSON.parse(d.data.templates[0].bom).length, 9);
  for (const bad of [0, -1, 1.5, 501, 'a']) assert.equal(x.P('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: bad, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).code, 'VALIDATION', String(bad));
  assert.equal(x.P('lsx.create', { lsx: { maMau: 'KHONG', soLuong: 1, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).code, 'VALIDATION');
});

test('S1/KB-SX1: xuất linh kiện ×2 trừ đúng tồn, nhập 2 tủ có 2 xê-ri, giá thành 11.620.000/tủ, serial LOGO! thành serial con', () => {
  const x = built();
  assert.match(x.xs, /^XS-2026-00001$/); assert.match(x.tp.soPhieu, /^NT-2026-00001$/);
  assert.deepEqual(x.tp.serials, ['LV-TUDKCS2N-2026-0001', 'LV-TUDKCS2N-2026-0002']);
  assert.equal(x.ton('LOGO').soLuong, 0); assert.equal(x.ton('DEN').soLuong, 0);
  assert.deepEqual([x.ton('TU-DKCS-2N').soLuong, x.ton('TU-DKCS-2N').giaTri], [2, 23240000]);
  const g = x.W('sx.get', { soLSX: x.so });
  assert.equal(g.doDang, 0); assert.equal(g.lsx.trangThai, 'CHO_KIEM_TRA');
  assert.deepEqual(g.hoSoTu.map(h => [h.serial, h.giaThanh]), [['LV-TUDKCS2N-2026-0001', 11620000], ['LV-TUDKCS2N-2026-0002', 11620000]]);
  assert.deepEqual(g.hoSoTu.map(h => JSON.parse(h.serialCon)), [['SIEMENS|LG11010'], ['SIEMENS|LG11011']]);
  const sr = x.W('serial.get', { serial: 'lv-tudkcs2n-2026-0002' }, x.xem);
  assert.equal(sr.hoSo.soLSX, x.so); assert.equal(sr.giaThanh, undefined, 'người xem không thấy giá thành');
  assert.deepEqual(sr.con.map(c => [c.serial, c.trangThai]), [['LG11011', 'DA_LAP']]);
  const gn = x.W('sx.get', { soLSX: x.so }, x.nv);
  assert.equal(gn.doDang, undefined); assert.equal(gn.chiPhi, undefined); assert.equal(gn.hoSoTu[0].giaThanh, undefined);
  assert.ok(gn.phieu.every(p => p.tongTien === undefined));
  assert.equal(x.pull(x.nv).data.stock.find(t => t.maHang === 'TU-DKCS-2N').giaTri, undefined);
});

test('S2: thiếu tồn linh kiện → nêu mã thiếu; serial LOGO! không đủ → từ chối; đã nhập TP thì không xuất bổ sung, không nhập quá N', () => {
  const x = plant(); x.buy('2026-11-01', 1); x.tpl();
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  const r = x.issue(so, '2026-11-05', 2, ['LG11010', 'LG11010']);
  assert.equal(r.ok, false);
  const r2 = x.P('lsx.xuatSX', { soLSX: so, ngay: '2026-11-05', lines: [{ maHang: 'CB40', soLuongCT: 2 }] }, x.nv);
  assert.equal(r2.code, 'STOCK_NOT_ENOUGH'); assert.match(r2.error, /CB40/);
  assert.equal(x.P('lsx.xuatSX', { soLSX: so, ngay: '2026-11-05', lines: [{ maHang: 'LOGO', soLuongCT: 1 }] }, x.nv).code, 'VALIDATION');
  assert.equal(x.issue(so, '2026-11-05', 1, ['LG11010']).ok, true);
  assert.equal(x.P('lsx.nhapTP', { soLSX: so, ngay: '2026-11-06', soLuong: 3 }, x.nv).code, 'VALIDATION');
  assert.equal(x.W('lsx.nhapTP', { soLSX: so, ngay: '2026-11-06', soLuong: 1 }, x.nv).serials.length, 1);
  x.buy('2026-11-07', 1);
  assert.equal(x.issue(so, '2026-11-08', 1, ['LG11070']).code, 'VALIDATION');
  assert.equal(x.P('voucher.create', { voucher: { loai: 'XUAT_SX', ngay: '2026-11-08', kho: 'KHO', lines: [{ maHang: 'VO', soLuongCT: 1 }] } }).code, 'VALIDATION', 'không lập phiếu SX trực tiếp');
});

test('S3: tủ chưa KCS / KCS không đạt → không xuất bán được; kiểm lại đạt → bán được; giữ lịch sử 2 lần kiểm; giá vốn bán 11.620.000', () => {
  const x = built(), [t1, t2] = x.tp.serials;
  const sell = ser => x.P('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-09', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [ser] }] } }, x.nv);
  assert.match(sell(t1).error, /chưa đạt kiểm tra xuất xưởng/);
  const bad = x.pass(); bad[2] = { ketQua: 'KHONG_DAT' };
  assert.equal(x.P('kcs.add', { serial: t1, ngay: '2026-11-09', ketQua: bad }, x.nv).code, 'VALIDATION', 'không đạt phải ghi chú');
  bad[2].ghiChu = 'Cách điện 0,4 MΩ';
  assert.deepEqual(x.W('kcs.add', { serial: t1, ngay: '2026-11-09', ketQua: bad }, x.nv), { lanKiem: 1, dat: false });
  assert.match(sell(t1).error, /chưa đạt/);
  assert.deepEqual(x.W('kcs.add', { serial: t1, ngay: '2026-11-09', ketQua: x.pass() }, x.nv), { lanKiem: 2, dat: true });
  const ok = sell(t1); assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(x.W('voucher.get', { soPhieu: ok.data.soPhieu }).lines[0].giaTriKho, 11620000);
  const h = x.W('serial.get', { serial: t1 }, x.xem);
  assert.deepEqual(h.kcs.map(k => [k.lanKiem, k.dat]), [[1, false], [2, true]]);
  assert.equal(h.serial.trangThai, 'DA_BAN');
  assert.equal(x.P('kcs.add', { serial: t1, ngay: '2026-11-10', ketQua: x.pass() }, x.nv).code, 'VALIDATION', 'tủ đã bán không kiểm lại');
  assert.equal(x.P('kcs.add', { serial: t2, ngay: '2026-11-09', ketQua: x.pass() }, x.xem).code, 'FORBIDDEN');
  x.W('kcs.add', { serial: t2, ngay: '2026-11-09', ketQua: x.pass() }, x.nv);
  assert.equal(x.W('sx.get', { soLSX: x.so }).lsx.trangThai, 'HOAN_TAT');
});

test('KB-SX3 qua máy chủ: nhập LOGO! lùi ngày → giá thành tủ, giá vốn bán, tồn TP đều tính lại (11.395.000)', () => {
  const x = plant(); x.buy('2026-11-01', 2, ['LOGO']); x.tpl();
  x.W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-01', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 5, gia: 4000000, serials: ['A1', 'A2', 'A3', 'A4', 'A5'] }] } });
  x.W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-05', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 5, gia: 4300000, serials: ['B1', 'B2', 'B3', 'B4', 'B5'] }] } });
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-06', kho: 'KHO' } }, x.nv).soLSX;
  assert.equal(x.issue(so, '2026-11-06', 2, ['A1', 'A2']).ok, true);
  x.W('lsx.chiPhi', { soLSX: so, chiPhi: { ngay: '2026-11-06', loai: 'NC_TRUC_TIEP', soTien: 3000000 } });
  const tp = x.W('lsx.nhapTP', { soLSX: so, ngay: '2026-11-07', soLuong: 2 }, x.nv);
  tp.serials.forEach(t => x.W('kcs.add', { serial: t, ngay: '2026-11-07', ketQua: x.pass() }, x.nv));
  const sale = x.W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-08', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [tp.serials[0]] }] } });
  assert.equal(x.W('voucher.get', { soPhieu: sale.soPhieu }).lines[0].giaTriKho, 11620000);
  const back = x.W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-03', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 10, gia: 3700000, serials: Array.from({ length: 10 }, (_, i) => 'C' + i) }] } });
  assert.ok(back.tinhLai >= 3, 'XS LOGO + NT + PX: ' + back.tinhLai);
  assert.equal(x.W('voucher.get', { soPhieu: sale.soPhieu }).lines[0].giaTriKho, 11395000);
  assert.equal(x.W('voucher.get', { soPhieu: tp.soPhieu }).lines[0].giaTriKho, 22790000);
  assert.deepEqual([x.ton('TU-DKCS-2N').soLuong, x.ton('TU-DKCS-2N').giaTri], [1, 11395000]);
  assert.equal(x.W('sx.get', { soLSX: so }).hoSoTu[1].giaThanh, 11395000);
  const pv = x.a.sheets.Phieu.d.find(r => r[0] === sale.soPhieu); assert.equal(pv[16], 11395000, 'tổng tiền đầu phiếu bán theo giá vốn mới');
});

test('chi phí khác ghi sau khi nhập TP (cùng kỳ) → tính lại giá thành; chi phí sau ngày nhập tủ cuối → từ chối; người nhập liệu không ghi chi phí', () => {
  const x = built();
  assert.equal(x.P('lsx.chiPhi', { soLSX: x.so, chiPhi: { ngay: '2026-11-05', loai: 'NC_TRUC_TIEP', soTien: 1 } }, x.nv).code, 'FORBIDDEN');
  const r = x.W('lsx.chiPhi', { soLSX: x.so, chiPhi: { ngay: '2026-11-08', loai: 'GIA_CONG_NGOAI', soTien: 1000000, soCTGoc: 'HĐ 123' } });
  assert.equal(r.tinhLai, 1);
  assert.equal(x.ton('TU-DKCS-2N').giaTri, 24240000);
  assert.equal(x.P('lsx.chiPhi', { soLSX: x.so, chiPhi: { ngay: '2026-11-10', loai: 'NC_TRUC_TIEP', soTien: 5 } }).code, 'VALIDATION');
  for (const bad of [{ loai: 'VAN_CHUYEN', soTien: 1 }, { loai: 'NC_TRUC_TIEP', soTien: 0 }, { loai: 'NC_TRUC_TIEP', soTien: 1.5 }, { loai: 'NC_TRUC_TIEP', soTien: 2e12 }])
    assert.equal(x.P('lsx.chiPhi', { soLSX: x.so, chiPhi: { ngay: '2026-11-05', ...bad } }).code, 'VALIDATION', JSON.stringify(bad));
  x.W('period.lock', { ngay: '2026-11-08' });
  assert.equal(x.P('lsx.chiPhi', { soLSX: x.so, chiPhi: { ngay: '2026-11-08', loai: 'NC_TRUC_TIEP', soTien: 5 } }).code, 'PERIOD_LOCKED');
});

test('S4: phiếu xuất xưởng — chỉ tủ đạt KCS; số liên tục theo năm; 1 tủ chỉ thuộc 1 PXX còn hiệu lực; huỷ giữ số; chỉ QT huỷ', () => {
  const x = built(), [t1, t2] = x.tp.serials;
  const iss = (sers, who = x.nv) => x.P('pxx.issue', { pxx: { ngay: '2026-11-09', serials: sers, maKH: 'TN', maCongTrinh: 'PDG', diaDiem: 'Hẻm 20 Phan Đình Giót' } }, who);
  assert.match(iss([t1]).error, /chưa đạt/);
  [t1, t2].forEach(t => x.W('kcs.add', { serial: t, ngay: '2026-11-09', ketQua: x.pass() }, x.nv));
  const p1 = iss([t1]); assert.equal(p1.ok, true, JSON.stringify(p1)); assert.equal(p1.data.soPXX, '0001/2026/PXX-LAVIPCO');
  assert.match(iss([t1, t2]).error, /đã thuộc/);
  assert.equal(iss([t2], x.xem).code, 'FORBIDDEN');
  assert.equal(x.P('pxx.cancel', { soPXX: p1.data.soPXX, lyDo: 'In sai' }, x.nv).code, 'FORBIDDEN');
  assert.equal(x.P('pxx.cancel', { soPXX: p1.data.soPXX }).code, 'VALIDATION', 'bắt buộc lý do');
  x.W('pxx.cancel', { soPXX: p1.data.soPXX, lyDo: 'In sai địa điểm' });
  const p2 = iss([t1, t2]); assert.equal(p2.data.soPXX, '0002/2026/PXX-LAVIPCO');
  const d = x.pull(x.xem).data.pxx;
  assert.deepEqual(d.map(p => [p.soPXX, p.trangThai]), [['0001/2026/PXX-LAVIPCO', 'HUY'], ['0002/2026/PXX-LAVIPCO', 'PHAT_HANH']]);
  assert.equal(x.W('serial.get', { serial: t2 }).pxx.soPXX, '0002/2026/PXX-LAVIPCO');
});

test('KB-SX6 huỷ lệnh: nhập lại linh kiện còn (trừ phụ kiện đã dùng) theo giá xuất gốc, kết chuyển 350.000, dở dang 0, LOGO! về kho', () => {
  const x = plant(); x.buy('2026-11-01', 1); x.tpl();
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 1, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  const xs = x.issue(so, '2026-11-05', 1, ['LG11010']).data.soPhieu;
  assert.equal(x.P('lsx.huy', { soLSX: so, ngay: '2026-11-06', lyDo: 'Khách đổi thiết kế' }, x.nv).code, 'FORBIDDEN');
  assert.equal(x.P('lsx.huy', { soLSX: so, ngay: '2026-11-06' }).code, 'VALIDATION', 'bắt buộc lý do');
  const traLai = BOM.map(([m, q], i) => ({ phieuGoc: xs, dong: i + 1, soLuong: m === 'PK' ? 0 : q, serials: m === 'LOGO' ? ['LG11010'] : undefined }));
  const h = x.W('lsx.huy', { soLSX: so, ngay: '2026-11-06', lyDo: 'Khách đổi thiết kế', traLai });
  assert.equal(h.phieuNhapLai.length, 1); assert.match(h.phieuNhapLai[0], /^NL-2026-00001$/); assert.equal(h.ketChuyen, 350000);
  const g = x.W('sx.get', { soLSX: so });
  assert.equal(g.lsx.trangThai, 'HUY'); assert.equal(g.doDang, 0);
  assert.deepEqual(g.chiPhi.map(c => [c.loai, c.soTien]), [['KC_HUY', -350000]]);
  assert.equal(x.ton('LOGO').soLuong, 1); assert.equal(x.ton('PK').soLuong, 0); assert.equal(x.ton('VO').giaTri, 3200000);
  assert.equal(x.W('serial.get', { serial: 'LG11010' }).serial.trangThai, 'TRONG_KHO');
  assert.equal(x.issue(so, '2026-11-07', 1, ['LG11010']).code, 'VALIDATION', 'lệnh đã huỷ');
  const so2 = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 1, ngay: '2026-11-07', kho: 'KHO' } }, x.nv).soLSX;
  x.buy('2026-11-07', 1, ['LOGO']);
  assert.equal(x.issue(so2, '2026-11-07', 1, ['LG11010']).ok, true);
  x.W('lsx.nhapTP', { soLSX: so2, ngay: '2026-11-08', soLuong: 1 }, x.nv);
  assert.match(x.P('lsx.huy', { soLSX: so2, ngay: '2026-11-08', lyDo: 'x' }).error, /đã nhập thành phẩm/);
});

test('đảo phiếu nhập thành phẩm (tủ còn trong kho, chưa PXX) → hồ sơ tủ huỷ, dở dang trở lại; có PXX thì phải huỷ PXX trước', () => {
  const x = built(), [t1] = x.tp.serials;
  x.W('kcs.add', { serial: t1, ngay: '2026-11-09', ketQua: x.pass() }, x.nv);
  const p = x.W('pxx.issue', { pxx: { ngay: '2026-11-09', serials: [t1], maKH: 'TN' } }, x.nv);
  assert.match(x.P('voucher.reverse', { phieuGoc: x.tp.soPhieu, ngay: '2026-11-10', lyDo: 'Nhập nhầm' }).error, /PXX|xuất xưởng/);
  x.W('pxx.cancel', { soPXX: p.soPXX, lyDo: 'Đảo nhập' });
  x.W('voucher.reverse', { phieuGoc: x.tp.soPhieu, ngay: '2026-11-10', lyDo: 'Nhập nhầm' });
  const g = x.W('sx.get', { soLSX: x.so });
  assert.equal(g.doDang, 23240000); assert.equal(g.lsx.trangThai, 'DANG_LAP');
  assert.ok(g.hoSoTu.every(h => h.trangThai === 'HUY'));
  assert.equal(x.W('serial.get', { serial: 'LG11010' }).serial.trangThai, 'DA_LAP');
  const tp2 = x.W('lsx.nhapTP', { soLSX: x.so, ngay: '2026-11-10', soLuong: 2 }, x.nv);
  assert.deepEqual(tp2.serials, ['LV-TUDKCS2N-2026-0003', 'LV-TUDKCS2N-2026-0004']);
  assert.deepEqual(x.W('sx.get', { soLSX: x.so }).hoSoTu.filter(h => h.trangThai !== 'HUY').map(h => JSON.parse(h.serialCon)), [['SIEMENS|LG11010'], ['SIEMENS|LG11011']]);
});

test('gửi lại cùng requestId (mất mạng) → không nhập TP / không cấp PXX lần 2', () => {
  const x = plant(); x.buy('2026-11-01', 2); x.tpl();
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  x.issue(so, '2026-11-05', 2, ['LG11010', 'LG11011']);
  const id = rid(), q = { action: 'lsx.nhapTP', session: x.nv, requestId: id, soLSX: so, ngay: '2026-11-09', soLuong: 1 };
  const r1 = x.a.post(q), r2 = x.a.post(q);
  assert.deepEqual(r1.data.serials, r2.data.serials);
  assert.equal(x.a.sheets.Phieu.d.filter(r => r[2] === 'NHAP_TP').length, 1);
  assert.equal(x.a.sheets.HoSoTu.d.length, 2);
});

// ---------- hồi quy theo 2 chuyên gia vòng 1 ----------
function dieAfterHead(a) {   // chết NGAY SAU khi ghi đầu phiếu (lần đọc Phieu kế tiếp ném lỗi)
  const ph = a.sheets.Phieu, orig = ph.appendRow, og = ph.getDataRange;
  ph.appendRow = function (r) { orig.call(this, r); ph.appendRow = orig; ph.getDataRange = function () { ph.getDataRange = og; throw new Error('chết sau đầu phiếu'); }; };
}
const clearCache = a => { for (const k of Object.keys(a.cache.d || a.cache)) if (/done|req:|pending/.test(k)) delete (a.cache.d || a.cache)[k]; };
const cnt = (a, loai) => a.sheets.Phieu.d.filter(r => r[2] === loai).length;

test('KT-A1 chết sau đầu phiếu rồi gửi lại cùng requestId (bộ đệm mất) → không ghi phiếu thứ 2 (nhập TP, xuất linh kiện)', () => {
  const x = plant(); x.buy('2026-11-01', 4); x.tpl();
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 4, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  const bx = { action: 'lsx.xuatSX', session: x.nv, requestId: rid(), soLSX: so, ngay: '2026-11-05', lines: BOM.map(([m, q]) => ({ maHang: m, soLuongCT: q * 4, serials: m === 'LOGO' ? ['LG11010', 'LG11011', 'LG11012', 'LG11013'] : undefined })) };
  dieAfterHead(x.a); assert.equal(x.a.post(bx).ok, false); clearCache(x.a);
  const r2 = x.a.post(bx); assert.equal(r2.ok, true, JSON.stringify(r2)); assert.equal(cnt(x.a, 'XUAT_SX'), 1); assert.equal(x.ton('VO').soLuong, 0);
  const bn = { action: 'lsx.nhapTP', session: x.nv, requestId: rid(), soLSX: so, ngay: '2026-11-09', soLuong: 2 };
  dieAfterHead(x.a); assert.equal(x.a.post(bn).ok, false); clearCache(x.a);
  const r3 = x.a.post(bn); assert.equal(r3.ok, true, JSON.stringify(r3)); assert.equal(r3.data.serials.length, 2);
  assert.equal(cnt(x.a, 'NHAP_TP'), 1); assert.equal(x.ton('TU-DKCS-2N').soLuong, 2); assert.equal(x.a.sheets.HoSoTu.d.length - 1, 2);
});

test('KT-A2 phát hành PXX chết khi gắn tủ, gửi lại → chỉ 1 PXX còn hiệu lực; dòng PXX ghi cuối', () => {
  const x = built(), [t1] = x.tp.serials;
  x.W('kcs.add', { serial: t1, ngay: '2026-11-09', ketQua: x.pass() }, x.nv);
  const hs = x.a.sheets.HoSoTu, og = hs.getRange; hs.getRange = function () { hs.getRange = og; throw new Error('chết khi ghi HoSoTu'); };
  const body = { action: 'pxx.issue', session: x.nv, requestId: rid(), pxx: { ngay: '2026-11-09', serials: [t1] } };
  assert.equal(x.a.post(body).ok, false); assert.equal(x.a.sheets.PhieuXuatXuong.d.length, 1, 'chưa có dòng PXX');
  const r = x.a.post(body); assert.equal(r.ok, true); assert.equal(r.data.soPXX, '0001/2026/PXX-LAVIPCO');
  assert.equal(x.a.sheets.PhieuXuatXuong.d.length, 2);
});

test('KT-A3 trả lại trùng dòng gốc trong 1 lệnh huỷ → từ chối, không tồn ảo', () => {
  const x = plant(); x.buy('2026-11-01', 1); x.tpl();
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 1, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  const xs = x.issue(so, '2026-11-05', 1, ['LG11010']).data.soPhieu;
  assert.equal(x.P('lsx.huy', { soLSX: so, ngay: '2026-11-06', lyDo: 'x', traLai: [{ phieuGoc: xs, dong: 1, soLuong: 1 }, { phieuGoc: xs, dong: 1, soLuong: 1 }] }).code, 'VALIDATION');
  assert.equal(x.ton('VO').soLuong, 0);
  assert.equal(x.P('lsx.huy', { soLSX: so, ngay: '2026-11-06', lyDo: 'x', traLai: [{ phieuGoc: xs, dong: 1, soLuong: 1 }, { phieuGoc: xs, dong: 4, soLuong: 1, serials: ['LG11099'] }] }).ok, false, 'serial sai → không ghi phiếu nào');
  assert.equal(cnt(x.a, 'NHAP_LAI_SX'), 0, 'kiểm toàn bộ kế hoạch trước khi ghi');
});

test('KT-A4 mất bộ đệm "đang ghi" sau khi nhập TP chết trước đầu phiếu → Tính lại tồn dọn tủ ma; tủ ma không KCS/PXX/bán được', () => {
  const x = plant(); x.buy('2026-11-01', 2); x.tpl();
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  x.issue(so, '2026-11-05', 2, ['LG11010', 'LG11011']);
  const ph = x.a.sheets.Phieu, orig = ph.appendRow; ph.appendRow = function () { ph.appendRow = orig; throw new Error('chết trước đầu phiếu'); };
  assert.equal(x.P('lsx.nhapTP', { soLSX: so, ngay: '2026-11-09', soLuong: 2 }, x.nv).ok, false);
  clearCache(x.a);
  const ghost = x.a.sheets.HoSoTu.d[1][0];
  assert.equal(x.P('kcs.add', { serial: ghost, ngay: '2026-11-09', ketQua: x.pass() }, x.nv).code, 'VALIDATION', 'tủ ma không KCS được');
  x.W('stock.rebuild', {});
  assert.ok(x.a.sheets.HoSoTu.d.slice(1).every(r => r[15] === 'HUY'), 'hồ sơ tủ ma → HUY');
  const tp = x.W('lsx.nhapTP', { soLSX: so, ngay: '2026-11-09', soLuong: 2 }, x.nv);
  assert.deepEqual(x.W('sx.get', { soLSX: so }).hoSoTu.filter(h => h.trangThai !== 'HUY').map(h => JSON.parse(h.serialCon)), [['SIEMENS|LG11010'], ['SIEMENS|LG11011']]);
  assert.equal(x.ton('TU-DKCS-2N').soLuong, 2); assert.equal(tp.serials.length, 2);
  x.W('stock.rebuild', {});
  assert.equal(x.W('serial.get', { serial: 'LG11010' }).cha.serial, tp.serials[0], 'Tính lại tồn lần nữa không gỡ serial con khỏi tủ thật');
});

test('KT-B5 KCS khi mẫu không có mục kiểm tra → từ chối (không thành ĐẠT với 0 mục)', () => {
  const x = built(), t = x.tp.serials[0];
  x.a.sheets.MauSanPham.d.slice(1).forEach(r => { r[QSchemaCols('MauSanPham').indexOf('kcs')] = '[]'; });
  for (const k of Object.keys(x.a.raw)) if (k.startsWith('ver:')) x.a.raw[k] = 'x' + Math.random();
  assert.equal(x.P('kcs.add', { serial: t, ngay: '2026-11-09', ketQua: [] }, x.nv).code, 'VALIDATION');
});
function QSchemaCols(n) { return require('../core/schema.js').SHEETS[n].cols; }

test('KT-A2 kế toán: lệnh đã huỷ — nhập lùi ngày phụ kiện làm đổi giá xuất → kết chuyển tự cân, dở dang vẫn 0', () => {
  const x = plant(); x.buy('2026-11-01', 1); x.tpl();
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 1, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  const xs = x.issue(so, '2026-11-05', 1, ['LG11010']).data.soPhieu;
  const traLai = BOM.map(([m, q], i) => ({ phieuGoc: xs, dong: i + 1, soLuong: m === 'PK' ? 0 : q, serials: m === 'LOGO' ? ['LG11010'] : undefined }));
  assert.equal(x.W('lsx.huy', { soLSX: so, ngay: '2026-11-06', lyDo: 'Đổi thiết kế', traLai }).ketChuyen, 350000);
  x.W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-03', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'PK', soLuongCT: 2, gia: 500000 }] } });
  const g = x.W('sx.get', { soLSX: so });
  assert.equal(g.doDang, 0); assert.deepEqual(g.chiPhi.map(c => [c.loai, c.soTien]), [['KC_HUY', -450000]]);
  assert.ok(x.a.sheets.NhatKy.d.some(r => r[2] === 'lsx.ketChuyenDoi' && /-350000/.test(r[5]) && /-450000/.test(r[6])), 'nhật ký ghi điều chỉnh kết chuyển cũ → mới');
});

test('KT-B2 huỷ dòng chi phí ghi sai → giá thành tính lại; báo cáo dở dang theo kỳ (QT)', () => {
  const x = built();
  const cp = x.W('sx.get', { soLSX: x.so }).chiPhi[0].id;
  assert.equal(x.P('lsx.chiPhiHuy', { id: cp, lyDo: 'nhập sai' }, x.nv).code, 'FORBIDDEN');
  assert.equal(x.W('lsx.chiPhiHuy', { id: cp, lyDo: 'Ghi nhầm lệnh' }).tinhLai, 1);
  assert.equal(x.ton('TU-DKCS-2N').giaTri, 20240000);
  assert.equal(x.P('lsx.chiPhiHuy', { id: cp, lyDo: 'lần 2' }).code, 'VALIDATION');
  const w = x.W('report.wip', { from: '2026-11-01', to: '2026-11-30' }).rows.find(r => r.soLSX === x.so);
  assert.deepEqual([w.dauKy, w.linhKien, w.cp.NC_TRUC_TIEP, w.nhapTP, w.cuoiKy], [0, 20240000, 0, 20240000, 0]);
  assert.equal(x.P('report.wip', { from: '2026-11-01', to: '2026-11-30' }, x.nv).code, 'FORBIDDEN');
});

test('KT-B vòng 2: nhập lại TRƯỚC khi Tính lại tồn → dọn tủ ma không gỡ LOGO! khỏi tủ thật', () => {
  const x = plant(); x.buy('2026-11-01', 2); x.tpl();
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-02', kho: 'KHO' } }, x.nv).soLSX;
  x.issue(so, '2026-11-05', 2, ['LG11010', 'LG11011']);
  const ph = x.a.sheets.Phieu, orig = ph.appendRow; ph.appendRow = function () { ph.appendRow = orig; throw new Error('chết trước đầu phiếu'); };
  assert.equal(x.P('lsx.nhapTP', { soLSX: so, ngay: '2026-11-09', soLuong: 2 }, x.nv).ok, false);
  clearCache(x.a);
  const tp = x.W('lsx.nhapTP', { soLSX: so, ngay: '2026-11-09', soLuong: 2 }, x.nv);
  x.W('stock.rebuild', {});
  assert.equal(x.W('serial.get', { serial: 'LG11010' }).cha.serial, tp.serials[0]);
  assert.equal(x.W('serial.get', { serial: 'LG11011' }).cha.serial, tp.serials[1]);
});
