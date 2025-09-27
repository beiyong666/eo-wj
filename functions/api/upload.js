export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  // Expect multipart/form-data
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const id = crypto.randomUUID();
  const filename = file.name || 'unknown';
  const contentTypeHeader = file.type || 'application/octet-stream';
  const arrayBuffer = await file.arrayBuffer();
  const size = arrayBuffer.byteLength;

  // store binary under key file:<id>
  await env.wj.put('file:' + id, arrayBuffer);

  // store metadata under meta:<id>
  const meta = {
    id,
    filename,
    size,
    contentType: contentTypeHeader,
    createdAt: new Date().toISOString()
  };
  await env.wj.put('meta:' + id, JSON.stringify(meta));

  // update index (list)
  const indexKey = 'index';
  let index = [];
  try {
    const raw = await env.wj.get(indexKey);
    if (raw) index = JSON.parse(raw);
  } catch (e) {
    index = [];
  }
  index.unshift(meta);
  // keep only recent 1000 entries to avoid growth
  if (index.length > 1000) index = index.slice(0, 1000);
  await env.wj.put(indexKey, JSON.stringify(index));

  return new Response(JSON.stringify({ id, filename, size }), { headers: { 'Content-Type': 'application/json' } });
}
