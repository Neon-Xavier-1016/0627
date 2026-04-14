/**
 * wishing-pool.js — 许愿池功能 (完全修复版)
 */

// ==================== 全局变量 ====================
let editingWishId = null;
let tempWishImage = null;

// ==================== 渲染卡片列表 ====================
function renderWishPoolGrid() {
    const grid = document.getElementById('wish-pool-grid');
    if (!grid) return;

    if (!wishingPoolData || wishingPoolData.length === 0) {
        grid.innerHTML = `
            <div class="wp-empty-state">
                <div style="font-size: 40px; margin-bottom: 12px; opacity: 0.4;">✨</div>
                <div style="font-size: 14px; font-weight: 500;">许愿池空空如也</div>
                <div style="font-size: 12px; margin-top: 6px; opacity: 0.6;">种草了好物却买不起？<br>先许个愿，等以后有钱了再说~</div>
            </div>`;
        return;
    }

    grid.innerHTML = wishingPoolData.map(item => {
        const hasReplied = item.status === 'replied';

        let timeHtml = '';
        if (hasReplied) {
            const replyDate = new Date(item.actualReplyTime || item.replyTime);
            timeHtml = `<div style="font-size: 10px; color: var(--accent-color); opacity: 0.8;">✨ 已回应 · ${replyDate.toLocaleDateString('zh-CN', {month:'2-digit', day:'2-digit'})}</div>`;
        } else {
            const hoursLeft = Math.max(0, Math.ceil((item.replyTime - Date.now()) / (1000 * 60 * 60)));
            timeHtml = `<div style="font-size: 10px; color: var(--text-secondary); opacity: 0.6;">⏳ 预计 ${hoursLeft} 小时后回应</div>`;
        }

        const seedDate = new Date(item.wishTime).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        const priceHtml = item.price ? `<div class="wp-item-price">¥ ${item.price}</div>` : '';
        const myNoteHtml = item.myNote ? `
            <div>
                <div class="wp-note-label">我的备注</div>
                <div class="wp-note-content">${escapeHtml(item.myNote).replace(/\n/g, '<br>')}</div>
            </div>` : '';

        const partnerNoteHtml = hasReplied && item.partnerNote ? `
            <div>
                <div class="wp-note-label" style="color: var(--accent-color);">Ta 的回应</div>
                <div class="wp-note-content" style="border-left: 2px solid rgba(var(--accent-color-rgb), 0.4);">${escapeHtml(item.partnerNote).replace(/\n/g, '<br>')}</div>
            </div>` : `
            <div>
                <div class="wp-note-label">Ta 的回应</div>
                <div class="wp-note-content" style="color: var(--text-secondary); font-style: italic; font-size: 11px;">「Ta正在聆听你的愿望...」</div>
            </div>`;

        return `
        <div class="wp-card-wrapper ${hasReplied ? 'replied' : ''}" data-id="${item.id}">
            <div class="wp-card-star">✨</div>
            <div class="wp-card-inner" onclick="flipWishCardById('${item.id}')">
                <div class="wp-card-front">
                    ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy">` : `<div style="font-size: 16px; color: var(--text-secondary); padding: 20px; text-align: center;">${escapeHtml(item.name)}</div>`}
                </div>
                <div class="wp-card-back">
                    <div class="wp-item-name">${escapeHtml(item.name)}</div>
                    ${priceHtml}
                    ${myNoteHtml || partnerNoteHtml ? `
                    <div style="flex: 1; overflow-y: auto; min-height: 20px; margin: 4px -4px; padding: 0 4px; scrollbar-width: none;">
                        ${myNoteHtml}
                        ${partnerNoteHtml}
                    </div>` : ''}
                    <div style="flex-shrink: 0; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color);">
                        <div style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px;">
                            <div style="font-size: 10px; color: var(--text-secondary); opacity: 0.6;">${seedDate} 种草</div>
                            ${timeHtml}
                        </div>
                        <div class="wp-card-actions">
                            <button class="wp-act-btn" onclick="event.stopPropagation(); openEditWish('${item.id}')">详情</button>
                            <button class="wp-act-btn danger" onclick="event.stopPropagation(); deleteWish('${item.id}')">删除</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ==================== 卡片翻转 ====================
function flipWishCardById(id) {
    const wrapper = document.querySelector(`.wp-card-wrapper[data-id="${id}"]`);
    if (wrapper) wrapper.classList.toggle('flipped');
}

function flipWishCard(frontEl) {
    const wrapper = frontEl.closest('.wp-card-wrapper');
    if (wrapper) wrapper.classList.toggle('flipped');
}

// ==================== HTML转义 ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 后台检测 ====================
function checkWishReplyStatus() {
    if (!wishingPoolData || wishingPoolData.length === 0) return;

    const now = Date.now();
    let changed = false;
    let newReplyItem = null;

    wishingPoolData.forEach(item => {
        if (item.status === 'pending' && now >= item.replyTime) {
            item.status = 'replied';
            item.actualReplyTime = Date.now();
            item.partnerNote = generateWishReplyText();
            changed = true;
            newReplyItem = item;
        }
    });

    if (changed) {
        saveWishPoolData();
        renderWishPoolGrid();
        if (typeof playSound === 'function') playSound('message');

        if (newReplyItem) {
            showWishReplyPopup(newReplyItem);
        }
    }
}

// ==================== 生成回复文本 ====================
function generateWishReplyText() {
    const pool = (typeof customReplies !== 'undefined' && customReplies.length > 0) ? customReplies : [];
    if (pool.length === 0) return '（回复库为空，请先添加字卡）';

    const count = Math.floor(Math.random() * 5) + 2;
    const used = [];
    let result = '';

    for (let i = 0; i < count; i++) {
        let sentence;
        let tries = 0;
        do {
            sentence = pool[Math.floor(Math.random() * pool.length)];
            tries++;
        } while (used.includes(sentence) && tries < 20);
        used.push(sentence);

        const punct = Math.random() < 0.3 ? '！' : (Math.random() < 0.3 ? '...' : '。');
        result += sentence + punct;
    }

    return result;
}

// ==================== 保存数据 ====================
function saveWishPoolData() {
    if (typeof throttledSaveData === 'function') {
        throttledSaveData();
    }
}

// ==================== 关闭许愿池模态框（统一方法）====================
function closeWishingPoolModal() {
    const modal = document.getElementById('wishing-pool-modal');
    if (modal) {
        modal.style.display = 'none';
        // 恢复页面滚动
        document.body.style.overflow = '';
        document.body.style.position = '';
    }
}

// ==================== 打开许愿池模态框（统一方法）====================
function openWishingPoolModal(scrollToId) {
    const modal = document.getElementById('wishing-pool-modal');
    if (!modal) {
        console.error('找不到许愿池模态框');
        return false;
    }

    // 显示模态框
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';

    // 禁止背景滚动（防止卡死）
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    // 刷新列表
    if (typeof renderWishPoolGrid === 'function') {
        renderWishPoolGrid();
    }

    // 如果需要滚动到指定卡片
    if (scrollToId) {
        setTimeout(function() {
            const wrapper = document.querySelector('.wp-card-wrapper[data-id="' + scrollToId + '"]');
            if (wrapper) {
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
                wrapper.classList.add('highlight-wish');
                setTimeout(function() {
                    wrapper.classList.remove('highlight-wish');
                }, 1500);
            }
        }, 200);
    }

    return true;
}

// ==================== 弹出底部通知 ====================
function showWishReplyPopup(item) {
    // 移除已存在的弹窗
    const existing = document.getElementById('wish-reply-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'wish-reply-popup';
    popup.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:20px;padding:18px 20px;z-index:8000;max-width:320px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,0.18);display:flex;flex-direction:column;gap:12px;animation:slideUpNotif 0.4s cubic-bezier(0.22,1,0.36,1);';

    const preview = item.partnerNote ? (item.partnerNote.length > 30 ? item.partnerNote.substring(0, 30) + '…' : item.partnerNote) : '';

    popup.innerHTML = `
        <style>@keyframes slideUpNotif{from{opacity:0;transform:translateX(-50%) translateY(24px) scale(0.9)}60%{transform:translateX(-50%) translateY(-4px) scale(1.02)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}</style>
        <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:26px;">✨</span>
            <div>
                <div style="font-size:14px;font-weight:700;color:var(--text-primary);">许愿池有回应了</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;opacity:0.8;">Ta 对「${escapeHtml(item.name)}」有了反应~</div>
            </div>
        </div>
        ${preview ? `<div style="font-size:12px;color:var(--text-secondary);font-style:italic;padding:8px 12px;background:var(--primary-bg);border-radius:10px;border-left:2px solid rgba(var(--accent-color-rgb),0.4);">"${preview}"</div>` : ''}
        <div style="display:flex;gap:8px;">
            <button class="wish-popup-later-btn" style="flex:1;padding:8px 0;border-radius:12px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;">稍后查看</button>
            <button class="wish-popup-view-btn" data-wish-id="${item.id}" style="flex:2;padding:8px 0;border-radius:12px;border:none;background:var(--accent-color);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">立即查看 ✨</button>
        </div>`;

    document.body.appendChild(popup);

    // 绑定按钮事件（避免内联onclick的转义问题）
    const laterBtn = popup.querySelector('.wish-popup-later-btn');
    const viewBtn = popup.querySelector('.wish-popup-view-btn');

    if (laterBtn) {
        laterBtn.onclick = function() {
            if (popup.parentNode) popup.remove();
        };
    }

    if (viewBtn) {
        const wishId = viewBtn.getAttribute('data-wish-id');
        viewBtn.onclick = function() {
            if (popup.parentNode) popup.remove();
            viewWishReply(wishId);
        };
    }

    // 8秒后自动消失
    setTimeout(() => {
        if (popup.parentNode) popup.remove();
    }, 8000);
}

// ==================== 查看回复（核心修复）====================
function viewWishReply(id) {
    console.log('viewWishReply 被调用, id:', id);

    // 关闭弹窗
    const popup = document.getElementById('wish-reply-popup');
    if (popup) popup.remove();

    // 获取许愿池模态框
    const modal = document.getElementById('wishing-pool-modal');
    if (!modal) {
        console.error('找不到许愿池模态框');
        return;
    }

    // 直接显示模态框
    modal.style.display = 'flex';

    // 刷新许愿池列表
    if (typeof renderWishPoolGrid === 'function') {
        renderWishPoolGrid();
    }

    // 滚动到对应的心愿卡片
    if (id) {
        setTimeout(function() {
            const wrapper = document.querySelector('.wp-card-wrapper[data-id="' + id + '"]');
            if (wrapper) {
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
                wrapper.classList.add('highlight-wish');
                setTimeout(function() {
                    wrapper.classList.remove('highlight-wish');
                }, 1500);
            } else {
                console.log('未找到心愿卡片，ID:', id);
            }
        }, 300);
    }
}

// ==================== 编辑弹窗逻辑 ====================
function initWishEditModal() {
    const modal = document.getElementById('wish-edit-modal');
    if (!modal) return;

    // 取消按钮
    const cancelBtn = document.getElementById('wish-edit-cancel');
    if (cancelBtn) {
        cancelBtn.onclick = () => hideModal(modal);
    }

    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) hideModal(modal);
    };

    const imgArea = document.getElementById('wish-img-upload-area');
    const imgInput = document.getElementById('wish-img-input');
    const imgPreview = document.getElementById('wish-img-preview');
    const placeholder = document.getElementById('wish-img-placeholder');

    if (imgArea) {
        imgArea.onclick = (e) => {
            if (e.target.closest('#wish-img-preview') || e.target.closest('#wish-img-placeholder')) {
                if (imgInput) imgInput.click();
            }
        };
    }

    if (imgInput) {
        imgInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                if (typeof showNotification === 'function') showNotification('图片不能超过5MB', 'error');
                return;
            }

            if (typeof showNotification === 'function') showNotification('正在处理图片...', 'info', 1000);

            const reader = new FileReader();
            reader.onload = (ev) => {
                if (typeof optimizeImage === 'function') {
                    optimizeImage(file, 400, 0.8).then(base64 => {
                        tempWishImage = base64;
                        if (imgPreview) {
                            imgPreview.src = base64;
                            imgPreview.style.display = 'block';
                        }
                        if (placeholder) placeholder.style.display = 'none';
                    });
                } else {
                    tempWishImage = ev.target.result;
                    if (imgPreview) {
                        imgPreview.src = ev.target.result;
                        imgPreview.style.display = 'block';
                    }
                    if (placeholder) placeholder.style.display = 'none';
                }
            };
            reader.readAsDataURL(file);
            imgInput.value = '';
        };
    }

    const saveBtn = document.getElementById('wish-edit-save');
    if (saveBtn) saveBtn.onclick = saveWishItem;
}

function openEditWish(id) {
    editingWishId = id || null;
    tempWishImage = null;
    const modal = document.getElementById('wish-edit-modal');
    const title = document.getElementById('wish-edit-title');
    const nameInput = document.getElementById('wish-name-input');
    const priceInput = document.getElementById('wish-price-input');
    const myNoteInput = document.getElementById('wish-my-note-input');
    const partnerNoteInput = document.getElementById('wish-partner-note-input');
    const imgPreview = document.getElementById('wish-img-preview');
    const placeholder = document.getElementById('wish-img-placeholder');

    if (id) {
        const item = wishingPoolData.find(w => w.id === id);
        if (!item) return;
        title.textContent = '编辑愿望';
        if (nameInput) nameInput.value = item.name || '';
        if (priceInput) priceInput.value = item.price || '';
        if (myNoteInput) myNoteInput.value = item.myNote || '';
        if (partnerNoteInput) {
            partnerNoteInput.value = item.partnerNote || '';
            if (item.status === 'pending') {
                partnerNoteInput.placeholder = '等待Ta回应中';
                partnerNoteInput.style.opacity = '0.6';
                partnerNoteInput.disabled = true;
            } else {
                partnerNoteInput.placeholder = 'Ta 的回应';
                partnerNoteInput.style.opacity = '1';
                partnerNoteInput.disabled = false;
            }
        }
        if (item.image) {
            if (imgPreview) {
                imgPreview.src = item.image;
                imgPreview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
            tempWishImage = item.image;
        } else {
            if (imgPreview) imgPreview.style.display = 'none';
            if (placeholder) placeholder.style.display = 'block';
        }
    } else {
        title.textContent = '许个愿';
        if (nameInput) nameInput.value = '';
        if (priceInput) priceInput.value = '';
        if (myNoteInput) myNoteInput.value = '';
        if (partnerNoteInput) {
            partnerNoteInput.value = '';
            partnerNoteInput.placeholder = 'Ta 的回应 (等Ta回应后自动填入)';
            partnerNoteInput.style.opacity = '1';
            partnerNoteInput.disabled = false;
        }
        if (imgPreview) imgPreview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';
    }
    showModal(modal, document.getElementById('wish-name-input'));
}

function saveWishItem() {
    const nameInput = document.getElementById('wish-name-input');
    const priceInput = document.getElementById('wish-price-input');
    const myNoteInput = document.getElementById('wish-my-note-input');
    const partnerNoteInput = document.getElementById('wish-partner-note-input');

    if (editingWishId) {
        const item = wishingPoolData.find(w => w.id === editingWishId);
        if (!item) return;
        if (nameInput) item.name = nameInput.value.trim() || item.name;
        if (tempWishImage) item.image = tempWishImage;
        if (priceInput) item.price = priceInput.value.trim();
        if (myNoteInput) item.myNote = myNoteInput.value.trim();
        if (partnerNoteInput && partnerNoteInput.value.trim()) {
            item.partnerNote = partnerNoteInput.value.trim();
            if (item.status === 'pending') {
                item.status = 'replied';
                item.actualReplyTime = Date.now();
            }
        }
        if (typeof showNotification === 'function') showNotification('愿望已更新', 'success');
    } else {
        const minHours = 6, maxHours = 12;
        const randomHours = Math.random() * (maxHours - minHours) + minHours;
        const replyTime = Date.now() + randomHours * 60 * 60 * 1000;
        const noteVal = myNoteInput ? myNoteInput.value.trim() : '';

        const itemName = (nameInput && nameInput.value.trim())
            ? nameInput.value.trim()
            : (noteVal ? noteVal.split('\n')[0].substring(0, 20) : '未命名的愿望');

        wishingPoolData.push({
            id: 'wish_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            name: itemName,
            image: tempWishImage || null,
            price: (priceInput ? priceInput.value.trim() : ''),
            myNote: noteVal,
            partnerNote: (partnerNoteInput && partnerNoteInput.value.trim()) ? partnerNoteInput.value.trim() : null,
            wishTime: Date.now(),
            replyTime: replyTime,
            actualReplyTime: null,
            status: (partnerNoteInput && partnerNoteInput.value.trim()) ? 'replied' : 'pending'
        });
        if (partnerNoteInput && partnerNoteInput.value.trim()) {
            wishingPoolData[wishingPoolData.length - 1].actualReplyTime = Date.now();
        }
        const hoursNum = Math.floor(randomHours);
        if (typeof showNotification === 'function') showNotification(`愿望已投入池中，预计 ${hoursNum} 小时后回应...`, 'success');
    }
    hideModal(document.getElementById('wish-edit-modal'));
    saveWishPoolData();
    renderWishPoolGrid();
}

function deleteWish(id) {
    if (!confirm('确定要删除这个愿望吗？')) return;
    wishingPoolData = wishingPoolData.filter(w => w.id !== id);
    saveWishPoolData();
    renderWishPoolGrid();
    if (typeof showNotification === 'function') showNotification('已删除', 'success');
}

// ==================== 添加高亮样式 ====================
function addHighlightStyle() {
    if (document.getElementById('wish-pool-highlight-style')) return;
    const style = document.createElement('style');
    style.id = 'wish-pool-highlight-style';
    style.textContent = `
        .highlight-wish {
            animation: wishHighlight 1.5s ease;
            background: rgba(var(--accent-color-rgb, 255, 107, 107), 0.2) !important;
            border-radius: 16px;
            transition: all 0.2s;
        }
        @keyframes wishHighlight {
            0% { background: rgba(var(--accent-color-rgb, 255, 107, 107), 0); }
            30% { background: rgba(var(--accent-color-rgb, 255, 107, 107), 0.35); }
            100% { background: rgba(var(--accent-color-rgb, 255, 107, 107), 0); }
        }
    `;
    document.head.appendChild(style);
}

// ==================== 初始化入口 ====================
function initWishingPool() {
    if (typeof wishingPoolData === 'undefined' || !Array.isArray(wishingPoolData)) {
        window.wishingPoolData = [];
    }

    // 添加高亮样式
    addHighlightStyle();

    renderWishPoolGrid();
    checkWishReplyStatus();

    // 初始化编辑弹窗
    const editModal = document.getElementById('wish-edit-modal');
    if (editModal && !editModal._bound) {
        editModal._bound = true;
        initWishEditModal();
    }

    // 关闭按钮
    const closeBtn = document.getElementById('close-wishing-pool');
    if (closeBtn && !closeBtn._bound) {
        closeBtn._bound = true;
        closeBtn.onclick = function(e) {
            e.stopPropagation();
            closeWishingPoolModal();
        };
    }

    // 添加按钮
    const addBtn = document.getElementById('add-wish-btn');
    if (addBtn && !addBtn._bound) {
        addBtn._bound = true;
        addBtn.onclick = () => openEditWish(null);
    }

    // 点击模态框背景关闭
    const wishModal = document.getElementById('wishing-pool-modal');
    if (wishModal && !wishModal._bgBound) {
        wishModal._bgBound = true;
        wishModal.addEventListener('click', function(e) {
            if (e.target === wishModal) {
                closeWishingPoolModal();
            }
        });
    }

    console.log('许愿池初始化完成');
}

// ==================== 导出全局函数 ====================
window.initWishingPool = initWishingPool;
window.flipWishCard = flipWishCard;
window.flipWishCardById = flipWishCardById;
window.openEditWish = openEditWish;
window.deleteWish = deleteWish;
window.viewWishReply = viewWishReply;
window.openWishingPoolModal = openWishingPoolModal;
window.closeWishingPoolModal = closeWishingPoolModal;
window.renderWishPoolGrid = renderWishPoolGrid;

// 页面加载完成后自动检查
window.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (typeof wishingPoolData !== 'undefined' && Array.isArray(wishingPoolData)) {
            checkWishReplyStatus();
        }
    }, 1500);
});