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
    let s = KV ? await KV.get('state') : null;
    if (!s){
      const DEFAULT_STATE = { settings: { title: "我的导航", background: "", bgNoCache: false, requireAuth: false }, groups: [] };
      if (KV) await KV.put('state', JSON.stringify(DEFAULT_STATE));
      s = JSON.stringify(DEFAULT_STATE);
    }
    return new Response(s, { headers: { 'Content-Type': 'application/json' } });
  } catch (e){
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers:{ 'Content-Type':'application/json' } });
  }
}
