/* QLHH — giao diện PWA v0.1 (đợt ①). Không framework; lõi validate/perm/price/search dùng chung với máy chủ. */
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
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 18l-6-6 6-6"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    warn: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
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
    return { get: k => tx('readonly', s => s.get(k)).catch(() => null), set: (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => null), del: k => tx('readwrite', s => s.delete(k)).catch(() => null) };
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
  const RETRY = ['LOCK_TIMEOUT', 'INTERNAL', 'NOT_JSON', 'NETWORK'];
  async function call(action, body = {}, tries = 1) {
    if (!S.co || !S.co.url) return { ok: false, code: 'CONFIG', error: 'Công ty chưa cấu hình máy chủ' };
    let wait = 1000, last;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(S.co.url, { method: 'POST', redirect: 'follow', credentials: 'omit', body: JSON.stringify({ action, session: S.session, ...body }) });
        const t = await r.text();
        try { last = JSON.parse(t); } catch (e) { last = { ok: false, code: 'NOT_JSON', error: 'Máy chủ trả về trang lỗi' }; }
        setOffline(false);
      } catch (e) { last = { ok: false, code: 'NETWORK', error: 'Không kết nối được máy chủ' }; setOffline(true); }
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
  function expire(msg) { if (S.user) IDB.del(cacheKey()); IDB.del('sess:' + S.co.id); S.session = null; S.user = null; S.data = null; S.version = 0; toast(msg || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'); renderLogin(); }

  // ---------------- đăng nhập ----------------
  async function startLogin() {
    if (!S.co.url) return toast(`${S.co.ten} chưa có máy chủ — liên hệ quản trị`);
    const btn = $('#loginBtn'); btn && btn.classList.add('busy');
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
    if (p.has('error')) { renderLogin(); toast('Google báo: ' + p.get('error')); return true; }
    renderLogin('Đang xác minh với máy chủ…');
    const r = await call('auth.login', { idToken: p.get('id_token') }, 3);
    if (!r.ok) { renderLogin(); toast('Đăng nhập thất bại: ' + (r.error || r.code)); return true; }
    S.session = r.data.session; S.user = { email: r.data.email, vaiTro: r.data.vaiTro, hoTen: r.data.hoTen };
    await IDB.set('sess:' + co.id, { session: S.session, user: S.user });
    countUse();
    await boot();
    return true;
  }
  async function logout() {
    if (S.co && S.user) await IDB.del(cacheKey());
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
  async function sync() {
    const r = await call('sync.pull', { since: S.data ? S.version : 0 }, 3);
    if (!r.ok) {
      if (S.offline) { renderView(); toast(S.data ? 'Đang ngoại tuyến — xem dữ liệu lưu gần nhất' : 'Không kết nối được máy chủ'); }
      else if (r.code === 'FORBIDDEN') expire('Tài khoản đã bị khoá hoặc chưa được cấp quyền — đã xoá dữ liệu trên máy');
      else if (r.code !== 'AUTH_INVALID' && r.code !== 'AUTH_EXPIRED') toast('Lỗi tải dữ liệu: ' + (r.error || r.code));
      return;
    }
    if (r.data.today) S.today = r.data.today;
    if (r.data.me && S.user && r.data.me.vaiTro !== S.user.vaiTro) {   // QT vừa đổi vai trò của mình
      if (r.data.me.vaiTro !== 'QUAN_TRI') await IDB.del(cacheKey());
      S.user = { ...S.user, ...r.data.me }; IDB.set('sess:' + S.co.id, { session: S.session, user: S.user }); S.data = null; S.version = 0;
      toast('Vai trò của anh/chị đã đổi thành ' + (ROLE[S.user.vaiTro] || S.user.vaiTro)); renderShell(); return sync();
    }
    if (!r.data.unchanged) {
      S.data = r.data.data; S.version = r.data.version; reindex();
      IDB.set(cacheKey(), { data: S.data, version: S.version, at: Date.now() });
      if (isQT() && r.data.warnings && r.data.warnings.length) toast(`Sheet có ${r.data.warnings.length} dòng sai kiểu (vd ${r.data.warnings[0]})`);
    }
    renderView();
    flushFeedbackQueue();
  }
  function reindex() { S.idx = QSearch.buildIndex(S.data.items); }

  // ---------------- khung ----------------
  function applyCo() {
    document.documentElement.style.setProperty('--co', S.co.mau);
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name=theme-color]').setAttribute('content', dark ? '#0b1220' : S.co.mau);
  }
  const ROUTES = [
    { id: 'hang', ten: 'Danh mục hàng', icon: 'box' },
    { id: 'ncc', ten: 'Giá & NCC', icon: 'tag' },
    { id: 'nhom', ten: 'Nhóm hàng', icon: 'layers' },
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
    const nav = ROUTES.filter(x => !x.qt || isQT()).map(x => `<a href="#/${x.id}" ${x.id === r ? 'aria-current="page"' : ''}>${ic(x.icon)}<span>${x.ten}</span></a>`).join('');
    $('#root').innerHTML = `<div class="app">
      <aside class="side"><div class="brand"><div class="logo">Q</div><div><b>QLHH</b><button class="cobtn" id="coSwitch" title="Đổi công ty">${esc(S.co.ten)} ▾</button></div></div>
        <nav class="nav" aria-label="Chức năng">${nav}</nav>
        <div class="me"><div style="font-weight:600;word-break:break-all">${esc(S.user.email)}</div><div style="opacity:.8">${ROLE[S.user.vaiTro] || ''} · v${VER}</div>
          <div class="row"><button class="btn" id="fbBtn" title="Góp ý & đánh giá">${ic('chat')}</button><button class="btn" id="themeBtn" title="Sáng/tối">${ic('moon')}</button><button class="btn hide" id="instBtn" title="Cài đặt app">${ic('install')}</button><button class="btn" id="outBtn" title="Đăng xuất">${ic('out')}</button></div></div>
      </aside>
      <main id="main"></main></div>
      <nav class="bnav" aria-label="Chức năng">
        <a href="#/hang" ${r === 'hang' ? 'aria-current="page"' : ''}>${ic('box')}Hàng</a>
        <a href="#/ncc" ${r === 'ncc' ? 'aria-current="page"' : ''}>${ic('tag')}Giá & NCC</a>
        <a href="#/gopy" ${r === 'gopy' ? 'aria-current="page"' : ''}>${ic('chat')}Góp ý</a>
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
    const items = ROUTES.filter(x => !x.qt || isQT()).filter(x => !['hang', 'ncc', 'gopy'].includes(x.id));
    dialog('Thêm', `<div class="list">${items.map(x => `<a class="it" href="#/${x.id}" data-close>${ic(x.icon)}<span style="flex:1">${x.ten}</span></a>`).join('')}
      <button class="it btn ghost" style="width:100%;justify-content:flex-start" id="mCo" type="button">Đổi công ty (đang: ${esc(S.co.ten)})</button>
      <button class="it btn ghost" style="width:100%;justify-content:flex-start" id="mTheme" type="button">${ic('moon')} Giao diện sáng/tối</button>
      <button class="it btn ghost" style="width:100%;justify-content:flex-start" id="mOut" type="button">${ic('out')} Đăng xuất (${esc(S.user.email)})</button></div>`, null, d => {
      $$('[data-close]', d).forEach(a => a.onclick = () => d.close());
      $('#mCo', d).onclick = () => { d.close(); switchCo(); }; $('#mTheme', d).onclick = toggleTheme; $('#mOut', d).onclick = () => { d.close(); logout(); };
    });
  }
  function header(title, actions = '', search = false, addId = '') {
    return `<div class="mtop">${title === 'Danh mục hàng' ? '' : `<a class="btn ghost iconbtn" href="#/hang" aria-label="Quay lại">${ic('back')}</a>`}<h1>${title}</h1><span class="cobadge">${esc(S.co.ten)}</span>${addId ? `<button class="btn pri iconbtn" type="button" id="${addId}" aria-label="Thêm">${ic('plus')}</button>` : ''}</div>
      ${search ? `<label class="msearch">${ic('search')}<span class="sr">Tìm hàng</span><input id="qm" type="search" inputmode="search" placeholder="Tìm mã, tên, quy cách…" value="${esc(S.q)}" autocomplete="off"></label>` : ''}
      <div class="top"><h1>${title}</h1><span class="cobadge">${esc(S.co.ten)}</span>${search ? `<label class="search">${ic('search')}<span class="sr">Tìm hàng</span><input id="qd" type="search" placeholder="Tìm mã, tên, quy cách… (Ctrl K)" value="${esc(S.q)}" autocomplete="off"></label>` : ''}${actions}</div>
      ${S.offline ? `<div class="banner" role="status">${ic('warn')} Đang ngoại tuyến — chỉ xem dữ liệu đã lưu, chưa ghi được.</div>` : ''}`;
  }

  // ---------------- màn hình ----------------
  function renderView(loading) {
    const m = $('#main'); if (!m) return;
    $$('.nav a,.bnav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#/' + route()));
    $$('.nav a[aria-current],.bnav a[aria-current]').forEach(a => a.setAttribute('aria-current', 'page'));
    const mb = $('#moreBtn'); if (mb) mb.toggleAttribute('aria-current', ['nhom', 'nguoidung'].includes(route()));
    if (!S.data) { m.innerHTML = header('Đang tải…') + `<div class="card">${'<div class="skel"></div>'.repeat(6)}</div>`; return; }
    ({ hang: viewItems, ncc: viewSuppliers, nhom: viewGroups, nguoidung: viewUsers, gopy: viewFeedback })[route()](m);
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
  window.addEventListener('popstate', () => { if (S.sel) closeDetail(); else renderView(); });
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
        ${safeUrl(i.taiLieuUrl) ? `<dt>Tài liệu</dt><dd><a href="${esc(safeUrl(i.taiLieuUrl))}" target="_blank" rel="noopener noreferrer">Mở tài liệu</a></dd>` : ''}</dl>
      ${canEdit() && !S.offline ? `<div class="acts"><button class="btn" id="edItem">Sửa</button><button class="btn" id="addPrice">${ic('plus')} Thêm giá</button><button class="btn ${i.trangThai === 'NGUNG' ? '' : 'danger'}" id="stopItem">${i.trangThai === 'NGUNG' ? 'Kinh doanh lại' : 'Ngừng KD'}</button></div>` : ''}
      <div class="hist"><h3>Lịch sử giá bán</h3>${ban.length ? `<ul>${ban.slice(0, 12).map(p => `<li><span>Từ ${esc(p.tuNgay)}</span><b>${money(p.gia)}</b></li>`).join('')}</ul>` : '<p class="mut">Chưa có giá bán.</p>'}</div>
      ${isQT() ? `<div class="hist"><h3>Giá nhập theo NCC</h3>${nhap.length ? `<ul>${nhap.slice(0, 12).map(p => `<li><span>${esc(sup(p.maNCC))} · ${esc(p.tuNgay)}</span><b>${money(p.gia)}</b></li>`).join('')}</ul>` : '<p class="mut">Chưa có giá nhập.</p>'}</div>` : ''}`;
  }
  function bindDetail() {
    const b = $('#detBack'); if (b) b.onclick = () => history.state && history.state.det ? history.back() : closeDetail();
    const i = S.sel && S.data.items.find(x => x.maHang === S.sel); if (!i) return;
    const e = $('#edItem'); if (e) e.onclick = () => itemForm(i);
    const p = $('#addPrice'); if (p) p.onclick = () => priceForm(i);
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

  // ---------------- hộp thoại & biểu mẫu ----------------
  function dialog(title, body, onSubmit, after, submitText = 'Lưu') {
    const d = $('#dlg');
    const back = document.activeElement;
    d.innerHTML = `<form method="dialog" novalidate><header><h2>${title}</h2><button class="btn ghost iconbtn" type="button" data-x aria-label="Đóng">${ic('x')}</button></header><div class="body">${body}<div class="dlgmsg" id="dlgMsg" role="alert"></div></div>${onSubmit ? `<footer><button class="btn" type="button" data-x>Huỷ</button><button class="btn pri" id="dlgOk" type="submit">${submitText}</button></footer>` : ''}</form>`;
    const f = $('form', d);
    $$('[data-x]', d).forEach(b => b.onclick = () => d.close());
    d.onclose = () => { if (back && back.isConnected && back.focus) back.focus(); };
    f.onsubmit = async e => {
      e.preventDefault(); if (!onSubmit) return d.close();
      const ok = $('#dlgOk'); if (ok.disabled) return; ok.classList.add('busy'); ok.disabled = true; $('#dlgMsg', d).textContent = '';
      try { const done = await onSubmit(Object.fromEntries(new FormData(f)), d); if (done) d.close(); } finally { ok.classList.remove('busy'); ok.disabled = false; }
    };
    d.onclick = e => { if (e.target === d) d.close(); };
    if (after) after(d);
    d.showModal();
    const first = $('.body input:not([type=hidden]):not([readonly]),.body select,.body textarea', d); if (first && matchMedia('(pointer:fine)').matches) first.focus();
    $$('.body .in', d).forEach(i => { const e = $('#e_' + i.name, d); if (e) i.setAttribute('aria-describedby', e.id); });
    return d;
  }
  const fld = (name, label, val = '', o = {}) => `<label class="f" for="f_${name}">${label}${o.req ? ' *' : ''}</label>${o.type === 'textarea' ? `<textarea class="in" id="f_${name}" name="${name}" ${o.ro ? 'readonly' : ''}>${esc(val)}</textarea>` : o.opts ? `<select class="in" id="f_${name}" name="${name}">${o.opts.map(([k, t]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : `<input class="in" id="f_${name}" name="${name}" value="${esc(val)}" ${o.type ? `type="${o.type}"` : ''} ${o.ro ? 'readonly' : ''} ${o.im ? `inputmode="${o.im}"` : ''} autocomplete="off">`}<div class="err" id="e_${name}"></div>`;
  function showErrors(d, errs) {
    $$('.err', d).forEach(e => e.textContent = ''); $$('.in', d).forEach(i => i.removeAttribute('aria-invalid'));
    let first = null;
    Object.entries(errs || {}).forEach(([k, v]) => { const e = $('#e_' + k, d), i = $('#f_' + k, d); if (e) e.textContent = v; if (i) { i.setAttribute('aria-invalid', 'true'); first = first || i; } });
    if (first) first.focus();
    if (errs && errs._) dlgMsg(d, errs._);
  }
  function dlgMsg(d, m) { const x = $('#dlgMsg', d); if (x) x.textContent = m; else toast(m); }
  async function submit(d, action, body, okMsg) {
    if (S.offline) { dlgMsg(d, 'Đang ngoại tuyến — chưa lưu được. Dữ liệu trong ô vẫn giữ nguyên.'); return false; }
    const r = await write(action, body);
    if (!r.ok) { if (r.fields && !Array.isArray(r.fields)) showErrors(d, r.fields); dlgMsg(d, 'Chưa lưu: ' + (r.error || r.code) + (r.code === 'NETWORK' ? ' — kiểm tra mạng rồi bấm Lưu lại' : '')); return false; }
    toast(okMsg); await sync(); return true;
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
  window.addEventListener('hashchange', () => { if (S.user) { S.sel = null; renderView(); } });
  window.addEventListener('online', () => { if (S.user) sync(); });
  matchMedia(MOBILE).addEventListener('change', () => { if (S.user && S.data && route() === 'hang') renderResults(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.user && S.data) sync(); });

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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (await handleReturn()) return;
    await restore();
  })();
  window.QLHH_DEBUG = S;
})();
