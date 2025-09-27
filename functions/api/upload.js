export async function onRequest(context) {
  const { request, env } = context;
  // resolve KV binding: prefer env.wj, fallback to global wj
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found. Bind your KV namespace as "wj".' }), { status: 500, headers: jsonHeaders() });
  }

  function isAuthed(request){ const cookie = request.headers.get('cookie') || ''; return cookie.split(';').map(s=>s.trim()).includes('auth=1'); }

  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders() });
    }

    // require auth cookie
    if (!isAuthed(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders() });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data', got: contentType }), { status: 400, headers: jsonHeaders() });
    }

    let form;
    function isAuthed(request){ const cookie = request.headers.get('cookie') || ''; return cookie.split(';').map(s=>s.trim()).includes('auth=1'); }

  try {
      form = await request.formData();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse multipart/form-data', message: String(e) }), { status: 400, headers: jsonHeaders() });
    }

    const file = form.get('file');
    let dir = form.get('dir');
    if(typeof dir === 'string') dir = dir.trim().replace(/^\/+|\/+$/g, ''); else dir = '';

    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ error: 'No file field found in form-data (field name must be "file")' }), { status: 400, headers: jsonHeaders() });
    }

    const id = (typeof crypto?.randomUUID === 'function') ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    const filename = file.name || 'unknown';
    const contentTypeHeader = file.type || 'application/octet-stream';

    let arrayBuffer;
    function isAuthed(request){ const cookie = request.headers.get('cookie') || ''; return cookie.split(';').map(s=>s.trim()).includes('auth=1'); }

  try {
      arrayBuffer = await file.arrayBuffer();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to read uploaded file as arrayBuffer', message: String(e) }), { status: 500, headers: jsonHeaders() });
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
    function isAuthed(request){ const cookie = request.headers.get('cookie') || ''; return cookie.split(';').map(s=>s.trim()).includes('auth=1'); }

  try {
      b64 = uint8ToBase64(uint8);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to convert file to base64', message: String(e) }), { status: 500, headers: jsonHeaders() });
    }

    function isAuthed(request){ const cookie = request.headers.get('cookie') || ''; return cookie.split(';').map(s=>s.trim()).includes('auth=1'); }

  try {
      // store base64 string under file:<id>
      await kv.put('file:' + id, b64);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'KV put failed (file)', message: String(e) }), { status: 500, headers: jsonHeaders() });
    }

    const meta = {
      id,
      filename,
      size,
      dir,
      contentType: contentTypeHeader,
      createdAt: new Date().toISOString()
    };

    function isAuthed(request){ const cookie = request.headers.get('cookie') || ''; return cookie.split(';').map(s=>s.trim()).includes('auth=1'); }

  try {
      await kv.put('meta:' + id, JSON.stringify(meta));
    } catch (e) {
      // attempt rollback
      function isAuthed(request){ const cookie = request.headers.get('cookie') || ''; return cookie.split(';').map(s=>s.trim()).includes('auth=1'); }

  try { await kv.delete('file:' + id); } catch(_) {}
      return new Response(JSON.stringify({ error: 'KV put failed (meta)', message: String(e) }), { status: 500, headers: jsonHeaders() });
    }

    // update index
    function isAuthed(request){ const cookie = request.headers.get('cookie') || ''; return cookie.split(';').map(s=>s.trim()).includes('auth=1'); }

  try {
      const indexKey = 'index';
      let raw = await kv.get(indexKey);
      let index = raw ? JSON.parse(raw) : [];
      index.unshift(meta);
      if (index.length > 1000) index = index.slice(0, 1000);
      await kv.put(indexKey, JSON.stringify(index));
      // update dirs list
      try {
        const dirsKey = 'dirs';
        const rawDirs = await kv.get(dirsKey);
        let dirs = rawDirs ? JSON.parse(rawDirs) : [];
        if(dir && !dirs.includes(dir)) { dirs.unshift(dir); if(dirs.length>1000) dirs = dirs.slice(0,1000); await kv.put(dirsKey, JSON.stringify(dirs)); }
      } catch(e){ /* non-fatal */ }

    } catch (e) {
      return new Response(JSON.stringify({ id, warning: 'uploaded but index update failed', message: String(e) }), { status: 201, headers: jsonHeaders() });
    }

    const downloadUrl = new URL('/api/download?id=' + id, request.url).toString();
    return new Response(JSON.stringify({ id, filename, size, downloadUrl }), { status: 201, headers: jsonHeaders() });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unhandled server error', message: String(err) }), { status: 500, headers: jsonHeaders() });
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
