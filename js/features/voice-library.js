/* ═══════════════════════════════════════════════════════════════
   voice-library.js — 语音库（完整版）
   - 音频 Blob 存 LocalForage，元数据存 settings.voiceLibrary
   - 支持 MP3 上传 / 录音 / 转文字 / 删除 / ZIP 导出导入
   - 聊天语音条：单击播放/停止，双击弹功能气泡
   - 聊天气泡"文"：显示/收起下方文字
   - 语音库"文"：打开编辑窗
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.__voiceLibraryLoaded) return;
    window.__voiceLibraryLoaded = true;

    const VOICE_PREFIX = 'voice_blob_';
    const MAX_SIZE = 5 * 1024 * 1024;
    const MAX_DURATION = 60;

    // ─── 样式注入 ───
    (function injectStyles() {
        if (document.getElementById('voice-lib-styles')) return;
        const s = document.createElement('style');
        s.id = 'voice-lib-styles';
        s.textContent = `
            @keyframes voicePulse {
                0%,100% { opacity:1; transform:scale(1); }
                50% { opacity:0.4; transform:scale(1.15); }
            }
            .rl-card.voice-playing {
                border-color: var(--accent-color) !important;
                background: rgba(var(--accent-color-rgb,180,140,100),0.1) !important;
            }
            .rl-card.voice-playing [data-action="play"] {
                color: var(--accent-color) !important;
                animation: voicePulse 1s ease-in-out infinite;
            }
            .voice-bubble.voice-playing .fa-wifi {
                color: var(--accent-color) !important;
                animation: voicePulse 1s ease-in-out infinite;
            }
            /* 语音消息功能气泡默认隐藏，双击才显示 */
            .message-wrapper:has(.voice-bubble) .message-meta-actions {
                opacity: 0 !important;
                pointer-events: none !important;
                transition: opacity 0.15s ease;
            }
            .voice-transcript {
                margin-top: 6px;
                font-size: 13px;
                color: var(--text-secondary);
                line-height: 1.6;
                padding-left: 2px;
                word-break: break-word;
                display: none;
            }
        `;
        document.head.appendChild(s);
    })();

    // ─── 元数据 ───
    function ensureVoiceLibrary() {
        if (typeof settings === 'undefined' || !settings) return null;
        if (!Array.isArray(settings.voiceLibrary)) settings.voiceLibrary = [];
        return settings.voiceLibrary;
    }

    // ─── Blob 存取 ───
    async function getVoiceBlob(id) {
        try { return await localforage.getItem(VOICE_PREFIX + id); }
        catch (e) { console.warn('读取语音失败', id, e); return null; }
    }
    async function saveVoiceBlob(id, blob) { return await localforage.setItem(VOICE_PREFIX + id, blob); }
    async function deleteVoiceBlob(id) { try { await localforage.removeItem(VOICE_PREFIX + id); } catch (e) {} }

    // ─── 播放（单例 + 再点停止） ───
    let _curAudio = null;
    let _curUrl = null;
    let _curVoiceId = null;
    let _curEl = null;

    function _stopCurrent() {
        if (_curAudio) { try { _curAudio.pause(); } catch (e) {} _curAudio = null; }
        if (_curUrl) { try { URL.revokeObjectURL(_curUrl); } catch (e) {} _curUrl = null; }
        if (_curEl) { try { _curEl.classList.remove('voice-playing'); } catch (e) {} _curEl = null; }
        _curVoiceId = null;
    }

    async function playVoice(id, el) {
        if (_curAudio && _curVoiceId === id) {
            _stopCurrent();
            return;
        }
        _stopCurrent();
        const blob = await getVoiceBlob(id);
        if (!blob) { if (typeof showNotification === 'function') showNotification('语音文件不存在', 'error'); return; }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        _curAudio = audio; _curUrl = url; _curVoiceId = id; _curEl = el;
        if (el) el.classList.add('voice-playing');
        audio.onended = audio.onerror = () => {
            try { URL.revokeObjectURL(url); } catch (e) {}
            if (el) el.classList.remove('voice-playing');
            if (_curAudio === audio) _curAudio = null;
            if (_curUrl === url) _curUrl = null;
            if (_curVoiceId === id) _curVoiceId = null;
            if (_curEl === el) _curEl = null;
        };
        try { await audio.play(); }
        catch (e) {
            if (typeof showNotification === 'function') showNotification('播放失败：' + e.message, 'error');
            _stopCurrent();
        }
    }

    // ─── 时长读取 ───
    function readDuration(fileOrBlob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(fileOrBlob);
            const audio = new Audio();
            audio.preload = 'metadata';
            const cleanup = () => { try { URL.revokeObjectURL(url); } catch (e) {} };
            audio.onloadedmetadata = () => {
                const d = Math.round(audio.duration);
                cleanup();
                if (!isFinite(d) || d <= 0) reject(new Error('无法读取时长'));
                else resolve(d);
            };
            audio.onerror = () => { cleanup(); reject(new Error('无法解析音频')); };
            audio.src = url;
        });
    }

    // ─── 从文件添加 ───
    async function addVoiceFromFile(file, opts) {
        opts = opts || {};
        if (!file) return null;
        if (file.size > MAX_SIZE) {
            if (typeof showNotification === 'function') showNotification(`单条语音不能超过 ${(MAX_SIZE/1024/1024).toFixed(1)}MB`, 'error');
            return null;
        }
        let duration;
        try { duration = await readDuration(file); }
        catch (e) { if (typeof showNotification === 'function') showNotification('解析失败：' + e.message, 'error'); return null; }
        if (duration > MAX_DURATION) {
            if (typeof showNotification === 'function') showNotification(`语音时长 ${duration}s 超过 ${MAX_DURATION} 秒限制`, 'error');
            return null;
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await saveVoiceBlob(id, file);
        const lib = ensureVoiceLibrary(); if (!lib) return null;
        const meta = {
            id,
            name: opts.name || (file.name ? file.name.replace(/\.[^.]+$/, '') : '未命名'),
            duration, size: file.size, createdAt: Date.now(),
            text: ''
        };
        lib.push(meta);
        if (typeof throttledSaveData === 'function') throttledSaveData();
        return meta;
    }

    // ─── 录音 ───
    let _rec = null, _recChunks = [], _recStream = null, _recTimer = null, _recTick = null, _recStart = 0;

    async function startRecording(onTick, onStop) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (typeof showNotification === 'function') showNotification('当前浏览器不支持录音', 'error');
            return false;
        }
        try {
            _recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            _recChunks = [];
            let mime = '';
            if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
                for (const c of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']) {
                    if (MediaRecorder.isTypeSupported(c)) { mime = c; break; }
                }
            }
            _rec = mime ? new MediaRecorder(_recStream, { mimeType: mime, audioBitsPerSecond: 24000 }) : new MediaRecorder(_recStream);
            _rec.ondataavailable = e => { if (e.data && e.data.size) _recChunks.push(e.data); };
            _rec.onstop = () => {
                clearTimeout(_recTimer); clearInterval(_recTick);
                if (_recStream) { _recStream.getTracks().forEach(t => t.stop()); _recStream = null; }
                const duration = Math.round((Date.now() - _recStart) / 1000);
                if (!_recChunks.length) { onStop && onStop(null); return; }
                const blob = new Blob(_recChunks, { type: _rec.mimeType || 'audio/webm' });
                _recChunks = [];
                onStop && onStop({ blob, duration });
            };
            _recStart = Date.now();
            _rec.start();
            _recTimer = setTimeout(() => stopRecording(), MAX_DURATION * 1000);
            _recTick = setInterval(() => { if (onTick) onTick(Math.floor((Date.now() - _recStart) / 1000)); }, 200);
            return true;
        } catch (e) {
            if (typeof showNotification === 'function') showNotification('无法访问麦克风：' + e.message, 'error');
            return false;
        }
    }
    function stopRecording() { if (_rec && _rec.state === 'recording') { try { _rec.stop(); } catch (e) {} } }

    async function saveRecordedBlob(blob, duration) {
        if (!blob) return null;
        if (blob.size > MAX_SIZE) {
            if (typeof showNotification === 'function') showNotification('录音过大，请缩短时长', 'error');
            return null;
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await saveVoiceBlob(id, blob);
        const lib = ensureVoiceLibrary(); if (!lib) return null;
        const meta = {
            id,
            name: '录音 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            duration: duration || 0, size: blob.size, createdAt: Date.now(),
            text: ''
        };
        lib.push(meta);
        if (typeof throttledSaveData === 'function') throttledSaveData();
        return meta;
    }

    // ─── 删除 ───
    async function deleteVoices(ids) {
        if (!ids || !ids.length) return 0;
        const lib = ensureVoiceLibrary(); if (!lib) return 0;
        const set = new Set(ids);
        for (const id of ids) await deleteVoiceBlob(id);
        settings.voiceLibrary = lib.filter(v => !set.has(v.id));
        if (typeof throttledSaveData === 'function') throttledSaveData();
        return ids.length;
    }

    // ─── ZIP 导出 ───
    function guessExt(blob, name) {
        const t = (blob.type || '').toLowerCase();
        if (t.includes('webm')) return 'webm';
        if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'm4a';
        if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
        if (t.includes('wav')) return 'wav';
        if (t.includes('ogg')) return 'ogg';
        if (name && /\.([a-z0-9]+)$/i.test(name)) return name.split('.').pop().toLowerCase();
        return 'webm';
    }
    async function exportVoiceLibrary(ids) {
        if (typeof JSZip === 'undefined') { if (typeof showNotification === 'function') showNotification('JSZip 未加载', 'error'); return; }
        const lib = ensureVoiceLibrary(); if (!lib) return;
        const list = ids && ids.length ? lib.filter(v => ids.includes(v.id)) : lib.slice();
        if (!list.length) { if (typeof showNotification === 'function') showNotification('没有可导出的语音', 'warning'); return; }
        if (typeof showNotification === 'function') showNotification(`正在打包 ${list.length} 条语音…`, 'info');
        const zip = new JSZip();
        const manifest = [];
        for (const meta of list) {
            const blob = await getVoiceBlob(meta.id); if (!blob) continue;
            const ext = guessExt(blob, meta.name);
            const path = `voices/${meta.id}.${ext}`;
            zip.file(path, blob, { binary: true });
            manifest.push({
                id: meta.id, name: meta.name, duration: meta.duration,
                size: meta.size, createdAt: meta.createdAt, file: path,
                text: meta.text || ''
            });
        }
        zip.file('manifest.json', JSON.stringify({
            type: 'xavier-voice-library-v1', version: 1,
            exportedAt: new Date().toISOString(),
            count: manifest.length, voices: manifest
        }, null, 2));
        const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        const fileName = `voice-library-${new Date().toISOString().slice(0,10)}.zip`;
        const url = URL.createObjectURL(out);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        if (typeof showNotification === 'function') showNotification(`✓ 已导出 ${manifest.length} 条语音`, 'success');
    }

    // ─── ZIP 导入 ───
    async function importVoiceLibrary(file) {
        if (!file) return 0;
        if (typeof JSZip === 'undefined') { if (typeof showNotification === 'function') showNotification('JSZip 未加载', 'error'); return 0; }
        try {
            const zip = await JSZip.loadAsync(file);
            const mf = zip.file('manifest.json');
            if (!mf) { if (typeof showNotification === 'function') showNotification('无效的语音库文件', 'error'); return 0; }
            const manifest = JSON.parse(await mf.async('string'));
            if (!manifest.voices || !Array.isArray(manifest.voices)) { if (typeof showNotification === 'function') showNotification('manifest 格式不正确', 'error'); return 0; }
            const lib = ensureVoiceLibrary(); if (!lib) return 0;
            const existing = new Set(lib.map(v => v.id));
            let added = 0;
            for (const m of manifest.voices) {
                if (!m.id || !m.file || existing.has(m.id)) continue;
                const zf = zip.file(m.file); if (!zf) continue;
                const raw = await zf.async('blob');
                let mime = raw.type || '';
                if (!mime || !mime.startsWith('audio/')) {
                    if (/\.mp3$/i.test(m.file)) mime = 'audio/mpeg';
                    else if (/\.m4a$/i.test(m.file)) mime = 'audio/mp4';
                    else if (/\.wav$/i.test(m.file)) mime = 'audio/wav';
                    else if (/\.ogg$/i.test(m.file)) mime = 'audio/ogg';
                    else mime = 'audio/webm';
                }
                const typedBlob = new Blob([raw], { type: mime });
                await saveVoiceBlob(m.id, typedBlob);
                lib.push({
                    id: m.id, name: m.name || '未命名',
                    duration: m.duration || 0, size: typedBlob.size,
                    createdAt: m.createdAt || Date.now(),
                    text: m.text || ''
                });
                added++;
            }
            if (typeof throttledSaveData === 'function') throttledSaveData();
            if (typeof showNotification === 'function') showNotification(`✓ 导入成功，新增 ${added} 条语音`, 'success');
            return added;
        } catch (e) {
            console.error(e);
            if (typeof showNotification === 'function') showNotification('导入失败：' + e.message, 'error');
            return 0;
        }
    }

    // ─── 工具 ───
    function _fmtSize(bytes) {
        if (!bytes || bytes < 1024) return (bytes || 0) + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / 1024 / 1024).toFixed(2) + 'MB';
    }
    function _escape(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    // ══════════════════════════════════════════════════════════════
    // 转文字编辑弹窗（语音库用）
    // ══════════════════════════════════════════════════════════════
    function _showVoiceTextEditor(voiceId) {
        const lib = ensureVoiceLibrary();
        if (!lib) return;
        const meta = lib.find(v => v.id === voiceId);
        if (!meta) { if (typeof showNotification === 'function') showNotification('语音不存在', 'error'); return; }

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg);border-radius:22px;padding:22px;width:92%;max-width:400px;box-shadow:0 24px 80px rgba(0,0,0,.45);">
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">转文字</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:14px;">为「${_escape(meta.name)}」写一段文字，聊天里点"文"才显示</div>
                <textarea id="_vte_input" placeholder="在这里输入这段语音的内容…" style="
                    width:100%;box-sizing:border-box;min-height:120px;padding:12px 14px;
                    border:1.5px solid var(--border-color);border-radius:13px;
                    background:var(--primary-bg);color:var(--text-primary);
                    font-size:14px;font-family:var(--font-family);outline:none;resize:vertical;
                    line-height:1.6;transition:border 0.18s;
                ">${_escape(meta.text || '')}</textarea>
                <div style="display:flex;gap:10px;margin-top:14px;">
                    <button id="_vte_cancel" style="flex:1;padding:12px;border:1.5px solid var(--border-color);border-radius:13px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">取消</button>
                    <button id="_vte_save" style="flex:2;padding:12px;border:none;border-radius:13px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--font-family);">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('#_vte_input');
        const close = () => overlay.remove();

        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('#_vte_cancel').onclick = close;
        overlay.querySelector('#_vte_save').onclick = () => {
            meta.text = input.value.trim();
            if (typeof throttledSaveData === 'function') throttledSaveData();
            close();
            if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
            if (typeof renderMessages === 'function') renderMessages(true);
            if (typeof showNotification === 'function') showNotification('✓ 已保存文字', 'success');
        };

        setTimeout(() => input.focus(), 100);
    }

    // ══════════════════════════════════════════════════════════════
    // 聊天气泡"文"：显示/收起下方文字
    // ══════════════════════════════════════════════════════════════
    function toggleTranscript(btn) {
        const wrapper = btn.closest('.message-wrapper');
        if (!wrapper) return;
        const bubble = wrapper.querySelector('.voice-bubble');
        if (!bubble) return;
        const voiceId = bubble.dataset.voiceId;
        const lib = ensureVoiceLibrary();
        const meta = lib ? lib.find(v => v.id === voiceId) : null;

        if (!meta) {
            if (typeof showNotification === 'function') showNotification('语音不存在', 'error');
            return;
        }
        // 没文字 → 让用户先写
        if (!meta.text) {
            _showVoiceTextEditor(voiceId);
            return;
        }

        let t = wrapper.querySelector('.voice-transcript');
        if (!t) {
            // DOM 里还没有这个节点，临时创建一个
            const wrap = wrapper.querySelector('.voice-bubble-wrap');
            if (!wrap) return;
            t = document.createElement('div');
            t.className = 'voice-transcript';
            t.textContent = meta.text;
            wrap.appendChild(t);
        }
        const isHidden = (t.style.display === 'none' || getComputedStyle(t).display === 'none');
        t.style.display = isHidden ? 'block' : 'none';
        // 让按钮有"按下"感
        btn.classList.toggle('active', isHidden);
    }

    // ══════════════════════════════════════════════════════════════
    // 语音库卡片
    // ══════════════════════════════════════════════════════════════
    function _createVoiceCard(meta, index) {
        const card = document.createElement('div');
        card.className = 'rl-card';
        const batchActive = (typeof _batchModeActive !== 'undefined') && _batchModeActive;
        const selectedSet = (typeof _batchSelectedIndices !== 'undefined') ? _batchSelectedIndices : null;
        const isSelected = batchActive && selectedSet && selectedSet.has(index);

        if (batchActive) {
            card.style.cursor = 'pointer';
            if (isSelected) card.classList.add('rl-selected');
            card.innerHTML = `
                <div class="rl-batch-check" style="border:1.5px solid ${isSelected ? 'var(--accent-color)' : 'var(--border-color)'};background:${isSelected ? 'var(--accent-color)' : 'transparent'};">
                    ${isSelected ? `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>` : ''}
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${_escape(meta.name)}</div>
                    <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${meta.duration}" · ${_fmtSize(meta.size)}</div>
                </div>
            `;
            card.addEventListener('click', () => {
                if (!selectedSet) return;
                if (isSelected) selectedSet.delete(index);
                else selectedSet.add(index);
                if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
            });
            return card;
        }

        card.innerHTML = `
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${_escape(meta.name)}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${meta.duration}" · ${_fmtSize(meta.size)}</div>
                ${meta.text ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;opacity:0.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📝 ${_escape(meta.text)}</div>` : ''}
            </div>
            <div class="rl-card-actions">
                <button class="rl-act-btn" data-action="play" title="试听">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M5.6 5l3.2 2-3.2 2V5z" fill="currentColor"/></svg>
                </button>
                <button class="rl-act-btn" data-action="text" title="转文字">
                    <span style="font-family:'Noto Serif SC',serif;font-size:13px;font-weight:700;line-height:1;">文</span>
                </button>
                <button class="rl-act-btn" data-action="rename" title="重命名">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 2l2.5 2.5L4 11.5H1.5V9L8.5 2z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
                </button>
                <button class="rl-act-btn danger" data-action="delete" title="删除">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="2" y1="3" x2="11" y2="3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M4.5 3V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V3"/><path d="M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
                </button>
            </div>
        `;

        card.querySelector('[data-action="play"]').onclick = e => {
            e.stopPropagation();
            playVoice(meta.id, card);
        };
        card.querySelector('[data-action="text"]').onclick = e => {
            e.stopPropagation();
            _showVoiceTextEditor(meta.id);
        };
        card.querySelector('[data-action="rename"]').onclick = e => {
            e.stopPropagation();
            const nn = prompt('重命名语音：', meta.name);
            if (nn === null) return;
            const t = nn.trim(); if (!t) return;
            meta.name = t;
            if (typeof throttledSaveData === 'function') throttledSaveData();
            if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
        };
        card.querySelector('[data-action="delete"]').onclick = async e => {
            e.stopPropagation();
            if (!confirm(`删除「${meta.name}」？`)) return;
            await deleteVoices([meta.id]);
            if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
            if (typeof showNotification === 'function') showNotification('已删除', 'success');
        };
        // 双击卡片 → 编辑文字
        card.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            _showVoiceTextEditor(meta.id);
        });
        return card;
    }

    // ══════════════════════════════════════════════════════════════
    // 语音库 Tab 渲染
    // ══════════════════════════════════════════════════════════════
    function _renderVoiceTab(list, items) {
        const all = (typeof settings !== 'undefined' && settings && settings.voiceLibrary) || [];
        const q = (typeof _searchQuery === 'string' && _searchQuery.trim().toLowerCase()) || '';
        const filtered = q ? all.filter(v =>
            (v.name || '').toLowerCase().includes(q) || (v.text || '').toLowerCase().includes(q)
        ) : all;
        if (!filtered.length) {
            list.innerHTML = (typeof renderEmptyState === 'function')
                ? renderEmptyState(q ? `未找到「${q}」` : '还没有语音，点下方"新增"添加')
                : '<div style="padding:40px;text-align:center;color:var(--text-secondary);">暂无语音</div>';
            return;
        }
        const frag = document.createDocumentFragment();
        let totalSize = 0; all.forEach(v => totalSize += (v.size || 0));
        const info = document.createElement('div');
        info.style.cssText = 'padding:2px 4px 10px;font-size:11px;color:var(--text-secondary);opacity:0.75;';
        info.textContent = `共 ${all.length} 条语音 · 合计 ${_fmtSize(totalSize)}`;
        frag.appendChild(info);
        filtered.forEach((meta) => { const idx = all.indexOf(meta); frag.appendChild(_createVoiceCard(meta, idx)); });
        list.appendChild(frag);
    }

    // ══════════════════════════════════════════════════════════════
    // 新增菜单
    // ══════════════════════════════════════════════════════════════
    function openAddMenu() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg);border-radius:22px;padding:24px;width:92%;max-width:340px;box-shadow:0 24px 80px rgba(0,0,0,.45);">
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:16px;">添加语音</div>
                <div id="_vam_upload" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:14px;background:var(--primary-bg);border:1.5px solid var(--border-color);cursor:pointer;margin-bottom:10px;">
                    <div style="width:38px;height:38px;border-radius:10px;background:rgba(var(--accent-color-rgb),0.12);display:flex;align-items:center;justify-content:center;color:var(--accent-color);flex-shrink:0;">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4.5 6L8 9.5 11.5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 12.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:13px;font-weight:600;color:var(--text-primary);">上传音频文件</div>
                        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">MP3 / M4A / WAV / OGG，≤60秒</div>
                    </div>
                </div>
                <div id="_vam_record" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:14px;background:var(--primary-bg);border:1.5px solid var(--border-color);cursor:pointer;">
                    <div style="width:38px;height:38px;border-radius:10px;background:rgba(var(--accent-color-rgb),0.12);display:flex;align-items:center;justify-content:center;color:var(--accent-color);flex-shrink:0;">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="6" y="2" width="4" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><line x1="8" y1="12" x2="8" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:13px;font-weight:600;color:var(--text-primary);">录音</div>
                        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">最长 60 秒，自动截断</div>
                    </div>
                </div>
                <button id="_vam_cancel" style="width:100%;margin-top:14px;padding:12px;border:1.5px solid var(--border-color);border-radius:13px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">取消</button>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('#_vam_cancel').onclick = close;

        // 上传
        overlay.querySelector('#_vam_upload').onclick = () => {
            close();
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'audio/*,.mp3,.m4a,.wav,.ogg,.webm'; inp.multiple = true;
            inp.onchange = async () => {
                const files = [...inp.files]; if (!files.length) return;
                let ok = 0, fail = 0;
                const addedList = [];
                for (const f of files) {
                    const r = await addVoiceFromFile(f);
                    if (r) { ok++; addedList.push(r); } else fail++;
                }
                if (ok && typeof renderReplyLibrary === 'function') renderReplyLibrary();
                if (typeof showNotification === 'function') {
                    if (ok) showNotification(`✓ 已添加 ${ok} 条${fail ? `，${fail} 条失败` : ''}`, 'success');
                    else showNotification('未添加任何语音', 'warning');
                }
                // 只导入一条时，自动弹编辑
                if (addedList.length === 1) {
                    setTimeout(() => _showVoiceTextEditor(addedList[0].id), 250);
                }
            };
            inp.click();
        };

        // 录音
        overlay.querySelector('#_vam_record').onclick = () => {
            close();
            _showRecordDialog();
        };
    }

    // ══════════════════════════════════════════════════════════════
    // 录音弹窗
    // ══════════════════════════════════════════════════════════════
    function _showRecordDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg);border-radius:22px;padding:28px;width:92%;max-width:320px;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.45);">
                <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:18px;">正在录音…</div>
                <div id="_vrd_time" style="font-size:32px;font-weight:700;color:var(--accent-color);font-variant-numeric:tabular-nums;margin-bottom:6px;">00:00</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:22px;">最长 60 秒</div>
                <div style="display:flex;gap:10px;">
                    <button id="_vrd_cancel" style="flex:1;padding:12px;border:1.5px solid var(--border-color);border-radius:13px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">取消</button>
                    <button id="_vrd_stop" style="flex:2;padding:12px;border:none;border-radius:13px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--font-family);">完成</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const timeEl = overlay.querySelector('#_vrd_time');
        let stopped = false;
        const finish = () => { if (stopped) return; stopped = true; stopRecording(); };
        startRecording(
            (sec) => { timeEl.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); },
            async (result) => {
                overlay.remove();
                if (!result) { if (typeof showNotification === 'function') showNotification('录音失败或已取消', 'warning'); return; }
                const meta = await saveRecordedBlob(result.blob, result.duration);
                if (meta) {
                    if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
                    if (typeof showNotification === 'function') showNotification(`✓ 已保存录音（${result.duration}秒）`, 'success');
                    setTimeout(() => _showVoiceTextEditor(meta.id), 250);
                }
            }
        );
        overlay.querySelector('#_vrd_cancel').onclick = () => { stopped = true; stopRecording(); };
        overlay.querySelector('#_vrd_stop').onclick = finish;
    }

    // ══════════════════════════════════════════════════════════════
    // 拦截工具栏按钮（仅语音库 Tab）
    // ══════════════════════════════════════════════════════════════
    document.addEventListener('click', (e) => {
        const onVoice = (typeof currentSubTab !== 'undefined') && currentSubTab === 'voice';
        if (!onVoice) return;
        const addBtn = e.target.closest('#add-custom-reply');
        if (addBtn) { e.stopImmediatePropagation(); e.preventDefault(); openAddMenu(); return; }
        const expBtn = e.target.closest('#tb-export-btn');
        if (expBtn) { e.stopImmediatePropagation(); e.preventDefault(); exportVoiceLibrary(); return; }
        const impBtn = e.target.closest('#tb-import-btn');
        if (impBtn) {
            e.stopImmediatePropagation(); e.preventDefault();
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.zip,application/zip';
            inp.onchange = async () => {
                if (!inp.files || !inp.files[0]) return;
                await importVoiceLibrary(inp.files[0]);
                if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
            };
            inp.click(); return;
        }
    }, true);

    // ══════════════════════════════════════════════════════════════
    // 语音气泡 HTML
    // ══════════════════════════════════════════════════════════════
    function buildVoiceBubbleHTML(msg) {
        const dur = Number(msg.duration) || 0;
        const widthPx = Math.min(220, 70 + dur * 4.5);
        // 查语音库里的文字（默认隐藏，等用户点"文"才显示）
        let transcriptHTML = '';
        try {
            if (typeof settings !== 'undefined' && settings && Array.isArray(settings.voiceLibrary)) {
                const meta = settings.voiceLibrary.find(v => v.id === msg.voiceId);
                if (meta && meta.text) {
                    transcriptHTML = `<div class="voice-transcript" style="display:none;">${_escape(meta.text)}</div>`;
                }
            }
        } catch (e) {}
        return `
            <div class="voice-bubble-wrap" style="display:inline-block;max-width:100%;">
                <div class="voice-bubble" data-voice-id="${msg.voiceId}"
                     style="display:flex;align-items:center;gap:10px;cursor:pointer;min-width:${widthPx}px;padding:2px 0;user-select:none;">
                    <i class="fas fa-wifi" style="transform:rotate(90deg);font-size:16px;opacity:0.8;flex-shrink:0;"></i>
                    <span style="font-size:14px;font-weight:500;letter-spacing:0.5px;">${dur}"</span>
                </div>
                ${transcriptHTML}
            </div>
        `;
    }

    // ══════════════════════════════════════════════════════════════
    // 语音条：单击播放/停止，双击弹功能气泡
    // ══════════════════════════════════════════════════════════════
    let _lastTapTime = 0;

    function _showWrapperActions(wrapper) {
        const actions = wrapper.querySelector('.message-meta-actions');
        if (!actions) return;
        actions.style.setProperty('opacity', '1', 'important');
        actions.style.setProperty('pointer-events', 'auto', 'important');
        actions.style.setProperty('visibility', 'visible', 'important');
        if (getComputedStyle(actions).display === 'none') {
            actions.style.setProperty('display', 'flex', 'important');
        }
        wrapper.classList.add('voice-actions-open');
    }
    function _hideWrapperActions(wrapper) {
        const actions = wrapper.querySelector('.message-meta-actions');
        if (actions) {
            actions.style.removeProperty('opacity');
            actions.style.removeProperty('pointer-events');
            actions.style.removeProperty('visibility');
            actions.style.removeProperty('display');
        }
        wrapper.classList.remove('voice-actions-open');
    }
    function _hideAllVoiceActions() {
        document.querySelectorAll('.message-wrapper.voice-actions-open').forEach(_hideWrapperActions);
    }

    function _handleVoiceClick(e) {
        const bubble = e.target.closest('.voice-bubble');
        if (!bubble) {
            const insideMenu = e.target.closest('.message-meta-actions');
            if (!insideMenu) _hideAllVoiceActions();
            return;
        }
        e.stopPropagation();
        e.preventDefault();

        const now = Date.now();
        const isDouble = (now - _lastTapTime) < 280;

        if (isDouble) {
            _lastTapTime = 0;
            _stopCurrent();
            const wrapper = bubble.closest('.message-wrapper');
            if (wrapper) {
                _hideAllVoiceActions();
                _showWrapperActions(wrapper);
            }
            return;
        }
        _lastTapTime = now;
        const id = bubble.dataset.voiceId;
        if (id) playVoice(id, bubble);
    }

    document.addEventListener('click', _handleVoiceClick, true);
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.voice-bubble')) e.preventDefault();
    }, true);

    // ══════════════════════════════════════════════════════════════
    // 暴露 API
    // ══════════════════════════════════════════════════════════════
    window.VoiceLibrary = {
        playVoice, addVoiceFromFile, saveRecordedBlob,
        startRecording, stopRecording, deleteVoices,
        exportVoiceLibrary, importVoiceLibrary,
        getVoiceBlob, openAddMenu, buildVoiceBubbleHTML,
        editVoiceText: _showVoiceTextEditor,
        toggleTranscript: toggleTranscript
    };
    window._renderVoiceTab = _renderVoiceTab;
    window._openVoiceAddMenu = openAddMenu;

    console.log('✅ voice-library.js 已加载');
})();