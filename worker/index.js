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
  if(await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first())return json({error:"Account already exists"},409);
  const id=crypto.randomUUID(),hash=await sha256(password),t=token();
  await env.DB.batch([env.DB.prepare("INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)").bind(id,name,email,hash),env.DB.prepare("INSERT INTO sessions(token,user_id) VALUES(?,?)").bind(t,id)]);
  return json({token:t,user:{id,name,email}},201);
 }
 if(path==="/api/auth/login"&&request.method==="POST"){
  const b=await request.json().catch(()=>({}));const email=String(b.email||"").trim().toLowerCase(),password=String(b.password||"");
  const user=await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  if(!user||user.password_hash!==await sha256(password))return json({error:"Invalid email or password"},401);
  const t=token();await env.DB.prepare("INSERT INTO sessions(token,user_id) VALUES(?,?)").bind(t,user.id).run();
  return json({token:t,user:{id:user.id,name:user.name,email:user.email}});
 }
 if(path==="/api/me"&&request.method==="GET"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);return json({user:{id:user.id,name:user.name,email:user.email}})}
 if(path==="/api/orders"&&request.method==="GET"){const user=await userFrom(request,env);if(!user)return json({error:"Authentication required"},401);const r=await env.DB.prepare("SELECT id,total,status,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all();return json({orders:r.results})}
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
