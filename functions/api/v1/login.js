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

function makeCorsHeaders(request){
  const headers = { 'Content-Type': 'application/json' };
  try {
    const origin = request.headers.get('origin') || request.headers.get('host') || '*';
    // When credentials are used, Access-Control-Allow-Origin cannot be '*'
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  } catch(e){}
  return headers;
}
function randToken(len=24){ const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join(''); }
export async function onRequestPost(context){
  const { request, env } = context;
  const KV = findKV(env);
  try {
    const body = await request.json().catch(()=>null);
    const password = body?.password;
    if (!password) return new Response(JSON.stringify({ ok:false, msg:'密码缺失' }), { status:400, headers: makeCorsHeaders(request) });
    const ADMIN_PW = String(env.AUTH_PASSWORD || '');
    if (!ADMIN_PW) return new Response(JSON.stringify({ ok:false, msg:'服务未配置 AUTH_PASSWORD' }), { status:500, headers: makeCorsHeaders(request) });
    if (password !== ADMIN_PW) return new Response(JSON.stringify({ ok:false, msg:'密码错误' }), { status:401, headers: makeCorsHeaders(request) });
    const token = randToken(24);
    const ttl = Number(env.SESSION_TTL || 86400);
    if (KV) {
      const data = { val: '1', exp: Date.now() + Number(ttl)*1000 };
      await KV.put('session:'+token, JSON.stringify(data));
    }
    // Cookie: include SameSite=None to allow cross-site, but omit Secure unless FORCE_SECURE is set
    let cookie = `NAV_SESSION=${token}; Max-Age=${ttl}; Path=/; HttpOnly; SameSite=None`;
    if (String(env.FORCE_SECURE || '').toLowerCase() === 'true') cookie += '; Secure';
    const headers = makeCorsHeaders(request);
    // Set-Cookie via Headers: note platform must allow Set-Cookie (same-origin recommended)
    const respHeaders = new Headers(headers);
    respHeaders.append('Set-Cookie', cookie);
    return new Response(JSON.stringify({ ok:true, msg:'登录成功' }), { status:200, headers: respHeaders });
  } catch (e){
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers: makeCorsHeaders(request) });
  }
}
