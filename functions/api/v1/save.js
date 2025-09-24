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
export async function onRequestPost(context){
  const { request, env } = context;
  const KV = findKV(env);
  const headers = makeCorsHeaders(request);
  try {
    const sRaw = KV ? await KV.get('state') : null;
    let mode = 'false';
    if (sRaw){
      try {
        const st = typeof sRaw === 'string' ? JSON.parse(sRaw) : sRaw;
        const ra = st?.settings?.requireAuth;
        if (ra === true || String(ra) === 'true') mode = 'true';
        else if (String(ra) === 'only') mode = 'only';
      } catch(e){}
    }
    const editRequiresAuth = (mode === 'true' || mode === 'only');
    if (editRequiresAuth){
      const cookieHeader = request.headers.get('cookie') || '';
      const cookies = Object.fromEntries(cookieHeader.split(';').map(p=>p.trim()).filter(Boolean).map(p=>p.split('=').map(x=>x.trim())));
      const token = cookies['NAV_SESSION'];
      if (!token) return new Response(JSON.stringify({ ok:false, msg:'未登录' }), { status:401, headers });
      // validate session
      let sess = null;
      try { sess = KV ? await KV.get('session:'+token, { type: 'json' }) : null; } catch(e){}
      if (!sess) {
        try { sess = KV ? await KV.get('session:'+token, 'json') : null; } catch(e){}
      }
      if (!sess || !sess.exp || Number(sess.exp) < Date.now()){
        try { if (KV) await KV.delete('session:'+token); } catch(e){}
        return new Response(JSON.stringify({ ok:false, msg:'会话无效' }), { status:401, headers });
      }
    }
    const body = await request.json().catch(()=>null);
    if (!body) return new Response(JSON.stringify({ ok:false, msg:'请求体错误' }), { status:400, headers });
    const st = {
      settings: Object.assign({ title: "我的导航", background: "", bgNoCache: false, requireAuth: false }, body.settings || {}),
      groups: Array.isArray(body.groups) ? body.groups : []
    };
    if (KV) await KV.put('state', JSON.stringify(st));
    return new Response(JSON.stringify({ ok:true }), { headers });
  } catch (e){
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers: makeCorsHeaders(request) });
  }
}
