const test=require('node:test'),assert=require('node:assert');const I=require('../core/idem.js');
test('requestId mới → chạy, lần 2 trả kết quả cũ',()=>{const st=new Map();let n=0;const run=()=>({so:++n});
 const r1=I.once(st,'a@x','req-0001-abcd',run),r2=I.once(st,'a@x','req-0001-abcd',run),r3=I.once(st,'a@x','req-0001-abcd',run);
 assert.deepEqual(r1,{ok:true,data:{so:1},replay:false});assert.deepEqual(r2,{ok:true,data:{so:1},replay:true});assert.equal(n,1);assert.equal(r3.replay,true);});
test('cùng requestId khác email → FORBIDDEN, không lộ dữ liệu',()=>{const st=new Map();I.once(st,'a@x','req-0001-abcd',()=>({gia:1}));const r=I.once(st,'b@x','req-0001-abcd',()=>({}));assert.equal(r.ok,false);assert.equal(r.code,'FORBIDDEN');assert.equal(r.data,undefined);});
test('requestId sai định dạng → VALIDATION',()=>{for(const id of ['',null,'x'.repeat(65),'có dấu'])assert.equal(I.once(new Map(),'a@x',id,()=>1).code,'VALIDATION');});
test('lệnh lỗi → không lưu, cho chạy lại',()=>{const st=new Map();let n=0;const bad=()=>{n++;throw new Error('x')};assert.throws(()=>I.once(st,'a@x','req-0001-abcd',bad));const r=I.once(st,'a@x','req-0001-abcd',()=>({ok:1}));assert.equal(r.replay,false);});
