export async function onRequestGet(context){
  const { env } = context;
  const KV = env.DAOHANG || env.daohang;
  try {
    // Try KV first
    const sRaw = KV ? await KV.get('state') : null;
    if (sRaw){
      try {
        const st = JSON.parse(sRaw);
        const ra = st?.settings?.requireAuth;
        if (ra === true || String(ra) === 'true') return new Response(JSON.stringify({ authEnabled: 'true' }), { headers:{ 'Content-Type':'application/json' } });
        if (String(ra) === 'only') return new Response(JSON.stringify({ authEnabled: 'only' }), { headers:{ 'Content-Type':'application/json' } });
        return new Response(JSON.stringify({ authEnabled: 'false' }), { headers:{ 'Content-Type':'application/json' } });
      } catch(e){}
    }
    // Fallback to environment variable AUTH_ENABLED if present
    const envVal = String(env.AUTH_ENABLED || env.AUTH || '').trim().toLowerCase();
    if (envVal === 'true') return new Response(JSON.stringify({ authEnabled: 'true' }), { headers:{ 'Content-Type':'application/json' } });
    if (envVal === 'only') return new Response(JSON.stringify({ authEnabled: 'only' }), { headers:{ 'Content-Type':'application/json' } });
    return new Response(JSON.stringify({ authEnabled: 'false' }), { headers:{ 'Content-Type':'application/json' } });
  } catch (e){
    return new Response(JSON.stringify({ authEnabled: 'false' }), { headers:{ 'Content-Type':'application/json' } });
  }
}