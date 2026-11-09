// E2E giao diện đợt ② — kho (Playwright + máy chủ giả lập Code.gs + Kho.gs thật). Chạy: node test/kho.e2e.js
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const { ready, rid } = require('./gas-mock.js');
const DOCS = path.join(__dirname, '..', 'docs'), SHOTS = process.env.SHOTS || '/tmp/qlhh-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const api = ready({ 'nv@gmail.com': 'NHAP_LIEU' });
const srv = http.createServer((q, r) => {
  let f = path.join(DOCS, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } const ext = path.extname(f); r.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png' }[ext] || 'application/json' }); r.end(b); });
}).listen(8767);
const BASE = 'http://localhost:8767/';
let drop = 0; const fails = []; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
// dữ liệu sẵn qua API (danh mục đã test ở đợt ①)
const s0 = api.login(); const W = (action, o) => { const r = api.post({ action, session: s0, requestId: rid(), ...o }); if (!r.ok) throw new Error(action + ' ' + JSON.stringify(r)); };
W('item.upsert', { isNew: true, item: { maHang: 'LOGO', ten: 'Siemens LOGO! 230RC', dvt: 'bộ', hang: 'Siemens', quanLySerial: true } });
W('item.upsert', { isNew: true, item: { maHang: 'CB40', ten: 'CB tổng 2P 40A', dvt: 'cái', tonToiThieu: 5 } });
W('item.upsert', { isNew: true, item: { maHang: 'CAP', ten: 'Cáp CVV 2x2.5', dvt: 'm' } });
W('unit.upsert', { unit: { maHang: 'CAP', dvtPhu: 'cuộn', heSo: 500 } });
W('supplier.upsert', { isNew: true, supplier: { maNCC: 'NCC1', ten: 'Cty Thiết bị điện' } });
async function page(b, vp, email = 'maivulam2020@gmail.com', scheme = 'light') {
  const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, acceptDownloads: true, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('JS lỗi: ' + e.message); fails.push('JS lỗi: ' + e.message); });
  await p.route('https://script.google.com/**', async rt => {
    const body = api.doPost({ postData: { contents: rt.request().postData() } }).t;   // máy chủ VẪN ghi
    if (drop > 0 && JSON.parse(rt.request().postData()).action === 'voucher.create') { drop--; return rt.abort(); }   // nhưng phản hồi bị mất
    await rt.fulfill({ contentType: 'application/json', body });
  });
  await p.route('https://accounts.google.com/**', async rt => { const u = new URL(rt.request().url()); api.st.email = email; api.st.nonce = u.searchParams.get('nonce'); await rt.fulfill({ status: 302, headers: { location: BASE + '#id_token=tok-' + Math.random() + '&state=LAVIPCO' } }); });
  await p.goto(BASE); await p.waitForSelector('#loginBtn'); await p.click('#loginBtn');
  await p.waitForFunction(() => window.QLHH_DEBUG && window.QLHH_DEBUG.data, null, { timeout: 10000 });
  return p;
}
const fill = async (p, o) => { for (const [k, v] of Object.entries(o)) { const s = '#f_' + k; const tag = await p.$eval(s, e => e.tagName); if (tag === 'SELECT') await p.selectOption(s, v); else await p.fill(s, String(v)); } };
const closed = p => p.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 8000 }).then(() => true).catch(() => false);
const msg = p => p.$eval('#dlgMsg', e => e.textContent).catch(() => '');
const line = async (p, i, o) => { for (const [k, v] of Object.entries(o)) { const s = { maHang: '#l_ma_', dvt: '#l_dvt_', soLuongCT: '#l_sl_', gia: '#l_gia_', serials: '#l_sr_', slThucTe: '#l_tt_' }[k] + i; if (k === 'dvt') await p.selectOption(s, v); else { await p.fill(s, String(v)); if (k === 'maHang') await p.dispatchEvent(s, 'change'); } } };
const toast = p => p.$$eval('.toast', ts => ts.map(t => t.textContent).join(' | '));

(async () => {
  const b = await chromium.launch();
  let p = await page(b, { width: 1366, height: 860 });
  await p.goto(BASE + '#/khach'); await p.click('#addKH'); await fill(p, { maKH: 'tn', ten: 'CP QLVH Chiếu sáng ĐT Tây Ninh', mst: '3900123456' }); await p.click('#dlgOk'); ok(await closed(p), 'thêm khách hàng');
  await p.click('#addCT'); await fill(p, { maCongTrinh: 'pdg', ten: 'Hẻm 20 Phan Đình Giót', maKH: 'TN' }); await p.click('#dlgOk'); ok(await closed(p), 'thêm công trình gắn khách');
  ok((await p.textContent('#main')).includes('Hẻm 20 Phan Đình Giót'), 'công trình hiện dưới khách');
  // nhập mua 2 dòng: CB40 + cáp theo cuộn, LOGO có serial
  await p.goto(BASE + '#/kho'); ok((await p.textContent('#main')).includes('Tồn đầu kỳ'), 'tồn kho rỗng có hướng dẫn bắt đầu');
  await p.click('#newV'); await p.click('[data-t="NHAP_MUA"]');
  await fill(p, { maNCC: 'NCC1', soCTGoc: 'HĐ 0001234', nguoiGiaoNhan: 'Anh Bình' });
  await line(p, 0, { maHang: 'cb40', soLuongCT: 10, gia: '450.000' });
  await p.click('#addLine'); await line(p, 1, { maHang: 'CAP' }); await line(p, 1, { dvt: 'cuộn', soLuongCT: 2, gia: 25000000 });
  await p.click('#addLine'); await line(p, 2, { maHang: 'LOGO' }); await line(p, 2, { soLuongCT: 2, gia: 4150000, serials: 'VPC4H20512\nVPC4H20513' });
  ok((await p.textContent('#vSum')).replace(/\D/g, '') === String(4500000 + 50000000 + 8300000), 'tổng tiền phiếu nhập tính ngay khi gõ');
  await p.screenshot({ path: SHOTS + '/kho-phieu-nhap.png' });
  await p.click('#dlgOk'); ok(await closed(p), 'lưu phiếu nhập mua 3 dòng (quy đổi cuộn, serial)'); ok((await toast(p)).includes('PN-'), 'báo số phiếu PN-…');
  await p.waitForTimeout(200);
  ok((await p.textContent('#stockRes')).includes('1.000'), 'tồn cáp 1.000 m sau quy đổi');
  // xuất bán thiếu tồn → báo lỗi, giữ dữ liệu
  await p.click('#newV'); await p.click('[data-t="XUAT_BAN"]'); await fill(p, { maKH: 'TN', maCongTrinh: 'PDG' });
  await line(p, 0, { maHang: 'CB40', soLuongCT: 11 }); await p.click('#dlgOk'); await p.waitForTimeout(300);
  ok(/Không đủ tồn/.test(await msg(p)), 'xuất quá tồn → báo "Không đủ tồn" trong hộp thoại');
  await line(p, 0, { soLuongCT: 7 });
  await p.click('#addLine'); await line(p, 1, { maHang: 'LOGO' });
  ok(await p.waitForSelector('[data-s="VPC4H20512"]', { timeout: 3000 }).then(() => true).catch(() => false), 'xuất hàng serial: chọn serial đang trong kho');
  await p.check('[data-s="VPC4H20512"]');
  await p.click('#dlgOk'); ok(await closed(p), 'lưu phiếu xuất bán'); await p.waitForTimeout(200);
  ok((await p.textContent('#stockRes')).includes('⚠') || (await p.textContent('#main')).includes('Dưới tồn tối thiểu (1)'), 'CB40 còn 3 < 5 → cảnh báo dưới tồn tối thiểu');
  await p.screenshot({ path: SHOTS + '/kho-ton.png' });
  // danh sách phiếu → xem → in → đảo
  await p.goto(BASE + '#/phieu'); await p.waitForSelector('[data-so]');
  ok((await p.$$('[data-so]')).length === 2, 'danh sách 2 phiếu');
  await p.click('[data-so^="PX-"]'); await p.waitForSelector('#vPrint');
  ok((await p.textContent('#dlg')).includes('VPC4H20512'), 'xem phiếu: có serial đã xuất');
  await p.screenshot({ path: SHOTS + '/kho-xem-phieu.png' });
  await p.evaluate(() => { window.print = () => { window.__printed = document.querySelector('#printArea') && document.querySelector('#printArea').innerText; }; });
  await p.click('#vPrint'); await p.waitForTimeout(200);
  const pr = await p.evaluate(() => window.__printed || '');
  ok(/PHIẾU XUẤT KHO/.test(pr) && /Mẫu số 02 - VT/.test(pr) && /viết bằng chữ/.test(pr) && /Thủ kho/.test(pr) && /đồng/.test(pr), 'in phiếu xuất: đủ mẫu 02-VT, tiền bằng chữ, chữ ký');
  await p.emulateMedia({ media: 'print' }); await p.evaluate(() => document.body.classList.add('printing'));
  await p.click('#vPrint'); await p.screenshot({ path: SHOTS + '/kho-in-phieu.png', fullPage: true }); await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => { document.body.classList.remove('printing'); const x = document.querySelector('#printArea'); if (x) x.remove(); });
  await p.click('#vRev'); await fill(p, { lyDo: 'Xuất nhầm công trình' }); await p.click('#dlgOk'); ok(await closed(p), 'QT đảo phiếu xuất');
  await p.waitForTimeout(200); ok((await p.textContent('#main')).includes('Đã đảo') && (await p.textContent('#main')).includes('DA-'), 'phiếu gốc "Đã đảo" + phiếu đảo DA-');
  await p.click('[data-so^="DA-"]'); await p.waitForSelector('#vPrint');
  await p.evaluate(() => { window.print = () => { window.__printed = document.querySelector('#printArea').innerText; }; });
  await p.click('#vPrint'); await p.waitForTimeout(300);
  const pd = await p.evaluate(() => window.__printed || '');
  ok(/PHIẾU XUẤT KHO \(ĐẢO\)/.test(pd) && /Mẫu số 02 - VT/.test(pd) && /Đảo chứng từ số PX-/.test(pd) && /-7/.test(pd) && /ghi âm/.test(pd), 'in phiếu đảo: mẫu phiếu gốc, số âm, ghi rõ chứng từ bị đảo');
  ok(/Địa chỉ|Số 63\/23A/.test(pd), 'bản in có địa chỉ đơn vị');
  await p.evaluate(() => { const x = document.querySelector('#printArea'); if (x) x.remove(); document.body.classList.remove('printing'); }); await p.keyboard.press('Escape');
  // trả NCC từ phiếu nhập gốc
  await p.click('[data-so^="PN-"]'); await p.waitForSelector('#vTn'); await p.click('#vTn');
  await line(p, 0, { soLuongCT: 1 }); await p.click('#dlgOk'); const okTn = await closed(p);
  if (!okTn) { console.log('  msg:', await msg(p)); p.once('dialog', dg => dg.accept()); await p.keyboard.press('Escape'); }
  ok(okTn, 'trả NCC từ phiếu nhập gốc (tính theo giá gốc)');
  // mất phản hồi khi lưu → bấm Lưu lại → chỉ 1 phiếu
  const nPh = api.sheets.Phieu.d.length;
  await p.click('#newV'); await p.click('[data-t="XUAT_CONG_TRINH"]'); await fill(p, { maCongTrinh: 'PDG' }); await line(p, 0, { maHang: 'CB40', soLuongCT: 1 });
  drop = 2; await p.click('#dlgOk'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => document.querySelector('#dlg').open), 'mất phản hồi → hộp thoại còn mở, báo lỗi');
  await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(300);
  await p.click('#dlgOk'); ok(await closed(p), 'bấm Lưu lại khi có mạng');
  ok(api.sheets.Phieu.d.length === nPh + 1, 'chỉ 1 phiếu được tạo (cùng requestId)');
  await p.click('#newV'); await p.click('[data-t="XUAT_CONG_TRINH"]'); await line(p, 0, { maHang: 'CB40', soLuongCT: 1 });
  p.once('dialog', dg => dg.dismiss()); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('#dlg').open), 'Esc khi phiếu đang nhập dở → hỏi lại, bấm Huỷ thì giữ phiếu');
  p.once('dialog', dg => dg.accept()); await p.keyboard.press('Escape'); ok(await closed(p), 'đồng ý bỏ → đóng');
  await p.click('#newV'); await p.click('[data-t="XUAT_CONG_TRINH"]'); await fill(p, { maCongTrinh: 'PDG' }); await line(p, 0, { maHang: 'CB40', soLuongCT: 1 });
  await p.focus('#l_sl_0'); await p.keyboard.press('Control+Enter'); ok(await closed(p), 'Ctrl+Enter trong dòng hàng = Lưu phiếu');
  // kiểm kê
  await p.goto(BASE + '#/kho'); await p.click('[data-km="CB40"]'); await p.click('#kKK'); await line(p, 0, { slThucTe: 9 });
  await p.click('#dlgOk'); ok(await closed(p), 'kiểm kê từ chi tiết tồn'); await p.waitForTimeout(200);
  ok(api.sheets.TonKho.d.some(r => r[0] === 'CB40' && r[1] === 'KHO' && r[2] === 9), 'tồn CB40 = 9 sau kiểm kê');
  // báo cáo N-X-T
  await p.goto(BASE + '#/baocao'); await p.click('#rRun'); await p.waitForSelector('#rOut table');
  ok((await p.textContent('#rOut')).includes('CB40'), 'báo cáo N-X-T có dữ liệu');
  // khoá sổ
  await p.goto(BASE + '#/kho'); await p.click('#khoAdm'); await p.click('#lockB'); await fill(p, { ngay: '2026-01-31' }); await p.click('#dlgOk'); ok(await closed(p), 'khoá sổ');
  // ===== NHẬP LIỆU: không thấy giá trị; mobile dọc/ngang =====
  const nv = await page(b, { width: 390, height: 844 }, 'nv@gmail.com');
  await nv.goto(BASE + '#/kho'); await nv.waitForSelector('#stockRes');
  ok(!(await nv.textContent('#main')).includes('Giá trị tồn'), 'Nhập liệu không thấy giá trị tồn');
  ok(await nv.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile 390: không tràn ngang');
  await nv.screenshot({ path: SHOTS + '/kho-mobile.png' });
  await nv.click('#newVM'); await nv.click('[data-t="XUAT_CONG_TRINH"]'); await fill(nv, { maCongTrinh: 'PDG' }); await line(nv, 0, { maHang: 'CAP', soLuongCT: '120,5' });
  await nv.screenshot({ path: SHOTS + '/kho-mobile-lap-phieu.png' });
  ok(await nv.evaluate(() => document.querySelector('#dlg').scrollWidth <= innerWidth + 1), 'mobile: hộp lập phiếu không tràn');
  await nv.click('#dlgOk'); ok(await closed(nv), 'Nhập liệu xuất 120,5 m cáp (dấu phẩy thập phân)');
  await nv.goto(BASE + '#/phieu'); await nv.click('[data-so^="XC-"]'); await nv.waitForSelector('#vPrint');
  ok(!(await nv.textContent('#dlg')).includes('6.025.000') && !(await nv.isVisible('#vRev')), 'Nhập liệu: không thấy giá trị, không có nút đảo');
  await nv.keyboard.press('Escape');
  await nv.setViewportSize({ width: 844, height: 390 }); await nv.goto(BASE + '#/kho'); await nv.waitForTimeout(300);
  ok(await nv.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'ngang 844×390: không tràn');
  await nv.screenshot({ path: SHOTS + '/kho-ngang.png' });
  const dk = await page(b, { width: 1366, height: 860 }, 'maivulam2020@gmail.com', 'dark');
  await dk.goto(BASE + '#/kho'); await dk.waitForSelector('#stockRes'); await dk.screenshot({ path: SHOTS + '/kho-toi.png' });
  await b.close(); srv.close();
  console.log(fails.length ? `\n${fails.length} LỖI:\n- ` + fails.join('\n- ') : '\nTẤT CẢ ĐẠT');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
