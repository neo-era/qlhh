/** QLHH — lắp đặt & bảo hành (BH-1): bàn giao / di dời tủ (vị trí, GPS), hạn bảo hành theo ngày bàn giao, phiếu bảo hành, thay linh kiện serial.
 *  Lõi: core/bh.js (QBH). Ghép sau SanXuat.gs bởi build.sh. Mọi dòng ghi chính có requestId để gửi lại không ghi trùng. */

/** Xê-ri cần tra → dòng Serial, hồ sơ tủ (nếu là tủ), mã hàng. Ưu tiên xê-ri có hồ sơ tủ. */
function bhResolve(q) {
  q = QSerial.norm(q); if (!q) throw fail('VALIDATION', 'Nhập số xê-ri', { serial: 'Bắt buộc' });
  var heads = cabHeads(), hs = readTable('HoSoTu').rows.filter(function (c) { return c.serial === q && cabOK(c, heads); })[0];
  var srs = readTable('Serial').rows, sk = mapBy(srs, 'key'), sr = hs ? sk[hs.key] : srs.filter(function (r) { return r.serial === q; })[0];
  if (!sr) throw fail('VALIDATION', 'Không có xê-ri ' + q, { serial: 'Xê-ri không có' });
  return { q: q, sr: sr, hs: hs, sk: sk, it: mapBy(readTable('HangHoa').rows, 'maHang')[sr.maHang] || {} };
}
/** Ngày xuất khỏi kho gần nhất (phiếu xuất bán / công trình / bảo hành còn hiệu lực). */
function bhNgayXuat(key) {
  var ph = mapBy(readTable('Phieu').rows.filter(function (h) { return h.trangThai === 'HOAN_TAT' && !h.daDao; }), 'soPhieu'), d = '';
  readTable('LichSuSerial').rows.forEach(function (h) { if (h.key === key && h.to === 'DA_BAN' && ph[h.soPhieu] && ph[h.soPhieu].ngay > d) d = ph[h.soPhieu].ngay; });
  return d;
}
/** Số tháng BH mặc định: mẫu tủ → mã hàng → 12. */
function bhThang(sr, hs, it) {
  if (hs) { var t = template(hs.maMau, hs.phienBan); if (t && t.thangBH !== '' && t.thangBH !== undefined) return Number(t.thangBH); }
  return it && it.thangBH !== '' && it.thangBH !== undefined && it.thangBH !== null ? Number(it.thangBH) : 12;
}
/** Lịch sử lắp đặt của LẦN GIAO HIỆN TẠI (cùng ngày xuất kho): khách trả rồi bán lại thì bắt đầu chu kỳ bảo hành mới. */
function bhHist(key, nx) { return readTable('LapDat').rows.filter(function (r) { return r.key === key && (nx === undefined || !r.ngayXuat || r.ngayXuat === nx); }).map(strip); }
function bhInfo(key, sr, hs, it) {
  var nx = bhNgayXuat(key), live = sr && sr.trangThai === 'DA_BAN', hist = live ? bhHist(key, nx) : [], cur = QBH.current(hist, bhThang(sr, hs, it));
  if (!live) nx = '';
  var o = cur ? { ngayBanGiao: cur.ngayBanGiao, hanBH: cur.hanBH, thangBH: cur.thangBH, viTri: cur.viTri } : { thangBH: bhThang(sr, hs, it) };
  o.ngayXuat = nx; o.tinhTrang = QBH.status(cur ? cur : { ngayXuat: nx }, today()); o.lapDat = hist;
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
  if (pv) { var c0 = QBH.current(bhHist(pv.key), 12); return sxMark(u, req, { id: pv.id, ngayBanGiao: c0 && c0.ngayBanGiao, hanBH: c0 && c0.hanBH, lapLai: true }); }
  var r = bhResolve(req.serial), b = bhBase(r);
  if (b.sr.key !== r.sr.key) throw fail('VALIDATION', 'Xê-ri ' + r.q + ' là linh kiện trong tủ ' + b.serialTu + ' — ghi lắp đặt cho tủ', { serial: 'Chọn xê-ri tủ' });
  if (r.sr.trangThai !== 'DA_BAN') throw fail('VALIDATION', 'Xê-ri ' + r.q + ' chưa xuất khỏi kho (đang ' + r.sr.trangThai + (r.sr.kho ? ' tại ' + r.sr.kho : '') + ') — lập phiếu xuất bán / công trình trước', { serial: 'Chưa xuất kho' });
  var nx = bhNgayXuat(r.sr.key), v = need(QBH.validateInstall(req.lapDat, { ngayXuat: nx, today: today() }));
  var hist = bhHist(r.sr.key, nx), bg = hist.filter(function (x) { return x.loai === 'BAN_GIAO'; })[0];
  if (v.loai === 'BAN_GIAO' && bg) throw fail('VALIDATION', 'Tủ đã bàn giao ngày ' + bg.ngay + ' — chuyển vị trí thì chọn "Di dời"', { loai: 'Chọn Di dời' });
  if (v.loai === 'DI_DOI' && !bg) throw fail('VALIDATION', 'Chưa có lần bàn giao — chọn "Bàn giao" trước', { loai: 'Chọn Bàn giao' });
  var last = hist.reduce(function (m, x) { return x.ngay > m ? x.ngay : m; }, '');
  if (v.loai === 'DI_DOI' && v.ngay < last) throw fail('VALIDATION', 'Ngày di dời không trước lần ghi cuối (' + last + ')', { ngay: 'Từ ' + last });
  if (v.maKH && !readTable('KhachHang').rows.some(function (x) { return x.maKH === v.maKH; })) throw fail('VALIDATION', 'Khách hàng ' + v.maKH + ' chưa có', { maKH: 'Chọn khách có sẵn' });
  if (v.maCongTrinh && !readTable('CongTrinh').rows.some(function (x) { return x.maCongTrinh === v.maCongTrinh; })) throw fail('VALIDATION', 'Công trình ' + v.maCongTrinh + ' chưa có', { maCongTrinh: 'Chọn công trình có sẵn' });
  var id = 'LD' + pad(nextId('LAPDAT'), 6);
  appendBlock('LapDat', [{ id: id, serial: r.sr.serial, key: r.sr.key, maHang: r.sr.maHang, loai: v.loai, ngay: v.ngay, maKH: v.maKH, maCongTrinh: v.maCongTrinh, diaChi: v.diaChi, tenTaiCT: v.tenTaiCT,
    viDo: v.viDo, kinhDo: v.kinhDo, thangBH: v.loai === 'BAN_GIAO' && v.thangBH !== '' ? String(v.thangBH) : '', soBBBG: v.soBBBG, ghiChu: v.ghiChu, nguoiGhi: u.email, thoiGian: nowIso(), requestId: String(req.requestId), ngayXuat: nx }]);
  var cur = QBH.current(bhHist(r.sr.key, nx), bhThang(r.sr, r.hs, r.it));
  logs.push({ action: 'install.add', doiTuong: 'LapDat', id: id, truoc: null, sau: { serial: r.sr.serial, loai: v.loai, ngay: v.ngay, diaChi: v.diaChi, hanBH: cur.hanBH } });
  return sxMark(u, req, { id: id, ngayBanGiao: cur.ngayBanGiao, hanBH: cur.hanBH });
}

function bhCreate(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var pv = prevRow('PhieuBaoHanh', req)[0]; if (pv) return sxMark(u, req, { soPBH: pv.soPBH, serialTu: pv.serialTu, tinhTrangBH: pv.tinhTrangBH, hanBH: pv.hanBH, lapLai: true });
  var r = bhResolve(req.serial), b = bhBase(r);
  if (b.sr.trangThai !== 'DA_BAN') throw fail('VALIDATION', (b.serialTu ? 'Tủ ' + b.serialTu : 'Xê-ri ' + r.q) + ' chưa giao cho khách (đang ' + b.sr.trangThai + ') — không lập phiếu bảo hành', { serial: 'Chưa xuất kho' });
  var v = need(QBH.validateTicket(req.phieu, { today: today() })), cur = QBH.current(bhHist(b.key, bhNgayXuat(b.key)), bhThang(b.sr, b.hs, b.it));
  var tt = !cur ? 'CHUA_BAN_GIAO' : !cur.hanBH ? 'KHONG_BH' : v.ngay <= cur.hanBH ? 'TRONG_BH' : 'HET_BH';
  var yr = v.ngay.slice(0, 4), so = 'BH-' + yr + '-' + pad(nextId('PBH:' + yr), 5);
  appendBlock('PhieuBaoHanh', [{ soPBH: so, serial: r.q, key: r.sr.key, maHang: r.sr.maHang, serialTu: b.serialTu, ngay: v.ngay, nguoiBao: v.nguoiBao, moTaLoi: v.moTaLoi, tinhTrangBH: tt, hanBH: cur ? cur.hanBH : '',
    trangThai: 'TIEP_NHAN', nguyenNhan: '', ketQua: '', ngayDong: '', thayThe: '[]', soPhieuXuat: '', soPhieuLoi: '', nguoiTiepNhan: u.email, nguoiXuLy: '', thoiGian: nowIso(), ghiChu: v.ghiChu, requestId: String(req.requestId) }]);
  logs.push({ action: 'bh.create', doiTuong: 'PhieuBaoHanh', id: so, truoc: null, sau: { serial: r.q, serialTu: b.serialTu, tinhTrangBH: tt } });
  return sxMark(u, req, { soPBH: so, serialTu: b.serialTu, tinhTrangBH: tt, hanBH: cur ? cur.hanBH : '' });
}
function bhTicket(so) {
  var t = readTable('PhieuBaoHanh').rows.filter(function (x) { return x.soPBH === String(so || '').trim().toUpperCase(); })[0];
  if (!t) throw fail('VALIDATION', 'Không có phiếu bảo hành ' + so, null); return t;
}
function bhUpdate(u, req, logs) {
  var t = bhTicket(req.soPBH), v = need(QBH.validateUpdate(req, t.trangThai)), x = strip(t);
  x.trangThai = v.trangThai; if (v.nguyenNhan) x.nguyenNhan = v.nguyenNhan; if (v.ketQua) x.ketQua = v.ketQua; x.nguoiXuLy = u.email;
  if (v.trangThai === 'HOAN_THANH' || v.trangThai === 'TU_CHOI') x.ngayDong = today();
  putRow('PhieuBaoHanh', x, t._row);
  logs.push({ action: 'bh.update', doiTuong: 'PhieuBaoHanh', id: t.soPBH, truoc: { trangThai: t.trangThai }, sau: { trangThai: v.trangThai, nguyenNhan: v.nguyenNhan, ketQua: v.ketQua } });
  return { soPBH: t.soPBH, trangThai: v.trangThai };
}

/** Thay linh kiện trong tủ khi bảo hành: mới → phiếu Xuất bảo hành (giá vốn BQ = chi phí BH); cũ (serial) → phiếu Nhận hàng lỗi vào kho lỗi (giá 0). */
function bhReplace(u, req, logs) {
  var d = sxDone(u, req); if (d) return d;
  var px = prevHeads(req, 'XUAT_BH')[0];
  if (px) { var pl = prevHeads(req, 'NHAP_HANG_LOI')[0]; return sxMark(u, req, { soPhieuXuat: px.soPhieu, soPhieuLoi: pl ? pl.soPhieu : '', lapLai: true }); }
  cleanupOrphans(logs);
  var t = bhTicket(req.soPBH);
  if (['TIEP_NHAN', 'DANG_XU_LY'].indexOf(t.trangThai) < 0) throw fail('VALIDATION', 'Phiếu ' + t.soPBH + ' đã đóng', null);
  if (!t.serialTu) throw fail('VALIDATION', 'Phiếu không gắn với tủ — chỉ thay linh kiện trong tủ có hồ sơ', null);
  var heads = cabHeads(), cab = readTable('HoSoTu').rows.filter(function (c) { return c.serial === t.serialTu && cabOK(c, heads); })[0];
  if (!cab) throw fail('VALIDATION', 'Không có hồ sơ tủ ' + t.serialTu, null);
  var ngay = chkDate(String(req.ngay || today())); if (ngay < t.ngay) throw fail('VALIDATION', 'Ngày thay không trước ngày tiếp nhận (' + t.ngay + ')', { ngay: 'Từ ' + t.ngay });
  var kh = mapBy(readTable('Kho').rows, 'maKho'), kho = kh[up(req.kho || 'KHO')], loi = readTable('Kho').rows.filter(function (k) { return k.loai === 'HANG_LOI' && k.trangThai === 'HOAT_DONG'; })[0];
  if (!kho || kho.trangThai !== 'HOAT_DONG' || kho.loai === 'HANG_LOI') throw fail('VALIDATION', 'Chọn kho thường lấy linh kiện mới', { kho: 'Kho thường' });
  var items = mapBy(readTable('HangHoa').rows, 'maHang'), con = parseSerials(cab.serialCon), inCab = {}; con.forEach(function (k) { inCab[k] = 1; });
  if (!Array.isArray(req.lines) || !req.lines.length || req.lines.length > 50) throw fail('VALIDATION', 'Chọn 1–50 linh kiện thay', { lines: 'Bắt buộc' });
  var outL = [], cuL = [], ghi = [], newKeys = [], oldKeys = [];
  req.lines.forEach(function (l, i) {
    var it = items[up(l && l.maHang)], q = Number(l && l.soLuong), sm = (l.serialMoi || []).map(QSerial.norm).filter(String), sc = (l.serialCu || []).map(QSerial.norm).filter(String);
    if (!it) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': mã ' + (l && l.maHang) + ' không có', null);
    if (!(q > 0) || q > 1e6) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': số lượng > 0', null);
    if (it.quanLySerial) {
      if (!Number.isInteger(q) || sm.length !== q) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': cần đúng ' + q + ' serial ' + it.maHang + ' mới', null);
      if (sc.length > q) throw fail('VALIDATION', 'Dòng ' + (i + 1) + ': số serial cũ nhiều hơn số thay', null);
      sc.forEach(function (z) { var k = QSerial.keyOf(it, z); if (!inCab[k]) throw fail('VALIDATION', 'Serial cũ ' + z + ' không thuộc tủ ' + cab.serial, null); oldKeys.push(k); });
      sm.forEach(function (z) { newKeys.push(QSerial.keyOf(it, z)); });
      if (sc.length) cuL.push({ maHang: it.maHang, soLuongCT: sc.length, serials: sc });
    }
    outL.push({ maHang: it.maHang, soLuongCT: q, serials: it.quanLySerial ? sm : undefined });
    ghi.push({ maHang: it.maHang, soLuong: q, serialMoi: sm, serialCu: sc, ngay: ngay });
  });
  var ld = QBH.current(bhHist(cab.key, bhNgayXuat(cab.key)), 12), vt = ld ? ld.viTri : {}, lsx = readTable('LenhSX').rows.filter(function (x) { return x.soLSX === cab.soLSX; })[0] || {};
  var ctxX = voucherPrep(u, { requestId: req.requestId, voucher: { loai: 'XUAT_BH', ngay: ngay, kho: kho.maKho, maKH: vt.maKH || lsx.maKH || '', maCongTrinh: vt.maCongTrinh || lsx.maCongTrinh || '',
    lyDo: 'Bảo hành ' + t.soPBH + ' — tủ ' + cab.serial, soCTGoc: t.soPBH, ngayCTGoc: t.ngay, lines: outL } }, true);
  var ctxL = null;
  if (cuL.length) {
    if (!loi) throw fail('VALIDATION', 'Chưa có kho hàng lỗi', null);
    ctxL = voucherPrep(u, { requestId: req.requestId, voucher: { loai: 'NHAP_HANG_LOI', ngay: ngay, kho: loi.maKho, lyDo: 'Linh kiện thu hồi khi bảo hành ' + t.soPBH + ' — tủ ' + cab.serial, soCTGoc: t.soPBH, ngayCTGoc: t.ngay, lines: cuL } }, true);
    var sv = QSerial.apply(QSerial.index(readTable('Serial').rows), { loai: 'NHAP_HANG_LOI', kho: loi.maKho, lines: ctxL.lines }, { items: items });   // kiểm trước khi ghi phiếu đầu
    if (!sv.ok) throw fail(sv.code, engineMsg(sv), sv.errors);
  }
  var rx = commitVoucher(u, req, logs, ctxX), rl = ctxL ? commitVoucher(u, req, logs, ctxL) : null;
  setParents(oldKeys.map(function (k) { return [k, '', cab.key]; }).concat(newKeys.map(function (k) { return [k, cab.key]; })));
  var nc = con.filter(function (k) { return oldKeys.indexOf(k) < 0; }).concat(newKeys), cx = strip(cab); cx.serialCon = JSON.stringify(nc); putRow('HoSoTu', cx, cab._row);
  var tt = bhTicket(t.soPBH), tx = strip(tt);
  tx.thayThe = JSON.stringify(parseSerials(tt.thayThe).concat(ghi)); tx.soPhieuXuat = [tt.soPhieuXuat, rx.soPhieu].filter(String).join(', ');
  tx.soPhieuLoi = [tt.soPhieuLoi, rl ? rl.soPhieu : ''].filter(String).join(', '); if (tt.trangThai === 'TIEP_NHAN') tx.trangThai = 'DANG_XU_LY'; tx.nguoiXuLy = u.email;
  putRow('PhieuBaoHanh', tx, tt._row);
  logs.push({ action: 'bh.replace', doiTuong: 'PhieuBaoHanh', id: t.soPBH, truoc: { serialCon: con }, sau: { serialCon: nc, soPhieuXuat: rx.soPhieu, soPhieuLoi: rl ? rl.soPhieu : '' } });
  return sxMark(u, req, { soPhieuXuat: rx.soPhieu, soPhieuLoi: rl ? rl.soPhieu : '', tinhLai: rx.tinhLai });
}

/** Bổ sung cho serial.get: lịch sử lắp đặt, hạn & tình trạng BH, phiếu bảo hành (theo tủ gốc). */
function bhAugment(out, sr, hs) {
  if (!sr) return;
  var r = { q: sr.serial, sr: sr, hs: hs, sk: mapBy(readTable('Serial').rows, 'key'), it: mapBy(readTable('HangHoa').rows, 'maHang')[sr.maHang] || {} }, b = bhBase(r);
  var info = bhInfo(b.key, b.sr, b.hs, b.it); out.lapDat = info.lapDat; delete info.lapDat; info.serialTu = b.serialTu; out.baoHanh = info;
  out.pbh = readTable('PhieuBaoHanh').rows.filter(function (t) { return t.key === sr.key || (b.serialTu && t.serialTu === b.serialTu); }).map(function (t) { var x = strip(t); delete x.requestId; return x; });
}
