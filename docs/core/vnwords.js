/* QLHH core/vnwords — đọc số tiền bằng chữ tiếng Việt (in chứng từ). */
var QWords=(function(){
  var D=['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
  function tri(n,full){ // 0..999; full = phải đọc đủ "không trăm"
    var h=Math.floor(n/100),t=Math.floor(n%100/10),u=n%10,w=[];
    if(h||full)w.push(D[h]+' trăm');
    if(t===0){if(u&&(h||full))w.push('linh');}
    else if(t===1)w.push('mười');else w.push(D[t]+' mươi');
    if(u){if(u===1&&t>1)w.push('mốt');else if(u===5&&t>0)w.push('lăm');else if(u===4&&t>1)w.push('tư');else w.push(D[u]);}
    return w.join(' ');
  }
  function read(n){
    if(n===0)return 'không';
    var U=['',' nghìn',' triệu',' tỷ',' nghìn tỷ',' triệu tỷ'],g=[],parts=[],i;
    while(n>0){g.push(n%1000);n=Math.floor(n/1000);}
    for(i=g.length-1;i>=0;i--){if(g[i])parts.push(tri(g[i],i<g.length-1)+U[i]);}
    return parts.join(' ');
  }
  function money(n){n=Math.round(Number(n)||0);var neg=n<0,s=read(Math.abs(n))+' đồng';if(neg)s='âm '+s;return s.charAt(0).toUpperCase()+s.slice(1);}
  return {money:money,read:read};
})();
if(typeof module!=='undefined')module.exports=QWords;
