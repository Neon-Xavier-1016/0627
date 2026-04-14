/**
 * data.js — 数据管理界面 v10
 * 整合存储统计（真实配额）+ 抽屉式备份/恢复 + 云同步（可选）
 * 无致谢声明，危险操作两个独立卡片
 */
(function () {
    'use strict';

    // ======================== 动态注入样式 ========================
    function injectStyles() {
        if (document.getElementById('dm-data-styles')) return;
        const style = document.createElement('style');
        style.id = 'dm-data-styles';
        style.textContent = `
/* ----- 数据管理模态框样式（移动优先）----- */
.dm6-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--secondary-bg);
}

/* 顶部栏 */
.dm6-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-color);
    background: var(--secondary-bg);
    flex-shrink: 0;
}
.dm6-topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
}
.dm6-back-btn {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}
.dm6-back-btn:hover {
    background: rgba(var(--accent-color-rgb), 0.1);
}
.dm6-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.3px;
}
.dm6-close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* 滚动主体 */
.dm6-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 24px;
    -webkit-overflow-scrolling: touch;
}

/* 存储卡片 */
.dm6-storage-card {
    background: var(--primary-bg);
    border-radius: 24px;
    padding: 16px 18px;
    margin-bottom: 24px;
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.dm6-storage-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
}
.dm6-storage-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 6px;
}
.dm6-storage-total {
    font-size: 12px;
    color: var(--text-secondary);
    font-family: monospace;
}
.dm6-stats-grid {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 16px 0 12px;
}
.dm6-stat-item {
    flex: 1;
    text-align: center;
    background: rgba(var(--accent-color-rgb), 0.05);
    border-radius: 18px;
    padding: 10px 4px;
}
.dm6-stat-icon {
    font-size: 18px;
    margin-bottom: 6px;
    color: var(--accent-color);
}
.dm6-stat-value {
    font-size: 16px;
    font-weight: 800;
    color: var(--text-primary);
}
.dm6-stat-label {
    font-size: 10px;
    color: var(--text-secondary);
    margin-top: 4px;
}
.dm6-progress {
    height: 6px;
    background: rgba(var(--accent-color-rgb), 0.15);
    border-radius: 10px;
    overflow: hidden;
    margin: 8px 0 4px;
}
.dm6-progress-fill {
    height: 100%;
    border-radius: 10px;
    width: 0%;
    transition: width 0.4s ease;
    background: linear-gradient(90deg, var(--accent-color), rgba(var(--accent-color-rgb), 0.7));
}

/* 区域标题 */
.dm6-section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-secondary);
    margin: 20px 0 12px 4px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.dm6-section-title i {
    font-size: 13px;
    opacity: 0.7;
}

/* 磁贴网格 */
.dm6-grid {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
}
.dm6-tile {
    flex: 1;
    background: var(--primary-bg);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    padding: 14px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.2s;
}
.dm6-tile:active {
    transform: scale(0.97);
    background: rgba(var(--accent-color-rgb), 0.05);
}
.dm6-tile-icon {
    width: 44px;
    height: 44px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
}
.dm6-tile-icon.blue {
    background: rgba(74, 144, 226, 0.15);
    color: #4A90E2;
}
.dm6-tile-icon.teal {
    background: rgba(59, 200, 164, 0.15);
    color: #3BC8A4;
}
.dm6-tile-info {
    flex: 1;
}
.dm6-tile-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
}
.dm6-tile-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 2px;
}
.dm6-tile-arrow {
    color: var(--text-secondary);
    font-size: 14px;
    opacity: 0.6;
}

/* 行卡片（云同步、通知） */
.dm6-row-card {
    background: var(--primary-bg);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    overflow: hidden;
    margin-bottom: 16px;
}
.dm6-row-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-color);
}
.dm6-row-item:last-child {
    border-bottom: none;
}
.dm6-row-icon {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
}
.dm6-row-icon.amber {
    background: rgba(255, 159, 10, 0.12);
    color: #FF9F0A;
}
.dm6-row-icon.slate {
    background: rgba(142, 142, 147, 0.12);
    color: #8E8E93;
}
.dm6-row-icon.green {
    background: rgba(62, 207, 142, 0.12);
    color: #3ECF8E;
}
.dm6-row-info {
    flex: 1;
    min-width: 0;
}
.dm6-row-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}
.dm6-row-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.dm6-nav-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 20px;
    font-size: 14px;
    transition: background 0.2s;
}
.dm6-nav-btn:hover {
    background: rgba(var(--accent-color-rgb), 0.1);
}

/* 开关 */
.dm6-toggle {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 26px;
    flex-shrink: 0;
}
.dm6-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}
.dm6-toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(120, 120, 128, 0.3);
    border-radius: 34px;
    transition: 0.2s;
}
.dm6-toggle-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: 0.2s;
}
.dm6-toggle input:checked + .dm6-toggle-slider {
    background-color: var(--accent-color);
}
.dm6-toggle input:checked + .dm6-toggle-slider:before {
    transform: translateX(22px);
}

/* 危险操作卡片行 */
.dm6-danger-row {
    display: flex;
    gap: 12px;
    margin-top: 8px;
}
.dm6-danger-card {
    flex: 1;
    background: var(--primary-bg);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    padding: 16px 12px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
}
.dm6-danger-card:active {
    transform: scale(0.97);
}
.dm6-danger-card.orange {
    border-left: 3px solid #FF9F0A;
}
.dm6-danger-card.red {
    border-left: 3px solid #FF3B30;
}
.dm6-danger-icon {
    font-size: 28px;
    margin-bottom: 8px;
}
.dm6-danger-card.orange .dm6-danger-icon { color: #FF9F0A; }
.dm6-danger-card.red .dm6-danger-icon { color: #FF3B30; }
.dm6-danger-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
}
.dm6-danger-desc {
    font-size: 10px;
    color: var(--text-secondary);
    margin-top: 4px;
}

/* 抽屉菜单 */
.dm6-drawer {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 3000;
    visibility: hidden;
    transition: visibility 0.2s;
}
.dm6-drawer.open {
    visibility: visible;
}
.dm6-drawer-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.5);
    opacity: 0;
    transition: opacity 0.2s;
}
.dm6-drawer.open .dm6-drawer-backdrop {
    opacity: 1;
}
.dm6-drawer-sheet {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--secondary-bg);
    border-radius: 28px 28px 0 0;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1);
    padding: 20px 20px 30px;
    max-height: 80vh;
    overflow-y: auto;
}
.dm6-drawer.open .dm6-drawer-sheet {
    transform: translateY(0);
}
.dm6-drawer-handle {
    width: 40px;
    height: 4px;
    background: var(--border-color);
    border-radius: 4px;
    margin: 0 auto 20px;
}
.dm6-drawer-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
}
.dm6-drawer-icon {
    width: 48px;
    height: 48px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: white;
}
.dm6-drawer-icon.blue {
    background: linear-gradient(135deg, #4A90E2, #3576C8);
}
.dm6-drawer-icon.teal {
    background: linear-gradient(135deg, #3BC8A4, #20A882);
}
.dm6-drawer-title-text {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
}
.dm6-drawer-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
}
.dm6-drawer-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
}
.dm6-drawer-btn {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--primary-bg);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    padding: 14px 16px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    text-align: left;
}
.dm6-drawer-btn.primary {
    background: var(--accent-color);
    border-color: transparent;
}
.dm6-drawer-btn.primary .dm6-drawer-btn-title,
.dm6-drawer-btn.primary .dm6-drawer-btn-desc {
    color: white;
}
.dm6-drawer-btn-icon {
    font-size: 22px;
}
.dm6-drawer-btn-text {
    flex: 1;
}
.dm6-drawer-btn-title {
    font-weight: 700;
    font-size: 15px;
    color: var(--text-primary);
}
.dm6-drawer-btn-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 2px;
}
.dm6-drawer-cancel {
    width: 100%;
    padding: 14px;
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    margin-top: 8px;
}
        `;
        document.head.appendChild(style);
    }

    // ======================== HTML 结构 ========================
    const MAIN_HTML = `
<div class="dm6-container">
    <div class="dm6-topbar">
        <div class="dm6-topbar-left">
            <button class="dm6-back-btn" id="dm6-back-btn"><i class="fas fa-arrow-left"></i></button>
            <span class="dm6-title">数据管理</span>
        </div>
        <button class="dm6-close-btn" id="dm6-close-btn"><i class="fas fa-times"></i></button>
    </div>
    <div class="dm6-body">
        <!-- 存储卡片 -->
        <div class="dm6-storage-card">
            <div class="dm6-storage-header">
                <span class="dm6-storage-title"><i class="fas fa-database"></i> 存储用量</span>
                <span class="dm6-storage-total" id="dm6-storage-total">计算中…</span>
            </div>
            <div class="dm6-stats-grid">
                <div class="dm6-stat-item">
                    <div class="dm6-stat-icon"><i class="fas fa-comments"></i></div>
                    <div class="dm6-stat-value" id="dm6-stat-msgs">—</div>
                    <div class="dm6-stat-label">聊天记录</div>
                </div>
                <div class="dm6-stat-item">
                    <div class="dm6-stat-icon"><i class="fas fa-sliders-h"></i></div>
                    <div class="dm6-stat-value" id="dm6-stat-settings">—</div>
                    <div class="dm6-stat-label">设置数据</div>
                </div>
                <div class="dm6-stat-item">
                    <div class="dm6-stat-icon"><i class="fas fa-images"></i></div>
                    <div class="dm6-stat-value" id="dm6-stat-media">—</div>
                    <div class="dm6-stat-label">图片媒体</div>
                </div>
            </div>
            <div class="dm6-progress">
                <div class="dm6-progress-fill" id="dm6-progress-fill"></div>
            </div>
        </div>

        <!-- 备份磁贴 -->
        <div class="dm6-section-title"><i class="fas fa-archive"></i> 备份与恢复</div>
        <div class="dm6-grid">
            <div class="dm6-tile" id="dm6-tile-full">
                <div class="dm6-tile-icon blue"><i class="fas fa-layer-group"></i></div>
                <div class="dm6-tile-info">
                    <div class="dm6-tile-title">全量备份</div>
                    <div class="dm6-tile-desc">所有设置与数据</div>
                </div>
                <i class="fas fa-chevron-right dm6-tile-arrow"></i>
            </div>
            <div class="dm6-tile" id="dm6-tile-chat">
                <div class="dm6-tile-icon teal"><i class="fas fa-comments"></i></div>
                <div class="dm6-tile-info">
                    <div class="dm6-tile-title">聊天记录</div>
                    <div class="dm6-tile-desc">消息内容单独备份</div>
                </div>
                <i class="fas fa-chevron-right dm6-tile-arrow"></i>
            </div>
        </div>

         <!-- 通知与引导 -->
        <div class="dm6-section-title"><i class="fas fa-bell"></i> 通知与引导</div>
        <div class="dm6-row-card">
            <div class="dm6-row-item">
                <div class="dm6-row-icon amber"><i class="fas fa-bell"></i></div>
                <div class="dm6-row-info">
                    <div class="dm6-row-title">后台消息推送</div>
                    <div class="dm6-row-desc" id="dm6-notif-desc">收到新消息时弹出提醒</div>
                </div>
                <label class="dm6-toggle">
                    <input type="checkbox" id="dm6-notif-toggle">
                    <span class="dm6-toggle-slider"></span>
                </label>
            </div>
            <div class="dm6-row-item" id="dm6-replay-tutorial" style="cursor:pointer">
                <div class="dm6-row-icon slate"><i class="fas fa-compass"></i></div>
                <div class="dm6-row-info">
                    <div class="dm6-row-title">重放新手引导</div>
                    <div class="dm6-row-desc">重新播放功能介绍教程</div>
                </div>
                <button class="dm6-nav-btn"><i class="fas fa-play"></i></button>
            </div>
        </div>

        <!-- 危险操作（两个独立卡片） -->
        <div class="dm6-section-title"><i class="fas fa-exclamation-triangle" style="color:#FF3B30;"></i> 危险操作</div>
        <div class="dm6-danger-row">
            <div class="dm6-danger-card orange" id="dm6-clear-chat">
                <div class="dm6-danger-icon"><i class="fas fa-eraser"></i></div>
                <div class="dm6-danger-title">清除会话</div>
                <div class="dm6-danger-desc">删除本会话消息</div>
            </div>
            <div class="dm6-danger-card red" id="dm6-reset-all">
                <div class="dm6-danger-icon"><i class="fas fa-skull-crossbones"></i></div>
                <div class="dm6-danger-title">重置数据</div>
                <div class="dm6-danger-desc">清空所有，不可撤销</div>
            </div>
        </div>
        <div style="height: 16px;"></div>
    </div>
</div>
    `;

    const DRAWER_FULL = `
<div class="dm6-drawer" id="dm6-drawer-full">
    <div class="dm6-drawer-backdrop" id="dm6-drawer-full-backdrop"></div>
    <div class="dm6-drawer-sheet">
        <div class="dm6-drawer-handle"></div>
        <div class="dm6-drawer-title">
            <div class="dm6-drawer-icon blue"><i class="fas fa-layer-group"></i></div>
            <div>
                <div class="dm6-drawer-title-text">全量备份</div>
                <div class="dm6-drawer-subtitle">包含所有设置、外观、字卡等数据</div>
            </div>
        </div>
        <div class="dm6-drawer-actions">
            <button class="dm6-drawer-btn primary" id="dm6-export-full">
                <div class="dm6-drawer-btn-icon"><i class="fas fa-download"></i></div>
                <div class="dm6-drawer-btn-text">
                    <div class="dm6-drawer-btn-title">导出备份</div>
                    <div class="dm6-drawer-btn-desc">将数据保存为文件</div>
                </div>
            </button>
            <button class="dm6-drawer-btn" id="dm6-import-full">
                <div class="dm6-drawer-btn-icon"><i class="fas fa-upload"></i></div>
                <div class="dm6-drawer-btn-text">
                    <div class="dm6-drawer-btn-title">从文件恢复</div>
                    <div class="dm6-drawer-btn-desc">选择之前导出的备份文件</div>
                </div>
            </button>
        </div>
        <button class="dm6-drawer-cancel" id="dm6-drawer-full-cancel">取消</button>
    </div>
</div>
    `;

    const DRAWER_CHAT = `
<div class="dm6-drawer" id="dm6-drawer-chat">
    <div class="dm6-drawer-backdrop" id="dm6-drawer-chat-backdrop"></div>
    <div class="dm6-drawer-sheet">
        <div class="dm6-drawer-handle"></div>
        <div class="dm6-drawer-title">
            <div class="dm6-drawer-icon teal"><i class="fas fa-comments"></i></div>
            <div>
                <div class="dm6-drawer-title-text">聊天记录</div>
                <div class="dm6-drawer-subtitle">仅包含消息内容</div>
            </div>
        </div>
        <div class="dm6-drawer-actions">
            <button class="dm6-drawer-btn primary" id="dm6-export-chat">
                <div class="dm6-drawer-btn-icon"><i class="fas fa-download"></i></div>
                <div class="dm6-drawer-btn-text">
                    <div class="dm6-drawer-btn-title">导出聊天</div>
                    <div class="dm6-drawer-btn-desc">将消息记录保存为文件</div>
                </div>
            </button>
            <button class="dm6-drawer-btn" id="dm6-import-chat">
                <div class="dm6-drawer-btn-icon"><i class="fas fa-upload"></i></div>
                <div class="dm6-drawer-btn-text">
                    <div class="dm6-drawer-btn-title">导入聊天</div>
                    <div class="dm6-drawer-btn-desc">从文件恢复历史消息</div>
                </div>
            </button>
        </div>
        <button class="dm6-drawer-cancel" id="dm6-drawer-chat-cancel">取消</button>
    </div>
</div>
    `;

    // ======================== 辅助函数 ========================
    function fmtBytes(b) {
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1048576).toFixed(2) + ' MB';
    }

    async function updateStorageStats() {
        try {
            let quota = 0, usage = 0;
            if (navigator.storage && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                quota = est.quota || 0;
                usage = est.usage || 0;
            }
            let msgsSize = 0, mediaSize = 0, settingsSize = 0;
            if (window.localforage) {
                const keys = await localforage.keys();
                for (const key of keys) {
                    try {
                        const val = await localforage.getItem(key);
                        if (val == null) continue;
                        const str = typeof val === 'string' ? val : JSON.stringify(val);
                        const bytes = (key.length + str.length) * 2;
                        const lowerKey = key.toLowerCase();
                        if (lowerKey.includes('messages') || lowerKey.includes('msgs')) {
                            msgsSize += bytes;
                        } else if (lowerKey.includes('avatar') || lowerKey.includes('image') || lowerKey.includes('photo') ||
                                   lowerKey.includes('background') || lowerKey.includes('wallpaper') ||
                                   lowerKey.includes('sticker') || lowerKey.includes('bg')) {
                            mediaSize += bytes;
                        } else {
                            settingsSize += bytes;
                        }
                    } catch (e) { /* 忽略单条失败 */ }
                }
            }
            // localStorage
            let lsSize = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i) || '';
                const v = localStorage.getItem(k) || '';
                lsSize += (k.length + v.length) * 2;
            }
            settingsSize += lsSize;

            const total = msgsSize + mediaSize + settingsSize;
            const pct = quota > 0 ? Math.min(100, (usage / quota) * 100) : (total / (5 * 1024 * 1024) * 100);
            const fill = document.getElementById('dm6-progress-fill');
            if (fill) {
                fill.style.width = pct + '%';
                if (pct > 90) fill.style.background = 'linear-gradient(90deg,#FF3B30,#CC0000)';
                else if (pct > 75) fill.style.background = 'linear-gradient(90deg,#FF9F0A,#E07000)';
                else fill.style.background = 'linear-gradient(90deg,var(--accent-color),rgba(var(--accent-color-rgb),0.7))';
            }
            const totalEl = document.getElementById('dm6-storage-total');
            if (totalEl) totalEl.textContent = quota > 0 ? `${fmtBytes(usage)} / ${fmtBytes(quota)}` : fmtBytes(total);
            const msgsEl = document.getElementById('dm6-stat-msgs');
            if (msgsEl) msgsEl.textContent = fmtBytes(msgsSize);
            const settingsEl = document.getElementById('dm6-stat-settings');
            if (settingsEl) settingsEl.textContent = fmtBytes(settingsSize);
            const mediaEl = document.getElementById('dm6-stat-media');
            if (mediaEl) mediaEl.textContent = fmtBytes(mediaSize);
        } catch (e) {
            console.warn('[dm6] 存储统计失败', e);
        }
    }

    function syncNotifToggle() {
        const toggle = document.getElementById('dm6-notif-toggle');
        if (!toggle) return;
        const enabled = localStorage.getItem('notifEnabled') === '1';
        const granted = 'Notification' in window && Notification.permission === 'granted';
        toggle.checked = enabled && granted;
        const desc = document.getElementById('dm6-notif-desc');
        if (desc) {
            if (toggle.checked) desc.textContent = '✅ 已开启 — 页面在后台时弹出系统通知';
            else if ('Notification' in window && Notification.permission === 'denied') desc.textContent = '❌ 权限被屏蔽，请自行开启';
            else desc.textContent = '关闭状态 — 开启后可在后台接收消息';
        }
    }

    function openDrawer(id) {
        const drawer = document.getElementById(id);
        if (drawer) {
            drawer.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }
    function closeDrawer(id) {
        const drawer = document.getElementById(id);
        if (drawer) {
            drawer.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    function bindEvents(modalContent) {
        // 返回/关闭
        const backBtn = modalContent.querySelector('#dm6-back-btn');
        if (backBtn) backBtn.addEventListener('click', () => {
            const modal = document.getElementById('data-modal');
            if (modal && typeof hideModal === 'function') hideModal(modal);
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal && typeof showModal === 'function') showModal(settingsModal);
        });
        const closeBtn = modalContent.querySelector('#dm6-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('data-modal');
            if (modal && typeof hideModal === 'function') hideModal(modal);
        });

        // 备份磁贴
        const tileFull = modalContent.querySelector('#dm6-tile-full');
        if (tileFull) tileFull.addEventListener('click', () => openDrawer('dm6-drawer-full'));
        const tileChat = modalContent.querySelector('#dm6-tile-chat');
        if (tileChat) tileChat.addEventListener('click', () => openDrawer('dm6-drawer-chat'));

        // 全量抽屉按钮
        const exportFull = document.getElementById('dm6-export-full');
        if (exportFull) exportFull.addEventListener('click', () => {
            closeDrawer('dm6-drawer-full');
            if (typeof exportAllData === 'function') exportAllData();
            else if (typeof showNotification === 'function') showNotification('全量导出功能未实现', 'error');
        });
        const importFull = document.getElementById('dm6-import-full');
        if (importFull) importFull.addEventListener('click', () => {
            closeDrawer('dm6-drawer-full');
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = '.json,.zip,application/json,application/zip';
            inp.onchange = (e) => {
                const f = e.target.files?.[0];
                if (f && typeof importAllData === 'function') importAllData(f);
                else if (typeof showNotification === 'function') showNotification('全量导入功能未实现', 'error');
            };
            inp.click();
        });
        const cancelFull = document.getElementById('dm6-drawer-full-cancel');
        if (cancelFull) cancelFull.addEventListener('click', () => closeDrawer('dm6-drawer-full'));
        const backdropFull = document.getElementById('dm6-drawer-full-backdrop');
        if (backdropFull) backdropFull.addEventListener('click', () => closeDrawer('dm6-drawer-full'));

        // 聊天抽屉按钮
        const exportChat = document.getElementById('dm6-export-chat');
        if (exportChat) exportChat.addEventListener('click', () => {
            closeDrawer('dm6-drawer-chat');
            if (typeof exportChatHistory === 'function') exportChatHistory();
            else if (typeof showNotification === 'function') showNotification('聊天导出功能未实现', 'error');
        });
        const importChat = document.getElementById('dm6-import-chat');
        if (importChat) importChat.addEventListener('click', () => {
            closeDrawer('dm6-drawer-chat');
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = '.json';
            inp.onchange = (e) => {
                const f = e.target.files?.[0];
                if (f && typeof importChatHistory === 'function') importChatHistory(f);
                else if (typeof showNotification === 'function') showNotification('聊天导入功能未实现', 'error');
            };
            inp.click();
        });
        const cancelChat = document.getElementById('dm6-drawer-chat-cancel');
        if (cancelChat) cancelChat.addEventListener('click', () => closeDrawer('dm6-drawer-chat'));
        const backdropChat = document.getElementById('dm6-drawer-chat-backdrop');
        if (backdropChat) backdropChat.addEventListener('click', () => closeDrawer('dm6-drawer-chat'));


        // 通知开关
        const notifToggle = document.getElementById('dm6-notif-toggle');
        if (notifToggle) {
            notifToggle.addEventListener('change', function() {
                if (!('Notification' in window)) {
                    notifToggle.checked = false;
                    if (typeof showNotification === 'function') showNotification('浏览器不支持通知', 'error');
                    return;
                }
                if (notifToggle.checked) {
                    Notification.requestPermission().then(perm => {
                        if (perm === 'granted') {
                            localStorage.setItem('notifEnabled', '1');
                            syncNotifToggle();
                            try { new Notification('传讯通知已开启 ✨', { body: '你现在可以在后台收到消息提醒' }); } catch(e) {}
                        } else {
                            notifToggle.checked = false;
                            localStorage.setItem('notifEnabled', '0');
                            syncNotifToggle();
                        }
                    }).catch(() => {
                        notifToggle.checked = false;
                        localStorage.setItem('notifEnabled', '0');
                        syncNotifToggle();
                    });
                } else {
                    localStorage.setItem('notifEnabled', '0');
                    syncNotifToggle();
                }
            });
        }

        // 重放引导
        const replayBtn = modalContent.querySelector('#dm6-replay-tutorial');
        if (replayBtn) {
            replayBtn.addEventListener('click', () => {
                const modal = document.getElementById('data-modal');
                if (modal && typeof hideModal === 'function') hideModal(modal);
                if (typeof startTour === 'function') {
                    if (window.localforage && window.APP_PREFIX) {
                        localforage.removeItem(APP_PREFIX + 'tour_seen').then(startTour).catch(startTour);
                    } else { startTour(); }
                }
            });
        }

        // 危险操作
        const clearChatBtn = document.getElementById('dm6-clear-chat');
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => {
                if (!confirm('确定要清除当前会话的所有消息吗？\n\n所有设置、头像、字卡等数据将保留，仅聊天记录会被删除。\n\n此操作无法恢复！')) return;
                if (typeof messages !== 'undefined') messages = [];
                if (typeof displayedMessageCount !== 'undefined') displayedMessageCount = 20;
                try { localStorage.removeItem('BACKUP_V1_critical'); } catch(e) {}
                try { localStorage.removeItem('BACKUP_V1_timestamp'); } catch(e) {}
                if (window.localforage && typeof getStorageKey === 'function') {
                    localforage.setItem(getStorageKey('chatMessages'), []).catch(()=>{});
                }
                if (typeof renderMessages === 'function') renderMessages();
                if (typeof showNotification === 'function') showNotification('聊天记录已清除', 'success');
            });
        }
        const resetBtn = document.getElementById('dm6-reset-all');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (!confirm('⚠️ 确定要清空全部数据吗？\n\n所有消息、设置、字卡、头像等将被永久删除，不可恢复！')) return;
                if (!confirm('最后确认：清空后页面将自动刷新，无法撤销，继续吗？')) return;
                window._skipBackup = true;
                const doReset = () => {
                    localStorage.clear();
                    if (typeof showNotification === 'function') showNotification('所有数据已清空，即将刷新…', 'info', 2000);
                    setTimeout(() => { window.location.href = window.location.pathname + '?reset=' + Date.now(); }, 2000);
                };
                if (window.localforage) localforage.clear().then(doReset).catch(doReset);
                else doReset();
            });
        }
    }

    function buildUI(modalContent) {
        modalContent.innerHTML = MAIN_HTML;
        // 确保抽屉存在于 body 中
        if (!document.getElementById('dm6-drawer-full')) {
            const div = document.createElement('div');
            div.innerHTML = DRAWER_FULL;
            document.body.appendChild(div.firstElementChild);
        }
        if (!document.getElementById('dm6-drawer-chat')) {
            const div = document.createElement('div');
            div.innerHTML = DRAWER_CHAT;
            document.body.appendChild(div.firstElementChild);
        }
        bindEvents(modalContent);
        updateStorageStats();
        syncNotifToggle();
        // 刷新云同步 UI（如果外部提供）
        if (typeof refreshCloudSyncInfo === 'function') refreshCloudSyncInfo();
        if (typeof window.syncCloudAutoSyncSettingsUI === 'function') window.syncCloudAutoSyncSettingsUI();
    }

    // 监听模态框打开
    function init() {
        injectStyles();
        const modal = document.getElementById('data-modal');
        if (!modal) return;
        let observer = new MutationObserver(() => {
            if (modal.style.display === 'flex' || modal.style.display === 'block') {
                const mc = modal.querySelector('.modal-content');
                if (mc && !mc.querySelector('.dm6-container')) {
                    mc.innerHTML = '';
                    buildUI(mc);
                }
                updateStorageStats();
                syncNotifToggle();
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
        // 如果已经显示
        if (modal.style.display === 'flex' || modal.style.display === 'block') {
            const mc = modal.querySelector('.modal-content');
            if (mc && !mc.querySelector('.dm6-container')) buildUI(mc);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

// 暴露给外部的全局更新函数（可选）
window.updateStorageUsageBar = function() {
    if (document.getElementById('dm6-progress-fill')) {
        // 重新执行统计
        (async () => {
            await window.updateStorageStats?.();
        })();
    }
};