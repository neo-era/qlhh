// E2E đợt 2 (thao tác hằng ngày): tìm kiếm giữ con trỏ, QR sau đăng nhập, khách ↔ công trình, serial, tự làm mới, cắt danh sách, màu tối, ô 16px. Chạy: node test/dot2.e2e.js
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const { ready, rid, jwt } = require('./gas-mock.js');
const DOCS = path.join(__dirname, '..', 'docs'), SHOTS = process.env.SHOTS || '/tmp/qlhh-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const api = ready({ 'nv@gmail.com': 'NHAP_LIEU' });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let f = path.join(DOCS, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
}).listen(8769);
const BASE = 'http://localhost:8769/';
const fails = []; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
const s0 = api.login(); const W = (action, o) => { const r = api.post({ action, session: s0, requestId: rid(), ...o }); if (!r.ok) throw new Error(action + ' ' + JSON.stringify(r)); return r.data; };
const BOM = [['VO', 'Vỏ tủ composite 775×478×324', 1, 3200000], ['CB40', 'CB tổng 2P 40A', 1, 450000], ['CB6', 'CB 2P 6A', 1, 180000], ['LOGO', 'Siemens LOGO! 230RC', 1, 4150000], ['CONT', 'Contactor 3P 40A', 2, 620000], ['DEN', 'Đèn báo 220V', 5, 45000], ['CT', 'Công tắc On/Off – Auto/Man', 1, 160000], ['DOM', 'Cầu đấu domino', 3, 55000], ['PK', 'Dây, phụ kiện đấu nối', 1, 350000]];
const KCS = [['Ngoại quan vỏ tủ: kích thước, màu, bản lề, khoá', 'Đúng bản vẽ, không nứt vỡ'], ['Chủng loại, số lượng thiết bị', 'Đủ, đúng quy cách'], ['Đấu nối, màu dây, bó dây', 'Chắc chắn, đúng sơ đồ'], ['Thông mạch nhánh 1, 2', 'Thông mạch'], ['Cấp nguồn chạy thử', 'Hoạt động bình thường'], ['Chương trình PLC LOGO!', 'Đúng chế độ cài đặt']];
for (const [m, ten] of BOM) W('item.upsert', { isNew: true, item: { maHang: m, ten, dvt: m === 'LOGO' ? 'bộ' : 'cái', hang: m === 'LOGO' ? 'Siemens' : '', xuatXu: m === 'LOGO' ? 'Đức' : '', quanLySerial: m === 'LOGO' } });
W('item.upsert', { isNew: true, item: { maHang: 'TU-DKCS-2N', ten: 'Tủ ĐKCS 2 nhánh PLC LOGO!', dvt: 'tủ', hang: 'LAVIPCO', quanLySerial: true, thangBH: 12 } });
W('supplier.upsert', { isNew: true, supplier: { maNCC: 'NCC1', ten: 'Cty Thiết bị điện' } });
W('customer.upsert', { isNew: true, customer: { maKH: 'TN', ten: 'CP Thi công QLVH Chiếu sáng ĐT Tây Ninh', diaChi: 'Số 8 Nguyễn Chí Thanh, P. Tân Ninh, Tây Ninh' } });
W('project.upsert', { isNew: true, project: { maCongTrinh: 'PDG', ten: 'Nâng cấp hẻm 20 Phan Đình Giót', maKH: 'TN' } });
W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-01', kho: 'KHO', maNCC: 'NCC1', lines: BOM.map(([m, , q, g]) => ({ maHang: m, soLuongCT: q * 3, gia: g, serials: m === 'LOGO' ? ['VPC4H20512', 'VPC4H20513', 'VPC4H20514'] : undefined })) } });
W('template.upsert', { template: { maMau: 'TU-2N', maHang: 'TU-DKCS-2N', ten: 'Tủ ĐKCS 2 nhánh LOGO!', moTa: 'Tủ điều khiển chiếu sáng công cộng – nguồn 220V/50Hz, 02 nhánh ra, điều khiển bằng PLC Siemens LOGO!', kichThuoc: '775 × 478 × 324', vatLieu: 'Composite, màu ghi', ketCau: '02 ngăn: thiết bị + điện kế', filePLC: 'NisseLOGOProgram_V2-ELR.lld', thangBH: 12,
  bom: BOM.map(([m, , q]) => ({ maHang: m, soLuong: q })), kcs: KCS.map(([noiDung, yeuCau]) => ({ noiDung, yeuCau })), ghiChuDM: 'Ngăn điện kế chừa sẵn vị trí lắp; điện kế do Điện lực cung cấp.' } });
// lệnh thứ 2 dựng sẵn qua API: 1 tủ đã nhập, chưa KCS (cho phần điện thoại)
const so2 = W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 1, ngay: '2026-11-02', kho: 'KHO' } }).soLSX;
W('lsx.xuatSX', { soLSX: so2, ngay: '2026-11-03', lines: BOM.map(([m, , q]) => ({ maHang: m, soLuongCT: q, serials: m === 'LOGO' ? ['VPC4H20514'] : undefined })) });
const tuM = W('lsx.nhapTP', { soLSX: so2, ngay: '2026-11-04', soLuong: 1 }).serials[0];

async function page(b, vp, email = 'maivulam2020@gmail.com', scheme = 'light') {
  const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, serviceWorkers: 'block', hasTouch: vp.width < 900, permissions: ['geolocation'], geolocation: { latitude: 11.310123, longitude: 106.098345, accuracy: 8 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('JS lỗi: ' + e.message); fails.push('JS lỗi: ' + e.message); });
  p.on('console', m => { if (m.type() === 'error') console.log('console: ' + m.text()); });
  await p.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; window.__printHTML = (document.getElementById('printArea') || {}).innerHTML; }; });
  await p.route('https://script.google.com/**', async rt => rt.fulfill({ contentType: 'application/json', body: api.doPost({ postData: { contents: rt.request().postData() } }).t }));
  await p.route('https://accounts.google.com/**', async rt => { const u = new URL(rt.request().url()); api.st.email = email; api.st.nonce = u.searchParams.get('nonce'); await rt.fulfill({ status: 302, headers: { location: BASE + '#id_token=' + jwt(api.st.nonce) + '&state=LAVIPCO' } }); });
  await p.goto(BASE); await p.waitForSelector('#loginBtn'); await p.click('#loginBtn');
  await p.waitForFunction(() => window.QLHH_DEBUG && window.QLHH_DEBUG.data, null, { timeout: 10000 });
  return p;
}
const fill = async (p, o) => { for (const [k, v] of Object.entries(o)) { const s = '#f_' + k; const tag = await p.$eval(s, e => e.tagName); if (tag === 'SELECT') await p.selectOption(s, v); else await p.fill(s, String(v)); } };
const closed = p => p.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 8000 }).then(() => true).catch(() => false);
const toast = p => p.$$eval('.toast', ts => ts.map(t => t.textContent).join(' | '));
const main = p => p.textContent('#main');
const settle = p => p.waitForTimeout(350);
const noOverflow = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && (!document.querySelector('#dlg').open || document.querySelector('#dlg').scrollWidth <= innerWidth + 1));
async function kcsAll(p, bad) {   // bad = {chỉ số mục: ghi chú}
  for (let i = 0; i < KCS.length; i++) {
    await p.waitForSelector('.kcb');
    if (bad && bad[i] !== undefined) { await p.click('.kcb.bad'); await p.fill('#kcNote', bad[i]); if (i < KCS.length - 1) await p.click('#kcNx'); }
    else { await p.click('.kcb.ok'); await p.waitForTimeout(320); }
  }
}

W('customer.upsert', { isNew: true, customer: { maKH: 'KH2', ten: 'Khách thứ hai' } });
W('project.upsert', { isNew: true, project: { maCongTrinh: 'CT2', ten: 'Công trình của KH2', maKH: 'KH2' } });
for (let i = 0; i < 360; i++) W('item.upsert', { isNew: true, item: { maHang: 'DM' + String(i).padStart(3, '0'), ten: 'Hàng thử ' + i, dvt: 'cái' } });
W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-10-05', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'VO', soLuongCT: 1, gia: 100 }] } });
const focusId = p => p.evaluate(() => document.activeElement && document.activeElement.id);

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  // ---------- A2: quét QR khi chưa đăng nhập → đăng nhập xong mở đúng hồ sơ tủ ----------
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', hasTouch: true });
    const p = await ctx.newPage(); p.on('pageerror', e => fails.push('JS lỗi: ' + e.message));
    await p.route('https://script.google.com/**', async rt => rt.fulfill({ contentType: 'application/json', body: api.doPost({ postData: { contents: rt.request().postData() } }).t }));
    await p.route('https://accounts.google.com/**', async rt => { const u = new URL(rt.request().url()); api.st.email = 'nv@gmail.com'; api.st.nonce = u.searchParams.get('nonce'); await rt.fulfill({ status: 302, headers: { location: BASE + '#id_token=' + jwt(api.st.nonce) + '&state=' + u.searchParams.get('state') } }); });
    await p.goto(BASE + '#/t/LAVIPCO/' + encodeURIComponent(tuM)); await p.waitForSelector('#loginBtn'); await p.click('#loginBtn');
    await p.waitForFunction(t => document.querySelector('#dlg').open && document.querySelector('#dlg').textContent.includes(t), tuM, { timeout: 10000 }).catch(() => {});
    ok((await p.textContent('#dlg')).includes('Hồ sơ tủ ' + tuM), 'A2 QR khi chưa đăng nhập → đăng nhập xong mở đúng hồ sơ tủ');
    await ctx.close();
  }
  for (const vp of [{ width: 390, height: 844 }, { width: 1366, height: 860 }]) {
    const mob = vp.width < 900, tag = mob ? '[điện thoại] ' : '[máy tính] ';
    const p = await page(b, vp, 'nv@gmail.com');
    // ---------- A1: ô tìm giữ con trỏ trên mọi màn ----------
    for (const [r, sel, q] of [['kho', mob ? '#qkm' : '#qkd', 'LOGO'], ['phieu', mob ? '#qpm' : '#qpd', 'PN'], ['sx', mob ? '#qsm' : '#qsd', 'LSX'], ['bh', '#qbh', 'LV']]) {
      await p.goto(BASE + '#/' + r); await settle(p); await p.click(sel); await p.keyboard.type(q, { delay: 60 }); await p.waitForTimeout(700);
      ok(await focusId(p) === sel.slice(1) && await p.inputValue(sel) === q, tag + `A1 ${r}: gõ "${q}" xong con trỏ vẫn ở ô tìm`);
    }
    await p.goto(BASE + '#/kho'); await settle(p); await p.fill(mob ? '#qkm' : '#qkd', 'LOGO'); await p.waitForTimeout(500);
    ok((await p.textContent('#stockRes')).includes('LOGO') && !(await p.textContent('#stockRes')).includes('DM001'), tag + 'A1 kết quả tồn kho lọc đúng');
    // gõ kiểu bộ gõ tiếng Việt: trong lúc composition không vẽ lại
    await p.fill(mob ? '#qkm' : '#qkd', ''); await p.waitForTimeout(400);
    const comp = await p.evaluate(async sel => { const q = document.querySelector(sel); q.focus(); q.dispatchEvent(new CompositionEvent('compositionstart')); q.value = 'tu'; q.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 500)); const same = document.querySelector(sel) === q && document.activeElement === q; q.value = 'tủ'; q.dispatchEvent(new CompositionEvent('compositionend')); await new Promise(r => setTimeout(r, 500)); return same && document.activeElement === q; }, mob ? '#qkm' : '#qkd');
    ok(comp, tag + 'A1 đang gõ dấu (Telex/VNI) không bị cắt, ô tìm không bị dựng lại');
    // ---------- B2: danh sách bị cắt có báo + Xem thêm ----------
    await p.fill(mob ? '#qkm' : '#qkd', ''); await p.waitForTimeout(500);
    ok(await p.isVisible('#kMore') && /Đang hiện 300\//.test(await p.textContent('#stockRes')), tag + 'B2 tồn kho > 300 mã: có dòng đếm + Xem thêm');
    await p.click('#kMore'); await settle(p); ok(!(await p.isVisible('#kMore')), tag + 'B2 Xem thêm hiện hết');
    // ---------- B9: ngày dd/mm/yyyy; lọc tháng ----------
    await p.goto(BASE + '#/phieu'); await settle(p);
    ok(/01\/11\/2026/.test(await main(p)) && !/2026-11-01/.test(await main(p)), tag + 'B9 danh sách phiếu ghi ngày dd/mm/yyyy');
    await p.fill('#vMon', '2026-10'); await p.dispatchEvent('#vMon', 'change'); await settle(p);
    ok((await p.$$('[data-so]')).length === 1 && /05\/10\/2026/.test(await main(p)), tag + 'B8 lọc phiếu theo tháng');
    await p.click('#vMonX'); await settle(p);
    // ---------- A3: khách ↔ công trình ----------
    await p.goto(BASE + '#/phieu'); await settle(p); await p.click(mob ? '#newVM' : '#newV'); await p.click('[data-t="XUAT_BAN"]'); await p.waitForSelector('#f_maKH');
    await p.selectOption('#f_maKH', 'TN'); let opts = await p.$$eval('#f_maCongTrinh option', o => o.map(x => x.value));
    ok(opts.includes('PDG') && !opts.includes('CT2'), tag + 'A3 chọn khách TN → chỉ hiện công trình của TN');
    await p.selectOption('#f_maKH', ''); await p.selectOption('#f_maCongTrinh', 'CT2');
    ok(await p.inputValue('#f_maKH') === 'KH2', tag + 'A3 chọn công trình CT2 → tự điền khách KH2');
    // ---------- B1/A4: chọn serial: tủ chưa KCS bị khoá; lọc; chọn N đầu ----------
    await p.selectOption('#f_maKH', 'TN'); await p.selectOption('#f_maCongTrinh', 'PDG');
    await p.fill('#l_ma_0', 'TU-DKCS-2N'); await p.dispatchEvent('#l_ma_0', 'change'); await settle(p);
    const dis = await p.$eval(`#l_sp_0 input[data-s="${tuM}"]`, c => c.disabled).catch(() => null);
    ok(dis === true && (await p.textContent('#l_sp_0')).includes('Chưa KCS'), tag + 'B1 tủ chưa KCS: hiện nhãn "Chưa KCS", không chọn được');
    await p.fill('#l_ma_0', 'LOGO'); await p.dispatchEvent('#l_ma_0', 'change'); await settle(p);
    await p.fill('#l_sl_0', '2'); await p.dispatchEvent('#l_sl_0', 'input'); await p.click('[data-first="0"]');
    ok(await p.$$eval('#l_sp_0 input:checked', c => c.length) === 2 && (await p.textContent('#l_cnt_0')) === '2', tag + 'A4 "Chọn 2 đầu" chọn đúng 2 serial, bộ đếm 2');
    ok(await focusId(p) !== null, tag + 'A4 chọn serial không vẽ lại cả khối');
    if (await p.$('#l_sf_0')) { await p.fill('#l_sf_0', 'zzz'); ok((await p.$$eval('#l_sp_0 [data-sv]', l => l.filter(x => !x.hidden).length)) === 0, tag + 'A4 ô lọc serial'); }
    // B6 lỗi theo dòng: xuất quá tồn → lý do ghi dưới đúng dòng
    await p.click('[data-none="0"]'); await p.fill('#l_ma_0', 'CB40'); await p.dispatchEvent('#l_ma_0', 'change'); await settle(p); await p.fill('#l_sl_0', '999'); await p.dispatchEvent('#l_sl_0', 'input');
    await p.click('#dlgOk'); await p.waitForTimeout(800);
    ok(/Dòng 1: không đủ tồn/.test(await p.textContent('#dlg [data-line="1"]')), tag + 'B6 lỗi hết tồn ghi lý do ngay dưới dòng hàng');
    // ---------- C: chạm X khi đang nhập dở → hỏi lại ----------
    let asked = false; p.once('dialog', d => { asked = true; d.dismiss(); }); await p.click('#dlg [data-x]'); await settle(p);
    ok(asked && await p.evaluate(() => document.querySelector('#dlg').open), tag + 'C bấm X khi đang nhập dở → hỏi lại, chọn ở lại thì phiếu còn');
    p.once('dialog', d => d.accept()); await p.click('#dlg [data-x]'); await closed(p);
    // ---------- A4: nhập serial — đếm + báo trùng ----------
    await p.click(mob ? '#newVM' : '#newV'); await p.click('[data-t="NHAP_MUA"]'); await p.waitForSelector('#l_ma_0');
    await p.fill('#l_ma_0', 'LOGO'); await p.dispatchEvent('#l_ma_0', 'change'); await settle(p); await p.fill('#l_sl_0', '3'); await p.dispatchEvent('#l_sl_0', 'input');
    await p.fill('#l_sr_0', 'NEW001\nNEW001\nVPC4H20512'); await p.dispatchEvent('#l_sr_0', 'input');
    const dup = await p.textContent('#l_dup_0');
    ok((await p.textContent('#l_cnt_0')) === '3' && /Trùng trong danh sách: NEW001/.test(dup) && /Đã có trên hệ thống: VPC4H20512/.test(dup), tag + 'A4 nhập serial: bộ đếm + báo trùng / đã có');
    // máy quét: mở camera giả, nạp bộ đọc QR, đóng tắt camera
    if (await p.$('[data-scan="0"]')) {
      await p.context().grantPermissions(['camera'], { origin: BASE.slice(0, -1) }); await p.click('[data-scan="0"]'); await p.waitForSelector('.scanov'); await p.waitForFunction(() => /khung|Không/.test((document.querySelector('.scanmsg') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
      ok(/Đưa mã vào khung/.test(await p.textContent('.scanmsg')), tag + 'A4 nút Quét serial mở camera');
      await p.click('.scanov [data-sx]'); ok(!(await p.$('.scanov')), tag + 'A4 đóng máy quét');
    }
    p.once('dialog', d => d.accept()); await p.click('#dlg [data-x]'); await closed(p);
    // ---------- B11: ô nhập 16px trên điện thoại ----------
    if (mob) { await p.goto(BASE + '#/kho'); await settle(p); ok(await p.$eval('#qkm', e => getComputedStyle(e).fontSize) === '16px', tag + 'B10 ô nhập 16 px (iPhone không tự phóng to)'); }
    ok(await noOverflow(p), tag + 'không tràn ngang');
    // ---------- B3: tự làm mới ----------
    await p.goto(BASE + '#/phieu'); await settle(p);
    W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-14', kho: 'KHO', maNCC: 'NCC1', lyDo: 'máy khác ' + vp.width, lines: [{ maHang: 'VO', soLuongCT: 1, gia: 100 }] } });
    await p.evaluate(() => QLHH_DEBUG._poll()); await settle(p);
    ok((await main(p)).includes('máy khác ' + vp.width), tag + 'B3 máy khác vừa ghi → tự cập nhật danh sách');
    await p.click(mob ? '#newVM' : '#newV'); await p.click('[data-t="NHAP_MUA"]'); await p.waitForSelector('#l_ma_0');
    W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-14', kho: 'KHO', maNCC: 'NCC1', lyDo: 'lần 2 ' + vp.width, lines: [{ maHang: 'VO', soLuongCT: 1, gia: 100 }] } });
    await p.evaluate(() => QLHH_DEBUG._poll()); await settle(p);
    ok(await p.isVisible('#newbar') && await p.evaluate(() => document.querySelector('#dlg').open), tag + 'B3 đang mở phiếu → chỉ hiện dải "Có dữ liệu mới", không đóng phiếu');
    p.once('dialog', d => d.accept()); await p.click('#dlg [data-x]'); await closed(p);
    await p.click('#nbGo'); await settle(p); ok((await main(p)).includes('lần 2 ' + vp.width), tag + 'B3 bấm Cập nhật → hiện phiếu mới');
    // ---------- B5: mở phiếu có "đang tải"; chuyển màn đóng hộp thoại ----------
    await p.click('[data-so]'); await p.waitForFunction(() => document.querySelector('#dlg').open);
    await p.goto(BASE + '#/kho'); await settle(p); ok(!(await p.evaluate(() => document.querySelector('#dlg').open)), tag + 'C đổi màn → hộp thoại tự đóng');
    await p.context().close();
  }
  // ---------- B4: KCS màu đúng khi máy tự để chế độ tối ----------
  {
    const p = await page(b, { width: 1366, height: 860 }, 'maivulam2020@gmail.com', 'dark');
    await p.goto(BASE + '#/sx'); await settle(p);
    const c = await p.evaluate(() => { const x = document.createElement('button'); x.className = 'kcb ok'; document.body.appendChild(x); const v = getComputedStyle(x).color; x.remove(); return v; });
    ok(c === 'rgb(74, 222, 128)', 'B4 chế độ tối của hệ thống: nút Đạt dùng màu sáng (' + c + ')');
    // bộ đọc QR giải đúng tem tủ
    const dec = await p.evaluate(async t => { const ld = u => new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); await ld('vendor/jsqr.js'); if (!window.qrcode) await ld('vendor/qrcode.js');
      const q = qrcode(0, 'M'); q.addData(t); q.make(); const n = q.getModuleCount(), k = 6, sz = (n + 8) * k, cv = document.createElement('canvas'); cv.width = cv.height = sz; const cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, sz, sz); cx.fillStyle = '#000'; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) cx.fillRect((c + 4) * k, (r + 4) * k, k, k);
      const res = jsQR(cx.getImageData(0, 0, sz, sz).data, sz, sz); return res && res.data; }, BASE + '#/t/LAVIPCO/' + tuM);
    ok(dec === BASE + '#/t/LAVIPCO/' + tuM, 'A2 bộ đọc QR (jsQR) giải đúng tem tủ');
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails.length ? `\n${fails.length} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
