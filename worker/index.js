const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"Content-Type, Authorization","access-control-allow-methods":"GET,POST,OPTIONS"}});
const sha256=async s=>{const b=new TextEncoder().encode(s),h=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")};
const token=()=>crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
const products=[
[1,"Nova X1 Ultra","Tech",79999,18],[2,"Vertex 14","Computing",64999,12],[3,"AeroSound Pro","Audio",8999,25],[4,"Pulse Watch 4","Wearables",12999,20],[5,"Orbit Mechanical","Desk",6999,30],[6,"LumaCam 4K","Creator",18999,10],[7,"Flux Mini","Tech",3499,40],[8,"Arc Pad","Computing",45999,14]
];
async function userFrom(request,env){const t=request.headers.get("authorization")?.replace(/^Bearer\s+/,"");if(!t)return null;return await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?").bind(t).first()}
async function api(request,env){
 if(request.method==="OPTIONS")return json({});
 const u=new URL(request.url),path=u.pathname;
 if(path==="/api/health")return json({ok:true,service:"NEXORA Free Cloud API",version:"4.0.0",free:true});
 if(path==="/api/products"&&request.method==="GET"){
  const q=(u.searchParams.get("q")||"").trim().toLowerCase(),cat=(u.searchParams.get("category")||"").trim().toLowerCase();
  let r=await env.DB.prepare("SELECT id,name,category,price,stock FROM products WHERE lower(name) LIKE ? AND lower(category) LIKE ? ORDER BY id").bind("%"+q+"%","%"+cat+"%").all();
  return json({products:r.results,total:r.results.length});
 }
 if(path==="/api/auth/signup"&&request.method==="POST"){
  const b=await request.json().catch(()=>({}));const name=String(b.name||"").trim(),email=String(b.email||"").trim().toLowerCase(),password=String(b.password||"");
  if(!name||!email||password.length<6)return json({error:"Name, email and password (6+ chars) are required"},400);
  const existing=await env.DB.prepare("SELECT id FROM users WHERE lower(trim(email))=lower(trim(?))").bind(email).first();if(existing)return json({error:"An account with this email already exists. Try signing in instead."},409);
  const id=crypto.randomUUID(),hash=await sha256(password),t=token();
  await env.DB.batch([env.DB.prepare("INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)").bind(id,name,email,hash),env.DB.prepare("INSERT INTO sessions(token,user_id) VALUES(?,?)").bind(t,id)]);
  return json({token:t,user:{id,name,email}},201);
 }
 if(path==="/api/auth/logout"&&request.method==="POST"){const t=request.headers.get("authorization")?.replace(/^Bearer\s+/,"");if(t)await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(t).run();return json({ok:true})}
 if(path==="/api/auth/login"&&request.method==="POST"){
  const b=await request.json().catch(()=>({}));const email=String(b.email||"").trim().toLowerCase(),password=String(b.password||"");
  const user=await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  if(!user||user.password_hash!==await sha256(password))return json({error:"Invalid email or password"},401);
  const t=token();await env.DB.prepare("INSERT INTO sessions(token,user_id) VALUES(?,?)").bind(t,user.id).run();
  return json({token:t,user:{id:user.id,name:user.name,email:user.email}});
 }
 if(path==="/api/auth/check"&&request.method==="GET"){const user=await userFrom(request,env);return user?json({authenticated:true,user:{id:user.id,name:user.name,email:user.email}}):json({authenticated:false})}
 if(path==="/api/me"&&request.method==="GET"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);return json({user:{id:user.id,name:user.name,email:user.email}})}
 if(path==="/api/orders"&&request.method==="GET"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);const r=await env.DB.prepare("SELECT id,total,status,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all();return json({orders:r.results})}
 if(path==="/api/profile"&&request.method==="GET"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);const a=await env.DB.prepare("SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,id").bind(user.id).all();return json({user:{id:user.id,name:user.name,email:user.email},addresses:a.results})}
 if(path==="/api/addresses"&&request.method==="POST"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);const b=await request.json().catch(()=>({}));if(!b.line1||!b.city||!b.state||!b.postal)return json({error:"Complete address required"},400);const id=crypto.randomUUID();if(b.is_default)await env.DB.prepare("UPDATE addresses SET is_default=0 WHERE user_id=?").bind(user.id).run();await env.DB.prepare("INSERT INTO addresses(id,user_id,line1,line2,city,state,postal,country,is_default) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,user.id,String(b.line1),String(b.line2||""),String(b.city),String(b.state),String(b.postal),String(b.country||"India"),b.is_default?1:0).run();return json({ok:true,id},201)}
 if(path==="/api/orders/track"&&request.method==="GET"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);const id=u.searchParams.get("id");const o=await env.DB.prepare("SELECT id,total,status,created_at FROM orders WHERE id=? AND user_id=?").bind(id,user.id).first();if(!o)return json({error:"Order not found"},404);return json({order:o})}
 if(path==="/api/reviews"&&request.method==="GET"){const id=Number(u.searchParams.get("product_id"));const r=await env.DB.prepare("SELECT r.rating,r.comment,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=? ORDER BY r.created_at DESC").bind(id).all();return json({reviews:r.results})}
 if(path==="/api/reviews"&&request.method==="POST"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);const b=await request.json().catch(()=>({})),rating=Number(b.rating);if(!b.product_id||rating<1||rating>5)return json({error:"Product and rating 1-5 required"},400);const purchased=await env.DB.prepare("SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.user_id=? AND oi.product_id=? LIMIT 1").bind(user.id,Number(b.product_id)).first();if(!purchased)return json({error:"Purchase required before reviewing"},403);await env.DB.prepare("INSERT INTO reviews(id,product_id,user_id,rating,comment) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),Number(b.product_id),user.id,rating,String(b.comment||"")).run();return json({ok:true},201)}
 if(path==="/api/recently-viewed"&&request.method==="POST"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);const id=Number((await request.json().catch(()=>({}))).product_id);if(!id)return json({error:"Product required"},400);await env.DB.prepare("INSERT OR REPLACE INTO recently_viewed(user_id,product_id,viewed_at) VALUES(?,?,CURRENT_TIMESTAMP)").bind(user.id,id).run();return json({ok:true})}
 if(path==="/api/recently-viewed"&&request.method==="GET"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);const r=await env.DB.prepare("SELECT p.id,p.name,p.category,p.price,p.stock,rv.viewed_at FROM recently_viewed rv JOIN products p ON p.id=rv.product_id WHERE rv.user_id=? ORDER BY rv.viewed_at DESC LIMIT 12").bind(user.id).all();return json({products:r.results})}
 if(path==="/api/coupons/validate"&&request.method==="POST"){const b=await request.json().catch(()=>({}));const code=String(b.code||"").trim().toUpperCase();const x=await env.DB.prepare("SELECT code,type,value,min_total,active FROM coupons WHERE code=?").bind(code).first();if(!x||!x.active)return json({error:"Invalid coupon"},400);const total=Number(b.total||0);if(total<Number(x.min_total))return json({error:"Minimum order value not reached"},400);const discount=x.type==="PERCENT"?Math.floor(total*x.value/100):Math.min(total,x.value);return json({valid:true,discount,total:Math.max(0,total-discount),code})}
 if(path==="/api/orders"&&request.method==="POST"){
  const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);
  const b=await request.json().catch(()=>({})),items=Array.isArray(b.items)?b.items:[];if(!items.length)return json({error:"Cart is empty"},400);
  let total=0,lines=[];
  for(const i of items){const id=Number(i.id),qty=Math.max(1,Number(i.quantity)||1),p=await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(id).first();if(!p)return json({error:"Invalid product"},400);if(qty>p.stock)return json({error:"Insufficient stock for "+p.name},400);total+=p.price*qty;lines.push({id,qty,price:p.price,name:p.name})}
  const orderId="NX-"+crypto.randomUUID().slice(0,8).toUpperCase();
  await env.DB.batch([env.DB.prepare("INSERT INTO orders(id,user_id,total,status) VALUES(?,?,?,'CONFIRMED')").bind(orderId,user.id,total),...lines.map(x=>env.DB.prepare("INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(?,?,?,?)").bind(orderId,x.id,x.qty,x.price)),...lines.map(x=>env.DB.prepare("UPDATE products SET stock=stock-? WHERE id=?").bind(x.qty,x.id))]);
  return json({order:{id:orderId,total,status:"CONFIRMED"}},201);
 }
 return json({error:"Not found"},404);
}
export default{async fetch(request,env,ctx){const u=new URL(request.url);if(u.pathname.startsWith("/api/"))return api(request,env);return env.ASSETS.fetch(request)}};
