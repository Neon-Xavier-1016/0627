/**
 * features/period.js - 月经记录系统（完整版）
 * 功能：记录经期、预测下次日期、关怀提醒、历史管理
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
        lastReminderCheck: 'lastPeriodReminderCheck'
    };

    // ==================== 工具函数 ====================
    function getStorageKey(key) {
        return STORAGE_KEYS[key];
    }

    /**
     * 标准化日期为本地日期 00:00:00
     */
    function normalizeDate(dateInput) {
        let d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) {
            d = new Date(dateInput);
        }
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * 格式化日期为 YYYY-MM-DD
     */
    function formatDate(date) {
        const d = normalizeDate(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 计算两次开始日期的周期长度（天）
     */
    function calculateCycleLength(prevStart, nextStart) {
        return Math.round((nextStart - prevStart) / (1000 * 60 * 60 * 24));
    }

    /**
     * 计算一次月经持续时间（天）
     */
    function calculateDuration(record) {
        if (!record.endDate) return 0;
        const start = normalizeDate(record.startDate);
        const end = normalizeDate(record.endDate);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    // ==================== 周期计算与预测 ====================
    /**
     * 重新计算平均周期（基于最近5次有效完整记录）
     */
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

    /**
     * 获取下次预测月经开始的具体日期
     * @returns {Date|null}
     */
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

    /**
     * 获取距离下次预测还有多少天（负数表示已推迟）
     */
    function getDaysUntilNextPeriod() {
        const nextDate = getNextPeriodDate();
        if (!nextDate) return null;
        const today = normalizeDate(new Date());
        return Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
    }

    /**
     * 获取当前周期状态
     */
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
            daysSinceEnd: daysSinceEnd,
            daysUntilNext: daysUntilNext,
            isDelayed: isDelayed,
            record: latest
        };
    }

    // ==================== 提醒与关怀消息 ====================
    function getReminderMessage() {
        if (records.length === 0) return null;
        const partner = settings.partnerName || '梦角';
        const careMsgs = window.periodCareMessages || { during: [], approaching: [], delayed: [] };
        const status = getCurrentCycleStatus();

        if (status.status === 'during') {
            const msgs = careMsgs.during;
            if (msgs && msgs.length) {
                const idx = Math.floor(Math.random() * msgs.length);
                return `${partner}：${msgs[idx]}`;
            }
            return null;
        }

        if (status.status === 'after') {
            const daysUntil = status.daysUntilNext;
            if (daysUntil !== null && daysUntil <= 3 && daysUntil > 0) {
                const msgs = careMsgs.approaching;
                if (msgs && msgs.length) {
                    const idx = Math.floor(Math.random() * msgs.length);
                    return `${partner}：${msgs[idx]}`;
                }
            } else if (status.isDelayed) {
                const msgs = careMsgs.delayed;
                if (msgs && msgs.length) {
                    const idx = Math.floor(Math.random() * msgs.length);
                    return `${partner}：${msgs[idx]}`;
                }
            }
        }
        return null;
    }

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
                // 修改点：显示具体日期而非“X天后”
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

        // 修改点：将“距离下次天数”改为显示具体日期
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

        // 绑定删除事件（事件委托）
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
        // 关闭可能打开的其他模态框
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

    function checkDailyReminder() {
        const todayStr = formatDate(new Date());
        if (lastReminderCheckDate === todayStr) return;

        lastReminderCheckDate = todayStr;
        saveData();

        const msg = getReminderMessage();
        if (msg && typeof showNotification === 'function') {
            setTimeout(() => {
                showNotification(msg, 'info', 6000);
            }, 4000);
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
        cacheElements();
        await loadData();
        fullRefreshUI();
        bindEvents();
        setTimeout(checkDailyReminder, 5000);
    };

    window.initPeriodListeners = function() {
        bindEvents();
    };

    window.deletePeriodRecord = function(id) {
        deleteRecordById(id);
    };
})();