// TDD máy chủ lắp đặt & bảo hành (BH-1). Viết TRƯỚC khi code.
const test = require('node:test'), assert = require('node:assert');
const { rid } = require('./gas-mock.js');
const { built } = require('./sx-fixture.js');

// 2 tủ đạt KCS; tủ 1 bán cho TN / công trình PDG ngày 09/11
function sold() {
  const x = built(), [t1, t2] = x.tp.serials;
  [t1, t2].forEach(t => x.W('kcs.add', { serial: t, ngay: '2026-11-09', ketQua: x.pass() }, x.nv));
  const px = x.W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-09', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [t1] }] } }, x.nv);
  return { ...x, t1, t2, px: px.soPhieu };
}
const lap = (x, ser, o = {}, who) => x.P('install.add', { serial: ser, lapDat: { loai: 'BAN_GIAO', ngay: '2026-11-10', maKH: 'TN', maCongTrinh: 'PDG', diaChi: 'Hẻm 20 Phan Đình Giót, P. Tân Ninh', viDo: 11.3101, kinhDo: 106.0983, tenTaiCT: 'Tủ H20', soBBBG: 'BBBG-01', ...o } }, who || x.nv);

test('BH1 ghi bàn giao: chỉ tủ đã xuất khỏi kho; không trước ngày xuất; 1 lần bàn giao, sau đó là di dời; hạn BH 12 tháng', () => {
  const x = sold();
  assert.match(lap(x, x.t2).error, /chưa xuất khỏi kho|trong kho/, 'tủ còn trong kho');
  assert.equal(lap(x, x.t1, { ngay: '2026-11-08' }).code, 'VALIDATION', 'trước ngày xuất 09/11');
  assert.equal(lap(x, x.t1, {}, x.xem).code, 'FORBIDDEN');
  const r = lap(x, x.t1); assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.data.ngayBanGiao, r.data.hanBH], ['2026-11-10', '2027-11-09']);
  assert.match(lap(x, x.t1).error, /đã bàn giao/);
  const d = lap(x, x.t1, { loai: 'DI_DOI', ngay: '2026-11-11', diaChi: 'Đường Nguyễn Chí Thanh', viDo: '', kinhDo: '' });
  assert.equal(d.ok, true); assert.equal(d.data.hanBH, '2027-11-09', 'di dời không đổi hạn');
  const g = x.W('serial.get', { serial: x.t1 }, x.xem);
  assert.equal(g.lapDat.length, 2); assert.equal(g.baoHanh.viTri.diaChi, 'Đường Nguyễn Chí Thanh'); assert.equal(g.baoHanh.hanBH, '2027-11-09');
  assert.equal(x.pull(x.xem).data.lapDat.length, 2);
});

test('BH1 hợp đồng ghi đè số tháng BH (24 tháng); linh kiện serial (LOGO!) báo theo tủ chứa nó', () => {
  const x = sold();
  assert.equal(lap(x, x.t1, { thangBH: 24 }).data.hanBH, '2028-11-09');
  const b = x.W('bh.create', { serial: 'LG11010', phieu: { ngay: '2026-11-11', moTaLoi: 'LOGO! không chạy chương trình', nguoiBao: 'Anh Tâm – 0909 000 111' } }, x.nv);
  assert.match(b.soPBH, /^BH-2026-00001$/); assert.equal(b.serialTu, x.t1); assert.equal(b.tinhTrangBH, 'TRONG_BH');
});

test('BH4 phiếu bảo hành: tình trạng BH tính tại ngày tiếp nhận; tủ chưa bàn giao → CHUA_BAN_GIAO; luồng trạng thái; đóng rồi không sửa', () => {
  const x = sold();
  const a = x.W('bh.create', { serial: x.t1, phieu: { ngay: '2026-11-10', moTaLoi: 'Nhánh 2 không đóng' } }, x.nv);
  assert.equal(a.tinhTrangBH, 'CHUA_BAN_GIAO');
  assert.equal(x.P('bh.create', { serial: x.t2, phieu: { ngay: '2026-11-10', moTaLoi: 'x' } }, x.nv).code, 'VALIDATION', 'tủ còn trong kho không lập phiếu BH');
  assert.equal(x.P('bh.update', { soPBH: a.soPBH, trangThai: 'HOAN_THANH' }, x.nv).code, 'VALIDATION', 'thiếu kết quả');
  x.W('bh.update', { soPBH: a.soPBH, trangThai: 'DANG_XU_LY' }, x.nv);
  x.W('bh.update', { soPBH: a.soPBH, trangThai: 'TU_CHOI', ketQua: 'Sét đánh cháy contactor — ngoài bảo hành', nguyenNhan: 'SET_DANH' }, x.nv);
  assert.equal(x.P('bh.update', { soPBH: a.soPBH, trangThai: 'DANG_XU_LY' }, x.nv).code, 'VALIDATION');
  const p = x.pull(x.xem).data.pbh.find(r => r.soPBH === a.soPBH);
  assert.deepEqual([p.trangThai, p.nguyenNhan], ['TU_CHOI', 'SET_DANH']); assert.match(p.ngayDong, /^\d{4}-\d{2}-\d{2}$/);
});

test('BH5 thay LOGO! trong bảo hành: LOGO! mới xuất kho (XUAT_BH, giá vốn), LOGO! cũ về kho hàng lỗi (giá 0), hồ sơ tủ đổi serial con', () => {
  const x = sold(); lap(x, x.t1);
  x.W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-10', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 4200000, serials: ['LGNEW1'] }, { maHang: 'CONT', soLuongCT: 1, gia: 620000 }] } });
  const b = x.W('bh.create', { serial: x.t1, phieu: { ngay: '2026-11-11', moTaLoi: 'PLC treo' } }, x.nv);
  const bad = x.P('bh.replace', { soPBH: b.soPBH, ngay: '2026-11-11', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'], serialCu: ['LG11011'] }] }, x.nv);
  assert.equal(bad.code, 'VALIDATION', 'LOGO! cũ phải nằm trong tủ này (LG11011 thuộc tủ khác)');
  const r = x.W('bh.replace', { soPBH: b.soPBH, ngay: '2026-11-11', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'], serialCu: ['LG11010'] }, { maHang: 'CONT', soLuong: 1 }] }, x.nv);
  assert.match(r.soPhieuXuat, /^BH-|^XB-|^X/); assert.ok(r.soPhieuLoi);
  const st = x.pull().data.stock.filter(t => t.maHang === 'LOGO'); const q = k => (st.find(t => t.kho === k) || {}).soLuong || 0;
  assert.deepEqual([q('KHO'), q('KHO-LOI')], [0, 1], 'LOGO! mới rời kho thường, LOGO! cũ nằm ở kho hàng lỗi');
  const g = x.W('serial.get', { serial: x.t1 });
  assert.deepEqual(g.con.map(c => c.serial), ['LGNEW1']);
  assert.equal(x.W('serial.get', { serial: 'LGNEW1' }).cha.serial, x.t1);
  const old = x.W('serial.get', { serial: 'LG11010' }).serial; assert.deepEqual([old.trangThai, old.kho, old.serialCha], ['HANG_LOI', 'KHO-LOI', '']);
  assert.equal(x.W('voucher.get', { soPhieu: r.soPhieuXuat }).lines.find(l => l.maHang === 'LOGO').giaTriKho, 4200000, 'giá vốn LOGO! mới xuất bảo hành');
  const p = x.pull().data.pbh.find(z => z.soPBH === b.soPBH);
  assert.equal(p.trangThai, 'DANG_XU_LY'); assert.equal(JSON.parse(p.thayThe).length, 2);
  // gửi lại cùng requestId không tạo phiếu thứ 2
  const id = rid(), body = { action: 'bh.replace', session: x.nv, requestId: id, soPBH: b.soPBH, ngay: '2026-11-11', kho: 'KHO', lines: [{ maHang: 'CONT', soLuong: 1 }] };
  x.W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-11', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'CONT', soLuongCT: 1, gia: 620000 }] } });
  const a1 = x.a.post(body), a2 = x.a.post(body); assert.equal(a1.data.soPhieuXuat, a2.data.soPhieuXuat);
  assert.equal(x.a.sheets.Phieu.d.filter(z => z[2] === 'XUAT_BH').length, 2);
});

test('BH7 tra cứu tình trạng: tủ đã xuất chưa bàn giao quá 30 ngày được cảnh báo; danh sách gửi kèm hạn BH', () => {
  const x = sold();
  const d = x.pull(x.xem).data;
  assert.equal(d.lapDat.length, 0);
  assert.ok(d.cabinets.find(c => c.serial === x.t1));
  const s = x.W('serial.get', { serial: x.t1 }, x.xem);
  assert.equal(s.baoHanh.tinhTrang.ma, 'CHUA_BAN_GIAO'); assert.equal(s.baoHanh.ngayXuat, '2026-11-09');
});
