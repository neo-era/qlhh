/* QLHH core/perm — quyền theo vai trò + lọc dữ liệu nhạy cảm (chạy ở MÁY CHỦ trước khi trả về). */
var QPerm=(function(){
  var READ=['auth.me','sync.pull','feedback.add'];
  var EDIT=['item.upsert','item.stop','group.upsert','supplier.upsert','price.add'];
  var ADMIN=['user.upsert','feedback.update','admin.schemaCheck'];
  var ACT={XEM:READ,NHAP_LIEU:READ.concat(EDIT),QUAN_TRI:READ.concat(EDIT,ADMIN)};
  function can(role,action){return !!ACT[role]&&ACT[role].indexOf(action)>=0;}
  function copy(a){return (a||[]).map(function(o){var c={};for(var k in o)if(k!=='_row')c[k]=o[k];return c;});}
  function filterForRole(role,email,d){
    var out={items:[],groups:[],suppliers:[],prices:[],users:[],feedback:[],logs:[]};
    if(!ACT[role])return out;
    var admin=role==='QUAN_TRI';
    out.items=copy(d.items);out.groups=copy(d.groups);out.suppliers=copy(d.suppliers);out.prices=copy(d.prices);
    if(!admin){
      out.items.forEach(function(i){delete i.giaVon;});
      out.prices=out.prices.filter(function(p){return p.loai!=='NHAP';});
      out.feedback=copy(d.feedback).filter(function(f){return f.email===email;});
    }else{out.users=copy(d.users);out.feedback=copy(d.feedback);out.logs=copy(d.logs);}
    return out;
  }
  return {can:can,filterForRole:filterForRole,ACT:ACT};
})();
if(typeof module!=='undefined')module.exports=QPerm;
