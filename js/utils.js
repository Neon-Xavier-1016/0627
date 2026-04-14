/**
 * utils.js - Utility Functions (简化音效版)
 * 包含：存储辅助、通知、音效、字体、CSS、备份、云同步等
 */

// ======================== 存储辅助 ========================
function safeGetItem(key) {
    try { return localStorage.getItem(key); }
    catch (e) { console.error('Error getting item:', e); return null; }
}

function safeSetItem(key, value) {
    try {
        if (typeof value === 'object') value = JSON.stringify(value);
        localStorage.setItem(key, value);
    } catch (e) { console.error('Error setting item:', e); }
}

function safeRemoveItem(key) {
    try { localStorage.removeItem(key); }
    catch (e) { console.error('Error removing item:', e); }
}

function getRandomItem(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeStringStrict(s) {
    if (typeof s !== 'string') return '';
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function deduplicateContentArray(arr, baseSystemArray = []) {
    const seen = new Set(baseSystemArray.map(normalizeStringStrict));
    const result = [];
    let removedCount = 0;
    for (const item of arr) {
        const norm = normalizeStringStrict(item);
        if (norm !== '' && !seen.has(norm)) {
            seen.add(norm);
            result.push(item);
        } else {
            removedCount++;
        }
    }
    return { result, removedCount };
}

function cropImageToSquare(file, maxSize = 640) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const minSide = Math.min(img.width, img.height);
                const sx = (img.width - minSide) / 2;
                const sy = (img.height - minSide) / 2;
                const canvas = document.createElement('canvas');
                canvas.width = maxSize; canvas.height = maxSize;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxSize, maxSize);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function exportDataToMobileOrPC(dataString, fileName) {
    if (navigator.share && navigator.canShare) {
        try {
            const blob = new Blob([dataString], { type: 'application/json' });
            const file = new File([blob], fileName, { type: 'application/json' });
            if (navigator.canShare({ files: [file] })) {
                navigator.share({ files: [file], title: '传讯数据备份', text: '请选择"保存到文件"' })
                    .catch(() => downloadFileFallback(blob, fileName));
                return;
            }
        } catch (e) {}
    }
    const blob = new Blob([dataString], { type: 'application/json' });
    downloadFileFallback(blob, fileName);
}

function downloadFileFallback(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName; link.style.display = 'none';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

if (typeof localforage !== 'undefined') {
    localforage.config({
        driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
        name: 'ChatApp_V3', version: 1.0, storeName: 'chat_data',
        description: 'Storage for Chat App V3'
    });
} else {
    console.warn('[storage] localforage 未加载，IndexedDB 能力不可用');
}

// ======================== 通知 ========================
function showNotification(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    const iconMap = { success:'fa-check-circle', error:'fa-exclamation-circle', info:'fa-info-circle', warning:'fa-exclamation-triangle' };
    notification.innerHTML = `<i class="fas ${iconMap[type] || 'fa-info-circle'}"></i><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('hiding');
        notification.addEventListener('animationend', () => notification.remove());
    }, duration);
}

// ======================== 音效（简洁版，来自文件二） ========================
const playSound = (type) => {
    if (!settings.soundEnabled) return;
    try {
        if (settings.customSoundUrl && settings.customSoundUrl.trim()) {
            const audio = new Audio(settings.customSoundUrl.trim());
            audio.volume = Math.min(1, Math.max(0, settings.soundVolume || 0.15));
            audio.play().catch(() => {});
            return;
        }
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'sine';
        const vol = Math.min(0.5, Math.max(0.01, settings.soundVolume || 0.1));
        gainNode.gain.setValueAtTime(vol, audioContext.currentTime);
        if (type === 'send') oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        else if (type === 'favorite') oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
        else oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.15);
        oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
        console.warn("音频播放失败:", e);
    }
};

// ======================== 防抖保存 ========================
const throttledSaveData = () => {
    if (typeof saveTimeout !== 'undefined') clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const maybePromise = saveData();
            if (maybePromise && typeof maybePromise.catch === 'function') {
                maybePromise.catch(e => console.error('[throttledSaveData] 保存失败:', e));
            }
        } catch (e) {
            console.error('[throttledSaveData] 保存失败:', e);
        }
    }, 500);
};

// ======================== 字体 & CSS 应用 ========================
async function applyCustomFont(url) {
    if (!url || !url.trim()) {
        document.documentElement.style.removeProperty('--font-family');
        document.documentElement.style.removeProperty('--message-font-family');
        return;
    }
    const fontName = 'UserCustomFont';
    try {
        const font = new FontFace(fontName, `url(${url})`);
        await font.load();
        document.fonts.add(font);
        const fontStack = `"${fontName}", 'Noto Serif SC', serif`;
        document.documentElement.style.setProperty('--font-family', fontStack);
        document.documentElement.style.setProperty('--message-font-family', fontStack);
        if (typeof settings !== 'undefined') settings.messageFontFamily = fontStack;
    } catch (e) {
        console.error('字体加载失败:', e);
        showNotification('字体加载失败，请检查链接是否有效', 'error');
    }
}

function applyCustomBubbleCss(cssCode) {
    const styleId = 'user-custom-bubble-style';
    let styleTag = document.getElementById(styleId);
    if (!cssCode || !cssCode.trim()) { if (styleTag) styleTag.remove(); return; }
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = styleId; document.head.appendChild(styleTag); }
    styleTag.textContent = cssCode + `
.message.message-image-bubble-none,
.message-image-bubble-none {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    border-radius: 0 !important;
}`;
}

function applyGlobalThemeCss(cssCode) {
    const styleId = 'user-custom-global-theme-style';
    let styleTag = document.getElementById(styleId);
    if (!cssCode || !cssCode.trim()) { if (styleTag) styleTag.remove(); return; }
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = styleId; document.head.appendChild(styleTag); }
    styleTag.textContent = cssCode;
}

// ======================== 存储空间检查 ========================
async function checkStorageSpace() {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota || 0;
    let appUsage = 0;
    try {
        const keys = await localforage.keys();
        for (const key of keys) {
            const raw = await localforage.getItem(key);
            const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
            appUsage += new Blob([str]).size;
        }
    } catch(e) {}
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        const v = localStorage.getItem(k) || '';
        appUsage += (k.length + v.length) * 2;
    }
    const percentUsed = quota > 0 ? (appUsage / quota) * 100 : 0;
    if (percentUsed > 95) {
        showNotification('应用数据存储即将满载，建议导出备份', 'warning', 10000);
    }
    return estimate;
}

window.addEventListener('load', () => {
    setTimeout(checkStorageSpace, 5000);
});
setInterval(checkStorageSpace, 24 * 60 * 60 * 1000);

// ======================== 云同步相关（保留文件一的高级功能） ========================
const CLOUD_SYNC_META_KEY = 'CHATAPP_CLOUD_SYNC_META_V1';
const CLOUD_SYNC_CONFIG_KEY = 'CHATAPP_SUPABASE_CONFIG_V1';
const CLOUD_SYNC_SINGLE_BACKUP_ID = 'SINGLE_USER_BACKUP';

let cloudAutoSyncTimer = null;
let cloudAutoSyncInFlight = false;
let cloudAutoSyncDirty = false;

function getNormalizedCloudAutoSyncSettings() {
    const enabled = !!(settings && settings.cloudAutoSyncEnabled);
    const rawInterval = Number(settings && settings.cloudAutoSyncInterval);
    const interval = Math.min(360, Math.max(1, Number.isFinite(rawInterval) ? rawInterval : 10));
    if (settings) settings.cloudAutoSyncInterval = interval;
    return { enabled, interval };
}

function getCloudAutoSyncStatusText() {
    const cfg = getNormalizedCloudAutoSyncSettings();
    if (!cfg.enabled) return '自动上传已关闭';
    if (cloudAutoSyncInFlight) return `自动上传进行中（每 ${cfg.interval} 分钟）`;
    if (cloudAutoSyncDirty) return `检测到本地变更，等待自动上传（每 ${cfg.interval} 分钟）`;
    return `自动上传已开启（每 ${cfg.interval} 分钟）`;
}

function manageCloudAutoSyncTimer() {
    if (cloudAutoSyncTimer) clearInterval(cloudAutoSyncTimer);
    const cfg = getNormalizedCloudAutoSyncSettings();
    if (!cfg.enabled) return;
    cloudAutoSyncTimer = setInterval(() => {
        triggerCloudAutoSync('auto-timer').catch(err => console.error('[triggerCloudAutoSync]', err));
    }, cfg.interval * 60 * 1000);
}

async function triggerCloudAutoSync(reason) {
    const cfg = getNormalizedCloudAutoSyncSettings();
    if (!cfg.enabled || !cloudAutoSyncDirty || cloudAutoSyncInFlight) return false;
    const cloudCfg = getCloudSyncConfig();
    if (!cloudCfg || !cloudCfg.url || !cloudCfg.anonKey) return false;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return false;
    cloudAutoSyncInFlight = true;
    updateCloudSyncStatusUI({ statusText: getCloudAutoSyncStatusText() });
    try {
        await uploadLocalSnapshotToCloud(reason || 'cloud-auto-sync', { silent: true });
        cloudAutoSyncDirty = false;
        updateCloudSyncStatusUI({ statusText: getCloudAutoSyncStatusText() });
        return true;
    } catch (e) {
        console.error('[cloudAutoSync]', e);
        updateCloudSyncStatusUI({ statusText: '自动上传失败，请检查云端配置或网络' });
        return false;
    } finally {
        cloudAutoSyncInFlight = false;
        updateCloudSyncStatusUI({ statusText: getCloudAutoSyncStatusText() });
    }
}

function getCloudSyncConfig() {
    try {
        const raw = localStorage.getItem(CLOUD_SYNC_CONFIG_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function setCloudSyncConfig(config) {
    try { localStorage.setItem(CLOUD_SYNC_CONFIG_KEY, JSON.stringify(config || {})); } catch(e) {}
}

function getCloudSyncMeta() {
    try {
        const raw = localStorage.getItem(CLOUD_SYNC_META_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function setCloudSyncMeta(meta) {
    try { localStorage.setItem(CLOUD_SYNC_META_KEY, JSON.stringify(meta || {})); } catch(e) {}
}

function formatCloudSyncTime(ts) {
    if (!ts) return '暂无';
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '暂无';
        return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch(e) { return '暂无'; }
}

async function buildFullBackupPayloadObject() {
    if (typeof ChatBackup !== 'undefined' && ChatBackup.buildBackupPayload) {
        return await ChatBackup.buildBackupPayload({
            inclMsgs: true, inclSet: true, inclCustom: true, inclAnn: true,
            inclThemes: true, inclDg: true, inclStickers: true
        });
    }
    const keys = await localforage.keys();
    const idbData = {};
    for (const k of keys) { try { idbData[k] = await localforage.getItem(k); } catch(e) {} }
    const lsData = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) lsData[k] = localStorage.getItem(k); }
    return {
        version: '3.1-full', appName: 'ChatApp', exportDate: new Date().toISOString(),
        type: 'full', indexedDB: idbData, localStorage: lsData
    };
}

async function buildFullBackupJsonString() {
    const payload = await buildFullBackupPayloadObject();
    const jsonString = JSON.stringify(payload);
    if (jsonString.charCodeAt(0) === 0xFEFF) return jsonString.substring(1);
    return jsonString;
}

async function calcTextSha256(text) {
    try {
        if (!window.crypto || !window.crypto.subtle) return '';
        const enc = new TextEncoder().encode(text);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc);
        const arr = Array.from(new Uint8Array(hashBuffer));
        return arr.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch(e) { return ''; }
}

async function buildLocalSnapshotMeta(reason) {
    const json = await buildFullBackupJsonString();
    const hash = await calcTextSha256(json);
    const nowIso = new Date().toISOString();
    const meta = { updated_at: nowIso, size_bytes: new Blob([json]).size, hash: hash, source: reason || 'local-edit' };
    setCloudSyncMeta(meta);
    return { json: json, meta: meta };
}

function updateCloudSyncStatusUI(state) {
    const statusText = document.getElementById('dm-supabase-status-text');
    const localTime = document.getElementById('dm-local-backup-time');
    const cloudTime = document.getElementById('dm-cloud-backup-time');
    const checkBtn = document.getElementById('dm-supabase-check-btn');
    const syncBtn = document.getElementById('dm-supabase-sync-btn');

    const localMeta = (state && state.localMeta) || getCloudSyncMeta();
    const cloudMeta = state && state.cloudMeta;

    if (statusText) statusText.textContent = (state && state.statusText) || '还没有连接云端备份，点这里开始设置';
    if (localTime) localTime.textContent = localMeta ? formatCloudSyncTime(localMeta.updated_at) : '暂无';
    if (cloudTime) cloudTime.textContent = cloudMeta ? formatCloudSyncTime(cloudMeta.updated_at) : '暂无';
    if (checkBtn) checkBtn.innerHTML = '<i class="fas fa-rotate"></i><span style="margin-left:6px;">检查云端</span>';
    if (syncBtn) syncBtn.innerHTML = '<i class="fas fa-cloud-arrow-up"></i><span style="margin-left:6px;">同步数据</span>';
}

window.syncCloudAutoSyncSettingsUI = function() {
    const toggle = document.getElementById('dm-cloud-auto-sync-toggle');
    const intervalInput = document.getElementById('dm-cloud-auto-sync-interval');
    const desc = document.getElementById('dm-cloud-auto-sync-desc');
    const cfg = getNormalizedCloudAutoSyncSettings();
    if (toggle) toggle.checked = cfg.enabled;
    if (intervalInput) {
        intervalInput.value = String(cfg.interval);
        intervalInput.disabled = !cfg.enabled;
        intervalInput.style.opacity = cfg.enabled ? '1' : '0.6';
    }
    if (desc) desc.textContent = cfg.enabled ? `已开启：本地数据变更后，每 ${cfg.interval} 分钟后台自动上传一次` : '关闭状态';
};

window.applyCloudAutoSyncSettings = function(reason) {
    const cfg = getNormalizedCloudAutoSyncSettings();
    if (!cfg.enabled) cloudAutoSyncDirty = false;
    manageCloudAutoSyncTimer();
    if (typeof throttledSaveData === 'function') throttledSaveData();
    if (typeof window.syncCloudAutoSyncSettingsUI === 'function') window.syncCloudAutoSyncSettingsUI();
    updateCloudSyncStatusUI({ statusText: getCloudAutoSyncStatusText() });
};

async function askSupabaseConfigSimple() {
    return new Promise(resolve => {
        const modal = document.getElementById('supabase-config-modal');
        const urlInput = document.getElementById('supabase-url-input');
        const keyInput = document.getElementById('supabase-key-input');
        const saveBtn = document.getElementById('save-supabase-config');
        const cancelBtn = document.getElementById('cancel-supabase-config');
        if (!modal || !urlInput || !keyInput || !saveBtn || !cancelBtn) return resolve(null);
        const existing = getCloudSyncConfig() || {};
        urlInput.value = existing.url || '';
        keyInput.value = existing.anonKey || '';
        const closeAndResolve = (value) => { hideModal(modal); resolve(value); };
        saveBtn.onclick = () => {
            const clean = { url: (urlInput.value || '').trim().replace(/\/+$/, ''), anonKey: (keyInput.value || '').trim() };
            if (!clean.url || !clean.anonKey) { showNotification('Supabase 配置不能为空', 'error'); return; }
            setCloudSyncConfig(clean);
            closeAndResolve(clean);
        };
        cancelBtn.onclick = () => closeAndResolve(null);
        showModal(modal);
    });
}

function getSupabaseClient() {
    const cfg = getCloudSyncConfig();
    if (!cfg || !cfg.url || !cfg.anonKey) return null;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    if (!window.__chatappSupabaseClient) {
        window.__chatappSupabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
    }
    return window.__chatappSupabaseClient;
}

async function ensureSupabaseTableGuide() {
    return new Promise(resolve => {
        const modal = document.getElementById('supabase-guide-modal');
        const sqlDisplay = document.getElementById('supabase-sql-code-display');
        const closeBtn = document.getElementById('close-supabase-guide');
        if (!modal || !sqlDisplay || !closeBtn) return resolve();
        const sqlCode = `-- 1. 如果旧表存在，安全地删除它
DROP TABLE IF EXISTS public.chat_backups;
-- 2. 创建新的、字段类型完全正确的备份表
CREATE TABLE public.chat_backups (
  id TEXT PRIMARY KEY,
  backup_json JSONB,
  updated_at TIMESTAMPTZ,
  size_bytes BIGINT,
  hash TEXT,
  source TEXT
);
-- 3. 关闭这张表的行级安全策略 (RLS)
ALTER TABLE public.chat_backups DISABLE ROW LEVEL SECURITY;`;
        sqlDisplay.value = sqlCode;
        closeBtn.onclick = () => { hideModal(modal); resolve(); };
        showModal(modal);
    });
}

async function fetchCloudBackupMeta() {
    const client = getSupabaseClient();
    if (!client) return null;
    const ret = await client.from('chat_backups').select('updated_at,size_bytes,hash,source,id').eq('id', CLOUD_SYNC_SINGLE_BACKUP_ID).single();
    if (ret.error && ret.error.code !== 'PGRST116') throw ret.error;
    return ret.data || null;
}

async function fetchCloudBackupRow() {
    const client = getSupabaseClient();
    if (!client) return null;
    const ret = await client.from('chat_backups').select('id,backup_json,updated_at,size_bytes,hash,source').eq('id', CLOUD_SYNC_SINGLE_BACKUP_ID).single();
    if (ret.error && ret.error.code !== 'PGRST116') throw ret.error;
    return ret.data || null;
}

async function uploadLocalSnapshotToCloud(reason, options) {
    const client = getSupabaseClient();
    if (!client) throw new Error('尚未配置 Supabase');
    const opts = options || {};
    const payloadObject = await buildFullBackupPayloadObject();
    const jsonForMeta = JSON.stringify(payloadObject);
    const meta = {
        updated_at: new Date().toISOString(),
        size_bytes: new Blob([jsonForMeta]).size,
        hash: await calcTextSha256(jsonForMeta),
        source: reason || 'cloud-push'
    };
    const dbPayload = {
        id: CLOUD_SYNC_SINGLE_BACKUP_ID,
        backup_json: payloadObject,
        updated_at: meta.updated_at,
        size_bytes: meta.size_bytes,
        hash: meta.hash,
        source: meta.source
    };
    const ret = await client.from('chat_backups').upsert(dbPayload).select('updated_at,size_bytes,hash,source').single();
    if (ret.error) throw ret.error;
    setCloudSyncMeta(meta);
    if (!opts.silent) {
        updateCloudSyncStatusUI({ statusText: '云端已连接，最近一次已上传', localMeta: meta, cloudMeta: ret.data });
    }
    return ret.data;
}

async function applyCloudJsonToLocal(jsonData) {
    let data = jsonData;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) { throw new Error('云端 JSON 已损坏'); }
    }
    if (typeof ChatBackup === 'undefined' || !ChatBackup.applyBackupToStorage) throw new Error('备份模块未加载');
    await ChatBackup.applyBackupToStorage(data, { selective: false });
    const jsonTextForMeta = JSON.stringify(data);
    const meta = {
        updated_at: new Date().toISOString(),
        size_bytes: new Blob([jsonTextForMeta]).size,
        hash: await calcTextSha256(jsonTextForMeta),
        source: 'cloud-pull'
    };
    setCloudSyncMeta(meta);
    return meta;
}

async function pickSyncDirectionManually(localMeta, cloudMeta) {
    return new Promise((resolve) => {
        const existingOverlay = document.getElementById('dm-sync-direction-overlay');
        if (existingOverlay) existingOverlay.remove();
        const overlay = document.createElement('div');
        overlay.id = 'dm-sync-direction-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.58);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;';
        const localTimeStr = formatCloudSyncTime(localMeta && localMeta.updated_at);
        const localSizeStr = localMeta && localMeta.size_bytes ? (localMeta.size_bytes / 1024).toFixed(1) + ' KB' : '未知';
        const cloudTimeStr = formatCloudSyncTime(cloudMeta && cloudMeta.updated_at);
        const cloudSizeStr = cloudMeta && cloudMeta.size_bytes ? (cloudMeta.size_bytes / 1024).toFixed(1) + ' KB' : '未知';
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg);border-radius:22px;padding:22px;width:90%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.28);">
                <div style="font-size:16px;font-weight:800;color:var(--text-primary);margin-bottom:8px;">同步选择</div>
                <div style="font-size:12px;color:var(--text-secondary);line-height:1.7;margin-bottom:14px;">检测到本地与云端数据不一致，请选择同步方向。</div>
                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
                    <div style="padding:12px 14px;border:1px solid var(--border-color);border-radius:14px;background:var(--primary-bg);">
                        <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">本地数据</div>
                        <div style="font-size:11px;color:var(--text-secondary);">更新于：${localTimeStr}</div>
                        <div style="font-size:11px;color:var(--text-secondary);">大小：${localSizeStr}</div>
                    </div>
                    <div style="padding:12px 14px;border:1px solid var(--border-color);border-radius:14px;background:var(--primary-bg);">
                        <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">云端备份</div>
                        <div style="font-size:11px;color:var(--text-secondary);">更新于：${cloudTimeStr}</div>
                        <div style="font-size:11px;color:var(--text-secondary);">大小：${cloudSizeStr}</div>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <button id="cloud-sync-push-local" class="modal-btn modal-btn-primary" style="width:100%;">上传本地数据 (覆盖云端)</button>
                    <button id="cloud-sync-pull-cloud" class="modal-btn modal-btn-secondary" style="width:100%;">下载云端数据 (覆盖本地)</button>
                    <button id="cloud-sync-cancel" class="modal-btn modal-btn-secondary" style="width:100%;margin-top:4px;">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('#cloud-sync-push-local').addEventListener('click', () => { overlay.remove(); resolve('push'); });
        overlay.querySelector('#cloud-sync-pull-cloud').addEventListener('click', () => { overlay.remove(); resolve('pull'); });
        overlay.querySelector('#cloud-sync-cancel').addEventListener('click', () => { overlay.remove(); resolve(null); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    });
}

async function compareAndSyncCloudBackup() {
    let client = getSupabaseClient();
    if (!client) {
        await ensureSupabaseTableGuide();
        const cfg = await askSupabaseConfigSimple();
        if (!cfg) return;
        window.__chatappSupabaseClient = null;
        client = getSupabaseClient();
        if (!client) { showNotification('Supabase 客户端初始化失败', 'error'); return; }
    }
    const localBuilt = await buildLocalSnapshotMeta('local-snapshot');
    let cloudRow = await fetchCloudBackupRow();
    if (!cloudRow) {
        if (confirm('云端还没有任何备份。是否要将当前的本地数据作为第一份备份上传？')) {
            await uploadLocalSnapshotToCloud('first-sync-push');
            showNotification('首次同步完成：本地数据已成功上传到云端。', 'success', 4000);
        } else { showNotification('已取消首次备份。', 'info'); }
        return;
    }
    const cloudMeta = { updated_at: cloudRow.updated_at, size_bytes: cloudRow.size_bytes, hash: cloudRow.hash, source: cloudRow.source || 'cloud' };
    const localTime = new Date(localBuilt.meta.updated_at || 0).getTime();
    const cloudTime = new Date(cloudMeta.updated_at || 0).getTime();
    if (!localBuilt.meta.updated_at || !cloudMeta.updated_at) {
        const direction = await pickSyncDirectionManually(localBuilt.meta, cloudMeta);
        if (direction === 'push') {
            await uploadLocalSnapshotToCloud('manual-push');
            showNotification('已用本地覆盖云端', 'success');
        } else if (direction === 'pull') {
            const newLocalMeta = await applyCloudJsonToLocal(cloudRow.backup_json);
            updateCloudSyncStatusUI({ statusText: '云端已连接，最近一次已下载', localMeta: newLocalMeta, cloudMeta: cloudMeta });
            showNotification('已用云端覆盖本地，正在刷新页面', 'success', 2500);
            setTimeout(() => location.reload(), 2200);
        }
        return;
    }
    if (localBuilt.meta.hash && cloudMeta.hash && localBuilt.meta.hash === cloudMeta.hash) {
        updateCloudSyncStatusUI({ statusText: '本地与云端一致', localMeta: localBuilt.meta, cloudMeta: cloudMeta });
        showNotification('本地与云端数据一致', 'info');
        return;
    }
    let direction = null;
    if (cloudTime > localTime && cloudMeta.size_bytes >= localBuilt.meta.size_bytes) direction = 'pull';
    if (localTime > cloudTime && localBuilt.meta.size_bytes >= cloudMeta.size_bytes) direction = 'push';
    if (!direction) {
        direction = await pickSyncDirectionManually(localBuilt.meta, cloudMeta);
        if (!direction) { showNotification('已取消同步', 'info'); return; }
    } else {
        const ask = confirm(direction === 'pull' ? '检测到云端看起来更新。\n\n点击“确定”用云端覆盖本地；点击“取消”改为手动选择方向。' : '检测到本地看起来更新。\n\n点击“确定”用本地覆盖云端；点击“取消”改为手动选择方向。');
        if (!ask) direction = await pickSyncDirectionManually(localBuilt.meta, cloudMeta);
        if (!direction) return;
    }
    if (direction === 'push') {
        const cloudSaved = await uploadLocalSnapshotToCloud('manual-push');
        updateCloudSyncStatusUI({ statusText: '云端已连接，最近一次已上传', localMeta: localBuilt.meta, cloudMeta: cloudSaved });
        showNotification('同步成功：本地已上传到云端', 'success');
        return;
    }
    if (direction === 'pull') {
        const newLocalMeta = await applyCloudJsonToLocal(cloudRow.backup_json);
        updateCloudSyncStatusUI({ statusText: '云端已连接，最近一次已下载', localMeta: newLocalMeta, cloudMeta: cloudMeta });
        showNotification('同步成功：云端已覆盖本地，正在刷新页面', 'success', 2600);
        setTimeout(() => location.reload(), 2200);
    }
}

async function refreshCloudSyncInfo() {
    const cfg = getCloudSyncConfig();
    if (!cfg) {
        updateCloudSyncStatusUI({ statusText: '还没有连接云端备份，点这里开始设置' });
        return;
    }
    try {
        const cloudMeta = await fetchCloudBackupMeta();
        const autoSyncStatus = getCloudAutoSyncStatusText();
        updateCloudSyncStatusUI({ statusText: cloudMeta ? `已连接云端，可随时同步｜${autoSyncStatus}` : `已配置，但云端还没有备份｜${autoSyncStatus}`, cloudMeta: cloudMeta });
    } catch(e) {
        console.error('[refreshCloudSyncInfo]', e);
        updateCloudSyncStatusUI({ statusText: '连接云端失败，请检查配置或网络' });
    }
}

window.openSupabaseGuide = async function(openWebsite) {
    if (openWebsite) {
        try { window.open('https://supabase.com/dashboard/projects', '_blank'); } catch(e) {}
        await ensureSupabaseTableGuide();
    } else {
        const cfg = await askSupabaseConfigSimple();
        if (!cfg) { showNotification('你还没有保存云端配置', 'warning', 3500); return; }
        manageCloudAutoSyncTimer();
        await refreshCloudSyncInfo();
        showNotification('云端配置已保存成功', 'success', 2500);
    }
};

window.checkSupabaseCloud = async function() {
    await refreshCloudSyncInfo();
    showNotification('已检查云端状态', 'success');
};

window.syncSupabaseCloud = async function() {
    try {
        await compareAndSyncCloudBackup();
    } catch(e) {
        console.error('[syncSupabaseCloud]', e);
        showNotification('云同步失败：' + (e.message || e), 'error', 5000);
    }
};

window.markLocalBackupUpdated = async function(reason) {
    try {
        await buildLocalSnapshotMeta(reason || 'local-edit');
        cloudAutoSyncDirty = true;
        if (typeof window.syncCloudAutoSyncSettingsUI === 'function') window.syncCloudAutoSyncSettingsUI();
        updateCloudSyncStatusUI({ statusText: getCloudAutoSyncStatusText() });
    } catch(e) {}
};

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        manageCloudAutoSyncTimer();
        if (typeof window.syncCloudAutoSyncSettingsUI === 'function') window.syncCloudAutoSyncSettingsUI();
        if (window.supabase) refreshCloudSyncInfo();
    }, 800);
});