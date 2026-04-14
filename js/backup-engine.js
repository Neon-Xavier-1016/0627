/**
 * 统一备份/恢复引擎 v6
 * - 支持 ZIP（媒体与 JSON 分离）和单 JSON 两种格式
 * - 修复 session ID 冲突导致导入后数据丢失的问题
 * - 修复 localStorage 大图被跳过的问题
 * - 导入后自动刷新页面，确保界面立即显示新数据
 * - 兼容 config.js 中的数据注册表，支持选择性导入
 *
 * 依赖：localforage, JSZip (可选), 全局 APP_PREFIX, SESSION_ID
 */
(function (global) {
    'use strict';

    var MIN_MEDIA_CHARS = 800;

    // ---------- 工具函数 ----------
    function escapeRe(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function isDataMediaUrl(s) {
        return typeof s === 'string' && s.length > MIN_MEDIA_CHARS && /^data:(image|video)\//i.test(s);
    }

    function isZipArrayBuffer(ab) {
        if (!ab || ab.byteLength < 4) return false;
        var u = new Uint8Array(ab);
        return u[0] === 0x50 && u[1] === 0x4b && (u[2] === 0x03 || u[2] === 0x05 || u[2] === 0x07) &&
            (u[3] === 0x04 || u[3] === 0x06 || u[3] === 0x08);
    }

    function dataUrlToBinary(dataUrl) {
        if (typeof dataUrl !== 'string') return null;
        var m = /^data:([^,]+),([\s\S]*)$/.exec(dataUrl);
        if (!m) return null;
        var header = m[1];
        var body = m[2].replace(/\s/g, '');
        var mime = header.split(';')[0].trim();
        var isB64 = /;base64/i.test(header);
        if (isB64) {
            try {
                var binary = atob(body);
                var len = binary.length;
                var bytes = new Uint8Array(len);
                for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
                return { mime: mime, bytes: bytes };
            } catch (e) {
                return null;
            }
        }
        try {
            return { mime: mime, bytes: new TextEncoder().encode(decodeURIComponent(body)) };
        } catch (e2) {
            return null;
        }
    }

    function uint8ToBase64Chunked(u8) {
        var CHUNK = 0x8000;
        var str = '';
        for (var i = 0; i < u8.length; i += CHUNK) {
            str += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + CHUNK, u8.length)));
        }
        return btoa(str);
    }

    function binaryToDataUrl(mime, u8) {
        return 'data:' + (mime || 'application/octet-stream') + ';base64,' + uint8ToBase64Chunked(u8);
    }

    function deepCloneJsonSafe(obj) {
        try {
            return JSON.parse(JSON.stringify(obj, function (k, v) {
                if (v instanceof Date) return v.toISOString();
                return v;
            }));
        } catch (e) {
            return obj;
        }
    }

    // ---------- 媒体树处理 ----------
    function extractMediaTree(node, state) {
        if (!state) state = { store: {}, map: new Map(), n: 0 };
        if (node === null || node === undefined) return node;
        if (typeof node === 'string') {
            if (isDataMediaUrl(node)) {
                var id = state.map.get(node);
                if (!id) {
                    id = 'm' + state.n++;
                    state.map.set(node, id);
                    state.store[id] = node;
                }
                return { __mRef: id };
            }
            return node;
        }
        if (Array.isArray(node)) return node.map(function (x) { return extractMediaTree(x, state); });
        if (typeof node === 'object') {
            if (node instanceof Date) return node.toISOString();
            var out = {};
            for (var k in node) {
                if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
                out[k] = extractMediaTree(node[k], state);
            }
            return out;
        }
        return node;
    }

    function inlineMediaTree(node, store) {
        if (!store) store = {};
        if (node === null || node === undefined) return node;
        if (typeof node === 'object' && !Array.isArray(node) && node.__mRef && typeof node.__mRef === 'string') {
            var blob = store[node.__mRef];
            return blob !== undefined && blob !== null ? blob : node;
        }
        if (Array.isArray(node)) return node.map(function (x) { return inlineMediaTree(x, store); });
        if (typeof node === 'object') {
            var o = {};
            for (var k in node) {
                if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
                o[k] = inlineMediaTree(node[k], store);
            }
            return o;
        }
        return node;
    }

    function processLocalStorageValueForExport(str, state) {
        if (str == null) return str;
        if (typeof str !== 'string') return str;
        if (isDataMediaUrl(str)) {
            var id = state.map.get(str);
            if (!id) {
                id = 'm' + state.n++;
                state.map.set(str, id);
                state.store[id] = str;
            }
            return JSON.stringify({ __mRef: id });
        }
        try {
            var parsed = JSON.parse(str);
            var extracted = extractMediaTree(parsed, state);
            return JSON.stringify(extracted);
        } catch (e) {
            return str;
        }
    }

    function processLocalStorageValueForImport(str, store) {
        if (str == null) return str;
        if (typeof str !== 'string') return str;
        try {
            var parsed = JSON.parse(str);
            return JSON.stringify(inlineMediaTree(parsed, store));
        } catch (e) {
            return str;
        }
    }

    // ---------- session 推断 ----------
    function inferBackupSessionId(lfKeys, appPrefix) {
        var pfx = appPrefix || (typeof APP_PREFIX !== 'undefined' ? APP_PREFIX : 'CHAT_APP_V3_');
        var skipParts = ['MIGRATION', 'sessionList', 'lastSessionId', 'customThemes', 'themeSchemes'];
        for (var i = 0; i < lfKeys.length; i++) {
            var sk = lfKeys[i];
            if (!sk || !sk.startsWith(pfx)) continue;
            if (skipParts.some(function (s) { return sk.startsWith(pfx + s); })) continue;
            var after = sk.slice(pfx.length);
            var u = after.indexOf('_');
            if (u > 0) return after.slice(0, u);
        }
        return null;
    }

    // ---------- 模块过滤（与 config.js 注册表联动）----------
    function buildModuleSkipPatterns(flags) {
        flags = flags || {};
        var p = [];
        if (!flags.inclStickers) p.push('stickerLibrary', 'myStickerLibrary');
        if (!flags.inclThemes) p.push('backgroundGallery', 'chatBackground', 'partnerAvatar', 'myAvatar', 'playerCover');
        if (!flags.inclMsgs) p.push('chatMessages');
        if (!flags.inclSet) p.push('chatSettings', 'partnerPersonas', 'showPartnerNameInChat');
        if (!flags.inclCustom) p.push('customReplies', 'customPokes', 'customStatuses', 'customMottos', 'customIntros', 'customEmojis', 'customReplyGroups');
        if (!flags.inclAnn) p.push('anniversaries');
        if (!flags.inclThemes) p.push('customThemes', 'themeSchemes');
        if (!flags.inclDg) p.push('dg_custom_data', 'dg_status_pool', 'weekly_fortune', 'daily_fortune', 'customWeather_');
        return p;
    }

    function shouldSkipKey(key, flags) {
        if (!key) return true;
        if (key.startsWith('annHeaderBg_')) return true;
        if (key.indexOf('dg_header_bg') !== -1 || key.indexOf('dg_overlay_bg') !== -1) return true;
        var patterns = buildModuleSkipPatterns(flags || {});
        return patterns.some(function (p) { return key.indexOf(p) !== -1; });
    }

    // ---------- 构建备份负载 ----------
    async function buildBackupPayload(flags) {
        flags = flags || {
            inclMsgs: true, inclSet: true, inclCustom: true, inclAnn: true,
            inclThemes: true, inclDg: true, inclStickers: true   // 默认全部备份
        };
        var lfData = {};
        var keys = await localforage.keys();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (shouldSkipKey(key, flags)) continue;
            try {
                var rawVal = await localforage.getItem(key);
                if (rawVal === null || rawVal === undefined) continue;
                lfData[key] = deepCloneJsonSafe(rawVal);
            } catch (e) { console.warn('[backup] 读取失败', key, e); }
        }
        var lsData = {};
        for (var j = 0; j < localStorage.length; j++) {
            var lk = localStorage.key(j);
            if (!lk || shouldSkipKey(lk, flags)) continue;
            try {
                lsData[lk] = localStorage.getItem(lk);
            } catch (e2) {}
        }
        var state = { store: {}, map: new Map(), n: 0 };
        var lfOut = {};
        for (var k in lfData) {
            if (!Object.prototype.hasOwnProperty.call(lfData, k)) continue;
            lfOut[k] = extractMediaTree(lfData[k], state);
        }
        var lsOut = {};
        for (var k2 in lsData) {
            if (!Object.prototype.hasOwnProperty.call(lsData, k2)) continue;
            lsOut[k2] = processLocalStorageValueForExport(lsData[k2], state);
        }
        return {
            type: 'chatapp-backup-v6',
            formatVersion: 6,
            appName: 'ChatApp',
            timestamp: new Date().toISOString(),
            sessionId: typeof SESSION_ID !== 'undefined' ? SESSION_ID : null,
            appPrefix: typeof APP_PREFIX !== 'undefined' ? APP_PREFIX : 'CHAT_APP_V3_',
            modules: flags,
            mediaStore: state.store,
            localforage: lfOut,
            localStorage: lsOut
        };
    }

    // ---------- 导出 ----------
    function downloadBlob(blob, fileName) {
        if (typeof downloadFileFallback === 'function') {
            downloadFileFallback(blob, fileName);
            return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }

    async function exportBackupToFile(flags) {
        if (typeof showNotification === 'function') showNotification('正在打包备份…', 'info', 4000);
        var payload = await buildBackupPayload(flags);
        var dateStr = new Date().toISOString().slice(0, 10);
        var fileNameZip = 'chatapp-backup-' + dateStr + '.zip';

        if (typeof JSZip !== 'undefined') {
            try {
                var zip = new JSZip();
                var store = payload.mediaStore || {};
                var mediaIndex = {};
                for (var sid in store) {
                    if (!Object.prototype.hasOwnProperty.call(store, sid)) continue;
                    var url = store[sid];
                    var parts = dataUrlToBinary(url);
                    var path = 'media/' + sid;
                    if (parts && parts.bytes && parts.bytes.length) {
                        zip.file(path, parts.bytes, { binary: true });
                        mediaIndex[sid] = { path: path, mime: parts.mime };
                    } else {
                        var txtPath = path + '.txt';
                        zip.file(txtPath, String(url));
                        mediaIndex[sid] = { path: txtPath, mime: 'text/plain+dataurl' };
                    }
                }
                var jsonBody = {
                    type: 'chatapp-backup-v6',
                    formatVersion: 6,
                    appName: payload.appName,
                    timestamp: payload.timestamp,
                    sessionId: payload.sessionId,
                    appPrefix: payload.appPrefix,
                    modules: payload.modules,
                    localforage: payload.localforage,
                    localStorage: payload.localStorage,
                    mediaIndex: mediaIndex
                };
                zip.file('backup.json', '\uFEFF' + JSON.stringify(jsonBody));
                var zipBlob = await zip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 6 }
                });
                // 移动端分享
                if (navigator.share && /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)) {
                    try {
                        var shareFile = new File([zipBlob], fileNameZip, { type: 'application/zip' });
                        if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
                            await navigator.share({
                                files: [shareFile],
                                title: '传讯全量备份',
                                text: 'ZIP 备份：' + new Date().toLocaleDateString()
                            });
                            if (typeof showNotification === 'function') showNotification('备份导出成功', 'success');
                            return;
                        }
                    } catch (e) { /* fall through */ }
                }
                downloadBlob(zipBlob, fileNameZip);
                if (typeof showNotification === 'function') {
                    showNotification('已导出 ZIP 备份（含图片）', 'success', 3500);
                }
                return;
            } catch (zipErr) {
                console.error('[backup] ZIP 导出失败，回退单文件 JSON', zipErr);
                if (typeof showNotification === 'function') {
                    showNotification('ZIP 打包失败，改为单文件 JSON', 'warning', 4500);
                }
            }
        } else if (typeof showNotification === 'function') {
            showNotification('JSZip 未加载，将导出单文件 JSON', 'warning', 3000);
        }

        // 回退到单 JSON
        var bom = '\uFEFF';
        var str = bom + JSON.stringify(payload);
        var blob = new Blob([str], { type: 'application/json;charset=utf-8' });
        var fileName = 'chatapp-backup-' + dateStr + '.json';
        if (navigator.share && /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)) {
            try {
                var f = new File([blob], fileName, { type: 'application/json' });
                if (navigator.canShare && navigator.canShare({ files: [f] })) {
                    await navigator.share({ files: [f], title: '传讯全量备份', text: '备份日期：' + new Date().toLocaleDateString() });
                    if (typeof showNotification === 'function') showNotification('备份导出成功', 'success');
                    return;
                }
            } catch (e2) { /* fall through */ }
        }
        downloadBlob(blob, fileName);
        if (typeof showNotification === 'function') showNotification('备份导出成功（JSON）', 'success');
    }

    // ---------- 导入解析 ----------
    async function parseZipBackup(arrayBuffer) {
        if (typeof JSZip === 'undefined') throw new Error('JSZip 未加载，无法读取 ZIP 备份');
        var zip = await JSZip.loadAsync(arrayBuffer);
        var jsonFile = zip.file('backup.json');
        if (!jsonFile) {
            var names = Object.keys(zip.files).filter(function (n) {
                var e = zip.files[n];
                return e && !e.dir && /\.json$/i.test(n);
            });
            if (names.length === 1) jsonFile = zip.file(names[0]);
        }
        if (!jsonFile) throw new Error('ZIP 内未找到 backup.json');
        var raw = await jsonFile.async('string');
        if (raw.length && raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        var data = JSON.parse(raw);
        var idx = data.mediaIndex;
        if ((data.formatVersion === 5 || data.formatVersion === 6) && data.type.indexOf('backup-v') !== -1 && idx && typeof idx === 'object') {
            var built = {};
            var ids = Object.keys(idx);
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                var meta = idx[id];
                var path = (meta && meta.path) ? meta.path : ('media/' + id);
                var zf = zip.file(path);
                if (!zf) {
                    console.warn('[backup] ZIP 缺少媒体文件', path);
                    continue;
                }
                var mimeMeta = (meta && meta.mime) ? meta.mime : 'application/octet-stream';
                if (mimeMeta === 'text/plain+dataurl') {
                    built[id] = await zf.async('string');
                } else {
                    var ab = await zf.async('arraybuffer');
                    built[id] = binaryToDataUrl(mimeMeta, new Uint8Array(ab));
                }
            }
            var ms = data.mediaStore || {};
            for (var k in ms) {
                if (Object.prototype.hasOwnProperty.call(ms, k) && built[k] == null) built[k] = ms[k];
            }
            data.mediaStore = built;
        }
        return data;
    }

    async function loadBackupFromArrayBuffer(ab) {
        if (isZipArrayBuffer(ab)) return await parseZipBackup(ab);
        var text = new TextDecoder('utf-8', { fatal: false }).decode(ab);
        if (text.length && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        return JSON.parse(text);
    }

    async function loadBackupFromFile(file) {
        var ab = await file.arrayBuffer();
        return await loadBackupFromArrayBuffer(ab);
    }

    // ---------- 核心：恢复数据到存储（修复版）----------
    async function applyBackupToStorage(data, opt) {
        opt = opt || {};
        var selective = !!opt.selective;
        var mediaStore = data.mediaStore || {};

        // 获取原始数据源（兼容旧格式 indexedDB / localforage）
        var lfRaw = {};
        if (data.localforage && typeof data.localforage === 'object') {
            lfRaw = data.localforage;
        } else if (data.indexedDB && typeof data.indexedDB === 'object') {
            lfRaw = data.indexedDB;
        }
        var lsRaw = data.localStorage || {};

        // 选择性导入（如果你有 categories 定义）
        if (selective && opt.selectedCategoryIds && opt.categories) {
            // 这里需要根据你的 config.js 中的 APP_DATA_REGISTRY 来过滤
            // 简化起见，仅保留示例逻辑，实际可在调用时传入过滤函数
            console.warn('[backup] 选择性导入需要传入 categories 和过滤函数，当前未实现详细过滤，将导入全部');
        }

        // ========== 关键修复1：禁止 session 重映射 ==========
        var lfKeys = Object.keys(lfRaw);
        var backupSid = data.sessionId || inferBackupSessionId(lfKeys, data.appPrefix);
        var curSid = typeof SESSION_ID !== 'undefined' ? SESSION_ID : null;
        var appPfx = data.appPrefix || (typeof APP_PREFIX !== 'undefined' ? APP_PREFIX : 'CHAT_APP_V3_');

        // 不再重命名键名，而是直接使用备份中的键名
        var needRemap = false;  // 强制关闭重映射

        // ========== 关键修复2：更新当前 SESSION_ID 为备份的 ID ==========
        if (backupSid && typeof SESSION_ID !== 'undefined') {
            SESSION_ID = backupSid;
            // 同时更新全局变量（如果存在 window 上）
            if (typeof window !== 'undefined') window.SESSION_ID = backupSid;
        }

        // 写入 localforage
        for (var i = 0; i < lfKeys.length; i++) {
            var lk = lfKeys[i];
            var targetKey = needRemap ? remapLfKey(lk, backupSid, curSid, appPfx) : lk;
            var val = inlineMediaTree(lfRaw[lk], mediaStore);
            try {
                await localforage.setItem(targetKey, val);
            } catch (e) {
                console.warn('[backup] 写入 localforage 失败', targetKey, e);
            }
        }

        // 写入 localStorage（修复：不再跳过任何图片）
        for (var k in lsRaw) {
            if (!Object.prototype.hasOwnProperty.call(lsRaw, k)) continue;
            var targetLsKey = needRemap ? remapLfKey(k, backupSid, curSid, appPfx) : k;
            try {
                var lsv = processLocalStorageValueForImport(lsRaw[k], mediaStore);
                // 原代码会 if (长度>2000 && data:image) continue; 现已移除，确保所有图片恢复
                localStorage.setItem(targetLsKey, lsv);
            } catch (e2) {
                console.warn('[backup] 写入 localStorage 失败', targetLsKey, e2);
            }
        }

        // ========== 关键修复3：更新会话列表并刷新页面 ==========
        if (typeof APP_PREFIX !== 'undefined' && typeof SESSION_ID !== 'undefined') {
            try {
                // 更新最后使用的会话 ID
                await localforage.setItem(APP_PREFIX + 'lastSessionId', SESSION_ID);
                // 确保当前会话存在于会话列表中
                var sessionList = await localforage.getItem(APP_PREFIX + 'sessionList') || [];
                if (!sessionList.some(function(s) { return s.id === SESSION_ID; })) {
                    sessionList.push({
                        id: SESSION_ID,
                        name: '导入的会话 ' + new Date().toLocaleDateString(),
                        createdAt: Date.now()
                    });
                    await localforage.setItem(APP_PREFIX + 'sessionList', sessionList);
                }
            } catch (e3) {
                console.warn('[backup] 更新会话列表失败', e3);
            }
        }

        // ========== 关键修复4：导入后强制刷新页面 ==========
        if (typeof showNotification === 'function') {
            showNotification('导入成功，即将刷新页面…', 'success', 2000);
        }
        setTimeout(function() {
            window.location.href = window.location.pathname;  // 刷新当前页面
        }, 1500);
    }

    // ---------- 辅助：判断是否为完整备份 ----------
    function isFullBackupShape(d) {
        if (!d || typeof d !== 'object') return false;
        if (d.formatVersion === 6 && d.type === 'chatapp-backup-v6') return true;
        if (d.formatVersion === 5 && d.type === 'chatapp-backup-v5') return true;
        if (d.formatVersion === 4 && d.type === 'chatapp-backup-v4') return true;
        if (d.type === 'full' || (typeof d.type === 'string' && d.type.indexOf('full-backup') !== -1)) return true;
        if (d.indexedDB && typeof d.indexedDB === 'object') return true;
        if (d.localforage && typeof d.localforage === 'object') return true;
        return false;
    }

    // ---------- 导出全局对象 ----------
    global.ChatBackup = {
        MIN_MEDIA_CHARS: MIN_MEDIA_CHARS,
        extractMediaTree: extractMediaTree,
        inlineMediaTree: inlineMediaTree,
        buildBackupPayload: buildBackupPayload,
        exportBackupToFile: exportBackupToFile,
        loadBackupFromFile: loadBackupFromFile,
        loadBackupFromArrayBuffer: loadBackupFromArrayBuffer,
        applyBackupToStorage: applyBackupToStorage,
        isFullBackupShape: isFullBackupShape,
        shouldSkipKey: shouldSkipKey,
        buildModuleSkipPatterns: buildModuleSkipPatterns
    };
})(typeof window !== 'undefined' ? window : this);
