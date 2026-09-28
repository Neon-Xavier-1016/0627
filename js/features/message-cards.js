// ═══════════════════════════════════════════════════════
// 留言卡 (Message Cards)
// 单层留言板：正文 + 一条回复
// ═══════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── 常量 ────────────────────────────────────────
    const MAX_NORMAL = 50;          // 非收藏上限
    const MAX_FAVORITE = 10;        // 收藏上限
    const DAILY_MIN = 0;            // 每日他写的卡最少
    const DAILY_MAX = 3;            // 每日他写的卡最多
    const HOUR_START = 8;           // 发送时段起
    const HOUR_END = 23;            // 发送时段止
    const CATCH_UP_MS = 24 * 3600 * 1000; // 补发窗口

    const SHORT_DELAY_MIN = 2 * 60 * 1000;
    const SHORT_DELAY_MAX = 45 * 60 * 1000;
    const LONG_DELAY_MIN = 1 * 3600 * 1000;
    const LONG_DELAY_MAX = 6 * 3600 * 1000;
    const LONG_DELAY_PROB = 0.15;

    const REPLY_COUNT_MIN = 1, REPLY_COUNT_MAX = 3;   // 他的回复抽几张字卡
    const CARD_COUNT_MIN = 2, CARD_COUNT_MAX = 4;     // 他写的卡抽几张字卡

    let _refreshTimer = null;

    // ─── 数据访问 ────────────────────────────────────
    function _s() {
        if (typeof settings !== 'undefined') return settings;
        if (window.settings) return window.settings;
        return (window.settings = {});
    }
    function getCards() {
        const s = _s();
        if (!Array.isArray(s.messageCards)) s.messageCards = [];
        return s.messageCards;
    }
    function getPlan() {
        const s = _s();
        return s.messageCardsPlan || null;
    }
    function setPlan(p) { _s().messageCardsPlan = p; }
    function save() { if (typeof throttledSaveData === 'function') throttledSaveData(); }

    // ─── 字卡池 ──────────────────────────────────────
    function getPool() {
        const pool = [];
        if (typeof customReplies !== 'undefined' && Array.isArray(customReplies)) {
            customReplies.forEach(x => { if (x && typeof x === 'string') pool.push(x); });
        }
        if (window.dreamFreeReplies && Array.isArray(window.dreamFreeReplies)) {
            window.dreamFreeReplies.forEach(x => { if (x && typeof x === 'string') pool.push(x); });
        }
        if (typeof customEmojis !== 'undefined' && Array.isArray(customEmojis)) {
            customEmojis.forEach(x => { if (x && typeof x === 'string') pool.push(x); });
        }
        if (typeof CONSTANTS !== 'undefined' && CONSTANTS.REPLY_EMOJIS) {
            CONSTANTS.REPLY_EMOJIS.forEach(x => { if (x && typeof x === 'string') pool.push(x); });
        }
        return pool.filter(x => x.trim());
    }
    function pickCards(n) {
        const pool = getPool();
        if (!pool.length) return [];
        const out = [];
        for (let i = 0; i < n; i++) out.push(pool[Math.floor(Math.random() * pool.length)]);
        return out;
    }
    function randInt(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }
    function generatePartnerText(minC, maxC) {
        const n = randInt(minC, maxC);
        const parts = pickCards(n);
        return parts.join('\n');
    }

    // ─── 每日计划 ────────────────────────────────────
    function todayKey() {
        const d = new Date();
        return d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2, '0') + '-' +
               String(d.getDate()).padStart(2, '0');
    }

    function ensureDailyPlan() {
        const key = todayKey();
        const plan = getPlan();
        if (plan && plan.date === key) return;

        const count = randInt(DAILY_MIN, DAILY_MAX);
        const items = [];
        for (let i = 0; i < count; i++) {
            const h = randInt(HOUR_START, HOUR_END - 1);
            const m = randInt(0, 59);
            const ts = new Date();
            ts.setHours(h, m, 0, 0);
            items.push({ timestamp: ts.getTime(), generated: false });
        }
        items.sort((a, b) => a.timestamp - b.timestamp);
        setPlan({ date: key, items });
        save();
    }

    function processScheduledCards() {
        const plan = getPlan();
        if (!plan || !plan.items) return false;
        const now = Date.now();
        let changed = false;
        plan.items.forEach(item => {
            if (item.generated) return;
            if (item.timestamp > now) return;
            // 超过补发窗口 → 直接丢弃
            if (now - item.timestamp > CATCH_UP_MS) {
                item.generated = true;
                changed = true;
                return;
            }
            _createPartnerCard(item.timestamp);
            item.generated = true;
            changed = true;
        });
        if (changed) save();
        return changed;
    }

    // ─── 卡片生成 ────────────────────────────────────
    function genId() {
        return 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    }

    function _createPartnerCard(timestamp) {
        const text = generatePartnerText(CARD_COUNT_MIN, CARD_COUNT_MAX);
        if (!text) return null;
        const card = {
            id: genId(),
            author: 'partner',
            text,
            createdAt: timestamp,
            editedAt: null,
            reply: null,
            favorited: false,
            read: false
        };
        const list = getCards();
        // 按时间插到正确位置（通常是末尾/按倒序插入）
        list.push(card);
        list.sort((a, b) => b.createdAt - a.createdAt);
        _enforceLimit();
        return card;
    }

    function createMyCard(text) {
        if (!text || !text.trim()) return null;
        const replyText = generatePartnerText(REPLY_COUNT_MIN, REPLY_COUNT_MAX);
        const delay = Math.random() < LONG_DELAY_PROB
            ? randInt(LONG_DELAY_MIN, LONG_DELAY_MAX)
            : randInt(SHORT_DELAY_MIN, SHORT_DELAY_MAX);

        const card = {
            id: genId(),
            author: 'me',
            text: text.trim(),
            createdAt: Date.now(),
            editedAt: null,
            reply: {
                text: replyText,
                createdAt: Date.now() + delay,
                editedAt: null
            },
            favorited: false,
            read: true
        };
        const list = getCards();
        list.unshift(card);
        _enforceLimit();
        save();
        return card;
    }

    function _enforceLimit() {
        const list = getCards();
        const normals = list.filter(c => !c.favorited);
        if (normals.length <= MAX_NORMAL) return;
        // 删除最旧的非收藏
        const toRemove = normals
            .slice()
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(0, normals.length - MAX_NORMAL);
        const ids = new Set(toRemove.map(c => c.id));
        _s().messageCards = list.filter(c => !ids.has(c.id));
    }

    // ─── 工具 ────────────────────────────────────────
    function formatTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const sameYear = d.getFullYear() === now.getFullYear();
        const M = d.getMonth() + 1, D = d.getDate();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return sameYear ? `${M}月${D}日 ${hh}:${mm}` : `${d.getFullYear()}/${M}/${D} ${hh}:${mm}`;
    }

    function isReplyVisible(card) {
        return card.reply && card.reply.createdAt <= Date.now();
    }

    function isUnread(card) {
        return card.author === 'partner' && !card.read && !card.reply;
    }

    // ─── 渲染 ────────────────────────────────────────
    let _currentFilter = 'all'; // 'all' | 'fav'

    function render() {
        const body = document.getElementById('mc-body');
        if (!body) return;
        const cards = getCards().slice();
        cards.sort((a, b) => b.createdAt - a.createdAt);

        let filtered = _currentFilter === 'fav'
            ? cards.filter(c => c.favorited)
            : cards;

        if (!filtered.length) {
            body.innerHTML = `
                <div class="mc-empty">
                    <div style="font-size:40px;opacity:0.3;margin-bottom:14px;">
                        <i class="fas fa-sticky-note"></i>
                    </div>
                    <div style="font-weight:600;margin-bottom:6px;">${_currentFilter === 'fav' ? '还没有收藏的卡片' : '还没有留言'}</div>
                    <div style="font-size:12px;opacity:0.7;">${_currentFilter === 'fav' ? '点亮一张卡片的小星星试试' : '点击右下角，写下第一句吧'}</div>
                </div>
            `;
            return;
        }

        body.innerHTML = filtered.map(card => _renderCard(card)).join('');

        // 绑定事件
        body.querySelectorAll('[data-mc-id]').forEach(node => {
            const id = node.dataset.mcId;
            node.querySelectorAll('[data-act]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const act = btn.dataset.act;
                    const card = getCards().find(c => c.id === id);
                    if (!card) return;
                    if (act === 'fav') _toggleFav(card);
                    else if (act === 'edit-card') _editCardText(card);
                    else if (act === 'edit-reply') _editReplyText(card);
                    else if (act === 'delete') _deleteCard(card);
                    else if (act === 'reply') _replyToPartnerCard(card);
                });
            });
            // 未读卡片点击=标记已读（可选：自动滚到底部编辑器）
            if (node.classList.contains('mc-unread')) {
                node.addEventListener('click', () => {
                    const card = getCards().find(c => c.id === id);
                    if (card && isUnread(card)) {
                        // 点击未读卡不直接标记已读，而是引导回复
                    }
                });
            }
        });
    }

    function _renderCard(card) {
        const isMine = card.author === 'me';
        const authorLabel = isMine
            ? (typeof settings !== 'undefined' && settings.myName || '我')
            : (typeof settings !== 'undefined' && settings.partnerName || '梦角');
        const unread = isUnread(card);
        const replyVisible = isReplyVisible(card);

        const favBtn = `
            <button class="mc-action-btn ${card.favorited ? 'favorited' : ''}" data-act="fav" title="${card.favorited ? '取消收藏' : '收藏'}">
                <i class="fa${card.favorited ? 's' : 'r'} fa-star"></i>
            </button>`;

        const editCardBtn = `
            <button class="mc-action-btn" data-act="edit-card" title="编辑正文">
                <i class="fas fa-pen"></i>
            </button>`;

        const deleteBtn = `
            <button class="mc-action-btn" data-act="delete" title="删除">
                <i class="fas fa-trash-alt"></i>
            </button>`;

        const replyBlock = (() => {
            if (isMine) {
                if (!replyVisible) return '';
                return `
                    <div class="mc-reply">
                        <div class="mc-reply-header">
                            <span class="mc-reply-author">${escapeHtml(settings.partnerName || '梦角')}</span>
                            <span class="mc-reply-time">${formatTime(card.reply.createdAt)}</span>
                            <button class="mc-action-btn" data-act="edit-reply" title="编辑回复" style="margin-left:auto;width:22px;height:22px;font-size:11px;">
                                <i class="fas fa-pen"></i>
                            </button>
                        </div>
                        <div class="mc-reply-text">${escapeHtml(card.reply.text)}</div>
                    </div>`;
            } else {
                if (card.reply) {
                    // 我已经回复了
                    return `
                        <div class="mc-reply mc-reply-mine">
                            <div class="mc-reply-header">
                                <span class="mc-reply-author mc-reply-author-me">${escapeHtml(settings.myName || '我')}</span>
                                <span class="mc-reply-time">${formatTime(card.reply.createdAt)}</span>
                                <button class="mc-action-btn" data-act="edit-reply" title="编辑回复" style="margin-left:auto;width:22px;height:22px;font-size:11px;">
                                    <i class="fas fa-pen"></i>
                                </button>
                            </div>
                            <div class="mc-reply-text">${escapeHtml(card.reply.text)}</div>
                        </div>`;
                } else {
                    return `
                        <div class="mc-reply mc-reply-empty" data-act="reply" style="cursor:pointer;">
                            <div class="mc-reply-text" style="opacity:0.6;font-style:italic;">点击回复…</div>
                        </div>`;
                }
            }
        })();

        return `
            <div class="mc-card ${unread ? 'mc-unread' : ''}" data-mc-id="${card.id}">
                <div class="mc-card-header">
                    ${unread ? '<span class="mc-dot"></span>' : ''}
                    <span class="mc-author-badge ${isMine ? 'me' : 'partner'}">${escapeHtml(authorLabel)}</span>
                    <span class="mc-time">${formatTime(card.createdAt)}</span>
                    <div class="mc-actions">
                        ${favBtn}
                        ${editCardBtn}
                        ${deleteBtn}
                    </div>
                </div>
                <div class="mc-text">${escapeHtml(card.text)}</div>
                ${replyBlock}
            </div>
        `;
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ─── 操作 ────────────────────────────────────────
    function _toggleFav(card) {
        if (!card.favorited) {
            const favCount = getCards().filter(c => c.favorited).length;
            if (favCount >= MAX_FAVORITE) {
                if (typeof showNotification === 'function')
                    showNotification('收藏满了，先取消一张', 'warning');
                return;
            }
            card.favorited = true;
        } else {
            card.favorited = false;
        }
        save();
        render();
    }

    function _deleteCard(card) {
        if (!confirm('确定删除这张留言吗？')) return;
        const list = getCards();
        const idx = list.findIndex(c => c.id === card.id);
        if (idx >= 0) list.splice(idx, 1);
        save();
        render();
        if (typeof showNotification === 'function') showNotification('已删除', 'success');
    }

    function _editCardText(card) {
        _showEditModal({
            title: card.author === 'me' ? '编辑我的留言' : '编辑他的留言',
            value: card.text,
            multiline: true,
            onSave: (v) => {
                card.text = v;
                card.editedAt = Date.now();
                save();
                render();
            }
        });
    }

    function _editReplyText(card) {
        if (!card.reply) return;
        _showEditModal({
            title: card.author === 'me' ? '编辑他的回复' : '编辑我的回复',
            value: card.reply.text,
            multiline: true,
            onSave: (v) => {
                card.reply.text = v;
                card.reply.editedAt = Date.now();
                // 若因为延迟还没展示，编辑后立即展示
                if (card.reply.createdAt > Date.now()) {
                    card.reply.createdAt = Date.now();
                }
                save();
                render();
            }
        });
    }

    function _replyToPartnerCard(card) {
        _showEditModal({
            title: '回复他的留言',
            value: '',
            multiline: true,
            placeholder: '说点什么…',
            onSave: (v) => {
                if (!v.trim()) return;
                card.reply = {
                    text: v.trim(),
                    createdAt: Date.now(),
                    editedAt: null
                };
                card.read = true; // 回复即已读
                save();
                render();
            }
        });
    }

    // ─── 弹窗 ────────────────────────────────────────
    function _showEditModal({ title, value, multiline, placeholder, onSave }) {
        const overlay = document.createElement('div');
        overlay.className = 'mc-editor-overlay';
        overlay.innerHTML = `
            <div class="mc-editor-content">
                <div class="mc-editor-title">${escapeHtml(title)}</div>
                ${multiline
                    ? `<textarea class="mc-editor-input" placeholder="${escapeHtml(placeholder || '')}">${escapeHtml(value || '')}</textarea>`
                    : `<input class="mc-editor-input" type="text" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder || '')}">`}
                <div class="mc-editor-btns">
                    <button class="modal-btn modal-btn-secondary" data-act="cancel">取消</button>
                    <button class="modal-btn modal-btn-primary" data-act="save">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('.mc-editor-input');
        const close = () => overlay.remove();
        const confirm = () => {
            const v = input.value;
            close();
            if (v != null && v.trim()) onSave(v);
        };

        overlay.querySelector('[data-act="cancel"]').onclick = close;
        overlay.querySelector('[data-act="save"]').onclick = confirm;
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        setTimeout(() => input.focus(), 60);
        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && !multiline && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                e.preventDefault(); confirm();
            }
        });
    }

    // ─── 主界面 ──────────────────────────────────────
    function open() {
        ensureDailyPlan();
        processScheduledCards();
        _ensureModal();
        document.getElementById('mc-modal').style.display = 'flex';
        render();
        _startRefresh();
    }

    function close() {
        const m = document.getElementById('mc-modal');
        if (m) m.style.display = 'none';
        _stopRefresh();
    }

    function _startRefresh() {
        _stopRefresh();
        _refreshTimer = setInterval(() => {
            const changed = processScheduledCards();
            const cards = getCards();
            const hasPendingReply = cards.some(c => c.reply && c.reply.createdAt > Date.now() && c.reply.createdAt - Date.now() < 60000);
            if (changed || hasPendingReply) render();
        }, 20000);
    }

    function _stopRefresh() {
        if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
    }

    function _ensureModal() {
        if (document.getElementById('mc-modal')) return;
        const div = document.createElement('div');
        div.id = 'mc-modal';
        div.className = 'mc-modal';
        div.style.display = 'none';
        div.innerHTML = `
            <div class="mc-nav">
                <button class="mc-nav-btn" id="mc-close-btn" title="关闭">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="mc-nav-title">留言墙</div>
                <div style="width:32px;"></div>
            </div>
            <div class="mc-filter-bar">
                <button class="mc-filter-btn active" data-filter="all">全部</button>
                <button class="mc-filter-btn" data-filter="fav"><i class="fas fa-star" style="font-size:10px;margin-right:4px;"></i>只看收藏</button>
            </div>
            <div class="mc-body" id="mc-body"></div>
            <button class="mc-write-btn" id="mc-write-btn" title="写一张">
                <i class="fas fa-pen"></i>
            </button>
        `;
        document.body.appendChild(div);

        div.querySelector('#mc-close-btn').onclick = close;
        div.querySelectorAll('.mc-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _currentFilter = btn.dataset.filter;
                div.querySelectorAll('.mc-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
                render();
            });
        });
        div.querySelector('#mc-write-btn').onclick = _openWriteModal;
    }

    function _openWriteModal() {
        const overlay = document.createElement('div');
        overlay.className = 'mc-editor-overlay';
        overlay.innerHTML = `
            <div class="mc-editor-content">
                <div class="mc-editor-title">写一张留言</div>
                <textarea class="mc-editor-input" placeholder="随便写点什么…" style="min-height:120px;"></textarea>
                <div class="mc-editor-btns">
                    <button class="modal-btn modal-btn-secondary" data-act="cancel">取消</button>
                    <button class="modal-btn modal-btn-primary" data-act="save">贴上</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const ta = overlay.querySelector('.mc-editor-input');
        setTimeout(() => ta.focus(), 60);
        const closeOv = () => overlay.remove();
        overlay.querySelector('[data-act="cancel"]').onclick = closeOv;
        overlay.addEventListener('click', e => { if (e.target === overlay) closeOv(); });
        overlay.querySelector('[data-act="save"]').onclick = () => {
            const v = ta.value.trim();
            if (!v) { closeOv(); return; }
            closeOv();
            createMyCard(v);
            render();
            if (typeof showNotification === 'function') {
                showNotification('已贴上 ✦', 'success');
            }
        };
    }

    // ─── CSS 注入 ────────────────────────────────────
    function _injectStyles() {
        if (document.getElementById('mc-styles')) return;
        const s = document.createElement('style');
        s.id = 'mc-styles';
        s.textContent = `
            .mc-modal {
                position: fixed; inset: 0;
                background: var(--primary-bg);
                z-index: 5000;
                display: flex; flex-direction: column;
            }
            .mc-nav {
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 14px;
                border-bottom: 1px solid var(--border-color);
                background: var(--secondary-bg);
                flex-shrink: 0;
                padding-top: max(12px, env(safe-area-inset-top, 12px));
            }
            .mc-nav-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
            .mc-nav-btn {
                width: 36px; height: 36px; border-radius: 10px; border: none;
                background: transparent; color: var(--text-primary);
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                font-size: 16px;
            }
            .mc-nav-btn:active { background: var(--border-color); }

            .mc-filter-bar {
                display: flex; gap: 8px; padding: 10px 16px;
                background: var(--secondary-bg);
                border-bottom: 1px solid var(--border-color);
                flex-shrink: 0;
            }
            .mc-filter-btn {
                padding: 6px 14px; border-radius: 16px; font-size: 12px;
                border: 1.5px solid var(--border-color); background: transparent;
                color: var(--text-secondary); cursor: pointer;
                font-family: var(--font-family);
                transition: all 0.15s;
                display: inline-flex; align-items: center;
            }
            .mc-filter-btn.active {
                background: var(--accent-color);
                color: #fff;
                border-color: var(--accent-color);
            }

            .mc-body {
                flex: 1; overflow-y: auto;
                padding: 14px 16px 90px;
                -webkit-overflow-scrolling: touch;
            }

            .mc-card {
                background: var(--secondary-bg);
                border: 1px solid var(--border-color);
                border-radius: 14px;
                padding: 12px 14px;
                margin-bottom: 10px;
                position: relative;
                transition: border-color 0.2s;
            }
            .mc-card.mc-unread {
                border-color: rgba(var(--accent-color-rgb), 0.45);
                box-shadow: 0 0 0 1px rgba(var(--accent-color-rgb), 0.12);
            }

            .mc-card-header {
                display: flex; align-items: center; gap: 8px;
                margin-bottom: 8px;
            }
            .mc-author-badge {
                font-size: 11px; padding: 2px 9px; border-radius: 10px;
                font-weight: 600;
                flex-shrink: 0;
            }
            .mc-author-badge.me {
                background: rgba(var(--accent-color-rgb), 0.14);
                color: var(--accent-color);
            }
            .mc-author-badge.partner {
                background: rgba(128, 128, 128, 0.14);
                color: var(--text-secondary);
            }
            .mc-time {
                font-size: 11px; color: var(--text-secondary);
                opacity: 0.75;
            }
            .mc-actions {
                display: flex; gap: 2px; margin-left: auto;
            }
            .mc-action-btn {
                width: 26px; height: 26px; border: none; border-radius: 8px;
                background: transparent; color: var(--text-secondary);
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                font-size: 12px;
                transition: all 0.15s;
            }
            .mc-action-btn:active { background: var(--border-color); }
            .mc-action-btn.favorited { color: #FFB800; }
            .mc-dot {
                width: 7px; height: 7px; border-radius: 50%;
                background: #ff4757; flex-shrink: 0;
                box-shadow: 0 0 0 3px rgba(255, 71, 87, 0.18);
            }

            .mc-text {
                font-size: 14px; line-height: 1.65; color: var(--text-primary);
                white-space: pre-wrap; word-break: break-word;
            }

            .mc-reply {
                margin-top: 10px;
                padding: 9px 12px 9px 14px;
                border-radius: 10px;
                background: var(--primary-bg);
                border-left: 3px solid var(--accent-color);
                font-size: 13px;
            }
            .mc-reply.mc-reply-mine {
                border-left-color: var(--text-secondary);
                background: rgba(128,128,128,0.06);
            }
            .mc-reply-header {
                display: flex; align-items: center; gap: 8px;
                margin-bottom: 4px;
            }
            .mc-reply-author {
                font-size: 11px; color: var(--accent-color);
                font-weight: 600;
            }
            .mc-reply-author-me { color: var(--text-secondary); }
            .mc-reply-time {
                font-size: 10px; color: var(--text-secondary);
                opacity: 0.7;
            }
            .mc-reply-text {
                font-size: 13px; line-height: 1.6;
                color: var(--text-primary);
                white-space: pre-wrap; word-break: break-word;
            }

            .mc-empty {
                text-align: center; padding: 60px 20px;
                color: var(--text-secondary);
            }

            .mc-write-btn {
                position: absolute;
                bottom: max(20px, env(safe-area-inset-bottom, 20px));
                right: 20px;
                width: 56px; height: 56px; border-radius: 50%;
                background: var(--accent-color); color: #fff;
                border: none; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                font-size: 20px;
                box-shadow: 0 6px 20px rgba(var(--accent-color-rgb), 0.4);
                transition: transform 0.15s;
                z-index: 10;
            }
            .mc-write-btn:active { transform: scale(0.94); }

            .mc-editor-overlay {
                position: fixed; inset: 0; z-index: 6000;
                background: rgba(0,0,0,0.55);
                backdrop-filter: blur(8px);
                display: flex; align-items: center; justify-content: center;
                animation: mcFadeIn 0.18s ease;
            }
            @keyframes mcFadeIn { from { opacity: 0; } to { opacity: 1; } }
            .mc-editor-content {
                background: var(--secondary-bg);
                border-radius: 18px;
                padding: 20px;
                width: 88%; max-width: 420px;
                box-shadow: 0 24px 80px rgba(0,0,0,0.4);
                animation: mcPop 0.2s cubic-bezier(.34,1.56,.64,1);
            }
            @keyframes mcPop { from { transform: scale(0.93); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .mc-editor-title {
                font-size: 15px; font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 14px;
            }
            .mc-editor-input {
                width: 100%; box-sizing: border-box;
                padding: 12px 14px;
                border: 1.5px solid var(--border-color);
                border-radius: 12px;
                background: var(--primary-bg);
                color: var(--text-primary);
                font-size: 14px;
                font-family: var(--font-family);
                outline: none;
                resize: vertical;
                min-height: 70px;
                line-height: 1.6;
                transition: border-color 0.18s;
            }
            .mc-editor-input:focus { border-color: var(--accent-color); }
            .mc-editor-btns {
                display: flex; gap: 10px;
                margin-top: 16px;
            }
            .mc-editor-btns .modal-btn { flex: 1; }
        `;
        document.head.appendChild(s);
    }

    // ─── 暴露 API ────────────────────────────────────
    window.MessageCards = {
        open: open,
        close: close,
        render: render,
        createMyCard: createMyCard,
        ensureDailyPlan: ensureDailyPlan,
        processScheduledCards: processScheduledCards,
        // 用于备份引擎引用
        _getCards: getCards
    };

    // 页面加载后跑一次：确保今日计划 + 落地已到时间的卡
    function _boot() {
        _injectStyles();
        ensureDailyPlan();
        processScheduledCards();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

})();