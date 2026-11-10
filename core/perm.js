/* QLHH core/perm — quyền theo vai trò + lọc dữ liệu nhạy cảm (chạy ở MÁY CHỦ trước khi trả về). */
var QPerm=(function(){
  var READ=['auth.me','sync.pull','feedback.add','voucher.get','sx.get','serial.get'];
  var EDIT=['item.upsert','item.stop','group.upsert','supplier.upsert','price.add','customer.upsert','project.upsert','unit.upsert','voucher.create','lsx.create','lsx.xuatSX','lsx.nhapTP','kcs.add','pxx.issue'];
  var ADMIN=['user.upsert','feedback.update','admin.schemaCheck','warehouse.upsert','voucher.reverse','period.lock','stock.rebuild','report.nxt','template.upsert','lsx.chiPhi','lsx.huy','pxx.cancel'];
  var ACT={XEM:READ,NHAP_LIEU:READ.concat(EDIT),QUAN_TRI:READ.concat(EDIT,ADMIN)};
  var TABS=['items','groups','suppliers','prices','warehouses','units','customers','projects','vouchers','stock','serials','templates','lsx','cabinets','pxx'];
  function can(role,action){return !!ACT[role]&&ACT[role].indexOf(action)>=0;}
  function copy(a){return (a||[]).map(function(o){var c={};for(var k in o)if(k!=='_row')c[k]=o[k];return c;});}
  function filterForRole(role,email,d){
    var out={users:[],feedback:[],logs:[],config:{}};TABS.forEach(function(k){out[k]=[];});
    if(!ACT[role])return out;
    var admin=role==='QUAN_TRI';
    TABS.forEach(function(k){out[k]=copy(d[k]);});
    out.config={ngayKhoaSo:(d.config&&d.config.ngayKhoaSo)||'',maCongTy:(d.config&&d.config.maCongTy)||''};
    if(!admin){
      out.items.forEach(function(i){delete i.giaVon;});
      out.prices=out.prices.filter(function(p){return p.loai!=='NHAP';});
      out.vouchers.forEach(function(p){delete p.tongTien;});
      out.stock.forEach(function(t){delete t.giaTri;});
      out.feedback=copy(d.feedback).filter(function(f){return f.email===email;});
    }else{out.users=copy(d.users);out.feedback=copy(d.feedback);out.logs=copy(d.logs);}
    return out;
  }
  /* Dòng phiếu: người không phải Quản trị không thấy đơn giá / thành tiền / giá trị kho (kể cả phiếu nhập do chính họ lập). */
  function filterLines(role,lines){
    var c=copy(lines);if(role==='QUAN_TRI')return c;
    c.forEach(function(l){delete l.donGia;delete l.thanhTien;delete l.giaTriKho;delete l.chenhLechGV;});return c;
  }
  return {can:can,filterForRole:filterForRole,filterLines:filterLines,ACT:ACT};
})();
if(typeof module!=='undefined')module.exports=QPerm;
