/**
 * features/period.js - 月经记录系统 + 关怀消息管理
 * Period Tracker Module + Care Messages Manager
 */

// ===== 初始化 periodCareMessages（确保全局存在） =====
if (typeof periodCareMessages === 'undefined') {
    window.periodCareMessages = {
        approaching: [
            "特殊日子快来了，记得保暖～",
            "这几天别太累，我会陪着你",
            "提前准备好红糖姜茶，好好照顾自己"
        ],
        during: [
            "这几天要好好休息，别碰冷水",
            "注意保暖，多喝热水",
            "我会一直在这里陪着你",
            "疼的话就告诉我，我在呢"
        ],
        delayed: [
            "周期有点乱，是不是最近太累了？",
            "别担心，规律作息会慢慢恢复的",
            "放松心情，我们一起调整"
        ]
    };
}

// ===== 数据加载 =====
async function initPeriodData() {
    try {
        const savedRecords = await localforage.getItem(getStorageKey('periodRecords'));
        if (savedRecords) {
            periodRecords = savedRecords.map(record => ({
                ...record,
                startDate: new Date(record.startDate),
                endDate: record.endDate ? new Date(record.endDate) : null,
                id: record.id || (Date.now() + Math.random()) 
            }));
        }
        
        const savedSettings = await localforage.getItem(getStorageKey('periodSettings'));
        if (savedSettings) {
            periodSettings = { ...periodSettings, ...savedSettings };
        }
        
        const savedCheckDate = await localforage.getItem(getStorageKey('lastPeriodReminderCheck'));
        if (savedCheckDate) {
            lastPeriodReminderCheck = savedCheckDate;
        }
        
        const savedCareMsgs = await localforage.getItem(getStorageKey('periodCareMessages'));
        if (savedCareMsgs) {
            periodCareMessages = savedCareMsgs;
        } else {
            await localforage.setItem(getStorageKey('periodCareMessages'), periodCareMessages);
        }
    } catch (e) {
        console.error('Error loading period data:', e);
    }
}

function savePeriodData() {
    try {
        localforage.setItem(getStorageKey('periodRecords'), periodRecords);
        localforage.setItem(getStorageKey('periodSettings'), periodSettings);
        localforage.setItem(getStorageKey('periodCareMessages'), periodCareMessages);
        if (lastPeriodReminderCheck) {
            localforage.setItem(getStorageKey('lastPeriodReminderCheck'), lastPeriodReminderCheck);
        }
    } catch (e) {
        console.error('Error saving period data:', e);
        if (e.name === 'QuotaExceededError') {
            showNotification('存储空间不足，建议清理一些旧记录', 'warning', 3000);
        }
    }
}

function checkDailyPeriodReminder() {
    const today = new Date().toDateString();
    if (lastPeriodReminderCheck === today) return;
    lastPeriodReminderCheck = today;
    localforage.setItem(getStorageKey('lastPeriodReminderCheck'), today);
    const message = getCycleMessageForReminder();
    if (message) {
        setTimeout(() => {
            showNotification(`${message}`, 'info', 6000);
        }, 4000);
    }
}

function getCycleMessageForReminder() {
    if (periodRecords.length === 0) return null;
    const sortedRecords = [...periodRecords].sort((a, b) => b.startDate - a.startDate);
    const latestRecord = sortedRecords[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(latestRecord.startDate);
    startDate.setHours(0, 0, 0, 0);
    const duringMsgs = periodCareMessages.during || [];
    const approachingMsgs = periodCareMessages.approaching || [];
    const delayedMsgs = periodCareMessages.delayed || [];
    if (latestRecord && !latestRecord.endDate) {
        if (duringMsgs.length > 0) {
            const randomIndex = Math.floor(Math.random() * duringMsgs.length);
            return `${settings.partnerName}：${duringMsgs[randomIndex]}`;
        }
        return null;
    }
    if (latestRecord.endDate) {
        const daysUntilNext = calculateDaysUntilNextPeriod();
        if (daysUntilNext !== null && daysUntilNext <= 3 && daysUntilNext > 0) {
            if (approachingMsgs.length > 0) {
                const randomIndex = Math.floor(Math.random() * approachingMsgs.length);
                return `${settings.partnerName}：${approachingMsgs[randomIndex]}`;
            }
        }
        if (daysUntilNext !== null && daysUntilNext <= 0) {
            if (delayedMsgs.length > 0) {
                const randomIndex = Math.floor(Math.random() * delayedMsgs.length);
                return `${settings.partnerName}：${delayedMsgs[randomIndex]}`;
            }
        }
    }
    return null;
}

function getCycleMessage() {
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
    if (typeof periodRecords === 'undefined' || periodRecords.length === 0) {
        return `${partnerName}：我会在这里守着你`;
    }
    const sortedRecords = [...periodRecords].sort((a, b) => b.startDate - a.startDate);
    const latestRecord = sortedRecords[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(latestRecord.startDate);
    startDate.setHours(0, 0, 0, 0);
    if (latestRecord && !latestRecord.endDate) {
        const messages = periodCareMessages.during;
        if (messages && messages.length > 0) {
            const randomIndex = Math.floor(Math.random() * messages.length);
            return `${partnerName}：${messages[randomIndex]}`;
        }
        return `${partnerName}：这几天要好好休息`;
    }
    if (latestRecord.endDate) {
        const daysUntilNext = calculateDaysUntilNextPeriod();
        if (daysUntilNext !== null && daysUntilNext <= 3 && daysUntilNext > 0) {
            const messages = periodCareMessages.approaching;
            if (messages && messages.length > 0) {
                const randomIndex = Math.floor(Math.random() * messages.length);
                return `${partnerName}：${messages[randomIndex]}`;
            }
            return `${partnerName}：特殊日子快来了，注意休息`;
        }
        if (daysUntilNext !== null && daysUntilNext <= 0) {
            const messages = periodCareMessages.delayed;
            if (messages && messages.length > 0) {
                const randomIndex = Math.floor(Math.random() * messages.length);
                return `${partnerName}：${messages[randomIndex]}`;
            }
            return `${partnerName}：周期有点乱，最近累到了？`;
        }
    }
    return `${partnerName}：我会在这里守着你`;
}

function calculatePeriodDuration(record) {
    if (!record.endDate) return 0;
    const start = new Date(record.startDate);
    const end = new Date(record.endDate);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function calculateAverageCycleLength() {
    if (periodRecords.length < 2) return periodSettings.averageCycleLength;
    const completeRecords = periodRecords.filter(record => record.endDate);
    if (completeRecords.length < 2) return periodSettings.averageCycleLength;
    const recentRecords = [...completeRecords].sort((a, b) => b.startDate - a.startDate).slice(0, 5);
    const sortedRecords = [...recentRecords].sort((a, b) => a.startDate - b.startDate);
    let totalDays = 0, cycleCount = 0;
    for (let i = 1; i < sortedRecords.length; i++) {
        const currentStart = new Date(sortedRecords[i].startDate);
        const previousStart = new Date(sortedRecords[i - 1].startDate);
        const cycleLength = Math.ceil((currentStart - previousStart) / (1000 * 60 * 60 * 24));
        if (cycleLength >= 20 && cycleLength <= 45) {
            totalDays += cycleLength;
            cycleCount++;
        }
    }
    if (cycleCount > 0) {
        const average = Math.round(totalDays / cycleCount);
        periodSettings.averageCycleLength = average;
        savePeriodData();
        return average;
    }
    return periodSettings.averageCycleLength;
}

function calculateDaysUntilNextPeriod() {
    if (periodRecords.length === 0) return null;
    const completeRecords = periodRecords.filter(record => record.endDate);
    if (completeRecords.length === 0) return null;
    const sortedRecords = [...completeRecords].sort((a, b) => b.startDate - a.startDate);
    const latestRecord = sortedRecords[0];
    const averageCycle = calculateAverageCycleLength();
    if (completeRecords.length < 3) {
        const variation = Math.min(3, Math.floor(averageCycle * 0.1));
        return Math.ceil((latestRecord.startDate - new Date()) / (1000 * 60 * 60 * 24)) + averageCycle;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextPeriodDate = new Date(latestRecord.startDate);
    nextPeriodDate.setDate(nextPeriodDate.getDate() + averageCycle);
    return Math.ceil((nextPeriodDate - today) / (1000 * 60 * 60 * 24));
}

function formatPeriodDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updatePeriodUI() {
    updatePeriodCurrentStatus();
    updatePeriodStatistics();
    updatePeriodHistoryList();
    updatePeriodCycleMessage();
    renderPeriodCareUI();
}

function updatePeriodCurrentStatus() {
    const statusElement = document.getElementById('period-current-status');
    if (!statusElement) return;
    if (periodRecords.length === 0) {
        statusElement.textContent = '未记录';
        statusElement.style.color = 'var(--text-secondary)';
        return;
    }
    const sortedRecords = [...periodRecords].sort((a, b) => b.startDate - a.startDate);
    const latestRecord = sortedRecords[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(latestRecord.startDate);
    startDate.setHours(0, 0, 0, 0);
    if (!latestRecord.endDate) {
        const dayOfCycle = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
        statusElement.textContent = `经期第${dayOfCycle}天`;
        statusElement.style.color = '#e91e63';
    } else {
        const endDate = new Date(latestRecord.endDate);
        endDate.setHours(0, 0, 0, 0);
        const daysSince = Math.ceil((today - endDate) / (1000 * 60 * 60 * 24));
        const averageCycle = calculateAverageCycleLength();
        const nextPeriodDate = new Date(latestRecord.startDate);
        nextPeriodDate.setDate(nextPeriodDate.getDate() + averageCycle);
        if (today < nextPeriodDate) {
            const daysUntilNext = Math.ceil((nextPeriodDate - today) / (1000 * 60 * 60 * 24));
            statusElement.textContent = `已结束${daysSince}天，预计${daysUntilNext}天后`;
            statusElement.style.color = 'var(--accent-color)';
        } else {
            const daysDelayed = Math.ceil((today - nextPeriodDate) / (1000 * 60 * 60 * 24));
            statusElement.textContent = `已结束${daysSince}天，推迟${daysDelayed}天`;
            statusElement.style.color = '#ff9800';
        }
    }
}

function updatePeriodStatistics() {
    const durationEl = document.getElementById('period-duration');
    const cycleEl = document.getElementById('period-cycle-length');
    const nextEl = document.getElementById('period-days-until-next');
    if (periodRecords.length === 0) {
        if (durationEl) durationEl.textContent = '-';
        if (cycleEl) cycleEl.textContent = '-';
        if (nextEl) nextEl.textContent = '-';
        return;
    }
    const averageCycle = calculateAverageCycleLength();
    if (cycleEl) cycleEl.textContent = `${averageCycle}天`;
    const daysUntilNext = calculateDaysUntilNextPeriod();
    if (nextEl) nextEl.textContent = daysUntilNext !== null ? `${daysUntilNext}天` : '-';
    const completeRecords = periodRecords.filter(record => record.endDate);
    if (completeRecords.length > 0 && durationEl) {
        const sortedCompleteRecords = [...completeRecords].sort((a, b) => b.startDate - a.startDate);
        const latestCompleteRecord = sortedCompleteRecords[0];
        const duration = calculatePeriodDuration(latestCompleteRecord);
        durationEl.textContent = `${duration}天`;
    } else if (durationEl) {
        durationEl.textContent = '-';
    }
}

function updatePeriodHistoryList() {
    const historyList = document.getElementById('period-history-list');
    if (!historyList) return;
    if (periodRecords.length === 0) {
        historyList.innerHTML = `
            <div class="period-empty-state">
                <i class="fas fa-calendar-plus"></i>
                <p>暂无记录</p>
                <span>开始记录你的月经周期吧</span>
            </div>
        `;
        return;
    }
    const sortedRecords = [...periodRecords].sort((a, b) => b.startDate - a.startDate);
    let historyHTML = '';
    sortedRecords.forEach((record, index) => {
        const startDateStr = formatPeriodDate(record.startDate);
        const isActive = !record.endDate;
        if (isActive) {
            const dayOfCycle = Math.ceil((new Date() - record.startDate) / (1000 * 60 * 60 * 24)) + 1;
            historyHTML += `
                <div class="period-history-item" data-index="${index}">
                    <div class="period-history-dates">
                        <div class="period-history-range">${startDateStr} - 进行中</div>
                        <div class="period-history-duration">第${dayOfCycle}天</div>
                    </div>
                    <button class="period-history-delete" title="删除记录" onclick="deletePeriodRecord(${record.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        } else {
            const endDateStr = formatPeriodDate(record.endDate);
            const duration = calculatePeriodDuration(record);
            historyHTML += `
                <div class="period-history-item" data-index="${index}">
                    <div class="period-history-dates">
                        <div class="period-history-range">${startDateStr} - ${endDateStr}</div>
                        <div class="period-history-duration">持续 ${duration} 天</div>
                    </div>
                    <button class="period-history-delete" title="删除记录" onclick="deletePeriodRecord(${record.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
    });
    historyList.innerHTML = historyHTML;
}

function updatePeriodCycleMessage() {
    const messageElement = document.getElementById('period-random-message');
    if (!messageElement) return;
    const message = getCycleMessage();
    messageElement.innerHTML = `<i class="fas fa-heart" style="color: #e91e63; margin-right: 8px;"></i>${message}`;
}

function startPeriodRecord() {
    const startDateInput = document.getElementById('period-start-date');
    const startDate = startDateInput ? startDateInput.value : null;
    if (!startDate) {
        showNotification('请选择开始日期', 'warning', 3000);
        return;
    }
    const start = new Date(startDate);
    const hasActivePeriod = periodRecords.some(record => !record.endDate);
    if (hasActivePeriod) {
        showNotification('已有进行中的月经记录，请先结束当前记录', 'warning', 3000);
        return;
    }
    const newRecord = {
        id: Date.now(),
        startDate: start,
        endDate: null,
        createdAt: new Date()
    };
    periodRecords.push(newRecord);
    savePeriodData();
    updatePeriodUI();
    showNotification('月经开始记录已保存', 'success', 2000);
}

function endPeriodRecord() {
    const endDateInput = document.getElementById('period-end-date');
    const endDate = endDateInput ? endDateInput.value : null;
    if (!endDate) {
        showNotification('请选择结束日期', 'warning', 3000);
        return;
    }
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (end > today) {
        showNotification('结束日期不能晚于今天', 'error', 3000);
        return;
    }
    const activeRecordIndex = periodRecords.findIndex(record => !record.endDate);
    if (activeRecordIndex === -1) {
        showNotification('没有找到进行中的月经记录', 'warning', 3000);
        return;
    }
    const startDate = new Date(periodRecords[activeRecordIndex].startDate);
    if (end < startDate) {
        showNotification('结束日期不能早于开始日期', 'error', 3000);
        return;
    }
    periodRecords[activeRecordIndex].endDate = end;
    savePeriodData();
    updatePeriodUI();
    const duration = calculatePeriodDuration(periodRecords[activeRecordIndex]);
    showNotification(`月经结束记录已保存，本次持续${duration}天`, 'success', 3000);
}

window.deletePeriodRecord = function(id) {
    if (confirm('确定要删除这条记录吗？')) {
        const index = periodRecords.findIndex(record => record.id === id);
        if (index !== -1) {
            periodRecords.splice(index, 1);
            savePeriodData();
            updatePeriodUI();
            showNotification('记录已删除', 'success', 2000);
        }
    }
};

// ===== 月经关怀消息管理 UI（修复事件绑定） =====
function renderPeriodCareUI() {
    const container = document.getElementById('period-care-messages-container');
    if (!container) return;

    const categories = [
        { id: 'approaching', name: '📅 月经临近', desc: '月经来临前3天发送' },
        { id: 'during', name: '🌸 月经期间', desc: '月经期间每天发送' },
        { id: 'delayed', name: '⏰ 月经推迟', desc: '月经推迟时发送' }
    ];

    let html = `
        <div class="period-section" id="period-care-section">
            <div class="period-section-title">
                <i class="fas fa-heart"></i><span>关怀消息管理</span>
                <span style="font-size: 11px; color: var(--text-secondary); margin-left: auto;">可自定义提醒语句</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px;">
    `;
    categories.forEach(cat => {
        const msgs = periodCareMessages[cat.id] || [];
        html += `
            <div style="background: var(--primary-bg); border-radius: 14px; border: 1px solid var(--border-color); overflow: hidden;">
                <div style="padding: 10px 14px; background: rgba(var(--accent-color-rgb), 0.05); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; font-size: 14px;">${cat.name}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${cat.desc}</div>
                    </div>
                    <button class="modal-btn modal-btn-secondary add-care-msg-btn" data-category="${cat.id}" style="padding: 4px 12px; font-size: 12px;">+ 添加</button>
                </div>
                <div style="padding: 8px;">
                    ${msgs.map((msg, idx) => `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--border-color);">
                            <span style="flex: 1; font-size: 13px;">${escapeHtml(msg)}</span>
                            <button class="edit-care-msg-btn" data-category="${cat.id}" data-index="${idx}" style="background: none; border: none; cursor: pointer; color: var(--text-secondary);">✏️</button>
                            <button class="del-care-msg-btn" data-category="${cat.id}" data-index="${idx}" style="background: none; border: none; cursor: pointer; color: #f44336;">🗑️</button>
                        </div>
                    `).join('')}
                    ${msgs.length === 0 ? '<div style="padding: 12px; text-align: center; color: var(--text-secondary); font-size: 12px;">暂无消息，点击上方按钮添加</div>' : ''}
                </div>
            </div>
        `;
    });
    html += `</div></div>`;
    container.innerHTML = html;

    // 使用 onclick 直接绑定，避免 removeEventListener 的变量问题
    container.querySelectorAll('.add-care-msg-btn').forEach(btn => {
        btn.onclick = () => {
            const category = btn.dataset.category;
            const newMsg = prompt('输入新的关怀消息：');
            if (newMsg && newMsg.trim()) {
                periodCareMessages[category].push(newMsg.trim());
                savePeriodData();
                renderPeriodCareUI();
                showNotification('添加成功', 'success');
            }
        };
    });
    container.querySelectorAll('.edit-care-msg-btn').forEach(btn => {
        btn.onclick = () => {
            const category = btn.dataset.category;
            const idx = parseInt(btn.dataset.index);
            const current = periodCareMessages[category][idx];
            const newMsg = prompt('编辑消息：', current);
            if (newMsg !== null && newMsg.trim()) {
                periodCareMessages[category][idx] = newMsg.trim();
                savePeriodData();
                renderPeriodCareUI();
                showNotification('已保存', 'success');
            }
        };
    });
    container.querySelectorAll('.del-care-msg-btn').forEach(btn => {
        btn.onclick = () => {
            const category = btn.dataset.category;
            const idx = parseInt(btn.dataset.index);
            if (confirm('确定删除这条消息吗？')) {
                periodCareMessages[category].splice(idx, 1);
                savePeriodData();
                renderPeriodCareUI();
                showNotification('已删除', 'success');
            }
        };
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function ensureCareContainer() {
    let container = document.getElementById('period-care-messages-container');
    if (container) return;
    const modalContent = document.querySelector('#period-modal .modal-content');
    if (!modalContent) return;
    const sections = modalContent.querySelectorAll('.period-section');
    const lastSection = sections[sections.length - 1];
    if (lastSection) {
        container = document.createElement('div');
        container.id = 'period-care-messages-container';
        lastSection.insertAdjacentElement('afterend', container);
    } else {
        container = document.createElement('div');
        container.id = 'period-care-messages-container';
        modalContent.appendChild(container);
    }
}

function openPeriodModal() {
    const advModal = document.getElementById('advanced-modal');
    if (advModal) hideModal(advModal);
    const periodModal = document.getElementById('period-modal');
    setTimeout(() => {
        updatePeriodUI();
        const today = new Date().toISOString().split('T')[0];
        const startInput = document.getElementById('period-start-date');
        const endInput = document.getElementById('period-end-date');
        if (startInput) startInput.value = today;
        if (endInput) endInput.value = today;
        ensureCareContainer();
        renderPeriodCareUI();
        showModal(periodModal);
    }, 150);
}

function initPeriodListeners() {
    const entryBtn = document.getElementById('period-function');
    if (entryBtn && !entryBtn.dataset.initialized) {
        entryBtn.dataset.initialized = 'true';
        entryBtn.addEventListener('click', openPeriodModal);
    }
    const closeBtn = document.getElementById('close-period');
    if (closeBtn && !closeBtn.dataset.initialized) {
        closeBtn.dataset.initialized = 'true';
        closeBtn.addEventListener('click', () => {
            hideModal(document.getElementById('period-modal'));
        });
    }
    const startBtn = document.getElementById('start-period-record');
    if (startBtn && !startBtn.dataset.initialized) {
        startBtn.dataset.initialized = 'true';
        startBtn.addEventListener('click', startPeriodRecord);
    }
    const endBtn = document.getElementById('end-period-record');
    if (endBtn && !endBtn.dataset.initialized) {
        endBtn.dataset.initialized = 'true';
        endBtn.addEventListener('click', endPeriodRecord);
    }
    const today = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById('period-start-date');
    const endInput = document.getElementById('period-end-date');
    if (startInput) startInput.max = today;
    if (endInput) endInput.max = today;
    setTimeout(checkDailyPeriodReminder, 5000);
}

window.initPeriodData = initPeriodData;
window.initPeriodListeners = initPeriodListeners;
window.renderPeriodCareUI = renderPeriodCareUI;