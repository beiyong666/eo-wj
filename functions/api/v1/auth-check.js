export async function onRequestGet(context){
  const { request, env } = context;
  const KV = env.DAOHANG || env.daohang;
  try {
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
    // If mode isn't 'true' then pages don't require auth; for API we still report authed:true
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(cookieHeader.split(';').map(p=>p.trim()).filter(Boolean).map(p=>p.split('=').map(x=>x.trim())));
    const token = cookies['NAV_SESSION'];
    if (mode !== 'true') {
      return new Response(JSON.stringify({ authed: true }), { headers:{ 'Content-Type':'application/json' } });
    }
    // mode === 'true' -> require session for all requests
    if (!token) return new Response(JSON.stringify({ authed: false }), { headers:{ 'Content-Type':'application/json' } });
    const ok = KV ? await KV.get('session:'+token) : null;
    return new Response(JSON.stringify({ authed: !!ok }), { headers:{ 'Content-Type':'application/json' } });
  } catch (e){
    return new Response(JSON.stringify({ authed: false, error: String(e) }), { headers:{ 'Content-Type':'application/json' }, status:500 });
  }
}