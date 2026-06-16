/**
 * period-care.js - 月经关怀独立模块（稳定版，带批量添加但不破坏渲染）
 */
(function() {
    // 确保数据存在
    if (typeof periodCareMessages === 'undefined') {
        window.periodCareMessages = { approaching: [], during: [], delayed: [] };
    }

    // 渲染界面（与之前手动调用成功的版本一致）
    function renderPeriodCare(container) {
        if (!container) return;
        const categories = [
            { id: 'approaching', name: '月经临近', icon: '📅', color: '#FF9800', desc: '月经来临前3天发送' },
            { id: 'during', name: '月经期间', icon: '🌸', color: '#E91E63', desc: '月经期间每天发送' },
            { id: 'delayed', name: '月经推迟', icon: '⏰', color: '#9C27B0', desc: '月经推迟时发送' }
        ];
        container.innerHTML = '';
        categories.forEach(cat => {
            const msgs = periodCareMessages[cat.id] || [];
            const section = document.createElement('div');
            section.className = 'period-care-section';
            section.innerHTML = `
                <div class="period-care-header">
                    <div class="period-care-icon" style="background: ${cat.color}20;">${cat.icon}</div>
                    <div class="period-care-title-wrap">
                        <div class="period-care-title">${cat.name}</div>
                        <div class="period-care-desc">${cat.desc}</div>
                    </div>
                    <div class="period-care-count">${msgs.length} 条</div>
                </div>
                <div class="period-care-list" data-cat="${cat.id}">
                    ${msgs.map((msg, idx) => `
                        <div class="period-care-item" data-idx="${idx}">
                            <div class="period-care-text">${escapeHtml(msg)}</div>
                            <div class="period-care-actions">
                                <button class="period-care-btn edit" data-cat="${cat.id}" data-idx="${idx}" title="编辑">✏️</button>
                                <button class="period-care-btn delete" data-cat="${cat.id}" data-idx="${idx}" title="删除">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="period-care-add" data-cat="${cat.id}"><i class="fas fa-plus"></i> 添加消息</button>
            `;
            container.appendChild(section);
        });

        // 绑定事件（批量添加）
        container.querySelectorAll('.period-care-add').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.cat;
                openBatchAddModal(cat);
            });
        });
        container.querySelectorAll('.period-care-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cat = btn.dataset.cat;
                const idx = parseInt(btn.dataset.idx);
                editMessage(cat, idx);
            });
        });
        container.querySelectorAll('.period-care-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cat = btn.dataset.cat;
                const idx = parseInt(btn.dataset.idx);
                deleteMessage(cat, idx);
            });
        });
    }

    // 批量添加模态框（独立且不会干扰渲染）
    let batchModal = null;
    let currentBatchCategory = null;
    function openBatchAddModal(category) {
        currentBatchCategory = category;
        if (!batchModal) {
            batchModal = document.createElement('div');
            batchModal.className = 'modal';
            batchModal.id = 'period-batch-modal';
            batchModal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-title"><i class="fas fa-layer-group"></i> <span id="batch-modal-title">批量添加消息</span></div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;" id="batch-modal-desc">每行一条，自动去重</div>
                    <textarea id="batch-messages-input" rows="8" placeholder="在此粘贴内容，每行一条…" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:8px; background:var(--primary-bg); color:var(--text-primary); font-family:var(--font-family); resize:vertical;"></textarea>
                    <div style="margin-top:8px; font-size:12px; color:var(--text-secondary);">共 <span id="batch-count">0</span> 条</div>
                    <div class="modal-buttons" style="margin-top:20px;">
                        <button class="modal-btn modal-btn-secondary" id="cancel-batch">取消</button>
                        <button class="modal-btn modal-btn-primary" id="confirm-batch">添加</button>
                    </div>
                </div>
            `;
            document.body.appendChild(batchModal);
            const ta = batchModal.querySelector('#batch-messages-input');
            ta.addEventListener('input', () => {
                const lines = ta.value.split('\n').filter(l => l.trim().length > 0);
                document.getElementById('batch-count').innerText = lines.length;
            });
            batchModal.querySelector('#cancel-batch').addEventListener('click', () => {
                hideModal(batchModal);
                currentBatchCategory = null;
            });
            batchModal.querySelector('#confirm-batch').addEventListener('click', () => {
                const lines = batchModal.querySelector('#batch-messages-input').value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length === 0) {
                    showNotification('请至少输入一条消息', 'warning');
                    return;
                }
                const existing = periodCareMessages[currentBatchCategory] || [];
                let added = 0;
                for (let line of lines) {
                    if (!existing.includes(line)) {
                        existing.push(line);
                        added++;
                    }
                }
                if (added > 0) {
                    periodCareMessages[currentBatchCategory] = existing;
                    throttledSaveData();
                    // 刷新当前月经关怀界面
                    const listArea = document.getElementById('custom-replies-list');
                    if (listArea && window.currentSubTab === 'period') {
                        renderPeriodCare(listArea);
                    }
                    showNotification(`成功添加 ${added} 条消息`, 'success');
                } else {
                    showNotification('没有新增的消息（全部重复）', 'info');
                }
                hideModal(batchModal);
                batchModal.querySelector('#batch-messages-input').value = '';
                document.getElementById('batch-count').innerText = '0';
                currentBatchCategory = null;
            });
        }
        const titleMap = { approaching:'批量添加月经临近消息', during:'批量添加月经期间消息', delayed:'批量添加月经推迟消息' };
        const descMap = { approaching:'月经来临前3天发送的消息，每行一条，自动去重', during:'月经期间每天发送的消息，每行一条，自动去重', delayed:'月经推迟时发送的消息，每行一条，自动去重' };
        batchModal.querySelector('#batch-modal-title').innerText = titleMap[category];
        batchModal.querySelector('#batch-modal-desc').innerText = descMap[category];
        batchModal.querySelector('#batch-messages-input').value = '';
        document.getElementById('batch-count').innerText = '0';
        showModal(batchModal);
    }

    function editMessage(cat, idx) {
        const current = periodCareMessages[cat][idx];
        const input = prompt('编辑消息：', current);
        if (input !== null && input.trim()) {
            periodCareMessages[cat][idx] = input.trim();
            throttledSaveData();
            const listArea = document.getElementById('custom-replies-list');
            if (listArea && window.currentSubTab === 'period') {
                renderPeriodCare(listArea);
            }
            showNotification('已保存', 'success');
        }
    }

    function deleteMessage(cat, idx) {
        if (confirm('确定删除这条消息吗？')) {
            periodCareMessages[cat].splice(idx, 1);
            throttledSaveData();
            const listArea = document.getElementById('custom-replies-list');
            if (listArea && window.currentSubTab === 'period') {
                renderPeriodCare(listArea);
            }
            showNotification('已删除', 'success');
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 添加样式（如果没有）
    if (!document.getElementById('period-tab-style')) {
        const style = document.createElement('style');
        style.id = 'period-tab-style';
        style.textContent = `
            .period-care-section { margin-bottom: 20px; background: var(--secondary-bg); border-radius: 16px; border: 1px solid var(--border-color); overflow: hidden; }
            .period-care-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: linear-gradient(135deg, rgba(var(--accent-color-rgb), 0.08), transparent); border-bottom: 1px solid var(--border-color); }
            .period-care-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
            .period-care-title-wrap { flex: 1; }
            .period-care-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
            .period-care-desc { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
            .period-care-count { font-size: 12px; color: var(--text-secondary); background: var(--primary-bg); padding: 4px 10px; border-radius: 20px; }
            .period-care-list { padding: 12px; }
            .period-care-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; margin-bottom: 6px; background: var(--primary-bg); border: 1px solid var(--border-color); }
            .period-care-text { flex: 1; font-size: 13px; color: var(--text-primary); word-break: break-word; }
            .period-care-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.15s; }
            .period-care-item:hover .period-care-actions { opacity: 1; }
            @media (hover: none) { .period-care-actions { opacity: 1; } }
            .period-care-btn { width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 14px; transition: all 0.15s; }
            .period-care-btn:hover { background: rgba(var(--accent-color-rgb), 0.1); color: var(--accent-color); }
            .period-care-btn.delete:hover { background: rgba(244, 67, 54, 0.1); color: #f44336; }
            .period-care-add { display: flex; align-items: center; justify-content: center; gap: 6px; width: calc(100% - 24px); margin: 0 12px 16px 12px; padding: 10px; border-radius: 12px; background: transparent; border: 1.5px dashed var(--border-color); color: var(--text-secondary); font-size: 13px; cursor: pointer; }
            .period-care-add:hover { border-color: var(--accent-color); color: var(--accent-color); }
        `;
        document.head.appendChild(style);
    }

    // 核心：确保每次切换到“月经关怀”选项卡时都正确渲染
    function ensureRendering() {
        if (window.currentSubTab === 'period') {
            const listArea = document.getElementById('custom-replies-list');
            if (listArea) {
                // 延迟一点点，防止被其他代码清空
                setTimeout(() => renderPeriodCare(listArea), 30);
            }
        }
    }

    // 监听选项卡点击事件（通过事件委托）
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.reply-tab-btn');
        if (btn && btn.dataset.id === 'period') {
            // 短暂延迟，等原有逻辑更新 currentSubTab 后再渲染
            setTimeout(ensureRendering, 80);
        }
    });

    // 监听回复库弹窗打开
    const modal = document.getElementById('custom-replies-modal');
    if (modal) {
        const observer = new MutationObserver(() => {
            if (modal.style.display === 'flex') {
                setTimeout(ensureRendering, 100);
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }

    // 暴露渲染函数供手动调用（可选）
    window._renderPeriodCareTab = renderPeriodCare;
})();
// 监听回复库弹窗中的选项卡点击
function setupPeriodTabHook() {
    const tabsContainer = document.getElementById('cr-sub-tabs');
    if (!tabsContainer) {
        // 如果容器还没出现，稍后重试
        setTimeout(setupPeriodTabHook, 500);
        return;
    }

    // 找到“月经关怀”按钮
    const periodBtn = tabsContainer.querySelector('.reply-tab-btn[data-id="period"]');
    if (!periodBtn) {
        setTimeout(setupPeriodTabHook, 500);
        return;
    }

    // 避免重复绑定
    if (periodBtn.dataset.hooked === 'true') return;
    periodBtn.dataset.hooked = 'true';

    // 移除原有的事件（如果有），添加新的事件
    const newBtn = periodBtn.cloneNode(true);
    periodBtn.parentNode.replaceChild(newBtn, periodBtn);

    newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // 手动更新全局变量
        window.currentSubTab = 'period';

        // 直接渲染月经关怀界面
        const listArea = document.getElementById('custom-replies-list');
        if (listArea && typeof window._renderPeriodCareTab === 'function') {
            window._renderPeriodCareTab(listArea);
        }

        // 同时更新按钮样式（高亮）
        const allTabs = tabsContainer.querySelectorAll('.reply-tab-btn');
        allTabs.forEach(tab => tab.classList.remove('active'));
        newBtn.classList.add('active');
    });
}

// 监听回复库弹窗的打开（因为弹窗是动态显示的）
const modal = document.getElementById('custom-replies-modal');
if (modal) {
    const observer = new MutationObserver(() => {
        if (modal.style.display === 'flex') {
            // 弹窗打开后，等待 DOM 渲染完再 hook
            setTimeout(setupPeriodTabHook, 100);
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
}

// 如果页面加载时弹窗已经打开，也尝试 hook
setupPeriodTabHook();