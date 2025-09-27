export async function onRequest(context) {
  const { request } = context;
  const cookie = request.headers.get('cookie') || '';
  const auth = cookie.split(';').map(s=>s.trim()).includes('auth=1');
  return new Response(JSON.stringify({ auth }), { status: 200, headers: {'Content-Type':'application/json'} });
}
