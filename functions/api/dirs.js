export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) return new Response(JSON.stringify({ error: 'KV not configured' }), { status: 500, headers: {'Content-Type':'application/json'} });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {'Content-Type':'application/json'} });
  const raw = await kv.get('dirs');
  const dirs = raw ? JSON.parse(raw) : [];
  return new Response(JSON.stringify(dirs), { headers: {'Content-Type':'application/json'} });
}
