
export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found.' }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {'Content-Type':'application/json'} });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: {'Content-Type':'application/json'} });
  }
  const dir = (body && body.dir) ? String(body.dir) : '';
  if (!dir) return new Response(JSON.stringify({ error: 'Missing dir' }), { status: 400, headers: {'Content-Type':'application/json'} });
  try {
    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    let index = raw ? JSON.parse(raw) : [];
    const toDelete = index.filter(i => (i.dir||'') === dir).map(i => i.id);
    for (const id of toDelete) {
      try{
        await kv.delete('file:' + id);
        await kv.delete('meta:' + id);
      }catch(e){}
    }
    index = index.filter(i => (i.dir||'') !== dir);
    await kv.put(indexKey, JSON.stringify(index));
    return new Response(JSON.stringify({ ok: true, deleted: toDelete.length }), { headers: {'Content-Type':'application/json'} });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Deletion failed: ' + String(e) }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
}
