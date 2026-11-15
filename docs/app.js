/* QLHH — giao diện PWA v0.2 (đợt ① danh mục · đợt ② kho). Không framework; lõi validate/perm/price/search dùng chung với máy chủ. */
(function () {
  'use strict';
  const CFG = window.QLHH_CONFIG, VER = CFG.appVersion;
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => n === '' || n === null || n === undefined ? '—' : Number(n).toLocaleString('vi-VN') + ' ₫';
  const ROLE = { XEM: 'Xem', NHAP_LIEU: 'Nhập liệu', QUAN_TRI: 'Quản trị' };
  const FBTYPE = { DE_XUAT: 'Đề xuất tính năng', LOI_APP: 'Lỗi app', SAI_DU_LIEU: 'Sai dữ liệu', KHAC: 'Khác' };
  const FBST = { MOI: 'Mới', DANG_XU_LY: 'Đang xử lý', DA_XU_LY: 'Đã xử lý', BO_QUA: 'Bỏ qua' };
  const STARS = ['', 'Rất tệ', 'Tệ', 'Tạm được', 'Tốt', 'Rất tốt'];
  const ICON = {
    check: '<path d="M20 6L9 17l-5-5"/>', shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>', pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 18l-6-6 6-6"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    warn: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    stock: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>', chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    install: '<path d="M12 3v12M7 10l5 5 5-5"/><rect x="3" y="17" width="18" height="4" rx="1"/>', layers: '<path d="M12 2l10 5-10 5L2 7l10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>'
  };
  const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  // ---------------- lưu trữ ----------------
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const SS = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }, del(k) { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const IDB = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open('qlhh', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('kv', mode), s = t.objectStore('kv'), r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
    const clr = pre => tx('readwrite', s => { const r = s.openCursor(); r.onsuccess = () => { const c = r.result; if (!c) return; if (String(c.key).startsWith(pre)) c.delete(); c.continue(); }; return null; }).catch(() => null);
    return { clr: pre => { LS.set('qlhh-vk', LS.get('qlhh-vk', []).filter(k => !k.startsWith(pre))); return clr(pre); }, get: k => tx('readonly', s => s.get(k)).catch(() => null), set: (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => null), del: k => tx('readwrite', s => s.delete(k)).catch(() => null) };
  })();

  // ---------------- trạng thái ----------------
  const S = {
    co: null, session: null, user: null, data: null, version: 0, idx: null, offline: false,
    q: '', group: '', showStopped: false, sel: null, limit: 150, today: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
  };
  const company = id => CFG.companies.find(c => c.id === id);
  const cacheKey = () => `data:${S.co.id}:${S.user && S.user.email}`;
  const isQT = () => S.user && S.user.vaiTro === 'QUAN_TRI';
  const canEdit = () => S.user && (S.user.vaiTro === 'NHAP_LIEU' || S.user.vaiTro === 'QUAN_TRI');
  const giaBan = i => { const e = S.data && QPrice.effective(S.data.prices, i.maHang, 'BAN', S.today); return e ? e.gia : i.giaBan; };   // giá áp dụng HÔM NAY (giá hẹn ngày tự có hiệu lực)
  const safeUrl = u => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? u : '';

  // ---------------- giao tiếp máy chủ ----------------
  const rid = () => 'r' + Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
  const RETRY = ['LOCK_TIMEOUT', 'INTERNAL', 'NOT_JSON', 'NETWORK', 'STALE'];
  /* Đọc có hiển thị "Đang tải…" (sau 300 ms), chống bấm 2 lần (lệnh đọc giống hệt đang chạy → lần bấm sau bị bỏ qua),
     và lưu tạm bản vừa đọc trên máy: mất mạng thì mở bản lưu (ghi rõ giờ lưu). */
  const INFL = {};
  /** Bản lưu tối đa 200 mục (bỏ mục cũ nhất); khoá gồm công ty + email + vai trò → người khác / vai trò khác trên cùng máy không đọc được. */
  function vkeep(k) { let l = LS.get('qlhh-vk', []); l = l.filter(x => x !== k); l.push(k); while (l.length > 200) IDB.del(l.shift()); LS.set('qlhh-vk', l); }
  async function load(action, body, label) {
    const key = action + ':' + JSON.stringify(body);
    if (INFL[key]) return new Promise(() => {});   // đang mở rồi
    INFL[key] = 1; let ov = null; const sess = S.session, who = S.user ? S.user.email + ':' + S.user.vaiTro : ''; const tm = setTimeout(() => { ov = document.createElement('div'); ov.className = 'loadov'; ov.setAttribute('role', 'status'); ov.innerHTML = `<span>${esc(label || 'Đang tải…')}</span>`; ($('dialog[open]') || document.body).appendChild(ov); }, 300);
    try {
      const r = await call(action, body, 3, { timeout: 45000 }), ck = 'v:' + S.co.id + ':' + who + ':' + key;
      if (S.session !== sess || !S.user) return new Promise(() => {});   // đã đăng xuất / đổi người trong lúc chờ: bỏ kết quả, không lưu
      if (r.ok) { IDB.set(ck, { r, at: Date.now() }); vkeep(ck); return r; }
      if (r.code === 'NETWORK' || S.offline) { const c = await IDB.get(ck); if (c && c.r && Date.now() - c.at < 30 * 864e5) { toast('Ngoại tuyến — đang xem bản lưu lúc ' + new Date(c.at).toLocaleString('vi-VN')); return { ...c.r, cached: c.at }; } }
      return r;
    } finally { clearTimeout(tm); if (ov) ov.remove(); delete INFL[key]; }
  }
  async function call(action, body = {}, tries = 1, opt = {}) {
    if (!S.co || !S.co.url) return { ok: false, code: 'CONFIG', error: 'Công ty chưa cấu hình máy chủ' };
    let wait = 1000, last;
    for (let i = 0; i < tries; i++) {
      const ac = typeof AbortController === 'function' ? new AbortController() : null, to = ac && setTimeout(() => ac.abort(), opt.timeout || 75000);   // không treo "Đang tải…" vô hạn
      try {
        const r = await fetch(S.co.url, { method: 'POST', redirect: 'follow', credentials: 'omit', body: JSON.stringify({ action, session: S.session, ...body }), signal: ac ? ac.signal : undefined });
        const t = await r.text();
        try { last = JSON.parse(t); } catch (e) { last = { ok: false, code: 'NOT_JSON', error: 'Máy chủ trả về trang lỗi' }; }
        setOffline(false);
      } catch (e) { last = { ok: false, code: 'NETWORK', error: e && e.name === 'AbortError' ? 'Máy chủ không trả lời — thử lại' : 'Không kết nối được máy chủ' }; if (!opt.quiet) setOffline(true); }
      finally { if (to) clearTimeout(to); }
      if (last.ok || !RETRY.includes(last.code)) break;
      if (last.code === 'NETWORK' && i >= 1) break;   // mất mạng: báo sau ~1 s, không quay 31 s
      if (i < tries - 1) { await new Promise(r => setTimeout(r, wait)); wait *= 2; }
    }
    if (last.code === 'AUTH_INVALID' || last.code === 'AUTH_EXPIRED') { if (action !== 'auth.login') expire(); }
    return last;
  }
  function setOffline(v) {   // báo ngay ở lần lỗi mạng đầu tiên, không đợi hết các lần thử lại
    if (S.offline === v) return; S.offline = v;
    if (S.user && S.data && $('#main')) { renderView(); if (!v) toast('Đã có mạng trở lại'); }
  }
  let writeChain = Promise.resolve();   // tối đa 1 lệnh ghi đang chạy/máy; giữ nguyên requestId khi thử lại
  function write(action, body) {
    const p = writeChain.then(() => call(action, { requestId: rid(), ...body }, 6));
    writeChain = p.catch(() => {});
    return p;
  }
  function expire(msg) { if (S.user) IDB.del(cacheKey()); IDB.clr('v:' + S.co.id + ':'); IDB.del('sess:' + S.co.id); S.session = null; S.user = null; S.data = null; S.version = 0; toast(msg || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'); renderLogin(); }

  // ---------------- đăng nhập ----------------
  async function startLogin() {
    if (!S.co.url) return toast(`${S.co.ten} chưa có máy chủ — liên hệ quản trị`);
    const btn = $('#loginBtn'); btn && btn.classList.add('busy');
    try { if (/^#\/\w/.test(location.hash)) sessionStorage.setItem('qlhh-ret', location.hash); } catch (e) {}   // quét QR khi chưa đăng nhập: đăng nhập xong mở lại đúng tủ
    const n = await call('auth.nonce', {}, 3);
    if (!n.ok) { btn && btn.classList.remove('busy'); return toast('Không lấy được mã đăng nhập: ' + (n.error || n.code)); }
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({ client_id: CFG.clientId, redirect_uri: new URL('./', location.href).href, response_type: 'id_token', scope: 'openid email profile', nonce: n.data.nonce, state: S.co.id, prompt: 'select_account' });
    location.assign(u.toString());
  }
  async function handleReturn() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (!p.has('id_token') && !p.has('error')) return false;
    history.replaceState(null, '', location.pathname + location.search);
    const co = company(p.get('state')) || company(LS.get('qlhh-co', 'LAVIPCO'));
    S.co = co; LS.set('qlhh-co', co.id); applyCo();
    if (p.has('error')) { try { sessionStorage.removeItem('qlhh-ret'); } catch (e) {} renderLogin(); toast('Google báo: ' + p.get('error')); return true; }
    renderLogin('Đang xác minh với máy chủ…');
    const r = await call('auth.login', { idToken: p.get('id_token') }, 3);
    if (!r.ok) { renderLogin(); toast('Đăng nhập thất bại: ' + (r.error || r.code)); return true; }
    S.session = r.data.session; S.user = { email: r.data.email, vaiTro: r.data.vaiTro, hoTen: r.data.hoTen };
    await IDB.set('sess:' + co.id, { session: S.session, user: S.user });
    countUse();
    let ret = ''; try { ret = sessionStorage.getItem('qlhh-ret') || ''; sessionStorage.removeItem('qlhh-ret'); } catch (e) {}
    if (/^#\/\w/.test(ret)) history.replaceState(null, '', location.pathname + location.search + ret);
    await boot();
    return true;
  }
  async function logout() {
    if (S.co && S.user) { await IDB.del(cacheKey()); await IDB.clr('v:' + S.co.id + ':'); }
    await IDB.del('sess:' + S.co.id); S.session = null; S.user = null; S.data = null; S.version = 0;
    renderLogin(); toast('Đã đăng xuất và xoá dữ liệu lưu trên máy');
  }

  // ---------------- dữ liệu ----------------
  async function boot() {
    renderShell(); renderView(true);
    const cached = await IDB.get(cacheKey());
    if (cached && !S.data) { S.data = cached.data; S.version = cached.version; reindex(); renderView(); }
    await sync();
  }
  async function sync(opt = {}) {
    const r = await call('sync.pull', { since: S.data ? S.version : 0 }, opt.poll ? 1 : 3);
    if (!r.ok) {
      if (opt.poll) return;
      if (S.offline) { S.wasOff = true; renderView(); toast(S.data ? 'Đang ngoại tuyến — xem dữ liệu lưu gần nhất' : 'Không kết nối được máy chủ'); }
      else if (r.code === 'FORBIDDEN') expire('Tài khoản đã bị khoá hoặc chưa được cấp quyền — đã xoá dữ liệu trên máy');
      else if (r.code !== 'AUTH_INVALID' && r.code !== 'AUTH_EXPIRED') toast('Lỗi tải dữ liệu: ' + (r.error || r.code));
      return;
    }
    if (r.data.today) S.today = r.data.today;
    if (r.data.me && S.user && r.data.me.vaiTro !== S.user.vaiTro) {   // QT vừa đổi vai trò của mình
      if (r.data.me.vaiTro !== 'QUAN_TRI') { await IDB.del(cacheKey()); await IDB.clr('v:' + S.co.id + ':'); }
      S.user = { ...S.user, ...r.data.me }; IDB.set('sess:' + S.co.id, { session: S.session, user: S.user }); S.data = null; S.version = 0;
      toast('Vai trò của anh/chị đã đổi thành ' + (ROLE[S.user.vaiTro] || S.user.vaiTro)); renderShell(); return sync();
    }
    if (r.data.unchanged && !opt.force) { if (S.wasOff) { S.wasOff = false; renderView(); } flushFeedbackQueue(); return; }   // không đổi: không vẽ lại (giữ cuộn, ô đang gõ)
    if (!r.data.unchanged) {
      SX.stale = true; if (KS.vmc) Object.keys(KS.vmc).forEach(k => { if (k >= addMonth(S.today, -1)) delete KS.vmc[k]; });   // tháng cũ giữ bản đã tải
      S.data = r.data.data; S.data.vouchersCut = !!r.data.vouchersCut; S.version = r.data.version; reindex();
      IDB.set(cacheKey(), { data: S.data, version: S.version, at: Date.now() });
      if (isQT() && r.data.warnings && r.data.warnings.length) toast(`Sheet có ${r.data.warnings.length} dòng sai kiểu (vd ${r.data.warnings[0]})`);
    }
    renderView();
    flushFeedbackQueue();
  }
  function reindex() { S.idx = QSearch.buildIndex(S.data.items); }
  /* Tự làm mới: 60 giây/lần khi app đang hiện (máy để yên > 5 phút: 3 phút/lần), chỉ 1 tab trên máy hỏi, và chỉ hỏi SỐ PHIÊN BẢN (sync.ver, không đọc sheet).
     Có dữ liệu mới: đang gõ / mở hộp thoại / đang quét → dải "Có dữ liệu mới — Cập nhật" (bấm mới tải); còn lại → tải luôn.
     Lỗi mạng khi tự kiểm tra: không báo ngoại tuyến ngay (2 lần liên tiếp mới báo), thử lại sau 1 → 2 → 5 phút. */
  function pollOwner() {
    const me = S.tabId || (S.tabId = Math.random().toString(36).slice(2)), k = 'qlhh-poll:' + S.co.id, o = LS.get(k, null), t = Date.now();   // theo công ty
    if (o && o.id !== me && t - o.at < 150e3) return false;
    LS.set(k, { id: me, at: t }); return true;
  }
  function showNewBar() {
    if ($('#newbar') || !$('#main')) return;
    $('#main').insertAdjacentHTML('afterbegin', '<div class="newbar" id="newbar" role="status"><span>Có dữ liệu mới từ máy khác</span><button class="btn pri" type="button" id="nbGo">Cập nhật</button></div>');
    $('#nbGo').onclick = () => sync();
  }
  async function poll(now) {
    if (!S.user || !S.data || S.polling || (!now && document.hidden)) return;
    const t = Date.now();
    if (!now) {
      if (S.offline && t < (S.pollNext || 0)) return;
      if (t - (S.lastAct || t) > 300e3 && t - (S.lastPoll || 0) < 180e3) return;
      if (!pollOwner()) return;
    }
    S.polling = true; S.lastPoll = t;
    try {
      const r = await call('sync.ver', {}, 1, { quiet: true, timeout: 20000 });
      if (!r.ok) { if (r.code === 'FORBIDDEN') return expire('Tài khoản đã bị khoá hoặc chưa được cấp quyền — đã xoá dữ liệu trên máy'); if (r.code === 'NETWORK') { S.pollFail = (S.pollFail || 0) + 1; S.pollNext = t + [60e3, 120e3, 300e3][Math.min(S.pollFail - 1, 2)]; if (S.pollFail >= 2) setOffline(true); } return; }
      S.pollFail = 0; S.pollNext = 0;
      const newDay = r.data.today && r.data.today !== S.today; if (r.data.today) S.today = r.data.today;
      const a = document.activeElement, busy = $('dialog[open]') || $('.scanov') || (a && a.matches && a.matches('#main input,#main textarea,#main select'));
      if (Number(r.data.version) !== Number(S.version)) { tabBus({ co: S.co.id, version: r.data.version }); if (busy) showNewBar(); else await sync(); }
      else if (newDay && !busy) renderView();   // app mở qua đêm: ngày mặc định / giá "áp dụng hôm nay" sang ngày mới
    } finally { S.polling = false; }
  }
  setInterval(poll, 60000); S._poll = poll; S.lastAct = Date.now();
  /* Tab đang hỏi báo phiên bản mới cho các tab khác cùng công ty (các tab đó tự tải, theo quy tắc "đang bận"). */
  let BUS = null; try { BUS = new BroadcastChannel('qlhh'); BUS.onmessage = e => { const m = e.data || {}; if (S.user && S.data && m.co === S.co.id && Number(m.version) !== Number(S.version)) poll(true); }; } catch (e) { BUS = null; }
  function tabBus(m) { try { if (BUS) BUS.postMessage(m); } catch (e) {} }

  // ---------------- khung ----------------
  function applyCo() {
    document.documentElement.style.setProperty('--co', S.co.mau);
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name=theme-color]').setAttribute('content', dark ? '#0b1220' : S.co.mau);
  }
  const ROUTES = [
    { id: 'hang', ten: 'Danh mục hàng', icon: 'box' },
    { id: 'kho', ten: 'Tồn kho', icon: 'stock' },
    { id: 'phieu', ten: 'Phiếu kho', icon: 'doc' },
    { id: 'sx', ten: 'Sản xuất tủ', icon: 'tool' },
    { id: 'bh', ten: 'Lắp đặt & bảo hành', icon: 'shield' },
    { id: 'khach', ten: 'Khách hàng & CT', icon: 'users' },
    { id: 't', ten: 'Hồ sơ tủ', icon: 'box', hide: true },
    { id: 'ncc', ten: 'Giá & NCC', icon: 'tag' },
    { id: 'nhom', ten: 'Nhóm hàng', icon: 'layers' },
    { id: 'baocao', ten: 'Báo cáo N-X-T', icon: 'chart', qt: true },
    { id: 'nguoidung', ten: 'Người dùng', icon: 'users', qt: true },
    { id: 'gopy', ten: 'Góp ý', icon: 'chat' }
  ];
  const route = () => { const h = (location.hash.match(/^#\/(\w+)/) || [])[1]; return ROUTES.some(r => r.id === h && (!r.qt || isQT())) ? h : 'hang'; };
  function renderLogin(msg) {
    const sel = S.co || company(LS.get('qlhh-co', 'LAVIPCO'));
    S.co = sel; applyCo();
    $('#root').innerHTML = `<div class="login"><div class="box">
      <div class="brand" style="padding:0 0 10px"><div class="logo" style="background:var(--co);color:#fff">Q</div><div><b>QLHH</b><span class="mut">Quản lý hàng hóa · v${VER}</span></div></div>
      <h1>Đăng nhập</h1><p class="mut" style="margin:0">Chọn công ty, sau đó đăng nhập bằng tài khoản Google đã được cấp quyền.</p>
      <div class="cos" role="group" aria-label="Chọn công ty">${CFG.companies.map(c => `<button class="co" type="button" data-co="${c.id}" aria-pressed="${c.id === sel.id}" style="--c:${c.mau}"><span class="dot"></span><span><b>${esc(c.ten)}</b><small>${esc(c.tenDay)}${c.url ? '' : ' · chưa cấu hình'}</small></span></button>`).join('')}</div>
      <button class="btn pri" id="loginBtn" style="width:100%" ${msg ? 'disabled' : ''}>${msg ? esc(msg) : 'Đăng nhập bằng Google'}</button>
      <p class="mut" style="font-size:12.5px;margin:14px 0 0">Dữ liệu mỗi công ty lưu riêng. Chưa có quyền? Nhờ quản trị thêm email của anh/chị.</p>
      <div class="row" style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" id="themeBtn" type="button">${ic('moon')} Giao diện</button><button class="btn ghost hide" id="instBtn" type="button">${ic('install')} Cài đặt app</button></div>
    </div></div>`;
    $$('.co').forEach(b => b.onclick = () => { S.co = company(b.dataset.co); LS.set('qlhh-co', S.co.id); renderLogin(); });
    $('#loginBtn').onclick = startLogin; $('#themeBtn').onclick = toggleTheme; installBtn();
  }
  function renderShell() {
    const r = route();
    const nav = ROUTES.filter(x => (!x.qt || isQT()) && !x.hide).map(x => `<a href="#/${x.id}" ${x.id === r ? 'aria-current="page"' : ''}>${ic(x.icon)}<span>${x.ten}</span></a>`).join('');
    $('#root').innerHTML = `<div class="app">
      <aside class="side"><div class="brand"><div class="logo">Q</div><div><b>QLHH</b><button class="cobtn" id="coSwitch" title="Đổi công ty">${esc(S.co.ten)} ▾</button></div></div>
        <nav class="nav" aria-label="Chức năng">${nav}</nav>
        <div class="me"><div style="font-weight:600;word-break:break-all">${esc(S.user.email)}</div><div style="opacity:.8">${ROLE[S.user.vaiTro] || ''} · v${VER}</div>
          <div class="row"><button class="btn" id="fbBtn" title="Góp ý & đánh giá">${ic('chat')}</button><button class="btn" id="themeBtn" title="Sáng/tối">${ic('moon')}</button><button class="btn hide" id="instBtn" title="Cài đặt app">${ic('install')}</button><button class="btn" id="outBtn" title="Đăng xuất">${ic('out')}</button></div></div>
      </aside>
      <main id="main"></main></div>
      <nav class="bnav" aria-label="Chức năng">
        <a href="#/hang" ${r === 'hang' ? 'aria-current="page"' : ''}>${ic('box')}Hàng</a>
        <a href="#/kho" ${r === 'kho' ? 'aria-current="page"' : ''}>${ic('stock')}Tồn kho</a>
        <a href="#/phieu" ${r === 'phieu' ? 'aria-current="page"' : ''}>${ic('doc')}Phiếu</a>
        <button type="button" id="moreBtn">${ic('menu')}Thêm</button></nav>`;
    $('#coSwitch').onclick = switchCo; $('#outBtn').onclick = logout; $('#themeBtn').onclick = toggleTheme;
    $('#fbBtn').onclick = () => feedbackForm(); $('#moreBtn').onclick = moreMenu; installBtn();
  }
  function switchCo() {
    const other = CFG.companies.filter(c => c.id !== S.co.id);
    dialog('Đổi công ty', `<div class="cos">${other.map(c => `<button class="co" type="button" data-co="${c.id}" style="--c:${c.mau}"><span class="dot"></span><span><b>${esc(c.ten)}</b><small>${esc(c.tenDay)}${c.url ? '' : ' · chưa cấu hình'}</small></span></button>`).join('')}</div><p class="mut">Mỗi công ty dùng dữ liệu và phiên đăng nhập riêng.</p>`, null, d => {
      $$('.co', d).forEach(b => b.onclick = () => { d.close(); S.co = company(b.dataset.co); LS.set('qlhh-co', S.co.id); restore(); });
    });
  }
  function moreMenu() {
    const items = ROUTES.filter(x => (!x.qt || isQT()) && !x.hide).filter(x => !['hang', 'kho', 'phieu'].includes(x.id));
    dialog('Thêm', `<div class="list">${items.map(x => `<a class="it" href="#/${x.id}" data-close>${ic(x.icon)}<span style="flex:1">${x.ten}</span></a>`).join('')}
      <button class="it btn ghost" style="width:100%;justify-content:flex-start" id="mCo" type="button">Đổi công ty (đang: ${esc(S.co.ten)})</button>
      <button class="it btn ghost" style="width:100%;justify-content:flex-start" id="mTheme" type="button">${ic('moon')} Giao diện sáng/tối</button>
      <button class="it btn ghost" style="width:100%;justify-content:flex-start" id="mOut" type="button">${ic('out')} Đăng xuất (${esc(S.user.email)})</button></div>`, null, d => {
      $$('[data-close]', d).forEach(a => a.onclick = () => d.close());
      $('#mCo', d).onclick = () => { d.close(); switchCo(); }; $('#mTheme', d).onclick = toggleTheme; $('#mOut', d).onclick = () => { d.close(); logout(); };
    });
  }
  function header(title, actions = '', search = false, addId = '') {
    return `<div class="mtop">${title === 'Danh mục hàng' ? '' : `<a class="btn ghost iconbtn" href="#/hang" aria-label="Quay lại">${ic('back')}</a>`}<h1>${title}</h1><span class="cobadge">${esc(S.co.ten)}</span>${addId ? `<button class="btn pri iconbtn" type="button" id="${addId}" aria-label="${{ addItemM: 'Thêm hàng', addSupM: 'Thêm nhà cung cấp', addGM: 'Thêm nhóm', addUM: 'Thêm người dùng', addFM: 'Gửi góp ý', newVM: 'Lập phiếu', addKHM: 'Thêm khách hàng', newLM: 'Lập lệnh sản xuất' }[addId] || 'Thêm'}">${ic('plus')}</button>` : ''}</div>
      ${search ? `<label class="msearch">${ic('search')}<span class="sr">Tìm hàng</span><input id="qm" type="search" inputmode="search" placeholder="Tìm mã, tên, quy cách…" value="${esc(S.q)}" autocomplete="off"></label>` : ''}
      <div class="top"><h1>${title}</h1><span class="cobadge">${esc(S.co.ten)}</span>${search ? `<label class="search">${ic('search')}<span class="sr">Tìm hàng</span><input id="qd" type="search" placeholder="Tìm mã, tên, quy cách… (Ctrl K)" value="${esc(S.q)}" autocomplete="off"></label>` : ''}${actions}</div>
      ${S.offline ? `<div class="banner" role="status">${ic('warn')} Đang ngoại tuyến — chỉ xem dữ liệu đã lưu, chưa ghi được.</div>` : ''}`;
  }

  // ---------------- màn hình ----------------
  function renderView(loading) {
    const m = $('#main'); if (!m) return;
    $$('.nav a,.bnav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#/' + route()));
    $$('.nav a[aria-current],.bnav a[aria-current]').forEach(a => a.setAttribute('aria-current', 'page'));
    const mb = $('#moreBtn'); if (mb) mb.toggleAttribute('aria-current', ['nhom', 'nguoidung', 'ncc', 'gopy', 'khach', 'baocao', 'sx', 't', 'bh'].includes(route()));
    if (!S.data) { m.innerHTML = header('Đang tải…') + `<div class="card">${'<div class="skel"></div>'.repeat(6)}</div>`; return; }
    ({ hang: viewItems, kho: viewStock, phieu: viewVouchers, sx: viewSX, t: viewTu, bh: viewBH, khach: viewCustomers, baocao: viewReport, ncc: viewSuppliers, nhom: viewGroups, nguoidung: viewUsers, gopy: viewFeedback })[route()](m);
  }
  function kpis() {
    const d = S.data, kd = d.items.filter(i => i.trangThai !== 'NGUNG').length;
    const k = [['Mặt hàng đang KD', kd], ['Ngừng KD', d.items.length - kd], ['Nhà cung cấp', d.suppliers.length], isQT() ? ['Góp ý mới', d.feedback.filter(f => f.trangThai === 'MOI').length] : ['Nhóm hàng', d.groups.length]];
    return `<div class="kpi">${k.map(([a, b]) => `<div class="k"><small>${a}</small><b>${b.toLocaleString('vi-VN')}</b></div>`).join('')}</div>`;
  }
  function filteredItems() {
    let list = QSearch.search(S.data.items, S.q, S.idx);
    if (!S.showStopped) list = list.filter(i => i.trangThai !== 'NGUNG');
    if (S.group) list = list.filter(i => i.nhom === S.group);
    return list;
  }
  const MOBILE = '(max-width:899px),(orientation:landscape) and (max-height:520px)';
  const isMobile = () => matchMedia(MOBILE).matches;
  function viewItems(m) {
    const d = S.data;
    const act = `${canEdit() ? `<button class="btn pri" id="addItem">${ic('plus')}<span>Thêm hàng</span></button>` : ''}<button class="btn" id="xls">${ic('dl')}<span>Xuất Excel</span></button>`;
    m.innerHTML = header('Danh mục hàng', act, true, canEdit() ? 'addItemM' : '') + kpis() +
      `<div class="chips" role="group" aria-label="Lọc">${[['', 'Tất cả'], ...d.groups.map(g => [g.maNhom, g.ten])].map(([k, t]) => `<button class="chip" type="button" data-g="${esc(k)}" aria-pressed="${S.group === k}">${esc(t)}</button>`).join('')}
        <button class="chip" type="button" id="stopT" aria-pressed="${S.showStopped}">Gồm hàng ngừng KD</button></div>
      <div class="layout"><div class="card"><div class="tbl" id="results"></div></div><section class="card det ${S.sel ? '' : 'closed'}" id="det" aria-label="Chi tiết">${detail()}</section></div>`;
    // Ô tìm KHÔNG bị dựng lại khi gõ (giữ bộ gõ Telex/VNI); chỉ vẽ lại vùng kết quả, trễ 150 ms
    let timer = null, composing = false;
    $$('#qm,#qd').forEach(q => {
      q.addEventListener('compositionstart', () => composing = true);
      q.addEventListener('compositionend', () => { composing = false; q.dispatchEvent(new Event('input')); });
      q.oninput = () => { if (composing) return; S.q = q.value; $$('#qm,#qd').forEach(o => { if (o !== q) o.value = q.value; }); S.limit = 150; clearTimeout(timer); timer = setTimeout(renderResults, 150); };
    });
    $$('.chip[data-g]').forEach(b => b.onclick = () => { S.group = b.dataset.g; $$('.chip[data-g]').forEach(x => x.setAttribute('aria-pressed', x === b)); S.limit = 150; renderResults(); });
    $('#stopT').onclick = e => { S.showStopped = !S.showStopped; e.currentTarget.setAttribute('aria-pressed', S.showStopped); renderResults(); };
    $$('#addItem,#addItemM').forEach(b => b.onclick = () => itemForm());
    $('#xls').onclick = exportItems;
    renderResults(); bindDetail();
  }
  function renderResults() {
    const box = $('#results'); if (!box) return;
    const d = S.data, list = filteredItems(), shown = list.slice(0, S.limit), mob = isMobile();
    const gname = g => (d.groups.find(x => x.maNhom === g) || {}).ten || g;
    box.innerHTML = list.length ? (mob
      ? `<div class="list">${shown.map(i => `<div class="it" data-ma="${esc(i.maHang)}" role="button" tabindex="0" aria-selected="${S.sel === i.maHang}"><div><div class="mono">${esc(i.maHang)}</div>${esc(i.ten)}${i.trangThai === 'NGUNG' ? ' <span class="tag stop">Ngừng KD</span>' : ''}<br><small class="mut">${esc(i.quyCach)}</small></div><div style="text-align:right;white-space:nowrap"><b>${money(giaBan(i))}</b><br><small class="mut">${esc(i.dvt)}</small></div></div>`).join('')}</div>`
      : `<table><thead><tr><th>Mã hàng</th><th>Tên hàng · quy cách</th><th>Nhóm</th><th>ĐVT</th><th class="n">Giá bán</th><th class="n">BH</th></tr></thead><tbody>
          ${shown.map(i => `<tr data-ma="${esc(i.maHang)}" role="button" aria-selected="${S.sel === i.maHang}" tabindex="0"><td class="mono">${esc(i.maHang)}</td><td>${esc(i.ten)}${i.trangThai === 'NGUNG' ? ' <span class="tag stop">Ngừng KD</span>' : ''}<br><small>${esc(i.quyCach)}</small></td><td>${i.nhom ? `<span class="tag">${esc(gname(i.nhom))}</span>` : ''}</td><td>${esc(i.dvt)}</td><td class="n">${money(giaBan(i))}</td><td class="n">${i.thangBH !== '' ? i.thangBH + ' th' : '—'}</td></tr>`).join('')}</tbody></table>`)
      + (list.length > shown.length ? `<button class="btn more" type="button" id="more">Xem thêm (${(list.length - shown.length).toLocaleString('vi-VN')} mã)</button>` : '')
      : `<div class="empty">${d.items.length ? 'Không có mã nào khớp — thử bỏ dấu hoặc ít từ hơn.' : 'Chưa có mặt hàng nào.' + (canEdit() ? ' Bấm <b>Thêm hàng</b> để bắt đầu.' : '')}</div>`;
    $$('[data-ma]', box).forEach(r => r.onclick = () => select(r.dataset.ma));
    const more = $('#more'); if (more) more.onclick = () => { S.limit += 500; renderResults(); };
  }
  function select(ma) {
    S.sel = ma; const det = $('#det'); det.innerHTML = detail(); det.classList.remove('closed'); bindDetail();
    $$('[data-ma]').forEach(r => r.setAttribute('aria-selected', r.dataset.ma === ma));
    if (matchMedia('(max-width:899px),(orientation:landscape) and (max-height:520px)').matches) { history.pushState({ det: 1 }, ''); det.scrollTop = 0; }
  }
  function closeDetail() { S.sel = null; const det = $('#det'); if (det) { det.classList.add('closed'); det.innerHTML = detail(); } }
  window.addEventListener('popstate', () => { const dg0 = $('#dlg'); if (dg0 && dg0.open && dg0._isDirty && dg0._isDirty()) return; /* đang nhập dở: để hashchange hỏi lại, không vẽ màn khác phía sau */ if (S.sel) closeDetail(); else if (SX.sel && route() === 'sx') { SX.sel = null; renderView(); } else if (KS.sel && route() === 'kho') { KS.sel = null; renderView(); } else renderView(); });
  function detail() {
    if (!S.sel) return `<div class="empty">Chọn một mặt hàng để xem chi tiết, giá và nhà cung cấp.</div>`;
    const i = S.data.items.find(x => x.maHang === S.sel); if (!i) return '';
    const g = S.data.groups.find(x => x.maNhom === i.nhom);
    const ban = QPrice.history(S.data.prices, i.maHang, 'BAN'), nhap = isQT() ? QPrice.history(S.data.prices, i.maHang, 'NHAP') : [];
    const sup = c => (S.data.suppliers.find(s => s.maNCC === c) || {}).ten || c;
    return `<button class="btn ghost back" id="detBack">${ic('back')} Quay lại</button>
      <div class="mono mut">${esc(i.maHang)}</div><h2>${esc(i.ten)}</h2>${i.trangThai === 'NGUNG' ? '<span class="tag stop">Ngừng kinh doanh</span>' : '<span class="tag">Đang kinh doanh</span>'}
      <dl class="dl"><dt>Nhóm</dt><dd>${esc(g ? g.ten : i.nhom || '—')}</dd><dt>Quy cách</dt><dd>${esc(i.quyCach || '—')}</dd><dt>ĐVT</dt><dd>${esc(i.dvt)}</dd>
        <dt>Hãng / xuất xứ</dt><dd>${esc([i.hang, i.xuatXu].filter(Boolean).join(' · ') || '—')}</dd><dt>Bảo hành</dt><dd>${i.thangBH !== '' ? i.thangBH + ' tháng' : '—'}</dd>
        <dt>Quản lý serial</dt><dd>${i.quanLySerial === true || i.quanLySerial === 'true' ? 'Có' : 'Không'}</dd><dt>Tồn tối thiểu</dt><dd>${i.tonToiThieu !== '' ? i.tonToiThieu + ' ' + esc(i.dvt) : '—'}</dd>
        <dt>Giá bán hiện hành</dt><dd><b>${money(giaBan(i))}</b></dd>${isQT() ? `<dt>Giá vốn</dt><dd>${money(i.giaVon)}</dd>` : ''}
        <dt>Tồn kho</dt><dd><a href="#/kho" id="toKho">${num(tonQ(i.maHang))} ${esc(i.dvt)}</a>${low(i) ? ` <span class="tag stop">${ic('warn')} dưới tối thiểu</span>` : ''}</dd>
        <dt>Quy đổi ĐVT</dt><dd>${(S.data.units || []).filter(u => u.maHang === i.maHang).map(u => `1 ${esc(u.dvtPhu)} = ${num(u.heSo)} ${esc(i.dvt)}`).join('; ') || '—'}${canEdit() && !S.offline ? ' <button class="btn ghost" style="min-height:32px;padding:0 8px" id="addUnit" type="button">+ Thêm</button>' : ''}</dd>
        ${safeUrl(i.taiLieuUrl) ? `<dt>Tài liệu</dt><dd><a href="${esc(safeUrl(i.taiLieuUrl))}" target="_blank" rel="noopener noreferrer">Mở tài liệu</a></dd>` : ''}</dl>
      ${canEdit() && !S.offline ? `<div class="acts"><button class="btn" id="edItem">Sửa</button><button class="btn" id="addPrice">${ic('plus')} Thêm giá</button><button class="btn ${i.trangThai === 'NGUNG' ? '' : 'danger'}" id="stopItem">${i.trangThai === 'NGUNG' ? 'Kinh doanh lại' : 'Ngừng KD'}</button></div>` : ''}
      <div class="hist"><h3>Lịch sử giá bán</h3>${ban.length ? `<ul>${ban.slice(0, 12).map(p => `<li><span>Từ ${esc(vnD(p.tuNgay))}</span><b>${money(p.gia)}</b></li>`).join('')}</ul>` : '<p class="mut">Chưa có giá bán.</p>'}</div>
      ${isQT() ? `<div class="hist"><h3>Giá nhập theo NCC</h3>${nhap.length ? `<ul>${nhap.slice(0, 12).map(p => `<li><span>${esc(sup(p.maNCC))} · ${esc(vnD(p.tuNgay))}</span><b>${money(p.gia)}</b></li>`).join('')}</ul>` : '<p class="mut">Chưa có giá nhập.</p>'}</div>` : ''}`;
  }
  function bindDetail() {
    const b = $('#detBack'); if (b) b.onclick = () => history.state && history.state.det ? history.back() : closeDetail();
    const i = S.sel && S.data.items.find(x => x.maHang === S.sel); if (!i) return;
    const e = $('#edItem'); if (e) e.onclick = () => itemForm(i);
    const p = $('#addPrice'); if (p) p.onclick = () => priceForm(i);
    const un = $('#addUnit'); if (un) un.onclick = () => unitForm(i);
    const tk = $('#toKho'); if (tk) tk.onclick = () => { KS.sel = i.maHang; };
    const s = $('#stopItem'); if (s) s.onclick = async () => {
      s.classList.add('busy'); const ng = i.trangThai !== 'NGUNG';
      const r = await write('item.stop', { maHang: i.maHang, ngung: ng });
      if (r.ok) { toast(ng ? 'Đã chuyển sang ngừng kinh doanh' : 'Đã kinh doanh lại'); await sync(); } else { s.classList.remove('busy'); toast('Lỗi: ' + (r.error || r.code)); }
    };
  }
  function viewSuppliers(m) {
    const d = S.data;
    m.innerHTML = header('Giá & nhà cung cấp', canEdit() ? `<button class="btn pri" id="addSup">${ic('plus')}<span>Thêm NCC</span></button>` : '', false, canEdit() ? 'addSupM' : '') + `
      <p class="mut" style="margin-top:0">Giá bán và giá nhập theo từng mặt hàng: mở mặt hàng ở <a href="#/hang">Danh mục hàng</a> → <b>Thêm giá</b>.${isQT() ? '' : ' Giá nhập chỉ Quản trị xem được.'}</p>
      <div class="card list">${d.suppliers.length ? d.suppliers.map(s => `<div class="it" data-ncc="${esc(s.maNCC)}" role="button" tabindex="0"><div><div class="mono">${esc(s.maNCC)}</div><b>${esc(s.ten)}</b><br><small class="mut">${esc([s.mst && 'MST ' + s.mst, s.dienThoai, s.email].filter(Boolean).join(' · '))}</small></div>${s.trangThai === 'NGUNG' ? '<span class="tag stop">Ngừng</span>' : ''}</div>`).join('') : '<div class="empty">Chưa có nhà cung cấp.</div>'}</div>`;
    $$('#addSup,#addSupM').forEach(b => b.onclick = () => supplierForm());
    $$('[data-ncc]').forEach(r => r.onclick = () => canEdit() && supplierForm(d.suppliers.find(s => s.maNCC === r.dataset.ncc)));
  }
  function viewGroups(m) {
    const d = S.data, cnt = g => d.items.filter(i => i.nhom === g).length;
    m.innerHTML = header('Nhóm hàng', canEdit() ? `<button class="btn pri" id="addG">${ic('plus')}<span>Thêm nhóm</span></button>` : '', false, canEdit() ? 'addGM' : '') + `
      <div class="card list">${d.groups.length ? d.groups.map(g => `<div class="it" data-g="${esc(g.maNhom)}" role="button" tabindex="0"><div><div class="mono">${esc(g.maNhom)}</div><b>${esc(g.ten)}</b>${g.cha ? `<br><small class="mut">thuộc ${esc(g.cha)}</small>` : ''}</div><span class="tag">${cnt(g.maNhom)} mã</span></div>`).join('') : '<div class="empty">Chưa có nhóm. Ví dụ: ĐÈN LED, TỦ ĐIỆN, TRỤ, CÁP, IOT, PHỤ KIỆN.</div>'}</div>`;
    $$('#addG,#addGM').forEach(b => b.onclick = () => groupForm());
    $$('[data-g]').forEach(r => r.onclick = () => canEdit() && groupForm(d.groups.find(g => g.maNhom === r.dataset.g)));
  }
  function viewUsers(m) {
    const d = S.data;
    m.innerHTML = header('Người dùng', `<button class="btn pri" id="addU">${ic('plus')}<span>Thêm người dùng</span></button>`, false, 'addUM') +
      `
      <p class="mut" style="margin-top:0">Người dùng đăng nhập bằng Gmail. <b>Xem</b>: chỉ xem; <b>Nhập liệu</b>: thêm/sửa hàng, NCC, nhập giá (không xem lại giá nhập); <b>Quản trị</b>: toàn quyền, xem giá vốn.</p>
      <div class="card list">${d.users.map(u => `<div class="it" data-u="${esc(u.email)}" role="button" tabindex="0"><div><b>${esc(u.hoTen || u.email)}</b><br><small class="mut">${esc(u.email)}</small></div><div style="text-align:right"><span class="tag">${ROLE[u.vaiTro] || esc(u.vaiTro)}</span>${u.trangThai === 'KHOA' ? '<br><span class="tag stop">Đã khoá</span>' : ''}</div></div>`).join('')}</div>`;
    $$('#addU,#addUM').forEach(b => b.onclick = () => userForm());
    $$('[data-u]').forEach(r => r.onclick = () => userForm(d.users.find(u => u.email === r.dataset.u)));
  }
  function viewFeedback(m) {
    const d = S.data, mine = !isQT();
    m.innerHTML = header('Góp ý & đánh giá', `<button class="btn pri" id="addF">${ic('chat')}<span>Gửi góp ý</span></button>`, false, 'addFM') +
      `
      <p class="mut" style="margin-top:0">${mine ? 'Các góp ý anh/chị đã gửi.' : 'Tất cả góp ý của người dùng — bấm để cập nhật trạng thái.'}</p>
      <div class="card list">${d.feedback.length ? d.feedback.slice().reverse().map(f => `<div class="it" data-f="${esc(f.id)}" role="button" tabindex="0"><div><b>${f.sao ? '★'.repeat(f.sao) : ''} ${esc(FBTYPE[f.loai] || f.loai)}</b><br>${esc(f.noiDung || '')}<br><small class="mut">${esc(String(f.thoiGian).slice(0, 16).replace('T', ' '))}${mine ? '' : ' · ' + esc(f.email)}${f.note ? ' · Ghi chú: ' + esc(f.note) : ''}</small></div><span class="tag">${FBST[f.trangThai] || esc(f.trangThai)}</span></div>`).join('') : '<div class="empty">Chưa có góp ý.</div>'}</div>`;
    $$('#addF,#addFM').forEach(b => b.onclick = () => feedbackForm());
    if (!mine) $$('[data-f]').forEach(r => r.onclick = () => feedbackStatus(d.feedback.find(f => f.id === r.dataset.f)));
  }

  // ======================= ĐỢT ②: KHO =======================
  const LOAI = Object.fromEntries(Object.entries(QStock.TYPES).map(([k, t]) => [k, t.ten]));
  const TAO_DUOC = ['NHAP_MUA', 'XUAT_BAN', 'XUAT_CONG_TRINH', 'CHUYEN_KHO', 'KIEM_KE', 'KHACH_TRA', 'TRA_NCC', 'NHAP_KHAC', 'XUAT_HUY', 'NHAP_HANG_LOI', 'GUI_NCC', 'NHAN_NCC', 'CHUYEN_SUA', 'TRA_KHACH_SUA', 'TON_DAU'];   // xuất bảo hành / xuất sửa chữa: lập từ phiếu bảo hành
  const LOI_ONLY = ['NHAP_HANG_LOI', 'GUI_NCC', 'CHUYEN_SUA', 'TRA_KHACH_SUA'];   // phiếu lập từ / vào kho hàng lỗi
  const LYDO_BAT_BUOC = ['XUAT_HUY', 'NHAP_KHAC', 'CHUYEN_SUA'];
  const NHOM_PHIEU = { nhap: ['TON_DAU', 'NHAP_MUA', 'KHACH_TRA', 'NHAP_TP', 'NHAP_LAI_SX', 'NHAP_HANG_LOI', 'NHAP_KHAC', 'NHAN_NCC', 'CHUYEN_SUA'], xuat: ['XUAT_BAN', 'XUAT_CONG_TRINH', 'XUAT_BH', 'XUAT_SX', 'TRA_NCC', 'XUAT_HUY', 'GUI_NCC', 'TRA_KHACH_SUA', 'XUAT_SUA'], khac: ['CHUYEN_KHO', 'KIEM_KE'], dao: ['DAO'] };
  const num = n => n === '' || n === null || n === undefined ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
  const itemOf = ma => S.data.items.find(i => i.maHang === ma) || { maHang: ma, ten: ma, dvt: '' };
  const khoName = k => k === '*' ? 'Tổng' : ((S.data.warehouses || []).find(w => w.maKho === k) || {}).ten || k;
  const isLoi = k => ((S.data.warehouses || []).find(w => w.maKho === k) || {}).loai === 'HANG_LOI';
  const tonRow = (ma, kho = '*') => (S.data.stock || []).find(t => t.maHang === ma && t.kho === kho);
  const tonQ = (ma, kho = '*') => Number((tonRow(ma, kho) || {}).soLuong) || 0;
  const low = i => i.tonToiThieu !== '' && i.tonToiThieu !== undefined && i.trangThai !== 'NGUNG' && tonQ(i.maHang) < Number(i.tonToiThieu);
  const custName = c => ((S.data.customers || []).find(x => x.maKH === c) || {}).ten || c;
  const projName = c => ((S.data.projects || []).find(x => x.maCongTrinh === c) || {}).ten || c;
  const supName = c => ((S.data.suppliers || []).find(x => x.maNCC === c) || {}).ten || c;
  const activeKho = (loi) => (S.data.warehouses || []).filter(w => w.trangThai !== 'NGUNG' && (loi === undefined || (w.loai === 'HANG_LOI') === loi));
  const KS = { q: '', kho: '', lowOnly: false, pq: '', pg: '', sel: null, lim: 300, vlim: 300, vm: '' };

  /* Vẽ lại: only = bộ chọn vùng kết quả → chỉ thay vùng đó (ô tìm giữ nguyên: không mất con trỏ, bộ gõ Telex/VNI không bị cắt). */
  function paint(m, only, html) {
    const cur = only && $(only, m);
    if (cur) { const t = document.createElement('template'); t.innerHTML = html; const n = t.content.querySelector(only); if (n) { cur.replaceWith(n); return; } }
    m.innerHTML = html;
  }
  /** Gắn ô tìm 1 lần: chờ gõ xong dấu (composition), đồng bộ ô điện thoại/máy tính, trễ ms rồi redraw(). */
  function onSearch(sel, set, redraw, ms = 250) {
    let t = null;
    $$(sel).forEach(q => { if (q._srch) return; q._srch = 1; let comp = false;
      q.addEventListener('compositionstart', () => comp = true);
      q.addEventListener('compositionend', () => { comp = false; q.dispatchEvent(new Event('input')); });
      q.addEventListener('input', () => { if (comp) return; set(q.value); $$(sel).forEach(o => { if (o !== q) o.value = q.value; }); clearTimeout(t); t = setTimeout(redraw, ms); }); });
  }
  function viewStock(m, only) {
    const d = S.data, ws = d.warehouses || [];
    const list0 = QSearch.search(d.items, KS.q, S.idx).filter(i => i.trangThai !== 'NGUNG' || tonQ(i.maHang) !== 0);
    const list = list0.filter(i => (!KS.lowOnly || low(i)) && (!KS.kho || tonRow(i.maHang, KS.kho)));
    const nLow = d.items.filter(low).length, val = isQT() ? (d.stock || []).filter(t => t.kho === '*').reduce((a, t) => a + (Number(t.giaTri) || 0), 0) : null;
    const thisMonth = (d.vouchers || []).filter(p => String(p.ngay).slice(0, 7) === S.today.slice(0, 7)).length;
    const act = (canEdit() ? `<button class="btn pri" id="newV">${ic('plus')}<span>Lập phiếu</span></button>` : '') + (isQT() ? `<button class="btn" id="khoAdm">${ic('layers')}<span>Kho & khoá sổ</span></button>` : '') + (activeKho(true).length ? `<button class="btn" id="loiR">${ic('warn')}<span>Kho hàng lỗi</span></button>` : '') + `<button class="btn" id="xlsT">${ic('dl')}<span>Xuất Excel</span></button>`;
    paint(m, only, header('Tồn kho', act, false, canEdit() ? 'newVM' : '') +
      `<label class="msearch">${ic('search')}<span class="sr">Tìm hàng</span><input id="qkm" type="search" placeholder="Tìm mã, tên hàng…" value="${esc(KS.q)}" autocomplete="off"></label>
      <div class="kpi"><div class="k"><small>Mã có tồn</small><b>${(d.stock || []).filter(t => t.kho === '*' && Number(t.soLuong) > 0).length.toLocaleString('vi-VN')}</b></div>
        <div class="k"><small>⚠ Dưới tồn tối thiểu</small><b>${nLow}</b></div><div class="k"><small>${isQT() ? 'Giá trị tồn (giá vốn)' : 'Số kho'}</small><b>${isQT() ? money(val) : ws.length}</b></div>
        <div class="k"><small>Phiếu tháng này</small><b>${thisMonth}</b></div></div>
      <div class="top" style="margin-top:-4px"><label class="search" style="flex:1 1 380px">${ic('search')}<span class="sr">Tìm hàng</span><input id="qkd" type="search" placeholder="Tìm mã, tên hàng…" value="${esc(KS.q)}" autocomplete="off"></label></div>
      <div class="chips" role="group" aria-label="Lọc kho">${[['', 'Tất cả kho'], ...ws.map(w => [w.maKho, w.ten])].map(([k, t]) => `<button class="chip" type="button" data-k="${esc(k)}" aria-pressed="${KS.kho === k}">${esc(t)}</button>`).join('')}
        <button class="chip" type="button" id="lowT" aria-pressed="${KS.lowOnly}">⚠ Dưới tồn tối thiểu (${nLow})</button></div>
      ${(d.vouchers || []).length ? '' : `<div class="banner" role="status" style="background:var(--acc-soft)">Chưa có phiếu kho. ${canEdit() ? 'Bắt đầu bằng phiếu <b>Tồn đầu kỳ</b> (hàng đang có) hoặc <b>Nhập mua</b>.' : ''}</div>`}
      ${d.config && d.config.ngayKhoaSo ? `<p class="mut" style="margin:0 0 10px">Đã khoá sổ đến hết ngày <b>${esc(vnD(d.config.ngayKhoaSo))}</b>.</p>` : ''}${d.config && d.config.ngayKhoaMax && d.config.ngayKhoaMax > (d.config.ngayKhoaSo || '') ? `<p class="warnbar" role="status">Sổ đang được mở lại từ ${esc(vnD(d.config.ngayKhoaSo ? addDay(d.config.ngayKhoaSo) : ''))} đến ${esc(vnD(d.config.ngayKhoaMax))} để Quản trị điều chỉnh — chỉ Quản trị ghi phiếu trong khoảng này. Điều chỉnh xong nhớ khoá lại.</p>` : ''}
      <div class="layout"><div class="card"><div class="tbl" id="stockRes"></div></div><section class="card det ${KS.sel ? '' : 'closed'}" id="kdet" aria-label="Chi tiết tồn">${stockDetail()}</section></div>`);
    const draw = () => {
      const box = $('#stockRes'), mob = isMobile(), rows = list.slice(0, KS.lim);
      const wcols = ws.filter(w => (d.stock || []).some(t => t.kho === w.maKho && Number(t.soLuong)));   // ẩn cột kho không có hàng
      const q = i => KS.kho ? tonQ(i.maHang, KS.kho) : tonQ(i.maHang);
      const warn = i => low(i) ? ` <span class="tag stop">${ic('warn')} dưới tối thiểu ${num(i.tonToiThieu)}</span>` : '';
      box.innerHTML = rows.length ? (mob
        ? `<div class="list">${rows.map(i => `<div class="it" data-km="${esc(i.maHang)}" role="button" tabindex="0" aria-selected="${KS.sel === i.maHang}"><div><div class="mono">${esc(i.maHang)}</div>${esc(i.ten)}${warn(i)}</div><div style="text-align:right;white-space:nowrap"><b>${num(q(i))}</b><br><small class="mut">${esc(i.dvt)}</small></div></div>`).join('')}</div>`
        : `<table><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th>ĐVT</th>${KS.kho || wcols.length < 2 ? '' : wcols.map(w => `<th class="n">${esc(w.ten)}</th>`).join('')}<th class="n" title="Không gồm kho hàng lỗi">${KS.kho ? esc(khoName(KS.kho)) : 'Tổng tồn'}</th>${isQT() ? '<th class="n">Giá vốn</th><th class="n">Giá trị</th>' : ''}</tr></thead><tbody>
          ${rows.map(i => { const t = tonRow(i.maHang) || {}; return `<tr data-km="${esc(i.maHang)}" role="button" tabindex="0" aria-selected="${KS.sel === i.maHang}"><td class="mono">${esc(i.maHang)}</td><td>${esc(i.ten)}${warn(i)}</td><td>${esc(i.dvt)}</td>${KS.kho || wcols.length < 2 ? '' : wcols.map(w => `<td class="n">${num(tonQ(i.maHang, w.maKho) || '')}</td>`).join('')}<td class="n"><b>${num(q(i))}</b></td>${isQT() ? `<td class="n">${money(i.giaVon)}</td><td class="n">${money(t.giaTri)}</td>` : ''}</tr>`; }).join('')}</tbody></table>`)
        : `<div class="empty">${d.items.length ? 'Không có mã nào khớp bộ lọc.' : 'Chưa có mặt hàng — thêm ở Danh mục hàng.'}${canEdit() && !(d.vouchers || []).length ? '<br>Bắt đầu bằng phiếu <b>Tồn đầu kỳ</b> hoặc <b>Nhập mua</b>.' : ''}</div>`;
      if (list.length > rows.length) box.insertAdjacentHTML('beforeend', `<p class="mut cnt">Đang hiện ${rows.length.toLocaleString('vi-VN')}/${list.length.toLocaleString('vi-VN')} mã — gõ tìm để thu hẹp.</p><button class="btn more" type="button" id="kMore">Xem thêm (${(list.length - rows.length).toLocaleString('vi-VN')} mã)</button>`);
      const km = $('#kMore', box); if (km) km.onclick = () => { KS.lim += 500; draw(); };
      $$('[data-km]', box).forEach(r => r.onclick = () => { KS.sel = r.dataset.km; const det = $('#kdet'); det.innerHTML = stockDetail(); det.classList.remove('closed'); bindStockDetail(); $$('[data-km]').forEach(x => x.setAttribute('aria-selected', x.dataset.km === KS.sel)); if (isMobile()) history.pushState({ kdet: 1 }, ''); });
    };
    onSearch('#qkm,#qkd', v => { KS.q = v; KS.lim = 300; }, () => viewStock(m, '#stockRes'));
    $$('.chip[data-k]').forEach(b => b.onclick = () => { KS.kho = b.dataset.k; viewStock(m); });
    $('#lowT').onclick = () => { KS.lowOnly = !KS.lowOnly; viewStock(m); };
    $$('#newV,#newVM').forEach(b => b.onclick = () => voucherPick());
    const ka = $('#khoAdm'); if (ka) ka.onclick = khoAdmin;
    const lr = $('#loiR'); if (lr) lr.onclick = loiReport;
    $('#xlsT').onclick = () => exportRows(`TonKho_${S.today}`, list.map(i => ({ 'Mã hàng': i.maHang, 'Tên hàng': i.ten, 'ĐVT': i.dvt, ...Object.fromEntries(ws.map(w => [w.ten, tonQ(i.maHang, w.maKho)])), 'Tồn (không gồm hàng lỗi)': tonQ(i.maHang), 'Tồn tối thiểu': i.tonToiThieu, ...(isQT() ? { 'Giá vốn BQ': i.giaVon, 'Giá trị tồn': (tonRow(i.maHang) || {}).giaTri } : {}) })));
    draw(); bindStockDetail();
  }
  function stockDetail() {
    if (!KS.sel) return '<div class="empty">Chọn một mã để xem tồn từng kho và số serial.</div>';
    const i = itemOf(KS.sel), ser = (S.data.serials || []).filter(x => x.maHang === i.maHang && x.trangThai !== 'DA_BAN');
    const ps = (S.data.vouchers || []).slice(-500);
    return `<button class="btn ghost back" id="kBack">${ic('back')} Quay lại</button><div class="mono mut">${esc(i.maHang)}</div><h2>${esc(i.ten)}</h2>
      <dl class="dl">${(S.data.warehouses || []).map(w => `<dt>${esc(w.ten)}</dt><dd>${num(tonQ(i.maHang, w.maKho))} ${esc(i.dvt)}${w.loai === 'HANG_LOI' ? ' <small class="mut">(hàng lỗi)</small>' : ''}</dd>`).join('')}
        <dt>Tồn tối thiểu</dt><dd>${i.tonToiThieu !== '' ? num(i.tonToiThieu) + ' ' + esc(i.dvt) : '—'}${low(i) ? ` <span class="tag stop">${ic('warn')} thiếu</span>` : ''}</dd>
        ${isQT() ? `<dt>Giá vốn BQ</dt><dd>${money(i.giaVon)}</dd><dt>Giá trị tồn</dt><dd>${money((tonRow(i.maHang) || {}).giaTri)}</dd>` : ''}</dl>
      ${canEdit() && !S.offline ? `<div class="acts"><button class="btn pri" id="kIn">Nhập</button><button class="btn" id="kOut">Xuất</button><button class="btn" id="kKK">Kiểm kê</button><button class="btn" id="kXH">Xuất huỷ</button>${activeKho(true).some(w => tonQ(i.maHang, w.maKho) > 0) ? '<button class="btn" id="kCS">Hàng lỗi đã sửa → kho thường</button><button class="btn" id="kGN">Gửi NCC</button>' : ''}</div>` : ''}
      ${ser.length ? `<div class="hist"><h3>Serial đang trong kho (${ser.length})</h3><ul>${ser.slice(0, 50).map(x => `<li><span class="mono">${esc(x.serial)}</span><span>${esc(khoName(x.kho))}${x.trangThai === 'HANG_LOI' ? ' · lỗi' : ''}</span></li>`).join('')}</ul></div>` : ''}`;
  }
  function bindStockDetail() {
    const b = $('#kBack'); if (b) b.onclick = () => history.state && history.state.kdet ? history.back() : (KS.sel = null, renderView());
    const i = KS.sel && itemOf(KS.sel); if (!i) return;
    const line = { maHang: i.maHang };
    const a = $('#kIn'); if (a) a.onclick = () => voucherForm('NHAP_MUA', { lines: [line] });
    const o = $('#kOut'); if (o) o.onclick = () => voucherForm('XUAT_CONG_TRINH', { lines: [line] });
    const k = $('#kKK'); if (k) k.onclick = () => voucherForm('KIEM_KE', { lines: [line] });
    const loiKho = (activeKho(true).find(w => tonQ(i.maHang, w.maKho) > 0) || {}).maKho;
    const xh = $('#kXH'); if (xh) xh.onclick = () => voucherForm('XUAT_HUY', { lines: [line] });
    const cs = $('#kCS'); if (cs) cs.onclick = () => voucherForm('CHUYEN_SUA', { kho: loiKho, lines: [line] });
    const gn = $('#kGN'); if (gn) gn.onclick = () => voucherForm('GUI_NCC', { kho: loiKho, lines: [line] });
  }

  // ---------- danh sách phiếu ----------
  /* Lọc theo tháng: tháng nằm trong 500 phiếu đã tải thì dùng luôn, cũ hơn thì hỏi máy chủ (voucher.list) — nhớ theo phiên bản dữ liệu. */
  function monthVouchers(m) {
    const loc = (S.data.vouchers || []);
    if (!S.data.vouchersCut) return loc;   // máy đã có đủ mọi phiếu
    const c = (KS.vmc = KS.vmc || {})[KS.vm], recent = KS.vm >= addMonth(S.today, -1);
    if (c && !c.busy && (c.err || !recent || c.ver === S.version)) return c.rows;   // bản lỗi cũng là kết quả: chỉ gọi lại khi bấm Thử lại   // tháng cũ: giữ bản đã tải; 2 tháng gần nhất: tải lại khi dữ liệu đổi
    if (!c || !c.busy) { const th = KS.vm; KS.vmc[th] = { busy: 1, rows: c ? c.rows : [] };
      call('voucher.list', { thang: th }, 3).then(r => { KS.vmc[th] = r.ok ? { ver: S.version, rows: r.data.vouchers } : { rows: [], err: r.error || r.code }; if (route() === 'phieu' && KS.vm === th) viewVouchers(m, '#vres'); }); }
    return KS.vmc[KS.vm].rows;
  }
  const addMonth = (d, n) => { const y = +d.slice(0, 4), mo = +d.slice(5, 7) - 1 + n; return new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7); };
  function viewVouchers(m, only) {
    const d = S.data, src = KS.vm ? monthVouchers(m) : (d.vouchers || []);
    const all = src.slice().sort((a, b) => b.ngay < a.ngay ? -1 : b.ngay > a.ngay ? 1 : b.stt - a.stt);
    const nq = QSearch.norm(KS.pq);
    const list = all.filter(p => (!KS.pg || NHOM_PHIEU[KS.pg].includes(p.loai)) && (!KS.vm || String(p.ngay).slice(0, 7) === KS.vm) && (!nq || QSearch.norm([p.soPhieu, custName(p.maKH), projName(p.maCongTrinh), supName(p.maNCC), p.lyDo, p.soCTGoc].join(' ')).includes(nq)));
    paint(m, only, header('Phiếu kho', canEdit() ? `<button class="btn pri" id="newV">${ic('plus')}<span>Lập phiếu</span></button>` : '', false, canEdit() ? 'newVM' : '') +
      `<label class="msearch">${ic('search')}<span class="sr">Tìm phiếu</span><input id="qpm" type="search" placeholder="Số phiếu, khách, công trình…" value="${esc(KS.pq)}" autocomplete="off"></label>
      <div class="top" style="margin-top:-4px"><label class="search" style="flex:1 1 380px">${ic('search')}<span class="sr">Tìm phiếu</span><input id="qpd" type="search" placeholder="Số phiếu, khách, công trình, NCC, lý do…" value="${esc(KS.pq)}" autocomplete="off"></label></div>
      <div class="chips" role="group" aria-label="Lọc phiếu">${[['', 'Tất cả'], ['nhap', 'Nhập'], ['xuat', 'Xuất'], ['khac', 'Chuyển kho · Kiểm kê'], ['dao', 'Phiếu đảo']].map(([k, t]) => `<button class="chip" type="button" data-pg="${k}" aria-pressed="${KS.pg === k}">${t}</button>`).join('')}</div>
      <div class="monrow"><label for="vMon">Tháng</label><input class="in" type="month" id="vMon" value="${esc(KS.vm)}">${KS.vm ? `<button class="chip" type="button" id="vMonX" aria-pressed="true">Đang lọc ${esc(vnD(KS.vm))} ✕</button>` : '<span class="mut">tất cả các tháng</span>'}</div>
      <div id="vres">${KS.vm && KS.vmc && KS.vmc[KS.vm] && KS.vmc[KS.vm].busy ? `<p class="mut cnt" role="status">Đang tải phiếu tháng ${esc(vnD(KS.vm))}…</p>` : ''}${KS.vm && KS.vmc && KS.vmc[KS.vm] && KS.vmc[KS.vm].err ? `<p class="cnt bad" role="alert">Không tải được phiếu tháng ${esc(vnD(KS.vm))}: ${esc(KS.vmc[KS.vm].err)} <button class="btn ghost" type="button" id="vRetry">Thử lại</button></p>` : ''}<div class="card list">${list.length ? list.slice(0, KS.vlim).map(p => `<div class="it" data-so="${esc(p.soPhieu)}" role="button" tabindex="0"><div><div class="mono">${esc(p.soPhieu)}${p.daDao ? ' <span class="tag stop">Đã đảo</span>' : ''}</div><b>${esc(LOAI[p.loai] || p.loai)}</b> · ${esc(vnD(p.ngay))} · ${esc(khoName(p.kho))}${p.khoDen ? ' → ' + esc(khoName(p.khoDen)) : ''}<br><small class="mut">${esc([p.maKH && custName(p.maKH), p.maCongTrinh && projName(p.maCongTrinh), p.maNCC && supName(p.maNCC), p.phieuGoc && 'gốc ' + p.phieuGoc, p.lyDo].filter(Boolean).join(' · '))}</small></div>${isQT() && p.tongTien !== undefined ? `<b style="white-space:nowrap">${money(p.tongTien)}</b>` : ''}</div>`).join('')
        : `<div class="empty">${KS.vm && KS.vmc && KS.vmc[KS.vm] && (KS.vmc[KS.vm].busy || KS.vmc[KS.vm].err) ? '' : all.length || KS.vm ? 'Không có phiếu khớp.' : 'Chưa có phiếu kho.' + (canEdit() ? ' Bấm <b>Lập phiếu</b> — bắt đầu bằng Tồn đầu kỳ hoặc Nhập mua.' : '')}</div>`}</div>
      ${list.length > KS.vlim ? `<p class="mut cnt">Đang hiện ${KS.vlim.toLocaleString('vi-VN')}/${list.length.toLocaleString('vi-VN')} phiếu (mới nhất trước) — lọc theo tháng hoặc gõ tìm để thu hẹp.</p><button class="btn more" type="button" id="vMore">Xem thêm (${(list.length - KS.vlim).toLocaleString('vi-VN')} phiếu)</button>` : ''}</div>`);
    const vr = $('#vRetry'); if (vr) vr.onclick = () => { delete KS.vmc[KS.vm]; viewVouchers(m, '#vres'); };
    const vmo = $('#vMore'); if (vmo) vmo.onclick = () => { KS.vlim += 500; viewVouchers(m, '#vres'); };
    $('#vMon').onchange = e => { KS.vm = e.target.value; KS.vlim = 300; viewVouchers(m); }; const vx = $('#vMonX'); if (vx) vx.onclick = () => { KS.vm = ''; viewVouchers(m); };
    onSearch('#qpm,#qpd', v => { KS.pq = v; }, () => viewVouchers(m, '#vres'), 300);
    $$('.chip[data-pg]').forEach(b => b.onclick = () => { KS.pg = b.dataset.pg; viewVouchers(m); });
    $$('#newV,#newVM').forEach(b => b.onclick = () => voucherPick());
    $$('[data-so]').forEach(r => r.onclick = () => voucherView(r.dataset.so));
  }
  function voucherPick() {
    const types = TAO_DUOC.filter(t => !(LOI_ONLY.includes(t) || t === 'NHAN_NCC') || activeKho(true).length);
    dialog('Lập phiếu kho', `<div class="list">${types.map(t => `<button class="it btn ghost" type="button" style="width:100%;justify-content:flex-start" data-t="${t}"><span class="mono" style="min-width:34px">${QStock.prefix(t)}</span><span style="flex:1;text-align:left">${LOAI[t]}</span></button>`).join('')}</div>`, null, d => $$('[data-t]', d).forEach(b => b.onclick = () => { d.close(); voucherForm(b.dataset.t); }));
  }
  async function voucherView(so) {
    const r = await load('voucher.get', { soPhieu: so }, 'Đang mở phiếu ' + so + '…');
    if (!r.ok) return toast('Không mở được phiếu: ' + (r.error || r.code));
    const p = r.data.phieu, L = r.data.lines, showMoney = isQT();
    const canRev = isQT() && !S.offline && p.loai !== 'DAO' && !p.daDao;
    const canRet = canEdit() && !S.offline && ['XUAT_BAN', 'XUAT_CONG_TRINH', 'XUAT_BH'].includes(p.loai) && !p.daDao;
    const canTn = canEdit() && !S.offline && ['NHAP_MUA', 'TON_DAU'].includes(p.loai) && !p.daDao;
    const live = canEdit() && !S.offline && !p.daDao;
    const canNN = live && p.loai === 'GUI_NCC', canTS = live && p.loai === 'NHAP_HANG_LOI' && !!p.maKH;
    const leBH = live && ['XUAT_BAN', 'XUAT_CONG_TRINH', 'XUAT_BH'].includes(p.loai) && L.some(l => !isSer(itemOf(l.maHang)));
    dialog(esc(LOAI[p.loai] || p.loai) + ' ' + esc(p.soPhieu), `
      <dl class="dl"><dt>Ngày</dt><dd>${esc(vnD(p.ngay))}</dd><dt>Kho</dt><dd>${esc(khoName(p.kho))}${p.khoDen ? ' → ' + esc(khoName(p.khoDen)) : ''}</dd>
        ${p.maNCC ? `<dt>Nhà cung cấp</dt><dd>${esc(supName(p.maNCC))}</dd>` : ''}${p.maKH ? `<dt>Khách hàng</dt><dd>${esc(custName(p.maKH))}</dd>` : ''}${p.maCongTrinh ? `<dt>Công trình</dt><dd>${esc(projName(p.maCongTrinh))}</dd>` : ''}
        ${p.soLSX ? `<dt>Lệnh sản xuất</dt><dd class="mono">${esc(p.soLSX)}</dd>` : ''}${p.phieuGoc ? `<dt>Phiếu gốc</dt><dd class="mono">${esc(p.phieuGoc)}</dd>` : ''}${p.nguoiGiaoNhan ? `<dt>Người giao/nhận</dt><dd>${esc(p.nguoiGiaoNhan)}</dd>` : ''}
        ${p.lyDo ? `<dt>Lý do</dt><dd>${esc(p.lyDo)}</dd>` : ''}${p.soCTGoc ? `<dt>Chứng từ gốc</dt><dd>${esc(p.soCTGoc)}${p.ngayCTGoc ? ' ngày ' + esc(vnD(p.ngayCTGoc)) : ''}</dd>` : ''}
        <dt>Người lập</dt><dd>${esc(p.nguoiTao)}</dd>${p.daDao ? '<dt>Trạng thái</dt><dd><span class="tag stop">Đã đảo</span></dd>' : ''}</dl>
      <div class="tbl" style="max-height:none"><table><thead><tr><th>#</th><th>Hàng</th><th class="n">${p.loai === 'KIEM_KE' ? 'Sổ sách → Thực tế' : 'Số lượng'}</th>${showMoney ? '<th class="n">Giá trị kho</th>' : ''}</tr></thead><tbody>
        ${L.map(l => { const i = itemOf(l.maHang); return `<tr><td>${l.dong}</td><td><span class="mono">${esc(l.maHang)}</span> ${esc(i.ten)}${l.serials && l.serials.length ? `<br><small class="mono">${l.serials.map(esc).join(', ')}</small>` : ''}${l.serialsDoi && l.serialsDoi.length ? `<br><small>NCC đổi cho: <span class="mono">${l.serialsDoi.map(esc).join(', ')}</span></small>` : ''}</td><td class="n">${p.loai === 'KIEM_KE' ? num(l.slSoSach) + ' → ' + num(l.slThucTe) : num(l.soLuongCT) + ' ' + esc(l.dvt)}${l.heSo && l.heSo !== 1 ? `<br><small class="mut">= ${num(l.soLuong)} ${esc(i.dvt)}</small>` : ''}</td>${showMoney ? `<td class="n">${money(l.giaTriKho)}${Number(l.chenhLechGV) ? `<br><small class="mut">chênh lệch GV ${money(l.chenhLechGV)}</small>` : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>
      ${showMoney ? `<p style="text-align:right"><b>Tổng: ${money(p.tongTien)}</b></p>` : '<p class="mut" style="font-size:12.5px">Đơn giá, giá trị chỉ Quản trị xem được.</p>'}
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" type="button" id="vPrint">In phiếu</button>${canRet ? '<button class="btn" type="button" id="vRet">Khách trả hàng</button>' : ''}${canTn ? '<button class="btn" type="button" id="vTn">Trả nhà cung cấp</button>' : ''}${canNN ? '<button class="btn pri" type="button" id="vNN">Nhận hàng NCC trả về</button>' : ''}${canTS ? '<button class="btn" type="button" id="vTS">Trả khách (đã sửa)</button>' : ''}${leBH ? `<button class="btn" type="button" id="vBH">${ic('shield')} Tiếp nhận bảo hành</button>` : ''}${canRev ? '<button class="btn danger" type="button" id="vRev">Đảo phiếu</button>' : ''}</div>`, null, d => {
      d.classList.add('wide');
      $('#vPrint', d).onclick = () => printVoucher(p, L);   // phiếu đảo: in theo mẫu của phiếu gốc, số âm
      const rt = $('#vRet', d); if (rt) rt.onclick = () => { d.close(); voucherForm('KHACH_TRA', { phieuGoc: p.soPhieu, kho: p.kho, maKH: p.maKH, maCongTrinh: p.maCongTrinh, lines: L.map(l => ({ maHang: l.maHang, soLuongCT: '', dongGoc: l.dong, gocSerials: l.serials })) }); };
      const tn = $('#vTn', d); if (tn) tn.onclick = () => { d.close(); voucherForm('TRA_NCC', { phieuGoc: p.soPhieu, kho: p.kho, maNCC: p.maNCC, lines: L.map(l => ({ maHang: l.maHang, soLuongCT: '', dongGoc: l.dong, gocSerials: l.serials })) }); };
      const rv = $('#vRev', d); if (rv) rv.onclick = () => { d.close(); reverseForm(p); };
      const nn = $('#vNN', d); if (nn) nn.onclick = () => { d.close(); voucherForm('NHAN_NCC', { phieuGoc: p.soPhieu, maNCC: p.maNCC, kho: (activeKho(false)[0] || {}).maKho, lines: L.map(l => ({ maHang: l.maHang, soLuongCT: '', dongGoc: l.dong, gocSerials: l.serials })) }); };
      const ts = $('#vTS', d); if (ts) ts.onclick = () => { d.close(); voucherForm('TRA_KHACH_SUA', { phieuGoc: p.soPhieu, kho: p.kho, maKH: p.maKH, maCongTrinh: p.maCongTrinh, lyDo: 'Trả hàng đã sửa', lines: L.map(l => ({ maHang: l.maHang, soLuongCT: '', dongGoc: l.dong, gocSerials: l.serials })) }); };
      const bh = $('#vBH', d); if (bh) bh.onclick = () => { d.close(); ticketFormLe(p, L); };
    });
  }
  function reverseForm(p) {
    dialog('Đảo phiếu ' + esc(p.soPhieu), `<p>Phiếu đảo huỷ tác động của phiếu gốc lên tồn kho và giá vốn. Phiếu gốc vẫn giữ lại, được đánh dấu <b>Đã đảo</b>.</p>
      ${fld('ngay', 'Ngày phiếu đảo', S.today, { req: 1, type: 'date', max: S.today })}${fld('lyDo', 'Lý do đảo', '', { req: 1, type: 'textarea' })}`,
      async (v, d) => { if (!v.lyDo.trim()) { showErrors(d, { lyDo: 'Nhập lý do' }); return false; } return submitV(d, 'voucher.reverse', { phieuGoc: p.soPhieu, ngay: v.ngay, lyDo: v.lyDo }, so => 'Đã lập phiếu đảo ' + so); }, null, 'Đảo phiếu');
  }
  async function submitV(d, action, body, okMsg) {
    if (S.offline) { dlgMsg(d, 'Đang ngoại tuyến — chưa lưu được. Dữ liệu trong phiếu vẫn giữ nguyên.'); return false; }
    const r = await write(action, { ...body, requestId: d._rid || (d._rid = rid()) });
    if (!r.ok) {
      $$('.lineerr', d).forEach(x => x.remove()); $$('.bad-line', d).forEach(x => x.classList.remove('bad-line'));
      if (Array.isArray(r.fields)) {   // lỗi theo dòng: tô viền + ghi lý do ngay dưới dòng (lỗi tồn kho chỉ có mã hàng → tìm dòng có mã đó)
        r.fields.forEach(e => {
          const c = e.dong ? $(`[data-line="${e.dong}"]`, d) : e.maHang ? $$('[data-line]', d).find(x => { const i = $('[data-f="maHang"]', x); return i && i.value.trim().toUpperCase() === String(e.maHang).toUpperCase(); }) : null;
          const msg = e.msg || e.error || (e.code === 'NEG' ? 'không đủ tồn' + (e.ton !== undefined ? ' (thiếu ' + num(-e.ton) + ')' : '') : '');
          if (c) { c.classList.add('bad-line'); if (msg) c.insertAdjacentHTML('beforeend', `<div class="lineerr" role="alert">Dòng ${esc(c.dataset.line)}: ${esc(msg)}</div>`); }
        });
        const f = $('.bad-line', d); if (f) f.scrollIntoView({ block: 'center' });
      } else if (r.fields) showErrors(d, r.fields);
      if (!['NETWORK', 'VALIDATION', 'AUTH_INVALID', 'AUTH_EXPIRED', 'FORBIDDEN', 'PERIOD_LOCKED'].includes(r.code)) sync();   // hết tồn / serial vừa bị người khác dùng → lấy số mới
      dlgMsg(d, 'Chưa lưu: ' + (r.error || r.code) + (r.code === 'NETWORK' ? ' — kiểm tra mạng rồi bấm Lưu lại' : '')); return false;
    }
    d._guard = null; toast((r.data.lapLai || r.replay ? 'Phiếu đã lưu từ lần bấm trước: ' + r.data.soPhieu : okMsg(r.data.soPhieu)) + (r.data.tinhLai ? ` · đã tính lại giá vốn ${r.data.tinhLai} dòng phiếu sau` : '')); await sync(); return true;
  }

  // ---------- lập phiếu ----------
  // ---------- quét mã bằng camera (QR tem tủ, mã serial) ----------
  const hasCam = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  /** Chuỗi quét được → số serial (tem tủ là đường dẫn …#/t/<cty>/<xê-ri>). */
  const serOf = t => { const m = String(t).match(/#\/t\/([^/]+)\/([^?#\s]+)/); let z = m ? m[2] : String(t); if (m) { try { z = decodeURIComponent(z); } catch (e) { /* % hỏng: giữ nguyên */ } } return z.trim().slice(0, 80); };
  let JSQR = null;
  const loadJsQR = () => JSQR || (JSQR = new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'vendor/jsqr.js'; sc.integrity = 'sha384-3oyTvplaWkcozEpjVh5YYIxrcwDnbZJ2cN0LnjEUo7sNQGp9sgaPhIhVnnzc8JXm';   /* jsQR 1.4.0 (npm, Apache-2.0, xem vendor/jsqr.LICENSE) */ sc.onload = () => ok(window.jsQR); sc.onerror = () => { JSQR = null; no(new Error('Không tải được bộ đọc QR')); }; document.head.appendChild(sc); }));
  /** Mở camera sau, đọc liên tục. onCode(text) → { msg, bad } hiện dưới khung; multi = quét nhiều mã (bấm Xong để đóng), không multi = đóng sau mã đầu.
   *  Máy có BarcodeDetector (Android Chrome) đọc cả QR lẫn mã vạch 1D; còn lại (iPhone) đọc QR bằng jsQR. */
  async function scanCode(title, onCode, multi) {
    if (!hasCam()) return toast('Máy không cho dùng camera — nhập tay');
    const host = $('dialog[open]') || document.body, ov = document.createElement('div');
    ov.className = 'scanov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', title);
    ov.innerHTML = `<div class="scanbox"><header><b>${esc(title)}</b><button class="btn ghost iconbtn" type="button" data-sx aria-label="Đóng">${ic('x')}</button></header>
      <div class="scanvid"><video playsinline muted></video><div class="scanaim"></div></div><p class="scanmsg" role="status" aria-live="polite">Đang mở camera…</p>
      ${multi ? '<button class="btn pri" type="button" data-sx style="width:100%">Xong</button>' : ''}</div>`;
    host.appendChild(ov);
    const v = $('video', ov), msg = $('.scanmsg', ov), back = document.activeElement; let stream = null, alive = true, last = '', lastAt = 0, timer = null;
    if (S.scanStop) S.scanStop();
    const stop = () => { if (!alive) return; alive = false; clearTimeout(timer); if (stream) stream.getTracks().forEach(t => t.stop()); ov.remove(); document.removeEventListener('keydown', key, true); if (S.scanStop === stop) S.scanStop = null; if (back && back.isConnected && back.focus) back.focus(); };
    const key = e => {   // Esc đóng máy quét (không đóng phiếu phía sau); Tab chỉ đi trong máy quét
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); stop(); }
      else if (e.key === 'Tab') { const f = $$('button', ov); if (!f.length) return; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); }
    };
    S.scanStop = stop; document.addEventListener('keydown', key, true);
    $$('[data-sx]', ov).forEach(b => b.onclick = stop); $('[data-sx]', ov).focus();
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); if (!alive || !ov.isConnected) { stream.getTracks().forEach(t => t.stop()); stream = null; return stop(); } }
    catch (e) { msg.textContent = 'Không mở được camera (' + (e.name === 'NotAllowedError' ? 'chưa cho phép dùng camera' : e.message) + ') — nhập tay.'; return; }
    if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
    v.srcObject = stream; await v.play().catch(() => {});
    let det = null; if ('BarcodeDetector' in window) { try { const f = await BarcodeDetector.getSupportedFormats(); det = new BarcodeDetector({ formats: f.filter(x => ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix', 'itf'].includes(x)) }); } catch (e) { det = null; } }
    let qr = null; if (!det) { try { qr = await loadJsQR(); } catch (e) { msg.textContent = e.message; return; } }
    msg.textContent = 'Đưa mã vào khung'; const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    const tick = async () => {
      if (!alive) return; if (!ov.isConnected) return stop();   // hộp thoại chứa máy quét đã đóng / bị thay
      try {
        let txt = '';
        if (v.readyState >= 2) {
          if (det) { const r = await det.detect(v); txt = r[0] && r[0].rawValue; }
          else { const w = Math.min(v.videoWidth, 720), h = Math.round(v.videoHeight * w / v.videoWidth); cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h); const r = qr(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' }); txt = r && r.data; }
        }
        if (txt && !(txt === last && Date.now() - lastAt < 2500)) {
          last = txt; lastAt = Date.now(); if (navigator.vibrate) navigator.vibrate(60);
          const r = (await onCode(txt)) || {}; msg.textContent = r.msg || txt; msg.classList.toggle('bad', !!r.bad);
          if ((!multi || r.done) && !r.bad) return stop();
        }
      } catch (e) { /* khung hình lỗi: bỏ qua */ }
      timer = setTimeout(tick, 220);
    };
    tick();
  }
  /** Quét tem QR tủ → mở hồ sơ tủ. */
  function scanTu() {
    scanCode('Quét tem QR tủ', txt => { const m = String(txt).match(/#\/t\/([^/]+)\/([^?#\s]+)/);
      if (m && m[1] !== S.co.id) return { msg: 'Tủ của công ty ' + ((company(m[1]) || {}).ten || m[1]) + ' — đổi công ty để xem', bad: 1 };
      const z = serOf(txt); setTimeout(() => tuView(z), 0); return { msg: z }; });
  }
  /** Tủ chưa đạt KCS (hoặc chưa kiểm) — không chọn được khi xuất bán / xuất công trình. */
  function cabNoKCS(x) { const c = x && x.key && (S.data.cabinets || []).find(k => k.key === x.key && k.trangThai !== 'HUY'); return !!c && !(c.kcsDat === true || c.kcsDat === 'true'); }
  /** Serial nhập trùng: trong danh sách, hoặc đã có trên hệ thống (cùng mã). */
  function serDup(it, list) {
    list = list || []; const seen = {}, dup = [], has = [];
    list.forEach(z => { const u = z.toUpperCase(); if (seen[u]) dup.push(z); seen[u] = 1; if (it && (S.data.serials || []).some(x => x.maHang === it.maHang && String(x.serial).toUpperCase() === u)) has.push(z); });
    return (dup.length ? 'Trùng trong danh sách: ' + [...new Set(dup)].join(', ') + '. ' : '') + (has.length ? 'Đã có trên hệ thống: ' + has.join(', ') : '');
  }
  function voucherForm(loai, pre = {}) {
    const d = S.data, t = QStock.TYPES[loai], priced = t.cost === 'PRICE', kk = loai === 'KIEM_KE', out = t.dir < 0 || loai === 'CHUYEN_KHO' || loai === 'CHUYEN_SUA', nccIn = loai === 'NHAN_NCC';
    const khos = pre.sx ? activeKho(false).filter(w => w.maKho === pre.kho) : LOI_ONLY.includes(loai) ? activeKho(true) : ['TRA_NCC', 'XUAT_HUY', 'NHAN_NCC'].includes(loai) ? activeKho() : activeKho(false);
    const danhGia = loai === 'NHAN_NCC' || loai === 'CHUYEN_SUA', nhapK = t.dir > 0 || loai === 'CHUYEN_SUA';
    const opt = (rows, k, n, empty) => [['', empty], ...rows.filter(x => x.trangThai !== 'NGUNG').map(x => [x[k], x[n] + ' (' + x[k] + ')'])];
    const lines = (pre.lines && pre.lines.length ? pre.lines : [{}]).map(l => ({ ...l }));
    const custProj = loai === 'XUAT_BAN' || loai === 'XUAT_BH' || loai === 'KHACH_TRA' || loai === 'TRA_KHACH_SUA';   // trả khách hàng đã sửa: máy chủ lấy khách theo phiếu nhận lỗi
    const body = `
      <div class="grid2"><div>${fld('ngay', 'Ngày phiếu', pre.ngay || S.today, { req: 1, type: 'date', max: S.today })}</div>
        <div>${fld('kho', loai === 'CHUYEN_KHO' ? 'Từ kho' : loai === 'CHUYEN_SUA' ? 'Từ kho hàng lỗi' : nccIn ? 'Nhận về kho' : 'Kho', pre.kho || (khos[0] || {}).maKho || '', { opts: khos.map(w => [w.maKho, w.ten + (w.loai === 'HANG_LOI' ? ' (hàng lỗi)' : '')]) })}</div>
        ${loai === 'CHUYEN_KHO' ? `<div>${fld('khoDen', 'Đến kho', '', { opts: [['', '— Chọn kho đến —'], ...activeKho().map(w => [w.maKho, w.ten])] })}</div>` : ''}
        ${loai === 'CHUYEN_SUA' ? `<div>${fld('khoDen', 'Về kho thường', pre.khoDen || (activeKho(false)[0] || {}).maKho || '', { opts: activeKho(false).map(w => [w.maKho, w.ten]) })}</div>` : ''}
        ${['NHAP_MUA', 'TRA_NCC', 'GUI_NCC', 'NHAN_NCC'].includes(loai) ? `<div>${fld('maNCC', 'Nhà cung cấp', pre.maNCC || '', { opts: opt(d.suppliers, 'maNCC', 'ten', '— Chọn NCC —') })}</div>` : ''}
        ${custProj ? `<div>${fld('maKH', 'Khách hàng', pre.maKH || '', { opts: opt(d.customers || [], 'maKH', 'ten', '— Chọn khách —') })}</div>` : ''}
        ${custProj || loai === 'XUAT_CONG_TRINH' ? `<div>${fld('maCongTrinh', 'Công trình', pre.maCongTrinh || '', { opts: opt(d.projects || [], 'maCongTrinh', 'ten', '— Chọn công trình —') })}</div>` : ''}
        ${loai === 'KHACH_TRA' ? `<div>${fld('phieuGoc', 'Phiếu xuất gốc', pre.phieuGoc || '', { ro: !!pre.phieuGoc })}</div>` : ''}
        ${loai === 'NHAN_NCC' ? `<div>${fld('phieuGoc', 'Phiếu gửi NCC gốc', pre.phieuGoc || '', { ro: !!pre.phieuGoc, list: 'dlGocG' })}<datalist id="dlGocG">${(d.vouchers || []).filter(x => x.loai === 'GUI_NCC' && !x.daDao).slice(-200).reverse().map(x => `<option value="${esc(x.soPhieu)}">${esc(vnD(x.ngay))} · ${esc(supName(x.maNCC))}</option>`).join('')}</datalist></div>` : ''}
        ${loai === 'TRA_KHACH_SUA' ? `<div>${fld('phieuGoc', 'Phiếu nhận hàng lỗi của khách', pre.phieuGoc || '', { ro: !!pre.phieuGoc, list: 'dlGocL' })}<datalist id="dlGocL">${(d.vouchers || []).filter(x => x.loai === 'NHAP_HANG_LOI' && x.maKH && !x.daDao).slice(-200).reverse().map(x => `<option value="${esc(x.soPhieu)}">${esc(vnD(x.ngay))} · ${esc(custName(x.maKH))}</option>`).join('')}</datalist></div>` : ''}
        ${loai === 'TRA_NCC' ? `<div>${fld('phieuGoc', 'Phiếu nhập gốc (bắt buộc nếu trả từ kho thường)', pre.phieuGoc || '', { ro: !!pre.phieuGoc, list: 'dlGocN' })}<datalist id="dlGocN">${(d.vouchers || []).filter(x => ['NHAP_MUA', 'TON_DAU'].includes(x.loai) && !x.daDao).slice(-200).reverse().map(x => `<option value="${esc(x.soPhieu)}">${esc(vnD(x.ngay))} · ${esc(supName(x.maNCC))}</option>`).join('')}</datalist></div>` : ''}
        <div>${fld('nguoiGiaoNhan', t.dir > 0 ? 'Người giao hàng' : 'Người nhận hàng', '')}</div>
        <div>${fld('soCTGoc', 'Số chứng từ gốc (HĐ, hợp đồng…)', '')}</div><div>${fld('ngayCTGoc', 'Ngày chứng từ gốc', '', { type: 'date', max: S.today })}</div></div>
      ${fld('lyDo', kk ? 'Ghi chú kiểm kê' : loai === 'XUAT_HUY' ? 'Lý do huỷ (số biên bản huỷ / mất)' : loai === 'CHUYEN_SUA' ? 'Nội dung đã sửa' : 'Lý do ' + (nhapK ? 'nhập' : 'xuất'), pre.lyDo || '', { req: LYDO_BAT_BUOC.includes(loai) })}
      ${danhGia ? '<p class="mut" style="font-size:12.5px;margin:4px 0 0">Đơn giá đánh giá: giá trị thu hồi ước tính hoặc phí sửa đã trả (được để 0). Nhận về kho hàng lỗi luôn tính giá 0.</p>' : ''}
      ${loai === 'XUAT_HUY' ? '<p class="mut" style="font-size:12.5px;margin:4px 0 0">Giá trị huỷ tính theo giá vốn bình quân tại ngày phiếu (kho hàng lỗi: 0).</p>' : ''}
      <h3 style="font-size:14px;margin:16px 0 6px">Dòng hàng</h3>${nccIn ? '<p class="mut" style="font-size:12.5px;margin:0 0 6px">Hàng có serial: tích serial NCC sửa xong trả lại; NCC đổi hàng mới thì gõ serial mới cạnh serial đã gửi.</p>' : ''}
      <datalist id="dlItems">${d.items.filter(i => i.trangThai !== 'NGUNG').map(i => `<option value="${esc(i.maHang)}">${esc(i.ten)}</option>`).join('')}</datalist>
      <div id="vLines"></div><button class="btn" type="button" id="addLine">${ic('plus')} Thêm dòng</button>
      ${priced ? `<p style="text-align:right;margin:10px 0 0"><b>Tổng tiền: <span id="vSum">0 ₫</span></b>${isQT() ? '' : '<br><small class="mut">Sau khi lưu, đơn giá chỉ Quản trị xem lại được.</small>'}</p>` : ''}
      ${loai === 'KIEM_KE' ? '<p class="mut" style="font-size:12.5px">Số sổ sách lấy theo tồn hiện tại trên máy chủ lúc lưu; phiếu kiểm kê phải là phiếu mới nhất của mã.</p>' : ''}`;
    const draw = dlg => {
      const box = $('#vLines', dlg), kho = $('#f_kho', dlg).value;
      box.innerHTML = lines.map((l, i) => {
        const it = d.items.find(x => x.maHang === String(l.maHang || '').toUpperCase()), ser = it && (it.quanLySerial === true || it.quanLySerial === 'true');
        const units = it ? [[it.dvt, it.dvt], ...(d.units || []).filter(u => u.maHang === it.maHang).map(u => [u.dvtPhu, `${u.dvtPhu} (= ${num(u.heSo)} ${it.dvt})`])] : [['', 'ĐVT']];
        const pick = ser && out ? (S.data.serials || []).filter(x => x.maHang === it.maHang && x.kho === kho) : [];
        const gocS = l.gocSerials || [];
        return `<div class="vline card" data-line="${i + 1}" style="padding:10px 12px;margin-bottom:8px;box-shadow:none">
          <div class="vl-grid ${kk ? 'kk' : priced ? 'pr' : ''}">
            <div><label class="f" for="l_ma_${i}">Mã hàng ${i + 1}</label><input class="in" id="l_ma_${i}" data-i="${i}" data-f="maHang" list="dlItems" value="${esc(l.maHang || '')}" autocomplete="off" ${pre.phieuGoc ? 'readonly' : ''}><div class="${it || !l.maHang ? 'hint' : 'err'}">${it ? esc(it.ten) + (kk ? ' · sổ sách ' + num(tonQ(it.maHang, kho)) : out ? ' · tồn ' + num(tonQ(it.maHang, kho)) + ' ' + esc(it.dvt) : '') : l.maHang ? 'Không có mã này' : ''}</div></div>
            ${kk ? `<div><label class="f" for="l_tt_${i}">SL thực tế</label><input class="in" id="l_tt_${i}" data-i="${i}" data-f="slThucTe" inputmode="decimal" value="${esc(l.slThucTe ?? '')}"></div>`
              : `<div><label class="f" for="l_dvt_${i}">ĐVT</label><select class="in" id="l_dvt_${i}" data-i="${i}" data-f="dvt">${units.map(([k, n]) => `<option value="${esc(k)}" ${k === (l.dvt || (it && it.dvt)) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
                 <div><label class="f" for="l_sl_${i}">Số lượng</label><input class="in" id="l_sl_${i}" data-i="${i}" data-f="soLuongCT" inputmode="decimal" value="${esc(l.soLuongCT ?? '')}"></div>`}
            ${priced ? `<div><label class="f" for="l_gia_${i}">${danhGia ? 'Đơn giá đánh giá (₫)' : 'Đơn giá (₫)'}</label><input class="in" id="l_gia_${i}" data-i="${i}" data-f="gia" inputmode="numeric" value="${esc(l.gia ?? '')}"></div>` : ''}
            <div style="align-self:end"><button class="btn ghost iconbtn" type="button" data-del="${i}" aria-label="Xoá dòng ${i + 1}" ${lines.length < 2 ? 'disabled' : ''}>${ic('x')}</button></div>
          </div>
          ${ser && nccIn ? `<div class="serhead"><span class="f" style="margin:0">Serial nhận về · <b id="l_cnt_${i}">${(l.serials || []).length}</b> / ${gocS.length} đã gửi</span></div>
              <div class="serpick ncc" id="l_sp_${i}">${gocS.map(z => { const nw = (l.doiMap || {})[z] || ''; return `<div class="nccrow"><label class="chk" style="margin:0;min-height:48px"><input type="checkbox" data-nr="${i}" data-s="${esc(z)}" ${(l.serials || []).includes(z) ? 'checked' : ''} ${nw ? 'disabled' : ''}> <span class="mono">${esc(z)}</span> sửa xong</label><input class="in mono" data-nd="${i}" data-g="${esc(z)}" placeholder="hoặc serial mới NCC đổi" aria-label="Serial mới NCC đổi cho ${esc(z)}" value="${esc(nw)}" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>`; }).join('') || '<div class="err">Phiếu gốc không có serial mã này.</div>'}</div>`
          : ser ? (pick.length || gocS.length
            ? (() => { const all = gocS.length ? gocS.map(z => ({ serial: z })) : pick, sell = loai === 'XUAT_BAN' || loai === 'XUAT_CONG_TRINH';
                return `<div class="serhead"><span class="f" style="margin:0">Chọn serial · <b id="l_cnt_${i}">${(l.serials || []).length}</b><span id="l_tot_${i}">${l.soLuongCT ? ' / ' + esc(l.soLuongCT) : ''}</span> đã chọn</span>
                  ${all.length > 6 ? `<input class="in serf" id="l_sf_${i}" data-sf="${i}" type="search" placeholder="Lọc serial…" aria-label="Lọc serial dòng ${i + 1}" autocomplete="off">` : ''}
                  <button class="btn ghost" type="button" data-first="${i}">${l.soLuongCT ? 'Chọn ' + esc(l.soLuongCT) + ' đầu' : 'Chọn theo SL'}</button><button class="btn ghost" type="button" data-none="${i}">Bỏ chọn</button>${hasCam() ? `<button class="btn ghost" type="button" data-scanpick="${i}">${ic('search')} Quét</button>` : ''}</div>
                <div class="serpick" id="l_sp_${i}">${all.map(x => { const z = x.serial, nk = sell && cabNoKCS(x); return `<label class="chk${nk ? ' dis' : ''}" style="margin:0;min-height:48px" data-sv="${esc(QSearch.norm(z))}"><input type="checkbox" data-i="${i}" data-s="${esc(z)}" ${(l.serials || []).includes(z) ? 'checked' : ''} ${nk ? 'disabled' : ''}> <span class="mono">${esc(z)}</span>${nk ? ' <span class="tag bad">Chưa KCS</span>' : ''}</label>`; }).join('')}</div>`; })()
            : out && !kk ? `<div class="err">Không có serial nào của mã này trong kho đã chọn.</div>`
            : `<div class="serhead"><label class="f" for="l_sr_${i}" style="margin:0">Số serial (mỗi dòng 1 số) · <b id="l_cnt_${i}">${(l.serials || []).length}</b><span id="l_tot_${i}">${l.soLuongCT ? ' / ' + esc(l.soLuongCT) : ''}</span></label>${hasCam() ? `<button class="btn ghost" type="button" data-scan="${i}">${ic('search')} Quét serial</button>` : ''}</div>
               <textarea class="in" id="l_sr_${i}" data-i="${i}" data-f="serials" style="min-height:64px" autocapitalize="characters" spellcheck="false">${esc((l.serials || []).join('\n'))}</textarea><div class="err" id="l_dup_${i}" role="status">${serDup(it, l.serials)}</div>`) : ''}
        </div>`;
      }).join('');
      $$('[data-f]', box).forEach(x => x.onchange = x.oninput = () => {
        const l = lines[+x.dataset.i]; let v = x.value;
        if (x.dataset.f === 'serials') v = v.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        l[x.dataset.f] = v; if (x.dataset.f === 'gia') l.gia = String(v).replace(/[.\s,₫]/g, '');
        if (x.dataset.f === 'serials') { const e = $('#l_dup_' + x.dataset.i, dlg); if (e) e.textContent = serDup(itemOf(String(l.maHang || '').toUpperCase()), v); }
        if (x.dataset.f === 'serials' || x.dataset.f === 'soLuongCT') serCount(+x.dataset.i);
        sum(dlg);
      });
      // bộ đếm "đã chọn / SL" + nhãn nút cập nhật khi gõ số lượng; lệch số lượng thì tô màu
      const serCount = i => { const l = lines[i], n = (l.serials || []).length, c = $('#l_cnt_' + i, box), t = $('#l_tot_' + i, box), b = $(`[data-first="${i}"]`, box);
        if (c) { c.textContent = n; c.classList.toggle('bad-ink', !!l.soLuongCT && n !== Number(l.soLuongCT)); } if (t) t.textContent = l.soLuongCT ? ' / ' + l.soLuongCT : ''; if (b) b.textContent = l.soLuongCT ? 'Chọn ' + l.soLuongCT + ' đầu' : 'Chọn theo SL'; };
      const pickSync = i => { const l = lines[i]; l.serials = $$(`#l_sp_${i} input:checked`, box).map(c => c.dataset.s);
        if (l.serials.length && (!l.soLuongCT || out)) { l.soLuongCT = String(l.serials.length); const q = $('#l_sl_' + i, box); if (q) q.value = l.soLuongCT; }   // bỏ chọn hết: giữ số lượng đã nhập
        serCount(i); sum(dlg); };
      $$('[data-s]', box).forEach(c => { if (!c.dataset.nr) c.onchange = () => pickSync(+c.dataset.i); });   // không vẽ lại cả khối dòng hàng
      const nccSync = i => { const l = lines[i], dm = {}; $$(`[data-nd="${i}"]`, box).forEach(x => { const v = x.value.trim().toUpperCase(); if (v) dm[x.dataset.g] = v; const c = $(`[data-nr="${i}"][data-s="${CSS.escape(x.dataset.g)}"]`, box); if (c) { c.disabled = !!v; if (v) c.checked = false; } });
        l.doiMap = dm; l.serialsDoi = Object.keys(dm); l.serials = $$(`[data-nr="${i}"]:checked`, box).map(c => c.dataset.s).concat(Object.values(dm));
        l.soLuongCT = l.serials.length ? String(l.serials.length) : ''; const q = $('#l_sl_' + i, box); if (q) q.value = l.soLuongCT; const c = $('#l_cnt_' + i, box); if (c) c.textContent = l.serials.length; sum(dlg); };
      $$('[data-nr]', box).forEach(c => c.onchange = () => nccSync(+c.dataset.nr)); $$('[data-nd]', box).forEach(x => x.oninput = () => nccSync(+x.dataset.nd));
      $$('[data-sf]', box).forEach(f => f.oninput = () => { const q = QSearch.norm(f.value); $$(`#l_sp_${f.dataset.sf} [data-sv]`, box).forEach(x => x.hidden = !!q && !x.dataset.sv.includes(q)); });
      $$('[data-first]', box).forEach(b => b.onclick = () => { const i = +b.dataset.first, n = Number(lines[i].soLuongCT) || 0;
        if (!(n > 0)) { const q = $('#l_sl_' + i, box); toast('Nhập số lượng trước'); if (q) q.focus(); return; }
        const rows = $$(`#l_sp_${i} [data-sv]`, box); let k = rows.filter(x => x.hidden && $('input', x).checked).length;   // serial đang bị ô lọc ẩn mà đã chọn: giữ nguyên, tính vào N
        rows.forEach(x => { if (x.hidden) return; const c = $('input', x); if (c.disabled) { c.checked = false; return; } c.checked = k < n; if (c.checked) k++; }); pickSync(i); });
      $$('[data-none]', box).forEach(b => b.onclick = () => { const i = +b.dataset.none; $$(`#l_sp_${i} input`, box).forEach(c => c.checked = false); pickSync(i); });
      $$('[data-scanpick]', box).forEach(b => b.onclick = () => { const i = +b.dataset.scanpick; scanCode('Quét serial để chọn', txt => { const z = serOf(txt), c = $$(`#l_sp_${i} input`, box).find(x => x.dataset.s.toUpperCase() === z.toUpperCase());
        if (!c) return { msg: z + ': không có trong kho đã chọn', bad: 1 }; if (c.disabled) return { msg: z + ': tủ chưa đạt KCS', bad: 1 }; if (c.checked) return { msg: z + ': đã chọn rồi', bad: 1 }; c.checked = true; pickSync(i); return { msg: z + ' ✓ (' + lines[i].serials.length + ')' }; }, true); });
      $$('[data-scan]', box).forEach(b => b.onclick = () => { const i = +b.dataset.scan, ta = $('#l_sr_' + i, box); scanCode('Quét serial nhập kho', txt => { const z = serOf(txt), cur = ta.value.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
        if (cur.some(x => x.toUpperCase() === z.toUpperCase())) return { msg: z + ': đã có trong danh sách', bad: 1 };
        cur.push(z); ta.value = cur.join('\n'); ta.dispatchEvent(new Event('input')); const full = Number(lines[i].soLuongCT) > 0 && cur.length >= Number(lines[i].soLuongCT);
        return { msg: z + ' ✓ (' + cur.length + (lines[i].soLuongCT ? '/' + lines[i].soLuongCT : '') + ')', done: full }; }, true); });
      $$('[data-del]', box).forEach(b => b.onclick = () => { lines.splice(+b.dataset.del, 1); draw(dlg); });
      sum(dlg);
    };
    const sum = dlg => { const s = $('#vSum', dlg); if (!s) return; let tot = 0; lines.forEach(l => { const q = Number(l.soLuongCT), g = Number(l.gia); if (q > 0 && g >= 0) tot += Math.round(q * g); }); s.textContent = money(tot); };
    dialog(pre.sx ? 'Xuất linh kiện — lệnh ' + esc(pre.sx) : LOAI[loai] + ' — phiếu mới', body, async (v, dlg) => {
      const clean = lines.filter(l => String(l.maHang || '').trim() && !(l.dongGoc && (l.soLuongCT === '' || l.soLuongCT === undefined) && !(l.serials || []).length));   // dòng lấy từ phiếu gốc mà để trống SL = không trả dòng đó
      if (!clean.length) { dlgMsg(dlg, 'Phiếu chưa có dòng hàng'); return false; }
      const vh = { ...v, loai, phieuGoc: v.phieuGoc || pre.phieuGoc || '', lines: clean.map(l => ({ maHang: String(l.maHang).trim().toUpperCase(), dvt: l.dvt, soLuongCT: l.soLuongCT === '' ? '' : Number(String(l.soLuongCT).replace(',', '.')), gia: l.gia === undefined ? undefined : Number(l.gia), slThucTe: l.slThucTe === undefined ? undefined : Number(String(l.slThucTe).replace(',', '.')), dongGoc: l.dongGoc, serials: l.serials || [], serialsDoi: l.serialsDoi && l.serialsDoi.length ? l.serialsDoi : undefined })) };
      const r = QValidate.voucherHead(vh); if (!r.ok) { showErrors(dlg, r.errors); dlgMsg(dlg, Object.values(r.errors)[0]); return false; }
      if (pre.sx) { SX.stale = true; return submitV(dlg, 'lsx.xuatSX', { soLSX: pre.sx, ngay: vh.ngay, lyDo: vh.lyDo, nguoiGiaoNhan: vh.nguoiGiaoNhan, lines: vh.lines }, so => 'Đã xuất linh kiện, phiếu ' + so); }
      return submitV(dlg, 'voucher.create', { voucher: vh }, so => 'Đã lưu phiếu ' + so);
    }, dlg => {
      dlg.classList.add('wide');
      const start = JSON.stringify(lines); dlg._guard = () => dlg._dirty || JSON.stringify(lines) !== start;
      dlg.addEventListener('keydown', e => {   // Enter trong dòng hàng: sang ô kế tiếp (không lưu vội); Ctrl+Enter = Lưu phiếu
        if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || !e.target.closest || !e.target.closest('#vLines')) return;
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); $('form', dlg).requestSubmit(); return; }   // Ctrl+Enter = Lưu phiếu
        e.preventDefault(); const ins = $$('#vLines input:not([type=checkbox]),#vLines select', dlg), i = ins.indexOf(e.target);
        if (i >= 0 && i < ins.length - 1) ins[i + 1].focus(); else $('#addLine', dlg).click();
      });
      $('#addLine', dlg).onclick = () => { lines.push({}); draw(dlg); const n = $(`#l_ma_${lines.length - 1}`, dlg); if (n) n.focus(); };
      $('#f_kho', dlg).onchange = () => draw(dlg);
      $('#vLines', dlg).addEventListener('change', e => {   // đổi mã hàng → vẽ lại dòng (ĐVT, serial); hoãn để không đụng sự kiện blur, giữ con trỏ ở ô kế tiếp
        if (!(e.target.dataset && e.target.dataset.f === 'maHang')) return;
        setTimeout(() => { const nx = document.activeElement && document.activeElement.id; draw(dlg); const f = nx && dlg.querySelector('#' + CSS.escape(nx)); if (f) f.focus(); }, 0);
      });
      draw(dlg);
    }, 'Lưu phiếu');
  }

  // ---------- in chứng từ (đủ nội dung Điều 16 Luật Kế toán 88/2015) ----------
  async function printVoucher(p, L) {
    let base = p, sign = 1;
    if (p.loai === 'DAO') {   // phiếu đảo: in theo mẫu của phiếu gốc, số lượng & tiền ghi ÂM (phương pháp ghi số âm)
      let g = (S.data.vouchers || []).find(x => x.soPhieu === p.phieuGoc);
      if (!g) { const r = await call('voucher.get', { soPhieu: p.phieuGoc }, 2); g = r.ok ? r.data.phieu : null; }
      if (!g) return toast('Không đọc được phiếu gốc ' + p.phieuGoc);
      base = { ...p, loai: g.loai, maNCC: g.maNCC, maKH: g.maKH, maCongTrinh: g.maCongTrinh, khoDen: g.khoDen, soLSX: g.soLSX, ngayGoc: g.ngay }; sign = -1;
    }
    const t = QStock.TYPES[base.loai] || {}, kk = base.loai === 'KIEM_KE', ck = base.loai === 'CHUYEN_KHO', cs = base.loai === 'CHUYEN_SUA', nhapKho = t.dir > 0 || cs, priced = t.cost === 'PRICE';
    const title = (kk ? 'BIÊN BẢN KIỂM KÊ VẬT TƯ, HÀNG HÓA' : ck ? 'PHIẾU ĐIỀU CHUYỂN KHO (NỘI BỘ)' : nhapKho ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO') + (sign < 0 ? ' (ĐẢO)' : '');
    const mau = kk ? 'Mẫu số 05 - VT' : nhapKho ? 'Mẫu số 01 - VT' : 'Mẫu số 02 - VT';
    const showMoney = isQT(), sg = n => n === '' || n === undefined || n === null ? '' : sign * Number(n);
    const amt = l => (Number(priced ? l.thanhTien : l.giaTriKho) || 0) + (Number(l.chenhLechGV) || 0), tot = sign * L.reduce((a, l) => a + amt(l), 0);   // trả NCC: thành tiền = giá gốc (khớp công nợ)
    const adjTot = sign * L.reduce((a, l) => a + (Number(l.chenhLechGV) || 0), 0);
    const d0 = p.ngay.split('-'), ngay = `Ngày ${d0[2]} tháng ${d0[1]} năm ${d0[0]}`;
    const sxP = ['XUAT_SX', 'NHAP_TP', 'NHAP_LAI_SX'].includes(base.loai);   // phiếu sản xuất: người giao/nhận là bộ phận sản xuất, không in khách hàng
    const partner = sxP ? null : base.maNCC ? (d => d && { ten: d.ten, dc: d.diaChi, mst: d.mst })((S.data.suppliers || []).find(x => x.maNCC === base.maNCC))
      : base.maKH ? (d => d && { ten: d.ten, dc: d.diaChi, mst: d.mst })((S.data.customers || []).find(x => x.maKH === base.maKH)) : null;
    const price = l => priced ? Number(l.donGia) : (amt(l) && Number(l.soLuong) ? amt(l) / Number(l.soLuong) : '');
    const p2 = n => n === '' ? '' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    const rows = L.map((l, i) => { const it = itemOf(l.maHang);
      if (kk) { const dd = Number(l.slThucTe) - Number(l.slSoSach), u = price(l) || Number(it.giaVon) || '';
        return `<tr><td>${i + 1}</td><td>${esc(it.ten)}</td><td>${esc(l.maHang)}</td><td>${esc(it.dvt)}</td><td class="n">${showMoney ? p2(u) : ''}</td><td class="n">${num(l.slSoSach)}</td><td class="n">${num(l.slThucTe)}</td><td class="n">${dd > 0 ? num(sg(dd)) : ''}</td><td class="n">${dd < 0 ? num(sg(-dd)) : ''}</td><td class="n">${showMoney ? num(sg(l.giaTriKho)) : ''}</td></tr>`; }
      const ct = l.dvt && l.dvt !== it.dvt ? `${num(sg(l.soLuongCT))} ${esc(l.dvt)}` : num(sg(l.soLuongCT !== '' && l.soLuongCT !== undefined ? l.soLuongCT : l.soLuong));
      return `<tr><td>${i + 1}</td><td>${esc(it.ten)}${l.serials && l.serials.length ? `<br><small>Serial: ${l.serials.map(esc).join(', ')}</small>` : ''}</td><td>${esc(l.maHang)}</td><td>${esc(it.dvt)}</td><td class="n">${ct}</td><td class="n">${num(sg(l.soLuong))}</td><td class="n">${showMoney ? p2(price(l)) : ''}</td><td class="n">${showMoney ? num(sg(amt(l))) : ''}</td></tr>`; }).join('');
    const co = S.co, host = document.createElement('div'); host.id = 'printArea';
    host.innerHTML = `<div class="pv"><div class="pv-h"><div><b>${esc(co.tenDay || co.ten)}</b><br>${esc(co.diaChi || '')}${co.mst ? '<br>MST: ' + esc(co.mst) : ''}<br>Bộ phận: Kho</div><div class="pv-r"><b>${mau}</b></div></div>
      <h1>${title}</h1><p class="c">${ngay}<br>Số: <b>${esc(p.soPhieu)}</b></p>
      ${sign < 0 ? `<p><b>Đảo chứng từ số ${esc(p.phieuGoc)} ngày ${esc(vnD(p.ngayCTGoc || base.ngayGoc || ''))}</b> — lý do: ${esc(p.lyDo || '')}${p.hieuLuc === 'GOC' ? `<br><b>Hạch toán vào ngày ${esc(vnD(p.ngayCTGoc || base.ngayGoc || ''))} (ngày phiếu gốc)</b>` : ''}</p>` : ''}
      ${kk ? `<p>- Thời điểm kiểm kê: ${ngay.toLowerCase()} · Kho: ${esc(khoName(base.kho))}<br>- Ban kiểm kê: ……………………………………………………………<br>- ${esc(p.lyDo || 'Đã kiểm kê các mặt hàng dưới đây')}</p>`
        : `<p>- Họ và tên người ${nhapKho ? 'giao' : 'nhận'}: ${esc(p.nguoiGiaoNhan || '……………………')}${partner ? `<br>- Đơn vị: ${esc(partner.ten)}${partner.mst ? ' · MST ' + esc(partner.mst) : ''}${partner.dc ? '<br>- Địa chỉ: ' + esc(partner.dc) : ''}` : ''}
          <br>- Lý do ${nhapKho ? 'nhập' : 'xuất'} kho: ${esc(sign < 0 ? LOAI[base.loai] + ' (đảo)' : (p.lyDo || LOAI[base.loai]))}${base.maCongTrinh && !sxP ? ' — công trình ' + esc(projName(base.maCongTrinh)) : ''}
          ${base.soLSX ? '<br>- Lệnh sản xuất: <b>' + esc(base.soLSX) + '</b> (bộ phận sản xuất)' : ''}<br>- Theo chứng từ số: ${esc((sign < 0 ? '' : p.soCTGoc) || '……')} ngày ${esc((sign < 0 ? '' : p.ngayCTGoc) || '……')}<br>- ${ck || cs ? 'Từ kho: ' + esc(khoName(base.kho)) + ' → đến kho: ' + esc(khoName(base.khoDen)) : (nhapKho ? 'Nhập' : 'Xuất') + ' tại kho: ' + esc(khoName(base.kho))}</p>`}
      <table class="pv-t"><thead>${kk ? '<tr><th rowspan="2">STT</th><th rowspan="2">Tên vật tư, hàng hóa</th><th rowspan="2">Mã số</th><th rowspan="2">ĐVT</th><th rowspan="2">Đơn giá</th><th colspan="2">Số lượng</th><th colspan="2">Chênh lệch</th><th rowspan="2">Giá trị chênh lệch</th></tr><tr><th>Theo sổ sách</th><th>Theo kiểm kê</th><th>Thừa</th><th>Thiếu</th></tr>'
        : `<tr><th rowspan="2">STT</th><th rowspan="2">Tên, nhãn hiệu, quy cách vật tư, hàng hóa</th><th rowspan="2">Mã số</th><th rowspan="2">ĐVT</th><th colspan="2">Số lượng</th><th rowspan="2">Đơn giá</th><th rowspan="2">Thành tiền</th></tr><tr><th>Theo chứng từ</th><th>Thực ${nhapKho ? 'nhập' : 'xuất'}</th></tr>`}</thead>
        <tbody>${rows}<tr><td></td><td><b>Cộng</b></td><td></td><td></td><td></td><td></td><td></td>${kk ? '<td></td><td></td>' : ''}<td class="n"><b>${showMoney ? num(tot) : ''}</b></td></tr></tbody></table>
      ${kk ? '' : `<p>- Tổng số tiền (viết bằng chữ): ${showMoney ? '<i>' + esc(QWords.money(Math.abs(tot))) + (tot < 0 ? ' (ghi âm)' : '') + '</i>' : '……………………………………………'}${showMoney && adjTot ? `<br>- Trong đó chênh lệch giá vốn (điều chỉnh TK 632): ${num(adjTot)} đ` : ''}<br>- Số chứng từ gốc kèm theo: ${esc((sign < 0 ? p.phieuGoc : p.soCTGoc) || '……')}</p>`}
      <p class="pv-date">${ngay}</p>
      <div class="pv-sign">${(kk ? ['Thủ kho', 'Kế toán trưởng', 'Trưởng ban kiểm kê', 'Giám đốc'] : ['Người lập phiếu', nhapKho ? 'Người giao hàng' : 'Người nhận hàng', 'Thủ kho', 'Kế toán trưởng', 'Giám đốc']).map(x => `<div><b>${x}</b><br><i>(Ký, họ tên)</i></div>`).join('')}</div>
      <p class="pv-foot">In từ QLHH v${VER} · người lập ${esc(p.nguoiTao)}${showMoney ? '' : ' · bản in không gồm đơn giá (vai trò ' + esc(ROLE[S.user.vaiTro]) + ')'}</p></div>`;
    document.body.appendChild(host); document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); host.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
  }

  // ---------- kho, khoá sổ, tính lại (QT) ----------
  function khoAdmin() {
    const d = S.data;
    dialog('Kho & khoá sổ', `<div class="list">${(d.warehouses || []).map(w => `<div class="it" data-w="${esc(w.maKho)}" role="button" tabindex="0"><div><div class="mono">${esc(w.maKho)}</div><b>${esc(w.ten)}</b>${w.loai === 'HANG_LOI' ? ' <span class="tag">Hàng lỗi — không tính giá vốn</span>' : ''}</div>${w.trangThai === 'NGUNG' ? '<span class="tag stop">Ngừng</span>' : ''}</div>`).join('')}</div>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" type="button" id="wAdd">${ic('plus')} Thêm kho</button><button class="btn" type="button" id="lockB">Khoá sổ${d.config && d.config.ngayKhoaSo ? ' (đang: ' + esc(d.config.ngayKhoaSo) + ')' : ''}</button><button class="btn" type="button" id="rbB">Tính lại tồn & giá vốn</button><button class="btn" type="button" id="nxtB">Báo cáo N-X-T</button></div>`, null, dlg => {
      $$('[data-w]', dlg).forEach(r => r.onclick = () => { dlg.close(); warehouseForm(d.warehouses.find(w => w.maKho === r.dataset.w)); });
      $('#wAdd', dlg).onclick = () => { dlg.close(); warehouseForm(); };
      $('#lockB', dlg).onclick = () => { dlg.close(); const cur = (d.config || {}).ngayKhoaSo || '';
        dialog('Khoá sổ', `<p>Không lập, đảo phiếu có ngày đến hết ngày khoá; giá vốn kỳ đã khoá không bị tính lại. Khi khoá, hệ thống tính lại các phiếu kỳ còn mở rồi lưu số dư chốt (từng mã hàng, dở dang từng lệnh sản xuất).</p>${cur ? `<p class="mut">Đang khoá đến hết ngày <b>${esc(vnD(cur))}</b>. Khoá chỉ đi tiến; lùi ngày khoá phải ghi lý do (ít nhất 10 ký tự, ghi rõ ai yêu cầu) và được lưu lịch sử.</p>` : ''}${fld('ngay', 'Khoá sổ đến hết ngày', cur, { type: 'date' })}${fld('lyDo', 'Lý do (khi lùi ngày khoá / số dư khác lần chốt trước)', '')}`,
          async (v, x) => { if (S.offline) { dlgMsg(x, 'Đang ngoại tuyến — chưa lưu được'); return false; } const r = await write('period.lock', { ngay: v.ngay, lyDo: v.lyDo, requestId: x._rid || (x._rid = rid()) }); if (!r.ok) { if (r.fields && !Array.isArray(r.fields)) showErrors(x, r.fields); dlgMsg(x, 'Chưa lưu: ' + (r.error || r.code)); return false; }
            const z = r.data; toast((z.ngayKhoaSo ? 'Đã khoá sổ đến ' + vnD(z.ngayKhoaSo) : 'Đã mở khoá sổ') + (z.tinhLai ? ' · tính lại ' + z.tinhLai + ' dòng kỳ mở' : '') + (z.dangMoLai ? ' · kỳ đến ' + vnD(z.dangMoLai) + ' vẫn đang mở lại' : ''));
            if (z.daoGoc && z.daoGoc.length) setTimeout(() => dialog('Lưu ý phiếu đảo', `<p>${z.daoGoc.length} phiếu đảo ghi ngày sau kỳ khoá nhưng hạch toán vào ngày phiếu gốc (trong kỳ). Kế toán ghi âm vào đúng kỳ của phiếu gốc:</p><ul>${z.daoGoc.map(d => `<li>${esc(d.soPhieu)} (${esc(vnD(d.ngay))}) đảo ${esc(d.phieuGoc)} — hạch toán ngày ${esc(vnD(d.ngayGoc))}</li>`).join('')}</ul>`, async () => true, null, 'Đã hiểu'), 50);
            sync(); return true; }, null, 'Lưu'); };
      $('#rbB', dlg).onclick = async e => { const b = e.currentTarget; b.classList.add('busy'); const r = await write('stock.rebuild', {}); b.classList.remove('busy'); if (!r.ok) return toast('Lỗi: ' + (r.error || r.code));
        if (r.data.chanKyKhoa) { const l = r.data.lechSoDu; return dialog('Chưa tính lại', `<p>Kỳ đã khoá sổ đến <b>${esc(vnD(r.data.ngayKhoaSo))}</b> tính lại ra <b>${l.length}</b> số dư khác lúc khoá (thường do sửa tay trên Google Sheet). Hệ thống không ghi gì.</p><div class="tbl"><table><tr><th>Ngày khoá</th><th>Mã</th><th>Kho</th><th>Lúc khoá</th><th>Tính lại</th></tr>${l.map(z => { const dp = z.kho === 'Dòng phiếu', tien = z.kho === '*' || z.kho === '154', v = o => dp ? '' : (z.kho === '154' ? '' : esc(String(o.soLuong))) + (tien ? (z.kho === '154' ? '' : ' · ') + esc(money(o.giaTri)) : '');
          return `<tr><td>${esc(vnD(z.ngayKhoa || ''))}</td><td>${esc(z.maHang)}</td><td>${esc(z.kho === '*' ? 'Tổng' : z.kho === '154' ? 'Dở dang 154' : z.kho)}</td><td>${dp ? esc(z.luocKhoa.soLuong + ' dòng') : v(z.luocKhoa)}</td><td>${dp ? 'nội dung khác' + (z.tinhLai.soLuong !== z.luocKhoa.soLuong ? ' · ' + esc(z.tinhLai.soLuong + ' dòng') : '') : v(z.tinhLai)}</td></tr>`; }).join('')}</table></div><p class="mut">Đối chiếu với sổ kế toán và lịch sử sửa của Google Sheet. Nếu số tính lại là đúng: lùi ngày khoá về trước ngày có chênh lệch (ghi lý do), tính lại, rồi khoá lại.</p>`, async () => true, null, 'Đóng'); }
        toast(`Đã tính lại ${r.data.ma} mã · sửa ${r.data.tinhLai} dòng${r.data.loiTonAm.length ? ' · ⚠ ' + r.data.loiTonAm.length + ' chỗ tồn âm' : ''}${r.data.lechKyKhoa.length ? ' · ⚠ ' + r.data.lechKyKhoa.length + ' dòng kỳ đã khoá khác' : ''}`); sync(); };
      $('#nxtB', dlg).onclick = () => { dlg.close(); location.hash = '#/baocao'; };
    });
  }
  function warehouseForm(w) {
    const isNew = !w; w = w || { loai: 'THUONG', trangThai: 'HOAT_DONG' };
    dialog(isNew ? 'Thêm kho' : 'Sửa kho ' + esc(w.maKho), `<div class="grid2"><div>${fld('maKho', 'Mã kho', w.maKho, { req: 1, ro: !isNew })}</div><div>${fld('ten', 'Tên kho', w.ten, { req: 1 })}</div></div>${fld('diaChi', 'Địa chỉ', w.diaChi)}
      <div class="grid2"><div>${fld('loai', 'Loại', w.loai, { opts: [['THUONG', 'Kho thường'], ['HANG_LOI', 'Kho hàng lỗi (không tính giá vốn)']] })}</div><div>${fld('trangThai', 'Trạng thái', w.trangThai, { opts: [['HOAT_DONG', 'Hoạt động'], ['NGUNG', 'Ngừng']] })}</div></div>`,
      async (v, d) => { const r = QValidate.warehouse(v); if (!r.ok) { showErrors(d, r.errors); return false; } return submit(d, 'warehouse.upsert', { isNew, warehouse: r.value }, 'Đã lưu kho ' + r.value.maKho); });
  }

  // ---------- khách hàng & công trình ----------
  function viewCustomers(m) {
    const d = S.data, cs = d.customers || [], ps = d.projects || [];
    m.innerHTML = header('Khách hàng & công trình', canEdit() ? `<button class="btn pri" id="addKH">${ic('plus')}<span>Thêm khách</span></button><button class="btn" id="addCT">${ic('plus')}<span>Thêm công trình</span></button>` : '', false, canEdit() ? 'addKHM' : '') +
      `<div class="card list">${cs.length ? cs.map(c => `<div class="it" data-kh="${esc(c.maKH)}" role="button" tabindex="0"><div><div class="mono">${esc(c.maKH)}</div><b>${esc(c.ten)}</b><br><small class="mut">${esc([c.mst && 'MST ' + c.mst, c.dienThoai, c.loaiKH === 'CA_NHAN' ? 'Cá nhân' : 'Doanh nghiệp'].filter(Boolean).join(' · '))}</small>
          ${ps.filter(p => p.maKH === c.maKH).map(p => `<div class="ctrow" data-ct="${esc(p.maCongTrinh)}" role="button" tabindex="0">↳ <span class="mono">${esc(p.maCongTrinh)}</span> ${esc(p.ten)}</div>`).join('')}</div>${c.trangThai === 'NGUNG' ? '<span class="tag stop">Ngừng</span>' : ''}</div>`).join('') : '<div class="empty">Chưa có khách hàng.</div>'}
        ${ps.filter(p => !p.maKH).map(p => `<div class="it" data-ct="${esc(p.maCongTrinh)}" role="button" tabindex="0"><div><div class="mono">${esc(p.maCongTrinh)}</div><b>${esc(p.ten)}</b><br><small class="mut">Công trình chưa gắn khách</small></div></div>`).join('')}</div>`;
    $$('#addKH,#addKHM').forEach(b => b.onclick = () => customerForm());
    const a = $('#addCT'); if (a) a.onclick = () => projectForm();
    $$('[data-ct]').forEach(r => r.onclick = e => { e.stopPropagation(); canEdit() && projectForm(ps.find(p => p.maCongTrinh === r.dataset.ct)); });
    $$('[data-kh]').forEach(r => r.onclick = () => canEdit() && customerForm(cs.find(c => c.maKH === r.dataset.kh)));
  }
  function customerForm(c) {
    const isNew = !c; c = c || { loaiKH: 'DN', cheDoBHThayThe: 'TINH_LAI' };
    dialog(isNew ? 'Thêm khách hàng' : 'Sửa ' + esc(c.maKH), `<div class="grid2"><div>${fld('maKH', 'Mã khách', c.maKH, { req: 1, ro: !isNew })}</div><div>${fld('loaiKH', 'Loại', c.loaiKH, { opts: [['DN', 'Doanh nghiệp'], ['CA_NHAN', 'Cá nhân']] })}</div></div>
      ${fld('ten', 'Tên khách hàng', c.ten, { req: 1 })}<div class="grid2"><div>${fld('mst', 'Mã số thuế', c.mst, { im: 'numeric' })}</div><div>${fld('dienThoai', 'Điện thoại', c.dienThoai, { type: 'tel' })}</div></div>
      ${fld('diaChi', 'Địa chỉ', c.diaChi)}<div class="grid2"><div>${fld('lienHe', 'Người liên hệ', c.lienHe)}</div><div>${fld('email', 'Email', c.email, { type: 'email' })}</div></div>
      ${fld('cheDoBHThayThe', 'Bảo hành thiết bị thay thế', c.cheDoBHThayThe, { opts: [['TINH_LAI', 'Tính lại từ ngày thay'], ['CON_LAI', 'Hưởng thời hạn còn lại (chỉ DN, theo hợp đồng)']] })}
      ${isNew ? '' : fld('trangThai', 'Trạng thái', c.trangThai || 'HOAT_DONG', { opts: [['HOAT_DONG', 'Đang giao dịch'], ['NGUNG', 'Ngừng']] })}`,
      async (v, d) => { const r = QValidate.customer(v); if (!r.ok) { showErrors(d, r.errors); return false; } return submit(d, 'customer.upsert', { isNew, customer: r.value }, 'Đã lưu ' + r.value.maKH); });
  }
  function projectForm(p) {
    const isNew = !p; p = p || {};
    dialog(isNew ? 'Thêm công trình' : 'Sửa ' + esc(p.maCongTrinh), `<div class="grid2"><div>${fld('maCongTrinh', 'Mã công trình', p.maCongTrinh, { req: 1, ro: !isNew })}</div><div>${fld('maKH', 'Khách hàng', p.maKH || '', { opts: [['', '— Không —'], ...(S.data.customers || []).map(c => [c.maKH, c.ten])] })}</div></div>
      ${fld('ten', 'Tên công trình', p.ten, { req: 1 })}${fld('diaChi', 'Địa điểm', p.diaChi)}${fld('chuDauTu', 'Chủ đầu tư', p.chuDauTu)}
      <div class="grid2"><div>${fld('ngayBatDau', 'Ngày bắt đầu', p.ngayBatDau, { type: 'date' })}</div><div>${fld('ngayNghiemThu', 'Ngày nghiệm thu', p.ngayNghiemThu, { type: 'date' })}</div></div>`,
      async (v, d) => { const r = QValidate.project(v); if (!r.ok) { showErrors(d, r.errors); return false; } return submit(d, 'project.upsert', { isNew, project: r.value }, 'Đã lưu ' + r.value.maCongTrinh); });
  }
  function unitForm(it) {
    dialog('Quy đổi ĐVT — ' + esc(it.maHang), `<p class="mut">ĐVT chính: <b>${esc(it.dvt)}</b>. Ví dụ cáp: 1 cuộn = 500 m.</p><div class="grid2"><div>${fld('dvtPhu', 'ĐVT phụ', '', { req: 1 })}</div><div>${fld('heSo', 'Bằng bao nhiêu ' + esc(it.dvt), '', { req: 1, im: 'decimal' })}</div></div>`,
      async (v, d) => { v.maHang = it.maHang; v.heSo = String(v.heSo).replace(',', '.'); const r = QValidate.unit(v); if (!r.ok) { showErrors(d, r.errors); return false; } return submit(d, 'unit.upsert', { unit: r.value }, 'Đã lưu quy đổi'); });
  }

  // ---------- báo cáo N-X-T (QT) ----------
  const RP = { from: '', to: '', rows: null };
  function viewReport(m) {
    if (!RP.from) { RP.from = S.today.slice(0, 8) + '01'; RP.to = S.today; }
    m.innerHTML = header('Báo cáo Nhập – Xuất – Tồn') + `<div class="card" style="padding:14px 16px;margin-bottom:12px"><div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));align-items:end">
      <div>${fld('rfrom', 'Từ ngày', RP.from, { type: 'date' })}</div><div>${fld('rto', 'Đến ngày', RP.to, { type: 'date' })}</div>
      <div style="display:flex;gap:8px;padding-bottom:16px"><button class="btn pri" id="rRun">Xem báo cáo</button><button class="btn" id="rXls" ${RP.rows ? '' : 'disabled'}>${ic('dl')}Excel</button></div></div>
      <p class="mut" style="margin:0">Giá trị theo giá vốn bình quân gia quyền toàn công ty, không gồm kho hàng lỗi. Dùng đối chiếu sổ kế toán (S07/S08).</p></div>
      <div class="card"><div class="tbl" id="rOut">${RP.rows ? reportTable() : '<div class="empty">Chọn kỳ rồi bấm Xem báo cáo.</div>'}</div></div>`;
    $('#rRun').onclick = async e => {
      RP.from = $('#f_rfrom').value; RP.to = $('#f_rto').value; const b = e.currentTarget; b.classList.add('busy');
      const r = await call('report.nxt', { from: RP.from, to: RP.to }, 3); b.classList.remove('busy');
      if (!r.ok) return toast('Lỗi: ' + (r.error || r.code)); RP.rows = r.data.rows; viewReport(m);
    };
    $('#rXls').onclick = () => { const ks = [...new Set(RP.rows.flatMap(r => Object.keys(r.theoLoai || {})))].sort(), ten = k => LOAI[k] || { KIEM_KE_THUA: 'Kiểm kê thừa', KIEM_KE_THIEU: 'Kiểm kê thiếu' }[k] || k;
      exportRows(`NXT_${RP.from}_${RP.to}`, RP.rows.map(r => ({ 'Mã hàng': r.maHang, 'Tên hàng': r.ten, 'ĐVT': r.dvt, 'Tồn đầu SL': r.dauQ, 'Tồn đầu GT': r.dauV, 'Nhập SL': r.nhapQ, 'Nhập GT': r.nhapV, 'Xuất SL': r.xuatQ, 'Xuất GT': r.xuatV, 'Tồn cuối SL': r.cuoiQ, 'Tồn cuối GT': r.cuoiV, 'Điều chỉnh giá vốn (632)': r.dcV,
        ...Object.fromEntries(ks.flatMap(k => { const x = (r.theoLoai || {})[k] || { q: 0, v: 0 }; return [[ten(k) + ' SL', x.q], [ten(k) + ' GT', x.v]]; })) }))); };
  }
  /* Cột "trong đó" theo loại phiếu đợt 3 (chỉ hiện khi kỳ có phát sinh): nhập khác, hàng sửa / NCC trả về kho thường, xuất huỷ. */
  const NXT_EXTRA = [['nk', 'Nhập khác GT', ['NHAP_KHAC']], ['sua', 'Hàng sửa / NCC trả về GT', ['CHUYEN_SUA', 'NHAN_NCC']], ['huy', 'Xuất huỷ GT', ['XUAT_HUY']]];
  const tlV = (r, ks) => ks.reduce((a, k) => a + (((r.theoLoai || {})[k] || {}).v || 0), 0);
  function reportTable() {
    const R = RP.rows, s = k => R.reduce((a, r) => a + r[k], 0);
    if (!R.length) return '<div class="empty">Không có phát sinh trong kỳ.</div>';
    const ex = NXT_EXTRA.filter(([, , ks]) => R.some(r => ks.some(k => (r.theoLoai || {})[k])));
    return `<table><thead><tr><th>Mã</th><th>Tên hàng</th><th>ĐVT</th><th class="n">Đầu kỳ SL</th><th class="n">Đầu kỳ GT</th><th class="n">Nhập SL</th><th class="n">Nhập GT</th>${ex.filter(e => e[0] !== 'huy').map(e => `<th class="n" title="Trong đó">${e[1]}</th>`).join('')}<th class="n">Xuất SL</th><th class="n">Xuất GT</th>${ex.filter(e => e[0] === 'huy').map(e => `<th class="n" title="Trong đó">${e[1]}</th>`).join('')}<th class="n">Cuối kỳ SL</th><th class="n">Cuối kỳ GT</th><th class="n" title="Chênh lệch khi trả NCC/đảo theo giá gốc — hạch toán TK 632">Điều chỉnh GV</th></tr></thead><tbody>
      ${R.map(r => `<tr><td class="mono">${esc(r.maHang)}</td><td>${esc(r.ten)}</td><td>${esc(r.dvt)}</td><td class="n">${num(r.dauQ)}</td><td class="n">${num(r.dauV)}</td><td class="n">${num(r.nhapQ)}</td><td class="n">${num(r.nhapV)}</td>${ex.filter(e => e[0] !== 'huy').map(e => `<td class="n">${tlV(r, e[2]) ? num(tlV(r, e[2])) : ''}</td>`).join('')}<td class="n">${num(r.xuatQ)}</td><td class="n">${num(r.xuatV)}</td>${ex.filter(e => e[0] === 'huy').map(e => `<td class="n">${tlV(r, e[2]) ? num(tlV(r, e[2])) : ''}</td>`).join('')}<td class="n">${num(r.cuoiQ)}</td><td class="n">${num(r.cuoiV)}</td><td class="n">${r.dcV ? num(r.dcV) : ''}</td></tr>`).join('')}
      <tr><td></td><td><b>Cộng giá trị</b></td><td></td><td></td><td class="n"><b>${num(s('dauV'))}</b></td><td></td><td class="n"><b>${num(s('nhapV'))}</b></td>${ex.filter(e => e[0] !== 'huy').map(e => `<td class="n"><b>${num(R.reduce((a, r) => a + tlV(r, e[2]), 0))}</b></td>`).join('')}<td></td><td class="n"><b>${num(s('xuatV'))}</b></td>${ex.filter(e => e[0] === 'huy').map(e => `<td class="n"><b>${num(R.reduce((a, r) => a + tlV(r, e[2]), 0))}</b></td>`).join('')}<td></td><td class="n"><b>${num(s('cuoiV'))}</b></td><td class="n"><b>${s('dcV') ? num(s('dcV')) : ''}</b></td></tr></tbody></table>`;
  }
  /** Báo cáo kho hàng lỗi (mọi vai trò, không có giá): tồn kho lỗi + serial, hàng đang gửi NCC; lối tắt lập phiếu đường ra. */
  async function loiReport() {
    const r = await load('report.loi', {}, 'Đang đọc kho hàng lỗi…'); if (!r.ok) return toast('Không đọc được: ' + (r.error || r.code));
    const R = r.data.rows, ed = canEdit() && !S.offline, many = activeKho(true).length > 1;
    dialog('Báo cáo kho hàng lỗi', R.length ? `<p class="mut" style="font-size:12.5px;margin-top:0">Kho hàng lỗi không tính giá vốn (giá trị 0) — chỉ theo dõi số lượng. Hàng của khách gửi sửa: trả lại bằng phiếu "Trả khách hàng đã sửa" từ phiếu nhận hàng lỗi.</p>
      <div class="tbl" style="max-height:none"><table><thead><tr><th>Mã</th><th>Tên hàng</th><th class="n">Tồn kho lỗi</th><th>Serial trong kho lỗi</th><th>Đang gửi NCC</th>${ed ? '<th>Lập phiếu</th>' : ''}</tr></thead><tbody>
      ${R.map(x => { const tk = Object.entries(x.ton); return `<tr><td class="mono">${esc(x.maHang)}</td><td>${esc(x.ten)}</td><td class="n">${tk.length ? tk.map(([k, q]) => num(q) + ' ' + esc(x.dvt) + (many ? ' <small class="mut">' + esc(khoName(k)) + '</small>' : '')).join('<br>') : '—'}</td>
        <td><small class="mono">${x.serials.map(z => esc(z.serial)).join(', ')}</small></td>
        <td>${x.dangGui.map(g => `<button class="linkbtn mono" type="button" data-vso="${esc(g.soPhieu)}">${esc(g.soPhieu)}</button> ${esc(vnD(g.ngay))} · ${esc(supName(g.maNCC))} · còn <b>${num(g.con)}</b>/${num(g.gui)}${g.serials.length ? '<br><small class="mono">' + g.serials.map(esc).join(', ') + '</small>' : ''}`).join('<br>')}</td>
        ${ed ? `<td style="white-space:nowrap">${tk.length ? `<button class="btn ghost" type="button" data-lt="CHUYEN_SUA" data-m="${esc(x.maHang)}" data-k="${esc(tk[0][0])}">Về kho thường</button><button class="btn ghost" type="button" data-lt="GUI_NCC" data-m="${esc(x.maHang)}" data-k="${esc(tk[0][0])}">Gửi NCC</button><button class="btn ghost" type="button" data-lt="XUAT_HUY" data-m="${esc(x.maHang)}" data-k="${esc(tk[0][0])}">Huỷ</button>` : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>
      <button class="btn" type="button" id="loiX">${ic('dl')} Xuất Excel</button>` : '<div class="empty">Kho hàng lỗi trống và không có hàng đang gửi NCC.</div>', null, d => {
      d.classList.add('wide');
      $$('[data-vso]', d).forEach(b => b.onclick = () => { d.close(); voucherView(b.dataset.vso); });
      $$('[data-lt]', d).forEach(b => b.onclick = () => { d.close(); voucherForm(b.dataset.lt, { kho: b.dataset.k, lines: [{ maHang: b.dataset.m }] }); });
      const xb = $('#loiX', d); if (xb) xb.onclick = () => exportRows(`KhoHangLoi_${S.today}`, R.map(x => ({ 'Mã hàng': x.maHang, 'Tên hàng': x.ten, 'ĐVT': x.dvt, 'Tồn kho lỗi': Object.values(x.ton).reduce((a, q) => a + q, 0), 'Serial': x.serials.map(z => z.serial).join(', '), 'Đang gửi NCC': x.dangGui.map(g => `${g.soPhieu} (${supName(g.maNCC)}) còn ${g.con}/${g.gui}`).join('; ') })));
    });
  }
  async function exportRows(name, rows) {
    name = `QLHH_${S.co.id}_${name}`;
    try {
      if (!window.XLSX) await loadScript('vendor/xlsx.full.min.js');
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data'); XLSX.writeFile(wb, name + '.xlsx');
    } catch (e) { toast('Không xuất được Excel: ' + e.message); }
  }

  // ---------------- sản xuất tủ (SX-1) ----------------
  const LSX_ST = { MOI: 'Mới', DANG_LAP: 'Đang lắp', CHO_KIEM_TRA: 'Chờ KCS', HOAN_TAT: 'Hoàn tất', HUY: 'Đã huỷ' };
  const CP_LOAI = { NC_TRUC_TIEP: 'Nhân công trực tiếp', SX_CHUNG: 'Sản xuất chung', GIA_CONG_NGOAI: 'Gia công ngoài', KC_HUY: 'Kết chuyển khi huỷ lệnh' };
  const SX = { f: '', q: '', sel: null, data: null, stale: false };
  const optsOf = (rows, k, n, empty) => [['', empty], ...(rows || []).filter(x => x.trangThai !== 'NGUNG').map(x => [x[k], x[n] + ' (' + x[k] + ')'])];
  const tplName = l => ((S.data.templates || []).find(t => t.maMau === l.maMau) || {}).ten || l.maMau;
  const cabsOf = so => (S.data.cabinets || []).filter(c => c.soLSX === so && c.trangThai !== 'HUY');
  /** Sự kiện khách trả gần nhất còn hiệu lực của hồ sơ tủ (cột lichSu). */
  const retEv = c => { try { return JSON.parse((c && c.lichSu) || '[]').filter(e => e.loai === 'KHACH_TRA' && !e.huy).slice(-1)[0] || null; } catch (e) { return null; } };
  const kcsLai = c => { const ev = retEv(c); return !!ev && !(c.kcsDat === true || c.kcsDat === 'true') && Number(c.lanKiemCuoi || 0) === Number(ev.lanKiemCuoi || 0); };
  const kcsTag = c => kcsLai(c) ? `<span class="tag warn">${ic('warn')} Cần KCS lại</span>` : !Number(c.lanKiemCuoi) ? '<span class="tag">Chưa kiểm</span>' : c.kcsDat ? `<span class="tag ok">${ic('check')} Đạt</span>` : `<span class="tag bad">${ic('x')} Không đạt</span>`;
  const isSer = it => it && (it.quanLySerial === true || it.quanLySerial === 'true');
  const tuLink = ser => `${location.origin}${location.pathname}#/t/${S.co.id}/${encodeURIComponent(ser)}`;
  async function qrSvg(text, px = 4) {
    if (!window.qrcode) await loadScript('vendor/qrcode.js');
    const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: px, margin: 2, scalable: true });
  }
  async function submitSX(d, action, body, okMsg) {
    if (S.offline) { dlgMsg(d, 'Đang ngoại tuyến — chưa lưu được. Dữ liệu đã nhập vẫn giữ nguyên.'); return null; }
    const r = await write(action, { ...body, requestId: d._rid || (d._rid = rid()) });
    if (!r.ok) {
      if (r.fields && !Array.isArray(r.fields)) showErrors(d, r.fields);
      dlgMsg(d, 'Chưa lưu: ' + (r.error || r.code) + (r.code === 'NETWORK' ? ' — kiểm tra mạng rồi bấm lại' : '')); return null;
    }
    d._guard = null; SX.stale = true; toast(okMsg(r.data) + (r.data.tinhLai ? ` · đã tính lại giá vốn ${r.data.tinhLai} dòng phiếu` : '')); await sync(); return r.data;
  }

  // ----- danh sách lệnh -----
  function viewSX(m, only) {
    if (SX.sel) return lsxPage(m);
    const d = S.data, L = (d.lsx || []).slice().sort((a, b) => a.soLSX < b.soLSX ? 1 : -1);
    const bad = so => cabsOf(so).some(c => Number(c.lanKiemCuoi) && !c.kcsDat);
    const F = [['', 'Tất cả'], ['DANG', 'Đang làm'], ['CHO_KIEM_TRA', 'Chờ KCS'], ['LOI', '⚠ Không đạt KCS'], ['HOAN_TAT', 'Hoàn tất'], ['HUY', 'Đã huỷ']];
    const nq = QSearch.norm(SX.q);
    const list = L.filter(l => (!SX.f || (SX.f === 'DANG' ? ['MOI', 'DANG_LAP'].includes(l.trangThai) : SX.f === 'LOI' ? bad(l.soLSX) : l.trangThai === SX.f))
      && (!nq || QSearch.norm([l.soLSX, l.maMau, l.maHang, tplName(l), custName(l.maKH), projName(l.maCongTrinh)].join(' ')).includes(nq)));
    const noTpl = !(d.templates || []).length;
    paint(m, only, header('Sản xuất tủ', canEdit() && !noTpl ? `<button class="btn pri" id="newL">${ic('plus')}<span>Lệnh sản xuất</span></button>` : '', false, canEdit() && !noTpl ? 'newLM' : '') + `
      <label class="msearch">${ic('search')}<span class="sr">Tìm lệnh</span><input id="qsm" type="search" placeholder="Số lệnh, mẫu, khách, công trình…" value="${esc(SX.q)}" autocomplete="off"></label>
      <div class="top" style="margin-top:-4px"><label class="search" style="flex:1 1 320px">${ic('search')}<span class="sr">Tìm lệnh</span><input id="qsd" type="search" placeholder="Số lệnh, mẫu, khách, công trình…" value="${esc(SX.q)}" autocomplete="off"></label></div>
      <div class="sxbar"><button class="btn" type="button" id="serB">${ic('search')} Tra xê-ri tủ</button>${hasCam() ? `<button class="btn" type="button" data-scantu>${ic('search')} Quét QR tủ</button>` : ''}<button class="btn" type="button" id="tplB">${ic('layers')} Mẫu tủ (${(d.templates || []).length})</button>${isQT() ? `<button class="btn" type="button" id="wipB">${ic('chart')} Dở dang (TK 154)</button>` : ''}</div>
      <div class="chips" role="group" aria-label="Lọc lệnh">${F.map(([k, t]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${SX.f === k}">${t}</button>`).join('')}</div>
      <div class="card list" id="sxres">${list.length ? list.slice(0, 300).map(l => { const c = cabsOf(l.soLSX), ok = c.filter(x => x.kcsDat).length;
        return `<div class="it" data-lsx="${esc(l.soLSX)}" role="button" tabindex="0"><div><div class="mono">${esc(l.soLSX)} <span class="tag st-${esc(l.trangThai)}">${LSX_ST[l.trangThai] || esc(l.trangThai)}</span>${bad(l.soLSX) ? ` <span class="tag bad">${ic('warn')} Không đạt KCS</span>` : ''}</div>
          <b>${esc(tplName(l))}</b> × ${num(l.soLuong)}<br><small class="mut">${esc([vnD(l.ngay), l.maKH && custName(l.maKH), l.maCongTrinh && projName(l.maCongTrinh)].filter(Boolean).join(' · '))}</small></div>
          <div style="text-align:right;white-space:nowrap"><b>${ok}/${num(l.soLuong)}</b><br><small class="mut">tủ đạt KCS</small></div></div>`; }).join('')
        : `<div class="empty">${L.length ? 'Không có lệnh khớp bộ lọc.' : 'Chưa có lệnh sản xuất.' + (noTpl ? (isQT() ? '<br>Bắt đầu bằng <b>Mẫu tủ</b>: định mức linh kiện + các mục kiểm tra xuất xưởng.' : '<br>Cần Quản trị tạo Mẫu tủ trước.') : canEdit() ? '<br>Bấm <b>+ Lệnh sản xuất</b>.' : '')}</div>`}</div>`);
    onSearch('#qsm,#qsd', v => { SX.q = v; }, () => viewSX(m, '#sxres'), 300);
    $$('.chip[data-f]').forEach(b => b.onclick = () => { SX.f = b.dataset.f; viewSX(m); });
    $$('#newL,#newLM').forEach(b => b.onclick = lsxForm);
    $('#tplB').onclick = tplList; $('#serB').onclick = serialSearch; $$('[data-scantu]', m).forEach(b => b.onclick = scanTu); const wb = $('#wipB'); if (wb) wb.onclick = wipReport;
    $$('[data-lsx]').forEach(r => r.onclick = r.onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter') return; openLSX(r.dataset.lsx); });
  }
  function openLSX(so) { SX.sel = so; SX.stale = true; if (isMobile()) history.pushState({ lsx: 1 }, ''); if (route() !== 'sx') location.hash = '#/sx'; else renderView(); }

  // ----- trang 1 lệnh: 4 bước -----
  async function lsxPage(m) {
    const so = SX.sel;
    if (SX.stale || !SX.data || SX.data.lsx.soLSX !== so) {
      if (!SX.data || SX.data.lsx.soLSX !== so) m.innerHTML = header(esc(so)) + `<div class="card">${'<div class="skel"></div>'.repeat(5)}</div>`;
      const r = await load('sx.get', { soLSX: so }, 'Đang mở lệnh ' + so + '…');
      if (!r.ok) { toast('Không mở được lệnh: ' + (r.error || r.code)); SX.sel = null; SX.data = null; return renderView(); }
      SX.data = r.data; SX.stale = false; if (route() !== 'sx' || SX.sel !== so) return;
    }
    const g = SX.data, l = g.lsx, t = g.template || { bom: [], kcs: [] }, all = g.hoSoTu, tus = all.filter(c => c.trangThai !== 'HUY');
    const ph = g.phieu, hasX = ph.some(p => p.loai === 'XUAT_SX'), hasN = ph.some(p => p.loai === 'NHAP_TP'), rem = Number(l.soLuong) - tus.length, huy = l.trangThai === 'HUY';
    const step = huy ? 0 : !hasX ? 1 : rem > 0 ? 2 : !tus.every(c => c.kcsDat) ? 3 : 4;
    const kcsOf = ser => g.kcs.filter(k => k.serial === ser).sort((a, b) => b.lanKiem - a.lanKiem)[0];
    const pxxReady = tus.filter(c => c.kcsDat && !c.soPXX && !['DA_BAN'].includes(c.trangThai));
    const live = canEdit() && !S.offline && !huy;
    const STEPS = ['Xuất linh kiện', 'Nhập thành phẩm', 'Kiểm tra xuất xưởng', 'Phiếu xuất xưởng'];
    m.innerHTML = `<div class="mtop"><button class="btn ghost iconbtn" type="button" id="lBack" aria-label="Quay lại">${ic('back')}</button><h1>${esc(so)}</h1><span class="cobadge">${esc(S.co.ten)}</span></div>
      <div class="top"><button class="btn ghost" type="button" id="lBack2">${ic('back')} Lệnh sản xuất</button><h1>${esc(so)}</h1><span class="tag st-${esc(l.trangThai)}">${LSX_ST[l.trangThai] || esc(l.trangThai)}</span><span class="cobadge">${esc(S.co.ten)}</span></div>
      ${S.offline ? `<div class="banner" role="status">${ic('warn')} Đang ngoại tuyến — chỉ xem, chưa ghi được.</div>` : ''}
      ${huy ? `<div class="banner" role="status">${ic('warn')} Lệnh đã huỷ${l.lyDoHuy ? ': ' + esc(l.lyDoHuy) : ''}.</div>` : `<ol class="steps" aria-label="Tiến độ lệnh">${STEPS.map((s, i) => `<li class="${i + 1 < step ? 'done' : i + 1 === step ? 'cur' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><b>${i + 1}</b><span>${s}</span></li>`).join('')}</ol>`}
      <div class="layout sxl"><div>
        <section class="card"><h2 class="h2">${esc(t.ten || l.maMau)} <small class="mut">mẫu ${esc(l.maMau)} · bản ${esc(l.phienBan)}</small></h2>
          <dl class="dl"><dt>Số tủ</dt><dd>${num(l.soLuong)} ${tus.length ? `· đã nhập ${tus.length}` : ''}</dd><dt>Ngày lệnh</dt><dd>${esc(vnD(l.ngay))}</dd><dt>Kho linh kiện</dt><dd>${esc(khoName(l.kho))}</dd>
            ${l.maKH ? `<dt>Khách hàng</dt><dd>${esc(custName(l.maKH))}</dd>` : ''}${l.maCongTrinh ? `<dt>Công trình</dt><dd>${esc(projName(l.maCongTrinh))}</dd>` : ''}
            ${l.canCuCheTao ? `<dt>Căn cứ chế tạo</dt><dd>${esc(l.canCuCheTao)}</dd>` : ''}${l.ghiChu ? `<dt>Ghi chú</dt><dd>${esc(l.ghiChu)}</dd>` : ''}
            ${isQT() && g.doDang !== undefined ? `<dt>Dở dang (TK 154)</dt><dd><b>${money(g.doDang)}</b></dd>` : ''}</dl>
          <div class="acts sxacts">
            ${live && !hasN ? `<button class="btn ${step === 1 ? 'pri' : ''}" type="button" id="aX">${ic('stock')} Xuất linh kiện</button>` : ''}
            ${live && hasX && rem > 0 ? `<button class="btn ${step === 2 ? 'pri' : ''}" type="button" id="aN">${ic('plus')} Nhập thành phẩm (${rem} tủ)</button>` : ''}
            ${live && pxxReady.length ? `<button class="btn ${step === 4 ? 'pri' : ''}" type="button" id="aP">${ic('doc')} Phát hành PXX (${pxxReady.length})</button>` : ''}
            ${isQT() && !S.offline && !huy && !(rem <= 0 && hasN) ? `<button class="btn" type="button" id="aC">Chi phí khác</button>` : ''}
            ${isQT() && !S.offline && !huy && !hasN ? `<button class="btn danger" type="button" id="aH">Huỷ lệnh</button>` : ''}
          </div></section>
        <section class="card"><h2 class="h2">Tủ thành phẩm ${tus.length ? `(${tus.filter(c => c.kcsDat).length}/${tus.length} đạt KCS)` : ''}</h2>
          ${tus.length ? `<div class="list">${tus.map(c => { const k = kcsOf(c.serial);
            return `<div class="it" data-tu="${esc(c.serial)}" role="button" tabindex="0"><div><div class="mono"><b>${esc(c.serial)}</b></div>${kcsTag(c)}${c.soPXX ? ` <span class="tag">PXX ${esc(c.soPXX)}</span>` : ''}
              ${k && !k.dat ? `<br><small class="bad-ink">${esc(k.ketQua.filter(x => x.ketQua === 'KHONG_DAT').map(x => x.noiDung + (x.ghiChu ? ': ' + x.ghiChu : '')).join('; '))}</small>` : ''}
              ${isQT() && c.giaThanh !== undefined ? `<br><small class="mut">Giá thành ${money(c.giaThanh)}</small>` : ''}</div>
              ${live && !c.soPXX && !c.kcsDat ? `<button class="btn ${step === 3 ? 'pri' : ''} kcsb" type="button" data-kcs="${esc(c.serial)}">${ic('check')} Kiểm tra</button>` : ''}</div>`; }).join('')}</div>`
          : `<div class="empty">${hasX ? 'Chưa nhập tủ nào. Lắp xong bấm <b>Nhập thành phẩm</b> — hệ thống cấp số xê-ri cho từng tủ.' : 'Bước đầu: <b>Xuất linh kiện</b> theo định mức × số tủ (sửa được theo thực tế).'}</div>`}</section>
      </div><div>
        <section class="card"><h2 class="h2">Phiếu kho của lệnh</h2>${ph.length ? `<div class="list">${ph.map(p => `<div class="it" data-so="${esc(p.soPhieu)}" role="button" tabindex="0"><div><span class="mono">${esc(p.soPhieu)}</span> · ${esc(LOAI[p.loai] || p.loai)}<br><small class="mut">${esc(vnD(p.ngay))} · ${p.lines.length} dòng</small></div>${isQT() && p.tongTien !== undefined ? `<b style="white-space:nowrap">${money(p.tongTien)}</b>` : ''}</div>`).join('')}</div>` : '<div class="empty">Chưa có phiếu.</div>'}</section>
        ${isQT() && g.chiPhi ? `<section class="card"><h2 class="h2">Chi phí khác</h2>${g.chiPhi.length ? `<div class="list">${g.chiPhi.map(c => { const huyRoi = g.chiPhi.some(y => y.soCTGoc === c.id && Number(y.soTien) < 0); return `<div class="it"><div>${esc(CP_LOAI[c.loai] || c.loai)} <small class="mut mono">${esc(c.id)}</small><br><small class="mut">${esc(vnD(c.ngay))}${c.soCTGoc ? ' · ' + esc(c.soCTGoc) : ''}${c.ghiChu ? ' · ' + esc(c.ghiChu) : ''}</small></div><div style="text-align:right"><b>${money(c.soTien)}</b>${!huy && !S.offline && Number(c.soTien) > 0 && c.loai !== 'KC_HUY' && !huyRoi ? `<br><button class="linkbtn" type="button" data-cph="${esc(c.id)}">Huỷ dòng</button>` : huyRoi ? '<br><small class="mut">đã huỷ</small>' : ''}</div></div>`; }).join('')}</div>` : '<div class="empty">Chưa có (nhân công, gia công…).</div>'}</section>` : ''}
        <section class="card"><h2 class="h2">Định mức 1 tủ</h2><div class="tbl"><table><thead><tr><th>Mã</th><th>Linh kiện</th><th class="n">SL</th></tr></thead><tbody>${t.bom.map(b => { const it = itemOf(b.maHang); return `<tr><td class="mono">${esc(b.maHang)}</td><td>${esc(it.ten)}${isSer(it) ? ' <span class="tag">serial</span>' : ''}</td><td class="n">${num(b.soLuong)} ${esc(it.dvt)}</td></tr>`; }).join('')}</tbody></table></div></section>
      </div></div>`;
    const back = () => history.state && history.state.lsx ? history.back() : (SX.sel = null, renderView());
    $$('#lBack,#lBack2').forEach(b => b.onclick = back);
    const on = (id, f) => { const b = $('#' + id); if (b) b.onclick = f; };
    on('aX', () => { const iss = {}; ph.filter(p => p.loai === 'XUAT_SX').forEach(p => p.lines.forEach(x => iss[x.maHang] = (iss[x.maHang] || 0) + Number(x.soLuong)));
      ph.filter(p => p.loai === 'NHAP_LAI_SX').forEach(p => p.lines.forEach(x => iss[x.maHang] = (iss[x.maHang] || 0) - Number(x.soLuong)));
      const plan = QSX.planIssue(t.bom, Number(l.soLuong)).map(b => ({ maHang: b.maHang, soLuongCT: Math.max(0, Math.round((b.soLuong - (iss[b.maHang] || 0)) * 1000) / 1000) })).filter(b => b.soLuongCT > 0);
      if (!plan.length) return toast('Đã xuất đủ định mức — muốn bổ sung thì thêm dòng trong phiếu');
      voucherForm('XUAT_SX', { sx: so, kho: l.kho, lyDo: 'Xuất linh kiện cho ' + so, lines: plan }); });
    $$('[data-cph]').forEach(b => b.onclick = () => dialog('Huỷ chi phí ' + esc(b.dataset.cph), `<p>Ghi dòng âm cùng ngày, cùng loại; giá thành các tủ đã nhập được tính lại.</p>${fld('lyDo', 'Lý do', '', { req: 1, type: 'textarea' })}`,
      async (v, dlg) => { if (!v.lyDo.trim()) { showErrors(dlg, { lyDo: 'Nhập lý do' }); return false; } return !!(await submitSX(dlg, 'lsx.chiPhiHuy', { id: b.dataset.cph, lyDo: v.lyDo }, () => 'Đã huỷ chi phí ' + b.dataset.cph)); }, null, 'Huỷ chi phí'));
    on('aN', () => nhapForm(g, rem)); on('aP', () => pxxForm(g, pxxReady)); on('aC', () => chiPhiForm(g)); on('aH', () => huyForm(g));
    $$('[data-kcs]').forEach(b => b.onclick = e => { e.stopPropagation(); kcsScreen(b.dataset.kcs, t, tus); });
    $$('[data-tu]').forEach(r => r.onclick = () => tuView(r.dataset.tu));
    $$('[data-so]', m).forEach(r => r.onclick = () => voucherView(r.dataset.so));
  }

  // ----- biểu mẫu lệnh -----
  function lsxForm() {
    const d = S.data, tp = d.templates || [];
    if (!tp.length) return toast('Chưa có mẫu tủ — Quản trị tạo Mẫu tủ trước');
    dialog('Lập lệnh sản xuất', `<div class="grid2"><div>${fld('maMau', 'Mẫu tủ', tp[0].maMau, { opts: tp.map(t => [t.maMau, t.ten + ' — ' + t.maMau + ' (bản ' + t.phienBan + ')']) })}</div>
        <div>${fld('soLuong', 'Số tủ', '1', { req: 1, im: 'numeric' })}</div><div>${fld('ngay', 'Ngày lệnh', S.today, { type: 'date', max: S.today })}</div>
        <div>${fld('kho', 'Kho lấy linh kiện', (activeKho(false)[0] || {}).maKho || '', { opts: activeKho(false).map(w => [w.maKho, w.ten]) })}</div>
        <div>${fld('maKH', 'Khách hàng (nếu làm theo đơn)', '', { opts: optsOf(d.customers, 'maKH', 'ten', '— Không —') })}</div>
        <div>${fld('maCongTrinh', 'Công trình', '', { opts: optsOf(d.projects, 'maCongTrinh', 'ten', '— Không —') })}</div></div>
      ${fld('canCuCheTao', 'Căn cứ chế tạo (bản vẽ, đơn vị lập)', '', { type: 'textarea' })}${fld('ghiChu', 'Ghi chú', '')}
      <h3 class="h3">Linh kiện cần (định mức × số tủ)</h3><div id="bomPrev"></div>`,
      async (v, dlg) => {
        const n = Number(v.soLuong); if (!Number.isInteger(n) || n < 1 || n > 500) { showErrors(dlg, { soLuong: 'Số nguyên 1–500' }); return false; }
        const r = await submitSX(dlg, 'lsx.create', { lsx: { ...v, soLuong: n } }, x => 'Đã lập lệnh ' + x.soLSX);
        if (r) setTimeout(() => openLSX(r.soLSX), 0); return !!r;
      }, dlg => {
        const prev = () => { const t = tp.find(x => x.maMau === $('#f_maMau', dlg).value), n = Number($('#f_soLuong', dlg).value) || 0, kho = $('#f_kho', dlg).value; if (!t) return;
          const bom = QSX.planIssue(JSON.parse(t.bom || '[]'), n);
          $('#bomPrev', dlg).innerHTML = `<div class="tbl"><table><thead><tr><th>Linh kiện</th><th class="n">Cần</th><th class="n">Tồn ${esc(khoName(kho))}</th></tr></thead><tbody>${bom.map(b => { const it = itemOf(b.maHang), ton = tonQ(b.maHang, kho), thieu = ton < b.soLuong;
            return `<tr><td><span class="mono">${esc(b.maHang)}</span> ${esc(it.ten)}${it.trangThai === 'NGUNG' ? ' <span class="tag stop">ngừng KD</span>' : ''}</td><td class="n">${num(b.soLuong)} ${esc(it.dvt)}</td><td class="n ${thieu ? 'bad-ink' : ''}">${num(ton)}${thieu ? ` <b>(thiếu ${num(Math.round((b.soLuong - ton) * 1000) / 1000)})</b>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`; };
        ['#f_maMau', '#f_soLuong', '#f_kho'].forEach(s => $(s, dlg).addEventListener('input', prev)); $('#f_kho', dlg).onchange = prev; $('#f_maMau', dlg).onchange = prev; prev();
      }, 'Lập lệnh');
  }
  function nhapForm(g, rem) {
    const iss = {}; g.phieu.forEach(p => p.lines.forEach(x => { if (p.loai === 'XUAT_SX') iss[x.maHang] = (iss[x.maHang] || 0) + Number(x.soLuong); if (p.loai === 'NHAP_LAI_SX') iss[x.maHang] = (iss[x.maHang] || 0) - Number(x.soLuong); }));
    const thieu = QSX.planIssue((g.template || {}).bom || [], Number(g.lsx.soLuong)).filter(b => (iss[b.maHang] || 0) + 1e-9 < b.soLuong);
    dialog('Nhập thành phẩm — ' + esc(g.lsx.soLSX), `<p>Hệ thống cấp số xê-ri cho từng tủ (dạng <span class="mono">${esc(QSX.serialNo(S.data.config.maCongTy || S.co.id, g.lsx.maHang, S.today.slice(0, 4), 1))}</span>), lập phiếu nhập kho thành phẩm và hồ sơ tủ. Linh kiện có serial (LOGO!…) tự gắn vào từng tủ.</p>
      <div class="grid2"><div>${fld('soLuong', 'Số tủ nhập', String(rem), { req: 1, im: 'numeric' })}</div><div>${fld('ngay', 'Ngày nhập', S.today, { type: 'date', max: S.today })}</div></div>
      ${thieu.length ? `<div class="banner" role="alert">${ic('warn')} Linh kiện đã xuất chưa đủ định mức × ${num(g.lsx.soLuong)} tủ: ${thieu.map(b => esc(b.maHang) + ' (cần ' + num(b.soLuong) + ', đã xuất ' + num(iss[b.maHang] || 0) + ')').join(', ')}. Nhập thành phẩm rồi thì không xuất bổ sung được.</div>` : ''}<p class="mut" style="font-size:12.5px">Sau khi nhập thành phẩm, không xuất bổ sung linh kiện cho lệnh này nữa. Giá thành = giá trị linh kiện đã xuất + chi phí khác, chia theo số tủ.</p>`,
      async (v, dlg) => { const n = Number(v.soLuong); if (!Number.isInteger(n) || n < 1 || n > rem) { showErrors(dlg, { soLuong: 'Từ 1 đến ' + rem }); return false; }
        return !!(await submitSX(dlg, 'lsx.nhapTP', { soLSX: g.lsx.soLSX, ngay: v.ngay, soLuong: n }, x => `Đã nhập ${x.serials.length} tủ: ${x.serials.join(', ')}`)); }, null, 'Nhập kho');
  }
  function chiPhiForm(g) {
    dialog('Chi phí khác — ' + esc(g.lsx.soLSX), `<div class="grid2"><div>${fld('loai', 'Loại chi phí', 'NC_TRUC_TIEP', { opts: Object.entries(CP_LOAI).filter(([k]) => k !== 'KC_HUY') })}</div>
        <div>${fld('soTien', 'Số tiền (₫)', '', { req: 1, im: 'numeric' })}</div><div>${fld('ngay', 'Ngày', S.today, { type: 'date', max: S.today })}</div>
        <div>${fld('soCTGoc', 'Số chứng từ (bảng lương, HĐ gia công…)', '')}</div><div>${fld('ngayCTGoc', 'Ngày chứng từ', '', { type: 'date', max: S.today })}</div></div>${fld('ghiChu', 'Diễn giải', '')}
      <p class="mut" style="font-size:12.5px">Không ghi vận chuyển giao khách, chi phí bảo hành. Nếu đã nhập thành phẩm, giá thành các tủ nhập từ ngày này được tính lại.</p>`,
      async (v, dlg) => { const n = Number(String(v.soTien).replace(/[.\s,₫]/g, '')); if (!Number.isInteger(n) || n <= 0) { showErrors(dlg, { soTien: 'Số nguyên VND > 0' }); return false; }
        return !!(await submitSX(dlg, 'lsx.chiPhi', { soLSX: g.lsx.soLSX, chiPhi: { ...v, soTien: n } }, () => 'Đã ghi chi phí ' + money(n))); });
  }
  function huyForm(g) {
    const rows = []; const back = {};
    g.phieu.filter(p => p.loai === 'NHAP_LAI_SX').forEach(p => p.lines.forEach(x => { const k = p.phieuGoc + '#' + x.dongGoc; back[k] = (back[k] || 0) + Number(x.soLuong); (x.serials || []).forEach(s => back[k + '|' + s] = 1); }));
    g.phieu.filter(p => p.loai === 'XUAT_SX').forEach(p => p.lines.forEach(x => { const k = p.soPhieu + '#' + x.dong, q = Math.round((Number(x.soLuong) - (back[k] || 0)) * 1000) / 1000; if (q > 0) rows.push({ phieuGoc: p.soPhieu, dong: x.dong, maHang: x.maHang, max: q, serials: (x.serials || []).filter(s => !back[k + '|' + s]) }); }));
    dialog('Huỷ lệnh ' + esc(g.lsx.soLSX), `<p>Linh kiện còn dùng được nhập lại kho theo đúng giá đã xuất. Phần đã tiêu hao (dây, phụ kiện…) để số 0 — giá trị đó kết chuyển vào chi phí.</p>
      ${fld('ngay', 'Ngày huỷ', S.today, { type: 'date', max: S.today })}${fld('lyDo', 'Lý do huỷ', '', { req: 1, type: 'textarea' })}
      ${rows.length ? `<div class="tbl"><table><thead><tr><th>Linh kiện</th><th class="n">Đã xuất</th><th class="n">Nhập lại</th></tr></thead><tbody>${rows.map((r, i) => { const it = itemOf(r.maHang);
        return `<tr><td><span class="mono">${esc(r.maHang)}</span> ${esc(it.ten)}<br><small class="mut">${esc(r.phieuGoc)}#${r.dong}</small>${r.serials.length ? `<div class="sers">${r.serials.map(s => `<label><input type="checkbox" data-hs="${i}" value="${esc(s)}" checked> ${esc(s)}</label>`).join('')}</div>` : ''}</td>
          <td class="n">${num(r.max)} ${esc(it.dvt)}</td><td class="n"><input class="in num" data-hq="${i}" value="${r.max}" inputmode="decimal" aria-label="Số nhập lại ${esc(r.maHang)}" ${r.serials.length ? 'readonly' : ''}></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="mut">Lệnh chưa xuất linh kiện.</p>'}`,
      async (v, dlg) => {
        if (!v.lyDo.trim()) { showErrors(dlg, { lyDo: 'Nhập lý do' }); return false; }
        const traLai = rows.map((r, i) => { const sers = $$(`[data-hs="${i}"]:checked`, dlg).map(c => c.value), q = r.serials.length ? sers.length : Number(String($(`[data-hq="${i}"]`, dlg).value).replace(',', '.'));
          return { phieuGoc: r.phieuGoc, dong: r.dong, soLuong: q, serials: r.serials.length ? sers : undefined }; });
        if (traLai.some((x, i) => !(x.soLuong >= 0) || x.soLuong > rows[i].max)) { dlgMsg(dlg, 'Số nhập lại từ 0 đến số đã xuất'); return false; }
        return !!(await submitSX(dlg, 'lsx.huy', { soLSX: g.lsx.soLSX, ngay: v.ngay, lyDo: v.lyDo, traLai }, x => `Đã huỷ lệnh${x.phieuNhapLai.length ? ' · nhập lại ' + x.phieuNhapLai.join(', ') : ''}${isQT() && x.ketChuyen ? ' · kết chuyển chi phí ' + money(x.ketChuyen) : ''}`));
      }, dlg => { dlg.classList.add('wide'); $$('[data-hs]', dlg).forEach(c => c.onchange = () => { const i = c.dataset.hs; $(`[data-hq="${i}"]`, dlg).value = $$(`[data-hs="${i}"]:checked`, dlg).length; }); }, 'Huỷ lệnh');
  }

  // ----- kiểm tra xuất xưởng: mỗi lần 1 mục, nháp lưu trên máy -----
  function kcsScreen(ser, tpl, tus) {
    const items = tpl.kcs || [], key = `qlhh-kcs:${S.co.id}:${ser}`, saved = LS.get(key, null);
    const st = saved && saved.n === items.length ? saved : { n: items.length, res: items.map(() => ({ ketQua: '', ghiChu: '' })), i: 0, rid: rid() };
    const save = () => LS.set(key, st);
    let sum = false;
    const d = dialog('Kiểm tra xuất xưởng', '<div id="kc"></div>', null, dlg => { dlg.classList.add('wide', 'kcsd'); dlg._rid = st.rid; });
    const done = () => st.res.every(r => r.ketQua === 'DAT' || (r.ketQua === 'KHONG_DAT' && r.ghiChu.trim()));
    const draw = () => {
      const box = $('#kc', d), it = items[st.i], r = st.res[st.i], nDone = st.res.filter(x => x.ketQua).length;
      if (sum) {
        const nd = st.res.filter(x => x.ketQua === 'DAT').length;
        box.innerHTML = `<div class="kchead"><span class="cobadge">${esc(S.co.ten)}</span> <b class="mono">${esc(ser)}</b></div>
          <h3 class="h3">Tóm tắt: ${nd}/${items.length} mục đạt → tủ <b class="${nd === items.length ? 'ok-ink' : 'bad-ink'}">${nd === items.length ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b></h3>
          <ol class="kcsum">${items.map((x, i) => `<li><button type="button" class="linkbtn" data-go="${i}">${esc(x.noiDung)}</button> — ${st.res[i].ketQua === 'DAT' ? '<b class="ok-ink">✓ Đạt</b>' : `<b class="bad-ink">✗ Không đạt</b>: ${esc(st.res[i].ghiChu)}`}</li>`).join('')}</ol>
          <p class="mut">Đã chốt thì không sửa được; kiểm lại = lần kiểm mới.</p>
          <div class="kcbar"><button class="btn" type="button" id="kcBack">‹ Xem lại</button><button class="btn pri" type="button" id="kcOk" ${S.offline ? 'disabled' : ''}>${S.offline ? 'Mất mạng — chưa chốt được' : 'Xác nhận chốt'}</button></div><div class="dlgmsg" id="kcMsg" role="alert"></div>`;
        $$('[data-go]', box).forEach(b => b.onclick = () => { sum = false; st.i = +b.dataset.go; save(); draw(); });
        $('#kcBack', box).onclick = () => { sum = false; draw(); };
        $('#kcOk', box).onclick = async e => {
          const b = e.currentTarget; if (b.disabled) return; b.disabled = true; b.classList.add('busy');
          const x = await write('kcs.add', { serial: ser, ngay: S.today, ketQua: st.res, requestId: st.rid });
          b.disabled = false; b.classList.remove('busy');
          if (!x.ok) { $('#kcMsg', box).textContent = 'Chưa chốt: ' + (x.error || x.code) + (x.code === 'NETWORK' ? ' — nháp vẫn lưu trên máy, bấm lại khi có mạng' : ''); return; }
          LS.del(key); SX.stale = true; toast(`Đã chốt lần kiểm ${x.data.lanKiem}: tủ ${ser} ${x.data.dat ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
          const next = (tus || []).find(c => c.serial !== ser && !c.kcsDat && !c.soPXX);
          box.innerHTML = `<div class="empty"><p style="font-size:20px">${x.data.dat ? '✓ Tủ đạt kiểm tra xuất xưởng' : '✗ Tủ không đạt — sửa xong kiểm lại'}</p>${next ? `<button class="btn pri big" type="button" id="kcNext">Tủ kế tiếp: ${esc(next.serial)}</button>` : ''}<button class="btn" type="button" id="kcClose" style="margin-top:12px">Đóng</button></div>`;
          $('#kcClose', box).onclick = () => d.close(); const nb = $('#kcNext', box); if (nb) nb.onclick = () => { d.close(); kcsScreen(next.serial, tpl, tus); };
          sync();
        };
        return;
      }
      box.innerHTML = `<div class="kchead"><span class="cobadge">${esc(S.co.ten)}</span> <b class="mono">${esc(ser)}</b><span class="mut" style="margin-left:auto">Mục ${st.i + 1}/${items.length} · đã chọn ${nDone}</span></div>
        <div class="kcdots" aria-hidden="true">${items.map((x, i) => `<span class="${i === st.i ? 'cur' : ''} ${st.res[i].ketQua === 'DAT' ? 'ok' : st.res[i].ketQua === 'KHONG_DAT' ? 'bad' : ''}"></span>`).join('')}</div>
        <div class="kccard"><div class="kcq">${esc(it.noiDung)}</div>${it.yeuCau ? `<div class="kcy"><small>Yêu cầu</small><br>${esc(it.yeuCau)}</div>` : ''}
          <div class="kcbtns" role="group" aria-label="Kết quả mục ${st.i + 1}"><button type="button" class="kcb ok" aria-pressed="${r.ketQua === 'DAT'}" data-k="DAT">${ic('check')} Đạt</button><button type="button" class="kcb bad" aria-pressed="${r.ketQua === 'KHONG_DAT'}" data-k="KHONG_DAT">${ic('x')} Không đạt</button></div>
          ${r.ketQua === 'KHONG_DAT' ? `<label class="f" for="kcNote">Mô tả lỗi *</label><textarea class="in" id="kcNote" placeholder="VD: cách điện 0,4 MΩ, K2 không đóng">${esc(r.ghiChu)}</textarea>` : ''}</div>
        <p class="mut kcsave">${ic('check')} Đã lưu trên máy — mất mạng không mất kết quả.</p>
        <div class="kcbar"><button class="btn" type="button" id="kcPrev" ${st.i ? '' : 'disabled'}>‹ Mục trước</button>
          ${st.i < items.length - 1 ? `<button class="btn pri" type="button" id="kcNx" ${r.ketQua ? '' : 'disabled'}>Mục tiếp ›</button>` : ''}
          <button class="btn ${st.i === items.length - 1 ? 'pri' : ''}" type="button" id="kcSum" ${done() ? '' : 'disabled'}>Chốt lần kiểm</button></div>`;
      $$('.kcb', box).forEach(b => b.onclick = () => { r.ketQua = b.dataset.k; if (r.ketQua === 'DAT') r.ghiChu = ''; save(); if (navigator.vibrate) navigator.vibrate(15);
        if (r.ketQua === 'DAT' && st.i < items.length - 1) { draw(); setTimeout(() => { st.i++; save(); draw(); }, 250); } else { draw(); const n = $('#kcNote', box); if (n) n.focus(); } });
      const note = $('#kcNote', box); if (note) note.oninput = () => { r.ghiChu = note.value; save(); $('#kcSum', box).disabled = !done(); };
      $('#kcPrev', box).onclick = () => { st.i--; save(); draw(); };
      const nx = $('#kcNx', box); if (nx) nx.onclick = () => { if (r.ketQua === 'KHONG_DAT' && !r.ghiChu.trim()) { const n = $('#kcNote', box); n.setAttribute('aria-invalid', 'true'); n.focus(); return; } st.i++; save(); draw(); };
      $('#kcSum', box).onclick = () => { sum = true; draw(); };
    };
    if (!items.length) { $('#kc', d).innerHTML = '<div class="empty">Mẫu tủ chưa có mục kiểm tra.</div>'; return; }
    if (saved) toast('Đã khôi phục kết quả kiểm đang làm dở');
    draw();
  }

  // ----- phiếu xuất xưởng -----
  function pxxForm(g, ready) {
    const d = S.data, l = g.lsx;
    dialog('Phát hành phiếu xuất xưởng', `<p>Chọn tủ (đã đạt KCS, cùng mẫu). Số PXX cấp khi phát hành, liên tục theo năm; phát hành rồi không sửa, chỉ huỷ kèm lý do.</p>
      <div class="sers">${ready.map(c => `<label><input type="checkbox" name="s_${esc(c.serial)}" value="${esc(c.serial)}" checked> <span class="mono">${esc(c.serial)}</span></label>`).join('')}</div>
      <div class="grid2"><div>${fld('ngay', 'Ngày PXX', S.today, { type: 'date', max: S.today })}</div>
        <div>${fld('maKH', 'Khách hàng', l.maKH, { opts: optsOf(d.customers, 'maKH', 'ten', '— Chọn khách —') })}</div>
        <div>${fld('maCongTrinh', 'Công trình', l.maCongTrinh, { opts: optsOf(d.projects, 'maCongTrinh', 'ten', '— Không —') })}</div>
        <div>${fld('diaDiem', 'Địa điểm xây dựng', '')}</div><div>${fld('soPhieuXuat', 'Số phiếu xuất kho (nếu đã có)', '')}</div><div>${fld('soHoaDon', 'Số hoá đơn (nếu có)', '')}</div></div>
      ${fld('canCuCheTao', 'Căn cứ chế tạo', l.canCuCheTao, { type: 'textarea' })}${fld('ghiChu', 'Ghi chú', '')}`,
      async (v, dlg) => {
        const serials = $$('.sers input:checked', dlg).map(c => c.value); if (!serials.length) { dlgMsg(dlg, 'Chọn ít nhất 1 tủ'); return false; }
        const r = await submitSX(dlg, 'pxx.issue', { pxx: { ngay: v.ngay, maKH: v.maKH, maCongTrinh: v.maCongTrinh, diaDiem: v.diaDiem, soPhieuXuat: v.soPhieuXuat, soHoaDon: v.soHoaDon, canCuCheTao: v.canCuCheTao, ghiChu: v.ghiChu, serials } }, x => 'Đã phát hành ' + x.soPXX);
        if (r) setTimeout(() => toast('Phiếu ' + r.soPXX + ' đã phát hành', 'In PXX', () => printPXX(r.soPXX), 9000), 50); return !!r;
      }, null, 'Phát hành');
  }
  function pxxCancelForm(p) {
    dialog('Huỷ phiếu xuất xưởng ' + esc(p.soPXX), `<p>Số phiếu giữ nguyên (không cấp lại). Các tủ trong phiếu được gỡ khỏi PXX để kiểm lại hoặc phát hành phiếu mới.</p>${fld('lyDo', 'Lý do huỷ', '', { req: 1, type: 'textarea' })}`,
      async (v, dlg) => { if (!v.lyDo.trim()) { showErrors(dlg, { lyDo: 'Nhập lý do' }); return false; } return !!(await submitSX(dlg, 'pxx.cancel', { soPXX: p.soPXX, lyDo: v.lyDo }, () => 'Đã huỷ ' + p.soPXX)); }, null, 'Huỷ PXX');
  }
  async function printPXX(soPXX) {
    const p = (S.data.pxx || []).find(x => x.soPXX === soPXX); if (!p) return toast('Không có phiếu ' + soPXX);
    const sers = JSON.parse(p.serials || '[]'), info = await Promise.all(sers.map(s => call('serial.get', { serial: s }, 3)));
    if (info.some(r => !r.ok)) return toast('Không đọc được hồ sơ tủ — thử lại');
    const tus = info.map(r => r.data), so = tus[0].hoSo.soLSX, g = SX.data && SX.data.lsx.soLSX === so ? SX.data : (await call('sx.get', { soLSX: so }, 3)).data;
    if (!g) return toast('Không đọc được lệnh sản xuất');
    const t = g.template, co = S.co, cust = (S.data.customers || []).find(x => x.maKH === p.maKH) || {}, n = sers.length;
    const dd = p.ngay.split('-'), pad2 = x => String(x).padStart(2, '0');
    const qrs = await Promise.all(sers.map(s => qrSvg(tuLink(s), 3)));
    const conBy = {}; tus.forEach(x => (x.con || []).forEach(c => (conBy[c.maHang] = conBy[c.maHang] || []).push(c.serial)));
    const last = x => (x.kcs || []).slice(-1)[0] || { ketQua: [] };
    const kTab = (t.kcs || []).map((k, i) => { const okAll = tus.every(x => (last(x).ketQua[i] || {}).ketQua === 'DAT');
      return `<tr><td class="c">${i + 1}</td><td>${esc(k.noiDung)}</td><td>${esc(k.yeuCau)}</td><td class="c">${okAll ? '☑' : '☐'}</td><td class="c">${okAll ? '☐' : '☑'}</td></tr>`; }).join('');
    const kiem = [...new Set(tus.map(x => last(x).nguoiKiemTen || last(x).nguoiKiem).filter(Boolean))].join(', '), ngayKiem = [...new Set(tus.map(x => last(x).ngay).filter(Boolean))].join(', ');
    const words = QWords.read ? QWords.read(n) : String(n);
    const host = document.createElement('div'); host.id = 'printArea';
    host.innerHTML = `<div class="pv pxx">${p.trangThai === 'HUY' ? '<div class="pxx-void">ĐÃ HUỶ</div>' : ''}
      <div class="c"><b>${esc((co.tenDay || co.ten).toUpperCase())}</b><br>Địa chỉ: ${esc(co.diaChi || '')}${co.mst ? ' – MST: ' + esc(co.mst) : ''}</div>
      <h1>PHIẾU XUẤT XƯỞNG</h1><p class="c"><b>${esc((t.moTa ? 'TỦ ĐIỀU KHIỂN CHIẾU SÁNG CÔNG CỘNG' : t.ten).toUpperCase())}</b><br>Số: <b>${esc(p.soPXX)}</b><br><i>TP. Hồ Chí Minh, ngày ${dd[2]} tháng ${dd[1]} năm ${dd[0]}</i></p>
      <h2>I. THÔNG TIN CHUNG</h2><table class="pv-k"><tbody>
        <tr><td>Đơn vị sản xuất</td><td>${esc((co.tenDay || co.ten).toUpperCase())}</td></tr><tr><td>Khách hàng</td><td>${esc(cust.ten || '')}</td></tr>
        <tr><td>Địa chỉ khách hàng</td><td>${esc(cust.diaChi || '')}</td></tr><tr><td>Công trình</td><td>${esc(p.maCongTrinh ? projName(p.maCongTrinh) : '')}</td></tr>
        <tr><td>Địa điểm xây dựng</td><td>${esc(p.diaDiem || '')}</td></tr><tr><td>Căn cứ chế tạo</td><td>${esc(p.canCuCheTao || '')}</td></tr>
        ${p.soPhieuXuat || p.soHoaDon ? `<tr><td>Phiếu xuất kho / Hoá đơn</td><td>${esc([p.soPhieuXuat, p.soHoaDon].filter(Boolean).join(' / '))}</td></tr>` : ''}
        ${JSON.parse(p.traLai || '[]').length ? `<tr><td>Tủ khách đã trả lại</td><td>${JSON.parse(p.traLai).map(z => esc(z.serial) + ' (phiếu ' + esc(z.soPhieu) + ' ngày ' + esc(vnD(z.ngay)) + ')').join('; ')} — không còn hiệu lực theo phiếu này</td></tr>` : ''}</tbody></table>
      <h2>II. THÔNG TIN SẢN PHẨM</h2><table class="pv-k"><tbody>
        <tr><td>Tên sản phẩm</td><td>${esc(t.moTa || t.ten)}</td></tr><tr><td>Số lượng</td><td>${pad2(n)} (${esc(words)}) tủ</td></tr>
        ${t.kichThuoc ? `<tr><td>Kích thước vỏ tủ</td><td>${esc(t.kichThuoc)} mm (Cao × Rộng × Sâu)</td></tr>` : ''}${t.vatLieu ? `<tr><td>Vật liệu, màu sắc</td><td>${esc(t.vatLieu)}</td></tr>` : ''}
        ${t.ketCau ? `<tr><td>Kết cấu</td><td>${esc(t.ketCau)}</td></tr>` : ''}${t.filePLC ? `<tr><td>Chương trình PLC (firmware)</td><td>${esc(t.filePLC)}</td></tr>` : ''}${t.thongSoDien ? `<tr><td>Thông số điện</td><td>${esc(t.thongSoDien)}</td></tr>` : ''}
        <tr><td>Số xê-ri tủ</td><td><div class="pxx-qr">${sers.map((s, i) => `<div>${qrs[i]}<b>${esc(s)}</b></div>`).join('')}</div></td></tr></tbody></table>
      <h2>III. DANH MỤC THIẾT BỊ LẮP TRONG TỦ</h2><table class="pv-t"><thead><tr><th>STT</th><th>Tên thiết bị – Quy cách</th><th>Hãng / xuất xứ</th><th>ĐVT</th><th>SL</th></tr></thead><tbody>
        ${(t.bom || []).map((b, i) => { const it = itemOf(b.maHang), s = conBy[b.maHang];
          return `<tr><td class="c">${i + 1}</td><td>${esc(it.ten)}${it.quyCach ? ' – ' + esc(it.quyCach) : ''}${s ? `<br><small>Serial: ${s.map(esc).join(', ')}</small>` : ''}</td><td>${esc([it.hang, it.xuatXu].filter(Boolean).join(' / '))}</td><td class="c">${esc(it.dvt)}</td><td class="c">${pad2(num(b.soLuong))}${n > 1 ? '/tủ' : ''}</td></tr>`; }).join('')}</tbody></table>
      ${t.ghiChuDM ? `<p><i>Ghi chú: ${esc(t.ghiChuDM)}</i></p>` : ''}
      <h2>IV. KẾT QUẢ KIỂM TRA XUẤT XƯỞNG</h2><table class="pv-t"><thead><tr><th>STT</th><th>Nội dung kiểm tra</th><th>Yêu cầu</th><th>Đạt</th><th>Không đạt</th></tr></thead><tbody>${kTab}</tbody></table>
      <p>Người kiểm tra: ${esc(kiem)} · ngày kiểm: ${esc(ngayKiem)}${n > 1 ? ` · kết quả đạt áp dụng cho cả ${n} tủ` : ''}</p>
      <h2>V. KẾT LUẬN</h2><p class="pxx-kl">Tủ điều khiển nêu trên đã được kiểm tra theo các nội dung tại mục IV, đủ điều kiện xuất xưởng, giao cho khách hàng để lắp đặt tại công trình. Thời gian bảo hành ${esc(t.thangBH || 12)} tháng kể từ ngày bàn giao, theo điều kiện sử dụng và vận hành đúng hướng dẫn. Bảo hành không áp dụng cho hư hỏng do thiên tai, sét đánh, quá áp lưới điện, tác động cơ học hoặc tự ý sửa chữa, thay đổi đấu nối.${p.ghiChu ? ' ' + esc(p.ghiChu) : ''}<br>Liên hệ bảo hành: ${esc(co.tenDay || co.ten)}${co.dienThoai ? ' – ĐT ' + esc(co.dienThoai) : ''}.<br>Kèm theo: Sơ đồ mạch và hình ảnh tủ thực tế tại xưởng (Phụ lục).</p>
      <div class="pv-sign pxx-sign"><div><b>ĐẠI DIỆN BÊN NHẬN</b><br><i>(Ký, ghi rõ họ tên, ngày)</i></div><div><b>NGƯỜI KIỂM TRA</b><br><i>(Ký, ghi rõ họ tên)</i></div><div><b>ĐƠN VỊ SẢN XUẤT</b><br><b>GIÁM ĐỐC</b><br><i>(Ký, đóng dấu)</i><br><br><br><br><b>${esc(co.giamDoc || '')}</b></div></div>
      <p class="pv-foot">In từ QLHH v${VER} · quét QR để tra hồ sơ tủ (cần đăng nhập)</p></div>`;
    document.body.appendChild(host); document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); host.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
  }

  // ----- hồ sơ tủ (tra xê-ri / quét QR) -----
  function serialSearch() {
    dialog('Tra xê-ri', `${fld('serial', 'Số xê-ri tủ hoặc serial linh kiện', '', { req: 1 })}${hasCam() ? `<button class="btn" type="button" id="scanQ" style="width:100%;margin-top:8px">${ic('search')} Quét mã QR trên tem tủ</button>` : ''}<p class="mut" style="font-size:12.5px">Mã QR có trên tem tủ và phiếu xuất xưởng.</p>`,
      async (v, dlg) => { if (!v.serial.trim()) { showErrors(dlg, { serial: 'Nhập số xê-ri' }); return false; } dlg.close(); tuView(serOf(v.serial)); return false; },
      d => { d._noGuard = true; const b = $('#scanQ', d); if (b) b.onclick = () => { d.close(); scanTu(); }; }, 'Tra');
  }
  function viewTu(m) {
    const p = location.hash.split('/'), co = p[2], ser = decodeURIComponent(p[3] || '');
    if (co && co !== S.co.id) { m.innerHTML = header('Hồ sơ tủ') + `<div class="card empty">Tủ <b class="mono">${esc(ser)}</b> thuộc công ty <b>${esc((company(co) || {}).ten || co)}</b> — đổi công ty để xem.<br><button class="btn" type="button" id="swc" style="margin-top:12px">Đổi công ty</button></div>`; $('#swc').onclick = switchCo; return; }
    location.replace('#/sx'); if (ser) setTimeout(() => tuView(ser), 0);
  }
  async function tuView(ser) {
    const r = await load('serial.get', { serial: ser }, 'Đang mở hồ sơ ' + ser + '…');
    if (!r.ok) return toast(r.code === 'NOT_FOUND' ? 'Không có xê-ri ' + ser : 'Lỗi: ' + (r.error || r.code));
    const x = r.data, h = x.hoSo, sr = x.serial || {}, ST = { TRONG_KHO: 'Trong kho', DA_BAN: 'Đã bán/giao', DA_LAP: 'Đã lắp vào tủ', HUY: 'Huỷ', HANG_LOI: 'Hàng lỗi', DA_TRA_NCC: 'Đã trả NCC', MAT: 'Mất', DA_THAY: 'Đã thay ra (bảo hành)', GUI_NCC: 'Đang gửi NCC' };
    if (!h) return dialog('Serial ' + esc(sr.serial), `<dl class="dl"><dt>Mã hàng</dt><dd>${esc(sr.maHang)} ${esc(x.item.ten || '')}</dd><dt>Hãng</dt><dd>${esc(sr.hang)}</dd><dt>Trạng thái</dt><dd>${ST[sr.trangThai] || esc(sr.trangThai)}${sr.kho ? ' · ' + esc(khoName(sr.kho)) : ''}</dd>${x.cha ? `<dt>Lắp trong tủ</dt><dd><button class="linkbtn mono" type="button" id="toCha">${esc(x.cha.serial)}</button></dd>` : ''}</dl>${x.baoHanh && (x.baoHanh.serialTu || sr.trangThai === 'DA_BAN') ? bhBlock(x) : ''}
      ${bhCanAct(x) ? `<div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" type="button" id="tB">${ic('shield')} Tiếp nhận bảo hành</button></div>` : ''}`, null, d => { const b = $('#toCha', d); if (b) b.onclick = () => { d.close(); tuView(x.cha.serial); }; bhBind(d, x, sr.serial); });
    const qr = await qrSvg(tuLink(h.serial), 4).catch(() => '');
    const live = canEdit() && !S.offline && sr.trangThai === 'TRONG_KHO' && !h.soPXX && h.trangThai !== 'HUY';
    const evs = (() => { try { return JSON.parse(h.lichSu || '[]'); } catch (e) { return []; } })(), ev = kcsLai(h) && sr.trangThai === 'TRONG_KHO' ? retEv(h) : null;
    const openT = (x.pbh || []).filter(t => ['TIEP_NHAN', 'DANG_XU_LY'].includes(t.trangThai)).slice(-1)[0], canThay = canEdit() && !S.offline && !!openT && sr.trangThai === 'DA_BAN';
    dialog('Hồ sơ tủ ' + esc(h.serial), `<div class="tuhead"><div class="tuqr">${qr}</div><div><div class="mono"><b>${esc(h.serial)}</b></div><b>${esc(x.item.ten || h.maHang)}</b><br>
        ${h.trangThai === 'HUY' ? '<span class="tag stop">Hồ sơ đã huỷ</span>' : kcsTag(h)} <span class="tag">${ST[sr.trangThai] || esc(sr.trangThai || '')}${sr.kho ? ' · ' + esc(khoName(sr.kho)) : ''}</span></div></div>
      ${ev ? `<p class="warnbar" role="status">${ic('warn')} Khách trả tủ ngày ${esc(vnD(ev.ngay))} (phiếu ${esc(ev.soPhieu)}) — <b>cần kiểm tra xuất xưởng lại</b> trước khi bán hoặc phát hành phiếu xuất xưởng mới.</p>` : ''}
      <dl class="dl"><dt>Lệnh sản xuất</dt><dd><button class="linkbtn mono" type="button" id="toL">${esc(h.soLSX)}</button></dd><dt>Nhập kho</dt><dd>${esc(vnD(h.ngayNhap))} · <button class="linkbtn mono" type="button" data-vso="${esc(h.soPhieuNhap)}">${esc(h.soPhieuNhap)}</button></dd>${h.phieuXuat ? `<dt>Xuất kho</dt><dd>${esc(vnD(h.ngayXuat))} · <button class="linkbtn mono" type="button" data-vso="${esc(h.phieuXuat)}">${esc(h.phieuXuat)}</button></dd>` : ''}
        <dt>Mẫu</dt><dd>${esc(h.maMau)} bản ${esc(h.phienBan)}${h.kichThuoc ? ' · ' + esc(h.kichThuoc) + ' mm' : ''}</dd>
        ${x.pxx ? `<dt>Phiếu xuất xưởng</dt><dd><button class="linkbtn mono" type="button" id="tP2">${esc(x.pxx.soPXX)}</button> · ${esc(vnD(x.pxx.ngay))}${x.pxx.maKH ? ' · ' + esc(custName(x.pxx.maKH)) : ''}</dd>` : ''}
        ${x.lsx && x.lsx.maKH ? `<dt>Khách theo lệnh</dt><dd>${esc(custName(x.lsx.maKH))}${x.lsx.maCongTrinh ? ' · ' + esc(projName(x.lsx.maCongTrinh)) : ''}</dd>` : ''}
        ${x.giaThanh !== undefined && isQT() ? `<dt>Giá thành</dt><dd>${money(x.giaThanh)} <small class="mut">(khi bán, giá vốn theo bình quân của mã thành phẩm)</small></dd>` : ''}</dl>
      <h3 class="h3">Linh kiện có serial trong tủ</h3>${(x.con || []).length ? `<ul class="plain conlist">${x.con.map(c => `<li><span><span class="mono">${esc(c.serial)}</span> — ${esc(itemOf(c.maHang).ten)}</span>${canThay ? `<button class="btn ghost" type="button" data-thay="${esc(c.maHang)}" data-ts="${esc(c.serial)}">${ic('tool')} Thay ${esc(itemOf(c.maHang).ten)}</button>` : ''}</li>`).join('')}</ul>` : '<p class="mut">Không có.</p>'}
      ${canThay ? `<p style="margin:6px 0 0"><button class="btn ghost" type="button" id="tThayK">${ic('tool')} Thay linh kiện khác (phiếu ${esc(openT.soPBH)})</button></p>` : ''}
      ${evs.length ? `<h3 class="h3">Lịch sử giao – trả (${evs.length})</h3><ol class="kcsum">${evs.map(e => `<li>Xuất ${esc(vnD(e.ngayXuat))} · <button class="linkbtn mono" type="button" data-vso="${esc(e.phieuXuat)}">${esc(e.phieuXuat)}</button>${e.maKH ? ' · ' + esc(custName(e.maKH)) : ''}${e.ngayBanGiao ? ' · bàn giao ' + esc(vnD(e.ngayBanGiao)) + (e.hanBH ? ', hạn BH ' + esc(vnD(e.hanBH)) : '') : ''}${e.soPXX ? ' · PXX ' + esc(e.soPXX) : ''} → khách trả ${esc(vnD(e.ngay))} · <button class="linkbtn mono" type="button" data-vso="${esc(e.soPhieu)}">${esc(e.soPhieu)}</button>${(e.pbh || []).length ? ' · đóng ' + e.pbh.map(z => esc(z.soPBH)).join(', ') : ''}${e.huy ? ' <span class="tag">phiếu trả đã đảo</span>' : ''}</li>`).join('')}</ol>` : ''}
      ${bhBlock(x)}<h3 class="h3">Kiểm tra xuất xưởng (${(x.kcs || []).length} lần)</h3>${(x.kcs || []).length ? x.kcs.slice().reverse().map(k => `<details ${k === x.kcs[x.kcs.length - 1] ? 'open' : ''}><summary>Lần ${k.lanKiem} · ${esc(vnD(k.ngay))} · ${k.dat ? '<b class="ok-ink">Đạt</b>' : '<b class="bad-ink">Không đạt</b>'} · ${esc(k.nguoiKiem)}</summary><ol class="kcsum">${k.ketQua.map(q => `<li>${esc(q.noiDung)} — ${q.ketQua === 'DAT' ? '✓' : `<b class="bad-ink">✗ ${esc(q.ghiChu)}</b>`}</li>`).join('')}</ol></details>`).join('') : '<p class="mut">Chưa kiểm.</p>'}
      <div class="acts stickacts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${live ? `<button class="btn pri" type="button" id="tK">${ic('check')} Kiểm tra xuất xưởng</button>` : ''}${x.pxx ? `<button class="btn" type="button" id="tP">In PXX</button>${isQT() && !S.offline && x.pxx.trangThai === 'PHAT_HANH' ? '<button class="btn danger" type="button" id="tPH">Huỷ PXX</button>' : ''}` : ''}${bhCanAct(x) ? `<button class="btn pri" type="button" id="tL">${ic('pin')} ${(x.baoHanh || {}).ngayBanGiao ? 'Di dời' : 'Ghi bàn giao'}</button><button class="btn" type="button" id="tB">${ic('shield')} Tiếp nhận bảo hành</button>` : ''}<button class="btn" type="button" id="tTem">In tem QR</button></div>`, null, d => {
      d.classList.add('wide'); bhBind(d, x, h.serial);
      $('#toL', d).onclick = () => { d.close(); openLSX(h.soLSX); };
      const k = $('#tK', d); if (k) k.onclick = async () => { d.close(); const g = await load('sx.get', { soLSX: h.soLSX }, 'Đang mở lệnh…'); if (!g.ok) return toast('Không mở được lệnh'); kcsScreen(h.serial, g.data.template, g.data.hoSoTu.filter(c => c.trangThai !== 'HUY')); };
      const pp = $('#tP', d); if (pp) pp.onclick = () => printPXX(x.pxx.soPXX); const pp2 = $('#tP2', d); if (pp2) pp2.onclick = () => printPXX(x.pxx.soPXX);
      $$('[data-vso]', d).forEach(b => b.onclick = () => { d.close(); voucherView(b.dataset.vso); });   // hồ sơ tủ → phiếu nhập / xuất
      const ph = $('#tPH', d); if (ph) ph.onclick = () => { d.close(); pxxCancelForm(x.pxx); };
      $('#tTem', d).onclick = () => printTem(h.serial, x.item.ten || h.maHang, qr);
      $$('[data-thay]', d).forEach(b => b.onclick = () => { d.close(); replaceForm(openT, { maHang: b.dataset.thay, cu: [b.dataset.ts] }); });
      const tk = $('#tThayK', d); if (tk) tk.onclick = () => { d.close(); replaceForm(openT); };
    });
  }
  function printTem(ser, ten, qr) {   // tem dán tủ: QR ≥ 25 mm + số xê-ri
    const host = document.createElement('div'); host.id = 'printArea';
    host.innerHTML = `<div class="tem"><div class="tem-qr">${qr}</div><div><b>${esc(S.co.tenDay || S.co.ten)}</b><br>${esc(ten)}<br><b class="mono" style="font-size:14pt">${esc(ser)}</b><br><small>Quét để tra hồ sơ, bảo hành</small></div></div>`;
    document.body.appendChild(host); document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); host.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
  }

  // ---------------- lắp đặt & bảo hành (BH-1) ----------------
  const BH_TT = { CON_BH: 'Còn bảo hành', SAP_HET: 'Sắp hết bảo hành', HET_BH: 'Hết bảo hành', KHONG_BH: 'Không bảo hành', CHUA_BAN_GIAO: 'Chưa bàn giao' };
  const PBH_TT = { TIEP_NHAN: 'Tiếp nhận', DANG_XU_LY: 'Đang xử lý', HOAN_THANH: 'Hoàn thành', TU_CHOI: 'Từ chối', DONG_KHACH_TRA: 'Đóng — khách trả tủ' };
  const HINH = { BAO_HANH: 'Bảo hành', THIEN_CHI: 'Bảo hành thiện chí', THU_TIEN: 'Sửa có thu tiền' };
  const pbhCls = t => t.trangThai === 'HOAN_THANH' ? 'ok' : t.trangThai === 'TU_CHOI' ? 'bad' : t.trangThai === 'DONG_KHACH_TRA' ? '' : 'warn';
  const pbhObj = t => t.serialTu || t.serial ? `<span class="mono">${esc(t.serialTu || t.serial)}</span>` : `${esc(itemOf(t.maHang).ten || t.maHang)} × ${num(t.soLuong)}`;
  const NN = { LOI_THIET_BI: 'Lỗi thiết bị (nhà sản xuất)', LOI_LAP_RAP: 'Lỗi lắp ráp tại xưởng', LOI_LAP_DAT: 'Lỗi lắp đặt tại công trình', SET_DANH: 'Sét đánh', QUA_AP: 'Quá áp lưới điện', TAC_DONG: 'Tác động cơ học / ngập nước', TU_Y_SUA: 'Tự ý sửa chữa, đổi đấu nối', KHAC: 'Khác' };
  const TT_BH = { TRONG_BH: 'Trong bảo hành', HET_BH: 'Hết bảo hành', CHUA_BAN_GIAO: 'Chưa ghi bàn giao', KHONG_BH: 'Không bảo hành' };
  const BH = { tab: 'tu', f: '', q: '' };
  const vnD = d => d ? String(d).split('-').reverse().join('/') : '';
  const addDay = d => new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
  const mapUrl = v => v && v.viDo !== '' && v.viDo != null ? `https://www.google.com/maps?q=${v.viDo},${v.kinhDo}` : '';
  function bhTag(t) { t = t || {}; const c = { CON_BH: 'ok', SAP_HET: 'warn', HET_BH: 'bad', KHONG_BH: '', CHUA_BAN_GIAO: t.canhBao ? 'warn' : '' }[t.ma] || '';
    return `<span class="tag ${c}">${t.canhBao ? ic('warn') + ' ' : ''}${BH_TT[t.ma] || '—'}${t.ma === 'CON_BH' || t.ma === 'SAP_HET' ? ' · còn ' + t.conNgay + ' ngày' : t.ma === 'HET_BH' ? ' · quá ' + t.quaNgay + ' ngày' : ''}</span>`; }
  function bhCanAct(x) { const b = x.baoHanh || {}, sr = x.serial || {}, tu = b.serialTu ? true : !!x.hoSo; return canEdit() && !S.offline && tu && (x.hoSo ? sr.trangThai === 'DA_BAN' : true); }
  function bhBlock(x) {
    const b = x.baoHanh; if (!b) return ''; const v = b.viTri, mu = mapUrl(v);
    return `<h3 class="h3">Lắp đặt & bảo hành${b.serialTu && !x.hoSo ? ' — theo tủ ' + esc(b.serialTu) : ''}</h3><dl class="dl">
      <dt>Tình trạng</dt><dd>${bhTag(b.tinhTrang)}${b.hanBH ? ` đến hết <b>${vnD(b.hanBH)}</b>` : ''}</dd>
      <dt>Bàn giao</dt><dd>${b.ngayBanGiao ? `${vnD(b.ngayBanGiao)} · bảo hành ${esc(b.thangBH)} tháng` : `<i>Chưa ghi bàn giao</i>${b.ngayXuat ? ' · xuất kho ' + vnD(b.ngayXuat) : ''}${(b.tinhTrang || {}).canhBao ? ' <b class="bad-ink">— đã quá 30 ngày</b>' : ''}`}</dd>
      ${v ? `<dt>Vị trí hiện tại</dt><dd>${v.tenTaiCT ? '<b>' + esc(v.tenTaiCT) + '</b> · ' : ''}${esc(v.diaChi)}${v.maCongTrinh ? '<br><small class="mut">' + esc(projName(v.maCongTrinh)) + (v.maKH ? ' · ' + esc(custName(v.maKH)) : '') + '</small>' : ''}${mu ? `<br><a class="linkbtn" href="${mu}" target="_blank" rel="noopener">${ic('pin')} Xem bản đồ (${v.viDo}, ${v.kinhDo})</a>` : ''}</dd>` : ''}</dl>
      ${(x.lapDat || []).length > (isQT() ? 0 : 1) ? `<details><summary>Lịch sử vị trí (${x.lapDat.length} lần)</summary><ol class="kcsum">${x.lapDat.map(l => `<li>${vnD(l.ngay)} · ${l.loai === 'BAN_GIAO' ? 'Bàn giao' : 'Di dời'} · ${esc(l.diaChi)}${l.soBBBG ? ' · ' + esc(l.soBBBG) : ''}${isQT() && !S.offline ? ` <button class="linkbtn" type="button" data-ldv="${esc(l.id)}">Huỷ dòng</button>` : ''}</li>`).join('')}</ol></details>` : ''}
      ${(x.pbh || []).length ? `<h3 class="h3">Phiếu bảo hành (${x.pbh.length})</h3><div class="list">${x.pbh.slice().reverse().map(t => `<div class="it" data-pbh="${esc(t.soPBH)}" role="button" tabindex="0"><div><span class="mono">${esc(t.soPBH)}</span> · ${vnD(t.ngay)} <span class="tag ${pbhCls(t)}">${PBH_TT[t.trangThai] || esc(t.trangThai)}</span><br><small class="mut">${esc(t.moTaLoi)}</small></div></div>`).join('')}</div>` : ''}`;
  }
  function bhBind(d, x, ser) {
    const l = $('#tL', d); if (l) l.onclick = () => { d.close(); installForm(x); };
    const b = $('#tB', d); if (b) b.onclick = () => { d.close(); ticketForm(ser, x); };
    $$('[data-pbh]', d).forEach(r => r.onclick = () => { d.close(); ticketView(r.dataset.pbh); });
    $$('[data-ldv]', d).forEach(b => b.onclick = () => { d.close(); dialog('Huỷ dòng lắp đặt ' + esc(b.dataset.ldv), `<p>Dùng khi ghi nhầm (ngày, số tháng BH, vị trí). Huỷ rồi ghi lại cho đúng; phiếu bảo hành đã lập giữ nguyên.</p>${fld('lyDo', 'Lý do', '', { req: 1, type: 'textarea' })}`,
      async (v, dlg) => { if (!v.lyDo.trim()) { showErrors(dlg, { lyDo: 'Nhập lý do' }); return false; } const r = await submitSX(dlg, 'install.void', { id: b.dataset.ldv, lyDo: v.lyDo }, () => 'Đã huỷ dòng ' + b.dataset.ldv); if (r) setTimeout(() => tuView(ser), 0); return !!r; }, null, 'Huỷ dòng'); });
  }
  function installForm(x) {
    const h = x.hoSo, b = x.baoHanh || {}, v0 = b.viTri || {}, moi = !b.ngayBanGiao, d = S.data;
    const kh = v0.maKH || (x.pxx && x.pxx.maKH) || (x.lsx && x.lsx.maKH) || '', ct = v0.maCongTrinh || (x.pxx && x.pxx.maCongTrinh) || (x.lsx && x.lsx.maCongTrinh) || '';
    dialog((moi ? 'Ghi bàn giao — ' : 'Di dời — ') + esc(h.serial), `<input type="hidden" name="loai" value="${moi ? 'BAN_GIAO' : 'DI_DOI'}">
      <div class="grid2"><div>${fld('ngay', moi ? 'Ngày bàn giao (bắt đầu tính bảo hành)' : 'Ngày di dời', S.today, { type: 'date', max: S.today })}</div><div>${fld('soBBBG', 'Số biên bản bàn giao', '')}</div>
        <div>${fld('maKH', 'Khách hàng', kh, { opts: optsOf(d.customers, 'maKH', 'ten', '— Không —') })}</div><div>${fld('maCongTrinh', 'Công trình', ct, { opts: optsOf(d.projects, 'maCongTrinh', 'ten', '— Không —') })}</div>
        <div>${fld('tenTaiCT', 'Tên tủ tại công trình', v0.tenTaiCT || '')}</div>${moi ? `<div>${fld('thangBH', 'Bảo hành theo hợp đồng (tháng)', '', { im: 'numeric' })}<small class="mut">Để trống = ${esc(b.thangBH || 12)} tháng theo mẫu tủ</small></div>` : ''}</div>
      ${fld('diaChi', 'Địa chỉ / vị trí lắp', moi ? (x.pxx && x.pxx.diaDiem) || '' : '', { req: 1, type: 'textarea' })}
      <div class="grid2"><div>${fld('viDo', 'Vĩ độ', '', { im: 'decimal' })}</div><div>${fld('kinhDo', 'Kinh độ', '', { im: 'decimal' })}</div></div>
      <button class="btn" type="button" id="gps">${ic('pin')} Lấy vị trí hiện tại (đứng cạnh tủ)</button> <small class="mut" id="gpsMsg"></small>
      ${fld('ghiChu', 'Ghi chú', '')}`,
      async (v, dlg) => { const c = QBH.validateInstall(v, { today: S.today, ngayXuat: b.ngayXuat }); if (!c.ok) { showErrors(dlg, c.errors); dlgMsg(dlg, Object.values(c.errors)[0]); return false; }
        const r = await submitSX(dlg, 'install.add', { serial: h.serial, lapDat: v }, z => `Đã ghi ${moi ? 'bàn giao' : 'di dời'} · bảo hành đến hết ${vnD(z.hanBH)}`); if (r) setTimeout(() => tuView(h.serial), 0); return !!r; },
      dlg => { const gb = $('#gps', dlg); gb.onclick = () => { const m = $('#gpsMsg', dlg); if (!navigator.geolocation) { m.textContent = 'Máy không hỗ trợ định vị — nhập tay hoặc bỏ trống'; return; } if (gb.disabled) return; gb.disabled = true; m.textContent = 'Đang lấy vị trí…';
        navigator.geolocation.getCurrentPosition(p => { gb.disabled = false; const a = Math.round(p.coords.accuracy); $('#f_viDo', dlg).value = p.coords.latitude.toFixed(6); $('#f_kinhDo', dlg).value = p.coords.longitude.toFixed(6);
            m.innerHTML = a > 50 ? `<b class="bad-ink">Sai số ${a} m — ra chỗ thoáng rồi bấm lại</b>` : `Sai số khoảng ${a} m`; },
          e => { gb.disabled = false; m.textContent = e.code === 1 ? 'Chưa cho phép định vị — bật quyền vị trí cho trình duyệt (hoặc nhập tay)' : 'Không lấy được vị trí — thử lại ngoài trời, hoặc nhập tay'; }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }); }; }, moi ? 'Ghi bàn giao' : 'Ghi di dời');
  }
  function ticketForm(ser, x) {
    const b = x.baoHanh || {};
    dialog('Tiếp nhận bảo hành — ' + esc(b.serialTu || ser), `<p>${bhTag(b.tinhTrang)}${b.hanBH ? ' hạn đến hết ' + vnD(b.hanBH) : ''}${b.serialTu && b.serialTu !== ser ? `<br><small class="mut">Linh kiện ${esc(ser)} trong tủ ${esc(b.serialTu)}</small>` : ''}</p>
      <div class="grid2"><div>${fld('ngay', 'Ngày tiếp nhận', S.today, { type: 'date', max: S.today })}</div><div>${fld('nguoiBao', 'Người báo (tên, điện thoại)', '')}</div></div>
      ${fld('moTaLoi', 'Hiện tượng lỗi', '', { req: 1, type: 'textarea' })}${fld('ghiChu', 'Ghi chú', '')}`,
      async (v, dlg) => { const c = QBH.validateTicket(v, { today: S.today }); if (!c.ok) { showErrors(dlg, c.errors); return false; }
        const r = await submitSX(dlg, 'bh.create', { serial: ser, phieu: v }, z => `Đã lập phiếu ${z.soPBH} · ${TT_BH[z.tinhTrangBH] || z.tinhTrangBH}`); if (r) setTimeout(() => ticketView(r.soPBH), 0); return !!r; }, null, 'Lập phiếu');
  }
  function ticketView(so) {
    const t = (S.data.pbh || []).find(z => z.soPBH === so); if (!t) return toast('Không có phiếu ' + so);
    const open = ['TIEP_NHAN', 'DANG_XU_LY'].includes(t.trangThai), live = canEdit() && !S.offline && open, tt = JSON.parse(t.thayThe || '[]'), hv = JSON.parse(t.huyThay || '[]');
    const mien = QBH.mienPhi(t.tinhTrangBH, t.nguyenNhan), cabT = !!t.serialTu;
    const lan = [...new Set(tt.map(z => z.soPhieuXuat).filter(Boolean))].concat(String(t.soPhieuXuat || '').split(/\s*,\s*/).filter(z => z && !tt.some(y => y.soPhieuXuat === z)));
    dialog('Phiếu bảo hành ' + esc(t.soPBH), `<dl class="dl"><dt>Trạng thái</dt><dd><span class="tag ${pbhCls(t)}">${PBH_TT[t.trangThai] || esc(t.trangThai)}</span> ${TT_BH[t.tinhTrangBH] ? `<span class="tag ${t.tinhTrangBH === 'TRONG_BH' ? 'ok' : ''}">${TT_BH[t.tinhTrangBH]}${t.hanBH ? ' · hạn ' + vnD(t.hanBH) : ''}</span>` : ''}</dd>
        ${t.serialTu || t.serial ? `<dt>${cabT ? 'Tủ' : 'Serial'}</dt><dd><button class="linkbtn mono" type="button" id="pT">${esc(t.serialTu || t.serial)}</button>${t.serialTu && t.serial !== t.serialTu ? ` · báo theo linh kiện <span class="mono">${esc(t.serial)}</span>` : ''}</dd>`
          : `<dt>Hàng</dt><dd>${esc(itemOf(t.maHang).ten || t.maHang)} × ${num(t.soLuong)} ${esc(itemOf(t.maHang).dvt)} · phiếu xuất <button class="linkbtn mono" type="button" id="pPX">${esc(t.phieuGoc)}</button>${t.maKH ? ' · ' + esc(custName(t.maKH)) : ''}</dd>`}
        <dt>Tiếp nhận</dt><dd>${vnD(t.ngay)}${t.nguoiBao ? ' · ' + esc(t.nguoiBao) : ''}</dd><dt>Hiện tượng</dt><dd>${esc(t.moTaLoi)}</dd>
        ${t.nguyenNhan ? `<dt>Nguyên nhân</dt><dd>${esc(NN[t.nguyenNhan] || t.nguyenNhan)}${QBH.NGOAI_BH.includes(t.nguyenNhan) ? ' <span class="tag bad">ngoài bảo hành</span>' : ''}</dd>` : ''}
        ${t.hinhThuc ? `<dt>Hình thức</dt><dd>${esc(HINH[t.hinhThuc] || t.hinhThuc)}${Number(t.phiSua) ? ' · phí sửa thu khách <b>' + money(t.phiSua) + '</b>' : ''}</dd>` : ''}
        ${t.thienChi ? `<dt>Bảo hành thiện chí</dt><dd>${esc(t.thienChi)}</dd>` : ''}${t.ketQua ? `<dt>Kết quả</dt><dd>${esc(t.ketQua)}</dd>` : ''}${t.ngayDong ? `<dt>Đóng phiếu</dt><dd>${vnD(t.ngayDong)}</dd>` : ''}
        ${tt.length ? `<dt>Đã thay</dt><dd><ul class="plain">${tt.map(z => `<li>${esc(vnD(z.ngay))} · ${esc(itemOf(z.maHang).ten || z.maHang)} × ${num(z.soLuong)}${z.serialMoi.length ? ' · mới <span class="mono">' + z.serialMoi.map(esc).join(', ') + '</span>' : ''}${z.serialCu.length ? ' · thu hồi <span class="mono">' + z.serialCu.map(esc).join(', ') + '</span>' : ''}${z.hinhThuc === 'THU_TIEN' ? ' · <i>thu tiền</i>' : ''}</li>`).join('')}</ul><small class="mut">${esc([t.soPhieuXuat, t.soPhieuLoi].filter(Boolean).join(' · '))}</small></dd>` : ''}
        ${hv.length ? `<dt>Lần thay đã huỷ</dt><dd><ul class="plain">${hv.map(z => `<li><span class="mono">${esc(z.soPhieuXuat)}</span>${z.soPhieuLoi ? ' + <span class="mono">' + esc(z.soPhieuLoi) + '</span>' : ''} · huỷ ${esc(vnD(z.ngay))} (đảo ${esc([z.daoXuat, z.daoLoi].filter(Boolean).join(', '))}) · ${esc(z.lyDo)}</li>`).join('')}</ul></dd>` : ''}</dl>
      ${!mien && live ? `<p class="mut" style="font-size:12.5px">Ngoài bảo hành: chọn <b>Sửa có thu tiền</b> khi thay linh kiện, hoặc lập phiếu xuất bán linh kiện rời cho khách.</p>` : ''}
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${live ? `<button class="btn" type="button" id="pR">${ic('tool')} ${cabT ? 'Thay linh kiện' : 'Đổi hàng / thay'}</button>` : ''}${live && !mien ? '<button class="btn" type="button" id="pXB">Lập phiếu xuất bán</button>' : ''}${live ? `<button class="btn pri" type="button" id="pU">Cập nhật xử lý</button>` : ''}<button class="btn" type="button" id="pPr">In phiếu</button>
        ${isQT() && !S.offline && lan.length ? lan.map(z => `<button class="btn danger" type="button" data-hv="${esc(z)}">Huỷ lần thay ${esc(z)}</button>`).join('') : ''}</div>`, null, d => {
      const pt = $('#pT', d); if (pt) pt.onclick = () => { d.close(); tuView(t.serialTu || t.serial); };
      const px = $('#pPX', d); if (px) px.onclick = () => { d.close(); voucherView(t.phieuGoc); };
      const r = $('#pR', d); if (r) r.onclick = () => { d.close(); replaceForm(t); };
      const xb = $('#pXB', d); if (xb) xb.onclick = async () => { d.close(); const k = await ticketCust(t); voucherForm('XUAT_BAN', { maKH: k.maKH, maCongTrinh: k.maCongTrinh, lyDo: 'Bán linh kiện thay cho ' + (t.serialTu ? 'tủ ' + t.serialTu : t.serial || t.maHang) + ' — phiếu BH ' + t.soPBH, lines: [{}] }); };
      const u = $('#pU', d); if (u) u.onclick = () => { d.close(); ticketUpdate(t); };
      $('#pPr', d).onclick = () => printPBH(t);
      $$('[data-hv]', d).forEach(b => b.onclick = () => { d.close(); replaceVoidForm(t, b.dataset.hv); });
    });
  }
  /** Khách + công trình của phiếu BH (vị trí lắp hiện tại của tủ / phiếu xuất của hàng) — điền sẵn phiếu xuất bán linh kiện. */
  async function ticketCust(t) {
    if (t.serialTu || t.serial) { const g = await load('serial.get', { serial: t.serialTu || t.serial }, 'Đang đọc hồ sơ…'); if (g.ok) { const v = (g.data.baoHanh || {}).viTri || {}, l = g.data.lsx || {}; return v.maKH ? { maKH: v.maKH, maCongTrinh: v.maCongTrinh } : { maKH: l.maKH || '', maCongTrinh: l.maCongTrinh || '' }; } }
    const p = (S.data.vouchers || []).find(z => z.soPhieu === t.phieuGoc) || {}; return { maKH: t.maKH || p.maKH || '', maCongTrinh: p.maCongTrinh || '' };
  }
  function replaceVoidForm(t, so) {
    dialog('Huỷ lần thay ' + esc(so), `<p>Đảo phiếu xuất <b class="mono">${esc(so)}</b> (linh kiện mới về kho) và phiếu thu hồi cùng lần thay (linh kiện cũ lắp lại vào tủ). Dùng khi ghi nhầm; phiếu bảo hành giữ lịch sử lần huỷ.</p>
      ${fld('ngay', 'Ngày phiếu đảo', S.today, { type: 'date', max: S.today })}${fld('lyDo', 'Lý do huỷ (ít nhất 10 ký tự)', '', { req: 1, type: 'textarea' })}`,
      async (v, dlg) => { if (v.lyDo.trim().length < 10) { showErrors(dlg, { lyDo: 'Ghi rõ lý do (≥ 10 ký tự)' }); return false; }
        const r = await submitSX(dlg, 'bh.replaceVoid', { soPBH: t.soPBH, soPhieuXuat: so, lyDo: v.lyDo, ngay: v.ngay }, z => `Đã huỷ lần thay ${so} · đảo ${[z.daoXuat, z.daoLoi].filter(Boolean).join(', ')}`); if (r) setTimeout(() => ticketView(t.soPBH), 0); return !!r; }, null, 'Huỷ lần thay');
  }
  function ticketUpdate(t) {
    const next = { TIEP_NHAN: ['DANG_XU_LY', 'HOAN_THANH', 'TU_CHOI'], DANG_XU_LY: ['HOAN_THANH', 'TU_CHOI'] }[t.trangThai] || [];
    dialog('Cập nhật ' + esc(t.soPBH), `${fld('trangThai', 'Chuyển sang', next[0], { opts: next.map(k => [k, PBH_TT[k]]) })}${fld('nguyenNhan', 'Nguyên nhân', t.nguyenNhan, { opts: [['', '— Chưa xác định —'], ...Object.entries(NN)] })}
      ${fld('ketQua', 'Kết quả xử lý / lý do từ chối', t.ketQua, { type: 'textarea' })}${fld('phiSua', 'Phí sửa chữa thu khách (₫, để trống nếu miễn phí)', t.phiSua === '' || t.phiSua === undefined ? '' : String(t.phiSua), { im: 'numeric' })}<p class="mut" style="font-size:12.5px">Sét đánh, quá áp, tác động cơ học, tự ý sửa chữa thuộc điều kiện loại trừ bảo hành ghi trên phiếu xuất xưởng. Phí sửa là căn cứ xuất hoá đơn dịch vụ.</p>`,
      async (v, dlg) => { const c = QBH.validateUpdate(v, t.trangThai); if (!c.ok) { showErrors(dlg, c.errors); dlgMsg(dlg, Object.values(c.errors)[0]); return false; }
        const ps = String(v.phiSua || '').replace(/[.\s,₫]/g, ''); if (ps && !/^\d+$/.test(ps)) { showErrors(dlg, { phiSua: 'Số tiền VND' }); return false; }
        const r = await submitSX(dlg, 'bh.update', { soPBH: t.soPBH, trangThai: v.trangThai, ketQua: v.ketQua, nguyenNhan: v.nguyenNhan, phiSua: ps === '' ? undefined : Number(ps) }, z => `${t.soPBH}: ${PBH_TT[z.trangThai]}`); if (r) setTimeout(() => ticketView(t.soPBH), 0); return !!r; }, null, 'Lưu');
  }
  /** Tiếp nhận bảo hành hàng KHÔNG serial (đèn…) theo phiếu xuất. */
  function ticketFormLe(p, L) {
    const le = L.filter(l => !isSer(itemOf(l.maHang))); if (!le.length) return toast('Phiếu không có hàng không serial');
    dialog('Tiếp nhận bảo hành — phiếu ' + esc(p.soPhieu), `<p class="mut" style="font-size:12.5px">Hàng không quản lý serial: hạn bảo hành tính từ ngày xuất ${esc(vnD(p.ngay))} theo số tháng bảo hành của mã hàng.</p>
      <div class="grid2"><div>${fld('maHang', 'Hàng', le[0].maHang, { opts: le.map(l => [l.maHang, itemOf(l.maHang).ten + ' — đã xuất ' + num(l.soLuong) + ' ' + itemOf(l.maHang).dvt]) })}</div><div>${fld('soLuong', 'Số lượng lỗi', '1', { im: 'decimal', req: 1 })}</div>
        <div>${fld('ngay', 'Ngày tiếp nhận', S.today, { type: 'date', max: S.today })}</div><div>${fld('nguoiBao', 'Người báo (tên, điện thoại)', '')}</div></div>
      ${fld('moTaLoi', 'Hiện tượng lỗi', '', { req: 1, type: 'textarea' })}${fld('ghiChu', 'Ghi chú', '')}`,
      async (v, dlg) => { const c = QBH.validateTicket(v, { today: S.today }); if (!c.ok) { showErrors(dlg, c.errors); return false; }
        const q = Number(String(v.soLuong).replace(',', '.')); if (!(q > 0)) { showErrors(dlg, { soLuong: 'Số lượng > 0' }); return false; }
        const r = await submitSX(dlg, 'bh.create', { hangLe: { phieuXuat: p.soPhieu, maHang: v.maHang, soLuong: q }, phieu: { ngay: v.ngay, moTaLoi: v.moTaLoi, nguoiBao: v.nguoiBao, ghiChu: v.ghiChu } }, z => `Đã lập phiếu ${z.soPBH} · ${TT_BH[z.tinhTrangBH] || z.tinhTrangBH}${z.hanBH ? ' (hạn ' + vnD(z.hanBH) + ')' : ''}`);
        if (r) setTimeout(() => ticketView(r.soPBH), 0); return !!r; }, null, 'Lập phiếu');
  }
  function ticketLePick() {
    const ps = (S.data.vouchers || []).filter(x => ['XUAT_BAN', 'XUAT_CONG_TRINH', 'XUAT_BH'].includes(x.loai) && !x.daDao).slice(-300).reverse();
    dialog('Tra phiếu xuất để bảo hành hàng không serial', `${fld('so', 'Số phiếu xuất (bán / công trình)', '', { req: 1, list: 'dlPX' })}<datalist id="dlPX">${ps.map(x => `<option value="${esc(x.soPhieu)}">${esc(vnD(x.ngay))} · ${esc(custName(x.maKH) || projName(x.maCongTrinh) || '')}</option>`).join('')}</datalist>`,
      async (v, dlg) => { const so = v.so.trim().toUpperCase(); if (!so) { showErrors(dlg, { so: 'Nhập số phiếu' }); return false; }
        const r = await load('voucher.get', { soPhieu: so }, 'Đang mở phiếu…'); if (!r.ok) { showErrors(dlg, { so: 'Không có phiếu ' + so }); return false; }
        dlg.close(); ticketFormLe(r.data.phieu, r.data.lines); return false; }, null, 'Tra');
  }
  /** Thay linh kiện (tủ) / đổi hàng (serial bán rời, hàng không serial). pre = {maHang, cu: [serial cũ]} khi bấm "Thay [linh kiện]" ở hồ sơ tủ. */
  async function replaceForm(t, pre = {}) {
    const cabT = !!t.serialTu, leT = !t.serialTu && !t.serial;
    let con = [];
    if (cabT) { const g = await load('serial.get', { serial: t.serialTu }, 'Đang đọc hồ sơ tủ…'); if (!g.ok) return toast('Không đọc được hồ sơ tủ: ' + (g.error || g.code)); con = g.data.con || []; }
    const items = S.data.items.filter(i => i.trangThai !== 'NGUNG'), kho0 = (activeKho(false)[0] || {}).maKho, mien = QBH.mienPhi(t.tinhTrangBH, t.nguyenNhan);
    const lines = pre.maHang ? [{ maHang: pre.maHang, cu: pre.cu || [], moi: [], soLuong: String((pre.cu || []).length || '') }] : leT ? [{ maHang: t.maHang, soLuong: String(t.soLuong || ''), soLuongCu: String(t.soLuong || '') }] : !cabT ? [{ maHang: t.maHang, soLuong: '1' }] : [{}];
    const hinhO = [['THU_TIEN', 'Sửa có thu tiền (khách trả phí)'], ...(isQT() ? [['THIEN_CHI', 'Bảo hành thiện chí (Quản trị duyệt)']] : [])];
    const ttl = cabT ? 'Thay linh kiện' : 'Đổi hàng';
    dialog(ttl + ' — ' + esc(t.soPBH), `${mien ? `<p>${cabT ? 'Linh kiện mới xuất từ kho (phiếu Xuất bảo hành, tính chi phí bảo hành). Linh kiện có serial thu hồi về kho hàng lỗi.' : 'Hàng mới xuất từ kho (phiếu Xuất bảo hành); hàng hỏng thu hồi về kho hàng lỗi (giá 0).'}</p>`
        : `<div class="banner" role="alert">${ic('warn')} Ngoài bảo hành (${esc(TT_BH[t.tinhTrangBH] || '')}${t.nguyenNhan ? ' · ' + esc(NN[t.nguyenNhan] || t.nguyenNhan) : ''}) — không thay miễn phí.</div>
          ${fld('hinhThuc', 'Hình thức', 'THU_TIEN', { opts: hinhO })}<div id="hTT">${fld('phiSua', 'Phí sửa chữa thu khách (₫)', '', { im: 'numeric' })}<small class="mut">Linh kiện xuất theo phiếu Xuất sửa chữa (giá vốn); phí sửa là căn cứ xuất hoá đơn dịch vụ.</small></div><div id="hTC" hidden>${fld('thienChi', 'Lý do bảo hành thiện chí', '', { req: 1 })}</div>`}
      ${cabT ? '<p class="mut" style="font-size:12.5px">Linh kiện có serial: tủ đang có serial cùng mã thì phải chọn serial cũ thu hồi.</p>' : leT ? `<p class="mut" style="font-size:12.5px">Hàng: ${esc(itemOf(t.maHang).ten || t.maHang)} × ${num(t.soLuong)} (phiếu xuất ${esc(t.phieuGoc)}). "Thu hồi" = số hàng hỏng nhận về kho lỗi (để 0 nếu khách không trả lại).</p>` : `<p class="mut" style="font-size:12.5px">Serial ${esc(t.serial)} thu hồi về kho hàng lỗi khi đổi cùng mã.</p>`}
      ${con.length ? `<div class="chips" role="group" aria-label="Chọn nhanh linh kiện trong tủ">${con.map(c => `<button class="chip" type="button" data-pk="${esc(c.maHang)}" data-ps="${esc(c.serial)}">${ic('tool')} Thay ${esc(itemOf(c.maHang).ten)} (${esc(c.serial)})</button>`).join('')}</div>` : ''}
      <div class="grid2"><div>${fld('ngay', 'Ngày thay', S.today, { type: 'date', max: S.today })}</div><div>${fld('kho', 'Lấy từ kho', kho0, { opts: activeKho(false).map(w => [w.maKho, w.ten]) })}</div></div>
      <datalist id="dlRI">${items.map(i => `<option value="${esc(i.maHang)}">${esc(i.ten)}</option>`).join('')}</datalist><div id="rl"></div><button class="btn" type="button" id="rAdd">${ic('plus')} Thêm dòng</button>`,
      async (v, dlg) => {
        const L = lines.filter(l => l.maHang).map(l => ({ maHang: l.maHang.toUpperCase(), soLuong: Number(String(l.soLuong || '').replace(',', '.')), serialMoi: l.moi || [], serialCu: l.cu || [], soLuongCu: leT && l.soLuongCu !== undefined && l.soLuongCu !== '' ? Number(String(l.soLuongCu).replace(',', '.')) : undefined }));
        if (!L.length) { dlgMsg(dlg, 'Chọn hàng / linh kiện thay'); return false; }
        const hinh = mien ? '' : v.hinhThuc, ps = String(v.phiSua || '').replace(/[.\s,₫]/g, '');
        if (hinh === 'THIEN_CHI' && !String(v.thienChi || '').trim()) { showErrors(dlg, { thienChi: 'Nhập lý do' }); return false; }
        if (hinh === 'THU_TIEN' && ps && !/^\d+$/.test(ps)) { showErrors(dlg, { phiSua: 'Số tiền VND' }); return false; }
        const r = await submitSX(dlg, 'bh.replace', { soPBH: t.soPBH, ngay: v.ngay, kho: v.kho, lines: L, thienChi: hinh === 'THIEN_CHI' ? v.thienChi : '', hinhThuc: hinh === 'THU_TIEN' ? 'THU_TIEN' : '', phiSua: hinh === 'THU_TIEN' && ps ? Number(ps) : undefined },
          z => `Đã ${cabT ? 'thay' : 'đổi'} · ${z.soPhieuXuat}${z.soPhieuLoi ? ' · thu hồi ' + z.soPhieuLoi : ''}`);
        if (r) setTimeout(() => ticketView(t.soPBH), 0); return !!r;
      }, dlg => {
        dlg.classList.add('wide');
        const hs = $('#f_hinhThuc', dlg); if (hs) hs.onchange = () => { $('#hTT', dlg).hidden = hs.value !== 'THU_TIEN'; $('#hTC', dlg).hidden = hs.value !== 'THIEN_CHI'; };
        const autoCu = l => { const it = itemOf(String(l.maHang || '').toUpperCase()), cu = con.filter(c => c.maHang === it.maHang); if (cabT && isSer(it) && !(l.cu || []).length && cu.length && (cu.length === 1 || cu.length === Number(l.soLuong))) l.cu = cu.slice(0, Math.max(1, Number(l.soLuong) || 1)).map(c => c.serial); };   // tủ chỉ có đúng số serial cùng mã → chọn sẵn serial cũ
        const draw = () => { const kho = $('#f_kho', dlg).value;
          $('#rl', dlg).innerHTML = lines.map((l, i) => { const it = l.maHang ? itemOf(l.maHang.toUpperCase()) : {}, ser = isSer(it);
            const moi = ser ? (S.data.serials || []).filter(z => z.maHang === it.maHang && z.kho === kho && z.trangThai === 'TRONG_KHO') : [], cu = ser && cabT ? con.filter(c => c.maHang === it.maHang) : [];
            return `<div class="card" style="padding:10px;margin:0 0 8px"><div class="trow"><input class="in mono" list="dlRI" data-r="${i}" data-f="maHang" value="${esc(l.maHang || '')}" placeholder="Mã hàng" aria-label="Mã hàng ${i + 1}"><input class="in num" data-r="${i}" data-f="soLuong" value="${esc(l.soLuong || '')}" inputmode="decimal" placeholder="SL" aria-label="Số lượng ${i + 1}" ${ser ? 'readonly' : ''}>${leT ? `<input class="in num" data-r="${i}" data-f="soLuongCu" value="${esc(l.soLuongCu ?? '')}" inputmode="decimal" placeholder="Thu hồi" aria-label="Số thu hồi dòng ${i + 1}" title="Số hàng hỏng thu hồi về kho lỗi">` : ''}<span class="mut tname">${esc(it.ten || '')}</span><button class="btn ghost iconbtn" type="button" data-rd="${i}" aria-label="Xoá dòng ${i + 1}">${ic('x')}</button></div>
              ${ser ? `<small>Serial mới (trong kho ${esc(khoName(kho))}):</small><div class="sers">${moi.length ? moi.map(z => `<label><input type="checkbox" data-rm="${i}" value="${esc(z.serial)}" ${(l.moi || []).includes(z.serial) ? 'checked' : ''}> ${esc(z.serial)}</label>`).join('') : '<span class="bad-ink">Không còn serial trong kho này</span>'}</div>
                ${cabT ? `<small>Serial cũ thu hồi (đang trong tủ):</small><div class="sers">${cu.length ? cu.map(z => `<label><input type="checkbox" data-rc="${i}" value="${esc(z.serial)}" ${(l.cu || []).includes(z.serial) ? 'checked' : ''}> ${esc(z.serial)}</label>`).join('') : '<span class="mut">Tủ không có serial mã này</span>'}</div>` : ''}` : ''}</div>`; }).join('');
          $$('[data-r]', dlg).forEach(x => x.oninput = () => { lines[+x.dataset.r][x.dataset.f] = x.value; });
          $$('[data-r][data-f=maHang]', dlg).forEach(x => x.onchange = () => { const l = lines[+x.dataset.r]; l.moi = []; l.cu = []; autoCu(l); setTimeout(draw, 0); });
          $$('[data-rd]', dlg).forEach(b => b.onclick = () => { lines.splice(+b.dataset.rd, 1); if (!lines.length) lines.push({}); draw(); });
          $$('[data-rm]', dlg).forEach(c => c.onchange = () => { const l = lines[+c.dataset.rm]; l.moi = $$(`[data-rm="${c.dataset.rm}"]:checked`, dlg).map(z => z.value); l.soLuong = String(l.moi.length); $(`[data-r="${c.dataset.rm}"][data-f=soLuong]`, dlg).value = l.soLuong; });
          $$('[data-rc]', dlg).forEach(c => c.onchange = () => { lines[+c.dataset.rc].cu = $$(`[data-rc="${c.dataset.rc}"]:checked`, dlg).map(z => z.value); });
        };
        $$('[data-pk]', dlg).forEach(b => b.onclick = () => { const e = lines.find(l => !l.maHang); const l = e || {}; if (!e) lines.push(l); Object.assign(l, { maHang: b.dataset.pk, cu: [b.dataset.ps], moi: [], soLuong: '1' }); draw(); });
        lines.forEach(autoCu);
        $('#f_kho', dlg).onchange = () => { lines.forEach(l => l.moi = []); draw(); }; $('#rAdd', dlg).onclick = () => { lines.push({}); draw(); }; draw();
      }, cabT ? 'Ghi thay thế' : 'Ghi đổi hàng');
  }
  async function printPBH(t) {
    const co = S.co, tt = JSON.parse(t.thayThe || '[]'), dd = (t.ngayDong || t.ngay).split('-');
    let v = {};
    if (t.serialTu || t.serial) {
      const g = await load('serial.get', { serial: t.serialTu || t.serial }, 'Đang chuẩn bị bản in…');
      if (!g.ok) return toast('Chưa in được: không đọc được hồ sơ tủ (' + (g.error || g.code) + ') — thử lại khi có mạng');   // không in phiếu thiếu khách / vị trí
      v = (g.data.baoHanh || {}).viTri || {};
    } else { const px = (S.data.vouchers || []).find(z => z.soPhieu === t.phieuGoc) || {}; v = { maKH: t.maKH || px.maKH, maCongTrinh: px.maCongTrinh }; }
    const kh = (S.data.customers || []).find(z => z.maKH === v.maKH) || {};
    const host = document.createElement('div'); host.id = 'printArea';
    host.innerHTML = `<div class="pv pxx"><div class="c"><b>${esc((co.tenDay || co.ten).toUpperCase())}</b><br>Địa chỉ: ${esc(co.diaChi || '')}${co.mst ? ' – MST: ' + esc(co.mst) : ''}</div>
      <h1>PHIẾU BẢO HÀNH</h1><p class="c">Số: <b>${esc(t.soPBH)}</b><br><i>${esc(co.noiLap || 'TP. Hồ Chí Minh')}, ngày ${dd[2]} tháng ${dd[1]} năm ${dd[0]}</i></p>
      <table class="pv-k"><tbody><tr><td>Khách hàng</td><td>${esc(kh.ten || '')}${kh.diaChi ? '<br>' + esc(kh.diaChi) : ''}</td></tr>${v.maCongTrinh ? `<tr><td>Công trình</td><td>${esc(projName(v.maCongTrinh))}</td></tr>` : ''}
        ${v.diaChi ? `<tr><td>Vị trí lắp</td><td>${v.tenTaiCT ? esc(v.tenTaiCT) + ' — ' : ''}${esc(v.diaChi)}</td></tr>` : ''}${t.serialTu || t.serial ? `<tr><td>${t.serialTu ? 'Tủ (số xê-ri)' : 'Số serial'}</td><td>${esc(t.serialTu || t.serial)}</td></tr>` : `<tr><td>Hàng bảo hành</td><td>${esc(itemOf(t.maHang).ten || t.maHang)} × ${num(t.soLuong)} ${esc(itemOf(t.maHang).dvt)} — phiếu xuất ${esc(t.phieuGoc)}</td></tr>`}${t.serialTu && t.serial !== t.serialTu ? `<tr><td>Linh kiện báo lỗi</td><td>${esc(t.serial)}</td></tr>` : ''}
        <tr><td>Ngày tiếp nhận</td><td>${vnD(t.ngay)}${t.nguoiBao ? ' — ' + esc(t.nguoiBao) : ''}</td></tr><tr><td>Tình trạng bảo hành</td><td>${esc(TT_BH[t.tinhTrangBH] || '')}${t.hanBH ? ' (hạn đến hết ' + vnD(t.hanBH) + ')' : ''}</td></tr>
        <tr><td>Hiện tượng lỗi</td><td>${esc(t.moTaLoi)}</td></tr><tr><td>Nguyên nhân</td><td>${esc(NN[t.nguyenNhan] || '')}</td></tr><tr><td>Kết quả xử lý</td><td>${esc(t.ketQua || '')}</td></tr></tbody></table>
      ${tt.length ? `<h2>Linh kiện thay thế</h2><table class="pv-t"><thead><tr><th>STT</th><th>Linh kiện</th><th>SL</th><th>Serial mới</th><th>Serial thu hồi</th></tr></thead><tbody>${tt.map((z, i) => `<tr><td class="c">${i + 1}</td><td>${esc(itemOf(z.maHang).ten || z.maHang)}</td><td class="c">${num(z.soLuong)}</td><td>${z.serialMoi.map(esc).join(', ')}</td><td>${z.serialCu.map(esc).join(', ')}</td></tr>`).join('')}</tbody></table>` : ''}
      <p>Trạng thái phiếu: <b>${PBH_TT[t.trangThai] || esc(t.trangThai)}</b>${t.hinhThuc ? ' · Hình thức: ' + esc(HINH[t.hinhThuc] || t.hinhThuc) : ''}${t.thienChi ? ' · Bảo hành thiện chí: ' + esc(t.thienChi) : ''}${Number(t.phiSua) ? ' · Phí sửa chữa: <b>' + money(t.phiSua) + '</b>' : ''}</p>
      <div class="pv-sign pxx-sign"><div><b>ĐẠI DIỆN KHÁCH HÀNG</b><br><i>(Ký, ghi rõ họ tên)</i></div><div><b>NGƯỜI XỬ LÝ</b><br><i>(Ký, ghi rõ họ tên)</i></div><div><b>ĐƠN VỊ BẢO HÀNH</b><br><i>(Ký, đóng dấu)</i></div></div>
      <p class="pv-foot">In từ QLHH v${VER}</p></div>`;
    document.body.appendChild(host); document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); host.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
  }
  function bhReport() {
    const m0 = S.today.slice(0, 8) + '01';
    dialog('Chi phí bảo hành', `<div class="grid2"><div>${fld('from', 'Từ ngày', m0, { type: 'date' })}</div><div>${fld('to', 'Đến ngày', S.today, { type: 'date' })}</div></div><div id="bhR"></div>`,
      async (v, dlg) => { const r = await call('report.bh', { from: v.from, to: v.to }, 3); if (!r.ok) { dlgMsg(dlg, r.error || r.code); return false; }
        const x = r.data; $('#bhR', dlg).innerHTML = `<p>Chi phí linh kiện xuất bảo hành: <b>${money(x.tong)}</b> · tủ còn hạn bảo hành đến ${vnD(x.to)}: <b>${num(x.tuConBH)}</b> (cơ sở trích dự phòng TK 352)<br>Sửa có thu tiền: giá vốn linh kiện <b>${money(x.tongSua || 0)}</b> (TK 632) · phí sửa thu khách (phiếu hoàn thành trong kỳ) <b>${money(x.phiSua || 0)}</b> (TK 511)</p>
          ${x.rows.length ? `<div class="tbl"><table><thead><tr><th>Phiếu xuất</th><th>Ngày</th><th>Phiếu BH</th><th>Tủ / hàng</th><th>Hình thức</th><th>Tình trạng</th><th class="n">Giá trị</th></tr></thead><tbody>${x.rows.map(z => `<tr><td class="mono">${esc(z.soPhieu)}</td><td>${vnD(z.ngay)}</td><td class="mono">${esc(z.soPBH)}</td><td class="mono">${esc(z.serialTu || z.serial || (z.maHang ? z.maHang + ' × ' + z.soLuong : ''))}</td><td>${z.loai === 'THU_TIEN' ? 'Sửa thu tiền' : z.thienChi ? 'Thiện chí' : 'Bảo hành'}</td><td>${esc(TT_BH[z.tinhTrangBH] || '')}${z.nguyenNhan ? ' · ' + esc(NN[z.nguyenNhan] || z.nguyenNhan) : ''}</td><td class="n">${num(z.giaTri)}</td></tr>`).join('')}</tbody></table></div>
          <button class="btn" type="button" id="bhX">${ic('dl')} Xuất Excel</button>` : '<div class="empty">Không có phiếu xuất bảo hành trong kỳ.</div>'}`;
        const xb = $('#bhX', dlg); if (xb) xb.onclick = () => exportRows(`ChiPhiBH_${v.from}_${v.to}`, x.rows.map(z => ({ 'Phiếu xuất': z.soPhieu, 'Ngày': z.ngay, 'Phiếu BH': z.soPBH, 'Tủ / hàng': z.serialTu || z.serial || z.maHang, 'Hình thức': z.loai === 'THU_TIEN' ? 'Sửa thu tiền' : z.thienChi ? 'Thiện chí' : 'Bảo hành', 'Tình trạng BH': TT_BH[z.tinhTrangBH] || '', 'Nguyên nhân': NN[z.nguyenNhan] || '', 'Thiện chí': z.thienChi, 'Giá trị': z.giaTri })));
        return false; }, dlg => dlg.classList.add('wide'), 'Xem báo cáo');
  }
  function viewBH(m, only) {
    const d = S.data, sk = {}; (d.serials || []).forEach(z => sk[z.key] = z);
    const tpl = {}; (d.templates || []).forEach(t => tpl[t.maMau] = t);
    const hist = {}; (d.lapDat || []).forEach(l => { if (!l.lyDoHuy) (hist[l.key] = hist[l.key] || []).push(l); });
    const tus = (d.cabinets || []).filter(c => c.trangThai !== 'HUY' && sk[c.key] && sk[c.key].trangThai === 'DA_BAN').map(c => {
      const all = hist[c.key] || [], px = c.phieuXuat || all.reduce((m, l) => (l.thoiGian > (m.t || '') ? { t: l.thoiGian, p: l.phieuXuat } : m), {}).p || '';   // tủ bán trước bản 0.4.0 chưa có phieuXuat → lấy chu kỳ ghi gần nhất
      const h = all.filter(l => l.phieuXuat ? l.phieuXuat === px : (!l.ngayXuat || l.ngayXuat === c.ngayXuat));   // chu kỳ giao hiện hành (theo số phiếu xuất)
      const thang = tpl[c.maMau] && tpl[c.maMau].thangBH !== '' ? Number(tpl[c.maMau].thangBH) : Number(itemOf(c.maHang).thangBH || 12), cur = QBH.current(h, thang);
      return { c, cur, st: QBH.status(cur || { ngayXuat: c.ngayXuat }, S.today) }; });
    const rank = x => x.st.canhBao ? 0 : x.st.ma === 'SAP_HET' ? 1 : x.st.ma === 'CHUA_BAN_GIAO' ? 2 : x.st.ma === 'CON_BH' ? 3 : 4;
    const nq = QSearch.norm(BH.q), F = [['', 'Tất cả'], ['CON_BH', 'Còn BH'], ['SAP_HET', 'Sắp hết BH'], ['HET_BH', 'Hết BH'], ['CHUA_BAN_GIAO', 'Chưa bàn giao']];
    const pb = (d.pbh || []).slice().sort((a, b) => a.soPBH < b.soPBH ? 1 : -1), FP = [['', 'Tất cả'], ['MO', 'Đang mở'], ['DONG', 'Đã đóng']];
    let body;
    if (BH.tab === 'tu') {
      const list = tus.filter(x => (!BH.f || x.st.ma === BH.f) && (!nq || QSearch.norm([x.c.serial, x.cur && x.cur.viTri.diaChi, x.cur && x.cur.viTri.tenTaiCT, x.cur && projName(x.cur.viTri.maCongTrinh), x.cur && custName(x.cur.viTri.maKH)].join(' ')).includes(nq)))
        .sort((a, b) => rank(a) - rank(b) || (((a.cur && a.cur.hanBH) || '9') < ((b.cur && b.cur.hanBH) || '9') ? -1 : 1));
      body = `<div class="chips" role="group" aria-label="Lọc tình trạng">${F.map(([k, t]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${BH.f === k}">${t} (${k ? tus.filter(x => x.st.ma === k).length : tus.length})</button>`).join('')}</div>
        <div class="card list">${list.length ? list.slice(0, 400).map(x => { const v = x.cur && x.cur.viTri, mu = mapUrl(v);
          return `<div class="it" data-tu="${esc(x.c.serial)}" role="button" tabindex="0"><div><div class="mono"><b>${esc(x.c.serial)}</b></div>${bhTag(x.st)}<br>${v ? `${v.tenTaiCT ? '<b>' + esc(v.tenTaiCT) + '</b> · ' : ''}${esc(v.diaChi)}<br><small class="mut">${esc([v.maCongTrinh && projName(v.maCongTrinh), v.maKH && custName(v.maKH)].filter(Boolean).join(' · '))}</small>` : '<small class="mut">Chưa ghi bàn giao / vị trí</small>'}</div>
            <div style="text-align:right;white-space:nowrap">${x.cur && x.cur.hanBH ? `<small class="mut">BH đến</small><br><b>${vnD(x.cur.hanBH)}</b>` : ''}${mu ? `<br><a class="linkbtn" href="${mu}" target="_blank" rel="noopener" aria-label="Bản đồ ${esc(x.c.serial)}">${ic('pin')} Bản đồ</a>` : ''}</div></div>`; }).join('')
          + (list.length > 400 ? `<div class="empty">Đang hiện 400/${list.length} tủ — gõ tìm hoặc lọc để thu hẹp.</div>` : '')
          : `<div class="empty">${tus.length ? 'Không có tủ khớp.' : 'Chưa có tủ nào xuất khỏi kho. Tủ bán / xuất công trình sẽ hiện ở đây để ghi bàn giao và theo dõi bảo hành.'}</div>`}</div>`;
    } else {
      const list = pb.filter(t => (!BH.f || (BH.f === 'MO' ? ['TIEP_NHAN', 'DANG_XU_LY'].includes(t.trangThai) : ['HOAN_THANH', 'TU_CHOI', 'DONG_KHACH_TRA'].includes(t.trangThai))) && (!nq || QSearch.norm([t.soPBH, t.serial, t.serialTu, t.maHang, itemOf(t.maHang).ten, t.phieuGoc, t.moTaLoi, t.nguoiBao].join(' ')).includes(nq)));
      body = `<div class="chips" role="group" aria-label="Lọc phiếu">${FP.map(([k, t]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${BH.f === k}">${t}</button>`).join('')}</div>
        <div class="card list">${list.length ? list.map(t => `<div class="it" data-pbh="${esc(t.soPBH)}" role="button" tabindex="0"><div><span class="mono">${esc(t.soPBH)}</span> · ${pbhObj(t)} <span class="tag ${pbhCls(t)}">${PBH_TT[t.trangThai] || esc(t.trangThai)}</span><br><small class="mut">${vnD(t.ngay)} · ${esc(TT_BH[t.tinhTrangBH] || '')} · ${esc(t.moTaLoi)}</small></div></div>`).join('') : '<div class="empty">Chưa có phiếu bảo hành. Lập phiếu từ hồ sơ tủ (tra xê-ri / quét QR) → <b>Tiếp nhận bảo hành</b>.</div>'}</div>`;
    }
    paint(m, only, header('Lắp đặt & bảo hành') + `
      <div class="sxbar"><button class="btn ${BH.tab === 'tu' ? 'pri' : ''}" type="button" data-tab="tu">${ic('box')} Tủ đã giao (${tus.length})</button><button class="btn ${BH.tab === 'pbh' ? 'pri' : ''}" type="button" data-tab="pbh">${ic('shield')} Phiếu bảo hành (${pb.filter(t => ['TIEP_NHAN', 'DANG_XU_LY'].includes(t.trangThai)).length} đang mở)</button><button class="btn" type="button" id="bSer">${ic('search')} Tra xê-ri</button>${hasCam() ? `<button class="btn" type="button" data-scantu>${ic('search')} Quét QR tủ</button>` : ''}${canEdit() && !S.offline ? `<button class="btn" type="button" id="bLe">${ic('shield')} BH hàng không serial</button>` : ''}${isQT() ? `<button class="btn" type="button" id="bRep">${ic('chart')} Chi phí BH</button>` : ''}</div>
      <label class="search" style="margin-bottom:10px">${ic('search')}<span class="sr">Tìm</span><input id="qbh" type="search" placeholder="${BH.tab === 'tu' ? 'Xê-ri, địa chỉ, công trình, khách…' : 'Số phiếu, xê-ri, hiện tượng…'}" value="${esc(BH.q)}" autocomplete="off"></label><div id="bhbody">${body}</div>`);
    onSearch('#qbh', v => { BH.q = v; }, () => viewBH(m, '#bhbody'), 300);
    $$('[data-tab]').forEach(b => b.onclick = () => { BH.tab = b.dataset.tab; BH.f = ''; viewBH(m); });
    $$('.chip[data-f]').forEach(b => b.onclick = () => { BH.f = b.dataset.f; viewBH(m); });
    $('#bSer').onclick = serialSearch; $$('[data-scantu]', m).forEach(b => b.onclick = scanTu); const br = $('#bRep'); if (br) br.onclick = bhReport; const bl = $('#bLe'); if (bl) bl.onclick = ticketLePick;
    $$('[data-tu]', m).forEach(r => r.onclick = e => { if (e.target.closest('a')) return; tuView(r.dataset.tu); });
    $$('[data-pbh]', m).forEach(r => r.onclick = () => ticketView(r.dataset.pbh));
  }

  // ----- báo cáo dở dang (QT) -----
  function wipReport() {
    const m0 = S.today.slice(0, 8) + '01';
    dialog('Báo cáo dở dang sản xuất (TK 154)', `<div class="grid2"><div>${fld('from', 'Từ ngày', m0, { type: 'date' })}</div><div>${fld('to', 'Đến ngày', S.today, { type: 'date' })}</div></div><div id="wipR"></div>`,
      async (v, dlg) => {
        const r = await call('report.wip', { from: v.from, to: v.to }, 3); if (!r.ok) { dlgMsg(dlg, r.error || r.code); return false; }
        const rows = r.data.rows, sumCp = x => Object.values(x.cp).reduce((a, b) => a + b, 0), tot = k => rows.reduce((a, x) => a + (k === 'cp' ? sumCp(x) : x[k]), 0);
        $('#wipR', dlg).innerHTML = rows.length ? `<div class="tbl"><table><thead><tr><th>Lệnh</th><th class="n">Đầu kỳ</th><th class="n">Linh kiện</th><th class="n">NC trực tiếp</th><th class="n">SX chung</th><th class="n">Gia công ngoài</th><th class="n">Nhập TP</th><th class="n">KC huỷ</th><th class="n">Cuối kỳ</th></tr></thead><tbody>
          ${rows.map(x => `<tr><td class="mono">${esc(x.soLSX)}<br><small class="mut">${esc(x.maMau || '')} × ${num(x.soLuong)} · ${LSX_ST[x.trangThai] || ''}</small></td>${[x.dauKy, x.linhKien, x.cp.NC_TRUC_TIEP || 0, x.cp.SX_CHUNG || 0, x.cp.GIA_CONG_NGOAI || 0, x.nhapTP, x.kcHuy, x.cuoiKy].map(n => `<td class="n">${num(n)}</td>`).join('')}</tr>`).join('')}
          <tr><td><b>Cộng</b></td>${['dauKy', 'linhKien'].map(k => `<td class="n"><b>${num(tot(k))}</b></td>`).join('')}<td class="n" colspan="3"><b>${num(tot('cp'))}</b></td>${['nhapTP', 'kcHuy', 'cuoiKy'].map(k => `<td class="n"><b>${num(tot(k))}</b></td>`).join('')}</tr></tbody></table></div>
          <p class="mut" style="font-size:12.5px">Cuối kỳ = Đầu kỳ + Linh kiện + Chi phí − Nhập TP + KC huỷ (âm: kết chuyển sang chi phí 632/811).</p><button class="btn" type="button" id="wipX">${ic('dl')} Xuất Excel</button>` : '<div class="empty">Không có lệnh phát sinh trong kỳ.</div>';
        const xb = $('#wipX', dlg); if (xb) xb.onclick = () => exportRows(`DoDang_${v.from}_${v.to}`, rows.map(x => ({ 'Lệnh SX': x.soLSX, 'Mẫu': x.maMau, 'Số tủ': x.soLuong, 'Đầu kỳ': x.dauKy, 'Linh kiện': x.linhKien, 'NC trực tiếp': x.cp.NC_TRUC_TIEP || 0, 'SX chung': x.cp.SX_CHUNG || 0, 'Gia công ngoài': x.cp.GIA_CONG_NGOAI || 0, 'Nhập TP': x.nhapTP, 'KC huỷ': x.kcHuy, 'Cuối kỳ': x.cuoiKy })));
        return false;
      }, dlg => dlg.classList.add('wide'), 'Xem báo cáo');
  }

  // ----- mẫu tủ -----
  function tplList() {
    const tp = S.data.templates || [];
    dialog('Mẫu tủ', `<div class="list">${tp.length ? tp.map(t => `<div class="it" data-t="${esc(t.maMau)}" role="button" tabindex="0"><div><div class="mono">${esc(t.maMau)} · bản ${esc(t.phienBan)}</div><b>${esc(t.ten)}</b><br><small class="mut">${esc(t.maHang)} · ${JSON.parse(t.bom || '[]').length} linh kiện · ${JSON.parse(t.kcs || '[]').length} mục kiểm tra</small></div></div>`).join('') : '<div class="empty">Chưa có mẫu tủ.</div>'}</div>
      ${isQT() && !S.offline ? `<button class="btn pri" type="button" id="tAdd" style="margin-top:10px">${ic('plus')} Mẫu tủ mới</button>` : ''}`, null, d => {
      $$('[data-t]', d).forEach(r => r.onclick = () => { d.close(); tplForm(tp.find(t => t.maMau === r.dataset.t)); });
      const a = $('#tAdd', d); if (a) a.onclick = () => { d.close(); tplForm(); };
    });
  }
  function tplForm(t0) {
    const ro = !isQT() || S.offline, items = S.data.items.filter(i => i.trangThai !== 'NGUNG');
    const bom = t0 ? JSON.parse(t0.bom || '[]') : [{}], kcs = t0 ? JSON.parse(t0.kcs || '[]') : [{}];
    const tp = items.filter(isSer);
    const body = `${t0 ? `<p class="mut">Sửa mẫu → lưu thành <b>bản ${Number(t0.phienBan) + 1}</b>; lệnh đã lập giữ bản cũ.</p>` : ''}
      <div class="grid2"><div>${fld('maMau', 'Mã mẫu', t0 ? t0.maMau : '', { req: 1, ro: !!t0 })}</div><div>${fld('maHang', 'Mã hàng thành phẩm (quản lý serial)', t0 ? t0.maHang : '', { opts: [['', '— Chọn —'], ...tp.map(i => [i.maHang, i.ten + ' (' + i.maHang + ')'])] })}</div>
        <div>${fld('ten', 'Tên mẫu', t0 ? t0.ten : '', { req: 1 })}</div><div>${fld('thangBH', 'Bảo hành (tháng)', t0 ? t0.thangBH : '12', { im: 'numeric' })}</div>
        <div>${fld('kichThuoc', 'Kích thước C×R×S (mm)', t0 ? t0.kichThuoc : '')}</div><div>${fld('vatLieu', 'Vật liệu, màu sắc', t0 ? t0.vatLieu : '')}</div>
        <div>${fld('filePLC', 'Chương trình PLC (tên file)', t0 ? t0.filePLC : '')}</div><div>${fld('thongSoDien', 'Thông số điện (dòng định mức, IP, cách điện…)', t0 ? t0.thongSoDien : '')}</div></div>
      ${fld('moTa', 'Tên sản phẩm in trên PXX', t0 ? t0.moTa : '', { type: 'textarea' })}${fld('ketCau', 'Kết cấu', t0 ? t0.ketCau : '', { type: 'textarea' })}
      <h3 class="h3">Định mức linh kiện cho 1 tủ</h3><datalist id="dlTI">${items.map(i => `<option value="${esc(i.maHang)}">${esc(i.ten)}</option>`).join('')}</datalist><div id="tBom"></div><button class="btn" type="button" id="tBomAdd">${ic('plus')} Thêm linh kiện</button>
      ${fld('ghiChuDM', 'Ghi chú danh mục (in dưới mục III)', t0 ? t0.ghiChuDM : '')}
      <h3 class="h3">Mục kiểm tra xuất xưởng</h3><div id="tKcs"></div><button class="btn" type="button" id="tKcsAdd">${ic('plus')} Thêm mục</button>`;
    const draw = d => {
      $('#tBom', d).innerHTML = bom.map((b, i) => `<div class="trow" data-line="${i + 1}"><input class="in mono" list="dlTI" data-b="${i}" data-f="maHang" value="${esc(b.maHang || '')}" placeholder="Mã linh kiện" aria-label="Mã linh kiện ${i + 1}"><input class="in num" data-b="${i}" data-f="soLuong" value="${esc(b.soLuong ?? '')}" inputmode="decimal" placeholder="SL" aria-label="Số lượng ${i + 1}"><span class="mut tname">${esc(b.maHang ? itemOf(String(b.maHang).toUpperCase()).ten : '')}</span><button class="btn ghost iconbtn" type="button" data-bd="${i}" aria-label="Xoá dòng ${i + 1}">${ic('x')}</button></div>`).join('');
      $('#tKcs', d).innerHTML = kcs.map((k, i) => `<div class="trow k"><b>${i + 1}</b><input class="in" data-k="${i}" data-f="noiDung" value="${esc(k.noiDung || '')}" placeholder="Nội dung kiểm tra" aria-label="Nội dung mục ${i + 1}"><input class="in" data-k="${i}" data-f="yeuCau" value="${esc(k.yeuCau || '')}" placeholder="Yêu cầu" aria-label="Yêu cầu mục ${i + 1}"><button class="btn ghost iconbtn" type="button" data-kd="${i}" aria-label="Xoá mục ${i + 1}">${ic('x')}</button></div>`).join('');
      $$('[data-b]', d).forEach(x => x.oninput = () => { bom[+x.dataset.b][x.dataset.f] = x.value; });
      $$('[data-b][data-f=maHang]', d).forEach(x => x.onchange = () => { const n = x.parentNode.querySelector('.tname'); if (n) n.textContent = x.value ? itemOf(x.value.trim().toUpperCase()).ten : ''; });   // không vẽ lại cả bảng: giữ ô đang gõ
      $$('[data-k]', d).forEach(x => x.oninput = () => { kcs[+x.dataset.k][x.dataset.f] = x.value; });
      $$('[data-bd]', d).forEach(b => b.onclick = () => { bom.splice(+b.dataset.bd, 1); draw(d); });
      $$('[data-kd]', d).forEach(b => b.onclick = () => { kcs.splice(+b.dataset.kd, 1); draw(d); });
      if (ro) $$('input,select,textarea,#tBomAdd,#tKcsAdd,[data-bd],[data-kd]', d).forEach(x => x.disabled = true);
    };
    dialog(t0 ? 'Mẫu ' + esc(t0.maMau) + ' · bản ' + esc(t0.phienBan) : 'Mẫu tủ mới', body, ro ? null : async (v, d) => {
      const tpl = { ...v, maMau: t0 ? t0.maMau : v.maMau, thangBH: v.thangBH === '' ? 12 : Number(v.thangBH), bom: bom.filter(b => b.maHang).map(b => ({ maHang: b.maHang, soLuong: Number(String(b.soLuong).replace(',', '.')) })), kcs: kcs.filter(k => (k.noiDung || '').trim()) };
      const c = QSX.validateTemplate(tpl);
      if (!c.ok) { showErrors(d, c.errors); $$('.trow', d).forEach(r => r.classList.toggle('bad-line', !!c.errors['bom.' + r.dataset.line])); dlgMsg(d, Object.values(c.errors)[0]); return false; }
      return !!(await submitSX(d, 'template.upsert', { template: tpl }, x => `Đã lưu mẫu ${x.maMau} bản ${x.phienBan}`));
    }, d => { d.classList.add('wide'); $('#tBomAdd', d).onclick = () => { bom.push({}); draw(d); }; $('#tKcsAdd', d).onclick = () => { kcs.push({}); draw(d); }; draw(d); }, t0 ? 'Lưu bản mới' : 'Lưu mẫu');
  }

  // ---------------- hộp thoại & biểu mẫu ----------------
  /** Khách ↔ công trình: chọn khách thì chỉ hiện công trình của khách đó; chọn công trình thì tự điền khách. */
  function linkCustProj(dlg) {
    const kh = $('#f_maKH', dlg), ct = $('#f_maCongTrinh', dlg); if (!kh || !ct || kh.tagName !== 'SELECT' || ct.tagName !== 'SELECT') return;
    const all = [...ct.options].map(o => [o.value, o.textContent]), owner = v => ((S.data.projects || []).find(p => p.maCongTrinh === v) || {}).maKH || '';
    let first = true;
    const fill = () => { const k = kh.value, cur = ct.value, keep = first && cur && owner(cur) && owner(cur) !== k; first = false;   // giá trị điền sẵn (phiếu gốc, vị trí cũ) không bị xoá âm thầm
      ct.innerHTML = all.filter(([v]) => !v || !k || !owner(v) || owner(v) === k || (keep && v === cur)).map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
      ct.value = [...ct.options].some(o => o.value === cur) ? cur : ''; };
    kh.addEventListener('change', fill);
    ct.addEventListener('change', () => { const o = owner(ct.value); if (o && kh.value !== o && [...kh.options].some(x => x.value === o)) { kh.value = o; fill(); } });
    fill();
  }
  function dialog(title, body, onSubmit, after, submitText = 'Lưu') {
    if (S.scanStop) S.scanStop();
    const d = $('#dlg');
    const back = document.activeElement;
    d.innerHTML = `<form method="dialog" novalidate><header><h2>${title}</h2><button class="btn ghost iconbtn" type="button" data-x aria-label="Đóng">${ic('x')}</button></header><div class="body">${body}<div class="dlgmsg" id="dlgMsg" role="alert"></div></div>${onSubmit ? `<footer><button class="btn" type="button" data-x>Huỷ</button><button class="btn pri" id="dlgOk" type="submit">${submitText}</button></footer>` : ''}</form>`;
    const f = $('form', d);
    d._rid = null; d._guard = null;   // 1 requestId cho cả vòng đời hộp thoại: bấm Lưu lại sau khi mất phản hồi KHÔNG tạo phiếu thứ 2
    d._dirty = false; d._noGuard = /^(Báo cáo|Chi phí bảo hành|Tra )/.test(title) || ['Xem', 'Tra', 'Lọc'].includes(submitText);   // hộp lọc / tra cứu: không hỏi lại khi đóng
    d._isDirty = () => !d._noGuard && !!(d._guard ? d._guard() : onSubmit && d._dirty);
    const tryClose = () => { if (d._isDirty() && !confirm('Bỏ nội dung đang nhập dở?')) return; d.close(); };   // chạm ra ngoài / bấm X / Esc khi đang nhập: hỏi lại
    $$('[data-x]', d).forEach(b => b.onclick = tryClose);
    d.oncancel = e => { if (S.scanStop) { e.preventDefault(); S.scanStop(); return; } if (d._isDirty()) { e.preventDefault(); tryClose(); } };
    d.onclose = () => { if (S.scanStop) S.scanStop(); if (back && back.isConnected && back.focus) back.focus(); };
    f.onsubmit = async e => {
      e.preventDefault(); if (!onSubmit) return d.close();
      const ok = $('#dlgOk'); if (ok.disabled) return; ok.classList.add('busy'); ok.disabled = true; $('#dlgMsg', d).textContent = '';
      try { const done = await onSubmit(Object.fromEntries(new FormData(f)), d); if (done) d.close(); } finally { ok.classList.remove('busy'); ok.disabled = false; }
    };
    d.onclick = e => { if (e.target === d) tryClose(); };
    if (after) after(d);
    linkCustProj(d);
    f.addEventListener('input', () => { d._dirty = true; });
    d.showModal();
    const first = $('.body input:not([type=hidden]):not([readonly]),.body select,.body textarea', d); if (first && matchMedia('(pointer:fine)').matches) first.focus();
    $$('.body .in', d).forEach(i => { const e = $('#e_' + i.name, d); if (e) i.setAttribute('aria-describedby', e.id); });
    return d;
  }
  const fld = (name, label, val = '', o = {}) => `<label class="f" for="f_${name}">${label}${o.req ? ' *' : ''}</label>${o.type === 'textarea' ? `<textarea class="in" id="f_${name}" name="${name}" ${o.ro ? 'readonly' : ''}>${esc(val)}</textarea>` : o.opts ? `<select class="in" id="f_${name}" name="${name}">${o.opts.map(([k, t]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : `<input class="in" id="f_${name}" name="${name}" value="${esc(val)}" ${o.type ? `type="${o.type}"` : ''} ${o.max ? `max="${esc(o.max)}"` : ''} ${o.list ? `list="${esc(o.list)}"` : ''} ${o.ro ? 'readonly' : ''} ${o.im ? `inputmode="${o.im}"` : ''} autocomplete="off">`}<div class="err" id="e_${name}"></div>`;
  function showErrors(d, errs) {
    $$('.err', d).forEach(e => e.textContent = ''); $$('.in', d).forEach(i => i.removeAttribute('aria-invalid'));
    let first = null;
    Object.entries(errs || {}).forEach(([k, v]) => { const e = $('#' + CSS.escape('e_' + k), d), i = $('#' + CSS.escape('f_' + k), d); if (e) e.textContent = v; if (i) { i.setAttribute('aria-invalid', 'true'); first = first || i; } });
    if (first) first.focus();
    if (errs && errs._) dlgMsg(d, errs._);
  }
  function dlgMsg(d, m) { const x = $('#dlgMsg', d); if (x) x.textContent = m; else toast(m); }
  async function submit(d, action, body, okMsg) {
    if (S.offline) { dlgMsg(d, 'Đang ngoại tuyến — chưa lưu được. Dữ liệu trong ô vẫn giữ nguyên.'); return false; }
    const r = await write(action, { ...body, requestId: d._rid || (d._rid = rid()) });
    if (!r.ok) { if (r.fields && !Array.isArray(r.fields)) showErrors(d, r.fields); dlgMsg(d, 'Chưa lưu: ' + (r.error || r.code) + (r.code === 'NETWORK' ? ' — kiểm tra mạng rồi bấm Lưu lại' : '')); return false; }
    toast(okMsg); await sync(); setTimeout(() => { const h = $('#main .top h1') || $('#main .mtop h1'); if (h && document.activeElement === document.body) { h.tabIndex = -1; h.focus(); } }, 0); return true;
  }
  function itemForm(it) {
    const isNew = !it; it = it || { quanLySerial: false };
    const groups = [['', '— Không chọn —'], ...S.data.groups.map(g => [g.maNhom, g.ten])];
    dialog(isNew ? 'Thêm mặt hàng' : 'Sửa ' + esc(it.maHang), `
      <div class="grid2"><div>${fld('maHang', 'Mã hàng', it.maHang, { req: 1, ro: !isNew })}</div><div>${fld('nhom', 'Nhóm', it.nhom || '', { opts: groups })}</div></div>
      ${fld('ten', 'Tên hàng', it.ten, { req: 1 })}${fld('quyCach', 'Quy cách', it.quyCach)}
      <div class="grid2"><div>${fld('dvt', 'Đơn vị tính', it.dvt, { req: 1 })}</div><div>${fld('thangBH', 'Bảo hành (tháng)', it.thangBH, { im: 'numeric' })}</div>
        <div>${fld('hang', 'Hãng', it.hang)}</div><div>${fld('xuatXu', 'Xuất xứ', it.xuatXu)}</div>
        <div>${fld('tonToiThieu', 'Tồn tối thiểu', it.tonToiThieu, { im: 'decimal' })}</div><div>${isNew ? fld('giaBan', 'Giá bán ban đầu (₫)', it.giaBan, { im: 'numeric' }) : `<label class="f">Giá bán</label><div class="in" style="display:flex;align-items:center">${money(it.giaBan)}</div><div class="err">Đổi giá: dùng “Thêm giá”</div>`}</div></div>
      ${fld('taiLieuUrl', 'Link tài liệu kỹ thuật', it.taiLieuUrl, { type: 'url' })}
      <label class="chk"><input type="checkbox" name="quanLySerial" value="true" ${it.quanLySerial === true || it.quanLySerial === 'true' ? 'checked' : ''}> Quản lý theo số serial (đèn, tủ, bộ IoT…)</label>`,
      async (v, d) => {
        v.quanLySerial = v.quanLySerial === 'true'; if (!isNew) { v.giaBan = it.giaBan; v.trangThai = it.trangThai; }
        const r = QValidate.item(v); if (!r.ok) { showErrors(d, r.errors); return false; }
        if (isNew && S.data.items.some(x => x.maHang === r.value.maHang)) { showErrors(d, { maHang: 'Mã đã tồn tại' }); return false; }
        const ok = await submit(d, 'item.upsert', { isNew, item: r.value }, isNew ? 'Đã thêm ' + r.value.maHang : 'Đã lưu ' + r.value.maHang);
        if (ok) { S.sel = r.value.maHang; renderView(); }
        return ok;
      });
  }
  function priceForm(it) {
    const sups = S.data.suppliers.filter(s => s.trangThai !== 'NGUNG').map(s => [s.maNCC, s.ten]);
    dialog('Thêm giá — ' + esc(it.maHang), `
      ${fld('loai', 'Loại giá', 'BAN', { opts: [['BAN', 'Giá bán'], ['NHAP', 'Giá nhập (theo NCC)']] })}
      <div id="nccBox" class="hide">${fld('maNCC', 'Nhà cung cấp', '', { opts: [['', '— Chọn NCC —'], ...sups] })}</div>
      <div class="grid2"><div>${fld('gia', 'Giá (₫, chưa VAT)', '', { req: 1, im: 'numeric' })}</div><div>${fld('tuNgay', 'Áp dụng từ ngày', S.today, { req: 1, type: 'date' })}</div></div>
      ${fld('ghiChu', 'Ghi chú', '')}
      ${isQT() ? '' : '<p class="mut" style="font-size:12.5px">Giá nhập sau khi lưu chỉ Quản trị xem được.</p>'}`,
      async (v, d) => {
        v.maHang = it.maHang; v.gia = String(v.gia).replace(/[.\s,₫]/g, '');
        const r = QValidate.price(v); if (!r.ok) { showErrors(d, r.errors); return false; }
        return submit(d, 'price.add', { price: r.value }, 'Đã lưu giá');
      }, d => { const s = $('#f_loai', d); s.onchange = () => $('#nccBox', d).classList.toggle('hide', s.value !== 'NHAP'); });
  }
  function supplierForm(s) {
    const isNew = !s; s = s || {};
    dialog(isNew ? 'Thêm nhà cung cấp' : 'Sửa ' + esc(s.maNCC), `
      <div class="grid2"><div>${fld('maNCC', 'Mã NCC', s.maNCC, { req: 1, ro: !isNew })}</div><div>${fld('mst', 'Mã số thuế', s.mst, { im: 'numeric' })}</div></div>
      ${fld('ten', 'Tên nhà cung cấp', s.ten, { req: 1 })}${fld('diaChi', 'Địa chỉ', s.diaChi)}
      <div class="grid2"><div>${fld('lienHe', 'Người liên hệ', s.lienHe)}</div><div>${fld('dienThoai', 'Điện thoại', s.dienThoai, { type: 'tel' })}</div></div>
      ${fld('email', 'Email', s.email, { type: 'email' })}${fld('ghiChu', 'Ghi chú', s.ghiChu, { type: 'textarea' })}
      ${isNew ? '' : fld('trangThai', 'Trạng thái', s.trangThai || 'HOAT_DONG', { opts: [['HOAT_DONG', 'Đang giao dịch'], ['NGUNG', 'Ngừng giao dịch']] })}`,
      async (v, d) => { const r = QValidate.supplier(v); if (!r.ok) { showErrors(d, r.errors); return false; } return submit(d, 'supplier.upsert', { isNew, supplier: r.value }, 'Đã lưu ' + r.value.maNCC); });
  }
  function groupForm(g) {
    const isNew = !g; g = g || {};
    dialog(isNew ? 'Thêm nhóm hàng' : 'Sửa nhóm ' + esc(g.maNhom), `${fld('maNhom', 'Mã nhóm', g.maNhom, { req: 1, ro: !isNew })}${fld('ten', 'Tên nhóm', g.ten, { req: 1 })}
      ${fld('cha', 'Thuộc nhóm', g.cha || '', { opts: [['', '— Không —'], ...S.data.groups.filter(x => x.maNhom !== g.maNhom).map(x => [x.maNhom, x.ten])] })}`,
      async (v, d) => { const r = QValidate.group(v); if (!r.ok) { showErrors(d, r.errors); return false; } return submit(d, 'group.upsert', { group: r.value }, 'Đã lưu nhóm ' + r.value.maNhom); });
  }
  function userForm(u) {
    const isNew = !u; u = u || { vaiTro: 'XEM', trangThai: 'HOAT_DONG' };
    dialog(isNew ? 'Thêm người dùng' : 'Sửa ' + esc(u.email), `${fld('email', 'Gmail', u.email, { req: 1, ro: !isNew, type: 'email' })}${fld('hoTen', 'Họ tên', u.hoTen)}
      <div class="grid2"><div>${fld('vaiTro', 'Vai trò', u.vaiTro, { opts: Object.entries(ROLE) })}</div><div>${fld('trangThai', 'Trạng thái', u.trangThai, { opts: [['HOAT_DONG', 'Hoạt động'], ['KHOA', 'Khoá']] })}</div></div>`,
      async (v, d) => { const r = QValidate.user(v); if (!r.ok) { showErrors(d, r.errors); return false; } return submit(d, 'user.upsert', { user: r.value }, 'Đã lưu ' + r.value.email); });
  }
  // ---- góp ý: sao + loại + nội dung; lưu hàng đợi khi mất mạng ----
  function feedbackForm(pre = {}) {
    let sao = 0;
    dialog('Góp ý & đánh giá', `<label class="f">Mức hài lòng</label><div class="stars" role="group" aria-label="Chấm sao">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-s="${n}" aria-pressed="false" aria-label="${n} sao – ${STARS[n]}">★</button>`).join('')}</div><div class="starlbl" id="slbl"></div>
      ${fld('loai', 'Loại góp ý', pre.loai || 'DE_XUAT', { opts: Object.entries(FBTYPE) })}${fld('noiDung', 'Nội dung', pre.noiDung || '', { type: 'textarea' })}
      <p class="mut" style="font-size:12.5px">Kèm tự động: phiên bản app ${VER}, loại thiết bị, màn hình đang mở. Không gửi vị trí.</p>`,
      async (v, d) => {
        const fb = { sao, loai: v.loai, noiDung: v.noiDung, banDung: VER, thietBi: navigator.userAgent.slice(0, 180), manHinh: route() };
        const r = QValidate.feedback(fb); if (!r.ok) { showErrors(d, r.errors); return false; }
        if (S.offline) { queueFeedback(r.value); toast('Đã lưu góp ý trên máy, sẽ gửi khi có mạng'); return true; }
        const res = await write('feedback.add', { feedback: r.value });
        if (!res.ok) { if (['NETWORK', 'NOT_JSON', 'INTERNAL', 'LOCK_TIMEOUT'].includes(res.code)) { queueFeedback(r.value); toast('Đã lưu góp ý trên máy, sẽ gửi khi có mạng'); return true; } dlgMsg(d, 'Chưa gửi: ' + (res.error || res.code)); return false; }
        LS.set('qlhh-rated', true); toast('Cảm ơn anh/chị! Góp ý đã gửi.'); sync(); return true;
      }, d => $$('.stars button', d).forEach(b => b.onclick = () => { sao = +b.dataset.s; $$('.stars button', d).forEach(x => x.setAttribute('aria-pressed', +x.dataset.s <= sao)); $('#slbl', d).textContent = STARS[sao]; }), 'Gửi');
  }
  function feedbackStatus(f) {
    dialog('Cập nhật góp ý ' + esc(f.id), `<p>${f.sao ? '★'.repeat(f.sao) + ' · ' : ''}${esc(FBTYPE[f.loai] || f.loai)} — ${esc(f.email)}</p><p>${esc(f.noiDung)}</p><p class="mut" style="font-size:12.5px">${esc(f.banDung)} · ${esc(f.manHinh)} · ${esc(f.thietBi)}</p>
      ${fld('trangThai', 'Trạng thái', f.trangThai, { opts: Object.entries(FBST) })}${fld('note', 'Ghi chú xử lý', f.note, { type: 'textarea' })}`,
      async (v, d) => submit(d, 'feedback.update', { id: f.id, trangThai: v.trangThai, note: v.note }, 'Đã cập nhật'));
  }
  const QK = () => 'qlhh-fbq:' + (S.co && S.co.id) + ':' + (S.user && S.user.email);
  function queueFeedback(fb) { const q = LS.get(QK(), []); q.push({ fb, requestId: rid() }); LS.set(QK(), q.slice(-20)); }
  async function flushFeedbackQueue() {
    const q = LS.get(QK(), []); if (!q.length || !S.session) return;
    const left = [];
    for (const x of q) { const r = await call('feedback.add', { requestId: x.requestId, feedback: x.fb }, 2); if (!r.ok && ['NETWORK', 'NOT_JSON', 'INTERNAL', 'LOCK_TIMEOUT'].includes(r.code)) left.push(x); }
    LS.set(QK(), left); if (left.length < q.length) toast(`Đã gửi ${q.length - left.length} góp ý lưu trên máy`);
  }
  function countUse() {
    const n = LS.get('qlhh-uses', 0) + 1; LS.set('qlhh-uses', n);
    if (n === 3 && !LS.get('qlhh-rated', false)) setTimeout(() => toast('Anh/chị thấy QLHH thế nào?', 'Đánh giá', () => feedbackForm(), 12000), 4000);
  }

  // ---------------- xuất Excel ----------------
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  async function exportItems() {
    const list = filteredItems(), gname = g => (S.data.groups.find(x => x.maNhom === g) || {}).ten || g;
    const rows = list.map(i => ({ 'Mã hàng': i.maHang, 'Tên hàng': i.ten, 'Nhóm': gname(i.nhom), 'Quy cách': i.quyCach, 'ĐVT': i.dvt, 'Hãng': i.hang, 'Xuất xứ': i.xuatXu, 'Bảo hành (tháng)': i.thangBH, 'Tồn tối thiểu': i.tonToiThieu, 'Giá bán (₫)': giaBan(i), ...(isQT() ? { 'Giá vốn (₫)': i.giaVon } : {}), 'Quản lý serial': i.quanLySerial === true || i.quanLySerial === 'true' ? 'Có' : '', 'Trạng thái': i.trangThai === 'NGUNG' ? 'Ngừng KD' : 'Đang KD' }));
    const name = `QLHH_${S.co.id}_DanhMucHang_${S.today}`;
    try {
      if (!window.XLSX) await loadScript('vendor/xlsx.full.min.js');   // SheetJS 0.18.5 đặt sẵn trong app (không phụ thuộc CDN)
      const ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = Object.keys(rows[0] || { a: 1 }).map(k => ({ wch: Math.max(10, k.length + 2) }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'DanhMucHang'); XLSX.writeFile(wb, name + '.xlsx');
    } catch (e) {
      const head = Object.keys(rows[0] || {}), csv = '﻿' + [head, ...rows.map(r => head.map(h => r[h]))].map(r => r.map(v => { let x = String(v ?? ''); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return `"${x.replace(/"/g, '""')}"`; }).join(',')).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name + '.csv'; a.click();
      toast('Đã xuất CSV (mở được bằng Excel)');
    }
  }

  // ---------------- tiện ích giao diện ----------------
  function toast(msg, btnText, onBtn, ms = 4500) {
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = `<span style="flex:1">${esc(msg)}</span>${btnText ? `<button class="btn" type="button">${esc(btnText)}</button>` : ''}`;
    if (btnText) $('button', t).onclick = () => { t.remove(); onBtn(); };
    const box = $('#toasts'); box.appendChild(t); while (box.children.length > 3) box.firstChild.remove();   // tối đa 3 thông báo
    setTimeout(() => t.remove(), ms);
  }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; LS.set('qlhh-theme', nx); applyCo();
  }
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; installBtn(); });
  function installBtn() {
    const b = $('#instBtn'); if (!b) return;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (standalone || (!deferredInstall && !ios)) return b.classList.add('hide');
    b.classList.remove('hide');
    b.onclick = async () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; b.classList.add('hide'); } else dialog('Cài QLHH lên iPhone', '<ol><li>Mở trang này bằng <b>Safari</b>.</li><li>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên).</li><li>Chọn <b>Thêm vào MH chính</b> → <b>Thêm</b>.</li></ol>'); };
  }
  document.addEventListener('keydown', e => {
    const t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t.getAttribute && t.getAttribute('role') === 'button' && !/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { e.preventDefault(); t.click(); return; }
    if (e.key === 'Escape' && S.sel && !$('#dlg').open) { history.state && history.state.det ? history.back() : closeDetail(); return; }
  });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { const q = $('#qd') || $('#qm'); if (q) { e.preventDefault(); q.focus(); q.select(); } } });
  window.addEventListener('hashchange', e => {
    if (S.scanStop) S.scanStop();
    const dg = $('#dlg');
    if (dg && dg.open) {   // nút Back / vuốt lùi khi đang nhập: hỏi lại; ở lại thì trả địa chỉ cũ
      if (dg._isDirty && dg._isDirty() && !confirm('Bỏ nội dung đang nhập dở?')) { history.pushState(null, '', new URL(e.oldURL).hash || '#/hang'); renderView(); return; }   // ở lại: thêm lại mục lịch sử (Back lần sau vẫn hỏi)
      dg.close();
    }
    if (S.user) { S.sel = null; if (route() !== 'kho') KS.sel = null; if (route() !== 'sx') SX.sel = null; renderView(); } });
  window.addEventListener('online', () => { if (S.user) { S.pollNext = 0; poll(true); } });
  matchMedia(MOBILE).addEventListener('change', () => { if (S.user && S.data && route() === 'hang') renderResults(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.scanStop) S.scanStop(); return; } if (S.user && S.data) poll(true); });   // ẩn app: tắt camera; quay lại: kiểm tra phiên bản theo quy tắc "đang bận"
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, () => { S.lastAct = Date.now(); }, { passive: true }));

  // ---------------- khởi động ----------------
  async function restore() {
    applyCo();
    const saved = await IDB.get('sess:' + S.co.id);
    if (saved && saved.session) { S.session = saved.session; S.user = saved.user; S.data = null; S.version = 0; await boot(); }
    else { S.session = null; S.user = null; renderLogin(); }
  }
  (async function start() {
    const th = LS.get('qlhh-theme', null); if (th) document.documentElement.dataset.theme = th;
    S.co = company(LS.get('qlhh-co', 'LAVIPCO')) || CFG.companies[0];
    const qc = (location.hash.match(/^#\/t\/([^/]+)\//) || [])[1]; if (qc && company(qc)) S.co = company(qc);   // QR tủ: mở đúng công ty của tem (không đổi công ty mặc định đã lưu)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (await handleReturn()) return;
    await restore();
  })();
  window.QLHH_DEBUG = S;
})();
