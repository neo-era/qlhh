// E2E giao diện sản xuất tủ (SX-1): Playwright + máy chủ giả lập (Code.gs + Kho.gs + SanXuat.gs thật). Chạy: node test/sx.e2e.js
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const { ready, rid } = require('./gas-mock.js');
const DOCS = path.join(__dirname, '..', 'docs'), SHOTS = process.env.SHOTS || '/tmp/qlhh-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const api = ready({ 'nv@gmail.com': 'NHAP_LIEU' });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let f = path.join(DOCS, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
}).listen(8768);
const BASE = 'http://localhost:8768/';
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
  await p.route('https://accounts.google.com/**', async rt => { const u = new URL(rt.request().url()); api.st.email = email; api.st.nonce = u.searchParams.get('nonce'); await rt.fulfill({ status: 302, headers: { location: BASE + '#id_token=tok-' + Math.random() + '&state=LAVIPCO' } }); });
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

(async () => {
  const b = await chromium.launch();
  let p = await page(b, { width: 1366, height: 860 });
  await p.goto(BASE + '#/sx'); await settle(p);
  ok((await main(p)).includes('LSX-2026-00001'), 'danh sách lệnh hiện lệnh có sẵn');
  ok(await p.isVisible('.nav a[href="#/sx"]'), 'menu trái có Sản xuất tủ');
  // mẫu tủ: xem + tạo mẫu mới qua giao diện
  await p.click('#tplB'); await p.click('[data-t="TU-2N"]'); ok((await p.textContent('#dlg')).includes('Lưu bản mới'), 'mở mẫu có sẵn → nút Lưu bản mới');
  ok(await p.$$eval('#tBom .trow', r => r.length) === 9 && await p.$$eval('#tKcs .trow', r => r.length) === 6, 'mẫu hiện 9 linh kiện, 6 mục kiểm tra');
  await p.click('[data-x]'); await closed(p);
  await p.click('#tplB'); await p.click('#tAdd');
  await fill(p, { maMau: 'tu-1n', maHang: 'TU-DKCS-2N', ten: 'Tủ 1 nhánh' });
  await p.fill('[data-b="0"][data-f="maHang"]', 'TU-DKCS-2N'); await p.fill('[data-b="0"][data-f="soLuong"]', '1');
  await p.fill('[data-k="0"][data-f="noiDung"]', 'Ngoại quan');
  await p.click('#dlgOk'); await settle(p);
  ok(/không chứa chính thành phẩm/.test(await p.textContent('#dlgMsg')), 'mẫu chứa chính thành phẩm → báo lỗi ngay, không gửi');
  await p.fill('[data-b="0"][data-f="maHang"]', 'VO'); await p.click('#dlgOk'); ok(await closed(p), 'lưu mẫu mới TU-1N ' + (await p.textContent('#dlgMsg').catch(() => '')));
  ok((await toast(p)).includes('TU-1N bản 1'), 'báo đã lưu mẫu bản 1');
  // lập lệnh: xem trước linh kiện cần + thiếu tồn
  await p.click('#newL'); await fill(p, { maMau: 'TU-2N', soLuong: 3, maKH: 'TN', maCongTrinh: 'PDG', canCuCheTao: 'Bản vẽ sơ đồ nguyên lý + vỏ tủ do Cty TVXD Tây Ninh lập' }); await p.waitForTimeout(150);
  ok(/thiếu/.test(await p.textContent('#bomPrev')), 'xem trước: 3 tủ → báo thiếu tồn (đã dùng 1 bộ cho lệnh kia)');
  await fill(p, { soLuong: 2 }); await p.waitForTimeout(150);
  ok(!/thiếu/.test(await p.textContent('#bomPrev')), 'đổi 2 tủ → đủ tồn');
  await p.screenshot({ path: SHOTS + '/sx-lap-lenh.png' });
  await p.click('#dlgOk'); ok(await closed(p), 'lập lệnh 2 tủ'); await p.waitForSelector('.steps'); await settle(p);
  ok((await p.textContent('.steps li.cur')).includes('Xuất linh kiện'), 'trang lệnh: bước 1 Xuất linh kiện đang làm');
  // bước 1: xuất linh kiện (định mức × 2, chọn serial LOGO!)
  await p.click('#aX'); await p.waitForSelector('#vLines');
  ok(await p.$$eval('#vLines .vline', r => r.length) === 9, 'phiếu xuất lập sẵn 9 dòng theo định mức ' + (await p.$$eval('#vLines .vline', r => r.length)) + ' ' + (await p.$$eval('#vLines input[data-f=soLuongCT]', r => r.map(x => x.id + '=' + x.value).join(','))));
  ok((await p.inputValue('#l_sl_4')) === '4', 'contactor 2 × 2 tủ = 4');
  for (const sr of ['VPC4H20512', 'VPC4H20513']) await p.click(`[data-s="${sr}"]`);
  ok((await p.inputValue('#l_sl_3')) === '2', 'chọn 2 serial LOGO! → SL 2');
  await p.click('#dlgOk'); ok(await closed(p), 'lưu phiếu xuất linh kiện'); ok((await toast(p)).includes('XS-'), 'báo số phiếu XS-…');
  await p.waitForSelector('.steps li.cur'); await settle(p);
  ok((await p.textContent('.steps li.cur')).includes('Nhập thành phẩm'), 'sang bước 2');
  // chi phí khác (QT)
  await p.click('#aC'); await fill(p, { soTien: '3.000.000', soCTGoc: 'BL-11/2026', ghiChu: 'Nhân công lắp 2 tủ' }); await p.click('#dlgOk'); ok(await closed(p), 'ghi chi phí nhân công'); await settle(p);
  // bước 2: nhập thành phẩm
  await p.click('#aN'); await p.click('#dlgOk'); ok(await closed(p), 'nhập 2 tủ'); ok(/LV-TUDKCS2N-2026-0002, LV-TUDKCS2N-2026-0003/.test(await toast(p)), 'cấp xê-ri LV-TUDKCS2N-2026-0002/0003');
  await p.waitForSelector('[data-kcs]'); await settle(p);
  ok((await main(p)).includes('11.620.000'), 'QT thấy giá thành 11.620.000/tủ ' + ((await main(p)).match(/Giá thành[^T]{0,30}/g) || []).join(';'));
  ok((await p.textContent('.steps li.cur')).includes('Kiểm tra'), 'sang bước 3 KCS');
  await p.screenshot({ path: SHOTS + '/sx-lenh-desktop.png', fullPage: true });
  // bước 3: KCS tủ 1 đạt hết
  await p.click('[data-kcs]'); await kcsAll(p);
  ok(!(await p.isDisabled('#kcSum')), 'đủ 6 mục → bật Chốt lần kiểm');
  await p.click('#kcSum'); ok((await p.textContent('#kc')).includes('ĐẠT'), 'màn tóm tắt: tủ ĐẠT');
  await p.click('#kcOk'); await p.waitForSelector('#kcNext'); ok(true, 'chốt → gợi ý Tủ kế tiếp');
  // tủ 2: 1 mục không đạt (phải ghi chú)
  await p.click('#kcNext'); await p.waitForTimeout(300);
  await kcsAll(p, { 2: 'Đầu cốt K2 lỏng' });
  await p.click('#kcSum'); ok((await p.textContent('#kc')).includes('KHÔNG ĐẠT'), 'tóm tắt: tủ KHÔNG ĐẠT kèm lỗi');
  await p.click('#kcOk'); await p.waitForSelector('#kcClose'); await p.click('#kcClose'); await closed(p); await settle(p); await p.waitForTimeout(400);
  ok((await main(p)).includes('Đầu cốt K2 lỏng'), 'danh sách tủ hiện lỗi KCS');
  // kiểm lại → đạt
  await p.click('[data-kcs]'); await kcsAll(p); await p.click('#kcSum'); await p.click('#kcOk'); await p.waitForSelector('#kcClose'); await p.click('#kcClose'); await closed(p); await p.waitForTimeout(600);
  ok((await p.textContent('.steps li.cur')).includes('Phiếu xuất xưởng'), 'cả 2 tủ đạt → bước 4');
  // bước 4: phát hành PXX + in
  await p.click('#aP'); await fill(p, { diaDiem: 'Phường Tân Ninh, tỉnh Tây Ninh' }); await p.click('#dlgOk'); ok(await closed(p), 'phát hành PXX');
  ok((await toast(p)).includes('0001/2026/PXX-LAVIPCO'), 'số PXX 0001/2026/PXX-LAVIPCO');
  await p.waitForTimeout(200);
  await p.evaluate(() => { const b = [...document.querySelectorAll('.toast button')].find(x => x.textContent.includes('In PXX')); b && b.click(); });
  await p.waitForFunction(() => window.__printed, null, { timeout: 8000 }).catch(() => {});
  const html = await p.evaluate(() => window.__printHTML || '');
  ok(/PHIẾU XUẤT XƯỞNG/.test(html) && /0001\/2026\/PXX-LAVIPCO/.test(html), 'bản in PXX có tiêu đề + số');
  ok(/I\. THÔNG TIN CHUNG/.test(html) && /II\. THÔNG TIN SẢN PHẨM/.test(html) && /III\. DANH MỤC/.test(html) && /IV\. KẾT QUẢ KIỂM TRA/.test(html) && /V\. KẾT LUẬN/.test(html), 'đủ 5 mục I–V');
  ok((html.match(/<svg/g) || []).length >= 2 && html.includes('LV-TUDKCS2N-2026-0002'), 'có QR + số xê-ri 2 tủ');
  ok(html.includes('VPC4H20512') && html.includes('NisseLOGOProgram_V2-ELR.lld') && html.includes('Số 8 Nguyễn Chí Thanh'), 'serial LOGO!, file PLC, địa chỉ khách');
  ok((html.match(/☑/g) || []).length === 6, 'IV: 6 mục đánh dấu Đạt');
  ok(/12 tháng kể từ ngày bàn giao/.test(html), 'kết luận: BH 12 tháng từ ngày bàn giao');
  await p.evaluate(h => { const d = document.createElement('div'); d.id = 'printArea'; d.innerHTML = h; document.body.appendChild(d); document.body.classList.add('printing'); }, html);
  await p.emulateMedia({ media: 'print' }); await p.pdf({ path: SHOTS + '/sx-PXX.pdf', format: 'A4', printBackground: true });
  await p.screenshot({ path: SHOTS + '/sx-PXX.png', fullPage: true }); await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => { document.getElementById('printArea').remove(); document.body.classList.remove('printing'); });
  ok(html.includes('Kèm theo: Sơ đồ mạch'), 'kết luận có dòng Kèm theo phụ lục');
  // báo cáo dở dang (QT)
  await p.goto(BASE + '#/sx'); await settle(p); await p.evaluate(() => { window.QLHH_DEBUG && 0; });
  if (await p.$('#lBack2')) { await p.click('#lBack2'); await settle(p); }
  await p.click('#wipB'); await fill(p, { from: '2026-11-01' }); await p.click('#dlgOk'); await p.waitForSelector('#wipR table');
  const wr = await p.textContent('#wipR'); ok(wr.includes('LSX-2026-00002') && wr.includes('20.240.000') && wr.includes('23.240.000'), 'báo cáo dở dang: linh kiện 20.240.000, nhập TP 23.240.000');
  await p.click('[data-x]'); await closed(p);
  // tra xê-ri → hồ sơ tủ: 2 lần kiểm, PXX
  await p.goto(BASE + '#/t/LAVIPCO/LV-TUDKCS2N-2026-0003'); await p.waitForSelector('.tuhead', { timeout: 8000 });
  const tv = await p.textContent('#dlg');
  ok(/Kiểm tra xuất xưởng \(2 lần\)/.test(tv) && tv.includes('0001/2026/PXX-LAVIPCO') && tv.includes('VPC4H20513'), 'quét QR → hồ sơ tủ: 2 lần KCS, PXX, serial LOGO! ' + tv.slice(0, 500));
  await p.screenshot({ path: SHOTS + '/sx-ho-so-tu.png' });
  await p.click('[data-x]'); await closed(p);
  await p.goto(BASE + '#/t/DAICHAU/DC-X'); await settle(p); ok((await main(p)).includes('đổi công ty'), 'QR công ty khác → báo đổi công ty');
  // bán tủ đã đạt KCS từ phiếu kho
  // ----- lắp đặt & bảo hành (BH-1) -----
  W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-09', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, serials: ['LV-TUDKCS2N-2026-0003'] }] } });
  W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-10', kho: 'KHO', maNCC: 'NCC1', lines: [{ maHang: 'LOGO', soLuongCT: 1, gia: 4200000, serials: ['VPC4H29999'] }] } });
  await p.goto(BASE + '#/sx'); await p.reload(); await p.waitForFunction(() => window.QLHH_DEBUG && window.QLHH_DEBUG.data);
  await p.goto(BASE + '#/bh'); await settle(p);
  ok((await main(p)).includes('LV-TUDKCS2N-2026-0003') && (await main(p)).includes('Chưa bàn giao'), 'Lắp đặt & BH: tủ đã bán hiện "Chưa bàn giao"');
  await p.click('[data-tu="LV-TUDKCS2N-2026-0003"]'); await p.waitForSelector('#tL');
  await p.click('#tL'); await p.waitForSelector('#gps');
  await fill(p, { tenTaiCT: 'Tủ H20 Phan Đình Giót', soBBBG: 'BBBG-01/2026' }); await p.click('#gps'); await p.waitForFunction(() => document.querySelector('#f_viDo').value !== '');
  ok((await p.inputValue('#f_viDo')) === '11.310123', 'lấy vị trí GPS điền vĩ độ/kinh độ');
  await p.click('#dlgOk'); await p.waitForSelector('.tuhead'); await settle(p);
  ok(/bảo hành đến hết/.test(await toast(p)), 'ghi bàn giao → báo hạn bảo hành');
  const tv2 = await p.textContent('#dlg'); ok(tv2.includes('Còn bảo hành') && tv2.includes('Tủ H20 Phan Đình Giót') && tv2.includes('Xem bản đồ'), 'hồ sơ tủ: còn BH, vị trí, link bản đồ');
  await p.click('#tB'); await fill(p, { nguoiBao: 'Anh Tâm 0909 000 111', moTaLoi: 'Tủ không tự bật đèn buổi tối' }); await p.click('#dlgOk'); await p.waitForSelector('#pR');
  ok((await p.textContent('#dlg')).includes('Trong bảo hành'), 'phiếu BH tính Trong bảo hành');
  await p.click('#pR'); await p.waitForSelector('#rl input[data-f=maHang]');
  await p.fill('[data-r="0"][data-f="maHang"]', 'LOGO'); await p.dispatchEvent('[data-r="0"][data-f="maHang"]', 'change'); await p.waitForSelector('[data-rm]');
  await p.click('[data-rm][value="VPC4H29999"]'); await p.click('[data-rc][value="VPC4H20513"]');
  await p.click('#dlgOk'); await p.waitForSelector('#pU', { timeout: 10000 }); await settle(p);
  ok(/VPC4H29999/.test(await p.textContent('#dlg')) && /thu hồi/.test(await p.textContent('#dlg')), 'thay LOGO!: phiếu ghi serial mới + thu hồi');
  await p.click('#pU'); await fill(p, { trangThai: 'HOAN_THANH', nguyenNhan: 'LOI_THIET_BI', ketQua: 'Thay LOGO! mới, chạy thử đạt' }); await p.click('#dlgOk'); await p.waitForSelector('#pPr'); await settle(p);
  ok((await p.textContent('#dlg')).includes('Hoàn thành'), 'đóng phiếu Hoàn thành');
  await p.click('#pPr'); await p.waitForTimeout(300); const ph = await p.evaluate(() => window.__printHTML || '');
  ok(/PHIẾU BẢO HÀNH/.test(ph) && /VPC4H29999/.test(ph) && /VPC4H20513/.test(ph), 'in phiếu bảo hành có linh kiện thay');
  await p.click('[data-x]'); await closed(p);
  await p.goto(BASE + '#/bh'); await settle(p); await p.click('[data-tab=pbh]'); await settle(p);
  ok((await main(p)).includes('BH-2026-00001') && (await main(p)).includes('Hoàn thành'), 'danh sách phiếu bảo hành');
  await p.screenshot({ path: SHOTS + '/bh-desktop.png', fullPage: true });
  await p.close();

  // ----- điện thoại: nhập liệu làm KCS -----
  const nv = await page(b, { width: 390, height: 844 }, 'nv@gmail.com');
  await nv.goto(BASE + '#/sx'); await settle(nv);
  ok(await noOverflow(nv), 'mobile 390: danh sách lệnh không tràn');
  await nv.click(`[data-lsx="${so2}"]`); await nv.waitForSelector('.steps'); await settle(nv);
  ok(!(await main(nv)).includes('Giá thành') && !(await main(nv)).includes('Dở dang'), 'nhập liệu không thấy giá thành / dở dang');
  ok(await noOverflow(nv), 'mobile: trang lệnh không tràn');
  await nv.screenshot({ path: SHOTS + '/sx-lenh-mobile.png', fullPage: true });
  await nv.click('[data-kcs]'); await nv.waitForSelector('.kcb');
  const bb = await nv.$eval('.kcb.ok', e => { const r = e.getBoundingClientRect(); return [r.height, r.width]; });
  ok(bb[0] >= 56 && bb[1] >= 390 * 0.4, `nút Đạt ${Math.round(bb[0])}×${Math.round(bb[1])} px (≥56 px cao, ~nửa hàng)`);
  await nv.click('.kcb.ok'); await nv.waitForTimeout(350); await nv.click('.kcb.bad');
  ok(await nv.isVisible('#kcNote'), 'không đạt → hiện ô mô tả lỗi');
  await nv.screenshot({ path: SHOTS + '/sx-kcs-mobile.png' });
  ok(await noOverflow(nv), 'mobile: màn KCS không tràn');
  // nháp lưu trên máy: tải lại trang → khôi phục
  await nv.reload(); await nv.waitForFunction(() => window.QLHH_DEBUG && window.QLHH_DEBUG.data);
  await nv.goto(BASE + '#/sx'); await settle(nv); await nv.click(`[data-lsx="${so2}"]`); await nv.waitForSelector('[data-kcs]'); await settle(nv); await nv.click('[data-kcs]'); await nv.waitForSelector('.kcb');
  ok((await nv.textContent('#kc')).includes('Mục 2/6') && /khôi phục/.test(await toast(nv)), 'mở lại → khôi phục nháp ở mục 2');
  await nv.click('.kcb.ok'); await nv.waitForTimeout(350);
  for (let i = 2; i < 6; i++) { await nv.click('.kcb.ok'); await nv.waitForTimeout(330); }
  await nv.click('#kcSum'); await nv.click('#kcOk'); await nv.waitForSelector('#kcClose'); ok(/Tủ đạt/.test(await nv.textContent('#kc')), 'mobile: chốt KCS đạt');
  await nv.click('#kcClose'); await closed(nv);
  await nv.goto(BASE + '#/bh'); await settle(nv); ok(await noOverflow(nv), 'mobile: Lắp đặt & BH không tràn'); await nv.screenshot({ path: SHOTS + '/bh-mobile.png', fullPage: true });
  await nv.goto(BASE + '#/sx'); await settle(nv);
  if (!(await nv.$('[data-tu]'))) { await nv.click(`[data-lsx="${so2}"]`); await nv.waitForSelector('[data-tu]'); await settle(nv); }
  // xoay ngang
  await nv.setViewportSize({ width: 844, height: 390 }); await nv.click('[data-tu]'); await nv.waitForSelector('.tuhead');
  ok(await noOverflow(nv), 'ngang 844×390: hồ sơ tủ không tràn');
  await nv.close();

  // ----- giao diện tối -----
  const dk = await page(b, { width: 390, height: 844 }, 'maivulam2020@gmail.com', 'dark');
  await dk.goto(BASE + '#/sx'); await settle(dk); await dk.screenshot({ path: SHOTS + '/sx-list-dark.png' });
  await dk.close();

  await b.close(); srv.close();
  console.log(fails.length ? `\n${fails.length} LỖI` : '\nTẤT CẢ ĐẠT');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
