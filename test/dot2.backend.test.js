// TDD đợt 2 (máy chủ): khách ↔ công trình, lọc phiếu theo tháng, thông báo serial tiếng Việt.
const test = require('node:test'), assert = require('node:assert');
const { plant, built } = require('./sx-fixture.js');

function kh2(x) { x.W('customer.upsert', { isNew: true, customer: { maKH: 'KH2', ten: 'Khách 2' } }); x.W('project.upsert', { isNew: true, project: { maCongTrinh: 'CT2', ten: 'CT của KH2', maKH: 'KH2' } }); x.W('project.upsert', { isNew: true, project: { maCongTrinh: 'CTCHUNG', ten: 'CT chưa gắn khách' } }); }

test('A3/A8 công trình phải thuộc khách đã chọn: phiếu xuất, lệnh SX, bàn giao, PXX', () => {
  const x = built(), { P, W, pass } = x; kh2(x); x.buy('2026-11-10', 1);
  const r = P('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'CT2', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } }, x.nv);
  assert.equal(r.ok, false); assert.match(r.error, /thuộc khách KH2/); assert.ok(r.fields.maCongTrinh);
  assert.equal(P('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'CTCHUNG', lines: [{ maHang: 'DEN', soLuongCT: 1 }] } }, x.nv).ok, true, 'công trình chưa gắn khách: không ràng buộc');
  assert.equal(P('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 1, ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'CT2' } }, x.nv).ok, false);
  x.tp.serials.forEach(s => W('kcs.add', { serial: s, ngay: '2026-11-10', ketQua: pass() }, x.nv));
  assert.equal(P('pxx.issue', { pxx: { ngay: '2026-11-12', serials: [x.tp.serials[0]], maKH: 'TN', maCongTrinh: 'CT2' } }, x.nv).ok, false);
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.tp.serials[0]] }] } }, x.nv);
  assert.equal(P('install.add', { serial: x.tp.serials[0], lapDat: { loai: 'BAN_GIAO', ngay: '2026-11-13', maKH: 'TN', maCongTrinh: 'CT2', diaChi: 'x' } }, x.nv).ok, false);
  assert.equal(P('install.add', { serial: x.tp.serials[0], lapDat: { loai: 'BAN_GIAO', ngay: '2026-11-13', maKH: 'TN', maCongTrinh: 'PDG', diaChi: 'x' } }, x.nv).ok, true);
});
test('B8 voucher.list: đầu phiếu một tháng (kể cả ngoài 500 phiếu gần nhất), ẩn giá với nhập liệu', () => {
  const x = plant(), { P } = x; x.buy('2026-10-05', 1); x.buy('2026-11-01', 1);
  const r = P('voucher.list', { thang: '2026-10' }, x.nv); assert.equal(r.ok, true);
  assert.deepEqual(r.data.vouchers.map(v => v.ngay), ['2026-10-05']); assert.equal(r.data.vouchers[0].tongTien, undefined, 'nhập liệu không thấy tổng tiền');
  assert.ok(P('voucher.list', { thang: '2026-10' }).data.vouchers[0].tongTien > 0, 'quản trị thấy');
  assert.equal(P('voucher.list', { thang: '10/2026' }, x.nv).ok, false);
});
test('B10 thông báo serial bằng tiếng Việt, không lộ mã trạng thái', () => {
  const x = plant(), { P, W } = x; x.buy('2026-11-01', 2);
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-02', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] } }, x.nv);
  const r = P('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-03', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] } }, x.nv);
  assert.equal(r.ok, false); const msg = JSON.stringify(r); assert.ok(!/DA_BAN|TRONG_KHO/.test(msg), msg); assert.match(msg, /đã bán/);
});

// ================= vòng 1 =================
function sold(o = {}) {
  const x = built(), [t1, t2] = x.tp.serials;
  [t1, t2].forEach(t => x.W('kcs.add', { serial: t, ngay: '2026-11-09', ketQua: x.pass() }, x.nv));
  kh2(x);
  const px = x.W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-09', kho: 'KHO', maKH: o.kh || 'TN', maCongTrinh: o.kh ? 'CT2' : 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [t1] }] } }, x.nv);
  x.W('install.add', { serial: t1, lapDat: { loai: 'BAN_GIAO', ngay: '2026-11-10', maKH: o.kh || 'TN', maCongTrinh: o.ct === undefined ? 'PDG' : o.ct, diaChi: 'x' } }, x.nv);
  return { ...x, t1, px: px.soPhieu };
}
const repl = x => { const b = x.W('bh.create', { serial: x.t1, phieu: { ngay: '2026-11-11', moTaLoi: 'PLC treo' } }, x.nv);
  x.W('bh.update', { soPBH: b.soPBH, trangThai: 'DANG_XU_LY', nguyenNhan: 'LOI_THIET_BI' }, x.nv);
  return x.P('bh.replace', { soPBH: b.soPBH, ngay: '2026-11-11', kho: 'KHO', lines: [{ maHang: 'CB6', soLuong: 1 }] }, x.nv); };
test('V1 tech A1: tủ làm theo lệnh khách A, bán + bàn giao khách B → thay linh kiện bảo hành không bị chặn', () => {
  const x = sold({ kh: 'KH2', ct: '' }); x.buy('2026-11-10', 1); const r = repl(x); assert.equal(r.ok, true, JSON.stringify(r));
});
test('V1 tech A1: công trình đổi chủ sau khi bán → bảo hành, khách trả theo phiếu gốc, di dời giữ vị trí cũ vẫn làm được', () => {
  const x = sold(); x.buy('2026-11-10', 1);
  x.W('project.upsert', { project: { maCongTrinh: 'PDG', ten: 'Hẻm 20 Phan Đình Giót', maKH: 'KH2' } });
  assert.equal(repl(x).ok, true, 'bảo hành');
  assert.equal(x.P('install.add', { serial: x.t1, lapDat: { loai: 'DI_DOI', ngay: '2026-11-12', maKH: 'TN', maCongTrinh: 'PDG', diaChi: 'y' } }, x.nv).ok, true, 'di dời giữ khách/công trình');
  assert.equal(x.P('install.add', { serial: x.t1, lapDat: { loai: 'DI_DOI', ngay: '2026-11-12', maKH: 'TN', maCongTrinh: 'CT2', diaChi: 'z' } }, x.nv).ok, false, 'di dời sang cặp lệch vẫn chặn');
  const kt = x.P('voucher.create', { voucher: { loai: 'KHACH_TRA', ngay: '2026-11-13', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', phieuGoc: x.px, lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.t1], dongGoc: 1 }] } }, x.nv);
  assert.equal(kt.ok, true, JSON.stringify(kt));
});
test('V1 tech B4/B5: sync.ver chỉ trả phiên bản + ngày (không đọc sheet); sync.pull báo danh sách phiếu bị cắt', () => {
  const x = plant(); x.buy('2026-11-01', 1); const v = x.pull().version; for (const k in x.a.reads) delete x.a.reads[k];
  const r = x.P('sync.ver', {}, x.nv); assert.equal(r.ok, true); assert.equal(r.data.version, v); assert.ok(r.data.today);
  assert.deepEqual(Object.keys(x.a.reads).filter(k => !/NguoiDung/.test(k)), [], 'không đọc sheet dữ liệu');
  assert.equal(x.pull().vouchersCut, false);
  const ph = x.a.sheets.Phieu; const row = ph.d[1]; for (let i = 0; i < 501; i++) ph.d.push(row.map((c, j) => j === 0 ? 'ZZ-' + i : j === 11 ? 'LOI_GHI' : c));
  x.a.raw.dataVersion = String(Number(x.a.raw.dataVersion) + 1); for (const k of Object.keys(x.a.cache)) if (/dataVersion|^ver:/.test(k)) delete x.a.cache[k];
  assert.equal(x.pull().vouchersCut, true);
});

// ================= vòng 2 =================
test('V2 tech B6: đổi khoá phiên (rotateSessionKey) → phiên cũ hết hiệu lực ngay, đăng nhập lại dùng được', () => {
  const x = plant(); const old = x.nv;
  assert.equal(x.P('sync.ver', {}, old).ok, true);
  x.a.rotateSessionKey();
  assert.equal(x.P('sync.ver', {}, old).code, 'AUTH_INVALID', 'phiên cũ bị từ chối ngay');
  const s2 = x.a.login('nv@gmail.com'); assert.equal(typeof s2, 'string');
  assert.equal(x.a.post({ action: 'sync.ver', session: s2 }).ok, true, 'phiên mới dùng được ngay');
});
