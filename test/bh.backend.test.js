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

test('khách trả tủ rồi bán lại → chu kỳ bảo hành mới (bàn giao lại được, hạn tính từ lần bàn giao mới)', () => {
  const x = sold(); lap(x, x.t1);
  x.W('voucher.create', { voucher: { loai: 'KHACH_TRA', ngay: '2026-11-10', kho: 'KHO', maKH: 'TN', phieuGoc: x.px, lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, dongGoc: 1, serials: [x.t1] }] } });
  assert.equal(x.W('serial.get', { serial: x.t1 }).baoHanh.ngayBanGiao, undefined, 'tủ về kho → hết chu kỳ cũ');
  x.W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-11', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.t1] }] } });
  const r = lap(x, x.t1, { ngay: '2026-11-11' }); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.hanBH, '2027-11-10');
  assert.equal(x.W('serial.get', { serial: x.t1 }).lapDat.length, 1);
});

// ---------- hồi quy theo chuyên gia BH vòng 1 ----------
function withLogo(x) {
  lap(x, x.t1);
  x.W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-10', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 2, gia: 4200000, serials: ['LGNEW1', 'LGNEW2'] }] } });
  return x.W('bh.create', { serial: x.t1, phieu: { ngay: '2026-11-11', moTaLoi: 'PLC treo' } }, x.nv).soPBH;
}
const rep1 = (so, extra = {}) => ({ soPBH: so, ngay: '2026-11-11', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'], serialCu: ['LG11010'] }], ...extra });

test('BH-A1 thay linh kiện chết trước phiếu thu hồi → gửi lại cùng requestId LÀM TIẾP: đủ 2 phiếu, tủ có LOGO! mới, phiếu BH ghi lần thay', () => {
  const x = sold(), so = withLogo(x);
  const ph = x.a.sheets.Phieu, orig = ph.appendRow; let n = 0;
  ph.appendRow = function (r) { if (r[2] === 'NHAP_HANG_LOI') { ph.appendRow = orig; throw new Error('chết trước đầu phiếu HL'); } return orig.call(this, r); };
  const body = { action: 'bh.replace', session: x.nv, requestId: rid(), ...rep1(so) };
  assert.equal(x.a.post(body).ok, false);
  for (const k of Object.keys(x.a.cache)) if (/done/.test(k)) delete x.a.cache[k];
  const r = x.a.post(body); assert.equal(r.ok, true, JSON.stringify(r)); assert.ok(r.data.soPhieuLoi, 'đã lập phiếu thu hồi');
  assert.equal(x.a.sheets.Phieu.d.filter(z => z[2] === 'XUAT_BH').length, 1);
  assert.deepEqual(x.W('serial.get', { serial: x.t1 }).con.map(c => c.serial), ['LGNEW1']);
  const nw = x.W('serial.get', { serial: 'LGNEW1' }).serial; assert.deepEqual([nw.trangThai, nw.serialCha.split('|')[1]], ['DA_LAP', x.t1]);
  assert.equal(JSON.parse(x.pull().data.pbh[0].thayThe).length, 1);
  assert.deepEqual(x.a.post(body).data.soPhieuXuat, r.data.soPhieuXuat, 'gửi lần 3 → trả kết quả cũ');
});

test('BH-A2/A3/B3 không đảo riêng phiếu thay linh kiện; không nhận hàng lỗi / khách trả linh kiện đang lắp trong tủ ngoài luồng bảo hành', () => {
  const x = sold(), so = withLogo(x), r = x.W('bh.replace', rep1(so), x.nv);
  assert.match(x.P('voucher.reverse', { phieuGoc: r.soPhieuXuat, ngay: '2026-11-11', lyDo: 'x' }).error, /lần thay linh kiện/);
  assert.match(x.P('voucher.reverse', { phieuGoc: r.soPhieuLoi, ngay: '2026-11-11', lyDo: 'x' }).error, /lần thay linh kiện/);
  assert.match(x.P('voucher.create', { voucher: { loai: 'NHAP_HANG_LOI', ngay: '2026-11-11', kho: 'KHO-LOI', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['LG11011'] }] } }, x.nv).error, /đang lắp trong tủ/);
  assert.match(x.P('voucher.create', { voucher: { loai: 'KHACH_TRA', ngay: '2026-11-11', kho: 'KHO', maKH: 'TN', phieuGoc: r.soPhieuXuat, lines: [{ maHang: 'LOGO', soLuongCT: 1, dongGoc: 1, serials: ['LGNEW1'] }] } }, x.nv).error, /đang lắp trong tủ|DA_LAP/);
});

test('BH-B1 ngoài bảo hành (sét đánh / hết hạn): không thay miễn phí; Quản trị duyệt thiện chí có lý do; đã thay thì không từ chối; hoàn thành phải có nguyên nhân', () => {
  const x = sold(), so = withLogo(x);
  x.W('bh.update', { soPBH: so, trangThai: 'DANG_XU_LY', nguyenNhan: 'SET_DANH' }, x.nv);
  assert.match(x.P('bh.replace', rep1(so), x.nv).error, /Ngoài bảo hành/);
  assert.match(x.P('bh.replace', rep1(so, { thienChi: 'khách lớn' }), x.nv).error, /Ngoài bảo hành/, 'nhập liệu không duyệt thiện chí');
  const r = x.W('bh.replace', rep1(so, { thienChi: 'Khách hàng chiến lược — GĐ duyệt' }));
  assert.equal(x.P('bh.update', { soPBH: so, trangThai: 'TU_CHOI', ketQua: 'sét' }, x.nv).code, 'VALIDATION');
  assert.equal(x.P('bh.update', { soPBH: so, trangThai: 'HOAN_THANH', ketQua: 'Đã thay' }, x.nv).ok, true, 'nguyên nhân đã có từ trước');
  const p = x.pull().data.pbh.find(z => z.soPBH === so); assert.match(p.thienChi, /chiến lược/);
  const rb = x.W('report.bh', { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(rb.rows.length, 1); assert.equal(rb.tong, 4200000); assert.equal(rb.rows[0].soPBH, so); assert.equal(rb.tuConBH, 1);
  assert.equal(x.P('report.bh', { from: '2026-11-01', to: '2026-11-30' }, x.nv).code, 'FORBIDDEN');
});

test('BH-B4/B5 thay LOGO! phải chọn LOGO! cũ thu hồi; phiếu BH không trước ngày xuất giao', () => {
  const x = sold(), so = withLogo(x);
  assert.match(x.P('bh.replace', { soPBH: so, ngay: '2026-11-11', kho: 'KHO', lines: [{ maHang: 'LOGO', soLuong: 1, serialMoi: ['LGNEW1'] }] }, x.nv).error, /chọn serial cũ/);
  assert.equal(x.P('bh.create', { serial: x.t1, phieu: { ngay: '2026-01-01', moTaLoi: 'x' } }, x.nv).code, 'VALIDATION');
});

test('BH-B9 khách trả rồi bán lại cùng ngày → vẫn bàn giao lại được (chu kỳ theo số phiếu xuất); B6 Quản trị huỷ dòng bàn giao ghi nhầm', () => {
  const x = sold(); lap(x, x.t1, { ngay: '2026-11-09' });
  x.W('voucher.create', { voucher: { loai: 'KHACH_TRA', ngay: '2026-11-09', kho: 'KHO', maKH: 'TN', phieuGoc: x.px, lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, dongGoc: 1, serials: [x.t1] }] } });
  x.W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-09', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: [x.t1] }] } });
  const r = lap(x, x.t1, { ngay: '2026-11-09', thangBH: 6 }); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.data.hanBH, '2027-05-08');
  assert.equal(x.pull().data.cabinets.find(c => c.serial === x.t1).ngayXuat, '2026-11-09');
  assert.equal(x.P('install.void', { id: r.data.id, lyDo: 'nhầm' }, x.nv).code, 'FORBIDDEN');
  x.W('install.void', { id: r.data.id, lyDo: 'Ghi nhầm số tháng' });
  assert.equal(lap(x, x.t1, { ngay: '2026-11-10' }).data.hanBH, '2027-11-09');
});
