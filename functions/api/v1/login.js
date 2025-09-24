function randToken(len=24){ const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join(''); }
export async function onRequestPost(context){
  const { request, env } = context;
  const KV = env.DAOHANG || env.daohang;
  try {
    const body = await request.json().catch(()=>null);
    const password = body?.password;
    if (!password) return new Response(JSON.stringify({ ok:false, msg:'missing password' }), { status:400, headers:{ 'Content-Type':'application/json' }});
    const ADMIN_PW = String(env.AUTH_PASSWORD || '');
    if (!ADMIN_PW) return new Response(JSON.stringify({ ok:false, msg:'server not configured: AUTH_PASSWORD missing' }), { status:500, headers:{ 'Content-Type':'application/json' }});
    if (password !== ADMIN_PW) return new Response(JSON.stringify({ ok:false, msg:'密码错误' }), { status:401, headers:{ 'Content-Type':'application/json' }});
    const token = randToken(24);
    const ttl = Number(env.SESSION_TTL || 86400);
    if (KV) await KV.put('session:'+token, '1', { expirationTtl: ttl });
    const headers = new Headers({ 'Content-Type':'application/json' });
    headers.append('Set-Cookie', `NAV_SESSION=${token}; Max-Age=${ttl}; Path=/; HttpOnly; SameSite=Lax; Secure`);
    return new Response(JSON.stringify({ ok:true, msg:'登录成功' }), { headers });
  } catch (e){
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers:{ 'Content-Type':'application/json' }});
  }
}
