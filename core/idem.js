/* QLHH core/idem — chạy lệnh đúng 1 lần theo (email + requestId). store: Map-like {get,set}. */
var QIdem=(function(){
  var RE=/^[A-Za-z0-9_-]{8,64}$/;
  function once(store,email,rid,run){
    if(typeof rid!=='string'||!RE.test(rid))return {ok:false,code:'VALIDATION',error:'requestId không hợp lệ'};
    var prev=store.get(rid);
    if(prev){if(String(prev.email)!==String(email))return {ok:false,code:'FORBIDDEN',error:'requestId thuộc người khác'};return {ok:true,data:prev.data,replay:true};}
    var data=run();store.set(rid,{email:email,data:data});return {ok:true,data:data,replay:false};
  }
  function validId(rid){return typeof rid==='string'&&RE.test(rid);}
  return {once:once,validId:validId};
})();
if(typeof module!=='undefined')module.exports=QIdem;
