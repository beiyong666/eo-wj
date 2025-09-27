export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const id = body && body.id;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  // delete keys
  await env.wj.delete('file:' + id);
  await env.wj.delete('meta:' + id);

  // update index
  const indexKey = 'index';
  try {
    const raw = await env.wj.get(indexKey);
    let index = raw ? JSON.parse(raw) : [];
    index = index.filter(item => item.id !== id);
    await env.wj.put(indexKey, JSON.stringify(index));
  } catch (e) {
    // ignore
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}
