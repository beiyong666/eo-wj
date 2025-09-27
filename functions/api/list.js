export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  };
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding \"wj\" not found. Bind your KV namespace as \"wj\".' }), { status: 500, headers });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    const index = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify(index), { headers });
  } catch (e) {
    return new Response(JSON.stringify([]), { headers });
  }
}
