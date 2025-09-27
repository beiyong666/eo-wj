export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found. Bind your KV namespace as "wj".' }), { status: 500, headers: {'Content-Type':'application/json'} });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {'Content-Type':'application/json'} });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: {'Content-Type':'application/json'} });
  }
  const id = body && body.id;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: {'Content-Type':'application/json'} });

  try {
    await kv.delete('file:' + id);
    await kv.delete('meta:' + id);

    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    let index = raw ? JSON.parse(raw) : [];
    index = index.filter(item => item.id !== id);
    await kv.put(indexKey, JSON.stringify(index));

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'delete failed', message: String(e) }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
}
