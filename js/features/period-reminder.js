/**
 * period-reminder.js - 月经提醒弹窗（每日一次，在今日公告后显示）
 * 标题背景跟随主题色
 */
(function() {
    console.log('[period-reminder] 脚本已加载');

    let reminderModal = null;

    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
    }

    function ensureModal() {
        if (reminderModal) return;
        reminderModal = document.createElement('div');
        reminderModal.id = 'period-reminder-modal';
        reminderModal.className = 'modal';
        reminderModal.style.cssText = 'z-index: 10001;';
        reminderModal.innerHTML = `
            <div class="modal-content" style="max-width: 320px; text-align: center; padding: 20px 20px 16px;">
                <div class="modal-title" id="reminder-title" style="background: var(--accent-color); color: #fff; padding: 12px 0; border-radius: 12px 12px 0 0; margin: -20px -20px 16px -20px;">
                    <i class="fas fa-droplet"></i> <span>月经提醒</span>
                </div>
                <div id="reminder-message" style="padding: 8px 0 16px; font-size: 16px; color: var(--text-primary);"></div>
                <div id="reminder-actions" class="modal-buttons" style="margin-top: 0; justify-content: center;"></div>
            </div>
        `;
        document.body.appendChild(reminderModal);
    }

    function showReminder(title, message, buttons) {
        console.log('[showReminder] 调用', title, message);
        ensureModal();
        document.getElementById('reminder-title').innerHTML = `<i class="fas fa-droplet"></i> <span>${title}</span>`;
        document.getElementById('reminder-message').innerHTML = message;
        const actionsDiv = document.getElementById('reminder-actions');
        actionsDiv.innerHTML = '';
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = btn.className || 'modal-btn modal-btn-primary';
            button.innerText = btn.text;
            button.onclick = () => {
                hideModal(reminderModal);
                if (btn.onClick) btn.onClick();
            };
            actionsDiv.appendChild(button);
        });
        showModal(reminderModal);
    }

    window._testShowReminder = showReminder;

    function getRandomMessage(category) {
        const messages = periodCareMessages[category];
        let msg = null;
        if (messages && messages.length > 0) {
            msg = messages[Math.floor(Math.random() * messages.length)];
        } else {
            if (category === 'approaching') msg = '月经快来了，注意休息哦～';
            else if (category === 'during') msg = '月经期间，照顾好自己～';
            else if (category === 'delayed') msg = '月经推迟了，放松心情～';
        }
        if (msg) {
            return `${getPartnerName()}：${msg}`;
        }
        return null;
    }

    function hasShownToday() {
        const today = new Date().toDateString();
        const lastShown = localStorage.getItem('periodReminderLastDate');
        return lastShown === today;
    }

    function markShownToday() {
        localStorage.setItem('periodReminderLastDate', new Date().toDateString());
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setUTCDate(result.getUTCDate() + days);
        return result;
    }

    function dateToYYYYMMDD(date) {
        return date.getUTCFullYear() + '-' + String(date.getUTCMonth()+1).padStart(2,'0') + '-' + String(date.getUTCDate()).padStart(2,'0');
    }

    function daysBetween(date1, date2) {
        const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
        return Math.floor((utc2 - utc1) / (1000*60*60*24));
    }

    function checkAndShowReminder() {
        console.log('[checkAndShowReminder] 开始执行');
        if (hasShownToday()) {
            console.log('[checkAndShowReminder] 今日已弹过，跳过');
            return;
        }

        const activePeriod = periodRecords.find(r => !r.endDate);
        if (activePeriod) {
            console.log('[checkAndShowReminder] 检测到进行中记录，尝试弹出经期提醒');
            const msg = getRandomMessage('during');
            if (msg) {
                showReminder('月经期间', msg, [{ text: '知道啦', className: 'modal-btn modal-btn-primary', onClick: () => {} }]);
                markShownToday();
            }
            return;
        }

        console.log('[checkAndShowReminder] 没有进行中记录，进入预测逻辑');
        if (periodRecords.length === 0) {
            console.log('[checkAndShowReminder] 无历史记录，无法预测');
            return;
        }
        const lastRecord = [...periodRecords].sort((a,b) => b.startDate - a.startDate)[0];
        const avgCycle = calculateAverageCycleLength();
        if (!avgCycle) return;

        const lastStart = new Date(lastRecord.startDate);
        const predictedDate = addDays(lastStart, avgCycle);
        const today = new Date();
        const todayStr = dateToYYYYMMDD(today);
        const predStr = dateToYYYYMMDD(predictedDate);
        const diffDays = daysBetween(predictedDate, today);
        console.log(`[checkAndShowReminder] 预测日期: ${predStr}, 今天: ${todayStr}, diffDays: ${diffDays}`);

        if (diffDays > 0 && diffDays <= 3) {
            const msg = getRandomMessage('approaching');
            if (msg) showReminder('月经临近', msg, [{ text: '知道了', onClick: () => {} }]);
            markShownToday();
        } else if (diffDays === 0) {
            showReminder('月经预测日', '今天预计是月经第一天，是否已经来了？', [
                { text: '来了', className: 'modal-btn modal-btn-primary', onClick: () => {
                    const todayStr = dateToYYYYMMDD(new Date()).replace(/-/g, '-');
                    const startDate = new Date(todayStr);
                    periodRecords.push({
                        id: Date.now(),
                        startDate: startDate,
                        endDate: null,
                        createdAt: new Date()
                    });
                    savePeriodData();
                    const duringMsg = getRandomMessage('during');
                    if (duringMsg) {
                        setTimeout(() => {
                            showReminder('月经期间', duringMsg, [{ text: '好', onClick: () => {} }]);
                        }, 500);
                    }
                    markShownToday();
                } },
                { text: '还没来', className: 'modal-btn modal-btn-secondary', onClick: () => {
                    const delayedMsg = getRandomMessage('delayed');
                    showReminder('月经推迟', delayedMsg || `${getPartnerName()}：周期可能有些变化，放松心情~`, [{ text: '好的', onClick: () => {} }]);
                    markShownToday();
                } }
            ]);
            markShownToday();
        } else if (diffDays < 0) {
            const msg = getRandomMessage('delayed');
            if (msg) showReminder('月经推迟', msg, [{ text: '好的', onClick: () => {} }]);
            markShownToday();
        } else {
            console.log('[checkAndShowReminder] 不在提醒范围内');
        }
    }

    window.triggerPeriodReminder = function() {
        console.log('[triggerPeriodReminder] 被外部调用');
        if (typeof periodCareMessages !== 'undefined' && typeof periodRecords !== 'undefined') {
            setTimeout(checkAndShowReminder, 500);
        } else {
            console.warn('[triggerPeriodReminder] periodCareMessages 或 periodRecords 未定义');
        }
    };
})();