/* ============================================================
 * 通用工具 · 从 group-chat.js 提取
 * 包含：统计 tab / 消息搜索 / 备份按钮 / 公告天气编辑 / 输入框滚动 / 消息撤回
 * ============================================================ */

/* ---------- 统计弹窗 Tab 切换 ---------- */
window.switchStatsTab = function(tab) {
    var statsPanel     = document.getElementById('stats-panel');
    var favoritesPanel = document.getElementById('favorites-panel');
    var searchPanel    = document.getElementById('search-panel');
    var wordcloudPanel = document.getElementById('wordcloud-panel');
    var allBtns = document.querySelectorAll('.stats-nav-btn');
    allBtns.forEach(function(b) { b.classList.remove('active'); });
    var activeBtn = document.querySelector('.stats-nav-btn[data-tab="' + tab + '"]');
    if (activeBtn) activeBtn.classList.add('active');

    if (statsPanel)     statsPanel.style.display = 'none';
    if (favoritesPanel) favoritesPanel.style.display = 'none';
    if (searchPanel)    searchPanel.style.display = 'none';
    if (wordcloudPanel) wordcloudPanel.style.display = 'none';

    if (tab === 'stats') {
        if (statsPanel) statsPanel.style.display = 'block';
    } else if (tab === 'search') {
        if (searchPanel) searchPanel.style.display = 'block';
        setTimeout(function() {
            var inp = document.getElementById('msg-search-input');
            if (inp) inp.focus();
        }, 100);
    } else if (tab === 'wordcloud') {
        if (wordcloudPanel) wordcloudPanel.style.display = 'block';
        requestAnimationFrame(function() {
            if (typeof renderWordCloud === 'function') renderWordCloud();
        });
    } else {
        if (favoritesPanel) favoritesPanel.style.display = 'block';
        if (typeof renderFavorites === 'function') renderFavorites();
    }
};

/* ---------- 备份导出 / 导入按钮 ---------- */
document.addEventListener('DOMContentLoaded', function() {
    var exportAllBtn = document.getElementById('export-all-settings');
    var importAllBtn = document.getElementById('import-all-settings');

    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', async function() {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';
            overlay.innerHTML = `
                <div style="background:var(--secondary-bg);border-radius:20px;padding:24px;width:88%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
                    <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:4px;display:flex;align-items:center;gap:8px;">
                        <i class="fas fa-archive" style="color:var(--accent-color);font-size:14px;"></i>全量备份导出
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">默认导出为 <strong>ZIP</strong>：<code style="font-size:11px;">backup.json</code> 仅存结构与引用，大图在 <code style="font-size:11px;">media/</code>。</div>
                    <div style="display:flex;flex-direction:column;gap:9px;margin-bottom:20px;">
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:12px;background:var(--primary-bg);font-size:13px;color:var(--text-primary);">
                            <input type="checkbox" id="_bk_msgs" checked style="accent-color:var(--accent-color);width:15px;height:15px;">
                            <i class="fas fa-comments" style="color:var(--accent-color);width:16px;text-align:center;"></i>
                            <span>聊天记录 <span style="font-size:11px;color:var(--text-secondary);">(${typeof messages !== 'undefined' ? messages.length : 0} 条)</span></span>
                        </label>
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:12px;background:var(--primary-bg);font-size:13px;color:var(--text-primary);">
                            <input type="checkbox" id="_bk_settings" checked style="accent-color:var(--accent-color);width:15px;height:15px;">
                            <i class="fas fa-sliders-h" style="color:var(--accent-color);width:16px;text-align:center;"></i>
                            <span>外观与聊天设置</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:12px;background:var(--primary-bg);font-size:13px;color:var(--text-primary);">
                            <input type="checkbox" id="_bk_custom" checked style="accent-color:var(--accent-color);width:15px;height:15px;">
                            <i class="fas fa-reply" style="color:var(--accent-color);width:16px;text-align:center;"></i>
                            <span>字卡 / 拍一拍 / 状态 / 格言</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:12px;background:var(--primary-bg);font-size:13px;color:var(--text-primary);">
                            <input type="checkbox" id="_bk_ann" checked style="accent-color:var(--accent-color);width:15px;height:15px;">
                            <i class="fas fa-calendar-heart" style="color:var(--accent-color);width:16px;text-align:center;"></i>
                            <span>纪念日 / 倒计时</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:12px;background:var(--primary-bg);font-size:13px;color:var(--text-primary);">
                            <input type="checkbox" id="_bk_themes" checked style="accent-color:var(--accent-color);width:15px;height:15px;">
                            <i class="fas fa-palette" style="color:var(--accent-color);width:16px;text-align:center;"></i>
                            <span>自定义主题 / 方案</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:12px;background:var(--primary-bg);font-size:13px;color:var(--text-primary);">
                            <input type="checkbox" id="_bk_dg" checked style="accent-color:var(--accent-color);width:15px;height:15px;">
                            <i class="fas fa-sun" style="color:var(--accent-color);width:16px;text-align:center;"></i>
                            <span>每日公告 / 心情数据</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:12px;background:var(--primary-bg);font-size:13px;color:var(--text-primary);">
                            <input type="checkbox" id="_bk_stickers" style="accent-color:var(--accent-color);width:15px;height:15px;">
                            <i class="fas fa-sticky-note" style="color:var(--accent-color);width:16px;text-align:center;"></i>
                            <span>表情库 <span style="font-size:11px;color:var(--text-secondary);">(默认关，勾选后去重打包)</span></span>
                        </label>
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button id="_bk_cancel" style="flex:1;padding:11px;border:1px solid var(--border-color);border-radius:12px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">取消</button>
                        <button id="_bk_confirm" style="flex:2;padding:11px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-family);display:flex;align-items:center;justify-content:center;gap:7px;">
                            <i class="fas fa-download"></i>导出备份
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            function closeBkDialog() { overlay.remove(); }
            overlay.addEventListener('click', ev => { if (ev.target === overlay) closeBkDialog(); });
            const bkCancelBtn = document.getElementById('_bk_cancel');
            const bkConfirmBtn = document.getElementById('_bk_confirm');
            if (bkCancelBtn) bkCancelBtn.onclick = closeBkDialog;

            if (bkConfirmBtn) bkConfirmBtn.onclick = async function() {
                const inclMsgs    = document.getElementById('_bk_msgs').checked;
                const inclSet     = document.getElementById('_bk_settings').checked;
                const inclCustom  = document.getElementById('_bk_custom').checked;
                const inclAnn     = document.getElementById('_bk_ann').checked;
                const inclThemes  = document.getElementById('_bk_themes').checked;
                const inclDg      = document.getElementById('_bk_dg').checked;
                const inclStickers = document.getElementById('_bk_stickers') && document.getElementById('_bk_stickers').checked;

                if (!inclMsgs && !inclSet && !inclCustom && !inclAnn && !inclThemes && !inclDg && !inclStickers) {
                    showNotification('请至少选择一项', 'error');
                    return;
                }
                closeBkDialog();

                try {
                    if (typeof ChatBackup !== 'undefined' && ChatBackup.buildBackupPayload && ChatBackup.serializeBackupV4) {
                        const payload = await ChatBackup.buildBackupPayload({
                            inclMsgs, inclSet, inclCustom, inclAnn, inclThemes, inclDg, inclStickers
                        });
                        const jsonString = ChatBackup.serializeBackupV4(payload);
                        const dateStr = new Date().toISOString().slice(0, 10);
                        const fileName = `chatapp-backup-${dateStr}.json`;
                        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
                        downloadFileFallback(blob, fileName);
                        if (typeof showNotification === 'function') showNotification('已导出 JSON 备份', 'success');
                    } else {
                        if (typeof showNotification === 'function') showNotification('备份模块或函数未加载，请刷新页面', 'error');
                    }
                } catch(e) {
                    console.error('全量备份导出失败:', e);
                    if (typeof showNotification === 'function') showNotification('导出失败，请重试', 'error');
                }
            };
        });
    }

    if (importAllBtn) {
        importAllBtn.addEventListener('click', function() {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.zip,application/json,application/zip';
            input.onchange = async function(e) {
                var file = e.target.files[0];
                if (!file) return;

                if (file.size > 220 * 1024 * 1024) {
                    if (typeof showNotification === 'function') showNotification('文件过大，请检查是否是正确的备份文件', 'error');
                    return;
                }

                try {
                    if (typeof ChatBackup === 'undefined' || !ChatBackup.loadBackupFromFile || !ChatBackup.applyBackupToStorage) {
                        throw new Error('备份模块未加载，请刷新页面');
                    }
                    var backup = await ChatBackup.loadBackupFromFile(file);

                    var okShape = backup.type === 'chatapp-backup-v5' ||
                        backup.type === 'full' ||
                        (backup.type && backup.type.indexOf('backup') !== -1) ||
                        backup.formatVersion === 4 ||
                        backup.formatVersion === 5 ||
                        backup.localforage ||
                        backup.indexedDB;
                    if (!okShape) throw new Error('不是有效的传讯备份文件');

                    if (!confirm('导入全量备份将覆盖备份文件中包含的数据（按文件内容写入）。\n\nv5 ZIP：从 media/ 还原图片；v4 JSON：从 mediaStore 还原。\n\n确定继续吗？')) return;

                    await ChatBackup.applyBackupToStorage(backup, { selective: false });

                    if (typeof showNotification === 'function') showNotification('数据恢复成功，即将刷新页面应用更改', 'success', 2000);
                    setTimeout(function() { location.reload(); }, 2000);
                } catch (err) {
                    var msg = err && err.message ? err.message : '未知错误';
                    if (typeof showNotification === 'function') showNotification('导入失败：' + msg, 'error', 5000);
                    console.error('导入报错:', err);
                }
            };
            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
        });
    }
});

/* ---------- 公告天气点击编辑 ---------- */
window.startEditDgWeather = function(el) {
    var current = el.textContent.trim();
    var input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.maxLength = 20;
    input.style.cssText = 'width:120px;padding:2px 6px;border:1px solid var(--accent-color);border-radius:6px;font-size:13px;background:var(--primary-bg);color:var(--text-primary);outline:none;';
    el.style.display = 'none';
    el.parentNode.insertBefore(input, el.nextSibling);
    input.focus();
    input.select();
    function saveWeather() {
        var val = input.value.trim() || current;
        el.textContent = val;
        el.style.display = '';
        input.remove();
        var now = new Date();
        var dateKey = 'customWeather_' + now.getFullYear() + '_' + (now.getMonth()+1) + '_' + now.getDate();
        localStorage.setItem(dateKey, val);
    }
    input.addEventListener('blur', saveWeather);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); saveWeather(); }
        if (e.key === 'Escape') { el.style.display = ''; input.remove(); }
    });
};

/* ---------- 输入框聚焦时滚到底 ---------- */
document.addEventListener('focusin', function(e) {
    if (e.target && (e.target.classList.contains('message-input') || e.target.tagName === 'TEXTAREA')) {
        setTimeout(function() {
            var chat = document.querySelector('.chat-container');
            if (chat) chat.scrollTop = chat.scrollHeight;
        }, 100);
    }
});

/* ---------- 消息搜索 ---------- */
window._runMsgSearch = function() {
    var input = document.getElementById('msg-search-input');
    var dateFrom = document.getElementById('msg-search-date-from');
    var dateTo = document.getElementById('msg-search-date-to');
    var resultsEl = document.getElementById('msg-search-results');
    if (!input || !resultsEl) return;

    var q = input.value.trim().toLowerCase();
    var from = dateFrom && dateFrom.value ? new Date(dateFrom.value) : null;
    var to = dateTo && dateTo.value ? new Date(dateTo.value + 'T23:59:59') : null;

    var allMessages = (typeof messages !== 'undefined' ? messages : [])
        .filter(function(m) { return m.type !== 'system'; });

    var filtered = allMessages.filter(function(m) {
        var matchText = !q || (m.text && m.text.toLowerCase().includes(q)) || (m.image && !q);
        if (q && m.image && !m.text) matchText = false;
        if (q) matchText = m.text && m.text.toLowerCase().includes(q);
        var ts = m.timestamp ? new Date(m.timestamp) : null;
        var matchFrom = !from || (ts && ts >= from);
        var matchTo = !to || (ts && ts <= to);
        return matchText && matchFrom && matchTo;
    });

    if (!q && !from && !to) {
        resultsEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;">输入关键词或选择日期开始搜索</div>';
        return;
    }

    if (filtered.length === 0) {
        resultsEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;">未找到相关消息</div>';
        return;
    }

    var myAvatarEl = document.querySelector('#my-avatar img');
    var partnerAvatarEl = document.querySelector('#partner-avatar img');
    var myAvatar = myAvatarEl ? myAvatarEl.src : '';
    var partnerAvatar = partnerAvatarEl ? partnerAvatarEl.src : '';
    var myName = (typeof settings !== 'undefined' && settings.myName) || '我';
    var partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '对方';

    function highlight(text) {
        if (!q || !text) return (text || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var safe = text.replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return safe.replace(new RegExp('(' + safeQ + ')', 'gi'), '<mark style="background:rgba(var(--accent-color-rgb,180,140,100),0.3);border-radius:2px;padding:0 1px;">$1</mark>');
    }

    resultsEl.innerHTML = filtered.map(function(msg) {
        var isUser = msg.sender === 'user';
        var name = isUser ? myName : partnerName;
        var avatar = isUser ? myAvatar : partnerAvatar;

        var ts = msg.timestamp ? new Date(msg.timestamp).toLocaleString('zh-CN', {
            month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
        }) : '';

        var avatarHtml = avatar
            ? '<img src="' + avatar + '" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;">'
            : '<div style="width:34px;height:34px;border-radius:50%;background:rgba(var(--accent-color-rgb,180,140,100),0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-user" style="font-size:14px;color:var(--accent-color);"></i></div>';

        var contentHtml = '';
        if (msg.text) contentHtml += '<div style="font-size:13px;color:var(--text-primary);line-height:1.5;word-break:break-word;margin-top:3px;">' + highlight(msg.text) + '</div>';
        if (msg.image) contentHtml += '<img src="' + msg.image + '" style="max-width:120px;max-height:90px;border-radius:8px;display:block;margin-top:5px;cursor:pointer;" onclick="if(typeof viewImage===\'function\')viewImage(\'' + msg.image.replace(/'/g,"\\'") + '\')" loading="lazy">';

        return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:12px;background:var(--primary-bg);border:1px solid var(--border-color);margin-bottom:8px;cursor:pointer;" onclick="if(typeof scrollToMessage===\'function\')scrollToMessage(' + msg.id + ')">'
            + avatarHtml
            + '<div style="flex:1;min-width:0;">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">'
            + '<span style="font-size:12px;font-weight:600;color:var(--accent-color);">' + name + '</span>'
            + '<span style="font-size:11px;color:var(--text-secondary);white-space:nowrap;">' + ts + '</span>'
            + '</div>'
            + contentHtml
            + '</div></div>';
    }).join('');

    resultsEl.insertAdjacentHTML('afterbegin',
        '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;padding:0 2px;">共找到 ' + filtered.length + ' 条结果</div>'
    );
};

window.scrollToMessage = function(msgId) {
    var el = document.querySelector('[data-id="' + msgId + '"]');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background 0.3s';
        el.style.background = 'rgba(var(--accent-color-rgb,180,140,100),0.18)';
        setTimeout(function() { el.style.background = ''; }, 1500);
    }
};


/* ============================================================
 * 消息撤回 & 对方消息编辑
 * ------------------------------------------------------------
 * · 自己发的消息：2 分钟内可通过消息菜单「撤回」
 * · 对方发的消息：5% 概率在 5~10 秒后自动撤回
 * · 撤回后替换为灰色胶囊提示条；≤ 1 分钟时带「重新编辑」
 * · 数据侧同步从 messages[] 删除并 throttledSaveData()
 * · 对方消息菜单新增「编辑」按钮，复用 editMessage(id)
 * 对外接口：window.RecallFeature.onRecall(info) 可覆盖
 * ============================================================ */
(function () {
    'use strict';

    /* ---------- 可调参数 ---------- */
    const CFG = {
        RECALL_WINDOW_MS:  2 * 60 * 1000,   // 2 分钟可撤回
        REEDIT_WINDOW_MS:  60 * 1000,       // 1 分钟内显示「重新编辑」
        PARTNER_CHANCE:    0.05,            // 对方撤回概率 5%
        PARTNER_DELAY_MIN: 5000,            // 对方撤回延迟下限
        PARTNER_DELAY_MAX: 10000            // 对方撤回延迟上限
    };

    /* ---------- 样式 ---------- */
        function injectStyle() {
            if (document.getElementById('recall-style')) return;
            const s = document.createElement('style');
            s.id = 'recall-style';
            s.textContent = `
                /* ---- 撤回提示条 ---- */
                .recall-tip {
                    width: 100%;
                    box-sizing: border-box;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 6px 12px;
                    margin: 4px 0;
                }
                .recall-tip-inner {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 5px 16px;
                    border: 1px solid var(--border-color, rgba(0,0,0,0.12));
                    border-radius: 20px;
                    font-size: 12.5px;
                    color: var(--text-secondary, #999);
                    background: transparent;
                    font-family: var(--font-family, inherit);
                    line-height: 1.4;
                    animation: recallFadeIn .28s ease;
                }
                @keyframes recallFadeIn {
                    from { opacity: 0; transform: scale(.96); }
                    to   { opacity: 1; transform: scale(1); }
                }
                .recall-tip-reedit {
                    color: var(--accent-color, #4a7bd9);
                    cursor: pointer;
                    font-weight: 500;
                    margin-left: 2px;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                }
                .recall-tip-reedit:active { opacity: .55; }

                /* ---- Toast ---- */
                .recall-toast {
                    position: fixed;
                    left: 50%;
                    bottom: 100px;
                    transform: translateX(-50%) translateY(10px);
                    background: rgba(0,0,0,.78);
                    color: #fff;
                    padding: 9px 18px;
                    border-radius: 20px;
                    font-size: 13px;
                    z-index: 10000;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity .22s ease, transform .22s ease;
                    white-space: nowrap;
                    font-family: var(--font-family, inherit);
                }
                .recall-toast.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }

                /* ---- 消息菜单：不裁切 + 紧凑布局，能塞下 5 个按钮 ---- */
                .message-meta-actions,
                .message-content-wrapper,
                .message-wrapper {
                    overflow: visible !important;
                }
                .message-meta-actions {
                    flex-wrap: nowrap !important;
                    white-space: nowrap;
                    max-width: none !important;
                    gap: 0 !important;                   /* 按钮之间不留缝 */
                }
                .message-meta-actions .meta-action-btn {
                    padding: 5px 6px !important;         /* 原 padding 太大，缩一缩 */
                    min-width: 0 !important;
                    flex-shrink: 0 !important;           /* 不允许被压缩 */
                    margin: 0 !important;
                }
                .message-meta-actions .meta-action-btn i {
                    font-size: 13.5px !important;        /* 图标略缩 */
                }
                /* 撤回按钮：继承默认灰色，不再用强调色 */
            /* ---- 自己的消息菜单：整体向左微调 ---- */
            .message-wrapper.sent .message-meta-actions {
                transform: translateX(-8px);
            }
            `;
            document.head.appendChild(s);
        }

    /* ---------- Toast ---------- */
    let toastTimer = null;
    function showToast(msg) {
        let el = document.getElementById('recall-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'recall-toast';
            el.className = 'recall-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
    }

    /* ---------- 工具 ---------- */
    function getSentAt(idStr) {
        const n = Number(idStr);
        if (!isFinite(n) || n <= 0) return Date.now();
        return n < 1000000000000 ? n * 1000 : n;   // 兼容秒级时间戳
    }

    function findMessage(idStr) {
        if (typeof messages === 'undefined' || !Array.isArray(messages)) return null;
        return messages.find(m => String(m.id) === String(idStr)) || null;
    }

    function removeMessage(idStr) {
        if (typeof messages === 'undefined' || !Array.isArray(messages)) return;
        const idx = messages.findIndex(m => String(m.id) === String(idStr));
        if (idx < 0) return;
        messages.splice(idx, 1);
        if (typeof throttledSaveData === 'function') {
            try { throttledSaveData(); } catch (e) { console.warn('[Recall] save fail', e); }
        }
    }

    function getPartnerName() {
        if (typeof settings !== 'undefined' && settings.partnerName) return settings.partnerName;
        const el = document.getElementById('partner-name');
        return (el && el.textContent.trim()) || '对方';
    }

    /* ---------- 构建撤回提示条 ---------- */
    function buildTip(who, reeditText) {
        const tip   = document.createElement('div');
        tip.className = 'recall-tip';

        const inner = document.createElement('div');
        inner.className = 'recall-tip-inner';

        const label = document.createElement('span');
        label.textContent = who + '撤回了一条消息';
        inner.appendChild(label);

        if (reeditText) {
            const btn = document.createElement('span');
            btn.className = 'recall-tip-reedit';
            btn.textContent = '重新编辑';
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const input = document.getElementById('message-input');
                if (!input) return;
                input.value = reeditText;
                input.focus();
                try { input.setSelectionRange(reeditText.length, reeditText.length); } catch (err) {}
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            inner.appendChild(btn);
        }

        tip.appendChild(inner);
        return tip;
    }

    /* ---------- 执行撤回 ---------- */
    function doRecall(wrapper, idStr, isMine) {
        const sentAt = getSentAt(idStr);
        const msg    = findMessage(idStr);
        const text   = msg && msg.text ? msg.text : '';

        // 「重新编辑」条件：自己发的 且 ≤ 1 分钟 且 有文本 且 不是图片消息
        const canReedit = isMine
            && (Date.now() - sentAt <= CFG.REEDIT_WINDOW_MS)
            && !!text
            && !(msg && msg.image);

        // 同步删除数据
        removeMessage(idStr);

        // DOM 替换
        const who = isMine ? '你' : getPartnerName();
        const tip = buildTip(who, canReedit ? text : '');
        if (wrapper.isConnected) wrapper.replaceWith(tip);

        // 对外回调
        const hook = window.RecallFeature && window.RecallFeature.onRecall;
        if (typeof hook === 'function') {
            try { hook({ id: idStr, mine: !!isMine }); } catch (e) {}
        }
    }

    /* ---------- 给自己的消息注入「撤回」按钮 ---------- */
    function injectRecallBtn(menu, wrapper, idStr) {
        if (menu.querySelector('.recall-btn')) return;

        const sentAt = getSentAt(idStr);
        if (Date.now() - sentAt > CFG.RECALL_WINDOW_MS) return;    // 已超时，不插入

        const editBtn = menu.querySelector('.edit-btn');
        if (!editBtn) return;   // 只有自己的消息才有 edit-btn

        const btn = document.createElement('button');
        btn.className = 'meta-action-btn recall-btn';
        btn.title = '撤回';
        btn.innerHTML = '<i class="fas fa-undo-alt"></i>';
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();

            if (Date.now() - getSentAt(idStr) > CFG.RECALL_WINDOW_MS) {
                showToast('超过 2 分钟的消息无法撤回');
                return;
            }
            doRecall(wrapper, idStr, true);
        });

        editBtn.parentNode.insertBefore(btn, editBtn);
    }

    /* ---------- 给对方的「第一条消息」注入编辑按钮 ---------- */
    function injectEditBtnForPartner(menu, idStr) {
        if (menu.querySelector('.edit-btn')) return;   // 已有编辑按钮就不重复

        const favoriteBtn = menu.querySelector('.favorite-action-btn');
        const btn = document.createElement('button');
        btn.className = 'meta-action-btn edit-btn';
        btn.title = '编辑消息';
        btn.innerHTML = '<i class="fas fa-pen"></i>';
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            if (typeof editMessage === 'function') {
                editMessage(idStr);
            } else {
                showToast('编辑功能未就绪');
            }
        });

        // 插到收藏按钮后面（和「我的消息」编辑按钮位置一致）
        if (favoriteBtn && favoriteBtn.nextSibling) {
            favoriteBtn.parentNode.insertBefore(btn, favoriteBtn.nextSibling);
        } else {
            menu.appendChild(btn);
        }
    }

    /* ---------- 对方 5% 概率撤回 ---------- */
    function schedulePartnerRecall(wrapper, idStr) {
        const msg = findMessage(idStr);
        if (msg && msg.type === 'system') return;   // 系统消息不参与撤回

        if (Math.random() >= CFG.PARTNER_CHANCE) return;

        const delay = CFG.PARTNER_DELAY_MIN +
                      Math.random() * (CFG.PARTNER_DELAY_MAX - CFG.PARTNER_DELAY_MIN);

        setTimeout(function () {
            if (!wrapper.isConnected) return;
            if (!findMessage(idStr)) return;   // 已被撤回或已删除
            doRecall(wrapper, idStr, false);
        }, delay);
    }

    /* ---------- 处理单条消息 ---------- */
    const seen = new WeakSet();

    function processWrapper(wrapper) {
        if (!wrapper || seen.has(wrapper)) return;
        seen.add(wrapper);

        const idStr = wrapper.dataset.id || wrapper.dataset.msgId;
        if (!idStr) return;

        // 【关键】只用 class 判断归属，别用 .edit-btn 兜底，
        // 否则给对方注入编辑按钮后自己会被误判
        const isMine = wrapper.classList.contains('sent');
        const menu = wrapper.querySelector('.message-meta-actions');

        if (isMine) {
            if (menu) injectRecallBtn(menu, wrapper, idStr);
        } else {
            if (menu) injectEditBtnForPartner(menu, idStr);
            schedulePartnerRecall(wrapper, idStr);
        }
    }

    /* ---------- 初始化 ---------- */
    function init() {
        injectStyle();

        // 已存在的消息
        document.querySelectorAll('.message-wrapper').forEach(processWrapper);

        // 监听新消息
        const chat = document.getElementById('chat-container');
        if (!chat) { setTimeout(init, 500); return; }

        const observer = new MutationObserver(function (mutations) {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.classList && node.classList.contains('message-wrapper')) {
                        processWrapper(node);
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll('.message-wrapper').forEach(processWrapper);
                    }
                }
            }
        });
        observer.observe(chat, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
    } else {
        setTimeout(init, 100);
    }

    /* ---------- 对外接口 ---------- */
    window.RecallFeature = {
        onRecall: null,   // 宿主可覆盖：window.RecallFeature.onRecall = info => {...}
        recall: function (idStr) {
            const wrapper = document.querySelector('.message-wrapper[data-id="' + idStr + '"]');
            if (wrapper) doRecall(wrapper, idStr, wrapper.classList.contains('sent'));
        }
    };
})();