/* QLHH core/stock — sổ kho: tồn theo kho, giá vốn bình quân gia quyền di động theo mã × công ty,
   tính lại theo (ngày phiếu, thứ tự), kiểm không âm theo dòng thời gian, phiếu đảo, khoá sổ, quy đổi ĐVT.
   Thuần JS (không Sheet/DOM) — chạy chung cho Apps Script và trình duyệt. Số lượng tính nội bộ theo phần nghìn. */
var QStock=(function(){
  // dir: +1 tăng, -1 giảm, 0 đặc biệt. cost: PRICE (đơn giá trên phiếu) | GOC (theo dòng xuất gốc) | GIVEN (giá trị tính sẵn) | AVG | ZERO
  var T={
    TON_DAU:{dir:1,cost:'PRICE',pre:'TD',ten:'Tồn đầu kỳ'},
    NHAP_MUA:{dir:1,cost:'PRICE',pre:'PN',ten:'Nhập mua'},
    KHACH_TRA:{dir:1,cost:'GOC',pre:'KT',ten:'Khách trả hàng'},
    NHAP_TP:{dir:1,cost:'GIVEN',pre:'NT',ten:'Nhập thành phẩm'},
    NHAP_LAI_SX:{dir:1,cost:'GOC',pre:'NL',ten:'Nhập lại từ sản xuất'},
    NHAP_HANG_LOI:{dir:1,cost:'ZERO',pre:'HL',ten:'Nhận hàng lỗi'},
    CHUYEN_KHO:{dir:0,pre:'CK',ten:'Chuyển kho'},
    KIEM_KE:{dir:0,pre:'KK',ten:'Kiểm kê'},
    XUAT_BAN:{dir:-1,cost:'AVG',pre:'PX',ten:'Xuất bán'},
    XUAT_CONG_TRINH:{dir:-1,cost:'AVG',pre:'XC',ten:'Xuất công trình'},
    XUAT_BH:{dir:-1,cost:'AVG',pre:'XB',ten:'Xuất bảo hành'},
    XUAT_SX:{dir:-1,cost:'AVG',pre:'XS',ten:'Xuất cho sản xuất'},
    TRA_NCC:{dir:-1,cost:'AVG',pre:'TN',ten:'Trả nhà cung cấp'},
    DAO:{dir:0,pre:'DA',ten:'Phiếu đảo'}
  };
  var LOI_OK=['NHAP_HANG_LOI','TRA_NCC','DAO'];           // loại phiếu được dùng ở kho hàng lỗi
  var TRA_DUOC=['XUAT_BAN','XUAT_CONG_TRINH','XUAT_BH'];   // phiếu gốc của KHACH_TRA
  var MAXP=1e12;
  function Q(x){return Math.round(Number(x)*1000);}
  function R(q){return Math.round(q)/1000;}
  function money(x){return Math.round(Number(x));}
  function isoDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v)))return false;var d=new Date(v+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===v;}
  function dec3(x){var n=Number(x);return isFinite(n)&&Math.abs(Math.round(n*1000)-n*1000)<1e-6;}
  function active(v){return (v||[]).filter(function(p){return p&&p.trangThai==='HOAN_TAT';});}
  function key(p){return p.soPhieu+'';}
  function cmpPos(a,b){return a.ngay<b.ngay?-1:a.ngay>b.ngay?1:(a.stt-b.stt)||(a.sub-b.sub);}
  function loiSet(o){var s={};((o&&o.khoLoi)||[]).forEach(function(k){s[k]=1;});return s;}
  /* Vị trí tính của phiếu đảo: 'GOC' = ngay sau phiếu gốc (coi như phiếu gốc chưa từng có), 'NGAY' = tại ngày phiếu đảo.
     Chốt LÚC LẬP (cột hieuLuc) để khoá sổ về sau không làm đổi giá vốn kỳ đã khoá. Thiếu hieuLuc (dữ liệu cũ/ứng viên) → theo ngày khoá hiện tại. */
  function daoMode(p,g,lock){return p.hieuLuc==='GOC'||p.hieuLuc==='NGAY'?p.hieuLuc:(g&&g.ngay>lock?'GOC':'NGAY');}
  function posOfIn(p,by,lock){
    if(p.loai==='DAO'){var g=by[p.phieuGoc];if(g&&daoMode(p,g,lock)==='GOC')return {ngay:g.ngay,stt:Number(g.stt)||0,sub:1};}
    return {ngay:p.ngay,stt:Number(p.stt)||0,sub:0};
  }
  /* Dòng phiếu gốc ứng với dòng trả (KHACH_TRA / TRA_NCC): theo dongGoc; nhiều dòng cùng mã mà không chỉ rõ → 'MULTI'. */
  function gocLine(g,l){var c=((g&&g.lines)||[]).filter(function(x){return x.maHang===l.maHang;});
    if(l.dongGoc!==undefined&&l.dongGoc!==''&&l.dongGoc!==null)c=c.filter(function(x){return Number(x.dong)===Number(l.dongGoc);});
    return c.length===1?c[0]:c.length?'MULTI':null;}

  // ---------- chạy sổ ----------
  function replay(vouchers,opts){
    opts=opts||{};var loi=loiSet(opts),lock=opts.ngayKhoaSo||'';
    var act=active(vouchers),by={};act.forEach(function(p){by[key(p)]=p;});
    var ev=act.map(function(p){return {p:p,pos:posOfIn(p,by,lock)};}).sort(function(a,b){return cmpPos(a.pos,b.pos);});
    var st={},lines={},errors=[],adj={};
    /* Lệnh sản xuất (soLSX): xv = giá trị linh kiện đã xuất, nq/nv = SL/giá trị thành phẩm đã nhập, tv = giá trị nhập lại.
       Dở dang = xv + chi phí khác (đến ngày) − nv − tv. Nhập TP lấy phần dở dang theo tỷ lệ số tủ còn lại (lần cuối lấy trọn). */
    var Lc=opts.lsx||{},L={};
    function LS(s){return L[s]||(L[s]={xv:0,nq:0,nv:0,tv:0});}
    function cpTo(s,ngay){return ((Lc[s]&&Lc[s].chiPhi)||[]).reduce(function(a,c){return c.ngay<=ngay?a+money(c.soTien):a;},0);}
    function S(ma){return st[ma]||(st[ma]={pq:0,pv:0,kho:{},last:null,la:0});}
    // chốt chặn giá trị: không âm, hết số lượng thì hết giá trị; ghi nhận giá BQ gần nhất
    function vguard(ma,p){var s=S(ma);if(s.pq>0)s.la=s.pv/s.pq;
      if(s.pq>=0&&(s.pv<0||(s.pq===0&&s.pv!==0)))errors.push({code:'NEGV',maHang:ma,kho:'*',soPhieu:p.soPhieu,ngay:p.ngay,giaTri:s.pv});}
    function neg(ma,kh,p){var s=S(ma);if(s.kho[kh]<0)errors.push({code:'NEG',maHang:ma,kho:kh,soPhieu:p.soPhieu,ngay:p.ngay,ton:R(s.kho[kh])});}
    function inn(ma,kh,q,v){var s=S(ma);s.kho[kh]=(s.kho[kh]||0)+q;if(!loi[kh]){s.pq+=q;s.pv+=v;}}
    function out(ma,kh,q,p){var s=S(ma),v=0;s.kho[kh]=(s.kho[kh]||0)-q;
      if(!loi[kh]){if(s.pq>0)v=q>=s.pq?s.pv:money(s.pv*q/s.pq);s.pq-=q;s.pv-=v;if(s.pq<=0&&s.kho[kh]>=0){s.pv=s.pq===0?0:s.pv;}}
      neg(ma,kh,p);return v;}
    /* Giảm tồn theo một giá trị đích (giá gốc): trừ tối đa giá trị đang tồn; SL về 0 thì trừ trọn phần còn lại.
       Phần lệch so với giá đích → adj (điều chỉnh giá vốn, TK 632) để không kẹt khi giá trị tồn không đủ. */
    function capOut(ma,kh,q,target,p){var s=S(ma);if(loi[kh]){out(ma,kh,q,p);return {v:0,d:0};}
      var pq0=s.pq,pv0=s.pv;out(ma,kh,q,p);var rem=q>=pq0?pv0:Math.max(0,Math.min(target,pv0));s.pv=pv0-rem;return {v:rem,d:target-rem};}
    function avgVal(ma,q){var s=S(ma);return s.pq>0?(q>=s.pq?s.pv:money(s.pv*q/s.pq)):money(s.la*q);}
    function doLine(p,l,dir,valueIn){
      var ma=l.maHang,q,v=0;
      if(p.loai==='CHUYEN_KHO'||(p._rev&&p._rev==='CHUYEN_KHO')){
        var from=dir>0?p.kho:p.khoDen,to=dir>0?p.khoDen:p.kho;q=Q(l.soLuong);
        v=avgVal(ma,q);var s=S(ma);s.kho[from]=(s.kho[from]||0)-q;s.kho[to]=(s.kho[to]||0)+q;neg(ma,from,p);return v;
      }
      if(p.loai==='KIEM_KE'||(p._rev&&p._rev==='KIEM_KE')){
        var d=Q(l.slThucTe)-Q(l.slSoSach);if(dir<0)d=-d;
        if(d>0){v=valueIn!==undefined?valueIn:avgVal(ma,d);inn(ma,p.kho,d,v);}
        else if(d<0){if(valueIn!==undefined&&!loi[p.kho]){var cr=capOut(ma,p.kho,-d,valueIn,p);v=cr.v;if(cr.d)adj[p.soPhieu+'#'+l.dong]=cr.d;}else v=out(ma,p.kho,-d,p);}
        return v;
      }
      q=Q(l.soLuong);
      if(dir>0){inn(ma,p.kho,q,valueIn);return valueIn;}
      return out(ma,p.kho,q,p);
    }
    ev.forEach(function(e){
      var p=e.p,t=T[p.loai];if(!t)return;
      if(p.loai==='DAO'){
        var g=by[p.phieuGoc];if(!g||!T[g.loai])return;var tg=T[g.loai],atGoc=daoMode(p,g,lock)==='GOC';
        var rp={soPhieu:p.soPhieu,ngay:p.ngay,kho:g.kho,khoDen:g.khoDen,loai:'DAO',_rev:g.loai};
        (g.lines||[]).forEach(function(l){
          var gv=lines[g.soPhieu+'#'+l.dong]||0,v;
          if(g.loai==='CHUYEN_KHO')v=doLine(rp,l,-1);
          else if(g.loai==='KIEM_KE')v=doLine(rp,l,-1,gv);
          else if(tg.dir>0){
            if(atGoc){v=out(l.maHang,g.kho,Q(l.soLuong),rp);if(!loi[g.kho]&&v!==gv){var s=S(l.maHang);s.pv+=v-gv;v=gv;}}   // ngay sau phiếu gốc: luôn đủ giá trị
            else{var cr=capOut(l.maHang,g.kho,Q(l.soLuong),gv,rp);v=cr.v;if(cr.d)adj[p.soPhieu+'#'+l.dong]=cr.d;}
          }
          else{inn(l.maHang,g.kho,Q(l.soLuong),loi[g.kho]?0:gv);v=gv;var ga=adj[g.soPhieu+'#'+l.dong];if(ga)adj[p.soPhieu+'#'+l.dong]=-ga;}
          if(g.soLSX){var x=LS(g.soLSX);
            if(g.loai==='XUAT_SX')x.xv-=v;
            else if(g.loai==='NHAP_LAI_SX')x.tv-=v;
            else if(g.loai==='NHAP_TP'&&Lc[g.soLSX]){x.nq-=Q(l.soLuong);x.nv-=v;delete adj[p.soPhieu+'#'+l.dong];}}   // trả đúng phần đã rời kho về dở dang
          lines[p.soPhieu+'#'+l.dong]=v;S(l.maHang).last={ngay:p.ngay,stt:Number(p.stt)||0};vguard(l.maHang,rp);
        });
        return;
      }
      (p.lines||[]).forEach(function(l){
        var v,ma=l.maHang;
        if(t.dir>0){
          if(t.cost==='PRICE')v=l.thanhTien!==undefined&&l.thanhTien!==''?money(l.thanhTien):money(Number(l.soLuong)*Number(l.donGia));
          else if(p.loai==='NHAP_TP'&&p.soLSX&&Lc[p.soLSX]){var c=Lc[p.soLSX],x=LS(p.soLSX),k=Q(l.soLuong),rem=Q(c.n)-x.nq,bal=x.xv+cpTo(p.soLSX,p.ngay)-x.nv-x.tv;
            v=k>=rem?bal:money(bal*k/rem);x.nq+=k;x.nv+=v;}
          else if(t.cost==='GIVEN')v=money(l.giaTriKho);
          else if(t.cost==='ZERO')v=0;
          else if(t.cost==='GOC'){var g=by[p.phieuGoc],gl=gocLine(g,l);
            v=gl&&gl!=='MULTI'?money((lines[g.soPhieu+'#'+gl.dong]||0)*Q(l.soLuong)/Q(gl.soLuong)):0;}
          v=doLine(p,l,1,loi[p.kho]?0:v);
          if(p.loai==='NHAP_LAI_SX'&&p.soLSX)LS(p.soLSX).tv+=v;
        }else if(p.loai==='TRA_NCC'&&!loi[p.kho]&&p.phieuGoc){   // trả NCC: theo giá của dòng nhập gốc (khớp công nợ 331)
          var g3=by[p.phieuGoc],gl3=gocLine(g3,l),gv3=gl3&&gl3!=='MULTI'?money((lines[g3.soPhieu+'#'+gl3.dong]||0)*Q(l.soLuong)/Q(gl3.soLuong)):0;
          var cr3=capOut(ma,p.kho,Q(l.soLuong),gv3,p);v=cr3.v;if(cr3.d)adj[p.soPhieu+'#'+l.dong]=cr3.d;
        }else{v=doLine(p,l,t.dir||1);if(p.loai==='XUAT_SX'&&p.soLSX)LS(p.soLSX).xv+=v;}
        lines[p.soPhieu+'#'+l.dong]=v;S(ma).last={ngay:p.ngay,stt:Number(p.stt)||0};vguard(ma,p);
      });
    });
    var ton={};Object.keys(st).forEach(function(ma){var s=st[ma],k={};Object.keys(s.kho).forEach(function(x){k[x]=R(s.kho[x]);});
      ton[ma]={pool:{q:R(s.pq),v:s.pv},kho:k,last:s.last};});
    var lsx={};Object.keys(L).forEach(function(s){var x=L[s];lsx[s]={xv:x.xv,nq:R(x.nq),nv:x.nv,tv:x.tv};});
    return {ton:ton,lines:lines,errors:errors,adj:adj,lsx:lsx};
  }

  // ---------- kiểm phiếu (không cần lịch sử) ----------
  function staticCheck(p,opts){
    var e=[],t=T[p&&p.loai],loi=loiSet(opts);
    if(!p||!t)return [{dong:0,field:'loai',msg:'Loại phiếu không hợp lệ'}];
    if(!isoDate(p.ngay))e.push({dong:0,field:'ngay',msg:'Ngày phiếu không hợp lệ'});
    if(p.loai!=='DAO'){
      if(!p.kho)e.push({dong:0,field:'kho',msg:'Chọn kho'});
      if(loi[p.kho]&&LOI_OK.indexOf(p.loai)<0)e.push({dong:0,field:'kho',msg:'Kho hàng lỗi chỉ dùng cho nhận hàng lỗi / trả NCC'});
      if(p.loai==='NHAP_HANG_LOI'&&!loi[p.kho])e.push({dong:0,field:'kho',msg:'Hàng lỗi phải nhận vào kho hàng lỗi'});
      if(p.loai==='CHUYEN_KHO'){
        if(!p.khoDen||p.khoDen===p.kho)e.push({dong:0,field:'khoDen',msg:'Kho đến phải khác kho đi'});
        else if(!!loi[p.khoDen]!==!!loi[p.kho])e.push({dong:0,field:'khoDen',msg:'Không chuyển giữa kho hàng lỗi và kho thường'});
      }
      if(!p.lines||!p.lines.length)e.push({dong:0,field:'lines',msg:'Phiếu chưa có dòng hàng'});
      (p.lines||[]).forEach(function(l){
        var d=l.dong;
        if(!l.maHang)e.push({dong:d,field:'maHang',msg:'Chọn mã hàng'});
        if(p.loai==='KIEM_KE'){
          if(!(Number(l.slThucTe)>=0)||!dec3(l.slThucTe))e.push({dong:d,field:'slThucTe',msg:'SL thực tế ≥ 0, tối đa 3 số lẻ'});
        }else if(!(Number(l.soLuong)>0)||!dec3(l.soLuong)||Number(l.soLuong)>1e9)e.push({dong:d,field:'soLuong',msg:'Số lượng > 0, tối đa 3 số lẻ'});
        if(t.cost==='PRICE'&&(l.donGia===''||l.donGia===undefined||!(Number(l.donGia)>=0)||Number(l.donGia)>MAXP))e.push({dong:d,field:'donGia',msg:'Đơn giá từ 0 đến 1.000 tỷ'});
        else if(t.cost==='PRICE'&&!Number.isSafeInteger(money(Number(l.thanhTien!==undefined&&l.thanhTien!==''?l.thanhTien:Number(l.soLuong)*Number(l.donGia)))))e.push({dong:d,field:'donGia',msg:'Thành tiền quá lớn'});
        if(t.cost==='GIVEN'&&!(p.loai==='NHAP_TP'&&p.soLSX)&&!(Number.isSafeInteger(Number(l.giaTriKho))&&Number(l.giaTriKho)>=0))e.push({dong:d,field:'giaTriKho',msg:'Giá trị nhập kho phải là số nguyên ≥ 0'});
      });
    }
    return e;
  }

  function reversedSet(all){var s={};active(all).forEach(function(p){if(p.loai==='DAO')s[p.phieuGoc]=1;});return s;}

  function contextCheck(all,p,opts){
    var e=[],act=active(all),by={};act.forEach(function(x){by[key(x)]=x;});var rev=reversedSet(all),loi=loiSet(opts),lock=(opts&&opts.ngayKhoaSo)||'';
    function refs(so,loai){return act.some(function(x){return x.loai===loai&&x.phieuGoc===so&&!rev[x.soPhieu];});}
    // phiếu trả (khách trả / trả NCC): mỗi dòng ứng 1 dòng gốc, không vượt số còn lại của dòng gốc
    function capCheck(g,loai,word){(p.lines||[]).forEach(function(l){
      var gl=gocLine(g,l);
      if(gl==='MULTI'){e.push({dong:l.dong,field:'dongGoc',msg:'Phiếu gốc có nhiều dòng mã '+l.maHang+' — chọn dòng gốc'});return;}
      if(!gl){e.push({dong:l.dong,field:'maHang',msg:'Mã '+l.maHang+' không có trong phiếu gốc'});return;}
      var da=0;act.forEach(function(x){if(x.loai===loai&&x.phieuGoc===g.soPhieu&&!rev[x.soPhieu])(x.lines||[]).forEach(function(y){var yl=gocLine(g,y);if(yl&&yl!=='MULTI'&&yl.dong===gl.dong)da+=Q(y.soLuong);});});
      if(da+Q(l.soLuong)>Q(gl.soLuong))e.push({dong:l.dong,field:'soLuong',msg:word+' vượt số của phiếu gốc (còn '+R(Q(gl.soLuong)-da)+')'});
    });}
    if(by[key(p)])e.push({dong:0,field:'soPhieu',msg:'Số phiếu đã tồn tại'});
    if(p.loai==='DAO'){
      var g=by[p.phieuGoc];
      if(!g)e.push({dong:0,field:'phieuGoc',msg:'Không tìm thấy phiếu gốc'});
      else if(g.loai==='DAO')e.push({dong:0,field:'phieuGoc',msg:'Không đảo phiếu đảo'});
      else if(rev[g.soPhieu])e.push({dong:0,field:'phieuGoc',msg:'Phiếu gốc đã được đảo'});
      else if(p.ngay<g.ngay)e.push({dong:0,field:'ngay',msg:'Ngày phiếu đảo không trước ngày phiếu gốc'});
      else if(refs(g.soPhieu,'KHACH_TRA'))e.push({dong:0,field:'phieuGoc',msg:'Phiếu đã có khách trả hàng — đảo phiếu khách trả trước'});
      else if(refs(g.soPhieu,'TRA_NCC'))e.push({dong:0,field:'phieuGoc',msg:'Phiếu đã có phiếu trả NCC — đảo phiếu trả NCC trước'});
      else if(refs(g.soPhieu,'NHAP_LAI_SX'))e.push({dong:0,field:'phieuGoc',msg:'Phiếu xuất đã có phiếu nhập lại — đảo phiếu nhập lại trước'});
      else if(g.loai==='XUAT_SX'&&g.soLSX&&act.some(function(x){return x.loai==='NHAP_TP'&&x.soLSX===g.soLSX&&!rev[x.soPhieu];}))e.push({dong:0,field:'phieuGoc',msg:'Lệnh '+g.soLSX+' đã nhập thành phẩm — đảo phiếu nhập thành phẩm trước'});
    }
    // không chèn phiếu trước phiếu kiểm kê cùng mã × kho (làm mất kết quả đếm thực tế) — muốn ghi thì đảo phiếu kiểm kê trước
    (function(){
      var g=p.loai==='DAO'?by[p.phieuGoc]:null,src=g||p,pos=p.loai==='DAO'?posOfIn(Object.assign({},p,{hieuLuc:daoMode(p,g,lock)}),by,lock):{ngay:p.ngay,stt:Infinity,sub:0};
      if(p.loai==='DAO'&&!g)return;
      var khos=[src.kho,src.khoDen].filter(Boolean),mas={};(src.lines||[]).forEach(function(l){mas[l.maHang]=1;});
      act.forEach(function(x){
        if(x.loai!=='KIEM_KE'||rev[x.soPhieu]||(g&&x.soPhieu===g.soPhieu)||khos.indexOf(x.kho)<0)return;
        if(cmpPos({ngay:x.ngay,stt:Number(x.stt)||0,sub:0},pos)<=0)return;
        (x.lines||[]).forEach(function(y){if(mas[y.maHang])e.push({dong:0,field:'ngay',msg:'Mã '+y.maHang+' đã kiểm kê kho '+x.kho+' ngày '+x.ngay+' ('+x.soPhieu+') — không ghi lùi trước ngày kiểm kê; đảo phiếu kiểm kê trước'});});
      });
    })();
    if(p.loai==='KIEM_KE'){   // kiểm kê phải là phiếu mới nhất của mã tại kho đó
      var mk={};(p.lines||[]).forEach(function(l){mk[l.maHang]=1;});
      act.forEach(function(x){if(rev[x.soPhieu]||x.loai==='DAO'||cmpPos({ngay:x.ngay,stt:Number(x.stt)||0,sub:0},{ngay:p.ngay,stt:Number(p.stt)||Infinity,sub:0})<=0)return;
        if([x.kho,x.khoDen].indexOf(p.kho)<0)return;
        (x.lines||[]).forEach(function(y){if(mk[y.maHang])e.push({dong:0,field:'ngay',msg:'Kiểm kê phải có ngày không trước phiếu cuối của mã '+y.maHang+' ('+x.soPhieu+' ngày '+x.ngay+')'});});});
    }
    if(p.loai==='TRA_NCC'&&!loi[p.kho]){
      var g4=by[p.phieuGoc];
      if(!g4||['NHAP_MUA','TON_DAU'].indexOf(g4.loai)<0||rev[g4.soPhieu])e.push({dong:0,field:'phieuGoc',msg:'Trả NCC từ kho thường phải chọn phiếu nhập gốc còn hiệu lực'});
      else if(g4.kho!==p.kho)e.push({dong:0,field:'kho',msg:'Trả từ đúng kho đã nhập ('+g4.kho+')'});
      else{if(p.ngay<g4.ngay)e.push({dong:0,field:'ngay',msg:'Ngày trả không trước ngày nhập'});capCheck(g4,'TRA_NCC','Trả NCC');}
    }
    if(p.loai==='XUAT_SX'||p.loai==='NHAP_LAI_SX'||(p.loai==='NHAP_TP'&&p.soLSX)){   // phiếu sản xuất gắn lệnh
      var Lc=(opts&&opts.lsx)||{},s=p.soLSX,c=Lc[s];
      if(!s)e.push({dong:0,field:'soLSX',msg:'Phiếu sản xuất phải gắn lệnh sản xuất'});
      else if(!c)e.push({dong:0,field:'soLSX',msg:'Không tìm thấy lệnh sản xuất '+s});
      else{
        var mine=act.filter(function(x){return x.soLSX===s&&x.loai!=='DAO'&&!rev[x.soPhieu];}),tps=mine.filter(function(x){return x.loai==='NHAP_TP';});
        if(p.loai==='XUAT_SX'&&tps.length)e.push({dong:0,field:'soLSX',msg:'Lệnh '+s+' đã nhập thành phẩm — không xuất bổ sung linh kiện'});
        if(p.loai==='NHAP_TP'){
          var nq=0;tps.forEach(function(x){(x.lines||[]).forEach(function(y){nq+=Q(y.soLuong);});});
          var k=0;(p.lines||[]).forEach(function(l){k+=Q(l.soLuong);});
          if((p.lines||[]).length!==1)e.push({dong:0,field:'lines',msg:'Phiếu nhập thành phẩm chỉ một dòng'});
          if(nq+k>Q(c.n))e.push({dong:1,field:'soLuong',msg:'Vượt số lượng của lệnh (còn '+R(Q(c.n)-nq)+')'});
          var lx='';mine.forEach(function(x){if(x.loai==='XUAT_SX'&&x.ngay>lx)lx=x.ngay;});
          if(p.ngay<lx)e.push({dong:0,field:'ngay',msg:'Ngày nhập thành phẩm không trước lần xuất linh kiện cuối ('+lx+')'});
        }
        if(p.loai==='NHAP_LAI_SX'){
          var g5=by[p.phieuGoc];
          if(!g5||g5.loai!=='XUAT_SX'||g5.soLSX!==s||rev[g5.soPhieu])e.push({dong:0,field:'phieuGoc',msg:'Nhập lại phải theo phiếu xuất sản xuất của cùng lệnh'});
          else if(g5.kho!==p.kho)e.push({dong:0,field:'kho',msg:'Nhập lại đúng kho đã xuất ('+g5.kho+')'});
          else{if(p.ngay<g5.ngay)e.push({dong:0,field:'ngay',msg:'Ngày nhập lại không trước ngày xuất'});capCheck(g5,'NHAP_LAI_SX','Nhập lại');}
        }
      }
    }
    if(p.loai==='TON_DAU')(p.lines||[]).forEach(function(l){
      if(act.some(function(x){return x.loai==='TON_DAU'&&!rev[x.soPhieu]&&x.kho===p.kho&&(x.lines||[]).some(function(y){return y.maHang===l.maHang;});}))
        e.push({dong:l.dong,field:'maHang',msg:'Mã '+l.maHang+' đã có tồn đầu kỳ ở kho '+p.kho});
    });
    if(p.loai==='KHACH_TRA'){
      var g2=by[p.phieuGoc];
      if(!g2||TRA_DUOC.indexOf(g2.loai)<0||rev[g2.soPhieu])e.push({dong:0,field:'phieuGoc',msg:'Phiếu gốc phải là phiếu xuất cho khách còn hiệu lực'});
      else{
        if(p.ngay<g2.ngay)e.push({dong:0,field:'ngay',msg:'Ngày trả không trước ngày xuất'});
        capCheck(g2,'KHACH_TRA','Trả');
      }
    }
    return e;
  }

  function errKey(x){return x.code+'|'+x.soPhieu+'|'+x.maHang+'|'+x.kho;}

  function check(all,p,opts){
    opts=opts||{};var lock=opts.ngayKhoaSo||'';
    var e=staticCheck(p,opts);if(e.length)return {ok:false,code:'VALIDATION',errors:e};
    if(lock&&p.ngay<=lock)return {ok:false,code:'PERIOD_LOCKED',errors:[{dong:0,field:'ngay',msg:'Kỳ đến '+lock+' đã khoá sổ'}]};
    e=contextCheck(all,p,opts);if(e.length)return {ok:false,code:'VALIDATION',errors:e};
    var by={};active(all).forEach(function(x){by[key(x)]=x;});
    var hl=p.loai==='DAO'?daoMode(p,by[p.phieuGoc],lock):'';
    var cand=Object.assign({},p,{trangThai:'HOAN_TAT'},hl?{hieuLuc:hl}:{});
    var before=replay(all,opts),after=replay(active(all).concat([cand]),opts);
    var old={};before.errors.forEach(function(x){old[errKey(x)]=1;});
    var fresh=after.errors.filter(function(x){return !old[errKey(x)];});
    var fv=fresh.filter(function(x){return x.code==='NEGV';});
    if(fv.length)return {ok:false,code:'VALIDATION',errors:[{dong:0,field:'giaTri',maHang:fv[0].maHang,msg:'Phiếu làm giá trị tồn của mã '+fv[0].maHang+' âm hoặc lệch (ngày '+fv[0].ngay+') — kiểm tra lại giá, hoặc nhờ kế toán lập điều chỉnh giá vốn'}]};
    if(fresh.length){
      var later=fresh.some(function(x){return x.soPhieu!==p.soPhieu;});
      return {ok:false,code:later?'NEGATIVE_STOCK_LATER':'STOCK_NOT_ENOUGH',errors:fresh};
    }
    var changes=[];
    active(all).forEach(function(x){(x.lines||[]).forEach(function(l){
      if(x.loai==='DAO')return;var k=x.soPhieu+'#'+l.dong,nv=after.lines[k],na=after.adj[k]||0;
      if(l.giaTriKho!==undefined&&l.giaTriKho!==''&&nv!==undefined&&(Number(l.giaTriKho)!==nv||(Number(l.chenhLechGV)||0)!==na))changes.push({soPhieu:x.soPhieu,dong:l.dong,maHang:l.maHang,ngay:x.ngay,old:Number(l.giaTriKho),new:nv,adj:na});
    });});
    if(lock&&changes.some(function(c){return c.ngay<=lock;}))return {ok:false,code:'PERIOD_LOCKED',errors:[{dong:0,field:'ngay',msg:'Phiếu làm đổi giá vốn trong kỳ đã khoá sổ'}]};
    return {ok:true,result:after,changes:changes,pos:posOfIn(cand,by,lock),hieuLuc:hl};
  }

  // ---------- đường nhanh: phiếu mới nằm sau mọi phiếu của các mã liên quan ----------
  var FAST=['NHAP_MUA','NHAP_HANG_LOI','CHUYEN_KHO','KIEM_KE','XUAT_BAN','XUAT_CONG_TRINH','XUAT_BH','TRA_NCC'];   // phiếu sản xuất luôn qua đường đầy đủ (ràng buộc theo lệnh)
  function applyFast(ton,p,opts){
    opts=opts||{};if(FAST.indexOf(p.loai)<0)return null;
    if(p.loai==='TRA_NCC'&&!loiSet(opts)[p.kho])return null;   // cần phiếu nhập gốc → đường đầy đủ
    if(p.loai==='KIEM_KE'&&(p.lines||[]).some(function(l){var t0=ton&&ton[l.maHang];return !t0||!(t0.pool.q>0);}))return null;   // tồn 0: cần giá BQ gần nhất từ lịch sử
    var pos={ngay:p.ngay,stt:Number(p.stt)||0,sub:0},mas={};
    for(var i=0;i<(p.lines||[]).length;i++){var m=p.lines[i].maHang,t0=ton&&ton[m];
      if(t0&&t0.last&&cmpPos({ngay:t0.last.ngay,stt:t0.last.stt,sub:0},pos)>0)return null;mas[m]=1;}
    var e=staticCheck(p,opts);if(e.length)return {ok:false,code:'VALIDATION',errors:e};
    var lock=opts.ngayKhoaSo||'';if(lock&&p.ngay<=lock)return {ok:false,code:'PERIOD_LOCKED',errors:[{dong:0,field:'ngay',msg:'Kỳ đến '+lock+' đã khoá sổ'}]};
    // dựng "phiếu tồn" tương đương rồi chạy cùng bộ máy với phiếu mới → kết quả trùng tính lại toàn bộ
    var loi=loiSet(opts),fake=[],n=0;
    Object.keys(mas).forEach(function(m){var t0=ton&&ton[m];if(!t0)return;
      var ks=Object.keys(t0.kho),pv=t0.pool.v,pq=Q(t0.pool.q),acc=0,poolK=ks.filter(function(k){return !loi[k]&&Q(t0.kho[k])!==0;});
      ks.forEach(function(k){var q=Q(t0.kho[k]);if(q===0)return;var v=0;
        if(!loi[k]){poolK.splice(poolK.indexOf(k),1);v=poolK.length&&pq>0?money(pv*q/pq):pv-acc;acc+=v;}
        fake.push({soPhieu:'~'+(++n),stt:-1e9+n,loai:q>0?'NHAP_TP':'XUAT_BAN',ngay:'0000-01-01',kho:k,trangThai:'HOAN_TAT',lines:[{dong:1,maHang:m,soLuong:R(Math.abs(q)),giaTriKho:v}]});});
    });
    var r=replay(fake.concat([Object.assign({},p,{trangThai:'HOAN_TAT'})]),opts);
    var bad=r.errors.filter(function(x){return x.soPhieu===p.soPhieu;});
    if(bad.some(function(x){return x.code==='NEGV';}))return {ok:false,code:'VALIDATION',errors:[{dong:0,field:'giaTri',msg:'Phiếu làm giá trị tồn âm hoặc lệch'}]};
    if(bad.length)return {ok:false,code:'STOCK_NOT_ENOUGH',errors:bad};
    var out={};Object.keys(ton||{}).forEach(function(m){out[m]=ton[m];});
    Object.keys(mas).forEach(function(m){var x=r.ton[m];out[m]={pool:x.pool,kho:Object.assign({},(ton&&ton[m]&&ton[m].kho)||{},x.kho),last:{ngay:p.ngay,stt:Number(p.stt)||0}};});
    var ln={};(p.lines||[]).forEach(function(l){ln[p.soPhieu+'#'+l.dong]=r.lines[p.soPhieu+'#'+l.dong];});
    return {ok:true,result:{ton:out,lines:ln,errors:[],adj:{}},changes:[],pos:pos};
  }

  // ---------- quy đổi ĐVT: dòng nhập theo ĐVT phụ → ĐVT chính ----------
  function convert(l,item,qd){
    var dvt=l.dvt||item.dvt,soCT=Number(l.soLuongCT!==undefined?l.soLuongCT:l.soLuong),gia=l.gia!==undefined?Number(l.gia):undefined;
    if(!item||dvt===item.dvt)return {soLuong:soCT,donGia:gia,heSo:1,dvt:dvt};
    var r=(qd||[]).filter(function(x){return x.maHang===item.maHang&&x.dvtPhu===dvt;})[0];
    if(!r||!(Number(r.heSo)>0))return {error:'Không có quy đổi '+dvt+' → '+item.dvt};
    var h=Number(r.heSo);
    return {soLuong:R(Q(soCT*h)),donGia:gia===undefined?undefined:gia/h,heSo:h,dvt:dvt};
  }


  // ---------- báo cáo Nhập – Xuất – Tồn theo kỳ (giá trị toàn công ty, không gồm kho hàng lỗi) ----------
  function effDate(p,by,lock){return posOfIn(p,by,lock).ngay;}
  function nxt(vouchers,from,to,opts){
    opts=opts||{};var lock=opts.ngayKhoaSo||'',loi=loiSet(opts),act=active(vouchers),by={};act.forEach(function(p){by[key(p)]=p;});
    var all=replay(act,opts),dau=replay(act.filter(function(p){return effDate(p,by,lock)<from;}),opts),cuoi=replay(act.filter(function(p){return effDate(p,by,lock)<=to;}),opts);
    var rows={};function R0(m){return rows[m]||(rows[m]={maHang:m,dauQ:0,dauV:0,nhapQ:0,nhapV:0,xuatQ:0,xuatV:0,cuoiQ:0,cuoiV:0,dcV:0});}
    function add(m,sign,q,v){var r=R0(m);if(sign>0){r.nhapQ+=q;r.nhapV+=v;}else{r.xuatQ+=q;r.xuatV+=v;}}
    act.forEach(function(p){
      var d=effDate(p,by,lock);if(d<from||d>to)return;var t=T[p.loai];if(!t||p.loai==='CHUYEN_KHO')return;
      Object.keys(all.adj).forEach(function(k){if(k.indexOf(p.soPhieu+'#')!==0)return;var dg=Number(k.split('#')[1]),src=p.loai==='DAO'?by[p.phieuGoc]:p,ln=src&&(src.lines||[]).filter(function(x){return Number(x.dong)===dg;})[0];if(ln)R0(ln.maHang).dcV+=all.adj[k];});
      if(p.loai==='DAO'){var g=by[p.phieuGoc];if(!g||g.loai==='CHUYEN_KHO'||!T[g.loai])return;var tg=T[g.loai];
        (g.lines||[]).forEach(function(l){if(loi[g.kho])return;var v=all.lines[p.soPhieu+'#'+l.dong]||0;
          if(g.loai==='KIEM_KE'){var dd=Q(l.slThucTe)-Q(l.slSoSach);add(l.maHang,dd>0?1:-1,-Math.abs(dd),-v);}
          else add(l.maHang,tg.dir,-Q(l.soLuong),-v);});return;}
      if(loi[p.kho])return;
      (p.lines||[]).forEach(function(l){var v=all.lines[p.soPhieu+'#'+l.dong]||0;
        if(p.loai==='KIEM_KE'){var dd=Q(l.slThucTe)-Q(l.slSoSach);if(dd)add(l.maHang,dd>0?1:-1,Math.abs(dd),v);}
        else add(l.maHang,t.dir,Q(l.soLuong),v);});
    });
    [[dau,'dau'],[cuoi,'cuoi']].forEach(function(x){Object.keys(x[0].ton).forEach(function(m){var r=R0(m);r[x[1]+'Q']=Q(x[0].ton[m].pool.q);r[x[1]+'V']=x[0].ton[m].pool.v;});});
    return Object.keys(rows).sort().map(function(m){var r=rows[m];['dauQ','nhapQ','xuatQ','cuoiQ'].forEach(function(k){r[k]=R(r[k]);});return r;});
  }
  function prefix(loai){return T[loai]?T[loai].pre:'';}
  return {TYPES:T,effDate:function(p,all,opts){var by={};active(all).forEach(function(x){by[key(x)]=x;});return effDate(p,by,(opts&&opts.ngayKhoaSo)||'');},nxt:nxt,replay:replay,check:check,applyFast:applyFast,convert:convert,staticCheck:staticCheck,prefix:prefix,money:money,isoDate:isoDate};
})();
if(typeof module!=='undefined')module.exports=QStock;
