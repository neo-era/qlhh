// E2E giao diện QLHH (Playwright) + máy chủ giả lập (Code.gs thật). Chạy: node test/app.e2e.js
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const { ready } = require('./gas-mock.js');
const DOCS = path.join(__dirname, '..', 'docs'), SHOTS = process.env.SHOTS || '/tmp/qlhh-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const api = ready({ 'nv@gmail.com': 'NHAP_LIEU', 'xem@gmail.com': 'XEM' });
const srv = http.createServer((q, r) => {
  let f = path.join(DOCS, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } const ext = path.extname(f); r.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png' }[ext] || 'application/json' }); r.end(b); });
}).listen(8766);
const BASE = 'http://localhost:8766/';
const fails = []; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
let offline = false;
async function page(b, vp, email = 'maivulam2020@gmail.com', scheme = 'light') {
  const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, acceptDownloads: true, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('JS lỗi: ' + e.message); fails.push('JS lỗi: ' + e.message); });
  await p.route('https://script.google.com/**', async rt => { if (offline) return rt.abort(); await rt.fulfill({ contentType: 'application/json', body: api.doPost({ postData: { contents: rt.request().postData() } }).t }); });
  await p.route('https://accounts.google.com/**', async rt => {
    const u = new URL(rt.request().url()); api.st.email = email; api.st.nonce = u.searchParams.get('nonce');
    if (u.searchParams.get('redirect_uri') !== BASE || u.searchParams.get('response_type') !== 'id_token' || u.searchParams.get('state') !== 'LAVIPCO') fails.push('tham số Google sai');
    await rt.fulfill({ status: 302, headers: { location: BASE + '#id_token=tok-' + Math.random() + '&state=LAVIPCO' } });
  });
  await p.goto(BASE); await p.waitForSelector('#loginBtn');
  return p;
}
const login = async p => { await p.click('#loginBtn'); await p.waitForFunction(() => window.QLHH_DEBUG && window.QLHH_DEBUG.data, null, { timeout: 10000 }); };
const fill = async (p, o) => { for (const [k, v] of Object.entries(o)) { const s = '#f_' + k; const tag = await p.$eval(s, e => e.tagName); if (tag === 'SELECT') await p.selectOption(s, v); else await p.fill(s, String(v)); } };
const save = async p => { await p.click('#dlgOk'); await p.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 8000 }).catch(async () => { const t = await toasts(p), e = await p.$$eval('.err', x => x.map(y => y.textContent).filter(Boolean).join('; ')); console.log('✗ hộp thoại không đóng: ' + t + ' | ' + e); fails.push('hộp thoại không đóng sau khi lưu: ' + t + ' | ' + e); await p.keyboard.press('Escape'); }); await p.waitForTimeout(100); };
const toasts = p => p.$$eval('.toast', ts => ts.map(t => t.textContent).join(' | '));
const rows = p => p.$$('tbody tr');

(async () => {
  const b = await chromium.launch();
  // ===== QUẢN TRỊ — desktop =====
  let p = await page(b, { width: 1366, height: 820 });
  ok((await p.textContent('.cos')).includes('chưa cấu hình'), 'Đại Châu chưa cấu hình hiển thị rõ');
  await p.screenshot({ path: SHOTS + '/login.png' });
  await login(p);
  ok(await p.isVisible('text=Chưa có mặt hàng nào'), 'trạng thái rỗng có hướng dẫn');
  await p.goto(BASE + '#/nhom'); await p.click('#addG'); await fill(p, { maNhom: 'den', ten: 'Đèn LED' }); await save(p);
  await p.click('#addG'); await fill(p, { maNhom: 'TU', ten: 'Tủ điện' }); await save(p);
  ok((await p.textContent('#main')).includes('Tủ điện'), 'thêm 2 nhóm');
  await p.goto(BASE + '#/hang'); await p.click('#addItem');
  await p.click('#dlgOk'); ok((await p.textContent('#e_maHang')) !== '', 'bỏ trống → báo lỗi tại ô');
  await fill(p, { maHang: 'dl-str-100', nhom: 'DEN', ten: 'Đèn LED đường phố 100W', quyCach: '100W · 4000K · IP66', dvt: 'bộ', thangBH: 24, giaBan: '3850000', tonToiThieu: 10 });
  await p.check('input[name=quanLySerial]'); await save(p);
  await p.click('#addItem'); await fill(p, { maHang: 'TU-DK-3P', nhom: 'TU', ten: 'Tủ điều khiển chiếu sáng 3 pha', dvt: 'tủ', giaBan: '28500000' });
  await p.focus('#f_ten'); await p.keyboard.press('Enter'); await p.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(200); ok((await rows(p)).length === 2, 'bấm Enter trong ô nhập = Lưu (không phải Huỷ)');
  await p.click('#addItem'); await fill(p, { maHang: 'DL-STR-100', ten: 'x', dvt: 'bộ' }); await p.click('#dlgOk');
  ok((await p.textContent('#e_maHang')).includes('đã tồn tại'), 'mã trùng bị chặn ngay trên máy'); await p.keyboard.press('Escape');
  ok((await rows(p)).length === 2, 'bảng có 2 mã');
  await p.fill('#qd', 'den 100w'); await p.waitForTimeout(250); ok((await rows(p)).length === 1, 'tìm không dấu nhiều từ');
  await p.fill('#qd', ''); await p.waitForTimeout(250); await p.click('tbody tr[data-ma="DL-STR-100"]');
  ok((await p.textContent('#det')).includes('3.850.000'), 'chi tiết hiển thị giá bán');
  await p.goto(BASE + '#/ncc'); await p.click('#addSup'); await fill(p, { maNCC: 'ncc01', ten: 'Cty Đèn Sáng', mst: '123' }); await p.click('#dlgOk');
  ok((await p.textContent('#e_mst')) !== '', 'MST sai báo lỗi'); await fill(p, { mst: '0312345678' }); await save(p);
  await p.focus('[data-ncc="NCC01"]'); await p.keyboard.press(' '); ok(await p.evaluate(() => document.querySelector('#dlg').open), 'bàn phím: Space mở dòng NCC'); await p.keyboard.press('Escape');
  await p.goto(BASE + '#/hang'); await p.click('tbody tr[data-ma="DL-STR-100"]'); await p.click('#addPrice');
  await fill(p, { loai: 'NHAP', maNCC: 'NCC01', gia: '2.900.000', tuNgay: '2026-01-02' }); await save(p);
  await p.click('tbody tr[data-ma="DL-STR-100"]'); await p.click('#addPrice'); await fill(p, { loai: 'BAN', gia: '3990000' }); await save(p);   // ngày mặc định = hôm nay → thay giá ban đầu
  await p.click('tbody tr[data-ma="DL-STR-100"]');
  const det = await p.textContent('#det');
  ok(det.includes('3.990.000') && det.includes('2.900.000') && det.includes('Cty Đèn Sáng'), 'QT thấy giá bán mới + giá nhập theo NCC');
  await p.click('#stopItem'); await p.waitForTimeout(300);
  ok((await rows(p)).length === 1, 'ngừng KD → ẩn khỏi danh sách mặc định');
  await p.click('#stopT'); ok((await rows(p)).length === 2, 'bật "Gồm hàng ngừng KD" → hiện lại');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#xls')]);
  const XLSX = require('/tmp/xl/package'); const wb = XLSX.readFile(await dl.path()); const rowsX = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  ok(dl.suggestedFilename().endsWith('.xlsx') && rowsX.some(r => r['Mã hàng'] === 'DL-STR-100' && r['Giá bán (₫)'] === 3990000) && 'Giá vốn (₫)' in rowsX[0], 'xuất Excel .xlsx (giá bán theo ngày hôm nay, QT có cột giá vốn)');
  await p.goto(BASE + '#/nguoidung'); await p.click('#addU'); await fill(p, { email: 'Moi@Gmail.com', hoTen: 'Nhân viên mới', vaiTro: 'NHAP_LIEU' }); await save(p);
  ok((await p.textContent('#main')).includes('moi@gmail.com'), 'QT thêm người dùng (email chuẩn hoá)');
  await p.click('#fbBtn'); await p.click('#dlgOk'); ok(/sao hoặc nhập nội dung/.test(await p.textContent('#dlgMsg')), 'góp ý rỗng bị chặn (báo ngay trong hộp thoại)');
  await p.click('.stars button[data-s="4"]'); await fill(p, { noiDung: 'Thêm lọc theo hãng' }); await save(p);
  await p.goto(BASE + '#/gopy'); await p.waitForTimeout(200); ok((await p.textContent('#main')).includes('Thêm lọc theo hãng'), 'góp ý đã gửi và hiện trong danh sách');
  await p.goto(BASE + '#/hang'); await p.click('tbody tr[data-ma="TU-DK-3P"]'); await p.screenshot({ path: SHOTS + '/desktop-light.png' });
  await p.click('#addItem'); await fill(p, { maHang: 'MAT-MANG', ten: 'Thử mất mạng', dvt: 'cái' }); offline = true; const t0 = Date.now(); await p.click('#dlgOk');
  await p.waitForFunction(() => /Chưa lưu|ngoại tuyến/.test(document.querySelector('#dlgMsg').textContent), null, { timeout: 8000 }).catch(() => {});
  ok(Date.now() - t0 < 5000 && await p.inputValue('#f_ten') === 'Thử mất mạng', 'mất mạng lúc lưu: báo trong hộp thoại < 5 s, giữ nguyên dữ liệu đã nhập (' + (Date.now() - t0) + ' ms)');
  offline = false; await p.click('[data-x]');
  // mất mạng: dữ liệu đã lưu vẫn xem được
  offline = true; await p.reload(); await p.waitForSelector('tbody tr', { timeout: 10000 }).catch(() => {});
  await p.waitForSelector('text=Đang ngoại tuyến', { timeout: 2500 }).catch(() => {});
  ok((await rows(p)).length >= 1 && await p.isVisible('text=Đang ngoại tuyến'), 'mất mạng: vẫn xem dữ liệu đã lưu + báo ngoại tuyến');
  const p2 = await p.context().newPage(); await p.close(); p = p2;
  await p.route('https://script.google.com/**', rt => rt.abort()); await p.goto(BASE); await p.waitForSelector('tbody tr', { timeout: 10000 }).catch(() => {});
  ok((await rows(p)).length >= 1, 'đóng app rồi mở lại khi mất mạng: vẫn xem được dữ liệu đã lưu');
  await p.unroute('https://script.google.com/**'); await p.route('https://script.google.com/**', async rt => await rt.fulfill({ contentType: 'application/json', body: api.doPost({ postData: { contents: rt.request().postData() } }).t }));
  offline = false;
  await p.click('#outBtn'); await p.waitForSelector('#loginBtn');
  ok(await p.evaluate(() => new Promise(r => { const q = indexedDB.open('qlhh'); q.onsuccess = () => { const t = q.result.transaction('kv').objectStore('kv').getAllKeys(); t.onsuccess = () => r(t.result.length === 0); }; })), 'đăng xuất xoá dữ liệu lưu trên máy');
  await p.context().close();

  // ===== NHẬP LIỆU — điện thoại dọc =====
  p = await page(b, { width: 390, height: 844 }, 'nv@gmail.com');
  await login(p); await p.waitForSelector('.list .it');
  ok(!(await p.$('a[href="#/nguoidung"]')), 'Nhập liệu không thấy menu Người dùng');
  const raw = JSON.stringify(await p.evaluate(() => window.QLHH_DEBUG.data));
  ok(!raw.includes('2900000'), 'BẢO MẬT: dữ liệu trên máy Nhập liệu không chứa giá nhập/giá vốn');
  await p.screenshot({ path: SHOTS + '/mobile-portrait-light.png' });
  const m = await p.evaluate(() => {
    const over = document.documentElement.scrollWidth > innerWidth;
    const small = [...document.querySelectorAll('.bnav a,.bnav button,.chip,.msearch,.list .it,#main .btn,.mtop .btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 48 || r.width < 44); }).map(e => e.textContent.trim().slice(0, 20) || e.getAttribute('aria-label'));
    const nav = document.querySelector('.bnav').getBoundingClientRect();
    return { over, small, navBottom: Math.round(nav.bottom), h: innerHeight };
  });
  ok(!m.over, 'dọc: không tràn ngang'); ok(m.small.length === 0, 'dọc: vùng chạm ≥ 48px ' + m.small.join(',')); ok(m.navBottom === m.h, 'thanh điều hướng dưới bám đáy');
  await p.click('.list .it'); await p.waitForTimeout(250);
  ok(await p.isVisible('#detBack'), 'mở chi tiết có nút Quay lại'); await p.screenshot({ path: SHOTS + '/mobile-detail.png' });
  ok(!(await p.textContent('#det')).includes('Giá nhập'), 'Nhập liệu không thấy mục giá nhập');
  await p.click('#detBack'); await p.waitForTimeout(250); ok(await p.isHidden('#det'), 'Quay lại đóng chi tiết');
  await p.click('#moreBtn'); ok(await p.isVisible('text=Đổi công ty'), 'menu Thêm có đổi công ty/đăng xuất'); await p.keyboard.press('Escape');
  await p.context().close();
  // ===== XEM — dọc tối; ngang; desktop tối =====
  p = await page(b, { width: 390, height: 844 }, 'xem@gmail.com', 'dark'); await login(p);
  ok(!(await p.$('#addItemM')) && !(await p.$('#addItem')), 'vai trò Xem không có nút Thêm hàng');
  await p.focus('#qm'); await p.keyboard.type('den'); await p.waitForTimeout(250); ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'qm' && document.activeElement.value === 'den'), 'gõ tìm: ô tìm giữ nguyên (không bị dựng lại → không hỏng bộ gõ Telex)');
  await p.screenshot({ path: SHOTS + '/mobile-portrait-dark.png' }); await p.context().close();
  p = await page(b, { width: 360, height: 640 }, 'nv@gmail.com'); await login(p); await p.waitForSelector('.list .it');
  const sm = await p.evaluate(() => { const b = document.querySelector('#addItemM').getBoundingClientRect(); return { over: document.documentElement.scrollWidth > innerWidth, add: b.right <= innerWidth && b.top < 120 }; });
  ok(!sm.over && sm.add, 'máy nhỏ 360: không tràn, nút Thêm hàng nằm trên thanh trên'); await p.screenshot({ path: SHOTS + '/mobile-360.png' }); await p.context().close();
  p = await page(b, { width: 844, height: 390 }); await login(p); await p.waitForSelector('.list .it');
  const l = await p.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, side: getComputedStyle(document.querySelector('aside.side')).display }));
  ok(!l.over && l.side === 'none', 'ngang: không tràn, dùng bố cục điện thoại'); await p.screenshot({ path: SHOTS + '/mobile-landscape.png' });
  await p.context().close();
  p = await page(b, { width: 1366, height: 820 }, 'maivulam2020@gmail.com', 'dark'); await login(p); await p.click('tbody tr'); await p.screenshot({ path: SHOTS + '/desktop-dark.png' }); await p.context().close();
  await b.close(); srv.close();
  console.log(fails.length ? 'THẤT BẠI ' + fails.length + ':\n - ' + fails.join('\n - ') : 'TẤT CẢ ĐẠT'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
