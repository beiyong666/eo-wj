export async function onRequest(context) {
  const { request, env } = context;
  const CORS_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers: CORS_HEADERS });

  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) return new Response(JSON.stringify({ error:'KV not bound' }), { status:500, headers: CORS_HEADERS });

  const key = 'random_allowed';
  if (request.method === 'GET') {
    try { const raw = await kv.get(key); const arr = raw ? JSON.parse(raw) : []; return new Response(JSON.stringify({ dirs: arr }), { headers: CORS_HEADERS }); } catch(e) { return new Response(JSON.stringify({ dirs: [] }), { headers: CORS_HEADERS }); }
  }

  if (request.method === 'POST') {
    let body = null;
    try { body = await request.json(); } catch(e) { return new Response(JSON.stringify({ error:'Invalid JSON' }), { status:400, headers: CORS_HEADERS }); }
    const dir = body && body.dir ? String(body.dir).replace(/^\/+|\/+$/g,'') : '';
    if (!dir) return new Response(JSON.stringify({ error:'dir required' }), { status:400, headers: CORS_HEADERS });
    try { const raw = await kv.get(key); let arr = raw ? JSON.parse(raw) : []; if (!arr.includes(dir)) arr.push(dir); await kv.put(key, JSON.stringify(arr)); return new Response(JSON.stringify({ ok:true }), { headers: CORS_HEADERS }); } catch(e) { return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: CORS_HEADERS }); }
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const dir = (url.searchParams.get('dir') || '').replace(/^\/+|\/+$/g,'');
    if (!dir) return new Response(JSON.stringify({ error:'dir required' }), { status:400, headers: CORS_HEADERS });
    try { const raw = await kv.get(key); let arr = raw ? JSON.parse(raw) : []; arr = arr.filter(x => x !== dir); await kv.put(key, JSON.stringify(arr)); return new Response(JSON.stringify({ ok:true }), { headers: CORS_HEADERS }); } catch(e) { return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: CORS_HEADERS }); }
  }

  return new Response(JSON.stringify({ error:'Method not allowed' }), { status:405, headers: CORS_HEADERS });
}
