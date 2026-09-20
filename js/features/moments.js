// js/features/moments.js
(function() {
    'use strict';

    window.settings = window.settings || {};

    // ==================== 配置 ====================
    var CONFIG = {
        MAX_MOMENTS: 30,
        MAX_FAVORITED: 10,

        // 自动发帖间隔：5~7 天
        AUTO_PUBLISH_MIN_GAP: 5 * 24 * 60 * 60 * 1000,
        AUTO_PUBLISH_MAX_GAP: 7 * 24 * 60 * 60 * 1000,
        AUTO_CHECK_INTERVAL: 30 * 1000,

        // 保底 / 上限
        WEEKLY_MIN_GAP: 7 * 24 * 60 * 60 * 1000,
        MONTHLY_AUTO_LIMIT: 6,
        MONTHLY_WINDOW: 30 * 24 * 60 * 60 * 1000,

        // 图片概率
        STICKER_RATIO: 0.4,

        // 初始化补发
        BOOTSTRAP_MIN: 1,
        BOOTSTRAP_MAX: 2,

        // 离线追赶
        CATCHUP_MAX: 3,

        // 评论 / 点赞回复延时：5min ~ 3h
        REPLY_DELAY_MIN: 5 * 60 * 1000,
        REPLY_DELAY_MAX: 3 * 60 * 60 * 1000,

        // 每条朋友圈最多自动回复轮次
        MAX_AUTO_REPLY_ROUNDS: 2,

        // 对方发圈自赞概率
        PARTNER_SELF_LIKE_RATIO: 0.7,

        // 图片
        IMAGE_MAX_WIDTH: 1080,
        IMAGE_QUALITY: 0.7,
        IMAGE_MAX_SIZE: 5 * 1024 * 1024,
        MAX_IMAGES: 9,
        COVER_MAX_SIZE: 5 * 1024 * 1024,
    };

    // ==================== 状态 ====================
    var moments = [];
    var pendingTasks = [];
    var redDot = false;
    var currentFilter = 'all';
    var editingMomentId = null;
    var autoCheckTimer = null;
    var replyLibCache = [];
    var stickerCache = [];

    var dom = {
        modal: null,
        list: null,
        unreadBanner: null,
        entryBtn: null,
        coverImg: null,
        userAvatar: null,
        userName: null,
        editorModal: null,
    };

    // ==================== 工具函数 ====================
    function generateId() {
        return 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }
    function generateCommentId() {
        return 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }
    function generateTaskId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }
    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function showToast(msg) {
        if (window.showNotification) window.showNotification(msg, 'info');
        else console.log('[朋友圈]', msg);
    }
    function formatTime(timestamp) {
        var now = Date.now();
        var diff = now - timestamp;
        var seconds = Math.floor(diff / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        var days = Math.floor(hours / 24);
        var date = new Date(timestamp);
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        var hh = String(date.getHours()).padStart(2, '0');
        var mm = String(date.getMinutes()).padStart(2, '0');
        if (seconds < 60) return '刚刚';
        if (minutes < 60) return minutes + '分钟前';
        if (hours < 24) return hours + '小时前';
        if (days === 1) return '昨天 ' + hh + ':' + mm;
        if (days < 7) return days + '天前';
        if (year === new Date(now).getFullYear()) {
            return month + '月' + day + '日 ' + hh + ':' + mm;
        }
        return year + '年' + month + '月' + day + '日 ' + hh + ':' + mm;
    }

    // ==================== 字卡库 / 表情库 兼容层 ====================
    function normalizeReplyLibrary(raw) {
        if (!Array.isArray(raw)) return [];
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var item = raw[i];
            var text = '';
            if (typeof item === 'string') text = item;
            else if (item && typeof item === 'object') {
                text = item.text || item.content || item.card || '';
            }
            if (text && String(text).trim()) out.push(String(text).trim());
        }
        return out;
    }

    function findReplyLibraryFromWindow() {
        var candidates = [
            window._customReplies,
            window.replyLibrary,
            window.replyCards,
            window.customReplies,
            window.settings && window.settings._customReplies,
            window.settings && window.settings.replyLibrary,
        ];
        for (var i = 0; i < candidates.length; i++) {
            var normalized = normalizeReplyLibrary(candidates[i]);
            if (normalized.length > 0) return normalized;
        }
        return [];
    }

    // ✅ 只读「对方」表情库，绝不读「我的」
    function findStickerLibraryFromWindow() {
        var candidates = [
            window.partnerStickerLibrary,
            window.stickerLibrary,
            window.settings && window.settings.partnerStickerLibrary,
            window.settings && window.settings.stickerLibrary,
        ];
        for (var i = 0; i < candidates.length; i++) {
            var c = candidates[i];
            if (Array.isArray(c) && c.length > 0) return c;
        }
        return [];
    }

    function loadLibsFromStorage() {
        return localforage.keys().then(function(keys) {
            var replyKey = null;
            var partnerStickerKey = null;

            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (/_customReplies$/.test(k)) replyKey = k;
                if (k.indexOf('myStickerLibrary') !== -1) continue;
                if (/_stickerLibrary$/.test(k) || k === 'stickerLibrary') {
                    partnerStickerKey = k;
                }
            }

            var tasks = [];
            if (replyKey) {
                tasks.push(localforage.getItem(replyKey).then(function(data) {
                    var normalized = normalizeReplyLibrary(data);
                    if (normalized.length > 0) replyLibCache = normalized;
                }));
            }
            if (partnerStickerKey) {
                tasks.push(localforage.getItem(partnerStickerKey).then(function(data) {
                    if (Array.isArray(data) && data.length > 0) {
                        stickerCache = data;
                        console.log('[朋友圈] 已加载对方表情库，共', data.length, '条');
                    }
                }));
            }
            return Promise.all(tasks);
        }).catch(function(err) {
            console.warn('[朋友圈] 从存储读库失败:', err);
        });
    }

    function getReplyLibrary() {
        var fromWindow = findReplyLibraryFromWindow();
        if (fromWindow.length > 0) {
            replyLibCache = fromWindow;
            return fromWindow;
        }
        return replyLibCache;
    }
    function getStickerLibrary() {
        var fromWindow = findStickerLibraryFromWindow();
        if (fromWindow.length > 0) {
            stickerCache = fromWindow;
            return fromWindow;
        }
        return stickerCache;
    }

    function getRandomReplyCards(count) {
        var lib = getReplyLibrary();
        if (!lib.length) return [];
        var shuffled = lib.slice().sort(function() { return Math.random() - 0.5; });
        return shuffled.slice(0, count);
    }
    function getRandomSticker() {
        var lib = getStickerLibrary();
        if (!lib.length) return null;
        return lib[randomInt(0, lib.length - 1)];
    }

    // ==================== 头像辅助 ====================
    function getAvatar(publisher) {
        var avatar = '';
        if (publisher === 'me') {
            avatar = localStorage.getItem('myAvatar') || (window.settings ? window.settings.myAvatar : '') || '';
        } else if (publisher === 'partner') {
            avatar = localStorage.getItem('partnerAvatar') || (window.settings ? window.settings.partnerAvatar : '') || '';
        }
        if (!avatar) {
            avatar = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23ccc\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'10\'/%3E%3C/svg%3E';
        }
        return avatar;
    }

    // ==================== 聊天头像设置联动 ====================
    var chatAvatarSettings = {
        size: 36,
        myShape: 'circle',
        partnerShape: 'circle',
        cornerRadius: 8,
    };

    function loadChatAvatarSettings() {
        return localforage.keys().then(function(keys) {
            var chatKey = null;
            for (var i = 0; i < keys.length; i++) {
                if (/chatSettings/i.test(keys[i])) { chatKey = keys[i]; break; }
            }
            if (!chatKey) return null;
            return localforage.getItem(chatKey);
        }).then(function(data) {
            if (!data) return;
            chatAvatarSettings.size = parseInt(data.inChatAvatarSize, 10) || 36;
            chatAvatarSettings.myShape = data.myAvatarShape || 'circle';
            chatAvatarSettings.partnerShape = data.partnerAvatarShape || data.myAvatarShape || 'circle';

            var r = data.inChatAvatarCornerRadius;
            if (r === undefined) r = data.myAvatarCornerRadius;
            if (r === undefined) r = data.avatarCornerRadius;
            if (r === undefined) r = data.cornerRadius;
            chatAvatarSettings.cornerRadius = parseInt(r, 10);
            if (isNaN(chatAvatarSettings.cornerRadius)) chatAvatarSettings.cornerRadius = 8;

            console.log('[朋友圈] 已读取聊天头像设置:', chatAvatarSettings);
        }).catch(function(err) {
            console.warn('[朋友圈] 读取聊天头像设置失败:', err);
        });
    }

    function getMomentAvatarStyle(publisher) {
        var shape = publisher === 'me' ? chatAvatarSettings.myShape : chatAvatarSettings.partnerShape;
        var borderRadius = shape === 'circle' ? '50%' : (chatAvatarSettings.cornerRadius + 'px');
        return {
            width: chatAvatarSettings.size + 'px',
            height: chatAvatarSettings.size + 'px',
            borderRadius: borderRadius,
        };
    }

    // ==================== 数据持久化 ====================
    function saveMoments() { return localforage.setItem('moments', moments); }
    function loadMoments() { return localforage.getItem('moments').then(function(data) { moments = data || []; return moments; }); }
    function savePendingTasks() { return localforage.setItem('pendingTasks', pendingTasks); }
    function loadPendingTasks() { return localforage.getItem('pendingTasks').then(function(data) { pendingTasks = data || []; return pendingTasks; }); }
    function saveRedDot() { return localforage.setItem('momentRedDot', redDot); }
    function loadRedDot() { return localforage.getItem('momentRedDot').then(function(data) { redDot = !!data; return redDot; }); }

    // ==================== 排序 ====================
    function getSortedMoments() {
        var valid = moments.filter(function(m) { return !m.deleted; });
        valid.sort(function(a, b) { return b.timestamp - a.timestamp; });
        return valid;
    }
    function getFilteredMoments() {
        var sorted = getSortedMoments();
        if (currentFilter === 'me') return sorted.filter(function(m) { return m.publisher === 'me'; });
        if (currentFilter === 'partner') return sorted.filter(function(m) { return m.publisher === 'partner'; });
        return sorted;
    }

    // ==================== 渲染卡片 ====================
    function renderMomentCard(moment) {
        var avStyle = getMomentAvatarStyle(moment.publisher);
        var isMe = moment.publisher === 'me';
        var name = isMe
            ? ((window.settings && window.settings.myName) || '我')
            : ((window.settings && window.settings.partnerName) || '梦角');
        var avatarUrl = getAvatar(moment.publisher);
        var timeStr = formatTime(moment.timestamp);

        var likes = moment.likes || [];
        var isLiked = likes.indexOf('me') > -1;
        var comments = moment.comments || [];

        var likesHtml = '';
        if (likes.length > 0) {
            var names = [];
            var seen = {};
            likes.forEach(function(id) {
                var n = id === 'me' ? ((window.settings && window.settings.myName) || '我')
                      : id === 'partner' ? ((window.settings && window.settings.partnerName) || '梦角')
                      : id;
                if (!seen[n]) { seen[n] = 1; names.push(n); }
            });
            likesHtml = '<div class="moment-likes-row" style="display:flex;align-items:center;padding:2px 0 4px 0;font-size:13px;line-height:1.6;">' +
                '<i class="far fa-heart" style="color:#576b95;margin-right:4px;font-size:13px;"></i>' +
                '<span style="color:#576b95;font-weight:700;">' + names.join('、') + '</span>' +
                '</div>';
        }

        var actionMenuHtml =
            '<div class="moment-action-menu" style="position:relative;display:inline-block;margin-left:8px;flex-shrink:0;">' +
                '<div class="moment-menu-trigger" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#888;border-radius:50%;font-size:16px;">' +
                    '<span style="font-size:16px;letter-spacing:2px;font-weight:bold;">··</span>' +
                '</div>' +
                '<div class="moment-menu-popup" style="display:none;position:absolute;right:0;bottom:100%;margin-bottom:6px;background:#4a4a4a;border-radius:8px;overflow:hidden;white-space:nowrap;z-index:100;box-shadow:0 4px 16px rgba(0,0,0,0.25);min-width:100px;">' +
                    '<button class="menu-action-like" data-moment-id="' + moment.id + '" style="background:none;border:none;color:white;padding:10px 18px;font-size:13px;display:flex;align-items:center;gap:8px;cursor:pointer;width:100%;text-align:left;">' +
                        '<i class="' + (isLiked ? 'fas' : 'far') + ' fa-heart" style="font-size:14px;width:16px;text-align:center;"></i> ' + (isLiked ? '取消赞' : '赞') +
                    '</button>' +
                    '<button class="menu-action-comment" data-moment-id="' + moment.id + '" style="background:none;border:none;color:white;padding:10px 18px;font-size:13px;display:flex;align-items:center;gap:8px;cursor:pointer;width:100%;text-align:left;border-top:1px solid rgba(255,255,255,0.1);">' +
                        '<i class="fas fa-comment" style="font-size:14px;width:16px;text-align:center;"></i> 评论' +
                    '</button>' +
                '</div>' +
            '</div>';

        var imagesHtml = '';
        if (moment.images && moment.images.length) {
            var count = moment.images.length;
            if (count === 1) {
                var src = moment.images[0];
                imagesHtml = '<div class="moment-single-image" style="margin-top:8px;border-radius:6px;overflow:hidden;display:inline-block;">' +
                    '<img src="' + src + '" style="max-width:180px;max-height:240px;width:auto;height:auto;display:block;cursor:pointer;" data-src="' + src + '" loading="lazy">' +
                    '</div>';
            } else {
                var gridClass = 'moment-grid-' + ((count === 2 || count === 4) ? '2' : '3');
                imagesHtml = '<div class="moment-images ' + gridClass + '" style="max-width:200px;margin-top:8px;">';
                moment.images.forEach(function(img) {
                    imagesHtml += '<div class="moment-image" data-src="' + img + '"><img src="' + img + '" loading="lazy" style="cursor:pointer;"></div>';
                });
                imagesHtml += '</div>';
            }
        }

        var commentsHtml = '';
        if (comments.length > 0) {
            var myName = localStorage.getItem('myName') || (window.settings && window.settings.myName) || '我';
            var partnerName = localStorage.getItem('partnerName') || (window.settings && window.settings.partnerName) || '梦角';
            commentsHtml = '<div class="moment-comments" style="margin-top:6px;">';
            comments.forEach(function(comment) {
                var sRaw = comment.sender || '';
                var cName = sRaw === 'me' ? myName :
                            sRaw === 'partner' ? partnerName :
                            sRaw === myName ? myName :
                            sRaw === partnerName ? partnerName : partnerName;
                var replyText = '';
                if (comment.replyToCommentId) {
                    var parent = comments.find(function(c) { return c.id === comment.replyToCommentId; });
                    if (parent) {
                        var pRaw = parent.sender || '';
                        var pName = pRaw === 'me' ? myName : (pRaw === 'partner' ? partnerName : pRaw);
                        replyText = ' 回复 ' + pName;
                    }
                }
                var text = (comment.text != null) ? comment.text : '';
                commentsHtml += '<div class="moment-comment" data-comment-id="' + comment.id + '" style="display:flex;align-items:baseline;padding:3px 0;font-size:13px;line-height:1.5;">' +
                    '<span class="comment-sender" style="color:#576b95;font-weight:700;flex-shrink:0;">' + cName + '</span>' +
                    (replyText ? '<span class="comment-reply-to" style="color:#576b95;font-weight:700;flex-shrink:0;">' + replyText + '</span>' : '') +
                    '<span class="comment-text" style="color:var(--text-primary);word-break:break-all;flex-shrink:1;min-width:0;">：' + text + '</span>' +
                    '<span class="comment-actions" data-comment-id="' + comment.id + '" style="margin-left:auto;color:#999;font-size:12px;cursor:pointer;padding:0 4px;flex-shrink:0;"><i class="fas fa-ellipsis-v"></i></span>' +
                    '</div>';
            });
            commentsHtml += '</div>';
        }

        var commentInputHtml =
            '<div class="moment-comment-input" data-moment-id="' + moment.id + '" style="display:none;margin-top:8px;gap:6px;align-items:center;padding:4px 0;">' +
                '<input type="text" placeholder="写评论..." class="comment-input-field" style="flex:1;padding:6px 10px;border:1px solid var(--border-color);border-radius:16px;font-size:13px;background:var(--primary-bg);color:var(--text-primary);outline:none;font-family:var(--font-family);">' +
                '<button class="comment-send-btn" style="padding:5px 14px;background:var(--accent-color);color:#fff;border:none;border-radius:16px;font-size:12px;cursor:pointer;font-weight:600;">发送</button>' +
            '</div>';

        var footerHtml =
            '<div class="moment-footer" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0 0 0;margin-top:4px;border-top:1px solid var(--border-color);">' +
                '<div class="moment-footer-left" style="flex:1;min-width:0;">' + (likesHtml || '') + '</div>' +
                '<div class="moment-footer-right" style="flex-shrink:0;display:flex;align-items:center;">' + actionMenuHtml + '</div>' +
            '</div>';

        return '<div class="moment-card" data-moment-id="' + moment.id + '" style="padding:12px 16px 8px;border-bottom:1px solid var(--border-color);">' +
            '<div class="moment-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                '<div class="moment-user" style="display:flex;align-items:center;gap:6px;margin:0;padding:0;flex:1;min-width:0;">' +
                    '<img class="moment-avatar" src="' + avatarUrl + '" style="width:' + avStyle.width + ';height:' + avStyle.height + ';border-radius:' + avStyle.borderRadius + ';object-fit:cover;background:#eee;margin:0;padding:0;flex-shrink:0;display:block;">' +
                    '<span class="moment-name" style="font-weight:700;font-size:15px;color:#576b95;margin:0;padding:0;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name +
                        (moment.isFavorited ? ' <i class="fas fa-star" style="color:#f7b500;font-size:11px;margin-left:2px;" title="已收藏"></i>' : '') +
                    '</span>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:6px;">' +
                    '<span class="moment-time" style="font-size:12px;color:#999;">' + timeStr + '</span>' +
                    '<span class="moment-more" data-moment-id="' + moment.id + '" style="cursor:pointer;color:#999;font-size:14px;padding:0 2px;"><i class="fas fa-ellipsis-v"></i></span>' +
                '</div>' +
            '</div>' +
            (moment.content ? '<div class="moment-content" style="font-size:14px;line-height:1.7;color:var(--text-primary);margin-bottom:4px;word-break:break-word;">' + moment.content + '</div>' : '') +
            imagesHtml +
            footerHtml +
            commentsHtml +
            commentInputHtml +
            '</div>';
    }

    // ==================== 图片预览 ====================
    function showImagePreview(src) {
        var existing = document.querySelector('.moments-image-preview-overlay');
        if (existing) {
            document.body.removeChild(existing);
            var eImg = existing.querySelector('img');
            if (eImg && eImg.src === src) return;
        }

        var overlay = document.createElement('div');
        overlay.className = 'moments-image-preview-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.3s ease;';

        var img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'max-width:95vw;max-height:95vh;object-fit:contain;border-radius:6px;box-shadow:0 8px 48px rgba(0,0,0,0.6);opacity:0;transform:scale(0.92);transition:opacity 0.3s ease,transform 0.3s ease;';
        img.onclick = function(e) { e.stopPropagation(); };

        var closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = 'position:absolute;top:20px;right:24px;width:40px;height:40px;border:none;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:100000;';
        closeBtn.onclick = function(e) { e.stopPropagation(); if (document.body.contains(overlay)) document.body.removeChild(overlay); };

        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        requestAnimationFrame(function() {
            overlay.style.background = 'rgba(0,0,0,0.85)';
            img.style.opacity = '1';
            img.style.transform = 'scale(1)';
        });

        overlay.onclick = function(e) {
            if (e.target === overlay && document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        };
        var keyHandler = function(e) {
            if (e.key === 'Escape' && document.body.contains(overlay)) {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);
    }

    // ==================== 渲染入口 ====================
    function renderMoments() {
        var myName = localStorage.getItem('myName') || (window.settings ? window.settings.myName : '我');
        var partnerName = localStorage.getItem('partnerName') || (window.settings ? window.settings.partnerName : '梦角');
        if (window.settings) {
            window.settings.myName = myName;
            window.settings.partnerName = partnerName;
        }
        var myAvatar = localStorage.getItem('myAvatar') || '';
        var partnerAvatar = localStorage.getItem('partnerAvatar') || '';
        if (window.settings) {
            if (myAvatar) window.settings.myAvatar = myAvatar;
            if (partnerAvatar) window.settings.partnerAvatar = partnerAvatar;
        }

        if (!dom.list) return;
        var filtered = getFilteredMoments();
        if (filtered.length === 0) {
            dom.list.innerHTML = '<div class="moments-empty">✦ 暂无动态，发布第一条吧 ✦</div>';
            return;
        }
        var html = '';
        filtered.forEach(function(m) { html += renderMomentCard(m); });
        dom.list.innerHTML = html;
        bindCardEvents();
    }

    // ==================== 事件绑定 ====================
    function bindCardEvents() {
        var container = dom.list;
        if (!container) return;

        if (container._momentsListener) {
            container.removeEventListener('click', container._momentsListener);
            container.removeEventListener('keydown', container._momentsListener);
        }

        container._momentsListener = function(e) {
            var target = e.target;

            var trigger = target.closest('.moment-menu-trigger');
            if (trigger) {
                e.stopPropagation();
                var popup = trigger.parentElement.querySelector('.moment-menu-popup');
                if (popup) {
                    container.querySelectorAll('.moment-menu-popup').forEach(function(p) {
                        if (p !== popup) p.style.display = 'none';
                    });
                    popup.style.display = (popup.style.display === 'flex' || popup.style.display === 'block') ? 'none' : 'flex';
                }
                return;
            }

            var likeBtn = target.closest('.menu-action-like');
            if (likeBtn) {
                e.stopPropagation();
                var id = likeBtn.dataset.momentId;
                if (id) toggleLike(id);
                var popup = likeBtn.closest('.moment-menu-popup');
                if (popup) popup.style.display = 'none';
                return;
            }

            var commentBtn = target.closest('.menu-action-comment');
            if (commentBtn) {
                e.stopPropagation();
                var id = commentBtn.dataset.momentId;
                if (id) {
                    var inputArea = container.querySelector('.moment-comment-input[data-moment-id="' + id + '"]');
                    if (inputArea) {
                        var isHidden = inputArea.style.display === 'none' || getComputedStyle(inputArea).display === 'none';
                        if (isHidden) {
                            inputArea.style.display = 'flex';
                            var inputField = inputArea.querySelector('.comment-input-field');
                            if (inputField) setTimeout(function() { inputField.focus(); }, 100);
                        } else {
                            inputArea.style.display = 'none';
                        }
                    }
                    var popup = commentBtn.closest('.moment-menu-popup');
                    if (popup) popup.style.display = 'none';
                }
                return;
            }

            var sendBtn = target.closest('.comment-send-btn');
            if (sendBtn) {
                var inputArea = sendBtn.closest('.moment-comment-input');
                var id = inputArea ? inputArea.dataset.momentId : null;
                var input = inputArea ? inputArea.querySelector('.comment-input-field') : null;
                var text = input ? input.value.trim() : '';
                if (id && text) {
                    addComment(id, text);
                    input.value = '';
                    inputArea.style.display = 'none';
                }
                return;
            }

            var inputField = target.closest('.comment-input-field');
            if (inputField && e.key === 'Enter') {
                e.preventDefault();
                var area = inputField.closest('.moment-comment-input');
                var sendBtn = area ? area.querySelector('.comment-send-btn') : null;
                if (sendBtn) sendBtn.click();
                return;
            }

            var commentActions = target.closest('.comment-actions');
            if (commentActions) {
                e.stopPropagation();
                var commentId = commentActions.dataset.commentId;
                var card = commentActions.closest('.moment-card');
                var momentId = card ? card.dataset.momentId : null;
                if (momentId && commentId) showCommentMenu(momentId, commentId);
                return;
            }

            var img = target.closest('.moment-image img');
            if (img) {
                var cImg = img.closest('.moment-image');
                var src = cImg ? cImg.getAttribute('data-src') || img.src : img.src;
                if (src) showImagePreview(src);
                return;
            }
            var singleImg = target.closest('.moment-single-image img');
            if (singleImg) {
                var src2 = singleImg.getAttribute('data-src') || singleImg.src;
                if (src2) showImagePreview(src2);
                return;
            }

            var topMore = target.closest('.moment-more');
            if (topMore) {
                e.stopPropagation();
                var id = topMore.dataset.momentId;
                if (id) showMomentMenu(id);
                return;
            }
        };

        container._momentsLeaveListener = function(e) {
            var popup = e.target.closest('.moment-menu-popup');
            var trigger = e.target.closest('.moment-menu-trigger');
            if (!popup && !trigger) {
                container.querySelectorAll('.moment-menu-popup').forEach(function(p) {
                    p.style.display = 'none';
                });
            }
        };

        container.addEventListener('click', container._momentsListener);
        container.addEventListener('keydown', container._momentsListener);
        document.addEventListener('click', container._momentsLeaveListener);
    }

    // ==================== 核心操作 ====================
    function publishMoment(data) {
        return new Promise(function(resolve, reject) {
            var timestamp = data.timestamp || Date.now();
            if (timestamp > Date.now()) {
                showToast('不能发布未来的朋友圈');
                reject('Future time not allowed');
                return;
            }
            var publisher = data.publisher || 'me';
            var publisherName = publisher === 'me'
                ? ((window.settings && window.settings.myName) || '我')
                : ((window.settings && window.settings.partnerName) || '梦角');

            var newMoment = {
                id: generateId(),
                publisher: publisher,
                publisherName: publisherName,
                content: data.content || '',
                images: data.images || [],
                timestamp: timestamp,
                createdAt: Date.now(),
                likes: [],
                comments: [],
                isGenerated: false,
                isFavorited: false,
                isEdited: false,
                deleted: false,
                autoReplyCount: 0,
                pendingAutoReply: 0,
            };
            moments.push(newMoment);
            saveMoments().then(function() {
                // 🆕 用户发圈 → 不立即点赞，改为排期 5min~3h 后对方点赞+评论
                if (newMoment.publisher === 'me') {
                    schedulePartnerReplyToMoment(newMoment.id);
                }
                enforceLimits();
                renderMoments();
                showToast('发布成功 ✦');
                resolve(newMoment);
            }).catch(function(err) {
                console.error('发布失败:', err);
                reject(err);
            });
        });
    }

    function toggleLike(momentId) {
        var moment = moments.find(function(m) { return m.id === momentId; });
        if (!moment) return;
        var idx = moment.likes.indexOf('me');
        if (idx > -1) moment.likes.splice(idx, 1);
        else moment.likes.push('me');
        saveMoments().then(function() { renderMoments(); });
    }

    function addComment(momentId, text, replyToCommentId) {
        replyToCommentId = replyToCommentId || null;
        var moment = moments.find(function(m) { return m.id === momentId; });
        if (!moment) return;
        var comment = {
            id: generateCommentId(),
            sender: 'me',
            senderName: (window.settings && window.settings.myName) || '我',
            text: text,
            timestamp: Date.now(),
            replyToCommentId: replyToCommentId,
            isAutoReply: false,
        };
        moment.comments.push(comment);
        saveMoments().then(function() {
            renderMoments();
            // 🆕 用户评论 → 排期 5min~3h 后对方回复（受 2 轮限制）
            schedulePartnerReplyToComment(momentId, comment.id);
        });
    }

    function deleteMoment(momentId) {
        var idx = moments.findIndex(function(m) { return m.id === momentId; });
        if (idx === -1) return;
        cancelTasksForMoment(momentId);
        moments.splice(idx, 1);
        saveMoments().then(function() {
            renderMoments();
            showToast('已删除');
        });
    }

    function editMoment(momentId, newData) {
        var moment = moments.find(function(m) { return m.id === momentId; });
        if (!moment) return;
        if (newData.timestamp && newData.timestamp > Date.now()) {
            showToast('不能设置为未来时间');
            return;
        }
        if (newData.content !== undefined) moment.content = newData.content;
        if (newData.images !== undefined) moment.images = newData.images;
        if (newData.timestamp) moment.timestamp = newData.timestamp;
        moment.isEdited = true;
        saveMoments().then(function() {
            renderMoments();
            showToast('已更新');
        });
    }

    function toggleFavorite(momentId) {
        var moment = moments.find(function(m) { return m.id === momentId; });
        if (!moment) return;
        if (moment.isFavorited) {
            moment.isFavorited = false;
            delete moment.favoritedAt;
        } else {
            var favCount = moments.filter(function(m) { return m.isFavorited && !m.deleted; }).length;
            if (favCount >= CONFIG.MAX_FAVORITED) {
                showToast('收藏已达上限（' + CONFIG.MAX_FAVORITED + '条），请先取消部分收藏');
                return;
            }
            moment.isFavorited = true;
            moment.favoritedAt = Date.now();
        }
        saveMoments().then(function() {
            renderMoments();
            showToast(moment.isFavorited ? '已收藏 ✦' : '已取消收藏');
        });
    }

    function deleteComment(momentId, commentId) {
        var moment = moments.find(function(m) { return m.id === momentId; });
        if (!moment) return;
        var idx = moment.comments.findIndex(function(c) { return c.id === commentId; });
        if (idx > -1) {
            moment.comments.splice(idx, 1);
            saveMoments().then(function() { renderMoments(); });
        }
    }

    function editComment(momentId, commentId, newText) {
        var moment = moments.find(function(m) { return m.id === momentId; });
        if (!moment) return;
        var comment = moment.comments.find(function(c) { return c.id === commentId; });
        if (comment) {
            comment.text = newText;
            comment.timestamp = Date.now();
            comment.isEdited = true;
            saveMoments().then(function() { renderMoments(); });
        }
    }

    function replyToComment(momentId, replyToCommentId, text) {
        addComment(momentId, text, replyToCommentId);
    }

    // ==================== 延迟回复 / 延迟点赞 ====================

    /**
     * 用户发朋友圈 → 排期对方「点赞 + 顶级评论」
     * 5min ~ 3h 随机
     * 离线也能补算（评论/点赞时间 = scheduledAt）
     */
    function schedulePartnerReplyToMoment(momentId) {
        var moment = moments.find(function(m) { return m.id === momentId; });
        if (!moment) return;
        if (getReplyLibrary().length === 0) {
            console.log('[朋友圈] 字卡库为空，跳过对方点赞+评论调度');
            return;
        }
        var autoReplyCount = moment.autoReplyCount || 0;
        var pendingAutoReply = moment.pendingAutoReply || 0;
        if (autoReplyCount + pendingAutoReply >= CONFIG.MAX_AUTO_REPLY_ROUNDS) return;

        var delay = randomInt(CONFIG.REPLY_DELAY_MIN, CONFIG.REPLY_DELAY_MAX);
        var scheduledAt = Date.now() + delay;
        var task = {
            id: generateTaskId(),
            type: 'partner_action',
            triggerType: 'moment',
            momentId: momentId,
            replyToCommentId: null,
            scheduledAt: scheduledAt,
            shouldLike: true, // 用户发朋友圈 → 对方 100% 点赞
        };
        pendingTasks.push(task);
        moment.pendingAutoReply = pendingAutoReply + 1;
        saveMoments();
        savePendingTasks().then(function() {
            var timeoutId = setTimeout(function() { executePartnerActionTask(task); }, delay);
            task._timeoutId = timeoutId;
            console.log('[朋友圈] 已排期对方点赞+评论 →',
                new Date(scheduledAt).toLocaleTimeString(),
                '(' + Math.round(delay / 60000) + ' 分钟后)');
        });
    }

    /**
     * 用户评论 → 排期对方「回复该评论」
     * 5min ~ 3h 随机
     * 受 2 轮对话限制
     */
    function schedulePartnerReplyToComment(momentId, commentId) {
        var moment = moments.find(function(m) { return m.id === momentId; });
        if (!moment) return;
        if (getReplyLibrary().length === 0) return;

        var autoReplyCount = moment.autoReplyCount || 0;
        var pendingAutoReply = moment.pendingAutoReply || 0;
        if (autoReplyCount + pendingAutoReply >= CONFIG.MAX_AUTO_REPLY_ROUNDS) {
            console.log('[朋友圈] 已达 ' + CONFIG.MAX_AUTO_REPLY_ROUNDS + ' 轮上限，不再自动回复');
            return;
        }

        var delay = randomInt(CONFIG.REPLY_DELAY_MIN, CONFIG.REPLY_DELAY_MAX);
        var scheduledAt = Date.now() + delay;
        var task = {
            id: generateTaskId(),
            type: 'partner_action',
            triggerType: 'comment',
            momentId: momentId,
            replyToCommentId: commentId,
            scheduledAt: scheduledAt,
            shouldLike: false, // 评论场景不再重复点赞
        };
        pendingTasks.push(task);
        moment.pendingAutoReply = pendingAutoReply + 1;
        saveMoments();
        savePendingTasks().then(function() {
            var timeoutId = setTimeout(function() { executePartnerActionTask(task); }, delay);
            task._timeoutId = timeoutId;
            console.log('[朋友圈] 已排期对方回复评论 →',
                new Date(scheduledAt).toLocaleTimeString(),
                '(' + Math.round(delay / 60000) + ' 分钟后)');
        });
    }

    /**
     * 执行对方动作（点赞 + / 或 评论）
     * 🆕 评论/点赞时间用 task.scheduledAt，离线补算时显示历史时间
     */
    function executePartnerActionTask(task) {
        var moment = moments.find(function(m) { return m.id === task.momentId; });
        if (!moment) { removeTask(task.id); return; }

        // 点赞（用户发圈场景）
        if (task.shouldLike && moment.likes.indexOf('partner') === -1) {
            moment.likes.push('partner');
        }

        // 评论：抽 1-5 张字卡
        var cardCount = randomInt(1, 5);
        var cards = getRandomReplyCards(cardCount);
        if (cards.length > 0) {
            var replyText = cards.join(' ');
            var replyComment = {
                id: generateCommentId(),
                sender: 'partner',
                senderName: (window.settings && window.settings.partnerName) || '梦角',
                text: replyText,
                timestamp: task.scheduledAt || Date.now(), // 🆕 用排期时间
                replyToCommentId: task.replyToCommentId || null,
                isAutoReply: true,
            };
            moment.comments.push(replyComment);
        }

        // 轮次计数
        moment.autoReplyCount = (moment.autoReplyCount || 0) + 1;
        moment.pendingAutoReply = Math.max(0, (moment.pendingAutoReply || 0) - 1);

        setRedDot(true);
        saveMoments().then(function() {
            removeTask(task.id);
            renderMoments();
        });
    }

    function removeTask(taskId) {
        pendingTasks = pendingTasks.filter(function(t) { return t.id !== taskId; });
        savePendingTasks();
    }

    function cancelTasksForMoment(momentId) {
        pendingTasks.forEach(function(task) {
            if (task.momentId === momentId && task._timeoutId) clearTimeout(task._timeoutId);
        });
        pendingTasks = pendingTasks.filter(function(t) { return t.momentId !== momentId; });
        savePendingTasks();
    }

    function processPendingTasksNow() {
        var now = Date.now();
        var toExecute = pendingTasks.filter(function(t) { return t.scheduledAt <= now; });
        toExecute.forEach(function(task) { executePartnerActionTask(task); });
        pendingTasks = pendingTasks.filter(function(t) { return t.scheduledAt > now; });
        pendingTasks.forEach(function(task) {
            var delay = task.scheduledAt - now;
            if (delay > 0) {
                var tid = setTimeout(function() { executePartnerActionTask(task); }, delay);
                task._timeoutId = tid;
            } else {
                executePartnerActionTask(task);
            }
        });
        savePendingTasks();
    }

    // ==================== 自动发帖 ====================
    function getNextAutoPublishAt() {
        return parseInt(localStorage.getItem('momentNextAutoPublishAt') || '0', 10);
    }
    function setNextAutoPublishAt(ts) {
        localStorage.setItem('momentNextAutoPublishAt', String(ts));
    }
    function scheduleNextAutoPublish() {
        var gap = randomInt(CONFIG.AUTO_PUBLISH_MIN_GAP, CONFIG.AUTO_PUBLISH_MAX_GAP);
        setNextAutoPublishAt(Date.now() + gap);
        console.log('[朋友圈] 下次对方发圈将在', Math.round(gap / 3600000), '小时后');
    }
    function scheduleNextAutoPublishForNextWindow() {
        var ts = Date.now() + CONFIG.MONTHLY_WINDOW;
        setNextAutoPublishAt(ts);
        console.log('[朋友圈] 30 天内已达上限，排期到', new Date(ts).toLocaleDateString());
    }

    function getAutoPublishCount() {
        return moments.filter(function(m) {
            return m.publisher === 'partner' && m.isGenerated && !m.deleted;
        }).length;
    }

    function getAutoPublishCountInWindow() {
        var cutoff = Date.now() - CONFIG.MONTHLY_WINDOW;
        return moments.filter(function(m) {
            return m.publisher === 'partner'
                && m.isGenerated
                && !m.deleted
                && (m.createdAt || m.timestamp) >= cutoff;
        }).length;
    }

    function getLastAutoPublishTime() {
        var latest = 0;
        moments.forEach(function(m) {
            if (m.publisher === 'partner' && m.isGenerated && !m.deleted) {
                var t = m.createdAt || m.timestamp || 0;
                if (t > latest) latest = t;
            }
        });
        return latest;
    }

    // ==================== 离线追赶 ====================
    function catchUpOfflinePublish() {
        var now = Date.now();
        var lastAuto = getLastAutoPublishTime();
        if (!lastAuto) return false;

        var elapsed = now - lastAuto;
        var avgGap = (CONFIG.AUTO_PUBLISH_MIN_GAP + CONFIG.AUTO_PUBLISH_MAX_GAP) / 2;
        var expected = Math.floor(elapsed / avgGap);
        if (expected <= 0) return false;

        var windowCount = getAutoPublishCountInWindow();
        var remainingInWindow = CONFIG.MONTHLY_AUTO_LIMIT - windowCount;
        if (remainingInWindow <= 0) return false;

        var toAdd = Math.min(expected, remainingInWindow, CONFIG.CATCHUP_MAX);
        var span = now - lastAuto;
        var segment = span / (toAdd + 1);

        var added = 0;
        for (var i = 1; i <= toAdd; i++) {
            var baseTs = lastAuto + segment * i;
            var jitter = randomInt(-segment * 0.2, segment * 0.2);
            var ts = Math.floor(baseTs + jitter);
            if (ts >= now) ts = now - randomInt(60 * 1000, 30 * 60 * 1000);
            if (ts <= lastAuto) ts = lastAuto + randomInt(60 * 1000, 60 * 60 * 1000);

            generatePartnerMoment(ts, ts);
            added++;
        }

        if (added > 0) {
            console.log('[朋友圈] 离线追赶：补齐了', added, '条动态（上次发布 ' +
                Math.floor(elapsed / 86400000) + ' 天前）');
            return true;
        }
        return false;
    }

    // ==================== 初始化补发 ====================
    function bootstrapPartnerMoments() {
        if (getAutoPublishCount() > 0) return false;
        if (getReplyLibrary().length === 0) {
            console.log('[朋友圈] 字卡库为空，跳过初始化发帖');
            return false;
        }
        var initCount = randomInt(CONFIG.BOOTSTRAP_MIN, CONFIG.BOOTSTRAP_MAX);
        var now = Date.now();
        var dayMs = 24 * 60 * 60 * 1000;
        for (var i = 0; i < initCount; i++) {
            var offset = randomInt(2 * 60 * 60 * 1000, 3 * dayMs);
            var ts = now - offset;
            generatePartnerMoment(ts, ts);
        }
        console.log('[朋友圈] 初始化补发', initCount, '条对方动态');
        return true;
    }

    function doAutoPublish() {
        if (getReplyLibrary().length === 0) return false;
        generatePartnerMoment(Date.now(), Date.now());
        return true;
    }

    function checkAndAutoPublish() {
        getReplyLibrary();
        if (getReplyLibrary().length === 0) return;

        var now = Date.now();

        // 0️⃣ 离线追赶
        if (getAutoPublishCount() > 0) {
            if (catchUpOfflinePublish()) {
                enforceLimits();
                saveMoments().then(function() {
                    renderMoments();
                    setRedDot(true);
                });
            }
        }

        // 1️⃣ 完全没有自动动态 → 补发
        if (getAutoPublishCount() === 0) {
            if (bootstrapPartnerMoments()) {
                enforceLimits();
                saveMoments().then(function() {
                    renderMoments();
                    setRedDot(true);
                    scheduleNextAutoPublish();
                });
            } else {
                scheduleNextAutoPublish();
            }
            return;
        }

        // 2️⃣ 30 天窗口内已达上限
        if (getAutoPublishCountInWindow() >= CONFIG.MONTHLY_AUTO_LIMIT) {
            scheduleNextAutoPublishForNextWindow();
            return;
        }

        // 3️⃣ 每周保底
        var lastAuto = getLastAutoPublishTime();
        if (lastAuto > 0 && (now - lastAuto) >= CONFIG.WEEKLY_MIN_GAP) {
            if (doAutoPublish()) {
                enforceLimits();
                saveMoments().then(function() {
                    renderMoments();
                    setRedDot(true);
                    console.log('[朋友圈] 每周保底：对方自动发布了一条 ✦');
                });
            }
            scheduleNextAutoPublish();
            return;
        }

        // 4️⃣ 正常排期
        var nextAt = getNextAutoPublishAt();
        if (nextAt === 0) { scheduleNextAutoPublish(); return; }
        if (now >= nextAt) {
            if (doAutoPublish()) {
                enforceLimits();
                saveMoments().then(function() {
                    renderMoments();
                    setRedDot(true);
                    console.log('[朋友圈] 对方自动发布了一条动态 ✦');
                });
            }
            scheduleNextAutoPublish();
        }
    }

    function startAutoPublishScheduler() {
        if (autoCheckTimer) clearInterval(autoCheckTimer);
        setTimeout(checkAndAutoPublish, 2000);
        autoCheckTimer = setInterval(checkAndAutoPublish, CONFIG.AUTO_CHECK_INTERVAL);
        console.log('[朋友圈] 自动发帖调度器已启动');
    }

    function generatePartnerMoment(createdAtTs, displayTs) {
        createdAtTs = createdAtTs || Date.now();
        displayTs = displayTs || createdAtTs;

        if (getReplyLibrary().length === 0) return;

        var cardCount = randomInt(1, 5);
        var cards = getRandomReplyCards(cardCount);
        if (cards.length === 0) return;
        var content = cards.join(' ');

        var images = [];
        if (Math.random() < CONFIG.STICKER_RATIO) {
            var sticker = getRandomSticker();
            if (sticker) images.push(sticker);
        }

        // 🆕 对方发圈 → 70% 概率发圈瞬间自赞
        var initialLikes = Math.random() < CONFIG.PARTNER_SELF_LIKE_RATIO ? ['partner'] : [];

        var newMoment = {
            id: generateId(),
            publisher: 'partner',
            publisherName: (window.settings && window.settings.partnerName) || '梦角',
            content: content,
            images: images,
            timestamp: displayTs,
            createdAt: createdAtTs,
            likes: initialLikes,
            comments: [],
            isGenerated: true,
            isFavorited: false,
            isEdited: false,
            deleted: false,
            autoReplyCount: 0,
            pendingAutoReply: 0,
        };
        moments.push(newMoment);
    }

    // ==================== 清理限制 ====================
    function enforceLimits() {
        var normal = moments.filter(function(m) {
            return !m.isFavorited && !m.deleted;
        });
        if (normal.length > CONFIG.MAX_MOMENTS) {
            normal.sort(function(a, b) { return a.timestamp - b.timestamp; });
            var toRemove = normal.slice(0, normal.length - CONFIG.MAX_MOMENTS);
            toRemove.forEach(function(m) {
                var idx = moments.indexOf(m);
                if (idx > -1) {
                    moments.splice(idx, 1);
                    cancelTasksForMoment(m.id);
                }
            });
            showToast('已自动清理最早的朋友圈以腾出空间');
            saveMoments();
        }

        var favorited = moments.filter(function(m) { return m.isFavorited && !m.deleted; });
        if (favorited.length > CONFIG.MAX_FAVORITED) {
            favorited.sort(function(a, b) { return (a.favoritedAt || a.timestamp) - (b.favoritedAt || b.timestamp); });
            favorited.slice(0, favorited.length - CONFIG.MAX_FAVORITED).forEach(function(m) {
                m.isFavorited = false;
                delete m.favoritedAt;
            });
            saveMoments();
        }
    }

    // ==================== 红点 ====================
    function setRedDot(value) {
        redDot = value;
        saveRedDot();
        updateRedDotUI();
    }
    function updateRedDotUI() {
        if (!dom.entryBtn) return;
        if (redDot) {
            if (!dom.entryBtn.querySelector('.moment-red-dot')) {
                var dot = document.createElement('span');
                dot.className = 'moment-red-dot';
                dom.entryBtn.appendChild(dot);
            }
        } else {
            var dot = dom.entryBtn.querySelector('.moment-red-dot');
            if (dot) dot.remove();
        }
    }

    // ==================== 封面双击 ====================
    function bindCoverDblClick() {
        var coverContainer = document.getElementById('momentsCover');
        var coverInput = document.getElementById('moments-cover-input');
        if (!coverContainer || !coverInput) return;

        if (coverContainer._clickHandler) {
            coverContainer.removeEventListener('click', coverContainer._clickHandler);
        }
        var lastClickTime = 0;
        coverContainer._clickHandler = function(e) {
            var now = Date.now();
            if (now - lastClickTime < 400) {
                e.stopPropagation();
                coverInput.click();
                lastClickTime = 0;
            } else {
                lastClickTime = now;
            }
        };
        coverContainer.addEventListener('click', coverContainer._clickHandler);
    }

    // ==================== 进入朋友圈 ====================
    function onEnterMoments() {
        var myName = localStorage.getItem('myName') || '我';
        var partnerName = localStorage.getItem('partnerName') || '梦角';
        if (window.settings) {
            window.settings.myName = myName;
            window.settings.partnerName = partnerName;
        }
        var myAvatar = localStorage.getItem('myAvatar');
        var partnerAvatar = localStorage.getItem('partnerAvatar');
        if (myAvatar && window.settings) window.settings.myAvatar = myAvatar;
        if (partnerAvatar && window.settings) window.settings.partnerAvatar = partnerAvatar;

        setRedDot(false);

        // 先进来先用旧设置渲染，再异步读设置重渲染
        renderMoments();
        loadChatAvatarSettings().then(function() {
            renderMoments();
        });

        initMomentsScrollEffect();
        bindCoverDblClick();
    }

    // ==================== 滚动效果 ====================
    function initMomentsScrollEffect() {
        var container = document.getElementById('momentsContainer');
        var nav = document.getElementById('momentsNav');
        if (!container || !nav) return;

        container.scrollTop = 0;
        nav.classList.remove('scrolled');
        nav.style.backgroundColor = '';
        nav.style.backdropFilter = '';
        nav.style.webkitBackdropFilter = '';

        var isDarkMode = false;
        try {
            var bg = window.getComputedStyle(document.body).backgroundColor;
            var rgb = bg.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                if (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2]) < 384) isDarkMode = true;
            }
        } catch (e) {}

        container.onscroll = function() {
            if (container.scrollTop > 100) {
                nav.classList.add('scrolled');
                if (isDarkMode) {
                    nav.style.backgroundColor = 'rgba(0,0,0,0.95)';
                    nav.style.backdropFilter = 'blur(15px) saturate(180%)';
                    nav.style.webkitBackdropFilter = 'blur(15px) saturate(180%)';
                    nav.querySelectorAll('.moments-nav-btn, .moments-nav-title').forEach(function(el) {
                        el.style.color = '#ffffff';
                    });
                }
            } else {
                nav.classList.remove('scrolled');
                if (isDarkMode) {
                    nav.style.backgroundColor = 'transparent';
                    nav.style.backdropFilter = '';
                    nav.style.webkitBackdropFilter = '';
                    nav.querySelectorAll('.moments-nav-btn, .moments-nav-title').forEach(function(el) {
                        el.style.color = '';
                    });
                }
            }
        };
    }

    // ==================== 菜单 ====================
    function showMomentMenu(momentId) {
        var moment = moments.find(function(m) { return m.id === momentId; });
        if (!moment) return;
        var items = [
            { label: '编辑', action: function() { openEditor(momentId); } },
            { label: moment.isFavorited ? '取消收藏' : '收藏', action: function() { toggleFavorite(momentId); } },
            { label: '删除', action: function() {
                if (confirm('确定删除这条动态吗？该动态下的待回复任务也会一起删除。')) {
                    deleteMoment(momentId);
                }
            }}
        ];
        showContextMenu(items);
    }

    function showCommentMenu(momentId, commentId) {
        var items = [
            { label: '编辑', action: function() {
                var t = prompt('编辑评论:');
                if (t !== null && t.trim()) editComment(momentId, commentId, t.trim());
            }},
            { label: '删除', action: function() {
                if (confirm('确定删除这条评论吗？')) deleteComment(momentId, commentId);
            }},
            { label: '回复', action: function() {
                var t = prompt('回复评论:');
                if (t !== null && t.trim()) replyToComment(momentId, commentId, t.trim());
            }}
        ];
        showContextMenu(items);
    }

    function showContextMenu(items) {
        var modal = document.createElement('div');
        modal.className = 'moments-menu-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';
        var menu = document.createElement('div');
        menu.style.cssText = 'background:var(--secondary-bg);border-radius:12px;padding:16px;min-width:200px;';
        items.forEach(function(item) {
            var btn = document.createElement('button');
            btn.textContent = item.label;
            btn.style.cssText = 'display:block;width:100%;padding:10px;border:none;background:transparent;text-align:left;font-size:14px;cursor:pointer;border-bottom:1px solid var(--border-color);color:var(--text-primary);';
            btn.onclick = function() {
                document.body.removeChild(modal);
                item.action();
            };
            menu.appendChild(btn);
        });
        var cancel = document.createElement('button');
        cancel.textContent = '取消';
        cancel.style.cssText = 'display:block;width:100%;padding:10px;border:none;background:transparent;text-align:center;font-size:14px;cursor:pointer;margin-top:8px;color:var(--text-secondary);';
        cancel.onclick = function() { document.body.removeChild(modal); };
        menu.appendChild(cancel);
        modal.appendChild(menu);
        document.body.appendChild(modal);
        modal.onclick = function(e) { if (e.target === modal) document.body.removeChild(modal); };
    }

    // ==================== 编辑器 ====================
    function openEditor(momentId) {
        momentId = momentId || null;
        var modal = dom.editorModal;
        if (!modal) { console.error('编辑器模态框未找到'); return; }
        editingMomentId = momentId;
        var isEdit = !!momentId;
        var moment = isEdit ? moments.find(function(m) { return m.id === momentId; }) : null;
        var titleEl = modal.querySelector('.editor-title');
        if (titleEl) titleEl.textContent = isEdit ? '编辑动态' : '发布动态';
        var identity = isEdit ? moment.publisher : 'me';

        var identityBtns = modal.querySelectorAll('.editor-identity-btn');
        var meName = (window.settings && window.settings.myName) || '我';
        var partnerName = (window.settings && window.settings.partnerName) || '梦角';
        identityBtns.forEach(function(btn) {
            if (btn.dataset.identity === 'me') btn.textContent = meName;
            else if (btn.dataset.identity === 'partner') btn.textContent = partnerName;
            btn.classList.toggle('active', btn.dataset.identity === identity);
        });

        var contentEl = modal.querySelector('#editor-content');
        if (contentEl) contentEl.value = isEdit ? moment.content : '';

        var previewContainer = modal.querySelector('#editor-image-preview');
        if (previewContainer) {
            previewContainer.innerHTML = '';
            if (isEdit && moment.images && moment.images.length) {
                moment.images.forEach(function(img) { addImagePreview(img); });
            }
        }
        var ts = isEdit ? moment.timestamp : Date.now();
        var date = new Date(ts);
        var local = new Date(ts - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        var timestampEl = modal.querySelector('#editor-timestamp');
        if (timestampEl) timestampEl.value = local;
        modal.style.display = 'block';
    }

    function closeEditor() {
        if (dom.editorModal) dom.editorModal.style.display = 'none';
        editingMomentId = null;
        var previewContainer = dom.editorModal ? dom.editorModal.querySelector('#editor-image-preview') : null;
        if (previewContainer) previewContainer.innerHTML = '';
        var contentEl = dom.editorModal ? dom.editorModal.querySelector('#editor-content') : null;
        if (contentEl) contentEl.value = '';
        var timestampEl = dom.editorModal ? dom.editorModal.querySelector('#editor-timestamp') : null;
        if (timestampEl) timestampEl.value = '';
    }

    window.switchEditorIdentity = function(identity) {
        var modal = dom.editorModal;
        if (!modal) return;
        modal.querySelectorAll('.editor-identity-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.identity === identity);
        });
    };

    function submitMoment() {
        var modal = dom.editorModal;
        if (!modal) return;
        var contentEl = modal.querySelector('#editor-content');
        var previewContainer = modal.querySelector('#editor-image-preview');
        var timestampEl = modal.querySelector('#editor-timestamp');
        var content = contentEl ? contentEl.value.trim() : '';
        var images = [];
        if (previewContainer) {
            previewContainer.querySelectorAll('.editor-image-wrapper img').forEach(function(img) {
                images.push(img.src);
            });
        }
        var timestamp = timestampEl && timestampEl.value ? new Date(timestampEl.value).getTime() : Date.now();
        var activeIdentityBtn = modal.querySelector('.editor-identity-btn.active');
        var identity = activeIdentityBtn ? activeIdentityBtn.dataset.identity : 'me';
        if (!content && images.length === 0) {
            showToast('请填写内容或添加图片');
            return;
        }
        if (editingMomentId) {
            editMoment(editingMomentId, { content: content, images: images, timestamp: timestamp });
        } else {
            publishMoment({ publisher: identity, content: content, images: images, timestamp: timestamp });
        }
        closeEditor();
    }

    function addImagePreview(src) {
        var modal = dom.editorModal;
        if (!modal) return;
        var container = modal.querySelector('#editor-image-preview');
        if (!container) return;
        var wrapper = document.createElement('div');
        wrapper.className = 'editor-image-wrapper';
        wrapper.style.cssText = 'position:relative;display:inline-block;margin:4px;';
        var img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color);';
        var del = document.createElement('button');
        del.textContent = '×';
        del.style.cssText = 'position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--accent-color);color:#fff;border:none;font-size:14px;line-height:20px;text-align:center;cursor:pointer;';
        del.onclick = function() { wrapper.remove(); };
        wrapper.appendChild(img);
        wrapper.appendChild(del);
        container.appendChild(wrapper);
    }

    window.handleImageUpload = function(files) {
        var modal = dom.editorModal;
        if (!modal) return;
        var container = modal.querySelector('#editor-image-preview');
        if (!container) return;
        var currentCount = container.children.length;
        if (currentCount + files.length > CONFIG.MAX_IMAGES) {
            showToast('最多上传 ' + CONFIG.MAX_IMAGES + ' 张图片');
            return;
        }
        Array.from(files).forEach(function(file) {
            if (file.size > CONFIG.IMAGE_MAX_SIZE) {
                showToast('图片 ' + file.name + ' 超过5MB，请压缩后重试');
                return;
            }
            compressImage(file, CONFIG.IMAGE_MAX_WIDTH, CONFIG.IMAGE_QUALITY)
                .then(function(base64) { addImagePreview(base64); })
                .catch(function(err) { console.error('图片压缩失败:', err); showToast('图片处理失败'); });
        });
    };

    function compressImage(file, maxWidth, quality) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var img = new Image();
                img.onload = function() {
                    var canvas = document.createElement('canvas');
                    var w = img.width, h = img.height;
                    if (w > maxWidth) { h = h * (maxWidth / w); w = maxWidth; }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ==================== 封面 ====================
    function updateCover() {
        if (dom.userAvatar) {
            var avatar = localStorage.getItem('myAvatar') || (window.settings ? window.settings.myAvatar : '') || '';
            dom.userAvatar.src = avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23ccc\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'10\'/%3E%3C/svg%3E';
        }
        if (dom.userName) {
            dom.userName.textContent = (window.settings && window.settings.myName) || '我';
        }
        if (dom.coverImg) {
            dom.coverImg.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 800 200\'%3E%3Crect width=\'800\' height=\'200\' fill=\'%23cccccc\'/%3E%3C/svg%3E';
            return localforage.getItem('momentsCover').then(function(cover) {
                if (cover) {
                    dom.coverImg.src = cover;
                    var hint = document.getElementById('moments-cover-hint');
                    if (hint) hint.style.display = 'none';
                }
            }).catch(function(err) {
                console.warn('读取封面失败', err);
            });
        }
        return Promise.resolve();
    }

    // ==================== 初始化 ====================
    function initMoments() {
        dom.modal = document.getElementById('moments-modal');
        dom.list = document.getElementById('moments-list');
        dom.unreadBanner = document.getElementById('moments-unread-banner');
        dom.entryBtn = document.getElementById('moments-entry-btn');
        dom.coverImg = document.getElementById('moments-cover-img');
        dom.userAvatar = document.getElementById('moments-user-avatar');
        dom.userName = document.getElementById('moments-user-name');
        dom.editorModal = document.getElementById('moments-editor-modal');

        return localforage.getItem('settings').then(function(s) {
            if (s && window.settings) Object.assign(window.settings, s);
            return Promise.all([
                loadMoments(),
                loadPendingTasks(),
                loadRedDot()
            ]);
        }).then(function() {
            getReplyLibrary();
            getStickerLibrary();
            return Promise.all([
                loadLibsFromStorage(),
                loadChatAvatarSettings()
            ]);
        }).then(function() {
            getReplyLibrary();
            getStickerLibrary();
            console.log('[朋友圈] 字卡库加载完成，共', getReplyLibrary().length, '条');
            console.log('[朋友圈] 对方表情库加载完成，共', getStickerLibrary().length, '条');

            processPendingTasksNow();
            enforceLimits();
            updateRedDotUI();
            updateCover();
            if (dom.modal && dom.modal.style.display !== 'none') {
                renderMoments();
            }
            bindCoverDblClick();
            startAutoPublishScheduler();
        }).catch(function(err) {
            console.error('朋友圈初始化失败:', err);
            startAutoPublishScheduler();
        });
    }

    // ==================== DOM 设置 ====================
    function setDom(refs) {
        for (var key in refs) {
            if (refs.hasOwnProperty(key)) dom[key] = refs[key];
        }
        if (dom.editorModal) {
            var closeBtn = dom.editorModal.querySelector('.editor-close-btn');
            if (closeBtn) closeBtn.onclick = closeEditor;
            var imageInput = dom.editorModal.querySelector('#editor-image-input');
            if (imageInput) {
                imageInput.onchange = function() {
                    if (this.files) window.handleImageUpload(this.files);
                    this.value = '';
                };
            }
            var submitBtn = dom.editorModal.querySelector('#editor-submit-btn');
            if (submitBtn) submitBtn.onclick = submitMoment;

            dom.editorModal.querySelectorAll('.editor-identity-btn').forEach(function(btn) {
                btn.onclick = function() {
                    window.switchEditorIdentity(this.dataset.identity);
                };
            });
        }
        var coverInput = document.getElementById('moments-cover-input');
        if (coverInput) {
            coverInput.onchange = function() {
                var file = this.files[0];
                if (file) {
                    if (file.size > CONFIG.COVER_MAX_SIZE) {
                        showToast('图片过大，请选择 5MB 以下的图片');
                        this.value = '';
                        return;
                    }
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        var dataUrl = e.target.result;
                        localforage.setItem('momentsCover', dataUrl).then(function() {
                            if (dom.coverImg) dom.coverImg.src = dataUrl;
                            var hint = document.getElementById('moments-cover-hint');
                            if (hint) hint.style.display = 'none';
                            showToast('封面更新成功');
                        }).catch(function(err) {
                            console.error('保存封面失败:', err);
                            showToast('保存失败，请尝试使用更小的图片');
                        });
                    };
                    reader.readAsDataURL(file);
                }
                this.value = '';
            };
        }
        var filterBtns = document.querySelectorAll('.moments-filter-btn');
        filterBtns.forEach(function(btn) {
            btn.onclick = function() {
                var filter = this.dataset.filter;
                filterBtns.forEach(function(b) { b.classList.remove('active'); });
                this.classList.add('active');
                window.moments.setFilter(filter);
            };
        });
        var cameraBtn = document.getElementById('moments-camera-btn');
        if (cameraBtn) {
            cameraBtn.onclick = function() { window.moments.showEditor(); };
        }
    }

    // ==================== 强制刷新 ====================
    function forceRender() {
        var localMy = localStorage.getItem('myAvatar');
        var localPartner = localStorage.getItem('partnerAvatar');
        if (localMy && window.settings) window.settings.myAvatar = localMy;
        if (localPartner && window.settings) window.settings.partnerAvatar = localPartner;

        if (!dom.list) return;
        var filtered = getFilteredMoments();
        if (filtered.length === 0) {
            dom.list.innerHTML = '<div class="moments-empty">✦ 暂无动态，发布第一条吧 ✦</div>';
        } else {
            var html = '';
            filtered.forEach(function(m) { html += renderMomentCard(m); });
            dom.list.innerHTML = html;
            bindCardEvents();
        }
        if (dom.userAvatar) {
            var avatar = localStorage.getItem('myAvatar') || (window.settings ? window.settings.myAvatar : '') || '';
            dom.userAvatar.src = avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23ccc\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'10\'/%3E%3C/svg%3E';
        }
        console.log('✅ 朋友圈强制刷新完成');
    }

    // ==================== 对外 API ====================
    window.moments = {
        init: initMoments,
        setDom: setDom,
        render: renderMoments,
        onEnter: onEnterMoments,
        publish: publishMoment,
        toggleLike: toggleLike,
        addComment: addComment,
        toggleFavorite: toggleFavorite,
        deleteMoment: deleteMoment,
        editMoment: editMoment,
        deleteComment: deleteComment,
        editComment: editComment,
        replyToComment: replyToComment,
        setFilter: function(filter) { currentFilter = filter; renderMoments(); },
        getMoments: function() { return moments; },
        getPendingTasks: function() { return pendingTasks; },
        showEditor: openEditor,
        closeEditor: closeEditor,
        forceRender: forceRender,
        refresh: function() { this.forceRender(); },
        previewImage: showImagePreview,

        // 手动重载头像设置（设置面板关闭后可以调用）
        reloadAvatarSettings: function() {
            return loadChatAvatarSettings().then(function() {
                renderMoments();
                console.log('[朋友圈] 头像设置已重新加载');
            });
        },

        triggerAutoPublishNow: function() {
            if (getReplyLibrary().length === 0) {
                console.warn('[朋友圈] 字卡库为空，无法发布');
                return Promise.resolve(false);
            }
            generatePartnerMoment(Date.now(), Date.now());
            enforceLimits();
            return saveMoments().then(function() {
                renderMoments();
                setRedDot(true);
                console.log('✅ 已手动触发一条对方动态');
                return true;
            });
        },

        /**
         * 手动触发对方对指定朋友圈/评论的回复（调试用）
         * 立即执行，跳过 5min~3h 延迟
         */
        triggerPartnerReplyNow: function(momentId, commentId) {
            var moment = moments.find(function(m) { return m.id === momentId; });
            if (!moment) { console.warn('[朋友圈] 未找到该动态'); return; }
            var task = {
                id: generateTaskId(),
                type: 'partner_action',
                triggerType: commentId ? 'comment' : 'moment',
                momentId: momentId,
                replyToCommentId: commentId || null,
                scheduledAt: Date.now(),
                shouldLike: !commentId,
            };
            executePartnerActionTask(task);
            console.log('✅ 已手动触发对方动作');
        },

        checkNextPublish: function() {
            var nextAt = parseInt(localStorage.getItem('momentNextAutoPublishAt') || '0', 10);
            if (!nextAt) {
                console.log('❌ 还没排期');
                return null;
            }
            var diff = nextAt - Date.now();
            if (diff <= 0) {
                console.log('⏰ 排期已到，等下次轮询（最多 30 秒）就会发');
                return { nextAt: nextAt, diff: 0 };
            }
            var hours = Math.floor(diff / 3600000);
            var days = Math.floor(hours / 24);
            var remainHours = hours % 24;
            var readable = days > 0
                ? days + '天' + remainHours + '小时后'
                : hours + '小时后';
            console.log('📅 下次发朋友圈：' + new Date(nextAt).toLocaleString());
            console.log('⏳ 距现在：' + readable);
            return { nextAt: nextAt, diff: diff, readable: readable };
        },

        debugAutoPublish: function() {
            var autoCount = getAutoPublishCount();
            var windowCount = getAutoPublishCountInWindow();
            var lastAuto = getLastAutoPublishTime();
            var lastAutoAgo = lastAuto ? Math.floor((Date.now() - lastAuto) / 86400000) + '天前' : '(从未)';
            var nextAt = parseInt(localStorage.getItem('momentNextAutoPublishAt') || '0', 10);
            var lib = getStickerLibrary();

            console.log('====== 朋友圈自动发帖状态 ======');
            console.log('字卡库数量:', getReplyLibrary().length);
            console.log('对方表情库数量:', lib.length);
            console.log('自动生成动态总数:', autoCount);
            console.log('30天内已自动发:', windowCount, '/', CONFIG.MONTHLY_AUTO_LIMIT);
            console.log('距上次自动发:', lastAutoAgo);
            console.log('下次排期:', nextAt ? new Date(nextAt).toLocaleString() : '(未设置)');
            console.log('距现在:', nextAt ? Math.round((nextAt - Date.now()) / 1000) + '秒' : '-');
            console.log('调度器状态:', autoCheckTimer ? '运行中' : '未启动');
            console.log('待执行回复任务:', pendingTasks.length);
            pendingTasks.forEach(function(t) {
                console.log('  →', t.triggerType, '排期:', new Date(t.scheduledAt).toLocaleString());
            });
            console.log('当前头像设置:', chatAvatarSettings);
            return {
                autoCount: autoCount,
                windowCount: windowCount,
                nextAt: nextAt,
                replyLib: getReplyLibrary().length,
                partnerStickerLib: lib.length,
                pendingTasks: pendingTasks.length,
                avatarSettings: chatAvatarSettings
            };
        },

        reloadLibs: function() {
            return loadLibsFromStorage().then(function() {
                getReplyLibrary();
                getStickerLibrary();
                console.log('字卡库:', getReplyLibrary().length, '对方表情库:', getStickerLibrary().length);
            });
        }
    };
})();