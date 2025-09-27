export async function onRequest(context) {
  const { request, env } = context;
  const CORS_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers: CORS_HEADERS });

  const kv = (env && env.wj) ? env.wj : null;
  if (!kv) return new Response(JSON.stringify({ ok:false, error:'KV not bound' }), { status:500, headers: CORS_HEADERS });

  const url = new URL(request.url);
  const origin = url.origin;
  let dir = (url.searchParams.get('dir') || '').replace(/^\/+|\/+$/g, '');
  const prefix = dir ? (dir + '/') : '';
  try {
    let result = { keys: [], cursor: null, list_complete: false };
    let keys = [];
    do {
      result = await kv.list({ prefix: 'file:' + prefix, cursor: result.cursor, limit: 1000 });
      for (const k of result.keys) {
        if (k && k.name && k.name.startsWith('file:')) keys.push(k.name.substring(5));
      }
    } while (!result.list_complete);
    const files = [];
    for (const key of keys) {
      const metaRaw = await kv.get('meta:' + key);
      const meta = metaRaw ? JSON.parse(metaRaw) : null;
      const name = meta && meta.name ? meta.name : key;
      const size = meta && meta.size ? meta.size : 0;
      const type = meta && meta.contentType ? meta.contentType : '';
      const urlOut = origin + '/api/download?path=' + encodeURIComponent(key);
      files.push({ key, name, size, type, url: urlOut });
    }
    return new Response(JSON.stringify({ ok:true, files }), { headers: CORS_HEADERS });
  } catch(e) {
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers: CORS_HEADERS });
  }
}
