/* QLHH core/price — giá hiệu lực & lịch sử giá. */
var QPrice=(function(){
  function cmp(a,b){return a.tuNgay<b.tuNgay?1:a.tuNgay>b.tuNgay?-1:(String(a.thoiGian)<String(b.thoiGian)?1:String(a.thoiGian)>String(b.thoiGian)?-1:0);}
  function history(prices,maHang,loai,maNCC){
    return prices.filter(function(p){return p.maHang===maHang&&p.loai===loai&&(!maNCC||p.maNCC===maNCC);}).slice().sort(cmp);
  }
  function effective(prices,maHang,loai,date,maNCC){
    var h=history(prices,maHang,loai,maNCC);for(var i=0;i<h.length;i++)if(h[i].tuNgay<=date)return h[i];return null;
  }
  return {history:history,effective:effective};
})();
if(typeof module!=='undefined')module.exports=QPrice;
