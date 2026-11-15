// E2E đợt 3 (v0.5.0): kho hàng lỗi (gửi/nhận NCC, chuyển hàng đã sửa, trả khách), xuất huỷ / nhập khác, tủ khách trả (KCS lại),
// "Thay [linh kiện]" từ hồ sơ tủ, huỷ lần thay, sửa có thu tiền + "Lập phiếu xuất bán", bảo hành hàng không serial, N-X-T theo loại. Chạy: node test/dot3.e2e.js
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const { ready, rid, jwt } = require('./gas-mock.js');
const DOCS = path.join(__dirname, '..', 'docs'), SHOTS = process.env.SHOTS || '/tmp/qlhh-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const api = ready({ 'nv@gmail.com': 'NHAP_LIEU' });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let f = path.join(DOCS, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
}).listen(8771);
const BASE = 'http://localhost:8771/';
const fails = []; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
const s0 = api.login(); const W = (action, o) => { const r = api.post({ action, session: s0, requestId: rid(), ...o }); if (!r.ok) throw new Error(action + ' ' + JSON.stringify(r)); return r.data; };
const ser = s => W('serial.get', { serial: s }).serial;

// ---------- dữ liệu dựng sẵn qua API ----------
const BOM = [['VO', 'Vỏ tủ composite', 1, 3200000], ['LOGO', 'Siemens LOGO! 230RC', 1, 4150000], ['CONT', 'Contactor 3P 40A', 2, 620000], ['CT', 'Công tắc On/Off', 1, 160000]];
for (const [m, ten] of BOM) W('item.upsert', { isNew: true, item: { maHang: m, ten, dvt: m === 'LOGO' ? 'bộ' : 'cái', hang: m === 'LOGO' ? 'Siemens' : '', quanLySerial: m === 'LOGO' } });
W('item.upsert', { isNew: true, item: { maHang: 'DEN-LED', ten: 'Đèn LED 100W', dvt: 'bộ', thangBH: 24 } });
W('item.upsert', { isNew: true, item: { maHang: 'TU-DKCS-2N', ten: 'Tủ ĐKCS 2 nhánh PLC LOGO!', dvt: 'tủ', hang: 'LAVIPCO', quanLySerial: true, thangBH: 12 } });
W('supplier.upsert', { isNew: true, supplier: { maNCC: 'NCC1', ten: 'Cty Thiết bị điện' } });
W('customer.upsert', { isNew: true, customer: { maKH: 'TN', ten: 'CP QLVH Chiếu sáng ĐT Tây Ninh', diaChi: 'Số 8 Nguyễn Chí Thanh, Tây Ninh' } });
W('project.upsert', { isNew: true, project: { maCongTrinh: 'PDG', ten: 'Hẻm 20 Phan Đình Giót', maKH: 'TN' } });
W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay: '2026-11-01', kho: 'KHO', maNCC: 'NCC1', lines: BOM.map(([m, , q, g]) => ({ maHang: m, soLuongCT: q * 3 + (m === 'LOGO' ? 2 : 2), gia: g, serials: m === 'LOGO' ? ['VPC001', 'VPC002', 'VPC003', 'VPC004', 'VPC005'] : undefined })).concat([{ maHang: 'DEN-LED', soLuongCT: 20, gia: 1000000 }]) } });
W('template.upsert', { template: { maMau: 'TU-2N', maHang: 'TU-DKCS-2N', ten: 'Tủ ĐKCS 2 nhánh LOGO!', kichThuoc: '775 × 478 × 324', thangBH: 12, bom: BOM.map(([m, , q]) => ({ maHang: m, soLuong: q })), kcs: [{ noiDung: 'Ngoại quan', yeuCau: 'Đạt' }, { noiDung: 'Chạy thử', yeuCau: 'Đạt' }] } });
const so = W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-02', maKH: 'TN', maCongTrinh: 'PDG', kho: 'KHO' } }).soLSX;
W('lsx.xuatSX', { soLSX: so, ngay: '2026-11-03', lines: BOM.map(([m, , q]) => ({ maHang: m, soLuongCT: q * 2, serials: m === 'LOGO' ? ['VPC001', 'VPC002'] : undefined })) });
const [t1, t2] = W('lsx.nhapTP', { soLSX: so, ngay: '2026-11-04', soLuong: 2 }).serials;
[t1, t2].forEach(t => W('kcs.add', { serial: t, ngay: '2026-11-04', ketQua: [{ ketQua: 'DAT' }, { ketQua: 'DAT' }] }));
W('pxx.issue', { pxx: { ngay: '2026-11-04', serials: [t1, t2], maKH: 'TN', maCongTrinh: 'PDG', diaDiem: 'Tây Ninh' } });
const px = W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-05', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 2, serials: [t1, t2] }, { maHang: 'DEN-LED', soLuongCT: 10 }] } }).soPhieu;
W('install.add', { serial: t1, lapDat: { loai: 'BAN_GIAO', ngay: '2026-11-06', maKH: 'TN', maCongTrinh: 'PDG', diaChi: 'Hẻm 20 Phan Đình Giót' } });
const pbh1 = W('bh.create', { serial: t1, phieu: { ngay: '2026-11-10', moTaLoi: 'PLC treo' } }).soPBH;
// kho hàng lỗi: LOGO! thu hồi (của công ty), đèn khách gửi sửa (của khách)
W('voucher.create', { voucher: { loai: 'XUAT_BAN', ngay: '2026-11-05', kho: 'KHO', maKH: 'TN', maCongTrinh: 'PDG', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['VPC005'] }] } });
W('voucher.create', { voucher: { loai: 'NHAP_HANG_LOI', ngay: '2026-11-07', kho: 'KHO-LOI', lyDo: 'Thu hồi LOGO! lỗi', lines: [{ maHang: 'LOGO', soLuongCT: 1, serials: ['VPC005'] }, { maHang: 'CT', soLuongCT: 1 }] } });
const hlKH = W('voucher.create', { voucher: { loai: 'NHAP_HANG_LOI', ngay: '2026-11-07', kho: 'KHO-LOI', maKH: 'TN', lyDo: 'Khách gửi sửa đèn', lines: [{ maHang: 'DEN-LED', soLuongCT: 2 }] } }).soPhieu;
// tủ 2 khách trả (qua API) → hồ sơ phải báo "Cần KCS lại"
W('voucher.create', { voucher: { loai: 'KHACH_TRA', ngay: '2026-11-11', kho: 'KHO', phieuGoc: px, lyDo: 'Khách trả tủ', lines: [{ maHang: 'TU-DKCS-2N', soLuongCT: 1, dongGoc: 1, serials: [t2] }] } });

const OWNER = api.st.email;   // chủ hệ thống do máy giả lập đặt (không ghi email thật trong test mới)
async function page(b, vp, email = OWNER) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block', hasTouch: vp.width < 900 });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('JS lỗi: ' + e.message); fails.push('JS lỗi: ' + e.message); });
  p.on('dialog', dg => dg.accept());
  await p.addInitScript(() => { window.print = () => { window.__printHTML = (document.getElementById('printArea') || {}).innerHTML; }; });
  await p.route('https://script.google.com/**', async rt => rt.fulfill({ contentType: 'application/json', body: api.doPost({ postData: { contents: rt.request().postData() } }).t }));
  await p.route('https://accounts.google.com/**', async rt => { const u = new URL(rt.request().url()); api.st.email = email; api.st.nonce = u.searchParams.get('nonce'); await rt.fulfill({ status: 302, headers: { location: BASE + '#id_token=' + jwt(api.st.nonce) + '&state=LAVIPCO' } }); });
  await p.goto(BASE); await p.waitForSelector('#loginBtn'); await p.click('#loginBtn');
  await p.waitForFunction(() => window.QLHH_DEBUG && window.QLHH_DEBUG.data, null, { timeout: 10000 });
  return p;
}
const closed = p => p.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 8000 }).then(() => true).catch(() => false);
const toast = p => p.$$eval('.toast', ts => ts.map(t => t.textContent).join(' | '));
const dlgT = p => p.textContent('#dlg');
const settle = p => p.waitForTimeout(350);
const noOverflow = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && (!document.querySelector('#dlg').open || document.querySelector('#dlg').scrollWidth <= innerWidth + 1));
const pick = async (p, loai) => { await p.goto(BASE + '#/phieu'); await settle(p); await p.click('#newV, #newVM >> visible=true'); await p.click(`[data-t="${loai}"]`); await p.waitForSelector('#vLines'); };
const openV = async (p, so) => { await p.goto(BASE + '#/phieu'); await settle(p); await p.click(`[data-so="${so}"] >> visible=true`); await p.waitForFunction(s => document.querySelector('#dlg').open && document.querySelector('#dlg h2').textContent.includes(s), so); };
const reload = async p => { await p.reload(); await p.waitForFunction(() => window.QLHH_DEBUG && window.QLHH_DEBUG.data); };

(async () => {
  const b = await chromium.launch();
  // ================= máy tính — Quản trị =================
  {
    const p = await page(b, { width: 1366, height: 860 });
    // báo cáo kho lỗi
    await p.goto(BASE + '#/kho'); await settle(p); await p.click('#loiR'); await p.waitForSelector('#loiX');
    const lr = await dlgT(p); ok(lr.includes('VPC005') && lr.includes('Đèn LED 100W') && lr.includes('không tính giá vốn'), 'báo cáo kho hàng lỗi: serial + hàng không serial');
    await p.screenshot({ path: SHOTS + '/d3-kho-loi.png' });
    // gửi NCC từ báo cáo kho lỗi
    await p.click('[data-lt="GUI_NCC"][data-m="LOGO"]'); await p.waitForSelector('#vLines');
    await p.selectOption('#f_maNCC', 'NCC1'); await p.fill('#l_sl_0', '1'); await p.check('#l_sp_0 input[data-s="VPC005"]'); await p.fill('#f_lyDo', 'Gửi hãng bảo hành');
    await p.click('#dlgOk'); ok(await closed(p), 'lập phiếu Gửi NCC từ kho lỗi'); const gn = (await toast(p)).match(/GN-\d{4}-\d{5}/); ok(!!gn, 'số phiếu GN-…');
    ok(ser('VPC005').trangThai === 'GUI_NCC', 'serial chuyển "đang gửi NCC"');
    // nhận NCC trả về: NCC đổi serial mới, về kho thường theo đơn giá đánh giá
    await openV(p, gn[0]); await p.click('#vNN'); await p.waitForSelector('[data-nd="0"]');
    await p.fill('[data-nd="0"][data-g="VPC005"]', 'VPC777'); await p.fill('#l_gia_0', '3000000');
    ok(await p.inputValue('#l_sl_0') === '1', 'gõ serial mới → số lượng tự = 1');
    await p.click('#dlgOk'); ok(await closed(p), 'lưu phiếu Nhận hàng NCC trả về');
    ok(ser('VPC777').trangThai === 'TRONG_KHO' && ser('VPC005').trangThai === 'DA_TRA_NCC', 'serial mới vào kho, serial gửi → đã trả NCC');
    // nhập khác: lý do bắt buộc
    await pick(p, 'NHAP_KHAC'); await p.fill('#l_ma_0', 'CT'); await p.dispatchEvent('#l_ma_0', 'change'); await settle(p);
    await p.fill('#l_sl_0', '2'); await p.fill('#l_gia_0', '150000'); await p.click('#dlgOk'); await settle(p);
    ok(/lý do/i.test(await p.textContent('#e_lyDo')), 'nhập khác thiếu lý do → báo lỗi tại ô');
    await p.fill('#f_lyDo', 'Thừa khi kiểm hàng về'); await p.click('#dlgOk'); ok(await closed(p), 'lưu phiếu Nhập khác');
    // xuất huỷ
    await pick(p, 'XUAT_HUY'); await p.fill('#l_ma_0', 'CT'); await p.dispatchEvent('#l_ma_0', 'change'); await settle(p);
    await p.fill('#l_sl_0', '1'); await p.fill('#f_lyDo', 'BB huỷ 01 — vỡ'); await p.click('#dlgOk'); ok(await closed(p), 'lưu phiếu Xuất huỷ');
    // chuyển hàng đã sửa về kho thường (CT ở kho lỗi)
    await pick(p, 'CHUYEN_SUA'); await p.fill('#l_ma_0', 'CT'); await p.dispatchEvent('#l_ma_0', 'change'); await settle(p);
    await p.fill('#l_sl_0', '1'); await p.fill('#l_gia_0', '0'); await p.fill('#f_lyDo', 'Thay lò xo, thử đạt'); await p.click('#dlgOk'); ok(await closed(p), 'lưu phiếu Chuyển hàng đã sửa về kho thường');
    // trả khách hàng đã sửa từ phiếu nhận lỗi của khách
    await openV(p, hlKH); await p.click('#vTS'); await p.waitForSelector('#l_sl_0'); await p.fill('#l_sl_0', '2');
    ok(await p.inputValue('#f_maKH') === 'TN', 'trả khách: khách điền theo phiếu nhận lỗi');
    await p.click('#dlgOk'); ok(await closed(p), 'lưu phiếu Trả khách hàng đã sửa');
    // N-X-T theo loại phiếu
    await p.goto(BASE + '#/baocao'); await settle(p); await p.fill('#f_rfrom', '2026-11-01'); await p.click('#rRun'); await p.waitForSelector('#rOut table');
    const nx = await p.textContent('#rOut'); ok(nx.includes('Nhập khác GT') && nx.includes('Xuất huỷ GT') && nx.includes('Hàng sửa / NCC trả về GT'), 'N-X-T có cột Nhập khác / Hàng sửa về / Xuất huỷ');
    // tủ khách trả → hồ sơ báo cần KCS lại + lịch sử
    await p.goto(BASE + '#/t/LAVIPCO/' + encodeURIComponent(t2)); await p.waitForSelector('.tuhead');
    const tv = await dlgT(p); ok(tv.includes('Cần KCS lại') && tv.includes('cần kiểm tra xuất xưởng lại') && tv.includes('Lịch sử giao – trả'), 'tủ khách trả: báo cần KCS lại + lịch sử giao – trả');
    ok(!!(await p.$('#tK')), 'tủ khách trả: có nút Kiểm tra xuất xưởng');
    await p.screenshot({ path: SHOTS + '/d3-tu-khach-tra.png' });
    await p.click('[data-x]'); await closed(p);
    // "Thay [linh kiện]" từ hồ sơ tủ → serial cũ chọn sẵn → thay → QT huỷ lần thay
    await p.goto(BASE + '#/t/LAVIPCO/' + encodeURIComponent(t1)); await p.waitForSelector('[data-thay]');
    ok((await p.textContent('[data-thay]')).includes('Thay Siemens LOGO!'), 'hồ sơ tủ: nút "Thay Siemens LOGO!" ở danh sách linh kiện');
    await p.click('[data-thay]'); await p.waitForSelector('[data-rc]');
    ok(await p.isChecked('[data-rc][value="VPC001"]'), 'form thay: serial cũ chọn sẵn');
    await p.check('[data-rm][value="VPC003"]'); await p.click('#dlgOk'); await p.waitForSelector('[data-hv]', { timeout: 10000 });
    ok(ser('VPC003').trangThai === 'DA_LAP', 'thay xong: LOGO! mới lắp vào tủ');
    await p.click('[data-hv]'); await p.waitForSelector('#f_lyDo'); await p.fill('#f_lyDo', 'ngắn'); await p.click('#dlgOk'); await settle(p);
    ok(/10 ký tự/.test(await p.textContent('#e_lyDo')), 'huỷ lần thay: lý do < 10 ký tự bị chặn');
    await p.fill('#f_lyDo', 'Ghi nhầm linh kiện thay'); await p.click('#dlgOk'); await p.waitForFunction(() => document.querySelector('#dlg').textContent.includes('Lần thay đã huỷ'), null, { timeout: 10000 }).catch(() => {});
    ok((await dlgT(p)).includes('Lần thay đã huỷ'), 'phiếu BH hiện "Lần thay đã huỷ"');
    ok(ser('VPC003').trangThai === 'TRONG_KHO' && ser('VPC001').trangThai === 'DA_LAP', 'huỷ lần thay: LOGO! mới về kho, LOGO! cũ lắp lại');
    await p.click('[data-x]'); await closed(p);
    ok(await noOverflow(p), 'máy tính: không tràn ngang');
    await p.close();
  }
  // ngoài bảo hành cho phần điện thoại
  const pbh2 = W('bh.create', { serial: t1, phieu: { ngay: '2026-11-12', moTaLoi: 'Cháy contactor sau mưa giông' } }).soPBH;
  W('bh.update', { soPBH: pbh2, trangThai: 'DANG_XU_LY', nguyenNhan: 'SET_DANH' });
  // ================= điện thoại — Nhập liệu =================
  {
    const p = await page(b, { width: 390, height: 844 }, 'nv@gmail.com');
    await p.goto(BASE + '#/bh'); await settle(p); await p.click('[data-tab=pbh]'); await settle(p); await p.click(`[data-pbh="${pbh2}"]`); await p.waitForSelector('#pXB');
    ok((await dlgT(p)).includes('Ngoài bảo hành'), 'PBH ngoài BH: gợi ý sửa có thu tiền / xuất bán');
    await p.click('#pXB'); await p.waitForSelector('#vLines');
    ok(await p.inputValue('#f_maKH') === 'TN' && await p.inputValue('#f_maCongTrinh') === 'PDG' && /BH-/.test(await p.inputValue('#f_lyDo')), '"Lập phiếu xuất bán" điền sẵn khách, công trình, lý do');
    await p.click('[data-x]'); await closed(p);
    await p.goto(BASE + '#/bh'); await settle(p); await p.click('[data-tab=pbh]'); await settle(p); await p.click(`[data-pbh="${pbh2}"]`); await p.waitForSelector('#pR');
    await p.click('#pR'); await p.waitForSelector('#f_hinhThuc');
    ok(await p.inputValue('#f_hinhThuc') === 'THU_TIEN', 'Nhập liệu: hình thức mặc định "Sửa có thu tiền"');
    await p.fill('#f_phiSua', '1.500.000'); await p.fill('[data-r="0"][data-f="maHang"]', 'CONT'); await p.dispatchEvent('[data-r="0"][data-f="maHang"]', 'change'); await settle(p);
    await p.fill('[data-r="0"][data-f="soLuong"]', '1'); await p.click('#dlgOk'); await p.waitForSelector('#pU', { timeout: 10000 }); await settle(p);
    const tv = await dlgT(p); ok(/Sửa có thu tiền/.test(tv) && /1\.500\.000/.test(tv), 'sửa có thu tiền: phiếu BH ghi hình thức + phí sửa');
    ok(/XR-\d{4}/.test(await toast(p)), 'phiếu Xuất sửa chữa XR-…');
    ok(!(await p.$('[data-hv]')), 'Nhập liệu không thấy nút huỷ lần thay');
    await p.click('[data-x]'); await closed(p);
    // bảo hành đèn (không serial) từ phiếu xuất
    await openV(p, px); await p.click('#vBH'); await p.waitForSelector('#f_soLuong');
    await p.fill('#f_soLuong', '2'); await p.fill('#f_moTaLoi', 'Đèn chập chờn'); await p.click('#dlgOk'); await p.waitForSelector('#pR', { timeout: 10000 });
    const t3 = await dlgT(p); ok(t3.includes('Đèn LED 100W × 2') && t3.includes('Trong bảo hành') && t3.includes('04/11/2028'), 'PBH đèn: hàng × SL, trong BH, hạn = ngày xuất + 24 tháng − 1');
    ok(t3.includes('Đổi hàng'), 'PBH đèn: nút Đổi hàng');
    await p.click('#pR'); await p.waitForSelector('[data-f="soLuongCu"]'); await p.click('#dlgOk'); await p.waitForSelector('#pU', { timeout: 10000 }); await settle(p);
    ok(/XB-\d{4}/.test(await toast(p)) && /HL-\d{4}/.test(await toast(p)), 'đổi đèn: xuất bảo hành + thu hồi về kho lỗi');
    await p.click('[data-x]'); await closed(p);
    // nhập liệu không thấy giá trị của phiếu nhập khác
    await p.goto(BASE + '#/phieu'); await settle(p); await p.click('[data-pg="nhap"]'); await settle(p);
    const nk = await p.$$eval('[data-so]', xs => xs.map(x => x.dataset.so).filter(s => s.startsWith('NK-'))); await openV(p, nk[0]);
    ok((await dlgT(p)).includes('chỉ Quản trị xem') && !/150\.000/.test(await dlgT(p)), 'Nhập liệu: phiếu nhập khác không lộ đơn giá');
    ok(await noOverflow(p), 'điện thoại: hộp phiếu không tràn ngang');
    await p.click('[data-x]'); await closed(p);
    await p.goto(BASE + '#/t/LAVIPCO/' + encodeURIComponent(t2)); await p.waitForSelector('.tuhead');
    ok((await dlgT(p)).includes('Cần KCS lại') && await noOverflow(p), 'điện thoại: hồ sơ tủ khách trả không tràn');
    await p.screenshot({ path: SHOTS + '/d3-phone-tu.png' });
    await p.close();
  }
  await b.close(); srv.close();
  console.log(fails.length ? '\nCÓ ' + fails.length + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
