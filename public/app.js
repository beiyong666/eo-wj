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
            await getDirectoryList(); // 新增：登录成功后加载目录
            await refreshList();
          } else {
            alert('密码错误');
          }
        }catch(e){
          alert('登录失败: ' + String(e));
        }
      });
    }

  }catch(e){
    // Ignore, maybe not needed on Pages environment
  }
})();

// --- File Storage Logic ---

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function api(path, opts){
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error('网络错误 ' + res.status);
  return res.json();
}

let currentDirectory = ''; // 新增：跟踪当前查看的目录

// 新增函数：获取目录列表并更新前端
async function getDirectoryList(){
  const datalist = document.getElementById('directoryList');
  const dirListDiv = document.getElementById('directoryListDisplay');
  if(!datalist || !dirListDiv) return; // 安全检查

  datalist.innerHTML = '';
  dirListDiv.innerHTML = '加载中...';
  try{
    const directories = await api('/api/directories');
    
    // 1. 更新 datalist 供上传输入框使用
    directories.forEach(dir => {
      const option = document.createElement('option');
      option.value = dir;
      datalist.appendChild(option);
    });
    
    // 2. 更新目录管理显示
    if(directories.length === 0){
      dirListDiv.innerHTML = '<p><small>还没有创建目录。</small></p>';
      return;
    }
    
    dirListDiv.innerHTML = '';

    // "全部文件" 按钮
    const allBtn = document.createElement('button');
    allBtn.textContent = '全部文件';
    allBtn.style.marginRight = '8px';
    allBtn.style.marginBottom = '8px';
    allBtn.onclick = () => switchDirectory('');
    if(currentDirectory === '') {
      allBtn.style.backgroundColor = '#10b981'; 
      allBtn.style.color = '#fff';
    } else {
      allBtn.className = 'secondary';
    }
    dirListDiv.appendChild(allBtn);

    directories.forEach(dir => {
      const card = document.createElement('div');
      card.className = 'file-card'; // 沿用样式
      card.style.display = 'inline-flex';
      card.style.alignItems = 'center';
      card.style.marginRight = '8px';
      card.style.marginBottom = '8px';
      card.style.padding = '8px 12px';
      
      const dirName = document.createElement('span');
      dirName.textContent = dir;
      dirName.style.marginRight = '12px';
      if(currentDirectory === dir) dirName.style.fontWeight = 'bold';
      
      const switchBtn = document.createElement('button');
      switchBtn.textContent = '查看';
      switchBtn.className = currentDirectory === dir ? '' : 'secondary';
      switchBtn.style.padding = '4px 8px';
      switchBtn.style.marginRight = '4px';
      switchBtn.onclick = () => switchDirectory(dir);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '删除目录';
      deleteBtn.className = 'secondary';
      deleteBtn.style.padding = '4px 8px';
      deleteBtn.style.backgroundColor = '#b91c1c'; // 红色删除按钮
      deleteBtn.style.color = '#fff';
      deleteBtn.onclick = () => deleteDirectory(dir);

      card.appendChild(dirName);
      card.appendChild(switchBtn);
      card.appendChild(deleteBtn);
      dirListDiv.appendChild(card);
    });

  }catch(err){
    dirListDiv.innerHTML = '<p style="color:#b91c1c"><small>目录加载失败: ' + err.message + '</small></p>';
  }
}

// 新增函数：切换目录
function switchDirectory(dir){
  currentDirectory = dir;
  document.getElementById('currentDirectoryName').textContent = dir === '' ? '全部文件' : dir;
  refreshList(); // 重新加载文件列表
  getDirectoryList(); // 刷新目录列表以突出显示当前目录
}

// 新增函数：删除目录 (后端会同时清除文件的 directory 字段)
async function deleteDirectory(dir){
  if(!confirm(`确定要删除目录 "${dir}" 吗？此操作将删除目录名称，并将其中的文件归为“无目录”。`)) return;
  try{
    const res = await fetch('/api/directories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory: dir })
    });
    const j = await res.json();
    if(!res.ok || !j.ok) throw new Error(j.error || '未知错误');
    
    alert(`目录 "${dir}" 已删除，相关文件已归档到“无目录”。`);
    if(currentDirectory === dir) switchDirectory(''); // 如果删除的是当前目录，则切换到全部文件
    else getDirectoryList();
    refreshList();
  }catch(err){
    alert('删除目录失败: ' + err.message);
  }
}

async function refreshList(){
  const listDiv = document.getElementById('list');
  listDiv.innerHTML = '加载中...';
  try{
    const data = await api('/api/list');
    if(!Array.isArray(data)) throw new Error('Invalid list');

    // 过滤文件：只显示当前目录的文件
    const filteredData = data.filter(item => 
      currentDirectory === '' 
      ? (!item.directory || item.directory === '') // 当查看全部文件时，显示无目录或目录为空的文件
      : item.directory === currentDirectory
    );

    if(filteredData.length === 0) listDiv.innerHTML = '<p><small>' + (currentDirectory === '' ? '还没有文件。' : `目录 "${currentDirectory}" 中没有文件。`) + '</small></p>';
    else {
      listDiv.innerHTML = '';
      filteredData.forEach(item => { // 使用 filteredData
        const el = document.createElement('div');
        el.className = 'file-card';
        el.innerHTML = `
          <div class="file-meta">
            <strong>${escapeHtml(item.filename)}</strong>
            <small>目录: ${item.directory ? escapeHtml(item.directory) : '无目录'} · ${item.size} bytes · ${new Date(item.createdAt).toLocaleString()}</small>
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
      listDiv.querySelectorAll('button.secondary').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if(!confirm('确定删除此文件？')) return;
          try{
            await api('/api/delete', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ id }) });
            await refreshList(); 
            await getDirectoryList(); // 刷新目录列表以确保一致性
          }catch(err){ alert('删除失败: ' + err.message); }
        });
      });
    }
  }catch(err){
    listDiv.innerHTML = '<p style="color:#b91c1c">加载失败: ' + err.message + '</p>';
  }
}

document.getElementById('uploadBtn').addEventListener('click', async () => {
  const fileEl = document.getElementById('fileInput');
  const dirEl = document.getElementById('directoryInput'); // 新增：获取目录输入框
  const status = document.getElementById('uploadStatus');
  if(!fileEl.files || fileEl.files.length === 0){ alert('请选择文件'); return; }
  const file = fileEl.files[0];
  const directory = dirEl.value.trim(); // 新增：获取目录值
  
  const fd = new FormData();
  fd.append('file', file, file.name);
  if (directory) { // 新增：如果目录不为空，则添加到 FormData
    fd.append('directory', directory);
  }

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
      box.innerHTML = `<input id=\"downloadUrlInput\" style=\"width:70%\" readonly value=\"${data.downloadUrl}\" /><button id=\"copyDlBtn\">复制下载链接</button>`;
      status.parentNode.appendChild(box);
      document.getElementById('copyDlBtn').addEventListener('click', async ()=>{
        try{ await navigator.clipboard.writeText(data.downloadUrl); alert('已复制到剪贴板'); }catch(e){ window.prompt('复制链接，手动复制:', data.downloadUrl); }
      });
    }

    fileEl.value = '';
    dirEl.value = ''; // 新增：清空目录输入
    await refreshList();
    await getDirectoryList(); // 新增：更新目录列表
  }catch(err){
    status.textContent = '上传失败: ' + err.message;
  }
});

window.addEventListener('load', async () => {
  await getDirectoryList();
  await refreshList();
});
