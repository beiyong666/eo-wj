
async function apiFetch(path, opts={}){
  opts.credentials = 'include';
  opts.headers = Object.assign({'Content-Type':'application/json'}, opts.headers || {});
  const origin = window.location.origin;
  // same-origin by default; if CORS needed, server handles Access-Control-Allow-Origin
  const r = await fetch(path, opts);
  const text = await r.text();
  try { return { ok: r.ok, status: r.status, json: JSON.parse(text), text }; } catch(e){ return { ok: r.ok, status: r.status, text }; }
}
document.getElementById('btnLogin').onclick = async ()=>{
  const pw = document.getElementById('pw').value;
  const res = await apiFetch('/api/v1/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
  console.log('login', res);
  if (res.ok) { document.getElementById('loginArea').style.display='none'; document.getElementById('saveArea').style.display='block'; } else alert('登录失败: '+ (res.json?.msg || res.text));
};
document.getElementById('btnSave').onclick = async ()=>{
  const body = JSON.parse(document.getElementById('state').value || '{}');
  const res = await apiFetch('/api/v1/save', { method: 'POST', body: JSON.stringify(body) });
  console.log('save', res);
  document.getElementById('result').textContent = res.ok ? '保存成功' : '保存失败: ' + (res.json?.msg || res.text);
};
