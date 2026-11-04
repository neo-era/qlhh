/* QLHH core/schema — định nghĩa sheet đợt ① + kiểm tiêu đề + đọc dòng → object (chịu lỗi). */
var QSchema=(function(){
  var SHEETS={
    HangHoa:{key:'maHang',cols:['maHang','ten','nhom','quyCach','dvt','hang','xuatXu','quanLySerial','thangBH','tonToiThieu','giaBan','giaVon','anhUrl','taiLieuUrl','trangThai','capNhat'],
      num:['thangBH','tonToiThieu','giaBan','giaVon'],text:['maHang','nhom']},
    NhomHang:{key:'maNhom',cols:['maNhom','ten','cha'],text:['maNhom','cha']},
    NhaCungCap:{key:'maNCC',cols:['maNCC','ten','mst','diaChi','lienHe','dienThoai','email','ghiChu','trangThai'],text:['maNCC','mst','dienThoai']},
    BangGia:{key:'id',cols:['id','maHang','loai','maNCC','gia','tuNgay','ghiChu','nguoiTao','thoiGian'],num:['gia'],text:['id','maHang','maNCC','tuNgay']},
    NguoiDung:{key:'email',cols:['email','hoTen','vaiTro','trangThai','ngayTao'],text:['email']},
    NhatKy:{cols:['thoiGian','email','action','doiTuong','id','truoc','sau','requestId'],text:['id','requestId']},
    Request:{key:'requestId',cols:['requestId','email','thoiGian','ketQua'],text:['requestId','email']},
    GopY:{key:'id',cols:['id','thoiGian','email','sao','loai','noiDung','banDung','thietBi','manHinh','trangThai','note'],num:['sao'],text:['id']},
    CauHinh:{key:'key',cols:['key','value'],text:['key']}
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
    var d=SHEETS[name],cols=d.cols,num=d.num||[],rows=[],warnings=[];
    for(var i=1;i<values.length;i++){
      var r=values[i];if(!r||blank(r))continue;
      var o={_row:i+1};
      for(var j=0;j<cols.length;j++){
        var c=cols[j],v=r[j]===undefined?'':r[j];
        if(v instanceof Date)v=new Date(v.getTime()+7*3600e3).toISOString().slice(0,10);   // ngày theo giờ VN
        if(num.indexOf(c)>=0&&v!==''){var n=Number(v);if(!isFinite(n)){warnings.push(name+'!'+(i+1)+': '+c+' không phải số ("'+v+'")');v='';}else v=n;}
        else if(num.indexOf(c)<0)v=typeof v==='string'?v:String(v);
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
