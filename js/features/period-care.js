/**
 * period-care.js - 月经关怀独立模块（完整版）
 * 功能：分类管理、批量添加、单条编辑/删除、批量删除、全部删除、查重清理、持久化修复
 */
(function() {
    const STORAGE_KEY = 'periodCareMessages';
    const SETTINGS_KEY = 'settings';

    const CATEGORIES = [
        { id: 'approaching', name: '月经临近', icon: '📅', color: '#FF9800', desc: '月经来临前3天发送' },
        { id: 'during',      name: '月经期间', icon: '🌸', color: '#E91E63', desc: '月经期间每天发送' },
        { id: 'delayed',     name: '月经推迟', icon: '⏰', color: '#9C27B0', desc: '月经推迟时发送' }
    ];

    // ==================== 数据加载与保存 ====================
    async function loadMessages() {
        if (window.periodCareMessages &&
            ((window.periodCareMessages.approaching?.length) ||
             (window.periodCareMessages.during?.length) ||
             (window.periodCareMessages.delayed?.length))) {
            console.log('[月经关怀] 已有内存数据，保留');
            return;
        }

        try {
            const saved = await localforage.getItem(STORAGE_KEY);
            if (saved && typeof saved === 'object') {
                window.periodCareMessages = {
                    approaching: Array.isArray(saved.approaching) ? saved.approaching : [],
                    during:      Array.isArray(saved.during)      ? saved.during      : [],
                    delayed:     Array.isArray(saved.delayed)     ? saved.delayed     : []
                };
                console.log('[月经关怀] 已从独立 key 恢复', window.periodCareMessages);
                return;
            }
        } catch (e) {
            console.warn('[月经关怀] 独立 key 读取失败', e);
        }

        try {
            const s = await localforage.getItem(SETTINGS_KEY);
            if (s && s.periodCareMessages) {
                window.periodCareMessages = {
                    approaching: Array.isArray(s.periodCareMessages.approaching) ? s.periodCareMessages.approaching : [],
                    during:      Array.isArray(s.periodCareMessages.during)      ? s.periodCareMessages.during      : [],
                    delayed:     Array.isArray(s.periodCareMessages.delayed)     ? s.periodCareMessages.delayed     : []
                };
                console.log('[月经关怀] 已从 settings 恢复', window.periodCareMessages);
                return;
            }
        } catch (e) {
            console.warn('[月经关怀] settings 读取失败', e);
        }

        if (!window.periodCareMessages) {
            window.periodCareMessages = { approaching: [], during: [], delayed: [] };
            console.log('[月经关怀] 初始化为空');
        }
    }

    async function saveMessages() {
        try {
            await localforage.setItem(STORAGE_KEY, window.periodCareMessages);
            try {
                const s = (await localforage.getItem(SETTINGS_KEY)) || {};
                s.periodCareMessages = window.periodCareMessages;
                await localforage.setItem(SETTINGS_KEY, s);
            } catch (e) {}
            if (typeof throttledSaveData === 'function') throttledSaveData();
        } catch (e) {
            console.error('[月经关怀] 保存失败', e);
            if (typeof showNotification === 'function') {
                showNotification('保存失败，请检查存储空间', 'error');
            }
        }
    }

    const loadPromise = loadMessages();

    // ==================== 工具 ====================
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function catName(id) {
        const c = CATEGORIES.find(c => c.id === id);
        return c ? c.name : id;
    }

    // 规范化：忽略前后空格、大小写、多空格
    function normalizeText(text) {
        return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    // ==================== 渲染 ====================
    function renderPeriodCare(container) {
        if (!container) return;
        if (!window.periodCareMessages) {
            loadPromise.then(() => renderPeriodCare(container));
            return;
        }

        // 保留已勾选
        const prevSel = {};
        container.querySelectorAll('.period-care-list').forEach(list => {
            const cat = list.dataset.cat;
            const set = new Set();
            list.querySelectorAll('.period-care-cb:checked').forEach(cb => {
                set.add(parseInt(cb.dataset.idx, 10));
            });
            prevSel[cat] = set;
        });

        container.innerHTML = '';

        CATEGORIES.forEach(cat => {
            const msgs = window.periodCareMessages[cat.id] || [];
            const section = document.createElement('div');
            section.className = 'period-care-section';
            section.dataset.cat = cat.id;

            const itemsHtml = msgs.length === 0
                ? `<div class="period-care-empty"><i class="fas fa-inbox"></i> 暂无语录，点击下方按钮添加</div>`
                : msgs.map((msg, idx) => `
                    <div class="period-care-item" data-idx="${idx}">
                        <label class="period-care-cb-wrap">
                            <input type="checkbox" class="period-care-cb" data-cat="${cat.id}" data-idx="${idx}">
                            <span class="period-care-cb-mark"></span>
                        </label>
                        <div class="period-care-text">${escapeHtml(msg)}</div>
                        <div class="period-care-actions">
                            <button class="period-care-btn edit" data-cat="${cat.id}" data-idx="${idx}" title="编辑">✏️</button>
                            <button class="period-care-btn delete" data-cat="${cat.id}" data-idx="${idx}" title="删除">🗑️</button>
                        </div>
                    </div>
                `).join('');

            const toolbarHtml = msgs.length > 0 ? `
                <div class="period-care-toolbar">
                    <label class="period-care-select-all-label">
                        <input type="checkbox" class="period-care-select-all-cb" data-cat="${cat.id}">
                        <span class="period-care-select-all-mark"></span>
                        <span>全选</span>
                    </label>
                    <span class="period-care-selected-count" data-cat="${cat.id}"></span>
                    <div class="period-care-toolbar-actions">
                        <button class="period-care-batch-btn period-care-dedupe" data-cat="${cat.id}" title="扫描并清理重复语录">查重</button>
                        <button class="period-care-batch-btn period-care-delete-selected" data-cat="${cat.id}" disabled>删除选中</button>
                        <button class="period-care-batch-btn danger period-care-delete-all" data-cat="${cat.id}">全部删除</button>
                    </div>
                </div>
            ` : '';

            section.innerHTML = `
                <div class="period-care-header">
                    <div class="period-care-icon" style="background: ${cat.color}20;">${cat.icon}</div>
                    <div class="period-care-title-wrap">
                        <div class="period-care-title">${cat.name}</div>
                        <div class="period-care-desc">${cat.desc}</div>
                    </div>
                    <div class="period-care-count">${msgs.length} 条</div>
                </div>
                ${toolbarHtml}
                <div class="period-care-list" data-cat="${cat.id}">
                    ${itemsHtml}
                </div>
                <button class="period-care-add" data-cat="${cat.id}"><i class="fas fa-plus"></i> 添加消息</button>
            `;
            container.appendChild(section);
        });

        // 恢复勾选
        Object.keys(prevSel).forEach(cat => {
            const set = prevSel[cat];
            if (!set || !set.size) return;
            const list = container.querySelector(`.period-care-list[data-cat="${cat}"]`);
            if (!list) return;
            list.querySelectorAll('.period-care-cb').forEach(cb => {
                if (set.has(parseInt(cb.dataset.idx, 10))) cb.checked = true;
            });
            updateBatchState(container, cat);
        });

        bindPeriodCareEvents(container);
    }

    // ==================== 事件绑定 ====================
    function bindPeriodCareEvents(container) {
        container.querySelectorAll('.period-care-add').forEach(btn => {
            btn.addEventListener('click', () => openBatchAddModal(btn.dataset.cat));
        });

        container.querySelectorAll('.period-care-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                editMessage(btn.dataset.cat, parseInt(btn.dataset.idx, 10));
            });
        });

        container.querySelectorAll('.period-care-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteMessage(btn.dataset.cat, parseInt(btn.dataset.idx, 10));
            });
        });

        container.querySelectorAll('.period-care-cb').forEach(cb => {
            cb.addEventListener('change', () => updateBatchState(container, cb.dataset.cat));
        });

        container.querySelectorAll('.period-care-select-all-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                const cat = cb.dataset.cat;
                const list = container.querySelector(`.period-care-list[data-cat="${cat}"]`);
                if (!list) return;
                list.querySelectorAll('.period-care-cb').forEach(itemCb => {
                    itemCb.checked = cb.checked;
                });
                updateBatchState(container, cat);
            });
        });

        container.querySelectorAll('.period-care-dedupe').forEach(btn => {
            btn.addEventListener('click', () => dedupeMessages(btn.dataset.cat));
        });

        container.querySelectorAll('.period-care-delete-selected').forEach(btn => {
            btn.addEventListener('click', () => deleteSelected(btn.dataset.cat));
        });

        container.querySelectorAll('.period-care-delete-all').forEach(btn => {
            btn.addEventListener('click', () => deleteAll(btn.dataset.cat));
        });
    }

    function updateBatchState(container, cat) {
        const list = container.querySelector(`.period-care-list[data-cat="${cat}"]`);
        if (!list) return;
        const allCbs = list.querySelectorAll('.period-care-cb');
        const checkedCbs = list.querySelectorAll('.period-care-cb:checked');
        const selectAllCb = container.querySelector(`.period-care-select-all-cb[data-cat="${cat}"]`);
        const deleteBtn = container.querySelector(`.period-care-delete-selected[data-cat="${cat}"]`);
        const countEl = container.querySelector(`.period-care-selected-count[data-cat="${cat}"]`);

        if (selectAllCb) {
            selectAllCb.checked = allCbs.length > 0 && checkedCbs.length === allCbs.length;
            selectAllCb.indeterminate = checkedCbs.length > 0 && checkedCbs.length < allCbs.length;
        }
        if (deleteBtn) {
            deleteBtn.disabled = checkedCbs.length === 0;
            deleteBtn.textContent = checkedCbs.length > 0 ? `删除选中 (${checkedCbs.length})` : '删除选中';
        }
        if (countEl) {
            countEl.textContent = checkedCbs.length > 0 ? `已选 ${checkedCbs.length} 条` : '';
        }
    }

    // ==================== 操作 ====================
    async function editMessage(cat, idx) {
        const current = window.periodCareMessages[cat][idx];
        const input = prompt('编辑消息：', current);
        if (input !== null && input.trim()) {
            window.periodCareMessages[cat][idx] = input.trim();
            await saveMessages();
            refreshCurrentView();
            if (typeof showNotification === 'function') showNotification('已保存', 'success');
        }
    }

    async function deleteMessage(cat, idx) {
        if (!confirm('确定删除这条消息吗？')) return;
        window.periodCareMessages[cat].splice(idx, 1);
        await saveMessages();
        refreshCurrentView();
        if (typeof showNotification === 'function') showNotification('已删除', 'success');
    }

    async function deleteSelected(cat) {
        const listArea = document.getElementById('custom-replies-list');
        if (!listArea) return;
        const list = listArea.querySelector(`.period-care-list[data-cat="${cat}"]`);
        if (!list) return;

        const indices = [];
        list.querySelectorAll('.period-care-cb:checked').forEach(cb => {
            indices.push(parseInt(cb.dataset.idx, 10));
        });
        if (indices.length === 0) return;
        if (!confirm(`确定删除选中的 ${indices.length} 条语录吗？`)) return;

        indices.sort((a, b) => b - a);
        indices.forEach(i => window.periodCareMessages[cat].splice(i, 1));
        await saveMessages();
        refreshCurrentView();
        if (typeof showNotification === 'function') {
            showNotification(`已删除 ${indices.length} 条`, 'success');
        }
    }

    async function deleteAll(cat) {
        const total = (window.periodCareMessages[cat] || []).length;
        if (total === 0) return;
        if (!confirm(`确定清空「${catName(cat)}」的全部 ${total} 条语录吗？此操作不可恢复。`)) return;

        window.periodCareMessages[cat] = [];
        await saveMessages();
        refreshCurrentView();
        if (typeof showNotification === 'function') {
            showNotification(`已清空 ${total} 条语录`, 'success');
        }
    }

    // ==================== 查重清理 ====================
    function findDuplicates(cat) {
        const msgs = window.periodCareMessages[cat] || [];
        const seen = new Map();       // 规范化 key -> 首个索引
        const dupIndices = [];        // 需要删除的索引
        const dupDetails = [];        // 用于提示

        msgs.forEach((raw, idx) => {
            const norm = normalizeText(raw);
            if (!norm) {
                dupIndices.push(idx);
                return;
            }
            if (seen.has(norm)) {
                dupIndices.push(idx);
                dupDetails.push({ keep: seen.get(norm), remove: idx, text: raw });
            } else {
                seen.set(norm, idx);
            }
        });

        return { dupIndices, dupDetails, total: msgs.length };
    }

    async function dedupeMessages(cat) {
        const msgs = window.periodCareMessages[cat] || [];
        if (msgs.length === 0) {
            if (typeof showNotification === 'function') showNotification('暂无语录', 'info');
            return;
        }

        const { dupIndices, dupDetails, total } = findDuplicates(cat);

        if (dupIndices.length === 0) {
            if (typeof showNotification === 'function') {
                showNotification(`「${catName(cat)}」没有重复语录（共 ${total} 条）`, 'success');
            }
            return;
        }

        const previewLines = dupDetails.slice(0, 3).map(d => `· ${d.text}`).join('\n');
        const moreLine = dupDetails.length > 3 ? `\n… 还有 ${dupDetails.length - 3} 条` : '';

        const confirmMsg =
            `「${catName(cat)}」共 ${total} 条语录，\n` +
            `检测到 ${dupIndices.length} 条重复（保留首次出现的）：\n\n` +
            `${previewLines}${moreLine}\n\n` +
            `确定清理这 ${dupIndices.length} 条重复项吗？`;

        if (!confirm(confirmMsg)) return;

        dupIndices.sort((a, b) => b - a).forEach(i => {
            window.periodCareMessages[cat].splice(i, 1);
        });

        await saveMessages();
        refreshCurrentView();

        if (typeof showNotification === 'function') {
            showNotification(
                `已清理 ${dupIndices.length} 条重复语录，剩余 ${window.periodCareMessages[cat].length} 条`,
                'success', 3000
            );
        }
    }

    function refreshCurrentView() {
        const listArea = document.getElementById('custom-replies-list');
        if (listArea && window.currentSubTab === 'period') {
            renderPeriodCare(listArea);
        }
    }

    // ==================== 批量添加 ====================
    function openBatchAddModal(category) {
        const old = document.getElementById('period-batch-modal');
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'period-batch-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-title">
                    <i class="fas fa-layer-group"></i>
                    <span id="batch-modal-title">批量添加消息</span>
                </div>
                <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;" id="batch-modal-desc">每行一条，自动去重</div>
                <textarea id="batch-messages-input" rows="8" placeholder="在此粘贴内容，每行一条…" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:8px; background:var(--primary-bg); color:var(--text-primary); font-family:var(--font-family); resize:vertical; box-sizing:border-box;"></textarea>
                <div style="margin-top:8px; font-size:12px; color:var(--text-secondary);">共 <span id="batch-count">0</span> 条</div>
                <div class="modal-buttons" style="margin-top:20px;">
                    <button class="modal-btn modal-btn-secondary" id="cancel-batch">取消</button>
                    <button class="modal-btn modal-btn-primary" id="confirm-batch">添加</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const titleMap = {
            approaching: '批量添加月经临近消息',
            during:      '批量添加月经期间消息',
            delayed:     '批量添加月经推迟消息'
        };
        const descMap = {
            approaching: '月经来临前3天发送的消息，每行一条，自动去重',
            during:      '月经期间每天发送的消息，每行一条，自动去重',
            delayed:     '月经推迟时发送的消息，每行一条，自动去重'
        };
        modal.querySelector('#batch-modal-title').innerText = titleMap[category];
        modal.querySelector('#batch-modal-desc').innerText  = descMap[category];

        const ta = modal.querySelector('#batch-messages-input');
        const countEl = modal.querySelector('#batch-count');
        ta.addEventListener('input', () => {
            countEl.innerText = ta.value.split('\n').filter(l => l.trim().length > 0).length;
        });

        modal.querySelector('#cancel-batch').addEventListener('click', () => {
            if (typeof hideModal === 'function') hideModal(modal);
            else modal.style.display = 'none';
        });

        modal.querySelector('#confirm-batch').addEventListener('click', async () => {
            const lines = ta.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length === 0) {
                if (typeof showNotification === 'function') showNotification('请至少输入一条消息', 'warning');
                return;
            }

            const existing = window.periodCareMessages[category] || [];
            // 规范化去重：忽略大小写/空格
            const existingNorm = new Set(existing.map(normalizeText));
            let added = 0;
            let skipped = 0;

            for (const line of lines) {
                const norm = normalizeText(line);
                if (!norm) continue;
                if (existingNorm.has(norm)) {
                    skipped++;
                    continue;
                }
                existing.push(line);
                existingNorm.add(norm);
                added++;
            }

            if (added > 0) {
                window.periodCareMessages[category] = existing;
                await saveMessages();
                refreshCurrentView();
                const msg = skipped > 0
                    ? `成功添加 ${added} 条，跳过 ${skipped} 条重复`
                    : `成功添加 ${added} 条消息`;
                if (typeof showNotification === 'function') showNotification(msg, 'success');
            } else {
                if (typeof showNotification === 'function') showNotification(`没有新增（${skipped} 条全部重复）`, 'info');
            }
            if (typeof hideModal === 'function') hideModal(modal);
            else modal.style.display = 'none';
        });

        if (typeof showModal === 'function') showModal(modal);
        else modal.style.display = 'flex';
    }

    // ==================== 样式注入 ====================
    function injectStyles() {
        if (document.getElementById('period-tab-style')) return;
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

            /* 工具栏 */
            .period-care-toolbar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(var(--accent-color-rgb), 0.04); border-bottom: 1px solid var(--border-color); flex-wrap: wrap; }
            .period-care-select-all-label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: var(--text-secondary); user-select: none; }
            .period-care-select-all-label input { display: none; }
            .period-care-select-all-mark { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid var(--border-color); display: inline-block; position: relative; transition: all 0.15s; flex-shrink: 0; }
            .period-care-select-all-label input:checked + .period-care-select-all-mark { background: var(--accent-color); border-color: var(--accent-color); }
            .period-care-select-all-label input:checked + .period-care-select-all-mark::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
            .period-care-select-all-label input:indeterminate + .period-care-select-all-mark { background: var(--accent-color); border-color: var(--accent-color); }
            .period-care-select-all-label input:indeterminate + .period-care-select-all-mark::after { content: ''; position: absolute; left: 3px; top: 6px; width: 8px; height: 2px; background: #fff; }
            .period-care-selected-count { font-size: 11px; color: var(--accent-color); font-weight: 600; }
            .period-care-toolbar-actions { margin-left: auto; display: flex; gap: 6px; }
            .period-care-batch-btn { font-size: 11px; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary); cursor: pointer; font-family: inherit; transition: all 0.15s; }
            .period-care-batch-btn:not(:disabled):hover { border-color: var(--accent-color); color: var(--accent-color); }
            .period-care-batch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .period-care-batch-btn.danger { color: #f44336; border-color: rgba(244, 67, 54, 0.35); }
            .period-care-batch-btn.danger:hover { background: rgba(244, 67, 54, 0.08); color: #f44336; border-color: #f44336; }

            /* 列表 */
            .period-care-list { padding: 12px; }
            .period-care-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; margin-bottom: 6px; background: var(--primary-bg); border: 1px solid var(--border-color); }
            .period-care-cb-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
            .period-care-cb { position: absolute; opacity: 0; width: 0; height: 0; }
            .period-care-cb-mark { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--border-color); display: inline-block; transition: all 0.15s; position: relative; }
            .period-care-cb:checked + .period-care-cb-mark { background: var(--accent-color); border-color: var(--accent-color); }
            .period-care-cb:checked + .period-care-cb-mark::after { content: ''; position: absolute; left: 5px; top: 1px; width: 4px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
            .period-care-text { flex: 1; font-size: 13px; color: var(--text-primary); word-break: break-word; }
            .period-care-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.15s; }
            .period-care-item:hover .period-care-actions { opacity: 1; }
            @media (hover: none) { .period-care-actions { opacity: 1; } }
            .period-care-btn { width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 14px; transition: all 0.15s; }
            .period-care-btn:hover { background: rgba(var(--accent-color-rgb), 0.1); color: var(--accent-color); }
            .period-care-btn.delete:hover { background: rgba(244, 67, 54, 0.1); color: #f44336; }
            .period-care-empty { padding: 20px 12px; text-align: center; color: var(--text-secondary); font-size: 12px; opacity: 0.7; }
            .period-care-empty i { margin-right: 6px; }
            .period-care-add { display: flex; align-items: center; justify-content: center; gap: 6px; width: calc(100% - 24px); margin: 0 12px 16px 12px; padding: 10px; border-radius: 12px; background: transparent; border: 1.5px dashed var(--border-color); color: var(--text-secondary); font-size: 13px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
            .period-care-add:hover { border-color: var(--accent-color); color: var(--accent-color); }
        `;
        document.head.appendChild(style);
    }

    injectStyles();

    // ==================== 触发渲染 ====================
    function ensureRendering() {
        if (window.currentSubTab === 'period') {
            const listArea = document.getElementById('custom-replies-list');
            if (listArea) {
                setTimeout(() => renderPeriodCare(listArea), 30);
            }
        }
    }

    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.reply-tab-btn');
        if (btn && btn.dataset.id === 'period') {
            setTimeout(ensureRendering, 80);
        }
    });

    const modal = document.getElementById('custom-replies-modal');
    if (modal) {
        const observer = new MutationObserver(() => {
            if (modal.style.display === 'flex') {
                setTimeout(ensureRendering, 100);
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }

    window._renderPeriodCareTab = renderPeriodCare;
})();

// ==================== 选项卡 hook ====================
function setupPeriodTabHook() {
    const tabsContainer = document.getElementById('cr-sub-tabs');
    if (!tabsContainer) {
        setTimeout(setupPeriodTabHook, 500);
        return;
    }
    const periodBtn = tabsContainer.querySelector('.reply-tab-btn[data-id="period"]');
    if (!periodBtn) {
        setTimeout(setupPeriodTabHook, 500);
        return;
    }
    if (periodBtn.dataset.hooked === 'true') return;
    periodBtn.dataset.hooked = 'true';

    const newBtn = periodBtn.cloneNode(true);
    periodBtn.parentNode.replaceChild(newBtn, periodBtn);

    newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.currentSubTab = 'period';
        const listArea = document.getElementById('custom-replies-list');
        if (listArea && typeof window._renderPeriodCareTab === 'function') {
            window._renderPeriodCareTab(listArea);
        }
        const allTabs = tabsContainer.querySelectorAll('.reply-tab-btn');
        allTabs.forEach(tab => tab.classList.remove('active'));
        newBtn.classList.add('active');
    });
}

const modal = document.getElementById('custom-replies-modal');
if (modal) {
    const observer = new MutationObserver(() => {
        if (modal.style.display === 'flex') {
            setTimeout(setupPeriodTabHook, 100);
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
}
setupPeriodTabHook();