/**
 * Added directory upload and directory management endpoints.
 * Endpoints:
 *  - POST  /upload?dir=<dir>        (multipart/form-data with file field 'file' OR raw body; param filename optional)
 *  - GET   /list?dir=<dir>          (list keys under dir)
 *  - DELETE /delete-dir?dir=<dir>   (delete all keys under dir)
 *
 * This worker expects a KV namespace bound as FILES (e.g., in wrangler.toml: [[kv_namespaces]] binding = "FILES" )
 *
 * Note: Cloudflare Workers KV doesn't support listing with more than 1000 keys per call; this code pages through lists.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    try {
      if (request.method === 'POST' && pathname === '/upload') {
        return await handleUpload(request, env, url);
      }
      if (request.method === 'GET' && pathname === '/list') {
        return await handleList(request, env, url);
      }
      if (request.method === 'DELETE' && pathname === '/delete-dir') {
        return await handleDeleteDir(request, env, url);
      }
      // Fallback: return 404
      return new Response(JSON.stringify({ok:false, error:'not_found'}), { status: 404, headers: {'Content-Type':'application/json'} });
    } catch (err) {
      return new Response(JSON.stringify({ok:false, error: String(err)}), { status: 500, headers: {'Content-Type':'application/json'} });
    }
  }
}

async function handleUpload(request, env, url) {
  const dir = (url.searchParams.get('dir') || '').replace(/^\/+|\/+$/g,'');
  // Extract filename param or use header
  const filenameParam = url.searchParams.get('filename') || '';
  const contentType = request.headers.get('content-type') || '';
  let filename = filenameParam;
  let value;

  if (contentType.includes('multipart/form-data')) {
    // parse using simple boundary split (works for single small file uploads)
    const text = await request.text();
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) throw new Error('no_boundary');
    // naive multipart parse:
    const parts = text.split('--' + boundary).filter(p => p.trim());
    for (const p of parts) {
      if (p.includes('name="file"')) {
        const idx = p.indexOf('\r\n\r\n');
        let head = p.slice(0, idx);
        let body = p.slice(idx+4);
        // remove trailing CRLF and closing --
        body = body.replace(/\r\n--$/,'').replace(/\r\n$/,'');
        // try to parse filename from head
        const m = head.match(/filename="([^"]+)"/);
        if (m) filename = filename || m[1];
        value = new TextEncoder().encode(body);
        break;
      }
    }
    if (!value) throw new Error('no_file_part');
  } else {
    // treat body as raw bytes
    const blob = await request.blob();
    const arr = await blob.arrayBuffer();
    value = new Uint8Array(arr);
    if (!filename) filename = 'file_' + Date.now();
  }

  const key = (dir ? dir + '/' : '') + filename;
  // Store as base64 to preserve binary safely
  const b64 = arrayBufferToBase64(value);
  await env.FILES.put(key, b64, { metadata: JSON.stringify({ contentType: contentType || 'application/octet-stream', filename }) });
  return new Response(JSON.stringify({ ok: true, key, url: '/file/' + encodeURIComponent(key) }), { headers: {'Content-Type':'application/json'} });
}

async function handleList(request, env, url) {
  const dir = (url.searchParams.get('dir') || '').replace(/^\/+|\/+$/g,'');
  const prefix = dir ? dir + '/' : '';
  let cursor = undefined;
  const items = [];
  while (true) {
    const res = await env.FILES.list({ prefix, cursor, limit: 1000 });
    for (const k of res.keys) {
      items.push({ name: k.name, metadata: k.metadata });
    }
    if (!res.list_complete) {
      cursor = res.cursor;
      continue;
    }
    break;
  }
  return new Response(JSON.stringify({ ok:true, items }), { headers: {'Content-Type':'application/json'} });
}

async function handleDeleteDir(request, env, url) {
  const dir = (url.searchParams.get('dir') || '').replace(/^\/+|\/+$/g,'');
  if (!dir) return new Response(JSON.stringify({ok:false, error:'dir_required'}), { status:400, headers:{'Content-Type':'application/json'} });
  const prefix = dir + '/';
  let cursor = undefined;
  let deleted = 0;
  while (true) {
    const res = await env.FILES.list({ prefix, cursor, limit: 1000 });
    for (const k of res.keys) {
      await env.FILES.delete(k.name);
      deleted++;
    }
    if (!res.list_complete) break;
    cursor = res.cursor;
  }
  return new Response(JSON.stringify({ ok:true, deleted }), { headers: {'Content-Type':'application/json'} });
}

// helper: convert uint8array to base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = Array.from(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}
