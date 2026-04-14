/**
 * envelope.js - 信封投递功能（完全重写版）
 */

// ==================== 全局变量 ====================
let envelopeData = { outbox: [], inbox: [] };
let currentEnvTab = 'outbox';
let editingEnvId = null;
let editingEnvSection = null;

// ==================== 工具函数 ====================
function getStorageKey(key) {
    return `envelope_${key}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 从字卡库生成回信内容
function generateEnvelopeReplyText() {
    const sourcePool = (typeof customReplies !== 'undefined' && customReplies.length > 0) ? customReplies : [];
    if (sourcePool.length === 0) {
        return '收到你的信了！💕\n\n读着你的文字，心里暖暖的。期待下一次通信~';
    }
    const sentenceCount = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
    let replyContent = "";
    for (let i = 0; i < sentenceCount; i++) {
        const randomSentence = sourcePool[Math.floor(Math.random() * sourcePool.length)];
        const punctuation = Math.random() < 0.2 ? "！" : (Math.random() < 0.2 ? "..." : "。");
        replyContent += randomSentence + punctuation;
    }
    return replyContent;
}

// 显示通知
function showEnvelopeReplyNotification(letter) {
    const existing = document.getElementById('envelope-reply-notification');
    if (existing) existing.remove();

    const preview = letter.content ? (letter.content.length > 40 ? letter.content.substring(0, 40) + '…' : letter.content) : '收到了一封回信';
    const notif = document.createElement('div');
    notif.id = 'envelope-reply-notification';
    notif.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: var(--secondary-bg);
        border-left: 4px solid #ff6b9d;
        border-radius: 16px;
        padding: 14px 18px;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        cursor: pointer;
        animation: slideInRight 0.3s ease;
        transition: transform 0.2s;
    `;
    notif.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 32px;">💌</div>
            <div style="flex: 1;">
                <div style="font-weight: bold; font-size: 14px; color: var(--text-primary);">收到回信啦！</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(preview)}</div>
            </div>
            <div style="font-size: 12px; color: #ff6b9d; font-weight: 500;">点击查看 →</div>
        </div>
    `;
    notif.onclick = () => {
        notif.remove();
        openEnvelopeAndViewReply(letter.id);
    };
    document.body.appendChild(notif);

    // 添加动画样式
    if (!document.getElementById('envelope-notif-style')) {
        const style = document.createElement('style');
        style.id = 'envelope-notif-style';
        style.textContent = `
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(100px); }
                to { opacity: 1; transform: translateX(0); }
            }
            .highlight-envelope {
                animation: envelopeHighlight 1.5s ease;
                background: rgba(255, 107, 157, 0.2) !important;
                border-radius: 12px;
            }
            @keyframes envelopeHighlight {
                0% { background: rgba(255, 107, 157, 0); }
                30% { background: rgba(255, 107, 157, 0.3); }
                100% { background: rgba(255, 107, 157, 0); }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        if (notif.parentNode) notif.remove();
    }, 8000);
}

// 打开回信并高亮
window.openEnvelopeAndViewReply = function(replyId) {
    const envelopeModal = document.getElementById('envelope-modal');
    if (envelopeModal && typeof showModal === 'function') {
        showModal(envelopeModal);
    } else if (envelopeModal) {
        envelopeModal.style.display = 'flex';
    }

    setTimeout(() => {
        switchEnvTab('inbox');
        setTimeout(() => {
            const targetCard = document.querySelector(`.env-letter-item[data-id="${replyId}"]`);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetCard.classList.add('highlight-envelope');
                setTimeout(() => targetCard.classList.remove('highlight-envelope'), 2000);
            }
            viewEnvLetter('inbox', replyId);
        }, 200);
    }, 200);
};

// ==================== 数据操作 ====================
async function loadEnvelopeData() {
    const saved = await localforage.getItem(getStorageKey('envelopeData'));
    if (saved) {
        if (Array.isArray(saved)) {
            envelopeData = {
                outbox: saved.filter(item => item && item.type === 'outbox'),
                inbox: saved.filter(item => item && item.type === 'inbox')
            };
        } else {
            envelopeData = saved;
        }
    }
    if (!envelopeData || typeof envelopeData !== 'object') {
        envelopeData = { outbox: [], inbox: [] };
    }
    if (!Array.isArray(envelopeData.outbox)) envelopeData.outbox = [];
    if (!Array.isArray(envelopeData.inbox)) envelopeData.inbox = [];

    // 迁移旧数据
    const oldPending = await localforage.getItem(getStorageKey('pending_envelope'));
    if (oldPending && envelopeData.outbox.length === 0) {
        envelopeData.outbox.push({
            id: 'legacy_' + Date.now(),
            content: '（历史寄出的信件）',
            sentTime: oldPending.sentTime,
            replyTime: oldPending.replyTime,
            status: 'pending'
        });
        await localforage.removeItem(getStorageKey('pending_envelope'));
        saveEnvelopeData();
    }
}

function saveEnvelopeData() {
    localforage.setItem(getStorageKey('envelopeData'), envelopeData);
}

// 检查回信状态
async function checkEnvelopeStatus() {
    await loadEnvelopeData();

    const now = Date.now();
    let changed = false;
    let newReplyLetter = null;

    for (const letter of envelopeData.outbox) {
        if (letter.status === 'pending' && now >= letter.replyTime) {
            letter.status = 'replied';
            const replyContent = generateEnvelopeReplyText();
            const replyId = 'reply_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            const inboxLetter = {
                id: replyId,
                refId: letter.id,
                originalContent: letter.content,
                content: replyContent,
                receivedTime: Date.now(),
                isNew: true
            };
            envelopeData.inbox.push(inboxLetter);
            newReplyLetter = inboxLetter;
            changed = true;
            if (typeof playSound === 'function') playSound('message');
        }
    }

    if (changed) {
        saveEnvelopeData();
        if (newReplyLetter) showEnvelopeReplyNotification(newReplyLetter);
        renderEnvelopeLists();
    }
}

// ==================== UI 渲染 ====================
function switchEnvTab(tab) {
    currentEnvTab = tab;
    const tabOutbox = document.getElementById('env-tab-outbox');
    const tabInbox = document.getElementById('env-tab-inbox');
    const outboxSection = document.getElementById('env-outbox-section');
    const inboxSection = document.getElementById('env-inbox-section');
    const composeForm = document.getElementById('env-compose-form');
    const mainCloseBtn = document.getElementById('env-main-close-btn');

    if (tabOutbox) tabOutbox.classList.toggle('active', tab === 'outbox');
    if (tabInbox) tabInbox.classList.toggle('active', tab === 'inbox');
    if (outboxSection) outboxSection.style.display = tab === 'outbox' ? 'block' : 'none';
    if (inboxSection) inboxSection.style.display = tab === 'inbox' ? 'block' : 'none';
    if (composeForm) composeForm.style.display = 'none';
    if (mainCloseBtn) mainCloseBtn.style.display = 'flex';

    renderEnvelopeLists();
}

function renderEnvelopeLists() {
    renderOutboxList();
    renderInboxList();

    const pendingCount = envelopeData.outbox.filter(l => l.status === 'pending').length;
    const newInboxCount = envelopeData.inbox.filter(l => l.isNew).length;
    const outboxBadge = document.getElementById('env-outbox-badge');
    const inboxBadge = document.getElementById('env-inbox-badge');

    if (outboxBadge) {
        outboxBadge.textContent = pendingCount;
        outboxBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
    if (inboxBadge) {
        inboxBadge.textContent = newInboxCount;
        inboxBadge.style.display = newInboxCount > 0 ? 'inline-block' : 'none';
    }
}

function renderOutboxList() {
    const list = document.getElementById('env-outbox-list');
    if (!list) return;

    if (envelopeData.outbox.length === 0) {
        list.innerHTML = `<div class="env-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
            <div style="font-size:14px;font-weight:500;margin-top:4px;">还没有寄出任何信件</div>
            <div style="font-size:12px;margin-top:6px;opacity:0.6;">提笔写下心意，寄送给Ta吧~</div>
        </div>`;
        return;
    }

    list.innerHTML = envelopeData.outbox.slice().reverse().map(letter => {
        const date = new Date(letter.sentTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const isPending = letter.status === 'pending';
        const replyTime = isPending ? new Date(letter.replyTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
        const preview = letter.content.length > 38 ? letter.content.substring(0, 38) + '…' : letter.content;
        return `
        <div class="env-letter-item" data-id="${letter.id}" onclick="viewEnvLetter('outbox','${letter.id}')">
            <div class="env-letter-header">
                <div class="env-letter-header-from">📤 寄出 · ${date}</div>
            </div>
            <div class="env-letter-body">
                <div class="env-letter-preview">${escapeHtml(preview)}</div>
                <div class="env-letter-status">${isPending ? '⏳ 等待回信中...' : '✅ 已收到回信'}</div>
            </div>
            <button class="env-letter-delete-btn" onclick="deleteEnvLetter(event,'outbox','${letter.id}')">✕</button>
        </div>`;
    }).join('');
}

function renderInboxList() {
    const list = document.getElementById('env-inbox-list');
    if (!list) return;

    if (envelopeData.inbox.length === 0) {
        list.innerHTML = `<div class="env-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/><polyline points="22 13 12 13"/><path d="M19 16l-5-3-5 3"/></svg>
            <div style="font-size:14px;font-weight:500;margin-top:4px;">还没有收到回信</div>
            <div style="font-size:12px;margin-top:6px;opacity:0.6;">对方正在认真回复中，请稍候~</div>
        </div>`;
        return;
    }

    list.innerHTML = envelopeData.inbox.slice().reverse().map(letter => {
        const date = new Date(letter.receivedTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const preview = letter.content.length > 50 ? letter.content.substring(0, 50) + '…' : letter.content;
        const isNew = letter.isNew;
        return `
        <div class="env-letter-item reply ${isNew ? 'env-letter-new' : ''}" data-id="${letter.id}" onclick="viewEnvLetter('inbox','${letter.id}')">
            <div class="env-letter-header">
                <div class="env-letter-header-from">💌 收到 · ${date} ${isNew ? '<span style="background:#ff6b9d;color:#fff;font-size:9px;padding:1px 6px;border-radius:6px;margin-left:6px;">新</span>' : ''}</div>
            </div>
            <div class="env-letter-body">
                <div class="env-letter-preview">${escapeHtml(preview)}</div>
            </div>
            <button class="env-letter-delete-btn" onclick="deleteEnvLetter(event,'inbox','${letter.id}')">✕</button>
        </div>`;
    }).join('');
}

// ==================== 信件操作 ====================
window.viewEnvLetter = function(section, id) {
    const letters = section === 'outbox' ? envelopeData.outbox : envelopeData.inbox;
    const letter = letters.find(l => l.id === id);
    if (!letter) return;

    if (section === 'inbox' && letter.isNew) {
        letter.isNew = false;
        saveEnvelopeData();
        renderEnvelopeLists();
    }

    editingEnvId = id;
    editingEnvSection = section;

    const modal = document.getElementById('envelope-view-modal');
    const contentDiv = document.getElementById('env-view-content');
    const textEl = document.getElementById('env-view-text');
    const titleEl = document.getElementById('env-view-title');

    if (titleEl) titleEl.textContent = section === 'outbox' ? '寄出的信' : '收到的回信';
    if (textEl) textEl.textContent = letter.content;
    if (contentDiv) contentDiv.style.display = 'block';

    // 编辑框同步内容
    const editInput = document.getElementById('env-edit-input');
    if (editInput) editInput.value = letter.content;

    if (modal && typeof showModal === 'function') {
        showModal(modal);
    } else if (modal) {
        modal.style.display = 'flex';
    }
};

window.deleteEnvLetter = function(event, section, id) {
    event.stopPropagation();
    if (!confirm('确定要删除这封信吗？')) return;

    if (section === 'outbox') {
        envelopeData.outbox = envelopeData.outbox.filter(l => l.id !== id);
    } else {
        envelopeData.inbox = envelopeData.inbox.filter(l => l.id !== id);
    }
    saveEnvelopeData();
    renderEnvelopeLists();
    if (typeof showNotification === 'function') showNotification('已删除', 'success');
};

window.closeEnvViewModal = function() {
    const modal = document.getElementById('envelope-view-modal');
    if (modal && typeof hideModal === 'function') {
        hideModal(modal);
    } else if (modal) {
        modal.style.display = 'none';
    }
};

window.toggleEnvEdit = function() {
    const contentEl = document.getElementById('env-view-content');
    const editEl = document.getElementById('env-view-edit');
    const editBtn = document.getElementById('env-view-edit-btn');
    const saveBtn = document.getElementById('env-view-save-btn');

    if (!contentEl || !editEl) return;

    const isEditing = editEl.style.display !== 'none';
    if (isEditing) {
        contentEl.style.display = 'block';
        editEl.style.display = 'none';
        if (editBtn) editBtn.textContent = '编辑';
        if (saveBtn) saveBtn.style.display = 'none';
    } else {
        contentEl.style.display = 'none';
        editEl.style.display = 'block';
        if (editBtn) editBtn.textContent = '取消';
        if (saveBtn) saveBtn.style.display = 'inline-flex';
    }
};

window.saveEnvEdit = function() {
    const newContent = document.getElementById('env-edit-input')?.value.trim();
    if (!newContent) {
        if (typeof showNotification === 'function') showNotification('内容不能为空', 'warning');
        return;
    }

    const letters = editingEnvSection === 'outbox' ? envelopeData.outbox : envelopeData.inbox;
    const letter = letters?.find(l => l.id === editingEnvId);
    if (letter) {
        letter.content = newContent;
        saveEnvelopeData();
        const textEl = document.getElementById('env-view-text');
        if (textEl) textEl.textContent = newContent;
        if (typeof showNotification === 'function') showNotification('已保存修改', 'success');
        window.toggleEnvEdit();
    }
};

// 写信表单
window.openNewEnvelopeForm = function() {
    document.getElementById('env-outbox-section').style.display = 'none';
    document.getElementById('env-inbox-section').style.display = 'none';
    document.getElementById('env-main-close-btn').style.display = 'none';
    document.getElementById('env-compose-title').textContent = '写一封信';
    document.getElementById('envelope-input').value = '';
    document.getElementById('env-send-to-chat').checked = false;
    document.getElementById('env-compose-form').style.display = 'block';
};

window.cancelEnvelopeCompose = function() {
    document.getElementById('env-compose-form').style.display = 'none';
    document.getElementById('env-main-close-btn').style.display = 'flex';
    if (currentEnvTab === 'outbox') {
        document.getElementById('env-outbox-section').style.display = 'block';
    } else {
        document.getElementById('env-inbox-section').style.display = 'block';
    }
};

async function handleSendEnvelope() {
    const text = document.getElementById('envelope-input').value.trim();
    if (!text) {
        if (typeof showNotification === 'function') showNotification('信件内容不能为空', 'warning');
        return;
    }

    const sendToChat = document.getElementById('env-send-to-chat').checked;
    if (sendToChat && typeof addMessage === 'function') {
        addMessage({ id: Date.now(), sender: 'user', text: `【寄出的信】\n${text}`, timestamp: new Date(), status: 'sent', type: 'normal' });
    }

    const minHours = 10, maxHours = 24;
    const randomHours = Math.random() * (maxHours - minHours) + minHours;
    const replyTime = Date.now() + randomHours * 60 * 60 * 1000;
    const newId = 'env_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    envelopeData.outbox.push({
        id: newId,
        content: text,
        sentTime: Date.now(),
        replyTime,
        status: 'pending'
    });
    saveEnvelopeData();

    cancelEnvelopeCompose();
    switchEnvTab('outbox');
    if (typeof showNotification === 'function') {
        showNotification(`信件已寄出，预计 ${Math.floor(randomHours)} 小时后收到回信 ✉️`, 'success');
    }
}

// ==================== 初始化 ====================
function initEnvelopeListeners() {
    const envelopeEntryBtn = document.getElementById('envelope-function');
    if (envelopeEntryBtn) {
        envelopeEntryBtn.addEventListener('click', async () => {
            try {
                const advancedModal = document.getElementById('advanced-modal');
                if (advancedModal && typeof hideModal === 'function') {
                    hideModal(advancedModal);
                }
                await loadEnvelopeData();
                await checkEnvelopeStatus();

                currentEnvTab = 'outbox';
                switchEnvTab('outbox');

                const envelopeModal = document.getElementById('envelope-modal');
                if (envelopeModal && typeof showModal === 'function') {
                    showModal(envelopeModal);
                } else if (envelopeModal) {
                    envelopeModal.style.display = 'flex';
                }
            } catch (err) {
                console.error('打开信封功能失败:', err);
            }
        });
    }

    const sendEnvelopeBtn = document.getElementById('send-envelope');
    if (sendEnvelopeBtn) {
        sendEnvelopeBtn.addEventListener('click', handleSendEnvelope);
    }

    const cancelEnvelopeBtn = document.getElementById('cancel-envelope');
    if (cancelEnvelopeBtn) {
        cancelEnvelopeBtn.addEventListener('click', () => {
            const modal = document.getElementById('envelope-modal');
            if (modal && typeof hideModal === 'function') hideModal(modal);
        });
    }

    const tabOutbox = document.getElementById('env-tab-outbox');
    if (tabOutbox) tabOutbox.addEventListener('click', () => switchEnvTab('outbox'));

    const tabInbox = document.getElementById('env-tab-inbox');
    if (tabInbox) tabInbox.addEventListener('click', () => switchEnvTab('inbox'));

    // 每5分钟检查一次回信
    setInterval(() => {
        checkEnvelopeStatus();
    }, 5 * 60 * 1000);
}

// 导出全局函数
window.initEnvelopeListeners = initEnvelopeListeners;
window.checkEnvelopeStatus = checkEnvelopeStatus;
window.loadEnvelopeData = loadEnvelopeData;
window.saveEnvelopeData = saveEnvelopeData;
window.renderEnvelopeLists = renderEnvelopeLists;
window.handleSendEnvelope = handleSendEnvelope;
window.switchEnvTab = switchEnvTab;

console.log('✅ envelope.js 已加载（重写版）');