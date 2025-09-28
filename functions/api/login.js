export async function onRequest(context) {
  const { request, env } = context;
  // env.PASSWORD should be set in Pages/Functions environment variables
  const PASSWORD = env && env.PASSWORD ? env.PASSWORD : undefined;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {'Content-Type':'application/json'} });
  }
  if (!PASSWORD) {
    return new Response(JSON.stringify({ error: 'Server password not configured' }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
  try {
    const j = await request.json();
    const pwd = j && j.password ? String(j.password) : '';
    if (pwd === PASSWORD) {
      // set HttpOnly cookie valid for 1 hour
      const headers = {
        'Content-Type':'application/json',
        'Set-Cookie': 'auth=1; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax'
      };
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    } else {
      return new Response(JSON.stringify({ ok: false }), { status: 401, headers: {'Content-Type':'application/json'} });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
}
