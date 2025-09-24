
// app.js - 还原并完善的前端逻辑（基于原始 single-file worker.js 的客户端脚本）
/* eslint-disable */
(async function(){
  // helper fetches
  async function fetchState(){ const r = await fetch('/api/v1/state'); if (!r.ok) throw new Error('获取 state 失败: ' + r.status); return await r.json(); }
  async function fetchMeta(){ const r = await fetch('/api/v1/meta'); if (!r.ok) return { authEnabled: 'false' }; return await r.json(); }

  function escapeHtmlClient(s){ if (s==null) return ''; return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function escapeAttrClient(s){ if (s==null) return ''; return String(s).replace(/"/g,'&quot;'); }

  let state = null;
  try {
    const [st, meta] = await Promise.all([fetchState(), fetchMeta()]);
    state = st;
    window.__nav_meta = meta;
  } catch (e) {
    document.getElementById('app-root').textContent = '初始化失败：' + e.message;
    console.error(e);
    return;
  }

  // normalize default
  const DEFAULT_STATE = {
    settings: {
      title: "我的导航",
      background: "",
      backgroundMode: "single",
      backgrounds: [],
      bgRotateInterval: 0,
      bingMarket: "en-US",
      overlayOpacity: 0.12,
      tagOpacity: 0.12,
      groupOpacity: 0.96,
      darkMode: false,
      accentRgb: "91,140,255",
      liquidGlass: false,
      liquidStrength: 0.5,
      bgNoCache: false,
      requireAuth: false
    },
    groups: [
      { id: "g_1", name: "常用", items: [
        { id: "i_google", title: "Google", url: "https://www.google.com", desc: "搜索" },
        { id: "i_github", title: "GitHub", url: "https://github.com", desc: "代码托管" }
      ] }
    ]
  };

  function normalizeStateClient(s){
    if (!s || typeof s !== 'object') return JSON.parse(JSON.stringify(DEFAULT_STATE));
    const st = JSON.parse(JSON.stringify(DEFAULT_STATE));
    st.settings = Object.assign(st.settings, s.settings || {});
    st.settings.backgrounds = Array.isArray(s.settings && s.settings.backgrounds) ? s.settings.backgrounds : (Array.isArray(st.settings.backgrounds)?st.settings.backgrounds:[]);
    if (typeof st.settings.bgNoCache === 'undefined') st.settings.bgNoCache = (s.settings && typeof s.settings.bgNoCache !== 'undefined') ? s.settings.bgNoCache : false;
    if (typeof st.settings.requireAuth === 'undefined') st.settings.requireAuth = (s.settings && typeof s.settings.requireAuth !== 'undefined') ? s.settings.requireAuth : false;
    if (typeof st.settings.liquidStrength === 'undefined') st.settings.liquidStrength = (s.settings && typeof s.settings.liquidStrength !== 'undefined') ? s.settings.liquidStrength : 0.5;
    if (Array.isArray(s.groups) && s.groups.length) st.groups = s.groups;
    return st;
  }

  state = normalizeStateClient(state);

  // render initial shell
  const root = document.getElementById('app-root');
  root.innerHTML = `
      <div class="fixed-bg-wrap" aria-hidden="true">
        <img id="fixed-bg-img" src="${escapeAttrClient(state.settings.background||'')}" alt="">
        <img id="fixed-bg-img-2" src="" alt="">
      </div>
      <div class="wrap">
        <header>
          <div class="brand">
            <div class="logo">NH</div>
            <div>
              <h1 id="siteTitle">${escapeHtmlClient(state.settings.title||'我的导航')}</h1>
              <div class="muted" id="siteSubtitle">个人导航 · Cloudflare Pages + KV (daohang)</div>
            </div>
          </div>
          <div class="controls">
            <div class="muted">编辑权限: ${window.__nav_meta && window.__nav_meta.authEnabled === 'false' ? '开放' : (window.__nav_meta.authEnabled === 'only' ? '编辑需要密码' : '访问需登录')}</div>
            <button id="btnNewGroup" class="btn">新增分组</button>
            <button id="btnSettings" class="btn ghost">网站设置</button>
            <button id="btnExport" class="btn ghost small">导出</button>
            <button id="btnImport" class="btn ghost small">导入</button>
            <button id="btnSave" class="btn">保存</button>
            <button id="btnToggleNoCache" class="btn ghost small">
              <span class="full-text">${state.settings.bgNoCache ? 'BG 不缓存：开' : 'BG 不缓存：关'}</span>
              <span class="short-text">${state.settings.bgNoCache ? 'BG:开' : 'BG:关'}</span>
            </button>
          </div>
        </header>
        <main>
          <section class="grid" id="grid"></section>
          <footer><div>数据保存在 KV（命名空间：daohang）。</div></footer>
        </main>
      </div>
      <div class="floating"><button id="btnLogin" class="btn small">${window.__nav_meta && window.__nav_meta.authEnabled === 'only' ? '登录(编辑)' : '登录'}</button></div>

      <!-- Settings Modal -->
      <div class="modal" id="modalSettings" aria-hidden="true">
        <div class="card" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
          <h3 id="settingsTitle">网站设置</h3>

          <label>站点标题
            <input id="s_title" type="text" value="${escapeAttrClient(state.settings.title||'')}">
          </label>

          <label>背景来源
            <select id="s_bgmode">
              <option value="single"${state.settings.backgroundMode === 'single' ? ' selected' : ''}>单张 URL</option>
              <option value="multiple"${state.settings.backgroundMode === 'multiple' ? ' selected' : ''}>多张顺序播放</option>
              <option value="bing"${state.settings.backgroundMode === 'bing' ? ' selected' : ''}>Bing 每日图（服务端代理）</option>
            </select>
          </label>

          <div id="bg_single_area" style="margin-top:8px;">
            <label>背景图片 URL（单张）
              <input id="s_bg" type="url" value="${escapeAttrClient(state.settings.background||'')}" placeholder="https://...">
            </label>
          </div>

          <div id="bg_multiple_area" style="display:${state.settings.backgroundMode === 'multiple' ? 'block' : 'none'};margin-top:8px;">
            <label>多张图片（每行一个 URL）</label>
            <div class="bg-list" id="bg_list">
            </div>
            <div style="margin-top:8px;display:flex;gap:8px">
              <button id="addBg" class="btn small">添加图片</button>
              <label style="display:flex;align-items:center;gap:6px"><small>轮播间隔(s，0=不轮播)</small><input id="s_bginterval" type="number" min="0" step="1" value="${Number(state.settings.bgRotateInterval||0)}" style="width:84px;margin-left:6px"></label>
            </div>
          </div>

          <div id="bg_bing_area" style="display:${state.settings.backgroundMode === 'bing' ? 'block' : 'none'};margin-top:8px;">
            <label>Bing 市场 (mkt)
              <input id="s_bing_mkt" type="text" value="${escapeAttrClient(state.settings.bingMarket||'en-US')}" placeholder="en-US">
            </label>
            <div class="muted" style="margin-top:6px">Bing 图片通过服务端接口拉取（避免 CORS）。支持一次拉取多张用于轮播（最大 8 张）。</div>
          </div>

          <label>背景蒙版透明度 (0 - 1)
            <input id="s_overlay" type="number" min="0" max="1" step="0.01" value="${Number(state.settings.overlayOpacity||0.12)}">
          </label>
          <label>标签透明度 (0 - 1)
            <input id="s_tagopacity" type="number" min="0" max="1" step="0.01" value="${Number(state.settings.tagOpacity||0.12)}">
          </label>
          <label>分组背景透明度 (0 - 1)
            <input id="s_groupopacity" type="number" min="0" max="1" step="0.01" value="${Number(state.settings.groupOpacity||0.96)}">
          </label>

          <label>液态玻璃效果
            <select id="s_liquid"><option value="false"${state.settings.liquidGlass ? '' : ' selected'}>关闭</option><option value="true"${state.settings.liquidGlass ? ' selected' : ''}>开启</option></select>
          </label>

          <label>液态玻璃强度（0.0 - 1.0）
            <input id="s_liquid_strength" type="number" min="0" max="1" step="0.05" value="${Number(state.settings.liquidStrength||0.5)}">
          </label>

          <label>暗色模式
            <select id="s_darkmode"><option value="false"${state.settings.darkMode ? '' : ' selected'}>关闭</option><option value="true"${state.settings.darkMode ? ' selected' : ''}>开启</option></select>
          </label>

          <label style="margin-top:8px">背景不缓存（每次强制重新拉取图片）
            <select id="s_bgnocache"><option value="false"${state.settings.bgNoCache ? '' : ' selected'}>关闭</option><option value="true"${state.settings.bgNoCache ? ' selected' : ''}>开启</option></select>
          </label>

          <label style="margin-top:8px">访问此页面是否需要密码（启用后访问首页需登录）
            <select id="s_require_auth"><option value="false"${state.settings.requireAuth ? '' : ' selected'}>否</option><option value="true"${state.settings.requireAuth ? ' selected' : ''}>是（使用 ENV.AUTH_PASSWORD）</option></select>
          </label>

          <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
            <button id="settingsCancel" class="btn ghost small">取消</button>
            <button id="settingsSave" class="btn small">保存并应用</button>
          </div>
        </div>
      </div>

      <!-- 登录 Modal（客户端也提供） -->
      <div class="modal" id="modalLogin" aria-hidden="true">
        <div class="card">
          <h3>登录</h3>
          <label>密码
            <input id="login_pwd" type="password" autocomplete="current-password">
          </label>
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
            <button id="loginCancel" class="btn ghost small">取消</button>
            <button id="loginSubmit" class="btn small">登录</button>
          </div>
          <div id="loginMsg" class="muted" style="margin-top:10px"></div>
        </div>
      </div>
  `;

  // now fill bg_list
  const bgList = document.getElementById('bg_list');
  (Array.isArray(state.settings.backgrounds) && state.settings.backgrounds.length ? state.settings.backgrounds : ['']).forEach(u=>{
    const div = document.createElement('div');
    div.className = 'bg-item';
    div.innerHTML = `<input class="bg-url" type="url" value="${u?escapeAttrClient(u):''}"><button class="remove-bg btn ghost small">删除</button>`;
    bgList.appendChild(div);
  });

  // variables for bg rotation
  let bingImages = [];
  let bingSeq = 0;
  let bgRotateTimer = null;
  let activeLayer = 0;
  let seqIndex = 0;

  applySettings();
  const grid = document.getElementById('grid');
  renderGrid();

  /* ---------------- UI 事件 ---------------- */
  document.getElementById('btnNewGroup').onclick = async ()=>{
    if (!await requireEditAuth()) return;
    const name = prompt('新分组名称：','新分组');
    if (!name) return;
    state.groups.push({ id:'g_'+Date.now(), name, items:[] });
    renderGrid();
  };

  document.getElementById('btnSettings').onclick = ()=>{
    const m = document.getElementById('modalSettings');
    m.classList.add('show');
    document.body.classList.add('modal-open');
    setTimeout(()=> {
      const first = document.getElementById('s_title') || m.querySelector('input, textarea, select');
      if (first) try { first.focus(); } catch(e){}
    }, 80);
  };
  document.getElementById('settingsCancel').onclick = ()=>{
    const m = document.getElementById('modalSettings');
    m.classList.remove('show');
    document.body.classList.remove('modal-open');
    try { if (document.activeElement) document.activeElement.blur(); } catch(e){}
  };

  const sBgMode = document.getElementById('s_bgmode');
  sBgMode.onchange = ()=>{
    const mode = sBgMode.value;
    document.getElementById('bg_single_area').style.display = mode === 'single' ? 'block' : 'none';
    document.getElementById('bg_multiple_area').style.display = mode === 'multiple' ? 'block' : 'none';
    document.getElementById('bg_bing_area').style.display = mode === 'bing' ? 'block' : 'none';
  };

  document.getElementById('addBg').onclick = ()=>{
    const list = document.getElementById('bg_list');
    const div = document.createElement('div');
    div.className = 'bg-item';
    div.innerHTML = '<input class="bg-url" type="url" placeholder="https://..."><button class="remove-bg btn ghost small">删除</button>';
    list.appendChild(div);
  };
  document.getElementById('bg_list').addEventListener('click', (e)=>{
    if (e.target.classList.contains('remove-bg')){
      const item = e.target.closest('.bg-item');
      if (item) item.remove();
    }
  });

  const btnToggleNoCache = document.getElementById('btnToggleNoCache');
  function setToggleButtonLabel(isOn){
    const full = isOn ? 'BG 不缓存：开' : 'BG 不缓存：关';
    const short = isOn ? 'BG:开' : 'BG:关';
    btnToggleNoCache.innerHTML = '<span class="full-text">'+full+'</span><span class="short-text">'+short+'</span>';
  }
  setToggleButtonLabel(Boolean(state.settings && state.settings.bgNoCache));
  btnToggleNoCache.onclick = ()=>{
    state.settings.bgNoCache = !Boolean(state.settings.bgNoCache);
    setToggleButtonLabel(Boolean(state.settings.bgNoCache));
    if (state.settings.backgroundMode === 'bing') bingImages = [];
    applyBackgroundImmediately();
  };

  document.getElementById('settingsSave').onclick = async ()=>{
    const title = document.getElementById('s_title').value.trim();
    const bgMode = document.getElementById('s_bgmode').value;
    const bgSingle = document.getElementById('s_bg').value.trim();
    const overlay = Number(document.getElementById('s_overlay').value) || 0;
    const tagOpacity = Number(document.getElementById('s_tagopacity').value) || 0;
    const groupOpacity = Number(document.getElementById('s_groupopacity').value);
    const liquid = document.getElementById('s_liquid').value === 'true';
    const darkMode = document.getElementById('s_darkmode').value === 'true';
    const bgInterval = Number(document.getElementById('s_bginterval').value || 0);
    const bingMkt = document.getElementById('s_bing_mkt').value.trim() || 'en-US';
    const bgNoCache = document.getElementById('s_bgnocache').value === 'true';
    const requireAuth = document.getElementById('s_require_auth').value === 'true';
    const liquidStrength = Number(document.getElementById('s_liquid_strength').value) || 0.5;

    const urls = Array.from(document.querySelectorAll('.bg-url')).map(i=>i.value.trim()).filter(Boolean);

    state.settings.title = title;
    state.settings.backgroundMode = bgMode;
    state.settings.background = bgSingle;
    state.settings.backgrounds = urls;
    state.settings.bgRotateInterval = Math.max(0, Math.floor(isNaN(bgInterval) ? 0 : bgInterval));
    state.settings.bingMarket = bingMkt;

    state.settings.overlayOpacity = overlay;
    state.settings.tagOpacity = tagOpacity;
    state.settings.groupOpacity = Math.max(0, Math.min(1, isNaN(groupOpacity) ? 0.96 : groupOpacity));
    state.settings.liquidGlass = liquid;
    state.settings.darkMode = darkMode;
    state.settings.bgNoCache = bgNoCache;
    state.settings.requireAuth = requireAuth;
    state.settings.liquidStrength = Math.max(0, Math.min(1, liquidStrength));

    setToggleButtonLabel(Boolean(state.settings.bgNoCache));
    applySettings();
    document.getElementById('modalSettings').classList.remove('show');
    document.body.classList.remove('modal-open');
    try { if (document.activeElement) document.activeElement.blur(); } catch(e){}
    if (state.settings.backgroundMode === 'bing') bingImages = [];
    await saveState();
  };

  document.getElementById('btnSave').onclick = saveState;

  document.getElementById('btnLogin').onclick = ()=>{
    document.getElementById('modalLogin').classList.add('show');
    document.body.classList.add('modal-open');
  };
  document.getElementById('loginCancel').onclick = ()=>{ document.getElementById('modalLogin').classList.remove('show'); document.body.classList.remove('modal-open'); };
  document.getElementById('loginSubmit').onclick = async ()=>{
    const pwd = document.getElementById('login_pwd').value;
    if (!pwd) { document.getElementById('loginMsg').textContent = '请输入密码'; return; }
    const r = await fetch('/api/v1/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pwd })});
    const j = await r.json().catch(()=>({}));
    if (r.ok && j.ok){ document.getElementById('modalLogin').classList.remove('show'); document.body.classList.remove('modal-open'); alert('登录成功'); location.reload(); }
    else { document.getElementById('loginMsg').textContent = j?.msg || '登录失败'; }
  };

  document.getElementById('btnExport').onclick = ()=>{
      const dataStr = JSON.stringify(state, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '导航站备份_' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('数据已导出');
  };

  const importBtn = document.getElementById('btnImport');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json';
  importBtn.appendChild(fileInput);

  fileInput.onchange = async e => {
      if (!await requireEditAuth()) return;
      const file = e.target.files[0];
      if (!file) return;
      if (confirm('导入数据将覆盖当前所有内容，是否继续？')){
          try {
              const text = await file.text();
              const importedData = JSON.parse(text);
              if (importedData.sites && importedData.groups) {
                  const newSettings = {
                      title: importedData.configs && importedData.configs['site.title'] ? importedData.configs['site.title'] : state.settings.title,
                      background: "",
                      backgroundMode: "single",
                      backgrounds: [],
                      bgRotateInterval: 0,
                      bingMarket: "en-US",
                      overlayOpacity: 0.12,
                      tagOpacity: 0.12,
                      groupOpacity: 0.96,
                      darkMode: false,
                      liquidGlass: false,
                      liquidStrength: 0.5,
                      bgNoCache: false,
                      requireAuth: false
                  };
                  const newGroups = importedData.groups.map(g => {
                      const items = importedData.sites
                          .filter(s => s.group_id === g.id)
                          .map(s => ({
                              id: s.id,
                              title: s.name,
                              url: s.url,
                              desc: s.description || s.notes
                          }));
                      return {
                          id: g.id,
                          name: g.name,
                          items: items
                      };
                  });
                  state = { settings: newSettings, groups: newGroups };
              } else if (importedData.settings && importedData.groups) {
                  state = importedData;
              } else {
                  throw new Error('导入文件格式不正确或版本不兼容');
              }
              applySettings();
              renderGrid();
              alert('数据已成功导入，请点击“保存”以应用到服务器。');
          } catch(error) {
              alert('导入失败: ' + error.message);
          } finally {
              fileInput.value = '';
          }
      } else { fileInput.value = ''; }
  };

  /* ---------------- 渲染网格（含折叠按钮） ---------------- */
  function renderGrid(){
    grid.innerHTML = '';
    state.groups.forEach(group=>{
      const col = document.createElement('div');
      col.className = 'col ' + (state.settings.liquidGlass ? 'liquid' : 'plain');
      col.draggable = true;
      col.dataset.gid = group.id;

      const linksId = 'links_' + group.id;

      col.innerHTML = `
        <h3>${escapeHtmlClient(group.name)} 
          <span style="font-size:12px" class="muted">(${group.items.length})</span>
        </h3>
        <div class="muted meta">管理：
          <button class="small btn ghost" data-gid="${group.id}" data-action="add">+网站</button> 
          <button class="small btn ghost" data-gid="${group.id}" data-action="edit">编辑</button> 
          <button class="small btn ghost" data-gid="${group.id}" data-action="del">删除</button>
          <span style="float:right" class="group-tools">
            <button class="collapse-btn" data-gid="${group.id}" data-action="toggle">收起/展开</button>
          </span>
        </div>
        <div class="links" id="${linksId}">${group.items.map(it => `
          <div class="link" data-gid="${group.id}" data-id="${it.id}" data-url="${escapeAttrClient(it.url)}" draggable="true">
            <div class="meta" style="flex:1">
              <a href="${escapeAttrClient(it.url)}" target="_blank" rel="noopener">${escapeHtmlClient(it.title)}</a>
              <small>${escapeHtmlClient(it.desc || it.url)}</small>
            </div>
            <div style="display:flex;gap:6px">
              <button class="small btn ghost" data-gid="${group.id}" data-id="${it.id}" data-action="edit">编辑</button>
              <button class="small btn ghost" data-gid="${group.id}" data-id="${it.id}" data-action="del">删除</button>
            </div>
          </div>`).join('')}</div>`;
      grid.appendChild(col);
    });
    attachDragHandlers();
    attachCollapseHandlers();
  }

  /* ---------------- 按钮委托（add/edit/del/toggle） ---------------- */
  document.body.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if (btn){
      const action = btn.dataset.action;
      if (!action) return;
      const gid = btn.dataset.gid;
      const id = btn.dataset.id;
      if (action === 'add'){
        if (!await requireEditAuth()) return;
        const title = prompt('网站标题：')||'';
        if (!title) return;
        const url = prompt('URL：')||'';
        if (!url) return;
        const desc = prompt('描述：')||'';
        const g = state.groups.find(x=>x.id===gid);
        g.items.push({ id:'i_'+Date.now(), title, url, desc });
        renderGrid();
      } else if (action === 'edit'){
        if (id){
          if (!await requireEditAuth()) return;
          const g = state.groups.find(x=>x.id===gid);
          const it = g.items.find(x=>x.id===id);
          const title = prompt('标题：', it.title) || it.title;
          const url = prompt('URL：', it.url) || it.url;
          const desc = prompt('描述：', it.desc) || it.desc;
          it.title = title; it.url = url; it.desc = desc;
          renderGrid();
        } else {
          if (!await requireEditAuth()) return;
          const g = state.groups.find(x=>x.id===gid);
          const name = prompt('分组名称：', g.name) || g.name;
          g.name = name; renderGrid();
        }
      } else if (action === 'del'){
        if (!await requireEditAuth()) return;
        if (id){
          if (!confirm('确认删除该网站？')) return;
          const g = state.groups.find(x=>x.id===gid);
          g.items = g.items.filter(x=>x.id!==id);
          renderGrid();
        } else {
          if (!confirm('确认删除整个分组？')) return;
          state.groups = state.groups.filter(x=>x.id!==gid);
          renderGrid();
        }
      } else if (action === 'toggle') {
        const linksEl = document.getElementById('links_' + gid);
        if (linksEl) toggleCollapseElement(linksEl);
      }
      return;
    }

    const a = e.target.closest('a');
    if (a) return;

    const linkCard = e.target.closest('.link');
    if (linkCard){
      const url = linkCard.dataset.url || (linkCard.querySelector('a') ? linkCard.querySelector('a').href : null);
      if (url){
        window.open(url, '_blank', 'noopener');
      }
    }
  });

  /* ---------------- 拖拽处理 ---------------- */
  function attachDragHandlers(){
    document.querySelectorAll('.col').forEach(col=>{
      col.addEventListener('dragstart', ev=>{
        ev.dataTransfer.setData('text/group', col.dataset.gid);
        ev.dataTransfer.effectAllowed = 'move';
      });
      col.addEventListener('dragover', ev=>{ ev.preventDefault(); ev.dataTransfer.dropEffect='move'; });
      col.addEventListener('drop', ev=>{
        ev.preventDefault();
        const src = ev.dataTransfer.getData('text/group');
        if (src){
          const to = col.dataset.gid;
          if (src === to) return;
          const srcIdx = state.groups.findIndex(g=>g.id===src);
          const toIdx = state.groups.findIndex(g=>g.id===to);
          const [m] = state.groups.splice(srcIdx,1);
          state.groups.splice(toIdx,0,m);
          renderGrid();
        } else {
          const itemId = ev.dataTransfer.getData('text/item');
          const fromG = ev.dataTransfer.getData('text/fromg');
          if (!itemId || !fromG) return;
          const toG = col.dataset.gid;
          if (toG === fromG) return;
          const fromGroup = state.groups.find(g=>g.id===fromG);
          const idx = fromGroup.items.findIndex(it=>it.id===itemId);
          const [item] = fromGroup.items.splice(idx,1);
          const targetGroup = state.groups.find(g=>g.id===toG);
          targetGroup.items.push(item);
          renderGrid();
        }
      });

      col.querySelectorAll('.link').forEach(link=>{
        link.addEventListener('dragstart', ev=>{
          ev.dataTransfer.setData('text=item', link.dataset.id);
          ev.dataTransfer.setData('text/fromg', link.dataset.gid);
          ev.dataTransfer.setData('text/item', link.dataset.id);
          ev.dataTransfer.effectAllowed = 'move';
        });
        link.addEventListener('dragover', ev=>{ ev.preventDefault(); ev.dataTransfer.dropEffect='move';});
        link.addEventListener('drop', ev=>{
          ev.preventDefault();
          const itemId = ev.dataTransfer.getData('text/item') || ev.dataTransfer.getData('text=item');
          const fromG = ev.dataTransfer.getData('text/fromg');
          if (!itemId) return;
          const toId = link.dataset.id;
          const toG = link.dataset.gid;
          const fromGroup = state.groups.find(g=>g.id===fromG);
          const itIdx = fromGroup.items.findIndex(it=>it.id===itemId);
          const [item] = fromGroup.items.splice(itIdx,1);
          const toGroup = state.groups.find(g=>g.id===toG);
          const insIdx = toGroup.items.findIndex(it=>it.id===toId);
          toGroup.items.splice(insIdx,0,item);
          renderGrid();
        });
      });
    });
  }

  /* ---------------- 折叠逻辑 ---------------- */
  function attachCollapseHandlers(){
    document.querySelectorAll('.links').forEach(links=>{
      links.style.transition = 'max-height 260ms ease, opacity 260ms ease';
      links.style.overflow = 'hidden';
      links.style.maxHeight = links.scrollHeight + 'px';
      links.style.opacity = '1';
    });
  }
  function toggleCollapseElement(el){
    if (!el.classList.contains('collapsed')) {
      el.style.maxHeight = el.scrollHeight + 'px';
      void el.offsetHeight;
      el.style.maxHeight = '0px';
      el.style.opacity = '0';
      el.classList.add('collapsed');
    } else {
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.opacity = '1';
      el.classList.remove('collapsed');
      const onEnd = ()=> { el.style.maxHeight = el.scrollHeight + 'px'; el.removeEventListener('transitionend', onEnd); };
      el.addEventListener('transitionend', onEnd);
    }
  }

  /* ---------------- 背景管理（含 Bing 多图支持） ---------------- */
  async function applySettings(){
    document.getElementById('siteTitle').textContent = state.settings.title || '我的导航';
    document.body.style.backgroundColor = 'rgba(2,6,23, '+Number(state.settings.overlayOpacity)+')';
    document.documentElement.style.setProperty('--overlay-opacity', Number(state.settings.overlayOpacity ?? 0.12));
    document.documentElement.style.setProperty('--tag-opacity', Number(state.settings.tagOpacity || 0.12));
    document.documentElement.style.setProperty('--group-opacity', Number(state.settings.groupOpacity ?? 0.96));
    document.documentElement.style.setProperty('--accent-rgb', state.settings.accentRgb || '91,140,255');
    document.documentElement.style.setProperty('--liquid-strength', Number(state.settings.liquidStrength ?? 0.5));
    if (state.settings.darkMode) document.body.classList.add('dark'); else document.body.classList.remove('dark');

    const fTitle = document.getElementById('s_title'); if (fTitle) fTitle.value = state.settings.title || '';
    const fBg = document.getElementById('s_bg'); if (fBg) fBg.value = state.settings.background || '';
    const fOverlay = document.getElementById('s_overlay'); if (fOverlay) fOverlay.value = Number(state.settings.overlayOpacity ?? 0.12);
    const fTag = document.getElementById('s_tagopacity'); if (fTag) fTag.value = Number(state.settings.tagOpacity || 0.12);
    const fGroup = document.getElementById('s_groupopacity'); if (fGroup) fGroup.value = Number(state.settings.groupOpacity ?? 0.96);
    const fLiquid = document.getElementById('s_liquid'); if (fLiquid) fLiquid.value = state.settings.liquidGlass ? 'true' : 'false';
    const fLiquidStrength = document.getElementById('s_liquid_strength'); if (fLiquidStrength) fLiquidStrength.value = Number(state.settings.liquidStrength ?? 0.5);
    const fDark = document.getElementById('s_darkmode'); if (fDark) fDark.value = state.settings.darkMode ? 'true' : 'false';
    const fMode = document.getElementById('s_bgmode'); if (fMode) fMode.value = state.settings.backgroundMode || 'single';
    const fInterval = document.getElementById('s_bginterval'); if (fInterval) fInterval.value = Number(state.settings.bgRotateInterval || 0);
    const fBingMkt = document.getElementById('s_bing_mkt'); if (fBingMkt) fBingMkt.value = state.settings.bingMarket || 'en-US';
    const fNoCache = document.getElementById('s_bgnocache'); if (fNoCache) fNoCache.value = state.settings.bgNoCache ? 'true' : 'false';
    const fRequireAuth = document.getElementById('s_require_auth'); if (fRequireAuth) fRequireAuth.value = state.settings.requireAuth ? 'true' : 'false';

    const list = document.getElementById('bg_list');
    if (list) {
      list.innerHTML = '';
      const arr = Array.isArray(state.settings.backgrounds) && state.settings.backgrounds.length ? state.settings.backgrounds : [''];
      arr.forEach(u=>{
        const div = document.createElement('div');
        div.className = 'bg-item';
        div.innerHTML = '<input class="bg-url" type="url" value="'+(u?escapeAttrClient(u):'')+'"><button class="remove-bg btn ghost small">删除</button>';
        list.appendChild(div);
      });
    }

    await applyBackgroundImmediately();

    if (bgRotateTimer) { clearInterval(bgRotateTimer); bgRotateTimer = null; }
    if (state.settings.backgroundMode === 'multiple' && Number(state.settings.bgRotateInterval || 0) > 0 && Array.isArray(state.settings.backgrounds) && state.settings.backgrounds.length > 1) {
      const sec = Number(state.settings.bgRotateInterval || 0);
      bgRotateTimer = setInterval(()=> { applyBackgroundImmediately(); }, sec * 1000);
    } else if (state.settings.backgroundMode === 'bing' && Number(state.settings.bgRotateInterval || 0) > 0) {
      const sec = Number(state.settings.bgRotateInterval || 0);
      bgRotateTimer = setInterval(()=> { applyBackgroundImmediately(); }, sec * 1000);
    }
  }

  async function applyBackgroundImmediately() {
    const imgA = document.getElementById('fixed-bg-img');
    const imgB = document.getElementById('fixed-bg-img-2');
    const activeImg = activeLayer === 0 ? imgA : imgB;
    const inactiveImg = activeLayer === 0 ? imgB : imgA;
    const mode = state.settings.backgroundMode || 'single';

    function cacheBusted(url){
      if (!url) return url;
      if (!state.settings.bgNoCache) return url;
      const sep = url.includes('?') ? '&' : '?';
      return url + sep + '_cb=' + Date.now();
    }

    if (mode === 'single') {
      const url = state.settings.background || '';
      if (url) {
        await crossfadeTo(cacheBusted(url), activeImg, inactiveImg);
      } else { imgA.style.opacity = 0; imgB.style.opacity = 0; }
    } else if (mode === 'multiple') {
      const arr = Array.isArray(state.settings.backgrounds) ? state.settings.backgrounds.filter(Boolean) : [];
      if (arr.length === 0) { imgA.style.opacity = 0; imgB.style.opacity = 0; }
      else {
        if (seqIndex >= arr.length) seqIndex = 0;
        const url = arr[seqIndex];
        seqIndex = (seqIndex + 1) % arr.length;
        await crossfadeTo(cacheBusted(url), activeImg, inactiveImg);
      }
    } else if (mode === 'bing') {
      try {
        if (!Array.isArray(bingImages) || bingImages.length === 0) {
          const want = Number(state.settings.bgRotateInterval || 0) > 0 ? 6 : 1;
          const n = Math.min(8, Math.max(1, want));
          const mkt = encodeURIComponent(state.settings.bingMarket || 'en-US');
          const r = await fetch('/api/v1/bing?mkt='+mkt+'&n='+n + (state.settings.bgNoCache ? '&nocache=1' : ''), { cache: state.settings.bgNoCache ? 'no-store' : 'default' });
          if (r.ok) {
            const j = await r.json().catch(()=>null);
            if (j && j.ok && Array.isArray(j.urls) && j.urls.length) {
              bingImages = j.urls.slice();
              bingSeq = 0;
            } else if (j && j.url) {
              bingImages = [ j.url ];
              bingSeq = 0;
            } else {
              bingImages = [];
            }
          } else {
            bingImages = [];
          }
        }

        if (bingImages && bingImages.length) {
          const url = cacheBusted(bingImages[bingSeq % bingImages.length]);
          bingSeq = (bingSeq + 1) % bingImages.length;
          await crossfadeTo(url, activeImg, inactiveImg);
        } else {
          imgA.style.opacity = 0; imgB.style.opacity = 0;
        }
      } catch (e) {
        imgA.style.opacity = 0; imgB.style.opacity = 0;
      }
    }

    activeLayer = activeLayer === 0 ? 1 : 0;
  }

  async function crossfadeTo(url, targetImg, otherImg) {
    if (!targetImg || !otherImg) return;
    return new Promise((resolve) => {
      targetImg.style.opacity = 0;
      targetImg.style.display = '';
      targetImg.style.transform = 'scale(1.03)';
      otherImg.style.transform = 'scale(1.0)';

      targetImg.onload = () => {
        requestAnimationFrame(()=>{
          targetImg.style.opacity = 1;
          targetImg.style.transform = 'scale(1.0)';
          otherImg.style.opacity = 0;
          setTimeout(()=> { resolve(); }, 700);
        });
      };
      targetImg.onerror = ()=> { targetImg.style.opacity = 0; resolve(); };
      targetImg.src = url || '';
    });
  }

  /* ---------------- 保存到服务器 ---------------- */
  async function saveState(){
    if (!await requireEditAuth()) return;
    try {
      const r = await fetch('/api/v1/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(state) });
      if (r.ok) { alert('已保存'); return true; }
      else { const j = await r.json().catch(()=>({})); alert('保存失败: '+(j.msg||r.statusText)); return false; }
    } catch (e) {
      alert('保存异常: '+e.message);
      return false;
    }
  }

  /* ---------------- 编辑鉴权 ---------------- */
  async function requireEditAuth(){
    try {
      const r = await fetch('/api/v1/auth-check');
      if (!r.ok) return false;
      const j = await r.json().catch(()=>({}));
      if (j && j.authed) return true;
      alert('需要登录才能进行编辑（点击右下登录）');
      return false;
    } catch (e) {
      alert('鉴权失败: '+String(e));
      return false;
    }
  }

  window.__nav_state = state;
  window.__nav_save = saveState;

})();
