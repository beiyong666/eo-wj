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
  if (!kv) return new Response(JSON.stringify({ error: 'KV binding "wj" not found. Bind your KV namespace as "wj".' }), { status:500, headers: CORS_HEADERS });

  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status:405, headers: CORS_HEADERS });

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data', got: contentType }), { status:400, headers: CORS_HEADERS });

  let form;
  try { form = await request.formData(); } catch(e) { return new Response(JSON.stringify({ error: 'Failed to parse multipart/form-data', message: String(e) }), { status:400, headers: CORS_HEADERS }); }

  const file = form.get('file');
  if (!file || typeof file === 'string') return new Response(JSON.stringify({ error: 'No file field found (field must be "file")' }), { status:400, headers: CORS_HEADERS });

  const dir = form.get('dir') ? String(form.get('dir')).trim() : '';
  const filename = file.name || 'unknown';
  let key = dir ? (dir.replace(/^\/+|\/+$/g,'') + '/' + filename) : filename;
  key = key.replace(/^\/+/, '');

  let arrayBuffer;
  try { arrayBuffer = await file.arrayBuffer(); } catch(e) { return new Response(JSON.stringify({ error:'Failed to read file', message: String(e) }), { status:500, headers: CORS_HEADERS }); }

  try {
    const u8 = new Uint8Array(arrayBuffer);
    const CHUNK = 0x8000;
    let parts = [];
    for (let i=0;i<u8.length;i+=CHUNK) parts.push(String.fromCharCode.apply(null, u8.subarray(i, i+CHUNK)));
    const b64 = btoa(parts.join(''));
    await kv.put('file:' + key, b64);
  } catch(e) { return new Response(JSON.stringify({ error: 'KV put failed (file)', message: String(e) }), { status:500, headers: CORS_HEADERS }); }

  const meta = { key: key, name: filename, size: arrayBuffer.byteLength, contentType: file.type || 'application/octet-stream', createdAt: new Date().toISOString() };
  try { await kv.put('meta:' + key, JSON.stringify(meta)); } catch(e) { try { await kv.delete('file:' + key); } catch(_) {} return new Response(JSON.stringify({ error: 'KV put failed (meta)', message: String(e) }), { status:500, headers: CORS_HEADERS }); }

  return new Response(JSON.stringify({ ok:true, key: key }), { headers: CORS_HEADERS });
}
