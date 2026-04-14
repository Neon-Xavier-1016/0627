/**
 * features/anniversary.js - 重要日与提醒系统
 */

// 当前正在编辑的纪念日ID（用于区分新增/编辑）
let currentEditAnnId = null;

window.selectAnnType = function(type) {
    window.currentAnnType = type;

    // 按钮高亮
    document.querySelectorAll('.ann-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // 提示语
    const hint = document.getElementById('ann-type-desc');
    if (hint) {
        if (type === 'anniversary') hint.textContent = '计算从过去某一天到现在已经过了多少天';
        else if (type === 'birthday') hint.textContent = '每年当天会触发专属通知与寄语';
        else hint.textContent = '计算从现在到未来某一天还剩下多少天';
    }

    const annOpt = document.getElementById('ann-opt-anniversary');
    const birOpt = document.getElementById('ann-opt-birthday');
    const reminderGroup = document.getElementById('ann-reminder-settings-group');

    if (type === 'countdown') {
        if(reminderGroup) reminderGroup.style.display = 'none';
    } else {
        if(reminderGroup) reminderGroup.style.display = 'block';
        if(annOpt) annOpt.style.display = (type === 'anniversary') ? 'block' : 'none';
        if(birOpt) birOpt.style.display = (type === 'birthday') ? 'block' : 'none';
    }
};

window.deleteAnniversary = function(id, event) {
    if (event) event.stopPropagation();
    if (confirm('确定要删除这个重要日吗？')) {
        window.anniversaries = window.anniversaries.filter(a => a.id !== id);
        if (typeof throttledSaveData === 'function') throttledSaveData();
        renderAnniversariesList();
        if (typeof showNotification === 'function') showNotification('重要日已删除', 'success');
    }
};

let activeAnnId = null;

async function fillAnnHeaderCard(ann) {
    const headerCard = document.getElementById('ann-header-card');
    const toolbar = document.getElementById('ann-card-toolbar');
    if (!ann || !headerCard) return;

    activeAnnId = ann.id;
    headerCard.style.display = 'block';
    if (toolbar) toolbar.style.display = 'flex';

    const now = new Date();
    const isCountdown = ann.type === 'countdown';
    const targetDate = new Date(ann.date);
    let diffDays;

    if (isCountdown) {
        diffDays = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) diffDays = 0;
    } else {
        diffDays = Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) diffDays = 0;
    }

    const iconEl = document.getElementById('ann-header-icon');
    const labelEl = document.getElementById('ann-header-label');
    if (iconEl) iconEl.textContent = isCountdown ? '♡' : '♥';
    if (labelEl) labelEl.textContent = isCountdown ? 'COUNTDOWN' : 'ANNIVERSARY';

    const titleEl = document.getElementById('ann-header-title');
    const dateEl = document.getElementById('ann-header-date');
    const daysEl = document.getElementById('ann-header-days');

    if (titleEl) titleEl.textContent = ann.name;
    if (dateEl) dateEl.textContent = ann.date;
    if (daysEl) daysEl.innerHTML = `${diffDays.toLocaleString('zh-CN')}<span class="ann-header-days-unit">${isCountdown ? '天后' : '天'}</span>`;

    const milestonesEl = document.getElementById('ann-header-milestones');
    if (milestonesEl) {
        milestonesEl.innerHTML = '';
        if (!isCountdown) {
            const milestones = [];
            if (diffDays >= 100) {
                const n = Math.floor(diffDays / 100);
                milestones.push(`🎉 第 ${n * 100} 天`);
            }
            if (diffDays >= 365) {
                const n = Math.floor(diffDays / 365);
                milestones.push(`🎊 ${n} 周年`);
            }
            if (diffDays > 0 && diffDays < 100) {
                milestones.push(`💫 距 100 天还有 ${100 - diffDays} 天`);
            }
            milestones.forEach(m => milestonesEl.insertAdjacentHTML('beforeend', `<span class="ann-milestone-chip">${m}</span>`));
        }
    }

    const bgEl = document.getElementById('ann-header-card-bg');
    if (bgEl && typeof localforage !== 'undefined') {
        const savedBg = await localforage.getItem(`annHeaderBg_${ann.id}`);
        bgEl.style.backgroundImage = savedBg ? `url(${savedBg})` : '';
    }

    document.querySelectorAll('.ann-item-card').forEach(el => el.classList.remove('ann-item-active'));
    const activeEl = document.querySelector(`.ann-item-card[data-ann-id="${ann.id}"]`);
    if (activeEl) activeEl.classList.add('ann-item-active');
}

function addAnniversary() {
    const nameInput = document.getElementById('ann-input-name');
    const dateInput = document.getElementById('ann-input-date');
    const name = nameInput ? nameInput.value.trim() : '';
    const date = dateInput ? dateInput.value : '';

    if (!name || !date) {
        if (typeof showNotification === 'function') showNotification('请填写名称和日期', 'error');
        return;
    }

    const type = window.currentAnnType || 'anniversary';
    const remindRules = [];

    document.querySelectorAll('.ann-reminder-checkbox:checked').forEach(cb => {
        if (cb.id !== 'ann-opt-custom-check' && cb.id !== 'ann-opt-interval-check' && cb.id !== 'ann-opt-yearly-interval-check') {
            remindRules.push(cb.value);
        }
    });

    const customCheck = document.getElementById('ann-opt-custom-check');
    const customDaysEl = document.getElementById('ann-opt-custom-days');
    if (customCheck && customCheck.checked && customDaysEl && customDaysEl.value) {
        const rawDays = customDaysEl.value;
        rawDays.split('\n').forEach(line => {
            line.split(',').forEach(d => {
                const day = parseInt(d.trim());
                if (!isNaN(day) && day > 0) {
                    remindRules.push('custom:' + day);
                }
            });
        });
    }

    const yearlyIntervalCheck = document.getElementById('ann-opt-yearly-interval-check');
    const yearlyIntervalEl = document.getElementById('ann-opt-yearly-interval-val');
    if (yearlyIntervalCheck && yearlyIntervalCheck.checked && yearlyIntervalEl && yearlyIntervalEl.value) {
        const yrs = parseInt(yearlyIntervalEl.value);
        if (!isNaN(yrs) && yrs > 0) {
            remindRules.push('anniversaryYearly:' + yrs);
        }
    }

    const intervalCheck = document.getElementById('ann-opt-interval-check');
    const intervalEl = document.getElementById('ann-opt-interval-years');
    if (intervalCheck && intervalCheck.checked && intervalEl && intervalEl.value) {
        const years = parseInt(intervalEl.value);
        if (!isNaN(years) && years > 0) {
            remindRules.push('interval:' + years);
        }
    }

    const customMsgEl = document.getElementById('ann-custom-message');
    const customMessage = customMsgEl ? customMsgEl.value.trim() : '';

    if (currentEditAnnId) {
        const index = window.anniversaries.findIndex(a => a.id === currentEditAnnId);
        if (index > -1) {
            window.anniversaries[index].name = name;
            window.anniversaries[index].date = date;
            window.anniversaries[index].type = type;
            window.anniversaries[index].remindRules = remindRules;
            window.anniversaries[index].customMessage = customMessage;
            currentEditAnnId = null;
        }
    } else {
        window.anniversaries.push({
            id: Date.now(),
            name: name,
            date: date,
            type: type,
            remindRules: remindRules,
            customMessage: customMessage
        });
    }

    if (typeof throttledSaveData === 'function') throttledSaveData();
    renderAnniversariesList();

    if (nameInput) nameInput.value = '';
    if (dateInput) dateInput.value = '';
    if (customMsgEl) customMsgEl.value = '';
    if (customDaysEl) customDaysEl.value = '';
    if (intervalEl) intervalEl.value = '';
    document.querySelectorAll('.ann-reminder-checkbox').forEach(cb => cb.checked = false);

    if (typeof showNotification === 'function') showNotification('重要日已保存', 'success');
}

function renderAnniversariesList() {
    const listContainer = document.getElementById('ann-list-container');
    const headerCard = document.getElementById('ann-header-card');
    const toolbar = document.getElementById('ann-card-toolbar');

    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!window.anniversaries) window.anniversaries = [];
    window.anniversaries.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (window.anniversaries.length === 0) {
        if (headerCard) headerCard.style.display = 'none';
        if (toolbar) toolbar.style.display = 'none';
        listContainer.innerHTML = `
        <div class="ann-empty">
            <div class="ann-empty-icon">💝</div>
            <p>还没有纪念日<br>去添加一个属于你们的日子吧~</p>
        </div>`;
        return;
    }

    const now = new Date();
    const defaultAnn = window.anniversaries.find(a => a.type === 'anniversary') || window.anniversaries[0];
    fillAnnHeaderCard(defaultAnn);

    window.anniversaries.forEach(ann => {
        const targetDate = new Date(ann.date);
        let diffDays = 0;
        let typeClass = '';
        let typeLabel = '';
        let dayLabel = '';

        if (ann.type === 'countdown') {
            typeClass = 'type-future';
            typeLabel = '倒数';
            dayLabel = '天后';
            diffDays = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) diffDays = 0;
        } else {
            typeClass = 'type-past';
            typeLabel = '已过';
            dayLabel = '天';
            diffDays = Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) diffDays = 0;
        }

        const formattedDays = diffDays.toLocaleString('zh-CN');

        const html = `
        <div class="ann-item-card ${typeClass}" data-ann-id="${ann.id}" onclick="editAnnCard(${ann.id})" style="cursor:pointer;">
            <div class="ann-item-left">
                <div class="ann-item-name">${escapeHtml(ann.name)}</div>
                <div class="ann-item-date">
                    <span class="ann-tag">${typeLabel}</span>
                    ${ann.date}
                </div>
            </div>
            <div style="display:flex; align-items:center;">
                <div class="ann-item-right">
                    <div class="ann-item-days">${formattedDays}</div>
                    <div class="ann-item-days-unit">${dayLabel}</div>
                </div>
                <div class="ann-delete-btn" onclick="event.stopPropagation(); deleteAnniversary(${ann.id}, event)">
                    <i class="fas fa-times"></i>
                </div>
            </div>
        </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', html);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.editAnnCard = function(id) {
    const ann = window.anniversaries.find(a => a.id === id);
    if (!ann) return;

    currentEditAnnId = ann.id;
    const editorSlide = document.getElementById('ann-editor-slide');
    if (editorSlide) editorSlide.classList.add('active');

    const nameInput = document.getElementById('ann-input-name');
    const dateInput = document.getElementById('ann-input-date');
    const msgInput = document.getElementById('ann-custom-message');

    if (nameInput) nameInput.value = ann.name || '';
    if (dateInput) dateInput.value = ann.date || '';
    if (msgInput) msgInput.value = ann.customMessage || '';

    window.selectAnnType(ann.type);

    document.querySelectorAll('.ann-reminder-checkbox').forEach(cb => cb.checked = false);
    const customDaysEl = document.getElementById('ann-opt-custom-days');
    const intervalEl = document.getElementById('ann-opt-interval-years');
    if(customDaysEl) customDaysEl.value = '';
    if(intervalEl) intervalEl.value = '';

    let customDaysArray = [];
    if (ann.remindRules) {
        ann.remindRules.forEach(rule => {
            const cb = document.querySelector(`.ann-reminder-checkbox[value="${rule}"]`);
            if (cb) cb.checked = true;

            if (rule.startsWith('custom:')) {
                customDaysArray.push(rule.split(':')[1]);
            }
            if (rule.startsWith('anniversaryYearly:')) {
                const y = rule.split(':')[1];
                const check = document.getElementById('ann-opt-yearly-interval-check');
                const input = document.getElementById('ann-opt-yearly-interval-val');
                if (check) check.checked = true;
                if (input) input.value = y;
            }
            if (rule.startsWith('interval:')) {
                const y = rule.split(':')[1];
                const check = document.getElementById('ann-opt-interval-check');
                if(check) check.checked = true;
                if(intervalEl) intervalEl.value = y;
            }
        });
    }

    if (customDaysArray.length > 0) {
        const check = document.getElementById('ann-opt-custom-check');
        if(check) check.checked = true;
        if(customDaysEl) customDaysEl.value = customDaysArray.join(', ');
    }
};

window.selectAnnCard = function(id) {
    const ann = window.anniversaries.find(a => a.id === id);
    if (ann) fillAnnHeaderCard(ann);
};

window.clearAnnCardBg = async function() {
    if (!activeAnnId) return;
    if (typeof localforage !== 'undefined') {
        await localforage.removeItem(`annHeaderBg_${activeAnnId}`);
    }
    const bgEl = document.getElementById('ann-header-card-bg');
    if (bgEl) bgEl.style.backgroundImage = '';
    if (typeof showNotification === 'function') showNotification('封面图已清除', 'success');
};

// ==================== 核心检测函数 ====================
function initSpecialDaySystem() {
    const today = new Date();
    const todayStr = today.toDateString();

    const lastNotifyDate = localStorage.getItem('lastSpecialNotifyDate');
    const alreadyNotified = lastNotifyDate === todayStr;

    let specialEvent = null;

    if (!window.anniversaries) return;

    window.anniversaries.forEach(ann => {
        const target = new Date(ann.date);
        if (!ann.remindRules || ann.remindRules.length === 0) return;

        if (ann.type === 'anniversary') {
            const days = Math.floor((today - target) / (1000 * 60 * 60 * 24));
            if (days < 0) return;

            ann.remindRules.forEach(rule => {
                if (rule === '100' && days % 100 === 0 && days !== 0) specialEvent = ann;
                if (rule === '1000' && days % 1000 === 0 && days !== 0) specialEvent = ann;
                if (rule.startsWith('custom:')) {
                    const customDay = parseInt(rule.split(':')[1]);
                    if (days === customDay) specialEvent = ann;
                }
            });

            const isAnniversaryDate = target.getMonth() === today.getMonth() && target.getDate() === today.getDate();
            if (isAnniversaryDate) {
                const years = today.getFullYear() - target.getFullYear();
                if (years > 0) {
                    ann.remindRules.forEach(rule => {
                        if (rule.startsWith('anniversaryYearly:')) {
                            const interval = parseInt(rule.split(':')[1]);
                            if (interval > 0 && years % interval === 0) {
                                specialEvent = ann;
                            }
                        }
                    });
                }
            }
        }

        if (ann.type === 'birthday') {
            const isDateMatch = target.getMonth() === today.getMonth() && target.getDate() === today.getDate();
            if (isDateMatch) {
                const yearsPassed = today.getFullYear() - target.getFullYear();

                if (ann.remindRules.includes('yearly')) specialEvent = ann;
                if (ann.remindRules.includes('decade') && yearsPassed % 10 === 0 && yearsPassed > 0) {
                    specialEvent = ann;
                }
                ann.remindRules.forEach(rule => {
                    if (rule.startsWith('interval:')) {
                        const yr = parseInt(rule.split(':')[1]);
                        if (yr > 0 && yearsPassed % yr === 0 && yearsPassed > 0) {
                            specialEvent = ann;
                        }
                    }
                });
            }
        }
    });

    if (specialEvent) {
        let msg = `今天是特别的日子：${specialEvent.name}`;
        if (specialEvent.customMessage) {
            const lines = specialEvent.customMessage.split('\n').filter(s => s.trim() !== '');
            if (lines.length > 0) {
                msg = lines[Math.floor(Math.random() * lines.length)];
            }
        }

        window._todaySpecialNote = msg;

        if (typeof showNotification === 'function') {
            showNotification(`🎉 ${msg}`, 'success');
        }

        const animDiv = document.getElementById('anniversary-animation');
        if (animDiv) {
            const titleEl = document.getElementById('anniversary-animation-title');
            const msgEl = document.getElementById('anniversary-animation-message');
            if (titleEl) titleEl.textContent = `${specialEvent.name}快乐！`;
            if (msgEl) msgEl.textContent = msg;
            animDiv.style.display = 'flex';
            setTimeout(() => {
                animDiv.style.display = 'none';
            }, 5000);
        }

        if (!alreadyNotified && Notification.permission === 'granted') {
            new Notification('传讯 · 重要日提醒', { body: msg });
            localStorage.setItem('lastSpecialNotifyDate', todayStr);
        }
    } else {
        window._todaySpecialNote = null;
    }
}

// ==================== 初始化模块 ====================
function initAnniversaryModule() {
    const entryBtn = document.getElementById('anniversary-function');
    if (entryBtn) {
        const newBtn = entryBtn.cloneNode(true);
        entryBtn.parentNode.replaceChild(newBtn, entryBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const advancedModal = document.getElementById('advanced-modal');
            const annModal = document.getElementById('anniversary-modal');
            if (advancedModal && typeof hideModal === 'function') hideModal(advancedModal);
            renderAnniversariesList();
            if (annModal && typeof showModal === 'function') showModal(annModal);
        });
    }

    const closeBtn = document.getElementById('close-anniversary-modal');
    if (closeBtn) {
        const newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);
        newClose.addEventListener('click', () => {
            const modal = document.getElementById('anniversary-modal');
            if (modal && typeof hideModal === 'function') hideModal(modal);
        });
    }

    const openAddBtn = document.getElementById('open-ann-add-btn');
    const editorSlide = document.getElementById('ann-editor-slide');

    if (openAddBtn) {
        openAddBtn.onclick = () => {
            currentEditAnnId = null;
            const nameInput = document.getElementById('ann-input-name');
            const dateInput = document.getElementById('ann-input-date');
            const msgInput = document.getElementById('ann-custom-message');
            if (nameInput) nameInput.value = '';
            if (dateInput) dateInput.value = '';
            if (msgInput) msgInput.value = '';
            document.querySelectorAll('.ann-reminder-checkbox').forEach(cb => cb.checked = false);

            window.selectAnnType('anniversary');
            if (editorSlide) editorSlide.classList.add('active');
        };
    }

    const closeEditorBtn = document.getElementById('close-ann-editor');
    if (closeEditorBtn) {
        closeEditorBtn.onclick = () => {
            if (editorSlide) editorSlide.classList.remove('active');
            currentEditAnnId = null;
        };
    }

    const saveBtn = document.getElementById('save-ann-btn');
    if (saveBtn) {
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        newSave.addEventListener('click', () => {
            addAnniversary();
            if (editorSlide) editorSlide.classList.remove('active');
        });
    }

    const annBgInput = document.getElementById('ann-header-bg-input');
    if (annBgInput) {
        annBgInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!activeAnnId) {
                if (typeof showNotification === 'function') showNotification('请先选择一个纪念日', 'warning');
                return;
            }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const dataUrl = ev.target.result;
                const bgEl = document.getElementById('ann-header-card-bg');
                if (bgEl) bgEl.style.backgroundImage = `url(${dataUrl})`;
                if (typeof localforage !== 'undefined') {
                    await localforage.setItem(`annHeaderBg_${activeAnnId}`, dataUrl);
                }
                if (typeof showNotification === 'function') showNotification('封面图已更新', 'success');
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        });
    }

    initSpecialDaySystem();
}

// ==================== 导出全局函数 ====================
window.checkAnniversaries = function() {
    console.log('手动触发纪念日检查');
    initSpecialDaySystem();
};

window.getTodayAnniversary = function() {
    const today = new Date();
    const found = (window.anniversaries || []).filter(ann => {
        const annDate = new Date(ann.date);
        return annDate.getMonth() === today.getMonth() &&
               annDate.getDate() === today.getDate();
    });
    return found;
};

window.showAnniversaryNotification = function(ann) {
    const msg = ann.customMessage || `今天是 ${ann.name}，记得庆祝哦~`;
    if (typeof showNotification === 'function') {
        showNotification(`🎉 ${msg}`, 'success');
    }
    const animDiv = document.getElementById('anniversary-animation');
    if (animDiv) {
        const titleEl = document.getElementById('anniversary-animation-title');
        const msgEl = document.getElementById('anniversary-animation-message');
        if (titleEl) titleEl.textContent = `${ann.name}快乐！`;
        if (msgEl) msgEl.textContent = msg;
        animDiv.style.display = 'flex';
        setTimeout(() => {
            animDiv.style.display = 'none';
        }, 5000);
    }
};

// 确保 anniversaries 数组存在
if (typeof window.anniversaries === 'undefined') {
    window.anniversaries = [];
}

// 设置默认 currentAnnType
if (typeof window.currentAnnType === 'undefined') {
    window.currentAnnType = 'anniversary';
}

console.log('✅ anniversary.js 已加载');