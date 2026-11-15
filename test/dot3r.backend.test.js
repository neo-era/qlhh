// Đợt 3 — duyệt vòng 1: tái hiện các phát hiện của 2 chuyên gia (kế toán /tmp/rv-kt/s1,s2; kỹ thuật /tmp/rv-kt2 R1..R10) — viết TRƯỚC khi sửa.
const test = require('node:test'), assert = require('node:assert');
const { rid, ready } = require('./gas-mock.js');
const { plant, built } = require('./sx-fixture.js');

const V = (x, v, who) => x.P('voucher.create', { voucher: v }, who || x.nv);
const VW = (x, v, who) => { const r = V(x, v, who); assert.equal(r.ok, true, JSON.stringify(r)); return r.data.soPhieu; };
const ser = (x, s) => x.W('serial.get', { serial: s }).serial;
const tonK = (x, ma, kho) => { const t = x.pull().data.stock.find(z => z.maHang === ma && z.kho === kho); return t ? Number(t.soLuong) : 0; };
const ton = (x, ma) => { const t = x.ton(ma); return t ? [Number(t.soLuong), Number(t.giaTri)] : [0, 0]; };
const pbhOf = (x, so) => x.pull().data.pbh.find(z => z.soPBH === so);
function lamps(n = 10) {
  const x = plant();
  x.W('item.upsert', { isNew: true, item: { maHang: 'DEN-LED', ten: 'Đèn LED', dvt: 'bộ', thangBH: 24 } });
  VW(x, { loai: 'NHAP_MUA', ngay: '2026-11-01', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'DEN-LED', soLuongCT: 20, gia: 1000000 }] }, x.s);
  const px = VW(x, { loai: 'XUAT_BAN', ngay: '2026-11-02', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'DEN-LED', soLuongCT: n }] });
  return { ...x, px };
}
const custLogo = () => { const x = plant(); x.buy('2026-11-01', 2);
  VW(x, { loai: 'XUAT_BAN', ngay: '2026-11-02', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] });
  const hl = VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-03', kho: 'KHO-LOI', maKH: 'TN', lyDo: 'Khách gửi sửa', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] });
  return { ...x, hl }; };

// ---------- kế toán B1 / kỹ thuật A2: hàng của khách không lọt vào tồn công ty ----------
test('KT-B1/A2 hàng khách (nhận lỗi có mã khách) không chuyển kho thường / xuất huỷ / gửi NCC như hàng công ty', () => {
  const x = lamps();
  VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-03', kho: 'KHO-LOI', maKH: 'TN', lyDo: 'Khách gửi sửa', lines: [{ maHang: 'DEN-LED', soLuongCT: 3 }] });
  const cs = V(x, { loai: 'CHUYEN_SUA', ngay: '2026-11-04', kho: 'KHO-LOI', khoDen: 'KHO', lyDo: 'Sửa xong', lines: [{ maHang: 'DEN-LED', soLuongCT: 2, gia: 900000 }] });
  assert.equal(cs.ok, false); assert.match(cs.error, /của khách/);
  assert.equal(V(x, { loai: 'XUAT_HUY', ngay: '2026-11-04', kho: 'KHO-LOI', lyDo: 'Hỏng', lines: [{ maHang: 'DEN-LED', soLuongCT: 1 }] }).ok, false);
  assert.equal(V(x, { loai: 'GUI_NCC', ngay: '2026-11-04', kho: 'KHO-LOI', maNCC: 'NCC1', lines: [{ maHang: 'DEN-LED', soLuongCT: 1 }] }).ok, false, 'gửi NCC hàng khách phải ghi mã khách');
  VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-04', kho: 'KHO-LOI', lyDo: 'Thu hồi', lines: [{ maHang: 'DEN-LED', soLuongCT: 1 }] });   // 1 bộ của công ty
  assert.equal(V(x, { loai: 'XUAT_HUY', ngay: '2026-11-05', kho: 'KHO-LOI', lyDo: 'Hỏng', lines: [{ maHang: 'DEN-LED', soLuongCT: 2 }] }).ok, false, 'chỉ 1 bộ của công ty');
  VW(x, { loai: 'CHUYEN_SUA', ngay: '2026-11-05', kho: 'KHO-LOI', khoDen: 'KHO', lyDo: 'Sửa xong', lines: [{ maHang: 'DEN-LED', soLuongCT: 1, gia: 0 }] });
  assert.equal(tonK(x, 'DEN-LED', 'KHO-LOI'), 3);
});
test('KT-B1/A2 serial của khách: chuyển về kho thường / xuất huỷ bị chặn; trả khách được', () => {
  const x = custLogo();
  const cs = V(x, { loai: 'CHUYEN_SUA', ngay: '2026-11-04', kho: 'KHO-LOI', khoDen: 'KHO', lyDo: 'Đã sửa', lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 4000000, serials: ['LG11010'] }] });
  assert.equal(cs.ok, false); assert.match(cs.error, /của khách/);
  assert.equal(V(x, { loai: 'XUAT_HUY', ngay: '2026-11-04', kho: 'KHO-LOI', lyDo: 'Hỏng', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] }).ok, false);
  VW(x, { loai: 'TRA_KHACH_SUA', ngay: '2026-11-05', kho: 'KHO-LOI', phieuGoc: x.hl, lyDo: 'Trả', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] });
  assert.equal(ser(x, 'LG11010').trangThai, 'DA_BAN');
});
test('KT-B1 + B2 gửi NCC hàng khách (serial): phiếu gửi tự ghi mã khách; nhận về chỉ vào kho lỗi; NCC đổi serial → trả khách bằng serial mới', () => {
  const x = custLogo();
  const gn = VW(x, { loai: 'GUI_NCC', ngay: '2026-11-04', kho: 'KHO-LOI', maNCC: 'NCC1', lyDo: 'g', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] });
  assert.equal(x.W('voucher.get', { soPhieu: gn }).phieu.maKH, 'TN');
  const bad = V(x, { loai: 'NHAN_NCC', ngay: '2026-11-05', kho: 'KHO', maNCC: 'NCC1', phieuGoc: gn, lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 4000000, serials: ['LG11010'] }] });
  assert.equal(bad.ok, false); assert.match(bad.error, /kho hàng lỗi/);
  const nn = VW(x, { loai: 'NHAN_NCC', ngay: '2026-11-05', kho: 'KHO-LOI', maNCC: 'NCC1', phieuGoc: gn, lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 0, serials: ['LGNEWX'], serialsDoi: ['LG11010'] }] });
  assert.equal(x.W('voucher.get', { soPhieu: nn }).phieu.maKH, 'TN');
  assert.equal(V(x, { loai: 'CHUYEN_SUA', ngay: '2026-11-06', kho: 'KHO-LOI', khoDen: 'KHO', lyDo: 'x', lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 0, serials: ['LGNEWX'] }] }).ok, false, 'serial NCC đổi vẫn là của khách');
  const ts = V(x, { loai: 'TRA_KHACH_SUA', ngay: '2026-11-06', kho: 'KHO-LOI', phieuGoc: x.hl, lyDo: 'trả', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LGNEWX'] }] });
  assert.equal(ts.ok, true, JSON.stringify(ts)); assert.equal(ser(x, 'LGNEWX').trangThai, 'DA_BAN');
});
test('KT-B1 hàng khách không serial gửi NCC (ghi mã khách) → nhận về kho lỗi → trả đủ; trả khi hàng còn ở NCC → chặn', () => {
  const x = lamps();
  const hl = VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-03', kho: 'KHO-LOI', maKH: 'TN', lyDo: 'Khách gửi sửa', lines: [{ maHang: 'DEN-LED', soLuongCT: 3 }] });
  const gn = VW(x, { loai: 'GUI_NCC', ngay: '2026-11-04', kho: 'KHO-LOI', maNCC: 'NCC1', maKH: 'TN', lyDo: 'g', lines: [{ maHang: 'DEN-LED', soLuongCT: 2 }] });
  assert.equal(V(x, { loai: 'TRA_KHACH_SUA', ngay: '2026-11-05', kho: 'KHO-LOI', phieuGoc: hl, lyDo: 't', lines: [{ maHang: 'DEN-LED', soLuongCT: 3 }] }).ok, false, '2 bộ còn ở NCC');
  VW(x, { loai: 'NHAN_NCC', ngay: '2026-11-06', kho: 'KHO-LOI', maNCC: 'NCC1', phieuGoc: gn, lines: [{ maHang: 'DEN-LED', soLuongCT: 2, gia: 0 }] });
  VW(x, { loai: 'TRA_KHACH_SUA', ngay: '2026-11-07', kho: 'KHO-LOI', phieuGoc: hl, lyDo: 't', lines: [{ maHang: 'DEN-LED', soLuongCT: 3 }] });
  assert.equal(tonK(x, 'DEN-LED', 'KHO-LOI'), 0);
});

// ---------- kế toán B3 / kỹ thuật A1: bảo hành hàng không serial khống chế số lượng ----------
test('KT-B3/A1 phiếu BH không serial cộng dồn không vượt số đã xuất; đổi không vượt số trên phiếu BH, kể cả nhiều lần', () => {
  const x = lamps();
  const a = x.P('bh.create', { hangLe: { phieuXuat: x.px, maHang: 'DEN-LED', soLuong: 8 }, phieu: { ngay: '2026-11-10', moTaLoi: 'a' } }, x.nv);
  assert.equal(a.ok, true);
  const b = x.P('bh.create', { hangLe: { phieuXuat: x.px, maHang: 'DEN-LED', soLuong: 8 }, phieu: { ngay: '2026-11-10', moTaLoi: 'b' } }, x.nv);
  assert.equal(b.ok, false); assert.match(b.error, /2/);
  assert.equal(x.P('bh.replace', { soPBH: a.data.soPBH, ngay: '2026-11-10', kho: 'KHO', lines: [{ maHang: 'DEN-LED', soLuong: 9 }] }, x.nv).ok, false, 'đổi 9 trên phiếu 8');
  assert.equal(x.P('bh.replace', { soPBH: a.data.soPBH, ngay: '2026-11-10', kho: 'KHO', lines: [{ maHang: 'DEN-LED', soLuong: 8 }] }, x.nv).ok, true);
  assert.equal(x.P('bh.replace', { soPBH: a.data.soPBH, ngay: '2026-11-11', kho: 'KHO', lines: [{ maHang: 'DEN-LED', soLuong: 1 }] }, x.nv).ok, false, 'đã đổi đủ 8');
  // phiếu từ chối không chiếm số lượng
  const c = x.W('bh.create', { hangLe: { phieuXuat: x.px, maHang: 'DEN-LED', soLuong: 2 }, phieu: { ngay: '2026-11-11', moTaLoi: 'c' } }, x.nv);
  x.W('bh.update', { soPBH: c.soPBH, trangThai: 'TU_CHOI', ketQua: 'Không lỗi', nguyenNhan: 'KHAC' }, x.nv);
  assert.equal(x.P('bh.create', { hangLe: { phieuXuat: x.px, maHang: 'DEN-LED', soLuong: 2 }, phieu: { ngay: '2026-11-12', moTaLoi: 'd' } }, x.nv).ok, true);
});

// ---------- kế toán B4: báo cáo BH tôn trọng kỳ đã khoá ----------
test('KT-B4 báo cáo chi phí BH: huỷ lần thay ở kỳ sau không sửa kỳ đã khoá (dòng âm ở kỳ phiếu đảo)', () => {
  const x = lamps();
  const b = x.W('bh.create', { hangLe: { phieuXuat: x.px, maHang: 'DEN-LED', soLuong: 2 }, phieu: { ngay: '2026-11-03', moTaLoi: 'x' } }, x.nv);
  const r = x.W('bh.replace', { soPBH: b.soPBH, ngay: '2026-11-03', kho: 'KHO', lines: [{ maHang: 'DEN-LED', soLuong: 2 }] }, x.nv);
  const t1 = x.W('report.bh', { from: '2026-11-01', to: '2026-11-05' }).tong; assert.equal(t1, 2000000);
  x.W('period.lock', { ngay: '2026-11-05' });
  x.W('bh.replaceVoid', { soPBH: b.soPBH, soPhieuXuat: r.soPhieuXuat, lyDo: 'Ghi nhầm phiếu bảo hành', ngay: '2026-11-10' });
  assert.equal(x.W('report.bh', { from: '2026-11-01', to: '2026-11-05' }).tong, 2000000, 'kỳ đã khoá giữ nguyên');
  const k2 = x.W('report.bh', { from: '2026-11-06', to: '2026-11-14' }); assert.equal(k2.tong, -2000000); assert.ok(k2.rows.some(z => z.giaTri === -2000000 && z.dao));
  assert.equal(x.W('report.bh', { from: '2026-11-01', to: '2026-11-14' }).tong, 0);
});

// ---------- kế toán B5 + C4 ----------
test('KT-B5 huỷ lần thay sửa thu tiền → bỏ phí sửa + hình thức; C4 doanh thu sửa theo ngày hoàn thành, gồm phiếu từ chối có phí', () => {
  const x = lamps();
  const b = x.W('bh.create', { hangLe: { phieuXuat: x.px, maHang: 'DEN-LED', soLuong: 1 }, phieu: { ngay: '2026-11-03', moTaLoi: 'x' } }, x.nv);
  x.W('bh.update', { soPBH: b.soPBH, trangThai: 'DANG_XU_LY', nguyenNhan: 'SET_DANH' }, x.nv);
  const r = x.W('bh.replace', { soPBH: b.soPBH, ngay: '2026-11-04', kho: 'KHO', hinhThuc: 'THU_TIEN', phiSua: 500000, lines: [{ maHang: 'DEN-LED', soLuong: 1 }] }, x.nv);
  x.W('bh.replaceVoid', { soPBH: b.soPBH, soPhieuXuat: r.soPhieuXuat, lyDo: 'Khách không đồng ý sửa', ngay: '2026-11-05' });
  const t = pbhOf(x, b.soPBH); assert.equal(t.phiSua, ''); assert.equal(t.hinhThuc, '');
  x.W('bh.update', { soPBH: b.soPBH, trangThai: 'TU_CHOI', ketQua: 'Trả lại, thu phí kiểm tra', nguyenNhan: 'SET_DANH', phiSua: 200000, ngay: '2026-11-06' }, x.nv);
  assert.equal(pbhOf(x, b.soPBH).ngayDong, '2026-11-06', 'ngày hoàn thành do người dùng ghi');
  const rep = x.W('report.bh', { from: '2026-11-01', to: '2026-11-06' }); assert.equal(rep.phiSua, 200000, 'phí phiếu từ chối có thu');
  assert.equal(x.W('report.bh', { from: '2026-11-07', to: '2026-11-30' }).phiSua, 0);
  assert.equal(x.P('bh.update', { soPBH: 'x', trangThai: 'HOAN_THANH' }).ok, false);
});

// ---------- kế toán C1: huỷ lần thay của chu kỳ cũ ----------
test('KT-C1 huỷ lần thay bị chặn khi tủ đã khách trả (kể cả đã bán khách mới)', () => {
  const x = built(), [t1] = x.tp.serials;
  x.W('customer.upsert', { isNew: true, customer: { maKH: 'KH2', ten: 'K2' } }); x.W('project.upsert', { isNew: true, project: { maCongTrinh: 'CT2', ten: 'c', maKH: 'KH2' } });
  x.W('kcs.add', { serial: t1, ngay: '2026-11-09', ketQua: x.pass() }, x.nv);
  const px = VW(x, { loai: 'XUAT_BAN', ngay: '2026-11-09', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [t1] }] });
  x.W('install.add', { serial: t1, lapDat: { loai: 'BAN_GIAO', ngay: '2026-11-10', maKH: 'TN', maCongTrinh: 'PDG', diaChi: 'H' } }, x.nv);
  VW(x, { loai: 'NHAP_MUA', ngay: '2026-11-10', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 4200000, serials: ['LGNEW1'] }] }, x.s);
  const pbh = x.W('bh.create', { serial: t1, phieu: { ngay: '2026-11-11', moTaLoi: 'x' } }, x.nv).soPBH;
  const r = x.W('bh.replace', { soPBH: pbh, ngay: '2026-11-11', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'], serialCu: ['LG11010'] }] }, x.nv);
  VW(x, { loai: 'KHACH_TRA', ngay: '2026-11-12', kho: 'KHO', phieuGoc: px, lyDo: 'trả', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [t1] }] });
  const v = x.P('bh.replaceVoid', { soPBH: pbh, soPhieuXuat: r.soPhieuXuat, lyDo: 'Ghi nhầm linh kiện thay', ngay: '2026-11-13' });
  assert.equal(v.ok, false); assert.match(v.error, /khách trả/);
  x.W('kcs.add', { serial: t1, ngay: '2026-11-13', ketQua: x.pass() }, x.nv);
  VW(x, { loai: 'XUAT_BAN', ngay: '2026-11-13', kho: 'KHO', maKH: 'KH2', maCongTrinh: 'CT2', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [t1] }] });
  assert.equal(x.P('bh.replaceVoid', { soPBH: pbh, soPhieuXuat: r.soPhieuXuat, lyDo: 'Ghi nhầm linh kiện thay', ngay: '2026-11-14' }).ok, false);
  assert.deepEqual(x.W('serial.get', { serial: t1 }).con.map(c => c.serial), ['LGNEW1']);
});

// ---------- kế toán C2: kiểm kê kho lỗi, chuyển hàng hỏng kho thường → kho lỗi ----------
test('KT-C2 kiểm kê kho hàng lỗi (giá 0); chuyển hàng hỏng sang kho lỗi (giá trị rời giá vốn theo BQ, đảo được)', () => {
  const x = plant(); x.buy('2026-11-01', 1); x.W('item.upsert', { isNew: true, item: { maHang: 'CBX', ten: 'CB thử', dvt: 'cái' } });
  VW(x, { loai: 'NHAP_MUA', ngay: '2026-11-01', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'CBX', soLuongCT: 5, gia: 100000 }] }, x.s);
  assert.equal(V(x, { loai: 'CHUYEN_LOI', ngay: '2026-11-02', kho: 'KHO', khoDen: 'KHO-LOI', lines: [{ maHang: 'CBX', soLuongCT: 1 }] }).code, 'VALIDATION', 'lý do bắt buộc');
  const cl = VW(x, { loai: 'CHUYEN_LOI', ngay: '2026-11-02', kho: 'KHO', khoDen: 'KHO-LOI', lyDo: 'Hỏng khi lắp thử', lines: [{ maHang: 'CBX', soLuongCT: 1 }] });
  const cb6 = ton(x, 'CBX'); assert.equal(cb6[0], 4, 'tồn giá vốn không gồm kho lỗi'); assert.equal(tonK(x, 'CBX', 'KHO-LOI'), 1); assert.equal(tonK(x, 'CBX', 'KHO'), 4);
  assert.equal(x.W('voucher.get', { soPhieu: cl }).lines[0].giaTriKho, 100000);
  const totalVal = x.ton('CBX'); assert.equal(Number(totalVal.giaTri), 400000, 'giá trị kho thường giảm theo BQ');
  x.W('voucher.reverse', { phieuGoc: cl, ngay: '2026-11-03', lyDo: 'nhầm' }); assert.equal(Number(x.ton('CBX').giaTri), 500000, 'đảo: giá trị về như cũ'); assert.equal(tonK(x, 'CBX', 'KHO-LOI'), 0);
  VW(x, { loai: 'CHUYEN_LOI', ngay: '2026-11-04', kho: 'KHO', khoDen: 'KHO-LOI', lyDo: 'Hỏng khi lắp thử', lines: [{ maHang: 'CBX', soLuongCT: 1 }] });
  VW(x, { loai: 'CHUYEN_LOI', ngay: '2026-11-04', kho: 'KHO', khoDen: 'KHO-LOI', lyDo: 'LOGO! hỏng', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11010'] }] });
  assert.deepEqual([ser(x, 'LG11010').trangThai, ser(x, 'LG11010').kho], ['HANG_LOI', 'KHO-LOI']);
  const kk = V(x, { loai: 'KIEM_KE', ngay: '2026-11-05', kho: 'KHO-LOI', lyDo: 'Kiểm kho lỗi', lines: [{ maHang: 'CBX', slThucTe: 0 }] });
  assert.equal(kk.ok, true, JSON.stringify(kk)); assert.equal(tonK(x, 'CBX', 'KHO-LOI'), 0); assert.equal(x.W('voucher.get', { soPhieu: kk.data.soPhieu }).lines[0].giaTriKho, 0);
  const kk2 = V(x, { loai: 'KIEM_KE', ngay: '2026-11-05', kho: 'KHO-LOI', lyDo: 'Thừa serial', lines: [{ maHang: 'LOGO', slThucTe: 2, serials: ['LGTHUA1'] }] });
  assert.equal(kk2.ok, true, JSON.stringify(kk2)); assert.deepEqual([ser(x, 'LGTHUA1').trangThai, ser(x, 'LGTHUA1').kho], ['HANG_LOI', 'KHO-LOI']);
  const n = x.W('report.nxt', { from: '2026-11-01', to: '2026-11-30' }).rows.find(z => z.maHang === 'CBX'); assert.deepEqual(n.theoLoai.CHUYEN_LOI, { q: 1, v: 100000 }, 'lần chuyển đã đảo trừ ra');
  const rb = x.W('stock.rebuild', {}); assert.equal(rb.tinhLai, 0); assert.deepEqual(rb.loiTonAm, []);
});

// ---------- kế toán C3: báo cáo kho lỗi tách hàng giữ hộ khách ----------
test('KT-C3 báo cáo kho lỗi tách số lượng / serial của khách', () => {
  const x = custLogo();
  VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-03', kho: 'KHO-LOI', lyDo: 'Thu hồi', lines: [{ maHang: 'DEN', soLuongCT: 2 }] });
  VW(x, { loai: 'NHAP_HANG_LOI', ngay: '2026-11-03', kho: 'KHO-LOI', maKH: 'TN', lyDo: 'Khách', lines: [{ maHang: 'DEN', soLuongCT: 1 }] });
  const R = x.W('report.loi', {}, x.xem).rows, d = R.find(r => r.maHang === 'DEN'), l = R.find(r => r.maHang === 'LOGO');
  assert.deepEqual(d.cuaKhach, [{ maKH: 'TN', soLuong: 1, serials: [] }]); assert.equal(d.congTy, 2);
  assert.deepEqual(l.cuaKhach, [{ maKH: 'TN', soLuong: 1, serials: ['LG11010'] }]); assert.equal(l.congTy, 0);
});

// ---------- kế toán C5 ----------
test('KT-C5 còn bảo hành miễn phí mà chọn thu tiền → chỉ Quản trị', () => {
  const x = lamps();
  const b = x.W('bh.create', { hangLe: { phieuXuat: x.px, maHang: 'DEN-LED', soLuong: 1 }, phieu: { ngay: '2026-11-03', moTaLoi: 'x' } }, x.nv);
  const r = x.P('bh.replace', { soPBH: b.soPBH, ngay: '2026-11-04', kho: 'KHO', hinhThuc: 'THU_TIEN', phiSua: 1, lines: [{ maHang: 'DEN-LED', soLuong: 1 }] }, x.nv);
  assert.equal(r.ok, false); assert.match(r.error, /còn bảo hành/i);
  assert.equal(x.P('bh.replace', { soPBH: b.soPBH, ngay: '2026-11-04', kho: 'KHO', hinhThuc: 'THU_TIEN', phiSua: 1, lines: [{ maHang: 'DEN-LED', soLuong: 1 }] }).ok, true);
});

// ---------- kỹ thuật B1: huỷ lần thay dở, làm lại với requestId mới ----------
test('KTh-B1 huỷ lần thay chết giữa 2 phiếu đảo, làm lại bằng requestId MỚI → làm tiếp, không kẹt', () => {
  const y = built(), [t1] = y.tp.serials;
  y.W('kcs.add', { serial: t1, ngay: '2026-11-09', ketQua: y.pass() }, y.nv);
  VW(y, { loai: 'XUAT_BAN', ngay: '2026-11-09', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [t1] }] });
  y.W('install.add', { serial: t1, lapDat: { loai: 'BAN_GIAO', ngay: '2026-11-10', maKH: 'TN', maCongTrinh: 'PDG', diaChi: 'H' } }, y.nv);
  VW(y, { loai: 'NHAP_MUA', ngay: '2026-11-10', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 4200000, serials: ['LGNEW1'] }] }, y.s);
  const pbh = y.W('bh.create', { serial: t1, phieu: { ngay: '2026-11-11', moTaLoi: 'x' } }, y.nv).soPBH;
  const r = y.W('bh.replace', { soPBH: pbh, ngay: '2026-11-12', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'], serialCu: ['LG11010'] }] }, y.nv);
  const ph = y.a.sheets.Phieu, orig = ph.appendRow; let n = 0;
  ph.appendRow = function (row) { if (row[2] === 'DAO' && ++n === 2) { ph.appendRow = orig; throw new Error('chết'); } return orig.call(this, row); };
  const body = { soPBH: pbh, soPhieuXuat: r.soPhieuXuat, lyDo: 'Ghi nhầm linh kiện thay', ngay: '2026-11-14' };
  assert.equal(y.P('bh.replaceVoid', body).ok, false);
  const again = y.P('bh.replaceVoid', body); assert.equal(again.ok, true, JSON.stringify(again));
  assert.equal(ph.d.filter(z => z[2] === 'DAO' && z[11] === 'HOAN_TAT').length, 2);
  assert.deepEqual(y.W('serial.get', { serial: t1 }).con.map(c => c.serial), ['LG11010']);
  assert.equal(pbhOf(y, pbh).soPhieuXuat, '');
});

// ---------- kỹ thuật C1: setup báo rõ cột lạ ----------
test('KTh-C1 setup() gặp cột tự đặt sau cột cuối của sheet cũ → báo lỗi nêu sheet + cột, không im lặng', () => {
  const a = ready(), S = a.sheets;
  S.PhieuBaoHanh.d[0] = S.PhieuBaoHanh.d[0].slice(0, 23).concat(['Ghi chú kế toán']);
  assert.throws(() => a.setup(), /PhieuBaoHanh.*Ghi chú kế toán/);
});
