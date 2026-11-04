// Môi trường Apps Script giả lập (Sheet trong bộ nhớ) — dùng chung cho test backend & e2e.
// Mô phỏng cả việc Sheets TỰ ĐỔI KIỂU khi ghi: chuỗi số → số, chuỗi ngày → Date (trừ cột định dạng '@').
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const BACKEND_FILES = ['core/auth.js', 'core/idem.js', 'core/schema.js', 'core/validate.js', 'core/perm.js', 'core/price.js', 'backend/Code.gs'];

function env(tokeninfo, ownerEmail = 'MaiVuLam2020@gmail.com') {
  const sheets = {}, props = {}, cache = {};
  const conv = (v, txt) => { if (txt || typeof v !== 'string') return v; if (/^\d+$/.test(v)) return Number(v); if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00Z'); return v; };
  const colIdx = a => a.charCodeAt(0) - 65;
  const mk = n => {
    const s = {
      n, d: [], txt: {},
      appendRow(r) { this.d.push(r.map((v, i) => conv(v, this.txt[i]))); },
      getLastRow() { return this.d.length; },
      getLastColumn() { return this.d.reduce((m, r) => Math.max(m, r.length), 0); },
      setFrozenRows() {}, clear() { this.d = []; }, getName() { return n; },
      getDataRange() { const me = this; return { getValues: () => me.d.map(r => r.slice()) }; },
      getRange(r, c, nr, nc) {
        const me = this;
        if (typeof r === 'string') { const [a, b] = r.split(':'); return { setNumberFormat: f => { for (let i = colIdx(a); i <= colIdx(b || a); i++) me.txt[i] = f === '@'; } }; }
        nr = nr || 1; nc = nc || 1;
        return {
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const row = me.d[r - 1 + i] || []; const v = row[c - 1 + j]; return v === undefined ? '' : v; })),
          setValues: v => v.forEach((row, i) => { const t = me.d[r - 1 + i] || (me.d[r - 1 + i] = []); row.forEach((x, j) => t[c - 1 + j] = conv(x, me.txt[c - 1 + j])); }),
          setNumberFormat: f => { for (let j = 0; j < nc; j++) me.txt[c - 1 + j] = f === '@'; },
          createTextFinder: t => ({ matchEntireCell: () => ({ findNext: () => { for (let i = r - 1; i < r - 1 + nr; i++) for (let j = c - 1; j < c - 1 + nc; j++) if (me.d[i] && String(me.d[i][j]) === t) return { getRow: () => i + 1 }; return null; } }) })
        };
      }
    };
    return sheets[n] = s;
  };
  const b64 = x => Buffer.from(typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x.map(b => b & 255))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const G = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: mk }), flush() {} },
    Session: { getEffectiveUser: () => ({ getEmail: () => ownerEmail }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => props[k] = String(v) }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(), sleep() {}, Charset: { UTF_8: 'utf8' }, DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (a, s) => [...crypto.createHash('sha256').update(s).digest()],
      computeHmacSha256Signature: (m, k) => [...crypto.createHmac('sha256', k).update(m).digest()],
      base64EncodeWebSafe: b64,
      base64DecodeWebSafe: s => [...Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')],
      newBlob: b => ({ getDataAsString: () => Buffer.from(b).toString('utf8') })
    },
    UrlFetchApp: { fetch: () => tokeninfo() },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => cache[k] = v, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ t, setMimeType() { return this; } }) },
    Logger: { log() {} }, console: { error() {}, log() {} }
  };
  const src = BACKEND_FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + '\nreturn {setup,doPost};';
  const names = Object.keys(G);
  const api = new Function(...names, 'module', 'Buffer', src)(...names.map(k => G[k]), undefined, undefined);
  Object.assign(api, { sheets, raw: props, cache });
  api.post = o => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(o) } }).t);
  return api;
}

// Google tokeninfo giả: trả claims với email/nonce thay đổi được
function google(state) {
  return () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ aud: 'CID', iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), email: state.email, email_verified: 'true', nonce: state.nonce }) });
}
// Dựng máy chủ + đăng nhập sẵn các vai trò
function ready(users = {}) {
  const st = { email: 'maivulam2020@gmail.com', nonce: '' };
  const a = env(google(st)); a.setup(); a.raw.CLIENT_ID = 'CID';
  for (const [email, role] of Object.entries(users)) a.sheets.NguoiDung.appendRow([email, '', role, 'HOAT_DONG', '']);
  a.login = (email = 'maivulam2020@gmail.com') => { st.email = email; st.nonce = a.post({ action: 'auth.nonce' }).data.nonce; const r = a.post({ action: 'auth.login', idToken: 'tok-' + Math.random() }); return r.ok ? r.data.session : r; };
  a.st = st;
  return a;
}
let n = 0; const rid = () => 'req-' + (++n).toString().padStart(8, '0') + '-' + Math.random().toString(36).slice(2, 6);
module.exports = { env, google, ready, rid, BACKEND_FILES };
