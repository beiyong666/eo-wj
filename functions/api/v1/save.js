export async function onRequestPost(context){
  const { request, env } = context;
  const KV = env.DAOHANG || env.daohang;
  try {
    // determine mode
    const sRaw = KV ? await KV.get('state') : null;
    let mode = 'false';
    if (sRaw){
      try {
        const st = JSON.parse(sRaw);
        const ra = st?.settings?.requireAuth;
        if (ra === true || String(ra) === 'true') mode = 'true';
        else if (String(ra) === 'only') mode = 'only';
      } catch(e){}
    }

    // fallback: if KV didn't define requireAuth, check environment variable AUTH_ENABLED
    try {
      const envVal = String(env.AUTH_ENABLED || env.AUTH || '').trim().toLowerCase();
      if (envVal === 'true') mode = 'true';
      else if (envVal === 'only') mode = 'only';
    } catch(e){}
    const editRequiresAuth = (mode === 'true' || mode === 'only');
    if (editRequiresAuth){
      const cookieHeader = request.headers.get('cookie') || '';
      const cookies = Object.fromEntries(cookieHeader.split(';').map(p=>p.trim()).filter(Boolean).map(p=>p.split('=').map(x=>x.trim())));
      const token = cookies['NAV_SESSION'];
      if (!token) return new Response(JSON.stringify({ ok:false, msg:'未登录' }), { status:401, headers:{ 'Content-Type':'application/json' } });
      const ok = KV ? await KV.get('session:'+token) : null;
      if (!ok) return new Response(JSON.stringify({ ok:false, msg:'会话无效' }), { status:401, headers:{ 'Content-Type':'application/json' } });
    }
    const body = await request.json().catch(()=>null);
    if (!body) return new Response(JSON.stringify({ ok:false, msg:'请求体错误' }), { status:400, headers:{ 'Content-Type':'application/json' } });
    const st = {
      settings: Object.assign({ title: "我的导航", background: "", bgNoCache: false, requireAuth: false }, body.settings || {}),
      groups: Array.isArray(body.groups) ? body.groups : []
    };
    if (KV) await KV.put('state', JSON.stringify(st));
    return new Response(JSON.stringify({ ok:true }), { headers:{ 'Content-Type':'application/json' } });
  } catch (e){
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers:{ 'Content-Type':'application/json' } });
  }
}