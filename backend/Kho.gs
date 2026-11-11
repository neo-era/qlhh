/** QLHH — máy chủ đợt ②: kho, khách hàng, công trình, quy đổi ĐVT, phiếu kho, phiếu đảo, khoá sổ, tính lại tồn, báo cáo N-X-T.
 *  Dùng lõi đã test: core/stock.js (QStock), core/serial.js (QSerial). Ghép sau Code.gs bởi build.sh. */

// ---------- cấu hình & đọc ----------
function cfg(k) { var r = readTable('CauHinh').rows.filter(function (x) { return x.key === k; })[0]; return r ? String(r.value) : ''; }   // đọc qua bộ đệm
function setCfg(k, v) { var r = findByKey('CauHinh', k); putRow('CauHinh', { key: k, value: String(v) }, r && r._row); }
function stockOpts() {
  var kho = readTable('Kho').rows;
  return { khoLoi: kho.filter(function (k) { return k.loai === 'HANG_LOI'; }).map(function (k) { return k.maKho; }), ngayKhoaSo: cfg('ngayKhoaSo'), kho: kho, lsx: lsxOpts() };
}
/** Lệnh SX cho bộ máy sổ kho: số tủ + chi phí khác theo ngày (giá thành nhập TP tính từ đây). */
function lsxOpts() {
  var o = {}; readTable('LenhSX').rows.forEach(function (l) { o[l.soLSX] = { n: Number(l.soLuong) || 0, chiPhi: [] }; });
  readTable('ChiPhiLSX').rows.forEach(function (c) { if (o[c.soLSX]) o[c.soLSX].chiPhi.push({ ngay: c.ngay, soTien: Number(c.soTien) || 0, loai: c.loai }); });
  return o;
}
function mapBy(rows, k) { var m = {}; rows.forEach(function (r) { m[r[k]] = r; }); return m; }
function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
function parseSerials(v) { if (!v) return []; try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } }

function readTon() {
  var t = readTable('TonKho').rows, ton = {};
  t.forEach(function (r) {
    var m = ton[r.maHang] || (ton[r.maHang] = { pool: { q: 0, v: 0 }, kho: {}, last: null });
    if (r.kho === '*') { m.pool = { q: Number(r.soLuong) || 0, v: Number(r.giaTri) || 0 }; if (r.ngayCuoi) m.last = { ngay: r.ngayCuoi, stt: Number(r.sttCuoi) || 0 }; }
    else m.kho[r.kho] = Number(r.soLuong) || 0;
  });
  return ton;
}
/** Ghi lại TonKho cho các mã `mas` (dòng '*' = tổng giá vốn toàn công ty, mỗi kho 1 dòng số lượng). Ghi 1 khối setValues. */
function writeTon(ton, mas) {
  var s = sheet('TonKho'), cols = QSchema.SHEETS.TonKho.cols, cur = readTable('TonKho').rows, idx = {}, rows = cur.map(function (r) { idx[r.maHang + '|' + r.kho] = r; return r; });
  mas.forEach(function (m) {
    var t = ton[m] || { pool: { q: 0, v: 0 }, kho: {}, last: null };
    var set = function (k, o) { var x = idx[m + '|' + k]; if (!x) { x = { maHang: m, kho: k }; idx[m + '|' + k] = x; rows.push(x); } for (var f in o) x[f] = o[f]; };
    set('*', { soLuong: t.pool.q, giaTri: t.pool.v, ngayCuoi: t.last ? t.last.ngay : '', sttCuoi: t.last ? t.last.stt : '' });
    Object.keys(idx).forEach(function (key) { if (key.indexOf(m + '|') === 0 && key !== m + '|*' && !(key.slice(m.length + 1) in t.kho)) idx[key].soLuong = 0; });
    Object.keys(t.kho).forEach(function (k) { set(k, { soLuong: t.kho[k], giaTri: '' }); });
  });
  if (rows.length) s.getRange(2, 1, rows.length, cols.length).setValues(rows.map(function (r) { return QSchema.toRow('TonKho', r); }));
  dirty('TonKho'); mark('write TonKho');
  writeThrough('TonKho', rows.map(function (r, i) { var o = {}; cols.forEach(function (c) { o[c] = r[c] === undefined ? '' : r[c]; }); o._row = i + 2; return o; }));
}
/** Đọc phiếu HOÀN TẤT có dòng thuộc `mas` (chỉ giữ các dòng của `mas` → tính lại riêng các mã đó). mas=null → tất cả. */
function loadVouchers(mas, lsxs) {   // lsxs: lệnh SX của phiếu sắp ghi (chưa có trên sheet) → mở bao đóng từ đó
  var heads = readTable('Phieu').rows, lines = readTable('ChiTietPhieu').rows, by = {}, rowOf = {}, want = null;
  heads.forEach(function (h) { h.lines = []; by[h.soPhieu] = h; });
  if (mas) {   // bao đóng theo lệnh SX: giá thành tủ phụ thuộc MỌI linh kiện của lệnh → mã nào chạm lệnh thì kéo cả lệnh (và các mã của nó)
    want = {}; mas.forEach(function (m) { want[m] = 1; });
    var maL = {}, lM = {}, seen = {}, q = mas.slice();
    (lsxs || []).forEach(function (x) { maL['\u0000' + x] = mk(x, 1); q.push('\u0000' + x); });
    lines.forEach(function (l) { var h = by[l.soPhieu]; if (!h || !h.soLSX) return; (maL[l.maHang] = maL[l.maHang] || {})[h.soLSX] = 1; (lM[h.soLSX] = lM[h.soLSX] || {})[l.maHang] = 1; });
    while (q.length) { var m = q.pop(); Object.keys(maL[m] || {}).forEach(function (x) { if (seen[x]) return; seen[x] = 1; Object.keys(lM[x] || {}).forEach(function (m2) { if (!want[m2]) { want[m2] = 1; q.push(m2); } }); }); }
  }
  lines.forEach(function (l) {
    var h = by[l.soPhieu]; if (!h) return;
    rowOf[l.soPhieu + '#' + l.dong] = l._row;
    if (want && !want[l.maHang]) return;
    l.serials = parseSerials(l.serials); h.lines.push(l);
  });
  var out = heads.filter(function (h) {
    if (h.loai === 'DAO') { var g = by[h.phieuGoc]; return g && (!want || g.lines.length); }
    return !want || h.lines.length;
  });
  return { vouchers: out, rowOf: rowOf, by: by, mas: want ? Object.keys(want) : null };
}
function loadVoucher(so) {
  var h = findByKey('Phieu', so); if (!h) return null;
  h.lines = readTable('ChiTietPhieu').rows.filter(function (l) { return l.soPhieu === so; }).map(function (l) { l.serials = parseSerials(l.serials); return l; });
  return h;
}
function engineMsg(r) {
  var e = (r.errors || [])[0] || {};
  if (e.code === 'NEG') return (r.code === 'NEGATIVE_STOCK_LATER' ? 'Phiếu làm tồn âm về sau: ' : 'Không đủ tồn: ') + 'mã ' + e.maHang + ' tại kho ' + e.kho + ' ngày ' + e.ngay + ' còn ' + e.ton;
  return (e.dong ? 'Dòng ' + e.dong + ': ' : '') + (e.msg || 'Phiếu không hợp lệ');
}

// ---------- ghi phiếu (dùng chung tạo & đảo) ----------
var CT_COL = QSchema.SHEETS.ChiTietPhieu.cols.indexOf('giaTriKho') + 1, CL_COL = QSchema.SHEETS.ChiTietPhieu.cols.indexOf('chenhLechGV') + 1;
function appendBlock(n, objs) {
  if (!objs.length) return;
  var s = sheet(n), cols = QSchema.SHEETS[n].cols;
  if (objs.length === 1) s.appendRow(QSchema.toRow(n, objs[0]));   // 1 dòng: 1 lệnh gọi (không cần getLastRow)
  else s.getRange(s.getLastRow() + 1, 1, objs.length, cols.length).setValues(objs.map(function (o) { return QSchema.toRow(n, o); }));
  dirty(n); mark('append ' + n);
}
function applySerials(changes, so) {
  if (!changes.length) return;
  var t = nowIso(), s = sheet('Serial'), cols = QSchema.SHEETS.Serial.cols, cur = mapBy(readTable('Serial').rows, 'key'), add = [];
  appendBlock('LichSuSerial', changes.map(function (c) { return { soPhieu: so, key: c.key, maHang: c.maHang, from: c.from || '', to: c.to, khoTu: c.khoTu || '', khoDen: c.kho || '', thoiGian: t }; }));
  changes.forEach(function (c) {
    var rec = { key: c.key, hang: c.hang, serial: c.serial, maHang: c.maHang, trangThai: c.to, kho: c.kho || '', capNhat: t };
    if (cur[c.key]) s.getRange(cur[c.key]._row, 1, 1, cols.length).setValues([QSchema.toRow('Serial', rec)]); else add.push(rec);
  });
  appendBlock('Serial', add); dirty('Serial');
}
function applyChanges(changes, rowOf, mas) {
  var s = sheet('ChiTietPhieu'), n = 0, want = mapBy(mas.map(function (m) { return { m: m }; }), 'm'), sos = {};
  changes.forEach(function (c) { if (!want[c.maHang]) return; var row = rowOf[c.soPhieu + '#' + c.dong]; if (row) { s.getRange(row, CT_COL, 1, 1).setValues([[c.new]]); s.getRange(row, CL_COL, 1, 1).setValues([[c.adj || '']]); n++; sos[c.soPhieu] = 1; } });
  if (n) { dirty('ChiTietPhieu'); refreshTotals(Object.keys(sos)); }   // tổng tiền đầu phiếu theo giá vốn mới
  return n;
}
/** Tổng tiền đầu phiếu = Σ thành tiền (phiếu có đơn giá) hoặc Σ (giá trị kho + chênh lệch GV) — tính lại sau khi giá vốn dòng đổi. sos=null → mọi phiếu. */
function refreshTotals(sos) {
  var want = sos ? mapBy(sos.map(function (x) { return { s: x }; }), 's') : null; if (want && !sos.length) return 0;
  var sum = {}, ps = sheet('Phieu'), cols = QSchema.SHEETS.Phieu.cols, n = 0;
  readTable('ChiTietPhieu').rows.forEach(function (l) { if (want && !want[l.soPhieu]) return; (sum[l.soPhieu] = sum[l.soPhieu] || []).push(l); });
  readTable('Phieu').rows.forEach(function (h) {
    if (want && !want[h.soPhieu]) return; var L = sum[h.soPhieu]; if (!L) return;
    var priced = QStock.TYPES[h.loai] && QStock.TYPES[h.loai].cost === 'PRICE';
    var t = L.reduce(function (a, l) { return a + (priced ? Number(l.thanhTien) || 0 : (Number(l.giaTriKho) || 0) + (Number(l.chenhLechGV) || 0)); }, 0);
    if (t !== Number(h.tongTien)) { var x = strip(h); x.tongTien = t; ps.getRange(h._row, 1, 1, cols.length).setValues([QSchema.toRow('Phieu', x)]); n++; }
  });
  if (n) dirty('Phieu');
  return n;
}
function updateCost(ton, mas) {
  var tb = readTable('HangHoa'), items = tb.rows, s = sheet('HangHoa'), cols = QSchema.SHEETS.HangHoa.cols, ch = false;
  items.forEach(function (it) {
    if (mas.indexOf(it.maHang) < 0) return; var t = ton[it.maHang]; if (!t) return;
    var g = t.pool.q > 0 ? Math.round(t.pool.v / t.pool.q) : it.giaVon;
    if (g !== it.giaVon) { var x = strip(it); x.giaVon = g; s.getRange(it._row, 1, 1, cols.length).setValues([QSchema.toRow('HangHoa', x)]); it.giaVon = g; ch = true; }
  });
  if (ch) { dirty('HangHoa'); if (!tb.warnings.length) writeThrough('HangHoa', items); }
}
function setVoucherState(so, st, extra, known) {   // known = {row, obj}: phiếu vừa ghi, khỏi tìm lại
  var h = known ? Object.assign({ _row: known.row }, known.obj) : findByKey('Phieu', so); if (!h) return; var x = strip(h); x.trangThai = st; for (var k in (extra || {})) x[k] = extra[k];
  delete x.lines; putRow('Phieu', x, h._row);
}
/* Phiếu đang ghi dở: đánh dấu trong cache để lệnh sau biết có phiếu mồ côi mà KHÔNG phải quét sheet Phieu mỗi lần. */
/* info = {loai, phieuGoc, mas}: đủ để dọn phiếu mồ côi khi đầu phiếu CHƯA kịp ghi (đầu phiếu ghi cuối cùng, 1 lần, trạng thái HOAN_TAT). */
function markPending(so, info) { var c = CacheService.getScriptCache(), l = JSON.parse(c.get('pendingList') || '[]'); l.push(so); c.put('pendingList', JSON.stringify(l.slice(-50)), 21600); c.put('pending:' + so, JSON.stringify(info || {}), 21600); }
function clearPending(so) { CacheService.getScriptCache().remove('pending:' + so); }
function pendingList() {   // 1 lần getAll thay cho 1 lần get mỗi phiếu
  var c = CacheService.getScriptCache(), l = JSON.parse(c.get('pendingList') || '[]'); if (!l.length) return [];
  var m = c.getAll(l.map(function (so) { return 'pending:' + so; })), live = l.filter(function (so) { return m['pending:' + so]; });
  if (live.length !== l.length) c.put('pendingList', JSON.stringify(live), 21600); return live;
}

/** Đầu lệnh ghi: phiếu NHAP_DO còn lại chắc chắn mồ côi (đang giữ khoá) → đánh dấu LOI_GHI, trả serial, tính lại tồn các mã của nó. */
function revertSerials(so) {
  var hist = readTable('LichSuSerial').rows.filter(function (h) { return h.soPhieu === so; }); if (!hist.length) return;
  var cur = mapBy(readTable('Serial').rows, 'key'), ss = sheet('Serial'), cols = QSchema.SHEETS.Serial.cols;
  hist.reverse().forEach(function (h) { var c = cur[h.key]; if (!c) return; var x = strip(c); x.trangThai = h.from || 'HUY'; x.kho = h.from ? h.khoTu : ''; x.capNhat = nowIso(); ss.getRange(c._row, 1, 1, cols.length).setValues([QSchema.toRow('Serial', x)]); });
  dirty('Serial');
}
function cleanupOrphans(logs, full) {
  var pend = pendingList(), c = CacheService.getScriptCache();
  if (!pend.length && !full) { mark('orphans none'); return; }   // cache mất (hiếm) → stock.rebuild quét đầy đủ
  pend.forEach(function (so) {
    var info = {}; try { info = JSON.parse(c.get('pending:' + so) || '{}'); } catch (e) { }
    var h = findByKey('Phieu', so);
    if (h && h.trangThai === 'HOAN_TAT') { clearPending(so); return; }   // chết sau khi ghi đầu phiếu: phiếu đã đủ
    if (h) setVoucherState(so, 'LOI_GHI');
    revertSerials(so);
    if (info.loai === 'NHAP_TP') cabinetsVoid(so);   // hồ sơ tủ của phiếu nhập TP dở dang
    var mas = (info.mas || []).concat(readTable('ChiTietPhieu').rows.filter(function (l) { return l.soPhieu === so; }).map(function (l) { return l.maHang; }));
    if (info.loai === 'DAO' && info.phieuGoc) { var g = loadVoucher(info.phieuGoc); if (g) { mas = mas.concat(g.lines.map(function (l) { return l.maHang; })); if (g.daDao) setVoucherState(g.soPhieu, g.trangThai, { daDao: false }); } }
    if (mas.length) rebuildFor(uniq(mas));   // dòng phiếu không có đầu phiếu bị bỏ qua khi tính → TonKho, giá vốn về đúng
    clearPending(so);
    logs.push({ action: 'voucher.orphan', doiTuong: 'Phieu', id: so, truoc: { trangThai: h ? h.trangThai : 'CHUA_GHI_DAU_PHIEU' }, sau: { trangThai: 'LOI_GHI' } });
  });
  if (full) {   // bộ đệm "đang ghi" mất: dòng phiếu / lịch sử serial / hồ sơ tủ không có đầu phiếu = phiếu ghi dở → trả serial, huỷ hồ sơ tủ
    var hd = {}; readTable('Phieu').rows.forEach(function (p) { hd[p.soPhieu] = 1; });
    var orf = uniq(readTable('ChiTietPhieu').rows.map(function (l) { return l.soPhieu; }).concat(readTable('LichSuSerial').rows.map(function (l) { return l.soPhieu; }), readTable('HoSoTu').rows.filter(function (c) { return c.trangThai !== 'HUY'; }).map(function (c) { return c.soPhieuNhap; })).filter(function (so) { return so && !hd[so]; }));
    orf.forEach(function (so) {
      var hist = readTable('LichSuSerial').rows.filter(function (h) { return h.soPhieu === so; }), sk = mapBy(readTable('Serial').rows, 'key');
      var rv = hist.some(function (h) { var c = sk[h.key]; return c && c.trangThai === h.to; }); if (rv) revertSerials(so);   // chỉ trả serial còn đúng trạng thái phiếu dở đã đặt
      if (cabinetsVoid(so) || rv) logs.push({ action: 'voucher.orphan', doiTuong: 'Phieu', id: so, truoc: { trangThai: 'KHONG_DAU_PHIEU' }, sau: { trangThai: 'DA_DON' } });
    });
  }
  if (full) readTail('Phieu', 300).rows.filter(function (p) { return p.trangThai === 'NHAP_DO'; }).forEach(function (p) {   // phiếu dở dang kiểu cũ / bộ đệm mất
    setVoucherState(p.soPhieu, 'LOI_GHI'); revertSerials(p.soPhieu);
    logs.push({ action: 'voucher.orphan', doiTuong: 'Phieu', id: p.soPhieu, truoc: { trangThai: 'NHAP_DO' }, sau: { trangThai: 'LOI_GHI' } });
  });
}
function uniq(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }
function rebuildFor(mas) {
  var o = stockOpts(), all = loadVouchers(mas), r = QStock.replay(all.vouchers, o), changes = [], locked = []; mas = all.mas;
  all.vouchers.forEach(function (p) { if (p.loai === 'DAO' || p.trangThai !== 'HOAN_TAT') return; p.lines.forEach(function (l) {
    var nv = r.lines[p.soPhieu + '#' + l.dong], na = r.adj[p.soPhieu + '#' + l.dong] || 0; if (nv === undefined || (Number(l.giaTriKho) === nv && (Number(l.chenhLechGV) || 0) === na)) return;
    if (o.ngayKhoaSo && p.ngay <= o.ngayKhoaSo) locked.push({ soPhieu: p.soPhieu, dong: l.dong, cu: l.giaTriKho, moi: nv });   // kỳ đã khoá: chỉ báo, không ghi
    else changes.push({ soPhieu: p.soPhieu, dong: l.dong, maHang: l.maHang, new: nv, adj: na });
  }); });
  var n = applyChanges(changes, all.rowOf, mas); syncKcHuy(r.lsx);
  writeTon(r.ton, mas); updateCost(r.ton, mas);
  refreshTotals(all.vouchers.filter(function (p) { return !(o.ngayKhoaSo && p.ngay <= o.ngayKhoaSo); }).map(function (p) { return p.soPhieu; }));   // sửa cả tổng tiền bị sửa tay (trừ kỳ đã khoá)
  return { changes: n, errors: r.errors, lechKyKhoa: locked };
}

// ---------- lập phiếu ----------
var SX_ONLY = ['NHAP_TP', 'NHAP_LAI_SX', 'XUAT_SX'], GOC_OK = ['KHACH_TRA', 'TRA_NCC'];
var SERIAL_RE = /^[A-Z0-9][A-Z0-9._\/\-]{0,59}$/;
/** Phiếu đã HOÀN TẤT với cùng requestId của cùng người (lỗi xảy ra sau khi ghi phiếu, trước khi ghi Request) → trả lại kết quả cũ. */
function doneByRequest(id, email) {   // ghi ở cache NGAY khi phiếu HOÀN TẤT (trước NhatKy/Request) — tra O(1), không quét sheet
  var v = CacheService.getScriptCache().get('done:' + email + ':' + id); if (!v) return null;
  var r = JSON.parse(v); r.lapLai = true; r.tinhLai = 0; return r;
}
function markDone(id, email, so, stt) { CacheService.getScriptCache().put('done:' + email + ':' + id, JSON.stringify({ soPhieu: so, stt: stt }), 21600); }
function noFuture(h) {
  var t = today();
  if (h.ngay > t) throw fail('VALIDATION', 'Ngày phiếu không được sau hôm nay (' + t + ')', { ngay: 'Không quá hôm nay' });
  if (h.ngayCTGoc && h.ngayCTGoc > t) throw fail('VALIDATION', 'Ngày chứng từ gốc không được sau hôm nay', { ngayCTGoc: 'Không quá hôm nay' });
}
/* Chuẩn bị NGOÀI khoá: kiểm đầu phiếu, danh mục, quy đổi dòng — chỉ đọc bảng danh mục, không đụng tồn kho. */
function voucherPrep(u, req, sx) {
  if (!sx) { var dup = doneByRequest(req.requestId, u.email); if (dup) return { done: dup }; }
  var x = req.voucher || {}, h = need(QValidate.voucherHead(x));
  if (!QStock.TYPES[h.loai] || h.loai === 'DAO') throw fail('VALIDATION', 'Loại phiếu không hợp lệ', { loai: 'Chọn loại phiếu' });
  if (!sx && SX_ONLY.indexOf(h.loai) >= 0) throw fail('VALIDATION', 'Phiếu sản xuất được lập từ Lệnh sản xuất', { loai: 'Không lập trực tiếp' });
  if (h.loai === 'TON_DAU' && u.vaiTro !== 'QUAN_TRI') throw fail('FORBIDDEN', 'Chỉ Quản trị lập phiếu tồn đầu kỳ');
  noFuture(h);
  if (GOC_OK.indexOf(h.loai) < 0) h.phieuGoc = '';
  var o = stockOpts(), kho = mapBy(o.kho, 'maKho');
  [['kho', h.kho], ['khoDen', h.khoDen]].forEach(function (k) {
    if (!k[1]) return; var w = kho[k[1]];
    if (!w || w.trangThai !== 'HOAT_DONG') throw fail('VALIDATION', 'Kho ' + k[1] + ' không có hoặc đã ngừng', mk(k[0], 'Chọn kho đang hoạt động'));
  });
  var has = function (n, k, v) { return v && readTable(n).rows.some(function (r) { return r[k] === v; }); };   // 1 lần đọc bảng nhỏ thay cho tìm từng dòng
  if (h.maNCC && !has('NhaCungCap', 'maNCC', h.maNCC)) throw fail('VALIDATION', 'Nhà cung cấp ' + h.maNCC + ' chưa có', { maNCC: 'Chọn NCC có sẵn' });
  if (h.maKH && !has('KhachHang', 'maKH', h.maKH)) throw fail('VALIDATION', 'Khách hàng ' + h.maKH + ' chưa có', { maKH: 'Chọn khách có sẵn' });
  if (h.maCongTrinh && !has('CongTrinh', 'maCongTrinh', h.maCongTrinh)) throw fail('VALIDATION', 'Công trình ' + h.maCongTrinh + ' chưa có', { maCongTrinh: 'Chọn công trình có sẵn' });
  if (h.loai === 'TRA_NCC' && h.phieuGoc) { var gN = findByKey('Phieu', h.phieuGoc); if (gN && gN.maNCC && gN.maNCC !== h.maNCC) throw fail('VALIDATION', 'Phiếu gốc ' + h.phieuGoc + ' là của NCC ' + gN.maNCC, { maNCC: 'Trả đúng NCC đã nhập' }); }
  var items = mapBy(readTable('HangHoa').rows, 'maHang'), qd = readTable('QuyDoiDVT').rows, priced = QStock.TYPES[h.loai].cost === 'PRICE';
  var lines = [], le = [];
  x.lines.forEach(function (l, i) {
    var d = i + 1;
    if (!l || typeof l !== 'object' || Array.isArray(l) || typeof l.maHang !== 'string' || (l.dvt !== undefined && l.dvt !== null && typeof l.dvt !== 'string')) { le.push({ dong: d, field: 'maHang', msg: 'Dòng không hợp lệ' }); return; }
    var ma = l.maHang.trim().toUpperCase(), it = items[ma];
    if (!it) { le.push({ dong: d, field: 'maHang', msg: 'Mã ' + (ma || '(trống)') + ' không có' }); return; }
    var ser = [];
    if (it.quanLySerial && l.serials !== undefined && l.serials !== null) {   // hàng không quản lý serial: bỏ qua serial gửi kèm
      if (!Array.isArray(l.serials) || l.serials.length > 1000 || l.serials.some(function (z) { return typeof z !== 'string' || !SERIAL_RE.test(QSerial.norm(z)); })) { le.push({ dong: d, field: 'serials', msg: 'Số serial chỉ gồm chữ không dấu, số, . _ / - (≤ 60 ký tự)' }); return; }
      ser = l.serials.map(QSerial.norm);
    }
    var y = { dong: d, maHang: ma, dvt: it.dvt, soLuongCT: '', heSo: 1, soLuong: '', donGia: '', thanhTien: '', giaTriKho: '', slSoSach: '', slThucTe: '', dongGoc: Number(l.dongGoc) || '', serials: ser };
    if (h.loai === 'KIEM_KE') { y.slThucTe = Number(l.slThucTe); y.soLuongCT = y.slThucTe; }
    else {
      if (typeof l.soLuongCT !== 'number' && typeof l.soLuongCT !== 'string' || !(Number(l.soLuongCT) > 0)) { le.push({ dong: d, field: 'soLuongCT', msg: 'Số lượng phải là số > 0' }); return; }
      var c = QStock.convert({ maHang: ma, dvt: String(l.dvt || it.dvt), soLuongCT: l.soLuongCT, gia: priced ? l.gia : undefined }, it, qd);
      if (c.error) { le.push({ dong: d, field: 'dvt', msg: c.error }); return; }
      y.dvt = c.dvt; y.soLuongCT = Number(l.soLuongCT); y.heSo = c.heSo; y.soLuong = c.soLuong;
      if (priced) {
        var g = Number(l.gia);
        if (!(g >= 0) || !Number.isInteger(g) || g > 1e12) { le.push({ dong: d, field: 'gia', msg: 'Đơn giá là số nguyên VND từ 0 đến 1.000 tỷ' }); return; }
        y.donGia = c.donGia; y.thanhTien = QStock.money(y.soLuongCT * g);
        if (!Number.isSafeInteger(y.thanhTien)) { le.push({ dong: d, field: 'gia', msg: 'Thành tiền quá lớn' }); return; }
      }
    }
    lines.push(y);
  });
  if (le.length) throw fail('VALIDATION', 'Dòng ' + le[0].dong + ': ' + le[0].msg, le);
  mark('prep');
  return { h: h, o: o, items: items, lines: lines, priced: priced };
}
/* Phần TRONG khoá: tồn kho, kiểm sổ, cấp số, ghi. */
function voucherCreate(u, req, logs, ctx) {
  ctx = ctx || voucherPrep(u, req);
  if (ctx.done) return ctx.done;
  var dup = doneByRequest(req.requestId, u.email); if (dup) return dup;
  cleanupOrphans(logs);
  var r = commitVoucher(u, req, logs, ctx);
  markDone(req.requestId, u.email, r.soPhieu, r.stt);
  return { soPhieu: r.soPhieu, stt: r.stt, tinhLai: r.tinhLai };
}
var BAN_RA = ['XUAT_BAN', 'XUAT_CONG_TRINH', 'XUAT_BH'];
/** Ghi 1 phiếu (trong khoá). opt.beforeHead(soPhieu): ghi thêm dữ liệu kèm phiếu TRƯỚC khi ghi đầu phiếu (vd hồ sơ tủ). */
function commitVoucher(u, req, logs, ctx, opt) {
  opt = opt || {};
  var h = ctx.h, o = ctx.o, items = ctx.items, lines = ctx.lines, priced = ctx.priced;
  o.ngayKhoaSo = cfg('ngayKhoaSo'); o.lsx = lsxOpts();   // đọc lại trong khoá
  var mas = uniq(lines.map(function (l) { return l.maHang; }));
  if (BAN_RA.indexOf(h.loai) >= 0 && lines.some(function (l) { return l.serials.length; })) {   // chỉ bán/giao tủ đã đạt KCS
    var hs = mapBy(readTable('HoSoTu').rows.filter(function (x) { return x.trangThai !== 'HUY'; }), 'serial'), ch = cabHeads();
    lines.forEach(function (l) { l.serials.forEach(function (z) { var c = hs[QSerial.norm(z)];
      if (c && !ch[c.soPhieuNhap]) throw fail('VALIDATION', 'Tủ ' + c.serial + ' thuộc phiếu nhập chưa hoàn tất — Quản trị chạy "Tính lại tồn"', { dong: l.dong });
      if (c && !c.kcsDat) throw fail('VALIDATION', 'Tủ ' + c.serial + ' chưa đạt kiểm tra xuất xưởng (KCS)', { dong: l.dong, serials: 'Kiểm tra xuất xưởng trước' }); }); });
  }
  var ton = readTon(), sttTry = Number(props().getProperty('seq:stt') || 0) + 1;
  if (h.loai === 'KIEM_KE') lines.forEach(function (l) { l.slSoSach = (ton[l.maHang] && ton[l.maHang].kho[h.kho]) || 0; });
  var cand = { soPhieu: '~MOI', stt: sttTry, loai: h.loai, ngay: h.ngay, kho: h.kho, khoDen: h.khoDen, phieuGoc: h.phieuGoc, soLSX: h.soLSX || '', lines: lines };
  var r = QStock.applyFast(ton, cand, o), all = null;
  if (!r) { all = loadVouchers(mas, h.soLSX ? [h.soLSX] : null); mas = all.mas; r = QStock.check(all.vouchers, cand, o); }   // lùi ngày / trả NCC / kiểm kê khi tồn 0 → tính lại đầy đủ (lõi kiểm 'kiểm kê phải mới nhất')
  if (!r.ok) throw fail(r.code, engineMsg(r), r.errors);
  var sr = { changes: [] };
  if (lines.some(function (l) { return items[l.maHang].quanLySerial; })) {
    var vctx = {}; if (h.phieuGoc) { var g0 = loadVoucher(h.phieuGoc); if (g0) vctx[g0.soPhieu] = g0; }
    sr = QSerial.apply(QSerial.index(readTable('Serial').rows), cand, { items: items, khoLoi: o.khoLoi, vouchers: vctx, choLapDat: !!ctx.choLapDat });
    if (!sr.ok) throw fail(sr.code, engineMsg(sr), sr.errors);
  }
  // cấp số trong khoá: thứ tự toàn cục + số theo loại/năm
  var stt = nextId('stt'), pre = QStock.prefix(h.loai), yr = h.ngay.slice(0, 4), so = pre + '-' + yr + '-' + pad(nextId('PH:' + pre + ':' + yr), 5);
  var tong = 0;
  lines.forEach(function (l) { l.soPhieu = so; l.giaTriKho = r.result.lines['~MOI#' + l.dong]; l.chenhLechGV = (r.result.adj && r.result.adj['~MOI#' + l.dong]) || ''; tong += priced ? Number(l.thanhTien) : Number(l.giaTriKho) || 0; });
  var head = { soPhieu: so, stt: stt, loai: h.loai, ngay: h.ngay, kho: h.kho, khoDen: h.khoDen, maNCC: h.maNCC, maKH: h.maKH, maCongTrinh: h.maCongTrinh, phieuGoc: h.phieuGoc, daDao: false,
    trangThai: 'HOAN_TAT', nguoiGiaoNhan: h.nguoiGiaoNhan, lyDo: h.lyDo, soCTGoc: h.soCTGoc, ngayCTGoc: h.ngayCTGoc, tongTien: tong, ghiChu: h.ghiChu, nguoiTao: u.email, thoiGian: nowIso(), requestId: String(req.requestId), hieuLuc: '', soLSX: h.soLSX || '' };
  if (lines.some(function (l) { return JSON.stringify(l.serials).length > 45000; })) throw fail('VALIDATION', 'Quá nhiều serial trong 1 dòng — tách phiếu', null);
  markPending(so, { loai: h.loai, phieuGoc: h.phieuGoc, mas: mas });
  appendBlock('ChiTietPhieu', lines.map(function (l) { var c = {}; for (var k in l) c[k] = l[k]; c.serials = l.serials.length ? JSON.stringify(l.serials.map(QSerial.norm)) : ''; return c; }));
  applySerials(sr.changes, so);
  var changed = all ? applyChanges(r.changes, all.rowOf, mas) : 0;
  if (all) syncKcHuy(r.result.lsx);
  Object.keys(r.result.ton).forEach(function (m) { var t = r.result.ton[m]; if (t.last && t.last.stt === sttTry) t.last.stt = stt; });
  writeTon(r.result.ton, mas); updateCost(r.result.ton, mas);
  if (opt.beforeHead) opt.beforeHead(so, r);
  appendBlock('Phieu', [head]);   // ĐẦU PHIẾU GHI CUỐI, 1 LẦN: có đầu phiếu = phiếu đủ (thiếu đầu phiếu thì dòng phiếu bị bỏ qua và được dọn)
  clearPending(so);
  if (sr.changes.length && typeof cabExitSync === 'function') cabExitSync(sr.changes.map(function (c) { return c.key; }));
  logs.push({ action: 'voucher.create', doiTuong: 'Phieu', id: so, truoc: null, sau: { loai: h.loai, ngay: h.ngay, kho: h.kho, soLSX: h.soLSX || undefined, soDong: lines.length, tinhLai: changed } });
  return { soPhieu: so, stt: stt, tinhLai: changed, lines: lines, head: head };
}
function mk(k, v) { var o = {}; o[k] = v; return o; }

function voucherReverse(u, req, logs) {
  cleanupOrphans(logs);
  var dup = doneByRequest(req.requestId, u.email); if (dup) return dup;
  var gso = String(req.phieuGoc || '').trim(), ngay = String(req.ngay || today()), lyDo = String(req.lyDo || '').trim().slice(0, 300);
  if (!lyDo) throw fail('VALIDATION', 'Nhập lý do đảo phiếu', { lyDo: 'Bắt buộc' });
  if (!QValidate.isoDate(ngay)) throw fail('VALIDATION', 'Ngày phiếu đảo không hợp lệ', { ngay: 'YYYY-MM-DD' });
  noFuture({ ngay: ngay });
  var g = loadVoucher(gso); if (!g || g.trangThai !== 'HOAN_TAT') throw fail('VALIDATION', 'Không có phiếu ' + gso, { phieuGoc: 'Phiếu không tồn tại' });
  if ((g.loai === 'XUAT_BH' || g.loai === 'NHAP_HANG_LOI') && /^BH-\d{4}-\d+$/.test(String(g.soCTGoc || '')) && readTable('PhieuBaoHanh').rows.some(function (t) { return t.soPBH === g.soCTGoc; }))
    throw fail('VALIDATION', 'Phiếu ' + gso + ' là lần thay linh kiện của phiếu bảo hành ' + g.soCTGoc + ' — không đảo riêng (linh kiện đang gắn với hồ sơ tủ)', null);
  if (g.soLSX) {
    var lx = readTable('LenhSX').rows.filter(function (x) { return x.soLSX === g.soLSX; })[0];
    if (lx && lx.trangThai === 'HUY') throw fail('VALIDATION', 'Lệnh ' + g.soLSX + ' đã huỷ — không đảo phiếu của lệnh', null);
    if (g.loai === 'NHAP_TP') readTable('HoSoTu').rows.forEach(function (c) { if (c.soPhieuNhap === gso && c.trangThai !== 'HUY' && c.soPXX) throw fail('VALIDATION', 'Tủ ' + c.serial + ' đã có phiếu xuất xưởng ' + c.soPXX + ' — huỷ PXX trước', null); });
  }
  var o = stockOpts(), all = loadVouchers(uniq(g.lines.map(function (l) { return l.maHang; }))), mas = all.mas;
  var sttTry = Number(props().getProperty('seq:stt') || 0) + 1;
  var cand = { soPhieu: '~MOI', stt: sttTry, loai: 'DAO', ngay: ngay, kho: g.kho, khoDen: g.khoDen, phieuGoc: gso, lines: [] };
  var r = QStock.check(all.vouchers, cand, o);
  if (!r.ok) throw fail(r.code, engineMsg(r), r.errors);
  var hist = readTable('LichSuSerial').rows.filter(function (x) { return x.soPhieu === gso; });
  var sr = QSerial.reverse(QSerial.index(readTable('Serial').rows), hist, '');
  if (!sr.ok) throw fail(sr.code, engineMsg(sr), sr.errors);
  var stt = nextId('stt'), yr = ngay.slice(0, 4), so = 'DA-' + yr + '-' + pad(nextId('PH:DA:' + yr), 5), tong = 0;
  var lines = g.lines.map(function (l) { var v = r.result.lines['~MOI#' + l.dong] || 0; tong += v;
    return { soPhieu: so, dong: l.dong, maHang: l.maHang, dvt: l.dvt, soLuongCT: l.soLuongCT, heSo: l.heSo, soLuong: l.soLuong, donGia: l.donGia, thanhTien: l.thanhTien, giaTriKho: v, slSoSach: l.slSoSach, slThucTe: l.slThucTe, dongGoc: l.dong, serials: l.serials.length ? JSON.stringify(l.serials) : '', chenhLechGV: r.result.adj['~MOI#' + l.dong] || '' }; });
  markPending(so, { loai: 'DAO', phieuGoc: gso, mas: mas }); var dhead = { soPhieu: so, stt: stt, loai: 'DAO', ngay: ngay, kho: g.kho, khoDen: g.khoDen, maNCC: g.maNCC, maKH: g.maKH, maCongTrinh: g.maCongTrinh, phieuGoc: gso, daDao: false,
    trangThai: 'HOAN_TAT', nguoiGiaoNhan: '', lyDo: lyDo, soCTGoc: gso, ngayCTGoc: g.ngay, tongTien: tong, ghiChu: '', nguoiTao: u.email, thoiGian: nowIso(), requestId: String(req.requestId), hieuLuc: r.hieuLuc };
  appendBlock('ChiTietPhieu', lines);
  applySerials(sr.changes, so);
  var changed = applyChanges(r.changes, all.rowOf, mas); syncKcHuy(r.result.lsx);
  writeTon(r.result.ton, mas); updateCost(r.result.ton, mas);
  setVoucherState(gso, 'HOAN_TAT', { daDao: true });
  appendBlock('Phieu', [dhead]);   // đầu phiếu đảo ghi cuối
  clearPending(so); markDone(req.requestId, u.email, so, stt);
  if (g.loai === 'NHAP_TP') cabinetsVoid(gso);
  if (g.soLSX) lsxRefresh(g.soLSX);
  if (sr.changes.length && typeof cabExitSync === 'function') cabExitSync(sr.changes.map(function (c) { return c.key; }));
  logs.push({ action: 'voucher.reverse', doiTuong: 'Phieu', id: so, truoc: { phieuGoc: gso }, sau: { ngay: ngay, lyDo: lyDo, tinhLai: changed } });
  return { soPhieu: so, tinhLai: changed };
}

function voucherGet(u, req) {
  var h = loadVoucher(String(req.soPhieu || '').trim());
  if (!h || ['HOAN_TAT'].indexOf(h.trangThai) < 0) return { ok: false, code: 'NOT_FOUND', error: 'Không có phiếu ' + req.soPhieu };
  var head = strip(h); delete head.lines; if (u.vaiTro !== 'QUAN_TRI') delete head.tongTien;
  return { phieu: head, lines: QPerm.filterLines(u.vaiTro, h.lines) };
}

// ---------- quản trị kho ----------
function periodLock(u, req, logs) {
  var d = String(req.ngay || '');
  if (d && !QValidate.isoDate(d)) throw fail('VALIDATION', 'Ngày khoá sổ không hợp lệ', { ngay: 'YYYY-MM-DD' });
  if (d && d >= today()) throw fail('VALIDATION', 'Chỉ khoá sổ đến trước hôm nay', { ngay: 'Chọn ngày đã qua' });
  var old = cfg('ngayKhoaSo'); setCfg('ngayKhoaSo', d);
  logs.push({ action: d ? 'period.lock' : 'period.unlock', doiTuong: 'CauHinh', id: 'ngayKhoaSo', truoc: { ngay: old }, sau: { ngay: d } });
  return { ngayKhoaSo: d };
}
function stockRebuild(u, req, logs) {
  FRESH = true;   // tính lại: luôn đọc thẳng sheet, không tin bộ đệm
  var w = readTable('Phieu').warnings.concat(readTable('ChiTietPhieu').warnings);
  if (w.length) throw fail('VALIDATION', 'Sheet phiếu có ' + w.length + ' ô sai kiểu, sửa trước khi tính lại (vd ' + w[0] + ')', null);
  cleanupOrphans(logs, true);
  var mas = uniq(readTable('HangHoa').rows.map(function (i) { return i.maHang; }).concat(readTable('ChiTietPhieu').rows.map(function (l) { return l.maHang; })));
  if (typeof cabExitSync === 'function') cabExitSync(readTable('HoSoTu').rows.map(function (c) { return c.key; }));   // lần xuất hiện hành của mọi tủ
  var r = rebuildFor(mas);
  logs.push({ action: 'stock.rebuild', doiTuong: 'TonKho', id: '*', truoc: null, sau: { ma: mas.length, tinhLai: r.changes, loi: r.errors.length } });
  return { ma: mas.length, tinhLai: r.changes, loiTonAm: r.errors.slice(0, 50), lechKyKhoa: r.lechKyKhoa.slice(0, 50) };
}
function reportNxt(u, req) {
  var from = String(req.from || ''), to = String(req.to || '');
  if (!QValidate.isoDate(from) || !QValidate.isoDate(to) || from > to) return { ok: false, code: 'VALIDATION', error: 'Kỳ báo cáo không hợp lệ' };
  var o = stockOpts(), all = loadVouchers(null), items = mapBy(readTable('HangHoa').rows, 'maHang');
  return { from: from, to: to, rows: QStock.nxt(all.vouchers, from, to, o).map(function (r) { var it = items[r.maHang] || {}; r.ten = it.ten || ''; r.dvt = it.dvt || ''; return r; }) };
}

// ---------- danh mục đợt ② ----------
function simpleUpsert(n, kf, v, req, logs, act) {
  var cur = findByKey(n, v[kf]);
  if (req.isNew && cur) throw fail('VALIDATION', 'Mã ' + v[kf] + ' đã có', mk(kf, 'Mã đã tồn tại'));
  putRow(n, v, cur && cur._row);
  logs.push({ action: act, doiTuong: n, id: v[kf], truoc: cur ? strip(cur) : null, sau: v });
  return mk(kf, v[kf]);
}
function warehouseUpsert(u, req, logs) { return simpleUpsert('Kho', 'maKho', need(QValidate.warehouse(req.warehouse)), req, logs, 'warehouse.upsert'); }
function customerUpsert(u, req, logs) { return simpleUpsert('KhachHang', 'maKH', need(QValidate.customer(req.customer)), req, logs, 'customer.upsert'); }
function projectUpsert(u, req, logs) {
  var v = need(QValidate.project(req.project));
  if (v.maKH && !findByKey('KhachHang', v.maKH)) throw fail('VALIDATION', 'Khách hàng ' + v.maKH + ' chưa có', { maKH: 'Chọn khách có sẵn' });
  return simpleUpsert('CongTrinh', 'maCongTrinh', v, req, logs, 'project.upsert');
}
function unitUpsert(u, req, logs) {
  var v = need(QValidate.unit(req.unit)), it = findByKey('HangHoa', v.maHang);
  if (!it) throw fail('VALIDATION', 'Không có mã hàng ' + v.maHang, { maHang: 'Chọn mã có sẵn' });
  if (v.dvtPhu === it.dvt) throw fail('VALIDATION', 'ĐVT phụ trùng ĐVT chính', { dvtPhu: 'Khác ĐVT chính (' + it.dvt + ')' });
  v.id = v.maHang + '|' + v.dvtPhu;
  return simpleUpsert('QuyDoiDVT', 'id', v, req, logs, 'unit.upsert');
}
