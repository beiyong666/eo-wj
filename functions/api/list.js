export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found. Bind your KV namespace as "wj".' }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {'Content-Type':'application/json'} });
  }

  try {
    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    const index = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }
}
