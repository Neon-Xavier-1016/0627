/**
 * highfunctions/farletter.js - 远方来信模块
 * 最终版：信件不移动，支持状态标记、编辑功能，查看回复使用独立弹窗
 */

(function() {
    // 存储 Key
    const STORAGE_KEYS = {
        RECEIVED: 'farLetters_received',
        REPLIED: 'farLetters_replied',
        SETTINGS: 'farLetters_settings'
    };

    // 默认设置
    const DEFAULT_SETTINGS = {
        period: 7,
        minCount: 1,
        maxCount: 5,
        replyNotifyEnabled: true,
        browserNotifyEnabled: true,
        currentCycleStart: null,
        currentCycleCount: 0,
        lastUrgeTime: null
    };

    // 全局变量
    let farLetters = { received: [], replied: [] };
    let farSettings = { ...DEFAULT_SETTINGS };
    let tempSettings = { ...DEFAULT_SETTINGS };
    let currentViewingLetter = null;
    let currentViewingMode = 'received';
    let currentReplyingLetter = null;
    let urgeCooldownActive = false;
    let periodicCheckInterval = null;

    // ========== 辅助函数 ==========
    function getPartnerName() {
        if (window.settings && window.settings.partnerName) return window.settings.partnerName;
        if (typeof settings !== 'undefined' && settings && settings.partnerName) return settings.partnerName;
        return '梦角';
    }

    function getMyName() {
        if (window.settings && window.settings.myName) return window.settings.myName;
        if (typeof settings !== 'undefined' && settings && settings.myName) return settings.myName;
        return '我';
    }

    function showToast(msg, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(msg, type);
        } else {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            const iconMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
            notification.innerHTML = `<i class="fas ${iconMap[type] || 'fa-info-circle'}"></i><span>${msg}</span>`;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.classList.add('hiding');
                notification.addEventListener('animationend', () => notification.remove());
            }, 3000);
        }
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 数据操作 ==========
    async function loadData() {
        try {
            const received = await localforage.getItem(STORAGE_KEYS.RECEIVED);
            const replied = await localforage.getItem(STORAGE_KEYS.REPLIED);
            const settings = await localforage.getItem(STORAGE_KEYS.SETTINGS);

            farLetters.received = received || [];
            farLetters.replied = replied || [];
            farSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
            tempSettings = { ...farSettings };

            farLetters.received = farLetters.received.map(l => ({
                ...l, read: l.read || false, replied: l.replied || false,
                deliveredAt: l.deliveredAt || null,
                originalEdited: l.originalEdited || false,
                originalEditedContent: l.originalEditedContent || null
            }));
            farLetters.replied = farLetters.replied.map(l => ({
                ...l, read: l.read || false, replied: l.replied || false,
                deliveredAt: l.deliveredAt || null,
                replyEdited: l.replyEdited || false,
                replyEditedContent: l.replyEditedContent || null
            }));
        } catch (e) {
            console.error('[远方来信] 加载数据失败', e);
        }
    }

    async function saveData() {
        try {
            await localforage.setItem(STORAGE_KEYS.RECEIVED, farLetters.received);
            await localforage.setItem(STORAGE_KEYS.REPLIED, farLetters.replied);
            await localforage.setItem(STORAGE_KEYS.SETTINGS, farSettings);
        } catch (e) {
            console.error('[远方来信] 保存数据失败', e);
        }
    }

    // ========== 字卡库 ==========
    async function getReplyLibrary() {
        let replyLibrary = [];
        try {
            const stored = await localforage.getItem('customReplies');
            if (stored && stored.reply && stored.reply.length) {
                replyLibrary = stored.reply;
            }
        } catch(e) {}
        if (replyLibrary.length === 0) {
            replyLibrary = [
                "今天天气真好，想和你一起散步。",
                "你吃饭了吗？要注意身体哦。",
                "想你了，你在做什么呢？",
                "晚安，好梦。",
                "早安，今天也要元气满满。",
                "记得多喝水，照顾好自己。"
            ];
        }
        return replyLibrary;
    }

    async function getRandomCardContent(count) {
        const library = await getReplyLibrary();
        if (library.length === 0) return "想你了，记得回信哦~";
        const shuffled = [...library];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, Math.min(count, shuffled.length)).join('\n\n');
    }

    // ========== 生成信件 ==========
    async function generateRandomLetter(triggerType, anniversaryId = null) {
        if (triggerType !== 'anniversary' && farSettings.currentCycleCount >= farSettings.maxCount) {
            return null;
        }
        const cardCount = Math.floor(Math.random() * (45 - 15 + 1)) + 15;
        const cardContent = await getRandomCardContent(cardCount);
        const newLetter = {
            id: generateUUID(), from: 'partner', content: cardContent, cardCount: cardCount,
            sendTime: Date.now(), read: false, replied: false, replyContent: '', replyTime: null,
            deliveredAt: null, triggerType: triggerType, anniversaryId: anniversaryId,
            originalEdited: false, originalEditedContent: null
        };
        farLetters.received.unshift(newLetter);
        if (triggerType !== 'anniversary') farSettings.currentCycleCount++;
        await saveData();
        await sendArrivalNotification(newLetter);
        renderReceivedList();
        updateUnreadBadge();
        return newLetter;
    }

    async function sendArrivalNotification(letter) {
        const partnerName = getPartnerName();
        if (farSettings.browserNotifyEnabled && Notification.permission === 'granted') {
            try {
                new Notification(`📬 来自${partnerName}的信件`, {
                    body: `${partnerName}给你寄来了一封信，快去看吧~`,
                    icon: window.settings?.partnerAvatar || ''
                });
            } catch(e) {}
        }
        if (!document.hidden) {
            addSystemMessage(`📬 ${partnerName}给你寄来了一封信，快去看吧~`);
        }
    }

    function addSystemMessage(text) {
        const chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;
        const systemMsg = document.createElement('div');
        systemMsg.className = 'system-message';
        systemMsg.innerHTML = `<span class="system-message-text">✨ ${text}</span>`;
        chatContainer.appendChild(systemMsg);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // ========== 周期管理 ==========
    async function checkAndProcessCycle() {
        const now = Date.now();
        if (!farSettings.currentCycleStart) {
            farSettings.currentCycleStart = now;
            farSettings.currentCycleCount = 0;
            await saveData();
            return;
        }
        const cycleEnd = farSettings.currentCycleStart + (farSettings.period * 24 * 60 * 60 * 1000);
        if (now >= cycleEnd) {
            const needCount = farSettings.minCount - farSettings.currentCycleCount;
            if (needCount > 0) await generateRandomLetter('auto_supplement');
            farSettings.currentCycleStart = now;
            farSettings.currentCycleCount = 0;
            await saveData();
        }
    }

    function startPeriodicCheck() {
        if (periodicCheckInterval) clearInterval(periodicCheckInterval);
        periodicCheckInterval = setInterval(checkAndProcessCycle, 60 * 60 * 1000);
    }

    function startRandomScheduler() {
        setInterval(async () => {
            if (!farSettings.currentCycleStart) return;
            const now = Date.now();
            const cycleEnd = farSettings.currentCycleStart + (farSettings.period * 24 * 60 * 60 * 1000);
            if (now >= cycleEnd) return;
            if (farSettings.currentCycleCount >= farSettings.maxCount) return;
            const elapsed = now - farSettings.currentCycleStart;
            const total = cycleEnd - farSettings.currentCycleStart;
            const progress = elapsed / total;
            const expectedCount = farSettings.maxCount * progress;
            if (farSettings.currentCycleCount < expectedCount - 0.5) {
                await generateRandomLetter('auto_random');
            }
        }, 30 * 60 * 1000);
    }

    // ========== 催信 ==========
    async function urgeLetter() {
        const partnerName = getPartnerName();
        if (urgeCooldownActive) {
            showToast(`不要着急嘛，${partnerName}还在慢慢写呢💕`, 'warning');
            return;
        }
        urgeCooldownActive = true;
        farSettings.lastUrgeTime = Date.now();
        await saveData();
        showToast(`已催促${partnerName}，Ta会在2-15小时内回信~`, 'success');
        const delayMs = (Math.random() * (15 - 2) + 2) * 60 * 60 * 1000;
        setTimeout(async () => {
            await generateRandomLetter('manual');
            urgeCooldownActive = false;
            await saveData();
        }, delayMs);
    }

    // ========== 回复信件 ==========
    async function replyToLetter(letterId, replyContent, sendToChat) {
        const letter = farLetters.received.find(l => l.id === letterId);
        if (!letter || letter.replied) return;
        const partnerName = getPartnerName();
        letter.replied = true;
        letter.replyContent = replyContent;
        letter.replyTime = Date.now();
        const repliedLetter = { ...letter, replyEdited: false, replyEditedContent: null };
        farLetters.replied.unshift(repliedLetter);
        await saveData();
        if (sendToChat && typeof window.sendMessage === 'function') {
            window.sendMessage(replyContent);
        }
        if (farSettings.replyNotifyEnabled) {
            const dateStr = new Date(letter.sendTime).toLocaleDateString();
            addSystemMessage(`📮 你回复了${partnerName}在 ${dateStr} 的来信`);
        }
        const deliveryDelay = Math.random() * 18 * 60 * 60 * 1000;
        setTimeout(async () => {
            const targetLetter = farLetters.replied.find(l => l.id === letterId);
            if (targetLetter) {
                targetLetter.deliveredAt = Date.now();
                await saveData();
                renderRepliedList();
            }
        }, deliveryDelay);
        renderReceivedList();
        renderRepliedList();
        updateUnreadBadge();
        closeReplyCompose();
        showToast('回复已寄出✨', 'success');
        return true;
    }

    // ========== 删除信件 ==========
    async function deleteLetter(letterId, isReceived) {
        if (!confirm('确定要删除这封信吗？删除后无法恢复。')) return;
        if (isReceived) {
            farLetters.received = farLetters.received.filter(l => l.id !== letterId);
        } else {
            farLetters.replied = farLetters.replied.filter(l => l.id !== letterId);
        }
        await saveData();
        renderReceivedList();
        renderRepliedList();
        updateUnreadBadge();
        showToast('信件已删除', 'info');
    }

    // ========== 编辑功能 ==========
    async function editOriginalLetter(letterId, newContent) {
        const letter = farLetters.received.find(l => l.id === letterId);
        if (!letter) return false;
        letter.originalEdited = true;
        letter.originalEditedContent = newContent;
        await saveData();
        showToast('原信已编辑保存', 'success');
        if (currentViewingLetter && currentViewingLetter.id === letterId) {
            viewLetterDetail(letter, currentViewingMode);
        }
        renderReceivedList();
        return true;
    }

    async function editReplyLetter(letterId, newReplyContent) {
        const letter = farLetters.replied.find(l => l.id === letterId);
        if (!letter) return false;
        letter.replyEdited = true;
        letter.replyEditedContent = newReplyContent;
        await saveData();
        showToast('回信已编辑保存', 'success');
        if (currentViewingLetter && currentViewingLetter.id === letterId) {
            viewLetterDetail(letter, currentViewingMode);
        }
        renderRepliedList();
        return true;
    }

    function getDisplayOriginalContent(letter) {
        if (letter.originalEdited && letter.originalEditedContent) return letter.originalEditedContent;
        return letter.content;
    }

    function getDisplayReplyContent(letter) {
        if (letter.replyEdited && letter.replyEditedContent) return letter.replyEditedContent;
        return letter.replyContent;
    }

    // ========== 独立弹窗（查看回复） ==========
    function showReplyPopup(repliedLetter) {
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#ff6b9d';
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary-bg').trim() || '#1a1a2e';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#ffffff';

        let r = 255, g = 107, b = 157;
        if (accentColor.startsWith('#')) {
            r = parseInt(accentColor.slice(1,3), 16);
            g = parseInt(accentColor.slice(3,5), 16);
            b = parseInt(accentColor.slice(5,7), 16);
        }

        const partnerName = getPartnerName();
        const myName = getMyName();
        const displayOriginal = getDisplayOriginalContent(repliedLetter);
        const displayReply = getDisplayReplyContent(repliedLetter);
        const replyDate = new Date(repliedLetter.replyTime).toLocaleString();
        const sendDate = new Date(repliedLetter.sendTime).toLocaleDateString();

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;';

        const content = document.createElement('div');
        content.style.cssText = `background:${bgColor};border-radius:20px;width:90%;max-width:400px;max-height:80%;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,0.5);`;

        content.innerHTML = `
            <div style="background:${accentColor};padding:14px 20px;position:relative;">
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(45deg,rgba(255,255,255,0.04) 0px,rgba(255,255,255,0.04) 2px,transparent 2px,transparent 12px);pointer-events:none;"></div>
                <div style="position:relative;display:flex;align-items:center;justify-content:space-between;color:white;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
                        <span style="font-size:14px;font-weight:700;letter-spacing:2px;">回复的信</span>
                    </div>
                    <div style="border:2px solid rgba(255,255,255,0.5);border-radius:50%;width:48px;height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0.7;">
                        <span style="font-size:7px;letter-spacing:0.5px;">已送达</span>
                        <span style="font-size:8px;font-weight:600;">${sendDate}</span>
                        <span style="font-size:6px;opacity:0.8;">DELIVERED</span>
                    </div>
                </div>
            </div>
            <div style="padding:16px;">
                <div style="margin-bottom:16px;background:rgba(${r},${g},${b},0.06);border:1px solid rgba(${r},${g},${b},0.18);border-radius:10px;padding:12px 14px;border-left:3px solid ${accentColor};">
                    <div style="font-size:10px;color:${accentColor};letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:5px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
                        ${escapeHtml(partnerName)}的原信
                    </div>
                    <div style="font-size:13px;color:${textColor};line-height:1.8;white-space:pre-wrap;">${escapeHtml(displayOriginal)}</div>
                </div>
                <div style="background:var(--primary-bg,#0d0d14);border-radius:12px;border:1px solid var(--border-color,#333);overflow:hidden;">
                    <div style="height:4px;background:linear-gradient(90deg,${accentColor},rgba(${r},${g},${b},0.4),${accentColor});"></div>
                    <div style="padding:18px 20px 14px;">
                        <div style="font-size:10px;color:${accentColor};letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:5px;">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
                            你的回信
                        </div>
                        <div style="font-size:13px;color:${textColor};line-height:1.8;white-space:pre-wrap;margin-bottom:16px;">${escapeHtml(displayReply)}</div>
                        <div style="border-top:1px dashed rgba(${r},${g},${b},0.25);margin:12px 0;"></div>
                        <div style="font-size:11px;color:var(--text-secondary,#aaa);text-align:right;margin-bottom:4px;">${replyDate}</div>
                        <div style="font-size:14px;color:${accentColor};text-align:right;font-weight:600;">${escapeHtml(myName)}</div>
                    </div>
                </div>
            </div>
            <div style="margin:0;padding:12px 18px 16px;border-top:1px solid var(--border-color,#333);display:flex;gap:10px;">
                <button id="close-reply-popup" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border-color,#333);background:transparent;color:var(--text-secondary,#aaa);cursor:pointer;">关闭</button>
                <button id="edit-reply-popup" style="flex:2;padding:10px;border-radius:10px;border:none;background:${accentColor};color:white;cursor:pointer;font-weight:500;">✎ 编辑回信</button>
            </div>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        document.getElementById('close-reply-popup').onclick = () => overlay.remove();
        document.getElementById('edit-reply-popup').onclick = () => {
            overlay.remove();
            openEditReplyDialog(repliedLetter);
        };
    }

    // ========== UI 渲染 ==========
    function renderReceivedList() {
        const container = document.getElementById('farletter-received-list');
        const emptyDiv = document.getElementById('farletter-received-empty');
        const partnerName = getPartnerName();
        if (!container) return;
        if (farLetters.received.length === 0) {
            container.style.display = 'none';
            if (emptyDiv) emptyDiv.style.display = 'block';
            return;
        }
        container.style.display = 'flex';
        if (emptyDiv) emptyDiv.style.display = 'none';
        container.innerHTML = farLetters.received.map(letter => {
            const dateStr = new Date(letter.sendTime).toLocaleString();
            const displayContent = getDisplayOriginalContent(letter);
            const preview = displayContent.substring(0, 40) + (displayContent.length > 40 ? '...' : '');
            let statusDot = '';
            if (!letter.read) statusDot = '<span class="farletter-unread-dot" style="background:#ff4444;"></span>';
            else if (!letter.replied) statusDot = '<span class="farletter-unread-dot" style="background:#44cc44;"></span>';
            const statusText = letter.replied ? `✓ 已回复${partnerName}` : (letter.read ? '📖 已读' : '✨ 新信');
            return `
                <div class="farletter-list-item" data-id="${letter.id}" data-type="received">
                    <div class="farletter-item-header">
                        <div class="farletter-item-date">${statusDot}<span>收到·${dateStr}</span></div>
                        <span class="farletter-item-status ${letter.replied ? 'replied' : (letter.read ? 'read' : 'unread')}">${statusText}</span>
                    </div>
                    <div class="farletter-item-preview">原信：${escapeHtml(preview)}</div>
                    <button class="farletter-item-delete" data-id="${letter.id}" onclick="event.stopPropagation(); window._deleteFarLetter('${letter.id}', true)"><i class="fas fa-times"></i></button>
                </div>
            `;
        }).join('');
        document.querySelectorAll('#farletter-received-list .farletter-list-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.farletter-item-delete')) return;
                const id = el.dataset.id;
                const letter = farLetters.received.find(l => l.id === id);
                if (letter) viewLetterDetail(letter, 'received');
            });
        });
    }

    function renderRepliedList() {
        const container = document.getElementById('farletter-replied-list');
        const emptyDiv = document.getElementById('farletter-replied-empty');
        const partnerName = getPartnerName();
        if (!container) return;
        if (farLetters.replied.length === 0) {
            container.style.display = 'none';
            if (emptyDiv) emptyDiv.style.display = 'block';
            return;
        }
        container.style.display = 'flex';
        if (emptyDiv) emptyDiv.style.display = 'none';
        container.innerHTML = farLetters.replied.map(letter => {
            const dateStr = new Date(letter.sendTime).toLocaleString();
            const displayReply = getDisplayReplyContent(letter);
            const preview = displayReply.substring(0, 40) + (displayReply.length > 40 ? '...' : '');
            const statusText = letter.deliveredAt ? `✓ ${partnerName}已收到` : `📮 等待${partnerName}查看`;
            return `
                <div class="farletter-list-item" data-id="${letter.id}" data-type="replied">
                    <div class="farletter-item-header">
                        <div class="farletter-item-date"><span>回复·${dateStr}</span></div>
                        <span class="farletter-item-status">${statusText}</span>
                    </div>
                    <div class="farletter-item-preview">回复：${escapeHtml(preview)}</div>
                    <button class="farletter-item-delete" data-id="${letter.id}" onclick="event.stopPropagation(); window._deleteFarLetter('${letter.id}', false)"><i class="fas fa-times"></i></button>
                </div>
            `;
        }).join('');
        document.querySelectorAll('#farletter-replied-list .farletter-list-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.farletter-item-delete')) return;
                const id = el.dataset.id;
                const letter = farLetters.replied.find(l => l.id === id);
                if (letter) viewLetterDetail(letter, 'replied');
            });
        });
    }

    // ========== 查看信件详情 ==========
    function viewLetterDetail(letter, type) {
        const partnerName = getPartnerName();
        const myName = getMyName();
        currentViewingLetter = letter;
        currentViewingMode = type;
        if (type === 'received' && !letter.read) {
            letter.read = true;
            saveData();
            renderReceivedList();
            updateUnreadBadge();
        }
        const displayOriginal = getDisplayOriginalContent(letter);
        document.getElementById('farletter-view-title').textContent = type === 'received' ? '收到的信' : '回复的信';
        document.getElementById('farletter-view-stamp-date').textContent = new Date(letter.sendTime).toLocaleDateString();
        document.getElementById('farletter-view-original-text').textContent = displayOriginal;
        const replyCtx = document.getElementById('farletter-view-reply-ctx');
        if (type === 'replied' && letter.replyContent) {
            const displayReply = getDisplayReplyContent(letter);
            replyCtx.style.display = 'block';
            document.getElementById('farletter-view-reply-greeting').textContent = `致${partnerName}：收到你的信件啦，一切安好`;
            document.getElementById('farletter-view-reply-text').textContent = displayReply;
            document.getElementById('farletter-view-reply-date').textContent = new Date(letter.replyTime).toLocaleString();
            document.getElementById('farletter-view-reply-sign').textContent = myName;
        } else {
            replyCtx.style.display = 'none';
        }
        // 按钮控制
        const replyBtn = document.getElementById('farletter-reply-from-view');
        const viewReplyBtn = document.getElementById('farletter-view-reply-btn');
        const editOriginalBtn = document.getElementById('farletter-edit-original-btn');
        const editReplyBtn = document.getElementById('farletter-edit-reply-btn');
        if (type === 'received') {
            if (!letter.replied) {
                replyBtn.style.display = 'block';
                viewReplyBtn.style.display = 'none';
                replyBtn.onclick = () => { closeFarLetterView(); openReplyCompose(letter); };
            } else {
                replyBtn.style.display = 'none';
                viewReplyBtn.style.display = 'block';
                viewReplyBtn.onclick = () => {
                    const repliedLetter = farLetters.replied.find(l => l.id === letter.id);
                    if (repliedLetter) showReplyPopup(repliedLetter);
                    else showToast('找不到对应的回信记录', 'warning');
                };
            }
            editOriginalBtn.style.display = 'block';
            editReplyBtn.style.display = 'none';
            editOriginalBtn.onclick = () => openEditOriginalDialog(letter);
        } else {
            replyBtn.style.display = 'none';
            viewReplyBtn.style.display = 'none';
            editOriginalBtn.style.display = 'none';
            editReplyBtn.style.display = 'block';
            editReplyBtn.onclick = () => openEditReplyDialog(letter);
        }
        showModal(document.getElementById('farletter-view-modal'));
    }

    // ========== 编辑对话框 ==========
    function openEditOriginalDialog(letter) {
        const modal = document.getElementById('farletter-edit-modal');
        const title = document.getElementById('farletter-edit-title');
        const textarea = document.getElementById('farletter-edit-textarea');
        const saveBtn = document.getElementById('farletter-edit-save');
        const cancelBtn = document.getElementById('farletter-edit-cancel');
        title.textContent = '编辑原信';
        textarea.value = getDisplayOriginalContent(letter);
        modal.style.cssText = `position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:999999!important;background:rgba(0,0,0,0.7)!important;`;
        const contentDiv = modal.querySelector('.modal-content');
        if (contentDiv) contentDiv.style.cssText = `background:var(--secondary-bg,#1a1a2e)!important;border-radius:20px!important;width:90%!important;max-width:400px!important;margin:0 auto!important;`;
        const newSaveBtn = saveBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        const onSave = async () => {
            const newContent = textarea.value.trim();
            if (!newContent) { showToast('内容不能为空', 'warning'); return; }
            await editOriginalLetter(letter.id, newContent);
            modal.style.display = 'none';
        };
        const onCancel = () => { modal.style.display = 'none'; };
        newSaveBtn.addEventListener('click', onSave);
        newCancelBtn.addEventListener('click', onCancel);
    }

    function openEditReplyDialog(letter) {
        const modal = document.getElementById('farletter-edit-modal');
        const title = document.getElementById('farletter-edit-title');
        const textarea = document.getElementById('farletter-edit-textarea');
        const saveBtn = document.getElementById('farletter-edit-save');
        const cancelBtn = document.getElementById('farletter-edit-cancel');
        title.textContent = '编辑回信';
        textarea.value = getDisplayReplyContent(letter);
        modal.style.cssText = `position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:999999!important;background:rgba(0,0,0,0.7)!important;`;
        const contentDiv = modal.querySelector('.modal-content');
        if (contentDiv) contentDiv.style.cssText = `background:var(--secondary-bg,#1a1a2e)!important;border-radius:20px!important;width:90%!important;max-width:400px!important;margin:0 auto!important;`;
        const newSaveBtn = saveBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        const onSave = async () => {
            const newContent = textarea.value.trim();
            if (!newContent) { showToast('内容不能为空', 'warning'); return; }
            await editReplyLetter(letter.id, newContent);
            modal.style.display = 'none';
        };
        const onCancel = () => { modal.style.display = 'none'; };
        newSaveBtn.addEventListener('click', onSave);
        newCancelBtn.addEventListener('click', onCancel);
    }

    function openReplyCompose(letter) {
        currentReplyingLetter = letter;
        document.getElementById('farletter-reply-input').value = '';
        document.getElementById('farletter-send-to-chat').checked = true;
        document.getElementById('farletter-received-section').style.display = 'none';
        document.getElementById('farletter-replied-section').style.display = 'none';
        document.getElementById('farletter-reply-compose').style.display = 'block';
    }

    function closeReplyCompose() {
        document.getElementById('farletter-received-section').style.display = 'block';
        document.getElementById('farletter-replied-section').style.display = 'none';
        document.getElementById('farletter-reply-compose').style.display = 'none';
        currentReplyingLetter = null;
    }

    function closeFarLetterView() {
        const modal = document.getElementById('farletter-view-modal');
        if (modal) modal.style.display = 'none';
        currentViewingLetter = null;
    }

    function updateFarLetterDynamicNames() {
        try {
            const partnerName = getPartnerName();
            const emptyText = document.getElementById('farletter-empty-text');
            if (emptyText) emptyText.textContent = `${partnerName}还没有给你寄信~ 点「催一封信」试试`;
            const settingsTitle = document.getElementById('farletter-settings-title');
            if (settingsTitle) settingsTitle.textContent = `${partnerName} 写信的频率`;
            const originalName = document.getElementById('farletter-view-original-name');
            if (originalName) originalName.textContent = partnerName;
            const replyGreeting = document.getElementById('farletter-view-reply-greeting');
            if (replyGreeting) replyGreeting.textContent = `致${partnerName}：收到你的信件啦，一切安好`;
            renderReceivedList();
            renderRepliedList();
            if (currentViewingLetter) viewLetterDetail(currentViewingLetter, currentViewingMode);
        } catch(e) { console.warn('updateFarLetterDynamicNames error:', e); }
    }

    function updateUnreadBadge() {
        const unreadCount = farLetters.received.filter(l => !l.read && !l.replied).length;
        const badge = document.getElementById('farletter-received-badge');
        if (unreadCount > 0 && badge) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'inline-flex';
        } else if (badge) badge.style.display = 'none';
    }

    window.switchFarLetterTab = function(tab) {
        const receivedSection = document.getElementById('farletter-received-section');
        const repliedSection = document.getElementById('farletter-replied-section');
        const receivedTab = document.getElementById('farletter-tab-received');
        const repliedTab = document.getElementById('farletter-tab-replied');
        if (tab === 'received') {
            receivedSection.style.display = 'block';
            repliedSection.style.display = 'none';
            receivedTab.classList.add('active');
            repliedTab.classList.remove('active');
            renderReceivedList();
        } else {
            receivedSection.style.display = 'none';
            repliedSection.style.display = 'block';
            receivedTab.classList.remove('active');
            repliedTab.classList.add('active');
            renderRepliedList();
        }
    };

        // ========== 设置面板 ==========
        function openSettingsModal() {
            updateFarLetterDynamicNames();
            tempSettings = { ...farSettings };

            // 更新周期按钮状态
            document.querySelectorAll('#farletter-settings-modal .period-btn').forEach(btn => {
                btn.classList.remove('active');
                if (parseInt(btn.dataset.period) === tempSettings.period) {
                    btn.classList.add('active');
                }
            });

            // 更新数字显示
            document.getElementById('farletter-min-val').textContent = tempSettings.minCount;
            document.getElementById('farletter-max-val').textContent = tempSettings.maxCount;

            // ========== 绑定加减按钮事件 ==========
            const minMinus = document.getElementById('farletter-min-minus');
            const minPlus = document.getElementById('farletter-min-plus');
            const maxMinus = document.getElementById('farletter-max-minus');
            const maxPlus = document.getElementById('farletter-max-plus');

            if (minMinus) {
                const newMinMinus = minMinus.cloneNode(true);
                minMinus.parentNode.replaceChild(newMinMinus, minMinus);
                newMinMinus.onclick = () => {
                    let val = tempSettings.minCount;
                    if (val > 1) {
                        val--;
                        if (val > tempSettings.maxCount) val = tempSettings.maxCount;
                        tempSettings.minCount = val;
                        document.getElementById('farletter-min-val').textContent = val;
                    }
                };
            }

            if (minPlus) {
                const newMinPlus = minPlus.cloneNode(true);
                minPlus.parentNode.replaceChild(newMinPlus, minPlus);
                newMinPlus.onclick = () => {
                    let val = tempSettings.minCount;
                    if (val < 10) {
                        val++;
                        if (val > tempSettings.maxCount) val = tempSettings.maxCount;
                        tempSettings.minCount = val;
                        document.getElementById('farletter-min-val').textContent = val;
                    }
                };
            }

            if (maxMinus) {
                const newMaxMinus = maxMinus.cloneNode(true);
                maxMinus.parentNode.replaceChild(newMaxMinus, maxMinus);
                newMaxMinus.onclick = () => {
                    let val = tempSettings.maxCount;
                    if (val > 1) {
                        val--;
                        if (val < tempSettings.minCount) val = tempSettings.minCount;
                        tempSettings.maxCount = val;
                        document.getElementById('farletter-max-val').textContent = val;
                    }
                };
            }

            if (maxPlus) {
                const newMaxPlus = maxPlus.cloneNode(true);
                maxPlus.parentNode.replaceChild(newMaxPlus, maxPlus);
                newMaxPlus.onclick = () => {
                    let val = tempSettings.maxCount;
                    if (val < 10) {
                        val++;
                        if (val < tempSettings.minCount) val = tempSettings.minCount;
                        tempSettings.maxCount = val;
                        document.getElementById('farletter-max-val').textContent = val;
                    }
                };
            }

            // 显示设置面板
            showModal(document.getElementById('farletter-settings-modal'));
        }

    function updateTempPeriod(btn) {
        tempSettings.period = parseInt(btn.dataset.period);
        document.querySelectorAll('#farletter-settings-modal .period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    function updateTempReplyNotify() {
        tempSettings.replyNotifyEnabled = !tempSettings.replyNotifyEnabled;
        const pill = document.querySelector('#farletter-notify-toggle .setting-pill-switch');
        if (pill) {
            const knob = pill.querySelector('.setting-pill-knob');
            if (tempSettings.replyNotifyEnabled) {
                pill.classList.add('active');
                if (knob) knob.style.right = '3px';
            } else {
                pill.classList.remove('active');
                if (knob) knob.style.right = '23px';
            }
        }
    }

    function updateTempBrowserNotify() {
        tempSettings.browserNotifyEnabled = !tempSettings.browserNotifyEnabled;
        const pill = document.querySelector('#farletter-browser-notify-toggle .setting-pill-switch');
        if (pill) {
            const knob = pill.querySelector('.setting-pill-knob');
            if (tempSettings.browserNotifyEnabled) {
                pill.classList.add('active');
                if (knob) knob.style.right = '3px';
            } else {
                pill.classList.remove('active');
                if (knob) knob.style.right = '23px';
            }
        }
    }

    async function saveSettings() {
        farSettings.period = tempSettings.period;
        farSettings.minCount = tempSettings.minCount;
        farSettings.maxCount = tempSettings.maxCount;
        farSettings.replyNotifyEnabled = tempSettings.replyNotifyEnabled;
        farSettings.browserNotifyEnabled = tempSettings.browserNotifyEnabled;
        await saveData();
        showToast('设置已保存', 'success');
        hideModal(document.getElementById('farletter-settings-modal'));
    }

    function cancelSettings() {
        hideModal(document.getElementById('farletter-settings-modal'));
    }

    function startNameChangeWatcher() {
        return;
    }

    // ========== 事件绑定 ==========
    function setupEventListeners() {
        document.getElementById('farletter-function')?.addEventListener('click', () => {
            updateFarLetterDynamicNames();
            renderReceivedList();
            renderRepliedList();
            updateUnreadBadge();
            showModal(document.getElementById('farletter-modal'));
        });
        document.getElementById('farletter-close-btn')?.addEventListener('click', () => {
            hideModal(document.getElementById('farletter-modal'));
        });
        document.getElementById('farletter-urge-btn')?.addEventListener('click', urgeLetter);
        document.getElementById('farletter-settings-btn')?.addEventListener('click', openSettingsModal);
        document.getElementById('farletter-close-view')?.addEventListener('click', closeFarLetterView);
        document.getElementById('farletter-cancel-reply')?.addEventListener('click', closeReplyCompose);
        document.getElementById('farletter-send-reply')?.addEventListener('click', async () => {
            const replyContent = document.getElementById('farletter-reply-input').value.trim();
            if (!replyContent) { showToast('请填写回复内容~', 'warning'); return; }
            if (currentReplyingLetter) {
                const sendToChat = document.getElementById('farletter-send-to-chat').checked;
                await replyToLetter(currentReplyingLetter.id, replyContent, sendToChat);
                closeReplyCompose();
            }
        });
        document.querySelectorAll('#farletter-settings-modal .period-btn').forEach(btn => {
            btn.addEventListener('click', () => updateTempPeriod(btn));
        });
        document.getElementById('farletter-notify-toggle')?.addEventListener('click', updateTempReplyNotify);
        document.getElementById('farletter-browser-notify-toggle')?.addEventListener('click', updateTempBrowserNotify);
        document.getElementById('farletter-settings-save')?.addEventListener('click', saveSettings);
        document.getElementById('farletter-settings-cancel')?.addEventListener('click', cancelSettings);
        document.getElementById('farletter-request-permission')?.addEventListener('click', async () => {
            if (Notification.permission === 'granted') {
                showToast('通知权限已开启', 'success');
            } else if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') showToast('通知权限已开启✨', 'success');
            } else {
                showToast('通知权限已被拒绝，请在浏览器设置中开启', 'warning');
            }
        });
    }

    // ========== 导出全局函数 ==========
    window.updateFarLetterDynamicNames = updateFarLetterDynamicNames;
    window._deleteFarLetter = deleteLetter;
    window.triggerFarLetterOnAnniversary = async function(anniversaryId, anniversaryName) {
        const partnerName = getPartnerName();
        const today = new Date();
        const todayKey = `farletter_ann_${anniversaryId}_${today.getFullYear()}`;
        let alreadySent = false;
        try { alreadySent = await localforage.getItem(todayKey); } catch(e) {}
        if (!alreadySent) {
            await generateRandomLetter('anniversary', anniversaryId);
            await localforage.setItem(todayKey, true);
            if (!document.hidden) addSystemMessage(`📬 今天是${anniversaryName}，${partnerName}给你寄来了一封信~`);
        }
    };

    // ========== 初始化 ==========
    async function initFarLetter() {
        await loadData();
        await checkAndProcessCycle();
        startPeriodicCheck();
        startRandomScheduler();
        setupEventListeners();
        updateUnreadBadge();
        updateFarLetterDynamicNames();
        startNameChangeWatcher();
        console.log('[远方来信] 初始化完成');
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFarLetter);
    } else {
        initFarLetter();
    }
})();