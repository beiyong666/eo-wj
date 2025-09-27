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

  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status:405, headers: CORS_HEADERS });

  const url = new URL(request.url);
  let dir = (url.searchParams.get('dir') || '').replace(/^\/+|\/+$/g, '');
  const prefix = dir ? (dir + '/') : '';

  try {
    let result = { keys: [], cursor: null, list_complete: false };
    let keys = [];
    do {
      result = await kv.list({ prefix: 'file:' + prefix, cursor: result.cursor, limit: 1000 });
      for (const k of result.keys) { if (k && k.name) keys.push(k.name.substring(5)); }
    } while (!result.list_complete);
    const files = [];
    for (const key of keys) {
      try { const metaRaw = await kv.get('meta:' + key); const meta = metaRaw ? JSON.parse(metaRaw) : null; files.push({ key, name: meta && meta.name ? meta.name : key, size: meta && meta.size ? meta.size : 0, type: meta && meta.contentType ? meta.contentType : '' }); } catch(e) {}
    }
    return new Response(JSON.stringify({ files }), { headers: CORS_HEADERS });
  } catch(e) { return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: CORS_HEADERS }); }
}
