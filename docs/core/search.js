/* QLHH core/search — tìm hàng không dấu, nhiều từ (AND), ưu tiên mã. */
var QSearch=(function(){
  function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'d').toLowerCase().replace(/\s+/g,' ').trim();}
  function buildIndex(items){return items.map(function(i){return {code:norm(i.maHang),text:norm([i.maHang,i.ten,i.quyCach,i.hang,i.nhom].join(' '))};});}
  function search(items,q,idx){
    idx=idx&&idx.length===items.length?idx:buildIndex(items);
    var t=norm(q);if(!t)return items.slice();
    var toks=t.split(' '),out=[];
    for(var i=0;i<items.length;i++){
      var x=idx[i],ok=true;for(var k=0;k<toks.length;k++)if(x.text.indexOf(toks[k])<0){ok=false;break;}
      if(!ok)continue;
      var score=x.code===t?0:x.code.indexOf(t)===0?1:x.code.indexOf(toks[0])>=0?2:3;
      out.push([score,i]);
    }
    out.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
    return out.map(function(p){return items[p[1]];});
  }
  return {norm:norm,buildIndex:buildIndex,search:search};
})();
if(typeof module!=='undefined')module.exports=QSearch;
