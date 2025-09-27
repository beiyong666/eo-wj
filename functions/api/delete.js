export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding \"wj\" not found. Bind your KV namespace as \"wj\".' }), { status: 500, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }
  const id = body && body.id;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers });

  try {
    await kv.delete('file:' + id);
    await kv.delete('meta:' + id);

    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    let index = raw ? JSON.parse(raw) : [];
    index = index.filter(item => item.id !== id);
    await kv.put(indexKey, JSON.stringify(index));

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'delete failed', message: String(e) }), { status: 500, headers });
  }
}
