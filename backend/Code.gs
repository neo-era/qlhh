/** QLHH — máy chủ Apps Script v0.2 (đợt ①: danh mục, giá, NCC, người dùng, góp ý · đợt ②: kho — xem backend/Kho.gs).
 *  Dán chung 1 file với lõi: core/auth.js, idem.js, schema.js, validate.js, perm.js, price.js, stock.js, serial.js (do build.sh ghép).
 *  Thiết kế: QLHH-thiet-ke.md. */
var VER = '0.2.0';
var SESSION_TTL = 10 * 3600;

// ======================= CÀI ĐẶT =======================
function setup() {
  var ss = SpreadsheetApp.getActive(), me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!me) throw new Error('Không đọc được email chủ — kiểm tra scope userinfo.email');
  Object.keys(QSchema.SHEETS).forEach(function (n) {
    var d = QSchema.SHEETS[n], s = ss.getSheetByName(n) || ss.insertSheet(n);
    if (s.getLastRow() === 0) s.appendRow(d.cols);
    s.setFrozenRows(1);
    d.cols.forEach(function (c, i) { if ((d.num || []).indexOf(c) < 0) { var L = String.fromCharCode(65 + i); s.getRange(L + ':' + L).setNumberFormat('@'); } });   // mọi cột chữ dạng văn bản: không tự đổi kiểu, không chạy công thức
  });
  var nd = ss.getSheetByName('NguoiDung');
  var has = nd.getDataRange().getValues().some(function (r) { return String(r[0]).trim().toLowerCase() === me; });
  if (!has) nd.appendRow([me, 'Chủ hệ thống', 'QUAN_TRI', 'HOAT_DONG', new Date().toISOString()]);
  var p = props();
  if (!p.getProperty('SESSION_KEY')) p.setProperty('SESSION_KEY', Utilities.getUuid() + Utilities.getUuid());
  if (!p.getProperty('CLIENT_ID')) p.setProperty('CLIENT_ID', 'DIEN_CLIENT_ID_VAO_DAY');
  if (!p.getProperty('dataVersion')) p.setProperty('dataVersion', '1');
  CACHE_T.forEach(function (n) { p.setProperty('ver:' + n, newVer()); });   // setup có thể đổi sheet → bỏ toàn bộ bộ đệm
  var kho = ss.getSheetByName('Kho');
  if (kho.getLastRow() < 2) {   // 2 kho mặc định: kho chính + kho hàng lỗi (nhận hàng bảo hành, không tính giá vốn)
    kho.appendRow(QSchema.toRow('Kho', { maKho: 'KHO', ten: 'Kho chính', diaChi: '', loai: 'THUONG', trangThai: 'HOAT_DONG' }));
    kho.appendRow(QSchema.toRow('Kho', { maKho: 'KHO-LOI', ten: 'Kho hàng lỗi', diaChi: '', loai: 'HANG_LOI', trangThai: 'HOAT_DONG' }));
  }
  Logger.log('Xong setup v%s. Chủ: %s', VER, me);
}

// ======================= KHUNG =======================
function doGet() { return out({ ok: true, code: 'OK', data: { app: 'QLHH', ver: VER } }); }
function doPost(e) {
  var t0 = Date.now();
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    MEMO = {}; PROF = [[ 'start', t0 ]]; DIRTY = {}; WT = {}; VERS = null; FRESH = false;
    var res; try { res = route(req); } finally { flushVers(); }
    res.ms = Date.now() - t0; res.ver = VER;
    if (req.prof && res.ok) res.prof = PROF.map(function (x, i) { return x[0] + ':' + (i ? x[1] - PROF[i - 1][1] : 0); }).join(' ');
    return out(res);
  } catch (err) {
    if (err && err.qlhh) return out(err.qlhh);
    console.error(err && err.stack || err);
    return out({ ok: false, code: 'INTERNAL', error: 'Lỗi máy chủ, thử lại', ms: Date.now() - t0 });
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail(code, error, fields) { var e = new Error(error); e.qlhh = { ok: false, code: code, error: error, fields: fields || null }; return e; }
function now() { return Math.floor(Date.now() / 1000); }
function nowIso() { return new Date().toISOString(); }
function today() { return Utilities.formatDate ? Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd') : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
function hmac(key, msg) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(msg, key)).replace(/=+$/, ''); }
function sha(s) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)); }
function props() { return PropertiesService.getScriptProperties(); }
function sheet(n) { var s = SpreadsheetApp.getActive().getSheetByName(n); if (!s) throw fail('SCHEMA', 'Thiếu sheet ' + n + ' — chạy setup()'); return s; }

var PUBLIC = { ping: 1, 'auth.nonce': 1, 'auth.login': 1 };
var HANDLERS = {
  'auth.me': function (u) { return { email: u.email, vaiTro: u.vaiTro, hoTen: u.hoTen, ver: VER }; },
  'sync.pull': syncPull,
  'item.upsert': function (u, r) { return write(u, r, itemUpsert); },
  'item.stop': function (u, r) { return write(u, r, itemStop); },
  'group.upsert': function (u, r) { return write(u, r, groupUpsert); },
  'supplier.upsert': function (u, r) { return write(u, r, supplierUpsert); },
  'price.add': function (u, r) { return write(u, r, priceAdd); },
  'user.upsert': function (u, r) { return write(u, r, userUpsert); },
  'feedback.add': function (u, r) { return write(u, r, feedbackAdd); },
  'feedback.update': function (u, r) { return write(u, r, feedbackUpdate); },
  'admin.schemaCheck': function () { return { errors: schemaErrors(true) }; },
  'warehouse.upsert': function (u, r) { return write(u, r, warehouseUpsert); },
  'customer.upsert': function (u, r) { return write(u, r, customerUpsert); },
  'project.upsert': function (u, r) { return write(u, r, projectUpsert); },
  'unit.upsert': function (u, r) { return write(u, r, unitUpsert); },
  'voucher.create': function (u, r) { return write(u, r, voucherCreate, voucherPrep); },
  'voucher.reverse': function (u, r) { return write(u, r, voucherReverse); },
  'voucher.get': voucherGet,
  'period.lock': function (u, r) { return write(u, r, periodLock); },
  'stock.rebuild': function (u, r) { return write(u, r, stockRebuild); },
  'report.nxt': reportNxt
};

function route(req) {
  switch (req.action) {
    case 'ping': return { ok: true, code: 'OK', data: { t: nowIso(), ver: VER } };
    case 'auth.nonce': return issueNonce();
    case 'auth.login': return login(req);
  }
  var s = QAuth.verifySession(req.session, now(), props().getProperty('SESSION_KEY'), hmac);
  if (!s.ok) return s;
  var u = findUser(s.email);
  if (!u) return { ok: false, code: 'FORBIDDEN', error: 'Tài khoản chưa được cấp quyền hoặc đã bị khoá' };
  if (!HANDLERS[req.action]) return { ok: false, code: 'VALIDATION', error: 'Lệnh không hợp lệ' };
  if (!QPerm.can(u.vaiTro, req.action)) return { ok: false, code: 'FORBIDDEN', error: 'Vai trò ' + u.vaiTro + ' không được làm việc này' };
  var r = HANDLERS[req.action](u, req);
  return r && r.ok !== undefined ? r : { ok: true, code: 'OK', data: r };
}

// ======================= XÁC THỰC =======================
function issueNonce() {
  var n = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('n:' + n, '1', 600);
  return { ok: true, code: 'OK', data: { nonce: n } };
}
function login(req) {
  var p = props(), cid = p.getProperty('CLIENT_ID');
  if (typeof req.idToken !== 'string' || !req.idToken || req.idToken.length > 4096) return { ok: false, code: 'VALIDATION', error: 'Thiếu idToken' };
  var cache = CacheService.getScriptCache(), th = 't:' + sha(req.idToken);
  var prev = cache.get('r:' + th); if (prev) return JSON.parse(prev);   // gửi lại cùng token trong 2 phút
  var claims = null, wait = 500;
  for (var i = 0; i < 3 && !claims; i++) {
    var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(req.idToken), { muteHttpExceptions: true });
    var c = r.getResponseCode();
    if (c === 200) claims = JSON.parse(r.getContentText());
    else if (c === 400) return { ok: false, code: 'AUTH_INVALID', error: 'Token Google không hợp lệ' };
    else { Utilities.sleep(wait); wait *= 2; }
  }
  if (!claims) return { ok: false, code: 'INTERNAL', error: 'Không xác minh được với Google, thử lại' };
  var n = String(claims.nonce || '');
  if (!n || cache.get('n:' + n) !== '1') return { ok: false, code: 'AUTH_INVALID', error: 'Nonce không hợp lệ hoặc đã dùng' };
  if (cache.get(th)) return { ok: false, code: 'AUTH_INVALID', error: 'Token đã được dùng' };
  var chk = QAuth.checkClaims(claims, { clientId: cid, nonce: n, now: now() });
  if (!chk.ok) return chk;
  cache.remove('n:' + n);
  var u = findUser(chk.email, true);
  if (!u) return { ok: false, code: 'FORBIDDEN', error: 'Email ' + chk.email + ' chưa được cấp quyền hoặc đã bị khoá' };
  var res = { ok: true, code: 'OK', data: { session: QAuth.issueSession(chk.email, now(), SESSION_TTL, p.getProperty('SESSION_KEY'), hmac), email: chk.email, vaiTro: u.vaiTro, hoTen: u.hoTen } };
  cache.put('r:' + th, JSON.stringify(res), 120);
  cache.put(th, '1', Math.max(1, Math.min(21600, Number(claims.exp) - now())));
  return res;
}
function findUser(email, fresh) {
  var c = CacheService.getScriptCache(), k = 'u:' + email, v = fresh ? null : c.get(k);
  if (v) return JSON.parse(v);
  var rows = QSchema.toObjects('NguoiDung', sheet('NguoiDung').getDataRange().getValues()).rows, u = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].email).trim().toLowerCase() === email && String(rows[i].trangThai).trim() === 'HOAT_DONG') { u = { email: email, vaiTro: String(rows[i].vaiTro).trim(), hoTen: rows[i].hoTen }; break; }
  }
  if (u) c.put(k, JSON.stringify(u), 60); else c.remove(k);
  return u;
}

// ======================= ĐỌC =======================
var TABLES = { items: 'HangHoa', groups: 'NhomHang', suppliers: 'NhaCungCap', prices: 'BangGia', users: 'NguoiDung', feedback: 'GopY', logs: 'NhatKy',
  warehouses: 'Kho', units: 'QuyDoiDVT', customers: 'KhachHang', projects: 'CongTrinh', vouchers: 'Phieu', stock: 'TonKho', serials: 'Serial' };
/* Bộ nhớ tạm trong 1 lệnh (MEMO): mỗi sheet chỉ đọc 1 lần; ghi sheet nào thì xoá bản nhớ sheet đó (dirty). Trả bản sao nông.
   Bộ đệm GIỮA các lệnh (CacheService) cho bảng danh mục + TonKho, khoá theo PHIÊN BẢN của từng sheet (ScriptProperties 'ver:<sheet>'):
   - ghi sheet → cấp phiên bản mới (DIRTY), đẩy lên ScriptProperties TRƯỚC khi nhả khoá (kể cả khi lỗi) → không lệnh nào đọc phải bản cũ;
   - ghi xong cả bảng (TonKho, HangHoa) → đặt luôn bản mới vào bộ đệm (write-through) để lệnh sau khỏi đọc lại;
   - sheet bị sửa tay ngoài app: bộ đệm sống tối đa 10 phút; "Tính lại tồn" luôn đọc thẳng sheet (FRESH). */
var MEMO = {}, PROF = [], DIRTY = {}, WT = {}, VERS = null, FRESH = false;
var CACHE_T = ['HangHoa', 'NhomHang', 'NhaCungCap', 'BangGia', 'Kho', 'QuyDoiDVT', 'KhachHang', 'CongTrinh', 'TonKho', 'CauHinh'];
function mark(l) { PROF.push([l, Date.now()]); }
function newVer() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function vers() { if (!VERS) VERS = props().getProperties(); return VERS; }
function cachedT(n) { return CACHE_T.indexOf(n) >= 0; }
function dirty(n) {
  delete MEMO[n]; Object.keys(MEMO).forEach(function (k) { if (k.indexOf(n + '#') === 0) delete MEMO[k]; });
  if (cachedT(n) && (!DIRTY[n] || WT[n])) { DIRTY[n] = newVer(); WT[n] = false; }
}
function flushVers() {   // gọi trước khi nhả khoá / cuối lệnh
  var ks = Object.keys(DIRTY); if (!ks.length) return;
  var o = {}; ks.forEach(function (n) { o['ver:' + n] = DIRTY[n]; }); props().setProperties(o);
  if (VERS) ks.forEach(function (n) { VERS['ver:' + n] = DIRTY[n]; }); DIRTY = {}; WT = {};
}
var CH = 30000;
function tkey(n, v) { return 'tbl:' + n + ':' + v; }
function cacheGetT(n) {
  var v = vers()['ver:' + n]; if (!v) return null;
  var c = CacheService.getScriptCache(), meta = c.get(tkey(n, v)); if (!meta) return null;
  var keys = []; for (var i = 0; i < Number(meta); i++) keys.push(tkey(n, v) + '#' + i);
  var m = c.getAll(keys), str = '';
  for (var j = 0; j < keys.length; j++) { if (!(keys[j] in m)) return null; str += m[keys[j]]; }
  try { return JSON.parse(str); } catch (e) { return null; }
}
function cachePutT(n, v, t) {
  try {
    var str = JSON.stringify(t), k = Math.ceil(str.length / CH) || 1; if (k > 30) return;   // bảng quá lớn (> ~900 nghìn ký tự): không đệm
    var o = {}; for (var i = 0; i < k; i++) o[tkey(n, v) + '#' + i] = str.slice(i * CH, (i + 1) * CH);
    o[tkey(n, v)] = String(k); CacheService.getScriptCache().putAll(o, 600);
  } catch (e) { /* bộ đệm lỗi thì thôi, đọc sheet */ }
}
/** Đặt nội dung mới của cả bảng vào MEMO + bộ đệm (sau khi chính lệnh này vừa ghi toàn bảng). */
function writeThrough(n, rows) {
  MEMO[n] = { rows: rows, warnings: [] };
  if (!cachedT(n)) return;
  if (!DIRTY[n]) DIRTY[n] = newVer();
  cachePutT(n, DIRTY[n], MEMO[n]); WT[n] = true;
}
function cloneT(t) { return { rows: t.rows.map(function (r) { var c = {}; for (var k in r) c[k] = r[k]; return c; }), warnings: t.warnings }; }
function readTable(n) {
  if (MEMO[n]) return cloneT(MEMO[n]);
  if (cachedT(n) && !DIRTY[n] && !FRESH) { var t = cacheGetT(n); if (t) { MEMO[n] = t; mark('cache ' + n); return cloneT(t); } }
  MEMO[n] = QSchema.toObjects(n, sheet(n).getDataRange().getValues()); mark('read ' + n);
  if (cachedT(n) && !DIRTY[n]) {
    var v = vers()['ver:' + n]; if (!v) { v = newVer(); props().setProperty('ver:' + n, v); VERS['ver:' + n] = v; }
    cachePutT(n, v, MEMO[n]);
  }
  return cloneT(MEMO[n]);
}
function readTail(n, k) { var key = n + '#tail' + k; if (MEMO[n]) { var t = MEMO[n], rows = t.rows.slice(-k); return cloneT({ rows: rows, warnings: t.warnings }); } if (!MEMO[key]) { MEMO[key] = readTail0(n, k); mark('tail ' + n); } return cloneT(MEMO[key]); }
function readTail0(n, k) {
  var s = sheet(n), last = s.getLastRow(), cols = QSchema.SHEETS[n].cols;
  if (last < 2) return { rows: [], warnings: [] };
  var from = Math.max(2, last - k + 1);
  return QSchema.toObjects(n, [cols].concat(s.getRange(from, 1, last - from + 1, cols.length).getValues()));
}
function syncPull(u, req) {
  var ver = Number(props().getProperty('dataVersion') || 1);   // đọc version TRƯỚC dữ liệu
  if (req.since && Number(req.since) === ver) return { unchanged: true, version: ver };
  var raw = {}, warnings = [];
  Object.keys(TABLES).forEach(function (k) {
    if (k === 'logs' && u.vaiTro !== 'QUAN_TRI') { raw[k] = []; return; }
    var t = k === 'logs' ? readTail('NhatKy', 300) : k === 'vouchers' ? readTail('Phieu', 500) : readTable(TABLES[k]); raw[k] = t.rows; warnings = warnings.concat(t.warnings);
  });
  raw.vouchers = raw.vouchers.filter(function (p) { return p.trangThai === 'HOAN_TAT'; });
  raw.serials = raw.serials.filter(function (x) { return x.trangThai === 'TRONG_KHO' || x.trangThai === 'HANG_LOI'; });   // để chọn serial khi xuất
  raw.config = { ngayKhoaSo: cfg('ngayKhoaSo') };
  return { version: ver, data: QPerm.filterForRole(u.vaiTro, u.email, raw), warnings: u.vaiTro === 'QUAN_TRI' ? warnings : [], today: today(), me: { email: u.email, vaiTro: u.vaiTro, hoTen: u.hoTen } };
}
function schemaErrors(force) {
  var c = CacheService.getScriptCache();
  if (!force) { var v = c.get('schemaOK'); if (v === '1') return []; }
  var heads = {}, ss = SpreadsheetApp.getActive();
  Object.keys(QSchema.SHEETS).forEach(function (n) { var s = ss.getSheetByName(n); if (s) heads[n] = s.getLastColumn() ? s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0] : []; });
  var errs = QSchema.check(heads);
  if (!errs.length) c.put('schemaOK', '1', 60); else c.remove('schemaOK');
  return errs;
}

// ======================= GHI (khoá + idempotent + nhật ký) =======================
function write(u, req, fn, pre) {
  if (!QIdem.validId(req.requestId)) return { ok: false, code: 'VALIDATION', error: 'requestId không hợp lệ' };
  var ctx = null;
  if (pre) { try { ctx = pre(u, req); } catch (err) { if (err && err.qlhh) return err.qlhh; throw err; } }   // kiểm/đọc danh mục NGOÀI khoá → giữ khoá ngắn
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, code: 'LOCK_TIMEOUT', error: 'Máy chủ bận, thử lại' };
  var t0 = Date.now();
  try {
    var se = schemaErrors(false);
    if (se.length) return { ok: false, code: 'SCHEMA', error: 'Sheet sai cấu trúc: ' + se[0].sheet + ' – ' + se[0].msg, fields: se };
    var rq = sheet('Request'), logs = [];
    var store = {
      get: function (id) { return findRequest(rq, id); },
      set: function (id, v) { rq.appendRow(QSchema.toRow('Request', { requestId: String(id), email: String(v.email), thoiGian: nowIso(), ketQua: JSON.stringify(v.data) })); }
    };
    var res = QIdem.once(store, u.email, req.requestId, function () {
      var d = fn(u, req, logs, ctx);
      appendBlock('NhatKy', logs.map(function (l) { return { thoiGian: nowIso(), email: u.email, action: l.action, doiTuong: l.doiTuong, id: String(l.id), truoc: l.truoc ? JSON.stringify(l.truoc).slice(0, 45000) : '', sau: l.sau ? JSON.stringify(l.sau).slice(0, 45000) : '', requestId: String(req.requestId) }; }));   // 1 lần ghi
      bumpVersion();
      return d;
    });
    SpreadsheetApp.flush();
    if (res.ok) { res.code = 'OK'; res.lockMs = Date.now() - t0; }
    return res;
  } catch (err) {
    if (err && err.qlhh) return err.qlhh;
    throw err;
  } finally { try { flushVers(); } finally { lock.releaseLock(); } }   // phiên bản bảng lên TRƯỚC khi nhả khoá
}
function findRequest(rq, id) {
  if (rq.getLastRow() < 2) return null;
  var cell = rq.getRange(2, 1, rq.getLastRow() - 1, 1).createTextFinder(String(id)).matchEntireCell(true).matchCase(true).findNext();
  if (!cell) return null;
  var r = rq.getRange(cell.getRow(), 1, 1, 4).getValues()[0], data;
  try { data = JSON.parse(r[3]); } catch (e) { data = { loi: 'ketQua hỏng' }; }
  return { email: String(r[1]), data: data };
}
function bumpVersion() { var p = props(); p.setProperty('dataVersion', String(Number(p.getProperty('dataVersion') || 1) + 1)); }
function nextId(key) { var p = props(), v = Number(p.getProperty('seq:' + key) || 0) + 1; p.setProperty('seq:' + key, String(v)); return v; }

/** Tìm 1 dòng theo khoá (cột đầu) bằng TextFinder. Trả {row, obj} hoặc null. */
function findByKey(n, key) {
  var s = sheet(n); if (s.getLastRow() < 2 || key === '' || key === null || key === undefined) return null;
  var cell = s.getRange(2, 1, s.getLastRow() - 1, 1).createTextFinder(String(key)).matchEntireCell(true).matchCase(true).findNext();
  if (!cell) return null;
  var cols = QSchema.SHEETS[n].cols, v = s.getRange(cell.getRow(), 1, 1, cols.length).getValues()[0];
  var o = QSchema.toObjects(n, [cols, v]).rows[0] || {};
  o._row = cell.getRow(); return o;
}
function putRow(n, obj, row) {
  dirty(n);
  var s = sheet(n), vals = QSchema.toRow(n, obj);
  if (row) s.getRange(row, 1, 1, vals.length).setValues([vals]); else s.appendRow(vals);
}
function strip(o) { var c = {}; for (var k in o) if (k !== '_row') c[k] = o[k]; return c; }
function need(r) { if (!r.ok) throw fail('VALIDATION', firstErr(r.errors), r.errors); return r.value; }
function firstErr(e) { var k = Object.keys(e)[0]; return e[k]; }

// ======================= NGHIỆP VỤ =======================
function itemUpsert(u, req, logs) {
  var v = need(QValidate.item(req.item));
  if (v.nhom && !findByKey('NhomHang', v.nhom)) throw fail('VALIDATION', 'Nhóm hàng ' + v.nhom + ' chưa có', { nhom: 'Chọn nhóm có sẵn' });
  var cur = findByKey('HangHoa', v.maHang);
  if (req.isNew && cur) throw fail('VALIDATION', 'Mã hàng ' + v.maHang + ' đã có', { maHang: 'Mã đã tồn tại' });
  if (!req.isNew && !cur) throw fail('NOT_FOUND', 'Không có mã hàng ' + v.maHang);
  v.giaVon = cur ? cur.giaVon : '';
  if (cur) v.giaBan = cur.giaBan;              // giá vốn do hệ thống tính, không nhận từ client
  if (cur && cur.trangThai) v.trangThai = cur.trangThai;   // đổi trạng thái qua item.stop
  v.capNhat = nowIso();
  if (!cur && v.giaBan !== '' && v.giaBan > 0) {   // giá bán ban đầu → ghi vào lịch sử giá TRƯỚC dòng hàng
    var g = { id: 'G' + ('000000' + nextId('BangGia')).slice(-6), maHang: v.maHang, loai: 'BAN', maNCC: '', gia: v.giaBan, tuNgay: today(), ghiChu: 'Giá ban đầu', nguoiTao: u.email, thoiGian: nowIso() };
    putRow('BangGia', g);
  }
  putRow('HangHoa', v, cur && cur._row);
  logs.push({ action: 'item.upsert', doiTuong: 'HangHoa', id: v.maHang, truoc: cur ? strip(cur) : null, sau: v });
  return { maHang: v.maHang };
}
function itemStop(u, req, logs) {
  var ma = String(req.maHang || '').trim().toUpperCase(), cur = findByKey('HangHoa', ma);
  if (!cur) throw fail('NOT_FOUND', 'Không có mã hàng ' + ma);
  var v = strip(cur); v.trangThai = req.ngung ? 'NGUNG' : 'KD'; v.capNhat = nowIso();
  putRow('HangHoa', v, cur._row);
  logs.push({ action: req.ngung ? 'item.stop' : 'item.resume', doiTuong: 'HangHoa', id: ma, truoc: { trangThai: cur.trangThai }, sau: { trangThai: v.trangThai } });
  return { maHang: ma, trangThai: v.trangThai };
}
function groupUpsert(u, req, logs) {
  var v = need(QValidate.group(req.group));
  if (v.cha && !findByKey('NhomHang', v.cha)) throw fail('VALIDATION', 'Nhóm cha ' + v.cha + ' chưa có', { cha: 'Chọn nhóm có sẵn' });
  if (v.cha) {   // chặn vòng lặp cha–con (A thuộc B, B thuộc A)
    var all = {}; readTable('NhomHang').rows.forEach(function (r) { all[r.maNhom] = r.cha; });
    for (var x = v.cha, n = 0; x && n < 50; x = all[x], n++) if (x === v.maNhom) throw fail('VALIDATION', 'Nhóm cha tạo vòng lặp', { cha: 'Không chọn nhóm con làm nhóm cha' });
  }
  var cur = findByKey('NhomHang', v.maNhom);
  putRow('NhomHang', v, cur && cur._row);
  logs.push({ action: 'group.upsert', doiTuong: 'NhomHang', id: v.maNhom, truoc: cur ? strip(cur) : null, sau: v });
  return { maNhom: v.maNhom };
}
function supplierUpsert(u, req, logs) {
  var v = need(QValidate.supplier(req.supplier)), cur = findByKey('NhaCungCap', v.maNCC);
  if (req.isNew && cur) throw fail('VALIDATION', 'Mã NCC ' + v.maNCC + ' đã có', { maNCC: 'Mã đã tồn tại' });
  putRow('NhaCungCap', v, cur && cur._row);
  logs.push({ action: 'supplier.upsert', doiTuong: 'NhaCungCap', id: v.maNCC, truoc: cur ? strip(cur) : null, sau: v });
  return { maNCC: v.maNCC };
}
function priceAdd(u, req, logs) {
  var v = need(QValidate.price(req.price));
  var it = findByKey('HangHoa', v.maHang);
  if (!it) throw fail('VALIDATION', 'Không có mã hàng ' + v.maHang, { maHang: 'Chọn mã có sẵn' });
  if (v.loai === 'NHAP' && !findByKey('NhaCungCap', v.maNCC)) throw fail('VALIDATION', 'Nhà cung cấp ' + v.maNCC + ' chưa có', { maNCC: 'Chọn NCC có sẵn' });
  v.id = 'G' + ('000000' + nextId('BangGia')).slice(-6); v.nguoiTao = u.email; v.thoiGian = nowIso();
  putRow('BangGia', v);
  if (v.loai === 'BAN') {                       // cập nhật giá bán hiện hành của hàng
    var all = readTable('BangGia').rows.map(function (p) { p.thoiGian = String(p.thoiGian); return p; });
    var eff = QPrice.effective(all, v.maHang, 'BAN', today());
    if (eff && eff.gia !== it.giaBan) { var x = strip(it); x.giaBan = eff.gia; x.capNhat = nowIso(); putRow('HangHoa', x, it._row); }
  }
  // Nhật ký giá NHAP không ghi số tiền ra trường "sau" để tránh lộ qua log cho người không phải QT (log chỉ QT đọc, vẫn che cho chắc)
  logs.push({ action: 'price.add', doiTuong: 'BangGia', id: v.id, truoc: null, sau: v.loai === 'NHAP' ? { maHang: v.maHang, loai: 'NHAP', maNCC: v.maNCC, tuNgay: v.tuNgay } : v });
  return { id: v.id };                          // không trả lại số tiền
}
function userUpsert(u, req, logs) {
  var v = need(QValidate.user(req.user)), cur = findByKey('NguoiDung', v.email);
  if (cur) {
    var losingAdmin = String(cur.vaiTro).trim() === 'QUAN_TRI' && String(cur.trangThai).trim() === 'HOAT_DONG' && (v.vaiTro !== 'QUAN_TRI' || v.trangThai !== 'HOAT_DONG');
    if (losingAdmin) {
      var admins = readTable('NguoiDung').rows.filter(function (r) { return String(r.vaiTro).trim() === 'QUAN_TRI' && String(r.trangThai).trim() === 'HOAT_DONG'; });
      if (admins.length <= 1) throw fail('VALIDATION', 'Phải còn ít nhất 1 Quản trị đang hoạt động', { vaiTro: 'Không hạ quyền/khoá Quản trị cuối cùng' });
    }
    v.ngayTao = cur.ngayTao; v.hoTen = v.hoTen || cur.hoTen;
  } else v.ngayTao = nowIso();
  putRow('NguoiDung', v, cur && cur._row);
  CacheService.getScriptCache().remove('u:' + v.email);
  logs.push({ action: 'user.upsert', doiTuong: 'NguoiDung', id: v.email, truoc: cur ? strip(cur) : null, sau: v });
  return { email: v.email };
}
function feedbackAdd(u, req, logs) {
  var v = need(QValidate.feedback(req.feedback));
  v.id = 'GY' + ('00000' + nextId('GopY')).slice(-5); v.thoiGian = nowIso(); v.email = u.email; v.trangThai = 'MOI'; v.note = '';
  putRow('GopY', v);
  logs.push({ action: 'feedback.add', doiTuong: 'GopY', id: v.id, truoc: null, sau: { sao: v.sao, loai: v.loai } });
  return { id: v.id };
}
function feedbackUpdate(u, req, logs) {
  if (!req.id) throw fail('VALIDATION', 'Thiếu mã góp ý');
  var cur = findByKey('GopY', String(req.id));
  if (!cur) throw fail('NOT_FOUND', 'Không có góp ý ' + req.id);
  var st = ['MOI', 'DANG_XU_LY', 'DA_XU_LY', 'BO_QUA'];
  if (st.indexOf(req.trangThai) < 0) throw fail('VALIDATION', 'Trạng thái không hợp lệ');
  var v = strip(cur); v.trangThai = req.trangThai; v.note = String(req.note || '').slice(0, 500);
  putRow('GopY', v, cur._row);
  logs.push({ action: 'feedback.update', doiTuong: 'GopY', id: v.id, truoc: { trangThai: cur.trangThai }, sau: { trangThai: v.trangThai, note: v.note } });
  return { id: v.id };
}
