/* QLHH core/validate — kiểm & chuẩn hoá dữ liệu nhập. Trả {ok, value, errors{truong:thongBao}}. */
var QValidate=(function(){
  var CODE=/^[A-Z0-9][A-Z0-9._\-\/]{0,39}$/, EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, PHONE=/^[+0-9][0-9 .\-]{5,19}$/, MST=/^\d{10}(-\d{3})?$/;
  var ROLES=['XEM','NHAP_LIEU','QUAN_TRI'], FB=['DE_XUAT','LOI_APP','SAI_DU_LIEU','KHAC'];
  function obj(x){return x&&typeof x==='object'&&!Array.isArray(x);}
  function s(v,max){v=v===undefined||v===null?'':String(v).trim();return max?v.slice(0,max+1):v;}
  function code(v){return s(v).toUpperCase();}
  function intOpt(v,e,f,min,max,msg){if(v===''||v===undefined||v===null)return '';var n=Number(v);if(!Number.isInteger(n)||n<min||(max!==undefined&&n>max)){e[f]=msg;return v;}return n;}
  function numOpt(v,e,f,msg){if(v===''||v===undefined||v===null)return '';var n=Number(v);if(!isFinite(n)||n<0){e[f]=msg;return v;}return n;}
  function bool(v){return v===true||v==='true'||v===1||v==='1'||v==='TRUE';}
  function isoDate(v){v=s(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;var d=new Date(v+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===v;}
  function done(value,e){return Object.keys(e).length?{ok:false,value:value,errors:e}:{ok:true,value:value,errors:{}};}
  function bad(){return {ok:false,value:null,errors:{_:'Dữ liệu không hợp lệ'}};}
  function item(x){
    if(!obj(x))return bad();var e={},v={};
    v.maHang=code(x.maHang);if(!v.maHang)e.maHang='Nhập mã hàng';else if(!CODE.test(v.maHang))e.maHang='Mã chỉ gồm chữ không dấu, số, - . _ / (≤ 40 ký tự)';
    v.ten=s(x.ten);if(!v.ten)e.ten='Nhập tên hàng';else if(v.ten.length>200)e.ten='Tên ≤ 200 ký tự';
    v.dvt=s(x.dvt);if(!v.dvt)e.dvt='Nhập đơn vị tính';else if(v.dvt.length>20)e.dvt='ĐVT ≤ 20 ký tự';
    v.nhom=code(x.nhom);v.quyCach=s(x.quyCach).slice(0,300);v.hang=s(x.hang).slice(0,100);v.xuatXu=s(x.xuatXu).slice(0,100);
    v.quanLySerial=bool(x.quanLySerial);
    v.thangBH=intOpt(x.thangBH,e,'thangBH',0,120,'Bảo hành 0–120 tháng (số nguyên)');
    v.tonToiThieu=numOpt(x.tonToiThieu,e,'tonToiThieu','Tồn tối thiểu ≥ 0');
    v.giaBan=intOpt(x.giaBan,e,'giaBan',0,undefined,'Giá bán là số nguyên VND ≥ 0');
    v.anhUrl=s(x.anhUrl).slice(0,500);v.taiLieuUrl=s(x.taiLieuUrl).slice(0,500);
    ['anhUrl','taiLieuUrl'].forEach(function(k){if(v[k]&&!/^https?:\/\/[^\s"'<>]+$/i.test(v[k]))e[k]='Link phải bắt đầu bằng http:// hoặc https://';});
    v.trangThai=x.trangThai==='NGUNG'?'NGUNG':'KD';
    return done(v,e);
  }
  function group(x){
    if(!obj(x))return bad();var e={},v={maNhom:code(x.maNhom),ten:s(x.ten),cha:code(x.cha)};
    if(!v.maNhom)e.maNhom='Nhập mã nhóm';else if(!CODE.test(v.maNhom))e.maNhom='Mã nhóm không hợp lệ';
    if(!v.ten)e.ten='Nhập tên nhóm';if(v.cha&&v.cha===v.maNhom)e.cha='Nhóm không thể là cha của chính nó';
    return done(v,e);
  }
  function supplier(x){
    if(!obj(x))return bad();var e={},v={};
    v.maNCC=code(x.maNCC);if(!v.maNCC)e.maNCC='Nhập mã NCC';else if(!CODE.test(v.maNCC))e.maNCC='Mã NCC không hợp lệ';
    v.ten=s(x.ten);if(!v.ten)e.ten='Nhập tên NCC';
    v.mst=s(x.mst);if(v.mst&&!MST.test(v.mst))e.mst='MST gồm 10 số hoặc 10 số-3 số';
    v.email=s(x.email).toLowerCase();if(v.email&&!EMAIL.test(v.email))e.email='Email không hợp lệ';
    v.dienThoai=s(x.dienThoai);if(v.dienThoai&&!PHONE.test(v.dienThoai))e.dienThoai='Số điện thoại không hợp lệ';
    v.diaChi=s(x.diaChi).slice(0,300);v.lienHe=s(x.lienHe).slice(0,100);v.ghiChu=s(x.ghiChu).slice(0,500);
    v.trangThai=x.trangThai==='NGUNG'?'NGUNG':'HOAT_DONG';
    return done(v,e);
  }
  function price(x){
    if(!obj(x))return bad();var e={},v={};
    v.maHang=code(x.maHang);if(!v.maHang)e.maHang='Chọn mã hàng';
    v.loai=s(x.loai).toUpperCase();if(['BAN','NHAP'].indexOf(v.loai)<0)e.loai='Loại giá là BAN hoặc NHAP';
    var g=Number(x.gia);if(!Number.isInteger(g)||g<=0)e.gia='Giá là số nguyên VND > 0';else v.gia=g;
    v.tuNgay=s(x.tuNgay);if(!isoDate(v.tuNgay))e.tuNgay='Ngày áp dụng không hợp lệ (YYYY-MM-DD)';
    v.maNCC=code(x.maNCC);if(v.loai==='NHAP'&&!v.maNCC)e.maNCC='Giá nhập phải chọn nhà cung cấp';
    v.ghiChu=s(x.ghiChu).slice(0,300);
    return done(v,e);
  }
  function user(x){
    if(!obj(x))return bad();var e={},v={};
    v.email=s(x.email).toLowerCase();if(!EMAIL.test(v.email))e.email='Email không hợp lệ';
    v.hoTen=s(x.hoTen).slice(0,100);
    v.vaiTro=s(x.vaiTro);if(ROLES.indexOf(v.vaiTro)<0)e.vaiTro='Vai trò không hợp lệ';
    v.trangThai=x.trangThai==='KHOA'?'KHOA':'HOAT_DONG';
    return done(v,e);
  }
  function feedback(x){
    if(!obj(x))return bad();var e={},v={};
    var n=x.sao===''||x.sao===undefined||x.sao===null?0:Number(x.sao);
    if(!Number.isInteger(n)||n<0||n>5)e.sao='Số sao 1–5';else v.sao=n;
    v.loai=s(x.loai);if(FB.indexOf(v.loai)<0)e.loai='Loại góp ý không hợp lệ';
    v.noiDung=x.noiDung===undefined||x.noiDung===null?'':String(x.noiDung).trim();
    if(v.noiDung.length>2000)e.noiDung='Nội dung ≤ 2000 ký tự';
    if(!e.sao&&!v.sao&&!v.noiDung)e._='Chọn số sao hoặc nhập nội dung';
    v.banDung=s(x.banDung).slice(0,40);v.thietBi=s(x.thietBi).slice(0,200);v.manHinh=s(x.manHinh).slice(0,60);
    return done(v,e);
  }
  function warehouse(x){
    if(!obj(x))return bad();var e={},v={maKho:code(x.maKho),ten:s(x.ten),diaChi:s(x.diaChi).slice(0,300)};
    if(!v.maKho)e.maKho='Nhập mã kho';else if(!CODE.test(v.maKho)||v.maKho==='*')e.maKho='Mã kho không hợp lệ';
    if(!v.ten)e.ten='Nhập tên kho';
    v.loai=x.loai==='HANG_LOI'?'HANG_LOI':'THUONG';v.trangThai=x.trangThai==='NGUNG'?'NGUNG':'HOAT_DONG';
    return done(v,e);
  }
  function customer(x){
    if(!obj(x))return bad();var e={},v={};
    v.maKH=code(x.maKH);if(!v.maKH)e.maKH='Nhập mã khách hàng';else if(!CODE.test(v.maKH))e.maKH='Mã khách không hợp lệ';
    v.ten=s(x.ten);if(!v.ten)e.ten='Nhập tên khách hàng';else if(v.ten.length>200)e.ten='Tên ≤ 200 ký tự';
    v.loaiKH=x.loaiKH==='CA_NHAN'?'CA_NHAN':'DN';
    v.mst=s(x.mst);if(v.mst&&!MST.test(v.mst))e.mst='MST gồm 10 số hoặc 10 số-3 số';
    v.email=s(x.email).toLowerCase();if(v.email&&!EMAIL.test(v.email))e.email='Email không hợp lệ';
    v.dienThoai=s(x.dienThoai);if(v.dienThoai&&!PHONE.test(v.dienThoai))e.dienThoai='Số điện thoại không hợp lệ';
    v.diaChi=s(x.diaChi).slice(0,300);v.lienHe=s(x.lienHe).slice(0,100);
    v.cheDoBHThayThe=x.cheDoBHThayThe==='CON_LAI'&&v.loaiKH==='DN'?'CON_LAI':'TINH_LAI';
    v.trangThai=x.trangThai==='NGUNG'?'NGUNG':'HOAT_DONG';
    return done(v,e);
  }
  function project(x){
    if(!obj(x))return bad();var e={},v={};
    v.maCongTrinh=code(x.maCongTrinh);if(!v.maCongTrinh)e.maCongTrinh='Nhập mã công trình';else if(!CODE.test(v.maCongTrinh))e.maCongTrinh='Mã công trình không hợp lệ';
    v.ten=s(x.ten);if(!v.ten)e.ten='Nhập tên công trình';else if(v.ten.length>300)e.ten='Tên ≤ 300 ký tự';
    v.maKH=code(x.maKH);v.diaChi=s(x.diaChi).slice(0,300);v.chuDauTu=s(x.chuDauTu).slice(0,200);
    ['ngayBatDau','ngayNghiemThu'].forEach(function(k){v[k]=s(x[k]);if(v[k]&&!isoDate(v[k]))e[k]='Ngày không hợp lệ';});
    if(v.ngayBatDau&&v.ngayNghiemThu&&v.ngayNghiemThu<v.ngayBatDau)e.ngayNghiemThu='Nghiệm thu không trước ngày bắt đầu';
    v.trangThai=x.trangThai==='NGUNG'?'NGUNG':'HOAT_DONG';
    return done(v,e);
  }
  function unit(x){
    if(!obj(x))return bad();var e={},v={maHang:code(x.maHang),dvtPhu:s(x.dvtPhu)};
    if(!v.maHang)e.maHang='Chọn mã hàng';if(!v.dvtPhu)e.dvtPhu='Nhập ĐVT phụ';else if(v.dvtPhu.length>20)e.dvtPhu='ĐVT ≤ 20 ký tự';
    var h=Number(x.heSo);if(!(h>0)||!isFinite(h)||Math.abs(Math.round(h*1000)-h*1000)>1e-6)e.heSo='Hệ số > 0, tối đa 3 số lẻ';else v.heSo=h;
    return done(v,e);
  }
  var VTEXT={nguoiGiaoNhan:100,lyDo:300,soCTGoc:60,ghiChu:500};
  function voucherHead(x){
    if(!obj(x))return bad();var e={},v={};
    v.loai=s(x.loai).toUpperCase();v.ngay=s(x.ngay);if(!isoDate(v.ngay))e.ngay='Ngày phiếu không hợp lệ';
    ['kho','khoDen','maNCC','maKH','maCongTrinh','phieuGoc'].forEach(function(k){v[k]=code(x[k]);});
    Object.keys(VTEXT).forEach(function(k){v[k]=s(x[k]);if(v[k].length>VTEXT[k])e[k]='Tối đa '+VTEXT[k]+' ký tự';});
    v.ngayCTGoc=s(x.ngayCTGoc);if(v.ngayCTGoc&&!isoDate(v.ngayCTGoc))e.ngayCTGoc='Ngày chứng từ gốc không hợp lệ';
    if(v.loai==='NHAP_MUA'&&!v.maNCC)e.maNCC='Phiếu nhập mua phải chọn nhà cung cấp';
    if(v.loai==='XUAT_BAN'&&!v.maKH)e.maKH='Phiếu xuất bán phải chọn khách hàng';
    if((v.loai==='XUAT_BAN'||v.loai==='XUAT_CONG_TRINH')&&!v.maCongTrinh)e.maCongTrinh='Chọn công trình';
    if(v.loai==='KHACH_TRA'&&!v.phieuGoc)e.phieuGoc='Chọn phiếu xuất gốc';
    if(!Array.isArray(x.lines))e.lines='Phiếu chưa có dòng hàng';else if(x.lines.length>200)e.lines='Tối đa 200 dòng/phiếu';
    return done(v,e);
  }
  return {warehouse:warehouse,customer:customer,project:project,unit:unit,voucherHead:voucherHead,item:item,group:group,supplier:supplier,price:price,user:user,feedback:feedback,isoDate:isoDate,ROLES:ROLES,FB:FB};
})();
if(typeof module!=='undefined')module.exports=QValidate;
