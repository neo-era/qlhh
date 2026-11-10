/* QLHH core/sx — sản xuất tủ: mẫu tủ (định mức + mục kiểm tra), kế hoạch xuất linh kiện, chia giá thành theo tủ,
   dở dang theo lệnh, số xê-ri tủ, số phiếu xuất xưởng, kiểm tra xuất xưởng (KCS). Thuần JS, dùng chung máy chủ/trình duyệt. */
var QSX=(function(){
  var K=typeof QStock!=='undefined'?QStock:require('./stock.js');
  var CTY={DAICHAU:'DC',LAVIPCO:'LV'},KQ=['DAT','KHONG_DAT'];
  function Q(x){return Math.round(Number(x)*1000);}
  function up(x){return String(x==null?'':x).trim().toUpperCase();}
  function txt(x,n){return String(x==null?'':x).trim().slice(0,n||500);}
  function dec3(x){var n=Number(x);return isFinite(n)&&Math.abs(Math.round(n*1000)-n*1000)<1e-6;}

  /* Chia tổng giá trị cho n tủ: phần nguyên đều nhau, tủ cuối nhận phần lẻ (tổng luôn khớp sổ). */
  function split(total,n){total=Math.round(Number(total)||0);n=Math.max(1,Math.floor(n));var b=total>=0?Math.floor(total/n):Math.ceil(total/n),r=[];
    for(var i=0;i<n;i++)r.push(i===n-1?total-b*(n-1):b);return r;}

  /* Dở dang của một lệnh tại ngày: xuất linh kiện + chi phí khác (đến ngày) − đã nhập TP − đã nhập lại. */
  function balance(st,cfg,ngay){st=st||{xv:0,nv:0,tv:0};
    var cp=((cfg&&cfg.chiPhi)||[]).reduce(function(a,c){return !ngay||c.ngay<=ngay?a+Math.round(Number(c.soTien)||0):a;},0);
    return st.xv+cp-st.nv-st.tv;}
  /* Dở dang mọi lệnh tại cuối ngày `ngay` (theo ngày hiệu lực của phiếu, kể cả phiếu đảo tính tại ngày gốc). */
  function wip(vouchers,opts,ngay){
    var e=K.effDates(vouchers,opts),vs=(vouchers||[]).filter(function(p){return e[p.soPhieu]&&e[p.soPhieu]<=ngay;}),r=K.replay(vs,opts),out={};
    Object.keys((opts&&opts.lsx)||{}).forEach(function(s){out[s]=balance(r.lsx[s],opts.lsx[s],ngay);});return out;}

  /* Báo cáo dở dang (TK 154) theo kỳ cho từng lệnh: đầu kỳ + linh kiện (xuất − nhập lại) + chi phí theo khoản mục + kết chuyển huỷ − nhập TP = cuối kỳ. */
  function wipReport(vouchers,opts,from,to){
    var L=(opts&&opts.lsx)||{},prev=new Date(Date.parse(from+'T00:00:00Z')-864e5).toISOString().slice(0,10);
    var dau=wip(vouchers,opts,prev),cuoi=wip(vouchers,opts,to),full=K.replay(vouchers,opts),eff=K.effDates(vouchers,opts),by={},rows={};
    (vouchers||[]).forEach(function(p){by[p.soPhieu]=p;});
    Object.keys(L).forEach(function(s){rows[s]={soLSX:s,dauKy:dau[s]||0,linhKien:0,cp:{},kcHuy:0,nhapTP:0,cuoiKy:cuoi[s]||0};
      (L[s].chiPhi||[]).forEach(function(c){if(c.ngay<from||c.ngay>to)return;rows[s].co=1;var t=Math.round(Number(c.soTien)||0);if(c.loai==='KC_HUY')rows[s].kcHuy+=t;else rows[s].cp[c.loai||'KHAC']=(rows[s].cp[c.loai||'KHAC']||0)+t;});});
    (vouchers||[]).forEach(function(p){
      if(p.trangThai!=='HOAN_TAT')return;var d=eff[p.soPhieu];if(!d||d<from||d>to)return;
      var g=p.loai==='DAO'?by[p.phieuGoc]:p,sign=p.loai==='DAO'?-1:1;if(!g||!g.soLSX||!rows[g.soLSX])return;var r=rows[g.soLSX];r.co=1;
      (g.lines||[]).forEach(function(l){var v=p.loai==='DAO'?(full.lines[g.soPhieu+'#'+l.dong]||0):(full.lines[p.soPhieu+'#'+l.dong]||0);
        if(g.loai==='XUAT_SX')r.linhKien+=sign*v;else if(g.loai==='NHAP_LAI_SX')r.linhKien-=sign*v;else if(g.loai==='NHAP_TP')r.nhapTP+=sign*v;});
    });
    return Object.keys(rows).sort().map(function(s){return rows[s];}).filter(function(r){var k=r.dauKy||r.cuoiKy||r.co;delete r.co;return k;});
  }
  function planIssue(bom,n){return (bom||[]).map(function(b){return {maHang:b.maHang,soLuong:Math.round(Q(b.soLuong)*n)/1000};});}

  /* Phân serial linh kiện (theo thứ tự đã xuất) cho từng tủ: mỗi tủ lấy đúng số lượng định mức của từng mã có serial. */
  function assignChildren(byMa,bom,n){var cur={},out=[];
    for(var i=0;i<n;i++){var a=[];(bom||[]).forEach(function(b){var s=byMa[b.maHang];if(!s||!s.length)return;var c=cur[b.maHang]||0,k=Math.round(Number(b.soLuong));
      for(var j=0;j<k&&c<s.length;j++)a.push(s[c++]);cur[b.maHang]=c;});out.push(a);}
    return out;}

  function serialNo(cty,maHang,nam,so){var m=up(maHang).replace(/[^A-Z0-9]/g,'').slice(0,10);
    return (CTY[cty]||up(cty).slice(0,2))+'-'+m+'-'+nam+'-'+String(so).padStart(4,'0');}
  function pxxNo(so,nam,cty){return String(so).padStart(4,'0')+'/'+nam+'/PXX-'+up(cty);}

  /* Kết quả KCS: đủ mọi mục, mỗi mục DAT/KHONG_DAT, "Không đạt" phải có ghi chú. Tủ đạt khi mọi mục đạt. */
  function kcs(items,res){var e=[],soDat=0;items=items||[];res=res||[];
    if(res.length!==items.length)e.push({stt:0,msg:'Cần kết quả cho đủ '+items.length+' mục'});
    res.forEach(function(r,i){var st=(items[i]&&items[i].stt)||i+1;
      if(KQ.indexOf(r&&r.ketQua)<0)e.push({stt:st,msg:'Chọn Đạt / Không đạt'});
      else if(r.ketQua==='KHONG_DAT'&&!txt(r.ghiChu))e.push({stt:st,msg:'Mục không đạt phải ghi rõ lỗi'});
      if(r&&r.ketQua==='DAT')soDat++;});
    return {ok:!e.length,dat:!e.length&&soDat===items.length,errors:e,soDat:soDat};}

  function validateTemplate(t){t=t||{};var e={},seen={};
    var v={maMau:up(t.maMau),maHang:up(t.maHang),ten:txt(t.ten,200),kichThuoc:txt(t.kichThuoc,100),moTa:txt(t.moTa,1000),vatLieu:txt(t.vatLieu,200),ketCau:txt(t.ketCau,400),filePLC:txt(t.filePLC,200),thongSoDien:txt(t.thongSoDien,400),ghiChuDM:txt(t.ghiChuDM,500),thangBH:Number(t.thangBH===''||t.thangBH==null?12:t.thangBH),
      bom:(t.bom||[]).map(function(b){return {maHang:up(b&&b.maHang),soLuong:Number(b&&b.soLuong),ghiChu:txt(b&&b.ghiChu,200)};}),
      kcs:(t.kcs||[]).map(function(k,i){return {stt:i+1,noiDung:txt(k&&k.noiDung,300),yeuCau:txt(k&&k.yeuCau,300)};})};
    if(!/^[A-Z0-9._-]{1,30}$/.test(v.maMau))e.maMau='Mã mẫu 1–30 ký tự A-Z 0-9 . _ -';
    if(!v.maHang)e.maHang='Chọn mã hàng thành phẩm';
    if(!v.ten)e.ten='Nhập tên mẫu';
    if(!(Number.isInteger(v.thangBH)&&v.thangBH>=0&&v.thangBH<=120))e.thangBH='Bảo hành 0–120 tháng';
    if(!v.bom.length)e.bom='Định mức chưa có linh kiện';
    if(v.bom.length>200)e.bom='Tối đa 200 dòng';
    v.bom.forEach(function(b,i){var k='bom.'+(i+1);
      if(!b.maHang)e[k]='Chọn mã linh kiện';
      else if(b.maHang===v.maHang)e[k]='Định mức không chứa chính thành phẩm';
      else if(seen[b.maHang])e[k]='Trùng mã '+b.maHang;
      else if(!(b.soLuong>0)||!dec3(b.soLuong)||b.soLuong>1e6)e[k]='Số lượng > 0, tối đa 3 số lẻ';
      seen[b.maHang]=1;});
    if(!v.kcs.length)e.kcs='Cần ít nhất một mục kiểm tra';
    v.kcs.forEach(function(k){if(!k.noiDung)e['kcs.'+k.stt]='Nhập nội dung kiểm tra';});
    return Object.keys(e).length?{ok:false,errors:e}:{ok:true,value:v};}

  return {split:split,balance:balance,wip:wip,wipReport:wipReport,planIssue:planIssue,assignChildren:assignChildren,serialNo:serialNo,pxxNo:pxxNo,kcs:kcs,validateTemplate:validateTemplate};
})();
if(typeof module!=='undefined')module.exports=QSX;
