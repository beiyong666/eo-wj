export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // resolve KV binding: prefer env.wj, fallback to global wj
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding \"wj\" not found. Bind your KV namespace as \"wj\".' }), { status: 500, headers });
  }

  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data', got: contentType }), { status: 400, headers });
    }

    let form;
    try {
      form = await request.formData();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse multipart/form-data', message: String(e) }), { status: 400, headers });
    }

    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ error: 'No file field found in form-data (field name must be \"file\")' }), { status: 400, headers });
    }

    const id = (typeof crypto?.randomUUID === 'function') ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    const filename = file.name || 'unknown';
    const contentTypeHeader = file.type || 'application/octet-stream';

    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to read uploaded file as arrayBuffer', message: String(e) }), { status: 500, headers });
    }
    const uint8 = new Uint8Array(arrayBuffer);
    const size = uint8.byteLength;

    // convert to base64 string to maximize compatibility with KV bindings that expect strings
    function uint8ToBase64(u8) {
      const CHUNK = 0x8000;
      let parts = [];
      for (let i=0; i<u8.length; i+=CHUNK) {
        parts.push(String.fromCharCode.apply(null, u8.subarray(i, i+CHUNK)));
      }
      return btoa(parts.join(''));
    }
    let b64;
    try {
      b64 = uint8ToBase64(uint8);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to convert file to base64', message: String(e) }), { status: 500, headers });
    }

    try {
      // store base64 string under file:<id>
      await kv.put('file:' + id, b64);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'KV put failed (file)', message: String(e) }), { status: 500, headers });
    }

    const meta = {
      id,
      filename,
      size,
      contentType: contentTypeHeader,
      createdAt: new Date().toISOString()
    };

    try {
      await kv.put('meta:' + id, JSON.stringify(meta));
    } catch (e) {
      // attempt rollback
      try { await kv.delete('file:' + id); } catch(_) {}
      return new Response(JSON.stringify({ error: 'KV put failed (meta)', message: String(e) }), { status: 500, headers });
    }

    // update index
    try {
      const indexKey = 'index';
      let raw = await kv.get(indexKey);
      let index = raw ? JSON.parse(raw) : [];
      index.unshift(meta);
      if (index.length > 1000) index = index.slice(0, 1000);
      await kv.put(indexKey, JSON.stringify(index));
    } catch (e) {
      return new Response(JSON.stringify({ id, warning: 'uploaded but index update failed', message: String(e) }), { status: 201, headers });
    }

    return new Response(JSON.stringify({ id, filename, size }), { status: 201, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unhandled server error', message: String(err) }), { status: 500, headers });
  }
}
