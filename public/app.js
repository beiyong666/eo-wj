document.addEventListener('DOMContentLoaded', () => {
  // helper
  async function api(path, opts){ 
    const res = await fetch(path, opts); 
    const text = await res.text();
    try { 
      return res.ok ? JSON.parse(text || '{}') : Promise.reject(JSON.parse(text || '{}') || text);
    } catch(e){
      if (res.ok) return {};
      return Promise.reject(text || ('网络错误 ' + res.status));
    }
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function isProtected() {
    try {
      const res = await fetch('/api/check_password');
      if (!res.ok) return false;
      const j = await res.json();
      return j.protected === true;
    } catch(e) {
      console.error('isProtected error', e);
      return false;
    }
  }

  function setAuthenticated(flag) {
    if (flag) localStorage.setItem('wj_auth_v1', '1');
    else localStorage.removeItem('wj_auth_v1');
  }

  function isAuthenticated() {
    return localStorage.getItem('wj_auth_v1') === '1';
  }

  // UI refs
  const appEl = document.getElementById('app');
  const modal = document.getElementById('pw-modal');
  const pwInput = document.getElementById('pw-input');
  const pwSubmit = document.getElementById('pw-submit');
  const pwError = document.getElementById('pw-error');

  function showModal() {
    modal.classList.add('show');
    pwInput.focus();
  }
  function hideModal() {
    modal.classList.remove('show');
    pwInput.value = '';
    pwError.textContent = '';
  }

  async function requireAuthFlow() {
    const protectedFlag = await isProtected();
    if (!protectedFlag) {
      appEl.style.display = 'block';
      hideModal();
      return true;
    }
    if (isAuthenticated()) {
      appEl.style.display = 'block';
      hideModal();
      return true;
    }
    // show modal
    showModal();
    return false;
  }

  // attach password handlers robustly
  async function verifyPassword() {
    pwError.textContent = '';
    const pw = pwInput.value;
    if (!pw) {
      pwError.textContent = '请输入密码';
      return;
    }
    pwSubmit.disabled = true;
    pwSubmit.textContent = '验证中...';
    try {
      const res = await fetch('/api/check_password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
      const j = await res.json().catch(()=>({}));
      if (res.ok && j.ok) {
        setAuthenticated(true);
        hideModal();
        appEl.style.display = 'block';
        await refreshList();
      } else {
        pwError.textContent = j.error || '密码错误';
      }
    } catch (e) {
      console.error('verifyPassword error', e);
      pwError.textContent = '网络错误';
    } finally {
      pwSubmit.disabled = false;
      pwSubmit.textContent = '进入';
    }
  }

  pwSubmit.addEventListener('click', verifyPassword);
  pwInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      verifyPassword();
    }
  });

  // file list refresh & upload logic
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
          const downloadUrl = '/api/download?id=' + encodeURIComponent(item.id);
          el.innerHTML = `
            <div class="file-meta">
              <strong>${escapeHtml(item.filename)}</strong>
              <small>${item.size} bytes · ${new Date(item.createdAt).toLocaleString()}</small>
            </div>
            <div class="actions">
              <a href="${downloadUrl}" download>
                <button>下载</button>
              </a>
              <button class="secondary" data-id="${item.id}">删除</button>
              <button class="secondary copy-link" data-link="${downloadUrl}">复制链接</button>
            </div>
          `;
          listDiv.appendChild(el);
        });
        // attach delete + copy handlers
        listDiv.querySelectorAll('button.secondary').forEach(btn => {
          if (btn.classList.contains('copy-link')) {
            btn.addEventListener('click', async () => {
              const link = btn.getAttribute('data-link');
              try {
                await navigator.clipboard.writeText(window.location.origin + link);
                btn.textContent = '已复制';
                setTimeout(()=>{ btn.textContent = '复制链接'; }, 1500);
              } catch(e){
                alert('复制失败: ' + e);
              }
            });
            return;
          }
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if(!confirm('确定删除此文件？')) return;
            try{
              await api('/api/delete', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ id }) });
              await refreshList();
            }catch(err){ alert('删除失败: ' + (err.message || JSON.stringify(err))); }
          });
        });
      }
    }catch(err){
      listDiv.innerHTML = '<p style="color:#b91c1c">加载失败: ' + (err.message || JSON.stringify(err)) + '</p>';
    }
  }

  // upload handler
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');
  const uploadStatus = document.getElementById('uploadStatus');

  uploadBtn.addEventListener('click', async () => {
    if (!isAuthenticated()) { alert('请先输入密码'); return; }
    if(!fileInput.files || fileInput.files.length === 0){ alert('请选择文件'); return; }
    const file = fileInput.files[0];
    const fd = new FormData();
    fd.append('file', file, file.name);
    uploadStatus.textContent = '上传中...';
    try{
      const res = await fetch('/api/upload', { method:'POST', body: fd });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text || '{}'); } catch(e) { data = {}; }
      if(!res.ok) throw new Error(data?.error || text || ('网络错误 ' + res.status));
      uploadStatus.textContent = '上传成功: ' + data.id;
      const downloadUrl = window.location.origin + '/api/download?id=' + encodeURIComponent(data.id);
      const copyBtn = document.createElement('button');
      copyBtn.textContent = '复制下载链接';
      copyBtn.style.marginLeft = '8px';
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(downloadUrl);
          copyBtn.textContent = '已复制';
          setTimeout(()=>copyBtn.textContent = '复制下载链接', 1500);
        } catch(e) {
          alert('复制失败: ' + e);
        }
      };
      uploadStatus.appendChild(copyBtn);
      fileInput.value = '';
      await refreshList();
    }catch(err){
      uploadStatus.textContent = '上传失败: ' + (err.message || JSON.stringify(err));
    }
  });

  // initial flow
  (async () => {
    const ok = await requireAuthFlow();
    if (ok) {
      await refreshList();
    }
  })();

});