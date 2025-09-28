
export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found.' }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
  try {
    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    const index = raw ? JSON.parse(raw) : [];
    const dirs = Array.from(new Set(index.map(i => i.dir || '').filter(Boolean)));
    return new Response(JSON.stringify(dirs), { headers: {'Content-Type':'application/json'} });
  } catch (e) {
    return new Response(JSON.stringify([]), { headers: {'Content-Type':'application/json'} });
  }
}
