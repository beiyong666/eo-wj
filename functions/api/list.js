export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found.' }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {'Content-Type':'application/json'} });
  }

  try {
    const url = new URL(request.url);
    const dir = url.searchParams.get('dir') || '';
    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    const index = raw ? JSON.parse(raw) : [];
    const filtered = dir ? index.filter(item => (item.dir||'') === dir) : index;
    return new Response(JSON.stringify(filtered), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }
}
