// TDD sản xuất tủ (SX-1) — viết TRƯỚC khi code. Số liệu KB-SX do chuyên gia kế toán giá thành tự tính (§14.4).
const test = require('node:test'), assert = require('node:assert');
const K = require('../core/stock.js'), X = require('../core/sx.js');

let stt = 0;
const P = (loai, ngay, kho, lines, x = {}) => ({ soPhieu: x.soPhieu || loai + '-' + (++stt), stt: x.stt || stt, loai, ngay, kho, trangThai: 'HOAN_TAT', ...x, lines: lines.map((l, i) => ({ dong: i + 1, ...l })) });
// BOM 1 tủ theo PXX Phan Đình Giót, đơn giá chuyên gia đặt
const BOM = [['VO', 1, 3200000], ['CB40', 1, 450000], ['CB6', 1, 180000], ['LOGO', 1, 4150000], ['CONT', 2, 620000], ['DEN', 5, 45000], ['CT', 1, 160000], ['DOM', 3, 55000], ['PK', 1, 350000]];
const nhapBom = (ngay, n, skip = []) => P('NHAP_MUA', ngay, 'K', BOM.filter(b => !skip.includes(b[0])).map(([m, q, g]) => ({ maHang: m, soLuong: q * n, donGia: g })));
const xuatSX = (ngay, lsx, n) => P('XUAT_SX', ngay, 'K', BOM.map(([m, q]) => ({ maHang: m, soLuong: q * n })), { soLSX: lsx });
const nhapTP = (ngay, lsx, k) => P('NHAP_TP', ngay, 'K', [{ maHang: 'TU', soLuong: k }], { soLSX: lsx });
const v = (r, p, d = 1) => r.lines[p.soPhieu + '#' + d];

test('KB-SX1 BOM PXX: linh kiện 10.120.000/tủ; LSX 2 tủ + nhân công 3.000.000 → 11.620.000/tủ; dở dang về 0', () => {
  const opts = { lsx: { L1: { n: 2, chiPhi: [{ ngay: '2026-11-05', soTien: 3000000 }] } } };
  const vs = [nhapBom('2026-11-01', 2), xuatSX('2026-11-05', 'L1', 2), nhapTP('2026-11-09', 'L1', 2)];
  const r = K.replay(vs, opts);
  assert.deepEqual(r.errors, []);
  assert.equal(BOM.reduce((a, b) => a + b[1] * b[2], 0), 10120000);
  assert.equal(v(r, vs[2]), 23240000);
  assert.deepEqual(X.split(23240000, 2), [11620000, 11620000]);
  assert.deepEqual([r.ton.TU.pool.q, r.ton.TU.pool.v], [2, 23240000]);
  assert.equal(X.balance(r.lsx.L1, opts.lsx.L1, '2026-11-30'), 0);
});

test('KB-SX2 chia đều có số lẻ: 10.000.000 / 3 tủ → 3.333.333 / 3.333.333 / 3.333.334 (tủ cuối nhận phần lẻ)', () => {
  assert.deepEqual(X.split(10000000, 3), [3333333, 3333333, 3333334]);
  assert.deepEqual(X.split(0, 2), [0, 0]);
  const opts = { lsx: { L2: { n: 3, chiPhi: [{ ngay: '2026-11-01', soTien: 10000000 }] } } };
  const t = nhapTP('2026-11-02', 'L2', 3), r = K.replay([t], opts);
  assert.equal(v(r, t), 10000000);
});

test('KB-SX3 lan tính lại: nhập LOGO lùi ngày → giá thành 11.395.000/tủ, giá vốn bán 11.395.000, tồn TP 11.395.000', () => {
  const opts = { lsx: { L3: { n: 2, chiPhi: [{ ngay: '2026-11-06', soTien: 3000000 }] } } };
  const base = [nhapBom('2026-11-01', 2, ['LOGO']), P('NHAP_MUA', '2026-11-01', 'K', [{ maHang: 'LOGO', soLuong: 5, donGia: 4000000 }]),
    P('NHAP_MUA', '2026-11-05', 'K', [{ maHang: 'LOGO', soLuong: 5, donGia: 4300000 }]), xuatSX('2026-11-06', 'L3', 2), nhapTP('2026-11-07', 'L3', 2),
    P('XUAT_BAN', '2026-11-08', 'K', [{ maHang: 'TU', soLuong: 1 }])];
  const r0 = K.replay(base, opts);
  assert.equal(v(r0, base[4]), 23240000); assert.equal(v(r0, base[5]), 11620000);
  base.forEach(p => p.lines.forEach(l => { l.giaTriKho = r0.lines[p.soPhieu + '#' + l.dong]; }));
  const c = K.check(base, P('NHAP_MUA', '2026-11-03', 'K', [{ maHang: 'LOGO', soLuong: 10, donGia: 3700000 }]), opts);
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(v(c.result, base[4]), 22790000);
  assert.equal(v(c.result, base[5]), 11395000);
  assert.deepEqual([c.result.ton.TU.pool.q, c.result.ton.TU.pool.v], [1, 11395000]);
  const ch = Object.fromEntries(c.changes.map(x => [x.soPhieu + '#' + x.dong, x.new]));
  assert.equal(ch[base[4].soPhieu + '#1'], 22790000, 'phiếu nhập thành phẩm nằm trong danh sách dòng bị tính lại');
  assert.equal(ch[base[5].soPhieu + '#1'], 11395000, 'phiếu bán tủ cũng được tính lại');
});

test('KB-SX4 dở dang cuối kỳ: LSX 3 tủ, nhập 2 tủ tháng 10 → dở dang 31/10 = 11.620.000; nhập nốt tủ 3 tháng 11 → 0', () => {
  const opts = { lsx: { L4: { n: 3, chiPhi: [{ ngay: '2026-10-05', soTien: 4500000 }] } } };
  const vs = [nhapBom('2026-10-01', 3), xuatSX('2026-10-05', 'L4', 3), nhapTP('2026-10-20', 'L4', 2), nhapTP('2026-11-03', 'L4', 1)];
  const r = K.replay(vs, opts);
  assert.equal(v(r, vs[2]), 23240000); assert.equal(v(r, vs[3]), 11620000);
  assert.equal(X.wip(vs, opts, '2026-10-31').L4, 11620000);
  assert.equal(X.wip(vs, opts, '2026-11-30').L4, 0);
});

test('KB-SX6 huỷ LSX: đã xuất 10.120.000, phụ kiện 350.000 đã dùng → nhập lại 9.770.000; kết chuyển chi phí 350.000 → dở dang 0', () => {
  const opts = { lsx: { L6: { n: 1, chiPhi: [] } } };
  const xs = xuatSX('2026-11-05', 'L6', 1);
  const vs = [nhapBom('2026-11-01', 1), xs];
  const back = P('NHAP_LAI_SX', '2026-11-06', 'K', BOM.filter(b => b[0] !== 'PK').map(([m, q]) => ({ maHang: m, soLuong: q, dongGoc: BOM.findIndex(b => b[0] === m) + 1 })), { soLSX: 'L6', phieuGoc: xs.soPhieu });
  const c = K.check(vs, back, opts);
  assert.equal(c.ok, true, JSON.stringify(c));
  const nl = back.lines.reduce((a, l) => a + c.result.lines[back.soPhieu + '#' + l.dong], 0);
  assert.equal(nl, 9770000);
  assert.equal(X.balance(c.result.lsx.L6, opts.lsx.L6, '2026-11-30'), 350000);
  opts.lsx.L6.chiPhi.push({ ngay: '2026-11-06', soTien: -350000, loai: 'KC_HUY' });
  assert.equal(X.wip([...vs, back], opts, '2026-11-30').L6, 0);
});

test('ràng buộc sổ: nhập TP vượt số tủ còn lại / nhập lại vượt số đã xuất / nhập lại không phải phiếu xuất SX cùng lệnh → từ chối', () => {
  const opts = { lsx: { L7: { n: 2, chiPhi: [] } } };
  const xs = xuatSX('2026-11-05', 'L7', 2), vs = [nhapBom('2026-11-01', 2), xs];
  assert.equal(K.check(vs, nhapTP('2026-11-06', 'L7', 3), opts).code, 'VALIDATION');
  assert.equal(K.check([...vs, nhapTP('2026-11-06', 'L7', 2)], nhapTP('2026-11-07', 'L7', 1), opts).code, 'VALIDATION');
  assert.equal(K.check(vs, P('NHAP_LAI_SX', '2026-11-06', 'K', [{ maHang: 'VO', soLuong: 3, dongGoc: 1 }], { soLSX: 'L7', phieuGoc: xs.soPhieu }), opts).code, 'VALIDATION');
  const other = P('NHAP_MUA', '2026-11-01', 'K', [{ maHang: 'VO', soLuong: 1, donGia: 1 }]);
  assert.equal(K.check([...vs, other], P('NHAP_LAI_SX', '2026-11-06', 'K', [{ maHang: 'VO', soLuong: 1, dongGoc: 1 }], { soLSX: 'L7', phieuGoc: other.soPhieu }), opts).code, 'VALIDATION');
  assert.equal(K.check(vs, P('XUAT_SX', '2026-11-06', 'K', [{ maHang: 'VO', soLuong: 1 }]), opts).code, 'VALIDATION', 'xuất SX phải gắn lệnh');
  assert.equal(K.check(vs, nhapTP('2026-11-04', 'L7', 1), opts).code, 'VALIDATION', 'nhập TP không trước lần xuất SX cuối');
  assert.equal(K.check([...vs, nhapTP('2026-11-06', 'L7', 1)], xuatSX('2026-11-07', 'L7', 1), opts).code, 'VALIDATION', 'đã nhập TP thì không xuất bổ sung');
});

test('đảo phiếu nhập thành phẩm (tủ còn trong kho) → trả lại dở dang; đảo phiếu xuất SX khi chưa nhập TP → trả linh kiện', () => {
  const opts = { lsx: { L8: { n: 2, chiPhi: [] } } };
  const xs = xuatSX('2026-11-05', 'L8', 2), tp = nhapTP('2026-11-06', 'L8', 1), vs = [nhapBom('2026-11-01', 2), xs, tp];
  const c = K.check(vs, P('DAO', '2026-11-07', 'K', [], { phieuGoc: tp.soPhieu }), opts);
  assert.equal(c.ok, true, JSON.stringify(c)); assert.equal(X.balance(c.result.lsx.L8, opts.lsx.L8, '2026-11-30'), 20240000);
  const c2 = K.check([nhapBom('2026-11-01', 2), xs], P('DAO', '2026-11-07', 'K', [], { phieuGoc: xs.soPhieu }), opts);
  assert.equal(c2.ok, true); assert.equal(X.balance(c2.result.lsx.L8, opts.lsx.L8, '2026-11-30'), 0); assert.equal(c2.result.ton.LOGO.pool.q, 2);
});

test('số xê-ri tủ, số phiếu xuất xưởng, phân serial con cho từng tủ', () => {
  assert.equal(X.serialNo('DAICHAU', 'TU-DKCS-2N/LOGO', 2026, 7), 'DC-TUDKCS2NLO-2026-0007');
  assert.equal(X.serialNo('LAVIPCO', 'TU', 2026, 12345), 'LV-TU-2026-12345');
  assert.equal(X.pxxNo(41, 2026, 'DAICHAU'), '0041/2026/PXX-DAICHAU');
  const a = X.assignChildren({ LOGO: ['S1', 'S2'], IOT: ['I1', 'I2', 'I3', 'I4'] }, [{ maHang: 'LOGO', soLuong: 1 }, { maHang: 'IOT', soLuong: 2 }, { maHang: 'VO', soLuong: 1 }], 2);
  assert.deepEqual(a, [['S1', 'I1', 'I2'], ['S2', 'I3', 'I4']]);
  assert.deepEqual(X.planIssue([{ maHang: 'A', soLuong: 2 }, { maHang: 'B', soLuong: 0.5 }], 3), [{ maHang: 'A', soLuong: 6 }, { maHang: 'B', soLuong: 1.5 }]);
});

test('kiểm tra xuất xưởng: đủ mục, "Không đạt" bắt buộc ghi chú, đạt khi mọi mục đạt', () => {
  const items = [{ stt: 1, noiDung: 'Ngoại quan' }, { stt: 2, noiDung: 'Chạy thử' }];
  assert.deepEqual(X.kcs(items, [{ ketQua: 'DAT' }, { ketQua: 'DAT' }]), { ok: true, dat: true, errors: [], soDat: 2 });
  const r = X.kcs(items, [{ ketQua: 'DAT' }, { ketQua: 'KHONG_DAT', ghiChu: 'K2 không đóng' }]);
  assert.equal(r.ok, true); assert.equal(r.dat, false); assert.equal(r.soDat, 1);
  assert.equal(X.kcs(items, [{ ketQua: 'DAT' }, { ketQua: 'KHONG_DAT' }]).ok, false, 'thiếu ghi chú');
  assert.equal(X.kcs(items, [{ ketQua: 'DAT' }]).ok, false, 'thiếu mục');
  assert.equal(X.kcs(items, [{ ketQua: 'DAT' }, { ketQua: 'X' }]).ok, false);
});

test('mẫu tủ: kiểm định mức + mục kiểm tra; không chứa chính thành phẩm; chuẩn hoá', () => {
  const ok = X.validateTemplate({ maMau: 'tu-2n', maHang: 'tu', ten: 'Tủ ĐKCS 2 nhánh', kichThuoc: '775x478x324', thangBH: '12',
    bom: [{ maHang: 'logo', soLuong: '1' }, { maHang: 'cont', soLuong: 2 }], kcs: [{ noiDung: 'Ngoại quan', yeuCau: 'Đúng bản vẽ' }] });
  assert.equal(ok.ok, true, JSON.stringify(ok)); assert.equal(ok.value.maMau, 'TU-2N'); assert.equal(ok.value.bom[0].maHang, 'LOGO'); assert.equal(ok.value.thangBH, 12);
  const e = X.validateTemplate({ maMau: 'M', maHang: 'TU', ten: 'x', thangBH: 200, bom: [{ maHang: 'TU', soLuong: 1 }, { maHang: 'A', soLuong: 0 }, { maHang: 'B', soLuong: 1 }, { maHang: 'B', soLuong: 1 }], kcs: [] });
  assert.equal(e.ok, false); assert.ok(e.errors.thangBH && e.errors.kcs && e.errors['bom.1'] && e.errors['bom.2'] && e.errors['bom.4']);
});
