export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const indexKey = 'index';
  try {
    const raw = await env.wj.get(indexKey);
    const index = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }
}
