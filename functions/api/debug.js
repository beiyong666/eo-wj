// functions/api/debug.js
export async function onRequest(context) {
  const { request } = context;
  const headers = {};
  for (const [k,v] of request.headers) headers[k] = v;
  let info = { method: request.method, url: request.url, headers };

  // 只处理 POST 的简单诊断
  if (request.method === 'POST') {
    try {
      // 尝试读取 some text (注意：读取 body 会消耗 body)
      const text = await request.text();
      info.bodyPreview = text.slice(0, 1024); // 预览前 1kb
    } catch (e) {
      info.bodyPreview = 'failed to read body: ' + String(e);
    }
  }

  return new Response(JSON.stringify(info, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  });
}
