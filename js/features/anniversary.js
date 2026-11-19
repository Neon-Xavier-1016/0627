/**
 * anniversary.js - 完整修复版 + 置顶功能
 * 支持纪念日/倒数日/生日 类型切换 + 置顶
 */
(function() {
    'use strict';

    let currentEditId = null;
    let currentType = 'anniversary';
    let activeAnnId = null;
    let anniversariesReady = false;

    // ===== 辅助函数 =====
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : m === '>' ? '&gt;' : m);
    }

    function localKey(d=new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    function dayValue(value) { const [y,m,d]=value.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000; }
    function parseAnnDate(value) { const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d); }
    function elapsed(value) { return dayValue(localKey())-dayValue(value); }
    function normalizeSelection(preferred) {
        const list=window.anniversaries||[];
        const chosen=list.find(a=>String(a.id)===String(preferred))||list.find(a=>a.pinned)||list[0];
        list.forEach(a=>{a.pinned=a===chosen;a.type=a.type||'anniversary';});activeAnnId=chosen?.id||null;
        if(typeof anniversaries!=='undefined')anniversaries=list;
        return chosen;
    }
    function saveAnniversaries() {
        normalizeSelection();
        return localforage.setItem(getStorageKey('anniversaries'),window.anniversaries).catch(e=>{console.warn(e);if(typeof showNotification==='function')showNotification('重要日保存失败，请重试','error');throw e;});
    }

    function milestoneTitle(ann, fallback='重要日') {
        if(!ann)return fallback;
        const days=elapsed(ann.date),name=ann.name||fallback;
        if(ann.type==='birthday'){
            const d=parseAnnDate(ann.date),now=new Date();let age=now.getFullYear()-d.getFullYear();
            if(now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate()))age--;
            return `${name} ${Math.max(0,age)}岁`;
        }
        if(ann.type==='countdown')return days>0?`${name} 已过${days}天`:days===0?`${name} 就是今天`:`${name} 还有${-days}天`;
        return days>=0?`${name} ${days}天`:`${name} 还有${-days}天`;
    }
    function speakerMessage(message){
        const name=document.querySelector('#partner-name')?.textContent.trim()||(typeof settings!=='undefined'&&settings.partnerName)||'梦角';
        return message.startsWith(name+'：')||message.startsWith(name+':')?message:name+'：'+message;
    }
    function showHeartModal(title, message, ann=null) {
        document.getElementById('heart-modal-container')?.remove();
        if (!document.getElementById('ann-heart-classic-style')) {
            const style=document.createElement('style');style.id='ann-heart-classic-style';
            style.textContent=`#heart-modal-container{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0005;backdrop-filter:blur(5px);padding:16px;box-sizing:border-box}.ann-heart-letter{position:relative;width:min(92vw,420px);aspect-ratio:360/330;animation:annSoftBeat 2.6s ease-in-out infinite;filter:drop-shadow(0 14px 24px rgba(0,0,0,.13))}.ann-heart-letter>svg{position:absolute;inset:0;width:100%;height:100%;fill:var(--secondary-bg,#fff);stroke:var(--accent-color,#b69a81);stroke-width:1.3}.ann-heart-copy{position:absolute;top:24%;left:18%;width:64%;height:47%;text-align:center;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior:contain;touch-action:pan-y;color:var(--text-primary,#333)}.ann-heart-copy::-webkit-scrollbar{display:none;width:0;height:0}.ann-heart-copy small{font-size:10px;letter-spacing:2px;color:var(--accent-color,#b69a81)}.ann-heart-copy h3{font-size:18px;line-height:1.5;margin:10px 0}.ann-heart-copy p{font:inherit;font-size:13px;line-height:1.9;white-space:pre-wrap;margin:0;overflow-wrap:anywhere}#heart-modal-container>button{font:inherit;font-size:13px;border:1px solid var(--border-color,#ddd);border-radius:30px;padding:10px 22px;background:var(--secondary-bg,#fff);color:var(--text-primary,#333);cursor:pointer;margin-top:4px}@keyframes annSoftBeat{0%,100%{transform:scale(1)}35%{transform:scale(1.018)}55%{transform:scale(1.006)}}@media(prefers-reduced-motion:reduce){.ann-heart-letter{animation:none}}`;
            document.head.appendChild(style);
        }
        const root=document.createElement('div');root.id='heart-modal-container';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','重要日留言');
        root.innerHTML='<div class="ann-heart-letter"><svg viewBox="0 0 360 330" aria-hidden="true"><path d="M180 307C156 286 25 199 15 119C4 30 111 0 180 74C249 0 356 30 345 119C335 199 204 286 180 307Z"/></svg><div class="ann-heart-copy"><h3></h3><p></p></div></div><button type="button">收好这份纪念</button>';
        root.querySelector('h3').textContent=milestoneTitle(ann,title);root.querySelector('p').textContent=speakerMessage(message);
        const close=()=>{document.removeEventListener('keydown',onKey);root.remove();};
        const onKey=e=>{if(e.key==='Escape'){e.stopPropagation();close();}};
        root.querySelector('button').onclick=close;root.onclick=e=>{if(e.target===root)close();};
        document.addEventListener('keydown',onKey);document.body.appendChild(root);
    }
    window.previewImportantDay = function() {
        const a=(window.anniversaries||[]).find(a=>a.pinned)||(window.anniversaries||[])[0];
        showHeartModal(a?.name||'属于我们的纪念日',a?.customMessages?.[0]||'又一起走到一个特别的日子。\n往后的日子，也想慢慢陪你度过。',a);
    };

    // ===== 检测重要日 =====
    window.pendingImportantDay = null;

    window.checkAndStoreImportantDay = function() {
        window.pendingImportantDay = null;
        if(!anniversariesReady||!Array.isArray(window.anniversaries))return;
        const today = new Date();
        const todayStr = today.toDateString();

        for (const ann of window.anniversaries) {
            if(ann.reminderEnabled===false)continue;
            if(localStorage.getItem(getStorageKey('annShown_'+ann.id+'_'+localKey())))continue;
            const target = parseAnnDate(ann.date);
            let matched = false;
            let msg = '';

            if (ann.type === 'anniversary') {
                const days = elapsed(ann.date);
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
                const diffDays = -elapsed(ann.date);
                if (diffDays === 0) {
                    const shownKey = getStorageKey('annShown_'+ann.id+'_'+localKey());
                    const lastShown = localStorage.getItem(shownKey);
                    if (lastShown === todayStr) {
                        console.log(`⏭️ 倒数日「${ann.name}」今天已弹过，跳过`);
                        continue;
                    }
                    matched = true;
                    const msgLines = ann.customMessages || [];
                    msg = msgLines.length ? msgLines[Math.floor(Math.random() * msgLines.length)] : `今天就是 ${ann.name} 的日子！🎉`;

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
        const title = ann.name || '重要日';
        // 从页面顶部读取对方昵称（更准确）
        const partnerNameEl = document.querySelector('#partner-name');
        const partnerName = partnerNameEl ? partnerNameEl.textContent.trim() : '梦角';
        let content = msg;
        if (!content) {
            content = type === 'birthday' ? '生日快乐！' : '纪念日快乐！';
        }
        const fullMsg = `${partnerName}：${content}`;
        showHeartModal(title, fullMsg, ann);
        localStorage.setItem(getStorageKey('annShown_'+ann.id+'_'+localKey()),'1');
        localStorage.setItem('lastSpecialNotifyDate', new Date().toDateString());
        window.pendingImportantDay = null;
    };
    window.showImportantDayModalIfNeeded = function() { waitForAllModalsAndShow(); };

    // ===== 渲染列表（含置顶支持） =====
    function renderList() {
        if(!anniversariesReady)return;
        const container = document.getElementById('ann-list-container');
        if (!container) return;
        normalizeSelection();
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
            const target = parseAnnDate(ann.date);
            let diffDays = 0, typeLabel = '', dayLabel = '';
            const type = ann.type || 'anniversary';
            if (type === 'countdown') {
                diffDays = -elapsed(ann.date);
                diffDays = Math.abs(diffDays);
                typeLabel = '倒数';
                dayLabel = elapsed(ann.date)>0?'天':elapsed(ann.date)===0?'天 · 就是今天':'天后';
            } else if (type === 'birthday') {
                let age = today.getFullYear() - target.getFullYear();
                if (today.getMonth() < target.getMonth() || (today.getMonth() === target.getMonth() && today.getDate() < target.getDate())) age--;
                diffDays = age >= 0 ? age : 0;
                typeLabel = '生日';
                dayLabel = '岁';
            } else {
                diffDays = elapsed(ann.date);
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
                             title="${isPinned ? '当前选中' : '置顶并选中'}"
                             style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(var(--accent-color-rgb,180,140,100),0.08);color:${pinColor};cursor:pointer;transition:all 0.2s;">
                            <i class="fas fa-thumbtack" style="transform: rotate(${pinRotation});"></i>
                        </div>
                        <div class="ann-item-right">
                            <div class="ann-item-days">${ann.type==='countdown'&&elapsed(ann.date)>0?'已过 ':''}${diffDays.toLocaleString()}</div>
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
        if(!anniversariesReady)return;
        if (!ann) return;
        activeAnnId = ann.id;
        const header = document.getElementById('ann-header-card');
        const toolbar = document.getElementById('ann-card-toolbar');
        if (header) header.style.display = 'block';
        if (toolbar) toolbar.style.display = 'flex';
        const isCountdown = ann.type === 'countdown';
        const isBirthday = ann.type === 'birthday';
        const target = parseAnnDate(ann.date);
        const today = new Date();
        let diffDays = 0, unit = '天';
        if (isCountdown) {
            diffDays = -elapsed(ann.date);
            diffDays = Math.abs(diffDays);
            unit = elapsed(ann.date)>0?'天':elapsed(ann.date)===0?'天 · 就是今天':'天后';
        } else if (isBirthday) {
            let age = today.getFullYear() - target.getFullYear();
            if (today.getMonth() < target.getMonth() || (today.getMonth() === target.getMonth() && today.getDate() < target.getDate())) age--;
            diffDays = age >= 0 ? age : 0;
            unit = '岁';
        } else {
            diffDays = elapsed(ann.date);
            if (diffDays < 0) diffDays = 0;
        }
        document.getElementById('ann-header-title').textContent = ann.name;
        document.getElementById('ann-header-date').textContent = ann.date;
        const daysEl = document.getElementById('ann-header-days');
        if (daysEl) daysEl.innerHTML = `${isCountdown&&elapsed(ann.date)>0?'已过 ':''}${diffDays.toLocaleString()}<span class="ann-header-days-unit">${unit}</span>`;
        const iconEl = document.getElementById('ann-header-icon');
        const labelEl = document.getElementById('ann-header-label');
        if (iconEl) iconEl.textContent = isCountdown ? '♡' : (isBirthday ? '🎂' : '♥');
        if (labelEl) labelEl.textContent = isCountdown ? 'COUNTDOWN' : (isBirthday ? 'BIRTHDAY' : 'ANNIVERSARY');
        if (typeof localforage !== 'undefined') {
            const bgKey = getStorageKey('annHeaderBg_'+ann.id);
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
    async function saveAnniversary() {
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

        await saveAnniversaries();
        renderList();
        closeEditor();
        if (typeof showNotification === 'function') showNotification('重要日已保存', 'success');
        console.log('✅ 已保存记录:', newAnn);
    }

    // ===== 删除 =====
    async function deleteAnniversary(id) {
        if (!confirm('确定要删除这个重要日吗？')) return;
        window.anniversaries = window.anniversaries.filter(a => a.id !== id);
        if (activeAnnId === id) activeAnnId = null;
        await saveAnniversaries();
        renderList();
        if (typeof showNotification === 'function') showNotification('已删除', 'success');
    }

    // ===== 置顶切换（新增） =====
    window._togglePin = async function(id) {
        normalizeSelection(id);await saveAnniversaries();renderList();
        if(typeof showNotification==='function')showNotification('已置顶并选中这个重要日','success');
    };
    // ===== 清除卡片背景图 =====
    function clearAnnCardBg() {
        if (!normalizeSelection()) {
            console.warn('无法清除背景图');
            return;
        }
        const bgKey = getStorageKey('annHeaderBg_'+activeAnnId);
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
        if(document.hidden || document.getElementById('heart-modal-container'))return;
        const w=document.getElementById('welcome-animation');if(w&&getComputedStyle(w).display!=='none')return;
        if([...document.querySelectorAll('.modal')].some(m=>getComputedStyle(m).display!=='none'))return;
        const daily=document.getElementById('daily-greeting-modal');if(daily&&!daily.classList.contains('hidden')&&getComputedStyle(daily).display!=='none')return;
        if(window.pendingImportantDay)window.showImportantDayModal();
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
        if (!file || !normalizeSelection()) return;
        const ownerId=activeAnnId;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const bgKey = getStorageKey('annHeaderBg_'+ownerId);
            await localforage.setItem(bgKey, ev.target.result);
            const bgEl = document.getElementById('ann-header-card-bg');
            if (bgEl && activeAnnId===ownerId) bgEl.style.backgroundImage = `url(${ev.target.result})`;
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
                    let stored = await localforage.getItem(getStorageKey('anniversaries'));
                    const migrated=await localforage.getItem(getStorageKey('annV2Migrated'));
                    if(!migrated){const legacy=await localforage.getItem('my_anniversaries');const list=Array.isArray(stored)?stored:[];const ids=new Set(list.map(a=>String(a.id)));for(const a of Array.isArray(legacy)?legacy:[]){if(!ids.has(String(a.id))){list.push(a);ids.add(String(a.id));}}stored=list;}
                    window.anniversaries=Array.isArray(stored)?stored:[];
                    normalizeSelection();await saveAnniversaries();await localforage.setItem(getStorageKey('annV2Migrated'),true);
                    anniversariesReady=true;
                }
            } catch (e) {
                console.warn('⚠️ 加载纪念日数据失败:', e);
                return;
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
    const bootTimer=setInterval(()=>{try{if(typeof SESSION_ID==='undefined'||!SESSION_ID)return;getStorageKey('anniversaries');const w=document.getElementById('welcome-animation');if(w&&getComputedStyle(w).display!=='none')return;clearInterval(bootTimer);init();}catch(e){}},500);
    function checkReminderAgain(){if(!anniversariesReady||!Array.isArray(window.anniversaries)||typeof SESSION_ID==='undefined'||!SESSION_ID)return;if(document.hidden||document.getElementById('heart-modal-container'))return;if(typeof getStorageKey!=='function')return;try{getStorageKey('anniversaries');window.checkAndStoreImportantDay();waitForAllModalsAndShow();}catch(e){console.warn(e);}}
    setInterval(checkReminderAgain,60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminderAgain();});

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