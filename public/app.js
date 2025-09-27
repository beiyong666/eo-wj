async function api(path, opts){ const res = await fetch(path, opts); if (!res.ok) throw new Error((await res.text()) || ('网络错误 ' + res.status)); try { return await res.json(); } catch(e){ return {}; } }

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function isProtected() {
  try {
    const res = await fetch('/api/check_password');
    if (!res.ok) return false;
    const j = await res.json();
    return j.protected === true;
  } catch(e) {
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

async function requireAuthFlow() {
  const protectedFlag = await isProtected();
  if (!protectedFlag) {
    // not protected, show app
    document.getElementById('app').style.display = 'block';
    return true;
  }
  if (isAuthenticated()) {
    document.getElementById('app').style.display = 'block';
    return true;
  }
  // show modal
  const modal = document.getElementById('pw-modal');
  modal.style.display = 'flex';
  document.getElementById('pw-submit').onclick = async () => {
    const pw = document.getElementById('pw-input').value;
    document.getElementById('pw-error').textContent = '';
    try {
      const res = await fetch('/api/check_password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
      const j = await res.json();
      if (res.ok && j.ok) {
        setAuthenticated(true);
        modal.style.display = 'none';
        document.getElementById('app').style.display = 'block';
        await refreshList();
      } else {
        document.getElementById('pw-error').textContent = j.error || '密码错误';
      }
    } catch (e) {
      document.getElementById('pw-error').textContent = '网络错误';
    }
  };
  return false;
}

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
      // attach delete handlers
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
          }catch(err){ alert('删除失败: ' + err.message); }
        });
      });
    }
  }catch(err){
    listDiv.innerHTML = '<p style="color:#b91c1c">加载失败: ' + err.message + '</p>';
  }
}

document.getElementById('uploadBtn').addEventListener('click', async () => {
  if (!isAuthenticated()) { alert('请先输入密码'); return; }
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
    // show copy download link button
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
    status.appendChild(copyBtn);
    fileEl.value = '';
    await refreshList();
  }catch(err){
    status.textContent = '上传失败: ' + err.message;
  }
});

window.addEventListener('load', async () => {
  await requireAuthFlow();
  if (isAuthenticated() || !(await isProtected())) {
    // only refresh if visible
    await refreshList();
  }
});