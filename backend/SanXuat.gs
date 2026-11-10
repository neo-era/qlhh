/** QLHH — máy chủ sản xuất tủ (SX-1): mẫu tủ, lệnh sản xuất, xuất linh kiện, chi phí khác, nhập thành phẩm (sinh xê-ri + hồ sơ tủ),
 *  kiểm tra xuất xưởng (KCS), phiếu xuất xưởng (PXX), huỷ lệnh, tra cứu, báo cáo dở dang. Lõi: core/sx.js (QSX) + core/stock.js. Ghép sau Kho.gs bởi build.sh.
 *  Chống ghi trùng khi gửi lại (chết giữa chừng): mọi dòng ghi chính có cột requestId → trong khoá tìm theo requestId, có rồi thì trả kết quả cũ. */

var CP_LOAI = ['NC_TRUC_TIEP', 'SX_CHUNG', 'GIA_CONG_NGOAI'];
function congTy() { return (cfg('maCongTy') || 'LAVIPCO').toUpperCase(); }
function txt(v, n) { return String(v === undefined || v === null ? '' : v).trim().slice(0, n); }
function up(v) { return String(v === undefined || v === null ? '' : v).trim().toUpperCase(); }
function chkDate(d, f) { if (!QValidate.isoDate(d)) throw fail('VALIDATION', 'Ngày không hợp lệ', mk(f || 'ngay', 'YYYY-MM-DD')); noFuture({ ngay: d }); return d; }
function template(maMau, ver) {
  var c = readTable('MauSanPham').rows.filter(function (t) { return t.maMau === maMau && (!ver || Number(t.phienBan) === Number(ver)); });
  c.sort(function (a, b) { return a.phienBan - b.phienBan; }); var t = c[c.length - 1]; if (!t) return null;
  t.bomL = parseSerials(t.bom); t.kcsL = parseSerials(t.kcs); return t;
}
function getLSX(so) {
  var l = readTable('LenhSX').rows.filter(function (x) { return x.soLSX === up(so); })[0];
  if (!l) throw fail('VALIDATION', 'Không có lệnh sản xuất ' + so, { soLSX: 'Chọn lệnh có sẵn' }); return l;
}
function lsxOpen(l) { if (l.trangThai === 'HUY') throw fail('VALIDATION', 'Lệnh ' + l.soLSX + ' đã huỷ', { soLSX: 'Lệnh đã huỷ' }); }
/* Bộ đệm kết quả theo requestId (nhanh); nguồn chắc chắn là cột requestId trên sheet (sxPrev*). */
function sxDone(u, req) { var v = CacheService.getScriptCache().get('sxdone:' + u.email + ':' + req.requestId); return v ? JSON.parse(v) : null; }
function sxMark(u, req, r) { CacheService.getScriptCache().put('sxdone:' + u.email + ':' + req.requestId, JSON.stringify(r), 21600); return r; }
function prevHeads(req, loai) { var id = String(req.requestId); return readTable('Phieu').rows.filter(function (h) { return h.requestId === id && h.loai === loai && h.trangThai === 'HOAN_TAT'; }); }
function prevRow(n, req) { var id = String(req.requestId); return readTable(n).rows.filter(function (r) { return r.requestId === id; }); }
/** Ghi nhiều dòng đã có của 1 sheet trong 1 lần setValues (khối từ dòng nhỏ nhất đến lớn nhất; dòng khác giữ nguyên). */
function putMany(n, objs) {
  if (!objs.length) return; if (objs.length === 1) return putRow(n, strip(objs[0]), objs[0]._row);
  var cur = readTable(n).rows, byRow = {}; cur.forEach(function (r) { byRow[r._row] = r; }); objs.forEach(function (o) { byRow[o._row] = o; });
  var lo = Math.min.apply(null, objs.map(function (o) { return o._row; })), hi = Math.max.apply(null, objs.map(function (o) { return o._row; })), vals = [], cols = QSchema.SHEETS[n].cols;
  for (var r = lo; r <= hi; r++) vals.push(byRow[r] ? QSchema.toRow(n, strip(byRow[r])) : cols.map(function () { return ''; }));
  sheet(n).getRange(lo, 1, vals.length, cols.length).setValues(vals); dirty(n); mark('putMany ' + n);
}
/** Phiếu còn hiệu lực của lệnh (HOÀN TẤT, chưa đảo) kèm dòng. */
function lsxVouchers(so) {
  var heads = readTable('Phieu').rows.filter(function (h) { return h.soLSX === so && h.trangThai === 'HOAN_TAT' && !h.daDao; }), by = {};
  heads.forEach(function (h) { h.lines = []; by[h.soPhieu] = h; });
  readTable('ChiTietPhieu').rows.forEach(function (l) { var h = by[l.soPhieu]; if (h) { l.serials = parseSerials(l.serials); h.lines.push(l); } });
  return heads;
}
function lsxMas(so) { var m = {}; lsxVouchers(so).forEach(function (h) { h.lines.forEach(function (l) { m[l.maHang] = 1; }); }); return Object.keys(m); }
/** Hồ sơ tủ hợp lệ = phiếu nhập TP của nó đã HOÀN TẤT và chưa đảo (chặn "tủ ma" của phiếu ghi dở). */
function cabHeads() { var m = {}; readTable('Phieu').rows.forEach(function (h) { if (h.loai === 'NHAP_TP' && h.trangThai === 'HOAN_TAT' && !h.daDao) m[h.soPhieu] = 1; }); return m; }
function cabOK(c, heads) { return c && c.trangThai !== 'HUY' && !!heads[c.soPhieuNhap]; }
/** Trạng thái lệnh: MOI → DANG_LAP → CHO_KIEM_TRA (đủ tủ) → HOAN_TAT (đủ tủ, tất cả đạt KCS). HUY giữ nguyên. Chỉ đọc đầu phiếu. */
function lsxRefresh(so) {
  var l = readTable('LenhSX').rows.filter(function (x) { return x.soLSX === so; })[0]; if (!l || l.trangThai === 'HUY') return;
  var heads = cabHeads(), has = readTable('Phieu').rows.some(function (h) { return h.soLSX === so && h.trangThai === 'HOAN_TAT' && !h.daDao; });
  var tus = readTable('HoSoTu').rows.filter(function (c) { return c.soLSX === so && cabOK(c, heads); });
  var st = has ? 'DANG_LAP' : 'MOI';
  if (tus.length >= Number(l.soLuong)) st = tus.every(function (c) { return c.kcsDat; }) ? 'HOAN_TAT' : 'CHO_KIEM_TRA';
  if (st !== l.trangThai) { var x = strip(l); x.trangThai = st; putRow('LenhSX', x, l._row); }
}
/** Hồ sơ tủ của phiếu nhập TP bị đảo / ghi dở → HUY; gỡ serialCha của linh kiện. */
function cabinetsVoid(soPhieu) {
  var pairs = [], ch = [];
  readTable('HoSoTu').rows.forEach(function (c) {
    if (c.soPhieuNhap !== soPhieu || c.trangThai === 'HUY') return;
    parseSerials(c.serialCon).forEach(function (k) { pairs.push([k, '', c.key]); });   // chỉ gỡ khi linh kiện còn đang trỏ đúng tủ này
    c.trangThai = 'HUY'; ch.push(c);
  });
  putMany('HoSoTu', ch);
  setParents(pairs);
  return ch.length;
}
/** pairs = [[khoá serial con, khoá tủ cha mới, (tuỳ chọn) chỉ đổi khi cha hiện tại = giá trị này]] — 1 lần đọc + 1 lần ghi Serial. */
function setParents(pairs) {
  if (!pairs.length) return; var want = {}; pairs.forEach(function (p) { want[p[0]] = p; });
  putMany('Serial', readTable('Serial').rows.filter(function (r) { var p = want[r.key]; return p && (p.length < 3 || r.serialCha === p[2]) && r.serialCha !== p[1]; }).map(function (r) { r.serialCha = want[r.key][1]; return r; }));
}
/** Kết chuyển huỷ lệnh (KC_HUY) tự cân: sau mỗi lần tính lại làm đổi giá linh kiện của lệnh đã huỷ → sửa số KC để dở dang về 0. */
function syncKcHuy(lsxState) {
  if (!lsxState) return; var huy = {}; readTable('LenhSX').rows.forEach(function (l) { if (l.trangThai === 'HUY') huy[l.soLSX] = 1; });
  var cps = readTable('ChiPhiLSX').rows, ch = [];
  Object.keys(lsxState).forEach(function (so) {
    if (!huy[so]) return; var st = lsxState[so], kc = cps.filter(function (c) { return c.soLSX === so && c.loai === 'KC_HUY'; })[0]; if (!kc) return;
    var cp = cps.reduce(function (a, c) { return c.soLSX === so && c.loai !== 'KC_HUY' ? a + (Number(c.soTien) || 0) : a; }, 0), want = -(st.xv + cp - st.nv - st.tv);
    if (Number(kc.soTien) !== want) { kc.soTien = want; ch.push(kc); }
  });
  putMany('ChiPhiLSX', ch);
}
/** Tính lại toàn bộ các mã `mas` (bao đóng lệnh) với opts `o`; chạm kỳ khoá → từ chối; phát sinh tồn/giá trị âm mới → từ chối. */
function recalcStrict(mas, o, oldO) {
  var all = loadVouchers(mas), r = QStock.replay(all.vouchers, o), before = QStock.replay(all.vouchers, oldO), changes = [], seen = {};
  before.errors.forEach(function (e) { seen[e.code + e.soPhieu + e.maHang + e.kho] = 1; });
  var fresh = r.errors.filter(function (e) { return !seen[e.code + e.soPhieu + e.maHang + e.kho]; });
  if (fresh.length) throw fail('VALIDATION', 'Thay đổi làm tồn hoặc giá trị âm (mã ' + fresh[0].maHang + ')', fresh);
  all.vouchers.forEach(function (p) { if (p.loai === 'DAO' || p.trangThai !== 'HOAN_TAT') return; p.lines.forEach(function (l) {
    var nv = r.lines[p.soPhieu + '#' + l.dong], na = r.adj[p.soPhieu + '#' + l.dong] || 0;
    if (nv === undefined || (Number(l.giaTriKho) === nv && (Number(l.chenhLechGV) || 0) === na)) return;
    if (o.ngayKhoaSo && p.ngay <= o.ngayKhoaSo) throw fail('PERIOD_LOCKED', 'Làm đổi giá vốn phiếu ' + p.soPhieu + ' trong kỳ đã khoá sổ', null);
    changes.push({ soPhieu: p.soPhieu, dong: l.dong, maHang: l.maHang, new: nv, adj: na });
  }); });
  return { all: all, r: r, changes: changes };
}
function recalcApply(x) { var n = applyChanges(x.changes, x.all.rowOf, x.all.mas); writeTon(x.r.ton, x.all.mas); updateCost(x.r.ton, x.all.mas); syncKcHuy(x.r.lsx); return n; }

// ---------- mẫu tủ ----------
function templateUpsert(u, req, logs) {
  var v = need(QSX.validateTemplate(req.template)), items = mapBy(readTable('HangHoa').rows, 'maHang'), tp = items[v.maHang], e = {};
  if (!tp) throw fail('VALIDATION', 'Không có mã thành phẩm ' + v.maHang, { maHang: 'Tạo mã hàng tủ trước' });
  if (!tp.quanLySerial) throw fail('VALIDATION', 'Mã thành phẩm ' + v.maHang + ' phải bật "Quản lý serial" (mỗi tủ 1 số xê-ri)', { maHang: 'Bật quản lý serial' });
  v.bom.forEach(function (b, i) { var it = items[b.maHang], k = 'bom.' + (i + 1);
    if (!it) e[k] = 'Mã ' + b.maHang + ' không có';
    else if (it.trangThai === 'NGUNG') e[k] = 'Mã ' + b.maHang + ' đã ngừng kinh doanh';
    else if (it.quanLySerial && !Number.isInteger(b.soLuong)) e[k] = 'Linh kiện có serial: số lượng nguyên'; });
  if (Object.keys(e).length) throw fail('VALIDATION', firstErr(e), e);
  var ver = readTable('MauSanPham').rows.reduce(function (m, t) { return t.maMau === v.maMau ? Math.max(m, Number(t.phienBan) || 0) : m; }, 0) + 1;
  var row = { id: v.maMau + '|' + ver, maMau: v.maMau, phienBan: ver, maHang: v.maHang, ten: v.ten, kichThuoc: v.kichThuoc, moTa: v.moTa, vatLieu: v.vatLieu, ketCau: v.ketCau, filePLC: v.filePLC, thongSoDien: v.thongSoDien, ghiChuDM: v.ghiChuDM, thangBH: v.thangBH,
    bom: JSON.stringify(v.bom), kcs: JSON.stringify(v.kcs), trangThai: 'HOAT_DONG', nguoiTao: u.email, thoiGian: nowIso() };
  appendBlock('MauSanPham', [row]);
  logs.push({ action: 'template.upsert', doiTuong: 'MauSanPham', id: row.id, truoc: null, sau: { maHang: v.maHang, bom: v.bom.length, kcs: v.kcs.length } });
  return { maMau: v.maMau, phienBan: ver };
}

// ---------- lệnh sản xuất ----------
function lsxCreate(u, req, logs) {
  var x = req.lsx || {}, t = template(up(x.maMau)), n = x.soLuong;
  if (!t) throw fail('VALIDATION', 'Không có mẫu tủ ' + x.maMau, { maMau: 'Chọn mẫu có sẵn' });
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 500) throw fail('VALIDATION', 'Số tủ từ 1 đến 500', { soLuong: '1–500' });
  var ngay = chkDate(String(x.ngay || today())), kho = mapBy(readTable('Kho').rows, 'maKho')[up(x.kho)];
  if (!kho || kho.trangThai !== 'HOAT_DONG' || kho.loai === 'HANG_LOI') throw fail('VALIDATION', 'Chọn kho thường đang hoạt động', { kho: 'Kho lấy linh kiện' });
  var maKH = up(x.maKH), maCT = up(x.maCongTrinh);
  if (maKH && !readTable('KhachHang').rows.some(function (r) { return r.maKH === maKH; })) throw fail('VALIDATION', 'Khách hàng ' + maKH + ' chưa có', { maKH: 'Chọn khách có sẵn' });
  if (maCT && !readTable('CongTrinh').rows.some(function (r) { return r.maCongTrinh === maCT; })) throw fail('VALIDATION', 'Công trình ' + maCT + ' chưa có', { maCongTrinh: 'Chọn công trình có sẵn' });
  var yr = ngay.slice(0, 4), so = 'LSX-' + yr + '-' + pad(nextId('LSX:' + yr), 5);
  appendBlock('LenhSX', [{ soLSX: so, ngay: ngay, maMau: t.maMau, phienBan: t.phienBan, maHang: t.maHang, soLuong: n, maKH: maKH, maCongTrinh: maCT, canCuCheTao: txt(x.canCuCheTao, 300),
    kho: kho.maKho, trangThai: 'MOI', ghiChu: txt(x.ghiChu, 500), nguoiTao: u.email, thoiGian: nowIso(), lyDoHuy: '' }]);
  logs.push({ action: 'lsx.create', doiTuong: 'LenhSX', id: so, truoc: null, sau: { maMau: t.maMau, phienBan: t.phienBan, soLuong: n } });
  return { soLSX: so };
}
/* Chuẩn bị phiếu SX qua cùng đường kiểm dòng của phiếu kho thường (quy đổi ĐVT, serial, số lượng). */
function sxPrep(u, req, v) { var c = voucherPrep(u, { requestId: req.requestId, voucher: v }, true); c.h.soLSX = v.soLSX; c.h.phieuGoc = v.phieuGoc || ''; return c; }

function lsxXuat(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var pv = prevHeads(req, 'XUAT_SX')[0]; if (pv) return sxMark(u, req, { soPhieu: pv.soPhieu, tinhLai: 0, lapLai: true });
  cleanupOrphans(logs);
  var l = getLSX(req.soLSX); lsxOpen(l);
  if (!Array.isArray(req.lines)) throw fail('VALIDATION', 'Chưa có dòng linh kiện', { lines: 'Bắt buộc' });
  var ctx = sxPrep(u, req, { loai: 'XUAT_SX', ngay: String(req.ngay || today()), kho: l.kho, lyDo: txt(req.lyDo, 300) || 'Xuất linh kiện cho sản xuất', nguoiGiaoNhan: txt(req.nguoiGiaoNhan, 100),
    soCTGoc: l.soLSX, ngayCTGoc: l.ngay, lines: req.lines, soLSX: l.soLSX });
  var r = commitVoucher(u, req, logs, ctx);
  sxMark(u, req, { soPhieu: r.soPhieu, tinhLai: r.tinhLai });
  lsxRefresh(l.soLSX);
  return { soPhieu: r.soPhieu, tinhLai: r.tinhLai };
}

function lsxChiPhi(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var pv = prevRow('ChiPhiLSX', req)[0]; if (pv) return sxMark(u, req, { id: pv.id, tinhLai: 0, lapLai: true });
  cleanupOrphans(logs);
  var l = getLSX(req.soLSX); lsxOpen(l);
  var c = req.chiPhi || {}, ngay = chkDate(String(c.ngay || '')), loai = up(c.loai), tien = c.soTien;
  if (CP_LOAI.indexOf(loai) < 0) throw fail('VALIDATION', 'Loại chi phí: nhân công trực tiếp / sản xuất chung / gia công ngoài', { loai: 'Chọn loại' });
  if (typeof tien !== 'number' || !Number.isInteger(tien) || tien <= 0 || tien > 1e12) throw fail('VALIDATION', 'Số tiền là số nguyên VND > 0', { soTien: 'Số nguyên > 0' });
  var ngayCT = txt(c.ngayCTGoc, 10); if (ngayCT && !QValidate.isoDate(ngayCT)) throw fail('VALIDATION', 'Ngày chứng từ gốc không hợp lệ', { ngayCTGoc: 'YYYY-MM-DD' });
  var r = cpWrite(u, req, l, { ngay: ngay, loai: loai, soTien: tien, soCTGoc: txt(c.soCTGoc, 50), ngayCTGoc: ngayCT, ghiChu: txt(c.ghiChu, 300) });
  logs.push({ action: 'lsx.chiPhi', doiTuong: 'ChiPhiLSX', id: r.id, truoc: null, sau: { soLSX: l.soLSX, ngay: ngay, loai: loai, soTien: tien, tinhLai: r.tinhLai } });
  return sxMark(u, req, r);
}
/** Ghi 1 dòng chi phí (dương: ghi thêm; âm: huỷ dòng cũ) rồi tính lại giá thành các tủ đã nhập — trong kỳ mở. */
function cpWrite(u, req, l, c) {
  var o = stockOpts(); if (o.ngayKhoaSo && c.ngay <= o.ngayKhoaSo) throw fail('PERIOD_LOCKED', 'Kỳ đến ' + o.ngayKhoaSo + ' đã khoá sổ', { ngay: 'Kỳ đã khoá' });
  var vs = lsxVouchers(l.soLSX), nq = 0, last = '';
  vs.forEach(function (h) { if (h.loai !== 'NHAP_TP') return; h.lines.forEach(function (x) { nq += Number(x.soLuong) || 0; }); if (h.ngay > last) last = h.ngay; });
  if (nq >= Number(l.soLuong) && c.ngay > last) throw fail('VALIDATION', 'Lệnh đã nhập đủ tủ ngày ' + last + ' — chi phí phải ghi đến ngày đó', { ngay: 'Không sau ' + last });
  var oldO = JSON.parse(JSON.stringify(o)); o.lsx[l.soLSX].chiPhi.push({ ngay: c.ngay, soTien: c.soTien, loai: c.loai });
  var mas = lsxMas(l.soLSX), x = mas.length ? recalcStrict(mas, o, oldO) : null;
  var id = 'CP' + pad(nextId('CPLSX'), 6);
  appendBlock('ChiPhiLSX', [{ id: id, soLSX: l.soLSX, ngay: c.ngay, loai: c.loai, soTien: c.soTien, soCTGoc: c.soCTGoc, ngayCTGoc: c.ngayCTGoc, ghiChu: c.ghiChu, nguoiTao: u.email, thoiGian: nowIso(), requestId: String(req.requestId) }]);
  return { id: id, tinhLai: x ? recalcApply(x) : 0 };
}
/** Huỷ 1 dòng chi phí ghi sai (QT): ghi dòng âm cùng ngày, cùng loại; tính lại giá thành. */
function lsxChiPhiHuy(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var pv = prevRow('ChiPhiLSX', req)[0]; if (pv) return sxMark(u, req, { id: pv.id, tinhLai: 0, lapLai: true });
  cleanupOrphans(logs);
  var lyDo = txt(req.lyDo, 300); if (!lyDo) throw fail('VALIDATION', 'Nhập lý do huỷ chi phí', { lyDo: 'Bắt buộc' });
  var rows = readTable('ChiPhiLSX').rows, g = rows.filter(function (c) { return c.id === txt(req.id, 20); })[0];
  if (!g || CP_LOAI.indexOf(g.loai) < 0 || !(Number(g.soTien) > 0)) throw fail('VALIDATION', 'Không có dòng chi phí ' + req.id, null);
  if (rows.some(function (c) { return c.soCTGoc === g.id && Number(c.soTien) < 0; })) throw fail('VALIDATION', 'Dòng ' + g.id + ' đã huỷ', null);
  var l = getLSX(g.soLSX); lsxOpen(l);
  var r = cpWrite(u, req, l, { ngay: g.ngay, loai: g.loai, soTien: -Number(g.soTien), soCTGoc: g.id, ngayCTGoc: g.ngay, ghiChu: 'Huỷ ' + g.id + ': ' + lyDo });
  logs.push({ action: 'lsx.chiPhiHuy', doiTuong: 'ChiPhiLSX', id: r.id, truoc: { id: g.id, soTien: g.soTien }, sau: { lyDo: lyDo, tinhLai: r.tinhLai } });
  return sxMark(u, req, r);
}

function lsxNhap(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var pv = prevHeads(req, 'NHAP_TP')[0];
  if (pv) { var pl = readTable('ChiTietPhieu').rows.filter(function (x) { return x.soPhieu === pv.soPhieu; })[0]; return sxMark(u, req, { soPhieu: pv.soPhieu, serials: parseSerials(pl && pl.serials), tinhLai: 0, lapLai: true }); }
  cleanupOrphans(logs);
  var l = getLSX(req.soLSX); lsxOpen(l);
  var k = req.soLuong, ngay = chkDate(String(req.ngay || today()));
  if (typeof k !== 'number' || !Number.isInteger(k) || k < 1 || k > 500) throw fail('VALIDATION', 'Số tủ nhập là số nguyên ≥ 1', { soLuong: '≥ 1' });
  var t = template(l.maMau, l.phienBan), items = mapBy(readTable('HangHoa').rows, 'maHang'), it = items[l.maHang];
  if (!t || !it) throw fail('VALIDATION', 'Mẫu tủ hoặc mã thành phẩm không còn', null);
  // số xê-ri: {CTY}-{mã rút gọn}-{năm}-{STT}; bỏ qua số đã có (serial nhập tay, hồ sơ tủ cũ kể cả tủ của phiếu ghi dở)
  var idx = QSerial.index(readTable('Serial').rows), hs = mapBy(readTable('HoSoTu').rows, 'serial'), cty = congTy(), yr = ngay.slice(0, 4);
  var ctr = 'TU:' + up(l.maHang).replace(/[^A-Z0-9]/g, '').slice(0, 10) + ':' + yr, cur = Number(props().getProperty('seq:' + ctr) || 0), sers = [];
  while (sers.length < k) { cur++; var s = QSX.serialNo(cty, l.maHang, yr, cur); if (!hs[s] && !idx[QSerial.keyOf(it, s)]) sers.push(s); }
  // serial linh kiện (LOGO!, IoT…) đã xuất cho lệnh, chưa nhập lại, chưa gắn vào tủ còn hiệu lực → gắn lần lượt cho từng tủ
  var vs = lsxVouchers(l.soLSX), byMa = {}, used = {}, iss = {}, heads = cabHeads();
  readTable('HoSoTu').rows.forEach(function (c) { if (c.soLSX === l.soLSX && cabOK(c, heads)) parseSerials(c.serialCon).forEach(function (z) { used[z] = 1; }); });
  vs.forEach(function (h) { if (h.loai === 'NHAP_LAI_SX') h.lines.forEach(function (x) { x.serials.forEach(function (z) { used[QSerial.keyOf(items[x.maHang], z)] = 1; }); }); });
  vs.forEach(function (h) { if (h.loai !== 'XUAT_SX') return; h.lines.forEach(function (x) {
    iss[x.maHang] = (iss[x.maHang] || 0) + (Number(x.soLuong) || 0);
    x.serials.forEach(function (z) { var key = QSerial.keyOf(items[x.maHang], z); if (!used[key]) (byMa[x.maHang] = byMa[x.maHang] || []).push(key); }); }); });
  vs.forEach(function (h) { if (h.loai === 'NHAP_LAI_SX') h.lines.forEach(function (x) { iss[x.maHang] = (iss[x.maHang] || 0) - (Number(x.soLuong) || 0); }); });
  var bomTT = Object.keys(iss).filter(function (m) { return iss[m] > 0; }).map(function (m) { return { maHang: m, soLuong: Math.round(iss[m] / Number(l.soLuong) * 1000) / 1000 }; });
  var con = QSX.assignChildren(byMa, t.bomL, k);
  var ctx = { h: { loai: 'NHAP_TP', ngay: ngay, kho: l.kho, khoDen: '', maNCC: '', maKH: '', maCongTrinh: '', phieuGoc: '', soLSX: l.soLSX, nguoiGiaoNhan: '', lyDo: 'Nhập kho thành phẩm', soCTGoc: l.soLSX, ngayCTGoc: l.ngay, ghiChu: '' },
    o: stockOpts(), items: items, priced: false,
    lines: [{ dong: 1, maHang: l.maHang, dvt: it.dvt, soLuongCT: k, heSo: 1, soLuong: k, donGia: '', thanhTien: '', giaTriKho: '', slSoSach: '', slThucTe: '', dongGoc: '', serials: sers }] };
  var r = commitVoucher(u, req, logs, ctx, { beforeHead: function (so) {
    appendBlock('HoSoTu', sers.map(function (s, i) { return { serial: s, key: QSerial.keyOf(it, s), soLSX: l.soLSX, maHang: l.maHang, maMau: l.maMau, phienBan: l.phienBan, soPhieuNhap: so, ngayNhap: ngay,
      bomThucTe: JSON.stringify(bomTT), serialCon: JSON.stringify(con[i]), kichThuoc: t.kichThuoc, ghiChu: '', kcsDat: false, lanKiemCuoi: 0, soPXX: '', trangThai: 'HOAT_DONG' }; }));
    var pairs = []; sers.forEach(function (s, i) { con[i].forEach(function (c) { pairs.push([c, QSerial.keyOf(it, s)]); }); }); setParents(pairs);
    props().setProperty('seq:' + ctr, String(cur));
  } });
  var res = { soPhieu: r.soPhieu, serials: sers, tinhLai: r.tinhLai };
  sxMark(u, req, res); lsxRefresh(l.soLSX);
  return res;
}

/** Huỷ lệnh (chưa nhập TP): nhập lại linh kiện còn dùng được theo giá xuất gốc; phần còn lại của dở dang kết chuyển chi phí (KC_HUY, tự cân khi giá linh kiện được tính lại). */
function lsxHuy(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  cleanupOrphans(logs);
  var l = getLSX(req.soLSX), made0 = prevHeads(req, 'NHAP_LAI_SX').filter(function (h) { return h.soLSX === l.soLSX; });
  if (l.trangThai === 'HUY') {
    var kc0 = prevRow('ChiPhiLSX', req)[0];
    if (made0.length || kc0 || l.lyDoHuy) return sxMark(u, req, { phieuNhapLai: made0.map(function (h) { return h.soPhieu; }), ketChuyen: kc0 ? -Number(kc0.soTien) : 0, lapLai: true });
  }
  lsxOpen(l);
  var lyDo = txt(req.lyDo, 300); if (!lyDo) throw fail('VALIDATION', 'Nhập lý do huỷ lệnh', { lyDo: 'Bắt buộc' });
  var ngay = chkDate(String(req.ngay || today())), lock = cfg('ngayKhoaSo');
  if (lock && ngay <= lock) throw fail('PERIOD_LOCKED', 'Kỳ đến ' + lock + ' đã khoá sổ', { ngay: 'Kỳ đã khoá' });
  var vs = lsxVouchers(l.soLSX), items = mapBy(readTable('HangHoa').rows, 'maHang');
  if (vs.some(function (h) { return h.loai === 'NHAP_TP'; })) throw fail('VALIDATION', 'Lệnh đã nhập thành phẩm — đảo phiếu nhập thành phẩm trước khi huỷ', null);
  var lastX = vs.reduce(function (m, h) { return h.ngay > m ? h.ngay : m; }, '');
  if (ngay < lastX) throw fail('VALIDATION', 'Ngày huỷ không trước phiếu cuối của lệnh (' + lastX + ')', { ngay: 'Từ ' + lastX });
  var doneGoc = {}; made0.forEach(function (h) { doneGoc[h.phieuGoc] = 1; });   // gửi lại sau khi chết giữa chừng: phiếu gốc đã nhập lại bởi chính lệnh này thì bỏ qua
  var back = {}, backS = {};
  vs.forEach(function (h) { if (h.loai === 'NHAP_LAI_SX') h.lines.forEach(function (x) { var k = h.phieuGoc + '#' + x.dongGoc; back[k] = (back[k] || 0) + (Number(x.soLuong) || 0); x.serials.forEach(function (z) { backS[k + '|' + QSerial.norm(z)] = 1; }); }); });
  var xs = mapBy(vs.filter(function (h) { return h.loai === 'XUAT_SX'; }), 'soPhieu'), plan = {}, seenL = {};
  var want = Array.isArray(req.traLai) ? req.traLai : null;
  if (want) want.forEach(function (t, i) {
    if (!t || typeof t !== 'object') throw fail('VALIDATION', 'Dòng trả lại ' + (i + 1) + ' không hợp lệ', null);
    var g = xs[up(t.phieuGoc)], gl = g && g.lines.filter(function (x) { return Number(x.dong) === Number(t.dong); })[0];
    if (!gl) throw fail('VALIDATION', 'Dòng ' + t.phieuGoc + '#' + t.dong + ' không thuộc phiếu xuất của lệnh', null);
    if (seenL[g.soPhieu + '#' + gl.dong]) throw fail('VALIDATION', 'Dòng ' + g.soPhieu + '#' + gl.dong + ' bị lặp trong danh sách trả lại', null); seenL[g.soPhieu + '#' + gl.dong] = 1;
    var q = Number(t.soLuong); if (!(q >= 0) || q > 1e9) throw fail('VALIDATION', 'Số lượng trả lại ≥ 0', null); if (!q || doneGoc[g.soPhieu]) return;
    (plan[g.soPhieu] = plan[g.soPhieu] || []).push({ maHang: gl.maHang, soLuongCT: q, dongGoc: gl.dong, serials: t.serials });
  });
  else Object.keys(xs).forEach(function (so) { xs[so].lines.forEach(function (gl) {   // mặc định: trả lại toàn bộ phần chưa nhập lại
    var k = so + '#' + gl.dong, q = Math.round(((Number(gl.soLuong) || 0) - (back[k] || 0)) * 1000) / 1000; if (q <= 0) return;
    (plan[so] = plan[so] || []).push({ maHang: gl.maHang, soLuongCT: q, dongGoc: gl.dong, serials: gl.serials.filter(function (z) { return !backS[k + '|' + QSerial.norm(z)]; }) });
  }); });
  // kiểm TRƯỚC toàn bộ kế hoạch (mỗi phiếu nhập lại theo 1 phiếu xuất riêng → độc lập), rồi mới ghi
  var ctxs = Object.keys(plan).map(function (so) {
    var g = xs[so], ctx = sxPrep(u, req, { loai: 'NHAP_LAI_SX', ngay: ngay, kho: g.kho, lyDo: 'Nhập lại linh kiện — huỷ lệnh', soCTGoc: l.soLSX, ngayCTGoc: l.ngay, lines: plan[so], soLSX: l.soLSX, phieuGoc: so });
    ctx.lines.forEach(function (x) { if (!items[x.maHang].quanLySerial) x.serials = []; });
    var o = stockOpts(), all = loadVouchers(uniq(ctx.lines.map(function (x) { return x.maHang; })), [l.soLSX]);
    var c = QStock.check(all.vouchers, { soPhieu: '~MOI', stt: 1e15, loai: 'NHAP_LAI_SX', ngay: ngay, kho: g.kho, phieuGoc: so, soLSX: l.soLSX, lines: ctx.lines }, o);
    if (!c.ok) throw fail(c.code, 'Phiếu xuất ' + so + ': ' + engineMsg(c), c.errors);
    var sr = QSerial.apply(QSerial.index(readTable('Serial').rows), { loai: 'NHAP_LAI_SX', kho: g.kho, lines: ctx.lines }, { items: items });
    if (!sr.ok) throw fail(sr.code, 'Phiếu xuất ' + so + ': ' + engineMsg(sr), sr.errors);
    return ctx;
  });
  var made = made0.map(function (h) { return h.soPhieu; }).concat(ctxs.map(function (ctx) { return commitVoucher(u, req, logs, ctx).soPhieu; }));
  var o = stockOpts(), mas = lsxMas(l.soLSX), bal;
  if (mas.length) { var rr = QStock.replay(loadVouchers(mas).vouchers, o); bal = QSX.balance(rr.lsx[l.soLSX], o.lsx[l.soLSX], null); }
  else bal = QSX.balance(null, o.lsx[l.soLSX], null);
  // KC_HUY luôn ghi (kể cả 0) để tự cân khi giá linh kiện của lệnh được tính lại về sau
  appendBlock('ChiPhiLSX', [{ id: 'CP' + pad(nextId('CPLSX'), 6), soLSX: l.soLSX, ngay: ngay, loai: 'KC_HUY', soTien: -bal, soCTGoc: l.soLSX, ngayCTGoc: '', ghiChu: 'Kết chuyển chi phí khi huỷ lệnh: ' + lyDo, nguoiTao: u.email, thoiGian: nowIso(), requestId: String(req.requestId) }]);
  var cur = getLSX(l.soLSX), x = strip(cur); x.trangThai = 'HUY'; x.lyDoHuy = lyDo; putRow('LenhSX', x, cur._row);
  logs.push({ action: 'lsx.huy', doiTuong: 'LenhSX', id: l.soLSX, truoc: { trangThai: l.trangThai }, sau: { trangThai: 'HUY', lyDo: lyDo, nhapLai: made, ketChuyen: bal } });
  return sxMark(u, req, { phieuNhapLai: made, ketChuyen: bal });
}

// ---------- kiểm tra xuất xưởng ----------
function kcsAdd(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var pv = prevRow('KiemTraXX', req)[0]; if (pv) return sxMark(u, req, { lanKiem: pv.lanKiem, dat: pv.dat });
  var ser = QSerial.norm(req.serial), heads = cabHeads(), c = readTable('HoSoTu').rows.filter(function (x) { return x.serial === ser && cabOK(x, heads); })[0];
  if (!c) throw fail('VALIDATION', 'Không có hồ sơ tủ ' + ser, { serial: 'Xê-ri không có' });
  var sr = mapBy(readTable('Serial').rows, 'key')[c.key];
  if (!sr || sr.trangThai !== 'TRONG_KHO') throw fail('VALIDATION', 'Tủ ' + ser + ' không còn trong kho (' + (sr ? sr.trangThai : '?') + ') — không kiểm tra lại', null);
  if (c.soPXX) throw fail('VALIDATION', 'Tủ ' + ser + ' đã có phiếu xuất xưởng ' + c.soPXX + ' — huỷ PXX trước khi kiểm lại', null);
  var ngay = chkDate(String(req.ngay || today())), t = template(c.maMau, c.phienBan), items = t ? t.kcsL : [];
  if (!items.length) throw fail('VALIDATION', 'Mẫu tủ ' + c.maMau + ' bản ' + c.phienBan + ' không có mục kiểm tra', null);
  var res = Array.isArray(req.ketQua) ? req.ketQua.slice(0, 201).map(function (r) { return { ketQua: up(r && r.ketQua), ghiChu: txt(r && r.ghiChu, 300) }; }) : [];
  var k = QSX.kcs(items, res);
  if (!k.ok) throw fail('VALIDATION', (k.errors[0].stt ? 'Mục ' + k.errors[0].stt + ': ' : '') + k.errors[0].msg, k.errors);
  var lan = readTable('KiemTraXX').rows.reduce(function (m, x) { return x.serial === ser ? Math.max(m, Number(x.lanKiem) || 0) : m; }, 0) + 1;
  appendBlock('KiemTraXX', [{ id: 'KT' + pad(nextId('KCS'), 6), serial: ser, lanKiem: lan, ngay: ngay, nguoiKiem: u.email, dat: k.dat, soDat: k.soDat, tongMuc: items.length, thoiGian: nowIso(), requestId: String(req.requestId),
    ketQua: JSON.stringify(items.map(function (it, i) { return { stt: it.stt, noiDung: it.noiDung, yeuCau: it.yeuCau, ketQua: res[i].ketQua, ghiChu: res[i].ghiChu }; })) }]);
  var x = strip(c); x.kcsDat = k.dat; x.lanKiemCuoi = lan; putRow('HoSoTu', x, c._row);
  sxMark(u, req, { lanKiem: lan, dat: k.dat });
  lsxRefresh(c.soLSX);
  logs.push({ action: 'kcs.add', doiTuong: 'KiemTraXX', id: ser, truoc: null, sau: { lanKiem: lan, dat: k.dat, soDat: k.soDat } });
  return { lanKiem: lan, dat: k.dat };
}

// ---------- phiếu xuất xưởng ----------
function pxxIssue(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var pv = prevRow('PhieuXuatXuong', req)[0]; if (pv) return sxMark(u, req, { soPXX: pv.soPXX, lapLai: true });
  var x = req.pxx || {}, ngay = chkDate(String(x.ngay || today()));
  if (!Array.isArray(x.serials) || !x.serials.length || x.serials.length > 50 || x.serials.some(function (s) { return typeof s !== 'string'; })) throw fail('VALIDATION', 'Chọn 1–50 tủ', { serials: '1–50 tủ' });
  var heads = cabHeads(), sers = uniq(x.serials.map(QSerial.norm)), hs = mapBy(readTable('HoSoTu').rows.filter(function (c) { return cabOK(c, heads); }), 'serial'), mau = null;
  var inPxx = {}; readTable('PhieuXuatXuong').rows.forEach(function (p) { if (p.trangThai === 'PHAT_HANH') parseSerials(p.serials).forEach(function (s) { inPxx[s] = p.soPXX; }); });
  sers.forEach(function (s) { var c = hs[s];
    if (!c) throw fail('VALIDATION', 'Không có hồ sơ tủ ' + s, { serials: s });
    if (!c.kcsDat) throw fail('VALIDATION', 'Tủ ' + s + ' chưa đạt kiểm tra xuất xưởng (KCS)', { serials: s });
    if (c.soPXX || inPxx[s]) throw fail('VALIDATION', 'Tủ ' + s + ' đã thuộc phiếu xuất xưởng ' + (c.soPXX || inPxx[s]), { serials: s });
    if (mau && mau !== c.maMau) throw fail('VALIDATION', 'Một phiếu xuất xưởng gồm các tủ cùng mẫu', { serials: s }); mau = c.maMau; });
  var maKH = up(x.maKH), maCT = up(x.maCongTrinh);
  if (maKH && !readTable('KhachHang').rows.some(function (r) { return r.maKH === maKH; })) throw fail('VALIDATION', 'Khách hàng ' + maKH + ' chưa có', { maKH: 'Chọn khách có sẵn' });
  if (maCT && !readTable('CongTrinh').rows.some(function (r) { return r.maCongTrinh === maCT; })) throw fail('VALIDATION', 'Công trình ' + maCT + ' chưa có', { maCongTrinh: 'Chọn công trình có sẵn' });
  var cty = congTy(), yr = Number(ngay.slice(0, 4)), key = 'seq:PXX:' + cty + ':' + yr;
  var n = Math.max(Number(props().getProperty(key) || 0), readTable('PhieuXuatXuong').rows.reduce(function (m, p) { return Number(p.nam) === yr ? Math.max(m, Number(p.so) || 0) : m; }, 0)) + 1;
  var so = QSX.pxxNo(n, yr, cty), lsx = readTable('LenhSX').rows.filter(function (l) { return l.soLSX === hs[sers[0]].soLSX; })[0] || {};
  putMany('HoSoTu', sers.map(function (s) { var c = hs[s]; c.soPXX = so; return c; }));   // gắn tủ TRƯỚC, dòng PXX ghi CUỐI (có dòng PXX = phiếu đủ)
  appendBlock('PhieuXuatXuong', [{ soPXX: so, nam: yr, so: n, ngay: ngay, maKH: maKH, maCongTrinh: maCT, diaDiem: txt(x.diaDiem, 300), serials: JSON.stringify(sers), canCuCheTao: txt(x.canCuCheTao || lsx.canCuCheTao, 300),
    soPhieuXuat: up(x.soPhieuXuat).slice(0, 30), soHoaDon: txt(x.soHoaDon, 30), trangThai: 'PHAT_HANH', nguoiLap: u.email, thoiGian: nowIso(), lyDoHuy: '', ghiChu: txt(x.ghiChu, 500), requestId: String(req.requestId) }]);
  props().setProperty(key, String(n));
  logs.push({ action: 'pxx.issue', doiTuong: 'PhieuXuatXuong', id: so, truoc: null, sau: { serials: sers } });
  return sxMark(u, req, { soPXX: so });
}
function pxxCancel(u, req, logs) {
  var so = txt(req.soPXX, 40), lyDo = txt(req.lyDo, 300);
  if (!lyDo) throw fail('VALIDATION', 'Nhập lý do huỷ phiếu xuất xưởng', { lyDo: 'Bắt buộc' });
  var p = readTable('PhieuXuatXuong').rows.filter(function (r) { return r.soPXX === so; })[0];
  if (!p || p.trangThai !== 'PHAT_HANH') throw fail('VALIDATION', 'Không có phiếu xuất xưởng còn hiệu lực ' + so, null);
  var y = strip(p); y.trangThai = 'HUY'; y.lyDoHuy = lyDo; putRow('PhieuXuatXuong', y, p._row);
  putMany('HoSoTu', readTable('HoSoTu').rows.filter(function (c) { return c.soPXX === so; }).map(function (c) { c.soPXX = ''; return c; }));
  logs.push({ action: 'pxx.cancel', doiTuong: 'PhieuXuatXuong', id: so, truoc: { trangThai: 'PHAT_HANH' }, sau: { trangThai: 'HUY', lyDo: lyDo } });
  return { soPXX: so };
}

// ---------- tra cứu & báo cáo ----------
/** Giá thành từng tủ = giá trị dòng nhập TP chia đều theo xê-ri (tủ cuối của phiếu nhận phần lẻ) — suy ra khi đọc, không lưu. */
function cabinetCosts(soLSX) {
  var m = {};
  lsxVouchers(soLSX).forEach(function (h) { if (h.loai !== 'NHAP_TP') return; h.lines.forEach(function (l) { var p = QSX.split(Number(l.giaTriKho) || 0, l.serials.length || 1); l.serials.forEach(function (s, i) { m[QSerial.norm(s)] = p[i]; }); }); });
  return m;
}
function userNames() { var m = {}; readTable('NguoiDung').rows.forEach(function (r) { m[String(r.email).toLowerCase()] = r.hoTen || ''; }); return m; }
function kcsOut(k, names) { var x = strip(k); delete x.requestId; x.ketQua = parseSerials(k.ketQua); x.nguoiKiemTen = names[String(k.nguoiKiem).toLowerCase()] || ''; return x; }
function sxGet(u, req) {
  var so = up(req.soLSX), l = readTable('LenhSX').rows.filter(function (x) { return x.soLSX === so; })[0];
  if (!l) return { ok: false, code: 'NOT_FOUND', error: 'Không có lệnh ' + so };
  var admin = u.vaiTro === 'QUAN_TRI', t = template(l.maMau, l.phienBan), vs = lsxVouchers(so), heads = cabHeads(), names = userNames();
  var tus = readTable('HoSoTu').rows.filter(function (c) { return c.soLSX === so && (c.trangThai === 'HUY' || heads[c.soPhieuNhap]); }).map(strip), cost = admin ? cabinetCosts(so) : {};
  if (admin) tus.forEach(function (c) { if (c.trangThai !== 'HUY') c.giaThanh = cost[c.serial]; });
  var ss = {}; tus.forEach(function (c) { ss[c.serial] = 1; });
  var out = { lsx: strip(l), template: t ? { maMau: t.maMau, phienBan: t.phienBan, maHang: t.maHang, ten: t.ten, kichThuoc: t.kichThuoc, moTa: t.moTa, vatLieu: t.vatLieu, ketCau: t.ketCau, filePLC: t.filePLC, thongSoDien: t.thongSoDien, ghiChuDM: t.ghiChuDM, thangBH: t.thangBH, bom: t.bomL, kcs: t.kcsL } : null,
    phieu: vs.map(function (h) { var x = strip(h); delete x.lines; if (!admin) delete x.tongTien; x.lines = QPerm.filterLines(u.vaiTro, h.lines); return x; }),
    hoSoTu: tus, kcs: readTable('KiemTraXX').rows.filter(function (k) { return ss[k.serial]; }).map(function (k) { return kcsOut(k, names); }) };
  if (admin) {
    var o = stockOpts(), mas = lsxMas(so), st = null;
    if (mas.length) { var all = loadVouchers(mas); st = QStock.replay(all.vouchers, o).lsx[so]; }
    out.chiPhi = readTable('ChiPhiLSX').rows.filter(function (c) { return c.soLSX === so; }).map(function (c) { var x = strip(c); delete x.requestId; return x; });
    out.doDang = QSX.balance(st, o.lsx[so], today());
  }
  return out;
}
function serialGet(u, req) {
  var q = QSerial.norm(req.serial); if (!q) return { ok: false, code: 'VALIDATION', error: 'Nhập số xê-ri' };
  var heads = cabHeads(), hsAll = readTable('HoSoTu').rows.filter(function (c) { return c.serial === q && (c.trangThai === 'HUY' || heads[c.soPhieuNhap]); }), hs = hsAll.filter(function (c) { return c.trangThai !== 'HUY'; })[0] || hsAll[hsAll.length - 1];
  var srs = readTable('Serial').rows, sk = mapBy(srs, 'key'), sr = hs ? sk[hs.key] : (sk[q] || srs.filter(function (r) { return r.serial === q; })[0]);
  if (!hs && !sr) return { ok: false, code: 'NOT_FOUND', error: 'Không tìm thấy xê-ri ' + q };
  var it = mapBy(readTable('HangHoa').rows, 'maHang')[(hs || sr).maHang] || {}, cha = sr && sr.serialCha ? sk[sr.serialCha] : null;
  var out = { serial: sr ? strip(sr) : null, item: { maHang: it.maHang, ten: it.ten, dvt: it.dvt, hang: it.hang, thangBH: it.thangBH }, cha: cha ? strip(cha) : null };
  if (hs) {
    var names = userNames();
    out.hoSo = strip(hs);
    out.con = parseSerials(hs.serialCon).map(function (k) { var c = sk[k]; return c ? strip(c) : { key: k, serial: k.split('|')[1], trangThai: '?' }; });
    out.kcs = readTable('KiemTraXX').rows.filter(function (k) { return k.serial === q; }).map(function (k) { return kcsOut(k, names); }).sort(function (a, b) { return a.lanKiem - b.lanKiem; });
    var p = hs.soPXX && readTable('PhieuXuatXuong').rows.filter(function (r) { return r.soPXX === hs.soPXX; })[0]; out.pxx = p ? strip(p) : null; if (out.pxx) delete out.pxx.requestId;
    var l = readTable('LenhSX').rows.filter(function (x) { return x.soLSX === hs.soLSX; })[0]; out.lsx = l ? strip(l) : null;
    if (u.vaiTro === 'QUAN_TRI' && hs.trangThai !== 'HUY') out.giaThanh = cabinetCosts(hs.soLSX)[q];
  }
  return out;
}
/** Báo cáo dở dang (TK 154) theo kỳ, mọi lệnh (QT). */
function reportWip(u, req) {
  var from = String(req.from || ''), to = String(req.to || '');
  if (!QValidate.isoDate(from) || !QValidate.isoDate(to) || from > to) return { ok: false, code: 'VALIDATION', error: 'Kỳ báo cáo không hợp lệ' };
  var o = stockOpts(), L = mapBy(readTable('LenhSX').rows, 'soLSX'), vs = loadVouchers(null).vouchers.filter(function (p) { return p.soLSX || p.loai === 'DAO'; });
  var mas = {}; vs.forEach(function (p) { if (p.soLSX) p.lines.forEach(function (l) { mas[l.maHang] = 1; }); });
  var all = loadVouchers(Object.keys(mas)).vouchers;
  return { from: from, to: to, rows: QSX.wipReport(all, o, from, to).map(function (r) { var l = L[r.soLSX] || {}; r.maMau = l.maMau; r.soLuong = l.soLuong; r.trangThai = l.trangThai; return r; }) };
}
