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

export async function onRequestGet(context){
  const { env } = context;
  const KV = findKV(env);
  try {
    const sRaw = KV ? await KV.get('state') : null;
    if (sRaw){
      try {
        const st = typeof sRaw === 'string' ? JSON.parse(sRaw) : sRaw;
        const ra = st?.settings?.requireAuth;
        if (ra === true || String(ra) === 'true') return new Response(JSON.stringify({ authEnabled: 'true' }), { headers:{ 'Content-Type':'application/json' } });
        if (String(ra) === 'only') return new Response(JSON.stringify({ authEnabled: 'only' }), { headers:{ 'Content-Type':'application/json' } });
        return new Response(JSON.stringify({ authEnabled: 'false' }), { headers:{ 'Content-Type':'application/json' } });
      } catch(e){}
    }
    const envVal = String(env.AUTH_ENABLED || env.AUTH || '').trim().toLowerCase();
    if (envVal === 'true') return new Response(JSON.stringify({ authEnabled: 'true' }), { headers:{ 'Content-Type':'application/json' } });
    if (envVal === 'only') return new Response(JSON.stringify({ authEnabled: 'only' }), { headers:{ 'Content-Type':'application/json' } });
    return new Response(JSON.stringify({ authEnabled: 'false' }), { headers:{ 'Content-Type':'application/json' } });
  } catch (e){
    return new Response(JSON.stringify({ authEnabled: 'false' }), { headers:{ 'Content-Type':'application/json' } });
  }
}
