export async function onRequestGet(context){
  const { env } = context;
  const KV = env.DAOHANG || env.daohang;
  try {
    const ex = KV ? await KV.get('state') : null;
    return new Response(JSON.stringify({ ok:true, kv_usable: !!KV, has_state: !!ex }), { headers:{ 'Content-Type':'application/json' }});
  } catch (e){
    return new Response(JSON.stringify({ ok:false, kv_usable:false, error: String(e) }), { status:500, headers:{ 'Content-Type':'application/json' }});
  }
}
