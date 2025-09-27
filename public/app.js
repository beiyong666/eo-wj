
(function(){
  function $(id){ return document.getElementById(id); }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function jsonFetch(url, opts){ const res = await fetch(url, opts); const text = await res.text(); try { return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null, raw: text }; } catch(e){ return { ok: res.ok, status: res.status, data: null, raw: text }; } }

  const app = $('app'), modal = $('pw-modal'), pwInput = $('pw-input'), pwSubmit = $('pw-submit'), pwError = $('pw-error');

  function showModal(){ modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); pwInput.focus(); }
  function hideModal(){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); pwInput.value=''; pwError.textContent=''; }

  function setAuthenticated(flag){ if(flag) localStorage.setItem('wj_auth_v1','1'); else localStorage.removeItem('wj_auth_v1'); }
  function isAuthenticated(){ return localStorage.getItem('wj_auth_v1') === '1'; }

  async function isProtected(){
    try {
      const r = await jsonFetch('/api/check_password');
      return r.ok && r.data && r.data.protected === true;
    } catch(e){
      console.error('isProtected error', e);
      return false;
    }
  }

  async function requireAuthFlow(){
    const prot = await isProtected();
    if(!prot){ app.style.display = 'block'; return true; }
    if(isAuthenticated()){ app.style.display = 'block'; hideModal(); return true; }
    showModal();
    return false;
  }

  async function tryLoginWithLocalFlag(){
    if(isAuthenticated()){
      try {
        const r = await jsonFetch('/api/check_password');
        if(r.ok && r.data && r.data.protected === true){
          app.style.display = 'block';
          hideModal();
          return true;
        } else {
          setAuthenticated(false);
          app.style.display = 'block';
          hideModal();
          return true;
        }
      } catch(e){
        app.style.display = 'block';
        hideModal();
        return true;
      }
    }
    return false;
  }

  pwSubmit.addEventListener('click', async ()=>{
    pwError.textContent='';
    const pw = pwInput.value || '';
    pwSubmit.disabled = true; pwSubmit.textContent = '验证中...';
    try{
      const res = await fetch('/api/check_password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch(e){ console.error('parse error', e, text); }
      if(res.ok && data && data.ok){
        setAuthenticated(true);
        hideModal();
        app.style.display = 'block';
        await refreshRandomConfig();
        await refreshList('');
      } else {
        const msg = (data && data.error) ? data.error : ('HTTP ' + res.status);
        pwError.textContent = msg;
        console.warn('login failed', msg, data);
      }
    } catch(e){
      console.error('login fetch error', e);
      pwError.textContent = '网络错误';
    } finally {
      pwSubmit.disabled = false; pwSubmit.textContent = '进入';
    }
  });

  pwInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); pwSubmit.click(); } });

  // upload
  const uploadBtn = $('uploadBtn'), fileInput = $('fileInput'), dirInput = $('dirInput'), uploadStatus = $('uploadStatus');
  uploadBtn.addEventListener('click', async ()=>{
    if(!(await requireAuthFlow())){ alert('请先输入密码'); return; }
    if(!fileInput.files || fileInput.files.length===0){ alert('请选择文件'); return; }
    const file = fileInput.files[0];
    const dir = (dirInput.value || '').trim();
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('dir', dir);
    uploadStatus.textContent = '上传中...';
    try{
      const res = await fetch('/api/upload', { method:'POST', body: fd });
      const text = await res.text();
      let data = null;
      try{ data = text ? JSON.parse(text) : null; } catch(e){ data = null; }
      if(!res.ok){ uploadStatus.textContent = '上传失败: ' + (data && data.error ? data.error : res.status); return; }
      uploadStatus.textContent = '上传成功: ' + (data && data.key ? data.key : '');
      const downloadUrl = window.location.origin + '/api/download?path=' + encodeURIComponent(data.key);
      const copyBtn = document.createElement('button'); copyBtn.textContent='复制下载链接'; copyBtn.style.marginLeft='8px';
      copyBtn.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(downloadUrl); copyBtn.textContent='已复制'; setTimeout(()=>copyBtn.textContent='复制下载链接',1500);}catch(e){ alert('复制失败: '+e); } });
      uploadStatus.appendChild(copyBtn);
      fileInput.value=''; await refreshList(dir);
    } catch(e){
      uploadStatus.textContent = '上传异常: '+String(e);
    }
  });

  // listing
  const listDirInput = $('listDirInput'), listBtn = $('listBtn'), listRootBtn = $('listRootBtn'), listDiv = $('list');
  listBtn.addEventListener('click', ()=>{ refreshList(listDirInput.value || ''); });
  listRootBtn.addEventListener('click', ()=>{ refreshList(''); });

  async function refreshList(dir=''){
    if(!(await requireAuthFlow())) return;
    listDiv.innerHTML = '加载中...';
    try{
      const q = dir ? '?dir=' + encodeURIComponent(dir) : '';
      const r = await jsonFetch('/api/list' + q);
      if(!r.ok){ listDiv.innerHTML = '<div style="color:#b91c1c">加载失败: '+(r.raw||r.status)+'</div>'; return; }
      const files = (r.data && r.data.files) ? r.data.files : [];
      if(files.length===0){ listDiv.innerHTML = '<p><small>目录为空或不存在。</small></p>'; return; }
      listDiv.innerHTML = '';
      files.forEach(item=>{
        const el = document.createElement('div'); el.className='file-card';
        el.innerHTML = '<div class="file-meta"><strong>'+escapeHtml(item.name)+'</strong><small>'+escapeHtml(String(item.size))+' bytes · '+escapeHtml(item.type || '')+'</small></div>';
        const actions = document.createElement('div'); actions.className='actions';
        const aDL = document.createElement('a'); aDL.href = item.url; aDL.target='_blank'; const dlBtn = document.createElement('button'); dlBtn.textContent='下载'; aDL.appendChild(dlBtn);
        const delBtn = document.createElement('button'); delBtn.className='secondary'; delBtn.textContent='删除';
        delBtn.addEventListener('click', async ()=>{
          if(!confirm('确定删除此文件？')) return;
          const res = await jsonFetch('/api/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: item.key, dir: false }) });
          if(res.ok && res.data && res.data.ok){ await refreshList(dir); } else { alert('删除失败'); }
        });
        const copyBtn = document.createElement('button'); copyBtn.className='secondary'; copyBtn.textContent='复制链接';
        copyBtn.addEventListener('click', async ()=>{
          try{ await navigator.clipboard.writeText(window.location.origin + '/api/download?path=' + encodeURIComponent(item.key)); copyBtn.textContent='已复制'; setTimeout(()=>copyBtn.textContent='复制链接',1500);}catch(e){ alert('复制失败: '+e); }
        });
        actions.appendChild(aDL); actions.appendChild(delBtn); actions.appendChild(copyBtn);
        el.appendChild(actions);
        listDiv.appendChild(el);
      });
    }catch(e){ listDiv.innerHTML = '<div style="color:#b91c1c">加载异常: '+String(e)+'</div>'; }
  }

  // random config
  const randomDirInput = $('randomDirInput'), addRandomDirBtn = $('addRandomDirBtn'), randomDirsList = $('randomDirsList'), refreshRandomConfigBtn = $('refreshRandomConfigBtn');
  addRandomDirBtn.addEventListener('click', async ()=>{
    const d = (randomDirInput.value || '').trim(); if(!d) return alert('请输入目录');
    const res = await jsonFetch('/api/randomconfig', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ dir: d }) });
    if(res.ok && res.data){ randomDirInput.value=''; await refreshRandomConfig(); } else { alert('添加失败'); }
  });
  refreshRandomConfigBtn.addEventListener('click', refreshRandomConfig);

  async function refreshRandomConfig(){
    const r = await jsonFetch('/api/randomconfig');
    randomDirsList.innerHTML = '';
    if(r.ok && r.data && Array.isArray(r.data.dirs)){
      r.data.dirs.forEach(d=>{
        const item = document.createElement('div'); item.className='dir-item';
        item.innerHTML = '<div>'+escapeHtml(d)+'</div>';
        const remove = document.createElement('button'); remove.className='secondary'; remove.textContent='移除';
        remove.addEventListener('click', async ()=>{
          const res = await jsonFetch('/api/randomconfig?dir='+encodeURIComponent(d), { method:'DELETE' });
          if(res.ok && res.data){ await refreshRandomConfig(); } else alert('移除失败');
        });
        item.appendChild(remove); randomDirsList.appendChild(item);
      });
    } else {
      randomDirsList.innerHTML = '<small>暂无开放目录</small>';
    }
  }

  // random test
  const randomDirTest = $('randomDirTest'), randomType = $('randomType'), randomBtn = $('randomBtn'), randomResult = $('randomResult');
  randomBtn.addEventListener('click', async ()=>{
    const d = (randomDirTest.value || '').trim(); const t = randomType.value;
    if(!d) return alert('请输入目录');
    randomResult.innerHTML = '请求中...';
    const r = await jsonFetch('/api/random?dir=' + encodeURIComponent(d) + '&type=' + encodeURIComponent(t));
    if(!r.ok || !r.data || !r.data.url){ randomResult.innerHTML = '<div style="color:#b91c1c">错误: ' + (r.raw || r.status) + '</div>'; return; }
    const url = r.data.url;
    if(t === 'img'){ randomResult.innerHTML = '<img src="' + url + '" alt="random image" />'; } else { randomResult.innerHTML = '<video src="' + url + '" controls></video>'; }
  });

  // initial
  (async ()=>{
    await tryLoginWithLocalFlag();
    const ok = await requireAuthFlow();
    if(ok){
      await refreshRandomConfig();
      await refreshList('');
    }
  })();

})();
