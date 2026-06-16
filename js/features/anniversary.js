/**
 * anniversary.js - 爱心弹窗 + 心跳动画 + 烟花效果
 */
(function() {
    let currentEditId = null;
    let currentType = 'anniversary';
    let activeAnnId = null;

    // ---------- 辅助函数 ----------
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : m === '>' ? '&gt;' : m);
    }

        function saveAnniversaries() {
            // 1. 调用全局保存（兼容其他功能）
            if (typeof throttledSaveData === 'function') throttledSaveData();

            // 2. 使用固定 key 保存到 localforage（不依赖 SESSION_ID）
            if (typeof localforage !== 'undefined') {
                const fixedKey = 'my_anniversaries';
                localforage.setItem(fixedKey, window.anniversaries).then(() => {
                    console.log('✅ 纪念日数据已保存到 localforage (固定key)');
                }).catch(err => {
                    console.warn('⚠️ 纪念日保存失败:', err);
                });
            }
        }

    // ---------- 烟花控制（保持不变） ----------
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

    // ================================================================
    //  ⭐ 重写的 showHeartModal —— 淡粉色、大爱心、文字可见、移动适配
    // ================================================================
    function showHeartModal(title, message) {
        // 启动烟花
        window.startFireworks();

        // 移除旧弹窗（如果有）
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
            -webkit-backdrop-filter: blur(3px);
            padding: 20px;
            box-sizing: border-box;
            animation: heartFadeIn 0.4s ease;
        `;

        // 注入样式（只注入一次）
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
                .heart-msg-v2::-webkit-scrollbar {
                    width: 3px;
                }
                .heart-msg-v2::-webkit-scrollbar-thumb {
                    background: rgba(255, 182, 193, 0.5);
                    border-radius: 3px;
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
                .heart-btn-v2:active {
                    transform: scale(0.95);
                }
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
                    .heart-content-layer {
                        width: 82%;
                        height: 78%;
                    }
                    .heart-title-v2 {
                        font-size: 20px;
                    }
                    .heart-msg-v2 {
                        font-size: 15px;
                        max-height: 58%;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // 生成唯一的渐变 ID（避免缓存冲突）
        const gradId = 'heartGrad_' + Date.now();

        // 构造 SVG 心形（淡粉色渐变）
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
            <path d="M50,85 C20,65 0,48 0,32 C0,12 20,2 35,2 C45,2 50,12 50,22 C50,12 55,2 65,2 C80,2 100,12 100,32 C100,48 80,65 50,85 Z"
                  fill="url(#${gradId})"
                  filter="url(#shadow_${gradId})"
                  stroke="rgba(255,255,255,0.6)"
                  stroke-width="1.5" />
        </svg>
        `;

        // 装饰小元素（四个角）
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

        // 安全转义消息
        const safeMsg = escapeHtml(message || '❤️').replace(/\n/g, '<br>');

        // 组装弹窗 —— 标题固定为“纪念日庆祝”，忽略传入的 title
        container.innerHTML = `
            <div class="heart-wrapper">
                ${svgHtml}
                <div class="heart-content-layer">
                    ${decoHtml}
                    <div class="heart-title-v2">纪念日庆祝</div>
                    <div class="heart-msg-v2">${safeMsg}</div>
                    <button class="heart-btn-v2" id="heart-close-btn-v2">💕 收下祝福</button>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // ---------- 关闭逻辑 ----------
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

        // 挂载到全局方便外部调试
        window._closeHeartModal = closeModal;
    }

    // ---------- 检测与存储（完全不变） ----------
    window.pendingImportantDay = null;

    window.checkAndStoreImportantDay = function() {
        window.pendingImportantDay = null;
        const today = new Date();
        for (const ann of window.anniversaries) {
            const target = new Date(ann.date);
            if (ann.type === 'anniversary') {
                const days = Math.floor((today - target) / 86400000);
                if (days < 0) continue;
                const rules = ann.remindRules || [];
                for (const rule of rules) {
                    let matched = false;
                    if (rule === '100' && days % 100 === 0 && days !== 0) matched = true;
                    else if (rule === '1000' && days % 1000 === 0 && days !== 0) matched = true;
                   else if (rule.startsWith('custom:')) {
                       const customDay = parseInt(rule.split(':')[1]);
                       if (days + 1 === customDay) matched = true;   // ← 加上 +1
                   }
                    else if (rule.startsWith('anniversaryYearly:')) {
                        const isSameMD = target.getMonth() === today.getMonth() && target.getDate() === today.getDate();
                        if (isSameMD) {
                            const years = today.getFullYear() - target.getFullYear();
                            const interval = parseInt(rule.split(':')[1]);
                            if (interval > 0 && years % interval === 0 && years > 0) matched = true;
                        }
                    }
                    if (matched) {
                        const msgLines = ann.customMessages || [];
                        const msg = msgLines.length ? msgLines[Math.floor(Math.random() * msgLines.length)] : `今天是 ${ann.name}！`;
                        window.pendingImportantDay = { ann, msg };
                        console.log('✅ 已存储纪念日信息:', msg);
                        return;
                    }
                }
            } else if (ann.type === 'birthday') {
                const isSameMD = target.getMonth() === today.getMonth() && target.getDate() === today.getDate();
                if (isSameMD) {
                    const rules = ann.remindRules || [];
                    let matched = false;
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
                        const msg = msgLines.length ? msgLines[Math.floor(Math.random() * msgLines.length)] : `🎂 ${ann.name}，生日快乐！`;
                        window.pendingImportantDay = { ann, msg };
                        console.log('✅ 已存储生日信息:', msg);
                        return;
                    }
                }
            }
        }
        console.log('今日无匹配的纪念日');
    };

    // ---------- 显示弹窗（外部调用入口） ----------
    window.showImportantDayModal = function() {
        if (!window.pendingImportantDay) return;
        const { ann, msg } = window.pendingImportantDay;
        // 注意：这里传入的 title 会被 showHeartModal 内部忽略（固定为“纪念日庆祝”）
        // 但为了兼容，仍然传入原 title
        const type = (ann && ann.type) ? ann.type : 'anniversary';
        const title = type === 'birthday' ? '🎂 生日快乐' : '💖 重要日庆祝';
        showHeartModal(title, msg);
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

    // ---------- 渲染列表（不变） ----------
    function renderList() {
        const container = document.getElementById('ann-list-container');
        if (!container) return;
        const anniversaries = window.anniversaries || [];
        if (!anniversaries.length) {
            container.innerHTML = `<div class="ann-empty"><div class="ann-empty-icon">💝</div><p>还没有纪念日<br>去添加一个属于你们的日子吧~</p></div>`;
            document.getElementById('ann-header-card')?.style.setProperty('display', 'none');
            return;
        }
        const sorted = [...anniversaries].sort((a,b) => new Date(a.date) - new Date(b.date));
        const today = new Date();
        let html = '';
        for (const ann of sorted) {
            const target = new Date(ann.date);
            let diffDays = 0, typeLabel = '', dayLabel = '';
            if (ann.type === 'countdown') {
                diffDays = Math.ceil((target - today) / 86400000);
                if (diffDays < 0) diffDays = 0;
                typeLabel = '倒数';
                dayLabel = '天后';
            } else if (ann.type === 'birthday') {
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
            html += `
                <div class="ann-item-card ${ann.type === 'countdown' ? 'type-future' : 'type-past'}" data-ann-id="${ann.id}" style="cursor:pointer;">
                    <div class="ann-item-left">
                        <div class="ann-item-name">${escapeHtml(ann.name)}<span class="ann-tag">${typeLabel}</span></div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="ann-item-right"><div class="ann-item-days">${diffDays.toLocaleString()}</div><div class="ann-item-days-unit">${dayLabel}</div></div>
                        <div class="ann-edit-btn" onclick="event.stopPropagation(); window._editAnniversary(${ann.id})" title="编辑" style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(var(--accent-color-rgb,180,140,100),0.1);color:var(--accent-color);cursor:pointer;"><i class="fas fa-pencil-alt"></i></div>
                        <div class="ann-delete-btn" onclick="event.stopPropagation(); window._deleteAnniversary(${ann.id})" title="删除" style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,80,80,0.1);color:#ff5050;cursor:pointer;"><i class="fas fa-times"></i></div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
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

       // ---------- 编辑器（带防御检查） ----------
               function openEditor(ann = null) {
                   const slide = document.getElementById('ann-editor-slide');
                   if (!slide) return;

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

                       // 清除所有复选框（使用旧 ID 的类名）
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
                       currentType = 'anniversary';
                   }

                   document.querySelectorAll('.ann-type-btn').forEach(btn => {
                       btn.classList.toggle('active', btn.dataset.type === currentType);
                   });

                   const descMap = {
                       anniversary: '计算从过去某一天到现在已经过了多少天',
                       countdown: '计算从现在到未来某一天还剩下多少天',
                       birthday: '每年当天会触发专属通知与寄语'
                   };
                   const descSpan = document.getElementById('ann-type-desc');
                   if (descSpan) descSpan.textContent = descMap[currentType];

                   const annOpt = document.getElementById('ann-opt-anniversary');
                   const birOpt = document.getElementById('ann-opt-birthday');
                   if (annOpt) annOpt.style.display = currentType === 'anniversary' ? 'block' : 'none';
                   if (birOpt) birOpt.style.display = currentType === 'birthday' ? 'block' : 'none';

                   slide.classList.add('active');
               }

    function closeEditor() {
        const slide = document.getElementById('ann-editor-slide');
        if (slide) slide.classList.remove('active');
        currentEditId = null;
    }

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

                          const type = currentType;
                          let remindRules = [];

                          const isChecked = (id) => {
                              const el = document.getElementById(id);
                              return el ? el.checked : false;
                          };
                          const getVal = (id) => {
                              const el = document.getElementById(id);
                              return el ? el.value : '';
                          };

                          // 100天 / 1000天
                          if (isChecked('ann-opt-100')) remindRules.push('100');
                          if (isChecked('ann-opt-1000')) remindRules.push('1000');

                          if (type === 'anniversary') {
                              // 自定义天数
                              if (isChecked('ann-opt-custom-check')) {
                                  const daysRaw = getVal('ann-opt-custom-days');
                                  if (daysRaw) {
                                      daysRaw.split(/[,\n]+/).forEach(d => {
                                          const num = parseInt(d.trim());
                                          if (!isNaN(num) && num > 0) remindRules.push(`custom:${num}`);
                                      });
                                  }
                              }
                              // 间隔年提醒
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

                          const newAnn = {
                              id: currentEditId || Date.now(),
                              name: name,
                              date: date,
                              type: type,
                              remindRules: remindRules,
                              customMessages: customMessages
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
                      }

    function deleteAnniversary(id) {
        if (!confirm('确定要删除这个重要日吗？')) return;
        window.anniversaries = window.anniversaries.filter(a => a.id !== id);
        if (activeAnnId === id) activeAnnId = null;
        saveAnniversaries();
        renderList();
        if (typeof showNotification === 'function') showNotification('已删除', 'success');
    }

    window._deleteAnniversary = deleteAnniversary;
    window._editAnniversary = (id) => {
        const ann = window.anniversaries.find(a => a.id === id);
        if (ann) openEditor(ann);
    };
    window.selectAnnType = (type) => {
        currentType = type;
        document.querySelectorAll('.ann-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        const descMap = {
            anniversary: '计算从过去某一天到现在已经过了多少天',
            countdown: '计算从现在到未来某一天还剩下多少天',
            birthday: '每年当天会触发专属通知与寄语'
        };
        const descSpan = document.getElementById('ann-type-desc');
        if (descSpan) descSpan.textContent = descMap[type];
        const annOpt = document.getElementById('ann-opt-anniversary');
        const birOpt = document.getElementById('ann-opt-birthday');
        if (annOpt) annOpt.style.display = type === 'anniversary' ? 'block' : 'none';
        if (birOpt) birOpt.style.display = type === 'birthday' ? 'block' : 'none';
    };

    // ---------- 事件绑定（不变） ----------
    function bindEvents() {
        const addBtn = document.getElementById('open-ann-add-btn');
        if (addBtn) addBtn.onclick = () => openEditor();
        const saveBtn = document.getElementById('save-ann-btn');
        if (saveBtn) saveBtn.onclick = saveAnniversary;
        const closeEditorBtn = document.getElementById('close-ann-editor');
        if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;
        const listContainer = document.getElementById('ann-list-container');
        if (listContainer) {
            listContainer.addEventListener('click', (e) => {
                const card = e.target.closest('.ann-item-card');
                if (card && !e.target.closest('.ann-edit-btn') && !e.target.closest('.ann-delete-btn')) {
                    const id = parseInt(card.dataset.annId);
                    const ann = window.anniversaries.find(a => a.id === id);
                    if (ann) openEditor(ann);
                }
            });
        }
        const bgInput = document.getElementById('ann-header-bg-input');
        if (bgInput && typeof localforage !== 'undefined') {
            bgInput.addEventListener('change', async (e) => {
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
            });
        }
    }

                 // ---------- 初始化 ----------
                 function init() {
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
                                     console.log('✅ 已加载纪念日数据 (固定key):', window.anniversaries.length, '条');
                                 } else {
                                     console.log('ℹ️ 没有已保存的纪念日数据');
                                 }
                             }
                         } catch (e) {
                             console.warn('⚠️ 加载纪念日数据失败:', e);
                         }
                         renderList();
                         window.checkAndStoreImportantDay();
                     })();
                 }

                 // 确保 init 在 DOM 加载后执行
                 if (document.readyState === 'loading') {
                     document.addEventListener('DOMContentLoaded', init);
                 } else {
                     init();
                 }

           })();