// TDD serial: trạng thái theo loại phiếu, chống trùng, đúng kho, đảo phiếu.
const test = require('node:test'), assert = require('node:assert');
const SR = require('../core/serial.js');
const items = { LOGO: { maHang: 'LOGO', hang: 'Siemens', quanLySerial: true }, CB: { maHang: 'CB', hang: 'LS', quanLySerial: false } };
const P = (loai, kho, lines, x = {}) => ({ soPhieu: x.soPhieu || loai, loai, ngay: '2026-11-09', kho, ...x, lines: lines.map((l, i) => ({ dong: i + 1, ...l })) });
const ctx = (extra = {}) => ({ items, khoLoi: ['LOI'], vouchers: {}, ...extra });

test('nhập: số serial = số lượng, không trùng trong phiếu / toàn hệ thống (theo hãng), chuẩn hoá', () => {
  const r = SR.apply({}, P('NHAP_MUA', 'K1', [{ maHang: 'LOGO', soLuong: 2, serials: [' vpc1 ', 'VPC2'] }]), ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.changes.map(c => [c.key, c.to, c.kho]), [['SIEMENS|VPC1', 'TRONG_KHO', 'K1'], ['SIEMENS|VPC2', 'TRONG_KHO', 'K1']]);
  assert.equal(SR.apply({}, P('NHAP_MUA', 'K1', [{ maHang: 'LOGO', soLuong: 2, serials: ['A'] }]), ctx()).code, 'VALIDATION');
  assert.equal(SR.apply({}, P('NHAP_MUA', 'K1', [{ maHang: 'LOGO', soLuong: 2, serials: ['A', 'a'] }]), ctx()).code, 'SERIAL_DUP');
  const map = SR.index(r.changes.map(SR.toRecord));
  assert.equal(SR.apply(map, P('NHAP_MUA', 'K2', [{ maHang: 'LOGO', soLuong: 1, serials: ['VPC1'] }]), ctx()).code, 'SERIAL_DUP');
  assert.equal(SR.apply({}, P('NHAP_MUA', 'K1', [{ maHang: 'LOGO', soLuong: 1.5, serials: ['A'] }]), ctx()).code, 'VALIDATION');
  assert.equal(SR.apply({}, P('NHAP_MUA', 'K1', [{ maHang: 'CB', soLuong: 3 }]), ctx()).changes.length, 0, 'hàng không quản lý serial');
});

test('xuất bán: chỉ serial TRONG_KHO đúng kho; sai kho/đã bán/không có → SERIAL_NOT_IN_STOCK', () => {
  const map = SR.index([{ key: 'SIEMENS|S1', maHang: 'LOGO', trangThai: 'TRONG_KHO', kho: 'K1' }, { key: 'SIEMENS|S2', maHang: 'LOGO', trangThai: 'DA_BAN', kho: '' }]);
  const r = SR.apply(map, P('XUAT_BAN', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['s1'] }]), ctx());
  assert.equal(r.ok, true); assert.equal(r.changes[0].to, 'DA_BAN'); assert.equal(r.changes[0].from, 'TRONG_KHO');
  for (const s of ['S2', 'S9']) assert.equal(SR.apply(map, P('XUAT_BAN', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: [s] }]), ctx()).code, 'SERIAL_NOT_IN_STOCK');
  assert.equal(SR.apply(map, P('XUAT_BAN', 'K2', [{ maHang: 'LOGO', soLuong: 1, serials: ['S1'] }]), ctx()).code, 'SERIAL_NOT_IN_STOCK');
  assert.equal(SR.apply(map, P('XUAT_SX', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['S1'] }]), ctx()).changes[0].to, 'DA_LAP');
});

test('chuyển kho đổi kho; khách trả chỉ nhận serial đã bán trong phiếu gốc; nhận hàng lỗi → HANG_LOI; trả NCC', () => {
  const map = SR.index([{ key: 'SIEMENS|S1', maHang: 'LOGO', trangThai: 'TRONG_KHO', kho: 'K1' }, { key: 'SIEMENS|S2', maHang: 'LOGO', trangThai: 'DA_BAN', kho: '' }, { key: 'SIEMENS|S3', maHang: 'LOGO', trangThai: 'DA_BAN', kho: '' }]);
  assert.equal(SR.apply(map, P('CHUYEN_KHO', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['S1'] }], { khoDen: 'K2' }), ctx()).changes[0].kho, 'K2');
  const goc = P('XUAT_BAN', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['S2'] }], { soPhieu: 'PX-1' });
  const c = ctx({ vouchers: { 'PX-1': goc } });
  assert.equal(SR.apply(map, P('KHACH_TRA', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['S2'] }], { phieuGoc: 'PX-1' }), c).changes[0].to, 'TRONG_KHO');
  assert.equal(SR.apply(map, P('KHACH_TRA', 'K1', [{ maHang: 'LOGO', soLuong: 1, serials: ['S3'] }], { phieuGoc: 'PX-1' }), c).code, 'VALIDATION');
  const hl = SR.apply(map, P('NHAP_HANG_LOI', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['S3'] }]), c);
  assert.deepEqual([hl.changes[0].to, hl.changes[0].kho], ['HANG_LOI', 'LOI']);
  const map2 = SR.index([{ key: 'SIEMENS|S3', maHang: 'LOGO', trangThai: 'HANG_LOI', kho: 'LOI' }]);
  assert.equal(SR.apply(map2, P('TRA_NCC', 'LOI', [{ maHang: 'LOGO', soLuong: 1, serials: ['S3'] }]), c).changes[0].to, 'DA_TRA_NCC');
});

test('đảo phiếu: trả serial về trạng thái trước; serial đã đi tiếp → không đảo được', () => {
  const hist = [{ soPhieu: 'PX-1', key: 'SIEMENS|S1', maHang: 'LOGO', from: 'TRONG_KHO', to: 'DA_BAN', khoTu: 'K1', khoDen: '' }];
  const ok = SR.reverse(SR.index([{ key: 'SIEMENS|S1', maHang: 'LOGO', trangThai: 'DA_BAN', kho: '' }]), hist, 'DA-1');
  assert.equal(ok.ok, true); assert.deepEqual([ok.changes[0].to, ok.changes[0].kho], ['TRONG_KHO', 'K1']);
  const moved = SR.reverse(SR.index([{ key: 'SIEMENS|S1', maHang: 'LOGO', trangThai: 'TRONG_KHO', kho: 'K1' }]), hist, 'DA-1');
  assert.equal(moved.code, 'VALIDATION');
  const created = [{ soPhieu: 'PN-1', key: 'SIEMENS|S9', maHang: 'LOGO', from: '', to: 'TRONG_KHO', khoTu: '', khoDen: 'K1' }];
  assert.equal(SR.reverse(SR.index([{ key: 'SIEMENS|S9', maHang: 'LOGO', trangThai: 'TRONG_KHO', kho: 'K1' }]), created, 'DA-2').changes[0].to, 'HUY');
});

test('kiểm kê hàng serial: thiếu → serial liệt kê thành MAT; thừa → serial mới TRONG_KHO; số serial = chênh lệch', () => {
  const map = SR.index([{ key: 'SIEMENS|S1', maHang: 'LOGO', trangThai: 'TRONG_KHO', kho: 'K1' }]);
  assert.equal(SR.apply(map, P('KIEM_KE', 'K1', [{ maHang: 'LOGO', slSoSach: 1, slThucTe: 0, serials: ['S1'] }]), ctx()).changes[0].to, 'MAT');
  assert.equal(SR.apply(map, P('KIEM_KE', 'K1', [{ maHang: 'LOGO', slSoSach: 1, slThucTe: 2, serials: ['S7'] }]), ctx()).changes[0].to, 'TRONG_KHO');
  assert.equal(SR.apply(map, P('KIEM_KE', 'K1', [{ maHang: 'LOGO', slSoSach: 1, slThucTe: 0, serials: [] }]), ctx()).code, 'VALIDATION');
});
