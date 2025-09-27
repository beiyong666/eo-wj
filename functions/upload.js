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

  if (request.method !== 'POST') return new Response(JSON.stringify({ ok:false, error:'Method not allowed' }), { status:405, headers: CORS_HEADERS });

  try {
    const form = await request.formData();
    const file = form.get('file');
    const dir = form.get('dir') ? String(form.get('dir')).trim() : '';
    if (!file) return new Response(JSON.stringify({ ok:false, error:'No file' }), { status:400, headers: CORS_HEADERS });
    const filename = file.name || 'file.bin';
    const key = dir ? (dir.replace(/^\/+|\/+$/g,'') + '/' + filename) : filename;
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    let parts = [];
    const CHUNK = 0x8000;
    for (let i=0;i<u8.length;i+=CHUNK) parts.push(String.fromCharCode.apply(null, u8.subarray(i, i+CHUNK)));
    const b64 = btoa(parts.join(''));
    await kv.put('file:' + key, b64);
    const meta = { name: filename, size: buf.byteLength, contentType: file.type || 'application/octet-stream' };
    await kv.put('meta:' + key, JSON.stringify(meta));
    return new Response(JSON.stringify({ ok:true, key: key }), { headers: CORS_HEADERS });
  } catch(e) {
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers: CORS_HEADERS });
  }
}
