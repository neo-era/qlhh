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
