// functions/api/upload.js
export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders() });
    }

    const contentType = request.headers.get('content-type') || '';
    // 防御性检查：确保 multipart 包含 boundary
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data', got: contentType }), { status: 400, headers: jsonHeaders() });
    }

    // 尝试解析 formData
    let form;
    try {
      form = await request.formData();
    } catch (e) {
      // 返回详细错误以便排查（不要在生产暴露堆栈）
      return new Response(JSON.stringify({ error: 'Failed to parse multipart/form-data', message: String(e) }), { status: 400, headers: jsonHeaders() });
    }

    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ error: 'No file field found in form-data (field name must be "file")' }), { status: 400, headers: jsonHeaders() });
    }

    // 生成 id 与读取内容
    const id = (typeof crypto?.randomUUID === 'function') ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    const filename = file.name || 'unknown';
    const contentTypeHeader = file.type || 'application/octet-stream';

    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to read uploaded file as arrayBuffer', message: String(e) }), { status: 500, headers: jsonHeaders() });
    }

    const size = arrayBuffer.byteLength;

    // Some KV implementations like Cloudflare KV accept ArrayBuffer or Uint8Array.
    // Convert to Uint8Array to be safe.
    const uint8 = new Uint8Array(arrayBuffer);

    try {
      await env.wj.put('file:' + id, uint8);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'KV put failed (file)', message: String(e) }), { status: 500, headers: jsonHeaders() });
    }

    const meta = {
      id,
      filename,
      size,
      contentType: contentTypeHeader,
      createdAt: new Date().toISOString()
    };

    try {
      await env.wj.put('meta:' + id, JSON.stringify(meta));
    } catch (e) {
      // 尝试回滚文件键（忽略回滚错误）
      try { await env.wj.delete('file:' + id); } catch(_) {}
      return new Response(JSON.stringify({ error: 'KV put failed (meta)', message: String(e) }), { status: 500, headers: jsonHeaders() });
    }

    // 更新索引（尽量原子化简单实现）
    try {
      const indexKey = 'index';
      let raw = await env.wj.get(indexKey);
      let index = raw ? JSON.parse(raw) : [];
      index.unshift(meta);
      if (index.length > 1000) index = index.slice(0, 1000);
      await env.wj.put(indexKey, JSON.stringify(index));
    } catch (e) {
      // index 更新失败不阻塞主要流程，但返回警告
      return new Response(JSON.stringify({ id, warning: 'uploaded but index update failed', message: String(e) }), { status: 201, headers: jsonHeaders() });
    }

    return new Response(JSON.stringify({ id, filename, size }), { status: 201, headers: jsonHeaders() });

  } catch (err) {
    // 最后兜底：返回清晰的错误
    return new Response(JSON.stringify({ error: 'Unhandled server error', message: String(err) }), { status: 500, headers: jsonHeaders() });
  }
}

function jsonHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
}
