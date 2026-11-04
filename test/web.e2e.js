// E2E: trang thử nghiệm + backend giả lập (Code.gs thật chạy trên Sheet trong bộ nhớ). Chạy: node test/web.e2e.js
const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const src=fs.readFileSync(path.join(__dirname,'backend.mock.test.js'),'utf8');
const envSrc=src.slice(src.indexOf('function env'),src.indexOf('const post='));const env=new Function('fs','crypto','require',envSrc+';return env;')(fs,crypto,require);
process.chdir(path.join(__dirname,'..'));
let nonce='';const api=env(()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({aud:'CID',iss:'accounts.google.com',exp:String(Math.floor(Date.now()/1000)+600),email:'maivulam2020@gmail.com',email_verified:'true',nonce})}));
api.setup();api.raw.CLIENT_ID='CID';
const srv=http.createServer((q,r)=>{let f=path.join('docs',decodeURIComponent(q.url.split('?')[0].split('#')[0]));if(f.endsWith('/'))f+='index.html';
 fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'application/json'});r.end(b)})}).listen(8765);
(async()=>{const b=await chromium.launch();const fails=[];const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails.push(m)};
 for(const [name,vp] of [['doc',{width:390,height:844}],['ngang',{width:844,height:390}],['desktop',{width:1280,height:800}]]){
  const p=await b.newPage({viewport:vp});
  await p.route('https://script.google.com/**',async rt=>{const body=rt.request().postData();await rt.fulfill({contentType:'application/json',body:api.doPost({postData:{contents:body}}).t})});
  await p.goto('http://localhost:8765/');
  await p.fill('#cid','CID');await p.fill('#url','https://script.google.com/macros/s/X/exec');await p.click('#save');
  await p.click('#ping');await p.waitForTimeout(150);
  nonce=JSON.parse(api.doPost({postData:{contents:'{"action":"auth.nonce"}'}}).t).data.nonce;
  await p.goto('about:blank');await p.goto('http://localhost:8765/#id_token=fake-'+name+'&token_type=Bearer');await p.waitForSelector('text=ĐĂNG NHẬP THÀNH CÔNG');
  ok(!(await p.evaluate(()=>location.hash)),name+': xoá token khỏi thanh địa chỉ');
  await p.click('#me');await p.click('#fake');await p.click('#w20');await p.waitForSelector('text=Ghi 20 lệnh');await p.click('#rep');await p.waitForSelector('text=Gửi lặp 3 lần');
  const t=await p.innerText('#log');
  ok(/Ghi 20 lệnh: thành công 20\/20 · số không trùng 20\/20/.test(t),name+': ghi 20/20 không trùng');
  ok(/→ 1 phiếu ✓/.test(t),name+': gửi lặp → 1 phiếu');ok(/bị từ chối \(AUTH_INVALID\) ✓/.test(t),name+': phiên giả bị từ chối');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+': không tràn ngang');
  const small=await p.evaluate(()=>[...document.querySelectorAll('button,input')].filter(e=>e.getBoundingClientRect().height<48).length);ok(small===0,name+': vùng chạm ≥ 48px');
  await p.screenshot({path:`/tmp/spike-${name}.png`,fullPage:true});await p.close();}
 // nonce sai
 const p=await b.newPage();await p.route('https://script.google.com/**',async rt=>{await rt.fulfill({contentType:'application/json',body:api.doPost({postData:{contents:rt.request().postData()}}).t})});
 await p.goto('http://localhost:8765/');await p.fill('#url','https://script.google.com/macros/s/X/exec');await p.fill('#cid','CID');await p.click('#save');
 nonce='dung';await p.evaluate(()=>sessionStorage.setItem('qlhh-nonce','sai'));await p.goto('about:blank');await p.goto('http://localhost:8765/#id_token=fake');await p.waitForSelector('text=Đăng nhập thất bại');ok(true,'nonce sai → đăng nhập thất bại');
 // máy chủ trả HTML
 await p.unroute('https://script.google.com/**');await p.route('https://script.google.com/**',rt=>rt.fulfill({contentType:'text/html',body:'<html>Error</html>'}));await p.click('#ping');await p.waitForTimeout(200);ok(/NOT_JSON/.test(await p.innerText('#log')),'máy chủ trả HTML → báo NOT_JSON, không sập');
 await b.close();srv.close();console.log(fails.length?'THẤT BẠI '+fails.length:'TẤT CẢ ĐẠT');process.exit(fails.length?1:0);})();
