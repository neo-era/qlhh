/* QLHH core/bh — lắp đặt & bảo hành: hạn BH theo ngày bàn giao, tình trạng BH, kiểm dữ liệu lắp đặt, luồng phiếu bảo hành.
   Thuần JS, dùng chung máy chủ/trình duyệt. Ngày dạng YYYY-MM-DD (giờ VN, không múi giờ). */
var QBH=(function(){
  var LOAI_LD=['BAN_GIAO','DI_DOI'],NGUYEN_NHAN=['LOI_THIET_BI','LOI_LAP_RAP','LOI_LAP_DAT','SET_DANH','QUA_AP','TAC_DONG','TU_Y_SUA','KHAC'];
  var NGOAI_BH=['SET_DANH','QUA_AP','TAC_DONG','TU_Y_SUA'];   // điều kiện loại trừ ghi trên PXX
  var TT={TIEP_NHAN:['DANG_XU_LY','HOAN_THANH','TU_CHOI'],DANG_XU_LY:['HOAN_THANH','TU_CHOI'],HOAN_THANH:[],TU_CHOI:[]};
  function iso(d){return /^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(Date.parse(d+'T00:00:00Z')).toISOString().slice(0,10)===d;}
  function ms(d){return Date.parse(d+'T00:00:00Z');}
  function day(t){return new Date(t).toISOString().slice(0,10);}
  function s(x,n){return String(x==null?'':x).trim().slice(0,n||300);}
  function up(x){return s(x,40).toUpperCase();}
  function addMonths(d,n){var y=+d.slice(0,4),m=+d.slice(5,7)-1+n,dd=+d.slice(8,10);y+=Math.floor(m/12);m=((m%12)+12)%12;
    var last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return day(Date.UTC(y,m,Math.min(dd,last)));}
  /* Ngày cuối còn bảo hành (bao gồm) = ngày bàn giao + N tháng − 1 ngày. N = 0 → không bảo hành. */
  function hanBH(ngay,thang){thang=Number(thang);if(!iso(ngay)||!(thang>0))return '';return day(ms(addMonths(ngay,thang))-864e5);}
  function diff(a,b){return Math.round((ms(b)-ms(a))/864e5);}
  /* x = {ngayBanGiao, hanBH} hoặc {ngayXuat} (chưa bàn giao) */
  function status(x,today){x=x||{};
    if(!x.ngayBanGiao)return {ma:'CHUA_BAN_GIAO',canhBao:!!(x.ngayXuat&&diff(x.ngayXuat,today)>30)};
    if(!x.hanBH)return {ma:'KHONG_BH'};
    var c=diff(today,x.hanBH);if(c<0)return {ma:'HET_BH',quaNgay:-c};
    return {ma:c<=30?'SAP_HET':'CON_BH',conNgay:c};}
  function num(x){return x===''||x==null?NaN:Number(x);}
  function validateInstall(x,o){x=x||{};o=o||{};var e={},v={loai:up(x.loai),ngay:s(x.ngay,10),maKH:up(x.maKH),maCongTrinh:up(x.maCongTrinh),diaChi:s(x.diaChi,300),tenTaiCT:s(x.tenTaiCT,100),
      soBBBG:s(x.soBBBG,50),ghiChu:s(x.ghiChu,500),viDo:'',kinhDo:'',thangBH:''};
    if(LOAI_LD.indexOf(v.loai)<0)e.loai='Chọn Bàn giao hoặc Di dời';
    if(!iso(v.ngay))e.ngay='Ngày không hợp lệ';else if(o.today&&v.ngay>o.today)e.ngay='Không chọn ngày tương lai';else if(o.ngayXuat&&v.ngay<o.ngayXuat)e.ngay='Không trước ngày xuất kho ('+o.ngayXuat+')';
    if(!v.diaChi)e.diaChi='Nhập địa chỉ / vị trí lắp';
    var la=num(x.viDo),lo=num(x.kinhDo);
    if(!isNaN(la)||!isNaN(lo)){
      if(isNaN(la)||isNaN(lo)){e[isNaN(la)?'viDo':'kinhDo']='Nhập đủ vĩ độ và kinh độ';}
      else{if(!(la>=8&&la<=24))e.viDo='Vĩ độ ngoài Việt Nam (8–24)';if(!(lo>=102&&lo<=110))e.kinhDo='Kinh độ ngoài Việt Nam (102–110)';
        v.viDo=Math.round(la*1e6)/1e6;v.kinhDo=Math.round(lo*1e6)/1e6;}
    }
    if(x.thangBH!==''&&x.thangBH!=null){var t=Number(x.thangBH);if(!(Number.isInteger(t)&&t>=0&&t<=120))e.thangBH='Bảo hành 0–120 tháng';else v.thangBH=t;}
    return Object.keys(e).length?{ok:false,errors:e}:{ok:true,value:v};}
  /* Lịch sử lắp đặt (mọi lần) → bàn giao gốc (tính BH) + vị trí hiện tại (lần mới nhất). thangMacDinh: theo mẫu tủ / mã hàng. */
  function current(hist,thangMacDinh){
    var h=(hist||[]).slice().sort(function(a,b){return a.ngay<b.ngay?-1:a.ngay>b.ngay?1:String(a.thoiGian)<String(b.thoiGian)?-1:1;});if(!h.length)return null;
    var bg=h.filter(function(r){return r.loai==='BAN_GIAO';})[0]||h[0],t=bg.thangBH!==''&&bg.thangBH!=null?Number(bg.thangBH):Number(thangMacDinh);
    if(isNaN(t))t=12;
    return {ngayBanGiao:bg.ngay,hanBH:hanBH(bg.ngay,t),thangBH:t,viTri:h[h.length-1],soLan:h.length};}
  function canMove(a,b){return (TT[a]||[]).indexOf(b)>=0;}
  function validateTicket(x,o){x=x||{};o=o||{};var e={},v={ngay:s(x.ngay,10),moTaLoi:s(x.moTaLoi,1000),nguoiBao:s(x.nguoiBao,150),ghiChu:s(x.ghiChu,500)};
    if(!iso(v.ngay))e.ngay='Ngày không hợp lệ';else if(o.today&&v.ngay>o.today)e.ngay='Không chọn ngày tương lai';
    if(!v.moTaLoi)e.moTaLoi='Mô tả hiện tượng lỗi';
    return Object.keys(e).length?{ok:false,errors:e}:{ok:true,value:v};}
  function validateUpdate(x,cur){x=x||{};var e={},v={trangThai:up(x.trangThai),ketQua:s(x.ketQua,1000),nguyenNhan:up(x.nguyenNhan)};
    if(!canMove(cur,v.trangThai))e.trangThai='Không chuyển từ '+cur+' sang '+v.trangThai;
    if(v.nguyenNhan&&NGUYEN_NHAN.indexOf(v.nguyenNhan)<0)e.nguyenNhan='Chọn nguyên nhân trong danh mục';
    if(v.trangThai==='HOAN_THANH'&&!v.ketQua)e.ketQua='Ghi kết quả xử lý';
    if(v.trangThai==='TU_CHOI'&&!v.ketQua)e.ketQua='Ghi lý do từ chối bảo hành';
    return Object.keys(e).length?{ok:false,errors:e}:{ok:true,value:v};}
  return {addMonths:addMonths,hanBH:hanBH,status:status,validateInstall:validateInstall,current:current,canMove:canMove,validateTicket:validateTicket,validateUpdate:validateUpdate,
    NGUYEN_NHAN:NGUYEN_NHAN,NGOAI_BH:NGOAI_BH,iso:iso};
})();
if(typeof module!=='undefined')module.exports=QBH;
