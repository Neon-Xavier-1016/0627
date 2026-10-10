/* ============================================================
 * image-pool.js v8
 * - MutationObserver 守住「换一换」tab 内容
 * ============================================================ */
(function () {
'use strict';
if (window.__imagePoolLoaded) return;
window.__imagePoolLoaded = true;

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function S() {
  const s = (window.settings || (typeof settings !== 'undefined' ? settings : {}));
  if (!window.settings) window.settings = s;
  return s;
}
function toast(msg) {
  try { if (typeof showNotification === 'function') { showNotification(msg, 'info', 2200); return; } } catch(e) {}
  let t = $('cc-toast');
  if (!t) { t = document.createElement('div'); t.id = 'cc-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'cc-toast'; void t.offsetWidth; t.className = 'cc-toast show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'cc-toast'; }, 2200);
}

const NAME_MAX_LEN = 30;
const NAME_POOL_MAX = 20;
const AVATAR_POOL_MAX = 20;
const AVATAR_POOL_TOTAL_MAX = 30;
const SWAP_MIN_H = 12;
const SWAP_MAX_H = 24;
const REJECT_PROB = 0.2;
const KW_TRIGGER_PROB = 0.6;
const KW_COOLDOWN_MS = 30000;

let currentMainTab = 'avatar';
let currentOwnerTab = 'partner';
const _bootTime = Date.now();
let _intervalTimer = null;

/* ============================================================
 * 一、数据
 * ============================================================ */
function getPool() {
  const s = S();
  if (!s.imagePool || typeof s.imagePool !== 'object') {
    s.imagePool = {
      partnerNamePool: [], myNamePool: [],
      partnerAvatarHashes: [], myAvatarHashes: [],
      allowNameChange: true, allowAvatarChange: true,
      nextSwapAt: 0, lastSwapAt: 0
    };
  }
  const p = s.imagePool;
  ['partnerNamePool','myNamePool','partnerAvatarHashes','myAvatarHashes'].forEach(k => {
    if (!Array.isArray(p[k])) p[k] = [];
  });
  if (typeof p.allowNameChange !== 'boolean') p.allowNameChange = true;
  if (typeof p.allowAvatarChange !== 'boolean') p.allowAvatarChange = true;
  if (typeof p.nextSwapAt !== 'number') p.nextSwapAt = 0;
  if (typeof p.lastSwapAt !== 'number') p.lastSwapAt = 0;
  return p;
}
function savePool() { try { if (typeof throttledSaveData === 'function') throttledSaveData(); } catch(e) {} }
function avatarKey(hash) {
  try { if (typeof getStorageKey === 'function') return getStorageKey('imagePool:av:' + hash); } catch(e) {}
  return 'xy-home-v2:imagePool:av:' + hash;
}
const INVIS_RE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u206A-\u206F\uFEFF\u180E]/g;
function cleanName(s) { return String(s == null ? '' : s).replace(INVIS_RE, '').trim().slice(0, NAME_MAX_LEN); }

async function computeHash(dataURL) {
  try {
    const buf = new TextEncoder().encode(dataURL);
    const hb = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(hb)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
  } catch(e) {
    let h = 5381;
    for (let i = 0; i < dataURL.length; i++) h = ((h << 5) + h + dataURL.charCodeAt(i)) | 0;
    return 'h' + Math.abs(h).toString(36);
  }
}

/* ============================================================
 * 二、面板切换
 * ============================================================ */
function switchToImagePoolPanel() {
  const listArea = $('custom-replies-list');
  const annPanel = $('announcement-panel');
  const ipPanel  = $('imagepool-panel');
  const subTabs  = $('cr-sub-tabs');
  const addBtn   = $('add-custom-reply');
  const titleEl  = $('cr-modal-title');
  const toolbar  = $('batch-ops-toolbar');

  if (listArea) { listArea.style.display = 'none'; listArea.innerHTML = ''; }
  if (annPanel) annPanel.style.display = 'none';
  if (subTabs)  { subTabs.style.display = 'none'; subTabs.innerHTML = ''; }
  if (toolbar)  { toolbar.style.display = 'none'; toolbar.innerHTML = ''; }
  if (ipPanel)  { ipPanel.style.display = 'block'; ipPanel.scrollTop = 0; }
  if (addBtn)   addBtn.style.display = 'none';
  if (titleEl)  titleEl.textContent = '形象库';

  document.querySelectorAll('.sidebar-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.major === 'imagepool');
  });
  render();
}
window.switchToImagePoolPanel = switchToImagePoolPanel;

function bindSidebarWatch() {
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    if (btn.__ipWatchBound) return;
    btn.__ipWatchBound = true;
    btn.addEventListener('click', () => {
      if (btn.dataset.major !== 'imagepool') {
        const ip = $('imagepool-panel');
        if (ip) ip.style.display = 'none';
      }
    });
  });
}

/* ============================================================
 * 三、渲染
 * ============================================================ */
function render() {
  const panel = $('imagepool-panel');
  if (!panel) return;
  panel.innerHTML = '';

  const mainTabs = document.createElement('div');
  mainTabs.id = 'imagepool-tabs';
  mainTabs.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;background:var(--secondary-bg);border-radius:12px;padding:4px;';
  [{ id: 'avatar', label: '头像' }, { id: 'name', label: '名字' }].forEach(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t.label;
    const on = currentMainTab === t.id;
    b.style.cssText = 'flex:1;padding:10px 0;border:none;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;' +
      (on ? 'background:var(--accent-color);color:#fff;' : 'background:transparent;color:var(--text-secondary);');
    b.onclick = () => { currentMainTab = t.id; render(); };
    mainTabs.appendChild(b);
  });
  panel.appendChild(mainTabs);

  const ownerTabs = document.createElement('div');
  ownerTabs.id = 'imagepool-owner-tabs';
  ownerTabs.style.cssText = 'display:flex;gap:8px;margin-bottom:18px;';
  const mainLabel = currentMainTab === 'avatar' ? '头像' : '名字';
  [{ id: 'partner', label: 'TA的' + mainLabel }, { id: 'me', label: '我的' + mainLabel }].forEach(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t.label;
    const on = currentOwnerTab === t.id;
    b.style.cssText = 'flex:1;padding:9px 0;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;' +
      (on
        ? 'background:rgba(var(--accent-color-rgb),0.14);color:var(--accent-color);border:1.5px solid var(--accent-color);'
        : 'background:transparent;color:var(--text-secondary);border:1.5px solid var(--border-color);');
    b.onclick = () => { currentOwnerTab = t.id; render(); };
    ownerTabs.appendChild(b);
  });
  panel.appendChild(ownerTabs);

  const body = document.createElement('div');
  body.id = 'imagepool-body';
  panel.appendChild(body);

  const p = getPool();
  if (currentMainTab === 'avatar') {
    const list = currentOwnerTab === 'partner' ? p.partnerAvatarHashes : p.myAvatarHashes;
    renderAvatarPool(body, currentOwnerTab, list);
    const total = p.partnerAvatarHashes.length + p.myAvatarHashes.length;
    const tip = document.createElement('div');
    tip.style.cssText = 'text-align:center;font-size:11px;color:var(--text-secondary);margin-top:14px;';
    tip.textContent = '两池合计 ' + total + '/' + AVATAR_POOL_TOTAL_MAX;
    body.appendChild(tip);
  } else {
    const list = currentOwnerTab === 'partner' ? p.partnerNamePool : p.myNamePool;
    renderNamePool(body, currentOwnerTab, list);
  }
}

function renderAvatarPool(container, target, list) {
  const counter = document.createElement('div');
  counter.style.cssText = 'text-align:right;font-size:11px;color:var(--text-secondary);margin-bottom:8px;';
  counter.textContent = list.length + '/' + AVATAR_POOL_MAX;
  container.appendChild(counter);
  if (!list.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:30px 0;text-align:center;font-size:12px;color:var(--text-secondary);opacity:.6;';
    empty.textContent = '还没有头像，点击下方按钮添加';
    container.appendChild(empty);
  } else {
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px;';
    list.forEach((hash, idx) => {
      const cell = document.createElement('div');
      cell.style.cssText = 'position:relative;padding-bottom:100%;border-radius:10px;background:var(--secondary-bg);overflow:hidden;';
      const img = document.createElement('img');
      img.dataset.ipHash = hash;
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
      img.alt = '';
      cell.appendChild(img);
      const del = document.createElement('button');
      del.type = 'button'; del.textContent = '×';
      del.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;border:none;font-size:12px;line-height:1;cursor:pointer;padding:0;';
      del.onclick = (e) => { e.stopPropagation(); deleteAvatarAt(target, idx); };
      cell.appendChild(del);
      grid.appendChild(cell);
      try { localforage.getItem(avatarKey(hash)).then(data => { if (data) img.src = data; }).catch(() => {}); } catch(e) {}
    });
    container.appendChild(grid);
  }
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;margin-top:6px;';
  const addBtn = document.createElement('button');
  addBtn.type = 'button'; addBtn.textContent = '+ 添加';
  addBtn.style.cssText = 'flex:1;padding:9px;border:1px dashed var(--border-color);border-radius:10px;background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;';
  addBtn.onclick = () => addAvatarTo(target);
  actions.appendChild(addBtn);
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button'; clearBtn.textContent = '清空';
  clearBtn.style.cssText = 'padding:9px 14px;border:1px solid var(--border-color);border-radius:10px;background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;';
  clearBtn.onclick = () => clearAvatarPool(target);
  actions.appendChild(clearBtn);
  container.appendChild(actions);
}

function renderNamePool(container, target, list) {
  const counter = document.createElement('div');
  counter.style.cssText = 'text-align:right;font-size:11px;color:var(--text-secondary);margin-bottom:8px;';
  counter.textContent = list.length + '/' + NAME_POOL_MAX;
  container.appendChild(counter);
  if (!list.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:24px 0;text-align:center;font-size:12px;color:var(--text-secondary);opacity:.6;';
    empty.textContent = '还没有名字';
    container.appendChild(empty);
  } else {
    list.forEach((name, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin-bottom:6px;background:var(--secondary-bg);border-radius:10px;';
      const txt = document.createElement('span');
      txt.style.cssText = 'flex:1;min-width:0;font-size:13px;color:var(--text-primary);word-break:break-all;';
      txt.textContent = name;
      row.appendChild(txt);
      const del = document.createElement('button');
      del.type = 'button'; del.textContent = '×';
      del.style.cssText = 'flex-shrink:0;width:22px;height:22px;border:none;border-radius:50%;background:rgba(0,0,0,.06);color:var(--text-secondary);font-size:12px;cursor:pointer;padding:0;margin-left:6px;';
      del.onclick = () => {
        const p = getPool();
        const key = target === 'partner' ? 'partnerNamePool' : 'myNamePool';
        p[key].splice(idx, 1);
        savePool(); render();
      };
      row.appendChild(del);
      container.appendChild(row);
    });
  }
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;margin-top:6px;';
  const addBtn = document.createElement('button');
  addBtn.type = 'button'; addBtn.textContent = '+ 添加';
  addBtn.style.cssText = 'flex:1;padding:9px;border:1px dashed var(--border-color);border-radius:10px;background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;';
  addBtn.onclick = () => addNameTo(target);
  actions.appendChild(addBtn);
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button'; clearBtn.textContent = '清空';
  clearBtn.style.cssText = 'padding:9px 14px;border:1px solid var(--border-color);border-radius:10px;background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;';
  clearBtn.onclick = () => clearNamePool(target);
  actions.appendChild(clearBtn);
  container.appendChild(actions);
}

/* ============================================================
 * 四、池子增删
 * ============================================================ */
function addAvatarTo(target) {
  const p = getPool();
  const key = target === 'partner' ? 'partnerAvatarHashes' : 'myAvatarHashes';
  const other = target === 'partner' ? 'myAvatarHashes' : 'partnerAvatarHashes';
  const roomTotal = AVATAR_POOL_TOTAL_MAX - (p[key].length + p[other].length);
  const roomSelf  = AVATAR_POOL_MAX - p[key].length;
  const room = Math.min(roomTotal, roomSelf);
  if (room <= 0) { toast(roomSelf <= 0 ? '这个池子已满（' + AVATAR_POOL_MAX + '）' : '两池合计已满（' + AVATAR_POOL_TOTAL_MAX + '）'); return; }
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
  input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(input);
  input.onchange = async () => {
    const files = Array.prototype.slice.call(input.files || []);
    try { document.body.removeChild(input); } catch(e) {}
    if (!files.length) return;
    const take = files.slice(0, room);
    if (files.length > room) toast('超出上限，只处理前 ' + room + ' 张');
    let okN = 0, failN = 0;
    for (const f of take) {
      try {
        let dataURL;
        if (typeof optimizeImage === 'function') dataURL = await optimizeImage(f, 256, 0.85);
        else dataURL = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = e => resolve(e.target.result);
          r.onerror = reject;
          r.readAsDataURL(f);
        });
        if (!dataURL || typeof dataURL !== 'string') { failN++; continue; }
        const hash = await computeHash(dataURL);
        if (p[key].indexOf(hash) >= 0) { failN++; continue; }
        await localforage.setItem(avatarKey(hash), dataURL);
        p[key].push(hash); okN++;
      } catch(e) { failN++; }
    }
    savePool(); render();
    if (okN > 0) toast('添加 ' + okN + ' 张' + (failN ? '，失败 ' + failN + ' 张' : ''));
    else toast('添加失败');
  };
  input.click();
}
async function deleteAvatarAt(target, idx) {
  const p = getPool();
  const key = target === 'partner' ? 'partnerAvatarHashes' : 'myAvatarHashes';
  const other = target === 'partner' ? 'myAvatarHashes' : 'partnerAvatarHashes';
  const hash = p[key][idx];
  if (!hash) return;
  p[key].splice(idx, 1);
  if (p[other].indexOf(hash) < 0) { try { await localforage.removeItem(avatarKey(hash)); } catch(e) {} }
  savePool(); render();
}
function clearAvatarPool(target) {
  const p = getPool();
  const key = target === 'partner' ? 'partnerAvatarHashes' : 'myAvatarHashes';
  const other = target === 'partner' ? 'myAvatarHashes' : 'partnerAvatarHashes';
  if (!p[key].length) return;
  if (!confirm('清空' + (target === 'partner' ? 'TA' : '我') + '的头像池？')) return;
  const gone = p[key].slice();
  p[key] = [];
  gone.forEach(h => { if (p[other].indexOf(h) < 0) { try { localforage.removeItem(avatarKey(h)); } catch(e) {} } });
  savePool(); render(); toast('已清空');
}
function addNameTo(target) {
  const p = getPool();
  const key = target === 'partner' ? 'partnerNamePool' : 'myNamePool';
  const room = NAME_POOL_MAX - p[key].length;
  if (room <= 0) { toast('这个池子已满（' + NAME_POOL_MAX + '）'); return; }
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--secondary-bg);border-radius:20px;padding:22px;width:88%;max-width:380px;box-shadow:0 24px 80px rgba(0,0,0,.5);';
  card.innerHTML =
    '<div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">添加名字</div>' +
    '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">一行一个，空行自动跳过；已有的不会重复添加。</div>' +
    '<textarea id="ip-name-ta" rows="6" placeholder="一行一个名字（每个最多 ' + NAME_MAX_LEN + ' 字）" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--primary-bg);color:var(--text-primary);font-size:13px;font-family:var(--font-family);outline:none;resize:vertical;line-height:1.6;"></textarea>' +
    '<div style="display:flex;gap:8px;margin-top:14px;">' +
      '<button id="ip-name-cancel" style="flex:1;padding:11px;border:1.5px solid var(--border-color);border-radius:12px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">取消</button>' +
      '<button id="ip-name-ok" style="flex:2;padding:11px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-family);">添加</button>' +
    '</div>';
  ov.appendChild(card);
  document.body.appendChild(ov);
  const ta = card.querySelector('#ip-name-ta'); ta.focus();
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  card.querySelector('#ip-name-cancel').onclick = () => ov.remove();
  card.querySelector('#ip-name-ok').onclick = () => {
    const raw = String(ta.value || '').split(/\r\n|\r|\n|\u2028|\u2029|\u0085/);
    const lines = raw.map(cleanName).filter(Boolean);
    if (!lines.length) { toast('没有可添加的名字'); return; }
    let dup = 0, added = 0;
    for (const n of lines) {
      if (added >= room) break;
      if (p[key].indexOf(n) >= 0) { dup++; continue; }
      p[key].push(n); added++;
    }
    savePool(); render(); ov.remove();
    if (added > 0) toast('已添加 ' + added + ' 个名字' + (dup ? '，跳过 ' + dup + ' 个重复' : ''));
    else toast('没有新名字可加' + (dup ? '（都是重复的）' : ''));
  };
}
function clearNamePool(target) {
  const p = getPool();
  const key = target === 'partner' ? 'partnerNamePool' : 'myNamePool';
  if (!p[key].length) return;
  if (!confirm('清空' + (target === 'partner' ? 'TA' : '我') + '的名字池？')) return;
  p[key] = []; savePool(); render(); toast('已清空');
}

/* ============================================================
 * 五、两个开关
 * ============================================================ */
function bindToggles() {
  const a = $('imagepool-name-toggle');
  if (a && !a.__ipBound) {
    a.__ipBound = true;
    a.addEventListener('click', () => {
      const p = getPool(); p.allowNameChange = !p.allowNameChange;
      savePool(); syncToggles();
      toast(p.allowNameChange ? '允许他换名字' : '已关闭换名字');
    });
  }
  const b = $('imagepool-avatar-toggle');
  if (b && !b.__ipBound) {
    b.__ipBound = true;
    b.addEventListener('click', () => {
      const p = getPool(); p.allowAvatarChange = !p.allowAvatarChange;
      savePool(); syncToggles();
      toast(p.allowAvatarChange ? '允许他换头像' : '已关闭换头像');
    });
  }
}
function syncToggles() {
  const p = getPool();
  const a = $('imagepool-name-toggle');
  const b = $('imagepool-avatar-toggle');
  if (a) a.classList.toggle('active', !!p.allowNameChange);
  if (b) b.classList.toggle('active', !!p.allowAvatarChange);
}

/* ============================================================
 * 六、消息 & 卡片
 * ============================================================ */
function injectIpcStyles() {
  if (document.getElementById('ipc-styles')) return;
  const st = document.createElement('style');
  st.id = 'ipc-styles';
  st.textContent = `
    .system-message:has(.ip-avatar-card){padding:0;background:transparent;border:none;max-width:100%}
    .ip-avatar-card{display:flex;flex-direction:column;gap:10px;padding:14px 16px 12px;background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:16px;width:240px;max-width:100%;margin:8px auto;box-shadow:0 3px 16px rgba(0,0,0,.06);box-sizing:border-box}
    .ip-avatar-card-head{font-size:13px;font-weight:600;color:var(--text-primary);text-align:center;line-height:1.5}
    .ip-avatar-card-img{width:96px;height:96px;margin:0 auto;border-radius:50%;overflow:hidden;background:var(--primary-bg);border:2px solid rgba(var(--accent-color-rgb),0.2)}
    .ip-avatar-card-img img{width:100%;height:100%;object-fit:cover;display:block}
    .ip-avatar-card-foot{font-size:11px;color:var(--text-secondary);text-align:center;opacity:.7}
  `;
  document.head.appendChild(st);
}
function addSystemMessage(htmlOrText) {
  const msg = { id: Date.now() + Math.random(), sender: 'system', type: 'system', text: htmlOrText, timestamp: new Date() };
  try { if (typeof addMessage === 'function') { addMessage(msg); return; } } catch(e) {}
  try { if (typeof window.messages !== 'undefined' && Array.isArray(window.messages)) window.messages.push(msg); } catch(e) {}
  try {
    const container = document.getElementById('chat-container');
    if (container) {
      const div = document.createElement('div');
      div.className = 'system-message';
      div.innerHTML = htmlOrText;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }
  } catch(e) {}
  try { if (typeof throttledSaveData === 'function') throttledSaveData(); } catch(e) {}
}
function pushAvatarCard(who, dataURL) {
  const whoText = who === 'partner' ? 'TA把头像换成了' : 'TA给你换了个新头像';
  addSystemMessage(
    '<div class="ip-avatar-card">' +
      '<div class="ip-avatar-card-head">' + esc(whoText) + '</div>' +
      '<div class="ip-avatar-card-img"><img src="' + dataURL + '" alt=""></div>' +
    '</div>'
  );
}

/* ============================================================
 * 七、应用 / 抽池
 * ============================================================ */
function applyChange(kind, owner, value) {
  if (kind === 'name') {
    const s = S();
    if (owner === 'partner') s.partnerName = value; else s.myName = value;
    let ok = false;
    try { if (typeof updateUI === 'function') { updateUI(); ok = true; } } catch(e) {}
    if (!ok) {
      const el = document.getElementById(owner === 'partner' ? 'partner-name' : 'my-name');
      if (el) el.textContent = value;
    }
  } else {
    const s = S();
    const elId = owner === 'partner' ? 'partner-avatar' : 'my-avatar';
    const el = document.getElementById(elId);
    if (el) el.innerHTML = '<img src="' + value + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="avatar">';
    if (owner === 'partner') s.partnerAvatar = value; else s.myAvatar = value;
    const lsKey = owner === 'partner' ? 'partnerAvatar' : 'myAvatar';
    try { localStorage.setItem(lsKey, value); } catch(e) {}
    try {
      let key = lsKey;
      if (typeof getStorageKey === 'function') key = getStorageKey(lsKey);
      localforage.setItem(key, value).catch(() => {});
    } catch(e) {}
    try { if (typeof renderMessages === 'function') renderMessages(true); } catch(e) {}
    try { if (window.moments && typeof window.moments.render === 'function') window.moments.render(); } catch(e) {}
  }
  try { if (typeof throttledSaveData === 'function') throttledSaveData(); } catch(e) {}
}
async function pickFromPool(owner, kind) {
  const p = getPool();
  const key = kind === 'name'
    ? (owner === 'partner' ? 'partnerNamePool' : 'myNamePool')
    : (owner === 'partner' ? 'partnerAvatarHashes' : 'myAvatarHashes');
  const pool = p[key];
  if (!pool || !pool.length) return null;
  if (kind === 'name') return pool[Math.floor(Math.random() * pool.length)] || null;
  const hash = pool[Math.floor(Math.random() * pool.length)];
  try { return await localforage.getItem(avatarKey(hash)); } catch(e) { return null; }
}

/* ============================================================
 * 八、换一换 tab —— MutationObserver 守内容
 * ============================================================ */
let _ipObserver = null;

function getComboArea() { return document.getElementById('combo-content-area'); }

function isChangeTabActive() {
  const btn = document.querySelector('#user-sticker-picker .combo-tab-btn.active');
  return btn && btn.dataset.tab === 'change';
}

function renderChangeButtons(area) {
  area.innerHTML = '';
  area.style.display = 'flex';
  area.style.flexDirection = 'column';
  area.style.gap = '10px';
  area.style.padding = '14px';
  area.style.maxHeight = '260px';
  area.style.overflowY = 'auto';
  area.style.flexWrap = 'nowrap';
  area.style.alignContent = 'initial';

  const mkBtn = (label, sub, icon, who) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ip-change-btn';
    b.style.cssText = 'width:100%;padding:13px 16px;background:var(--secondary-bg);border:1.5px solid var(--border-color);border-radius:14px;cursor:pointer;text-align:left;font-family:inherit;transition:all .15s;display:flex;align-items:center;gap:12px;flex:0 0 auto;';
    b.onmouseover = () => { b.style.borderColor = 'var(--accent-color)'; b.style.background = 'rgba(var(--accent-color-rgb),0.06)'; };
    b.onmouseout = () => { b.style.borderColor = 'var(--border-color)'; b.style.background = 'var(--secondary-bg)'; };

    const ico = document.createElement('div');
    ico.style.cssText = 'width:38px;height:38px;border-radius:50%;background:rgba(var(--accent-color-rgb),0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent-color);font-size:16px;';
    ico.innerHTML = icon;
    b.appendChild(ico);

    const txt = document.createElement('div');
    txt.style.cssText = 'flex:1;min-width:0;';
    txt.innerHTML = '<div style="font-size:14px;font-weight:600;color:var(--text-primary);">' + label + '</div>'
                  + '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + sub + '</div>';
    b.appendChild(txt);

    b.onclick = () => {
      const picker = document.getElementById('user-sticker-picker');
      if (picker) picker.classList.remove('active');
      setTimeout(() => requestChange(who), 200);
    };
    return b;
  };

  area.appendChild(mkBtn('让他给自己换一换', '名字或头像，随机一个', '<i class="fas fa-user-astronaut"></i>', 'partner'));
  area.appendChild(mkBtn('让他给我换一换', '名字或头像，随机一个', '<i class="fas fa-user"></i>', 'me'));
}

function ensureChangeContent(force) {
  const area = getComboArea();
  if (!area) return;
  if (!isChangeTabActive()) return;
  // 已有我们家的按钮且不是强制重绘 → 跳过
  if (!force && area.querySelector('.ip-change-btn')) return;
  renderChangeButtons(area);
}

function showChangeTab() {
  ensureChangeContent(true);
  // 挂起 MutationObserver（只挂一次）
  if (_ipObserver) return;
  const area = getComboArea();
  if (!area) return;
  _ipObserver = new MutationObserver(() => {
    // 用微任务异步执行，避免递归
    Promise.resolve().then(() => {
      if (!isChangeTabActive()) return;
      const a = getComboArea();
      if (!a) return;
      if (!a.querySelector('.ip-change-btn')) {
        renderChangeButtons(a);
      }
    });
  });
  _ipObserver.observe(area, { childList: true });
}
window.showChangeTab = showChangeTab;

function injectChangeTab() {
  const header = document.querySelector('#user-sticker-picker .combo-tabs-header');
  if (!header) return false;
  if (header.querySelector('[data-tab="change"]')) return true;

  const btn = document.createElement('button');
  btn.className = 'combo-tab-btn';
  btn.dataset.tab = 'change';
  btn.textContent = '换一换';
  btn._bound = true;   // 阻止 features.js 的 bindComboTabs 再绑

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('#user-sticker-picker .combo-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showChangeTab();
    // 稍后再确保一次（有些初始化会在打开面板时重新渲染）
    setTimeout(() => ensureChangeContent(false), 80);
    setTimeout(() => ensureChangeContent(false), 300);
  });

  const pokeBtn = header.querySelector('[data-tab="poke"]');
  if (pokeBtn && pokeBtn.parentNode) pokeBtn.parentNode.insertBefore(btn, pokeBtn.nextSibling);
  else header.appendChild(btn);
  return true;
}

/* ============================================================
 * 九、手动触发
 * ============================================================ */
const REJECT_NAME_MSGS = ['今天不想换名字，现在这样挺好的','算了吧，下次再换','先不换了，等我想想','现在这个挺喜欢的，不换','换名字这种事，让我再考虑考虑吧'];
const REJECT_AVATAR_MSGS = ['今天不想换头像，现在这张挺好的','头像先不换了','这张用着挺习惯的，先放着吧','下次吧，今天没心情换头像'];
const REJECT_BOTH_MSGS = ['今天不想折腾了，名字头像都先不换','先这样吧，等以后再说','现在这样挺好的，先不动了'];

async function requestChange(who, forcedKind) {
  const p = getPool();
  let kind = forcedKind || (Math.random() < 0.5 ? 'name' : 'avatar');

  if (kind === 'name' && !p.allowNameChange) { addSystemMessage('TA：现在还不打算换名字'); return; }
  if (kind === 'avatar' && !p.allowAvatarChange) { addSystemMessage('TA：现在还不打算换头像'); return; }

  const checkKind = (k) => {
    const key = k === 'name'
      ? (who === 'partner' ? 'partnerNamePool' : 'myNamePool')
      : (who === 'partner' ? 'partnerAvatarHashes' : 'myAvatarHashes');
    return p[key] && p[key].length;
  };
  const usableKinds = [];
  if (kind === 'both') {
    if (checkKind('name')) usableKinds.push('name');
    if (checkKind('avatar')) usableKinds.push('avatar');
  } else {
    if (checkKind(kind)) usableKinds.push(kind);
  }
  if (!usableKinds.length) { addSystemMessage('TA：还没有可以换的素材呢'); return; }

  if (Math.random() < REJECT_PROB) {
    const pool = kind === 'both' ? REJECT_BOTH_MSGS : (kind === 'avatar' ? REJECT_AVATAR_MSGS : REJECT_NAME_MSGS);
    const line = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => addSystemMessage('TA：' + line), 600 + Math.random() * 600);
    return;
  }

  setTimeout(async () => {
    for (const k of usableKinds) {
      const value = await pickFromPool(who, k);
      if (!value) continue;
      applyChange(k, who, value);
      await new Promise(r => setTimeout(r, 400));
      if (k === 'name') {
        addSystemMessage(who === 'partner'
          ? 'TA给自己换了个新名字：' + value
          : 'TA给你换了个新名字：' + value);
      } else {
        pushAvatarCard(who, value);
      }
    }
  }, 500 + Math.random() * 500);
}

/* ============================================================
 * 十、关键词触发
 * ============================================================ */
function handleKeyword(text) {
  if (!text) return;
  let kind = null;
  if (/给我.{0,3}换.{0,3}头像/.test(text)) kind = 'avatar';
  else if (/给我.{0,3}换.{0,3}名字/.test(text)) kind = 'name';
  else if (/给我换/.test(text)) kind = 'both';
  if (!kind) return;
  const p = getPool();
  const now = Date.now();
  if (p._lastKeywordAt && now - p._lastKeywordAt < KW_COOLDOWN_MS) return;
  p._lastKeywordAt = now; savePool();
  if (Math.random() > KW_TRIGGER_PROB) return;
  setTimeout(() => requestChange('me', kind), 900 + Math.random() * 800);
}

function bindKeywordListener() {
  if (window.__ipKwHooked) return;
  window.__ipKwHooked = true;
  const readAndCheck = () => {
    const input = document.getElementById('message-input');
    if (!input) return;
    const v = String(input.value || '').trim();
    if (v) setTimeout(() => handleKeyword(v), 400);
  };
  const bindSend = () => {
    const b = document.getElementById('send-btn');
    if (b && !b.__ipKwBound) { b.__ipKwBound = true; b.addEventListener('click', readAndCheck, true); }
  };
  const bindEnter = () => {
    const inp = document.getElementById('message-input');
    if (inp && !inp.__ipKwBound) {
      inp.__ipKwBound = true;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) readAndCheck(); }, true);
    }
  };
  bindSend(); bindEnter();
  setTimeout(() => { bindSend(); bindEnter(); }, 1500);
  setTimeout(() => { bindSend(); bindEnter(); }, 3500);

  if (typeof window.sendMessage === 'function' && !window.sendMessage.__ipWrapped) {
    const orig = window.sendMessage;
    window.sendMessage = function() {
      let t = '';
      try {
        t = String(arguments[0] || '').trim();
        if (!t) { const i = document.getElementById('message-input'); if (i) t = String(i.value || '').trim(); }
      } catch(e) {}
      const r = orig.apply(this, arguments);
      if (t) setTimeout(() => handleKeyword(t), 300);
      return r;
    };
    window.sendMessage.__ipWrapped = true;
  }
}

/* ============================================================
 * 十一、自动换
 * ============================================================ */
const SWAP_MSGS = {
  'name-partner': ['TA给自己换了个新名字','趁你不在，TA改名了','你不在的时候，TA换了个称呼'],
  'name-me':      ['TA给你换了个新名字','TA擅自把你的名字改了'],
  'avatar-partner': ['趁你不在，TA把头像换了','TA换了张新头像，等你回来看看','你不在的时候，TA偷偷换了头像'],
  'avatar-me':    ['TA擅自把你的头像换了','TA给你换了个新头像，看看喜不喜欢']
};
function pickMsg(kind, owner) {
  const pool = SWAP_MSGS[kind + '-' + owner] || ['TA换了点什么'];
  return pool[Math.floor(Math.random() * pool.length)];
}
function isUserPresent(reason) {
  try { if (document.visibilityState !== 'visible') return false; } catch(e) { return false; }
  if (reason === 'boot') return false;
  if (Date.now() - _bootTime < 15000) return false;
  return true;
}
function askConsent(kind, value) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--secondary-bg);border-radius:20px;padding:22px;width:88%;max-width:380px;box-shadow:0 24px 80px rgba(0,0,0,.5);';
    card.innerHTML = '<div style="font-size:15px;font-weight:700;color:var(--text-primary);text-align:center;">TA想给你换' + (kind === 'name' ? '名字' : '头像') + '</div>';
    const preview = document.createElement('div');
    preview.style.cssText = 'text-align:center;margin:18px 0;';
    if (kind === 'name') {
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:22px;font-weight:700;color:var(--accent-color);word-break:break-all;';
      nameEl.textContent = value;
      preview.appendChild(nameEl);
    } else {
      const img = document.createElement('img');
      img.src = value;
      img.style.cssText = 'width:96px;height:96px;border-radius:50%;object-fit:cover;display:block;margin:0 auto;';
      preview.appendChild(img);
    }
    card.appendChild(preview);
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;margin-top:14px;';
    const noBtn = document.createElement('button');
    noBtn.type = 'button'; noBtn.textContent = '拒绝';
    noBtn.style.cssText = 'flex:1;padding:11px;border:1.5px solid var(--border-color);border-radius:12px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);';
    const yesBtn = document.createElement('button');
    yesBtn.type = 'button'; yesBtn.textContent = '同意';
    yesBtn.style.cssText = 'flex:2;padding:11px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-family);';
    btns.appendChild(noBtn); btns.appendChild(yesBtn); card.appendChild(btns);
    ov.appendChild(card); document.body.appendChild(ov);
    const cleanup = (r) => { try { ov.remove(); } catch(e) {} resolve(r); };
    noBtn.onclick = () => cleanup(false);
    yesBtn.onclick = () => cleanup(true);
    ov.addEventListener('click', e => { if (e.target === ov) cleanup(false); });
  });
}
async function performSwap(reason) {
  const p = getPool();
  const allowName = p.allowNameChange, allowAvatar = p.allowAvatarChange;
  if (!allowName && !allowAvatar) return;
  let kind = (allowName && allowAvatar) ? (Math.random() < 0.5 ? 'name' : 'avatar') : (allowName ? 'name' : 'avatar');
  let owner = Math.random() < 0.5 ? 'partner' : 'me';
  let value = await pickFromPool(owner, kind);
  if (!value) {
    const altOwner = owner === 'partner' ? 'me' : 'partner';
    value = await pickFromPool(altOwner, kind);
    if (!value) return;
    owner = altOwner;
  }
  const needConsent = (owner === 'me') && isUserPresent(reason);
  if (needConsent) {
    const agreed = await askConsent(kind, value);
    if (!agreed) { addSystemMessage('你拒绝了TA给你换' + (kind === 'name' ? '名字' : '头像') + '的邀请'); return; }
    applyChange(kind, owner, value);
    if (kind === 'avatar') pushAvatarCard(owner, value);
    else addSystemMessage('你同意了TA给你换的新名字：' + value);
  } else {
    applyChange(kind, owner, value);
    if (kind === 'avatar') pushAvatarCard(owner, value);
    else addSystemMessage(pickMsg(kind, owner));
  }
}
function checkAndSwap(reason) {
  const p = getPool();
  if (!p.allowNameChange && !p.allowAvatarChange) return;
  if (!p.nextSwapAt) {
    p.nextSwapAt = Date.now() + (SWAP_MIN_H + Math.random() * (SWAP_MAX_H - SWAP_MIN_H)) * 3600 * 1000;
    p.lastSwapAt = Date.now(); savePool(); return;
  }
  if (Date.now() < p.nextSwapAt) return;
  p.nextSwapAt = Date.now() + (SWAP_MIN_H + Math.random() * (SWAP_MAX_H - SWAP_MIN_H)) * 3600 * 1000;
  p.lastSwapAt = Date.now(); savePool();
  performSwap(reason).catch(e => console.warn('[ImagePool]', e));
}

/* ============================================================
 * 十二、启动
 * ============================================================ */
function isPanelVisible() {
  const p = $('imagepool-panel');
  return !!(p && p.style.display !== 'none');
}
function boot() {
  getPool();
  bindToggles();
  syncToggles();
  bindSidebarWatch();
  injectIpcStyles();
  bindKeywordListener();
  if (isPanelVisible()) render();

  let tabTries = 0;
  const tryInject = () => {
    tabTries++;
    if (injectChangeTab()) return;
    if (tabTries < 60) setTimeout(tryInject, 300);
  };
  tryInject();
  setTimeout(injectChangeTab, 1500);
  setTimeout(injectChangeTab, 3500);

  setTimeout(() => checkAndSwap('boot'), 3000);
  if (!_intervalTimer) _intervalTimer = setInterval(() => checkAndSwap('interval'), 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(() => checkAndSwap('visible'), 500);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
setTimeout(boot, 1500);
setTimeout(boot, 3500);

window.ImagePool = {
  switchToPanel: switchToImagePoolPanel,
  getPool, save: savePool, render,
  requestChange,
  performSwap: (force) => performSwap(force ? 'boot' : 'interval'),
  checkAndSwap,
  showChangeTab,
  debug: {
    forceSwap: () => { const p = getPool(); p.nextSwapAt = 0; checkAndSwap('manual'); },
    swapNow: () => performSwap('interval'),
    requestName: (who) => requestChange(who || 'me', 'name'),
    requestAvatar: (who) => requestChange(who || 'me', 'avatar'),
    requestBoth: (who) => requestChange(who || 'me', 'both'),
    injectTab: injectChangeTab,
    showChangeTab: showChangeTab
  }
};

})();