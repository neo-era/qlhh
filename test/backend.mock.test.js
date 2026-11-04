// Chạy Code.gs + lõi trong môi trường Apps Script giả lập (Sheet trong bộ nhớ) để bắt lỗi tích hợp trước khi lên Google.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),crypto=require('crypto');
function env(tokeninfo){
  const sheets={};const mk=n=>{const s={n,d:[],appendRow(r){this.d.push(r.slice())},getLastRow(){return this.d.length},setFrozenRows(){},clear(){this.d=[]},
    getDataRange(){const me=this;return{getValues:()=>me.d.map(r=>r.slice())}},
    getRange(r,c,nr,nc){const me=this;return{getValues:()=>me.d.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+nc)),setValues:v=>{v.forEach((row,i)=>me.d[r-1+i]=row.slice())}}}};return sheets[n]=s;};
  const props={};const cache={};
  const G={sheets,
    SpreadsheetApp:{getActive:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:mk}),flush(){}},
    Session:{getEffectiveUser:()=>({getEmail:()=>'MaiVuLam2020@gmail.com'})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},
    Utilities:{getUuid:()=>crypto.randomUUID(),sleep(){},Charset:{UTF_8:'utf8'},
      computeHmacSha256Signature:(m,k)=>[...crypto.createHmac('sha256',k).update(m).digest()],
      base64EncodeWebSafe:(x,cs)=>Buffer.from(typeof x==='string'?Buffer.from(x,'utf8'):Buffer.from(x.map(b=>b&255))).toString('base64').replace(/\+/g,'-').replace(/\//g,'_'),
      base64DecodeWebSafe:s=>[...Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64')],newBlob:b=>({getDataAsString:()=>Buffer.from(b).toString('utf8')})},
    UrlFetchApp:{fetch:()=>tokeninfo()},
    CacheService:{getScriptCache:()=>({get:k=>cache[k]||null,put:(k,v)=>cache[k]=v})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({t,setMimeType(){return this}})},Logger:{log(){}}};
  // Ẩn Buffer để lõi đi nhánh Apps Script (Utilities), giống môi trường thật
  const src=['core/auth.js','core/idem.js','backend/Code.gs'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+'\nreturn {setup,doPost,props:PropertiesService};';
  const f=new Function(...Object.keys(G).filter(k=>k!=='sheets'),'module','Buffer',src);
  const api=f(...Object.keys(G).filter(k=>k!=='sheets').map(k=>G[k]),undefined,undefined);
  api.sheets=sheets;api.raw=props;return api;
}
const post=(api,o)=>JSON.parse(api.doPost({postData:{contents:JSON.stringify(o)}}).t);
const claims=n=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({aud:'CID',iss:'https://accounts.google.com',exp:String(Math.floor(Date.now()/1000)+600),email:'maivulam2020@gmail.com',email_verified:'true',nonce:n})});
test('setup tạo sheet + chủ là QUAN_TRI (email chuẩn hoá)',()=>{const a=env();a.setup();assert.equal(a.sheets.NguoiDung.d[1][0],'maivulam2020@gmail.com');assert.ok(a.raw.SESSION_KEY.length>40);a.setup();assert.equal(a.sheets.NguoiDung.d.length,2);});
test('đăng nhập → phiên → auth.me',()=>{const a=env(()=>claims('nn'));a.setup();a.raw.CLIENT_ID='CID';
  const l=post(a,{action:'auth.login',idToken:'x',nonce:'nn'});assert.equal(l.ok,true,JSON.stringify(l));
  const m=post(a,{action:'auth.me',session:l.data.session});assert.equal(m.data.email,'maivulam2020@gmail.com');assert.equal(m.data.vaiTro,'QUAN_TRI');});
test('sai nonce / token Google 400 / phiên giả bị từ chối',()=>{const a=env(()=>claims('nn'));a.setup();a.raw.CLIENT_ID='CID';
  assert.equal(post(a,{action:'auth.login',idToken:'x',nonce:'khac'}).code,'AUTH_INVALID');
  const b=env(()=>({getResponseCode:()=>400,getContentText:()=>'{}'}));b.setup();assert.equal(post(b,{action:'auth.login',idToken:'x',nonce:'n'}).code,'AUTH_INVALID');
  assert.equal(post(a,{action:'auth.me',session:'abc.def'}).code,'AUTH_INVALID');assert.equal(post(a,{action:'auth.me'}).code,'AUTH_INVALID');});
test('email không có trong NguoiDung → FORBIDDEN',()=>{const a=env(()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({...JSON.parse(claims('n').getContentText()),email:'la@gmail.com'})}));a.setup();a.raw.CLIENT_ID='CID';assert.equal(post(a,{action:'auth.login',idToken:'x',nonce:'n'}).code,'FORBIDDEN');});
test('ghi: 40 lệnh → số 1..40 không trùng; gửi lại requestId 3 lần → 1 dòng',()=>{const a=env(()=>claims('n'));a.setup();a.raw.CLIENT_ID='CID';const s=post(a,{action:'auth.login',idToken:'x',nonce:'n'}).data.session;
  const so=[];for(let i=0;i<40;i++)so.push(post(a,{action:'spike.write',session:s,requestId:'req-'+String(i).padStart(6,'0')}).data.so);
  assert.deepEqual(so,[...Array(40)].map((_,i)=>i+1));
  const r=[1,2,3].map(()=>post(a,{action:'spike.write',session:s,requestId:'req-lap-lai-01'}));
  assert.equal(new Set(r.map(x=>x.data.so)).size,1);assert.deepEqual(r.map(x=>x.replay),[false,true,true]);assert.equal(a.sheets.SpikeGhi.d.length,42);});
test('bench: seed + read',()=>{const a=env(()=>claims('n'));a.setup();a.raw.CLIENT_ID='CID';const s=post(a,{action:'auth.login',idToken:'x',nonce:'n'}).data.session;
  assert.equal(post(a,{action:'bench.read',session:s}).code,'VALIDATION');assert.equal(post(a,{action:'bench.seed',session:s}).data.chiTiet,50000);
  const r=post(a,{action:'bench.read',session:s});assert.equal(r.data.dongHH,5000);assert.equal(r.data.dongCT,50000);});
test('JSON rác → INTERNAL nhưng vẫn trả JSON',()=>{const a=env();const o=JSON.parse(a.doPost({postData:{contents:'{rác'}}).t);assert.equal(o.ok,false);assert.equal(o.code,'INTERNAL');});
