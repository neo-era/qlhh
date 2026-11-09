// TDD lõi kho đợt ② — viết TRƯỚC khi code. Số liệu KB1–KB6 do chuyên gia kế toán tự tính (§5a thiết kế).
const test = require('node:test'), assert = require('node:assert');
const K = require('../core/stock.js');

let stt = 0;
const P = (loai, ngay, kho, lines, x = {}) => ({ soPhieu: x.soPhieu || loai + '-' + (++stt), stt: x.stt || stt, loai, ngay, kho, trangThai: 'HOAN_TAT', ...x, lines: lines.map((l, i) => ({ dong: i + 1, ...l })) });
const nhap = (ngay, sl, gia, x) => P('NHAP_MUA', ngay, 'K1', [{ maHang: 'A', soLuong: sl, donGia: gia }], x);
const xuat = (ngay, sl, x) => P('XUAT_BAN', ngay, 'K1', [{ maHang: 'A', soLuong: sl }], x);
const val = (r, so, dong = 1) => r.lines[so + '#' + dong];

test('KB1 nhập ghi lùi ngày → tính lại theo (ngày, thứ tự): giá vốn xuất 12.876.471, tồn 120 = 13.623.529', () => {
  const v = [nhap('2026-10-01', 100, 100000), xuat('2026-10-05', 80), nhap('2026-10-10', 100, 130000), xuat('2026-10-15', 50),
    nhap('2026-10-03', 50, 70000)]; // ghi ngày 20/10 nhưng ngày phiếu 03/10 (stt lớn nhất)
  const r = K.replay(v);
  assert.deepEqual(r.errors, []);
  assert.equal(val(r, v[1].soPhieu) + val(r, v[3].soPhieu), 12876471);
  assert.equal(val(r, v[1].soPhieu), 7200000);
  assert.deepEqual([r.ton.A.pool.q, r.ton.A.pool.v], [120, 13623529]);
  assert.equal(r.ton.A.kho.K1, 120);
});

test('KB1 check(): phiếu chèn lùi ngày trả danh sách dòng xuất bị đổi giá vốn', () => {
  const v = [nhap('2026-10-01', 100, 100000), xuat('2026-10-05', 80), nhap('2026-10-10', 100, 130000), xuat('2026-10-15', 50)];
  const before = K.replay(v);
  v.forEach(p => p.lines.forEach(l => { const g = before.lines[p.soPhieu + '#' + l.dong]; if (p.loai === 'XUAT_BAN') l.giaTriKho = g; }));
  const c = K.check(v, nhap('2026-10-03', 50, 70000), {});
  assert.equal(c.ok, true, JSON.stringify(c));
  const ch = Object.fromEntries(c.changes.map(x => [x.soPhieu, x.new]));
  assert.equal(ch[v[1].soPhieu], 7200000); assert.equal(ch[v[3].soPhieu], 5676471);
});

test('KB2 đảo phiếu nhập sau khi đã bán → tính như chưa từng nhập: tồn 50 @100.000 = 5.000.000', () => {
  const n2 = nhap('2026-10-02', 100, 140000);
  const v = [nhap('2026-10-01', 100, 100000), n2, xuat('2026-10-05', 50)];
  const c = K.check(v, P('DAO', '2026-10-20', 'K1', [], { phieuGoc: n2.soPhieu }), {});
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.deepEqual([c.result.ton.A.pool.q, c.result.ton.A.pool.v], [50, 5000000]);
  assert.equal(val(c.result, v[2].soPhieu), 5000000);
});

test('KB2b đảo phiếu nhập làm tồn âm ở bất kỳ ngày nào → từ chối NEGATIVE_STOCK_LATER', () => {
  const n2 = nhap('2026-10-02', 100, 140000);
  const v = [nhap('2026-10-01', 100, 100000), n2, xuat('2026-10-05', 150)];
  const c = K.check(v, P('DAO', '2026-10-20', 'K1', [], { phieuGoc: n2.soPhieu }), {});
  assert.equal(c.ok, false); assert.equal(c.code, 'NEGATIVE_STOCK_LATER');
  assert.equal(c.errors[0].maHang, 'A');
});

test('đảo phiếu: không đảo được 2 lần, không đảo phiếu đảo, phiếu gốc phải có', () => {
  const n1 = nhap('2026-10-01', 10, 1000);
  const d = P('DAO', '2026-10-02', 'K1', [], { phieuGoc: n1.soPhieu });
  assert.equal(K.check([n1, d], P('DAO', '2026-10-03', 'K1', [], { phieuGoc: n1.soPhieu }), {}).code, 'VALIDATION');
  assert.equal(K.check([n1, d], P('DAO', '2026-10-03', 'K1', [], { phieuGoc: d.soPhieu }), {}).code, 'VALIDATION');
  assert.equal(K.check([n1], P('DAO', '2026-10-03', 'K1', [], { phieuGoc: 'KHONG-CO' }), {}).code, 'VALIDATION');
});

test('đảo phiếu gốc trong kỳ ĐÃ khoá → đảo tại ngày phiếu đảo với giá trị gốc (không sửa kỳ đã khoá)', () => {
  const n2 = nhap('2026-09-20', 100, 140000);
  const v = [nhap('2026-09-01', 100, 100000), n2, xuat('2026-10-05', 50)];
  const c = K.check(v, P('DAO', '2026-10-20', 'K1', [], { phieuGoc: n2.soPhieu }), { ngayKhoaSo: '2026-09-30' });
  assert.equal(c.ok, true, JSON.stringify(c));
  // xuất 05/10 vẫn theo BQ 120.000 (kỳ 9 đã khoá): 6.000.000; còn 150 = 18.000.000 − 14.000.000 = 4.000.000
  assert.equal(val(c.result, v[2].soPhieu), 6000000);
  assert.deepEqual([c.result.ton.A.pool.q, c.result.ton.A.pool.v], [50, 4000000]);
});

test('KB3 khách trả hàng → giá = giá vốn dòng xuất gốc: 5 cái = 2.100.000 tổng tồn (140.000/cái)', () => {
  // tồn 10 @150k; đã xuất 5 cái với giá vốn 120k trước đó
  const v = [nhap('2026-10-01', 5, 120000), xuat('2026-10-02', 5), nhap('2026-10-03', 10, 150000)];
  const kt = P('KHACH_TRA', '2026-10-10', 'K1', [{ maHang: 'A', soLuong: 5 }], { phieuGoc: v[1].soPhieu });
  const c = K.check(v, kt, {});
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(val(c.result, kt.soPhieu), 600000);
  assert.deepEqual([c.result.ton.A.pool.q, c.result.ton.A.pool.v], [15, 2100000]);
  assert.equal(c.result.ton.A.pool.v / c.result.ton.A.pool.q, 140000);
});

test('KB3b khách trả quá số đã xuất của phiếu gốc / sai mã → từ chối', () => {
  const v = [nhap('2026-10-01', 5, 120000), xuat('2026-10-02', 5)];
  assert.equal(K.check(v, P('KHACH_TRA', '2026-10-10', 'K1', [{ maHang: 'A', soLuong: 6 }], { phieuGoc: v[1].soPhieu }), {}).code, 'VALIDATION');
  const kt1 = P('KHACH_TRA', '2026-10-10', 'K1', [{ maHang: 'A', soLuong: 3 }], { phieuGoc: v[1].soPhieu });
  assert.equal(K.check([...v, kt1], P('KHACH_TRA', '2026-10-11', 'K1', [{ maHang: 'A', soLuong: 3 }], { phieuGoc: v[1].soPhieu }), {}).code, 'VALIDATION');
  assert.equal(K.check(v, P('KHACH_TRA', '2026-10-10', 'K1', [{ maHang: 'B', soLuong: 1 }], { phieuGoc: v[1].soPhieu }), {}).code, 'VALIDATION');
});

test('KB4 xuất ghi lùi ngày làm tồn ngày 10/10 = −3 → từ chối dù tồn hiện tại đủ', () => {
  const v = [nhap('2026-10-01', 10, 1000), xuat('2026-10-10', 8), nhap('2026-10-12', 10, 1000)];
  const c = K.check(v, xuat('2026-10-05', 5), {});
  assert.equal(c.ok, false); assert.equal(c.code, 'NEGATIVE_STOCK_LATER');
  assert.equal(c.errors[0].ngay, '2026-10-10'); assert.equal(c.errors[0].ton, -3);
  assert.equal(K.check(v, xuat('2026-10-13', 13), {}).code, 'STOCK_NOT_ENOUGH');
  assert.equal(K.check(v, xuat('2026-10-13', 12), {}).ok, true);
});

test('KB6 quy đổi ĐVT: cuộn 500 m giá 25.000.000 → 50.000/m; xuất 120,5 m = 6.025.000; còn 879,5 m', () => {
  const item = { maHang: 'CAP', dvt: 'm' }, qd = [{ maHang: 'CAP', dvtPhu: 'cuộn', heSo: 500 }];
  const a = K.convert({ maHang: 'CAP', dvt: 'cuộn', soLuongCT: 2, gia: 25000000 }, item, qd);
  assert.deepEqual([a.soLuong, a.donGia, a.heSo], [1000, 50000, 500]);
  assert.equal(K.convert({ maHang: 'CAP', dvt: 'thùng', soLuongCT: 1 }, item, qd).error, 'Không có quy đổi thùng → m');
  const v = [P('NHAP_MUA', '2026-10-01', 'K1', [{ maHang: 'CAP', soLuong: 1000, donGia: 50000 }])];
  const x = P('XUAT_CONG_TRINH', '2026-10-02', 'K1', [{ maHang: 'CAP', soLuong: 120.5 }]);
  const c = K.check(v, x, {});
  assert.equal(val(c.result, x.soPhieu), 6025000);
  assert.equal(c.result.ton.CAP.pool.q, 879.5);
});

test('số lượng thập phân không sai số trôi: 0,1 × 3 lần xuất từ 0,3', () => {
  const v = [P('NHAP_MUA', '2026-10-01', 'K1', [{ maHang: 'A', soLuong: 0.3, donGia: 10 }])];
  for (let i = 0; i < 3; i++) v.push(xuat('2026-10-02', 0.1));
  const r = K.replay(v);
  assert.deepEqual(r.errors, []); assert.equal(r.ton.A.pool.q, 0); assert.equal(r.ton.A.pool.v, 0);
});

test('xuất hết tồn → lấy trọn giá trị còn lại (không để lại tiền lẻ)', () => {
  const v = [nhap('2026-10-01', 3, 100), xuat('2026-10-02', 1), xuat('2026-10-03', 1), xuat('2026-10-04', 1)];
  const r = K.replay([nhap('2026-10-01', 1, 100), nhap('2026-10-01', 2, 101), ...v.slice(1)]);
  assert.equal(r.ton.A.pool.v, 0);
  assert.equal(val(r, v[1].soPhieu) + val(r, v[2].soPhieu) + val(r, v[3].soPhieu), 302);
});

test('chuyển kho: giảm kho đi, tăng kho đến, không đổi giá vốn; không đủ tại kho đi → từ chối', () => {
  const v = [nhap('2026-10-01', 10, 1000)];
  const ck = P('CHUYEN_KHO', '2026-10-02', 'K1', [{ maHang: 'A', soLuong: 4 }], { khoDen: 'K2' });
  const c = K.check(v, ck, {});
  assert.equal(c.ok, true);
  assert.deepEqual(c.result.ton.A.kho, { K1: 6, K2: 4 }); assert.equal(c.result.ton.A.pool.v, 10000);
  assert.equal(K.check(v, P('CHUYEN_KHO', '2026-10-02', 'K2', [{ maHang: 'A', soLuong: 1 }], { khoDen: 'K1' }), {}).code, 'STOCK_NOT_ENOUGH');
  assert.equal(K.check(v, P('CHUYEN_KHO', '2026-10-02', 'K1', [{ maHang: 'A', soLuong: 1 }], { khoDen: 'K1' }), {}).code, 'VALIDATION');
});

test('kiểm kê: thiếu 2 → giảm theo BQ ngày kiểm; thừa 1 → tăng theo BQ; giữ slSoSach', () => {
  const v = [nhap('2026-10-01', 10, 1000), nhap('2026-10-02', 10, 2000)];
  const kk = P('KIEM_KE', '2026-10-05', 'K1', [{ maHang: 'A', slSoSach: 20, slThucTe: 18 }]);
  const c = K.check(v, kk, {});
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(val(c.result, kk.soPhieu), 3000); assert.deepEqual([c.result.ton.A.pool.q, c.result.ton.A.pool.v], [18, 27000]);
  const kk2 = P('KIEM_KE', '2026-10-05', 'K1', [{ maHang: 'A', slSoSach: 20, slThucTe: 21 }]);
  assert.deepEqual([K.check(v, kk2, {}).result.ton.A.pool.q, K.check(v, kk2, {}).result.ton.A.pool.v], [21, 31500]);
});

test('kho hàng lỗi: số lượng có, không vào giá vốn; trả NCC từ kho lỗi không đụng giá vốn', () => {
  const o = { khoLoi: ['LOI'] };
  const v = [nhap('2026-10-01', 10, 1000), xuat('2026-10-02', 1)];
  const hl = P('NHAP_HANG_LOI', '2026-10-03', 'LOI', [{ maHang: 'A', soLuong: 1 }]);
  const c = K.check(v, hl, o);
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.deepEqual([c.result.ton.A.pool.q, c.result.ton.A.pool.v, c.result.ton.A.kho.LOI], [9, 9000, 1]);
  const tn = P('TRA_NCC', '2026-10-04', 'LOI', [{ maHang: 'A', soLuong: 1 }]);
  const c2 = K.check([...v, hl], tn, o);
  assert.equal(c2.ok, true); assert.equal(val(c2.result, tn.soPhieu), 0); assert.equal(c2.result.ton.A.pool.v, 9000);
  assert.equal(K.check(v, P('NHAP_HANG_LOI', '2026-10-03', 'K1', [{ maHang: 'A', soLuong: 1 }]), o).code, 'VALIDATION');
  assert.equal(K.check(v, P('CHUYEN_KHO', '2026-10-03', 'K1', [{ maHang: 'A', soLuong: 1 }], { khoDen: 'LOI' }), o).code, 'VALIDATION');
});

test('khoá sổ: phiếu ngày ≤ ngày khoá → PERIOD_LOCKED; đảo phiếu bằng phiếu đảo ngày ≤ khoá cũng vậy', () => {
  const v = [nhap('2026-09-01', 10, 1000)];
  assert.equal(K.check(v, xuat('2026-09-30', 1), { ngayKhoaSo: '2026-09-30' }).code, 'PERIOD_LOCKED');
  assert.equal(K.check(v, xuat('2026-10-01', 1), { ngayKhoaSo: '2026-09-30' }).ok, true);
  assert.equal(K.check(v, P('DAO', '2026-09-15', 'K1', [], { phieuGoc: v[0].soPhieu }), { ngayKhoaSo: '2026-09-30' }).code, 'PERIOD_LOCKED');
});

test('tồn đầu kỳ: chỉ 1 phiếu TON_DAU mỗi kho × mã', () => {
  const v = [P('TON_DAU', '2026-01-01', 'K1', [{ maHang: 'A', soLuong: 5, donGia: 10 }])];
  assert.equal(K.check(v, P('TON_DAU', '2026-01-01', 'K1', [{ maHang: 'A', soLuong: 1, donGia: 10 }]), {}).code, 'VALIDATION');
  assert.equal(K.check(v, P('TON_DAU', '2026-01-01', 'K2', [{ maHang: 'A', soLuong: 1, donGia: 10 }]), {}).ok, true);
});

test('dòng sai: SL ≤ 0, NHAP thiếu/âm đơn giá, phiếu không dòng, loại lạ → VALIDATION kèm vị trí dòng', () => {
  const c = K.check([], P('NHAP_MUA', '2026-10-01', 'K1', [{ maHang: 'A', soLuong: 0, donGia: 5 }, { maHang: 'A', soLuong: 1, donGia: -1 }]), {});
  assert.equal(c.code, 'VALIDATION'); assert.ok(c.errors.find(e => e.dong === 1)); assert.ok(c.errors.find(e => e.dong === 2));
  assert.equal(K.check([], P('NHAP_MUA', '2026-10-01', 'K1', []), {}).code, 'VALIDATION');
  assert.equal(K.check([], P('XYZ', '2026-10-01', 'K1', [{ maHang: 'A', soLuong: 1 }]), {}).code, 'VALIDATION');
  assert.equal(K.check([], P('NHAP_MUA', '2026-13-01', 'K1', [{ maHang: 'A', soLuong: 1, donGia: 1 }]), {}).code, 'VALIDATION');
});

test('NHAP_TP / NHAP_LAI_SX nhận giá trị do lệnh sản xuất tính sẵn (giaTriKho)', () => {
  const tp = P('NHAP_TP', '2026-11-09', 'K1', [{ maHang: 'TU', soLuong: 2, giaTriKho: 23240000 }]);
  const c = K.check([], tp, {});
  assert.equal(c.ok, true); assert.deepEqual([c.result.ton.TU.pool.q, c.result.ton.TU.pool.v], [2, 23240000]);
});

test('đường nhanh: phiếu mới là phiếu sau cùng → tính từ TonKho, cho kết quả như tính lại toàn bộ', () => {
  const v = [nhap('2026-10-01', 100, 100000), xuat('2026-10-05', 80), nhap('2026-10-10', 100, 130000)];
  const full = K.replay(v);
  const x = xuat('2026-10-15', 50);
  const fast = K.applyFast(full.ton, x, {});
  assert.ok(fast && fast.ok);
  const slow = K.check(v, x, {});
  assert.deepEqual(fast.result.ton.A, slow.result.ton.A);
  assert.equal(fast.result.lines[x.soPhieu + '#1'], slow.result.lines[x.soPhieu + '#1']);
  assert.equal(K.applyFast(full.ton, xuat('2026-10-06', 1), {}), null, 'lùi ngày → phải đi đường chậm');
  assert.equal(K.applyFast(full.ton, xuat('2026-10-16', 999), {}).code, 'STOCK_NOT_ENOUGH');
});

test('phiếu có trạng thái khác HOAN_TAT (NHAP_DO) không được tính', () => {
  const v = [nhap('2026-10-01', 10, 1000), { ...xuat('2026-10-02', 5), trangThai: 'NHAP_DO' }];
  assert.equal(K.replay(v).ton.A.pool.q, 10);
});

test('đảo phiếu chuyển kho / kiểm kê / xuất → trả về đúng trạng thái trước', () => {
  const n = nhap('2026-10-01', 10, 1000), ck = P('CHUYEN_KHO', '2026-10-02', 'K1', [{ maHang: 'A', soLuong: 4 }], { khoDen: 'K2' });
  const r1 = K.check([n, ck], P('DAO', '2026-10-03', 'K1', [], { phieuGoc: ck.soPhieu }), {});
  assert.equal(r1.ok, true); assert.deepEqual(r1.result.ton.A.kho, { K1: 10, K2: 0 });
  const kk = P('KIEM_KE', '2026-10-02', 'K1', [{ maHang: 'A', slSoSach: 10, slThucTe: 13 }]);
  const n2 = nhap('2026-10-03', 10, 2000);
  const r2 = K.check([n, kk, n2], P('DAO', '2026-10-05', 'K1', [], { phieuGoc: kk.soPhieu }), {});
  assert.equal(r2.ok, true); assert.deepEqual([r2.result.ton.A.pool.q, r2.result.ton.A.pool.v], [20, 30000]);
  const x = xuat('2026-10-02', 3);
  const r3 = K.check([n, x, n2], P('DAO', '2026-10-05', 'K1', [], { phieuGoc: x.soPhieu }), {});
  assert.deepEqual([r3.result.ton.A.pool.q, r3.result.ton.A.pool.v], [20, 30000]);
});

test('ngẫu nhiên 300 chuỗi phiếu: đường nhanh luôn trùng tính lại toàn bộ (tồn, giá trị, giá vốn dòng)', () => {
  let seed = 7; const rnd = n => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
  for (let run = 0; run < 300; run++) {
    const v = []; let ton = K.replay([]).ton; let day = 1;
    for (let i = 0; i < 12; i++) {
      day += rnd(2); const ngay = '2026-10-' + String(day).padStart(2, '0'), ma = 'M' + rnd(2), kho = 'K' + rnd(2);
      const kind = rnd(5); let p;
      if (kind < 2) p = P('NHAP_MUA', ngay, kho, [{ maHang: ma, soLuong: 1 + rnd(9) + rnd(1000) / 1000, donGia: 1000 + rnd(9000) }]);
      else if (kind < 4) p = P('XUAT_BAN', ngay, kho, [{ maHang: ma, soLuong: 1 + rnd(5) }]);
      else p = P('CHUYEN_KHO', ngay, kho, [{ maHang: ma, soLuong: 1 + rnd(3) }], { khoDen: kho === 'K0' ? 'K1' : 'K0' });
      const f = K.applyFast(ton, p, {}), s = K.check(v, p, {});
      assert.ok(f, 'phải đi được đường nhanh');
      assert.equal(f.ok, s.ok, JSON.stringify([f.code, s.code]));
      if (!s.ok) { assert.equal(f.code, s.code); continue; }
      for (const m of Object.keys(f.result.ton)) {
        assert.equal(f.result.ton[m].pool.q, s.result.ton[m].pool.q);
        assert.equal(f.result.ton[m].pool.v, s.result.ton[m].pool.v, 'run ' + run + ' i ' + i);
        for (const k of Object.keys(s.result.ton[m].kho)) assert.equal(f.result.ton[m].kho[k] || 0, s.result.ton[m].kho[k]);
      }
      p.lines.forEach(l => { assert.equal(f.result.lines[p.soPhieu + '#' + l.dong], s.result.lines[p.soPhieu + '#' + l.dong]); l.giaTriKho = s.result.lines[p.soPhieu + '#' + l.dong]; });
      v.push(p); ton = s.result.ton;
    }
  }
});

test('báo cáo N-X-T tháng 10 (KB1 + đảo + chuyển kho): đầu + nhập − xuất = cuối từng mã, khớp số tay', () => {
  const v = [nhap('2026-09-25', 10, 50000), nhap('2026-10-01', 100, 100000), xuat('2026-10-05', 80), nhap('2026-10-10', 100, 130000), xuat('2026-10-15', 50),
    nhap('2026-10-03', 50, 70000), P('CHUYEN_KHO', '2026-10-16', 'K1', [{ maHang: 'A', soLuong: 5 }], { khoDen: 'K2' }), xuat('2026-11-02', 1)];
  const r = K.nxt(v, '2026-10-01', '2026-10-31', {});
  const a = r.find(x => x.maHang === 'A');
  assert.deepEqual([a.dauQ, a.dauV], [10, 500000]);
  assert.deepEqual([a.nhapQ, a.nhapV], [250, 26500000]);
  assert.equal(a.xuatQ, 130);
  assert.equal(a.dauV + a.nhapV - a.xuatV, a.cuoiV); assert.equal(a.dauQ + a.nhapQ - a.xuatQ, a.cuoiQ);
  assert.equal(a.cuoiQ, 130);
});
