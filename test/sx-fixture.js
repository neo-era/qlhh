// Dữ liệu dựng sẵn cho test máy chủ sản xuất / bảo hành.
const assert = require('node:assert');
const { ready, rid } = require('./gas-mock.js');
const NV = 'nv@gmail.com', XEM = 'xem@gmail.com';
const BOM = [['VO', 1, 3200000], ['CB40', 1, 450000], ['CB6', 1, 180000], ['LOGO', 1, 4150000], ['CONT', 2, 620000], ['DEN', 5, 45000], ['CT', 1, 160000], ['DOM', 3, 55000], ['PK', 1, 350000]];
const KCS = ['Ngoại quan, kích thước', 'Đấu nối theo sơ đồ', 'Đo cách điện ≥ 1 MΩ', 'Chạy thử chế độ tự động', 'Chạy thử chế độ tay', 'Nhãn, tem, QR'];

function plant() {
  const a = ready({ [NV]: 'NHAP_LIEU', [XEM]: 'XEM' }), s = a.login(), nv = a.login(NV), xem = a.login(XEM);
  const P = (action, o, who = s) => a.post({ action, session: who, requestId: rid(), ...o });
  const W = (action, o, who = s) => { const r = P(action, o, who); assert.equal(r.ok, true, action + ': ' + JSON.stringify(r)); return r.data; };
  for (const [m] of BOM) W('item.upsert', { isNew: true, item: { maHang: m, ten: 'Linh kiện ' + m, dvt: 'cái', hang: m === 'LOGO' ? 'Siemens' : '', quanLySerial: m === 'LOGO' } });
  W('item.upsert', { isNew: true, item: { maHang: 'TU-DKCS-2N', ten: 'Tủ ĐKCS 2 nhánh có LOGO!', dvt: 'tủ', hang: 'LAVIPCO', quanLySerial: true, thangBH: 12 } });
  W('supplier.upsert', { isNew: true, supplier: { maNCC: 'NCC1', ten: 'Cty Thiết bị điện' } });
  W('customer.upsert', { isNew: true, customer: { maKH: 'TN', ten: 'CP QLVH Chiếu sáng ĐT Tây Ninh' } });
  W('project.upsert', { isNew: true, project: { maCongTrinh: 'PDG', ten: 'Hẻm 20 Phan Đình Giót', maKH: 'TN' } });
  const buy = (ngay, n, skip = [], who = s) => W('voucher.create', { voucher: { loai: 'NHAP_MUA', ngay, kho: 'KHO', maNCC: 'NCC1',
    lines: BOM.filter(b => !skip.includes(b[0])).map(([m, q, g]) => ({ maHang: m, soLuongCT: q * n, gia: g, serials: m === 'LOGO' ? Array.from({ length: n }, (_, i) => 'LG' + ngay.slice(5).replace('-', '') + i) : undefined })) } }, who);
  const tpl = () => W('template.upsert', { template: { maMau: 'TU-2N', maHang: 'TU-DKCS-2N', ten: 'Tủ ĐKCS 2 nhánh', kichThuoc: '775x478x324', thangBH: 12,
    bom: BOM.map(([m, q]) => ({ maHang: m, soLuong: q })), kcs: KCS.map(k => ({ noiDung: k, yeuCau: 'Đạt' })) } });
  const issue = (so, ngay, n, logos, who = nv) => P('lsx.xuatSX', { soLSX: so, ngay, lines: BOM.map(([m, q]) => ({ maHang: m, soLuongCT: q * n, serials: m === 'LOGO' ? logos : undefined })) }, who);
  const pull = (who = s) => a.post({ action: 'sync.pull', session: who }).data;
  const ton = (ma, who = s) => pull(who).data.stock.find(t => t.maHang === ma && t.kho === '*');
  const pass = () => KCS.map(() => ({ ketQua: 'DAT' }));
  return { a, s, nv, xem, P, W, buy, tpl, issue, pull, ton, pass };
}
// LSX 2 tủ đã xuất linh kiện + nhân công 3tr + nhập 2 tủ
function built() {
  const x = plant(); x.buy('2026-11-01', 2); x.tpl();
  const so = x.W('lsx.create', { lsx: { maMau: 'TU-2N', soLuong: 2, ngay: '2026-11-02', maKH: 'TN', maCongTrinh: 'PDG', canCuCheTao: 'Bản vẽ ĐC-01', kho: 'KHO' } }, x.nv).soLSX;
  const xs = x.issue(so, '2026-11-05', 2, ['LG11010', 'LG11011']); assert.equal(xs.ok, true, JSON.stringify(xs));
  x.W('lsx.chiPhi', { soLSX: so, chiPhi: { ngay: '2026-11-05', loai: 'NC_TRUC_TIEP', soTien: 3000000, ghiChu: 'Nhân công lắp 2 tủ' } });
  const tp = x.W('lsx.nhapTP', { soLSX: so, ngay: '2026-11-09', soLuong: 2 }, x.nv);
  return { ...x, so, xs: xs.data.soPhieu, tp };
}

module.exports = { NV, XEM, BOM, KCS, plant, built };
