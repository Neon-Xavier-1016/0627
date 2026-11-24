(function () {
    'use strict';

    const schedules = {
        off: null,
        low: { initial: [25, 45], regular: [60, 100], retry: [10, 18], retryWindow: 20 },
        normal: { initial: [10, 18], regular: [25, 45], retry: [5, 9.75], retryWindow: 10 },
        high: { initial: [4, 8], regular: [10, 18], retry: [2, 5], retryWindow: 7 }
    };
    const storageKey = () => getStorageKey('gameInviteFrequency');

    function frequency() {
        try {
            const saved = localStorage.getItem(storageKey());
            if (Object.hasOwn(schedules, saved)) return saved;
        } catch (error) {
            console.warn('[游戏邀请]', error);
        }
        return 'normal';
    }

    function setFrequency(value) {
        if (!Object.hasOwn(schedules, value)) throw new Error('无效的邀请频率');
        localStorage.setItem(storageKey(), value);
        window.dispatchEvent(new Event('game-invite-frequency-change'));
    }

    window.GameInvites = { frequency, setFrequency, timing: (value = frequency()) => schedules[value] };
})();
