/* QLHH core/schema — định nghĩa sheet đợt ① + kiểm tiêu đề + đọc dòng → object (chịu lỗi). */
var QSchema=(function(){
  var SHEETS={
    HangHoa:{key:'maHang',cols:['maHang','ten','nhom','quyCach','dvt','hang','xuatXu','quanLySerial','thangBH','tonToiThieu','giaBan','giaVon','anhUrl','taiLieuUrl','trangThai','capNhat'],
      num:['thangBH','tonToiThieu','giaBan','giaVon'],bool:['quanLySerial'],text:['maHang','nhom']},
    NhomHang:{key:'maNhom',cols:['maNhom','ten','cha'],text:['maNhom','cha']},
    NhaCungCap:{key:'maNCC',cols:['maNCC','ten','mst','diaChi','lienHe','dienThoai','email','ghiChu','trangThai'],text:['maNCC','mst','dienThoai']},
    BangGia:{key:'id',cols:['id','maHang','loai','maNCC','gia','tuNgay','ghiChu','nguoiTao','thoiGian'],num:['gia'],text:['id','maHang','maNCC','tuNgay']},
    NguoiDung:{key:'email',cols:['email','hoTen','vaiTro','trangThai','ngayTao'],text:['email']},
    NhatKy:{cols:['thoiGian','email','action','doiTuong','id','truoc','sau','requestId'],text:['id','requestId']},
    Request:{key:'requestId',cols:['requestId','email','thoiGian','ketQua'],text:['requestId','email']},
    GopY:{key:'id',cols:['id','thoiGian','email','sao','loai','noiDung','banDung','thietBi','manHinh','trangThai','note'],num:['sao'],text:['id']},
    CauHinh:{key:'key',cols:['key','value'],text:['key']},
    Kho:{key:'maKho',cols:['maKho','ten','diaChi','loai','trangThai'],text:['maKho']},
    QuyDoiDVT:{key:'id',cols:['id','maHang','dvtPhu','heSo'],num:['heSo'],text:['id','maHang']},
    KhachHang:{key:'maKH',cols:['maKH','ten','loaiKH','mst','diaChi','lienHe','dienThoai','email','cheDoBHThayThe','trangThai'],text:['maKH','mst','dienThoai']},
    CongTrinh:{key:'maCongTrinh',cols:['maCongTrinh','ten','maKH','diaChi','chuDauTu','ngayBatDau','ngayNghiemThu','trangThai'],text:['maCongTrinh','maKH','ngayBatDau','ngayNghiemThu']},
    Phieu:{key:'soPhieu',cols:['soPhieu','stt','loai','ngay','kho','khoDen','maNCC','maKH','maCongTrinh','phieuGoc','daDao','trangThai','nguoiGiaoNhan','lyDo','soCTGoc','ngayCTGoc','tongTien','ghiChu','nguoiTao','thoiGian','requestId','hieuLuc','soLSX'],
      num:['stt','tongTien'],bool:['daDao'],text:['soPhieu','ngay','kho','khoDen','maNCC','maKH','maCongTrinh','phieuGoc','soCTGoc','ngayCTGoc','requestId','hieuLuc','soLSX']},
    ChiTietPhieu:{cols:['soPhieu','dong','maHang','dvt','soLuongCT','heSo','soLuong','donGia','thanhTien','giaTriKho','slSoSach','slThucTe','dongGoc','serials','chenhLechGV'],
      num:['dong','soLuongCT','heSo','soLuong','donGia','thanhTien','giaTriKho','slSoSach','slThucTe','dongGoc','chenhLechGV'],text:['soPhieu','maHang']},
    Serial:{key:'key',cols:['key','hang','serial','maHang','trangThai','kho','capNhat','serialCha'],text:['key','hang','serial','maHang','kho','serialCha']},
    LichSuSerial:{cols:['soPhieu','key','maHang','from','to','khoTu','khoDen','thoiGian'],text:['soPhieu','key','maHang','khoTu','khoDen']},
    TonKho:{cols:['maHang','kho','soLuong','giaTri','ngayCuoi','sttCuoi'],num:['soLuong','giaTri','sttCuoi'],text:['maHang','kho','ngayCuoi']},
    // sản xuất tủ (SX-1). Mẫu tủ: mỗi phiên bản 1 dòng, định mức + mục kiểm tra lưu JSON (bất biến sau khi ghi)
    MauSanPham:{key:'id',cols:['id','maMau','phienBan','maHang','ten','kichThuoc','moTa','vatLieu','ketCau','filePLC','thongSoDien','ghiChuDM','thangBH','bom','kcs','trangThai','nguoiTao','thoiGian'],num:['phienBan','thangBH'],text:['id','maMau','maHang','kichThuoc']},
    LenhSX:{key:'soLSX',cols:['soLSX','ngay','maMau','phienBan','maHang','soLuong','maKH','maCongTrinh','canCuCheTao','kho','trangThai','ghiChu','nguoiTao','thoiGian','lyDoHuy'],num:['phienBan','soLuong'],text:['soLSX','ngay','maMau','maHang','maKH','maCongTrinh','kho']},
    ChiPhiLSX:{key:'id',cols:['id','soLSX','ngay','loai','soTien','soCTGoc','ngayCTGoc','ghiChu','nguoiTao','thoiGian','requestId'],num:['soTien'],text:['id','soLSX','ngay','soCTGoc','ngayCTGoc','requestId']},
    HoSoTu:{key:'serial',cols:['serial','key','soLSX','maHang','maMau','phienBan','soPhieuNhap','ngayNhap','bomThucTe','serialCon','kichThuoc','ghiChu','kcsDat','lanKiemCuoi','soPXX','trangThai','ngayXuat','phieuXuat'],num:['phienBan','lanKiemCuoi'],bool:['kcsDat'],text:['serial','key','soLSX','maHang','maMau','soPhieuNhap','ngayNhap','soPXX','ngayXuat','phieuXuat']},
    KiemTraXX:{key:'id',cols:['id','serial','lanKiem','ngay','nguoiKiem','ketQua','dat','soDat','tongMuc','thoiGian','requestId'],num:['lanKiem','soDat','tongMuc'],bool:['dat'],text:['id','serial','ngay','requestId']},
    // lắp đặt & bảo hành (BH-1): mỗi lần bàn giao / di dời 1 dòng; phiếu bảo hành theo xê-ri
    LapDat:{key:'id',cols:['id','serial','key','maHang','loai','ngay','maKH','maCongTrinh','diaChi','tenTaiCT','viDo','kinhDo','thangBH','soBBBG','ghiChu','nguoiGhi','thoiGian','requestId','ngayXuat','phieuXuat','lyDoHuy'],num:['viDo','kinhDo'],text:['id','serial','key','maHang','ngay','maKH','maCongTrinh','thangBH','soBBBG','requestId','ngayXuat','phieuXuat']},
    PhieuBaoHanh:{key:'soPBH',cols:['soPBH','serial','key','maHang','serialTu','ngay','nguoiBao','moTaLoi','tinhTrangBH','hanBH','trangThai','nguyenNhan','ketQua','ngayDong','thayThe','soPhieuXuat','soPhieuLoi','nguoiTiepNhan','nguoiXuLy','thoiGian','ghiChu','requestId','thienChi'],text:['soPBH','serial','key','maHang','serialTu','ngay','hanBH','ngayDong','soPhieuXuat','soPhieuLoi','requestId']},
    PhieuXuatXuong:{key:'soPXX',cols:['soPXX','nam','so','ngay','maKH','maCongTrinh','diaDiem','serials','canCuCheTao','soPhieuXuat','soHoaDon','trangThai','nguoiLap','thoiGian','lyDoHuy','ghiChu','requestId'],num:['nam','so'],text:['soPXX','ngay','maKH','maCongTrinh','soPhieuXuat','soHoaDon','requestId']}
  };
  function check(heads){
    var errs=[];
    Object.keys(SHEETS).forEach(function(n){
      var want=SHEETS[n].cols,h=heads[n];
      if(!h){errs.push({sheet:n,msg:'không có sheet '+n});return;}
      for(var i=0;i<want.length;i++){
        if(String(h[i]||'').trim()!==want[i]){errs.push({sheet:n,msg:'cột '+(i+1)+' phải là "'+want[i]+'" (đang là "'+(h[i]||'')+'")'});break;}
      }
    });
    return errs;
  }
  function blank(r){for(var i=0;i<r.length;i++)if(r[i]!==''&&r[i]!==null&&r[i]!==undefined)return false;return true;}
  function toObjects(name,values){
    var d=SHEETS[name],cols=d.cols,num=d.num||[],bool=d.bool||[],rows=[],warnings=[];
    for(var i=1;i<values.length;i++){
      var r=values[i];if(!r||blank(r))continue;
      var o={_row:i+1};
      for(var j=0;j<cols.length;j++){
        var c=cols[j],v=r[j]===undefined?'':r[j];
        if(v instanceof Date)v=new Date(v.getTime()+7*3600e3).toISOString().slice(0,10);   // ngày theo giờ VN
        if(num.indexOf(c)>=0&&v!==''){var n=Number(v);if(!isFinite(n)){warnings.push(name+'!'+(i+1)+': '+c+' không phải số ("'+v+'")');v='';}else v=n;}
        else if(bool.indexOf(c)>=0)v=v===true||String(v).trim().toLowerCase()==='true';
        else if(num.indexOf(c)<0){v=typeof v==='string'?v:String(v);if(/^'[=+\-@\t\r]/.test(v))v=v.slice(1);}   // ô văn bản có thể giữ dấu ' đã thêm khi ghi
        o[c]=v;
      }
      rows.push(o);
    }
    return {rows:rows,warnings:warnings};
  }
  /* Chuỗi bắt đầu = + - @ được thêm ' để Sheets lưu là VĂN BẢN, không chạy công thức (chống chèn công thức lấy giá vốn). */
  function safe(v){return typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v;}
  function toRow(name,o){return SHEETS[name].cols.map(function(c){var v=o[c];return v===undefined||v===null?'':safe(v);});}
  return {SHEETS:SHEETS,check:check,toObjects:toObjects,toRow:toRow,safe:safe};
})();
if(typeof module!=='undefined')module.exports=QSchema;
