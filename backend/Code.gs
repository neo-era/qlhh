/** QLHH — backend Apps Script (bản SPIKE đợt ①: đăng nhập, phiên HMAC, ghi đồng thời, đo tốc độ).
 *  Cách cài: xem HUONG-DAN-SPIKE.md. Các file auth.gs, idem.gs là bản sao nguyên văn core/*.js (do build.sh tạo). */
var SESSION_TTL = 10 * 3600;          // 10 giờ
var SH = { ND:'NguoiDung', REQ:'Request', GHI:'SpikeGhi', CH:'CauHinh', HH:'BenchHangHoa', CT:'BenchChiTiet' };

function setup() {
  var ss = SpreadsheetApp.getActive(), me = Session.getEffectiveUser().getEmail().toLowerCase();
  function sheet(n, head){ var s = ss.getSheetByName(n) || ss.insertSheet(n); if (s.getLastRow()===0) s.appendRow(head); s.setFrozenRows(1); return s; }
  var nd = sheet(SH.ND, ['email','hoTen','vaiTro','trangThai','ngayTao']);
  var has = nd.getDataRange().getValues().some(function(r){ return String(r[0]).toLowerCase()===me; });
  if (!has) nd.appendRow([me,'Chủ hệ thống','QUAN_TRI','HOAT_DONG',new Date().toISOString()]);
  sheet(SH.REQ, ['requestId','email','thoiGian','ketQua']);
  sheet(SH.GHI, ['so','email','thoiGian','requestId']);
  sheet(SH.CH, ['key','value']);
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('SESSION_KEY')) p.setProperty('SESSION_KEY', Utilities.getUuid()+Utilities.getUuid());
  if (!p.getProperty('CLIENT_ID')) p.setProperty('CLIENT_ID', 'DIEN_CLIENT_ID_VAO_DAY');
  Logger.log('Xong setup. Chủ: %s. Nhớ điền CLIENT_ID trong Project Settings → Script properties.', me);
}

function doGet(){ return out({ok:true,code:'OK',data:{app:'QLHH',ver:'spike-0.1'}}); }

function doPost(e) {
  var t0 = Date.now();
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var res = route(req);
    res.ms = Date.now() - t0;
    return out(res);
  } catch (err) {
    return out({ok:false, code:'INTERNAL', error:String(err && err.message || err), ms: Date.now()-t0});
  }
}
function out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function now(){ return Math.floor(Date.now()/1000); }
function hmac(key,msg){ return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(msg,key)).replace(/=+$/,''); }
function props(){ return PropertiesService.getScriptProperties(); }

function route(req) {
  switch (req.action) {
    case 'ping': return {ok:true, code:'OK', data:{t:new Date().toISOString()}};
    case 'auth.login': return login(req);
  }
  var s = QAuth.verifySession(req.session, now(), props().getProperty('SESSION_KEY'), hmac);
  if (!s.ok) return s;
  var user = findUser(s.email);
  if (!user) return {ok:false, code:'FORBIDDEN', error:'Tài khoản chưa được cấp quyền'};
  switch (req.action) {
    case 'auth.me': return {ok:true, code:'OK', data:{email:s.email, vaiTro:user.vaiTro, het:s.exp}};
    case 'spike.write': return spikeWrite(s.email, req.requestId);
    case 'bench.seed': return user.vaiTro==='QUAN_TRI' ? benchSeed() : {ok:false,code:'FORBIDDEN'};
    case 'bench.read': return benchRead();
  }
  return {ok:false, code:'VALIDATION', error:'action không hợp lệ'};
}

function login(req) {
  var p = props(), cid = p.getProperty('CLIENT_ID');
  if (typeof req.idToken !== 'string' || req.idToken.length > 4096) return {ok:false, code:'VALIDATION', error:'Thiếu idToken'};
  var claims = null, wait = 500;
  for (var i = 0; i < 3 && !claims; i++) {     // tokeninfo: có thử lại có lùi (rủi ro đã chấp nhận)
    var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(req.idToken), {muteHttpExceptions:true});
    var c = r.getResponseCode();
    if (c === 200) claims = JSON.parse(r.getContentText());
    else if (c === 400) return {ok:false, code:'AUTH_INVALID', error:'Token Google không hợp lệ'};
    else { Utilities.sleep(wait); wait *= 2; }
  }
  if (!claims) return {ok:false, code:'INTERNAL', error:'Không xác minh được với Google, thử lại'};
  var chk = QAuth.checkClaims(claims, {clientId:cid, nonce:req.nonce, now:now()});
  if (!chk.ok) return chk;
  var user = findUser(chk.email);
  if (!user) return {ok:false, code:'FORBIDDEN', error:'Email ' + chk.email + ' chưa có trong danh sách người dùng'};
  return {ok:true, code:'OK', data:{session:QAuth.issueSession(chk.email, now(), SESSION_TTL, p.getProperty('SESSION_KEY'), hmac), email:chk.email, vaiTro:user.vaiTro}};
}

function findUser(email) {
  var c = CacheService.getScriptCache(), k = 'u:' + email, v = c.get(k);
  if (v) return v === '-' ? null : JSON.parse(v);
  var rows = SpreadsheetApp.getActive().getSheetByName(SH.ND).getDataRange().getValues(), u = null;
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]).trim().toLowerCase() === email && rows[i][3] === 'HOAT_DONG') { u = {vaiTro:rows[i][2]}; break; }
  c.put(k, u ? JSON.stringify(u) : '-', 60);   // cache vai trò ≤ 60 giây
  return u;
}

/** Ghi thử: khoá + idempotent (email+requestId) + số tự tăng không trùng. */
function spikeWrite(email, rid) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return {ok:false, code:'LOCK_TIMEOUT', error:'Máy chủ bận, thử lại'};
  var held0 = Date.now();
  try {
    var ss = SpreadsheetApp.getActive(), rq = ss.getSheetByName(SH.REQ);
    var rows = rq.getLastRow() > 1 ? rq.getRange(2,1,rq.getLastRow()-1,4).getValues() : [];
    var store = { map:{}, get:function(id){ return this.map[id]; }, set:function(id,v){ this.map[id]=v; rq.appendRow([id, v.email, new Date().toISOString(), JSON.stringify(v.data)]); } };
    rows.forEach(function(r){ store.map[r[0]] = {email:r[1], data:JSON.parse(r[3])}; });
    var res = QIdem.once(store, email, rid, function(){
      var g = ss.getSheetByName(SH.GHI), so = g.getLastRow();   // dòng tiêu đề = 1 → số kế tiếp = lastRow
      g.appendRow([so, email, new Date().toISOString(), rid]);
      return {so:so};
    });
    SpreadsheetApp.flush();
    res.code = res.ok ? 'OK' : res.code; res.lockMs = Date.now() - held0;
    return res;
  } finally { lock.releaseLock(); }
}

/** Đo tốc độ: tạo 5.000 mã + 50.000 dòng chi tiết giả (chạy 1 lần). */
function benchSeed() {
  var ss = SpreadsheetApp.getActive(), t0 = Date.now();
  var hh = ss.getSheetByName(SH.HH) || ss.insertSheet(SH.HH), ct = ss.getSheetByName(SH.CT) || ss.insertSheet(SH.CT);
  hh.clear(); ct.clear();
  var a = [['maHang','ten','nhom','quyCach','dvt','giaBan']];
  for (var i = 1; i <= 5000; i++) a.push(['HH-' + ('00000'+i).slice(-5), 'Hàng thử nghiệm số ' + i, 'Nhóm ' + (i%12), 'Quy cách ' + i, 'bộ', 100000 + i]);
  hh.getRange(1,1,a.length,6).setValues(a);
  var b = [['soPhieu','dong','maHang','soLuong','donGia']];
  for (var j = 1; j <= 50000; j++) b.push(['PN-' + Math.ceil(j/5), j%5+1, 'HH-' + ('00000'+(j%5000+1)).slice(-5), j%17+1, 100000 + j%997]);
  ct.getRange(1,1,b.length,5).setValues(b);
  return {ok:true, code:'OK', data:{taoMs:Date.now()-t0, hangHoa:5000, chiTiet:50000}};
}
function benchRead() {
  var ss = SpreadsheetApp.getActive(), t0 = Date.now();
  var hh = ss.getSheetByName(SH.HH), ct = ss.getSheetByName(SH.CT);
  if (!hh || !ct) return {ok:false, code:'VALIDATION', error:'Chưa tạo dữ liệu đo — bấm "Tạo dữ liệu đo" trước'};
  var a = hh.getDataRange().getValues(), t1 = Date.now(), b = ct.getDataRange().getValues(), t2 = Date.now();
  var map = {}; for (var i = 1; i < a.length; i++) map[a[i][0]] = i;
  return {ok:true, code:'OK', data:{docHangHoaMs:t1-t0, docChiTietMs:t2-t1, dongHH:a.length-1, dongCT:b.length-1, taoMapMs:Date.now()-t2}};
}
