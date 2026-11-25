/**
 * features/period.js - 月经记录系统（完整版 + 方框弹窗交互）
 * 功能：记录经期、预测下次日期、关怀提醒、历史管理、每日弹窗
 * 依赖：localforage, showNotification, showModal, hideModal, periodCareMessages, settings
 */

(function() {
    // ==================== 私有状态 ====================
    const INITIAL_CYCLE_LENGTH = 28;
    let records = [];                // 月经记录 { id, startDate, endDate, createdAt }
    let settings = {
        partnerName: '梦角'
    };
    let lastReminderCheckDate = null;
    let reminderReady = false;
    let reminderChecking = false;
    let saving = false;
    let undoRecords = null;

    // DOM 元素缓存
    const elements = {};

    // 存储键名
    const STORAGE_KEYS = {
        records: 'periodRecords',
        settings: 'periodSettings',
        lastReminderCheck: 'lastPeriodReminderCheck',
        suppressDate: 'periodRemindSuppressDate'
    };

    // ==================== 工具函数 ====================
    function getStorageKey(key) {
        return STORAGE_KEYS[key];
    }

    function normalizeDate(value) {
        const dateOnly = typeof value === 'string' && /^(\d{4,})-(\d{2})-(\d{2})$/.exec(value);
        const date = dateOnly
            ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
            : new Date(value);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function formatDate(date) {
        const d = normalizeDate(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function differenceInDays(start, end) {
        const day = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
        return (day(end) - day(start)) / 86400000;
    }

    function calculateDuration(record, end = record.endDate) {
        return differenceInDays(record.startDate, end) + 1;
    }

    function sortedRecords() {
        return [...records].sort((a, b) => b.startDate - a.startDate);
    }

    function averageCycleLength(sorted) {
        const starts = [...new Set(sorted.map(record => +record.startDate))].slice(0, 5);
        if (starts.length < 2) return null;
        return Math.round(differenceInDays(new Date(starts.at(-1)), new Date(starts[0])) / (starts.length - 1));
    }

    function getCurrentCycleStatus() {
        if (!records.length) return { status: 'no_record', average: null };

        const sorted = sortedRecords();
        const active = sorted.find(record => !record.endDate);
        const latest = active || sorted[0];
        const today = normalizeDate(new Date());
        const average = averageCycleLength(sorted);
        if (active) {
            return { status: 'during', daysIntoCycle: Math.max(1, calculateDuration(active, today)), record: active, average };
        }

        const nextDate = new Date(latest.startDate);
        nextDate.setDate(nextDate.getDate() + (average ?? INITIAL_CYCLE_LENGTH));
        const daysUntilNext = differenceInDays(today, nextDate);
        return {
            status: 'after',
            daysSinceEnd: differenceInDays(latest.endDate, today),
            daysUntilNext,
            nextDate,
            isDelayed: daysUntilNext !== null && daysUntilNext < 0,
            record: latest,
            average
        };
    }

    // ==================== 关怀消息（用于卡片内） ====================
    function getRandomCareMessage() {
        const partner = settings.partnerName || '梦角';
        if (records.length === 0) {
            return `${partner}：我会在这里守着你`;
        }

        const careMsgs = window.periodCareMessages || { during: [], approaching: [], delayed: [] };
        const status = getCurrentCycleStatus();

        if (status.status === 'during') {
            const msgs = careMsgs.during;
            if (msgs && msgs.length) {
                const idx = Math.floor(Math.random() * msgs.length);
                return `${partner}：${msgs[idx]}`;
            }
            return `${partner}：这几天要好好休息`;
        }

        if (status.status === 'after') {
            const daysUntil = status.daysUntilNext;
            if (daysUntil !== null && daysUntil <= 3 && daysUntil > 0) {
                const msgs = careMsgs.approaching;
                if (msgs && msgs.length) {
                    const idx = Math.floor(Math.random() * msgs.length);
                    return `${partner}：${msgs[idx]}`;
                }
                return `${partner}：特殊日子快来了，注意休息`;
            } else if (status.isDelayed) {
                const msgs = careMsgs.delayed;
                if (msgs && msgs.length) {
                    const idx = Math.floor(Math.random() * msgs.length);
                    return `${partner}：${msgs[idx]}`;
                }
                return `${partner}：周期有点乱，最近累到了？`;
            }
        }
        return `${partner}：我会在这里守着你`;
    }

    // ==================== 数据持久化 ====================
    async function loadData() {
        try {
            const savedRecords = await localforage.getItem(getStorageKey('records'));
            if (savedRecords && Array.isArray(savedRecords)) {
                records = savedRecords.map(record => ({
                    ...record,
                    id: record.id || (Date.now() + Math.random()),
                    startDate: normalizeDate(record.startDate),
                    endDate: record.endDate ? normalizeDate(record.endDate) : null
                })).filter(record => Number.isFinite(+record.startDate) &&
                    (!record.endDate || Number.isFinite(+record.endDate)));
            }

            const savedSettings = await localforage.getItem(getStorageKey('settings'));
            if (savedSettings) {
                settings = { ...settings, ...savedSettings };
            }

            const savedCheck = await localforage.getItem(getStorageKey('lastReminderCheck'));
            if (savedCheck) {
                lastReminderCheckDate = savedCheck;
            }
        } catch (e) {
            console.error('加载月经数据失败:', e);
        }
    }

    async function commitRecords(next, message, undo = null) {
        if (saving) return false;
        saving = true;
        updateRecordActions();
        try {
            await localforage.setItem(getStorageKey('records'), next.map(record => ({
                ...record,
                startDate: formatDate(record.startDate),
                endDate: record.endDate ? formatDate(record.endDate) : null
            })));
        } catch (error) {
            console.error('保存月经数据失败:', error);
            const feedback = document.getElementById('period-record-feedback-text');
            if (feedback) feedback.textContent = '保存失败，请重试';
            if (typeof showNotification === 'function') showNotification('月经记录保存失败，请重试', 'error');
            return false;
        } finally {
            saving = false;
            updateRecordActions();
        }
        records = next;
        undoRecords = undo;
        closeRecordForm();
        fullRefreshUI();
        document.getElementById('period-record-feedback-text').textContent = message;
        return true;
    }

    // ==================== UI 更新 ====================
    function cacheElements() {
        const ids = [
            'period-current-status', 'period-duration', 'period-cycle-length',
            'period-days-until-next', 'period-history-list', 'period-random-message',
            'period-start-date', 'period-end-date', 'period-modal'
        ];
        ids.forEach(id => {
            elements[id] = document.getElementById(id);
        });
    }

    function updateCurrentStatus(cycle) {
        const value = elements['period-current-status'];
        if (!value) return;
        value.style.color = cycle.status === 'during' ? '#e91e63' : 'var(--text-secondary)';
        if (cycle.status === 'no_record') value.textContent = '未记录';
        else if (cycle.status === 'during') value.textContent = `经期第 ${cycle.daysIntoCycle} 天`;
        else if (cycle.daysUntilNext === 0) value.textContent = '今天是预计日期';
        else if (cycle.isDelayed) value.textContent = `已过预计日期 ${-cycle.daysUntilNext} 天`;
        else value.textContent = `预计下次：${formatDate(cycle.nextDate)}`;
    }

    function updateStatistics(cycle) {
        const average = elements['period-cycle-length'];
        const next = elements['period-days-until-next'];
        const duration = elements['period-duration'];
        if (average) average.textContent = cycle.average === null ? '记录不足' : `${cycle.average} 天`;
        if (next) {
            next.textContent = cycle.status === 'during' ? '经期中' :
                cycle.nextDate ? formatDate(cycle.nextDate) : '记录不足';
            const label = next.parentElement.querySelector('.period-stat-label');
            if (label) label.textContent = cycle.nextDate && cycle.average === null
                ? `预计下次（按 ${INITIAL_CYCLE_LENGTH} 天暂估）`
                : '预计下次';
        }
        if (duration) {
            duration.textContent = cycle.status === 'during' ? `已记录 ${cycle.daysIntoCycle} 天` :
                cycle.record ? `${calculateDuration(cycle.record)} 天` : '—';
        }
    }

    function updateHistoryList() {
        const container = elements['period-history-list'];
        if (!container) return;

        if (records.length === 0) {
            container.innerHTML = `
                <div class="period-empty-state">
                    <i class="fas fa-calendar-plus"></i>
                    <p>暂无记录</p>
                    <span>开始记录你的月经周期吧</span>
                </div>
            `;
            return;
        }

        const sorted = [...records].sort((a, b) => b.startDate - a.startDate);
        let html = '';
        sorted.forEach(record => {
            const startStr = formatDate(record.startDate);
            if (!record.endDate) {
                const status = getCurrentCycleStatus();
                const day = (status.status === 'during' && status.record === record) ? status.daysIntoCycle : '?';
                html += `
                    <div class="period-history-item" data-id="${record.id}">
                        <div class="period-history-dates">
                            <div class="period-history-range">${startStr} - 进行中</div>
                            <div class="period-history-duration">第${day}天</div>
                        </div>
                        <button class="period-history-delete" title="删除记录" data-id="${record.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            } else {
                const endStr = formatDate(record.endDate);
                const duration = calculateDuration(record);
                html += `
                    <div class="period-history-item" data-id="${record.id}">
                        <div class="period-history-dates">
                            <div class="period-history-range">${startStr} - ${endStr}</div>
                            <div class="period-history-duration">持续 ${duration} 天</div>
                        </div>
                        <button class="period-history-delete" title="删除记录" data-id="${record.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            }
        });
        container.innerHTML = html;

        container.querySelectorAll('.period-history-delete').forEach(btn => {
            btn.removeEventListener('click', handleDeleteClick);
            btn.addEventListener('click', handleDeleteClick);
        });
    }

    function handleDeleteClick(e) {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        if (id && confirm('确定要删除这条记录吗？')) {
            deleteRecordById(Number(id));
        }
    }

    function deleteRecordById(id) {
        const next = records.filter(record => Number(record.id) !== Number(id));
        if (next.length !== records.length) commitRecords(next, '记录已删除');
    }

    function updateCareMessage() {
        if (elements['period-random-message']) {
            const msg = getRandomCareMessage();
            elements['period-random-message'].innerHTML = `<i class="fas fa-heart" style="color: #e91e63; margin-right: 8px;"></i>${msg}`;
        }
    }

    function fullRefreshUI() {
        const cycle = getCurrentCycleStatus();
        updateCurrentStatus(cycle);
        updateStatistics(cycle);
        updateRecordActions();
        updateHistoryList();
        updateCareMessage();
    }

    // ==================== 用户操作 ====================
    function getActiveRecord() {
        return sortedRecords().find(record => !record.endDate);
    }

    function updateRecordActions() {
        const active = getActiveRecord();
        const quick = document.getElementById('period-quick-record');
        const backfill = document.getElementById('period-pick-dates');
        const end = document.getElementById('period-pick-end');
        const undo = document.getElementById('period-undo');
        if (!quick || !backfill || !end || !undo) return;
        quick.textContent = active ? '今天结束' : '今天开始';
        end.hidden = !active;
        quick.disabled = backfill.disabled = end.disabled = undo.disabled = saving;
        undo.hidden = !undoRecords;
        document.getElementById('period-save-dates').disabled = saving;
    }

    function closeRecordForm() {
        const form = document.getElementById('period-record-form');
        if (!form) return;
        form.hidden = true;
        delete form.dataset.mode;
        document.getElementById('period-pick-dates').setAttribute('aria-expanded', 'false');
        document.getElementById('period-pick-end').setAttribute('aria-expanded', 'false');
    }

    function openRecordForm(mode) {
        const form = document.getElementById('period-record-form');
        if (!form.hidden && form.dataset.mode === mode) {
            closeRecordForm();
            return;
        }
        const active = mode === 'end' ? getActiveRecord() : null;
        if (mode === 'end' && !active) return;
        closeRecordForm();
        form.dataset.mode = mode;
        const start = elements['period-start-date'];
        const end = elements['period-end-date'];
        const today = formatDate(new Date());
        start.parentElement.hidden = Boolean(active);
        start.disabled = Boolean(active);
        start.max = end.max = today;
        start.value = '';
        end.value = '';
        end.min = active ? formatDate(active.startDate) : '';
        form.hidden = false;
        document.getElementById(active ? 'period-pick-end' : 'period-pick-dates').setAttribute('aria-expanded', 'true');
        (active ? end : start).focus();
    }

    function recordPeriod(start, end, active = null) {
        if (saving) return false;
        const today = normalizeDate(new Date());
        let error;
        if (!Number.isFinite(+start) || (end && !Number.isFinite(+end))) error = '请选择有效日期';
        else if (start > today || end > today) error = '记录日期不能晚于今天';
        else if (end && end < start) error = '结束日期不能早于开始日期';
        else if (records.some(record => record !== active &&
            start <= (record.endDate || today) && (end || today) >= record.startDate)) {
            error = '这段日期与已有经期重叠';
        }
        if (error) {
            document.getElementById('period-record-feedback-text').textContent = error;
            if (typeof showNotification === 'function') showNotification(error, 'warning');
            return false;
        }

        const next = active
            ? records.map(record => record === active ? { ...active, endDate: end } : record)
            : [...records, { id: Date.now(), startDate: start, endDate: end, createdAt: new Date() }];
        const message = active ? '已记录结束' : end ? '已补记这段经期' : '已记录开始';
        return commitRecords(next, message, records);
    }

    function quickRecord() {
        const today = normalizeDate(new Date());
        const active = getActiveRecord();
        return active ? recordPeriod(active.startDate, today, active) : recordPeriod(today, null);
    }

    function submitRecordForm(event) {
        event.preventDefault();
        const mode = event.currentTarget.dataset.mode;
        const active = mode === 'end' ? getActiveRecord() : null;
        if (!mode || (mode === 'end' && !active)) return;
        const start = active?.startDate || normalizeDate(elements['period-start-date'].value);
        const end = normalizeDate(elements['period-end-date'].value);
        recordPeriod(start, end, active);
    }

    function openModal() {
        const advModal = document.getElementById('advanced-modal');
        if (advModal && typeof hideModal === 'function') hideModal(advModal);

        const periodModal = elements['period-modal'];
        if (!periodModal) return;

        fullRefreshUI();
        if (typeof showModal === 'function') showModal(periodModal);
        else periodModal.style.display = 'flex';
    }

    // ==================== 弹窗样式注入 ====================
    function injectPeriodDialogStyle() {
        if (document.getElementById('period-dialog-style')) return;
        const style = document.createElement('style');
        style.id = 'period-dialog-style';
        style.textContent = `
            .pd-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.45);
                display: flex; align-items: center; justify-content: center;
                z-index: 999999; opacity: 0; transition: opacity 0.25s;
            }
            .pd-overlay.show { opacity: 1; }
            .pd-box {
                background: #fff; width: 88%; max-width: 340px; border-radius: 20px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.15); overflow: hidden;
                transform: scale(0.9); transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex; flex-direction: column;
                font-family: var(--font-family, system-ui, sans-serif);
                color: #1a1a1a;
            }
            .pd-overlay.show .pd-box { transform: scale(1); }
            .pd-header {
                display: flex; align-items: center; padding: 16px 18px 0 18px;
                position: relative;
            }
            .pd-avatar {
                width: 38px; height: 38px; border-radius: 50%; background: #f0f0f0;
                display: flex; align-items: center; justify-content: center;
                overflow: hidden; flex-shrink: 0;
            }
            .pd-avatar img { width: 100%; height: 100%; object-fit: cover; }
            .pd-name {
                font-size: 15px; font-weight: 600; margin-left: 10px; color: #1a1a1a;
            }
            .pd-close {
                position: absolute; right: 18px; top: 16px;
                background: none; border: none; font-size: 18px; color: #999;
                cursor: pointer; padding: 4px; line-height: 1;
            }
            .pd-tag {
                display: inline-block; background: #e8f5e9; color: #4caf50;
                font-size: 11px; padding: 3px 10px; border-radius: 6px;
                margin: 14px 18px 6px 18px; font-weight: 500;
                align-self: flex-start;
            }
            .pd-content {
                padding: 6px 18px 24px 18px;
                font-size: 16px; line-height: 1.6; color: #333;
                font-weight: 500; word-break: break-word;
                transition: opacity 0.3s ease;
            }
            .pd-content.fade-out { opacity: 0; }
            .pd-content.fade-in { opacity: 1; }
            .pd-footer {
                display: flex; border-top: 1px solid #f0f0f0;
            }
            .pd-btn {
                flex: 1; padding: 14px 0; border: none; background: #fff;
                font-size: 15px; cursor: pointer; font-family: inherit;
                transition: background 0.15s; font-weight: 500;
            }
            .pd-btn:first-child { border-right: 1px solid #f0f0f0; color: #888; }
            .pd-btn:last-child { color: #d4a373; font-weight: 600; }
            .pd-btn:hover { background: #fafafa; }
            .pd-btn:active { background: #f0f0f0; }
        `;
        document.head.appendChild(style);
    }

    // ==================== 弹窗核心逻辑 ====================
    let currentPeriodDialog = null;

    function showPeriodDialog({ title, content, btnLeft, btnRight, onlyKnow, onLeft, onRight, keepOpenOnRight }) {
        if (currentPeriodDialog) {
            currentPeriodDialog.remove();
            currentPeriodDialog = null;
        }

        const overlay = document.createElement('div');
        overlay.className = 'pd-overlay';

        const partnerName = settings.partnerName || '梦角';
        let partnerAvatar = window.settings?.partnerAvatar || '';
        if (!partnerAvatar) {
            const avatarImg = document.querySelector('#partner-avatar img');
            if (avatarImg) partnerAvatar = avatarImg.src;
        }
        if (!partnerAvatar) partnerAvatar = 'image/Xavier.png';

        let footerHtml = '';
        if (onlyKnow) {
            footerHtml = `<button class="pd-btn pd-right" style="flex:1;">知道啦</button>`;
        } else {
            footerHtml = `
                <button class="pd-btn pd-left">${btnLeft || '不再提醒'}</button>
                <button class="pd-btn pd-right">${btnRight || '知道啦'}</button>
            `;
        }

        overlay.innerHTML = `
            <div class="pd-box">
                <div class="pd-header">
                    <div class="pd-avatar">
                        <img src="${partnerAvatar}" onerror="this.style.display='none'; this.parentNode.innerHTML='<i class=\\'fas fa-user\\' style=\\'color:#ccc;font-size:18px\\'></i>';" alt="">
                    </div>
                    <div class="pd-name">${partnerName}</div>
                    <button class="pd-close">✕</button>
                </div>
                <div class="pd-tag">${title || '月经提醒'}</div>
                <div class="pd-content">${content}</div>
                <div class="pd-footer">
                    ${footerHtml}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));
        currentPeriodDialog = overlay;

        const close = () => {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
                if (currentPeriodDialog === overlay) currentPeriodDialog = null;
            }, 250);
        };

        overlay.querySelector('.pd-close').onclick = close;

        if (onlyKnow) {
            overlay.querySelector('.pd-right').onclick = () => {
                if (onRight) onRight();
                close();
            };
        } else {
            overlay.querySelector('.pd-left').onclick = () => {
                if (onLeft) onLeft();
                close();
            };
            overlay.querySelector('.pd-right').onclick = () => {
                if (onRight) onRight();
                if (!keepOpenOnRight) close();
            };
        }

        return {
            close,
            updateContent: (newContent, newBtnRightText, newOnRight) => {
                const contentEl = overlay.querySelector('.pd-content');
                contentEl.classList.add('fade-out');
                setTimeout(() => {
                    contentEl.innerHTML = newContent;
                    contentEl.classList.remove('fade-out');
                    contentEl.classList.add('fade-in');
                    if (newBtnRightText) {
                        const rightBtn = overlay.querySelector('.pd-right');
                        if (rightBtn) rightBtn.textContent = newBtnRightText;
                    }
                    if (newOnRight) {
                        const rightBtn = overlay.querySelector('.pd-right');
                        if (rightBtn) {
                            const newRightBtn = rightBtn.cloneNode(true);
                            rightBtn.parentNode.replaceChild(newRightBtn, rightBtn);
                            newRightBtn.onclick = () => {
                                newOnRight();
                            };
                        }
                    }
                }, 300);
            }
        };
    }

    function getRandomMsg(category, fallback) {
        const msgs = window.periodCareMessages?.[category] || [];
        if (msgs.length > 0) return msgs[Math.floor(Math.random() * msgs.length)];
        return fallback;
    }

    async function setSuppressToday() {
        try {
            await localforage.setItem(getStorageKey('suppressDate'), formatDate(new Date()));
            if (typeof showNotification === 'function') showNotification('今天将不再提醒', 'info', 2000);
        } catch (error) {
            console.error('保存经期提醒设置失败:', error);
        }
    }

    // ==================== 求安慰：原地换字（防重复、防连点） ====================
    let lastComfortMsg = '';

    function showComfortInDialog() {
        if (!currentPeriodDialog) return;
        // 动画进行中，忽略本次点击
        if (currentPeriodDialog.dataset.comfortAnimating === '1') return;

        const duringMsgs = window.periodCareMessages?.during || [];
        let comfortMsg;

        if (duringMsgs.length > 1) {
            // 避免连续抽到同一条
            let tries = 0;
            do {
                comfortMsg = duringMsgs[Math.floor(Math.random() * duringMsgs.length)];
                tries++;
            } while (comfortMsg === lastComfortMsg && tries < 10);
        } else if (duringMsgs.length === 1) {
            comfortMsg = duringMsgs[0];
        } else {
            comfortMsg = '多喝热水，别碰凉的，抱抱你';
        }
        lastComfortMsg = comfortMsg;

        currentPeriodDialog.dataset.comfortAnimating = '1';
        const contentEl = currentPeriodDialog.querySelector('.pd-content');
        contentEl.classList.add('fade-out');

        setTimeout(() => {
            contentEl.innerHTML = comfortMsg;
            contentEl.classList.remove('fade-out');
            setTimeout(() => {
                if (currentPeriodDialog) currentPeriodDialog.dataset.comfortAnimating = '0';
            }, 50);
        }, 300);
    }

    // ==================== 每日提醒逻辑 ====================
    function showDuringReminder() {
        const msg = getRandomMsg('during', '这几天要好好休息，我会陪着你');
        lastComfortMsg = msg;
        showPeriodDialog({
            title: '月经提醒', content: msg,
            btnLeft: '今天不再提醒', btnRight: '求安慰', keepOpenOnRight: true,
            onLeft: setSuppressToday, onRight: showComfortInDialog
        });
    }

    async function checkDailyReminder() {
        const today = formatDate(new Date());
        if (!reminderReady || reminderChecking || lastReminderCheckDate === today) return;
        reminderChecking = true;
        try {
            if (await localforage.getItem(getStorageKey('suppressDate')) === today) return;
            const cycle = getCurrentCycleStatus();
            const daysUntil = cycle.daysUntilNext;
            if (cycle.status !== 'during' && (daysUntil == null || daysUntil > 3)) return;
            lastReminderCheckDate = today;
            try {
                await localforage.setItem(getStorageKey('lastReminderCheck'), today);
            } catch (error) {
                console.error('保存经期提醒日期失败:', error);
            }
            if (cycle.status === 'during') {
                showDuringReminder();
            } else if (daysUntil > 0) {
                showPeriodDialog({
                    title: '月经提醒', content: getRandomMsg('approaching', '月经快来了，注意休息'),
                    btnLeft: '今天不再提醒', btnRight: '知道啦', onLeft: setSuppressToday
                });
            } else {
                showPeriodDialog({
                    title: '月经提醒', content: '预计日期到了，今天来了吗？',
                    btnLeft: '今天还没来', btnRight: '已经开始', onLeft: setSuppressToday,
                    onRight: async () => {
                        if (!getActiveRecord() && await recordPeriod(normalizeDate(new Date()), null)) showDuringReminder();
                    }
                });
            }
        } catch (error) {
            console.error('读取经期提醒设置失败:', error);
        } finally {
            reminderChecking = false;
        }
    }

    // ==================== 事件绑定 ====================
    function bindEvents() {
        cacheElements();
        const periodBtn = document.getElementById('period-function');
        if (periodBtn && !periodBtn.dataset.periodBound) {
            periodBtn.dataset.periodBound = 'true';
            periodBtn.addEventListener('click', openModal);
        }

        const closeBtn = document.getElementById('close-period');
        if (closeBtn && !closeBtn.dataset.periodBound) {
            closeBtn.dataset.periodBound = 'true';
            closeBtn.addEventListener('click', () => {
                const modal = elements['period-modal'];
                if (modal && typeof hideModal === 'function') hideModal(modal);
                else if (modal) modal.style.display = 'none';
            });
        }

        const quick = document.getElementById('period-quick-record');
        const startDateInput = elements['period-start-date'];
        const endDateInput = elements['period-end-date'];
        if (!quick || quick.dataset.periodBound || !startDateInput || !endDateInput) return;
        quick.addEventListener('click', quickRecord);
        document.getElementById('period-pick-dates').addEventListener('click', () => openRecordForm('backfill'));
        document.getElementById('period-pick-end').addEventListener('click', () => openRecordForm('end'));
        const syncBackfillEndDate = () => {
            if (startDateInput.form.dataset.mode !== 'backfill' || !startDateInput.validity.valid) return;
            const start = startDateInput.value;
            if (!endDateInput.value || endDateInput.value === endDateInput.min || endDateInput.value < start) {
                endDateInput.value = start;
            }
            endDateInput.min = start;
        };
        for (const event of ['input', 'change', 'blur']) {
            startDateInput.addEventListener(event, syncBackfillEndDate);
        }
        endDateInput.addEventListener('focus', syncBackfillEndDate);
        document.getElementById('period-cancel-dates').addEventListener('click', closeRecordForm);
        document.getElementById('period-record-form').addEventListener('submit', submitRecordForm);
        document.getElementById('period-undo').addEventListener('click', () => {
            if (undoRecords) commitRecords(undoRecords, '已撤销上次记录');
        });
        quick.dataset.periodBound = 'true';
    }

    // ==================== 对外暴露的初始化方法 ====================
    window.initPeriodData = async function() {
        injectPeriodDialogStyle();
        bindEvents();
        await loadData();
        fullRefreshUI();
        reminderReady = true;
        setTimeout(checkDailyReminder, 6000);
    };

    window.triggerPeriodReminder = checkDailyReminder;

    window.initPeriodListeners = function() {
        bindEvents();
    };

    window.deletePeriodRecord = function(id) {
        deleteRecordById(id);
    };
})();
