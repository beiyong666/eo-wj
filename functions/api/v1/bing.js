export async function onRequestGet(context){
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const mkt = url.searchParams.get('mkt') || 'en-US';
    const nocache = url.searchParams.get('nocache');
    let n = parseInt(url.searchParams.get('n') || '1', 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 8) n = 8;
    let bingApi = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=' + encodeURIComponent(String(n)) + '&mkt=' + encodeURIComponent(mkt);
    if (nocache) bingApi += '&_=' + Date.now();
    const fetchOpts = nocache ? { cf: { cacheTtl: 0 } } : { cf: { cacheTtl: 3600 } };
    const r = await fetch(bingApi, fetchOpts);
    if (!r.ok) return new Response(JSON.stringify({ ok:false, msg:'bing fetch failed', status: r.status }), { status:502, headers:{ 'Content-Type':'application/json' }});
    const j = await r.json().catch(()=>null);
    if (!j || !j.images || !Array.isArray(j.images) || j.images.length === 0) {
      return new Response(JSON.stringify({ ok:false, msg:'bing json invalid' }), { status:502, headers:{ 'Content-Type':'application/json' }});
    }
    const urls = j.images.map(img => (img.url && img.url.startsWith('http')) ? img.url : ('https://www.bing.com' + img.url));
    if (urls.length === 1) return new Response(JSON.stringify({ ok:true, url: urls[0], meta: j.images[0] }), { headers:{ 'Content-Type':'application/json' }});
    return new Response(JSON.stringify({ ok:true, urls: urls, meta: j.images }), { headers:{ 'Content-Type':'application/json' }});
  } catch (e){
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status:500, headers:{ 'Content-Type':'application/json' }});
  }
}
