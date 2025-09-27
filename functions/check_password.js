export async function onRequest(context) {
  const { request, env } = context;
  const CORS_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers: CORS_HEADERS });

  const PASSWORD = (env && env.PASSWORD) ? String(env.PASSWORD).trim() : '';

  if (request.method === 'GET') {
    return new Response(JSON.stringify({ protected: !!PASSWORD }), { headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    let body = null;
    try { body = await request.json(); } catch(e) { return new Response(JSON.stringify({ ok:false, error:'Invalid JSON' }), { status:400, headers: CORS_HEADERS }); }
    const supplied = body && body.password ? String(body.password) : '';
    if (!PASSWORD) return new Response(JSON.stringify({ ok:true, note:'no password set on server' }), { headers: CORS_HEADERS });
    if (supplied === PASSWORD) return new Response(JSON.stringify({ ok:true }), { headers: CORS_HEADERS });
    return new Response(JSON.stringify({ ok:false, error:'密码错误' }), { status:401, headers: CORS_HEADERS });
  }

  return new Response(JSON.stringify({ ok:false, error:'Method not allowed' }), { status:405, headers: CORS_HEADERS });
}
