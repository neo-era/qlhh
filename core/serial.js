/* QLHH core/serial — trạng thái serial theo phiếu kho. Khoá serial = HÃNG|SERIAL (viết hoa, bỏ khoảng trắng đầu/cuối). */
var QSerial=(function(){
  // loại phiếu → [trạng thái được phép trước, trạng thái sau, kho sau: 'KHO' | 'DEN' | '']
  var MOVE={
    XUAT_BAN:[['TRONG_KHO'],'DA_BAN',''],XUAT_CONG_TRINH:[['TRONG_KHO'],'DA_BAN',''],XUAT_BH:[['TRONG_KHO'],'DA_BAN',''],
    XUAT_SX:[['TRONG_KHO'],'DA_LAP',''],TRA_NCC:[['TRONG_KHO','HANG_LOI'],'DA_TRA_NCC',''],
    CHUYEN_KHO:[['TRONG_KHO','HANG_LOI'],null,'DEN'],KHACH_TRA:[['DA_BAN'],'TRONG_KHO','KHO'],
    NHAP_HANG_LOI:[['DA_BAN','DA_THAY','DA_LAP'],'HANG_LOI','KHO'],NHAP_LAI_SX:[['DA_LAP'],'TRONG_KHO','KHO']
  };
  var NEW=['TON_DAU','NHAP_MUA','NHAP_TP'];
  function norm(s){return String(s===undefined||s===null?'':s).trim().toUpperCase();}
  function keyOf(item,serial){return norm(item&&item.hang)+'|'+norm(serial);}
  function index(rows){var m={};(rows||[]).forEach(function(r){m[r.key]=r;});return m;}
  function toRecord(c){return {key:c.key,maHang:c.maHang,serial:c.serial,hang:c.hang,trangThai:c.to,kho:c.kho};}
  function fail(code,dong,msg){return {ok:false,code:code,errors:[{dong:dong,field:'serials',msg:msg}],changes:[]};}
  function apply(map,p,ctx){
    var items=ctx.items||{},changes=[],seen={};
    for(var i=0;i<(p.lines||[]).length;i++){
      var l=p.lines[i],it=items[l.maHang];if(!it||!it.quanLySerial)continue;
      var ss=(l.serials||[]).map(norm).filter(function(x){return x;});
      var need;
      if(p.loai==='KIEM_KE'){need=Math.abs(Number(l.slThucTe)-Number(l.slSoSach));}
      else need=Number(l.soLuong);
      if(!Number.isInteger(need))return fail('VALIDATION',l.dong,'Hàng quản lý serial: số lượng phải là số nguyên');
      if(ss.length!==need)return fail('VALIDATION',l.dong,'Cần đúng '+need+' số serial (đang có '+ss.length+')');
      for(var j=0;j<ss.length;j++){
        var s=ss[j],k=keyOf(it,s),cur=map[k];
        if(seen[k])return fail('SERIAL_DUP',l.dong,'Serial '+s+' lặp trong phiếu');seen[k]=1;
        var base={key:k,maHang:l.maHang,serial:s,hang:it.hang||'',dong:l.dong,from:cur?cur.trangThai:'',khoTu:cur?cur.kho:''};
        var nhapMoi=NEW.indexOf(p.loai)>=0||(p.loai==='KIEM_KE'&&Number(l.slThucTe)>Number(l.slSoSach));
        if(nhapMoi){
          if(cur&&cur.trangThai!=='HUY')return fail('SERIAL_DUP',l.dong,'Serial '+s+' ('+(it.hang||'không hãng')+') đã có trong hệ thống');
          changes.push(Object.assign(base,{to:'TRONG_KHO',kho:p.kho}));continue;
        }
        if(p.loai==='KIEM_KE'){
          if(!cur||cur.trangThai!=='TRONG_KHO'||cur.kho!==p.kho)return fail('SERIAL_NOT_IN_STOCK',l.dong,'Serial '+s+' không có trong kho '+p.kho);
          changes.push(Object.assign(base,{to:'MAT',kho:''}));continue;
        }
        var mv=MOVE[p.loai];if(!mv)return fail('VALIDATION',l.dong,'Loại phiếu không dùng serial');
        if(p.loai==='KHACH_TRA'){
          var g=(ctx.vouchers||{})[p.phieuGoc],ok=g&&(g.lines||[]).some(function(x){return x.maHang===l.maHang&&(x.serials||[]).map(norm).indexOf(s)>=0;});
          if(!ok)return fail('VALIDATION',l.dong,'Serial '+s+' không thuộc phiếu xuất gốc');
        }
        var inStock=mv[0].indexOf('TRONG_KHO')>=0||mv[0].indexOf('HANG_LOI')>=0;
        if(!cur||mv[0].indexOf(cur.trangThai)<0||(inStock&&cur.kho!==p.kho))
          return fail(inStock?'SERIAL_NOT_IN_STOCK':'VALIDATION',l.dong,'Serial '+s+(cur?' đang ở trạng thái '+cur.trangThai+(cur.kho?' tại kho '+cur.kho:''):' chưa có trong hệ thống'));
        changes.push(Object.assign(base,{to:mv[1]||cur.trangThai,kho:mv[2]==='KHO'?p.kho:mv[2]==='DEN'?p.khoDen:''}));
      }
    }
    return {ok:true,changes:changes,errors:[]};
  }
  // đảo: hist = các thay đổi serial của phiếu gốc (LichSuSerial)
  function reverse(map,hist,soDao){
    var out=[];
    for(var i=0;i<(hist||[]).length;i++){
      var h=hist[i],cur=map[h.key];
      if(!cur||cur.trangThai!==h.to||String(cur.kho||'')!==String(h.khoDen||''))
        return {ok:false,code:'VALIDATION',errors:[{dong:0,field:'serials',msg:'Serial '+h.key.split('|')[1]+' đã thay đổi sau phiếu gốc — không đảo được'}],changes:[]};
      out.push({key:h.key,maHang:h.maHang,serial:h.key.split('|')[1],hang:h.key.split('|')[0],from:h.to,khoTu:h.khoDen||'',to:h.from||'HUY',kho:h.from?h.khoTu:'',soPhieu:soDao});
    }
    return {ok:true,changes:out,errors:[]};
  }
  return {apply:apply,reverse:reverse,index:index,toRecord:toRecord,keyOf:keyOf,norm:norm};
})();
if(typeof module!=='undefined')module.exports=QSerial;
