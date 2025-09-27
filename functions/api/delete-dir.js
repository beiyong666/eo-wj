export async function onRequest(context) {
  const { request, env } = context;
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) return new Response(JSON.stringify({ error: 'KV not configured' }), { status: 500, headers: {'Content-Type':'application/json'} });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {'Content-Type':'application/json'} });
  const cookie = request.headers.get('cookie') || '';
  const auth = cookie.split(';').map(s=>s.trim()).includes('auth=1');
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: {'Content-Type':'application/json'} });
  let body;
  try { body = await request.json(); } catch(e){ return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: {'Content-Type':'application/json'}); }
  const dir = body && body.dir ? String(body.dir).trim().replace(/^\/+|\/+$/g,'') : '';
  if (!dir) return new Response(JSON.stringify({ error: 'dir required' }), { status: 400, headers: {'Content-Type':'application/json'});
  try {
    const indexKey = 'index';
    const raw = await kv.get(indexKey);
    let index = raw ? JSON.parse(raw) : [];
    const toDelete = index.filter(it => it.dir === dir || (it.dir && it.dir.startsWith(dir+'/')));
    for (const it of toDelete) {
      try { await kv.delete('file:' + it.id); } catch(_) {}
      try { await kv.delete('meta:' + it.id); } catch(_) {}
    }
    index = index.filter(it => !(it.dir === dir || (it.dir && it.dir.startsWith(dir+'/'))));
    await kv.put(indexKey, JSON.stringify(index));
    // update dirs list - remove dir and any subdirs that start with dir+ '/'
    const rawDirs = await kv.get('dirs'); let dirs = rawDirs ? JSON.parse(rawDirs) : [];
    dirs = dirs.filter(d => !(d === dir || d.startsWith(dir+'/')));
    await kv.put('dirs', JSON.stringify(dirs));
    return new Response(JSON.stringify({ ok: true, deleted: toDelete.length }), { headers: {'Content-Type':'application/json'} });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'delete-dir failed', message: String(e) }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
}
