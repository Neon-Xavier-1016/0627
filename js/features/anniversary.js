/**
 * anniversary.js - 完整修复版 + 置顶功能
 * 支持纪念日/倒数日/生日 类型切换 + 置顶
 */
(function() {
    'use strict';

    let currentEditId = null;
    let currentType = 'anniversary';
    let activeAnnId = null;

    // ===== 辅助函数 =====
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : m === '>' ? '&gt;' : m);
    }

    function saveAnniversaries() {
        if (typeof throttledSaveData === 'function') throttledSaveData();
        if (typeof localforage !== 'undefined') {
            localforage.setItem('my_anniversaries', window.anniversaries).then(() => {
                console.log('✅ 纪念日数据已保存');
            }).catch(err => console.warn('⚠️ 保存失败:', err));
        }
    }

    // ===== 烟花控制（保留） =====
    let fireworkRunning = false;
    let fireworkCanvas = null;
    let fireworkCtx = null;
    let fireworkParticles = [];
    let fireworkRAF = null;
    let fireworkRounds = 0;
    const FIREWORK_MAX_ROUNDS = 6;
    let fireworkW = 0, fireworkH = 0;

    function fireworkResize() {
        if (!fireworkCanvas) return;
        fireworkW = fireworkCanvas.width = window.innerWidth;
        fireworkH = fireworkCanvas.height = window.innerHeight;
    }

    class FireworkParticle {
        constructor(x, y, r, g, b) {
            this.x = x;
            this.y = y;
            this.r = r;
            this.g = g;
            this.b = b;
            const angle = Math.random() * 2 * Math.PI;
            const speed = Math.random() * 6 + 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed - 1;
            this.alpha = 1;
            this.decay = Math.random() * 0.015 + 0.006;
            this.size = Math.random() * 4 + 2;
        }
        update() {
            this.vx *= 0.99;
            this.vy += 0.04;
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= this.decay;
            this.size *= 0.998;
        }
        draw(ctx) {
            if (this.alpha <= 0 || this.size < 0.3) return;
            ctx.globalAlpha = this.alpha;
            ctx.shadowBlur = 18;
            ctx.shadowColor = `rgba(${this.r},${this.g},${this.b},${this.alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${this.alpha * 0.15})`;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${this.r},${this.g},${this.b})`;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function fireworkBurst(x, y) {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        const count = 80 + Math.floor(Math.random() * 80);
        for (let i = 0; i < count; i++) {
            const p = new FireworkParticle(x, y, r, g, b);
            p.r += (Math.random() - 0.5) * 50;
            p.g += (Math.random() - 0.5) * 50;
            p.b += (Math.random() - 0.5) * 50;
            p.r = Math.max(0, Math.min(255, p.r));
            p.g = Math.max(0, Math.min(255, p.g));
            p.b = Math.max(0, Math.min(255, p.b));
            fireworkParticles.push(p);
        }
        if (Math.random() > 0.4) {
            setTimeout(() => {
                const x2 = x + (Math.random() - 0.5) * 120;
                const y2 = y + (Math.random() - 0.5) * 100;
                const r2 = Math.floor(Math.random() * 256);
                const g2 = Math.floor(Math.random() * 256);
                const b2 = Math.floor(Math.random() * 256);
                for (let i = 0; i < 35; i++) {
                    const p = new FireworkParticle(x2, y2, r2, g2, b2);
                    p.r += (Math.random() - 0.5) * 50;
                    p.g += (Math.random() - 0.5) * 50;
                    p.b += (Math.random() - 0.5) * 50;
                    p.r = Math.max(0, Math.min(255, p.r));
                    p.g = Math.max(0, Math.min(255, p.g));
                    p.b = Math.max(0, Math.min(255, p.b));
                    fireworkParticles.push(p);
                }
            }, 300 + Math.random() * 400);
        }
    }

    function fireworkLaunch() {
        if (!fireworkRunning) return;
        const x = Math.random() * fireworkW * 0.8 + fireworkW * 0.1;
        const y = Math.random() * fireworkH * 0.5 + fireworkH * 0.1;
        setTimeout(() => fireworkBurst(x, y), 150 + Math.random() * 350);
        if (Math.random() > 0.5) {
            setTimeout(() => {
                const x2 = Math.random() * fireworkW * 0.8 + fireworkW * 0.1;
                const y2 = Math.random() * fireworkH * 0.5 + fireworkH * 0.1;
                fireworkBurst(x2, y2);
            }, 400 + Math.random() * 600);
        }
    }

    function fireworkAnimate() {
        if (!fireworkRunning || !fireworkCtx) return;
        const ctx = fireworkCtx;
        ctx.clearRect(0, 0, fireworkW, fireworkH);
        fireworkParticles = fireworkParticles.filter(p => p.alpha > 0.01 && p.size > 0.3);
        fireworkParticles.forEach(p => p.update());
        fireworkParticles.forEach(p => p.draw(ctx));
        if (fireworkParticles.length < 30 && fireworkRounds < FIREWORK_MAX_ROUNDS) {
            fireworkRounds++;
            const count = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                setTimeout(fireworkLaunch, i * 400 + Math.random() * 500);
            }
        }
        if (fireworkRounds >= FIREWORK_MAX_ROUNDS && fireworkParticles.length === 0) {
            fireworkRAF = requestAnimationFrame(fireworkAnimate);
            return;
        }
        fireworkRAF = requestAnimationFrame(fireworkAnimate);
    }

    window.startFireworks = function() {
        if (fireworkRunning) return;
        fireworkRunning = true;
        fireworkRounds = 0;
        fireworkParticles = [];
        if (fireworkCanvas) {
            fireworkCanvas.remove();
            fireworkCanvas = null;
        }
        fireworkCanvas = document.createElement('canvas');
        fireworkCanvas.id = 'firework-canvas';
        fireworkCanvas.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none;';
        document.body.appendChild(fireworkCanvas);
        fireworkCtx = fireworkCanvas.getContext('2d');
        fireworkResize();
        window.addEventListener('resize', fireworkResize);
        for (let i = 0; i < 4; i++) {
            setTimeout(fireworkLaunch, i * 300 + 200);
        }
        fireworkAnimate();
    };

    window.stopFireworks = function() {
        fireworkRunning = false;
        if (fireworkRAF) {
            cancelAnimationFrame(fireworkRAF);
            fireworkRAF = null;
        }
        if (fireworkCanvas) {
            fireworkCanvas.remove();
            fireworkCanvas = null;
            fireworkCtx = null;
        }
        fireworkParticles = [];
        window.removeEventListener('resize', fireworkResize);
    };

    // ===== 爱心弹窗 =====
    function showHeartModal(title, message) {
        window.startFireworks();
        const oldEl = document.getElementById('heart-modal-container');
        if (oldEl) oldEl.remove();

        const container = document.createElement('div');
        container.id = 'heart-modal-container';
        container.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(3px);
            padding: 20px;
            box-sizing: border-box;
            animation: heartFadeIn 0.4s ease;
        `;

        if (!document.getElementById('heart-styles-v2')) {
            const style = document.createElement('style');
            style.id = 'heart-styles-v2';
            style.textContent = `
                @keyframes heartFadeIn {
                    0% { opacity: 0; transform: scale(0.85) translateY(20px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes heartbeatV2 {
                    0%, 100% { transform: scale(1); }
                    14% { transform: scale(1.04); }
                    28% { transform: scale(1); }
                    42% { transform: scale(1.02); }
                    70% { transform: scale(1); }
                }
                @keyframes glowV2 {
                    0%, 100% { box-shadow: 0 0 30px rgba(255, 182, 193, 0.3); }
                    50% { box-shadow: 0 0 60px rgba(255, 182, 193, 0.5), 0 0 100px rgba(255, 182, 193, 0.15); }
                }
                .heart-wrapper {
                    position: relative;
                    width: min(420px, 90vw);
                    max-height: 80vh;
                    aspect-ratio: 1 / 0.9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: heartbeatV2 1.6s ease-in-out infinite, glowV2 2.8s ease-in-out infinite;
                }
                .heart-svg-bg {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    filter: drop-shadow(0 8px 30px rgba(255, 150, 170, 0.3));
                }
                .heart-content-layer {
                    position: relative;
                    z-index: 2;
                    width: 78%;
                    height: 76%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: #5a3d4a;
                    padding: 4px;
                    box-sizing: border-box;
                }
                .heart-title-v2 {
                    font-size: clamp(24px, 6vw, 34px);
                    font-weight: 700;
                    letter-spacing: 2px;
                    margin-bottom: 6px;
                    color: #6b3f50;
                    text-shadow: 0 2px 10px rgba(255,255,255,0.4);
                    line-height: 1.2;
                    flex-shrink: 0;
                }
                .heart-msg-v2 {
                    font-size: clamp(16px, 4.2vw, 22px);
                    line-height: 1.8;
                    max-height: 62%;
                    overflow-y: auto;
                    padding: 4px 6px;
                    color: #4a2d38;
                    white-space: pre-wrap;
                    word-break: break-word;
                    width: 100%;
                    font-weight: 500;
                    text-shadow: 0 1px 6px rgba(255,255,255,0.2);
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .heart-btn-v2 {
                    margin-top: 8px;
                    padding: 10px 32px;
                    border: 2px solid rgba(90, 61, 74, 0.2);
                    border-radius: 40px;
                    background: rgba(255,255,255,0.5);
                    color: #5a3d4a;
                    font-size: clamp(13px, 3vw, 16px);
                    font-weight: 600;
                    cursor: pointer;
                    backdrop-filter: blur(4px);
                    transition: all 0.2s;
                    font-family: inherit;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(255,255,255,0.2);
                }
                .heart-btn-v2:active { transform: scale(0.95); }
                .heart-deco-v2 {
                    position: absolute;
                    font-size: clamp(16px, 3vw, 24px);
                    opacity: 0.3;
                    pointer-events: none;
                    animation: floatDecoV2 3s ease-in-out infinite;
                }
                @keyframes floatDecoV2 {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-12px); }
                }
                @media (max-width: 480px) {
                    .heart-content-layer { width: 82%; height: 78%; }
                    .heart-title-v2 { font-size: 20px; }
                    .heart-msg-v2 { font-size: 15px; max-height: 58%; }
                }
            `;
            document.head.appendChild(style);
        }

        const gradId = 'heartGrad_' + Date.now();
        const svgHtml = `
        <svg class="heart-svg-bg" viewBox="0 0 100 90" preserveAspectRatio="none">
            <defs>
                <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ffd9e2" />
                    <stop offset="100%" stop-color="#ffb6c1" />
                </linearGradient>
                <filter id="shadow_${gradId}" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="rgba(255,150,170,0.3)" />
                </filter>
            </defs>
            <path d="M50,88 C20,68 0,50 0,32 C0,14 18,2 35,2 C45,2 50,10 50,18 C50,10 55,2 65,2 C82,2 100,14 100,32 C100,50 80,68 50,88 Z"
                  fill="url(#${gradId})"
                  filter="url(#shadow_${gradId})"
                  stroke="rgba(255,255,255,0.6)"
                  stroke-width="1.5" />
        </svg>
        `;

        const decos = ['🌸', '💕', '🌷', '✨'];
        const posList = [
            { top: '6%', left: '6%' },
            { top: '6%', right: '6%' },
            { bottom: '6%', left: '6%' },
            { bottom: '6%', right: '6%' }
        ];
        let decoHtml = '';
        posList.forEach((p, i) => {
            const style = `top:${p.top};left:${p.left || 'auto'};right:${p.right || 'auto'};bottom:${p.bottom || 'auto'};animation-delay:${i * 0.4}s;`;
            decoHtml += `<span class="heart-deco-v2" style="${style}">${decos[i % decos.length]}</span>`;
        });

        const safeMsg = escapeHtml(message || '❤️').replace(/\n/g, '<br>');

        container.innerHTML = `
            <div class="heart-wrapper">
                ${svgHtml}
                <div class="heart-content-layer">
                    ${decoHtml}
                    <div class="heart-title-v2">${title}</div>
                    <div class="heart-msg-v2">${safeMsg}</div>
                    <button class="heart-btn-v2" id="heart-close-btn-v2">💕 收下祝福</button>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        const closeModal = () => {
            const el = document.getElementById('heart-modal-container');
            if (el) {
                el.style.transition = 'opacity 0.3s ease';
                el.style.opacity = '0';
                setTimeout(() => {
                    el.remove();
                    if (typeof window.stopFireworks === 'function') {
                        setTimeout(window.stopFireworks, 300);
                    }
                }, 350);
            }
            window.pendingImportantDay = null;
            document.removeEventListener('keydown', escHandler);
        };

        document.getElementById('heart-close-btn-v2').addEventListener('click', closeModal);
        container.addEventListener('click', (e) => {
            if (e.target === container) closeModal();
        });

        const escHandler = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        document.addEventListener('keydown', escHandler);
        window._closeHeartModal = closeModal;
    }

    // ===== 检测重要日 =====
    window.pendingImportantDay = null;

    window.checkAndStoreImportantDay = function() {
        window.pendingImportantDay = null;
        const today = new Date();
        const todayStr = today.toDateString();

        for (const ann of window.anniversaries) {
            const target = new Date(ann.date);
            let matched = false;
            let msg = '';

            if (ann.type === 'anniversary') {
                const days = Math.floor((today - target) / 86400000);
                if (days < 0) continue;
                const rules = ann.remindRules || [];
                for (const rule of rules) {
                    if (rule === '100' && days % 100 === 0 && days !== 0) matched = true;
                    else if (rule === '1000' && days % 1000 === 0 && days !== 0) matched = true;
                    else if (rule.startsWith('custom:')) {
                        const customDay = parseInt(rule.split(':')[1]);
                        if (days === customDay) matched = true;
                    }
                    else if (rule.startsWith('anniversaryYearly:')) {
                        const isSameMD = target.getMonth() === today.getMonth() && target.getDate() === today.getDate();
                        if (isSameMD) {
                            const years = today.getFullYear() - target.getFullYear();
                            const interval = parseInt(rule.split(':')[1]);
                            if (interval > 0 && years % interval === 0 && years > 0) matched = true;
                        }
                    }
                    if (matched) break;
                }
                if (matched) {
                    const msgLines = ann.customMessages || [];
                    msg = msgLines.length ? msgLines[Math.floor(Math.random() * msgLines.length)] : `今天是 ${ann.name}！`;
                }
            } else if (ann.type === 'birthday') {
                const isSameMD = target.getMonth() === today.getMonth() && target.getDate() === today.getDate();
                if (isSameMD) {
                    const rules = ann.remindRules || [];
                    if (rules.includes('yearly')) matched = true;
                    else if (rules.includes('decade')) {
                        const years = today.getFullYear() - target.getFullYear();
                        if (years % 10 === 0 && years > 0) matched = true;
                    }
                    else if (rules.some(r => r.startsWith('interval:'))) {
                        const years = today.getFullYear() - target.getFullYear();
                        for (const r of rules) {
                            if (r.startsWith('interval:')) {
                                const interval = parseInt(r.split(':')[1]);
                                if (interval > 0 && years % interval === 0 && years > 0) matched = true;
                                break;
                            }
                        }
                    }
                    if (matched) {
                        const msgLines = ann.customMessages || [];
                        msg = msgLines.length ? msgLines[Math.floor(Math.random() * msgLines.length)] : `🎂 ${ann.name}，生日快乐！`;
                    }
                }
            } else if (ann.type === 'countdown') {
                // ===== 新增：倒数日检测 =====
                const diffDays = Math.ceil((target - today) / 86400000);
                if (diffDays === 0) {
                    const shownKey = 'anniversary_shown_' + ann.id;
                    const lastShown = localStorage.getItem(shownKey);
                    if (lastShown === todayStr) {
                        console.log(`⏭️ 倒数日「${ann.name}」今天已弹过，跳过`);
                        continue;
                    }
                    matched = true;
                    const msgLines = ann.customMessages || [];
                    msg = msgLines.length ? msgLines[Math.floor(Math.random() * msgLines.length)] : `今天就是 ${ann.name} 的日子！🎉`;
                    localStorage.setItem(shownKey, todayStr);
                }
            }

            if (matched) {
                window.pendingImportantDay = { ann, msg };
                console.log('✅ 已存储纪念日信息:', msg);
                return;
            }
        }
        console.log('今日无匹配的纪念日');
    };

    window.showImportantDayModal = function() {
        if (!window.pendingImportantDay) return;
        const { ann, msg } = window.pendingImportantDay;
        const type = (ann && ann.type) ? ann.type : 'anniversary';
        // 标题使用纪念日名称
        const title = ann.name || '重要日';
        // 获取对方昵称（默认“梦角”）
        const partnerName = (window.settings && window.settings.partnerName) ? window.settings.partnerName : '梦角';
        // 组装消息，若 msg 为空则使用默认
        let content = msg;
        if (!content) {
            content = type === 'birthday' ? '生日快乐！' : '纪念日快乐！';
        }
        const fullMsg = `${partnerName}：${content}`;
        showHeartModal(title, fullMsg);
        localStorage.setItem('lastSpecialNotifyDate', new Date().toDateString());
        window.pendingImportantDay = null;
    };

    window.showImportantDayModalIfNeeded = function() {
        if (!window.pendingImportantDay) return;
        const periodModal = document.getElementById('period-reminder-modal');
        if (periodModal && periodModal.style.display === 'flex') {
            const observer = new MutationObserver(function() {
                if (periodModal.style.display !== 'flex') {
                    observer.disconnect();
                    setTimeout(() => window.showImportantDayModal(), 400);
                }
            });
            observer.observe(periodModal, { attributes: true, attributeFilter: ['style'] });
            setTimeout(() => {
                observer.disconnect();
                window.showImportantDayModal();
            }, 10000);
        } else {
            setTimeout(() => window.showImportantDayModal(), 400);
        }
    };

    // ===== 渲染列表（含置顶支持） =====
    function renderList() {
        const container = document.getElementById('ann-list-container');
        if (!container) return;
        const anniversaries = window.anniversaries || [];
        if (!anniversaries.length) {
            container.innerHTML = `<div class="ann-empty"><div class="ann-empty-icon">💝</div><p>还没有纪念日<br>去添加一个属于你们的日子吧~</p></div>`;
            document.getElementById('ann-header-card')?.style.setProperty('display', 'none');
            return;
        }
        // 排序：置顶优先，再按日期升序
        const sorted = [...anniversaries].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(a.date) - new Date(b.date);
        });
        const today = new Date();
        let html = '';
        for (const ann of sorted) {
            const target = new Date(ann.date);
            let diffDays = 0, typeLabel = '', dayLabel = '';
            const type = ann.type || 'anniversary';
            if (type === 'countdown') {
                diffDays = Math.ceil((target - today) / 86400000);
                if (diffDays < 0) diffDays = 0;
                typeLabel = '倒数';
                dayLabel = '天后';
            } else if (type === 'birthday') {
                let age = today.getFullYear() - target.getFullYear();
                if (today.getMonth() < target.getMonth() || (today.getMonth() === target.getMonth() && today.getDate() < target.getDate())) age--;
                diffDays = age >= 0 ? age : 0;
                typeLabel = '生日';
                dayLabel = '岁';
            } else {
                diffDays = Math.floor((today - target) / 86400000);
                if (diffDays < 0) diffDays = 0;
                typeLabel = '纪念';
                dayLabel = '天';
            }

            // ===== 为“生日”标签添加淡橙色内联样式（加 !important 确保覆盖） =====
            let tagStyle = '';
            if (type === 'birthday') {
                tagStyle = ' style="background: #FFE0B2 !important; color: #5d4037 !important; border: 1.5px solid #FFB74D !important;"';
            }

            // 置顶按钮样式
            const isPinned = ann.pinned === true;
            const pinColor = isPinned ? 'var(--accent-color)' : 'var(--text-secondary)';
            const pinRotation = isPinned ? '0deg' : '45deg';

            html += `
                <div class="ann-item-card ${type === 'countdown' ? 'type-future' : 'type-past'}" data-ann-id="${ann.id}" data-type="${type}" style="cursor:pointer;">
                    <div class="ann-item-left">
                        <div class="ann-item-name">${escapeHtml(ann.name)}<span class="ann-tag"${tagStyle}>${typeLabel}</span></div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <!-- 置顶按钮 -->
                        <div class="ann-pin-btn" onclick="event.stopPropagation(); window._togglePin(${ann.id})"
                             title="${isPinned ? '取消置顶' : '置顶'}"
                             style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(var(--accent-color-rgb,180,140,100),0.08);color:${pinColor};cursor:pointer;transition:all 0.2s;">
                            <i class="fas fa-thumbtack" style="transform: rotate(${pinRotation});"></i>
                        </div>
                        <div class="ann-item-right">
                            <div class="ann-item-days">${diffDays.toLocaleString()}</div>
                            <div class="ann-item-days-unit">${dayLabel}</div>
                        </div>
                        <div class="ann-edit-btn" onclick="event.stopPropagation(); window._editAnniversary(${ann.id})" title="编辑" style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(var(--accent-color-rgb,180,140,100),0.1);color:var(--accent-color);cursor:pointer;"><i class="fas fa-pencil-alt"></i></div>
                        <div class="ann-delete-btn" onclick="event.stopPropagation(); window._deleteAnniversary(${ann.id})" title="删除" style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,80,80,0.1);color:#ff5050;cursor:pointer;"><i class="fas fa-times"></i></div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
        // 更新头部
        const first = sorted[0];
        if (first && !activeAnnId) fillHeaderCard(first);
        else if (activeAnnId) {
            const active = sorted.find(a => a.id == activeAnnId);
            if (active) fillHeaderCard(active);
            else fillHeaderCard(first);
        }
    }

    async function fillHeaderCard(ann) {
        if (!ann) return;
        activeAnnId = ann.id;
        const header = document.getElementById('ann-header-card');
        const toolbar = document.getElementById('ann-card-toolbar');
        if (header) header.style.display = 'block';
        if (toolbar) toolbar.style.display = 'flex';
        const isCountdown = ann.type === 'countdown';
        const isBirthday = ann.type === 'birthday';
        const target = new Date(ann.date);
        const today = new Date();
        let diffDays = 0, unit = '天';
        if (isCountdown) {
            diffDays = Math.ceil((target - today) / 86400000);
            if (diffDays < 0) diffDays = 0;
            unit = '天后';
        } else if (isBirthday) {
            let age = today.getFullYear() - target.getFullYear();
            if (today.getMonth() < target.getMonth() || (today.getMonth() === target.getMonth() && today.getDate() < target.getDate())) age--;
            diffDays = age >= 0 ? age : 0;
            unit = '岁';
        } else {
            diffDays = Math.floor((today - target) / 86400000);
            if (diffDays < 0) diffDays = 0;
        }
        document.getElementById('ann-header-title').textContent = ann.name;
        document.getElementById('ann-header-date').textContent = ann.date;
        const daysEl = document.getElementById('ann-header-days');
        if (daysEl) daysEl.innerHTML = `${diffDays.toLocaleString()}<span class="ann-header-days-unit">${unit}</span>`;
        const iconEl = document.getElementById('ann-header-icon');
        const labelEl = document.getElementById('ann-header-label');
        if (iconEl) iconEl.textContent = isCountdown ? '♡' : (isBirthday ? '🎂' : '♥');
        if (labelEl) labelEl.textContent = isCountdown ? 'COUNTDOWN' : (isBirthday ? 'BIRTHDAY' : 'ANNIVERSARY');
        if (typeof localforage !== 'undefined' && window.SESSION_ID) {
            const bgKey = `${APP_PREFIX}${SESSION_ID}_annHeaderBg_${ann.id}`;
            const bg = await localforage.getItem(bgKey);
            const bgEl = document.getElementById('ann-header-card-bg');
            if (bgEl) bgEl.style.backgroundImage = bg ? `url(${bg})` : '';
        }
    }

    // ===== 类型切换（核心功能） =====
    function selectAnnType(type) {
        console.log('🔄 selectAnnType 被调用, type=', type);
        currentType = type;

        // 更新按钮高亮
        document.querySelectorAll('.ann-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // 更新描述文字
        const descMap = {
            anniversary: '计算从过去某一天到现在已经过了多少天 (例如: 恋爱纪念日)',
            countdown: '计算从现在到未来某一天还剩下多少天 (例如: 对方生日)',
            birthday: '每年当天会触发专属通知与寄语 (例如: 生日)'
        };
        const descSpan = document.getElementById('ann-type-desc');
        if (descSpan) descSpan.textContent = descMap[type] || '';

        // 切换提醒选项显示
        const annOpt = document.getElementById('ann-opt-anniversary');
        const birOpt = document.getElementById('ann-opt-birthday');
        if (annOpt) annOpt.style.display = (type === 'anniversary') ? 'block' : 'none';
        if (birOpt) birOpt.style.display = (type === 'birthday') ? 'block' : 'none';

        console.log('✅ 类型已切换为:', type);
    }

    // ===== 编辑器打开 =====
    function openEditor(ann = null) {
        console.log('📂 openEditor 被调用, ann=', ann);
        const slide = document.getElementById('ann-editor-slide');
        if (!slide) {
            console.warn('⚠️ 未找到 ann-editor-slide');
            return;
        }

        // 强制脱离父容器限制，独立于模态框
        slide.style.position = 'fixed';
        slide.style.top = '0';
        slide.style.right = '0';
        slide.style.width = '100%';
        slide.style.maxWidth = '420px';
        slide.style.height = '100%';
        slide.style.maxHeight = '100vh';
        slide.style.zIndex = '10000';
        slide.style.background = 'var(--secondary-bg, #1a1a2e)';
        slide.style.display = 'flex';
        slide.style.flexDirection = 'column';
        slide.style.pointerEvents = 'auto';
        slide.style.overflow = 'hidden';
        slide.style.transform = 'translateX(0)';
        slide.style.transition = 'transform 0.3s ease';
        slide.style.visibility = 'visible';
        slide.style.opacity = '1';
        slide.classList.add('active');

        // 设置内容区域可滚动
        const content = slide.querySelector('.ann-editor-content');
        if (content) {
            content.style.flex = '1';
            content.style.overflowY = 'auto';
            content.style.overflowX = 'hidden';
            content.style.webkitOverflowScrolling = 'touch';
            content.style.padding = '16px 20px 20px';
            content.style.touchAction = 'pan-y';
            content.style.pointerEvents = 'auto';
        }

        // 确保退出按钮可点击并重新绑定事件
        const closeBtn = document.getElementById('close-ann-editor');
        if (closeBtn) {
            closeBtn.style.pointerEvents = 'auto';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.position = 'relative';
            closeBtn.style.zIndex = '10001';
            // 移除所有已有监听器，使用新监听
            closeBtn.replaceWith(closeBtn.cloneNode(true));
            const newCloseBtn = document.getElementById('close-ann-editor');
            newCloseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('❌ 点击了“关闭编辑器”');
                closeEditor();
            });
        }

        // 填充数据...
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        const setChecked = (id, checked) => {
            const el = document.getElementById(id);
            if (el) el.checked = checked;
        };

        if (ann) {
            currentEditId = ann.id;
            const titleEl = document.getElementById('ann-editor-title');
            if (titleEl) titleEl.innerText = '编辑重要日';
            setVal('ann-input-name', ann.name || '');
            setVal('ann-input-date', ann.date || '');
            currentType = ann.type || 'anniversary';
            const rules = ann.remindRules || [];

            document.querySelectorAll('.ann-reminder-checkbox').forEach(cb => cb.checked = false);
            setVal('ann-opt-custom-days', '');

            rules.forEach(rule => {
                if (rule === '100') setChecked('ann-opt-100', true);
                else if (rule === '1000') setChecked('ann-opt-1000', true);
                else if (rule === 'yearly') setChecked('ann-opt-yearly', true);
                else if (rule === 'decade') setChecked('ann-opt-decade', true);
                else if (rule.startsWith('custom:')) {
                    setChecked('ann-opt-custom-check', true);
                    const days = rule.split(':')[1];
                    setVal('ann-opt-custom-days', days);
                }
                else if (rule.startsWith('interval:')) {
                    setChecked('ann-opt-interval-check', true);
                    const years = rule.split(':')[1];
                    setVal('ann-opt-interval-years', years);
                }
                else if (rule.startsWith('anniversaryYearly:')) {
                    setChecked('ann-opt-yearly-interval-check', true);
                    const years = rule.split(':')[1];
                    setVal('ann-opt-yearly-interval-val', years);
                }
            });

            const msgTa = document.getElementById('ann-custom-message');
            if (msgTa) msgTa.value = (ann.customMessages || []).join('\n');
        } else {
            const activeBtn = document.querySelector('.ann-type-btn.active');
            currentType = activeBtn ? activeBtn.dataset.type : 'anniversary';
            currentEditId = null;
            const titleEl = document.getElementById('ann-editor-title');
            if (titleEl) titleEl.innerText = '添加重要日';
            setVal('ann-input-name', '');
            setVal('ann-input-date', '');
            document.querySelectorAll('.ann-reminder-checkbox').forEach(cb => cb.checked = false);
            setVal('ann-opt-custom-days', '');
            setVal('ann-opt-yearly-interval-val', '');
            setVal('ann-opt-interval-years', '');
            const msgTa = document.getElementById('ann-custom-message');
            if (msgTa) msgTa.value = '';
        }

        // 同步类型 UI
        document.querySelectorAll('.ann-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === currentType);
        });

        const descMap = {
            anniversary: '计算从过去某一天到现在已经过了多少天',
            countdown: '计算从现在到未来某一天还剩下多少天',
            birthday: '每年当天会触发专属通知与寄语'
        };
        const descSpan = document.getElementById('ann-type-desc');
        if (descSpan) descSpan.textContent = descMap[currentType] || '';

        const annOpt = document.getElementById('ann-opt-anniversary');
        const birOpt = document.getElementById('ann-opt-birthday');
        if (annOpt) annOpt.style.display = (currentType === 'anniversary') ? 'block' : 'none';
        if (birOpt) birOpt.style.display = (currentType === 'birthday') ? 'block' : 'none';

        slide.classList.add('active');
    }

    function closeEditor() {
        const slide = document.getElementById('ann-editor-slide');
        if (slide) {
            slide.classList.remove('active');
            slide.style.transform = 'translateX(100%)';
            slide.style.opacity = '0';
            setTimeout(() => {
                slide.style.display = 'none';
                slide.style.visibility = 'hidden';
            }, 350);
        }
        currentEditId = null;
        console.log('✅ 编辑器已关闭');
    }

    // ===== 保存（保留 pinned 字段） =====
    function saveAnniversary() {
        const nameInput = document.getElementById('ann-input-name');
        const dateInput = document.getElementById('ann-input-date');
        const name = nameInput ? nameInput.value.trim() : '';
        const date = dateInput ? dateInput.value : '';
        if (!name || !date) {
            if (typeof showNotification === 'function') showNotification('请填写名称和日期', 'error');
            else alert('请填写名称和日期');
            return;
        }

        const activeBtn = document.querySelector('.ann-type-btn.active');
        let type = activeBtn ? activeBtn.dataset.type : currentType;
        if (!type) type = 'anniversary';
        console.log('📌 保存类型:', type);

        let remindRules = [];
        const isChecked = (id) => {
            const el = document.getElementById(id);
            return el ? el.checked : false;
        };
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        if (isChecked('ann-opt-100')) remindRules.push('100');
        if (isChecked('ann-opt-1000')) remindRules.push('1000');

        if (type === 'anniversary') {
            if (isChecked('ann-opt-custom-check')) {
                const daysRaw = getVal('ann-opt-custom-days');
                if (daysRaw) {
                    daysRaw.split(/[,\n]+/).forEach(d => {
                        const num = parseInt(d.trim());
                        if (!isNaN(num) && num > 0) remindRules.push(`custom:${num}`);
                    });
                }
            }
            if (isChecked('ann-opt-yearly-interval-check')) {
                const years = parseInt(getVal('ann-opt-yearly-interval-val'));
                if (years > 0) remindRules.push(`anniversaryYearly:${years}`);
            }
        } else if (type === 'birthday') {
            if (isChecked('ann-opt-yearly')) remindRules.push('yearly');
            if (isChecked('ann-opt-decade')) remindRules.push('decade');
            if (isChecked('ann-opt-interval-check')) {
                const years = parseInt(getVal('ann-opt-interval-years'));
                if (years > 0) remindRules.push(`interval:${years}`);
            }
        }

        const msgTa = document.getElementById('ann-custom-message');
        const customMsgRaw = msgTa ? msgTa.value : '';
        const customMessages = customMsgRaw.split('\n').filter(l => l.trim().length > 0);

        // 获取原有 pinned 状态（编辑时保留）
        let pinned = false;
        if (currentEditId) {
            const existing = window.anniversaries.find(a => a.id === currentEditId);
            if (existing) pinned = existing.pinned === true;
        }

        const newAnn = {
            id: currentEditId || Date.now(),
            name: name,
            date: date,
            type: type,
            remindRules: remindRules,
            customMessages: customMessages,
            pinned: pinned
        };

        if (currentEditId) {
            const idx = window.anniversaries.findIndex(a => a.id === currentEditId);
            if (idx !== -1) window.anniversaries[idx] = newAnn;
        } else {
            window.anniversaries.push(newAnn);
        }

        saveAnniversaries();
        renderList();
        closeEditor();
        if (typeof showNotification === 'function') showNotification('重要日已保存', 'success');
        console.log('✅ 已保存记录:', newAnn);
    }

    // ===== 删除 =====
    function deleteAnniversary(id) {
        if (!confirm('确定要删除这个重要日吗？')) return;
        window.anniversaries = window.anniversaries.filter(a => a.id !== id);
        if (activeAnnId === id) activeAnnId = null;
        saveAnniversaries();
        renderList();
        if (typeof showNotification === 'function') showNotification('已删除', 'success');
    }

    // ===== 置顶切换（新增） =====
    window._togglePin = function(id) {
        const ann = window.anniversaries.find(a => a.id === id);
        if (ann) {
            ann.pinned = !ann.pinned;
            saveAnniversaries();
            activeAnnId = null;   // ← 加上这一行
            renderList();
            if (typeof showNotification === 'function') {
                showNotification(ann.pinned ? '已置顶 ✦' : '取消置顶', 'success');
            }
        }
    };
    // ===== 清除卡片背景图 =====
    function clearAnnCardBg() {
        if (!activeAnnId || !window.SESSION_ID) {
            console.warn('无法清除背景图');
            return;
        }
        const bgKey = `${APP_PREFIX}${SESSION_ID}_annHeaderBg_${activeAnnId}`;
        if (typeof localforage !== 'undefined') {
            localforage.removeItem(bgKey).then(() => {
                const bgEl = document.getElementById('ann-header-card-bg');
                if (bgEl) bgEl.style.backgroundImage = '';
                console.log('✅ 已清除卡片背景图');
            }).catch(err => console.warn('清除背景图失败:', err));
        }
    }

    // ===== 等待其他弹窗关闭 =====
    function waitForAllModalsAndShow() {
        function allModalsClosed() {
            const welcome = document.getElementById('welcome-animation');
            const welcomeHidden = !welcome || getComputedStyle(welcome).display === 'none' || welcome.style.opacity === '0';
            const daily = document.getElementById('daily-greeting-modal');
            const dailyHidden = !daily || daily.classList.contains('hidden') || daily.style.display === 'none';
            const period = document.getElementById('period-reminder-modal');
            const periodHidden = !period || period.style.display === 'none' || period.style.display === '';
            return welcomeHidden && dailyHidden && periodHidden;
        }

        const checkInterval = setInterval(() => {
            if (allModalsClosed()) {
                clearInterval(checkInterval);
                console.log('✅ 其他弹窗已关闭，现在弹出纪念日');
                if (window.pendingImportantDay) {
                    window.showImportantDayModal();
                }
            }
        }, 500);

        setTimeout(() => {
            clearInterval(checkInterval);
            if (window.pendingImportantDay) {
                console.log('⏰ 等待超时，强制弹出纪念日');
                window.showImportantDayModal();
            }
        }, 10000);
    }

    // ===== 列表点击 =====
    function handleListClick(e) {
        const card = e.target.closest('.ann-item-card');
        if (card && !e.target.closest('.ann-edit-btn') && !e.target.closest('.ann-delete-btn') && !e.target.closest('.ann-pin-btn')) {
            const id = parseInt(card.dataset.annId);
            const ann = window.anniversaries.find(a => a.id === id);
            if (ann) {
                console.log('📝 点击列表项，编辑:', ann.name);
                openEditor(ann);
            }
        }
    }

    // ===== 背景图上传 =====
    async function handleBgUpload(e) {
        const file = e.target.files[0];
        if (!file || !activeAnnId || !window.SESSION_ID) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const bgKey = `${APP_PREFIX}${SESSION_ID}_annHeaderBg_${activeAnnId}`;
            await localforage.setItem(bgKey, ev.target.result);
            const bgEl = document.getElementById('ann-header-card-bg');
            if (bgEl) bgEl.style.backgroundImage = `url(${ev.target.result})`;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    // ===== 事件绑定 =====
    function bindEvents() {
        console.log('🔗 bindEvents 执行');

        // 新增按钮
        // 新增按钮（使用 addEventListener 并重置状态）
        const addBtn = document.getElementById('open-ann-add-btn');
        if (addBtn) {
            addBtn.replaceWith(addBtn.cloneNode(true));
            const newBtn = document.getElementById('open-ann-add-btn');
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🖱️ 点击了“新增”按钮');
                // 先强制重置编辑器面板状态
                const slide = document.getElementById('ann-editor-slide');
                if (slide) {
                    slide.style.display = 'none';
                    slide.style.visibility = 'hidden';
                    slide.style.opacity = '0';
                    slide.style.transform = 'translateX(100%)';
                    slide.classList.remove('active');
                }
                // 延迟打开，确保状态重置完成
                setTimeout(() => {
                    openEditor();
                }, 50);
            });
        }

        // 保存按钮
        const saveBtn = document.getElementById('save-ann-btn');
        if (saveBtn) {
            saveBtn.onclick = function(e) {
                e.preventDefault();
                console.log('💾 点击了“保存”按钮');
                saveAnniversary();
            };
        }

        // 关闭编辑器按钮（已在 openEditor 中动态绑定，但此处保留备用）
        // 但为了保险，再绑定一次（防止 openEditor 未覆盖）
        const closeBtn = document.getElementById('close-ann-editor');
        if (closeBtn) {
            closeBtn.replaceWith(closeBtn.cloneNode(true));
            const newCloseBtn = document.getElementById('close-ann-editor');
            newCloseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('❌ 点击了“关闭编辑器”');
                closeEditor();
            });
        }

        // 类型选择器 - 使用事件委托
        const selector = document.querySelector('.ann-type-selector');
        if (selector) {
            selector.onclick = function(e) {
                const btn = e.target.closest('.ann-type-btn');
                if (btn) {
                    const type = btn.dataset.type;
                    console.log('🖱️ 点击类型按钮:', type);
                    selectAnnType(type);
                }
            };
            console.log('✅ 类型选择器已绑定点击事件');
        } else {
            console.warn('⚠️ 未找到 .ann-type-selector');
        }

        // 列表点击
        const listContainer = document.getElementById('ann-list-container');
        if (listContainer) {
            listContainer.onclick = handleListClick;
        }

        // 背景图上传
        const bgInput = document.getElementById('ann-header-bg-input');
        if (bgInput && typeof localforage !== 'undefined') {
            bgInput.onchange = handleBgUpload;
        }
    }

    // ===== 初始化 =====
    function init() {
        console.log('📌 init 执行, readyState:', document.readyState);
        if (!window.anniversaries) {
            window.anniversaries = [];
        }

        bindEvents();
        window.renderAnniversariesList = renderList;
        window.fillAnnHeaderCard = fillHeaderCard;
        window.addAnniversary = saveAnniversary;

        (async function loadAnniversaries() {
            try {
                if (typeof localforage !== 'undefined') {
                    const stored = await localforage.getItem('my_anniversaries');
                    if (stored && Array.isArray(stored) && stored.length > 0) {
                        window.anniversaries = stored;
                        console.log('✅ 已加载纪念日数据:', window.anniversaries.length, '条');
                    }
                }
            } catch (e) {
                console.warn('⚠️ 加载纪念日数据失败:', e);
            }
            renderList();
            window.checkAndStoreImportantDay();

            if (window.pendingImportantDay) {
                console.log('🎉 检测到匹配的纪念日');
                waitForAllModalsAndShow();
            }
        })();
    }

    // ===== 启动 =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===== 暴露全局函数 =====
    window.openEditor = openEditor;
    window.closeEditor = closeEditor;
    window.saveAnniversary = saveAnniversary;
    window.selectAnnType = selectAnnType;
    window.clearAnnCardBg = clearAnnCardBg;
    window._deleteAnniversary = deleteAnniversary;
    window._editAnniversary = (id) => {
        const ann = window.anniversaries.find(a => a.id === id);
        if (ann) openEditor(ann);
    };
    // 置顶函数已暴露 window._togglePin

    console.log('✅ 重要日函数已暴露到全局');
    console.log('✅ selectAnnType 类型:', typeof selectAnnType);
    console.log('✅ _togglePin 已暴露');
})();