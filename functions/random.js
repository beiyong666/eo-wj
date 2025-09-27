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

  if (request.method !== 'GET') return new Response(JSON.stringify({ error:'Method not allowed' }), { status:405, headers: CORS_HEADERS });

  const url = new URL(request.url);
  const dir = (url.searchParams.get('dir') || '').replace(/^\/+|\/+$/g,'');
  const type = (url.searchParams.get('type') || '').toLowerCase();
  if (!dir || !type) return new Response(JSON.stringify({ error:'dir and type required' }), { status:400, headers: CORS_HEADERS });

  try {
    const raw = await kv.get('random_allowed');
    const allowed = raw ? JSON.parse(raw) : [];
    if (!allowed.includes(dir)) return new Response(JSON.stringify({ error:'目录未开放随机访问' }), { status:403, headers: CORS_HEADERS });

    const prefix = 'file:' + (dir.endsWith('/') ? dir : dir + '/');
    let result = { keys: [], cursor: null, list_complete: false };
    let keys = [];
    do { result = await kv.list({ prefix, cursor: result.cursor, limit: 1000 }); for (const k of result.keys) { if (k && k.name && k.name.startsWith('file:')) keys.push(k.name.substring(5)); } } while (!result.list_complete);

    const imgExts = ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg'];
    const vidExts = ['.mp4','.webm','.ogg'];
    const exts = type === 'img' ? imgExts : vidExts;
    const filtered = keys.filter(function(k){ var idx = k.lastIndexOf('.'); if (idx<0) return false; var ext = k.slice(idx).toLowerCase(); return exts.indexOf(ext) !== -1; });

    if (filtered.length === 0) return new Response(JSON.stringify({ error:'未找到符合类型的文件' }), { status:404, headers: CORS_HEADERS });
    var rand = filtered[Math.floor(Math.random()*filtered.length)];
    var origin = new URL(request.url).origin;
    var urlOut = origin + '/api/download?path=' + encodeURIComponent(rand);
    return new Response(JSON.stringify({ url: urlOut }), { headers: CORS_HEADERS });
  } catch(e) { return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: CORS_HEADERS }); }
}
