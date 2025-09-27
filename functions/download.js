export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Access-Control-Allow-Origin': '*' };
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers });

  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) return new Response('KV not bound', { status:500, headers });

  const url = new URL(request.url);
  const path = (url.searchParams.get('path') || '').replace(/^\/+/, '');
  if (!path) return new Response('path required', { status:400, headers });

  const b64 = await kv.get('file:' + path);
  if (!b64) return new Response('not found', { status:404, headers });
  try {
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i=0;i<len;i++) bytes[i] = binaryString.charCodeAt(i);
    const metaRaw = await kv.get('meta:' + path);
    const meta = metaRaw ? JSON.parse(metaRaw) : null;
    const contentType = meta && meta.contentType ? meta.contentType : 'application/octet-stream';
    const respHeaders = new Headers();
    respHeaders.set('Content-Type', contentType);
    respHeaders.set('Content-Disposition', 'inline; filename="' + ((meta && meta.name) ? meta.name.replace(/["\\]/g,'') : path.replace(/["\\]/g,'')) + '"');
    respHeaders.set('Access-Control-Allow-Origin','*');
    return new Response(bytes.buffer, { headers: respHeaders });
  } catch(e) {
    return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin':'*' } });
  }
}
