/**
 * features/period.js - 月经记录系统（完整版 + 方框弹窗交互）
 * 功能：记录经期、预测下次日期、关怀提醒、历史管理、每日弹窗
 * 依赖：localforage, showNotification, showModal, hideModal, periodCareMessages, settings
 */

(function() {
    // ==================== 私有状态 ====================
    let records = [];                // 月经记录 { id, startDate, endDate, createdAt }
    let settings = {
        averageCycleLength: 28,
        partnerName: '梦角'
    };
    let lastReminderCheckDate = null;

    // DOM 元素缓存
    const elements = {};

    // 存储键名
    const STORAGE_KEYS = {
        records: 'periodRecords',
        settings: 'periodSettings',
        lastReminderCheck: 'lastPeriodReminderCheck',
        suppressDate: 'periodRemindSuppressDate',
        waitingManual: 'periodWaitingForManualRecord'
    };

    // ==================== 工具函数 ====================
    function getStorageKey(key) {
        return STORAGE_KEYS[key];
    }

    function normalizeDate(dateInput) {
        let d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) {
            d = new Date(dateInput);
        }
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function formatDate(date) {
        const d = normalizeDate(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function calculateCycleLength(prevStart, nextStart) {
        return Math.round((nextStart - prevStart) / (1000 * 60 * 60 * 24));
    }

    function calculateDuration(record) {
        if (!record.endDate) return 0;
        const start = normalizeDate(record.startDate);
        const end = normalizeDate(record.endDate);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    // ==================== 周期计算与预测 ====================
    function recalcAverageCycle() {
        const completed = records.filter(r => r.endDate);
        if (completed.length < 2) return settings.averageCycleLength;

        const sorted = [...completed].sort((a, b) => b.startDate - a.startDate).slice(0, 5);
        const ascending = sorted.sort((a, b) => a.startDate - b.startDate);
        let total = 0, count = 0;

        for (let i = 1; i < ascending.length; i++) {
            const cycle = calculateCycleLength(ascending[i - 1].startDate, ascending[i].startDate);
            if (cycle >= 20 && cycle <= 45) {
                total += cycle;
                count++;
            }
        }

        if (count > 0) {
            const newAvg = Math.round(total / count);
            settings.averageCycleLength = newAvg;
            saveData();
            return newAvg;
        }
        return settings.averageCycleLength;
    }

    function getNextPeriodDate() {
        if (records.length === 0) return null;
        const completed = records.filter(r => r.endDate);
        if (completed.length === 0) return null;

        const sorted = [...completed].sort((a, b) => b.startDate - a.startDate);
        const lastComplete = sorted[0];
        const avgCycle = recalcAverageCycle();

        const nextDate = new Date(lastComplete.startDate);
        nextDate.setDate(nextDate.getDate() + avgCycle);
        return nextDate;
    }

    function getDaysUntilNextPeriod() {
        const nextDate = getNextPeriodDate();
        if (!nextDate) return null;
        const today = normalizeDate(new Date());
        return Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
    }

    function getCurrentCycleStatus() {
        if (records.length === 0) return { status: 'no_record' };

        const sorted = [...records].sort((a, b) => b.startDate - a.startDate);
        const latest = sorted[0];
        const today = normalizeDate(new Date());

        if (!latest.endDate) {
            const daysInto = Math.ceil((today - latest.startDate) / (1000 * 60 * 60 * 24)) + 1;
            return { status: 'during', daysIntoCycle: daysInto, record: latest };
        }

        const endDate = normalizeDate(latest.endDate);
        const daysSinceEnd = Math.ceil((today - endDate) / (1000 * 60 * 60 * 24));
        const daysUntilNext = getDaysUntilNextPeriod();
        const isDelayed = daysUntilNext !== null && daysUntilNext <= 0;
        return {
            status: 'after',
            daysSinceEnd,
            daysUntilNext,
            isDelayed,
            record: latest
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
                    startDate: normalizeDate(new Date(record.startDate)),
                    endDate: record.endDate ? normalizeDate(new Date(record.endDate)) : null
                }));
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

    function saveData() {
        try {
            localforage.setItem(getStorageKey('records'), records);
            localforage.setItem(getStorageKey('settings'), settings);
            if (lastReminderCheckDate) {
                localforage.setItem(getStorageKey('lastReminderCheck'), lastReminderCheckDate);
            }
        } catch (e) {
            console.error('保存月经数据失败:', e);
            if (e.name === 'QuotaExceededError' && typeof showNotification === 'function') {
                showNotification('存储空间不足，建议清理一些旧记录', 'warning', 3000);
            }
        }
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

    function updateCurrentStatus() {
        if (!elements['period-current-status']) return;
        if (records.length === 0) {
            elements['period-current-status'].textContent = '未记录';
            elements['period-current-status'].style.color = 'var(--text-secondary)';
            return;
        }

        const status = getCurrentCycleStatus();
        if (status.status === 'during') {
            elements['period-current-status'].textContent = `经期第${status.daysIntoCycle}天`;
            elements['period-current-status'].style.color = '#e91e63';
        } else if (status.status === 'after') {
            const { daysSinceEnd, daysUntilNext, isDelayed } = status;
            const nextDate = getNextPeriodDate();
            const nextDateStr = nextDate ? formatDate(nextDate) : '无法预测';

            if (daysUntilNext !== null && daysUntilNext > 0) {
                elements['period-current-status'].textContent = `已结束${daysSinceEnd}天，预计下次：${nextDateStr}`;
                elements['period-current-status'].style.color = 'var(--accent-color)';
            } else if (isDelayed) {
                const delayDays = Math.abs(daysUntilNext);
                elements['period-current-status'].textContent = `已结束${daysSinceEnd}天，推迟${delayDays}天`;
                elements['period-current-status'].style.color = '#ff9800';
            } else {
                elements['period-current-status'].textContent = `已结束${daysSinceEnd}天`;
                elements['period-current-status'].style.color = 'var(--accent-color)';
            }
        }
    }

    function updateStatistics() {
        if (elements['period-cycle-length']) {
            const avg = recalcAverageCycle();
            elements['period-cycle-length'].textContent = `${avg}天`;
        }

        if (elements['period-days-until-next']) {
            const nextDate = getNextPeriodDate();
            if (nextDate) {
                elements['period-days-until-next'].textContent = formatDate(nextDate);
            } else {
                elements['period-days-until-next'].textContent = '-';
            }
        }

        if (elements['period-duration']) {
            const completed = records.filter(r => r.endDate);
            if (completed.length) {
                const latest = completed.sort((a, b) => b.startDate - a.startDate)[0];
                elements['period-duration'].textContent = `${calculateDuration(latest)}天`;
            } else {
                elements['period-duration'].textContent = '-';
            }
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
        const index = records.findIndex(r => r.id === id);
        if (index !== -1) {
            records.splice(index, 1);
            saveData();
            fullRefreshUI();
            if (typeof showNotification === 'function') {
                showNotification('记录已删除', 'success', 2000);
            }
        }
    }

    function updateCareMessage() {
        if (elements['period-random-message']) {
            const msg = getRandomCareMessage();
            elements['period-random-message'].innerHTML = `<i class="fas fa-heart" style="color: #e91e63; margin-right: 8px;"></i>${msg}`;
        }
    }

    function fullRefreshUI() {
        updateCurrentStatus();
        updateStatistics();
        updateHistoryList();
        updateCareMessage();
    }

    // ==================== 用户操作 ====================
    function startPeriod() {
        const startInput = elements['period-start-date'];
        if (!startInput || !startInput.value) {
            if (typeof showNotification === 'function') showNotification('请选择开始日期', 'warning', 3000);
            return;
        }

        const startDate = normalizeDate(startInput.value);
        if (records.some(r => !r.endDate)) {
            if (typeof showNotification === 'function') showNotification('已有进行中的记录，请先结束当前记录', 'warning', 3000);
            return;
        }

        const newRecord = {
            id: Date.now(),
            startDate: startDate,
            endDate: null,
            createdAt: new Date()
        };
        records.push(newRecord);
        saveData();
        fullRefreshUI();

        // 清除静默等待期，这样刷新页面后会触发“求安慰”弹窗
        clearWaitingForManual();

        if (typeof showNotification === 'function') showNotification('月经开始记录已保存', 'success', 2000);
    }

    function endPeriod() {
        const endInput = elements['period-end-date'];
        if (!endInput || !endInput.value) {
            if (typeof showNotification === 'function') showNotification('请选择结束日期', 'warning', 3000);
            return;
        }

        const endDate = normalizeDate(endInput.value);
        const today = normalizeDate(new Date());
        if (endDate > today) {
            if (typeof showNotification === 'function') showNotification('结束日期不能晚于今天', 'error', 3000);
            return;
        }

        const activeIndex = records.findIndex(r => !r.endDate);
        if (activeIndex === -1) {
            if (typeof showNotification === 'function') showNotification('没有找到进行中的月经记录', 'warning', 3000);
            return;
        }

        const startDate = records[activeIndex].startDate;
        if (endDate < startDate) {
            if (typeof showNotification === 'function') showNotification('结束日期不能早于开始日期', 'error', 3000);
            return;
        }

        records[activeIndex].endDate = endDate;
        saveData();
        fullRefreshUI();
        const duration = calculateDuration(records[activeIndex]);
        if (typeof showNotification === 'function') showNotification(`月经结束记录已保存，本次持续${duration}天`, 'success', 3000);
    }

    function openModal() {
        const advModal = document.getElementById('advanced-modal');
        if (advModal && typeof hideModal === 'function') hideModal(advModal);

        const periodModal = elements['period-modal'];
        if (!periodModal) return;

        fullRefreshUI();
        const todayStr = formatDate(new Date());
        if (elements['period-start-date']) elements['period-start-date'].value = todayStr;
        if (elements['period-end-date']) elements['period-end-date'].value = todayStr;

        if (typeof showModal === 'function') {
            showModal(periodModal);
        } else if (periodModal.style) {
            periodModal.style.display = 'flex';
        }
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

    function autoRecordPeriodStart() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (records.some(r => !r.endDate)) return;

        const newRecord = {
            id: Date.now(),
            startDate: today,
            endDate: null,
            createdAt: new Date()
        };
        records.push(newRecord);
        saveData();
        fullRefreshUI();

        if (typeof showNotification === 'function') {
            showNotification('已为您自动记录：月经开始', 'success', 3000);
        }
    }

    async function setSuppressToday() {
        const todayStr = formatDate(new Date());
        await localforage.setItem(getStorageKey('suppressDate'), todayStr);
        if (typeof showNotification === 'function') {
            showNotification('今天将不再提醒', 'info', 2000);
        }
    }

    async function setWaitingForManual() {
        await localforage.setItem(getStorageKey('waitingManual'), true);
    }

    async function clearWaitingForManual() {
        await localforage.removeItem(getStorageKey('waitingManual'));
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
    async function checkDailyReminder() {
        const todayStr = formatDate(new Date());

        // 1. 今天点过“不再提醒”
        const suppressDate = await localforage.getItem(getStorageKey('suppressDate'));
        if (suppressDate === todayStr) {
            console.log('【经期提醒】今天已点击不再提醒，跳过所有弹窗');
            return;
        }

        // 2. 静默等待期（用户点了“没有开始”，等待手动记录）
        const isWaiting = await localforage.getItem(getStorageKey('waitingManual'));
        if (isWaiting) {
            console.log('【经期提醒】静默等待期，等待用户手动记录');
            return;
        }

        if (records.length === 0) return;

        const status = getCurrentCycleStatus();
        const partner = settings.partnerName || '梦角';

        // ====== 状态 A：月经前3天 ======
        if (status.status === 'after' && status.daysUntilNext > 0 && status.daysUntilNext <= 3) {
            const msg = getRandomMsg('approaching', '月经快来了，注意休息');
            setTimeout(() => {
                showPeriodDialog({
                    title: '月经提醒',
                    content: msg,
                    btnLeft: '不再提醒',
                    btnRight: '知道啦',
                    onLeft: () => setSuppressToday(),
                    onRight: () => {}
                });
            }, 1500);
            return;
        }

        // ====== 状态 B：预测日 / 已推迟 ======
        if (status.status === 'after' && status.daysUntilNext <= 0) {
            setTimeout(() => {
                showPeriodDialog({
                    title: '月经提醒',
                    content: `预期日子到了，月经来了吗？`,
                    btnLeft: '没有开始',
                    btnRight: '已经开始',
                    onLeft: async () => {
                        await setWaitingForManual();
                        const delayMsg = getRandomMsg('delayed', '最近累到了吗，没关系，月经本来就不是固定时间的');
                        setTimeout(() => {
                            showPeriodDialog({
                                title: '月经提醒',
                                content: delayMsg,
                                onlyKnow: true,
                                onRight: () => {}
                            });
                        }, 300);
                    },
                    onRight: () => {
                        autoRecordPeriodStart();
                        setTimeout(() => {
                            const duringMsg = getRandomMsg('during', '这几天要好好休息，我会陪着你');
                            lastComfortMsg = duringMsg;
                            showPeriodDialog({
                                title: '月经提醒',
                                content: duringMsg,
                                btnLeft: '不再提醒',
                                btnRight: '求安慰',
                                keepOpenOnRight: true,
                                onLeft: () => setSuppressToday(),
                                onRight: () => {
                                    showComfortInDialog();
                                }
                            });
                        }, 300);
                    }
                });
            }, 1500);
            return;
        }

        // ====== 状态 C：经期中 ======
        if (status.status === 'during') {
            const msg = getRandomMsg('during', '这几天要好好休息，我会陪着你');
            lastComfortMsg = msg;   // ← 新增
            setTimeout(() => {
                showPeriodDialog({
                    title: '月经提醒',
                    content: msg,
                    btnLeft: '不再提醒',
                    btnRight: '求安慰',
                    keepOpenOnRight: true,
                    onLeft: () => setSuppressToday(),
                    onRight: () => {
                        showComfortInDialog();
                    }
                });
            }, 1500);
            return;
        }
    }

    // ==================== 事件绑定 ====================
    function bindEvents() {
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

        const startBtn = document.getElementById('start-period-record');
        if (startBtn && !startBtn.dataset.periodBound) {
            startBtn.dataset.periodBound = 'true';
            startBtn.addEventListener('click', startPeriod);
        }

        const endBtn = document.getElementById('end-period-record');
        if (endBtn && !endBtn.dataset.periodBound) {
            endBtn.dataset.periodBound = 'true';
            endBtn.addEventListener('click', endPeriod);
        }

        const todayStr = formatDate(new Date());
        if (elements['period-start-date']) elements['period-start-date'].max = todayStr;
        if (elements['period-end-date']) elements['period-end-date'].max = todayStr;
    }

    // ==================== 对外暴露的初始化方法 ====================
    window.initPeriodData = async function() {
        injectPeriodDialogStyle();
        cacheElements();
        await loadData();
        fullRefreshUI();
        bindEvents();
        setTimeout(checkDailyReminder, 6000);
    };

    window.initPeriodListeners = function() {
        bindEvents();
    };

    window.deletePeriodRecord = function(id) {
        deleteRecordById(id);
    };
})();