// TDD lắp đặt & bảo hành (BH-1) — viết TRƯỚC khi code.
const test = require('node:test'), assert = require('node:assert');
const B = require('../core/bh.js');

test('hạn bảo hành: N tháng kể từ ngày bàn giao, ngày cuối được bảo hành = cùng ngày tháng sau − 1; cuối tháng kẹp đúng', () => {
  assert.equal(B.hanBH('2026-11-10', 12), '2027-11-09');
  assert.equal(B.hanBH('2026-01-31', 1), '2026-02-28', '31/1 + 1 tháng: tháng 2 không có ngày 31 → hết hạn cuối tháng 2');
  assert.equal(B.hanBH('2028-01-31', 1), '2028-02-29');
  assert.equal(B.hanBH('2026-03-31', 1), '2026-04-30'); assert.equal(B.hanBH('2026-01-30', 1), '2026-02-28'); assert.equal(B.hanBH('2024-02-29', 12), '2025-02-28');
  assert.equal(B.hanBH('2026-11-09', 12), '2027-11-08'); assert.equal(B.hanBH('2026-04-30', 1), '2026-05-29');
  assert.equal(B.hanBH('2026-03-01', 24), '2028-02-29');
  assert.equal(B.hanBH('2026-11-10', 0), '', '0 tháng = không bảo hành');
  assert.equal(B.hanBH('', 12), '');
});

test('tình trạng bảo hành theo ngày xem: còn / sắp hết (≤30 ngày) / hết / chưa bàn giao (cảnh báo khi xuất > 30 ngày)', () => {
  assert.deepEqual(B.status({ ngayBanGiao: '2026-11-10', hanBH: '2027-11-09' }, '2027-01-01'), { ma: 'CON_BH', conNgay: 312 });
  assert.equal(B.status({ ngayBanGiao: '2026-11-10', hanBH: '2027-11-09' }, '2027-10-15').ma, 'SAP_HET');
  assert.equal(B.status({ ngayBanGiao: '2026-11-10', hanBH: '2027-11-09' }, '2027-11-09').ma, 'SAP_HET');
  assert.equal(B.status({ ngayBanGiao: '2026-11-10', hanBH: '2027-11-09' }, '2027-11-10').ma, 'HET_BH');
  assert.equal(B.status({ ngayBanGiao: '2026-11-10', hanBH: '' }, '2027-01-01').ma, 'KHONG_BH');
  assert.deepEqual(B.status({ ngayXuat: '2026-11-01' }, '2026-11-20'), { ma: 'CHUA_BAN_GIAO', canhBao: false });
  assert.deepEqual(B.status({ ngayXuat: '2026-10-01' }, '2026-11-20'), { ma: 'CHUA_BAN_GIAO', canhBao: true });
});

test('ghi lắp đặt/bàn giao: kiểm ngày, toạ độ trong lãnh thổ VN, số tháng BH theo hợp đồng; chuẩn hoá', () => {
  const ok = B.validateInstall({ loai: 'BAN_GIAO', ngay: '2026-11-10', maKH: 'tn', maCongTrinh: 'pdg', diaChi: ' Hẻm 20 Phan Đình Giót ', viDo: '11.3101', kinhDo: 106.1, tenTaiCT: 'Tủ H20', thangBH: '18', soBBBG: 'BB-01' }, { ngayXuat: '2026-11-09', today: '2026-11-11' });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.deepEqual([ok.value.maKH, ok.value.diaChi, ok.value.viDo, ok.value.kinhDo, ok.value.thangBH], ['TN', 'Hẻm 20 Phan Đình Giót', 11.3101, 106.1, 18]);
  const e = B.validateInstall({ loai: 'X', ngay: '2026-11-08', viDo: 48.8, kinhDo: 2.3, thangBH: 200 }, { ngayXuat: '2026-11-09', today: '2026-11-11' });
  assert.equal(e.ok, false); assert.ok(e.errors.loai && e.errors.ngay && e.errors.viDo && e.errors.thangBH && e.errors.diaChi, JSON.stringify(e.errors));
  assert.ok(B.validateInstall({ loai: 'BAN_GIAO', ngay: '2026-11-12', diaChi: 'x' }, { ngayXuat: '2026-11-09', today: '2026-11-11' }).errors.ngay, 'không ngày tương lai');
  assert.equal(B.validateInstall({ loai: 'BAN_GIAO', ngay: '2026-11-10', diaChi: 'x', viDo: 11 }, { today: '2026-11-11' }).errors.kinhDo, 'Nhập đủ vĩ độ và kinh độ');
  assert.equal(B.validateInstall({ loai: 'DI_DOI', ngay: '2026-11-10', diaChi: 'x' }, { today: '2026-11-11' }).ok, true);
});

test('vị trí hiện tại + hạn BH từ lịch sử lắp đặt: bàn giao lần đầu giữ hạn, di dời đổi vị trí không đổi hạn; hợp đồng ghi đè số tháng', () => {
  const h = [{ loai: 'BAN_GIAO', ngay: '2026-11-10', diaChi: 'A', thangBH: '' , thoiGian: '1' }, { loai: 'DI_DOI', ngay: '2027-03-01', diaChi: 'B', thoiGian: '2' }];
  assert.deepEqual(B.current(h, 12), { ngayBanGiao: '2026-11-10', hanBH: '2027-11-09', thangBH: 12, viTri: h[1], soLan: 2 });
  assert.equal(B.current([{ loai: 'BAN_GIAO', ngay: '2026-11-10', thangBH: 18, thoiGian: '1' }], 12).hanBH, '2028-05-09');
  assert.equal(B.current([], 12), null);
});

test('phiếu bảo hành: luồng trạng thái hợp lệ; hoàn thành cần kết quả; từ chối cần lý do; đóng rồi không mở lại', () => {
  assert.equal(B.canMove('TIEP_NHAN', 'DANG_XU_LY'), true);
  assert.equal(B.canMove('TIEP_NHAN', 'HOAN_THANH'), true);
  assert.equal(B.canMove('DANG_XU_LY', 'TU_CHOI'), true);
  assert.equal(B.canMove('HOAN_THANH', 'DANG_XU_LY'), false);
  assert.equal(B.canMove('TU_CHOI', 'HOAN_THANH'), false);
  const t = B.validateTicket({ ngay: '2026-11-11', moTaLoi: 'Tủ không đóng điện nhánh 2', nguoiBao: 'Anh Tâm 0909' }, { today: '2026-11-11' });
  assert.equal(t.ok, true);
  assert.equal(B.validateTicket({ ngay: '2026-11-11', moTaLoi: '' }, { today: '2026-11-11' }).ok, false);
  assert.equal(B.validateUpdate({ trangThai: 'HOAN_THANH', ketQua: '' }, 'DANG_XU_LY').ok, false);
  assert.equal(B.validateUpdate({ trangThai: 'HOAN_THANH', ketQua: 'x' }, 'DANG_XU_LY').ok, false, 'hoàn thành phải chọn nguyên nhân');
  assert.equal(B.mienPhi('TRONG_BH', 'LOI_THIET_BI'), true); assert.equal(B.mienPhi('TRONG_BH', 'SET_DANH'), false); assert.equal(B.mienPhi('HET_BH', 'LOI_THIET_BI'), false);
  assert.equal(B.validateUpdate({ trangThai: 'HOAN_THANH', ketQua: 'Thay LOGO!', nguyenNhan: 'LOI_THIET_BI' }, 'DANG_XU_LY').ok, true);
  assert.equal(B.validateUpdate({ trangThai: 'TU_CHOI', ketQua: '', nguyenNhan: 'SET_DANH' }, 'TIEP_NHAN').ok, false, 'từ chối phải ghi lý do');
  assert.equal(B.validateUpdate({ trangThai: 'HOAN_THANH', ketQua: 'x', nguyenNhan: 'BAY' }, 'DANG_XU_LY').ok, false, 'nguyên nhân ngoài danh mục');
  assert.equal(B.validateUpdate({ trangThai: 'DANG_XU_LY' }, 'HOAN_THANH').ok, false);
  assert.equal(B.NGOAI_BH.includes('SET_DANH') && B.NGOAI_BH.includes('QUA_AP') && !B.NGOAI_BH.includes('LOI_THIET_BI'), true);
});
