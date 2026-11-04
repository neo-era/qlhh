// Chạy Code.gs + lõi trong môi trường Apps Script giả lập (Sheet trong bộ nhớ) để bắt lỗi tích hợp trước khi lên Google.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),crypto=require('crypto');
function env(tokeninfo){
  const sheets={};// Mô phỏng Sheets TỰ ĐỔI KIỂU khi appendRow: chuỗi số → số, chuỗi ngày → Date (trừ cột đã đặt định dạng '@')
  const conv=(v,txt)=>{if(txt||typeof v!=='string')return v;if(/^\d+$/.test(v))return Number(v);if(/^\d{4}-\d{2}-\d{2}$/.test(v))return new Date(v);return v;};
  const colIdx=a=>a.charCodeAt(0)-65;
  const mk=n=>{const s={n,d:[],txt:{},appendRow(r){this.d.push(r.map((v,i)=>conv(v,this.txt[i])))},getLastRow(){return this.d.length},setFrozenRows(){},clear(){this.d=[]},
    getDataRange(){const me=this;return{getValues:()=>me.d.map(r=>r.slice())}},
    getRange(r,c,nr,nc){const me=this;
      if(typeof r==='string'){const [a,b]=r.split(':');return{setNumberFormat:f=>{for(let i=colIdx(a);i<=colIdx(b);i++)me.txt[i]=f==='@'}}}
      return{createTextFinder:t=>({matchEntireCell:()=>({findNext:()=>{for(let i=r-1;i<r-1+nr;i++)if(String(me.d[i][c-1])===t)return{getRow:()=>i+1};return null}})}),getValues:()=>me.d.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+nc)),setValues:v=>{v.forEach((row,i)=>{const t=me.d[r-1+i]||(me.d[r-1+i]=[]);row.forEach((x,j)=>t[c-1+j]=x)})}}}};return sheets[n]=s;};
  const props={};const cache={};
  const G={sheets,
    SpreadsheetApp:{getActive:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:mk}),flush(){}},
    Session:{getEffectiveUser:()=>({getEmail:()=>'MaiVuLam2020@gmail.com'})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},
    Utilities:{getUuid:()=>crypto.randomUUID(),sleep(){},DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(a,s)=>[...crypto.createHash('sha256').update(s).digest()],Charset:{UTF_8:'utf8'},
      computeHmacSha256Signature:(m,k)=>[...crypto.createHmac('sha256',k).update(m).digest()],
      base64EncodeWebSafe:(x,cs)=>Buffer.from(typeof x==='string'?Buffer.from(x,'utf8'):Buffer.from(x.map(b=>b&255))).toString('base64').replace(/\+/g,'-').replace(/\//g,'_'),
      base64DecodeWebSafe:s=>[...Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64')],newBlob:b=>({getDataAsString:()=>Buffer.from(b).toString('utf8')})},
    UrlFetchApp:{fetch:()=>tokeninfo()},
    CacheService:{getScriptCache:()=>({get:k=>cache[k]||null,put:(k,v)=>cache[k]=v,remove:k=>{delete cache[k]}})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({t,setMimeType(){return this}})},Logger:{log(){}},console:{error(){},log(){}}};
  // Ẩn Buffer để lõi đi nhánh Apps Script (Utilities), giống môi trường thật
  const src=['core/auth.js','core/idem.js','backend/Code.gs'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+'\nreturn {setup,doPost,props:PropertiesService};';
  const f=new Function(...Object.keys(G).filter(k=>k!=='sheets'),'module','Buffer',src);
  const api=f(...Object.keys(G).filter(k=>k!=='sheets').map(k=>G[k]),undefined,undefined);
  api.sheets=sheets;api.raw=props;return api;
}
const post=(api,o)=>JSON.parse(api.doPost({postData:{contents:JSON.stringify(o)}}).t);
let NONCE='';const nonce=a=>NONCE=post(a,{action:'auth.nonce'}).data.nonce;
const login=(a,tok='tok-'+Math.random())=>{nonce(a);return post(a,{action:'auth.login',idToken:tok});};
const claims=n=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({aud:'CID',iss:'https://accounts.google.com',exp:String(Math.floor(Date.now()/1000)+600),email:'maivulam2020@gmail.com',email_verified:'true',nonce:n===undefined?NONCE:n})});
test('setup tạo sheet + chủ là QUAN_TRI (email chuẩn hoá)',()=>{const a=env();a.setup();assert.equal(a.sheets.NguoiDung.d[1][0],'maivulam2020@gmail.com');assert.ok(a.raw.SESSION_KEY.length>40);a.setup();assert.equal(a.sheets.NguoiDung.d.length,2);});
const ready=()=>{const a=env(()=>claims());a.setup();a.raw.CLIENT_ID='CID';return a;};
test('đăng nhập (nonce máy chủ) → phiên → auth.me',()=>{const a=ready();const l=login(a);assert.equal(l.ok,true,JSON.stringify(l));
  const m=post(a,{action:'auth.me',session:l.data.session});assert.equal(m.data.email,'maivulam2020@gmail.com');assert.equal(m.data.vaiTro,'QUAN_TRI');});
test('nonce do client tự bịa / nonce dùng lại / token dùng lại → từ chối',()=>{
  const a=env(()=>claims('tu-bia'));a.setup();a.raw.CLIENT_ID='CID';assert.equal(post(a,{action:'auth.login',idToken:'x'}).code,'AUTH_INVALID');
  const b=ready();assert.equal(login(b,'tok-1').ok,true);
  assert.equal(post(b,{action:'auth.login',idToken:'tok-2'}).code,'AUTH_INVALID','nonce cũ đã dùng');
  nonce(b);assert.equal(post(b,{action:'auth.login',idToken:'tok-1'}).code,'AUTH_INVALID','token đã dùng');});
test('token Google 400 / phiên giả bị từ chối',()=>{const b=env(()=>({getResponseCode:()=>400,getContentText:()=>'{}'}));b.setup();assert.equal(login(b).code,'AUTH_INVALID');
  const a=ready();assert.equal(post(a,{action:'auth.me',session:'abc.def'}).code,'AUTH_INVALID');assert.equal(post(a,{action:'auth.me'}).code,'AUTH_INVALID');});
test('email không có quyền → FORBIDDEN; thêm vào NguoiDung là dùng được ngay (không cache từ chối)',()=>{let em='la@gmail.com';
  const a=env(()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({...JSON.parse(claims().getContentText()),email:em})}));a.setup();a.raw.CLIENT_ID='CID';
  assert.equal(login(a).code,'FORBIDDEN');a.sheets.NguoiDung.d.push(['la@gmail.com','','XEM',' HOAT_DONG ','']);assert.equal(login(a).ok,true);});
test('ghi: 40 lệnh → số 1..40; gửi lại 3 lần → 1 dòng; requestId toàn số không bị Sheets đổi kiểu',()=>{const a=ready();const s=login(a).data.session;
  const so=[];for(let i=0;i<40;i++)so.push(post(a,{action:'spike.write',session:s,requestId:'req-'+String(i).padStart(6,'0')}).data.so);
  assert.deepEqual(so,[...Array(40)].map((_,i)=>i+1));
  for(const id of ['00000001','20261104']){const r=[1,2,3].map(()=>post(a,{action:'spike.write',session:s,requestId:id}));
    assert.equal(new Set(r.map(x=>x.data.so)).size,1,id);assert.deepEqual(r.map(x=>x.replay),[false,true,true],id);}
  assert.equal(a.sheets.SpikeGhi.d.length,43);});
test('xoá dòng SpikeGhi không gây trùng số (bộ đếm CauHinh)',()=>{const a=ready();const s=login(a).data.session;
  post(a,{action:'spike.write',session:s,requestId:'aaaaaaaa1'});post(a,{action:'spike.write',session:s,requestId:'aaaaaaaa2'});a.sheets.SpikeGhi.d.splice(1,1);
  assert.equal(post(a,{action:'spike.write',session:s,requestId:'aaaaaaaa3'}).data.so,3);});
test('dòng Request JSON hỏng không làm sập lệnh khác',()=>{const a=ready();const s=login(a).data.session;a.sheets.Request.d.push(['hong-0001','x','', '{rác']);
  assert.equal(post(a,{action:'spike.write',session:s,requestId:'moi-00001'}).ok,true);});
test('cùng requestId khác email → FORBIDDEN',()=>{let em='maivulam2020@gmail.com';const a=env(()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({...JSON.parse(claims().getContentText()),email:em})}));a.setup();a.raw.CLIENT_ID='CID';
  a.sheets.NguoiDung.d.push(['b@gmail.com','','NHAP_LIEU','HOAT_DONG','']);const s1=login(a).data.session;em='b@gmail.com';const s2=login(a).data.session;
  post(a,{action:'spike.write',session:s1,requestId:'chung-0001'});const r=post(a,{action:'spike.write',session:s2,requestId:'chung-0001'});assert.equal(r.code,'FORBIDDEN');assert.equal(r.data,undefined);});
test('bench: seed + read',()=>{const a=ready();const s=login(a).data.session;
  assert.equal(post(a,{action:'bench.read',session:s}).code,'VALIDATION');assert.equal(post(a,{action:'bench.seed',session:s}).data.chiTiet,50000);
  const r=post(a,{action:'bench.read',session:s});assert.equal(r.data.dongHH,5000);assert.equal(r.data.dongCT,50000);});
test('JSON rác → INTERNAL, không lộ chi tiết lỗi',()=>{const a=env();const o=JSON.parse(a.doPost({postData:{contents:'{rác'}}).t);assert.equal(o.code,'INTERNAL');assert.equal(o.error,'Lỗi máy chủ, thử lại');});
