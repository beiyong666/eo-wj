export async function onRequest(context) {
  const { request, env } = context;
  // Get configured PASSWORD from env or global
  const PASSWORD = (env && env.PASSWORD) ? env.PASSWORD : (typeof PASSWORD !== 'undefined' ? PASSWORD : '');
  // GET: tell if protected
  if (request.method === 'GET') {
    const isProtected = !!PASSWORD;
    return new Response(JSON.stringify({ protected: isProtected }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const supplied = body && body.password;
    if (!PASSWORD) {
      return new Response(JSON.stringify({ ok: true, note: 'no password set on server' }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (supplied === PASSWORD) {
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({ ok: false, error: '密码错误' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
}