// TDD máy chủ đợt 3 (v0.5.0) — viết TRƯỚC khi code: kho hàng lỗi, xuất huỷ / nhập khác, tủ khách trả, sửa thu tiền, BH hàng không serial, huỷ lần thay (§19).
const test = require('node:test'), assert = require('node:assert');
const { rid, ready } = require('./gas-mock.js');
const { plant, built } = require('./sx-fixture.js');

const V = (x, v, who) => x.P('voucher.create', { voucher: v }, who || x.nv);
const VW = (x, v, who) => { const r = V(x, v, who); assert.equal(r.ok, true, JSON.stringify(r)); return r.data.soPhieu; };
const ser = (x, s) => x.W('serial.get', { serial: s }).serial;
const tonK = (x, ma, kho) => { const t = x.pull().data.stock.find(z => z.maHang === ma && z.kho === kho); return t ? Number(t.soLuong) : 0; };
const ton = (x, ma) => { const t = x.ton(ma); return t ? [Number(t.soLuong), Number(t.giaTri)] : [0, 0]; };
const line = (x, so, who) => x.W('voucher.get', { soPhieu: so }, who).lines[0];
const dao = (x, so, ngay = '2026-11-14') => x.W('voucher.reverse', { phieuGoc: so, ngay, lyDo: 'Ghi nhầm — đảo' });
const sellLogo = (x, sers, ngay = '2026-11-02') => VW(x, { loai: 'XUAT_BAN', ngay, kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: sers.length, serials: sers }] });

test('D3-1 gửi NCC → nhận về: 1 sửa xong về kho thường theo đơn giá, 1 NCC đổi serial mới về kho lỗi; ràng buộc; đảo ngược thứ tự', () => {
  const x = plant(); x.buy('2026-11-01', 2); x.W('supplier.upsert', { isNew: true, supplier: { maNCC: 'NCC2', ten: 'NCC khác' } });
  sellLogo(x, ['LG11010', 'LG11011']);
  const hl = VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-03', kho: 'KHO-LOI', lyDo: 'Thu hồi LOGO! lỗi', lines: [{ maHang: 'LOGO', soLuongCT: 2, serials: ['LG11010', 'LG11011'] }] });
  assert.equal(V(x, { loai: 'GUI_NCC', ngay: '2026-11-04', kho: 'KHO-LOI', lines: [{ maHang: 'LOGO', soLuongCT: 2, serials: ['LG11010', 'LG11011'] }] }).code, 'VALIDATION', 'bắt buộc NCC');
  assert.equal(V(x, { loai: 'GUI_NCC', ngay: '2026-11-04', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'DEN', soLuongCT: 1 }] }).code, 'VALIDATION', 'chỉ gửi từ kho lỗi');
  const gn = VW(x, { loai: 'GUI_NCC', ngay: '2026-11-04', kho: 'KHO-LOI', maNCC: 'NCC1', lyDo: 'Gửi bảo hành hãng', lines: [{ maHang: 'LOGO', soLuongCT: 2, serials: ['LG11010', 'LG11011'] }] });
  assert.equal(ser(x, 'LG11010').trangThai, 'GUI_NCC'); assert.equal(tonK(x, 'LOGO', 'KHO-LOI'), 0);
  assert.equal(V(x, { loai: 'NHAN_NCC', ngay: '2026-11-06', kho: 'KHO', maNCC: 'NCC2', phieuGoc: gn, lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 0, serials: ['LG11010'] }] }).code, 'VALIDATION', 'khác NCC');
  assert.equal(V(x, { loai: 'NHAN_NCC', ngay: '2026-11-06', kho: 'KHO', maNCC: 'NCC1', phieuGoc: gn, lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] }).code, 'VALIDATION', 'thiếu đơn giá');
  const nn1 = VW(x, { loai: 'NHAN_NCC', ngay: '2026-11-06', kho: 'KHO', maNCC: 'NCC1', phieuGoc: gn, lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 3000000, serials: ['LG11010'] }] });
  assert.deepEqual(ton(x, 'LOGO'), [1, 3000000]); assert.deepEqual([ser(x, 'LG11010').trangThai, ser(x, 'LG11010').kho], ['TRONG_KHO', 'KHO']);
  assert.equal(line(x, nn1, x.nv).donGia, undefined, 'Nhập liệu không thấy đơn giá sau khi lưu');
  const nn2 = VW(x, { loai: 'NHAN_NCC', ngay: '2026-11-07', kho: 'KHO-LOI', maNCC: 'NCC1', phieuGoc: gn, lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 9, serials: ['LGX001'], serialsDoi: ['LG11011'] }] });
  assert.equal(line(x, nn2).giaTriKho, 0, 'về kho lỗi giá 0'); assert.equal(tonK(x, 'LOGO', 'KHO-LOI'), 1);
  assert.equal(ser(x, 'LG11011').trangThai, 'DA_TRA_NCC'); assert.deepEqual([ser(x, 'LGX001').trangThai, ser(x, 'LGX001').kho], ['HANG_LOI', 'KHO-LOI']);
  assert.equal(V(x, { loai: 'NHAN_NCC', ngay: '2026-11-07', kho: 'KHO-LOI', maNCC: 'NCC1', phieuGoc: gn, lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 0, serials: ['LGX002'], serialsDoi: ['LG11011'] }] }).ok, false, 'đã nhận đủ');
  // báo cáo kho lỗi (không giá, mọi vai trò)
  const rl = x.W('report.loi', {}, x.xem).rows.find(r => r.maHang === 'LOGO');
  assert.equal(rl.ton['KHO-LOI'], 1); assert.deepEqual(rl.serials.map(s => s.serial), ['LGX001']); assert.equal(rl.dangGui.length, 0);
  assert.match(x.P('voucher.reverse', { phieuGoc: gn, ngay: '2026-11-14', lyDo: 'x' }).error, /nhận/i, 'đảo GN khi đã có NN → chặn');
  dao(x, nn2); dao(x, nn1); dao(x, gn);
  assert.deepEqual([ser(x, 'LG11010').trangThai, ser(x, 'LG11011').trangThai, ser(x, 'LG11011').kho], ['HANG_LOI', 'HANG_LOI', 'KHO-LOI']);
  assert.equal(ser(x, 'LGX001').trangThai, 'HUY'); assert.equal(tonK(x, 'LOGO', 'KHO-LOI'), 2); assert.deepEqual(ton(x, 'LOGO'), [0, 0]);
  assert.ok(hl);
  const rb = x.W('stock.rebuild', {}); assert.equal(rb.tinhLai, 0); assert.deepEqual(rb.loiTonAm, []);
});

test('D3-1b báo cáo kho lỗi: hàng đang gửi NCC theo phiếu gửi (đã gửi / đã nhận / còn lại)', () => {
  const x = plant(); x.buy('2026-11-01', 1);
  VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-03', kho: 'KHO-LOI', lyDo: 'Đèn báo hỏng', lines: [{ maHang: 'DEN', soLuongCT: 3 }] });
  const gn = VW(x, { loai: 'GUI_NCC', ngay: '2026-11-04', kho: 'KHO-LOI', maNCC: 'NCC1', lines: [{ maHang: 'DEN', soLuongCT: 3 }] });
  VW(x, { loai: 'NHAN_NCC', ngay: '2026-11-05', kho: 'KHO-LOI', maNCC: 'NCC1', phieuGoc: gn, lines: [{ maHang: 'DEN', soLuongCT: 1, gia: 0 }] });
  const r = x.W('report.loi', {}, x.nv).rows.find(z => z.maHang === 'DEN');
  assert.equal(r.ton['KHO-LOI'], 1); assert.equal(r.dangGui.length, 1);
  assert.deepEqual([r.dangGui[0].soPhieu, r.dangGui[0].maNCC, r.dangGui[0].gui, r.dangGui[0].nhan, r.dangGui[0].con], [gn, 'NCC1', 3, 1, 2]);
});

test('D3-2 chuyển hàng đã sửa về kho thường: BQ 10@100.000 + 1@0 = 90.909; lý do bắt buộc; kho đến thường; đảo', () => {
  const x = plant();
  x.W('item.upsert', { isNew: true, item: { maHang: 'DEN-LED', ten: 'Đèn LED 100W', dvt: 'bộ', thangBH: 24 } });
  VW(x, { loai: 'NHAP_MUA', ngay: '2026-11-01', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'DEN-LED', soLuongCT: 10, gia: 100000 }] });
  VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-02', kho: 'KHO-LOI', lyDo: 'Thu hồi', lines: [{ maHang: 'DEN-LED', soLuongCT: 1 }] });
  assert.equal(V(x, { loai: 'CHUYEN_SUA', ngay: '2026-11-03', kho: 'KHO-LOI', khoDen: 'KHO', lines: [{ maHang: 'DEN-LED', soLuongCT: 1, gia: 0 }] }).code, 'VALIDATION', 'thiếu lý do');
  assert.equal(V(x, { loai: 'CHUYEN_SUA', ngay: '2026-11-03', kho: 'KHO-LOI', khoDen: 'KHO-LOI', lyDo: 'Sửa xong', lines: [{ maHang: 'DEN-LED', soLuongCT: 1, gia: 0 }] }).code, 'VALIDATION', 'kho đến là kho lỗi');
  const cs = VW(x, { loai: 'CHUYEN_SUA', ngay: '2026-11-03', kho: 'KHO-LOI', khoDen: 'KHO', lyDo: 'Đã thay driver, chạy thử đạt', lines: [{ maHang: 'DEN-LED', soLuongCT: 1, gia: 0 }] });
  assert.deepEqual(ton(x, 'DEN-LED'), [11, 1000000]); assert.equal(tonK(x, 'DEN-LED', 'KHO-LOI'), 0);
  assert.equal(x.pull().data.items.find(i => i.maHang === 'DEN-LED').giaVon, 90909);
  dao(x, cs); assert.deepEqual(ton(x, 'DEN-LED'), [10, 1000000]); assert.equal(tonK(x, 'DEN-LED', 'KHO-LOI'), 1);
  // serial
  x.buy('2026-11-01', 1); sellLogo(x, ['LG11010']);
  VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-03', kho: 'KHO-LOI', lyDo: 'Thu hồi', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] });
  VW(x, { loai: 'CHUYEN_SUA', ngay: '2026-11-04', kho: 'KHO-LOI', khoDen: 'KHO', lyDo: 'Nạp lại firmware', lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 2000000, serials: ['LG11010'] }] });
  assert.deepEqual([ser(x, 'LG11010').trangThai, ser(x, 'LG11010').kho], ['TRONG_KHO', 'KHO']); assert.deepEqual(ton(x, 'LOGO'), [1, 2000000]);
});

test('D3-3 trả khách hàng đã sửa: theo phiếu nhận lỗi có khách, serial → DA_BAN, khách kế thừa; hàng thu hồi BH → chặn', () => {
  const x = plant(); x.buy('2026-11-01', 1); sellLogo(x, ['LG11010']);
  const hl = VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-03', kho: 'KHO-LOI', maKH: 'TN', lyDo: 'Khách gửi sửa', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }, { maHang: 'DEN', soLuongCT: 2 }] });
  assert.equal(V(x, { loai: 'TRA_KHACH_SUA', ngay: '2026-11-05', kho: 'KHO-LOI', phieuGoc: hl, lines: [{ maHang: 'DEN', soLuongCT: 3 }] }).ok, false, 'vượt số đã nhận');
  const ts = VW(x, { loai: 'TRA_KHACH_SUA', ngay: '2026-11-05', kho: 'KHO-LOI', phieuGoc: hl, lyDo: 'Sửa xong giao lại', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }, { maHang: 'DEN', soLuongCT: 2 }] });
  assert.equal(ser(x, 'LG11010').trangThai, 'DA_BAN'); assert.equal(tonK(x, 'DEN', 'KHO-LOI'), 0);
  const h = x.W('voucher.get', { soPhieu: ts }).phieu; assert.deepEqual([h.maKH, h.phieuGoc], ['TN', hl]);
  const th = VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-06', kho: 'KHO-LOI', lyDo: 'Thu hồi', lines: [{ maHang: 'DEN', soLuongCT: 1 }] });
  assert.equal(V(x, { loai: 'TRA_KHACH_SUA', ngay: '2026-11-07', kho: 'KHO-LOI', phieuGoc: th, lines: [{ maHang: 'DEN', soLuongCT: 1 }] }).ok, false, 'hàng thu hồi của công ty');
  assert.equal(x.P('voucher.reverse', { phieuGoc: hl, ngay: '2026-11-14', lyDo: 'x' }).ok, false, 'đảo phiếu nhận lỗi khi đã trả khách');
  dao(x, ts); assert.deepEqual([ser(x, 'LG11010').trangThai, ser(x, 'LG11010').kho], ['HANG_LOI', 'KHO-LOI']);
});

test('D3-4 xuất huỷ: giá BQ 210.000; lý do; quyền; khoá sổ; serial không dùng lại; đảo', () => {
  const x = plant();
  VW(x, { loai: 'NHAP_MUA', ngay: '2026-11-01', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'CT', soLuongCT: 5, gia: 100000 }] });
  VW(x, { loai: 'NHAP_MUA', ngay: '2026-11-02', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'CT', soLuongCT: 5, gia: 110000 }] });
  assert.equal(V(x, { loai: 'XUAT_HUY', ngay: '2026-11-05', kho: 'KHO', lines: [{ maHang: 'CT', soLuongCT: 2 }] }).code, 'VALIDATION', 'thiếu lý do');
  assert.equal(V(x, { loai: 'XUAT_HUY', ngay: '2026-11-05', kho: 'KHO', lyDo: 'Vỡ', lines: [{ maHang: 'CT', soLuongCT: 2 }] }, x.xem).code, 'FORBIDDEN');
  const xh = VW(x, { loai: 'XUAT_HUY', ngay: '2026-11-05', kho: 'KHO', lyDo: 'Biên bản huỷ 01/BB — vỡ khi vận chuyển', lines: [{ maHang: 'CT', soLuongCT: 2 }] });
  assert.equal(line(x, xh).giaTriKho, 210000); assert.equal(line(x, xh, x.nv).giaTriKho, undefined, 'Nhập liệu không thấy giá trị');
  assert.deepEqual(ton(x, 'CT'), [8, 840000]);
  VW(x, { loai: 'XUAT_BAN', ngay: '2026-11-08', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CT', soLuongCT: 8 }] });
  assert.equal(V(x, { loai: 'XUAT_HUY', ngay: '2026-11-06', kho: 'KHO', lyDo: 'Mất', lines: [{ maHang: 'CT', soLuongCT: 1 }] }).code, 'NEGATIVE_STOCK_LATER');
  x.buy('2026-11-01', 2);
  const xs = VW(x, { loai: 'XUAT_HUY', ngay: '2026-11-09', kho: 'KHO', lyDo: 'LOGO! cháy do sét kho', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] });
  assert.equal(ser(x, 'LG11010').trangThai, 'XUAT_HUY');
  assert.equal(V(x, { loai: 'NHAP_MUA', ngay: '2026-11-10', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 1, serials: ['LG11010'] }] }).code, 'SERIAL_DUP');
  dao(x, xs); assert.equal(ser(x, 'LG11010').trangThai, 'TRONG_KHO');
  x.W('period.lock', { ngay: '2026-11-10' });
  assert.equal(V(x, { loai: 'XUAT_HUY', ngay: '2026-11-10', kho: 'KHO', lyDo: 'Mất', lines: [{ maHang: 'DEN', soLuongCT: 1 }] }).code, 'PERIOD_LOCKED');
});

test('D3-5 nhập khác: đơn giá bắt buộc, BQ đúng, ẩn giá với Nhập liệu, N-X-T có cột theo loại', () => {
  const x = plant();
  VW(x, { loai: 'NHAP_MUA', ngay: '2026-11-01', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'CB6', soLuongCT: 10, gia: 100000 }] });
  assert.equal(V(x, { loai: 'NHAP_KHAC', ngay: '2026-11-02', kho: 'KHO', lyDo: 'Thừa', lines: [{ maHang: 'CB6', soLuongCT: 2 }] }).code, 'VALIDATION', 'thiếu đơn giá');
  assert.equal(V(x, { loai: 'NHAP_KHAC', ngay: '2026-11-02', kho: 'KHO', lines: [{ maHang: 'CB6', soLuongCT: 2, gia: 40000 }] }).code, 'VALIDATION', 'thiếu lý do');
  assert.equal(V(x, { loai: 'NHAP_KHAC', ngay: '2026-11-02', kho: 'KHO-LOI', lyDo: 'x', lines: [{ maHang: 'CB6', soLuongCT: 2, gia: 40000 }] }).code, 'VALIDATION', 'không vào kho lỗi');
  const nk = VW(x, { loai: 'NHAP_KHAC', ngay: '2026-11-02', kho: 'KHO', lyDo: 'Hàng mẫu NCC tặng', lines: [{ maHang: 'CB6', soLuongCT: 2, gia: 40000 }] });
  assert.deepEqual(ton(x, 'CB6'), [12, 1080000]); assert.equal(line(x, nk, x.nv).donGia, undefined); assert.equal(line(x, nk).thanhTien, 80000);
  VW(x, { loai: 'XUAT_HUY', ngay: '2026-11-03', kho: 'KHO', lyDo: 'Hỏng', lines: [{ maHang: 'CB6', soLuongCT: 3 }] });
  const r = x.W('report.nxt', { from: '2026-11-01', to: '2026-11-30' }).rows.find(z => z.maHang === 'CB6');
  assert.deepEqual(r.theoLoai.NHAP_KHAC, { q: 2, v: 80000 }); assert.deepEqual(r.theoLoai.XUAT_HUY, { q: 3, v: 270000 }); assert.deepEqual(r.theoLoai.NHAP_MUA, { q: 10, v: 1000000 });
  assert.equal(x.P('report.nxt', { from: '2026-11-01', to: '2026-11-30' }, x.nv).code, 'FORBIDDEN');
});

// ---------- tủ khách trả (B7) ----------
function soldCab() {
  const x = built(), [t1, t2] = x.tp.serials;
  [t1, t2].forEach(t => x.W('kcs.add', { serial: t, ngay: '2026-11-09', ketQua: x.pass() }, x.nv));
  x.W('customer.upsert', { isNew: true, customer: { maKH: 'KH2', ten: 'Khách 2' } }); x.W('project.upsert', { isNew: true, project: { maCongTrinh: 'CT2', ten: 'CT của KH2', maKH: 'KH2' } });
  const pxx = x.W('pxx.issue', { pxx: { ngay: '2026-11-09', serials: [t1, t2], maKH: 'TN', maCongTrinh: 'PDG', diaDiem: 'Tây Ninh' } }, x.nv).soPXX;
  const px = VW(x, { loai: 'XUAT_BAN', ngay: '2026-11-09', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [t1] }] });
  x.W('install.add', { serial: t1, lapDat: { loai: 'BAN_GIAO', ngay: '2026-11-10', maKH: 'TN', maCongTrinh: 'PDG', diaChi: 'Hẻm 20' } }, x.nv);
  const pbh = x.W('bh.create', { serial: t1, phieu: { ngay: '2026-11-11', moTaLoi: 'Nhánh 1 không đóng' } }, x.nv).soPBH;
  return { ...x, t1, t2, pxx, px, pbh };
}
const traTu = (x, extra = {}) => x.P('voucher.create', { voucher: { loai: 'KHACH_TRA', ngay: '2026-11-12', kho: 'KHO', phieuGoc: x.px, lyDo: 'Khách trả tủ — đổi thiết kế', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.t1] }] } , ...extra }, x.nv);

test('D3-6 tủ khách trả: KCS lại trước khi bán; PXX cũ ghi trả lại; PBH mở đóng; lịch sử; gửi lại không trùng sự kiện; bán lại chu kỳ BH mới', () => {
  const x = soldCab(), id = rid();
  const r = traTu(x, { requestId: id }); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(traTu(x, { requestId: id }).data.soPhieu, r.data.soPhieu, 'gửi lại cùng requestId');
  const g = x.W('serial.get', { serial: x.t1 });
  assert.equal(g.serial.trangThai, 'TRONG_KHO'); assert.equal(g.hoSo.kcsDat, false, 'phải KCS lại'); assert.equal(g.hoSo.soPXX, '');
  const ls = JSON.parse(g.hoSo.lichSu); assert.equal(ls.length, 1, 'gửi lại không thêm sự kiện');
  assert.deepEqual([ls[0].loai, ls[0].soPhieu, ls[0].phieuXuat, ls[0].soPXX, ls[0].maKH, ls[0].ngayBanGiao, ls[0].hanBH], ['KHACH_TRA', r.data.soPhieu, x.px, x.pxx, 'TN', '2026-11-10', '2027-11-09']);
  const p = x.pull().data.pxx.find(z => z.soPXX === x.pxx); assert.equal(p.trangThai, 'PHAT_HANH', 'tủ khác của PXX vẫn hiệu lực');
  assert.deepEqual(JSON.parse(p.traLai).map(z => z.serial), [x.t1]);
  assert.equal(x.W('serial.get', { serial: x.t2 }).hoSo.soPXX, x.pxx);
  assert.equal(x.pull().data.pbh.find(t => t.soPBH === x.pbh).trangThai, 'DONG_KHACH_TRA');
  // chưa KCS lại → không bán, không PXX
  const sell = V(x, { loai: 'XUAT_BAN', ngay: '2026-11-13', kho: 'KHO', maKH: 'KH2', maCongTrinh: 'CT2', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.t1] }] });
  assert.equal(sell.ok, false); assert.match(sell.error, /KCS/);
  assert.equal(x.P('pxx.issue', { pxx: { ngay: '2026-11-13', serials: [x.t1], maKH: 'KH2', maCongTrinh: 'CT2' } }, x.nv).ok, false);
  x.W('kcs.add', { serial: x.t1, ngay: '2026-11-13', ketQua: x.pass() }, x.nv);
  const pxx2 = x.W('pxx.issue', { pxx: { ngay: '2026-11-13', serials: [x.t1], maKH: 'KH2', maCongTrinh: 'CT2' } }, x.nv).soPXX; assert.notEqual(pxx2, x.pxx);
  VW(x, { loai: 'XUAT_BAN', ngay: '2026-11-13', kho: 'KHO', maKH: 'KH2', maCongTrinh: 'CT2', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.t1] }] });
  const g2 = x.W('serial.get', { serial: x.t1 });
  assert.equal(g2.baoHanh.tinhTrang.ma, 'CHUA_BAN_GIAO', 'chu kỳ bảo hành mới'); assert.equal(g2.baoHanh.ngayXuat, '2026-11-13'); assert.equal(g2.lapDat.length, 0);
  assert.equal(g2.kcs.length, 2, 'lịch sử KCS giữ nguyên'); assert.equal(g2.hoSo.soPXX, pxx2);
});

test('D3-6b đảo phiếu khách trả tủ (chưa kiểm lại) → khôi phục KCS, PXX, phiếu BH; sự kiện đánh dấu huỷ', () => {
  const x = soldCab(), r = traTu(x); assert.equal(r.ok, true);
  dao(x, r.data.soPhieu);
  const g = x.W('serial.get', { serial: x.t1 });
  assert.equal(g.serial.trangThai, 'DA_BAN'); assert.equal(g.hoSo.kcsDat, true); assert.equal(g.hoSo.soPXX, x.pxx);
  assert.equal(JSON.parse(g.hoSo.lichSu)[0].huy, true);
  assert.equal(JSON.parse(x.pull().data.pxx.find(z => z.soPXX === x.pxx).traLai || '[]').length, 0);
  assert.equal(x.pull().data.pbh.find(t => t.soPBH === x.pbh).trangThai, 'TIEP_NHAN');
  assert.equal(g.baoHanh.ngayBanGiao, '2026-11-10', 'chu kỳ bảo hành cũ trở lại');
});

// ---------- sửa chữa có thu tiền ----------
function warranty(o = {}) {
  const x = soldCab();
  VW(x, { loai: 'NHAP_MUA', ngay: '2026-11-10', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 2, gia: 4200000, serials: ['LGNEW1', 'LGNEW2'] }, { maHang: 'CONT', soLuongCT: 2, gia: 620000 }] }, x.s);
  if (o.ngoai) x.W('bh.update', { soPBH: x.pbh, trangThai: 'DANG_XU_LY', nguyenNhan: 'SET_DANH' }, x.nv);
  return x;
}
test('D3-7 sửa có thu tiền: ngoài BH, Nhập liệu thay linh kiện → phiếu XR giá BQ, phí sửa trên PBH; báo cáo tách; không đảo riêng XR', () => {
  const x = warranty({ ngoai: 1 });
  assert.match(x.P('bh.replace', { soPBH: x.pbh, ngay: '2026-11-12', kho: 'KHO', lines: [{ maHang: 'CONT', soLuong: 1 }] }, x.nv).error, /Ngoài bảo hành/);
  const r = x.W('bh.replace', { soPBH: x.pbh, ngay: '2026-11-12', kho: 'KHO', hinhThuc: 'THU_TIEN', phiSua: 1500000, lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'], serialCu: ['LG11010'] }, { maHang: 'CONT', soLuong: 1 }] }, x.nv);
  assert.match(r.soPhieuXuat, /^XR-2026-/);
  assert.deepEqual(x.W('serial.get', { serial: x.t1 }).con.map(c => c.serial), ['LGNEW1']);
  assert.equal(x.W('voucher.get', { soPhieu: r.soPhieuXuat }).phieu.loai, 'XUAT_SUA');
  const t = x.pull().data.pbh.find(z => z.soPBH === x.pbh); assert.equal(t.phiSua, 1500000); assert.equal(t.hinhThuc, 'THU_TIEN');
  assert.equal(JSON.parse(t.thayThe)[0].hinhThuc, 'THU_TIEN'); assert.equal(JSON.parse(t.thayThe)[0].soPhieuXuat, r.soPhieuXuat);
  assert.equal(x.P('voucher.reverse', { phieuGoc: r.soPhieuXuat, ngay: '2026-11-14', lyDo: 'x' }).ok, false);
  x.W('bh.update', { soPBH: x.pbh, trangThai: 'HOAN_THANH', ketQua: 'Thay LOGO! + contactor, khách thanh toán', nguyenNhan: 'SET_DANH', phiSua: 1800000 }, x.nv);
  const rep = x.W('report.bh', { from: '2026-11-01', to: '2026-11-30' });
  const xr = rep.rows.find(z => z.soPhieu === r.soPhieuXuat); assert.equal(xr.loai, 'THU_TIEN'); assert.equal(xr.giaTri, 4200000 + 620000);
  assert.equal(rep.tong, 0, 'không tính vào chi phí bảo hành'); assert.equal(rep.tongSua, 4820000); assert.equal(rep.phiSua, 1800000);
});

// ---------- bảo hành hàng không serial ----------
test('D3-8 bảo hành đèn (không serial): tiếp nhận theo phiếu xuất, hạn = ngày xuất + 24 tháng − 1; đổi hàng XB + HL; gửi lại không trùng', () => {
  const x = plant();
  x.W('item.upsert', { isNew: true, item: { maHang: 'DEN-LED', ten: 'Đèn LED 100W', dvt: 'bộ', thangBH: 24 } });
  VW(x, { loai: 'NHAP_MUA', ngay: '2026-11-01', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'DEN-LED', soLuongCT: 20, gia: 1000000 }] }, x.s);
  const px = VW(x, { loai: 'XUAT_BAN', ngay: '2026-11-02', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN-LED', soLuongCT: 10 }] });
  assert.equal(x.P('bh.create', { hangLe: { phieuXuat: px, maHang: 'DEN-LED', soLuong: 11 }, phieu: { ngay: '2026-11-12', moTaLoi: 'Không sáng' } }, x.nv).ok, false, 'vượt số đã xuất');
  assert.equal(x.P('bh.create', { hangLe: { phieuXuat: px, maHang: 'DEN', soLuong: 1 }, phieu: { ngay: '2026-11-12', moTaLoi: 'x' } }, x.nv).ok, false, 'mã không có trong phiếu');
  const b = x.W('bh.create', { hangLe: { phieuXuat: px, maHang: 'DEN-LED', soLuong: 2 }, phieu: { ngay: '2026-11-12', moTaLoi: 'Không sáng', nguoiBao: 'Anh Tâm' } }, x.nv);
  assert.deepEqual([b.tinhTrangBH, b.hanBH], ['TRONG_BH', '2028-11-01']);
  const t = x.pull(x.xem).data.pbh.find(z => z.soPBH === b.soPBH); assert.deepEqual([t.maHang, t.soLuong, t.phieuGoc, t.maKH, t.serial], ['DEN-LED', 2, px, 'TN', '']);
  const id = rid(), body = { action: 'bh.replace', session: x.nv, requestId: id, soPBH: b.soPBH, ngay: '2026-11-12', kho: 'KHO', lines: [{ maHang: 'DEN-LED', soLuong: 2 }] };
  const a1 = x.a.post(body), a2 = x.a.post(body); assert.equal(a1.ok, true, JSON.stringify(a1)); assert.equal(a2.data.soPhieuXuat, a1.data.soPhieuXuat);
  assert.equal(line(x, a1.data.soPhieuXuat).giaTriKho, 2000000); assert.equal(tonK(x, 'DEN-LED', 'KHO-LOI'), 2); assert.deepEqual(ton(x, 'DEN-LED'), [8, 8000000]);
  assert.equal(x.a.sheets.Phieu.d.filter(z => z[2] === 'XUAT_BH').length, 1);
  // không thu hồi xác (soLuongCu = 0)
  const b2 = x.W('bh.create', { hangLe: { phieuXuat: px, maHang: 'DEN-LED', soLuong: 1 }, phieu: { ngay: '2026-11-13', moTaLoi: 'Vỡ chóa' } }, x.nv);
  const r2 = x.W('bh.replace', { soPBH: b2.soPBH, ngay: '2026-11-13', kho: 'KHO', lines: [{ maHang: 'DEN-LED', soLuong: 1, soLuongCu: 0 }] }, x.nv);
  assert.equal(r2.soPhieuLoi, ''); assert.equal(tonK(x, 'DEN-LED', 'KHO-LOI'), 2);
});

// ---------- huỷ lần thay linh kiện ----------
test('D3-9 huỷ lần thay (QT): linh kiện mới về kho, cũ lắp lại tủ, tồn/giá vốn như trước, PBH ghi huyThay; gửi lại không đảo 2 lần', () => {
  const x = warranty(), before = [ton(x, 'LOGO'), ton(x, 'CONT'), tonK(x, 'LOGO', 'KHO-LOI')];
  const r = x.W('bh.replace', { soPBH: x.pbh, ngay: '2026-11-12', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'], serialCu: ['LG11010'] }, { maHang: 'CONT', soLuong: 1 }] }, x.nv);
  assert.equal(x.P('bh.replaceVoid', { soPBH: x.pbh, soPhieuXuat: r.soPhieuXuat, lyDo: 'Ghi nhầm linh kiện thay' }, x.nv).code, 'FORBIDDEN');
  assert.equal(x.P('bh.replaceVoid', { soPBH: x.pbh, soPhieuXuat: r.soPhieuXuat, lyDo: 'ngắn' }).code, 'VALIDATION', 'lý do ≥ 10 ký tự');
  const id = rid(), body = { action: 'bh.replaceVoid', session: x.s, requestId: id, soPBH: x.pbh, soPhieuXuat: r.soPhieuXuat, lyDo: 'Ghi nhầm linh kiện thay', ngay: '2026-11-13' };
  const v1 = x.a.post(body); assert.equal(v1.ok, true, JSON.stringify(v1)); const v2 = x.a.post(body); assert.equal(v2.ok, true);
  assert.equal(x.a.sheets.Phieu.d.filter(z => z[2] === 'DAO').length, 2, 'đảo đúng 2 phiếu (XB + HL), gửi lại không đảo thêm');
  assert.deepEqual([ton(x, 'LOGO'), ton(x, 'CONT'), tonK(x, 'LOGO', 'KHO-LOI')], before);
  assert.deepEqual([ser(x, 'LGNEW1').trangThai, ser(x, 'LGNEW1').kho, ser(x, 'LGNEW1').serialCha], ['TRONG_KHO', 'KHO', '']);
  const old = ser(x, 'LG11010'); assert.equal(old.trangThai, 'DA_LAP'); assert.ok(old.serialCha.endsWith('|' + x.t1));
  assert.deepEqual(x.W('serial.get', { serial: x.t1 }).con.map(c => c.serial), ['LG11010']);
  const t = x.pull().data.pbh.find(z => z.soPBH === x.pbh);
  assert.equal(JSON.parse(t.thayThe).length, 0); const hv = JSON.parse(t.huyThay); assert.equal(hv.length, 1); assert.equal(hv[0].soPhieuXuat, r.soPhieuXuat); assert.equal(t.soPhieuXuat, '');
  assert.equal(x.P('bh.replaceVoid', { soPBH: x.pbh, soPhieuXuat: r.soPhieuXuat, lyDo: 'Ghi nhầm lần nữa' }).ok, false, 'đã huỷ');
  // thay lại được sau khi huỷ
  assert.equal(x.P('bh.replace', { soPBH: x.pbh, ngay: '2026-11-13', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW2'], serialCu: ['LG11010'] }] }, x.nv).ok, true);
  const rb = x.W('stock.rebuild', {}); assert.equal(rb.tinhLai, 0); assert.deepEqual(rb.loiTonAm, []);
});

test('D3-9b huỷ lần thay: linh kiện cũ đã gửi NCC → từ chối, chưa ghi gì; chết giữa 2 phiếu đảo → gửi lại làm tiếp', () => {
  const x = warranty();
  const r = x.W('bh.replace', { soPBH: x.pbh, ngay: '2026-11-12', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'], serialCu: ['LG11010'] }] }, x.nv);
  VW(x, { loai: 'GUI_NCC', ngay: '2026-11-12', kho: 'KHO-LOI', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] });
  const bad = x.P('bh.replaceVoid', { soPBH: x.pbh, soPhieuXuat: r.soPhieuXuat, lyDo: 'Ghi nhầm linh kiện thay', ngay: '2026-11-13' });
  assert.equal(bad.ok, false); assert.equal(x.a.sheets.Phieu.d.filter(z => z[2] === 'DAO').length, 0, 'kiểm trước, chưa ghi gì');
  assert.equal(ser(x, 'LGNEW1').trangThai, 'DA_LAP');
  const y = warranty();
  const r2 = y.W('bh.replace', { soPBH: y.pbh, ngay: '2026-11-12', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'], serialCu: ['LG11010'] }] }, y.nv);
  const ph = y.a.sheets.Phieu, orig = ph.appendRow; let n = 0;
  ph.appendRow = function (row) { if (row[2] === 'DAO' && ++n === 2) { ph.appendRow = orig; throw new Error('chết trước đầu phiếu đảo thứ 2'); } return orig.call(this, row); };
  const id = rid(), body = { action: 'bh.replaceVoid', session: y.s, requestId: id, soPBH: y.pbh, soPhieuXuat: r2.soPhieuXuat, lyDo: 'Ghi nhầm linh kiện thay', ngay: '2026-11-14' };
  assert.equal(y.a.post(body).ok, false);
  const ok = y.a.post(body); assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ph.d.filter(z => z[2] === 'DAO' && z[11] === 'HOAN_TAT').length, 2, 'đảo đủ 2 phiếu của lần thay');
  assert.equal(ser(y, 'LG11010').trangThai, 'DA_LAP'); assert.equal(ser(y, 'LGNEW1').trangThai, 'TRONG_KHO');
  assert.deepEqual(y.W('serial.get', { serial: y.t1 }).con.map(c => c.serial), ['LG11010']);
  assert.equal(JSON.parse(y.pull().data.pbh.find(z => z.soPBH === y.pbh).huyThay).length, 1);
});

// ---------- thay linh kiện: gợi ý xuất bán ----------
test('D3 thay linh kiện ngoài BH vẫn lập phiếu xuất bán linh kiện rời bình thường (khách/công trình theo vị trí lắp)', () => {
  const x = warranty({ ngoai: 1 });
  assert.equal(V(x, { loai: 'XUAT_BAN', ngay: '2026-11-12', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lyDo: 'Bán linh kiện thay cho tủ ' + x.t1 + ' — phiếu BH ' + x.pbh, lines: [{ maHang: 'CONT', soLuongCT: 1 }] }).ok, true);
});

// ---------- chuyển đổi lược đồ ----------
test('D3-10 setup() nối cột mới vào sheet đang chạy (tiêu đề cũ + dữ liệu cũ), schemaCheck sạch, đọc đúng', () => {
  const a = ready(), s = a.login(), S = a.sheets;
  const NEW = { ChiTietPhieu: ['serialsDoi'], HoSoTu: ['lichSu'], PhieuXuatXuong: ['traLai'], PhieuBaoHanh: ['soLuong', 'phieuGoc', 'maKH', 'phiSua', 'hinhThuc', 'huyThay'] };
  for (const [n, cols] of Object.entries(NEW)) {
    const h = S[n].d[0]; assert.deepEqual(h.slice(-cols.length), cols, n + ' có cột mới');
    S[n].d[0] = h.slice(0, h.length - cols.length);   // giả lập sheet bản 0.4.2
  }
  S.PhieuBaoHanh.d.push(['BH-2026-00001', 'LV-X-2026-0001', 'LAVIPCO|LV-X-2026-0001', 'TU', 'LV-X-2026-0001', '2026-11-01', '', 'Lỗi', 'TRONG_BH', '2027-10-31', 'TIEP_NHAN', '', '', '', '[]', '', '', 'a@b', '', '2026-11-01T00:00:00Z', '', 'rq1', '']);
  assert.ok(a.post({ action: 'admin.schemaCheck', session: s }).data.errors.length > 0, 'trước setup: lệch cấu trúc');
  a.setup();
  for (const [n, cols] of Object.entries(NEW)) assert.deepEqual(S[n].d[0].slice(-cols.length), cols, n + ' đã nối');
  assert.deepEqual(a.post({ action: 'admin.schemaCheck', session: s }).data.errors, []);
  const t = a.post({ action: 'sync.pull', session: s }).data.data.pbh[0]; assert.deepEqual([t.soPBH, t.trangThai, t.soLuong, t.huyThay], ['BH-2026-00001', 'TIEP_NHAN', '', '']);
  // cột > 26 (AA, AB…) được định dạng văn bản đúng chữ cái cột
  const cols = Object.keys(S.PhieuBaoHanh.txt).map(Number); assert.ok(cols.includes(QSchemaIdx('PhieuBaoHanh', 'huyThay')), 'huyThay dạng văn bản');
});
function QSchemaIdx(n, c) { return require('../core/schema.js').SHEETS[n].cols.indexOf(c); }

// ---------- toàn vẹn ----------
test('D3-11 xuất huỷ có serial: gửi lại cùng requestId → 1 phiếu; chết trước đầu phiếu → dọn, serial về kho', () => {
  const x = plant(); x.buy('2026-11-01', 2);
  const id = rid(), body = { action: 'voucher.create', session: x.nv, requestId: id, voucher: { loai: 'XUAT_HUY', ngay: '2026-11-03', kho: 'KHO', lyDo: 'Hỏng', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] } };
  const a = x.a.post(body); x.a.cache && Object.keys(x.a.cache).forEach(k => { if (/^done:|^req:/.test(k)) delete x.a.cache[k]; });
  const b = x.a.post(body); assert.equal(a.data.soPhieu, b.data.soPhieu);
  assert.equal(x.a.sheets.Phieu.d.filter(z => z[2] === 'XUAT_HUY').length, 1);
  const ph = x.a.sheets.Phieu, orig = ph.appendRow;
  ph.appendRow = function (r) { if (r[2] === 'XUAT_HUY') { ph.appendRow = orig; throw new Error('chết trước đầu phiếu'); } return orig.call(this, r); };
  assert.equal(V(x, { loai: 'XUAT_HUY', ngay: '2026-11-04', kho: 'KHO', lyDo: 'Hỏng', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11011'] }] }).ok, false);
  VW(x, { loai: 'NHAP_KHAC', ngay: '2026-11-05', kho: 'KHO', lyDo: 'Thừa', lines: [{ maHang: 'DEN', soLuongCT: 1, gia: 1000 }] });
  assert.equal(ser(x, 'LG11011').trangThai, 'TRONG_KHO', 'phiếu dở được dọn'); assert.deepEqual(ton(x, 'LOGO'), [1, 4150000]);
});
