/** QLHH — máy chủ Apps Script v0.2 (đợt ①: danh mục, giá, NCC, người dùng, góp ý · đợt ②: kho — xem backend/Kho.gs).
 *  Dán chung 1 file với lõi: core/auth.js, idem.js, schema.js, validate.js, perm.js, price.js, stock.js, serial.js (do build.sh ghép).
 *  Thiết kế: QLHH-thiet-ke.md. */
var VER = '0.4.2';
var SESSION_TTL = 10 * 3600;

// ======================= CÀI ĐẶT =======================
function setup() {
  var ss = SpreadsheetApp.getActive(), me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!me) throw new Error('Không đọc được email chủ — kiểm tra scope userinfo.email');
  Object.keys(QSchema.SHEETS).forEach(function (n) {
    var d = QSchema.SHEETS[n], s = ss.getSheetByName(n) || ss.insertSheet(n);
    if (s.getLastRow() === 0) s.appendRow(d.cols);
    else {   // nâng cấp: sheet cũ thiếu cột cuối (vd Phieu.soLSX, Serial.serialCha) → nối thêm tiêu đề, dữ liệu cũ giữ nguyên
      var h = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0].map(function (x) { return String(x).trim(); });
      while (h.length && !h[h.length - 1]) h.pop();
      if (h.length < d.cols.length && d.cols.slice(0, h.length).every(function (c, i) { return h[i] === c; })) s.getRange(1, h.length + 1, 1, d.cols.length - h.length).setValues([d.cols.slice(h.length)]);
    }
    s.setFrozenRows(1);
    if (typeof s.getProtections === 'function' && SpreadsheetApp.ProtectionType && !s.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) s.protect().setDescription('QLHH — dữ liệu do app ghi; sửa tay có thể làm sai số liệu').setWarningOnly(true);   // sửa tay → Sheets hỏi lại
    d.cols.forEach(function (c, i) { if ((d.num || []).indexOf(c) < 0) { var L = colLetter(i); s.getRange(L + ':' + L).setNumberFormat('@'); } });   // mọi cột chữ dạng văn bản: không tự đổi kiểu, không chạy công thức
  });
  var nd = ss.getSheetByName('NguoiDung');
  var has = nd.getDataRange().getValues().some(function (r) { return String(r[0]).trim().toLowerCase() === me; });
  if (!has) nd.appendRow([me, 'Chủ hệ thống', 'QUAN_TRI', 'HOAT_DONG', new Date().toISOString()]);
  var p = props();
  if (!p.getProperty('SESSION_KEY')) p.setProperty('SESSION_KEY', Utilities.getUuid() + Utilities.getUuid());
  if (!p.getProperty('CLIENT_ID')) p.setProperty('CLIENT_ID', 'DIEN_CLIENT_ID_VAO_DAY');
  if (!p.getProperty('dataVersion')) p.setProperty('dataVersion', '1');
  CACHE_T.forEach(function (n) { p.setProperty('ver:' + n, newVer()); });   // setup có thể đổi sheet → bỏ toàn bộ bộ đệm
  var ch = ss.getSheetByName('CauHinh');
  if (!ch.getDataRange().getValues().some(function (r) { return r[0] === 'maCongTy'; })) ch.appendRow(['maCongTy', 'LAVIPCO']);   // DAICHAU cho sheet Đại Châu (số xê-ri DC-…, PXX-DAICHAU)
  var kho = ss.getSheetByName('Kho');
  if (kho.getLastRow() < 2) {   // 2 kho mặc định: kho chính + kho hàng lỗi (nhận hàng bảo hành, không tính giá vốn)
    kho.appendRow(QSchema.toRow('Kho', { maKho: 'KHO', ten: 'Kho chính', diaChi: '', loai: 'THUONG', trangThai: 'HOAT_DONG' }));
    kho.appendRow(QSchema.toRow('Kho', { maKho: 'KHO-LOI', ten: 'Kho hàng lỗi', diaChi: '', loai: 'HANG_LOI', trangThai: 'HOAT_DONG' }));
  }
  Logger.log('Xong setup v%s. Chủ: %s', VER, me);
}

/** Chữ cái cột theo chỉ số 0: 0 → A, 25 → Z, 26 → AA (bảng > 26 cột, vd PhieuBaoHanh). */
function colLetter(i) { var s = ''; i += 1; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

// ======================= KHUNG =======================
function doGet() { return out({ ok: true, code: 'OK', data: { app: 'QLHH', ver: VER } }); }
function doPost(e) {
  var t0 = Date.now();
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    KCLOG = []; MEMO = {}; PROF = [[ 'start', t0 ]]; DIRTY = {}; WT = {}; VERS = null; FRESH = false; WROTE = false; VERIFIED = {};
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
  'voucher.list': voucherList,
  'sync.ver': syncVer,
  'period.lock': function (u, r) { return write(u, r, periodLock); },
  'stock.rebuild': function (u, r) { return write(u, r, stockRebuild); },
  'report.nxt': reportNxt,
  'template.upsert': function (u, r) { return write(u, r, templateUpsert); },
  'lsx.create': function (u, r) { return write(u, r, lsxCreate); },
  'lsx.xuatSX': function (u, r) { return write(u, r, lsxXuat); },
  'lsx.chiPhi': function (u, r) { return write(u, r, lsxChiPhi); },
  'lsx.nhapTP': function (u, r) { return write(u, r, lsxNhap); },
  'lsx.huy': function (u, r) { return write(u, r, lsxHuy); },
  'kcs.add': function (u, r) { return write(u, r, kcsAdd); },
  'pxx.issue': function (u, r) { return write(u, r, pxxIssue); },
  'pxx.cancel': function (u, r) { return write(u, r, pxxCancel); },
  'lsx.chiPhiHuy': function (u, r) { return write(u, r, lsxChiPhiHuy); },
  'report.wip': reportWip,
  'install.add': function (u, r) { return write(u, r, installAdd); },
  'bh.create': function (u, r) { return write(u, r, bhCreate); },
  'bh.update': function (u, r) { return write(u, r, bhUpdate); },
  'bh.replace': function (u, r) { return write(u, r, bhReplace); },
  'install.void': function (u, r) { return write(u, r, installVoid); },
  'report.bh': reportBH,
  'bh.replaceVoid': function (u, r) { return write(u, r, bhReplaceVoid); },
  'report.loi': reportLoi,
  'sx.get': sxGet,
  'serial.get': serialGet
};

function route(req) {
  switch (req.action) {
    case 'ping': return { ok: true, code: 'OK', data: { t: nowIso(), ver: VER } };
    case 'auth.nonce': return issueNonce();
    case 'auth.login': return login(req);
  }
  var s = QAuth.verifySession(req.session, now(), sessKey(), hmac);
  if (!s.ok) return s;
  var u = findUser(s.email);
  if (!u) return { ok: false, code: 'FORBIDDEN', error: 'Tài khoản chưa được cấp quyền hoặc đã bị khoá' };
  if (!HANDLERS[req.action]) return { ok: false, code: 'VALIDATION', error: 'Lệnh không hợp lệ' };
  if (!QPerm.can(u.vaiTro, req.action)) return { ok: false, code: 'FORBIDDEN', error: 'Vai trò ' + u.vaiTro + ' không được làm việc này' };
  var r = HANDLERS[req.action](u, req);
  return r && r.ok !== undefined ? r : { ok: true, code: 'OK', data: r };
}

// ======================= XÁC THỰC =======================
/* Nonce không trạng thái: thời điểm + ngẫu nhiên + chữ ký HMAC (không ghi bộ đệm → gọi dồn không đẩy được dấu chống ghi trùng ra khỏi bộ đệm). */
var NONCE_TTL = 600;
function issueNonce() {
  var ts = now().toString(36), r = Utilities.getUuid().replace(/-/g, '');
  return { ok: true, code: 'OK', data: { nonce: ts + '.' + r + '.' + hmac(sessKey(), 'nonce|' + ts + '|' + r) } };
}
function nonceOK(n) {
  var p = String(n || '').split('.'); if (p.length !== 3 || p[0].length > 12 || p[1].length > 64) return false;
  var want = hmac(sessKey(), 'nonce|' + p[0] + '|' + p[1]), age = now() - parseInt(p[0], 36);
  if (want.length !== p[2].length) return false; var d = 0; for (var i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ p[2].charCodeAt(i);
  return d === 0 && age >= -60 && age <= NONCE_TTL;
}
/** Đọc nonce trong phần thân idToken (chưa xác minh chữ ký) để loại token rác TRƯỚC khi gọi Google. */
function tokenNonce(t) {
  var p = String(t).split('.'); if (p.length !== 3) return '';
  try { var b = p[1]; while (b.length % 4) b += '='; return String(JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString()).nonce || ''); } catch (e) { return ''; }
}
function login(req) {
  var p = props(), cid = p.getProperty('CLIENT_ID');
  if (typeof req.idToken !== 'string' || !req.idToken || req.idToken.length > 4096) return { ok: false, code: 'VALIDATION', error: 'Thiếu idToken' };
  var cache = CacheService.getScriptCache(), th = 't:' + sha(req.idToken);
  var prev = cache.get('r:' + th); if (prev) return JSON.parse(prev);   // gửi lại cùng token trong 2 phút
  if (!nonceOK(tokenNonce(req.idToken))) return { ok: false, code: 'AUTH_INVALID', error: 'Phiên đăng nhập hết hạn hoặc không hợp lệ — bấm Đăng nhập lại' };   // không tốn lượt gọi Google
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
  if (!nonceOK(n) || n !== tokenNonce(req.idToken)) return { ok: false, code: 'AUTH_INVALID', error: 'Nonce không hợp lệ hoặc đã hết hạn' };
  if (cache.get(th)) return { ok: false, code: 'AUTH_INVALID', error: 'Token đã được dùng' };
  var chk = QAuth.checkClaims(claims, { clientId: cid, nonce: n, now: now() });
  if (!chk.ok) return chk;
  var u = findUser(chk.email, true);
  if (!u) return { ok: false, code: 'FORBIDDEN', error: 'Email ' + chk.email + ' chưa được cấp quyền hoặc đã bị khoá' };
  var res = { ok: true, code: 'OK', data: { session: QAuth.issueSession(chk.email, now(), SESSION_TTL, sessKey(), hmac), email: chk.email, vaiTro: u.vaiTro, hoTen: u.hoTen } };
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
  if (u) c.put(k, JSON.stringify(u), 300); else c.remove(k);   // 5 phút: đổi quyền qua app xoá ngay (user.upsert), sửa tay trên Sheet có hiệu lực ≤ 5 phút
  return u;
}

// ======================= ĐỌC =======================
var TABLES = { items: 'HangHoa', groups: 'NhomHang', suppliers: 'NhaCungCap', prices: 'BangGia', users: 'NguoiDung', feedback: 'GopY', logs: 'NhatKy',
  warehouses: 'Kho', units: 'QuyDoiDVT', customers: 'KhachHang', projects: 'CongTrinh', vouchers: 'Phieu', stock: 'TonKho', serials: 'Serial',
  templates: 'MauSanPham', lsx: 'LenhSX', cabinets: 'HoSoTu', pxx: 'PhieuXuatXuong', lapDat: 'LapDat', pbh: 'PhieuBaoHanh' };
/* Bộ nhớ tạm trong 1 lệnh (MEMO): mỗi sheet chỉ đọc 1 lần; ghi sheet nào thì xoá bản nhớ sheet đó (dirty). Trả bản sao nông.
   Bộ đệm GIỮA các lệnh (CacheService) cho bảng danh mục + TonKho, khoá theo PHIÊN BẢN của từng sheet (ScriptProperties 'ver:<sheet>'):
   - ghi sheet → cấp phiên bản mới (DIRTY), đẩy lên ScriptProperties TRƯỚC khi nhả khoá (kể cả khi lỗi) → không lệnh nào đọc phải bản cũ;
   - ghi xong cả bảng (TonKho, HangHoa) → đặt luôn bản mới vào bộ đệm (write-through) để lệnh sau khỏi đọc lại;
   - sheet bị sửa tay ngoài app: bộ đệm sống tối đa 10 phút; "Tính lại tồn" luôn đọc thẳng sheet (FRESH). */
var MEMO = {}, PROF = [], DIRTY = {}, WT = {}, VERS = null, FRESH = false, WROTE = false, VERIFIED = {};
var CACHE_T = ['HangHoa', 'NhomHang', 'NhaCungCap', 'BangGia', 'Kho', 'QuyDoiDVT', 'KhachHang', 'CongTrinh', 'TonKho', 'CauHinh', 'MauSanPham', 'LenhSX', 'ChiPhiLSX', 'HoSoTu', 'LapDat', 'PhieuBaoHanh'];
function mark(l) { PROF.push([l, Date.now()]); }
function newVer() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function vers() { if (!VERS) VERS = props().getProperties(); return VERS; }
function cachedT(n) { return CACHE_T.indexOf(n) >= 0; }
function dirty(n) {
  WROTE = true; delete MEMO[n]; Object.keys(MEMO).forEach(function (k) { if (k.indexOf(n + '#') === 0) delete MEMO[k]; });
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
  MEMO[n] = QSchema.toObjects(n, sheet(n).getDataRange().getValues()); mark('read ' + n); VERIFIED[n] = true;
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
/* Chống ghi đè sai dòng khi Sheet bị sửa tay (sắp xếp, chèn, xoá dòng) trong lúc bộ đệm còn sống:
   trước khi GHI THEO SỐ DÒNG vào bảng lấy từ bộ đệm, đọc 1 lần cột khoá của sheet và đối chiếu với bộ đệm.
   Lệch → bỏ bộ đệm bảng đó, báo STALE; write() đọc thẳng sheet rồi chạy lại lệnh 1 lần (các bước đã ghi được dọn/làm tiếp theo requestId). */
function keyCols(n) { return QSchema.SHEETS[n].key ? 1 : 2; }
function kv(v) { return v instanceof Date ? new Date(v.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : String(v === undefined || v === null ? '' : v).trim().replace(/^'(?=[=+\-@])/, ''); }
function guardTable(n) {
  if (!cachedT(n) || VERIFIED[n] || !MEMO[n]) return;
  var s = sheet(n), k = keyCols(n), cols = QSchema.SHEETS[n].cols, at = {};
  var vals = s.getRange(k === 1 ? 'A2:A' : 'A2:B').getValues(); mark('guard ' + n);   // 1 lệnh gọi: cả cột khoá (kèm dòng trống cuối sheet)
  while (vals.length && vals[vals.length - 1].every(function (x) { return x === '' || x === null; })) vals.pop();
  MEMO[n].rows.forEach(function (r) { at[r._row] = r; });
  for (var i = 0; i < vals.length; i++) {
    var row = i + 2, r = at[row], key = vals[i].map(kv).join('|');
    if (!r) { if (key.replace(/\|/g, '')) return stale(n); continue; }
    if (key !== cols.slice(0, k).map(function (c) { return kv(r[c]); }).join('|')) return stale(n);
    delete at[row];
  }
  if (Object.keys(at).length) return stale(n);
  VERIFIED[n] = true;
}
/** Đối chiếu TRƯỚC lần cấp số / lần ghi đầu tiên các bảng mà lệnh sẽ ghi theo số dòng → lệch thì chưa ghi gì, không nhảy số.
 *  (Bảng khác vẫn được đối chiếu lúc ghi theo dòng — putRow / putMany / writeTon / updateCost.) */
function guardEarly(names) { names.forEach(function (n) { if (cachedT(n) && !VERIFIED[n]) { readTable(n); guardTable(n); } }); }
function stale(n) { DIRTY[n] = newVer(); WT[n] = false; delete MEMO[n]; throw fail('STALE', 'Sheet ' + n + ' vừa được sửa trực tiếp trên Google Sheet — máy chủ đọc lại, thử lại', null); }
/** Máy tự kiểm tra 60 s/lần: chỉ trả số phiên bản + ngày (không đọc sheet). */
function syncVer(u, req) { return { version: dataVer(), today: today() }; }
function syncPull(u, req) {
  var ver = dataVer();   // đọc version TRƯỚC dữ liệu (bộ đệm → ít lượt đọc ScriptProperties khi máy tự kiểm tra 60 s/lần)
  if (req.since && Number(req.since) === ver) return { unchanged: true, version: ver };
  var raw = {}, warnings = [];
  Object.keys(TABLES).forEach(function (k) {
    if (k === 'logs' && u.vaiTro !== 'QUAN_TRI') { raw[k] = []; return; }
    var t = k === 'logs' ? readTail('NhatKy', 300) : k === 'vouchers' ? readTail('Phieu', 500) : readTable(TABLES[k]); raw[k] = t.rows; warnings = warnings.concat(t.warnings);
  });
  var cut = sheet('Phieu').getLastRow() - 1 > 500;   // sheet có hơn 500 dòng phiếu → máy khách biết danh sách bị cắt (lọc tháng cũ phải hỏi voucher.list)
  raw.vouchers = raw.vouchers.filter(function (p) { return p.trangThai === 'HOAN_TAT'; });
  var tuK = {}, lp = livePxx(); (raw.cabinets || []).forEach(function (c) { if (c.trangThai !== 'HUY') tuK[c.key] = 1; if (c.soPXX && !lp[c.soPXX]) c.soPXX = ''; });
  raw.serials = raw.serials.filter(function (x) { return x.trangThai === 'TRONG_KHO' || x.trangThai === 'HANG_LOI' || (x.trangThai === 'DA_BAN' && tuK[x.key]); });   // để chọn serial khi xuất + tủ đã giao (theo dõi bảo hành)
  var last = {}; raw.templates.forEach(function (t) { if (!last[t.maMau] || t.phienBan > last[t.maMau].phienBan) last[t.maMau] = t; });
  raw.templates = Object.keys(last).sort().map(function (k) { return last[k]; });   // chỉ phiên bản mẫu mới nhất
  raw.config = { ngayKhoaSo: cfg('ngayKhoaSo'), ngayKhoaMax: cfg('ngayKhoaMax'), maCongTy: congTy() };
  return { version: ver, vouchersCut: cut, data: QPerm.filterForRole(u.vaiTro, u.email, raw), warnings: u.vaiTro === 'QUAN_TRI' ? warnings : [], today: today(), me: { email: u.email, vaiTro: u.vaiTro, hoTen: u.hoTen } };
}
function schemaErrors(force) {
  var c = CacheService.getScriptCache();
  if (!force) { var v = c.get('schemaOK:' + VER); if (v === '1') return []; }
  var heads = {}, ss = SpreadsheetApp.getActive();
  Object.keys(QSchema.SHEETS).forEach(function (n) { var s = ss.getSheetByName(n); if (s) heads[n] = s.getLastColumn() ? s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0] : []; });
  var errs = QSchema.check(heads);
  if (!errs.length) c.put('schemaOK:' + VER, '1', 60); else c.remove('schemaOK:' + VER);
  return errs;
}

// ======================= GHI (khoá + idempotent + nhật ký) =======================
function write(u, req, fn, pre) {
  if (!QIdem.validId(req.requestId)) return { ok: false, code: 'VALIDATION', error: 'requestId không hợp lệ' };
  var ctx = null;
  if (pre) { try { ctx = pre(u, req); } catch (err) { if (err && err.qlhh) return err.qlhh; throw err; } }   // kiểm/đọc danh mục NGOÀI khoá → giữ khoá ngắn
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, code: 'LOCK_TIMEOUT', error: 'Máy chủ bận, thử lại' };
  var t0 = Date.now(); mark('lock');
  // CÓ KHOÁ RỒI: bỏ mọi thứ đã đọc/nhớ trước khi có khoá (tiến trình khác có thể vừa ghi) — đọc lại phiên bản bảng từ ScriptProperties.
  // Dữ liệu chuẩn bị ngoài khoá (ctx) chỉ là danh mục đã kiểm; mọi số liệu dùng để GHI đều đọc lại trong khoá.
  MEMO = {}; VERS = null;
  try {
    var se = schemaErrors(false); mark('schema');
    if (se.length) return { ok: false, code: 'SCHEMA', error: 'Sheet sai cấu trúc: ' + se[0].sheet + ' – ' + se[0].msg, fields: se };
    var rq = sheet('Request'), logs = [];
    var store = {
      get: function (id) { var r = findRequest(rq, id); mark('request?'); return r; },
      set: function (id, v) {
        rq.appendRow(QSchema.toRow('Request', { requestId: String(id), email: String(v.email), thoiGian: nowIso(), ketQua: JSON.stringify(v.data) }));
        try { CacheService.getScriptCache().put('req:' + id, JSON.stringify({ email: String(v.email), data: v.data }), 21600); } catch (e) { }
      }
    };
    var body = function () {
      if (pendingList().length) cleanupOrphans(logs);   // mọi lệnh ghi dọn phiếu dở (TonKho không bị treo đến phiếu kế tiếp)
      var d = fn(u, req, logs, ctx);
      logs.push.apply(logs, KCLOG); KCLOG = [];
      appendBlock('NhatKy', logs.map(function (l) { return { thoiGian: nowIso(), email: u.email, action: l.action, doiTuong: l.doiTuong, id: String(l.id), truoc: l.truoc ? JSON.stringify(l.truoc).slice(0, 45000) : '', sau: l.sau ? JSON.stringify(l.sau).slice(0, 45000) : '', requestId: String(req.requestId) }; }));   // 1 lần ghi
      return d;
    }, res;
    try { res = QIdem.once(store, u.email, req.requestId, body); }
    catch (e1) {   // bảng trong bộ đệm lệch với sheet (sửa tay): đọc thẳng sheet, chạy lại 1 lần — phần đã ghi được dọn / làm tiếp theo requestId
      if (!(e1 && e1.qlhh && e1.qlhh.code === 'STALE')) throw e1;
      MEMO = {}; FRESH = true; KCLOG = []; logs.length = 0; mark('stale-retry');
      res = QIdem.once(store, u.email, req.requestId, body);
    }
    mark('request+');
    if (res.ok) { res.code = 'OK'; res.lockMs = Date.now() - t0; }
    return res;
  } catch (err) {
    if (err && err.qlhh) return err.qlhh;
    throw err;
  } finally {   // đã ghi (kể cả khi lỗi giữa chừng): đẩy hết lệnh ghi xuống sheet RỒI mới tăng phiên bản dữ liệu; phiên bản bảng lên TRƯỚC khi nhả khoá
    try { if (WROTE) { SpreadsheetApp.flush(); mark('flush'); bumpVersion(); } } finally { try { flushVers(); } finally { lock.releaseLock(); } }
  }
}
/* Tra requestId đã xử lý: bộ đệm trước (lần gửi lại thường trong vài giây), rồi đọc 300 dòng cuối của Request trong 1 lần gọi
   (thay cho tìm kiếm toàn cột). Gửi lại sau hơn 300 lệnh ghi không xảy ra với cách client giữ requestId theo hộp thoại. */
function findRequest(rq, id) {
  var c = CacheService.getScriptCache(), hit = c.get('req:' + id);
  if (hit) { try { return JSON.parse(hit); } catch (e) { } }
  var last = rq.getLastRow(); if (last < 2) return null;
  var n = Math.min(300, last - 1), v = rq.getRange(last - n + 1, 1, n, 4).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === String(id)) {
    var data; try { data = JSON.parse(v[i][3]); } catch (e) { data = { loi: 'ketQua hỏng' }; }
    return { email: String(v[i][1]), data: data };
  }
  return null;
}
function bumpVersion() { var p = props(), v = String(Number(p.getProperty('dataVersion') || 1) + 1); p.setProperty('dataVersion', v); CacheService.getScriptCache().put('dataVersion', v, 21600); }
/** Phiên bản dữ liệu: bộ đệm trước (bumpVersion ghi cả hai), hụt thì đọc ScriptProperties. */
function dataVer() { var c = CacheService.getScriptCache(), v = c.get('dataVersion'); if (!v) { v = props().getProperty('dataVersion') || '1'; c.put('dataVersion', v, 60); } return Number(v); }   // tự nạp: hạn 60 s (lệch tối đa 1 phút); bumpVersion trong khoá ghi hạn 6 giờ
/** Khoá ký phiên: giữ trong bộ đệm 6 giờ để mỗi lệnh không phải đọc ScriptProperties. */
function sessKey() { var c = CacheService.getScriptCache(), k = c.get('sessKey'); if (!k) { k = props().getProperty('SESSION_KEY'); if (k) c.put('sessKey', k, 600); } return k; }
/** Đổi khoá ký phiên (nghi lộ khoá): mọi phiên cũ hết hiệu lực NGAY, mọi người đăng nhập lại. Chạy hàm này trong trình soạn Apps Script — không sửa tay ScriptProperties. */
function rotateSessionKey() { var k = Utilities.getUuid() + Utilities.getUuid(); props().setProperty('SESSION_KEY', k); CacheService.getScriptCache().remove('sessKey'); Logger.log('Đã đổi khoá phiên — mọi người đăng nhập lại'); }
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
  if (row) guardTable(n);
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
    var g = { id: 'G' + ('000000' + nextId('BangGia')).slice(-6), maHang: v.maHang, loai: 'BAN', maNCC: '', gia: v.giaBan, tuNgay: today(), ghiChu: 'Giá ban đầu', nguoiTao: u.email, thoiGian: nowIso(), requestId: String(req.requestId) };
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
  var pv = prevRow('BangGia', req)[0], v = pv ? strip(pv) : need(QValidate.price(req.price));   // gửi lại sau khi chết giữa chừng: dòng giá đã ghi → làm tiếp
  var it = findByKey('HangHoa', v.maHang);
  if (!it) throw fail('VALIDATION', 'Không có mã hàng ' + v.maHang, { maHang: 'Chọn mã có sẵn' });
  if (!pv) {
    if (v.loai === 'NHAP' && !findByKey('NhaCungCap', v.maNCC)) throw fail('VALIDATION', 'Nhà cung cấp ' + v.maNCC + ' chưa có', { maNCC: 'Chọn NCC có sẵn' });
    v.id = 'G' + ('000000' + nextId('BangGia')).slice(-6); v.nguoiTao = u.email; v.thoiGian = nowIso(); v.requestId = String(req.requestId);
    putRow('BangGia', v);
  }
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
  var pv = prevRow('GopY', req)[0]; if (pv) return { id: pv.id, lapLai: true };
  var v = need(QValidate.feedback(req.feedback));
  v.id = 'GY' + ('00000' + nextId('GopY')).slice(-5); v.thoiGian = nowIso(); v.email = u.email; v.trangThai = 'MOI'; v.note = ''; v.requestId = String(req.requestId);
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
