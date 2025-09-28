// functions/api/directories.js
const DIRECTORIES_KEY = 'directories';

export async function onRequest(context) {
  const { request, env } = context;
  // resolve KV binding: prefer env.wj, fallback to global wj
  const kv = (env && env.wj) ? env.wj : (typeof wj !== 'undefined' ? wj : null);
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV binding "wj" not found. Bind your KV namespace as "wj".' }), { status: 500, headers: {'Content-Type':'application/json'} });
  }

  // --- GET: 获取目录列表 ---
  if (request.method === 'GET') {
    try {
      const raw = await kv.get(DIRECTORIES_KEY);
      const directories = raw ? JSON.parse(raw) : [];
      // 返回一个排序后的列表
      directories.sort((a, b) => a.localeCompare(b, 'zh'));
      return new Response(JSON.stringify(directories), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      // 首次运行时可能没有该键，返回空数组
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // --- DELETE: 删除目录名（不删除文件，但清除文件元数据中的 directory 字段） ---
  if (request.method === 'DELETE') {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: {'Content-Type':'application/json'} });
    }
    const directoryToDelete = body && body.directory;
    if (!directoryToDelete) return new Response(JSON.stringify({ error: 'directory name required' }), { status: 400, headers: {'Content-Type':'application/json'} });
    
    try {
      // 1. 从目录列表中移除该目录名
      const raw = await kv.get(DIRECTORIES_KEY);
      let directories = raw ? JSON.parse(raw) : [];
      directories = directories.filter(dir => dir !== directoryToDelete);
      await kv.put(DIRECTORIES_KEY, JSON.stringify(directories));
      
      // 2. 更新所有属于该目录的文件的元数据和索引，将其 directory 字段置空
      const indexKey = 'index';
      const rawIndex = await kv.get(indexKey);
      let index = rawIndex ? JSON.parse(rawIndex) : [];
      
      const filesToUpdate = index.filter(item => item.directory === directoryToDelete);
      
      // 更新主索引 (Index)
      const updatedIndex = index.map(item => {
        if (item.directory === directoryToDelete) {
          delete item.directory; 
          return item;
        }
        return item;
      });
      await kv.put(indexKey, JSON.stringify(updatedIndex));

      // 批量更新文件的元数据 (meta:id)
      // 注意：此操作依赖于 Promise.all，如果文件过多，可能会超时。对于小型项目足够。
      const updatePromises = filesToUpdate.map(async (fileMeta) => {
        const newMeta = { ...fileMeta };
        delete newMeta.directory; 
        // 保证 meta:id 键存在，并且只更新实际需要更新的元数据
        if (newMeta.id) {
            await kv.put('meta:' + newMeta.id, JSON.stringify(newMeta));
        }
      });
      await Promise.all(updatePromises);
      

      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });

    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'directory delete failed', message: String(e) }), { status: 500, headers: {'Content-Type':'application/json'} });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {'Content-Type':'application/json'} });
}
