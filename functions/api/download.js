export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const metaRaw = await env.wj.get('meta:' + id);
  if (!metaRaw) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  const meta = JSON.parse(metaRaw);

  // get binary as arrayBuffer
  const arrayBuffer = await env.wj.get('file:' + id, { type: 'arrayBuffer' });
  if (!arrayBuffer) return new Response(JSON.stringify({ error: 'file not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const headers = new Headers();
  headers.set('Content-Type', meta.contentType || 'application/octet-stream');
  // prompt download with original filename
  headers.set('Content-Disposition', `attachment; filename="${meta.filename.replace(/["\\]/g, '')}"`);
  return new Response(arrayBuffer, { headers });
}
