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
    check: '<path d="M20 6L9 17l-5-5"/>', tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
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
    { id: 'kho', ten: 'Tồn kho', icon: 'stock' },
    { id: 'phieu', ten: 'Phiếu kho', icon: 'doc' },
    { id: 'sx', ten: 'Sản xuất tủ', icon: 'tool' },
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
    const mb = $('#moreBtn'); if (mb) mb.toggleAttribute('aria-current', ['nhom', 'nguoidung', 'ncc', 'gopy', 'khach', 'baocao', 'sx', 't'].includes(route()));
    if (!S.data) { m.innerHTML = header('Đang tải…') + `<div class="card">${'<div class="skel"></div>'.repeat(6)}</div>`; return; }
    ({ hang: viewItems, kho: viewStock, phieu: viewVouchers, sx: viewSX, t: viewTu, khach: viewCustomers, baocao: viewReport, ncc: viewSuppliers, nhom: viewGroups, nguoidung: viewUsers, gopy: viewFeedback })[route()](m);
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
  window.addEventListener('popstate', () => { if (S.sel) closeDetail(); else if (SX.sel && route() === 'sx') { SX.sel = null; renderView(); } else if (KS.sel && route() === 'kho') { KS.sel = null; renderView(); } else renderView(); });
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
      <div class="hist"><h3>Lịch sử giá bán</h3>${ban.length ? `<ul>${ban.slice(0, 12).map(p => `<li><span>Từ ${esc(p.tuNgay)}</span><b>${money(p.gia)}</b></li>`).join('')}</ul>` : '<p class="mut">Chưa có giá bán.</p>'}</div>
      ${isQT() ? `<div class="hist"><h3>Giá nhập theo NCC</h3>${nhap.length ? `<ul>${nhap.slice(0, 12).map(p => `<li><span>${esc(sup(p.maNCC))} · ${esc(p.tuNgay)}</span><b>${money(p.gia)}</b></li>`).join('')}</ul>` : '<p class="mut">Chưa có giá nhập.</p>'}</div>` : ''}`;
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
  const TAO_DUOC = ['NHAP_MUA', 'XUAT_BAN', 'XUAT_CONG_TRINH', 'CHUYEN_KHO', 'KIEM_KE', 'KHACH_TRA', 'TRA_NCC', 'XUAT_BH', 'NHAP_HANG_LOI', 'TON_DAU'];
  const NHOM_PHIEU = { nhap: ['TON_DAU', 'NHAP_MUA', 'KHACH_TRA', 'NHAP_TP', 'NHAP_LAI_SX', 'NHAP_HANG_LOI'], xuat: ['XUAT_BAN', 'XUAT_CONG_TRINH', 'XUAT_BH', 'XUAT_SX', 'TRA_NCC'], khac: ['CHUYEN_KHO', 'KIEM_KE'], dao: ['DAO'] };
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
  const KS = { q: '', kho: '', lowOnly: false, pq: '', pg: '', sel: null };

  function viewStock(m) {
    const d = S.data, ws = d.warehouses || [];
    const list0 = QSearch.search(d.items, KS.q, S.idx).filter(i => i.trangThai !== 'NGUNG' || tonQ(i.maHang) !== 0);
    const list = list0.filter(i => (!KS.lowOnly || low(i)) && (!KS.kho || tonRow(i.maHang, KS.kho)));
    const nLow = d.items.filter(low).length, val = isQT() ? (d.stock || []).filter(t => t.kho === '*').reduce((a, t) => a + (Number(t.giaTri) || 0), 0) : null;
    const thisMonth = (d.vouchers || []).filter(p => String(p.ngay).slice(0, 7) === S.today.slice(0, 7)).length;
    const act = (canEdit() ? `<button class="btn pri" id="newV">${ic('plus')}<span>Lập phiếu</span></button>` : '') + (isQT() ? `<button class="btn" id="khoAdm">${ic('layers')}<span>Kho & khoá sổ</span></button>` : '') + `<button class="btn" id="xlsT">${ic('dl')}<span>Xuất Excel</span></button>`;
    m.innerHTML = header('Tồn kho', act, false, canEdit() ? 'newVM' : '') +
      `<label class="msearch">${ic('search')}<span class="sr">Tìm hàng</span><input id="qkm" type="search" placeholder="Tìm mã, tên hàng…" value="${esc(KS.q)}" autocomplete="off"></label>
      <div class="kpi"><div class="k"><small>Mã có tồn</small><b>${(d.stock || []).filter(t => t.kho === '*' && Number(t.soLuong) > 0).length.toLocaleString('vi-VN')}</b></div>
        <div class="k"><small>⚠ Dưới tồn tối thiểu</small><b>${nLow}</b></div><div class="k"><small>${isQT() ? 'Giá trị tồn (giá vốn)' : 'Số kho'}</small><b>${isQT() ? money(val) : ws.length}</b></div>
        <div class="k"><small>Phiếu tháng này</small><b>${thisMonth}</b></div></div>
      <div class="top" style="margin-top:-4px"><label class="search" style="flex:1 1 380px">${ic('search')}<span class="sr">Tìm hàng</span><input id="qkd" type="search" placeholder="Tìm mã, tên hàng…" value="${esc(KS.q)}" autocomplete="off"></label></div>
      <div class="chips" role="group" aria-label="Lọc kho">${[['', 'Tất cả kho'], ...ws.map(w => [w.maKho, w.ten])].map(([k, t]) => `<button class="chip" type="button" data-k="${esc(k)}" aria-pressed="${KS.kho === k}">${esc(t)}</button>`).join('')}
        <button class="chip" type="button" id="lowT" aria-pressed="${KS.lowOnly}">⚠ Dưới tồn tối thiểu (${nLow})</button></div>
      ${(d.vouchers || []).length ? '' : `<div class="banner" role="status" style="background:var(--acc-soft)">Chưa có phiếu kho. ${canEdit() ? 'Bắt đầu bằng phiếu <b>Tồn đầu kỳ</b> (hàng đang có) hoặc <b>Nhập mua</b>.' : ''}</div>`}
      ${d.config && d.config.ngayKhoaSo ? `<p class="mut" style="margin:0 0 10px">Đã khoá sổ đến hết ngày <b>${esc(d.config.ngayKhoaSo)}</b>.</p>` : ''}
      <div class="layout"><div class="card"><div class="tbl" id="stockRes"></div></div><section class="card det ${KS.sel ? '' : 'closed'}" id="kdet" aria-label="Chi tiết tồn">${stockDetail()}</section></div>`;
    const draw = () => {
      const box = $('#stockRes'), mob = isMobile(), rows = list.slice(0, 300);
      const wcols = ws.filter(w => (d.stock || []).some(t => t.kho === w.maKho && Number(t.soLuong)));   // ẩn cột kho không có hàng
      const q = i => KS.kho ? tonQ(i.maHang, KS.kho) : tonQ(i.maHang);
      const warn = i => low(i) ? ` <span class="tag stop">${ic('warn')} dưới tối thiểu ${num(i.tonToiThieu)}</span>` : '';
      box.innerHTML = rows.length ? (mob
        ? `<div class="list">${rows.map(i => `<div class="it" data-km="${esc(i.maHang)}" role="button" tabindex="0" aria-selected="${KS.sel === i.maHang}"><div><div class="mono">${esc(i.maHang)}</div>${esc(i.ten)}${warn(i)}</div><div style="text-align:right;white-space:nowrap"><b>${num(q(i))}</b><br><small class="mut">${esc(i.dvt)}</small></div></div>`).join('')}</div>`
        : `<table><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th>ĐVT</th>${KS.kho || wcols.length < 2 ? '' : wcols.map(w => `<th class="n">${esc(w.ten)}</th>`).join('')}<th class="n" title="Không gồm kho hàng lỗi">${KS.kho ? esc(khoName(KS.kho)) : 'Tổng tồn'}</th>${isQT() ? '<th class="n">Giá vốn</th><th class="n">Giá trị</th>' : ''}</tr></thead><tbody>
          ${rows.map(i => { const t = tonRow(i.maHang) || {}; return `<tr data-km="${esc(i.maHang)}" role="button" tabindex="0" aria-selected="${KS.sel === i.maHang}"><td class="mono">${esc(i.maHang)}</td><td>${esc(i.ten)}${warn(i)}</td><td>${esc(i.dvt)}</td>${KS.kho || wcols.length < 2 ? '' : wcols.map(w => `<td class="n">${num(tonQ(i.maHang, w.maKho) || '')}</td>`).join('')}<td class="n"><b>${num(q(i))}</b></td>${isQT() ? `<td class="n">${money(i.giaVon)}</td><td class="n">${money(t.giaTri)}</td>` : ''}</tr>`; }).join('')}</tbody></table>`)
        : `<div class="empty">${d.items.length ? 'Không có mã nào khớp bộ lọc.' : 'Chưa có mặt hàng — thêm ở Danh mục hàng.'}${canEdit() && !(d.vouchers || []).length ? '<br>Bắt đầu bằng phiếu <b>Tồn đầu kỳ</b> hoặc <b>Nhập mua</b>.' : ''}</div>`;
      $$('[data-km]', box).forEach(r => r.onclick = () => { KS.sel = r.dataset.km; const det = $('#kdet'); det.innerHTML = stockDetail(); det.classList.remove('closed'); bindStockDetail(); $$('[data-km]').forEach(x => x.setAttribute('aria-selected', x.dataset.km === KS.sel)); if (isMobile()) history.pushState({ kdet: 1 }, ''); });
    };
    let t = null; $$('#qkm,#qkd').forEach(q => { let comp = false; q.addEventListener('compositionstart', () => comp = true); q.addEventListener('compositionend', () => { comp = false; q.dispatchEvent(new Event('input')); }); q.oninput = () => { if (comp) return; KS.q = q.value; clearTimeout(t); t = setTimeout(() => viewStock(m), 250); }; });
    $$('.chip[data-k]').forEach(b => b.onclick = () => { KS.kho = b.dataset.k; viewStock(m); });
    $('#lowT').onclick = () => { KS.lowOnly = !KS.lowOnly; viewStock(m); };
    $$('#newV,#newVM').forEach(b => b.onclick = () => voucherPick());
    const ka = $('#khoAdm'); if (ka) ka.onclick = khoAdmin;
    $('#xlsT').onclick = () => exportRows(`TonKho_${S.today}`, list.map(i => ({ 'Mã hàng': i.maHang, 'Tên hàng': i.ten, 'ĐVT': i.dvt, ...Object.fromEntries(ws.map(w => [w.ten, tonQ(i.maHang, w.maKho)])), 'Tồn (không gồm hàng lỗi)': tonQ(i.maHang), 'Tồn tối thiểu': i.tonToiThieu, ...(isQT() ? { 'Giá vốn BQ': i.giaVon, 'Giá trị tồn': (tonRow(i.maHang) || {}).giaTri } : {}) })));
    draw(); bindStockDetail();
  }
  function stockDetail() {
    if (!KS.sel) return '<div class="empty">Chọn một mã để xem tồn từng kho và số serial.</div>';
    const i = itemOf(KS.sel), ser = (S.data.serials || []).filter(x => x.maHang === i.maHang);
    const ps = (S.data.vouchers || []).slice(-500);
    return `<button class="btn ghost back" id="kBack">${ic('back')} Quay lại</button><div class="mono mut">${esc(i.maHang)}</div><h2>${esc(i.ten)}</h2>
      <dl class="dl">${(S.data.warehouses || []).map(w => `<dt>${esc(w.ten)}</dt><dd>${num(tonQ(i.maHang, w.maKho))} ${esc(i.dvt)}${w.loai === 'HANG_LOI' ? ' <small class="mut">(hàng lỗi)</small>' : ''}</dd>`).join('')}
        <dt>Tồn tối thiểu</dt><dd>${i.tonToiThieu !== '' ? num(i.tonToiThieu) + ' ' + esc(i.dvt) : '—'}${low(i) ? ` <span class="tag stop">${ic('warn')} thiếu</span>` : ''}</dd>
        ${isQT() ? `<dt>Giá vốn BQ</dt><dd>${money(i.giaVon)}</dd><dt>Giá trị tồn</dt><dd>${money((tonRow(i.maHang) || {}).giaTri)}</dd>` : ''}</dl>
      ${canEdit() && !S.offline ? `<div class="acts"><button class="btn pri" id="kIn">Nhập</button><button class="btn" id="kOut">Xuất</button><button class="btn" id="kKK">Kiểm kê</button></div>` : ''}
      ${ser.length ? `<div class="hist"><h3>Serial đang trong kho (${ser.length})</h3><ul>${ser.slice(0, 50).map(x => `<li><span class="mono">${esc(x.serial)}</span><span>${esc(khoName(x.kho))}${x.trangThai === 'HANG_LOI' ? ' · lỗi' : ''}</span></li>`).join('')}</ul></div>` : ''}`;
  }
  function bindStockDetail() {
    const b = $('#kBack'); if (b) b.onclick = () => history.state && history.state.kdet ? history.back() : (KS.sel = null, renderView());
    const i = KS.sel && itemOf(KS.sel); if (!i) return;
    const line = { maHang: i.maHang };
    const a = $('#kIn'); if (a) a.onclick = () => voucherForm('NHAP_MUA', { lines: [line] });
    const o = $('#kOut'); if (o) o.onclick = () => voucherForm('XUAT_CONG_TRINH', { lines: [line] });
    const k = $('#kKK'); if (k) k.onclick = () => voucherForm('KIEM_KE', { lines: [line] });
  }

  // ---------- danh sách phiếu ----------
  function viewVouchers(m) {
    const d = S.data, all = (d.vouchers || []).slice().sort((a, b) => b.ngay < a.ngay ? -1 : b.ngay > a.ngay ? 1 : b.stt - a.stt);
    const nq = QSearch.norm(KS.pq);
    const list = all.filter(p => (!KS.pg || NHOM_PHIEU[KS.pg].includes(p.loai)) && (!nq || QSearch.norm([p.soPhieu, custName(p.maKH), projName(p.maCongTrinh), supName(p.maNCC), p.lyDo, p.soCTGoc].join(' ')).includes(nq)));
    m.innerHTML = header('Phiếu kho', canEdit() ? `<button class="btn pri" id="newV">${ic('plus')}<span>Lập phiếu</span></button>` : '', false, canEdit() ? 'newVM' : '') +
      `<label class="msearch">${ic('search')}<span class="sr">Tìm phiếu</span><input id="qpm" type="search" placeholder="Số phiếu, khách, công trình…" value="${esc(KS.pq)}" autocomplete="off"></label>
      <div class="top" style="margin-top:-4px"><label class="search" style="flex:1 1 380px">${ic('search')}<span class="sr">Tìm phiếu</span><input id="qpd" type="search" placeholder="Số phiếu, khách, công trình, NCC, lý do…" value="${esc(KS.pq)}" autocomplete="off"></label></div>
      <div class="chips" role="group" aria-label="Lọc phiếu">${[['', 'Tất cả'], ['nhap', 'Nhập'], ['xuat', 'Xuất'], ['khac', 'Chuyển kho · Kiểm kê'], ['dao', 'Phiếu đảo']].map(([k, t]) => `<button class="chip" type="button" data-pg="${k}" aria-pressed="${KS.pg === k}">${t}</button>`).join('')}</div>
      <div class="card list">${list.length ? list.slice(0, 300).map(p => `<div class="it" data-so="${esc(p.soPhieu)}" role="button" tabindex="0"><div><div class="mono">${esc(p.soPhieu)}${p.daDao ? ' <span class="tag stop">Đã đảo</span>' : ''}</div><b>${esc(LOAI[p.loai] || p.loai)}</b> · ${esc(p.ngay)} · ${esc(khoName(p.kho))}${p.khoDen ? ' → ' + esc(khoName(p.khoDen)) : ''}<br><small class="mut">${esc([p.maKH && custName(p.maKH), p.maCongTrinh && projName(p.maCongTrinh), p.maNCC && supName(p.maNCC), p.phieuGoc && 'gốc ' + p.phieuGoc, p.lyDo].filter(Boolean).join(' · '))}</small></div>${isQT() && p.tongTien !== undefined ? `<b style="white-space:nowrap">${money(p.tongTien)}</b>` : ''}</div>`).join('')
        : `<div class="empty">${all.length ? 'Không có phiếu khớp.' : 'Chưa có phiếu kho.' + (canEdit() ? ' Bấm <b>Lập phiếu</b> — bắt đầu bằng Tồn đầu kỳ hoặc Nhập mua.' : '')}</div>`}</div>
      ${all.length >= 500 ? '<p class="mut">Hiện 500 phiếu gần nhất.</p>' : ''}`;
    let t = null; $$('#qpm,#qpd').forEach(q => q.oninput = () => { KS.pq = q.value; clearTimeout(t); t = setTimeout(() => { viewVouchers(m); const n = $('#' + q.id); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 300); });
    $$('.chip[data-pg]').forEach(b => b.onclick = () => { KS.pg = b.dataset.pg; viewVouchers(m); });
    $$('#newV,#newVM').forEach(b => b.onclick = () => voucherPick());
    $$('[data-so]').forEach(r => r.onclick = () => voucherView(r.dataset.so));
  }
  function voucherPick() {
    const types = TAO_DUOC.filter(t => t !== 'NHAP_HANG_LOI' || activeKho(true).length);
    dialog('Lập phiếu kho', `<div class="list">${types.map(t => `<button class="it btn ghost" type="button" style="width:100%;justify-content:flex-start" data-t="${t}"><span class="mono" style="min-width:34px">${QStock.prefix(t)}</span><span style="flex:1;text-align:left">${LOAI[t]}</span></button>`).join('')}</div>`, null, d => $$('[data-t]', d).forEach(b => b.onclick = () => { d.close(); voucherForm(b.dataset.t); }));
  }
  async function voucherView(so) {
    const r = await call('voucher.get', { soPhieu: so }, 3);
    if (!r.ok) return toast('Không mở được phiếu: ' + (r.error || r.code));
    const p = r.data.phieu, L = r.data.lines, showMoney = isQT();
    const canRev = isQT() && !S.offline && p.loai !== 'DAO' && !p.daDao;
    const canRet = canEdit() && !S.offline && ['XUAT_BAN', 'XUAT_CONG_TRINH', 'XUAT_BH'].includes(p.loai) && !p.daDao;
    const canTn = canEdit() && !S.offline && ['NHAP_MUA', 'TON_DAU'].includes(p.loai) && !p.daDao;
    dialog(esc(LOAI[p.loai] || p.loai) + ' ' + esc(p.soPhieu), `
      <dl class="dl"><dt>Ngày</dt><dd>${esc(p.ngay)}</dd><dt>Kho</dt><dd>${esc(khoName(p.kho))}${p.khoDen ? ' → ' + esc(khoName(p.khoDen)) : ''}</dd>
        ${p.maNCC ? `<dt>Nhà cung cấp</dt><dd>${esc(supName(p.maNCC))}</dd>` : ''}${p.maKH ? `<dt>Khách hàng</dt><dd>${esc(custName(p.maKH))}</dd>` : ''}${p.maCongTrinh ? `<dt>Công trình</dt><dd>${esc(projName(p.maCongTrinh))}</dd>` : ''}
        ${p.soLSX ? `<dt>Lệnh sản xuất</dt><dd class="mono">${esc(p.soLSX)}</dd>` : ''}${p.phieuGoc ? `<dt>Phiếu gốc</dt><dd class="mono">${esc(p.phieuGoc)}</dd>` : ''}${p.nguoiGiaoNhan ? `<dt>Người giao/nhận</dt><dd>${esc(p.nguoiGiaoNhan)}</dd>` : ''}
        ${p.lyDo ? `<dt>Lý do</dt><dd>${esc(p.lyDo)}</dd>` : ''}${p.soCTGoc ? `<dt>Chứng từ gốc</dt><dd>${esc(p.soCTGoc)}${p.ngayCTGoc ? ' ngày ' + esc(p.ngayCTGoc) : ''}</dd>` : ''}
        <dt>Người lập</dt><dd>${esc(p.nguoiTao)}</dd>${p.daDao ? '<dt>Trạng thái</dt><dd><span class="tag stop">Đã đảo</span></dd>' : ''}</dl>
      <div class="tbl" style="max-height:none"><table><thead><tr><th>#</th><th>Hàng</th><th class="n">${p.loai === 'KIEM_KE' ? 'Sổ sách → Thực tế' : 'Số lượng'}</th>${showMoney ? '<th class="n">Giá trị kho</th>' : ''}</tr></thead><tbody>
        ${L.map(l => { const i = itemOf(l.maHang); return `<tr><td>${l.dong}</td><td><span class="mono">${esc(l.maHang)}</span> ${esc(i.ten)}${l.serials && l.serials.length ? `<br><small class="mono">${l.serials.map(esc).join(', ')}</small>` : ''}</td><td class="n">${p.loai === 'KIEM_KE' ? num(l.slSoSach) + ' → ' + num(l.slThucTe) : num(l.soLuongCT) + ' ' + esc(l.dvt)}${l.heSo && l.heSo !== 1 ? `<br><small class="mut">= ${num(l.soLuong)} ${esc(i.dvt)}</small>` : ''}</td>${showMoney ? `<td class="n">${money(l.giaTriKho)}${Number(l.chenhLechGV) ? `<br><small class="mut">chênh lệch GV ${money(l.chenhLechGV)}</small>` : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>
      ${showMoney ? `<p style="text-align:right"><b>Tổng: ${money(p.tongTien)}</b></p>` : '<p class="mut" style="font-size:12.5px">Đơn giá, giá trị chỉ Quản trị xem được.</p>'}
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" type="button" id="vPrint">In phiếu</button>${canRet ? '<button class="btn" type="button" id="vRet">Khách trả hàng</button>' : ''}${canTn ? '<button class="btn" type="button" id="vTn">Trả nhà cung cấp</button>' : ''}${canRev ? '<button class="btn danger" type="button" id="vRev">Đảo phiếu</button>' : ''}</div>`, null, d => {
      d.classList.add('wide');
      $('#vPrint', d).onclick = () => printVoucher(p, L);   // phiếu đảo: in theo mẫu của phiếu gốc, số âm
      const rt = $('#vRet', d); if (rt) rt.onclick = () => { d.close(); voucherForm('KHACH_TRA', { phieuGoc: p.soPhieu, kho: p.kho, maKH: p.maKH, maCongTrinh: p.maCongTrinh, lines: L.map(l => ({ maHang: l.maHang, soLuongCT: '', dongGoc: l.dong, gocSerials: l.serials })) }); };
      const tn = $('#vTn', d); if (tn) tn.onclick = () => { d.close(); voucherForm('TRA_NCC', { phieuGoc: p.soPhieu, kho: p.kho, maNCC: p.maNCC, lines: L.map(l => ({ maHang: l.maHang, soLuongCT: '', dongGoc: l.dong, gocSerials: l.serials })) }); };
      const rv = $('#vRev', d); if (rv) rv.onclick = () => { d.close(); reverseForm(p); };
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
      if (Array.isArray(r.fields)) { r.fields.forEach(e => { const c = e.dong ? $(`[data-line="${e.dong}"]`, d) : null; if (c) c.classList.add('bad-line'); }); }
      else if (r.fields) showErrors(d, r.fields);
      dlgMsg(d, 'Chưa lưu: ' + (r.error || r.code) + (r.code === 'NETWORK' ? ' — kiểm tra mạng rồi bấm Lưu lại' : '')); return false;
    }
    d._guard = null; toast((r.data.lapLai || r.replay ? 'Phiếu đã lưu từ lần bấm trước: ' + r.data.soPhieu : okMsg(r.data.soPhieu)) + (r.data.tinhLai ? ` · đã tính lại giá vốn ${r.data.tinhLai} dòng phiếu sau` : '')); await sync(); return true;
  }

  // ---------- lập phiếu ----------
  function voucherForm(loai, pre = {}) {
    const d = S.data, t = QStock.TYPES[loai], priced = t.cost === 'PRICE', kk = loai === 'KIEM_KE', out = t.dir < 0 || loai === 'CHUYEN_KHO';
    const loiType = loai === 'NHAP_HANG_LOI', khos = pre.sx ? activeKho(false).filter(w => w.maKho === pre.kho) : loiType ? activeKho(true) : loai === 'TRA_NCC' ? activeKho() : activeKho(false);
    const opt = (rows, k, n, empty) => [['', empty], ...rows.filter(x => x.trangThai !== 'NGUNG').map(x => [x[k], x[n] + ' (' + x[k] + ')'])];
    const lines = (pre.lines && pre.lines.length ? pre.lines : [{}]).map(l => ({ ...l }));
    const custProj = loai === 'XUAT_BAN' || loai === 'XUAT_BH' || loai === 'KHACH_TRA';
    const body = `
      <div class="grid2"><div>${fld('ngay', 'Ngày phiếu', pre.ngay || S.today, { req: 1, type: 'date', max: S.today })}</div>
        <div>${fld('kho', loai === 'CHUYEN_KHO' ? 'Từ kho' : 'Kho', pre.kho || (khos[0] || {}).maKho || '', { opts: khos.map(w => [w.maKho, w.ten]) })}</div>
        ${loai === 'CHUYEN_KHO' ? `<div>${fld('khoDen', 'Đến kho', '', { opts: [['', '— Chọn kho đến —'], ...activeKho().map(w => [w.maKho, w.ten])] })}</div>` : ''}
        ${loai === 'NHAP_MUA' || loai === 'TRA_NCC' ? `<div>${fld('maNCC', 'Nhà cung cấp', pre.maNCC || '', { opts: opt(d.suppliers, 'maNCC', 'ten', '— Chọn NCC —') })}</div>` : ''}
        ${custProj ? `<div>${fld('maKH', 'Khách hàng', pre.maKH || '', { opts: opt(d.customers || [], 'maKH', 'ten', '— Chọn khách —') })}</div>` : ''}
        ${custProj || loai === 'XUAT_CONG_TRINH' ? `<div>${fld('maCongTrinh', 'Công trình', pre.maCongTrinh || '', { opts: opt(d.projects || [], 'maCongTrinh', 'ten', '— Chọn công trình —') })}</div>` : ''}
        ${loai === 'KHACH_TRA' ? `<div>${fld('phieuGoc', 'Phiếu xuất gốc', pre.phieuGoc || '', { ro: !!pre.phieuGoc })}</div>` : ''}
        ${loai === 'TRA_NCC' ? `<div>${fld('phieuGoc', 'Phiếu nhập gốc (bắt buộc nếu trả từ kho thường)', pre.phieuGoc || '', { ro: !!pre.phieuGoc, list: 'dlGocN' })}<datalist id="dlGocN">${(d.vouchers || []).filter(x => ['NHAP_MUA', 'TON_DAU'].includes(x.loai) && !x.daDao).slice(-200).reverse().map(x => `<option value="${esc(x.soPhieu)}">${esc(x.ngay)} · ${esc(supName(x.maNCC))}</option>`).join('')}</datalist></div>` : ''}
        <div>${fld('nguoiGiaoNhan', t.dir > 0 ? 'Người giao hàng' : 'Người nhận hàng', '')}</div>
        <div>${fld('soCTGoc', 'Số chứng từ gốc (HĐ, hợp đồng…)', '')}</div><div>${fld('ngayCTGoc', 'Ngày chứng từ gốc', '', { type: 'date', max: S.today })}</div></div>
      ${fld('lyDo', kk ? 'Ghi chú kiểm kê' : 'Lý do ' + (t.dir > 0 ? 'nhập' : 'xuất'), pre.lyDo || '')}
      <h3 style="font-size:14px;margin:16px 0 6px">Dòng hàng</h3>
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
            ${priced ? `<div><label class="f" for="l_gia_${i}">Đơn giá (₫)</label><input class="in" id="l_gia_${i}" data-i="${i}" data-f="gia" inputmode="numeric" value="${esc(l.gia ?? '')}"></div>` : ''}
            <div style="align-self:end"><button class="btn ghost iconbtn" type="button" data-del="${i}" aria-label="Xoá dòng ${i + 1}" ${lines.length < 2 ? 'disabled' : ''}>${ic('x')}</button></div>
          </div>
          ${ser ? (pick.length || gocS.length
            ? `<div class="f" style="margin-top:8px">Chọn serial (${(l.serials || []).length} đã chọn)</div><div class="serpick">${(gocS.length ? gocS : pick.map(x => x.serial)).map(s => `<label class="chk" style="margin:0;min-height:48px"><input type="checkbox" data-i="${i}" data-s="${esc(s)}" ${(l.serials || []).includes(s) ? 'checked' : ''}> <span class="mono">${esc(s)}</span></label>`).join('')}</div>`
            : out && !kk ? `<div class="err">Không có serial nào của mã này trong kho đã chọn.</div>`
            : `<label class="f" for="l_sr_${i}">Số serial (mỗi dòng 1 số, đủ = số lượng)</label><textarea class="in" id="l_sr_${i}" data-i="${i}" data-f="serials" style="min-height:64px">${esc((l.serials || []).join('\n'))}</textarea>`) : ''}
        </div>`;
      }).join('');
      $$('[data-f]', box).forEach(x => x.onchange = x.oninput = () => {
        const l = lines[+x.dataset.i]; let v = x.value;
        if (x.dataset.f === 'serials') v = v.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        l[x.dataset.f] = v; if (x.dataset.f === 'gia') l.gia = String(v).replace(/[.\s,₫]/g, '');
        sum(dlg);
      });
      $$('[data-s]', box).forEach(c => c.onchange = () => { const l = lines[+c.dataset.i]; l.serials = l.serials || []; if (c.checked) l.serials.push(c.dataset.s); else l.serials = l.serials.filter(s => s !== c.dataset.s); if (!l.soLuongCT || out) l.soLuongCT = String(l.serials.length); draw(dlg); });
      $$('[data-del]', box).forEach(b => b.onclick = () => { lines.splice(+b.dataset.del, 1); draw(dlg); });
      sum(dlg);
    };
    const sum = dlg => { const s = $('#vSum', dlg); if (!s) return; let tot = 0; lines.forEach(l => { const q = Number(l.soLuongCT), g = Number(l.gia); if (q > 0 && g >= 0) tot += Math.round(q * g); }); s.textContent = money(tot); };
    dialog(pre.sx ? 'Xuất linh kiện — lệnh ' + esc(pre.sx) : LOAI[loai] + ' — phiếu mới', body, async (v, dlg) => {
      const clean = lines.filter(l => String(l.maHang || '').trim() && !(l.dongGoc && (l.soLuongCT === '' || l.soLuongCT === undefined) && !(l.serials || []).length));   // dòng lấy từ phiếu gốc mà để trống SL = không trả dòng đó
      if (!clean.length) { dlgMsg(dlg, 'Phiếu chưa có dòng hàng'); return false; }
      const vh = { ...v, loai, phieuGoc: v.phieuGoc || pre.phieuGoc || '', lines: clean.map(l => ({ maHang: String(l.maHang).trim().toUpperCase(), dvt: l.dvt, soLuongCT: l.soLuongCT === '' ? '' : Number(String(l.soLuongCT).replace(',', '.')), gia: l.gia === undefined ? undefined : Number(l.gia), slThucTe: l.slThucTe === undefined ? undefined : Number(String(l.slThucTe).replace(',', '.')), dongGoc: l.dongGoc, serials: l.serials || [] })) };
      const r = QValidate.voucherHead(vh); if (!r.ok) { showErrors(dlg, r.errors); dlgMsg(dlg, Object.values(r.errors)[0]); return false; }
      if (pre.sx) { SX.stale = true; return submitV(dlg, 'lsx.xuatSX', { soLSX: pre.sx, ngay: vh.ngay, lyDo: vh.lyDo, nguoiGiaoNhan: vh.nguoiGiaoNhan, lines: vh.lines }, so => 'Đã xuất linh kiện, phiếu ' + so); }
      return submitV(dlg, 'voucher.create', { voucher: vh }, so => 'Đã lưu phiếu ' + so);
    }, dlg => {
      dlg.classList.add('wide');
      const start = JSON.stringify(lines); dlg._guard = () => JSON.stringify(lines) !== start;
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
      base = { ...p, loai: g.loai, maNCC: g.maNCC, maKH: g.maKH, maCongTrinh: g.maCongTrinh, khoDen: g.khoDen }; sign = -1;
    }
    const t = QStock.TYPES[base.loai] || {}, kk = base.loai === 'KIEM_KE', ck = base.loai === 'CHUYEN_KHO', nhapKho = t.dir > 0, priced = t.cost === 'PRICE';
    const title = (kk ? 'BIÊN BẢN KIỂM KÊ VẬT TƯ, HÀNG HÓA' : ck ? 'PHIẾU ĐIỀU CHUYỂN KHO (NỘI BỘ)' : nhapKho ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO') + (sign < 0 ? ' (ĐẢO)' : '');
    const mau = kk ? 'Mẫu số 05 - VT' : nhapKho ? 'Mẫu số 01 - VT' : 'Mẫu số 02 - VT';
    const showMoney = isQT(), sg = n => n === '' || n === undefined || n === null ? '' : sign * Number(n);
    const amt = l => (Number(priced ? l.thanhTien : l.giaTriKho) || 0) + (Number(l.chenhLechGV) || 0), tot = sign * L.reduce((a, l) => a + amt(l), 0);   // trả NCC: thành tiền = giá gốc (khớp công nợ)
    const adjTot = sign * L.reduce((a, l) => a + (Number(l.chenhLechGV) || 0), 0);
    const d0 = p.ngay.split('-'), ngay = `Ngày ${d0[2]} tháng ${d0[1]} năm ${d0[0]}`;
    const partner = base.maNCC ? (d => d && { ten: d.ten, dc: d.diaChi, mst: d.mst })((S.data.suppliers || []).find(x => x.maNCC === base.maNCC))
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
      ${sign < 0 ? `<p><b>Đảo chứng từ số ${esc(p.phieuGoc)} ngày ${esc(p.ngayCTGoc || '')}</b> — lý do: ${esc(p.lyDo || '')}</p>` : ''}
      ${kk ? `<p>- Thời điểm kiểm kê: ${ngay.toLowerCase()} · Kho: ${esc(khoName(base.kho))}<br>- Ban kiểm kê: ……………………………………………………………<br>- ${esc(p.lyDo || 'Đã kiểm kê các mặt hàng dưới đây')}</p>`
        : `<p>- Họ và tên người ${nhapKho ? 'giao' : 'nhận'}: ${esc(p.nguoiGiaoNhan || '……………………')}${partner ? `<br>- Đơn vị: ${esc(partner.ten)}${partner.mst ? ' · MST ' + esc(partner.mst) : ''}${partner.dc ? '<br>- Địa chỉ: ' + esc(partner.dc) : ''}` : ''}
          <br>- Lý do ${nhapKho ? 'nhập' : 'xuất'} kho: ${esc(sign < 0 ? LOAI[base.loai] + ' (đảo)' : (p.lyDo || LOAI[base.loai]))}${base.maCongTrinh ? ' — công trình ' + esc(projName(base.maCongTrinh)) : ''}
          <br>- Theo chứng từ số: ${esc((sign < 0 ? '' : p.soCTGoc) || '……')} ngày ${esc((sign < 0 ? '' : p.ngayCTGoc) || '……')}<br>- ${ck ? 'Từ kho: ' + esc(khoName(base.kho)) + ' → đến kho: ' + esc(khoName(base.khoDen)) : (nhapKho ? 'Nhập' : 'Xuất') + ' tại kho: ' + esc(khoName(base.kho))}</p>`}
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
      $('#lockB', dlg).onclick = () => { dlg.close(); dialog('Khoá sổ', `<p>Không lập, đảo phiếu có ngày đến hết ngày khoá; giá vốn kỳ đã khoá không bị tính lại. Để trống = mở khoá.</p>${fld('ngay', 'Khoá sổ đến hết ngày', (d.config || {}).ngayKhoaSo || '', { type: 'date' })}`, async (v, x) => submit(x, 'period.lock', { ngay: v.ngay }, v.ngay ? 'Đã khoá sổ đến ' + v.ngay : 'Đã mở khoá sổ'), null, 'Lưu'); };
      $('#rbB', dlg).onclick = async e => { const b = e.currentTarget; b.classList.add('busy'); const r = await write('stock.rebuild', {}); b.classList.remove('busy'); if (!r.ok) return toast('Lỗi: ' + (r.error || r.code)); toast(`Đã tính lại ${r.data.ma} mã · sửa ${r.data.tinhLai} dòng${r.data.loiTonAm.length ? ' · ⚠ ' + r.data.loiTonAm.length + ' chỗ tồn âm' : ''}`); sync(); };
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
    $('#rXls').onclick = () => exportRows(`NXT_${RP.from}_${RP.to}`, RP.rows.map(r => ({ 'Mã hàng': r.maHang, 'Tên hàng': r.ten, 'ĐVT': r.dvt, 'Tồn đầu SL': r.dauQ, 'Tồn đầu GT': r.dauV, 'Nhập SL': r.nhapQ, 'Nhập GT': r.nhapV, 'Xuất SL': r.xuatQ, 'Xuất GT': r.xuatV, 'Tồn cuối SL': r.cuoiQ, 'Tồn cuối GT': r.cuoiV, 'Điều chỉnh giá vốn (632)': r.dcV })));
  }
  function reportTable() {
    const R = RP.rows, s = k => R.reduce((a, r) => a + r[k], 0);
    if (!R.length) return '<div class="empty">Không có phát sinh trong kỳ.</div>';
    return `<table><thead><tr><th>Mã</th><th>Tên hàng</th><th>ĐVT</th><th class="n">Đầu kỳ SL</th><th class="n">Đầu kỳ GT</th><th class="n">Nhập SL</th><th class="n">Nhập GT</th><th class="n">Xuất SL</th><th class="n">Xuất GT</th><th class="n">Cuối kỳ SL</th><th class="n">Cuối kỳ GT</th><th class="n" title="Chênh lệch khi trả NCC/đảo theo giá gốc — hạch toán TK 632">Điều chỉnh GV</th></tr></thead><tbody>
      ${R.map(r => `<tr><td class="mono">${esc(r.maHang)}</td><td>${esc(r.ten)}</td><td>${esc(r.dvt)}</td><td class="n">${num(r.dauQ)}</td><td class="n">${num(r.dauV)}</td><td class="n">${num(r.nhapQ)}</td><td class="n">${num(r.nhapV)}</td><td class="n">${num(r.xuatQ)}</td><td class="n">${num(r.xuatV)}</td><td class="n">${num(r.cuoiQ)}</td><td class="n">${num(r.cuoiV)}</td><td class="n">${r.dcV ? num(r.dcV) : ''}</td></tr>`).join('')}
      <tr><td></td><td><b>Cộng giá trị</b></td><td></td><td></td><td class="n"><b>${num(s('dauV'))}</b></td><td></td><td class="n"><b>${num(s('nhapV'))}</b></td><td></td><td class="n"><b>${num(s('xuatV'))}</b></td><td></td><td class="n"><b>${num(s('cuoiV'))}</b></td><td class="n"><b>${s('dcV') ? num(s('dcV')) : ''}</b></td></tr></tbody></table>`;
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
  const kcsTag = c => !Number(c.lanKiemCuoi) ? '<span class="tag">Chưa kiểm</span>' : c.kcsDat ? `<span class="tag ok">${ic('check')} Đạt</span>` : `<span class="tag bad">${ic('x')} Không đạt</span>`;
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
  function viewSX(m) {
    if (SX.sel) return lsxPage(m);
    const d = S.data, L = (d.lsx || []).slice().sort((a, b) => a.soLSX < b.soLSX ? 1 : -1);
    const bad = so => cabsOf(so).some(c => Number(c.lanKiemCuoi) && !c.kcsDat);
    const F = [['', 'Tất cả'], ['DANG', 'Đang làm'], ['CHO_KIEM_TRA', 'Chờ KCS'], ['LOI', '⚠ Không đạt KCS'], ['HOAN_TAT', 'Hoàn tất'], ['HUY', 'Đã huỷ']];
    const nq = QSearch.norm(SX.q);
    const list = L.filter(l => (!SX.f || (SX.f === 'DANG' ? ['MOI', 'DANG_LAP'].includes(l.trangThai) : SX.f === 'LOI' ? bad(l.soLSX) : l.trangThai === SX.f))
      && (!nq || QSearch.norm([l.soLSX, l.maMau, l.maHang, tplName(l), custName(l.maKH), projName(l.maCongTrinh)].join(' ')).includes(nq)));
    const noTpl = !(d.templates || []).length;
    m.innerHTML = header('Sản xuất tủ', canEdit() && !noTpl ? `<button class="btn pri" id="newL">${ic('plus')}<span>Lệnh sản xuất</span></button>` : '', false, canEdit() && !noTpl ? 'newLM' : '') + `
      <label class="msearch">${ic('search')}<span class="sr">Tìm lệnh</span><input id="qsm" type="search" placeholder="Số lệnh, mẫu, khách, công trình…" value="${esc(SX.q)}" autocomplete="off"></label>
      <div class="top" style="margin-top:-4px"><label class="search" style="flex:1 1 320px">${ic('search')}<span class="sr">Tìm lệnh</span><input id="qsd" type="search" placeholder="Số lệnh, mẫu, khách, công trình…" value="${esc(SX.q)}" autocomplete="off"></label></div>
      <div class="sxbar"><button class="btn" type="button" id="serB">${ic('search')} Tra xê-ri tủ</button><button class="btn" type="button" id="tplB">${ic('layers')} Mẫu tủ (${(d.templates || []).length})</button></div>
      <div class="chips" role="group" aria-label="Lọc lệnh">${F.map(([k, t]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${SX.f === k}">${t}</button>`).join('')}</div>
      <div class="card list">${list.length ? list.slice(0, 300).map(l => { const c = cabsOf(l.soLSX), ok = c.filter(x => x.kcsDat).length;
        return `<div class="it" data-lsx="${esc(l.soLSX)}" role="button" tabindex="0"><div><div class="mono">${esc(l.soLSX)} <span class="tag st-${esc(l.trangThai)}">${LSX_ST[l.trangThai] || esc(l.trangThai)}</span>${bad(l.soLSX) ? ` <span class="tag bad">${ic('warn')} Không đạt KCS</span>` : ''}</div>
          <b>${esc(tplName(l))}</b> × ${num(l.soLuong)}<br><small class="mut">${esc([l.ngay, l.maKH && custName(l.maKH), l.maCongTrinh && projName(l.maCongTrinh)].filter(Boolean).join(' · '))}</small></div>
          <div style="text-align:right;white-space:nowrap"><b>${ok}/${num(l.soLuong)}</b><br><small class="mut">tủ đạt KCS</small></div></div>`; }).join('')
        : `<div class="empty">${L.length ? 'Không có lệnh khớp bộ lọc.' : 'Chưa có lệnh sản xuất.' + (noTpl ? (isQT() ? '<br>Bắt đầu bằng <b>Mẫu tủ</b>: định mức linh kiện + các mục kiểm tra xuất xưởng.' : '<br>Cần Quản trị tạo Mẫu tủ trước.') : canEdit() ? '<br>Bấm <b>+ Lệnh sản xuất</b>.' : '')}</div>`}</div>`;
    let t = null; $$('#qsm,#qsd').forEach(q => q.oninput = () => { SX.q = q.value; clearTimeout(t); t = setTimeout(() => { viewSX(m); const n = $('#' + q.id); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 300); });
    $$('.chip[data-f]').forEach(b => b.onclick = () => { SX.f = b.dataset.f; viewSX(m); });
    $$('#newL,#newLM').forEach(b => b.onclick = lsxForm);
    $('#tplB').onclick = tplList; $('#serB').onclick = serialSearch;
    $$('[data-lsx]').forEach(r => r.onclick = r.onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter') return; openLSX(r.dataset.lsx); });
  }
  function openLSX(so) { SX.sel = so; SX.stale = true; if (isMobile()) history.pushState({ lsx: 1 }, ''); if (route() !== 'sx') location.hash = '#/sx'; else renderView(); }

  // ----- trang 1 lệnh: 4 bước -----
  async function lsxPage(m) {
    const so = SX.sel;
    if (SX.stale || !SX.data || SX.data.lsx.soLSX !== so) {
      if (!SX.data || SX.data.lsx.soLSX !== so) m.innerHTML = header(esc(so)) + `<div class="card">${'<div class="skel"></div>'.repeat(5)}</div>`;
      const r = await call('sx.get', { soLSX: so }, 3);
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
          <dl class="dl"><dt>Số tủ</dt><dd>${num(l.soLuong)} ${tus.length ? `· đã nhập ${tus.length}` : ''}</dd><dt>Ngày lệnh</dt><dd>${esc(l.ngay)}</dd><dt>Kho linh kiện</dt><dd>${esc(khoName(l.kho))}</dd>
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
        <section class="card"><h2 class="h2">Phiếu kho của lệnh</h2>${ph.length ? `<div class="list">${ph.map(p => `<div class="it" data-so="${esc(p.soPhieu)}" role="button" tabindex="0"><div><span class="mono">${esc(p.soPhieu)}</span> · ${esc(LOAI[p.loai] || p.loai)}<br><small class="mut">${esc(p.ngay)} · ${p.lines.length} dòng</small></div>${isQT() && p.tongTien !== undefined ? `<b style="white-space:nowrap">${money(p.tongTien)}</b>` : ''}</div>`).join('')}</div>` : '<div class="empty">Chưa có phiếu.</div>'}</section>
        ${isQT() && g.chiPhi ? `<section class="card"><h2 class="h2">Chi phí khác</h2>${g.chiPhi.length ? `<div class="list">${g.chiPhi.map(c => `<div class="it"><div>${esc(CP_LOAI[c.loai] || c.loai)}<br><small class="mut">${esc(c.ngay)}${c.soCTGoc ? ' · ' + esc(c.soCTGoc) : ''}${c.ghiChu ? ' · ' + esc(c.ghiChu) : ''}</small></div><b>${money(c.soTien)}</b></div>`).join('')}</div>` : '<div class="empty">Chưa có (nhân công, gia công…).</div>'}</section>` : ''}
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
    dialog('Nhập thành phẩm — ' + esc(g.lsx.soLSX), `<p>Hệ thống cấp số xê-ri cho từng tủ (dạng <span class="mono">${esc(QSX.serialNo(S.data.config.maCongTy || S.co.id, g.lsx.maHang, S.today.slice(0, 4), 1))}</span>), lập phiếu nhập kho thành phẩm và hồ sơ tủ. Linh kiện có serial (LOGO!…) tự gắn vào từng tủ.</p>
      <div class="grid2"><div>${fld('soLuong', 'Số tủ nhập', String(rem), { req: 1, im: 'numeric' })}</div><div>${fld('ngay', 'Ngày nhập', S.today, { type: 'date', max: S.today })}</div></div>
      <p class="mut" style="font-size:12.5px">Sau khi nhập thành phẩm, không xuất bổ sung linh kiện cho lệnh này nữa. Giá thành = giá trị linh kiện đã xuất + chi phí khác, chia theo số tủ.</p>`,
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
    const kiem = [...new Set(tus.map(x => last(x).nguoiKiem).filter(Boolean))].join(', '), ngayKiem = [...new Set(tus.map(x => last(x).ngay).filter(Boolean))].join(', ');
    const words = QWords.read ? QWords.read(n) : String(n);
    const host = document.createElement('div'); host.id = 'printArea';
    host.innerHTML = `<div class="pv pxx">${p.trangThai === 'HUY' ? '<div class="pxx-void">ĐÃ HUỶ</div>' : ''}
      <div class="c"><b>${esc((co.tenDay || co.ten).toUpperCase())}</b><br>Địa chỉ: ${esc(co.diaChi || '')}${co.mst ? ' – MST: ' + esc(co.mst) : ''}</div>
      <h1>PHIẾU XUẤT XƯỞNG</h1><p class="c"><b>${esc((t.moTa ? 'TỦ ĐIỀU KHIỂN CHIẾU SÁNG CÔNG CỘNG' : t.ten).toUpperCase())}</b><br>Số: <b>${esc(p.soPXX)}</b><br><i>TP. Hồ Chí Minh, ngày ${dd[2]} tháng ${dd[1]} năm ${dd[0]}</i></p>
      <h2>I. THÔNG TIN CHUNG</h2><table class="pv-k"><tbody>
        <tr><td>Đơn vị sản xuất</td><td>${esc((co.tenDay || co.ten).toUpperCase())}</td></tr><tr><td>Khách hàng</td><td>${esc(cust.ten || '')}</td></tr>
        <tr><td>Địa chỉ khách hàng</td><td>${esc(cust.diaChi || '')}</td></tr><tr><td>Công trình</td><td>${esc(p.maCongTrinh ? projName(p.maCongTrinh) : '')}</td></tr>
        <tr><td>Địa điểm xây dựng</td><td>${esc(p.diaDiem || '')}</td></tr><tr><td>Căn cứ chế tạo</td><td>${esc(p.canCuCheTao || '')}</td></tr>
        ${p.soPhieuXuat || p.soHoaDon ? `<tr><td>Phiếu xuất kho / Hoá đơn</td><td>${esc([p.soPhieuXuat, p.soHoaDon].filter(Boolean).join(' / '))}</td></tr>` : ''}</tbody></table>
      <h2>II. THÔNG TIN SẢN PHẨM</h2><table class="pv-k"><tbody>
        <tr><td>Tên sản phẩm</td><td>${esc(t.moTa || t.ten)}</td></tr><tr><td>Số lượng</td><td>${pad2(n)} (${esc(words)}) tủ</td></tr>
        ${t.kichThuoc ? `<tr><td>Kích thước vỏ tủ</td><td>${esc(t.kichThuoc)} mm (Cao × Rộng × Sâu)</td></tr>` : ''}${t.vatLieu ? `<tr><td>Vật liệu, màu sắc</td><td>${esc(t.vatLieu)}</td></tr>` : ''}
        ${t.ketCau ? `<tr><td>Kết cấu</td><td>${esc(t.ketCau)}</td></tr>` : ''}${t.filePLC ? `<tr><td>Chương trình PLC (firmware)</td><td>${esc(t.filePLC)}</td></tr>` : ''}
        <tr><td>Số xê-ri tủ</td><td><div class="pxx-qr">${sers.map((s, i) => `<div>${qrs[i]}<b>${esc(s)}</b></div>`).join('')}</div></td></tr></tbody></table>
      <h2>III. DANH MỤC THIẾT BỊ LẮP TRONG TỦ</h2><table class="pv-t"><thead><tr><th>STT</th><th>Tên thiết bị – Quy cách</th><th>Hãng / xuất xứ</th><th>ĐVT</th><th>SL</th></tr></thead><tbody>
        ${(t.bom || []).map((b, i) => { const it = itemOf(b.maHang), s = conBy[b.maHang];
          return `<tr><td class="c">${i + 1}</td><td>${esc(it.ten)}${it.quyCach ? ' – ' + esc(it.quyCach) : ''}${s ? `<br><small>Serial: ${s.map(esc).join(', ')}</small>` : ''}</td><td>${esc([it.hang, it.xuatXu].filter(Boolean).join(' / '))}</td><td class="c">${esc(it.dvt)}</td><td class="c">${pad2(num(b.soLuong))}${n > 1 ? '/tủ' : ''}</td></tr>`; }).join('')}</tbody></table>
      ${t.ghiChuDM ? `<p><i>Ghi chú: ${esc(t.ghiChuDM)}</i></p>` : ''}
      <h2>IV. KẾT QUẢ KIỂM TRA XUẤT XƯỞNG</h2><table class="pv-t"><thead><tr><th>STT</th><th>Nội dung kiểm tra</th><th>Yêu cầu</th><th>Đạt</th><th>Không đạt</th></tr></thead><tbody>${kTab}</tbody></table>
      <p>Người kiểm tra: ${esc(kiem)} · ngày kiểm: ${esc(ngayKiem)}${n > 1 ? ` · kết quả đạt áp dụng cho cả ${n} tủ` : ''}</p>
      <h2>V. KẾT LUẬN</h2><p class="pxx-kl">Tủ điều khiển nêu trên đã được kiểm tra theo các nội dung tại mục IV, đủ điều kiện xuất xưởng, giao cho khách hàng để lắp đặt tại công trình. Thời gian bảo hành ${esc(t.thangBH || 12)} tháng kể từ ngày bàn giao, theo điều kiện sử dụng và vận hành đúng hướng dẫn. Bảo hành không áp dụng cho hư hỏng do thiên tai, sét đánh, quá áp lưới điện, tác động cơ học hoặc tự ý sửa chữa, thay đổi đấu nối.${p.ghiChu ? ' ' + esc(p.ghiChu) : ''}<br>Liên hệ bảo hành: ${esc(co.tenDay || co.ten)}${co.dienThoai ? ' – ĐT ' + esc(co.dienThoai) : ''}.</p>
      <div class="pv-sign pxx-sign"><div><b>ĐẠI DIỆN BÊN NHẬN</b><br><i>(Ký, ghi rõ họ tên, ngày)</i></div><div><b>NGƯỜI KIỂM TRA</b><br><i>(Ký, ghi rõ họ tên)</i></div><div><b>ĐƠN VỊ SẢN XUẤT</b><br><b>GIÁM ĐỐC</b><br><i>(Ký, đóng dấu)</i><br><br><br><br><b>${esc(co.giamDoc || '')}</b></div></div>
      <p class="pv-foot">In từ QLHH v${VER} · quét QR để tra hồ sơ tủ (cần đăng nhập)</p></div>`;
    document.body.appendChild(host); document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); host.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
  }

  // ----- hồ sơ tủ (tra xê-ri / quét QR) -----
  function serialSearch() {
    dialog('Tra xê-ri', `${fld('serial', 'Số xê-ri tủ hoặc serial linh kiện', '', { req: 1 })}<p class="mut" style="font-size:12.5px">Hoặc quét mã QR trên tem tủ / phiếu xuất xưởng bằng camera điện thoại.</p>`,
      async (v, dlg) => { if (!v.serial.trim()) { showErrors(dlg, { serial: 'Nhập số xê-ri' }); return false; } dlg.close(); tuView(v.serial.trim()); return false; }, null, 'Tra');
  }
  function viewTu(m) {
    const p = location.hash.split('/'), co = p[2], ser = decodeURIComponent(p[3] || '');
    if (co && co !== S.co.id) { m.innerHTML = header('Hồ sơ tủ') + `<div class="card empty">Tủ <b class="mono">${esc(ser)}</b> thuộc công ty <b>${esc((company(co) || {}).ten || co)}</b> — đổi công ty để xem.<br><button class="btn" type="button" id="swc" style="margin-top:12px">Đổi công ty</button></div>`; $('#swc').onclick = switchCo; return; }
    location.replace('#/sx'); if (ser) setTimeout(() => tuView(ser), 0);
  }
  async function tuView(ser) {
    const r = await call('serial.get', { serial: ser }, 3);
    if (!r.ok) return toast(r.code === 'NOT_FOUND' ? 'Không có xê-ri ' + ser : 'Lỗi: ' + (r.error || r.code));
    const x = r.data, h = x.hoSo, sr = x.serial || {}, ST = { TRONG_KHO: 'Trong kho', DA_BAN: 'Đã bán/giao', DA_LAP: 'Đã lắp vào tủ', HUY: 'Huỷ', HANG_LOI: 'Hàng lỗi', DA_TRA_NCC: 'Đã trả NCC', MAT: 'Mất' };
    if (!h) return dialog('Serial ' + esc(sr.serial), `<dl class="dl"><dt>Mã hàng</dt><dd>${esc(sr.maHang)} ${esc(x.item.ten || '')}</dd><dt>Hãng</dt><dd>${esc(sr.hang)}</dd><dt>Trạng thái</dt><dd>${ST[sr.trangThai] || esc(sr.trangThai)}${sr.kho ? ' · ' + esc(khoName(sr.kho)) : ''}</dd>${x.cha ? `<dt>Lắp trong tủ</dt><dd><button class="linkbtn mono" type="button" id="toCha">${esc(x.cha.serial)}</button></dd>` : ''}</dl>`, null, d => { const b = $('#toCha', d); if (b) b.onclick = () => { d.close(); tuView(x.cha.serial); }; });
    const qr = await qrSvg(tuLink(h.serial), 4).catch(() => '');
    const live = canEdit() && !S.offline && sr.trangThai === 'TRONG_KHO' && !h.soPXX && h.trangThai !== 'HUY';
    dialog('Hồ sơ tủ ' + esc(h.serial), `<div class="tuhead"><div class="tuqr">${qr}</div><div><div class="mono"><b>${esc(h.serial)}</b></div><b>${esc(x.item.ten || h.maHang)}</b><br>
        ${h.trangThai === 'HUY' ? '<span class="tag stop">Hồ sơ đã huỷ</span>' : kcsTag(h)} <span class="tag">${ST[sr.trangThai] || esc(sr.trangThai || '')}${sr.kho ? ' · ' + esc(khoName(sr.kho)) : ''}</span></div></div>
      <dl class="dl"><dt>Lệnh sản xuất</dt><dd><button class="linkbtn mono" type="button" id="toL">${esc(h.soLSX)}</button></dd><dt>Nhập kho</dt><dd>${esc(h.ngayNhap)} · <span class="mono">${esc(h.soPhieuNhap)}</span></dd>
        <dt>Mẫu</dt><dd>${esc(h.maMau)} bản ${esc(h.phienBan)}${h.kichThuoc ? ' · ' + esc(h.kichThuoc) + ' mm' : ''}</dd>
        ${x.pxx ? `<dt>Phiếu xuất xưởng</dt><dd><span class="mono">${esc(x.pxx.soPXX)}</span> · ${esc(x.pxx.ngay)}${x.pxx.maKH ? ' · ' + esc(custName(x.pxx.maKH)) : ''}</dd>` : ''}
        ${x.lsx && x.lsx.maKH ? `<dt>Khách theo lệnh</dt><dd>${esc(custName(x.lsx.maKH))}${x.lsx.maCongTrinh ? ' · ' + esc(projName(x.lsx.maCongTrinh)) : ''}</dd>` : ''}
        <dt>Bảo hành</dt><dd>${esc(x.item.thangBH || 12)} tháng từ ngày bàn giao — <i>chưa có ngày bàn giao</i></dd>
        ${x.giaThanh !== undefined ? `<dt>Giá thành</dt><dd>${money(x.giaThanh)}</dd>` : ''}</dl>
      <h3 class="h3">Linh kiện có serial trong tủ</h3>${(x.con || []).length ? `<ul class="plain">${x.con.map(c => `<li><span class="mono">${esc(c.serial)}</span> — ${esc(itemOf(c.maHang).ten)}</li>`).join('')}</ul>` : '<p class="mut">Không có.</p>'}
      <h3 class="h3">Kiểm tra xuất xưởng (${(x.kcs || []).length} lần)</h3>${(x.kcs || []).length ? x.kcs.slice().reverse().map(k => `<details ${k === x.kcs[x.kcs.length - 1] ? 'open' : ''}><summary>Lần ${k.lanKiem} · ${esc(k.ngay)} · ${k.dat ? '<b class="ok-ink">Đạt</b>' : '<b class="bad-ink">Không đạt</b>'} · ${esc(k.nguoiKiem)}</summary><ol class="kcsum">${k.ketQua.map(q => `<li>${esc(q.noiDung)} — ${q.ketQua === 'DAT' ? '✓' : `<b class="bad-ink">✗ ${esc(q.ghiChu)}</b>`}</li>`).join('')}</ol></details>`).join('') : '<p class="mut">Chưa kiểm.</p>'}
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${live ? `<button class="btn pri" type="button" id="tK">${ic('check')} Kiểm tra xuất xưởng</button>` : ''}${x.pxx ? `<button class="btn" type="button" id="tP">In PXX</button>${isQT() && !S.offline && x.pxx.trangThai === 'PHAT_HANH' ? '<button class="btn danger" type="button" id="tPH">Huỷ PXX</button>' : ''}` : ''}<button class="btn" type="button" id="tTem">In tem QR</button></div>`, null, d => {
      d.classList.add('wide');
      $('#toL', d).onclick = () => { d.close(); openLSX(h.soLSX); };
      const k = $('#tK', d); if (k) k.onclick = async () => { d.close(); const g = await call('sx.get', { soLSX: h.soLSX }, 3); if (!g.ok) return toast('Không mở được lệnh'); kcsScreen(h.serial, g.data.template, g.data.hoSoTu.filter(c => c.trangThai !== 'HUY')); };
      const pp = $('#tP', d); if (pp) pp.onclick = () => printPXX(x.pxx.soPXX);
      const ph = $('#tPH', d); if (ph) ph.onclick = () => { d.close(); pxxCancelForm(x.pxx); };
      $('#tTem', d).onclick = () => printTem(h.serial, x.item.ten || h.maHang, qr);
    });
  }
  function printTem(ser, ten, qr) {   // tem dán tủ: QR ≥ 25 mm + số xê-ri
    const host = document.createElement('div'); host.id = 'printArea';
    host.innerHTML = `<div class="tem"><div class="tem-qr">${qr}</div><div><b>${esc(S.co.tenDay || S.co.ten)}</b><br>${esc(ten)}<br><b class="mono" style="font-size:14pt">${esc(ser)}</b><br><small>Quét để tra hồ sơ, bảo hành</small></div></div>`;
    document.body.appendChild(host); document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); host.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
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
        <div>${fld('filePLC', 'Chương trình PLC (tên file)', t0 ? t0.filePLC : '')}</div></div>
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
  function dialog(title, body, onSubmit, after, submitText = 'Lưu') {
    const d = $('#dlg');
    const back = document.activeElement;
    d.innerHTML = `<form method="dialog" novalidate><header><h2>${title}</h2><button class="btn ghost iconbtn" type="button" data-x aria-label="Đóng">${ic('x')}</button></header><div class="body">${body}<div class="dlgmsg" id="dlgMsg" role="alert"></div></div>${onSubmit ? `<footer><button class="btn" type="button" data-x>Huỷ</button><button class="btn pri" id="dlgOk" type="submit">${submitText}</button></footer>` : ''}</form>`;
    const f = $('form', d);
    d._rid = null; d._guard = null;   // 1 requestId cho cả vòng đời hộp thoại: bấm Lưu lại sau khi mất phản hồi KHÔNG tạo phiếu thứ 2
    const tryClose = () => { if (d._guard && d._guard() && !confirm('Bỏ phiếu đang nhập dở?')) return; d.close(); };
    $$('[data-x]', d).forEach(b => b.onclick = tryClose);
    d.oncancel = e => { if (d._guard && d._guard()) { e.preventDefault(); tryClose(); } };
    d.onclose = () => { if (back && back.isConnected && back.focus) back.focus(); };
    f.onsubmit = async e => {
      e.preventDefault(); if (!onSubmit) return d.close();
      const ok = $('#dlgOk'); if (ok.disabled) return; ok.classList.add('busy'); ok.disabled = true; $('#dlgMsg', d).textContent = '';
      try { const done = await onSubmit(Object.fromEntries(new FormData(f)), d); if (done) d.close(); } finally { ok.classList.remove('busy'); ok.disabled = false; }
    };
    d.onclick = e => { if (e.target === d) tryClose(); };
    if (after) after(d);
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
  window.addEventListener('hashchange', () => { if (S.user) { S.sel = null; if (route() !== 'kho') KS.sel = null; if (route() !== 'sx') SX.sel = null; renderView(); } });
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
