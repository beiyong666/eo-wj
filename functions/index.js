export async function onRequest(context){
  const { request, env } = context;
  const KV = env.DAOHANG || env.daohang;
  try {
    const sRaw = KV ? await KV.get('state') : null;
    let mode = 'false';
    if (sRaw){
      try {
        const st = JSON.parse(sRaw);
        const ra = st?.settings?.requireAuth;
        if (ra === true || String(ra) === 'true') mode = 'true';
        else if (String(ra) === 'only') mode = 'only';
      } catch(e){}
    }

    // fallback: if KV didn't define requireAuth, check environment variable AUTH_ENABLED
    try {
      const envVal = String(env.AUTH_ENABLED || env.AUTH || '').trim().toLowerCase();
      if (envVal === 'true') mode = 'true';
      else if (envVal === 'only') mode = 'only';
    } catch(e){}
    // if pages don't require auth, just serve assets
    if (mode !== 'true') // 优先使用绑定的 ASSETS（Cloudflare Pages 风格），兼容性回退到全局 fetch
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return await env.ASSETS.fetch(request);
    }
    // 回退：尝试全局 fetch（如果平台支持）
    try {
      return await fetch(request);
    } catch (e) {
      return new Response('Assets binding missing and global fetch failed', { status: 500 });
    }

    // otherwise require session cookie for any page access
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(cookieHeader.split(';').map(p=>p.trim()).filter(Boolean).map(p=>p.split('=').map(x=>x.trim())));
    const token = cookies['NAV_SESSION'];
    if (!token){
      return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>登录</title></head><body>
        <h2>站点需要登录</h2>
        <form method="post" action="/api/v1/login">
          <input name="password" placeholder="密码" />
          <button type="submit">登录</button>
        </form>
      </body></html>`, { headers:{ 'Content-Type': 'text/html; charset=utf-8' }, status:401 });
    }
    const ok = KV ? await KV.get('session:'+token) : null;
    if (!ok){
      return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>登录</title></head><body>
        <h2>会话失效，请重新登录</h2>
        <form method="post" action="/api/v1/login">
          <input name="password" placeholder="密码" />
          <button type="submit">登录</button>
        </form>
      </body></html>`, { headers:{ 'Content-Type': 'text/html; charset=utf-8' }, status:401 });
    }
    // 优先使用绑定的 ASSETS（Cloudflare Pages 风格），兼容性回退到全局 fetch
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return await env.ASSETS.fetch(request);
    }
    // 回退：尝试全局 fetch（如果平台支持）
    try {
      return await fetch(request);
    } catch (e) {
      return new Response('Assets binding missing and global fetch failed', { status: 500 });
    }
  } catch (e){
    return new Response(String(e), { status:500 });
  }
}