/**
 * hygiene-reminder.js - 卫生巾更换提醒（月经期间定时提醒）
 * 提醒时间：10:00,12:00,14:00,16:00,18:00,20:00,22:00
 * 支持离线补提醒，每天每时刻只提醒一次
 */
(function() {
    // 提醒时间点（小时，24小时制）
    const REMIND_HOURS = [10, 12, 14, 16, 18, 20, 22];
    const STORAGE_KEY = 'hygieneReminderLastDates'; // 存储 { "2025-01-01-10": true, ... }

    // 检查浏览器是否支持通知
    function canNotify() {
        return 'Notification' in window;
    }

    // 请求权限（静默请求，不会主动弹，等用户触发）
    function requestNotifyPermission() {
        if (canNotify() && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // 发送系统通知
    function sendNotification(title, body) {
        if (!canNotify()) return;
        if (Notification.permission !== 'granted') {
            // 未授权，静默失败
            return;
        }
        new Notification(title, { body: body, icon: '/favicon.ico', tag: 'hygiene-reminder' });
    }

    // 获取今日日期字符串 YYYY-MM-DD
    function getTodayStr() {
        const d = new Date();
        return d.getFullYear() + '-' + (d.getMonth()+1).toString().padStart(2,'0') + '-' + d.getDate().toString().padStart(2,'0');
    }

    // 获取某个时间点的 key
    function getReminderKey(dateStr, hour) {
        return `${dateStr}-${hour}`;
    }

    // 检查某个时间点今天是否已经提醒过
    function isReminded(dateStr, hour) {
        const record = localStorage.getItem(STORAGE_KEY);
        if (!record) return false;
        const data = JSON.parse(record);
        return data[getReminderKey(dateStr, hour)] === true;
    }

    // 标记已提醒
    function markReminded(dateStr, hour) {
        const record = localStorage.getItem(STORAGE_KEY);
        let data = record ? JSON.parse(record) : {};
        data[getReminderKey(dateStr, hour)] = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // 清理旧的记录（保留最近7天）
    function cleanOldRecords() {
        const record = localStorage.getItem(STORAGE_KEY);
        if (!record) return;
        const data = JSON.parse(record);
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0,10);
        for (let key in data) {
            const datePart = key.split('-').slice(0,3).join('-');
            if (datePart < sevenDaysAgoStr) {
                delete data[key];
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // 显示自定义弹窗（在页面内）
    function showInPageReminder(hour) {
        // 获取当前对方名字
        const partnerName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
        const message = `现在是 ${hour}:00，该换卫生巾啦～`;
        if (typeof showModal === 'function') {
            // 复用已有的 modal 样式
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.cssText = 'z-index: 10002;';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 280px; text-align: center;">
                    <div class="modal-title" style="background: var(--accent-color); color: #fff; padding: 12px 0; border-radius: 12px 12px 0 0; margin: -20px -20px 16px -20px;">
                        <i class="fas fa-hand-holding-heart"></i> <span>贴心提醒</span>
                    </div>
                    <div style="padding: 16px 0; font-size: 15px; color: var(--text-primary);">
                        ${partnerName}：${message}
                    </div>
                    <div class="modal-buttons">
                        <button class="modal-btn modal-btn-primary" onclick="this.closest('.modal').remove();">知道了</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            showModal(modal);
            // 自动关闭（可选）
            setTimeout(() => {
                if (modal.parentNode) hideModal(modal);
            }, 8000);
        } else {
            alert(message);
        }
    }

    // 核心检查函数：检查当前时间是否应该提醒
    function checkReminders(now) {
        const todayStr = getTodayStr();
        const currentHour = now.getHours();
        // 遍历所有提醒时间点，找出小于等于当前小时且未提醒的点
        for (let hour of REMIND_HOURS) {
            if (hour <= currentHour && !isReminded(todayStr, hour)) {
                // 触发提醒
                markReminded(todayStr, hour);
                // 发送系统通知
                sendNotification('卫生巾更换提醒', `现在是 ${hour}:00，该换卫生巾啦～`);
                // 页面内弹窗
                showInPageReminder(hour);
            }
        }
    }

    // 每日定时器：每小时检查一次（精确度足够）
    let intervalId = null;
    function startScheduler() {
        if (intervalId) clearInterval(intervalId);
        // 每 30 分钟检查一次，避免错过（也可以每小时）
        intervalId = setInterval(() => {
            // 仅当月经期间（有进行中记录）才触发提醒
            const activePeriod = (typeof periodRecords !== 'undefined') && periodRecords.find(r => !r.endDate);
            if (activePeriod) {
                const now = new Date();
                checkReminders(now);
            }
        }, 30 * 60 * 1000); // 30分钟
    }

    // 页面加载时立即检查一次（处理错过的情况）
    function immediateCheck() {
        const activePeriod = (typeof periodRecords !== 'undefined') && periodRecords.find(r => !r.endDate);
        if (activePeriod) {
            const now = new Date();
            checkReminders(now);
        }
    }

    // 监听月经记录变化（当用户点击“来了”开始记录时，重新检查）
    function watchPeriodChanges() {
        // 监听 periodRecords 变化（简单轮询或利用事件）
        let lastRecords = JSON.stringify(periodRecords);
        setInterval(() => {
            const current = JSON.stringify(periodRecords);
            if (current !== lastRecords) {
                lastRecords = current;
                // 如果新出现了进行中记录，则立即检查一次提醒
                const active = periodRecords.find(r => !r.endDate);
                if (active) {
                    immediateCheck();
                }
            }
        }, 2000);
    }

    // 初始化
    function init() {
        requestNotifyPermission();
        cleanOldRecords();
        startScheduler();
        immediateCheck();
        watchPeriodChanges();
        // 页面可见时也检查一次（防止后台挂起恢复后错过）
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                immediateCheck();
            }
        });
    }

    // 等待周期数据加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
// 暴露测试函数到全局
window._testHygieneReminder = function() {
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
    const message = `测试提醒：该换卫生巾啦～`;
    // 页面内弹窗
    if (typeof showModal === 'function') {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'z-index: 10002;';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 280px; text-align: center;">
                <div class="modal-title" style="background: var(--accent-color); color: #fff; padding: 12px 0; border-radius: 12px 12px 0 0; margin: -20px -20px 16px -20px;">
                    <i class="fas fa-hand-holding-heart"></i> <span>贴心提醒</span>
                </div>
                <div style="padding: 16px 0; font-size: 15px; color: var(--text-primary);">
                    ${partnerName}：${message}
                </div>
                <div class="modal-buttons">
                    <button class="modal-btn modal-btn-primary" onclick="this.closest('.modal').remove();">知道了</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        showModal(modal);
        setTimeout(() => { if (modal.parentNode && typeof hideModal === 'function') hideModal(modal); }, 8000);
    } else {
        alert(message);
    }
    // 系统通知
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('卫生巾更换提醒', { body: message, icon: '/favicon.ico', tag: 'test' });
    }
};