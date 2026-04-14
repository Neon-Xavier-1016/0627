/**
 * combo-menu.js - 最终版（自动扫描所有对方表情库存储位置）
 */

const MY_STICKER_KEY = 'myStickerLibrary';

// 初始化全局变量
window.myStickerLibrary = window.myStickerLibrary || [];
window.stickerLibrary = window.stickerLibrary || [];
window.customPokes = window.customPokes || [];

// 加载我的表情
async function loadMyStickers() {
    if (typeof localforage !== 'undefined') {
        const saved = await localforage.getItem(MY_STICKER_KEY);
        if (saved) window.myStickerLibrary = saved;
    }
}

// 保存我的表情
async function saveMyStickers() {
    if (typeof localforage !== 'undefined') {
        await localforage.setItem(MY_STICKER_KEY, window.myStickerLibrary);
    }
}

// 智能同步对方表情库：自动找到第一个有内容的 stickerLibrary（排除 myStickerLibrary）
async function syncPartnerStickers() {
    if (typeof localforage === 'undefined') return false;
    const allKeys = await localforage.keys();
    // 筛选出所有可能存储对方表情的 key（包含 stickerLibrary 但不包含 myStickerLibrary）
    const candidateKeys = allKeys.filter(k =>
        (k.includes('stickerLibrary') || k.includes('partnerStickers')) &&
        !k.includes('myStickerLibrary')
    );
    for (let key of candidateKeys) {
        const val = await localforage.getItem(key);
        if (val && Array.isArray(val) && val.length > 0) {
            window.stickerLibrary = val;
            console.log(`✅ 从 ${key} 加载对方表情库，共 ${val.length} 个`);
            return true;
        }
    }
    // 降级：尝试 partnerStickers
    const fallback = await localforage.getItem('partnerStickers');
    if (fallback && Array.isArray(fallback) && fallback.length) {
        window.stickerLibrary = fallback;
        return true;
    }
    window.stickerLibrary = [];
    return false;
}

// 发送表情图片
function sendSticker(src) {
    if (typeof addMessage === 'function') {
        addMessage({
            id: Date.now(),
            sender: 'user',
            text: '',
            timestamp: new Date(),
            image: src,
            status: 'sent',
            type: 'normal'
        });
        if (typeof playSound === 'function') playSound('send');
        const minDelay = (window.settings && settings.replyDelayMin) || 2000;
        const maxDelay = (window.settings && settings.replyDelayMax) || 6000;
        const delay = minDelay + Math.random() * (maxDelay - minDelay);
        if (window._pendingReplyTimer) clearTimeout(window._pendingReplyTimer);
        window._pendingReplyTimer = setTimeout(() => {
            window._pendingReplyTimer = null;
            if (typeof simulateReply === 'function') simulateReply();
        }, delay);
    }
}

// ---------- 渲染面板 ----------
function renderComboMenu() {
    const picker = document.getElementById('user-sticker-picker');
    if (!picker) return;
    picker.innerHTML = '';

    // 标签栏
    const tabBar = document.createElement('div');
    tabBar.className = 'combo-tabs-header';
    tabBar.style.cssText = 'display:flex; gap:8px; padding:8px; border-bottom:1px solid var(--border-color); align-items:center;';
    tabBar.innerHTML = `
        <button class="combo-tab-btn active" data-tab="my-sticker" style="flex:1; padding:8px; border:none; background:var(--accent-color); color:#fff; border-radius:8px; cursor:pointer;">
            <i class="fas fa-user"></i> 我
        </button>
        <button class="combo-tab-btn" data-tab="partner-sticker" style="flex:1; padding:8px; border:none; background:var(--secondary-bg); color:var(--text-primary); border-radius:8px; cursor:pointer;">
            <i class="fas fa-heart"></i> 对方
        </button>
        <button class="combo-tab-btn" data-tab="poke" style="flex:1; padding:8px; border:none; background:var(--secondary-bg); color:var(--text-primary); border-radius:8px; cursor:pointer;">
            拍一拍
        </button>
        <div style="margin-left:auto; display:flex; align-items:center; gap:4px;">
            <button id="sticker-add-btn" title="添加我的表情" style="background:var(--accent-color); border:none; cursor:pointer; padding:4px 10px; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; gap:4px; border-radius:8px;">
                <i class="fas fa-plus"></i> 添加
            </button>
            <button onclick="if(window.openMyStickerSettings) window.openMyStickerSettings();" title="管理表情库" style="background:none; border:none; cursor:pointer; padding:4px 8px; color:var(--text-secondary); font-size:12px;">
                <i class="fas fa-cog"></i>
            </button>
        </div>
    `;

    const contentArea = document.createElement('div');
    contentArea.id = 'combo-content-area';
    contentArea.style.cssText = 'padding:10px; max-height:240px; overflow-y:auto;';
    picker.appendChild(tabBar);
    picker.appendChild(contentArea);

    // 渲染“我”的标签
    function renderMyStickers() {
        contentArea.innerHTML = '';
        if (!window.myStickerLibrary.length) {
            contentArea.innerHTML = `
                <div class="empty-sticker-tip" style="text-align:center; padding:20px; color:var(--text-secondary);">
                    <i class="fas fa-user-circle" style="font-size:32px; opacity:0.5;"></i><br>
                    还没有我的专属表情哦<br>
                    点击右上角"添加"按钮上传图片~
                </div>`;
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'sticker-grid-view';
        grid.style.cssText = 'display:grid; grid-template-columns:repeat(4,1fr); gap:8px;';
        window.myStickerLibrary.forEach((src, idx) => {
            const item = document.createElement('div');
            item.className = 'sticker-grid-item';
            item.style.position = 'relative';
            item.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" loading="lazy">
                <div class="sticker-delete-btn" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.5); border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <i class="fas fa-times" style="font-size:10px; color:#fff;"></i>
                </div>`;
            item.querySelector('img').onclick = (e) => {
                e.stopPropagation();
                sendSticker(src);
                document.getElementById('user-sticker-picker').classList.remove('active');
            };
            item.querySelector('.sticker-delete-btn').onclick = async (e) => {
                e.stopPropagation();
                window.myStickerLibrary.splice(idx, 1);
                await saveMyStickers();
                renderMyStickers();
                if (typeof showNotification === 'function') showNotification('已删除', 'success', 1000);
            };
            grid.appendChild(item);
        });
        contentArea.appendChild(grid);
    }

    // 渲染“对方”的标签
    function renderPartnerStickers() {
        contentArea.innerHTML = '';
        if (!window.stickerLibrary.length) {
            contentArea.innerHTML = `
                <div class="empty-sticker-tip" style="text-align:center; padding:20px; color:var(--text-secondary);">
                    <i class="far fa-images" style="font-size:32px; opacity:0.5;"></i><br>
                    对方表情库还是空的哦<br>
                    请去"高级功能"→"自定义回复"→"表情库"中添加图片~
                </div>`;
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'sticker-grid-view';
        grid.style.cssText = 'display:grid; grid-template-columns:repeat(4,1fr); gap:8px;';
        window.stickerLibrary.forEach(src => {
            const item = document.createElement('div');
            item.className = 'sticker-grid-item';
            item.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" loading="lazy">`;
            item.onclick = () => {
                sendSticker(src);
                document.getElementById('user-sticker-picker').classList.remove('active');
            };
            grid.appendChild(item);
        });
        contentArea.appendChild(grid);
    }

    // 渲染拍一拍
    function renderPokeMenu() {
        contentArea.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'poke-list-view';
        wrapper.style.cssText = 'display:flex; flex-direction:column; gap:8px;';

        const customBtn = document.createElement('button');
        customBtn.className = 'custom-poke-btn';
        customBtn.innerHTML = '<i class="fas fa-pen"></i> 自定义拍一拍';
        customBtn.style.cssText = 'padding:10px; background:var(--accent-color); color:#fff; border:none; border-radius:12px; cursor:pointer; font-weight:600;';
        customBtn.onclick = () => {
            document.getElementById('user-sticker-picker').classList.remove('active');
            if (typeof showModal === 'function' && window.DOMElements && DOMElements.pokeModal) {
                showModal(DOMElements.pokeModal.modal, DOMElements.pokeModal.input);
            }
        };
        wrapper.appendChild(customBtn);

        const title = document.createElement('div');
        title.innerText = '快捷动作';
        title.style.cssText = 'font-size:12px; color:var(--text-secondary); margin:4px 0 2px;';
        wrapper.appendChild(title);

        const presets = (window.customPokes && window.customPokes.length) ? window.customPokes.slice(0, 8) : [
            "拍了拍对方的头", "戳了戳对方的脸颊", "抱住了对方",
            "给对方比了个心", "牵起了对方的手", "看着对方发呆"
        ];

        presets.forEach(text => {
            const item = document.createElement('div');
            item.className = 'poke-quick-item';
            item.innerText = text;
            item.style.cssText = 'padding:8px 12px; background:var(--secondary-bg); border-radius:10px; cursor:pointer; transition:0.2s;';
            item.onmouseover = () => item.style.background = 'rgba(var(--accent-color-rgb),0.1)';
            item.onmouseout = () => item.style.background = 'var(--secondary-bg)';
            item.onclick = () => {
                const myName = (window.settings && settings.myName) || '我';
                let formatted = `${myName} ${text}`;
                if (typeof window._formatPokeText === 'function') formatted = window._formatPokeText(formatted);
                if (typeof addMessage === 'function') {
                    addMessage({ id: Date.now(), text: formatted, timestamp: new Date(), type: 'system' });
                }
                document.getElementById('user-sticker-picker').classList.remove('active');
                if (typeof simulateReply === 'function') setTimeout(simulateReply, 1500);
            };
            wrapper.appendChild(item);
        });
        contentArea.appendChild(wrapper);
    }

    // 切换标签函数
    function switchTab(tabId) {
        const allBtns = tabBar.querySelectorAll('.combo-tab-btn');
        allBtns.forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.style.background = 'var(--accent-color)';
                btn.style.color = '#fff';
                btn.classList.add('active');
            } else {
                btn.style.background = 'var(--secondary-bg)';
                btn.style.color = 'var(--text-primary)';
                btn.classList.remove('active');
            }
        });
        const addBtn = document.getElementById('sticker-add-btn');
        if (addBtn) addBtn.style.display = (tabId === 'my-sticker') ? 'flex' : 'none';

        if (tabId === 'my-sticker') renderMyStickers();
        else if (tabId === 'partner-sticker') renderPartnerStickers();
        else renderPokeMenu();
    }

    // 绑定标签点击
    tabBar.querySelectorAll('.combo-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchTab(btn.dataset.tab);
        });
    });

    // 添加按钮上传功能（仅“我”的标签）
    const addBtn = document.getElementById('sticker-add-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                    if (typeof showNotification === 'function') showNotification('图片不能超过5MB', 'error');
                    else alert('图片不能超过5MB');
                    return;
                }
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const dataUrl = ev.target.result;
                    window.myStickerLibrary.push(dataUrl);
                    await saveMyStickers();
                    if (switchTab && typeof switchTab === 'function') switchTab('my-sticker');
                    if (typeof showNotification === 'function') showNotification('已添加', 'success');
                };
                reader.readAsDataURL(file);
            };
            input.click();
        };
    }

    // 默认显示“我”
    switchTab('my-sticker');
}

// ---------- 主初始化函数 ----------
async function initComboMenu() {
    await loadMyStickers();           // 加载我的表情
    await syncPartnerStickers();      // 自动扫描并加载对方表情库

    const comboBtn = document.getElementById('combo-btn');
    const picker = document.getElementById('user-sticker-picker');
    if (!comboBtn || !picker) return;

    if (comboBtn._comboBound) return;
    comboBtn._comboBound = true;

    // 每次点击按钮时，重新同步对方表情库（确保最新）
    comboBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await syncPartnerStickers();   // 重新扫描
        renderComboMenu();             // 重新渲染
        picker.classList.toggle('active');
    });

    // 点击外部关闭
    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target) && e.target !== comboBtn) {
            picker.classList.remove('active');
        }
    });

    // 初始渲染（面板默认关闭，但提前渲染好内容）
    renderComboMenu();
}

// 启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComboMenu);
} else {
    initComboMenu();
}