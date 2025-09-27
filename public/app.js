
(function(){
  function $(id){ return document.getElementById(id); }
  function safeParse(text){
    try { return text ? JSON.parse(text) : null; } catch(e){ return null; }
  }
  async function fetchJson(url, opts){
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      const data = safeParse(text);
      return { ok: res.ok, status: res.status, data, raw: text };
    } catch(e){
      return { ok:false, status:0, data:null, error: String(e) };
    }
  }

  const app = $('app'), modal = $('pw-modal'), pwInput = $('pw-input'), pwSubmit = $('pw-submit'), pwError = $('pw-error');

  function showModal(){ modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); pwInput.focus(); document.body.style.overflow='hidden'; }
  function hideModal(){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); pwInput.value=''; pwError.textContent=''; document.body.style.overflow='auto'; }

  function setAuthenticated(flag){ if(flag) localStorage.setItem('wj_auth_v1','1'); else localStorage.removeItem('wj_auth_v1'); }
  function isAuthenticated(){ return localStorage.getItem('wj_auth_v1') === '1'; }

  async function checkProtected(){
    const r = await fetchJson('/api/check_password');
    if(!r.ok) return false;
    if(r.data && typeof r.data.protected !== 'undefined') return !!r.data.protected;
    return false;
  }

  async function requireAuthFlow(){
    const prot = await checkProtected();
    if(!prot){ app.style.display='block'; return true; }
    if(isAuthenticated()){ app.style.display='block'; hideModal(); return true; }
    showModal(); return false;
  }

  pwSubmit.addEventListener('click', async ()=>{
    pwError.textContent = '';
    const pw = pwInput.value || '';
    pwSubmit.disabled = true; pwSubmit.textContent = '验证中...';
    try {
      const r = await fetchJson('/api/check_password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
      // Accept case: HTTP 200 and data.ok === true OR server returns 200 with protected=false note
      if(r.ok && r.data && (r.data.ok === true || r.data.note)){ setAuthenticated(true); hideModal(); app.style.display='block'; await refreshList(''); }
      else {
        // if server returned 401 or ok=false show reason
        const msg = (r.data && r.data.error) ? r.data.error : ('HTTP ' + r.status);
        pwError.textContent = msg;
        console.warn('login failed', r);
      }
    } catch(e){
      pwError.textContent = '网络错误';
      console.error(e);
    } finally {
      pwSubmit.disabled = false; pwSubmit.textContent = '进入';
    }
  });

  pwInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); pwSubmit.click(); } });

  // Minimal list and upload to verify flow after login
  const uploadBtn = $('uploadBtn'), fileInput = $('fileInput'), dirInput = $('dirInput'), uploadStatus = $('uploadStatus'), listDiv = $('list');
  uploadBtn.addEventListener('click', async ()=>{
    if(!(await requireAuthFlow())){ alert('请先输入密码'); return; }
    if(!fileInput.files.length){ alert('请选择文件'); return; }
    const file = fileInput.files[0]; const dir = (dirInput.value || '').trim();
    const fd = new FormData(); fd.append('file', file); fd.append('dir', dir);
    uploadStatus.textContent = '上传中...';
    try {
      const res = await fetch('/api/upload', { method:'POST', body: fd });
      const text = await res.text(); const data = safeParse(text);
      if(res.ok && data && data.ok){ uploadStatus.textContent = '上传成功'; await refreshList(dir); } else uploadStatus.textContent = '上传失败';
    } catch(e){ uploadStatus.textContent = '上传异常'; }
  });

  async function refreshList(dir=''){
    if(!(await requireAuthFlow())) return;
    listDiv.innerHTML = '加载中...';
    try {
      const q = dir ? '?dir=' + encodeURIComponent(dir) : '';
      const r = await fetchJson('/api/list' + q);
      if(!r.ok){ listDiv.innerHTML = '加载失败'; return; }
      const files = (r.data && r.data.files) ? r.data.files : [];
      if(files.length === 0){ listDiv.innerHTML = '<small>无文件</small>'; return; }
      listDiv.innerHTML = '';
      for(const f of files){
        const el = document.createElement('div');
        el.textContent = f.name + '  (' + f.size + ' bytes) ';
        const a = document.createElement('a'); a.href = f.url; a.textContent = ' 下载'; a.target='_blank';
        el.appendChild(a);
        listDiv.appendChild(el);
      }
    } catch(e){ listDiv.innerHTML = '加载异常'; }
  }

  (async ()=>{
    // try to use local auth if present
    if(isAuthenticated()){
      try { const r = await fetchJson('/api/check_password'); if(r.ok && r.data && r.data.protected !== true){ setAuthenticated(false); } else { app.style.display='block'; hideModal(); await refreshList(''); return; } } catch(e){ /* network */ }
    }
    const ok = await requireAuthFlow();
    if(ok){ await refreshList(''); }
  })();

})();
