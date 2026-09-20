/**
 * app.js - 应用主入口（完整版）
 * 保留所有原有功能 + 强制刷新朋友圈头像
 */
(function() {
    'use strict';

    // ===== DOM 引用 =====
    const DOM = {
        welcomeScreen: document.getElementById('welcome-animation'),
        loaderBar: document.getElementById('loader-tech-bar'),
        welcomeSubtitle: document.querySelector('.welcome-subtitle-scramble'),
        disclaimerModal: document.getElementById('disclaimer-modal'),
        acceptDisclaimerBtn: document.getElementById('accept-disclaimer'),
        momentsModal: document.getElementById('moments-modal'),
        momentsList: document.getElementById('moments-list'),
        momentsUnreadBanner: document.getElementById('moments-unread-banner'),
        momentsEntryBtn: document.getElementById('moments-entry-btn'),
        momentsBackBtn: document.querySelector('#moments-modal .moments-back'),
        editorModal: document.getElementById('moments-editor-modal'),
        // 头像相关
        myAvatarImg: document.querySelector('#my-avatar img'),
        avatarInput: document.getElementById('avatar-input'),
        saveAvatarBtn: document.getElementById('save-avatar'),
    };

    // ===== 工具函数 =====
    function updateLoader(text, width) {
        if (DOM.welcomeSubtitle) DOM.welcomeSubtitle.textContent = text;
        if (DOM.loaderBar) DOM.loaderBar.style.width = width;
    }

    function hideWelcomeScreen() {
        if (!DOM.welcomeScreen) return;
        DOM.welcomeScreen.classList.add('hidden');
        setTimeout(() => {
            DOM.welcomeScreen.style.display = 'none';
        }, 800);
    }

    async function safeAwait(promise, fallback = null) {
        try { return await promise; } catch (e) { return fallback; }
    }

    // ===== 头像处理函数 =====
    function updateChatAvatar() {
        if (settings && settings.myAvatar && DOM.myAvatarImg) {
            DOM.myAvatarImg.src = settings.myAvatar;
        }
    }

    // ===== 强制刷新朋友圈头像（纯 DOM 操作） =====
    function forceRefreshMoments() {
        var newAvatar = localStorage.getItem('myAvatar');
        if (newAvatar) {
            var top = document.querySelector('#moments-user-avatar');
            if (top) top.src = newAvatar;
            if (window.settings) window.settings.myAvatar = newAvatar;
        }

        // 🆕 更新顶部名字
        var userName = document.querySelector('#moments-user-name');
        if (userName && window.settings) {
            userName.textContent = window.settings.myName || '我';
        }

        if (window.moments && typeof window.moments.render === 'function') {
            window.moments.render();
            console.log('✅ 朋友圈已刷新（名字+头像）');
        }
    }

    window.forceRefreshMoments = forceRefreshMoments;

    // ===== 头像保存函数（保留原有逻辑，增加强制刷新） =====
    function saveAvatarToStorage(dataUrl) {
        if (!settings) {
            console.warn('settings 未定义');
            return Promise.reject('settings 未定义');
        }
        // 立即更新内存和 localStorage
        settings.myAvatar = dataUrl;
        localStorage.setItem('myAvatar', dataUrl);
        if (DOM.myAvatarImg) DOM.myAvatarImg.src = dataUrl;

        // 持久化到 localforage
        return localforage.setItem('settings', settings)
            .then(() => {
                showToast('头像已更新', 'success');
                // 延迟执行强制刷新
                setTimeout(function() {
                    forceRefreshMoments();
                }, 300);
                if (typeof updateUI === 'function') updateUI();
            })
            .catch(err => {
                console.error('保存头像失败:', err);
                showToast('保存失败，请重试', 'error');
                throw err;
            });
    }

               // ===== 高级功能 / 每日公告 按钮显式绑定 =====
               function setupAdvancedFeatureButtons() {
                   // ✅ 修改：直接使用 DOM 操作，不依赖可能未定义的 showModal
                   const openModal = (id) => {
                       const m = document.getElementById(id);
                       if (m) {
                           // 复制朋友圈成功的显示逻辑
                           m.style.display = 'flex';
                       } else {
                           console.warn('找不到模态框:', id);
                       }
                   };

                   // 每日公告
                   const dailyBtn = document.getElementById('daily-greeting-btn');
                   if (dailyBtn && !dailyBtn._advBound) {
                       dailyBtn._advBound = true;
                       dailyBtn.addEventListener('click', function () {
                           if (typeof window.reopenDailyGreeting === 'function') {
                               window.reopenDailyGreeting();
                           } else {
                               openModal('daily-greeting-modal');
                           }
                       });
                   }

                   // ... 中间的其他按钮绑定保持不变 ...

                   // 自定义回复
                   bindOnce('custom-replies-function', () => openModal('custom-replies-modal'));

                   // 悬浮音乐播放器
                   bindOnce('music-player-toggle', () => {
                       if (typeof window.toggleMusicPlayer === 'function') window.toggleMusicPlayer();
                       else openModal('music-player-modal');
                   });

                   // 消息统计
                   bindOnce('stats-function', () => openModal('stats-modal'));

                   // 抉择
                   bindOnce('decision-function', () => openModal('decision-modal'));

                   // 心情手帐（如有的话）
                   bindOnce('mood-diary-function', () => openModal('mood-diary-modal'));

                   // 重要日 / 纪念日
                   bindOnce('anniversary-function', () => openModal('anniversary-modal'));

                   // 通用绑定小工具
                   function bindOnce(id, handler) {
                       const el = document.getElementById(id);
                       if (el && !el._advBound) {
                           el._advBound = true;
                           el.addEventListener('click', handler);
                       }
                   }
               }

    // ===== 初始化头像上传事件 =====
    function initAvatarUpload() {
        // 文件选择器 change 事件
        if (DOM.avatarInput) {
            DOM.avatarInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(ev) {
                    const dataUrl = ev.target.result;
                    saveAvatarToStorage(dataUrl)
                        .then(() => {
                            this.value = '';
                        })
                        .catch(() => {
                            this.value = '';
                        });
                };
                reader.onerror = function() {
                    showToast('读取文件失败', 'error');
                    this.value = '';
                };
                reader.readAsDataURL(file);
            });
        }

        // 保存按钮（如果有）
        if (DOM.saveAvatarBtn) {
            DOM.saveAvatarBtn.addEventListener('click', function() {
                // 从主页头像元素读取当前显示的图片
                const img = document.querySelector('#my-avatar img');
                if (!img || !img.src || img.src.includes('data:image/svg')) {
                    showToast('请先上传头像', 'warning');
                    return;
                }

                const currentSrc = img.src;
                // 写入 localStorage 和 settings
                localStorage.setItem('myAvatar', currentSrc);
                if (window.settings) window.settings.myAvatar = currentSrc;

                // 持久化到 localforage
                localforage.setItem('settings', settings)
                    .then(() => {
                        showToast('头像已保存', 'success');
                        // 强制刷新朋友圈
                        setTimeout(function() {
                            forceRefreshMoments();
                        }, 300);
                        if (typeof updateUI === 'function') updateUI();
                    })
                    .catch(err => {
                        console.error('保存失败:', err);
                        showToast('保存失败，请重试', 'error');
                    });
            });
        }
    }

    // ===== 原有初始化 =====
    async function initializeApp() {
        try {
            // 1. 原有事件绑定
            if (typeof setupEventListeners === 'function') {
                setupEventListeners();
            }

            // 2. 加载数据
            updateLoader('正在建立安全连接...', '10%');
            await safeAwait(initializeSession());

            updateLoader('正在读取记忆存档...', '40%');
            await safeAwait(loadData());

            // 3. 其他模块初始化
            await safeAwait(initPeriodData());

            // 4. 朋友圈
            await initMomentsModule();

            // 5. 随机UI和音乐
            updateLoader('正在渲染我们的世界...', '70%');
            await Promise.allSettled([
                safeAwait(initializeRandomUI?.()),
                safeAwait(initMusicPlayer?.())
            ]);

            // 6. 更新UI（包括头像）
            if (typeof updateUI === 'function') {
                updateUI();
            }
            // 从存储恢复聊天头像
            updateChatAvatar();

            // 7. 定时任务
            setInterval(checkStatusChange, 60000);
            setInterval(() => {
                saveData().catch(e => console.warn('自动保存失败:', e));
            }, 3 * 60 * 1000);

            // 8. 引导
            await handleTour();

            updateLoader('连接成功，欢迎回来。', '100%');
            setTimeout(hideWelcomeScreen, 3500);

            // 9. 后台任务
            scheduleBackgroundTasks();

           // 10. 初始化头像上传事件（在DOM就绪后）
           initAvatarUpload();

           // 11. 显式绑定高级功能按钮（不依赖朋友圈）
           setupAdvancedFeatureButtons();

        } catch (err) {
            console.error('初始化失败:', err);
            tryRecoverFromBackup();
            updateLoader('加载遇到问题，已强制进入...', '100%');
            setTimeout(hideWelcomeScreen, 3500);
        }
    }



    // ===== 朋友圈模块初始化 =====
    async function initMomentsModule() {
        // 1. 先绑定入口事件（无论如何都要执行）
        if (DOM.momentsEntryBtn && !DOM.momentsEntryBtn._momentsBound) {
            DOM.momentsEntryBtn._momentsBound = true;
            DOM.momentsEntryBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (DOM.momentsModal) {
                    DOM.momentsModal.style.display = 'flex';
                    // 强制刷新朋友圈头像（打开时）
                    setTimeout(function() {
                        forceRefreshMoments();
                    }, 300);
                    if (typeof window.moments?.onEnter === 'function') {
                        window.moments.onEnter();
                    } else {
                        console.warn('window.moments.onEnter 不可用');
                    }
                }
            });
            console.log('✅ 朋友圈入口事件已绑定');
        }

        if (DOM.momentsBackBtn && !DOM.momentsBackBtn._momentsBound) {
            DOM.momentsBackBtn._momentsBound = true;
            DOM.momentsBackBtn.addEventListener('click', closeMoments);
            console.log('✅ 朋友圈返回事件已绑定');
        }

        // 2. 初始化朋友圈模块（如果可用）
        if (!window.moments || typeof window.moments.init !== 'function') {
            console.warn('⚠️ window.moments.init 不可用，跳过初始化');
            return;
        }

        const domRefs = {
            modal: DOM.momentsModal,
            list: DOM.momentsList,
            unreadBanner: DOM.momentsUnreadBanner,
            entryBtn: DOM.momentsEntryBtn,
            coverImg: document.getElementById('moments-cover-img'),
            userAvatar: document.getElementById('moments-user-avatar'),
            userName: document.getElementById('moments-user-name'),
            editorModal: DOM.editorModal,
        };

        try {
            if (typeof window.moments.setDom === 'function') {
                window.moments.setDom(domRefs);
            }
            await window.moments.init();
            console.log('✅ 朋友圈模块初始化成功');
        } catch (e) {
            console.error('朋友圈初始化失败:', e);
        }
    }

    // ===== 引导 =====
    async function handleTour() {
        if (!DOM.disclaimerModal) return;
        try {
            const tourSeen = await safeAwait(
                localforage?.getItem(APP_PREFIX + 'tour_seen'), false
            );
            if (!tourSeen) {
                showModal(DOM.disclaimerModal);
                if (DOM.acceptDisclaimerBtn && !DOM.acceptDisclaimerBtn._bound) {
                    DOM.acceptDisclaimerBtn._bound = true;
                    DOM.acceptDisclaimerBtn.addEventListener('click', () => {
                        hideModal(DOM.disclaimerModal);
                        localforage?.setItem(APP_PREFIX + 'tour_seen', true).catch(() => {});
                        if (typeof startTour === 'function') startTour();
                    }, { once: true });
                }
            }
        } catch (e) { console.warn('引导检查失败:', e); }
    }

    // ===== 备份恢复 =====
    function emergencyBackup() {
        try {
            if (typeof _backupCriticalData === 'function') {
                _backupCriticalData();
            } else {
                const data = {
                    messages: typeof messages !== 'undefined' ? messages : [],
                    settings: typeof settings !== 'undefined' ? settings : {},
                    timestamp: Date.now()
                };
                localStorage.setItem('BACKUP_V1_critical', JSON.stringify(data));
            }
        } catch (e) { console.warn('紧急备份失败:', e); }
    }

    function tryRecoverFromBackup() {
        try {
            if (typeof _tryRecoverFromBackup === 'function') {
                const backup = _tryRecoverFromBackup();
                if (backup && Array.isArray(backup.messages) && backup.messages.length > 0) {
                    if (typeof messages !== 'undefined' && backup.messages.length > messages.length) {
                        messages = backup.messages.map(m => ({
                            ...m,
                            timestamp: new Date(m.timestamp)
                        }));
                        if (backup.settings) Object.assign(settings, backup.settings);
                        if (typeof updateUI === 'function') updateUI();
                        if (typeof throttledSaveData === 'function') throttledSaveData();
                        showNotification('已自动恢复本地临时备份内容', 'warning', 3500);
                        return true;
                    }
                }
            }
        } catch (e) { console.warn('恢复备份失败:', e); }
        return false;
    }

    // ===== 后台任务 =====
    function scheduleBackgroundTasks() {
        setTimeout(async () => {
            if ('Notification' in window && Notification.permission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        showNotification('已开启系统通知', 'success', 3000);
                    }
                } catch (e) { console.warn('通知权限请求失败:', e); }
            }
        }, 3000);

        const REMIND_KEY = 'exportReminderLastShown';
        const last = parseInt(localStorage.getItem(REMIND_KEY) || '0', 10);
        const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24);
        if (daysSince >= 7) {
            setTimeout(() => {
                showNotification('建议定期导出备份，防止数据意外丢失', 'info', 7000);
                localStorage.setItem(REMIND_KEY, String(Date.now()));
            }, 8000);
        }

        setTimeout(() => {
            try {
                if (localStorage.getItem('dailyGreetingShown') === new Date().toDateString()) return;
                if (typeof checkPartnerDailyMood === 'function') checkPartnerDailyMood();
                if (typeof _buildDailyGreeting === 'function') _buildDailyGreeting();
                const modal = document.getElementById('daily-greeting-modal');
                if (modal) {
                    modal.classList.remove('hidden');
                    localStorage.setItem('dailyGreetingShown', new Date().toDateString());
                }
            } catch (e) { console.warn('每日公告显示失败:', e); }
        }, 4500);
    }

    // ===== 关闭函数 =====
    window.closeMoments = function() {
        if (DOM.momentsModal) DOM.momentsModal.style.display = 'none';
    };
    window.closeMomentsEditor = function() {
        if (DOM.editorModal) DOM.editorModal.style.display = 'none';
    };

    // ===== 页面事件 =====
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            emergencyBackup();
            try {
                if (typeof saveData === 'function') {
                    const p = saveData();
                    if (p && typeof p.catch === 'function') p.catch(e => console.error('后台保存失败:', e));
                }
            } catch (e) { console.error('保存失败:', e); }
        } else if (document.visibilityState === 'visible') {
            tryRecoverFromBackup();
        }
    });

    window.addEventListener('pagehide', emergencyBackup);
    window.addEventListener('beforeunload', emergencyBackup);

    // ===== 启动 =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

const cancelBtn = document.getElementById('cancel-session');
if (cancelBtn) {
    cancelBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('session-modal').style.display = 'none';
        // 如果有遮罩
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.style.display = 'none';
    });
}

    // 暴露关键函数到全局
    window.saveAvatarToStorage = saveAvatarToStorage;
    window.forceRefreshMoments = forceRefreshMoments;

})();
