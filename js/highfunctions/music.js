(() => {
    'use strict';

    // ==================== 全局变量 ====================
    const APP = typeof APP_PREFIX !== 'undefined' ? APP_PREFIX : '';
    const SONG_KEY = APP + 'customSongs';
    const COVER_KEY = APP + 'playerCover';

    // 默认歌单（第二段代码中的完整列表）
    const DEFAULT_SONGS = [
        { title: "不被祝福的幸福", sub: "爱不是展览 何必给谁看", url: "https://img.heliar.top/file/1773075226440_%E4%B8%8D%E8%A2%AB%E7%A5%9D%E7%A6%8F%E7%9A%84%E5%B9%B8%E7%A6%8F-%E6%9D%A8%E4%B8%9E%E7%90%B3_f7Y4I.mp3" },
    ];

    // 播放器状态
    let songs = [];
    let currentIndex = 0;
    let isPlaying = false;
    let playMode = 'sequence';   // sequence, single, shuffle
    let isSearchVisible = false;
    let searchTerm = '';
    let editModeIndex = -1;
    let isInitialized = false;

    // DOM 元素
    let player, playlist, audio, playBtn, progressArea, miniView, addSongModal;
    let newSongTitle, newSongSub, newSongUrl, confirmAddSongBtn, cancelAddSongBtn, modalTitleElem;
    let uploadCoverBtn, coverInput, vinylRecord;

    // ==================== 辅助函数 ====================
    function $(id) { return document.getElementById(id); }

    function notify(msg, type = 'info') {
        if (typeof showNotification === 'function') showNotification(msg, type);
        else console.log(`[${type}] ${msg}`);
    }

    function showModalEl(el) {
        if (!el) return;
        if (typeof showModal === 'function') showModal(el);
        else el.classList.add('active');
    }

    function hideModalEl(el) {
        if (!el) return;
        if (typeof hideModal === 'function') hideModal(el);
        else el.classList.remove('active');
    }

    function escapeHTML(str) {
        return String(str ?? '').replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c;
        });
    }

    // ==================== 歌单存储 ====================
    function saveSongs() {
        localforage.setItem(SONG_KEY, songs).catch(err => {
            console.error('歌单保存失败', err);
            notify('歌单保存失败', 'error');
        });
    }

    async function loadSongs() {
        try {
            const saved = await localforage.getItem(SONG_KEY);
            if (Array.isArray(saved) && saved.length) {
                songs = saved;
            } else {
                songs = [...DEFAULT_SONGS];
            }
        } catch (e) {
            console.error('加载歌单失败', e);
            songs = [...DEFAULT_SONGS];
        }
    }

    // ==================== 播放器核心 ====================
    function updatePlayIcons() {
        const iconPlay = $('icon-play');
        const iconPause = $('icon-pause');
        if (iconPlay) iconPlay.style.display = isPlaying ? 'none' : 'block';
        if (iconPause) iconPause.style.display = isPlaying ? 'block' : 'none';
    }

    function updateModeIcons() {
        const iconLoop = $('icon-loop');
        const iconSingle = $('icon-single');
        const iconShuffle = $('icon-shuffle');
        if (iconLoop) iconLoop.style.display = playMode === 'sequence' ? 'block' : 'none';
        if (iconSingle) iconSingle.style.display = playMode === 'single' ? 'block' : 'none';
        if (iconShuffle) iconShuffle.style.display = playMode === 'shuffle' ? 'block' : 'none';
    }

    function loadSong(index, autoplay = false) {
        if (!songs.length || !audio) return;
        if (index < 0) index = 0;
        if (index >= songs.length) index = songs.length - 1;
        currentIndex = index;
        const song = songs[currentIndex];
        if (!song) return;

        audio.src = song.url || '';
        audio.load();

        const titleEl = $('music-title');
        const subEl = $('music-subtitle');
        if (titleEl) titleEl.textContent = song.title || '未命名歌曲';
        if (subEl) subEl.textContent = song.sub || '未知艺术家';

        renderPlaylist(); // 刷新高亮

        if (autoplay) {
            const p = audio.play();
            if (p !== undefined) {
                p.then(() => {
                    isPlaying = true;
                    updatePlayIcons();
                    player?.classList.add('playing');
                }).catch(err => {
                    console.error(err);
                    notify('播放失败，请检查链接是否有效', 'error');
                });
            }
        }
    }

    function togglePlay() {
        if (!songs.length) {
            notify('播放列表为空', 'warning');
            return;
        }
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            updatePlayIcons();
            player?.classList.remove('playing');
        } else {
            const p = audio.play();
            if (p !== undefined) {
                p.then(() => {
                    isPlaying = true;
                    updatePlayIcons();
                    player?.classList.add('playing');
                }).catch(err => {
                    console.error(err);
                    notify('播放失败，请检查链接是否有效', 'error');
                });
            }
        }
    }

    function nextSong() {
        if (!songs.length) return;
        if (playMode === 'single') {
            loadSong(currentIndex, true);
            return;
        }
        if (playMode === 'shuffle') {
            currentIndex = Math.floor(Math.random() * songs.length);
        } else {
            currentIndex = (currentIndex + 1) % songs.length;
        }
        loadSong(currentIndex, isPlaying);
    }

    function prevSong() {
        if (!songs.length) return;
        currentIndex = (currentIndex - 1 + songs.length) % songs.length;
        loadSong(currentIndex, isPlaying);
    }

    function cyclePlayMode() {
        if (playMode === 'sequence') playMode = 'single';
        else if (playMode === 'single') playMode = 'shuffle';
        else playMode = 'sequence';
        updateModeIcons();
        const labels = { sequence: '顺序播放', single: '单曲循环', shuffle: '随机播放' };
        notify(labels[playMode], 'info');
    }

    // ==================== 渲染歌单（完整版） ====================
    function renderPlaylist() {
        if (!playlist) return;
        playlist.innerHTML = '';

        // 头部
        const header = document.createElement('div');
        header.className = 'playlist-header';
        header.innerHTML = `
            <div class="pl-header-title">˙°ʚᕱ⑅ᕱɞ°˙</div>
            <div class="pl-header-actions">
                <button class="pl-icon-btn" id="pl-manage-btn" title="歌单管理"><i class="fas fa-folder-open"></i></button>
                <button class="pl-icon-btn ${isSearchVisible ? 'active' : ''}" id="pl-search-toggle" title="搜索"><i class="fas fa-search"></i></button>
                <button class="pl-icon-btn" id="pl-add-btn" title="添加歌曲"><i class="fas fa-plus"></i></button>
            </div>
            <input type="file" id="pl-import-input" accept=".json" style="display:none">
        `;
        playlist.appendChild(header);

        // 搜索框
        const searchWrapper = document.createElement('div');
        searchWrapper.className = `playlist-search-wrapper ${isSearchVisible ? 'active' : ''}`;
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'playlist-search-input';
        searchInput.placeholder = '搜索歌曲或歌手...';
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            renderListContent(contentDiv);
        });
        searchWrapper.appendChild(searchInput);
        playlist.appendChild(searchWrapper);

        // 内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'playlist-content';
        playlist.appendChild(contentDiv);

        // 渲染列表
        function renderListContent(container) {
            container.innerHTML = '';
            const filtered = songs.map((s, idx) => ({ ...s, originalIndex: idx }))
                .filter(s => s.title.toLowerCase().includes(searchTerm) || s.sub.toLowerCase().includes(searchTerm));

            if (filtered.length === 0) {
                container.innerHTML = `<div class="empty-search-result">${searchTerm ? '未找到相关歌曲' : '歌单为空'}</div>`;
                return;
            }

            filtered.forEach(song => {
                const realIndex = song.originalIndex;
                const row = document.createElement('div');
                row.className = `playlist-item ${realIndex === currentIndex ? 'playing' : ''}`;

                const highlight = (text, term) => {
                    if (!term) return escapeHTML(text);
                    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    return escapeHTML(text).replace(regex, '<span class="highlight">$1</span>');
                };

                row.innerHTML = `
                    <div class="song-info">
                        <div class="song-title-row">${highlight(song.title, searchTerm)}</div>
                        <div class="song-sub-row">${highlight(song.sub, searchTerm)}</div>
                    </div>
                    <div class="item-actions">
                        ${song.isCustom ? '<span class="custom-tag" title="编辑自定义歌曲"> </span>' : ''}
                        <span class="action-icon-btn delete" title="删除">×</span>
                    </div>
                `;

                // 编辑自定义歌曲
                const editTag = row.querySelector('.custom-tag');
                if (editTag) {
                    editTag.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openEditModal(realIndex);
                    });
                }

                // 删除
                row.querySelector('.delete').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`确定移除《${song.title}》吗？`)) {
                        songs.splice(realIndex, 1);
                        saveSongs();
                        if (songs.length === 0) {
                            currentIndex = 0;
                            isPlaying = false;
                            audio.pause();
                            updatePlayIcons();
                            renderPlaylist();
                        } else {
                            if (realIndex === currentIndex) {
                                currentIndex = Math.min(realIndex, songs.length - 1);
                                loadSong(currentIndex, isPlaying);
                            } else if (realIndex < currentIndex) {
                                currentIndex--;
                                renderPlaylist();
                            } else {
                                renderPlaylist();
                            }
                        }
                    }
                });

                row.addEventListener('click', () => {
                    currentIndex = realIndex;
                    loadSong(currentIndex, false);
                    if (!isPlaying) togglePlay();
                    else audio.play().catch(() => {});
                });

                container.appendChild(row);
            });
        }

        renderListContent(contentDiv);

        // 绑定头部按钮事件
        const manageBtn = header.querySelector('#pl-manage-btn');
        const searchToggle = header.querySelector('#pl-search-toggle');
        const addBtn = header.querySelector('#pl-add-btn');
        const importInput = header.querySelector('#pl-import-input');

        if (manageBtn) {
            manageBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 歌单管理弹窗
                const overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;';
                overlay.innerHTML = `
                    <div style="background:var(--secondary-bg);border-radius:16px;padding:20px;width:280px;box-shadow:0 10px 40px rgba(0,0,0,0.3);border:1px solid var(--border-color);">
                        <div style="text-align:center;font-weight:600;margin-bottom:15px;">歌单管理</div>
                        <button id="_pl_opt_import" style="width:100%;padding:10px;margin-bottom:10px;border-radius:8px;border:1px solid var(--border-color);background:var(--primary-bg);cursor:pointer;">📂 导入歌单</button>
                        <button id="_pl_opt_export" style="width:100%;padding:10px;margin-bottom:10px;border-radius:8px;border:1px solid var(--border-color);background:var(--primary-bg);cursor:pointer;">💾 导出歌单</button>
                        <button id="_pl_opt_cancel" style="width:100%;padding:8px;border:none;background:transparent;cursor:pointer;">取消</button>
                    </div>
                `;
                document.body.appendChild(overlay);
                const closeOverlay = () => overlay.remove();
                overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeOverlay(); });
                overlay.querySelector('#_pl_opt_cancel').onclick = closeOverlay;
                overlay.querySelector('#_pl_opt_export').onclick = () => {
                    closeOverlay();
                    if (!songs.length) { notify('歌单为空，无法导出', 'warning'); return; }
                    const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `music-playlist-${new Date().toISOString().slice(0,10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    notify('歌单导出成功', 'success');
                };
                overlay.querySelector('#_pl_opt_import').onclick = () => {
                    closeOverlay();
                    importInput.click();
                };
            });
        }

        if (searchToggle) {
            searchToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                isSearchVisible = !isSearchVisible;
                searchWrapper.classList.toggle('active', isSearchVisible);
                searchToggle.classList.toggle('active', isSearchVisible);
                if (isSearchVisible) setTimeout(() => searchInput.focus(), 100);
            });
        }

        if (addBtn) addBtn.addEventListener('click', () => openAddModal());
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const imported = JSON.parse(ev.target.result);
                        if (!Array.isArray(imported)) throw new Error();
                        if (confirm(`检测到 ${imported.length} 首歌曲。\n确定 → 覆盖当前歌单\n取消 → 追加到末尾`)) {
                            songs = imported;
                            notify('歌单已覆盖', 'success');
                        } else {
                            songs = songs.concat(imported);
                            notify(`已追加 ${imported.length} 首歌曲`, 'success');
                        }
                        saveSongs();
                        if (songs.length > 0 && currentIndex >= songs.length) currentIndex = 0;
                        loadSong(currentIndex, isPlaying);
                        renderPlaylist();
                    } catch (err) {
                        notify('导入失败：文件格式不正确', 'error');
                    }
                };
                reader.readAsText(file);
                e.target.value = '';
            });
        }
    }

    // ==================== 添加/编辑歌曲模态框 ====================
    function openAddModal() {
        editModeIndex = -1;
        if (modalTitleElem) modalTitleElem.textContent = '添加自定义歌曲';
        if (confirmAddSongBtn) confirmAddSongBtn.textContent = '添加播放';
        if (newSongTitle) newSongTitle.value = '';
        if (newSongSub) newSongSub.value = '';
        if (newSongUrl) newSongUrl.value = '';
        showModalEl(addSongModal);
        setTimeout(() => newSongTitle?.focus(), 50);
    }

    function openEditModal(index) {
        const song = songs[index];
        if (!song) return;
        editModeIndex = index;
        if (modalTitleElem) modalTitleElem.textContent = '编辑歌曲信息';
        if (confirmAddSongBtn) confirmAddSongBtn.textContent = '保存修改';
        if (newSongTitle) newSongTitle.value = song.title || '';
        if (newSongSub) newSongSub.value = song.sub || '';
        if (newSongUrl) newSongUrl.value = song.url || '';
        showModalEl(addSongModal);
    }

    function closeAddModal() {
        hideModalEl(addSongModal);
    }

    function confirmAddOrEdit() {
        const title = (newSongTitle?.value || '').trim();
        const sub = (newSongSub?.value || '').trim();
        const url = (newSongUrl?.value || '').trim();
        if (!title || !url) {
            notify('歌名和链接不能为空', 'error');
            return;
        }
        const data = { title, sub: sub || '未知艺术家', url, isCustom: true };
        if (editModeIndex >= 0) {
            songs[editModeIndex] = data;
            notify('歌曲信息已修改', 'success');
        } else {
            songs.unshift(data);
            notify('歌曲已添加', 'success');
            if (songs.length === 1) loadSong(0, false);
        }
        saveSongs();
        closeAddModal();
        renderPlaylist();
    }

    // ==================== 封面设置 ====================
    function bindCoverEvents() {
        uploadCoverBtn = $('upload-cover-btn');
        coverInput = $('cover-input');
        vinylRecord = $('vinyl-record-visual');
        if (!uploadCoverBtn || !coverInput || !vinylRecord) return;

        const applyCover = (base64Data) => {
            if (base64Data) {
                vinylRecord.style.backgroundImage = `url(${base64Data})`;
                vinylRecord.style.backgroundSize = 'cover';
                vinylRecord.style.backgroundPosition = 'center';
                vinylRecord.style.backgroundColor = 'transparent';
                vinylRecord.classList.add('has-cover');
                vinylRecord.style.borderWidth = '1px';
            } else {
                vinylRecord.style.backgroundImage = '';
                vinylRecord.style.backgroundColor = '';
                vinylRecord.classList.remove('has-cover');
                vinylRecord.style.borderWidth = '2px';
            }
        };

        localforage.getItem(COVER_KEY).then(cover => { if (cover) applyCover(cover); });

        uploadCoverBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (vinylRecord.classList.contains('has-cover')) {
                if (confirm('想要重置回默认的【主题色黑胶】样式吗？\n\n• 点击【确定】恢复默认\n• 点击【取消】选择新图片')) {
                    localforage.removeItem(COVER_KEY);
                    applyCover(null);
                    notify('已恢复默认黑胶样式', 'success');
                    return;
                }
            }
            coverInput.click();
        });

        coverInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                notify('图片太大了，请上传 2MB 以内的图片', 'error');
                return;
            }
            if (typeof cropImageToSquare !== 'function') {
                notify('图片处理函数未找到', 'error');
                return;
            }
            cropImageToSquare(file, 200).then(base64Data => {
                localforage.setItem(COVER_KEY, base64Data);
                applyCover(base64Data);
                notify('专辑封面设置成功！', 'success');
            }).catch(() => notify('图片处理失败，请重试', 'error'));
            e.target.value = '';
        });
    }

    // ==================== 拖拽移动 ====================
    function setupDrag() {
        if (!player) return;
        const handle = player.querySelector('.player-header') || player;
        let dragging = false, startX, startY, originLeft, originTop, moved = false;

        const onMouseDown = (e) => {
            if (e.target.closest('button, input, textarea, a')) return;
            const ev = e.type.startsWith('touch') ? e.touches[0] : e;
            dragging = true;
            moved = false;
            startX = ev.clientX;
            startY = ev.clientY;
            const rect = player.getBoundingClientRect();
            originLeft = rect.left;
            originTop = rect.top;
            player.style.transition = 'none';
            playlist.style.transition = 'none';
        };
        const onMouseMove = (e) => {
            if (!dragging) return;
            const ev = e.type.startsWith('touch') ? e.touches[0] : e;
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
            let newLeft = originLeft + dx;
            let newTop = originTop + dy;
            const maxLeft = window.innerWidth - player.offsetWidth;
            const maxTop = window.innerHeight - player.offsetHeight;
            player.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
            player.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
            const rect = player.getBoundingClientRect();
            playlist.style.left = rect.left + 'px';
            playlist.style.top = (rect.top + (player.classList.contains('collapsed') ? 65 : 155)) + 'px';
        };
        const onMouseUp = () => {
            dragging = false;
            player.style.transition = '';
            playlist.style.transition = '';
        };
        handle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        handle.addEventListener('touchstart', onMouseDown, { passive: false });
        document.addEventListener('touchmove', onMouseMove, { passive: false });
        document.addEventListener('touchend', onMouseUp);

        if (miniView) {
            miniView.addEventListener('click', () => {
                if (!moved && player.classList.contains('collapsed')) {
                    player.classList.remove('collapsed');
                    setTimeout(() => {
                        const rect = player.getBoundingClientRect();
                        playlist.style.top = (rect.top + 150) + 'px';
                    }, 300);
                }
            });
        }
    }

    // ==================== 主事件绑定 ====================
    function bindMainEvents() {
        // 播放/暂停
        if (playBtn) playBtn.addEventListener('click', togglePlay);
        const nextBtn = $('next-btn');
        if (nextBtn) nextBtn.addEventListener('click', nextSong);
        const prevBtn = $('prev-btn');
        if (prevBtn) prevBtn.addEventListener('click', prevSong);
        const minimizeBtn = $('minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                player?.classList.add('collapsed');
                playlist?.classList.remove('active');
            });
        }
        const listBtn = $('list-btn');
        if (listBtn) {
            listBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!player || !playlist) return;
                const rect = player.getBoundingClientRect();
                playlist.style.left = rect.left + 'px';
                playlist.style.top = (rect.top + (player.classList.contains('collapsed') ? 62 : 150)) + 'px';
                playlist.classList.toggle('active');
            });
        }
        const modeBtn = $('mode-btn');
        if (modeBtn) modeBtn.addEventListener('click', cyclePlayMode);

        // 进度条
        if (progressArea && audio) {
            progressArea.addEventListener('click', (e) => {
                if (!audio.duration) return;
                const width = progressArea.clientWidth;
                audio.currentTime = (e.offsetX / width) * audio.duration;
            });
        }

        // 音频事件
        if (audio) {
            audio.addEventListener('timeupdate', () => {
                const progressBar = $('progress-bar');
                if (progressBar && audio.duration) {
                    progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
                }
            });
            audio.addEventListener('ended', () => {
                if (playMode === 'single') loadSong(currentIndex, true);
                else nextSong();
            });
        }

        // 点击外部关闭歌单
        document.addEventListener('click', (e) => {
            const listBtnEl = $('list-btn');
            if (!playlist || !player || !listBtnEl) return;
            if (!playlist.contains(e.target) && !listBtnEl.contains(e.target) && !player.contains(e.target) && !e.target.closest('#add-song-modal')) {
                playlist.classList.remove('active');
            }
        });
    }

    function bindModalEvents() {
        if (confirmAddSongBtn) confirmAddSongBtn.addEventListener('click', confirmAddOrEdit);
        if (cancelAddSongBtn) cancelAddSongBtn.addEventListener('click', closeAddModal);
        if (addSongModal) {
            addSongModal.addEventListener('click', (e) => {
                if (e.target === addSongModal) closeAddModal();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && addSongModal?.classList.contains('active')) {
                closeAddModal();
            }
        });
    }

    // ==================== 初始化 ====================
    async function initMusicPlayer() {
        if (isInitialized) return;
        isInitialized = true;

        player = $('player');
        playlist = $('playlist');
        audio = $('audio');
        playBtn = $('play-btn');
        progressArea = $('progress-area');
        miniView = $('mini-view');
        addSongModal = $('add-song-modal');

        newSongTitle = $('new-song-title');
        newSongSub = $('new-song-sub');
        newSongUrl = $('new-song-url');
        confirmAddSongBtn = $('confirm-add-song');
        cancelAddSongBtn = $('cancel-add-song');
        modalTitleElem = addSongModal ? addSongModal.querySelector('.modal-title span') : null;

        if (!player || !playlist || !audio) {
            console.warn('音乐播放器 DOM 未找到');
            return;
        }

        await loadSongs();

        bindMainEvents();
        bindModalEvents();
        bindCoverEvents();
        setupDrag();

        if (songs.length > 0) {
            loadSong(0, false);
        } else {
            renderPlaylist();
        }

        // 根据全局设置显示/隐藏播放器（不改变设置本身）
        if (typeof settings !== 'undefined' && settings.musicPlayerEnabled) {
            player.classList.add('visible');
        } else {
            player.classList.remove('visible');
        }

        updatePlayIcons();
        updateModeIcons();
        renderPlaylist();
    }

    // ==================== 开关按钮逻辑（参照第一段代码） ====================
    // 监听入口按钮，点击时仅打开播放器并初始化，不修改 settings.musicPlayerEnabled
   function bindEntryButton() {
       const entryBtn = $('music-player-toggle');
       if (entryBtn) {
           entryBtn.addEventListener('click', async () => {
               if (!player) return;

               // 获取当前播放器可见状态
               const isVisible = player.classList.contains('visible');

               if (isVisible) {
                   // 关闭播放器
                   player.classList.remove('visible');
                   // 关闭歌单弹窗
                   if (playlist) playlist.classList.remove('active');
                   // 暂停音乐
                   if (audio && !audio.paused) {
                       audio.pause();
                       if (typeof isPlaying !== 'undefined') {
                           isPlaying = false;
                           updatePlayIcons();
                           player?.classList.remove('playing');
                       }
                   }
                   // 更新设置状态（如果存在）
                   if (typeof settings !== 'undefined') {
                       settings.musicPlayerEnabled = false;
                       if (typeof throttledSaveData === 'function') throttledSaveData();
                   }
                   // 可选：显示通知
                   notify('音乐播放器已关闭', 'info');
               } else {
                   // 打开播放器
                   player.classList.add('visible');
                   if (!isInitialized) {
                       await initMusicPlayer();
                   }
                   // 更新设置状态
                   if (typeof settings !== 'undefined') {
                       settings.musicPlayerEnabled = true;
                       if (typeof throttledSaveData === 'function') throttledSaveData();
                   }
                   // 关闭高级模态框（如果存在）
                   if (typeof DOMElements !== 'undefined' && DOMElements?.advancedModal?.modal) {
                       if (typeof hideModal === 'function') hideModal(DOMElements.advancedModal.modal);
                   }
                   notify('音乐播放器已开启', 'success');
               }
           });
       }

       // 备用入口同样处理
       const altEntryBtn = $('music-player-entry');
       if (altEntryBtn) {
           altEntryBtn.addEventListener('click', async () => {
               if (!player) return;
               const isVisible = player.classList.contains('visible');
               if (isVisible) {
                   player.classList.remove('visible');
                   if (playlist) playlist.classList.remove('active');
                   if (audio && !audio.paused) {
                       audio.pause();
                       if (typeof isPlaying !== 'undefined') {
                           isPlaying = false;
                           updatePlayIcons();
                           player?.classList.remove('playing');
                       }
                   }
                   if (typeof settings !== 'undefined') {
                       settings.musicPlayerEnabled = false;
                       if (typeof throttledSaveData === 'function') throttledSaveData();
                   }
                   notify('音乐播放器已关闭', 'info');
               } else {
                   player.classList.add('visible');
                   if (!isInitialized) await initMusicPlayer();
                   if (typeof settings !== 'undefined') {
                       settings.musicPlayerEnabled = true;
                       if (typeof throttledSaveData === 'function') throttledSaveData();
                   }
                   notify('音乐播放器已开启', 'success');
               }
           });
       }
   }

    // 暴露全局接口
    window.initMusicPlayer = initMusicPlayer;
    window.musicPlayer = {
        init: initMusicPlayer,
        loadSong,
        togglePlay,
        nextSong,
        prevSong,
        renderPlaylist
    };

    // 启动：先绑定入口按钮，等 DOM 加载完成后尝试自动初始化（若已启用则初始化）
    document.addEventListener('DOMContentLoaded', () => {
        bindEntryButton();
        // 如果 settings.musicPlayerEnabled 为 true，自动初始化并显示
        if (typeof settings !== 'undefined' && settings.musicPlayerEnabled) {
            initMusicPlayer();
        }
    });
})();