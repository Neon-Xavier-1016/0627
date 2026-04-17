// js/features/smart-send.js
(function() {
    // 获取主题色
    function getAccentColor() {
        let color = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
        return color && color !== '' ? color : '#ff6b9d';
    }

    // 更新主动开关外观
    function updateAutoSwitch(active) {
        const switchEl = document.getElementById('auto-send-switch');
        const knobEl = document.getElementById('auto-send-knob');
        const detailEl = document.getElementById('auto-send-detail');

        if (!switchEl) return;

        if (active) {
            switchEl.style.background = getAccentColor();
            if (knobEl) knobEl.style.left = '23px';
            if (detailEl) detailEl.style.display = 'block';
        } else {
            switchEl.style.background = '#ccc';
            if (knobEl) knobEl.style.left = '3px';
            if (detailEl) detailEl.style.display = 'none';
        }
    }

    // 更新智能开关外观
    function updateSmartSwitch(autoActive, smartActive) {
        const switchEl = document.getElementById('smart-random-switch');
        const knobEl = document.getElementById('smart-random-knob');
        const panelEl = document.getElementById('smart-random-panel');
        const fixedPanel = document.getElementById('fixed-interval-panel');

        if (!switchEl) return;

        if (autoActive && smartActive) {
            switchEl.style.background = getAccentColor();
            if (knobEl) knobEl.style.left = '23px';
            if (panelEl) panelEl.style.display = 'block';
            if (fixedPanel) fixedPanel.style.display = 'none';
        } else {
            switchEl.style.background = '#ccc';
            if (knobEl) knobEl.style.left = '3px';
            if (panelEl) panelEl.style.display = 'none';
            if (fixedPanel && autoActive) fixedPanel.style.display = 'flex';
        }
    }

    // 更新滑块显示
    function updateSliderUI(fixedInterval) {
        const slider = document.getElementById('auto-send-slider');
        const value = document.getElementById('auto-send-value');
        if (slider && value) {
            slider.value = fixedInterval;
            value.textContent = fixedInterval + '分钟';
        }
    }

    // 加载状态
    function loadState() {
        const saved = localStorage.getItem('smartRandomSettings');
        if (saved) {
            try {
                const s = JSON.parse(saved);
                return {
                    autoEnabled: s.autoEnabled || false,
                    smartEnabled: s.smartEnabled || false,
                    fixedInterval: s.fixedInterval || 30
                };
            } catch(e) {}
        }
        return { autoEnabled: false, smartEnabled: false, fixedInterval: 30 };
    }

    // 保存状态
    function saveState(autoEnabled, smartEnabled, fixedInterval) {
        localStorage.setItem('smartRandomSettings', JSON.stringify({
            autoEnabled: autoEnabled,
            smartEnabled: smartEnabled,
            activeStart: '08:00',
            activeEnd: '22:00',
            fixedInterval: fixedInterval
        }));

        if (typeof window.settings !== 'undefined') {
            window.settings.autoSendEnabled = autoEnabled;
            window.settings.autoSendInterval = fixedInterval;
            if (typeof window.throttledSaveData === 'function') window.throttledSaveData();
        }
    }

    // 覆盖定时器
    function overrideTimer(autoEnabled, fixedInterval) {
        if (window.autoSendTimer) {
            clearInterval(window.autoSendTimer);
            window.autoSendTimer = null;
        }

        if (autoEnabled) {
            console.log(`[主动发送] 已启动，间隔：${fixedInterval} 分钟`);
            window.autoSendTimer = setInterval(() => {
                if (typeof window.simulateReply === 'function') {
                    window.simulateReply();
                }
            }, fixedInterval * 60 * 1000);
        } else {
            console.log('[主动发送] 功能已关闭');
        }
    }

    // 初始化
    function init() {
        let state = loadState();

        // 更新界面
        updateAutoSwitch(state.autoEnabled);
        updateSmartSwitch(state.autoEnabled, state.smartEnabled);
        updateSliderUI(state.fixedInterval);

        // 绑定主动开关点击
        const autoToggle = document.getElementById('auto-send-toggle');
        if (autoToggle) {
            const newAuto = autoToggle.cloneNode(true);
            autoToggle.parentNode.replaceChild(newAuto, autoToggle);
            newAuto.addEventListener('click', function(e) {
                e.stopPropagation();
                state.autoEnabled = !state.autoEnabled;
                if (!state.autoEnabled) state.smartEnabled = false;
                updateAutoSwitch(state.autoEnabled);
                updateSmartSwitch(state.autoEnabled, state.smartEnabled);
                saveState(state.autoEnabled, state.smartEnabled, state.fixedInterval);
                overrideTimer(state.autoEnabled, state.fixedInterval);
                console.log('主动发消息:', state.autoEnabled ? '开启' : '关闭');
            });
        }

        // 绑定智能开关点击
        const smartToggle = document.getElementById('smart-random-switch');
        if (smartToggle) {
            const newSmart = smartToggle.cloneNode(true);
            smartToggle.parentNode.replaceChild(newSmart, smartToggle);
            newSmart.addEventListener('click', function(e) {
                e.stopPropagation();
                if (!state.autoEnabled) return;
                state.smartEnabled = !state.smartEnabled;
                updateSmartSwitch(state.autoEnabled, state.smartEnabled);
                saveState(state.autoEnabled, state.smartEnabled, state.fixedInterval);
                console.log('智能随机:', state.smartEnabled ? '开启' : '关闭');
            });
        }

        // 绑定滑块事件
        const slider = document.getElementById('auto-send-slider');
        if (slider) {
            slider.addEventListener('input', function(e) {
                state.fixedInterval = parseInt(e.target.value);
                updateSliderUI(state.fixedInterval);
                saveState(state.autoEnabled, state.smartEnabled, state.fixedInterval);
                overrideTimer(state.autoEnabled, state.fixedInterval);
                console.log('间隔已改为:', state.fixedInterval, '分钟');
            });
        }

        // 覆盖定时器
        window.manageAutoSendTimer = function() {
            overrideTimer(state.autoEnabled, state.fixedInterval);
        };

        // 启动定时器
        overrideTimer(state.autoEnabled, state.fixedInterval);

        console.log('智能发送模块初始化完成', state);
    }

    // 等待 DOM 加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
