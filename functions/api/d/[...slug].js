
export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response('KV binding "wj" not found', { status: 500 });
  }
  try {
    const url = new URL(request.url);
    // path after /api/d/
    let prefix = '/api/d/';
    const idx = url.pathname.indexOf(prefix);
    let tail = idx >= 0 ? url.pathname.slice(idx + prefix.length) : '';
    // decode components
    tail = decodeURIComponent(tail || '');
    const parts = tail.split('/').filter(Boolean);
    if (parts.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing directory' }), { status: 400, headers: {'Content-Type':'application/json'} });
    }
    const dir = parts[0] || 'root';
    // helper to load index and find files
    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    const index = raw ? JSON.parse(raw) : [];
    if (parts.length === 1) {
      // return a random file from this dir
      const candidates = index.filter(i => (i.dir||'') === dir);
      if (candidates.length === 0) {
        return new Response(JSON.stringify({ error: 'No files in this directory' }), { status: 404, headers: {'Content-Type':'application/json'} });
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const id = pick.id;
      const metaRaw = await kv.get('meta:' + id);
      if (!metaRaw) return new Response(JSON.stringify({ error: 'Meta missing' }), { status: 404, headers: {'Content-Type':'application/json'} });
      const meta = JSON.parse(metaRaw);
      const b64 = await kv.get('file:' + id);
      if (!b64) return new Response(JSON.stringify({ error: 'File missing' }), { status: 404, headers: {'Content-Type':'application/json'} });
      // decode base64
      const binaryString = atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const headers = new Headers();
      headers.set('Content-Type', meta.contentType || 'application/octet-stream');
      // inline so images/videos render; filename in header for downloads
      headers.set('Content-Disposition', `inline; filename="${meta.filename.replace(/["\\\\]/g, '')}"`);
      return new Response(bytes.buffer, { headers });
    } else {
      // parts.length >= 2 -> treat rest as filename components
      const filename = parts.slice(1).join('/');
      const found = index.find(i => (i.dir||'') === dir && i.filename === filename);
      if (!found) {
        // if not found by exact filename, try matching by filename only
        const alt = index.find(i => (i.dir||'') === dir && i.filename === decodeURIComponent(parts.slice(1).join('/')));
        if (!alt) return new Response(JSON.stringify({ error: 'File not found' }), { status: 404, headers: {'Content-Type':'application/json'} });
        found = alt;
      }
      const id = found.id;
      const metaRaw = await kv.get('meta:' + id);
      if (!metaRaw) return new Response(JSON.stringify({ error: 'Meta missing' }), { status: 404, headers: {'Content-Type':'application/json'} });
      const meta = JSON.parse(metaRaw);
      const b64 = await kv.get('file:' + id);
      if (!b64) return new Response(JSON.stringify({ error: 'File missing' }), { status: 404, headers: {'Content-Type':'application/json'} });
      const binaryString = atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const headers = new Headers();
      headers.set('Content-Type', meta.contentType || 'application/octet-stream');
      headers.set('Content-Disposition', `inline; filename="${meta.filename.replace(/["\\\\]/g, '')}"`);
      return new Response(bytes.buffer, { headers });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Server error: ' + String(e) }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
}
