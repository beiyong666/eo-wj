export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) return new Response('KV not configured', { status: 500 });
  const url = new URL(request.url);
  const dir = (url.searchParams.get('dir') || '').trim().replace(/^\/+|\/+$/g,'');
  const type = (url.searchParams.get('type') || '').trim();
  const raw = await kv.get('index');
  const index = raw ? JSON.parse(raw) : [];
  let candidates = index.filter(it => it.dir === dir || (it.dir && it.dir.startsWith(dir + '/')));
  if (type === 'img') candidates = candidates.filter(it => (it.contentType || '').startsWith('image/'));
  if (type === 'video') candidates = candidates.filter(it => (it.contentType || '').startsWith('video/'));
  if (!candidates || candidates.length === 0) return new Response('Not found', { status: 404 });
  const pick = candidates[Math.floor(Math.random()*candidates.length)];
  // fetch file data
  const b64 = await kv.get('file:' + pick.id);
  if (!b64) return new Response('Not found', { status: 404 });
  try {
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const headers = new Headers();
    headers.set('Content-Type', pick.contentType || 'application/octet-stream');
    // no Content-Disposition so browser displays inline if possible
    return new Response(bytes.buffer, { headers });
  } catch (e) {
    return new Response('Decode error', { status: 500 });
  }
}
