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
  if (!kv) return new Response(JSON.stringify({ error: 'KV binding "wj" not found.' }), { status:500, headers: CORS_HEADERS });

  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status:405, headers: CORS_HEADERS });

  let body = null;
  try { body = await request.json(); } catch(e) { return new Response(JSON.stringify({ error:'Invalid JSON' }), { status:400, headers: CORS_HEADERS }); }

  const path = body && body.path ? String(body.path) : '';
  const isDir = !!body.dir;
  if (!path) return new Response(JSON.stringify({ error: 'path required' }), { status:400, headers: CORS_HEADERS });

  try {
    if (isDir) {
      let prefix = path.endsWith('/') ? path : (path + '/');
      let result = { keys: [], cursor: null, list_complete: false };
      do {
        result = await kv.list({ prefix: 'file:' + prefix, cursor: result.cursor, limit: 1000 });
        for (const k of result.keys) { if (k && k.name) { const realKey = k.name.substring(5); await kv.delete('file:' + realKey); await kv.delete('meta:' + realKey); } }
      } while (!result.list_complete);
    } else {
      await kv.delete('file:' + path);
      await kv.delete('meta:' + path);
    }
    return new Response(JSON.stringify({ ok:true }), { headers: CORS_HEADERS });
  } catch(e) { return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: CORS_HEADERS }); }
}
