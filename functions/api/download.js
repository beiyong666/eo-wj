export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found. Bind your KV namespace as "wj".' }), { status: 500, headers: {'Content-Type':'application/json'} });
  }

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: {'Content-Type':'application/json'} });

  const metaRaw = await kv.get('meta:' + id);
  if (!metaRaw) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: {'Content-Type':'application/json'} });
  let meta;
  try { meta = JSON.parse(metaRaw); } catch(e){ meta = { filename: 'file' }; }

  // get base64 string
  const b64 = await kv.get('file:' + id);
  if (!b64) return new Response(JSON.stringify({ error: 'file not found' }), { status: 404, headers: {'Content-Type':'application/json'} });

  try {
    // decode base64 to Uint8Array
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
    return new Response(JSON.stringify({ error: 'Failed to decode file', message: String(e) }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
}
