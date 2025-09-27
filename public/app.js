async function api(path, opts){ const res = await fetch(path, opts); if (!res.ok) throw new Error('网络错误 ' + res.status); return res.json(); }

async function refreshList(){
  const listDiv = document.getElementById('list');
  listDiv.innerHTML = '加载中...';
  try{
    const data = await api('/api/list');
    if(!Array.isArray(data)) throw new Error('Invalid list');
    if(data.length === 0) listDiv.innerHTML = '<p><small>还没有文件。</small></p>';
    else {
      listDiv.innerHTML = '';
      data.forEach(item => {
        const el = document.createElement('div');
        el.className = 'file-card';
        el.innerHTML = `
          <div class="file-meta">
            <strong>${escapeHtml(item.filename)}</strong>
            <small>${item.size} bytes · ${new Date(item.createdAt).toLocaleString()}</small>
          </div>
          <div class="actions">
            <a href="/api/download?id=${encodeURIComponent(item.id)}" download>
              <button>下载</button>
            </a>
            <button class="secondary" data-id="${item.id}">删除</button>
          </div>
        `;
        listDiv.appendChild(el);
      });
      // attach delete handlers
      listDiv.querySelectorAll('button.secondary').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if(!confirm('确定删除此文件？')) return;
          try{
            await api('/api/delete', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ id }) });
            await refreshList();
          }catch(err){ alert('删除失败: ' + err.message); }
        });
      });
    }
  }catch(err){
    listDiv.innerHTML = '<p style="color:#b91c1c">加载失败: ' + err.message + '</p>';
  }
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

document.getElementById('uploadBtn').addEventListener('click', async () => {
  const fileEl = document.getElementById('fileInput');
  const status = document.getElementById('uploadStatus');
  if(!fileEl.files || fileEl.files.length === 0){ alert('请选择文件'); return; }
  const file = fileEl.files[0];
  const fd = new FormData();
  fd.append('file', file, file.name);
  status.textContent = '上传中...';
  try{
    const res = await fetch('/api/upload', { method:'POST', body: fd });
    const data = await res.json();
    if(!res.ok) throw new Error(data?.error || JSON.stringify(data));
    status.textContent = '上传成功: ' + data.id;
    fileEl.value = '';
    await refreshList();
  }catch(err){
    status.textContent = '上传失败: ' + err.message;
  }
});

window.addEventListener('load', refreshList);
