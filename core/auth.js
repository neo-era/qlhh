/* QLHH core/auth — thuần JS, chạy được cả Apps Script lẫn Node. Không gọi mạng. */
var QAuth=(function(){
  var ISS=['https://accounts.google.com','accounts.google.com'];
  function err(code,msg){return {ok:false,code:code,error:msg};}
  function checkClaims(c,o){
    if(!c||typeof c!=='object')return err('AUTH_INVALID','Token không đọc được');
    if(c.aud!==o.clientId)return err('AUTH_INVALID','Sai ứng dụng (aud)');
    if(ISS.indexOf(c.iss)<0)return err('AUTH_INVALID','Sai nơi cấp (iss)');
    if(String(c.email_verified)!=='true')return err('AUTH_INVALID','Email chưa xác minh');
    if(!o.nonce||c.nonce!==o.nonce)return err('AUTH_INVALID','Sai nonce');
    var exp=Number(c.exp);if(!(exp>o.now))return err('AUTH_EXPIRED','Token hết hạn');
    if(!c.email)return err('AUTH_INVALID','Thiếu email');
    return {ok:true,email:String(c.email).trim().toLowerCase()};
  }
  function b64e(s){return typeof Buffer!=='undefined'?Buffer.from(s,'utf8').toString('base64url'):Utilities.base64EncodeWebSafe(s,Utilities.Charset.UTF_8).replace(/=+$/,'');}
  function b64d(s){return typeof Buffer!=='undefined'?Buffer.from(s,'base64url').toString('utf8'):Utilities.newBlob(Utilities.base64DecodeWebSafe(s+'==='.slice((s.length+3)%4))).getDataAsString();}
  function safeEq(a,b){a=String(a);b=String(b);if(a.length!==b.length)return false;var r=0;for(var i=0;i<a.length;i++)r|=a.charCodeAt(i)^b.charCodeAt(i);return r===0;}
  function issueSession(email,now,ttl,key,hmac){var p=b64e(JSON.stringify({e:email,x:now+ttl}));return p+'.'+hmac(key,p);}
  function verifySession(tok,now,key,hmac){
    try{
      if(typeof tok!=='string')return err('AUTH_INVALID','Thiếu phiên');
      var parts=tok.split('.');if(parts.length!==2||!parts[0]||!parts[1])return err('AUTH_INVALID','Phiên sai định dạng');
      if(!safeEq(hmac(key,parts[0]),parts[1]))return err('AUTH_INVALID','Chữ ký phiên sai');
      var p=JSON.parse(b64d(parts[0]));if(!p||!p.e||!p.x)return err('AUTH_INVALID','Phiên thiếu dữ liệu');
      if(!(p.x>now))return err('AUTH_EXPIRED','Phiên hết hạn');
      return {ok:true,email:p.e,exp:p.x};
    }catch(e){return err('AUTH_INVALID','Phiên không đọc được');}
  }
  return {checkClaims:checkClaims,issueSession:issueSession,verifySession:verifySession,safeEq:safeEq};
})();
if(typeof module!=='undefined')module.exports=QAuth;
