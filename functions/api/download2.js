
export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response('KV binding "wj" not found', { status: 500 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers:{'Content-Type':'application/json'} });
  try {
    const metaRaw = await kv.get('meta:' + id);
    if (!metaRaw) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers:{'Content-Type':'application/json'} });
    const meta = JSON.parse(metaRaw);
    const b64 = await kv.get('file:' + id);
    if (!b64) return new Response(JSON.stringify({ error: 'File missing' }), { status: 404, headers:{'Content-Type':'application/json'} });
    // decode base64
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const headers = new Headers();
    headers.set('Content-Type', meta.contentType || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${meta.filename.replace(/["\\\\]/g, '')}"`);
    return new Response(bytes.buffer, { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch file' }), { status: 500, headers:{'Content-Type':'application/json'} });
  }
}
