export async function onRequest(context) {
  const { request, env } = context;
  // resolve KV binding: prefer env.wj, fallback to global wj
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found. Bind your KV namespace as "wj".' }), { status: 500, headers: jsonHeaders() });
  }

  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders() });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data', got: contentType }), { status: 400, headers: jsonHeaders() });
    }

    let form;
    try {
      form = await request.formData();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse multipart/form-data', message: String(e) }), { status: 400, headers: jsonHeaders() });
    }

    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ error: 'No file field found in form-data (field name must be "file")' }), { status: 400, headers: jsonHeaders() });
    }

    // 新增：获取目录信息
    const directoryRaw = form.get('directory');
    // 清理和规范化目录名称，只允许非空字符串
    const directory = (typeof directoryRaw === 'string' && directoryRaw.trim().length > 0) ? directoryRaw.trim() : undefined;


    const id = (typeof crypto?.randomUUID === 'function') ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    
    // file properties
    const filename = file.name || 'file';
    const contentTypeHeader = file.type || 'application/octet-stream';
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const size = uint8.byteLength;

    // convert to base64 string
    const base64 = btoa(String.fromCharCode(...uint8));

    // put file content
    try {
      await kv.put('file:' + id, base64);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'KV put failed (file)', message: String(e) }), { status: 500, headers: jsonHeaders() });
    }

    const meta = {
      id,
      filename,
      size,
      contentType: contentTypeHeader,
      createdAt: new Date().toISOString(),
      directory: directory // <--- 新增字段
    };

    try {
      await kv.put('meta:' + id, JSON.stringify(meta));
    } catch (e) {
      // attempt rollback
      try { await kv.delete('file:' + id); } catch(_) {}
      return new Response(JSON.stringify({ error: 'KV put failed (meta)', message: String(e) }), { status: 500, headers: jsonHeaders() });
    }

    // update index
    try {
      const indexKey = 'index';
      let raw = await kv.get(indexKey);
      let index = raw ? JSON.parse(raw) : [];
      index.unshift(meta);
      if (index.length > 1000) index = index.slice(0, 1000);
      await kv.put(indexKey, JSON.stringify(index));
    } catch (e) {
      // index update failed but file uploaded. Return warning but success.
      return new Response(JSON.stringify({ id, warning: 'uploaded but index update failed', message: String(e) }), { status: 201, headers: jsonHeaders() });
    }
    
    // 新增：更新目录列表
    if (directory) {
      try {
        const dirKey = 'directories';
        let rawDirs = await kv.get(dirKey);
        let directories = rawDirs ? JSON.parse(rawDirs) : [];
        if (!directories.includes(directory)) {
          directories.push(directory);
          await kv.put(dirKey, JSON.stringify(directories));
        }
      } catch (e) {
        console.warn('Directory index update failed:', String(e));
        // 不影响上传结果，只返回警告
        return new Response(JSON.stringify({ id, warning: 'uploaded but directory index update failed', message: String(e) }), { status: 201, headers: jsonHeaders() });
      }
    }

    const downloadUrl = new URL('/api/download?id=' + id, request.url).toString();
    return new Response(JSON.stringify({ id, filename, size, downloadUrl }), { status: 201, headers: jsonHeaders() });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unhandled server error', message: String(err) }), { status: 500, headers: jsonHeaders() });
  }
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json' };
}
