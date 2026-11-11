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
/** Lần xuất khỏi kho hiện hành {ngay, soPhieu}: phiếu xuất (bán / công trình / BH) còn hiệu lực đã đưa serial sang DA_BAN gần nhất. */
function bhXuatCalc(key) {
  var ph = mapBy(readTable('Phieu').rows.filter(function (h) { return h.trangThai === 'HOAN_TAT' && !h.daDao; }), 'soPhieu'), best = { ngay: '', soPhieu: '' };
  readTable('LichSuSerial').rows.forEach(function (h) { var p = h.key === key && h.to === 'DA_BAN' && ph[h.soPhieu]; if (p && (p.ngay > best.ngay || (p.ngay === best.ngay && Number(p.stt) > Number(best.stt || 0)))) best = { ngay: p.ngay, soPhieu: p.soPhieu, stt: p.stt }; });
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
function bhTicket(so) {
  var t = readTable('PhieuBaoHanh').rows.filter(function (x) { return x.soPBH === String(so || '').trim().toUpperCase(); })[0];
  if (!t) throw fail('VALIDATION', 'Không có phiếu bảo hành ' + so, null); return t;
}
function bhUpdate(u, req, logs) {
  var t = bhTicket(req.soPBH), v = need(QBH.validateUpdate({ trangThai: req.trangThai, ketQua: req.ketQua, nguyenNhan: req.nguyenNhan || t.nguyenNhan }, t.trangThai)), x = strip(t);
  if (v.trangThai === 'TU_CHOI' && t.soPhieuXuat) throw fail('VALIDATION', 'Phiếu đã xuất linh kiện (' + t.soPhieuXuat + ') — không từ chối được; đóng Hoàn thành và ghi nguyên nhân', { trangThai: 'Đã thay linh kiện' });
  x.trangThai = v.trangThai; if (v.nguyenNhan) x.nguyenNhan = v.nguyenNhan; if (v.ketQua) x.ketQua = v.ketQua; x.nguoiXuLy = u.email;
  if (v.trangThai === 'HOAN_THANH' || v.trangThai === 'TU_CHOI') x.ngayDong = today();
  putRow('PhieuBaoHanh', x, t._row);
  logs.push({ action: 'bh.update', doiTuong: 'PhieuBaoHanh', id: t.soPBH, truoc: { trangThai: t.trangThai }, sau: { trangThai: v.trangThai, nguyenNhan: v.nguyenNhan, ketQua: v.ketQua } });
  return { soPBH: t.soPBH, trangThai: v.trangThai };
}

/** Thay linh kiện trong tủ khi bảo hành: mới → phiếu Xuất bảo hành (giá vốn BQ = chi phí BH), lắp vào tủ (DA_LAP); cũ (serial) → phiếu Nhận hàng lỗi về kho lỗi (giá 0).
 *  Chỉ miễn phí khi còn hạn + nguyên nhân không loại trừ; ngoài BH phải Quản trị duyệt "thiện chí" có lý do (ngược lại lập phiếu xuất bán linh kiện có giá).
 *  Thứ tự ghi: XB → HL → serial/hồ sơ tủ → phiếu BH (cuối = dấu hoàn tất). Gửi lại cùng requestId thì LÀM TIẾP phần còn thiếu. */
function bhReplace(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  cleanupOrphans(logs);
  var t = bhTicket(req.soPBH), px = prevHeads(req, 'XUAT_BH')[0], pl = prevHeads(req, 'NHAP_HANG_LOI')[0];
  if (px && String(t.soPhieuXuat).indexOf(px.soPhieu) >= 0) return sxMark(u, req, { soPhieuXuat: px.soPhieu, soPhieuLoi: pl ? pl.soPhieu : '', lapLai: true });
  if (!px && ['TIEP_NHAN', 'DANG_XU_LY'].indexOf(t.trangThai) < 0) throw fail('VALIDATION', 'Phiếu ' + t.soPBH + ' đã đóng', null);
  if (!t.serialTu) throw fail('VALIDATION', 'Phiếu không gắn với tủ — chỉ thay linh kiện trong tủ có hồ sơ', null);
  var heads = cabHeads(), cab = readTable('HoSoTu').rows.filter(function (c) { return c.serial === t.serialTu && cabOK(c, heads); })[0];
  if (!cab) throw fail('VALIDATION', 'Không có hồ sơ tủ ' + t.serialTu, null);
  var sk = mapBy(readTable('Serial').rows, 'key');
  if (!px && (!sk[cab.key] || sk[cab.key].trangThai !== 'DA_BAN')) throw fail('VALIDATION', 'Tủ ' + cab.serial + ' không còn ở phía khách (đang ' + (sk[cab.key] ? sk[cab.key].trangThai : '?') + ')', null);
  var mien = QBH.mienPhi(t.tinhTrangBH, t.nguyenNhan), tc = txt(req.thienChi, 300);
  if (!px && !mien) {
    if (u.vaiTro !== 'QUAN_TRI' || !tc) throw fail('VALIDATION', 'Ngoài bảo hành (' + t.tinhTrangBH + (QBH.NGOAI_BH.indexOf(t.nguyenNhan) >= 0 ? ', ' + t.nguyenNhan : '') + ') — lập phiếu xuất bán linh kiện có giá cho khách, hoặc Quản trị duyệt bảo hành thiện chí (ghi lý do)', { thienChi: 'Quản trị duyệt' });
  }
  var ngay = chkDate(String(req.ngay || today())); if (ngay < t.ngay) throw fail('VALIDATION', 'Ngày thay không trước ngày tiếp nhận (' + t.ngay + ')', { ngay: 'Từ ' + t.ngay });
  var kh = mapBy(readTable('Kho').rows, 'maKho'), kho = kh[up(req.kho || 'KHO')], loi = readTable('Kho').rows.filter(function (k) { return k.loai === 'HANG_LOI' && k.trangThai === 'HOAT_DONG'; })[0];
  if (!px && (!kho || kho.trangThai !== 'HOAT_DONG' || kho.loai === 'HANG_LOI')) throw fail('VALIDATION', 'Chọn kho thường lấy linh kiện mới', { kho: 'Kho thường' });
  var items = mapBy(readTable('HangHoa').rows, 'maHang'), con = parseSerials(cab.serialCon), inCab = {}; con.forEach(function (k) { inCab[k] = 1; });
  if (!Array.isArray(req.lines) || !req.lines.length || req.lines.length > 50) throw fail('VALIDATION', 'Chọn 1–50 linh kiện thay', { lines: 'Bắt buộc' });
  var outL = [], cuL = [], ghi = [], newKeys = [], oldKeys = [];
  req.lines.forEach(function (l, i) {
    var it = items[up(l && l.maHang)], q = Number(l && l.soLuong), sm = ((l && l.serialMoi) || []).map(QSerial.norm).filter(String), sc = ((l && l.serialCu) || []).map(QSerial.norm).filter(String);
    if (!it) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': mã ' + (l && l.maHang) + ' không có', null);
    if (!(q > 0) || q > 1e6) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': số lượng > 0', null);
    if (it.quanLySerial) {
      if (!Number.isInteger(q) || sm.length !== q) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': cần đúng ' + q + ' serial ' + it.maHang + ' mới', null);
      var coSan = con.filter(function (k) { return sk[k] && sk[k].maHang === it.maHang; }).length;
      if (!px && coSan && sc.length !== Math.min(q, coSan)) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': tủ đang có ' + coSan + ' serial ' + it.maHang + ' — chọn serial cũ thu hồi tương ứng', { serialCu: 'Bắt buộc' });
      if (sc.length > q) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': số serial cũ nhiều hơn số thay', null);
      sc.forEach(function (z) { var k = QSerial.keyOf(it, z); if (!px && !inCab[k]) throw fail('VALIDATION', 'Serial cũ ' + z + ' không thuộc tủ ' + cab.serial, null); oldKeys.push(k); });
      sm.forEach(function (z) { newKeys.push(QSerial.keyOf(it, z)); });
      if (sc.length) cuL.push({ maHang: it.maHang, soLuongCT: sc.length, serials: sc });
    }
    outL.push({ maHang: it.maHang, soLuongCT: q, serials: it.quanLySerial ? sm : undefined });
    ghi.push({ maHang: it.maHang, soLuong: q, serialMoi: sm, serialCu: sc, ngay: ngay });
  });
  var ld = QBH.current(bhHist(cab.key, bhXuat(cab.key, sk[cab.key])), 12), vt = ld ? ld.viTri : {}, lsx = readTable('LenhSX').rows.filter(function (z) { return z.soLSX === cab.soLSX; })[0] || {};
  var ctxL = null;
  if (cuL.length && !pl) {
    if (!loi) throw fail('VALIDATION', 'Chưa có kho hàng lỗi', null);
    ctxL = voucherPrep(u, { requestId: req.requestId, voucher: { loai: 'NHAP_HANG_LOI', ngay: ngay, kho: loi.maKho, lyDo: 'Linh kiện thu hồi khi bảo hành ' + t.soPBH + ' — tủ ' + cab.serial, soCTGoc: t.soPBH, ngayCTGoc: t.ngay, lines: cuL } }, true);
    ctxL.choLapDat = true;
    var sv = QSerial.apply(QSerial.index(readTable('Serial').rows), { loai: 'NHAP_HANG_LOI', kho: loi.maKho, lines: ctxL.lines }, { items: items, choLapDat: true });   // kiểm trước khi ghi phiếu đầu
    if (!sv.ok) throw fail(sv.code, engineMsg(sv), sv.errors);
  }
  var rx = px ? { soPhieu: px.soPhieu, tinhLai: 0 } : commitVoucher(u, req, logs, voucherPrep(u, { requestId: req.requestId, voucher: { loai: 'XUAT_BH', ngay: ngay, kho: kho.maKho, maKH: vt.maKH || lsx.maKH || '', maCongTrinh: vt.maCongTrinh || lsx.maCongTrinh || '',
    lyDo: 'Bảo hành ' + t.soPBH + ' — tủ ' + cab.serial + (mien ? '' : ' (thiện chí: ' + tc + ')'), soCTGoc: t.soPBH, ngayCTGoc: t.ngay, lines: outL } }, true));
  var rl = pl ? { soPhieu: pl.soPhieu } : ctxL ? commitVoucher(u, req, logs, ctxL) : null;
  // linh kiện mới: lắp vào tủ (DA_LAP + serialCha); cũ: gỡ khỏi tủ (chỉ khi còn trỏ đúng tủ này)
  var ns = {}; newKeys.forEach(function (k) { ns[k] = 1; });
  putMany('Serial', readTable('Serial').rows.filter(function (z) { return (ns[z.key] && (z.trangThai !== 'DA_LAP' || z.serialCha !== cab.key)) || (oldKeys.indexOf(z.key) >= 0 && z.serialCha === cab.key); })
    .map(function (z) { if (ns[z.key]) { z.trangThai = 'DA_LAP'; z.serialCha = cab.key; z.kho = ''; } else z.serialCha = ''; return z; }));
  var cab2 = readTable('HoSoTu').rows.filter(function (c) { return c.key === cab.key && c.trangThai !== 'HUY'; })[0], con2 = parseSerials(cab2.serialCon);
  var nc = con2.filter(function (k) { return oldKeys.indexOf(k) < 0; }).concat(newKeys.filter(function (k) { return con2.indexOf(k) < 0; })), cx = strip(cab2); cx.serialCon = JSON.stringify(nc); putRow('HoSoTu', cx, cab2._row);
  var tt = bhTicket(t.soPBH), tx = strip(tt);
  tx.thayThe = JSON.stringify(parseSerials(tt.thayThe).concat(ghi)); tx.soPhieuXuat = [tt.soPhieuXuat, rx.soPhieu].filter(String).join(', ');
  tx.soPhieuLoi = [tt.soPhieuLoi, rl ? rl.soPhieu : ''].filter(String).join(', '); if (tt.trangThai === 'TIEP_NHAN') tx.trangThai = 'DANG_XU_LY'; tx.nguoiXuLy = u.email;
  if (!mien && tc) tx.thienChi = [tt.thienChi, tc].filter(String).join('; ');
  putRow('PhieuBaoHanh', tx, tt._row);   // ghi cuối = lần thay hoàn tất
  logs.push({ action: 'bh.replace', doiTuong: 'PhieuBaoHanh', id: t.soPBH, truoc: { serialCon: con2 }, sau: { serialCon: nc, soPhieuXuat: rx.soPhieu, soPhieuLoi: rl ? rl.soPhieu : '', thienChi: mien ? '' : tc } });
  return sxMark(u, req, { soPhieuXuat: rx.soPhieu, soPhieuLoi: rl ? rl.soPhieu : '', tinhLai: rx.tinhLai });
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
  var tk = mapBy(readTable('PhieuBaoHanh').rows, 'soPBH'), ph = readTable('Phieu').rows.filter(function (h) { return h.loai === 'XUAT_BH' && h.trangThai === 'HOAN_TAT' && !h.daDao && h.ngay >= from && h.ngay <= to; });
  var rows = ph.map(function (h) { var t = tk[h.soCTGoc] || {}; return { soPhieu: h.soPhieu, ngay: h.ngay, soPBH: h.soCTGoc, serialTu: t.serialTu || '', tinhTrangBH: t.tinhTrangBH || '', nguyenNhan: t.nguyenNhan || '', thienChi: t.thienChi || '', giaTri: Number(h.tongTien) || 0 }; });
  var con = 0, sk = mapBy(readTable('Serial').rows, 'key'), heads = cabHeads();
  readTable('HoSoTu').rows.forEach(function (c) { if (!cabOK(c, heads) || !sk[c.key] || sk[c.key].trangThai !== 'DA_BAN') return;
    var cur = QBH.current(bhHist(c.key, bhXuat(c.key, sk[c.key])), bhThang(sk[c.key], c, null)); if (cur && cur.hanBH && cur.hanBH >= to && cur.ngayBanGiao <= to) con++; });
  return { from: from, to: to, rows: rows, tong: rows.reduce(function (a, r) { return a + r.giaTri; }, 0), tuConBH: con };
}
