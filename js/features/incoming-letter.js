/* ============================================================
   信封接收 · Incoming Letter
   对方主动来信 → 我回信 → 一轮终止
   ============================================================ */

let incomingLetterData = {
    received: [],
    myReplies: [],
    settings: {
        intervalDays: 30,
        minCount: 2,
        maxCount: 8,
        nextCheckTime: null,
        urgeRequestTime: null
    }
};
let currentIncTab = 'received';
let editingIncId = null;
let editingIncSection = null;

const INC_GREETINGS = [
    '见字如面，一切皆好。',
    '展信佳，愿你今日安好。',
    '提笔时，忽然很想你。',
    '此刻有风，有光，也有你。',
    '好久没写信了，今日提笔。'
];

/* ---------- 存储 ---------- */
async function loadIncomingData() {
    const saved = await localforage.getItem(getStorageKey('incomingLetterData'));
    if (saved) {
        incomingLetterData.received = saved.received || [];
        incomingLetterData.myReplies = saved.myReplies || [];
        incomingLetterData.settings = Object.assign(
            { intervalDays: 30, minCount: 2, maxCount: 8, nextCheckTime: null, urgeRequestTime: null },
            saved.settings || {}
        );
    }
    if (!incomingLetterData.settings.nextCheckTime) {
        scheduleNextIncoming();
    }
}
function saveIncomingData() {
    localforage.setItem(getStorageKey('incomingLetterData'), incomingLetterData);
}
function scheduleNextIncoming() {
    const days = incomingLetterData.settings.intervalDays || 30;
    const jitter = (Math.random() * 0.2 - 0.1) * days;
    const ms = Math.max(1, days + jitter) * 24 * 60 * 60 * 1000;
    incomingLetterData.settings.nextCheckTime = Date.now() + ms;
    saveIncomingData();
}

/* ---------- 状态检查（同 envelope 模式） ---------- */
async function checkIncomingStatus() {
    await loadIncomingData();
    const now = Date.now();
    let changed = false;
    const newLetters = [];

    // 1. 催一封信
    if (incomingLetterData.settings.urgeRequestTime && now >= incomingLetterData.settings.urgeRequestTime) {
        const letter = generateIncomingLetter();
        incomingLetterData.received.push(letter);
        incomingLetterData.settings.urgeRequestTime = null;
        newLetters.push(letter);
        changed = true;
    }

    // 2. 定时来信
    if (incomingLetterData.settings.nextCheckTime && now >= incomingLetterData.settings.nextCheckTime) {
        const minC = incomingLetterData.settings.minCount || 2;
        const maxC = incomingLetterData.settings.maxCount || 8;
        const count = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
        for (let i = 0; i < count; i++) {
            const letter = generateIncomingLetter();
            letter.receivedTime = now + i * 500;
            incomingLetterData.received.push(letter);
            newLetters.push(letter);
        }
        scheduleNextIncoming();
        changed = true;
    }

    // 3. 刷新已读状态
    incomingLetterData.myReplies.forEach(reply => {
        if (!reply.isRead && reply.readTime && now >= reply.readTime) {
            reply.isRead = true;
            changed = true;
        }
    });

    if (changed) {
        saveIncomingData();
        updateIncBadges();
        if (newLetters.length > 0) {
            playSound('message');
            showIncomingLetterPopup(newLetters[0], newLetters.length);
            const m = document.getElementById('incoming-modal');
            if (m && m.style.display === 'flex') renderIncLists();
        }
    }
}

/* ---------- 生成来信内容 ---------- */
function generateIncomingLetter() {
    const sourcePool = (typeof customReplies !== 'undefined' && Array.isArray(customReplies)) ? customReplies : [];
    const cardCount = Math.floor(Math.random() * (45 - 15 + 1)) + 15; // 15-45
    let content = '';
    if (sourcePool.length === 0) {
        content = '（回复库还没有内容，先去添加一些字卡吧）';
    } else {
        const cards = [];
        for (let i = 0; i < cardCount; i++) {
            cards.push(sourcePool[Math.floor(Math.random() * sourcePool.length)]);
        }
        content = cards.join('  '); // 字卡间两个空格
    }
    return {
        id: 'inc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        content,
        greeting: INC_GREETINGS[Math.floor(Math.random() * INC_GREETINGS.length)],
        receivedTime: Date.now(),
        isNew: true,
        replied: false,
        replyId: null
    };
}

/* ---------- 通知弹窗 ---------- */
function showIncomingLetterPopup(letter, count) {
    const existing = document.getElementById('incoming-letter-popup');
    if (existing) existing.remove();
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '对方';
    const popup = document.createElement('div');
    popup.id = 'incoming-letter-popup';
    popup.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:20px;padding:18px 20px;z-index:8000;max-width:320px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,0.18);display:flex;flex-direction:column;gap:12px;animation:slideUpNotif 0.4s cubic-bezier(0.22,1,0.36,1);';
    popup.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:26px;">💌</span>
            <div>
                <div style="font-size:14px;font-weight:700;color:var(--text-primary);">收到${count > 1 ? count + '封' : '一封'}来信</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;opacity:0.8;">${partnerName} 给你写了信，快去看看吧~</div>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <button onclick="document.getElementById('incoming-letter-popup').remove();" style="flex:1;padding:8px 0;border-radius:12px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;">稍后查看</button>
            <button onclick="document.getElementById('incoming-letter-popup').remove(); openIncomingAndView('${letter.id}');" style="flex:2;padding:8px 0;border-radius:12px;border:none;background:var(--accent-color);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">立即阅读 ✉</button>
        </div>`;
    document.body.appendChild(popup);
    setTimeout(() => { if (popup.parentNode) popup.remove(); }, 8000);
}

/* ---------- 入口 / Tab ---------- */
window.openIncomingAndView = function(letterId) {
    showModal(document.getElementById('incoming-modal'));
    switchIncTab('received');
    checkIncomingStatus().then(() => {
        setTimeout(() => viewIncLetter('received', letterId), 150);
    });
};

window.openIncomingModal = function() {
    showModal(document.getElementById('incoming-modal'));
    switchIncTab('received');
    checkIncomingStatus();
};

window.switchIncTab = function(tab) {
    currentIncTab = tab;
    document.getElementById('inc-tab-received').classList.toggle('active', tab === 'received');
    document.getElementById('inc-tab-sent').classList.toggle('active', tab === 'sent');
    document.getElementById('inc-received-section').style.display = tab === 'received' ? 'block' : 'none';
    document.getElementById('inc-sent-section').style.display = tab === 'sent' ? 'block' : 'none';
    document.getElementById('inc-reply-form').style.display = 'none';
    document.getElementById('inc-main-footer').style.display = 'flex';
    renderIncLists();
};

/* ---------- 列表渲染 ---------- */
function renderIncLists() {
    renderIncReceivedList();
    renderIncSentList();
    updateIncBadges();
}

function updateIncBadges() {
    const newCount = incomingLetterData.received.filter(l => l.isNew).length;
    const badge = document.getElementById('inc-received-badge');
    if (badge) { badge.textContent = newCount; badge.style.display = newCount > 0 ? 'inline-block' : 'none'; }
    const entryBadge = document.getElementById('inc-entry-badge');
    if (entryBadge) entryBadge.style.display = newCount > 0 ? 'inline-block' : 'none';
}

function renderIncReceivedList() {
    const list = document.getElementById('inc-received-list');
    if (!list) return;
    if (incomingLetterData.received.length === 0) {
        list.innerHTML = `<div class="env-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/><polyline points="22 13 12 13"/><path d="M19 16l-5-3-5 3"/></svg>
            <div style="font-size:14px;font-weight:500;margin-top:4px;">还没有收到来信</div>
            <div style="font-size:12px;margin-top:6px;opacity:0.6;">耐心等待，或点下方「催一封信」~</div>
        </div>`;
        return;
    }
    list.innerHTML = incomingLetterData.received.slice().reverse().map(letter => {
        const date = new Date(letter.receivedTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const preview = letter.content.length > 38 ? letter.content.substring(0, 38) + '…' : letter.content;
        const isNew = letter.isNew;
        const statusText = letter.replied
            ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 已回信`
            : `未回信`;
        return `
        <div class="env-letter-item ${isNew ? 'env-letter-new' : ''}" onclick="viewIncLetter('received','${letter.id}')">
            <div class="env-letter-header">
                <div class="env-letter-header-from">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
                    收信 · ${date}
                    ${isNew ? '<span style="background:rgba(255,255,255,0.3);color:#fff;font-size:9px;padding:1px 5px;border-radius:6px;margin-left:6px;">新</span>' : ''}
                </div>
                <div class="env-stamp">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </div>
            </div>
            <div class="env-letter-body">
                <div class="env-letter-preview">${preview}</div>
                <div class="env-letter-status">${statusText}</div>
            </div>
            <button class="env-letter-delete-btn" onclick="deleteIncLetter(event,'received','${letter.id}')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`;
    }).join('');
}

function renderIncSentList() {
    const list = document.getElementById('inc-sent-list');
    if (!list) return;
    if (incomingLetterData.myReplies.length === 0) {
        list.innerHTML = `<div class="env-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
            <div style="font-size:14px;font-weight:500;margin-top:4px;">还没有寄出任何回信</div>
            <div style="font-size:12px;margin-top:6px;opacity:0.6;">打开收到的信，可以回信~</div>
        </div>`;
        return;
    }
    list.innerHTML = incomingLetterData.myReplies.slice().reverse().map(reply => {
        const date = new Date(reply.sentTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const readBadge = reply.isRead
            ? `<span class="inc-read-badge read">已读</span>`
            : `<span class="inc-read-badge unread">未读</span>`;
        const origPreview = reply.originalContent ? (reply.originalContent.length > 32 ? reply.originalContent.substring(0, 32) + '…' : reply.originalContent) : '';
        const preview = reply.content.length > 50 ? reply.content.substring(0, 50) + '…' : reply.content;
        return `
        <div class="env-letter-item reply" onclick="viewIncLetter('sent','${reply.id}')">
            <div class="env-letter-header">
                <div class="env-letter-header-from">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
                    寄出 · ${date}
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                    ${readBadge}
                    <div class="env-stamp">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                </div>
            </div>
            ${origPreview ? `<div style="padding:6px 12px 0;display:flex;align-items:flex-start;gap:6px;"><div style="width:2px;border-radius:2px;background:rgba(var(--accent-color-rgb),0.4);flex-shrink:0;align-self:stretch;min-height:14px;margin-top:1px;"></div><div style="font-size:11px;color:var(--text-secondary);font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100% - 14px);opacity:0.75;">原信: ${origPreview}</div></div>` : ''}
            <div class="env-letter-body">
                <div class="env-letter-preview">${preview}</div>
            </div>
            <button class="env-letter-delete-btn" onclick="deleteIncLetter(event,'sent','${reply.id}')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`;
    }).join('');
}

/* ---------- 查看详情 ---------- */
window.viewIncLetter = function(section, id) {
    const letters = section === 'received' ? incomingLetterData.received : incomingLetterData.myReplies;
    const letter = letters.find(l => l.id === id);
    if (!letter) return;
    if (section === 'received' && letter.isNew) {
        letter.isNew = false;
        saveIncomingData();
        renderIncLists();
    }
    editingIncId = id;
    editingIncSection = section;

    document.getElementById('inc-view-title').textContent = section === 'received' ? '收到的信' : '我的回信';

    const dateObj = new Date(section === 'received' ? letter.receivedTime : letter.sentTime);
    const y = dateObj.getFullYear();
    const mo = String(dateObj.getMonth()+1).padStart(2,'0');
    const d = String(dateObj.getDate()).padStart(2,'0');
    const weekdays = ['日','一','二','三','四','五','六'];
    const fullDateStr = `${y}/${mo}/${d} 星期${weekdays[dateObj.getDay()]}`;

    const stampEl = document.getElementById('inc-view-stamp-date');
    if (stampEl) stampEl.textContent = `${mo}/${d}`;
    document.getElementById('inc-view-date-line').textContent = fullDateStr;
    document.getElementById('inc-view-sign-date').textContent = fullDateStr;

    const myName = (typeof settings !== 'undefined' && settings.myName) || '你';
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '对方';

    const toLine = document.getElementById('inc-view-to-line');
    const greetLine = document.getElementById('inc-view-greeting-line');
    const textEl = document.getElementById('inc-view-text');
    const signNameEl = document.getElementById('inc-view-sign-name');
    const origCtx = document.getElementById('inc-view-original-ctx');

    if (section === 'received') {
        if (toLine) toLine.textContent = `致 ${myName}：`;
        if (greetLine) greetLine.textContent = letter.greeting || '见字如面，一切皆好。';
        if (textEl) textEl.textContent = letter.content;
        if (signNameEl) signNameEl.textContent = partnerName;
        if (origCtx) origCtx.style.display = 'none';
    } else {
        if (toLine) toLine.textContent = `致 ${partnerName}：`;
        if (greetLine) greetLine.textContent = '见字如面，望君安好。';
        if (textEl) textEl.textContent = letter.content;
        if (signNameEl) signNameEl.textContent = myName;
        const txt = document.getElementById('inc-view-original-text');
        if (origCtx && txt && letter.originalContent) {
            txt.textContent = letter.originalContent;
            origCtx.style.display = 'block';
        } else if (origCtx) {
            origCtx.style.display = 'none';
        }
    }

    document.getElementById('inc-edit-input').value = letter.content;
    document.getElementById('inc-view-content').style.display = 'block';
    document.getElementById('inc-view-edit').style.display = 'none';
    document.getElementById('inc-view-edit-btn').style.display = 'inline-flex';
    document.getElementById('inc-view-save-btn').style.display = 'none';

    const replyBtn = document.getElementById('inc-view-reply-btn');
    if (replyBtn) {
        replyBtn.style.display = (section === 'received' && !letter.replied) ? 'inline-flex' : 'none';
    }

    showModal(document.getElementById('incoming-view-modal'));
};

window.toggleIncEdit = function() {
    const contentEl = document.getElementById('inc-view-content');
    const editEl = document.getElementById('inc-view-edit');
    const editBtn = document.getElementById('inc-view-edit-btn');
    const saveBtn = document.getElementById('inc-view-save-btn');
    const replyBtn = document.getElementById('inc-view-reply-btn');
    const isEditing = editEl.style.display !== 'none';
    if (isEditing) {
        contentEl.style.display = 'block';
        editEl.style.display = 'none';
        editBtn.textContent = '编辑';
        saveBtn.style.display = 'none';
        if (editingIncSection === 'received' && replyBtn) {
            const letter = incomingLetterData.received.find(l => l.id === editingIncId);
            if (letter && !letter.replied) replyBtn.style.display = 'inline-flex';
        }
    } else {
        contentEl.style.display = 'none';
        editEl.style.display = 'block';
        editBtn.textContent = '取消';
        saveBtn.style.display = 'inline-flex';
        if (replyBtn) replyBtn.style.display = 'none';
    }
};

window.saveIncEdit = function() {
    const newContent = document.getElementById('inc-edit-input').value.trim();
    if (!newContent) { showNotification('内容不能为空', 'warning'); return; }
    const letters = editingIncSection === 'received' ? incomingLetterData.received : incomingLetterData.myReplies;
    const letter = letters.find(l => l.id === editingIncId);
    if (letter) {
        letter.content = newContent;
        saveIncomingData();
        document.getElementById('inc-view-text').textContent = newContent;
        showNotification('已保存修改', 'success');
        toggleIncEdit();
    }
};

window.closeIncViewModal = function() {
    hideModal(document.getElementById('incoming-view-modal'));
};

window.deleteIncLetter = function(event, section, id) {
    event.stopPropagation();
    if (!confirm('确定要删除这封信吗？')) return;
    if (section === 'received') {
        incomingLetterData.received = incomingLetterData.received.filter(l => l.id !== id);
    } else {
        incomingLetterData.myReplies = incomingLetterData.myReplies.filter(l => l.id !== id);
    }
    saveIncomingData();
    renderIncLists();
    showNotification('已删除', 'success');
};

/* ---------- 回信 ---------- */
window.openIncReplyFormFromView = function() {
    const letter = incomingLetterData.received.find(l => l.id === editingIncId);
    if (!letter) return;
    if (letter.replied) { showNotification('这封信已经回过了', 'info'); return; }
    hideModal(document.getElementById('incoming-view-modal'));
    document.getElementById('inc-received-section').style.display = 'none';
    document.getElementById('inc-sent-section').style.display = 'none';
    document.getElementById('inc-main-footer').style.display = 'none';
    document.getElementById('inc-reply-form').style.display = 'block';
    document.getElementById('inc-reply-input').value = '';
    document.getElementById('inc-send-to-chat').checked = false;

    const origEl = document.getElementById('inc-reply-original');
    if (origEl) {
        const preview = letter.content.length > 120 ? letter.content.substring(0, 120) + '…' : letter.content;
        origEl.textContent = preview;
    }
    setTimeout(() => document.getElementById('inc-reply-input').focus(), 100);
};

window.cancelIncReply = function() {
    document.getElementById('inc-reply-form').style.display = 'none';
    document.getElementById('inc-main-footer').style.display = 'flex';
    switchIncTab(currentIncTab || 'received');
};

window.handleSendIncomingReply = function() {
    const text = document.getElementById('inc-reply-input').value.trim();
    if (!text) { showNotification('回信内容不能为空', 'warning'); return; }

    const originalLetter = incomingLetterData.received.find(l => l.id === editingIncId);
    if (!originalLetter) { showNotification('找不到原信', 'error'); return; }
    if (originalLetter.replied) { showNotification('这封信已经回过了', 'info'); return; }

    const sendToChat = document.getElementById('inc-send-to-chat').checked;
    if (sendToChat && typeof addMessage === 'function') {
        addMessage({ id: Date.now(), sender: 'user', text: `【寄出的回信】\n${text}`, timestamp: new Date(), status: 'sent', type: 'normal' });
    }

    const minMs = 20 * 60 * 1000;
    const maxMs = 8 * 60 * 60 * 1000;
    const readDelay = minMs + Math.random() * (maxMs - minMs);
    const replyId = 'incr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    incomingLetterData.myReplies.push({
        id: replyId,
        refId: originalLetter.id,
        originalContent: originalLetter.content,
        content: text,
        sentTime: Date.now(),
        readTime: Date.now() + readDelay,
        isRead: false
    });
    originalLetter.replied = true;
    originalLetter.replyId = replyId;
    saveIncomingData();

    document.getElementById('inc-reply-form').style.display = 'none';
    document.getElementById('inc-main-footer').style.display = 'flex';
    switchIncTab('sent');
    showNotification('回信已寄出 ✉', 'success');
};

/* ---------- 催一封信 ---------- */
window.urgeIncomingLetter = function() {
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '对方';
    if (incomingLetterData.settings.urgeRequestTime) {
        showNotification(`已经催促${partnerName}了，不要着急嘛`, 'info');
        return;
    }
    const minMs = 20 * 60 * 1000;
    const maxMs = 8 * 60 * 60 * 1000;
    const delay = minMs + Math.random() * (maxMs - minMs);
    incomingLetterData.settings.urgeRequestTime = Date.now() + delay;
    saveIncomingData();
    showNotification(`${partnerName}收到你的思念了，立刻构思中...`, 'success');
};

/* ---------- 设置 ---------- */
window.openIncSettings = function() {
    const s = incomingLetterData.settings;
    document.querySelectorAll('#inc-interval-options .inc-opt-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.days) === s.intervalDays);
    });
    document.getElementById('inc-min-count').value = s.minCount;
    document.getElementById('inc-max-count').value = s.maxCount;
    showModal(document.getElementById('incoming-settings-modal'));
};

window.selectIncInterval = function(days) {
    document.querySelectorAll('#inc-interval-options .inc-opt-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
    });
};

window.saveIncSettings = function() {
    const activeBtn = document.querySelector('#inc-interval-options .inc-opt-btn.active');
    const days = parseInt(activeBtn ? activeBtn.dataset.days : 30);
    let minC = parseInt(document.getElementById('inc-min-count').value) || 2;
    let maxC = parseInt(document.getElementById('inc-max-count').value) || 8;
    minC = Math.max(1, Math.min(10, minC));
    maxC = Math.max(1, Math.min(10, maxC));
    if (minC > maxC) { const t = minC; minC = maxC; maxC = t; }

    incomingLetterData.settings.intervalDays = days;
    incomingLetterData.settings.minCount = minC;
    incomingLetterData.settings.maxCount = maxC;
    scheduleNextIncoming();
    saveIncomingData();
    hideModal(document.getElementById('incoming-settings-modal'));
    showNotification('设置已保存', 'success');
};

/* ---------- 初始化（延迟到 SESSION_ID 就绪） ---------- */
window.initIncomingLetter = function() {
    if (window.__incomingLetterInited) return;
    window.__incomingLetterInited = true;

    const entryBtn = document.getElementById('incoming-letter-function');
    if (entryBtn) {
        entryBtn.addEventListener('click', () => {
            if (typeof hideModal === 'function') hideModal(document.getElementById('advanced-modal'));
            openIncomingModal();
        });
    }
    const gearBtn = document.getElementById('inc-settings-entry');
    if (gearBtn) gearBtn.addEventListener('click', openIncSettings);

    loadIncomingData().then(() => {
        updateIncBadges();
        setTimeout(checkIncomingStatus, 2000);
    });
    setInterval(checkIncomingStatus, 60000);
};

/* 轮询等待 SESSION_ID 就绪后再初始化 */
(function waitForSession() {
    let tries = 0;
    const timer = setInterval(() => {
        tries++;
        let ready = false;
        if (typeof getStorageKey === 'function') {
            try {
                getStorageKey('__inc_probe__');
                ready = true;
            } catch (e) { /* SESSION_ID 还没好 */ }
        }
        if (ready) {
            clearInterval(timer);
            window.initIncomingLetter();
        } else if (tries > 40) {
            // 最多等 20 秒，避免死循环
            clearInterval(timer);
            console.warn('[incoming-letter] SESSION_ID 长时间未就绪，放弃自动初始化');
        }
    }, 500);
})();