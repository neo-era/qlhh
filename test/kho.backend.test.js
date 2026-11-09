// Test máy chủ đợt ② (Code.gs + Kho.gs thật + lõi) trên Sheet giả lập.
const test = require('node:test'), assert = require('node:assert');
const { ready, rid } = require('./gas-mock.js');
const NV = 'nv@gmail.com', XEM = 'xem@gmail.com';

function shop() {
  const a = ready({ [NV]: 'NHAP_LIEU', [XEM]: 'XEM' }); const s = a.login();
  const W = (action, o) => { const r = a.post({ action, session: s, requestId: rid(), ...o }); assert.equal(r.ok, true, action + ': ' + JSON.stringify(r)); return r.data; };
  W('item.upsert', { isNew: true, item: { maHang: 'LOGO', ten: 'Siemens LOGO! 230RC', dvt: 'bộ', hang: 'Siemens', quanLySerial: true } });
  W('item.upsert', { isNew: true, item: { maHang: 'CB40', ten: 'CB 2P 40A', dvt: 'cái', tonToiThieu: 5 } });
  W('item.upsert', { isNew: true, item: { maHang: 'CAP', ten: 'Cáp CVV 2x2.5', dvt: 'm' } });
  W('unit.upsert', { unit: { maHang: 'CAP', dvtPhu: 'cuộn', heSo: 500 } });
  W('supplier.upsert', { isNew: true, supplier: { maNCC: 'NCC1', ten: 'Cty Thiết bị điện' } });
  W('customer.upsert', { isNew: true, customer: { maKH: 'TN', ten: 'CP QLVH Chiếu sáng ĐT Tây Ninh', mst: '3900123456' } });
  W('project.upsert', { isNew: true, project: { maCongTrinh: 'PDG', ten: 'Hẻm 20 Phan Đình Giót', maKH: 'TN' } });
  const V = (v, who = s) => a.post({ action: 'voucher.create', session: who, requestId: rid(), voucher: v });
  return { a, s, W, V };
}
const nhap = (ngay, lines, x = {}) => ({ loai: 'NHAP_MUA', ngay, kho: 'KHO', maNCC: 'NCC1', lines, ...x });
const pull = (a, s) => a.post({ action: 'sync.pull', session: s }).data;
const tonOf = (d, ma, kho = '*') => d.data.stock.find(t => t.maHang === ma && t.kho === kho);

test('setup đợt ②: đủ sheet kho + 2 kho mặc định (kho chính, kho hàng lỗi)', () => {
  const { a, s } = shop();
  for (const n of ['Kho', 'QuyDoiDVT', 'KhachHang', 'CongTrinh', 'Phieu', 'ChiTietPhieu', 'Serial', 'LichSuSerial', 'TonKho']) assert.ok(a.sheets[n], n);
  assert.deepEqual(pull(a, s).data.warehouses.map(k => [k.maKho, k.loai]), [['KHO', 'THUONG'], ['KHO-LOI', 'HANG_LOI']]);
});

test('KB1 qua máy chủ: nhập lùi ngày → tự tính lại giá vốn dòng xuất đã ghi + TonKho + giá vốn hàng', () => {
  const { a, s, V } = shop();
  const p1 = V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 100, gia: 100000 }]));
  assert.equal(p1.ok, true, JSON.stringify(p1)); assert.match(p1.data.soPhieu, /^PN-2026-00001$/);
  const x1 = V({ loai: 'XUAT_BAN', ngay: '2026-10-05', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 80 }] });
  assert.equal(x1.ok, true, JSON.stringify(x1));
  V(nhap('2026-10-10', [{ maHang: 'CB40', soLuongCT: 100, gia: 130000 }]));
  V({ loai: 'XUAT_CONG_TRINH', ngay: '2026-10-15', kho: 'KHO', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 50 }] });
  const back = V(nhap('2026-10-03', [{ maHang: 'CB40', soLuongCT: 50, gia: 70000 }]));
  assert.equal(back.ok, true, JSON.stringify(back)); assert.equal(back.data.tinhLai, 2);
  const lines = a.sheets.ChiTietPhieu.d.slice(1).filter(r => r[0].startsWith('PX') || r[0].startsWith('XC')).map(r => r[9]);
  assert.equal(lines[0] + lines[1], 12876471);
  const d = pull(a, s);
  assert.deepEqual([tonOf(d, 'CB40').soLuong, tonOf(d, 'CB40').giaTri], [120, 13623529]);
  assert.equal(tonOf(d, 'CB40', 'KHO').soLuong, 120);
  assert.equal(d.data.items.find(i => i.maHang === 'CB40').giaVon, Math.round(13623529 / 120));
});

test('không đủ tồn / tồn âm về sau → từ chối, không ghi gì; số phiếu không nhảy', () => {
  const { a, V } = shop();
  V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 10, gia: 1000 }]));
  V({ loai: 'XUAT_BAN', ngay: '2026-10-10', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 8 }] });
  const n = a.sheets.Phieu.d.length;
  const r = V({ loai: 'XUAT_BAN', ngay: '2026-10-05', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 5 }] });
  assert.equal(r.code, 'NEGATIVE_STOCK_LATER'); assert.match(r.error, /CB40.*KHO.*2026-10-10.*-3/);
  assert.equal(V({ loai: 'XUAT_BAN', ngay: '2026-10-11', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 3 }] }).code, 'STOCK_NOT_ENOUGH');
  assert.equal(a.sheets.Phieu.d.length, n);
  assert.match(V({ loai: 'XUAT_BAN', ngay: '2026-10-11', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 2 }] }).data.soPhieu, /PX-2026-00002/);
});

test('quy đổi ĐVT: nhập 2 cuộn × 25.000.000 → 1.000 m; xuất 120,5 m = 6.025.000', () => {
  const { a, s, V } = shop();
  assert.equal(V(nhap('2026-10-01', [{ maHang: 'CAP', dvt: 'cuộn', soLuongCT: 2, gia: 25000000 }])).ok, true);
  const x = V({ loai: 'XUAT_CONG_TRINH', ngay: '2026-10-02', kho: 'KHO', maCongTrinh: 'PDG', lines: [{ maHang: 'CAP', soLuongCT: 120.5 }] });
  assert.equal(x.ok, true, JSON.stringify(x));
  const g = a.post({ action: 'voucher.get', session: s, soPhieu: x.data.soPhieu }).data;
  assert.equal(g.lines[0].giaTriKho, 6025000);
  assert.equal(tonOf(pull(a, s), 'CAP').soLuong, 879.5);
  assert.equal(V(nhap('2026-10-03', [{ maHang: 'CAP', dvt: 'thùng', soLuongCT: 1, gia: 5 }])).code, 'VALIDATION');
});

test('serial: nhập LOGO! có serial, xuất đúng serial, trùng serial bị chặn, khách trả về kho', () => {
  const { a, s, V } = shop();
  assert.equal(V(nhap('2026-11-01', [{ maHang: 'LOGO', soLuongCT: 2, gia: 4150000, serials: ['vpc1', 'VPC2'] }])).ok, true);
  assert.equal(V(nhap('2026-11-01', [{ maHang: 'LOGO', soLuongCT: 1, gia: 4150000, serials: ['VPC1'] }])).code, 'SERIAL_DUP');
  assert.equal(V(nhap('2026-11-01', [{ maHang: 'LOGO', soLuongCT: 1, gia: 4150000 }])).code, 'VALIDATION');
  const x = V({ loai: 'XUAT_BAN', ngay: '2026-11-02', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['VPC1'] }] });
  assert.equal(x.ok, true, JSON.stringify(x));
  assert.equal(V({ loai: 'XUAT_BAN', ngay: '2026-11-02', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['VPC1'] }] }).code, 'SERIAL_NOT_IN_STOCK');
  assert.deepEqual(pull(a, s).data.serials.map(x => x.serial), ['VPC2']);
  const kt = V({ loai: 'KHACH_TRA', ngay: '2026-11-03', kho: 'KHO', phieuGoc: x.data.soPhieu, lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['VPC1'] }] });
  assert.equal(kt.ok, true, JSON.stringify(kt));
  assert.deepEqual(pull(a, s).data.serials.map(x => x.serial).sort(), ['VPC1', 'VPC2']);
  assert.equal(a.sheets.LichSuSerial.d.length - 1, 4);
});

test('đảo phiếu (QT): KB2 tồn 50 @100.000, phiếu gốc đánh dấu đã đảo, serial về trạng thái trước; NHAP_LIEU không đảo được', () => {
  const { a, s, V } = shop();
  V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 100, gia: 100000 }]));
  const n2 = V(nhap('2026-10-02', [{ maHang: 'CB40', soLuongCT: 100, gia: 140000 }])).data.soPhieu;
  V({ loai: 'XUAT_BAN', ngay: '2026-10-05', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 50 }] });
  assert.equal(a.post({ action: 'voucher.reverse', session: a.login(NV), requestId: rid(), phieuGoc: n2, lyDo: 'x' }).code, 'FORBIDDEN');
  assert.equal(a.post({ action: 'voucher.reverse', session: s, requestId: rid(), phieuGoc: n2 }).code, 'VALIDATION', 'bắt buộc lý do');
  const r = a.post({ action: 'voucher.reverse', session: s, requestId: rid(), phieuGoc: n2, ngay: '2026-10-20', lyDo: 'Nhập nhầm NCC' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.match(r.data.soPhieu, /^DA-2026-/);
  const d = pull(a, s);
  assert.deepEqual([tonOf(d, 'CB40').soLuong, tonOf(d, 'CB40').giaTri], [50, 5000000]);
  assert.equal(d.data.vouchers.find(p => p.soPhieu === n2).daDao, true);
  assert.equal(a.post({ action: 'voucher.reverse', session: s, requestId: rid(), phieuGoc: n2, lyDo: 'lần 2' }).code, 'VALIDATION');
  // serial
  const p = V(nhap('2026-10-21', [{ maHang: 'LOGO', soLuongCT: 1, gia: 1, serials: ['S9'] }])).data.soPhieu;
  assert.equal(a.post({ action: 'voucher.reverse', session: s, requestId: rid(), phieuGoc: p, ngay: '2026-10-21', lyDo: 'sai' }).ok, true);
  assert.equal(pull(a, s).data.serials.length, 0);
});

test('khoá sổ: QT khoá → phiếu ngày ≤ khoá bị PERIOD_LOCKED; không khoá ngày tương lai', () => {
  const { a, s, V } = shop();
  assert.equal(a.post({ action: 'period.lock', session: s, requestId: rid(), ngay: '2999-01-01' }).code, 'VALIDATION');
  assert.equal(a.post({ action: 'period.lock', session: s, requestId: rid(), ngay: '2026-09-30' }).ok, true);
  assert.equal(pull(a, s).data.config.ngayKhoaSo, '2026-09-30');
  assert.equal(V(nhap('2026-09-30', [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }])).code, 'PERIOD_LOCKED');
  assert.equal(V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }])).ok, true);
});

test('quyền xem: NHAP_LIEU lập phiếu nhập nhưng không xem lại đơn giá / tổng tiền / giá trị tồn; XEM không lập phiếu', () => {
  const { a, s, V } = shop();
  const nv = a.login(NV);
  const r = V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 10, gia: 123456 }]), nv);
  assert.equal(r.ok, true, JSON.stringify(r));
  const g = a.post({ action: 'voucher.get', session: nv, soPhieu: r.data.soPhieu }).data;
  assert.equal(JSON.stringify(g).includes('123456'), false); assert.equal('tongTien' in g.phieu, false);
  const d = a.post({ action: 'sync.pull', session: nv }).data;
  assert.equal(JSON.stringify(d.data.stock).includes('giaTri'), false); assert.equal(JSON.stringify(d.data.vouchers).includes('tongTien'), false);
  assert.equal(V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }]), a.login(XEM)).code, 'FORBIDDEN');
  assert.equal(a.post({ action: 'voucher.get', session: s, soPhieu: r.data.soPhieu }).data.lines[0].thanhTien, 1234560);
});

test('idempotent: gửi lại cùng requestId 3 lần → 1 phiếu; chống chèn công thức ở lý do', () => {
  const { a, s } = shop(); const id = rid();
  const v = nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }], { lyDo: '=IMPORTRANGE("x")' });
  const r = [1, 2, 3].map(() => a.post({ action: 'voucher.create', session: s, requestId: id, voucher: v }));
  assert.equal(new Set(r.map(x => x.data.soPhieu)).size, 1);
  assert.equal(a.sheets.Phieu.d.length - 1, 1);
  assert.equal(a.post({ action: 'voucher.get', session: s, soPhieu: r[0].data.soPhieu }).data.phieu.lyDo, '=IMPORTRANGE("x")');
});

test('phiếu mồ côi NHAP_DO (máy chủ chết giữa chừng) → lệnh ghi sau dọn: LOI_GHI, trả serial, tính lại tồn', () => {
  const { a, s, V } = shop();
  V(nhap('2026-10-01', [{ maHang: 'LOGO', soLuongCT: 1, gia: 100, serials: ['S1'] }]));
  const so = V(nhap('2026-10-02', [{ maHang: 'LOGO', soLuongCT: 1, gia: 300, serials: ['S2'] }])).data.soPhieu;
  const row = a.sheets.Phieu.d.findIndex(r => r[0] === so); a.sheets.Phieu.d[row][11] = 'NHAP_DO';   // giả lập chết trước khi đổi HOAN_TAT
  assert.equal(V(nhap('2026-10-03', [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }])).ok, true);
  assert.equal(a.sheets.Phieu.d[row][11], 'LOI_GHI');
  const d = pull(a, s);
  assert.deepEqual([tonOf(d, 'LOGO').soLuong, tonOf(d, 'LOGO').giaTri], [1, 100]);
  assert.deepEqual(d.data.serials.map(x => x.serial), ['S1']);
});

test('tính lại tồn (QT) sửa TonKho bị sửa tay sai; báo cáo N-X-T khớp đầu + nhập − xuất = cuối', () => {
  const { a, s, V } = shop();
  V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 10, gia: 1000 }]));
  V({ loai: 'XUAT_BAN', ngay: '2026-10-05', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 4 }] });
  const pr = a.sheets.TonKho.d.findIndex(r => r[0] === 'CB40' && r[1] === '*'); a.sheets.TonKho.d[pr][2] = 999;
  const rb = a.post({ action: 'stock.rebuild', session: s, requestId: rid() });
  assert.equal(rb.ok, true, JSON.stringify(rb));
  assert.equal(tonOf(pull(a, s), 'CB40').soLuong, 6);
  const n = a.post({ action: 'report.nxt', session: s, from: '2026-10-01', to: '2026-10-31' }).data.rows.find(r => r.maHang === 'CB40');
  assert.deepEqual([n.dauQ, n.nhapQ, n.nhapV, n.xuatQ, n.xuatV, n.cuoiQ, n.cuoiV], [0, 10, 10000, 4, 4000, 6, 6000]);
  assert.equal(n.ten, 'CB 2P 40A');
  assert.equal(a.post({ action: 'report.nxt', session: a.login(NV), from: '2026-10-01', to: '2026-10-31' }).code, 'FORBIDDEN');
});

test('kiểm kê: SL sổ sách lấy từ máy chủ; kho hàng lỗi không nhận phiếu nhập mua; phiếu sản xuất không lập trực tiếp', () => {
  const { a, s, V } = shop();
  V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 10, gia: 1000 }]));
  const k = V({ loai: 'KIEM_KE', ngay: '2026-10-02', kho: 'KHO', lines: [{ maHang: 'CB40', slThucTe: 8, slSoSach: 999 }] });
  assert.equal(k.ok, true, JSON.stringify(k));
  const g = a.post({ action: 'voucher.get', session: s, soPhieu: k.data.soPhieu }).data.lines[0];
  assert.deepEqual([g.slSoSach, g.slThucTe, g.giaTriKho], [10, 8, 2000]);
  assert.equal(V(nhap('2026-10-02', [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }], { kho: 'KHO-LOI' })).code, 'VALIDATION');
  assert.equal(V({ loai: 'NHAP_TP', ngay: '2026-10-02', kho: 'KHO', lines: [{ maHang: 'CB40', soLuongCT: 1 }] }).code, 'VALIDATION');
  assert.equal(V({ loai: 'XUAT_BAN', ngay: '2026-10-02', kho: 'KHO', maKH: 'KHONGCO', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 1 }] }).code, 'VALIDATION');
});

// ===== ca xấu chuyên gia bảo mật/QA + kế toán tái hiện (duyệt v0.2 vòng 1) =====
test('B2 lỗi sau khi phiếu đã HOAN_TAT (trước khi ghi Request) → gửi lại cùng requestId vẫn chỉ 1 phiếu', () => {
  const { a, s, V } = shop(); V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 10, gia: 1000 }]));
  const nk = a.sheets.NhatKy, orig = nk.getRange; let once = true;
  nk.getRange = function (...x) { if (once) { once = false; nk.getRange = orig; throw new Error('mất kết nối Sheet'); } return orig.apply(this, x); };
  const id = rid(), v = { loai: 'XUAT_BAN', ngay: '2026-10-02', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 1 }] };
  assert.equal(a.post({ action: 'voucher.create', session: s, requestId: id, voucher: v }).code, 'INTERNAL');
  const r2 = a.post({ action: 'voucher.create', session: s, requestId: id, voucher: v });
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(a.sheets.Phieu.d.filter(r => String(r[0]).startsWith('PX')).length, 1);
});
test('B3 ngày phiếu / ngày chứng từ gốc ở tương lai → từ chối', () => {
  const { V } = shop();
  assert.equal(V(nhap('2099-01-01', [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }])).code, 'VALIDATION');
  assert.equal(V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }], { ngayCTGoc: '2099-01-01' })).code, 'VALIDATION');
});
test('B4 giá 1e20 / tiền vượt số nguyên an toàn → từ chối', () => {
  const { V } = shop();
  assert.equal(V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 1, gia: 1e20 }])).code, 'VALIDATION');
  assert.equal(V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 1e9, gia: 1e12 }])).code, 'VALIDATION');
});
test('B5 serial: ≤ 60 ký tự, đúng mẫu; hàng không quản lý serial thì bỏ serial; kiểu dữ liệu lạ không gây lỗi máy chủ', () => {
  const { a, s, V } = shop();
  assert.equal(V(nhap('2026-10-01', [{ maHang: 'LOGO', soLuongCT: 1, gia: 1, serials: ['X'.repeat(100000)] }])).code, 'VALIDATION');
  assert.equal(V(nhap('2026-10-01', [{ maHang: 'LOGO', soLuongCT: 1, gia: 1, serials: ['<img src=x>'] }])).code, 'VALIDATION');
  const r = V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 2, gia: 1, serials: new Array(1000).fill('A') }]));
  assert.equal(r.ok, true);
  assert.equal(a.sheets.ChiTietPhieu.d.slice(1).find(x => x[0] === r.data.soPhieu)[13], '');
  assert.equal(V(nhap('2026-10-01', [{ maHang: { toString: null }, soLuongCT: 1, gia: 1 }])).code, 'VALIDATION');
  assert.equal(V(nhap('2026-10-01', [{ maHang: 'CB40', dvt: { a: 1 }, soLuongCT: 1, gia: 1 }])).code, 'VALIDATION');
  assert.equal(V({ loai: 'NHAP_MUA', ngay: '2026-10-01', kho: 'KHO', maNCC: 'NCC1', lines: [null] }).code, 'VALIDATION');
});
test('tồn đầu kỳ chỉ Quản trị; phieuGoc chỉ giữ ở phiếu trả', () => {
  const { a, s, V } = shop();
  assert.equal(V({ loai: 'TON_DAU', ngay: '2026-01-01', kho: 'KHO', lines: [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }] }, a.login(NV)).code, 'FORBIDDEN');
  const r = V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 1, gia: 1 }], { phieuGoc: 'PX-2026-99999' }));
  assert.equal(r.ok, true); assert.equal(pull(a, s).data.vouchers[0].phieuGoc, '');
});
test('X2 qua máy chủ: phiếu đảo lưu hieuLuc; khoá sổ sau đó + tính lại tồn không đổi giá vốn kỳ đã khoá', () => {
  const { a, s, V } = shop();
  V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 100, gia: 100000 }]));
  const n2 = V(nhap('2026-10-02', [{ maHang: 'CB40', soLuongCT: 100, gia: 140000 }])).data.soPhieu;
  const x = V({ loai: 'XUAT_BAN', ngay: '2026-10-05', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 50 }] }).data.soPhieu;
  assert.equal(a.post({ action: 'voucher.reverse', session: s, requestId: rid(), phieuGoc: n2, ngay: '2026-10-20', lyDo: 'sai' }).ok, true);
  assert.equal(pull(a, s).data.vouchers.find(p => p.loai === 'DAO').hieuLuc, 'GOC');
  assert.equal(a.post({ action: 'period.lock', session: s, requestId: rid(), ngay: '2026-10-31' }).ok, true);
  const rb = a.post({ action: 'stock.rebuild', session: s, requestId: rid() }); assert.equal(rb.ok, true, JSON.stringify(rb)); assert.equal(rb.data.tinhLai, 0);
  assert.equal(a.post({ action: 'voucher.get', session: s, soPhieu: x }).data.lines[0].giaTriKho, 5000000);
});
test('X9 qua máy chủ: trả NCC từ kho thường cần phiếu nhập gốc cùng NCC, tính theo giá gốc', () => {
  const { a, s, W, V } = shop();
  W('supplier.upsert', { isNew: true, supplier: { maNCC: 'NCC2', ten: 'NCC khác' } });
  V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 10, gia: 100 }]));
  const n2 = V(nhap('2026-10-02', [{ maHang: 'CB40', soLuongCT: 10, gia: 200 }])).data.soPhieu;
  assert.equal(V({ loai: 'TRA_NCC', ngay: '2026-10-03', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'CB40', soLuongCT: 1 }] }).code, 'VALIDATION');
  assert.equal(V({ loai: 'TRA_NCC', ngay: '2026-10-03', kho: 'KHO', maNCC: 'NCC2', phieuGoc: n2, lines: [{ maHang: 'CB40', soLuongCT: 1 }] }).code, 'VALIDATION', 'khác NCC phiếu gốc');
  const t = V({ loai: 'TRA_NCC', ngay: '2026-10-03', kho: 'KHO', maNCC: 'NCC1', phieuGoc: n2, lines: [{ maHang: 'CB40', soLuongCT: 10 }] });
  assert.equal(t.ok, true, JSON.stringify(t));
  const d = pull(a, s); assert.deepEqual([tonOf(d, 'CB40').soLuong, tonOf(d, 'CB40').giaTri], [10, 1000]);
});
test('tính lại tồn từ chối khi Sheet phiếu có dòng sai kiểu (tránh ghi đè sai)', () => {
  const { a, s, V } = shop(); V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 10, gia: 1000 }]));
  a.sheets.ChiTietPhieu.d[1][6] = 'mười';
  const r = a.post({ action: 'stock.rebuild', session: s, requestId: rid() });
  assert.equal(r.code, 'VALIDATION'); assert.match(r.error, /ChiTietPhieu/);
});
test('Y2 qua máy chủ: trả NCC toàn bộ lô giá thấp → lưu chênh lệch giá vốn, N-X-T có cột điều chỉnh, Nhập liệu không thấy', () => {
  const { a, s, V } = shop();
  const n1 = V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 10, gia: 100 }])).data.soPhieu;
  V(nhap('2026-10-02', [{ maHang: 'CB40', soLuongCT: 10, gia: 200 }]));
  V({ loai: 'XUAT_BAN', ngay: '2026-10-03', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 10 }] });
  const t = V({ loai: 'TRA_NCC', ngay: '2026-10-04', kho: 'KHO', maNCC: 'NCC1', phieuGoc: n1, lines: [{ maHang: 'CB40', soLuongCT: 10, dongGoc: 1 }] });
  assert.equal(t.ok, true, JSON.stringify(t));
  const g = a.post({ action: 'voucher.get', session: s, soPhieu: t.data.soPhieu }).data.lines[0];
  assert.deepEqual([g.giaTriKho, g.chenhLechGV], [1500, -500]);
  assert.equal(a.post({ action: 'report.nxt', session: s, from: '2026-10-01', to: '2026-10-31' }).data.rows[0].dcV, -500);
  assert.equal('chenhLechGV' in a.post({ action: 'voucher.get', session: a.login(NV), soPhieu: t.data.soPhieu }).data.lines[0], false);
});
test('tính lại giá vốn lùi ngày → cập nhật cả tổng tiền đầu phiếu xuất (phát hiện khi chạy trên Google thật)', () => {
  const { a, s, V } = shop();
  V(nhap('2026-10-01', [{ maHang: 'CB40', soLuongCT: 100, gia: 100000 }]));
  const x1 = V({ loai: 'XUAT_CONG_TRINH', ngay: '2026-10-05', kho: 'KHO', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 80 }] }).data.soPhieu;
  V(nhap('2026-10-10', [{ maHang: 'CB40', soLuongCT: 100, gia: 130000 }]));
  const x2 = V({ loai: 'XUAT_CONG_TRINH', ngay: '2026-10-15', kho: 'KHO', maCongTrinh: 'PDG', lines: [{ maHang: 'CB40', soLuongCT: 50 }] }).data.soPhieu;
  V(nhap('2026-10-03', [{ maHang: 'CB40', soLuongCT: 50, gia: 70000 }]));
  const vs = pull(a, s).data.vouchers, t = so => vs.find(p => p.soPhieu === so).tongTien;
  assert.deepEqual([t(x1), t(x2)], [7200000, 5676471]);
  const pr = a.sheets.Phieu.d.findIndex(r => r[0] === x1); a.sheets.Phieu.d[pr][16] = 1;   // sửa tay sai → tính lại tồn sửa về đúng
  assert.equal(a.post({ action: 'stock.rebuild', session: s, requestId: rid() }).ok, true);
  assert.equal(pull(a, s).data.vouchers.find(p => p.soPhieu === x1).tongTien, 7200000);
});
