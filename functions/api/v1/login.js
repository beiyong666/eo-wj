function findKV(env){
  try {
    if (!env) return null;
    if (env.DAOHANG) return env.DAOHANG;
    if (env.daohang) return env.daohang;
    const prefer = ['KV','MY_KV','MYKV','KV_STORE','KVSTORE','DAOHANG','daohang'];
    for (const n of prefer){
      if (env[n] && typeof env[n].get === 'function' && typeof env[n].put === 'function') return env[n];
    }
    for (const k of Object.keys(env||{})){
      try {
        const v = env[k];
        if (v && typeof v.get === 'function' && typeof v.put === 'function') return v;
      } catch(e){}
    }
    return null;
  } catch(e){ return null; }
}

function randToken(len=24){ const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join(''); }
export async function onRequestPost(context){
  const { request, env } = context;
  const KV = findKV(env);
  try {
    const body = await request.json().catch(()=>null);
    const password = body?.password;
    if (!password) return new Response(JSON.stringify({ ok:false, msg:'missing password' }), { status:400, headers:{ 'Content-Type':'application/json' }});
    const ADMIN_PW = String(env.AUTH_PASSWORD || '');
    if (!ADMIN_PW) return new Response(JSON.stringify({ ok:false, msg:'server not configured: AUTH_PASSWORD missing' }), { status:500, headers:{ 'Content-Type':'application/json' }});
    if (password !== ADMIN_PW) return new Response(JSON.stringify({ ok:false, msg:'密码错误' }), { status:401, headers:{ 'Content-Type':'application/json' }});
    
    // store session as JSON including expiration timestamp to be compatible with EdgeOne KV
    const token = randToken(24);
    const ttl = Number(env.SESSION_TTL || 86400);
    if (KV) {
      const data = { val: '1', exp: Date.now() + Number(ttl)*1000 };
      try { await KV.put('session:' + token, JSON.stringify(data)); } catch(e) { /* fallback: try again or ignore */ }
    }
    const headers = new Headers({ 'Content-Type':'application/json' });
    headers.append('Set-Cookie', `NAV_SESSION=${token}; Max-Age=${ttl}; Path=/; HttpOnly; SameSite=Lax; Secure`);
    return new Response(JSON.stringify({ ok:true, msg:'登录成功' }), { headers });

  } catch (e){
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers:{ 'Content-Type':'application/json' }});
  }
}
