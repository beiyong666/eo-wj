
// --- Server-backed password gate ---
// Flow: on load call /api/check-auth. If not authenticated show overlay.
// On submit, POST /api/login with JSON { password }. If success, server sets HttpOnly cookie (1 hour).
(async function(){
  try{
    const overlay = document.getElementById('pwOverlay');
    const pwInput = overlay ? document.getElementById('pwInput') : null;
    const pwSubmit = overlay ? document.getElementById('pwSubmit') : null;

    async function checkAuth(){
      try{
        const res = await fetch('/api/check-auth', { method: 'GET', credentials: 'same-origin' });
        if(!res.ok) return false;
        const j = await res.json();
        return !!j.auth;
      }catch(e){ return false; }
    }

    function showOverlay(){ if(overlay) overlay.style.display = 'flex'; }
    function hideOverlay(){ if(overlay) overlay.style.display = 'none'; }

    const authed = await checkAuth();
    if(!authed){
      showOverlay();
    } else {
      hideOverlay();
    }

    if(pwSubmit){
      pwSubmit.addEventListener('click', async ()=>{
        const pwd = pwInput.value || '';
        try{
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd }),
            credentials: 'same-origin'
          });
          const j = await res.json();
          if(res.ok && j.ok){
            hideOverlay();
          } else {
            alert('密码错误');
            pwInput.value = '';
            pwInput.focus();
          }
        }catch(e){
          alert('请求失败：' + e.message);
        }
      });
      pwInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') pwSubmit.click(); });
    }
  }catch(e){
    console.error('Server auth init error', e);
  }
})();
// --- end server-backed password gate ---






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
  const dirVal = (document.getElementById('dirInput')||{value:''}).value || '';
  fd.append('dir', dirVal);
  status.textContent = '上传中...';
  try{
    const res = await fetch('/api/upload2', { method:'POST', body: fd });
    const data = await res.json();
    if(!res.ok) throw new Error(data?.error || JSON.stringify(data));
    status.textContent = '上传成功: ' + data.id;
    // show copy link UI if available
    if(data.downloadUrl){
      let existing = document.getElementById('downloadLinkBox');
      if(existing) existing.remove();
      const box = document.createElement('div');
      box.id = 'downloadLinkBox';
      box.style.marginTop = '8px';
      box.innerHTML = `<input id="downloadUrlInput" style="width:70%" readonly value="${data.downloadUrl}" /><button id="copyDlBtn">复制下载链接</button>`;
      status.parentNode.appendChild(box);
      document.getElementById('copyDlBtn').addEventListener('click', async ()=>{
        try{ await navigator.clipboard.writeText(data.downloadUrl); alert('已复制到剪贴板'); }catch(e){ window.prompt('复制链接，手动复制:', data.downloadUrl); }
      });
    }

    fileEl.value = '';
    await refreshList();
  }catch(err){
    status.textContent = '上传失败: ' + err.message;
  }
});



let selectedDir = '';
async function refreshDirs(){
  try{
    const res = await fetch('/api/dirs');
    if(!res.ok) return;
    const dirs = await res.json();
    const box = document.getElementById('dirList');
    box.innerHTML = '';
    if(!dirs || dirs.length===0){ box.textContent = '没有目录'; return; }
    dirs.forEach(d=>{
      const row = document.createElement('div');
      row.className = 'dirRow';
      row.style.marginBottom = '6px';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = d;
      nameSpan.style.cursor = 'pointer';
      nameSpan.addEventListener('click', ()=>{
        selectedDir = d;
        // visually mark selected
        Array.from(box.querySelectorAll('.dirRow')).forEach(r=> r.style.background='');
        row.style.background = '#eef';
        refreshList();
      });
      row.appendChild(nameSpan);

      const viewBtn = document.createElement('button');
      viewBtn.textContent = '查看';
      viewBtn.style.marginLeft = '8px';
      viewBtn.addEventListener('click', ()=>{
        selectedDir = d;
        Array.from(box.querySelectorAll('.dirRow')).forEach(r=> r.style.background='');
        row.style.background = '#eef';
        refreshList();
      });
      row.appendChild(viewBtn);

      const btn = document.createElement('button');
      btn.textContent = '删除目录';
      btn.style.marginLeft = '8px';
      btn.addEventListener('click', async ()=>{
        if(!confirm('确定删除目录：' + d + ' 及其中所有文件吗？')) return;
        try{
          const r = await fetch('/api/delete-dir', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ dir: d }) });
          const j = await r.json();
          if(!r.ok) throw new Error(j?.error || '删除失败');
          alert('已删除目录: ' + d);
          selectedDir = '';
          await refreshList();
          await refreshDirs();
        }catch(e){ alert('删除目录失败: ' + e.message); }
      });
      row.appendChild(btn);
      box.appendChild(row);
    });
  }catch(e){}
}

  try{
    const res = await fetch('/api/dirs');
    if(!res.ok) return;
    const dirs = await res.json();
    const box = document.getElementById('dirList');
    box.innerHTML = '';
    if(!dirs || dirs.length===0){ box.textContent = '没有目录'; return; }
    dirs.forEach(d=>{
      const row = document.createElement('div');
      row.className = 'dirRow';
      row.textContent = d;
      const btn = document.createElement('button');
      btn.textContent = '删除目录';
      btn.style.marginLeft = '8px';
      btn.addEventListener('click', async ()=>{
        if(!confirm('确定删除目录：' + d + ' 及其中所有文件吗？')) return;
        try{
          const r = await fetch('/api/delete-dir', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ dir: d }) });
          const j = await r.json();
          if(!r.ok) throw new Error(j?.error || '删除失败');
          alert('已删除目录: ' + d);
          await refreshList();
          await refreshDirs();
        }catch(e){ alert('删除目录失败: ' + e.message); }
      });
      row.appendChild(btn);
      box.appendChild(row);
    });
  }catch(e){}
}

window.addEventListener('load', ()=>{ refreshList(); refreshDirs(); });
