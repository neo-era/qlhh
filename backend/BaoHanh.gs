/** QLHH — lắp đặt & bảo hành (BH-1): bàn giao / di dời tủ (vị trí, GPS), hạn bảo hành theo ngày bàn giao, phiếu bảo hành, thay linh kiện serial.
 *  Lõi: core/bh.js (QBH). Ghép sau SanXuat.gs bởi build.sh. Mọi dòng ghi chính có requestId để gửi lại không ghi trùng.
 *  Chu kỳ bảo hành = 1 lần giao (khoá theo SỐ PHIẾU xuất hiện hành của tủ: khách trả rồi bán lại → chu kỳ mới). */

/** Xê-ri cần tra → dòng Serial, hồ sơ tủ (nếu là tủ), mã hàng. Ưu tiên xê-ri có hồ sơ tủ; trùng số giữa các hãng thì bắt chọn khoá. */
function bhResolve(q, key) {
  q = QSerial.norm(q); if (!q && !key) throw fail('VALIDATION', 'Nhập số xê-ri', { serial: 'Bắt buộc' });
  var heads = cabHeads(), srs = readTable('Serial').rows, sk = mapBy(srs, 'key'), hs = readTable('HoSoTu').rows.filter(function (c) { return (key ? c.key === key : c.serial === q) && cabOK(c, heads); })[0], sr;
  if (hs) sr = sk[hs.key];
  else if (key) sr = sk[String(key)];
  else { var m = srs.filter(function (r) { return r.serial === q; }); if (m.length > 1) throw fail('VALIDATION', 'Số serial ' + q + ' trùng ở nhiều hãng: ' + m.map(function (r) { return r.hang || '(không hãng)'; }).join(', ') + ' — mở từ hồ sơ để chọn đúng', { serial: 'Trùng' }); sr = m[0]; }
  if (!sr) throw fail('VALIDATION', 'Không có xê-ri ' + (q || key), { serial: 'Xê-ri không có' });
  return { q: sr.serial, sr: sr, hs: hs, sk: sk, it: mapBy(readTable('HangHoa').rows, 'maHang')[sr.maHang] || {} };
}
/** Lần xuất khỏi kho hiện hành {ngay, soPhieu}: phiếu xuất (bán / công trình / BH) còn hiệu lực đã đưa serial sang DA_BAN gần nhất.
 *  Bỏ qua phiếu đảo (đảo phiếu khách trả → chu kỳ của lần bán gốc tiếp tục) và phiếu trả khách hàng đã sửa (hàng của khách, bảo hành theo lần bán gốc). */
function bhXuatCalc(key) {
  var ph = mapBy(readTable('Phieu').rows.filter(function (h) { return h.trangThai === 'HOAN_TAT' && !h.daDao; }), 'soPhieu'), best = { ngay: '', soPhieu: '' };
  readTable('LichSuSerial').rows.forEach(function (h) { var p = h.key === key && h.to === 'DA_BAN' && ph[h.soPhieu]; if (p && p.loai !== 'TRA_KHACH_SUA' && p.loai !== 'DAO' && (p.ngay > best.ngay || (p.ngay === best.ngay && Number(p.stt) > Number(best.stt || 0)))) best = { ngay: p.ngay, soPhieu: p.soPhieu, stt: p.stt }; });
  return { ngay: best.ngay, soPhieu: best.soPhieu };
}
function bhXuat(key, sr) {
  if (!sr || sr.trangThai !== 'DA_BAN') return { ngay: '', soPhieu: '' };
  var c = readTable('HoSoTu').rows.filter(function (x) { return x.key === key && x.trangThai !== 'HUY' && x.phieuXuat; })[0];
  return c ? { ngay: c.ngayXuat, soPhieu: c.phieuXuat } : bhXuatCalc(key);
}
/** Ghi lần xuất hiện hành lên hồ sơ tủ sau mỗi phiếu/phiếu đảo có serial tủ (đọc nhanh cho danh sách & sync). */
function cabExitSync(keys) {
  var want = {}; keys.forEach(function (k) { want[k] = 1; });
  var cabs = readTable('HoSoTu').rows.filter(function (c) { return want[c.key] && c.trangThai !== 'HUY'; }); if (!cabs.length) return;
  var sk = mapBy(readTable('Serial').rows, 'key'), ch = [];
  cabs.forEach(function (c) { var s = sk[c.key], x = s && s.trangThai === 'DA_BAN' ? bhXuatCalc(c.key) : { ngay: '', soPhieu: '' };
    if (String(c.ngayXuat || '') !== x.ngay || String(c.phieuXuat || '') !== x.soPhieu) { c.ngayXuat = x.ngay; c.phieuXuat = x.soPhieu; ch.push(c); } });
  putMany('HoSoTu', ch);
}
/** Số tháng BH mặc định: mẫu tủ → mã hàng → 12. */
function bhThang(sr, hs, it) {
  if (hs) { var t = template(hs.maMau, hs.phienBan); if (t && t.thangBH !== '' && t.thangBH !== undefined) return Number(t.thangBH); }
  return it && it.thangBH !== '' && it.thangBH !== undefined && it.thangBH !== null ? Number(it.thangBH) : 12;
}
/** Lịch sử lắp đặt của chu kỳ giao x = {ngay, soPhieu} (bỏ dòng đã huỷ). */
function bhHist(key, x) {
  return readTable('LapDat').rows.filter(function (r) { return r.key === key && !r.lyDoHuy && (!x || (r.phieuXuat ? r.phieuXuat === x.soPhieu : (!r.ngayXuat || r.ngayXuat === x.ngay))); }).map(strip);
}
function bhInfo(key, sr, hs, it) {
  var x = bhXuat(key, sr), live = !!x.soPhieu, hist = live ? bhHist(key, x) : [], cur = QBH.current(hist, bhThang(sr, hs, it));
  var o = cur ? { ngayBanGiao: cur.ngayBanGiao, hanBH: cur.hanBH, thangBH: cur.thangBH, viTri: cur.viTri } : { thangBH: bhThang(sr, hs, it) };
  o.ngayXuat = x.ngay; o.phieuXuat = x.soPhieu; o.tinhTrang = QBH.status(cur ? cur : { ngayXuat: x.ngay }, today()); o.lapDat = hist;
  return o;
}
/** Tủ chứa linh kiện (nếu xê-ri là linh kiện đã lắp) → dùng tủ làm gốc bảo hành. */
function bhBase(r) {
  if (r.hs) return { key: r.hs.key, sr: r.sr, hs: r.hs, it: r.it, serialTu: r.hs.serial };
  if (r.sr.serialCha && r.sk[r.sr.serialCha]) {
    var cs = r.sk[r.sr.serialCha], heads = cabHeads(), ch = readTable('HoSoTu').rows.filter(function (c) { return c.key === cs.key && cabOK(c, heads); })[0];
    return { key: cs.key, sr: cs, hs: ch, it: mapBy(readTable('HangHoa').rows, 'maHang')[cs.maHang] || {}, serialTu: cs.serial };
  }
  return { key: r.sr.key, sr: r.sr, hs: null, it: r.it, serialTu: '' };
}

function installAdd(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var pv = prevRow('LapDat', req)[0];
  if (pv) { var c0 = QBH.current(bhHist(pv.key, { ngay: pv.ngayXuat, soPhieu: pv.phieuXuat }), 12); return sxMark(u, req, { id: pv.id, ngayBanGiao: c0 && c0.ngayBanGiao, hanBH: c0 && c0.hanBH, lapLai: true }); }
  var r = bhResolve(req.serial, req.key), b = bhBase(r);
  if (b.sr.key !== r.sr.key) throw fail('VALIDATION', 'Xê-ri ' + r.q + ' là linh kiện trong tủ ' + b.serialTu + ' — ghi lắp đặt cho tủ', { serial: 'Chọn xê-ri tủ' });
  if (r.sr.trangThai !== 'DA_BAN') throw fail('VALIDATION', 'Xê-ri ' + r.q + ' chưa xuất khỏi kho (đang ' + r.sr.trangThai + (r.sr.kho ? ' tại ' + r.sr.kho : '') + ') — lập phiếu xuất bán / công trình trước', { serial: 'Chưa xuất kho' });
  var x = bhXuat(r.sr.key, r.sr), v = need(QBH.validateInstall(req.lapDat, { ngayXuat: x.ngay, today: today() }));
  var hist = bhHist(r.sr.key, x), bg = hist.filter(function (z) { return z.loai === 'BAN_GIAO'; })[0];
  if (v.loai === 'BAN_GIAO' && bg) throw fail('VALIDATION', 'Tủ đã bàn giao ngày ' + bg.ngay + ' — chuyển vị trí thì chọn "Di dời"; ghi nhầm thì Quản trị huỷ dòng bàn giao', { loai: 'Chọn Di dời' });
  if (v.loai === 'DI_DOI' && !bg) throw fail('VALIDATION', 'Chưa có lần bàn giao — chọn "Bàn giao" trước', { loai: 'Chọn Bàn giao' });
  var last = hist.reduce(function (m, z) { return z.ngay > m ? z.ngay : m; }, '');
  if (v.loai === 'DI_DOI' && v.ngay < last) throw fail('VALIDATION', 'Ngày di dời không trước lần ghi cuối (' + last + ')', { ngay: 'Từ ' + last });
  if (v.maKH && !readTable('KhachHang').rows.some(function (z) { return z.maKH === v.maKH; })) throw fail('VALIDATION', 'Khách hàng ' + v.maKH + ' chưa có', { maKH: 'Chọn khách có sẵn' });
  if (v.maCongTrinh && !readTable('CongTrinh').rows.some(function (z) { return z.maCongTrinh === v.maCongTrinh; })) throw fail('VALIDATION', 'Công trình ' + v.maCongTrinh + ' chưa có', { maCongTrinh: 'Chọn công trình có sẵn' });
  var cur0 = hist.slice().sort(function (a, b) { return a.thoiGian < b.thoiGian ? -1 : 1; }).pop();
  if (v.loai === 'BAN_GIAO' || !cur0 || cur0.maKH !== v.maKH || cur0.maCongTrinh !== v.maCongTrinh) custProj(v.maKH, v.maCongTrinh);   // di dời giữ nguyên khách/công trình cũ thì không chặn
  var id = 'LD' + pad(nextId('LAPDAT'), 6);
  appendBlock('LapDat', [{ id: id, serial: r.sr.serial, key: r.sr.key, maHang: r.sr.maHang, loai: v.loai, ngay: v.ngay, maKH: v.maKH, maCongTrinh: v.maCongTrinh, diaChi: v.diaChi, tenTaiCT: v.tenTaiCT,
    viDo: v.viDo, kinhDo: v.kinhDo, thangBH: v.loai === 'BAN_GIAO' && v.thangBH !== '' ? String(v.thangBH) : '', soBBBG: v.soBBBG, ghiChu: v.ghiChu, nguoiGhi: u.email, thoiGian: nowIso(), requestId: String(req.requestId),
    ngayXuat: x.ngay, phieuXuat: x.soPhieu, lyDoHuy: '' }]);
  var cur = QBH.current(bhHist(r.sr.key, x), bhThang(r.sr, r.hs, r.it));
  logs.push({ action: 'install.add', doiTuong: 'LapDat', id: id, truoc: null, sau: { serial: r.sr.serial, loai: v.loai, ngay: v.ngay, diaChi: v.diaChi, hanBH: cur.hanBH } });
  return sxMark(u, req, { id: id, ngayBanGiao: cur.ngayBanGiao, hanBH: cur.hanBH });
}
/** Huỷ 1 dòng lắp đặt ghi nhầm (QT, bắt buộc lý do) → ghi lại bàn giao đúng; phiếu BH đã lập giữ nguyên số liệu lúc lập. */
function installVoid(u, req, logs) {
  var lyDo = txt(req.lyDo, 300); if (!lyDo) throw fail('VALIDATION', 'Nhập lý do huỷ', { lyDo: 'Bắt buộc' });
  var l = readTable('LapDat').rows.filter(function (z) { return z.id === txt(req.id, 20); })[0];
  if (!l || l.lyDoHuy) throw fail('VALIDATION', 'Không có dòng lắp đặt ' + req.id, null);
  if (l.loai === 'BAN_GIAO' && readTable('LapDat').rows.some(function (z) { return z.key === l.key && !z.lyDoHuy && z.loai === 'DI_DOI' && z.phieuXuat === l.phieuXuat; }))
    throw fail('VALIDATION', 'Huỷ các lần di dời sau đó trước', null);
  var x = strip(l); x.lyDoHuy = lyDo; putRow('LapDat', x, l._row);
  logs.push({ action: 'install.void', doiTuong: 'LapDat', id: l.id, truoc: { loai: l.loai, ngay: l.ngay, diaChi: l.diaChi }, sau: { lyDoHuy: lyDo } });
  return { id: l.id };
}

function bhCreate(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var pv = prevRow('PhieuBaoHanh', req)[0]; if (pv) return sxMark(u, req, { soPBH: pv.soPBH, serialTu: pv.serialTu, tinhTrangBH: pv.tinhTrangBH, hanBH: pv.hanBH, lapLai: true });
  if (req.hangLe) return bhCreateLe(u, req, logs);
  var r = bhResolve(req.serial, req.key), b = bhBase(r);
  if (b.sr.trangThai !== 'DA_BAN') throw fail('VALIDATION', (b.serialTu ? 'Tủ ' + b.serialTu : 'Xê-ri ' + r.q) + ' chưa giao cho khách (đang ' + b.sr.trangThai + ') — không lập phiếu bảo hành', { serial: 'Chưa xuất kho' });
  var x = bhXuat(b.key, b.sr), v = need(QBH.validateTicket(req.phieu, { today: today() }));
  if (x.ngay && v.ngay < x.ngay) throw fail('VALIDATION', 'Ngày tiếp nhận không trước ngày xuất giao tủ (' + x.ngay + ')', { ngay: 'Từ ' + x.ngay });
  var cur = QBH.current(bhHist(b.key, x), bhThang(b.sr, b.hs, b.it));
  var tt = !cur ? 'CHUA_BAN_GIAO' : !cur.hanBH ? 'KHONG_BH' : v.ngay <= cur.hanBH ? 'TRONG_BH' : 'HET_BH';
  var yr = v.ngay.slice(0, 4), so = 'BH-' + yr + '-' + pad(nextId('PBH:' + yr), 5);
  appendBlock('PhieuBaoHanh', [{ soPBH: so, serial: r.q, key: r.sr.key, maHang: r.sr.maHang, serialTu: b.serialTu, ngay: v.ngay, nguoiBao: v.nguoiBao, moTaLoi: v.moTaLoi, tinhTrangBH: tt, hanBH: cur ? cur.hanBH : '',
    trangThai: 'TIEP_NHAN', nguyenNhan: '', ketQua: '', ngayDong: '', thayThe: '[]', soPhieuXuat: '', soPhieuLoi: '', nguoiTiepNhan: u.email, nguoiXuLy: '', thoiGian: nowIso(), ghiChu: v.ghiChu, requestId: String(req.requestId), thienChi: '' }]);
  logs.push({ action: 'bh.create', doiTuong: 'PhieuBaoHanh', id: so, truoc: null, sau: { serial: r.q, serialTu: b.serialTu, tinhTrangBH: tt } });
  return sxMark(u, req, { soPBH: so, serialTu: b.serialTu, tinhTrangBH: tt, hanBH: cur ? cur.hanBH : '' });
}
/** Bảo hành hàng KHÔNG serial (đèn…): theo phiếu xuất + mã + số lượng; hạn = ngày xuất + tháng BH của mã hàng (trống → 12) − 1 ngày. */
function bhCreateLe(u, req, logs) {
  var x = req.hangLe || {}, so = up(x.phieuXuat), ma = up(x.maHang), q = Number(x.soLuong), g = loadVoucher(so);
  if (!g || g.trangThai !== 'HOAN_TAT' || g.daDao || ['XUAT_BAN', 'XUAT_CONG_TRINH', 'XUAT_BH'].indexOf(g.loai) < 0) throw fail('VALIDATION', 'Không có phiếu xuất ' + so + ' còn hiệu lực (xuất bán / công trình / bảo hành)', { phieuXuat: 'Chọn phiếu xuất' });
  var it = mapBy(readTable('HangHoa').rows, 'maHang')[ma];
  if (!it) throw fail('VALIDATION', 'Không có mã hàng ' + ma, { maHang: 'Chọn mã' });
  if (it.quanLySerial) throw fail('VALIDATION', 'Mã ' + ma + ' quản lý serial — tiếp nhận bảo hành theo số serial', { maHang: 'Tra serial' });
  var sl = g.lines.reduce(function (a, l) { return l.maHang === ma ? a + (Number(l.soLuong) || 0) : a; }, 0);
  if (!sl) throw fail('VALIDATION', 'Phiếu ' + so + ' không có mã ' + ma, { maHang: 'Không có trong phiếu' });
  var kt = mapBy(readTable('Phieu').rows.filter(function (h) { return h.loai === 'KHACH_TRA' && h.phieuGoc === so && h.trangThai === 'HOAN_TAT' && !h.daDao; }), 'soPhieu');
  readTable('ChiTietPhieu').rows.forEach(function (l) { if (kt[l.soPhieu] && l.maHang === ma) sl -= Number(l.soLuong) || 0; });
  sl = Math.round(sl * 1000) / 1000;
  if (!(q > 0) || q > sl) throw fail('VALIDATION', 'Số lượng bảo hành từ 1 đến ' + sl + ' (số đã xuất còn ở phía khách)', { soLuong: 'Tối đa ' + sl });
  var v = need(QBH.validateTicket(req.phieu, { today: today() }));
  if (v.ngay < g.ngay) throw fail('VALIDATION', 'Ngày tiếp nhận không trước ngày xuất (' + g.ngay + ')', { ngay: 'Từ ' + g.ngay });
  var thang = it.thangBH !== '' && it.thangBH !== undefined && it.thangBH !== null ? Number(it.thangBH) : 12, han = thang > 0 ? QBH.hanBH(g.ngay, thang) : '';
  var tt = !han ? 'KHONG_BH' : v.ngay <= han ? 'TRONG_BH' : 'HET_BH';
  var yr = v.ngay.slice(0, 4), sp = 'BH-' + yr + '-' + pad(nextId('PBH:' + yr), 5);
  appendBlock('PhieuBaoHanh', [{ soPBH: sp, serial: '', key: '', maHang: ma, serialTu: '', ngay: v.ngay, nguoiBao: v.nguoiBao, moTaLoi: v.moTaLoi, tinhTrangBH: tt, hanBH: han, trangThai: 'TIEP_NHAN', nguyenNhan: '', ketQua: '', ngayDong: '',
    thayThe: '[]', soPhieuXuat: '', soPhieuLoi: '', nguoiTiepNhan: u.email, nguoiXuLy: '', thoiGian: nowIso(), ghiChu: v.ghiChu, requestId: String(req.requestId), thienChi: '', soLuong: q, phieuGoc: so, maKH: g.maKH, phiSua: '', hinhThuc: '', huyThay: '' }]);
  logs.push({ action: 'bh.create', doiTuong: 'PhieuBaoHanh', id: sp, truoc: null, sau: { maHang: ma, soLuong: q, phieuXuat: so, tinhTrangBH: tt } });
  return sxMark(u, req, { soPBH: sp, serialTu: '', tinhTrangBH: tt, hanBH: han });
}
/** Lệnh cùng requestId đã ghi nhật ký (đã chạy xong phần ghi). */
function prevLog(req) { var id = String(req.requestId); return readTail('NhatKy', 300).rows.some(function (l) { return l.requestId === id; }); }
function bhTicket(so) {
  var t = readTable('PhieuBaoHanh').rows.filter(function (x) { return x.soPBH === String(so || '').trim().toUpperCase(); })[0];
  if (!t) throw fail('VALIDATION', 'Không có phiếu bảo hành ' + so, null); return t;
}
function bhUpdate(u, req, logs) {
  var t = bhTicket(req.soPBH), phi = req.phiSua === undefined || req.phiSua === null || req.phiSua === '' ? null : Number(req.phiSua);
  if (phi !== null && !(Number.isInteger(phi) && phi >= 0 && phi <= 1e12)) throw fail('VALIDATION', 'Phí sửa chữa là số nguyên VND ≥ 0', { phiSua: 'Số nguyên ≥ 0' });
  if (t.trangThai === up(req.trangThai) && String(t.nguoiXuLy).toLowerCase() === u.email && (!req.ketQua || txt(req.ketQua, 1000) === t.ketQua) && (!req.nguyenNhan || up(req.nguyenNhan) === t.nguyenNhan) && (phi === null || phi === Number(t.phiSua))) return { soPBH: t.soPBH, trangThai: t.trangThai, lapLai: true };   // gửi lại sau khi đã ghi
  var v = need(QBH.validateUpdate({ trangThai: req.trangThai, ketQua: req.ketQua, nguyenNhan: req.nguyenNhan || t.nguyenNhan }, t.trangThai)), x = strip(t);
  if (v.trangThai === 'TU_CHOI' && t.soPhieuXuat) throw fail('VALIDATION', 'Phiếu đã xuất linh kiện (' + t.soPhieuXuat + ') — không từ chối được; đóng Hoàn thành và ghi nguyên nhân', { trangThai: 'Đã thay linh kiện' });
  x.trangThai = v.trangThai; if (v.nguyenNhan) x.nguyenNhan = v.nguyenNhan; if (v.ketQua) x.ketQua = v.ketQua; x.nguoiXuLy = u.email;
  if (phi !== null) { x.phiSua = phi; if (phi > 0 && !x.hinhThuc) x.hinhThuc = 'THU_TIEN'; }   // sửa có thu tiền (kể cả chỉ công sửa): căn cứ xuất hoá đơn dịch vụ
  if (v.trangThai === 'HOAN_THANH' || v.trangThai === 'TU_CHOI') x.ngayDong = today();
  putRow('PhieuBaoHanh', x, t._row);
  logs.push({ action: 'bh.update', doiTuong: 'PhieuBaoHanh', id: t.soPBH, truoc: { trangThai: t.trangThai }, sau: { trangThai: v.trangThai, nguyenNhan: v.nguyenNhan, ketQua: v.ketQua, phiSua: phi === null ? undefined : phi } });
  return { soPBH: t.soPBH, trangThai: v.trangThai };
}

/** Thay linh kiện / đổi hàng khi bảo hành. 3 dạng phiếu BH: tủ (serialTu) · hàng có serial bán rời (key, không tủ) · hàng không serial (maHang + soLuong).
 *  Hình thức: BAO_HANH (còn hạn, nguyên nhân không loại trừ) → phiếu Xuất bảo hành (giá vốn BQ = chi phí BH);
 *  ngoài bảo hành: THIEN_CHI (Quản trị duyệt, ghi lý do) → Xuất bảo hành; THU_TIEN (sửa có thu tiền) → phiếu Xuất sửa chữa (giá vốn 632) + phí sửa thu khách (phiSua).
 *  Hàng cũ thu hồi → phiếu Nhận hàng lỗi về kho lỗi (giá 0). Thứ tự ghi: XB/XR → HL → serial/hồ sơ tủ → phiếu BH (cuối = dấu hoàn tất). Gửi lại cùng requestId thì LÀM TIẾP phần còn thiếu. */
function bhReplace(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  cleanupOrphans(logs);
  var t = bhTicket(req.soPBH), thu = up(req.hinhThuc) === 'THU_TIEN';
  var px = prevHeads(req, 'XUAT_BH')[0] || prevHeads(req, 'XUAT_SUA')[0], pl = prevHeads(req, 'NHAP_HANG_LOI')[0];
  if (px) thu = px.loai === 'XUAT_SUA';
  if ((px && px.daDao) || (pl && pl.daDao)) throw fail('VALIDATION', 'Phiếu của lần thay trước (' + (px && px.daDao ? px.soPhieu : pl.soPhieu) + ') đã bị đảo — lập lần thay mới', null);
  if (px && String(t.soPhieuXuat).indexOf(px.soPhieu) >= 0) return sxMark(u, req, { soPhieuXuat: px.soPhieu, soPhieuLoi: pl ? pl.soPhieu : '', lapLai: true });
  if (!px && ['TIEP_NHAN', 'DANG_XU_LY'].indexOf(t.trangThai) < 0) throw fail('VALIDATION', 'Phiếu ' + t.soPBH + ' đã đóng', null);
  var sk = mapBy(readTable('Serial').rows, 'key'), cab = null, sale = null;
  if (t.serialTu) {
    var heads = cabHeads(); cab = readTable('HoSoTu').rows.filter(function (c) { return c.serial === t.serialTu && cabOK(c, heads); })[0];
    if (!cab) throw fail('VALIDATION', 'Không có hồ sơ tủ ' + t.serialTu, null);
    if (!px && (!sk[cab.key] || sk[cab.key].trangThai !== 'DA_BAN')) throw fail('VALIDATION', 'Tủ ' + cab.serial + ' không còn ở phía khách (đang ' + (sk[cab.key] ? sk[cab.key].trangThai : '?') + ')', null);
  } else if (t.key) {   // hàng có serial bán rời: thay chính serial đó
    if (!px && (!sk[t.key] || sk[t.key].trangThai !== 'DA_BAN')) throw fail('VALIDATION', 'Serial ' + t.serial + ' không còn ở phía khách', null);
    var bx = bhXuat(t.key, sk[t.key]); sale = bx.soPhieu ? findByKey('Phieu', bx.soPhieu) : null;
  } else if (t.maHang && t.phieuGoc) sale = findByKey('Phieu', t.phieuGoc);   // hàng không serial
  else throw fail('VALIDATION', 'Phiếu bảo hành không gắn tủ / serial / phiếu xuất', null);
  var mien = QBH.mienPhi(t.tinhTrangBH, t.nguyenNhan), tc = txt(req.thienChi, 300);
  if (!px && !mien && !thu && (u.vaiTro !== 'QUAN_TRI' || !tc)) throw fail('VALIDATION', 'Ngoài bảo hành (' + t.tinhTrangBH + (QBH.NGOAI_BH.indexOf(t.nguyenNhan) >= 0 ? ', ' + t.nguyenNhan : '') + ') — chọn "Sửa có thu tiền", lập phiếu xuất bán linh kiện cho khách, hoặc Quản trị duyệt bảo hành thiện chí (ghi lý do)', { thienChi: 'Quản trị duyệt' });
  var phi = req.phiSua === undefined || req.phiSua === null || req.phiSua === '' ? null : Number(req.phiSua);
  if (thu && phi !== null && !(Number.isInteger(phi) && phi >= 0 && phi <= 1e12)) throw fail('VALIDATION', 'Phí sửa chữa là số nguyên VND ≥ 0', { phiSua: 'Số nguyên ≥ 0' });
  var hinh = thu ? 'THU_TIEN' : mien ? 'BAO_HANH' : 'THIEN_CHI', loaiX = thu ? 'XUAT_SUA' : 'XUAT_BH';
  var ngay = chkDate(String(req.ngay || today())); if (ngay < t.ngay) throw fail('VALIDATION', 'Ngày thay không trước ngày tiếp nhận (' + t.ngay + ')', { ngay: 'Từ ' + t.ngay });
  var kh = mapBy(readTable('Kho').rows, 'maKho'), kho = kh[up(req.kho || 'KHO')], loi = readTable('Kho').rows.filter(function (k) { return k.loai === 'HANG_LOI' && k.trangThai === 'HOAT_DONG'; })[0];
  if (!px && (!kho || kho.trangThai !== 'HOAT_DONG' || kho.loai === 'HANG_LOI')) throw fail('VALIDATION', 'Chọn kho thường lấy hàng mới', { kho: 'Kho thường' });
  var items = mapBy(readTable('HangHoa').rows, 'maHang'), con = cab ? parseSerials(cab.serialCon) : [], inCab = {}; con.forEach(function (k) { inCab[k] = 1; });
  if (!Array.isArray(req.lines) || !req.lines.length || req.lines.length > 50) throw fail('VALIDATION', 'Chọn 1–50 dòng thay', { lines: 'Bắt buộc' });
  var outL = [], cuL = [], ghi = [], newKeys = [], oldKeys = [], cuLe = 0;
  req.lines.forEach(function (l, i) {
    var it = items[up(l && l.maHang)], q = Number(l && l.soLuong), sm = ((l && l.serialMoi) || []).map(QSerial.norm).filter(String), sc = ((l && l.serialCu) || []).map(QSerial.norm).filter(String);
    if (!it) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': mã ' + (l && l.maHang) + ' không có', null);
    if (!(q > 0) || q > 1e6) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': số lượng > 0', null);
    if (it.quanLySerial && (!Number.isInteger(q) || sm.length !== q)) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': cần đúng ' + q + ' serial ' + it.maHang + ' mới', null);
    if (cab && it.quanLySerial) {
      var coSan = con.filter(function (k) { return sk[k] && sk[k].maHang === it.maHang; }).length;
      if (!px && coSan && sc.length !== Math.min(q, coSan)) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': tủ đang có ' + coSan + ' serial ' + it.maHang + ' — chọn serial cũ thu hồi tương ứng', { serialCu: 'Bắt buộc' });
      if (sc.length > q) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': số serial cũ nhiều hơn số thay', null);
      sc.forEach(function (z) { var k = QSerial.keyOf(it, z); if (!px && !inCab[k]) throw fail('VALIDATION', 'Serial cũ ' + z + ' không thuộc tủ ' + cab.serial, null); oldKeys.push(k); });
      if (sc.length) cuL.push({ maHang: it.maHang, soLuongCT: sc.length, serials: sc });
    } else if (!cab && t.key) {   // serial bán rời: hàng cũ = chính serial của phiếu BH
      if (it.maHang === t.maHang) { sc = [t.serial]; if (!oldKeys.length) { oldKeys.push(t.key); cuL.push({ maHang: t.maHang, soLuongCT: 1, serials: [t.serial] }); } } else sc = [];
    } else if (!cab) {   // hàng không serial: thu hồi xác (mặc định = số đổi nếu cùng mã)
      var qc = l.soLuongCu === undefined || l.soLuongCu === null || l.soLuongCu === '' ? (it.maHang === t.maHang ? q : 0) : Number(l.soLuongCu);
      if (!(qc >= 0) || qc > q) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': số thu hồi từ 0 đến ' + q, { soLuongCu: '0–' + q });
      cuLe += qc; sc = [];
    }
    sm.forEach(function (z) { newKeys.push(QSerial.keyOf(it, z)); });
    outL.push({ maHang: it.maHang, soLuongCT: q, serials: it.quanLySerial ? sm : undefined });
    ghi.push({ maHang: it.maHang, soLuong: q, serialMoi: sm, serialCu: sc, ngay: ngay, hinhThuc: hinh });
  });
  if (cuLe > 0) cuL.push({ maHang: t.maHang, soLuongCT: Math.round(cuLe * 1000) / 1000 });
  var src = {};
  if (cab) { var ld = QBH.current(bhHist(cab.key, bhXuat(cab.key, sk[cab.key])), 12), vt = ld ? ld.viTri : {}, lsx = readTable('LenhSX').rows.filter(function (z) { return z.soLSX === cab.soLSX; })[0] || {}; src = vt.maKH ? vt : lsx; }
  else src = { maKH: t.maKH || (sale && sale.maKH) || '', maCongTrinh: (sale && sale.maCongTrinh) || '' };   // cặp khách–công trình lấy cùng 1 nguồn
  var doiTuong = cab ? 'tủ ' + cab.serial : t.serial ? 'serial ' + t.serial : t.maHang + ' × ' + t.soLuong;
  var ctxL = null;
  if (cuL.length && !pl) {
    if (!loi) throw fail('VALIDATION', 'Chưa có kho hàng lỗi', null);
    ctxL = voucherPrep(u, { requestId: req.requestId, voucher: { loai: 'NHAP_HANG_LOI', ngay: ngay, kho: loi.maKho, lyDo: 'Linh kiện thu hồi khi bảo hành ' + t.soPBH + ' — ' + doiTuong, soCTGoc: t.soPBH, ngayCTGoc: t.ngay, lines: cuL } }, true);
    ctxL.choLapDat = true;
    var sv = QSerial.apply(QSerial.index(readTable('Serial').rows), { loai: 'NHAP_HANG_LOI', kho: loi.maKho, lines: ctxL.lines }, { items: items, choLapDat: true });   // kiểm trước khi ghi phiếu đầu
    if (!sv.ok) throw fail(sv.code, engineMsg(sv), sv.errors);
  }
  var rx = px ? { soPhieu: px.soPhieu, tinhLai: 0 } : commitVoucher(u, req, logs, voucherPrep(u, { requestId: req.requestId, voucher: { loai: loaiX, ngay: ngay, kho: kho.maKho, maKH: src.maKH || '', maCongTrinh: src.maCongTrinh || '',
    lyDo: (thu ? 'Sửa chữa thu tiền ' : 'Bảo hành ') + t.soPBH + ' — ' + doiTuong + (hinh === 'THIEN_CHI' ? ' (thiện chí: ' + tc + ')' : ''), soCTGoc: t.soPBH, ngayCTGoc: t.ngay, lines: outL } }, true));
  var rl = pl ? { soPhieu: pl.soPhieu } : ctxL ? commitVoucher(u, req, logs, ctxL) : null;
  ghi.forEach(function (g) { g.soPhieuXuat = rx.soPhieu; g.soPhieuLoi = rl ? rl.soPhieu : ''; });
  var con2 = con, nc = con;
  if (cab) {   // linh kiện mới: lắp vào tủ (DA_LAP + serialCha); cũ: gỡ khỏi tủ (chỉ khi còn trỏ đúng tủ này)
    var ns = {}; newKeys.forEach(function (k) { ns[k] = 1; });
    putMany('Serial', readTable('Serial').rows.filter(function (z) { return (ns[z.key] && (z.trangThai !== 'DA_LAP' || z.serialCha !== cab.key)) || (oldKeys.indexOf(z.key) >= 0 && z.serialCha === cab.key); })
      .map(function (z) { if (ns[z.key]) { z.trangThai = 'DA_LAP'; z.serialCha = cab.key; z.kho = ''; } else z.serialCha = ''; return z; }));
    var cab2 = readTable('HoSoTu').rows.filter(function (c) { return c.key === cab.key && c.trangThai !== 'HUY'; })[0]; con2 = parseSerials(cab2.serialCon);
    nc = con2.filter(function (k) { return oldKeys.indexOf(k) < 0; }).concat(newKeys.filter(function (k) { return con2.indexOf(k) < 0; })); var cx = strip(cab2); cx.serialCon = JSON.stringify(nc); putRow('HoSoTu', cx, cab2._row);
  }
  var tt = bhTicket(t.soPBH), tx = strip(tt);
  tx.thayThe = JSON.stringify(parseSerials(tt.thayThe).concat(ghi)); tx.soPhieuXuat = [tt.soPhieuXuat, rx.soPhieu].filter(String).join(', ');
  tx.soPhieuLoi = [tt.soPhieuLoi, rl ? rl.soPhieu : ''].filter(String).join(', '); if (tt.trangThai === 'TIEP_NHAN') tx.trangThai = 'DANG_XU_LY'; tx.nguoiXuLy = u.email;
  if (hinh === 'THIEN_CHI' && tc) tx.thienChi = [tt.thienChi, tc].filter(String).join('; ');
  if (thu) { tx.hinhThuc = 'THU_TIEN'; if (phi !== null) tx.phiSua = phi; } else if (!tx.hinhThuc) tx.hinhThuc = hinh;
  putRow('PhieuBaoHanh', tx, tt._row);   // ghi cuối = lần thay hoàn tất
  logs.push({ action: 'bh.replace', doiTuong: 'PhieuBaoHanh', id: t.soPBH, truoc: { serialCon: con2 }, sau: { serialCon: nc, hinhThuc: hinh, soPhieuXuat: rx.soPhieu, soPhieuLoi: rl ? rl.soPhieu : '', thienChi: hinh === 'THIEN_CHI' ? tc : '', phiSua: thu ? phi : undefined } });
  return sxMark(u, req, { soPhieuXuat: rx.soPhieu, soPhieuLoi: rl ? rl.soPhieu : '', tinhLai: rx.tinhLai, hinhThuc: hinh });
}

/** Huỷ 1 lần thay ghi nhầm (QT, lý do ≥ 10 ký tự): đảo phiếu xuất (XB/XR, linh kiện mới về kho, gỡ khỏi tủ) → đảo phiếu thu hồi HL (linh kiện cũ rời kho lỗi, lắp lại tủ)
 *  → gắn lại serialCha / serialCon → phiếu BH ghi cuối (thayThe bớt mục, huyThay thêm mục). Kiểm trước cả 2 phiếu đảo; gửi lại cùng requestId thì làm tiếp. */
function bhReplaceVoid(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  cleanupOrphans(logs);
  var lyDo = txt(req.lyDo, 300); if (lyDo.length < 10) throw fail('VALIDATION', 'Ghi lý do huỷ lần thay (ít nhất 10 ký tự)', { lyDo: 'Ghi rõ lý do' });
  var t = bhTicket(req.soPBH), so = up(req.soPhieuXuat), hv = parseSerials(t.huyThay), done = hv.filter(function (z) { return z.soPhieuXuat === so; })[0];
  if (done && done.requestId === String(req.requestId)) return sxMark(u, req, { soPhieuXuat: so, daoXuat: done.daoXuat, daoLoi: done.daoLoi, lapLai: true });
  if (done) throw fail('VALIDATION', 'Lần thay ' + so + ' đã huỷ ngày ' + done.ngay, null);
  if (String(t.soPhieuXuat).split(/\s*,\s*/).indexOf(so) < 0) throw fail('VALIDATION', 'Phiếu ' + so + ' không phải lần thay của phiếu bảo hành ' + t.soPBH, { soPhieuXuat: 'Chọn lần thay' });
  var gx = loadVoucher(so); if (!gx || gx.trangThai !== 'HOAN_TAT') throw fail('VALIDATION', 'Không có phiếu ' + so, null);
  var hl = readTable('Phieu').rows.filter(function (h) { return h.loai === 'NHAP_HANG_LOI' && h.trangThai === 'HOAN_TAT' && h.requestId === gx.requestId && h.soCTGoc === t.soPBH; })[0], gl = hl ? loadVoucher(hl.soPhieu) : null;   // phiếu thu hồi cùng lệnh thay
  var ngay = chkDate(String(req.ngay || today())), prevD = prevHeads(req, 'DAO');
  var dx = prevD.filter(function (h) { return h.phieuGoc === so; })[0], dl = gl ? prevD.filter(function (h) { return h.phieuGoc === gl.soPhieu; })[0] : null;
  if (!dx && gx.daDao) throw fail('VALIDATION', 'Phiếu ' + so + ' đã bị đảo', null);
  if (gl && !dl && gl.daDao) throw fail('VALIDATION', 'Phiếu thu hồi ' + gl.soPhieu + ' đã bị đảo', null);
  var heads = cabHeads(), cab = t.serialTu ? readTable('HoSoTu').rows.filter(function (c) { return c.serial === t.serialTu && cabOK(c, heads); })[0] : null;
  var sk = mapBy(readTable('Serial').rows, 'key'), items = mapBy(readTable('HangHoa').rows, 'maHang'), alt = {}, newKeys = [];
  gx.lines.forEach(function (l) { (l.serials || []).forEach(function (z) { var k = QSerial.keyOf(items[l.maHang], z); newKeys.push(k);
    if (cab && sk[k] && sk[k].trangThai === 'DA_LAP') { if (sk[k].serialCha !== cab.key) throw fail('VALIDATION', 'Linh kiện mới ' + z + ' không còn trong tủ ' + cab.serial + ' — không huỷ được lần thay', null); alt[k] = 'DA_LAP'; } }); });
  var lyD = 'Huỷ lần thay ' + t.soPBH + ': ' + lyDo;
  if (!dx) reverseCheck(gx, ngay, { alt: alt });   // kiểm trước CẢ HAI phiếu đảo, chưa ghi gì
  if (gl && !dl) reverseCheck(gl, ngay, {});
  var sx = dx ? dx.soPhieu : reverseCore(u, req, logs, gx, ngay, lyD, { alt: alt }).soPhieu;
  var sl = !gl ? '' : dl ? dl.soPhieu : reverseCore(u, req, logs, gl, ngay, lyD, {}).soPhieu;
  var oldKeys = gl ? uniq(readTable('LichSuSerial').rows.filter(function (h) { return h.soPhieu === gl.soPhieu && h.from === 'DA_LAP'; }).map(function (h) { return h.key; })) : [];
  if (cab) {   // linh kiện cũ lắp lại vào tủ; serialCon bỏ linh kiện mới, thêm lại linh kiện cũ
    setParents(oldKeys.map(function (k) { return [k, cab.key]; }));
    var c2 = readTable('HoSoTu').rows.filter(function (c) { return c.key === cab.key && c.trangThai !== 'HUY'; })[0], cn = parseSerials(c2.serialCon);
    var nc = cn.filter(function (k) { return newKeys.indexOf(k) < 0; }).concat(oldKeys.filter(function (k) { return cn.indexOf(k) < 0; }));
    if (JSON.stringify(nc) !== JSON.stringify(cn)) { var cx = strip(c2); cx.serialCon = JSON.stringify(nc); putRow('HoSoTu', cx, c2._row); }
  }
  var tt = bhTicket(t.soPBH), tx = strip(tt), all = parseSerials(tt.thayThe), keep = [], gone = [];
  var outS = {}; gx.lines.forEach(function (l) { (l.serials || []).forEach(function (z) { outS[l.maHang + '|' + z] = 1; }); outS[l.maHang] = 1; });
  all.forEach(function (z) { var mine = z.soPhieuXuat ? z.soPhieuXuat === so : outS[z.maHang] && (z.serialMoi || []).every(function (s) { return outS[z.maHang + '|' + s]; }); (mine ? gone : keep).push(z); });
  tx.thayThe = JSON.stringify(keep);
  tx.huyThay = JSON.stringify(hv.concat([{ soPhieuXuat: so, soPhieuLoi: gl ? gl.soPhieu : '', daoXuat: sx, daoLoi: sl, ngay: ngay, lyDo: lyDo, nguoi: u.email, thoiGian: nowIso(), requestId: String(req.requestId), muc: gone }]));
  tx.soPhieuXuat = String(tt.soPhieuXuat).split(/\s*,\s*/).filter(function (x) { return x && x !== so; }).join(', ');
  tx.soPhieuLoi = String(tt.soPhieuLoi).split(/\s*,\s*/).filter(function (x) { return x && (!gl || x !== gl.soPhieu); }).join(', ');
  putRow('PhieuBaoHanh', tx, tt._row);   // ghi cuối = huỷ xong
  logs.push({ action: 'bh.replaceVoid', doiTuong: 'PhieuBaoHanh', id: t.soPBH, truoc: { soPhieuXuat: so, soPhieuLoi: gl ? gl.soPhieu : '' }, sau: { daoXuat: sx, daoLoi: sl, lyDo: lyDo } });
  return sxMark(u, req, { soPhieuXuat: so, daoXuat: sx, daoLoi: sl });
}

/** Tủ khách trả (phiếu KHACH_TRA có xê-ri tủ): ghi sự kiện vào hồ sơ tủ (bản chụp chu kỳ cũ), bắt KCS lại, gỡ khỏi PXX cũ (PXX ghi "trả lại"), đóng phiếu BH đang mở.
 *  Làm lại được (gửi lại / dọn): sự kiện ghi trước, PXX + phiếu BH làm theo sự kiện. */
function cabReturn(so, h, keys) {
  var want = {}; keys.forEach(function (k) { want[k] = 1; });
  var heads = cabHeads(), cabs = readTable('HoSoTu').rows.filter(function (c) { return want[c.key] && cabOK(c, heads); }); if (!cabs.length) return;
  var lp = livePxx(), pbhs = readTable('PhieuBaoHanh').rows, g = findByKey('Phieu', h.phieuGoc) || {}, ch = [], pxCh = {}, tk = [];
  cabs.forEach(function (c) {
    var ls = parseSerials(c.lichSu), ev = ls.filter(function (e) { return e.loai === 'KHACH_TRA' && e.soPhieu === so; })[0];
    if (!ev) {
      var cur = QBH.current(bhHist(c.key, { ngay: g.ngay, soPhieu: h.phieuGoc }), bhThang(null, c, null)) || {}, vt = cur.viTri || {};
      ev = { loai: 'KHACH_TRA', ngay: h.ngay, soPhieu: so, phieuXuat: h.phieuGoc, ngayXuat: g.ngay || '', maKH: g.maKH || '', maCongTrinh: g.maCongTrinh || '', ngayBanGiao: cur.ngayBanGiao || '', hanBH: cur.hanBH || '', diaChi: vt.diaChi || '',
        soPXX: c.soPXX && lp[c.soPXX] ? c.soPXX : '', kcsDat: !!c.kcsDat, lanKiemCuoi: Number(c.lanKiemCuoi) || 0, thoiGian: nowIso(),
        pbh: pbhs.filter(function (t) { return (t.serialTu === c.serial || t.key === c.key) && (t.trangThai === 'TIEP_NHAN' || t.trangThai === 'DANG_XU_LY'); }).map(function (t) { return { soPBH: t.soPBH, trangThai: t.trangThai, ketQua: t.ketQua }; }) };
      ls.push(ev); c.lichSu = JSON.stringify(ls); c.kcsDat = false; c.soPXX = ''; ch.push(c);
    } else if (!ev.huy && ((ev.soPXX && c.soPXX === ev.soPXX) || ((Number(c.lanKiemCuoi) || 0) === ev.lanKiemCuoi && c.kcsDat))) {   // gửi lại: chưa kiểm lại thì bảo đảm đã bỏ KCS / PXX cũ
      if (c.soPXX === ev.soPXX) c.soPXX = ''; if ((Number(c.lanKiemCuoi) || 0) === ev.lanKiemCuoi) c.kcsDat = false; ch.push(c);
    }
    if (ev.huy) return;
    if (ev.soPXX) (pxCh[ev.soPXX] = pxCh[ev.soPXX] || []).push({ serial: c.serial, soPhieu: so, ngay: h.ngay });
    (ev.pbh || []).forEach(function (x) { var t = pbhs.filter(function (z) { return z.soPBH === x.soPBH; })[0];
      if (t && (t.trangThai === 'TIEP_NHAN' || t.trangThai === 'DANG_XU_LY')) { t.trangThai = 'DONG_KHACH_TRA'; t.ngayDong = h.ngay; t.ketQua = t.ketQua || ('Khách trả tủ — phiếu ' + so); tk.push(t); } });
  });
  putMany('HoSoTu', ch);
  Object.keys(pxCh).forEach(function (sp) {
    var p = readTable('PhieuXuatXuong').rows.filter(function (r) { return r.soPXX === sp; })[0]; if (!p) return;
    var tl = parseSerials(p.traLai), n0 = tl.length; pxCh[sp].forEach(function (z) { if (!tl.some(function (y) { return y.serial === z.serial && y.soPhieu === z.soPhieu; })) tl.push(z); });
    if (tl.length !== n0) { var y = strip(p); y.traLai = JSON.stringify(tl); putRow('PhieuXuatXuong', y, p._row); }
  });
  putMany('PhieuBaoHanh', tk);
}
/** Hoàn tác tủ khách trả (đảo phiếu khách trả / phiếu ghi dở): PXX bỏ dòng trả lại, phiếu BH mở lại, rồi hồ sơ tủ (KCS + PXX cũ nếu chưa kiểm lại / chưa có PXX mới; sự kiện đánh dấu huỷ — ghi cuối). */
function cabReturnUndo(so) {
  var pick = function (c) { return parseSerials(c.lichSu).filter(function (e) { return e.loai === 'KHACH_TRA' && e.soPhieu === so && !e.huy; })[0]; };
  var cabs = readTable('HoSoTu').rows.filter(function (c) { return c.trangThai !== 'HUY' && pick(c); }); if (!cabs.length) return;
  var pxx = readTable('PhieuXuatXuong').rows, pbhs = readTable('PhieuBaoHanh').rows, tk = [];
  cabs.forEach(function (c) { var ev = pick(c);
    var p = ev.soPXX && pxx.filter(function (r) { return r.soPXX === ev.soPXX; })[0];
    if (p) { var tl = parseSerials(p.traLai), t2 = tl.filter(function (z) { return !(z.serial === c.serial && z.soPhieu === so); }); if (t2.length !== tl.length) { var y = strip(p); y.traLai = t2.length ? JSON.stringify(t2) : ''; putRow('PhieuXuatXuong', y, p._row); } }
    (ev.pbh || []).forEach(function (x) { var t = pbhs.filter(function (z) { return z.soPBH === x.soPBH; })[0]; if (t && t.trangThai === 'DONG_KHACH_TRA') { t.trangThai = x.trangThai; t.ngayDong = ''; t.ketQua = x.ketQua || ''; tk.push(t); } });
  });
  putMany('PhieuBaoHanh', tk);
  var lp = livePxx(), ch = [];
  readTable('HoSoTu').rows.filter(function (c) { return c.trangThai !== 'HUY' && pick(c); }).forEach(function (c) {
    var ls = parseSerials(c.lichSu), ev = ls.filter(function (e) { return e.loai === 'KHACH_TRA' && e.soPhieu === so && !e.huy; })[0];
    ev.huy = true; ev.ngayHuy = today();
    if ((Number(c.lanKiemCuoi) || 0) === ev.lanKiemCuoi) c.kcsDat = ev.kcsDat;   // chưa kiểm lại: kết quả KCS cũ còn hiệu lực
    if (ev.soPXX && !c.soPXX && lp[ev.soPXX]) c.soPXX = ev.soPXX;
    c.lichSu = JSON.stringify(ls); ch.push(c);
  });
  putMany('HoSoTu', ch);
}

/** Bổ sung cho serial.get: lịch sử lắp đặt, hạn & tình trạng BH, phiếu bảo hành (theo tủ gốc). */
function bhAugment(out, sr, hs) {
  if (!sr) return;
  var r = { q: sr.serial, sr: sr, hs: hs, sk: mapBy(readTable('Serial').rows, 'key'), it: mapBy(readTable('HangHoa').rows, 'maHang')[sr.maHang] || {} }, b = bhBase(r);
  var info = bhInfo(b.key, b.sr, b.hs, b.it); out.lapDat = info.lapDat; delete info.lapDat; info.serialTu = b.serialTu; out.baoHanh = info;
  out.pbh = readTable('PhieuBaoHanh').rows.filter(function (t) { return t.key === sr.key || (b.serialTu && t.serialTu === b.serialTu); }).map(function (t) { var x = strip(t); delete x.requestId; return x; });
}
/** Báo cáo chi phí bảo hành theo kỳ (QT): giá vốn linh kiện xuất bảo hành (phiếu XB còn hiệu lực, chứng từ gốc = phiếu BH) + số tủ còn hạn BH tại cuối kỳ (cơ sở dự phòng 352). */
function reportBH(u, req) {
  var from = String(req.from || ''), to = String(req.to || '');
  if (!QValidate.isoDate(from) || !QValidate.isoDate(to) || from > to) return { ok: false, code: 'VALIDATION', error: 'Kỳ báo cáo không hợp lệ' };
  var tks = readTable('PhieuBaoHanh').rows, tk = mapBy(tks, 'soPBH'), ph = readTable('Phieu').rows.filter(function (h) { return (h.loai === 'XUAT_BH' || h.loai === 'XUAT_SUA') && h.trangThai === 'HOAN_TAT' && !h.daDao && h.ngay >= from && h.ngay <= to; });
  var rows = ph.map(function (h) { var t = tk[h.soCTGoc] || {}; return { soPhieu: h.soPhieu, ngay: h.ngay, soPBH: h.soCTGoc, loai: h.loai === 'XUAT_SUA' ? 'THU_TIEN' : 'BAO_HANH', serialTu: t.serialTu || '', serial: t.serial || '', maHang: t.serialTu ? '' : t.maHang || '', soLuong: t.soLuong || '',
    tinhTrangBH: t.tinhTrangBH || '', nguyenNhan: t.nguyenNhan || '', thienChi: t.thienChi || '', giaTri: Number(h.tongTien) || 0 }; });
  var con = 0, sk = mapBy(readTable('Serial').rows, 'key'), heads = cabHeads();
  readTable('HoSoTu').rows.forEach(function (c) { if (!cabOK(c, heads) || !sk[c.key] || sk[c.key].trangThai !== 'DA_BAN') return;
    var cur = QBH.current(bhHist(c.key, bhXuat(c.key, sk[c.key])), bhThang(sk[c.key], c, null)); if (cur && cur.hanBH && cur.hanBH >= to && cur.ngayBanGiao <= to) con++; });
  var sua = tks.filter(function (t) { return t.trangThai === 'HOAN_THANH' && Number(t.phiSua) > 0 && t.ngayDong >= from && t.ngayDong <= to; });   // doanh thu sửa chữa ghi nhận khi hoàn thành
  var sum = function (l) { return rows.reduce(function (a, r) { return r.loai === l ? a + r.giaTri : a; }, 0); };
  return { from: from, to: to, rows: rows, tong: sum('BAO_HANH'), tongSua: sum('THU_TIEN'), phiSua: sua.reduce(function (a, t) { return a + Number(t.phiSua); }, 0),
    sua: sua.map(function (t) { return { soPBH: t.soPBH, ngayDong: t.ngayDong, serialTu: t.serialTu || t.serial || t.maHang, phiSua: Number(t.phiSua) }; }), tuConBH: con };
}
