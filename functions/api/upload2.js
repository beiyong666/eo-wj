
export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found. Bind your KV namespace as "wj".' }), { status: 500, headers: jsonHeaders() });
  }
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders() });
    }
    const form = await request.formData();
    const file = form.get('file');
    const dir = (form.get('dir') || '').toString().trim();
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400, headers: jsonHeaders() });
    }
    const filename = file.name || 'file';
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const size = uint8.byteLength;

    // convert to base64
    function uint8ToBase64(u8) {
      const CHUNK = 0x8000;
      let parts = [];
      for (let i = 0; i < u8.length; i += CHUNK) {
        parts.push(String.fromCharCode.apply(null, Array.from(u8.slice(i, i + CHUNK))));
      }
      return btoa(parts.join(''));
    }
    const b64 = uint8ToBase64(uint8);

    // generate id
    const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2,9);

    await kv.put('file:' + id, b64);
    const meta = {
      id,
      filename,
      size,
      contentType: file.type || 'application/octet-stream',
      dir: dir || '',
      uploadedAt: Date.now()
    };
    await kv.put('meta:' + id, JSON.stringify(meta));

    // update index
    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    let index = raw ? JSON.parse(raw) : [];
    index.unshift({ id, filename, size, dir: meta.dir, uploadedAt: meta.uploadedAt });
    // keep index length reasonable
    if (index.length > 1000) index = index.slice(0, 1000);
    await kv.put(indexKey, JSON.stringify(index));

    const downloadUrl = '/api/download2?id=' + encodeURIComponent(id);
    return new Response(JSON.stringify({ id, filename, size, downloadUrl }), { status: 201, headers: jsonHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unhandled server error: ' + String(err) }), { status: 500, headers: jsonHeaders() });
  }
}

function jsonHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
}
