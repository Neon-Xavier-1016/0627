/**
 * envelope.js - 信封投递功能（最终安全版）
 * 修复：彻底避免暂时性死区，使用 var 声明全局变量
 */

// ==================== 全局变量（使用 var 避免 TDZ）====================
var envelopeData = { outbox: [], inbox: [] };
var currentEnvTab = 'outbox';
var editingEnvId = null;
var editingEnvSection = null;

// ==================== 工具函数 ====================
function getStorageKey(key) {
    return 'envelope_' + key;
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 从字卡库生成回信内容
function generateEnvelopeReplyText() {
    var sourcePool = (typeof customReplies !== 'undefined' && customReplies.length > 0) ? customReplies : [];
    if (sourcePool.length === 0) {
        return '收到你的信了！💕\n\n读着你的文字，心里暖暖的。期待下一次通信~';
    }
    var sentenceCount = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
    var replyContent = "";
    for (var i = 0; i < sentenceCount; i++) {
        var randomSentence = sourcePool[Math.floor(Math.random() * sourcePool.length)];
        var punctuation = Math.random() < 0.2 ? "！" : (Math.random() < 0.2 ? "..." : "。");
        replyContent += randomSentence + punctuation;
    }
    return replyContent;
}

// 显示回信通知
function showEnvelopeReplyNotification(letter) {
    var existing = document.getElementById('envelope-reply-notification');
    if (existing) existing.remove();

    var preview = letter.content ? (letter.content.length > 40 ? letter.content.substring(0, 40) + '…' : letter.content) : '收到了一封回信';
    var notif = document.createElement('div');
    notif.id = 'envelope-reply-notification';
    notif.style.cssText = 'position: fixed; bottom: 80px; right: 20px; background: var(--secondary-bg); border-left: 4px solid #ff6b9d; border-radius: 16px; padding: 14px 18px; z-index: 10000; max-width: 300px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); cursor: pointer; animation: slideInRight 0.3s ease; transition: transform 0.2s;';
    notif.innerHTML = '<div style="display: flex; align-items: center; gap: 12px;"><div style="font-size: 32px;">💌</div><div style="flex: 1;"><div style="font-weight: bold; font-size: 14px; color: var(--text-primary);">收到回信啦！</div><div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">' + escapeHtml(preview) + '</div></div><div style="font-size: 12px; color: #ff6b9d; font-weight: 500;">点击查看 →</div></div>';
    notif.onclick = function() {
        notif.remove();
        openEnvelopeAndViewReply(letter.id);
    };
    document.body.appendChild(notif);

    if (!document.getElementById('envelope-notif-style')) {
        var style = document.createElement('style');
        style.id = 'envelope-notif-style';
        style.textContent = '@keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } } .highlight-envelope { animation: envelopeHighlight 1.5s ease; background: rgba(255, 107, 157, 0.2) !important; border-radius: 12px; } @keyframes envelopeHighlight { 0% { background: rgba(255, 107, 157, 0); } 30% { background: rgba(255, 107, 157, 0.3); } 100% { background: rgba(255, 107, 157, 0); } }';
        document.head.appendChild(style);
    }

    setTimeout(function() { if (notif.parentNode) notif.remove(); }, 8000);
}

// 打开回信并高亮
window.openEnvelopeAndViewReply = function(replyId) {
    var envelopeModal = document.getElementById('envelope-modal');
    if (envelopeModal && typeof showModal === 'function') {
        showModal(envelopeModal);
    } else if (envelopeModal) {
        envelopeModal.style.display = 'flex';
    }

    setTimeout(function() {
        switchEnvTab('inbox');
        setTimeout(function() {
            var targetCard = document.querySelector('.env-letter-item[data-id="' + replyId + '"]');
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetCard.classList.add('highlight-envelope');
                setTimeout(function() { targetCard.classList.remove('highlight-envelope'); }, 2000);
            }
            viewEnvLetter('inbox', replyId);
        }, 200);
    }, 200);
};

// ==================== 数据操作 ====================
async function loadEnvelopeData() {
    var saved = await localforage.getItem(getStorageKey('envelopeData'));
    if (saved) {
        if (Array.isArray(saved)) {
            envelopeData = {
                outbox: saved.filter(function(item) { return item && item.type === 'outbox'; }),
                inbox: saved.filter(function(item) { return item && item.type === 'inbox'; })
            };
        } else {
            envelopeData = saved;
        }
    }
    // 确保数据结构完整（不再重复声明）
    if (!envelopeData || typeof envelopeData !== 'object') {
        envelopeData = { outbox: [], inbox: [] };
    }
    if (!Array.isArray(envelopeData.outbox)) envelopeData.outbox = [];
    if (!Array.isArray(envelopeData.inbox)) envelopeData.inbox = [];

    // 迁移旧数据
    var oldPending = await localforage.getItem(getStorageKey('pending_envelope'));
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

    var now = Date.now();
    var changed = false;
    var newReplyLetter = null;

    for (var i = 0; i < envelopeData.outbox.length; i++) {
        var letter = envelopeData.outbox[i];
        if (letter.status === 'pending' && now >= letter.replyTime) {
            letter.status = 'replied';
            var replyContent = generateEnvelopeReplyText();
            var replyId = 'reply_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            var inboxLetter = {
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
    var tabOutbox = document.getElementById('env-tab-outbox');
    var tabInbox = document.getElementById('env-tab-inbox');
    var outboxSection = document.getElementById('env-outbox-section');
    var inboxSection = document.getElementById('env-inbox-section');
    var composeForm = document.getElementById('env-compose-form');
    var mainCloseBtn = document.getElementById('env-main-close-btn');

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

    var pendingCount = envelopeData.outbox.filter(function(l) { return l.status === 'pending'; }).length;
    var newInboxCount = envelopeData.inbox.filter(function(l) { return l.isNew; }).length;
    var outboxBadge = document.getElementById('env-outbox-badge');
    var inboxBadge = document.getElementById('env-inbox-badge');

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
    var list = document.getElementById('env-outbox-list');
    if (!list) return;

    if (envelopeData.outbox.length === 0) {
        list.innerHTML = '<div class="env-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg><div style="font-size:14px;font-weight:500;margin-top:4px;">还没有寄出任何信件</div><div style="font-size:12px;margin-top:6px;opacity:0.6;">提笔写下心意，寄送给Ta吧~</div></div>';
        return;
    }

    var html = '';
    for (var i = envelopeData.outbox.length - 1; i >= 0; i--) {
        var letter = envelopeData.outbox[i];
        var date = new Date(letter.sentTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        var isPending = letter.status === 'pending';
        var preview = letter.content.length > 38 ? letter.content.substring(0, 38) + '…' : letter.content;
        html += '<div class="env-letter-item" data-id="' + letter.id + '" onclick="viewEnvLetter(\'outbox\',\'' + letter.id + '\')">' +
            '<div class="env-letter-header"><div class="env-letter-header-from">📤 寄出 · ' + date + '</div></div>' +
            '<div class="env-letter-body"><div class="env-letter-preview">' + escapeHtml(preview) + '</div>' +
            '<div class="env-letter-status">' + (isPending ? '⏳ 等待回信中...' : '✅ 已收到回信') + '</div></div>' +
            '<button class="env-letter-delete-btn" onclick="deleteEnvLetter(event,\'outbox\',\'' + letter.id + '\')">✕</button></div>';
    }
    list.innerHTML = html;
}

function renderInboxList() {
    var list = document.getElementById('env-inbox-list');
    if (!list) return;

    if (envelopeData.inbox.length === 0) {
        list.innerHTML = '<div class="env-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/><polyline points="22 13 12 13"/><path d="M19 16l-5-3-5 3"/></svg><div style="font-size:14px;font-weight:500;margin-top:4px;">还没有收到回信</div><div style="font-size:12px;margin-top:6px;opacity:0.6;">对方正在认真回复中，请稍候~</div></div>';
        return;
    }

    var html = '';
    for (var i = envelopeData.inbox.length - 1; i >= 0; i--) {
        var letter = envelopeData.inbox[i];
        var date = new Date(letter.receivedTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        var preview = letter.content.length > 50 ? letter.content.substring(0, 50) + '…' : letter.content;
        var isNew = letter.isNew;
        html += '<div class="env-letter-item reply ' + (isNew ? 'env-letter-new' : '') + '" data-id="' + letter.id + '" onclick="viewEnvLetter(\'inbox\',\'' + letter.id + '\')">' +
            '<div class="env-letter-header"><div class="env-letter-header-from">💌 收到 · ' + date + (isNew ? '<span style="background:#ff6b9d;color:#fff;font-size:9px;padding:1px 6px;border-radius:6px;margin-left:6px;">新</span>' : '') + '</div></div>' +
            '<div class="env-letter-body"><div class="env-letter-preview">' + escapeHtml(preview) + '</div></div>' +
            '<button class="env-letter-delete-btn" onclick="deleteEnvLetter(event,\'inbox\',\'' + letter.id + '\')">✕</button></div>';
    }
    list.innerHTML = html;
}

// ==================== 信件操作 ====================
window.viewEnvLetter = function(section, id) {
    var letters = section === 'outbox' ? envelopeData.outbox : envelopeData.inbox;
    var letter = null;
    for (var i = 0; i < letters.length; i++) {
        if (letters[i].id === id) { letter = letters[i]; break; }
    }
    if (!letter) return;

    if (section === 'inbox' && letter.isNew) {
        letter.isNew = false;
        saveEnvelopeData();
        renderEnvelopeLists();
    }

    editingEnvId = id;
    editingEnvSection = section;

    var modal = document.getElementById('envelope-view-modal');
    var contentDiv = document.getElementById('env-view-content');
    var textEl = document.getElementById('env-view-text');
    var titleEl = document.getElementById('env-view-title');
    var editInput = document.getElementById('env-edit-input');

    if (titleEl) titleEl.textContent = section === 'outbox' ? '寄出的信' : '收到的回信';
    if (textEl) textEl.textContent = letter.content;
    if (editInput) editInput.value = letter.content;
    if (contentDiv) contentDiv.style.display = 'block';

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
        var newOutbox = [];
        for (var i = 0; i < envelopeData.outbox.length; i++) {
            if (envelopeData.outbox[i].id !== id) newOutbox.push(envelopeData.outbox[i]);
        }
        envelopeData.outbox = newOutbox;
    } else {
        var newInbox = [];
        for (var i = 0; i < envelopeData.inbox.length; i++) {
            if (envelopeData.inbox[i].id !== id) newInbox.push(envelopeData.inbox[i]);
        }
        envelopeData.inbox = newInbox;
    }
    saveEnvelopeData();
    renderEnvelopeLists();
    if (typeof showNotification === 'function') showNotification('已删除', 'success');
};

window.closeEnvViewModal = function() {
    var modal = document.getElementById('envelope-view-modal');
    if (modal && typeof hideModal === 'function') {
        hideModal(modal);
    } else if (modal) {
        modal.style.display = 'none';
    }
};

window.toggleEnvEdit = function() {
    var contentEl = document.getElementById('env-view-content');
    var editEl = document.getElementById('env-view-edit');
    var editBtn = document.getElementById('env-view-edit-btn');
    var saveBtn = document.getElementById('env-view-save-btn');

    if (!contentEl || !editEl) return;

    var isEditing = editEl.style.display !== 'none';
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
    var editInput = document.getElementById('env-edit-input');
    if (!editInput) return;
    var newContent = editInput.value.trim();
    if (!newContent) {
        if (typeof showNotification === 'function') showNotification('内容不能为空', 'warning');
        return;
    }

    var letters = editingEnvSection === 'outbox' ? envelopeData.outbox : envelopeData.inbox;
    var letter = null;
    for (var i = 0; i < letters.length; i++) {
        if (letters[i].id === editingEnvId) { letter = letters[i]; break; }
    }
    if (letter) {
        letter.content = newContent;
        saveEnvelopeData();
        var textEl = document.getElementById('env-view-text');
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
    var text = document.getElementById('envelope-input').value.trim();
    if (!text) {
        if (typeof showNotification === 'function') showNotification('信件内容不能为空', 'warning');
        return;
    }

    var sendToChat = document.getElementById('env-send-to-chat').checked;
    if (sendToChat && typeof addMessage === 'function') {
        addMessage({ id: Date.now(), sender: 'user', text: '【寄出的信】\n' + text, timestamp: new Date(), status: 'sent', type: 'normal' });
    }

    var minHours = 10, maxHours = 24;
    var randomHours = Math.random() * (maxHours - minHours) + minHours;
    var replyTime = Date.now() + randomHours * 60 * 60 * 1000;
    var newId = 'env_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    envelopeData.outbox.push({
        id: newId,
        content: text,
        sentTime: Date.now(),
        replyTime: replyTime,
        status: 'pending'
    });
    saveEnvelopeData();

    cancelEnvelopeCompose();
    switchEnvTab('outbox');
    if (typeof showNotification === 'function') {
        showNotification('信件已寄出，预计 ' + Math.floor(randomHours) + ' 小时后收到回信 ✉️', 'success');
    }
}

// ==================== 初始化 ====================
function initEnvelopeListeners() {
    var envelopeEntryBtn = document.getElementById('envelope-function');
    if (envelopeEntryBtn) {
        envelopeEntryBtn.addEventListener('click', async function() {
            try {
                var advancedModal = document.getElementById('advanced-modal');
                if (advancedModal && typeof hideModal === 'function') {
                    hideModal(advancedModal);
                }
                await loadEnvelopeData();
                await checkEnvelopeStatus();

                currentEnvTab = 'outbox';
                switchEnvTab('outbox');

                var envelopeModal = document.getElementById('envelope-modal');
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

    var sendEnvelopeBtn = document.getElementById('send-envelope');
    if (sendEnvelopeBtn) {
        sendEnvelopeBtn.addEventListener('click', handleSendEnvelope);
    }

    var cancelEnvelopeBtn = document.getElementById('cancel-envelope');
    if (cancelEnvelopeBtn) {
        cancelEnvelopeBtn.addEventListener('click', function() {
            var modal = document.getElementById('envelope-modal');
            if (modal && typeof hideModal === 'function') hideModal(modal);
        });
    }

    var tabOutbox = document.getElementById('env-tab-outbox');
    if (tabOutbox) tabOutbox.addEventListener('click', function() { switchEnvTab('outbox'); });

    var tabInbox = document.getElementById('env-tab-inbox');
    if (tabInbox) tabInbox.addEventListener('click', function() { switchEnvTab('inbox'); });

    setInterval(function() {
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

console.log('✅ envelope.js 已加载（最终安全版）');
// ==================== 自动初始化 ====================
(function autoInit() {
    // 等待 DOM 就绪
    function init() {
        if (typeof initEnvelopeListeners === 'function') {
            initEnvelopeListeners();
            console.log('📬 信封功能已自动初始化');
        } else {
            console.warn('信封功能初始化失败：initEnvelopeListeners 未定义');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
// 移动端修复：确保写信按钮能点开
(function fixMobileEnvelopeButton() {
    function bindEnvelopeButton() {
        const btn = document.querySelector('#new-envelope-btn');
        if (btn) {
            // 移除旧事件，重新绑定
            btn.removeEventListener('click', openNewEnvelopeForm);
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof openNewEnvelopeForm === 'function') {
                    openNewEnvelopeForm();
                }
            });
            // 移动端触摸事件
            btn.addEventListener('touchstart', function(e) {
                e.preventDefault();
                if (typeof openNewEnvelopeForm === 'function') {
                    openNewEnvelopeForm();
                }
            });
        } else {
            // 如果按钮还没加载，稍后重试
            setTimeout(bindEnvelopeButton, 300);
        }
    }

    // 页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindEnvelopeButton);
    } else {
        bindEnvelopeButton();
    }
})();