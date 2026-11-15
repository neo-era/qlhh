/* QLHH core/serial — trạng thái serial theo phiếu kho. Khoá serial = HÃNG|SERIAL (viết hoa, bỏ khoảng trắng đầu/cuối). */
var QSerial=(function(){
  var TEN={TRONG_KHO:'đang trong kho',DA_BAN:'đã bán / đã giao khách',DA_LAP:'đã lắp vào tủ',HUY:'đã huỷ',HANG_LOI:'đang ở kho hàng lỗi',DA_TRA_NCC:'đã trả nhà cung cấp',MAT:'đã ghi mất',DA_THAY:'đã thay ra khi bảo hành',GUI_NCC:'đang gửi nhà cung cấp',XUAT_HUY:'đã xuất huỷ'};   // tên trạng thái cho thông báo
  // loại phiếu → [trạng thái được phép trước, trạng thái sau, kho sau: 'KHO' | 'DEN' | '']
  var MOVE={
    XUAT_BAN:[['TRONG_KHO'],'DA_BAN',''],XUAT_CONG_TRINH:[['TRONG_KHO'],'DA_BAN',''],XUAT_BH:[['TRONG_KHO'],'DA_BAN',''],
    XUAT_SX:[['TRONG_KHO'],'DA_LAP',''],TRA_NCC:[['TRONG_KHO','HANG_LOI'],'DA_TRA_NCC',''],
    CHUYEN_KHO:[['TRONG_KHO','HANG_LOI'],null,'DEN'],KHACH_TRA:[['DA_BAN'],'TRONG_KHO','KHO'],
    NHAP_HANG_LOI:[['DA_BAN','DA_THAY'],'HANG_LOI','KHO'],NHAP_LAI_SX:[['DA_LAP'],'TRONG_KHO','KHO'],
    XUAT_HUY:[['TRONG_KHO','HANG_LOI'],'XUAT_HUY',''],GUI_NCC:[['HANG_LOI'],'GUI_NCC',''],CHUYEN_SUA:[['HANG_LOI'],'TRONG_KHO','DEN'],
    TRA_KHACH_SUA:[['HANG_LOI'],'DA_BAN',''],XUAT_SUA:[['TRONG_KHO'],'DA_BAN',''],CHUYEN_LOI:[['TRONG_KHO'],'HANG_LOI','DEN']
  };
  var NEW=['TON_DAU','NHAP_MUA','NHAP_TP','NHAP_KHAC'];
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
      var nccSent=null,nNew=0;
      if(p.loai==='NHAN_NCC'){nccSent={};var gN=(ctx.vouchers||{})[p.phieuGoc];((gN&&gN.lines)||[]).forEach(function(x){if(x.maHang===l.maHang)(x.serials||[]).forEach(function(z){nccSent[norm(z)]=1;});});}
      for(var j=0;j<ss.length;j++){
        var s=ss[j],k=keyOf(it,s),cur=map[k];
        if(seen[k])return fail('SERIAL_DUP',l.dong,'Serial '+s+' lặp trong phiếu');seen[k]=1;
        var base={key:k,maHang:l.maHang,serial:s,hang:it.hang||'',dong:l.dong,from:cur?cur.trangThai:'',khoTu:cur?cur.kho:''};
        var nhapMoi=NEW.indexOf(p.loai)>=0||(p.loai==='KIEM_KE'&&Number(l.slThucTe)>Number(l.slSoSach));
        if(nhapMoi){
          if(cur&&cur.trangThai!=='HUY')return fail('SERIAL_DUP',l.dong,'Serial '+s+' ('+(it.hang||'không hãng')+') đã có trong hệ thống');
          changes.push(Object.assign(base,{to:p.loai==='KIEM_KE'&&(ctx.khoLoi||[]).indexOf(p.kho)>=0?'HANG_LOI':'TRONG_KHO',kho:p.kho}));continue;
        }
        if(nccSent){   // nhận NCC trả về: serial đang gửi của phiếu gốc (đã sửa) hoặc serial mới (NCC đổi — phải chỉ serial gửi được đổi)
          var toN=(ctx.khoLoi||[]).indexOf(p.kho)>=0?'HANG_LOI':'TRONG_KHO';
          if(cur&&cur.trangThai==='GUI_NCC'&&nccSent[s]){changes.push(Object.assign(base,{to:toN,kho:p.kho}));continue;}
          if(cur&&cur.trangThai!=='HUY')return fail('VALIDATION',l.dong,'Serial '+s+' '+(TEN[cur.trangThai]||cur.trangThai)+' — không phải serial đang gửi NCC theo phiếu gốc');
          nNew++;changes.push(Object.assign(base,{to:toN,kho:p.kho}));continue;
        }
        if(p.loai==='KIEM_KE'){
          if(!cur||(cur.trangThai!=='TRONG_KHO'&&cur.trangThai!=='HANG_LOI')||cur.kho!==p.kho)return fail('SERIAL_NOT_IN_STOCK',l.dong,'Serial '+s+' không có trong kho '+p.kho);
          changes.push(Object.assign(base,{to:'MAT',kho:''}));continue;
        }
        var mv=MOVE[p.loai];if(!mv)return fail('VALIDATION',l.dong,'Loại phiếu không dùng serial');
        if(p.loai==='NHAP_HANG_LOI'&&ctx.choLapDat)mv=[mv[0].concat('DA_LAP'),mv[1],mv[2]];   // chỉ luồng thay linh kiện bảo hành được thu hồi linh kiện đang lắp trong tủ
        if(p.loai==='KHACH_TRA'||p.loai==='TRA_KHACH_SUA'){
          var g=(ctx.vouchers||{})[p.phieuGoc],ok=g&&((g.lines||[]).some(function(x){return x.maHang===l.maHang&&(x.serials||[]).map(norm).indexOf(s)>=0;})
            ||(p.loai==='TRA_KHACH_SUA'&&g.maKH&&(ctx.owners||{})[k]===g.maKH));   // trả khách: cả serial NCC đổi cho hàng của khách
          if(!ok)return fail('VALIDATION',l.dong,'Serial '+s+' không thuộc phiếu xuất gốc');
        }
        var inStock=mv[0].indexOf('TRONG_KHO')>=0||mv[0].indexOf('HANG_LOI')>=0;
        if(cur&&cur.trangThai==='DA_LAP'&&mv[0].indexOf('DA_LAP')<0)return fail('VALIDATION',l.dong,'Serial '+s+' đang lắp trong tủ'+(cur.serialCha?' '+cur.serialCha.split('|')[1]:'')+' — thay linh kiện qua phiếu bảo hành');
        if(cur&&cur.serialCha&&p.loai==='KHACH_TRA')return fail('VALIDATION',l.dong,'Serial '+s+' đang lắp trong tủ '+cur.serialCha.split('|')[1]+' — không nhận trả riêng');
        if(!cur||mv[0].indexOf(cur.trangThai)<0||(inStock&&cur.kho!==p.kho))
          return fail(inStock?'SERIAL_NOT_IN_STOCK':'VALIDATION',l.dong,'Serial '+s+(cur?' '+(TEN[cur.trangThai]||('đang ở trạng thái '+cur.trangThai))+(cur.kho&&cur.trangThai!=='DA_BAN'?' (kho '+cur.kho+')':''):' chưa có trong hệ thống'));
        changes.push(Object.assign(base,{to:mv[1]||cur.trangThai,kho:mv[2]==='KHO'?p.kho:mv[2]==='DEN'?p.khoDen:''}));
      }
      if(nccSent){   // serial gửi đi được NCC đổi bằng serial mới → đã trả NCC
        var doi=(l.serialsDoi||[]).map(norm).filter(function(x){return x;});
        if(doi.length!==nNew)return fail('VALIDATION',l.dong,nNew?'Có '+nNew+' serial mới (NCC đổi) — chọn đúng '+nNew+' serial đã gửi được đổi':'Không có serial mới — bỏ chọn serial được đổi');
        for(var d2=0;d2<doi.length;d2++){var kd=keyOf(it,doi[d2]),cd=map[kd];
          if(seen[kd])return fail('VALIDATION',l.dong,'Serial '+doi[d2]+' vừa nhận lại vừa được đổi');seen[kd]=1;
          if(!cd||cd.trangThai!=='GUI_NCC'||!nccSent[doi[d2]])return fail('VALIDATION',l.dong,'Serial '+doi[d2]+' không phải serial đang gửi NCC theo phiếu gốc');
          changes.push({key:kd,maHang:l.maHang,serial:doi[d2],hang:it.hang||'',dong:l.dong,from:'GUI_NCC',khoTu:'',to:'DA_TRA_NCC',kho:''});}
      }
    }
    return {ok:true,changes:changes,errors:[]};
  }
  // đảo: hist = các thay đổi serial của phiếu gốc (LichSuSerial)
  // alt = {khoá serial: trạng thái hiện tại cũng chấp nhận} — huỷ lần thay linh kiện: linh kiện mới đang lắp trong tủ (DA_LAP) thay cho DA_BAN của phiếu xuất
  function reverse(map,hist,soDao,alt){
    var out=[];
    for(var i=0;i<(hist||[]).length;i++){
      var h=hist[i],cur=map[h.key];
      if(!cur||(cur.trangThai!==h.to&&!(alt&&alt[h.key]===cur.trangThai))||String(cur.kho||'')!==String(h.khoDen||''))
        return {ok:false,code:'VALIDATION',errors:[{dong:0,field:'serials',msg:'Serial '+h.key.split('|')[1]+' đã thay đổi sau phiếu gốc — không đảo được'}],changes:[]};
      out.push({key:h.key,maHang:h.maHang,serial:h.key.split('|')[1],hang:h.key.split('|')[0],from:cur.trangThai,khoTu:h.khoDen||'',to:h.from||'HUY',kho:h.from?h.khoTu:'',soPhieu:soDao});
    }
    return {ok:true,changes:out,errors:[]};
  }
  return {apply:apply,reverse:reverse,index:index,toRecord:toRecord,keyOf:keyOf,norm:norm};
})();
if(typeof module!=='undefined')module.exports=QSerial;
