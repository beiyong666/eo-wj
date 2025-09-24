export async function onRequestGet(context){
  const { env } = context;
  const KV = env.DAOHANG || env.daohang;
  try {
    let s = KV ? await KV.get('state') : null;
    if (!s){
      const DEFAULT_STATE = { settings: { title: "我的导航", background: "", backgroundMode: "single", backgrounds: [], bgRotateInterval: 0, bingMarket: "en-US", overlayOpacity: 0.12, tagOpacity: 0.12, groupOpacity: 0.96, darkMode: false, accentRgb: "91,140,255", liquidGlass: false, liquidStrength: 0.5, bgNoCache: false, requireAuth: false }, groups: [{ id: "g_1", name: "常用", items: [{ id: "i_google", title: "Google", url: "https://www.google.com", desc: "搜索" }, { id: "i_github", title: "GitHub", url: "https://github.com", desc: "代码托管" }]}] };
      if (KV) await KV.put('state', JSON.stringify(DEFAULT_STATE));
      s = JSON.stringify(DEFAULT_STATE);
    }
    return new Response(s, { headers: { 'Content-Type': 'application/json' }});
  } catch (e){
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers:{ 'Content-Type':'application/json' }});
  }
}
