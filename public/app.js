
// --- Password gate (uses window.SITE_CONFIG) ---
(function(){
  try{
    const cfg = window.SITE_CONFIG || { PASSWORD_ENABLED:false };
    const overlay = document.getElementById('pwOverlay');
    const pwInput = overlay ? document.getElementById('pwInput') : null;
    const pwSubmit = overlay ? document.getElementById('pwSubmit') : null;

    function isAuthenticated(){
      try{
        const at = localStorage.getItem('auth_time');
        if(!at) return false;
        const ts = Number(at);
        if(!ts) return false;
        const now = Date.now();
        return (now - ts) < (60*60*1000); // 1 hour
      }catch(e){ return false; }
    }

    function requireAuth(){
      if(!overlay) return;
      overlay.style.display = 'flex';
      pwInput && pwInput.focus();
    }

    function finishAuth(){
      if(!overlay) return;
      localStorage.setItem('auth_time', String(Date.now()));
      overlay.style.display = 'none';
    }

    if(cfg.PASSWORD_ENABLED){
      if(isAuthenticated()){
        // already ok
      } else {
        requireAuth();
      }
      if(pwSubmit){
        pwSubmit.addEventListener('click', () => {
          const v = pwInput.value || '';
          if(v === cfg.PASSWORD){
            finishAuth();
          } else {
            alert('密码错误');
            pwInput.value = '';
            pwInput.focus();
          }
        });
        // allow Enter key
        pwInput.addEventListener('keydown', (e) => {
          if(e.key === 'Enter') pwSubmit.click();
        });
      }
    } else {
      // ensure overlay hidden if disabled
      if(overlay) overlay.style.display = 'none';
    }
  }catch(e){
    console.error('Password gate init error', e);
  }
})();
// --- end password gate ---


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

window.addEventListener('load', refreshList);
