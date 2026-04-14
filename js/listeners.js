function setupEventListeners() {
    try {
        initCoreListeners();
        initModalListeners();
        initChatActionListeners();
        initHeaderAndSettingsListeners();
        initDataManagementListeners();
        //initNewFeatureListeners();
        //setupTutorialListeners();
        initMoodListeners();
        initDecisionModule();
        initAnniversaryModule();
        initThemeEditor();
        initThemeSchemes();
        initComboMenu();
        initPeriodListeners();
        initWishingPool();
        initScreenshotFunction();
        //initHomeShortcuts();
    } catch (e) {
        console.error("事件绑定过程中发生错误:", e);
    }
}

function initChatActionListeners() {
    DOMElements.chatContainer.addEventListener('click', (e) => {

        if (isBatchFavoriteMode) {
            const wrapper = e.target.closest('.message-wrapper');
            if (wrapper && !e.target.closest('.message-meta-actions')) {
                const messageId = Number(wrapper.dataset.id);
                const index = selectedMessages.indexOf(messageId);

                if (index > -1) {
                    selectedMessages.splice(index, 1);
                    wrapper.classList.remove('selected');
                } else {
                    selectedMessages.push(messageId);
                    wrapper.classList.add('selected');
                }

                const confirmBtn = document.getElementById('confirm-batch-favorite');
                if (confirmBtn) {
                    confirmBtn.textContent = `确认收藏 (${selectedMessages.length})`;
                }
                return;
            }
        }

                const favoriteBtn = e.target.closest('.favorite-action-btn');
                if (favoriteBtn) {
                    const wrapper = e.target.closest('.message-wrapper');
                    const messageId = Number(wrapper.dataset.id);
                    const message = messages.find(m => m.id === messageId);

                    if (message) {
                        message.favorited = !message.favorited;

                        showNotification(message.favorited ? '已收藏': '已取消收藏', 'success', 1500);
                        playSound('favorite');

                        throttledSaveData();

                        renderMessages(true);
                    }
                    return;
                }

                const target = e.target.closest('.meta-action-btn');
                if (!target) return;

                const wrapper = e.target.closest('.message-wrapper');
                if (!wrapper) return;

                const messageId = Number(wrapper.dataset.id);
                const message = messages.find(m => m.id === messageId);
                if (!message) return;

if (target.classList.contains('delete-btn')) {
    if (confirm('确定要删除这条消息吗？')) {
        const index = messages.findIndex(m => m.id === messageId);
        if (index > -1) {
            const savedScrollTop = DOMElements.chatContainer.scrollTop;
            messages.splice(index, 1);
            throttledSaveData();
            renderMessages(true);
            requestAnimationFrame(() => {
                DOMElements.chatContainer.scrollTop = savedScrollTop;
            });
            showNotification('消息已删除', 'success');
        }
    }
    return;
}
 if (target.classList.contains('edit-btn')) {
            const wrapper = e.target.closest('.message-wrapper');
            const messageId = Number(wrapper.dataset.id);
            const message = messages.find(m => m.id === messageId);

            if (!message) return;

            // 修正：使用 DOMElements.editModal
            if (DOMElements.editModal && DOMElements.editModal.modal) {
                showModal(DOMElements.editModal.modal, DOMElements.editModal.input);
                DOMElements.editModal.title.textContent = '编辑消息内容';
                DOMElements.editModal.input.value = message.text || '';
                DOMElements.editModal.save.disabled = false;

                // 重新绑定保存按钮的事件
                DOMElements.editModal.save.onclick = () => {
                    const newText = DOMElements.editModal.input.value.trim();

                    if (!newText && !message.image) {
                        showNotification('消息内容不能为空', 'error');
                        return;
                    }

                    message.text = newText; // 更新内存中的消息
                    throttledSaveData();     // 保存数据
                    renderMessages(true);    // 刷新界面
                    hideModal(DOMElements.editModal.modal); // 关闭弹窗
                    showNotification('消息已修改', 'success');
                };
            }
            return;
        }
                if (target.classList.contains('reply-btn')) {
                    currentReplyTo = {
                        id: message.id,
                        sender: message.sender,
                        text: message.text
                    };
                    updateReplyPreview();
                    DOMElements.messageInput.focus();
                    const targetMessageElement = DOMElements.chatContainer.querySelector(`[data-id="${message.id}"]`);
                    if (targetMessageElement) targetMessageElement.scrollIntoView({
                        behavior: 'smooth', block: 'center'
                    });
                    return;
                }
                throttledSaveData();
            });


  // 新的发送逻辑：先打断，再发送
    DOMElements.sendBtn.addEventListener('click', () => {
        /*if (typeof window.cancelPartnerReply === 'function') {
           // window.cancelPartnerReply();
        }*/

        const text = DOMElements.messageInput.value.trim();
        //const imageFile = DOMElements.imageInput.files[0];
        const imageFile = DOMElements.imageInput?.files?.[0] || null;
        if (text || imageFile) {
            sendMessage();
        }
    });
// ========== 继续回复弹出按钮组逻辑 ==========
    const continueBtn = document.getElementById('continue-btn');
    const continueSubBtns = document.getElementById('continue-sub-btns');
    const continueReplyBtn = document.getElementById('continue-reply-btn');
    const shutUpBtn = document.getElementById('shutUpBtn');

    // 点击大按钮：切换弹出菜单
    if (continueBtn) {
        continueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = continueSubBtns.classList.contains('active');
            // 先关闭页面上所有其他弹出层（避免叠加）
            document.querySelectorAll('.continue-sub-btns.active').forEach(el => {
                if (el !== continueSubBtns) el.classList.remove('active');
            });
            if (isActive) {
                continueSubBtns.classList.remove('active');
            } else {
                continueSubBtns.classList.add('active');
            }
        });
    }

    // 子按钮：继续回复
    if (continueReplyBtn) {
        continueReplyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            continueSubBtns.classList.remove('active');
            simulateReply();
        });
    }

    // 子按钮：打断对方回复
    if (shutUpBtn) {
        shutUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            continueSubBtns.classList.remove('active');
            if (typeof window.cancelPartnerReply === 'function') {
                window.cancelPartnerReply();
                showNotification('已打断对方回复', 'success', 1500);
            }
        });
    }

    // 点击页面其他任意位置，自动收起弹出菜单
    document.addEventListener('click', (e) => {
        if (continueSubBtns && !continueSubBtns.contains(e.target)) {
            continueSubBtns.classList.remove('active');
        }
    });
}

        function initModalListeners() {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                const cancelBtns = modal.querySelectorAll('.modal-buttons .modal-btn-secondary');
                cancelBtns.forEach(cancelBtn => {
                    if (!cancelBtn.getAttribute('onclick') && !cancelBtn.dataset.noAutoClose) {
                        cancelBtn.addEventListener('click', () => hideModal(modal));
                    }
                });
            });

            const closeChatBtn = document.getElementById('close-chat');
            if (closeChatBtn) {
                closeChatBtn.addEventListener('click', () => {
                    hideModal(DOMElements.chatModal.modal);
                });
            }

            const closeDataBtn = document.getElementById('close-data');
            if (closeDataBtn) {
                closeDataBtn.addEventListener('click', () => {
                    hideModal(DOMElements.dataModal.modal);
                });
            }

            DOMElements.editModal.input.addEventListener('input', () => {
                DOMElements.editModal.save.disabled = !DOMElements.editModal.input.value.trim();
            });
            DOMElements.pokeModal.save.addEventListener('click', () => {
                let pokeText = DOMElements.pokeModal.input.value.trim() || `${settings.myName} 拍了拍 ${settings.partnerName}`;
                if (typeof window._sanitizePokeTextForDisplay === 'function') {
                    pokeText = window._sanitizePokeTextForDisplay(pokeText);
                }
                const pokeSaveChecked = document.getElementById('poke-save-to-library');
                const shouldSaveToLibrary = pokeSaveChecked ? !!pokeSaveChecked.checked : false;
                addMessage({
                    id: Date.now(), text: _formatPokeText(pokeText), timestamp: new Date(), type: 'system'
                });
                if (typeof playSound === 'function') playSound('poke');

                if (shouldSaveToLibrary) {
                    try {
                        if (!Array.isArray(customPokes)) customPokes = [];
                        const exists = customPokes.some(r => String(r) === String(pokeText));
                        if (!exists) {
                            customPokes.unshift(pokeText);
                            if (typeof throttledSaveData === 'function') throttledSaveData();
                            if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
                        }
                    } catch (e) {
                        console.warn('拍一拍保存到库失败:', e);
                    }
                }
                hideModal(DOMElements.pokeModal.modal);
                DOMElements.pokeModal.input.value = '';
                const delayRange = settings.replyDelayMax - settings.replyDelayMin;
                const randomDelay = settings.replyDelayMin + Math.random() * delayRange;
                setTimeout(simulateReply, randomDelay);
            });


            DOMElements.cancelCoinResult.addEventListener('click', () => {
                DOMElements.coinTossOverlay.classList.remove('visible', 'finished');
                lastCoinResult = null;
            });


            DOMElements.sendCoinResult.addEventListener('click', () => {
                if (lastCoinResult) {
                    sendMessage(`🎲 抛硬币结果：${lastCoinResult}`, 'normal');
                    DOMElements.coinTossOverlay.classList.remove('visible', 'finished');
                    lastCoinResult = null;
                }
            });


            const retryBtn = document.getElementById('retry-coin-toss');

            if (retryBtn) {
                retryBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    startCoinFlipAnimation();
                });
            }
        }


        function initHeaderAndSettingsListeners() {

            const openNameModal = (isPartner) => {
                const modal = DOMElements.editModal;
                showModal(modal.modal, modal.input);
                modal.title.textContent = `修改${isPartner ? (settings.partnerName || '对方'): '我'}的昵称`;
                modal.input.value = isPartner ? settings.partnerName: settings.myName;
                modal.save.disabled = !modal.input.value.trim();
                modal.save.onclick = () => {
                    const newName = modal.input.value.trim();
                    if (newName) {
                        isPartner ? settings.partnerName = newName: settings.myName = newName;
                        throttledSaveData();
                        updateUI();
                        showNotification('昵称已更新', 'success');
                    }
                    hideModal(modal.modal);
                };
            };

            const openAvatarModal = (isPartner) => {
                const modal = DOMElements.avatarModal;

                modal.modal.querySelector('.modal-content').innerHTML = `
            <div class="modal-title"><i class="fas fa-portrait"></i><span>上传${isPartner ? '对方': '我'}的头像</span></div>
            <div style="margin-bottom: 16px;">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button class="modal-btn modal-btn-secondary" id="upload-file-btn" style="flex: 1;">选择文件</button>
            <button class="modal-btn modal-btn-secondary" id="paste-url-btn" style="flex: 1;">粘贴URL</button>
            </div>
            <input type="file" class="modal-input" id="avatar-file-input" accept="image/*" style="display: none;">
            <input type="text" class="modal-input" id="avatar-url-input" placeholder="输入图片URL地址" style="display: none;">
            <div id="avatar-preview" style="text-align: center; margin-top: 10px; display: none;">
            <img id="preview-image" style="max-width: 100px; max-height: 100px; border-radius: 50%; border: 2px solid var(--border-color);">
            </div>
            </div>
            <div class="modal-buttons">
            <button class="modal-btn modal-btn-secondary" id="cancel-avatar">取消</button>
            <button class="modal-btn modal-btn-primary" id="save-avatar" disabled>保存</button>
            </div>
            `;

                showModal(modal.modal);

                const fileInput = document.getElementById('avatar-file-input');
                const urlInput = document.getElementById('avatar-url-input');
                const uploadBtn = document.getElementById('upload-file-btn');
                const pasteUrlBtn = document.getElementById('paste-url-btn');
                const previewDiv = document.getElementById('avatar-preview');
                const previewImg = document.getElementById('preview-image');
                const saveBtn = document.getElementById('save-avatar');
                const cancelBtn = document.getElementById('cancel-avatar');

                let currentAvatarData = null;


                uploadBtn.addEventListener('click', () => {
                    fileInput.click();
                    urlInput.style.display = 'none';
                    uploadBtn.classList.add('active');
                    pasteUrlBtn.classList.remove('active');
                });


                pasteUrlBtn.addEventListener('click', () => {
                    urlInput.style.display = 'block';
                    fileInput.style.display = 'none';
                    pasteUrlBtn.classList.add('active');
                    uploadBtn.classList.remove('active');
                    urlInput.focus();
                });


fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > MAX_AVATAR_SIZE) {
            showNotification('头像图片不能超过2MB', 'error');
            return;
        }

        showNotification('正在裁剪处理...', 'info', 1000);

        cropImageToSquare(file, 300).then(base64Data => {
            currentAvatarData = base64Data;
            previewImg.src = currentAvatarData;
            previewDiv.style.display = 'block';
            saveBtn.disabled = false;
        }).catch(err => {
            console.error(err);
            showNotification('图片处理失败', 'error');
        });
    }
});


                urlInput.addEventListener('input',
                    function() {
                        const url = urlInput.value.trim();
                        if (url) {

                            if (/^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))$/i.test(url)) {
                                previewImg.src = url;
                                previewDiv.style.display = 'block';
                                currentAvatarData = url;
                                saveBtn.disabled = false;


                                const img = new Image();
                                img.onload = function() {

                                    previewImg.src = url;
                                };
                                img.onerror = function() {
                                    showNotification('图片URL无效或无法访问', 'error');
                                    saveBtn.disabled = true;
                                };
                                img.src = url;
                            } else {
                                saveBtn.disabled = true;
                            }
                        } else {
                            saveBtn.disabled = true;
                            previewDiv.style.display = 'none';
                        }
                    });


                saveBtn.addEventListener('click',
                    () => {
                        if (currentAvatarData) {
                            updateAvatar(isPartner ? DOMElements.partner.avatar: DOMElements.me.avatar, currentAvatarData);
                            throttledSaveData();
                            showNotification('头像已更新', 'success');
                            hideModal(modal.modal);
                        }
                    });


                cancelBtn.addEventListener('click',
                    () => {
                        hideModal(modal.modal);
                    });
            };

            DOMElements.partner.name.addEventListener('click', () => openNameModal(true));
            DOMElements.me.name.addEventListener('click', () => openNameModal(false));
            DOMElements.partner.avatar.addEventListener('click', () => openAvatarModal(true));
            DOMElements.me.avatar.addEventListener('click', () => openAvatarModal(false));

            DOMElements.me.statusContainer.addEventListener('click', () => {
                const statusTextElement = DOMElements.me.statusText; const statusContainer = DOMElements.me.statusContainer;
                if (statusContainer.querySelector('input')) return;
                const input = document.createElement('input'); input.type = 'text'; input.id = 'my-status-input'; input.value = statusTextElement.textContent;
                const saveStatus = () => {
                    const newStatus = input.value.trim();
                    if (newStatus) {
                        settings.myStatus = newStatus; showNotification('状态已更新', 'success');
                    } else {
                        settings.myStatus = "在线";
                    }
                    statusTextElement.textContent = settings.myStatus;
                    statusContainer.innerHTML = '';
                    statusContainer.appendChild(statusTextElement);
                    throttledSaveData();
                };
                input.addEventListener('blur', saveStatus);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') input.blur();
                });
                statusContainer.innerHTML = ''; statusContainer.appendChild(input); input.focus();
            });

            DOMElements.themeToggle.addEventListener('click', () => {
                settings.isDarkMode = !settings.isDarkMode; throttledSaveData(); updateUI(); showNotification(`已切换到${settings.isDarkMode ? '夜': '昼'}模式`,
                    'success');
            });
          if (DOMElements.settingsModal?.settingsBtn) {
              DOMElements.settingsModal.settingsBtn.addEventListener('click', () => {
                  showModal(DOMElements.settingsModal.modal);
              });
          } else {
              console.warn('settingsModal 或 settingsBtn 未找到，跳过绑定');
          }

          if (DOMElements.favoritesModal?.favoritesBtn) {
              DOMElements.favoritesModal.favoritesBtn.addEventListener('click', () => {
                  showModal(document.getElementById('group-chat-modal'));
              });
          } else {
              console.warn('favoritesModal 或 favoritesBtn 未找到，跳过绑定');
          }
 // 日历快捷按钮
            const calendarShortcutBtn = document.getElementById('calendar-shortcut-btn');
            if (calendarShortcutBtn) {
                calendarShortcutBtn.addEventListener('click', () => {
                    renderCalendar();
                    showModal(document.getElementById('calendar-modal'));
                });
            }
            // 回复库快捷按钮
            const replyLibraryBtn = document.getElementById('reply-library-btn');
            if (replyLibraryBtn) {
                replyLibraryBtn.addEventListener('click', () => {
                    renderReplyLibrary()
                    showModal(document.getElementById('custom-replies-modal'));
                });
            }
             // 高级功能快捷按钮 (原月经按钮)
                        const advancedShortcutBtn = document.getElementById('advanced-shortcut-btn');
                        if (advancedShortcutBtn) {
                            advancedShortcutBtn.addEventListener('click', () => {
                                showModal(DOMElements.advancedModal.modal);
                            });
                        }

window.setReadReceiptStyle = function(style) {
    settings.readReceiptStyle = style;
    throttledSaveData();
    const iconBtn = document.getElementById('rr-style-icon');
    const textBtn = document.getElementById('rr-style-text');
    if (iconBtn) { iconBtn.className = style === 'icon' ? 'modal-btn modal-btn-primary' : 'modal-btn modal-btn-secondary'; iconBtn.style.cssText = 'padding:5px 12px;font-size:12px;'; }
    if (textBtn) { textBtn.className = style === 'text' ? 'modal-btn modal-btn-primary' : 'modal-btn modal-btn-secondary'; textBtn.style.cssText = 'padding:5px 12px;font-size:12px;'; }
    renderMessages();
    showNotification('已读回执样式已更新', 'success');
};

const _chatSettingsEl = document.getElementById('chat-settings');
if (_chatSettingsEl) _chatSettingsEl.addEventListener('click', () => {
    hideModal(DOMElements.settingsModal.modal);

  const toggleSyncMap = {
         '#reply-toggle': { prop: 'replyEnabled', name: '引用回复' },
         '#sound-toggle': { prop: 'soundEnabled', name: '音效' },
         '#read-receipts-toggle': { prop: 'readReceiptsEnabled', name: '已读回执' },
         '#typing-indicator-toggle': { prop: 'typingIndicatorEnabled', name: '正在输入' },
         '#read-no-reply-toggle': { prop: 'allowReadNoReply', name: '已读不回' },
         '#emoji-mix-toggle': { prop: 'emojiMixEnabled', name: '表情消息' },
         '#enter-send-toggle': { prop: 'enterToSendEnabled', name: '回车发送消息' }
     };
    for (const [selector, { prop }] of Object.entries(toggleSyncMap)) {
        const el = document.querySelector(selector);
        const val = prop === 'emojiMixEnabled' ? (settings[prop] !== false) : !!settings[prop];
        if (el) el.classList.toggle('active', val);
    }
    const svSlider = document.getElementById('sound-volume-slider');
    const svVal = document.getElementById('sound-volume-value');
    if (svSlider) { svSlider.value = Math.round((settings.soundVolume || 0.15) * 100); if (svVal) svVal.textContent = svSlider.value + '%'; }
    const legacyCustom = (settings.customSoundUrl || '').trim();

    const setSelect = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || 'tone_low';
    };
    const setInput = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setSelect('sound-my-send-preset', settings.mySendSoundPreset || 'tone_low');
    setInput('sound-my-send-custom-url', (settings.mySendCustomSoundUrl || '').trim() || legacyCustom);

    setSelect('sound-partner-message-preset', settings.partnerMessageSoundPreset || 'tone_low');
    setInput('sound-partner-message-custom-url', (settings.partnerMessageCustomSoundUrl || '').trim() || legacyCustom);

    setSelect('sound-my-poke-preset', settings.myPokeSoundPreset || 'tone_low');
    setInput('sound-my-poke-custom-url', (settings.myPokeCustomSoundUrl || '').trim() || legacyCustom);

    setSelect('sound-partner-poke-preset', settings.partnerPokeSoundPreset || 'tone_low');
    setInput('sound-partner-poke-custom-url', (settings.partnerPokeCustomSoundUrl || '').trim() || legacyCustom);
    document.querySelectorAll('.time-fmt-opt').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.fmt === (settings.timeFormat || 'HH:mm'));
    });
    const autoToggle = document.getElementById('auto-send-toggle');
    if (autoToggle) autoToggle.classList.toggle('active', !!settings.autoSendEnabled);
    updateAutoSendUI();
    updateDelayUI();
    const immToggle = document.getElementById('immersive-toggle');
    if (immToggle) immToggle.classList.toggle('active', document.body.classList.contains('immersive-mode'));
    const rrStyle = settings.readReceiptStyle || 'icon';
    const rrIconBtn = document.getElementById('rr-style-icon');
    const rrTextBtn = document.getElementById('rr-style-text');
    if (rrIconBtn) { rrIconBtn.className = rrStyle === 'icon' ? 'modal-btn modal-btn-primary' : 'modal-btn modal-btn-secondary'; rrIconBtn.style.cssText = 'padding:5px 12px;font-size:12px;'; }
    if (rrTextBtn) { rrTextBtn.className = rrStyle === 'text' ? 'modal-btn modal-btn-primary' : 'modal-btn modal-btn-secondary'; rrTextBtn.style.cssText = 'padding:5px 12px;font-size:12px;'; }

    showModal(DOMElements.chatModal.modal);
    setupAvatarFrameSettings();
});
            const _advancedEl = document.getElementById('advanced-settings');
            if (_advancedEl) _advancedEl.addEventListener('click', () => {
                hideModal(DOMElements.settingsModal.modal);
                showModal(DOMElements.advancedModal.modal);
            });

            const _dataSettingsEl = document.getElementById('data-settings');
            if (_dataSettingsEl) _dataSettingsEl.addEventListener('click', () => {
                hideModal(DOMElements.settingsModal.modal);
                showModal(DOMElements.dataModal.modal);
                (async function calcDmStorage() {
                    try {
                        let total = 0, msgsSize = 0, settingsSize = 0, mediaSize = 0;
                        const keys = await localforage.keys();
                        for (const k of keys) {
                            const raw = await localforage.getItem(k);
                            const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
                            const bytes = new Blob([str]).size;
                            total += bytes;
                            if (/messages|msgs/i.test(k)) msgsSize += bytes;
                            else if (/avatar|image|photo|bg|background|wallpaper/i.test(k)) mediaSize += bytes;
                            else settingsSize += bytes;
                        }
                        const fmt = b => b > 1048576 ? (b/1048576).toFixed(1)+'MB' : b > 1024 ? (b/1024).toFixed(0)+'KB' : b+'B';
                        const MAX = 5 * 1024 * 1024;
                        const pct = Math.min(100, Math.round(total / MAX * 100));
                        const barEl = document.getElementById('dm-storage-bar');
                        const totalEl = document.getElementById('dm-storage-total');
                        if (barEl) barEl.style.width = pct + '%';
                        if (totalEl) totalEl.textContent = fmt(total);
                        const msgsEl = document.getElementById('dm-stat-msgs');
                        const setEl = document.getElementById('dm-stat-settings');
                        const medEl = document.getElementById('dm-stat-media');
                        if (msgsEl) msgsEl.textContent = fmt(msgsSize);
                        if (setEl) setEl.textContent = fmt(settingsSize);
                        if (medEl) medEl.textContent = fmt(mediaSize);
                    } catch(e) {
                        const totalEl = document.getElementById('dm-storage-total');
                        if (totalEl) totalEl.textContent = '无法读取';
                    }
                })();
            });
            const exportChatBtnDm = document.getElementById('export-chat-btn');
            const importChatBtnDm = document.getElementById('import-chat-btn');
            if (exportChatBtnDm) {
                exportChatBtnDm.addEventListener('click', () => {
                    if (typeof exportChatHistory === 'function') exportChatHistory();
                    else showNotification('功能暂不可用', 'error');
                });
            }
            if (importChatBtnDm) {
                importChatBtnDm.addEventListener('click', () => {
                    const inp = document.createElement('input');
                    inp.type = 'file'; inp.accept = '.json';
                    inp.onchange = e => { if (e.target.files[0] && typeof importChatHistory === 'function') importChatHistory(e.target.files[0]); };
                    inp.click();
                });
            }


            document.querySelectorAll('.theme-color-btn').forEach(btn => {
                btn.addEventListener('click',
                    () => {
                        settings.colorTheme = btn.dataset.theme;
                        throttledSaveData();
                        updateUI();
                        showNotification(`主题颜色已切换`, 'success');
                    });
            });


            document.querySelectorAll('[data-bubble-style]').forEach(item => {
                item.addEventListener('click',
                    () => {
                        settings.bubbleStyle = item.dataset.bubbleStyle;
                        throttledSaveData();
                        updateUI();
                        showNotification(`气泡样式已切换为${getBubbleStyleName(settings.bubbleStyle)}`, 'success');
                    });
            });

            const fontUrlInput = document.getElementById('custom-font-url');
            const applyFontBtn = document.getElementById('apply-font-btn');

            if (fontUrlInput) fontUrlInput.value = settings.customFontUrl || "";

            if (applyFontBtn) {
                applyFontBtn.addEventListener('click', () => {
                    const url = fontUrlInput.value.trim();
                    settings.customFontUrl = url;

                    showNotification('正在尝试加载字体...', 'info', 1000);
                    applyCustomFont(url).then(() => {
                        throttledSaveData();
                        if(url) showNotification('字体已应用', 'success');
                        else showNotification('已恢复默认字体', 'success');
                    });
                });
            }


            const followSystemBtn = document.getElementById('follow-system-font-btn');
            if (followSystemBtn) {
                followSystemBtn.addEventListener('click', () => {

                    const systemFontStack = 'system-ui, -apple-system, sans-serif';


                    if (fontUrlInput) fontUrlInput.value = "";


                    settings.customFontUrl = "";


                    settings.messageFontFamily = systemFontStack;


                    document.documentElement.style.setProperty('--font-family', systemFontStack);
                    document.documentElement.style.setProperty('--message-font-family', systemFontStack);


                    throttledSaveData();


                    renderMessages(true);

                    showNotification('已应用跟随系统字体', 'success');
                });
            }

            const cssTextarea = document.getElementById('custom-bubble-css');
            const applyCssBtn = document.getElementById('apply-css-btn');
            const resetCssBtn = document.getElementById('reset-css-btn');

            if (cssTextarea) cssTextarea.value = settings.customBubbleCss || "";

            function updateCssLivePreview() {
                const previewStyle = document.getElementById('css-live-preview-style');
                if (!previewStyle) return;
                const raw = (cssTextarea ? cssTextarea.value : '') || '';
                const scoped = raw.replace(/([^{}]+)\{/g, (match, selector) => {
                    const parts = selector.split(',').map(s => `#css-live-preview ${s.trim()}`);
                    return parts.join(', ') + ' {';
                });
                previewStyle.textContent = scoped;
            }

            if (cssTextarea) {
                cssTextarea.addEventListener('input', updateCssLivePreview);
                updateCssLivePreview();
            }

            if (applyCssBtn) {
                applyCssBtn.addEventListener('click', () => {
                    const css = cssTextarea.value;
                    settings.customBubbleCss = css;
                    applyCustomBubbleCss(css);
                    throttledSaveData();
                    showNotification('自定义样式已应用', 'success');
                });
            }

            if (resetCssBtn) {
                resetCssBtn.addEventListener('click', () => {
                    cssTextarea.value = "";
                    settings.customBubbleCss = "";
                    applyCustomBubbleCss("");
                    if (document.getElementById('css-live-preview-style')) document.getElementById('css-live-preview-style').textContent = '';
                    throttledSaveData();
                    showNotification('自定义样式已清除', 'success');
                });
            }

            const globalCssTextarea = document.getElementById('custom-global-css');
            const applyGlobalCssBtn = document.getElementById('apply-global-css-btn');
            const resetGlobalCssBtn = document.getElementById('reset-global-css-btn');
            const globalCssLiveToggle = document.getElementById('global-css-live-toggle');
            const globalCssStatus = document.getElementById('global-css-status');

            if (globalCssTextarea) {
                globalCssTextarea.value = settings.customGlobalCss || '';

                globalCssTextarea.addEventListener('input', () => {
                    if (globalCssLiveToggle && globalCssLiveToggle.checked) {
                        applyGlobalThemeCss(globalCssTextarea.value);
                        if (globalCssStatus) {
                            globalCssStatus.style.display = 'block';
                            globalCssStatus.textContent = '● 实时应用中';
                            globalCssStatus.style.color = 'var(--accent-color)';
                        }
                    }
                });
            }

            if (applyGlobalCssBtn) {
                applyGlobalCssBtn.addEventListener('click', () => {
                    const css = globalCssTextarea ? globalCssTextarea.value : '';
                    settings.customGlobalCss = css;
                    applyGlobalThemeCss(css);
                    throttledSaveData();
                    showNotification('全局主题 CSS 已应用', 'success');
                    if (globalCssStatus) {
                        globalCssStatus.style.display = 'block';
                        globalCssStatus.textContent = '✓ 已应用到全局';
                        globalCssStatus.style.color = '#51cf66';
                        setTimeout(() => { if (globalCssStatus) globalCssStatus.style.display = 'none'; }, 2000);
                    }
                });
            }

            if (resetGlobalCssBtn) {
                resetGlobalCssBtn.addEventListener('click', () => {
                    if (globalCssTextarea) globalCssTextarea.value = '';
                    settings.customGlobalCss = '';
                    applyGlobalThemeCss('');
                    throttledSaveData();
                    showNotification('全局主题 CSS 已清除', 'success');
                    if (globalCssStatus) globalCssStatus.style.display = 'none';
                });
            }

            const fontSizeSlider = document.getElementById('font-size-slider');
            const fontSizeValue = document.getElementById('font-size-value');

            fontSizeSlider.value = settings.fontSize;
            fontSizeValue.textContent = `${settings.fontSize}px`;

            fontSizeSlider.addEventListener('input', (e) => {
                settings.fontSize = parseInt(e.target.value);
                document.documentElement.style.setProperty('--font-size',
                    `${settings.fontSize}px`);
                fontSizeValue.textContent = `${settings.fontSize}px`;
            });

            fontSizeSlider.addEventListener('change', throttledSaveData);

            const avatarToggle = document.getElementById('in-chat-avatar-toggle-2');
            const avatarSizeControl = document.getElementById('in-chat-avatar-size-control-2');
            const avatarPositionControl = document.getElementById('in-chat-avatar-position-control-2');
            const avatarPreview = document.getElementById('avatar-bubble-preview');
            const avatarSizeSlider = document.getElementById('in-chat-avatar-size-slider-2');
            const avatarSizeValue = document.getElementById('in-chat-avatar-size-value-2');

            if (!settings.inChatAvatarPosition) settings.inChatAvatarPosition = 'center';


            function updateBubblePreview() {
                const receivedBubble = document.getElementById('preview-bubble-received');
                const sentBubble = document.getElementById('preview-bubble-sent');
                if (!receivedBubble || !sentBubble) return;
                const style = settings.bubbleStyle || 'standard';
                const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-color-rgb').trim() || '100,150,255';
                const styleMap = {
                    'standard':      { recv: '16px 16px 16px 4px',  sent: '16px 16px 4px 16px',  recvShadow: '0 2px 10px rgba(0,0,0,0.08)', sentShadow: `0 3px 12px rgba(${accentRgb},0.22)` },
                    'rounded':       { recv: '18px 18px 18px 6px',  sent: '18px 18px 6px 18px',  recvShadow: '0 2px 10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)', sentShadow: `0 3px 12px rgba(${accentRgb},0.25), 0 1px 3px rgba(${accentRgb},0.1)` },
                    'rounded-large': { recv: '24px 24px 24px 4px',  sent: '24px 24px 4px 24px',  recvShadow: '0 4px 16px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.05)', sentShadow: `0 4px 16px rgba(${accentRgb},0.28), 0 2px 4px rgba(${accentRgb},0.12)` },
                    'square':        { recv: '4px 4px 4px 0',       sent: '4px 4px 0 4px',       recvShadow: '0 3px 10px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', sentShadow: `0 3px 10px rgba(${accentRgb},0.2), 0 1px 2px rgba(${accentRgb},0.08)` }
                };
                const radii = styleMap[style] || styleMap['standard'];
                receivedBubble.style.borderRadius = radii.recv;
                receivedBubble.style.boxShadow = radii.recvShadow;
                sentBubble.style.borderRadius = radii.sent;
                sentBubble.style.boxShadow = radii.sentShadow;
                const recvBg = getComputedStyle(document.documentElement).getPropertyValue('--message-received-bg').trim();
                const recvText = getComputedStyle(document.documentElement).getPropertyValue('--message-received-text').trim();
                const sentBg = getComputedStyle(document.documentElement).getPropertyValue('--message-sent-bg').trim();
                const sentText = getComputedStyle(document.documentElement).getPropertyValue('--message-sent-text').trim();
                if (recvBg) receivedBubble.style.background = recvBg;
                if (recvText) receivedBubble.style.color = recvText;
                if (sentBg) sentBubble.style.background = sentBg;
                if (sentText) sentBubble.style.color = sentText;
                receivedBubble.style.fontFamily = settings.messageFontFamily || '';
                sentBubble.style.fontFamily = settings.messageFontFamily || '';
                receivedBubble.style.fontSize = (settings.fontSize || 16) + 'px';
                sentBubble.style.fontSize = (settings.fontSize || 16) + 'px';
                const customCss = (document.getElementById('custom-bubble-css') || {}).value || '';
                let previewStyle = document.getElementById('bubble-preview-custom-style');
                if (!previewStyle) {
                    previewStyle = document.createElement('style');
                    previewStyle.id = 'bubble-preview-custom-style';
                    document.head.appendChild(previewStyle);
                }
                previewStyle.textContent = customCss;
            }

            function updateAvatarSettingsUI() {
                const enabled = settings.inChatAvatarEnabled;
                const pill = document.getElementById('avatar-toggle-pill-2');
                const knob = document.getElementById('avatar-toggle-knob-2');
                const statusText = document.getElementById('avatar-toggle-status-2');
                if (pill) pill.style.background = enabled ? 'var(--accent-color)' : 'var(--border-color)';
                if (knob) knob.style.right = enabled ? '3px' : '23px';
                if (statusText) statusText.textContent = enabled ? '已开启 — 消息旁显示头像' : '已关闭';

                if (avatarSizeControl) avatarSizeControl.style.display = enabled ? 'flex' : 'none';
                if (avatarPositionControl) avatarPositionControl.style.display = enabled ? 'block' : 'none';
                if (avatarPreview) avatarPreview.style.display = enabled ? 'block' : 'none';

                if (avatarSizeSlider) avatarSizeSlider.value = settings.inChatAvatarSize;
                if (avatarSizeValue) avatarSizeValue.textContent = `${settings.inChatAvatarSize}px`;
                document.documentElement.style.setProperty('--in-chat-avatar-size', `${settings.inChatAvatarSize}px`);

                const pos = settings.inChatAvatarPosition || 'center';
                const alignMap = { 'top': 'flex-start', 'center': 'center', 'bottom': 'flex-end', 'custom': 'flex-start' };
                document.documentElement.style.setProperty('--avatar-align', alignMap[pos] || 'center');
                document.body.dataset.avatarPos = pos;
                document.querySelectorAll('.preview-msg-row').forEach(row => {
                    row.style.alignItems = alignMap[pos] || 'flex-start';
                });
                const topBtn = document.getElementById('avatar-pos-top-2');
                const centerBtn = document.getElementById('avatar-pos-center-2');
                const bottomBtn = document.getElementById('avatar-pos-bottom-2');
                const customBtn = document.getElementById('avatar-pos-custom-2');
                [topBtn, centerBtn, bottomBtn, customBtn].forEach(btn => {
                    if (!btn) return;
                    btn.className = btn.dataset.pos === pos ? 'modal-btn modal-btn-primary' : 'modal-btn modal-btn-secondary';
                    btn.style.flex = '1'; btn.style.fontSize = '12px'; btn.style.padding = '7px 0';
                });

                const customOffsetCtrl = document.getElementById('avatar-custom-offset-control');
                if (customOffsetCtrl) customOffsetCtrl.style.display = pos === 'custom' ? 'block' : 'none';
                if (pos === 'custom') {
                    const offset = settings.inChatAvatarCustomOffset || 0;
                    document.documentElement.style.setProperty('--avatar-custom-offset', offset + 'px');
                    const sl = document.getElementById('avatar-custom-offset-slider');
                    const vl = document.getElementById('avatar-custom-offset-value');
                    if (sl) sl.value = offset;
                    if (vl) vl.textContent = offset + 'px';
                    const previewPartner = document.getElementById('preview-partner-avatar');
                    if (previewPartner) previewPartner.style.marginTop = offset + 'px';
                    const previewMy = document.getElementById('preview-my-avatar');
                    if (previewMy) previewMy.style.marginTop = offset + 'px';
                } else {
                    document.documentElement.style.removeProperty('--avatar-custom-offset');
                    const previewPartner = document.getElementById('preview-partner-avatar');
                    if (previewPartner) previewPartner.style.marginTop = '';
                    const previewMy = document.getElementById('preview-my-avatar');
                    if (previewMy) previewMy.style.marginTop = '';
                }

                const alwaysPill = document.getElementById('always-avatar-pill');
                const alwaysKnob = document.getElementById('always-avatar-knob');
                const alwaysStatus = document.getElementById('always-avatar-status');
                const alwaysOn = !!settings.alwaysShowAvatar;
                if (alwaysPill) alwaysPill.style.background = alwaysOn ? 'var(--accent-color)' : 'var(--border-color)';
                if (alwaysKnob) alwaysKnob.style.right = alwaysOn ? '3px' : '23px';
                if (alwaysStatus) alwaysStatus.textContent = alwaysOn ? '已开启 — 每条消息都显示头像' : '已关闭 — 仅首条消息显示';
                document.body.classList.toggle('always-show-avatar', alwaysOn);

                const namePill = document.getElementById('partner-name-chat-pill');
                const nameKnob = document.getElementById('partner-name-chat-knob');
                const nameStatus = document.getElementById('partner-name-chat-status');
                const nameOn = !!settings.showPartnerNameInChat;
                if (namePill) namePill.style.background = nameOn ? 'var(--accent-color)' : 'var(--border-color)';
                if (nameKnob) nameKnob.style.right = nameOn ? '3px' : '23px';
                if (nameStatus) nameStatus.textContent = nameOn ? '已开启 — 消息旁显示对方名字' : '已关闭';
                showPartnerNameInChat = nameOn;
                document.body.classList.toggle('show-partner-name', nameOn);

                updateAvatarPreview();
            }
            updateAvatarSettingsUI();

            if (avatarToggle) {
                avatarToggle.addEventListener('click', () => {
                    settings.inChatAvatarEnabled = !settings.inChatAvatarEnabled;
                    updateAvatarSettingsUI();
                    renderMessages(true);
                    throttledSaveData();
                });
            }

            if (avatarSizeSlider) {
                avatarSizeSlider.addEventListener('input', (e) => {
                    settings.inChatAvatarSize = parseInt(e.target.value, 10);
                    updateAvatarSettingsUI();
                    renderMessages(true);
                });
                avatarSizeSlider.addEventListener('change', throttledSaveData);
            }

            ['avatar-pos-top-2','avatar-pos-center-2','avatar-pos-bottom-2','avatar-pos-custom-2'].forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.addEventListener('click', () => {
                        settings.inChatAvatarPosition = btn.dataset.pos;
                        updateAvatarSettingsUI();
                        renderMessages(true);
                        throttledSaveData();
                    });
                }
            });

            const customOffsetSlider = document.getElementById('avatar-custom-offset-slider');
            const customOffsetValue = document.getElementById('avatar-custom-offset-value');
            if (customOffsetSlider) {
                customOffsetSlider.value = settings.inChatAvatarCustomOffset || 0;
                if (customOffsetValue) customOffsetValue.textContent = (settings.inChatAvatarCustomOffset || 0) + 'px';
                customOffsetSlider.addEventListener('input', () => {
                    const val = parseInt(customOffsetSlider.value, 10);
                    settings.inChatAvatarCustomOffset = val;
                    if (customOffsetValue) customOffsetValue.textContent = val + 'px';
                    document.documentElement.style.setProperty('--avatar-custom-offset', val + 'px');
                    document.querySelectorAll('.preview-msg-row').forEach(row => {
                        row.style.alignItems = 'flex-start';
                    });
                    const previewPartner = document.getElementById('preview-partner-avatar');
                    if (previewPartner) previewPartner.style.marginTop = val + 'px';
                    const previewMy = document.getElementById('preview-my-avatar');
                    if (previewMy) previewMy.style.marginTop = val + 'px';
                    renderMessages(true);
                });
                customOffsetSlider.addEventListener('change', throttledSaveData);
            }

            const alwaysAvatarToggle = document.getElementById('always-avatar-toggle');
            if (alwaysAvatarToggle) {
                alwaysAvatarToggle.addEventListener('click', () => {
                    settings.alwaysShowAvatar = !settings.alwaysShowAvatar;
                    updateAvatarSettingsUI();
                    renderMessages(true);
                    throttledSaveData();
                });
            }

            const partnerNameChatToggle = document.getElementById('partner-name-chat-toggle');
            if (partnerNameChatToggle) {
                partnerNameChatToggle.addEventListener('click', () => {
                    settings.showPartnerNameInChat = !settings.showPartnerNameInChat;
                    updateAvatarSettingsUI();
                    throttledSaveData();
                });
            }

            function updateAvatarPreview(shape, cornerRadius) {
                const previewPartner = document.getElementById('preview-partner-avatar');
                const previewMy = document.getElementById('preview-my-avatar');
                if (!previewPartner || !previewMy) return;
                const sz = `${settings.inChatAvatarSize || 36}px`;
                previewPartner.style.width = sz;
                previewPartner.style.height = sz;
                previewMy.style.width = sz;
                previewMy.style.height = sz;
                const partnerImg = DOMElements.partner && DOMElements.partner.avatar ? DOMElements.partner.avatar.querySelector('img') : null;
                const myImg = DOMElements.me && DOMElements.me.avatar ? DOMElements.me.avatar.querySelector('img') : null;
                const currentShape = shape || settings.myAvatarShape || 'circle';

                function applyToPreviewEl(el, img, shp, cr) {
                    if (img && img.src) {
                        el.innerHTML = `<img src="${img.src}" style="width:100%;height:100%;object-fit:cover;">`;
                    }
                    if (shp === 'circle') {
                        el.style.borderRadius = '50%';
                    } else if (shp === 'square') {
                        el.style.borderRadius = (cr || 8) + 'px';
                    }
                }
                const cr = cornerRadius !== undefined ? cornerRadius : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--avatar-corner-radius') || '8') || 8;
                applyToPreviewEl(previewPartner, partnerImg, currentShape, cr);
                applyToPreviewEl(previewMy, myImg, currentShape, cr);
                if (typeof updateBubblePreview === 'function') updateBubblePreview();
            }

            function updateAvatarShapeBtns() {
                const shape = settings.myAvatarShape || 'circle';
                document.querySelectorAll('.avatar-shape-btn-2').forEach(b => {
                    b.classList.toggle('modal-btn-primary', b.dataset.shape === shape);
                    b.classList.toggle('modal-btn-secondary', b.dataset.shape !== shape);
                });
                const radiusCtrl = document.getElementById('avatar-corner-radius-control-2');
                if (radiusCtrl) radiusCtrl.style.display = shape === 'square' ? '' : 'none';
                updateAvatarPreview(shape);
            }
            document.querySelectorAll('.avatar-shape-btn-2').forEach(btn => {
                btn.addEventListener('click', () => {
                    const shape = btn.dataset.shape;
                    settings.myAvatarShape = shape;
                    settings.partnerAvatarShape = shape;
                    applyAvatarShapeToDOM && applyAvatarShapeToDOM('my', shape);
                    applyAvatarShapeToDOM && applyAvatarShapeToDOM('partner', shape);
                    updateAvatarShapeBtns();
                    updateAvatarPreview(shape);
                    renderMessages(true);
                    throttledSaveData();
                });
            });
            const cornerSlider = document.getElementById('avatar-corner-radius-slider-2');
            const cornerVal = document.getElementById('avatar-corner-radius-value-2');
            if (cornerSlider) {
                cornerSlider.value = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--avatar-corner-radius') || '8') || 8;
                if (cornerVal) cornerVal.textContent = cornerSlider.value + 'px';
                cornerSlider.addEventListener('input', () => {
                    const r = cornerSlider.value;
                    if (cornerVal) cornerVal.textContent = r + 'px';
                    document.documentElement.style.setProperty('--avatar-corner-radius', r + 'px');
                    updateAvatarPreview(settings.myAvatarShape || 'circle', parseInt(r));
                    renderMessages(true);
                });
                cornerSlider.addEventListener('change', () => {
                    settings.avatarCornerRadius = cornerSlider.value;
                    throttledSaveData();
                });
            }
            updateAvatarShapeBtns();

            document.querySelectorAll('[data-bubble-style]').forEach(item => {
                item.addEventListener('click', () => {
                    setTimeout(updateBubblePreview, 100);
                });
            });

            const minDelaySlider = document.getElementById('reply-delay-min-slider');
            const minDelayValue = document.getElementById('reply-delay-min-value');
            const maxDelaySlider = document.getElementById('reply-delay-max-slider');
            const maxDelayValue = document.getElementById('reply-delay-max-value');

            window.switchCsTab = function switchCsTab(btn) {
                document.querySelectorAll('.cs-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.cs-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById(btn.dataset.panel);
                if (panel) panel.classList.add('active');
            };

            function updateDelayUI() {
                minDelaySlider.value = settings.replyDelayMin;
                const minSec = settings.replyDelayMin / 1000;
                minDelayValue.textContent = minSec >= 60 ? `${(minSec/60).toFixed(1)}分钟` : `${minSec.toFixed(0)}s`;
                maxDelaySlider.value = settings.replyDelayMax;
                const maxSec = settings.replyDelayMax / 1000;
                maxDelayValue.textContent = maxSec >= 60 ? `${(maxSec/60).toFixed(1)}分钟` : `${maxSec.toFixed(0)}s`;
                maxDelaySlider.min = settings.replyDelayMin;
            }
            updateDelayUI();

            minDelaySlider.addEventListener('input', (e) => {
                settings.replyDelayMin = parseInt(e.target.value, 10);
                if (settings.replyDelayMin > settings.replyDelayMax) {
                    settings.replyDelayMax = settings.replyDelayMin;
                }
                updateDelayUI();
            });
            minDelaySlider.addEventListener('change', throttledSaveData);

            maxDelaySlider.addEventListener('input', (e) => {
                settings.replyDelayMax = parseInt(e.target.value, 10);
                 if (settings.replyDelayMax < settings.replyDelayMin) {
                    settings.replyDelayMin = settings.replyDelayMax;
                }
                updateDelayUI();
            });
            maxDelaySlider.addEventListener('change', throttledSaveData);
 const settingToggles = {
                '#reply-toggle': {prop: 'replyEnabled', name: '引用回复'},
                '#sound-toggle': {prop: 'soundEnabled', name: '音效'},
                '#read-receipts-toggle': {prop: 'readReceiptsEnabled', name: '已读回执'},
                '#typing-indicator-toggle': {prop: 'typingIndicatorEnabled', name: '正在输入'},
                '#read-no-reply-toggle': { prop: 'allowReadNoReply', name: '已读不回' },
                '#emoji-mix-toggle': { prop: 'emojiMixEnabled', name: '表情混入消息' },
                '#enter-send-toggle': { prop: 'enterToSendEnabled', name: '回车发送消息' },
            };

            for (const [selector, {
                prop, name
            }] of Object.entries(settingToggles)) {
                const element = document.querySelector(selector);
                if (!element) continue;

                const _initVal = prop === 'emojiMixEnabled' ? (settings[prop] !== false) : !!settings[prop];
                element.classList.toggle('active', _initVal);

                element.addEventListener('click', () => {
                    if (prop === 'emojiMixEnabled' && settings[prop] === undefined) settings[prop] = true;
                    settings[prop] = !settings[prop];
                    throttledSaveData();
                    updateUI();
                    element.classList.toggle('active', !!settings[prop]);
                    if (prop !== 'soundEnabled') renderMessages(true);
                    showNotification(`${name}已${settings[prop] ? '开启': '关闭'}`, 'success');
                });
            }

// --- 已读不回概率滑动条逻辑 ---
            const rnrToggle = document.querySelector('#read-no-reply-toggle');
            const rnrControl = document.getElementById('read-no-reply-chance-control');
            const rnrSlider = document.getElementById('read-no-reply-chance-slider');
            const rnrValue = document.getElementById('read-no-reply-chance-value');

            // 【新增】提取一个专门的 UI 同步函数，保证每次打开弹窗都能恢复正确状态
            const updateRnrUI = () => {
                if (rnrToggle) rnrToggle.classList.toggle('active', !!settings.allowReadNoReply);
                if (rnrControl) rnrControl.style.display = settings.allowReadNoReply ? 'block' : 'none';
                if (rnrSlider) {
                    // 如果设置里有值就用设置的，没有或者异常就安全回退到 20%
                    const chance = (settings.readNoReplyChance !== undefined && settings.readNoReplyChance !== null) ? settings.readNoReplyChance : 0.2;
                    rnrSlider.value = Math.round(chance * 100);
                    if (rnrValue) rnrValue.textContent = rnrSlider.value + '%';
                }
            };

            // 页面刚加载时执行一次同步
            updateRnrUI();

            // 页面加载时同步保活开关状态
            const kaRow = document.getElementById('keepalive-audio-toggle');
            if (kaRow) {
                kaRow.classList.toggle('active', !!settings.keepaliveAudioEnabled);
            }

            // 滑动条拖动逻辑
            if (rnrSlider) {
                rnrSlider.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value);
                    settings.readNoReplyChance = val / 100;
                    if (rnrValue) rnrValue.textContent = val + '%';
                });
                rnrSlider.addEventListener('change', throttledSaveData);
            }

            // 点击开关时的逻辑
            if (rnrToggle && rnrControl) {
                rnrToggle.addEventListener('click', () => {
                    // 延迟 20ms 执行，确保拿到最新的布尔值
                    setTimeout(() => {
                        updateRnrUI();
                    }, 20);
                });
            }

            const soundVolSlider = document.getElementById('sound-volume-slider');
            const soundVolVal = document.getElementById('sound-volume-value');
            if (soundVolSlider) {
                soundVolSlider.value = Math.round((settings.soundVolume || 0.15) * 100);
                if (soundVolVal) soundVolVal.textContent = soundVolSlider.value + '%';
                soundVolSlider.addEventListener('input', (e) => {
                    settings.soundVolume = parseInt(e.target.value) / 100;
                    if (soundVolVal) soundVolVal.textContent = e.target.value + '%';
                });
                soundVolSlider.addEventListener('change', throttledSaveData);
            }

            const bindPresetSelect = (selectId, settingsKey) => {
                const el = document.getElementById(selectId);
                if (!el) return;
                el.value = settings[settingsKey] || 'tone_default';
                el.addEventListener('change', () => {
                    settings[settingsKey] = el.value || 'tone_default';
                    throttledSaveData();
                });
            };

            bindPresetSelect('sound-my-send-preset', 'mySendSoundPreset');
            bindPresetSelect('sound-partner-message-preset', 'partnerMessageSoundPreset');
            bindPresetSelect('sound-my-poke-preset', 'myPokeSoundPreset');
            bindPresetSelect('sound-partner-poke-preset', 'partnerPokeSoundPreset');

            const bindCustomUrlInput = (inputId, settingsKey) => {
                const el = document.getElementById(inputId);
                if (!el) return;
                el.addEventListener('change', () => {
                    settings[settingsKey] = el.value.trim();
                    throttledSaveData();
                });
            };

            bindCustomUrlInput('sound-my-send-custom-url', 'mySendCustomSoundUrl');
            bindCustomUrlInput('sound-partner-message-custom-url', 'partnerMessageCustomSoundUrl');
            bindCustomUrlInput('sound-my-poke-custom-url', 'myPokeCustomSoundUrl');
            bindCustomUrlInput('sound-partner-poke-custom-url', 'partnerPokeCustomSoundUrl');

            const btnMySend = document.getElementById('test-sound-my-send-btn');
            if (btnMySend) btnMySend.addEventListener('click', () => playSound('my_send'));

            const btnPartnerMsg = document.getElementById('test-sound-partner-message-btn');
            if (btnPartnerMsg) btnPartnerMsg.addEventListener('click', () => playSound('partner_message'));

            const btnMyPoke = document.getElementById('test-sound-my-poke-btn');
            if (btnMyPoke) btnMyPoke.addEventListener('click', () => playSound('my_poke'));

            const btnPartnerPoke = document.getElementById('test-sound-partner-poke-btn');
            if (btnPartnerPoke) btnPartnerPoke.addEventListener('click', () => playSound('partner_poke'));

            document.querySelectorAll('.time-fmt-opt').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.fmt === (settings.timeFormat || 'HH:mm'));
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.time-fmt-opt').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    settings.timeFormat = opt.dataset.fmt;
                    throttledSaveData();
                    renderMessages(true);
                    showNotification('时间格式已更新', 'success');
                });
            });


            const _appearanceEl = document.getElementById('appearance-settings');
            if (_appearanceEl) _appearanceEl.addEventListener('click', () => {
                hideModal(DOMElements.settingsModal.modal);
                window.hideAppearancePanel && window.hideAppearancePanel();
                renderBackgroundGallery();
                renderThemeSchemesList();

                const fontSizeSliderEl = document.getElementById('font-size-slider');
                const fontSizeValueEl = document.getElementById('font-size-value');
                if (fontSizeSliderEl) {
                    fontSizeSliderEl.value = settings.fontSize;
                    if (fontSizeValueEl) fontSizeValueEl.textContent = `${settings.fontSize}px`;
                }
                const fontUrlInputEl = document.getElementById('custom-font-url');
                if (fontUrlInputEl) fontUrlInputEl.value = settings.customFontUrl || '';
                const cssTextareaEl = document.getElementById('custom-bubble-css');
                if (cssTextareaEl) cssTextareaEl.value = settings.customBubbleCss || '';
                const globalCssTextareaEl = document.getElementById('custom-global-css');
                if (globalCssTextareaEl) globalCssTextareaEl.value = settings.customGlobalCss || '';

                document.querySelectorAll('[data-bubble-style]').forEach(item => {
                    item.classList.toggle('active', item.dataset.bubbleStyle === settings.bubbleStyle);
                });

                document.querySelectorAll('.theme-color-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.theme === settings.colorTheme);
                });

                showModal(DOMElements.appearanceModal.modal);
                setTimeout(() => {
                    updateAvatarSettingsUI && updateAvatarSettingsUI();
                    setupAppearancePanelFrameSettings && setupAppearancePanelFrameSettings();
                }, 100);
            });
            DOMElements.appearanceModal.closeBtn.addEventListener('click', () => {
                    hideModal(DOMElements.appearanceModal.modal);
                });

            const bgInput = document.getElementById('bg-gallery-input');
            if (bgInput) {
                bgInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                        showNotification('背景图片不能超过10MB', 'error');
                        return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                        showNotification('文件较大，正在处理中...', 'info', 2000);
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64 = event.target.result;
                        savedBackgrounds.push({
                            id: `user-${Date.now()}`,
                            type: file.type === 'image/gif' ? 'gif' : 'image',
                            value: base64
                        });
                        saveBackgroundGallery();
                        renderBackgroundGallery();
                        applyBackground(base64);
                        localforage.setItem(getStorageKey('chatBackground'), base64);
                        showNotification('新背景已添加并应用', 'success');
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                });
            }

const autoSendToggle = document.getElementById('auto-send-toggle');
const autoSendControl = document.getElementById('auto-send-control');
const autoSendSlider = document.getElementById('auto-send-slider');
const autoSendValue = document.getElementById('auto-send-value');

const updateAutoSendUI = () => {
    autoSendToggle.classList.toggle('active', !!settings.autoSendEnabled);
    autoSendControl.style.display = settings.autoSendEnabled ? "flex" : "none";
    const currentVal = settings.autoSendInterval || 5;
    autoSendSlider.value = currentVal;
    autoSendValue.textContent = `${currentVal}分钟`;
};

updateAutoSendUI();

autoSendToggle.addEventListener('click', () => {
    settings.autoSendEnabled = !settings.autoSendEnabled;
    updateAutoSendUI();
    manageAutoSendTimer();
    throttledSaveData();
    showNotification(`主动发送已${settings.autoSendEnabled ? '开启' : '关闭'}`, 'success');
});

autoSendSlider.value = settings.autoSendInterval || 5;
autoSendValue.textContent = `${settings.autoSendInterval || 5}分钟`;

autoSendSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    settings.autoSendInterval = val;
    autoSendValue.textContent = `${val}分钟`;
});

autoSendSlider.addEventListener('change', () => {
    manageAutoSendTimer();
    throttledSaveData();
});

            const resetBgBtn = document.getElementById('reset-default-bg');
            if (resetBgBtn) {
                resetBgBtn.addEventListener('click', () => {
                    removeBackground();
                    renderBackgroundGallery();
                    showNotification('已移除背景图', 'success');
                });
            }
        }



                const galleryBanner = document.getElementById('gallery-banner-entry');
                if (galleryBanner) {
                    galleryBanner.addEventListener('click', () => {
                        window.open('https://aielin17.github.io/-/', '_blank');
                    });
                    galleryBanner.addEventListener('mousedown', () => { galleryBanner.style.transform = 'scale(0.97)'; });
                    galleryBanner.addEventListener('mouseup', () => { galleryBanner.style.transform = 'scale(1)'; });
                    galleryBanner.addEventListener('mouseleave', () => { galleryBanner.style.transform = 'scale(1)'; });
                }
                function handleSendEnvelope() {
                    console.log("发送信封功能待实现");
                }
                //document.getElementById('send-envelope').addEventListener('click', handleSendEnvelope);
                const sendEnvelopeBtn = document.getElementById('send-envelope');
                if (sendEnvelopeBtn) {
                    sendEnvelopeBtn.addEventListener('click', handleSendEnvelope);
                }
                /*document.getElementById('cancel-envelope').addEventListener('click', () => {
                    hideModal(document.getElementById('envelope-modal'));
                });*/
                const cancelEnvelopeBtn = document.getElementById('cancel-envelope');
                if (cancelEnvelopeBtn) {
                    cancelEnvelopeBtn.addEventListener('click', () => {
                        hideModal(document.getElementById('envelope-modal'));
                    });
                }
                const closeFortune = document.getElementById('close-fortune');
                if (closeFortune) {
                    closeFortune.addEventListener('click', () => {
                        hideModal(document.getElementById('fortune-lenormand-modal'));
                    });
                }
                const batchFavoriteBtn = document.getElementById('batch-favorite-function');
                if (batchFavoriteBtn) {
                    batchFavoriteBtn.addEventListener('click', () => {
                        hideModal(DOMElements.favoritesModal.modal);
                        toggleBatchFavoriteMode();
                    });
              }

 if (typeof initReplyLibraryListeners === 'function') {
     initReplyLibraryListeners();
 }

            DOMElements.anniversaryAnimation.closeBtn.addEventListener('click', () => {
                DOMElements.anniversaryAnimation.modal.classList.remove('active');
            });


   const _statsFuncEl = document.getElementById('stats-function');
   if (_statsFuncEl) {
       _statsFuncEl.addEventListener('click', () => {
           hideModal(DOMElements.advancedModal.modal);
           renderStatsContent();
           showModal(DOMElements.statsModal.modal);
       });
   }

   const coinFunctionBtn = document.getElementById('coin-function');
   if (coinFunctionBtn) {
       coinFunctionBtn.addEventListener('click', () => {
           hideModal(DOMElements.advancedModal.modal);
           handleCoinToss();
       });
   }

    const annToggleBtn = document.getElementById('ann-toggle-btn');
    const annFormWrapper = document.getElementById('ann-form-wrapper');

    if (annToggleBtn && annFormWrapper) {
        annToggleBtn.addEventListener('click', () => {
            const isActive = annFormWrapper.classList.contains('active');

            if (isActive) {
                annFormWrapper.classList.remove('active');
                annToggleBtn.classList.remove('active');
            } else {
                annFormWrapper.classList.add('active');
                annToggleBtn.classList.add('active');

                setTimeout(() => {
                    annFormWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 300);
            }
        });
    }

        function getBubbleStyleName(style) {
            const names = {
                'standard': '标准',
                'rounded': '圆角',
                'rounded-large': '大圆角',
                'square': '方形'
            };
            return names[style] || '标准';
        }


        function initDataManagementListeners() {

            const _clearStorageEl = document.getElementById('clear-storage');
            if (_clearStorageEl) _clearStorageEl.addEventListener('click', clearAllAppData);
            const creditsBtn = document.getElementById('open-credits-btn');
            if (creditsBtn) {
                creditsBtn.addEventListener('click', () => {

                    hideModal(DOMElements.dataModal.modal);


                    const disclaimerModal = document.getElementById('disclaimer-modal');


                    if (disclaimerModal) {
                        showModal(disclaimerModal);
                    }
                });
            }

        }
//const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
        function initCoreListeners() {
            // 1. 聊天容器滚动监听
            if (DOMElements.chatContainer) {
                DOMElements.chatContainer.addEventListener('scroll', () => {
                    const container = DOMElements.chatContainer;
                    if (container.scrollTop < 50 && !isLoadingHistory && messages.length > displayedMessageCount) {
                        isLoadingHistory = true;
                        const loader = document.getElementById('history-loader');
                        if (loader) loader.classList.add('visible');
                        setTimeout(() => {
                            displayedMessageCount += HISTORY_BATCH_SIZE;
                            renderMessages(true);
                            if (loader) loader.classList.remove('visible');
                            isLoadingHistory = false;
                        }, 600);
                    }
                });
            }

            // 6. 其他按钮监听
            /*if (DOMElements.continueBtn) {
                DOMElements.continueBtn.addEventListener('click', simulateReply);
            }*/
        }

        DOMElements.messageInput.addEventListener('input', () => {
            DOMElements.messageInput.style.height = 'auto'; DOMElements.messageInput.style.height = `${Math.min(DOMElements.messageInput.scrollHeight, 120)}px`;
        });
        // 回车发送消息功能（Shift+Enter依然是换行）
        DOMElements.messageInput.addEventListener('keydown', (e) => {
            if (settings.enterToSendEnabled && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // 阻止默认的换行
                const text = DOMElements.messageInput.value.trim();
                const imageFile = DOMElements.imageInput.files[0];
                if (text || imageFile) {
                    sendMessage();
                }
            }
        });


        function initCoreListeners() {

            DOMElements.chatContainer.addEventListener('scroll', () => {
                const container = DOMElements.chatContainer;
                if (!container) return;
                if (container.scrollTop < 50 && !isLoadingHistory && messages.length > displayedMessageCount) {
                    if (typeof loadMoreHistory === 'function') loadMoreHistory();
                }
            });

            DOMElements.sendBtn.addEventListener('click', () => isBatchMode ? addToBatch(): sendMessage());
            DOMElements.messageInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); isBatchMode ? addToBatch(): sendMessage();
                }
            });
            DOMElements.messageInput.addEventListener('input', () => {
                DOMElements.messageInput.style.height = 'auto'; DOMElements.messageInput.style.height = `${Math.min(DOMElements.messageInput.scrollHeight, 120)}px`;
            });


            DOMElements.attachmentBtn.addEventListener('click', () => {

                const modal = document.createElement('div');
                modal.className = 'modal image-upload-modal';
                modal.style.cssText = `
            display: flex !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 9999;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(8px);
            opacity: 0;
            transition: opacity 0.3s ease;
            `;

                modal.innerHTML = `
            <div class="modal-content" style="
            z-index: 10000;
            position: relative;
            background-color: var(--secondary-bg);
            border-radius: var(--radius);
            padding: 24px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.3s ease;
            ">
            <div class="modal-title"><i class="fas fa-image"></i><span>发送图片</span></div>
            <div style="margin-bottom: 16px;">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button class="modal-btn modal-btn-secondary upload-mode-btn active" id="upload-image-file-btn" style="flex: 1;">选择文件</button>
            <button class="modal-btn modal-btn-secondary upload-mode-btn" id="paste-image-url-btn" style="flex: 1;">粘贴URL</button>
            </div>
            <input type="file" class="modal-input" id="image-file-input" accept="image/*">
            <input type="text" class="modal-input" id="image-url-input" placeholder="输入图片URL地址" style="display: none;">
            <div id="image-preview" style="text-align: center; margin-top: 10px; display: none;">
            <img id="preview-chat-image" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--border-color);">
            </div>
            </div>
            <div class="modal-buttons">
            <button class="modal-btn modal-btn-secondary" id="cancel-image">取消</button>
            <button class="modal-btn modal-btn-primary" id="send-image" disabled>发送</button>
            </div>
            </div>
            `;

                document.body.appendChild(modal);


                setTimeout(() => {
                    modal.style.opacity = '1';
                    const content = modal.querySelector('.modal-content');
                    content.style.opacity = '1';
                    content.style.transform = 'translateY(0)';
                }, 10);

                const fileInput = document.getElementById('image-file-input');
                const urlInput = document.getElementById('image-url-input');
                const uploadBtn = document.getElementById('upload-image-file-btn');
                const pasteUrlBtn = document.getElementById('paste-image-url-btn');
                const previewDiv = document.getElementById('image-preview');
                const previewImg = document.getElementById('preview-chat-image');
                const sendBtn = document.getElementById('send-image');
                const cancelBtn = document.getElementById('cancel-image');
                const uploadModeBtns = document.querySelectorAll('.upload-mode-btn');

                let currentImageData = null;


                function switchUploadMode(isFileMode) {
                    uploadModeBtns.forEach(btn => btn.classList.remove('active'));
                    if (isFileMode) {
                        uploadBtn.classList.add('active');
                        fileInput.style.display = 'block';
                        urlInput.style.display = 'none';
                    } else {
                        pasteUrlBtn.classList.add('active');
                        fileInput.style.display = 'none';
                        urlInput.style.display = 'block';
                        urlInput.focus();
                    }

                    previewDiv.style.display = 'none';
                    sendBtn.disabled = true;
                    currentImageData = null;
                }


                uploadBtn.addEventListener('click', () => switchUploadMode(true));


                pasteUrlBtn.addEventListener('click', () => switchUploadMode(false));


                fileInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.size > MAX_IMAGE_SIZE) {
                            showNotification('图片大小不能超过5MB', 'error');
                            return;
                        }
                        showNotification('正在优化图片...', 'info', 1500);
                        optimizeImage(file).then(optimizedData => {
                            currentImageData = optimizedData;
                            previewImg.src = currentImageData;
                            previewDiv.style.display = 'block';
                            sendBtn.disabled = false;
                        }).catch(() => {
                            showNotification('图片处理失败', 'error');
                        });
                    }
                });


                urlInput.addEventListener('input',
                    function() {
                        const url = urlInput.value.trim();
                        if (url) {

                            if (/^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|bmp))$/i.test(url)) {
                                previewImg.src = url;
                                previewDiv.style.display = 'block';
                                currentImageData = url;
                                sendBtn.disabled = false;


                                const img = new Image();
                                img.onload = function() {

                                    previewImg.src = url;
                                    showNotification('图片URL有效', 'success', 1000);
                                };
                                img.onerror = function() {
                                    showNotification('图片URL无效或无法访问', 'error');
                                    sendBtn.disabled = true;
                                    previewDiv.style.display = 'none';
                                };
                                img.src = url;
                            } else {
                                sendBtn.disabled = true;
                                previewDiv.style.display = 'none';
                            }
                        } else {
                            sendBtn.disabled = true;
                            previewDiv.style.display = 'none';
                        }
                    });


                sendBtn.addEventListener('click',
                    () => {
                        if (currentImageData) {

                            addMessage({
                                id: Date.now(),
                                sender: 'user',
                                text: '',
                                timestamp: new Date(),
                                image: currentImageData,
                                status: 'sent',
                                favorited: false,
                                note: null,
                                replyTo: currentReplyTo,
                                type: 'normal'
                            });
                            playSound('send');
                            currentReplyTo = null;
                            updateReplyPreview();
                            const delayRange = settings.replyDelayMax - settings.replyDelayMin;
                            const randomDelay = settings.replyDelayMin + Math.random() * delayRange;
                            setTimeout(simulateReply, randomDelay);


                            closeModal();
                        }
                    });


                cancelBtn.addEventListener('click',
                    closeModal);


                function closeModal() {
                    modal.style.opacity = '0';
                    const content = modal.querySelector('.modal-content');
                    content.style.opacity = '0';
                    content.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        if (modal.parentNode) {
                            modal.parentNode.removeChild(modal);
                        }
                    },
                        300);
                }


                modal.addEventListener('click',
                    (e) => {
                        if (e.target === modal) {
                            closeModal();
                        }
                    });


                modal.querySelector('.modal-content').addEventListener('click',
                    (e) => {
                        e.stopPropagation();
                    });


                const handleEscKey = (e) => {
                    if (e.key === 'Escape') {
                        closeModal();
                        document.removeEventListener('keydown', handleEscKey);
                    }
                };
                document.addEventListener('keydown', handleEscKey);


                modal.addEventListener('close', () => {
                    document.removeEventListener('keydown', handleEscKey);
                });
            });


if (DOMElements.imageInput) {
    DOMElements.imageInput.addEventListener('change', () => {
        const file = DOMElements.imageInput.files && DOMElements.imageInput.files[0];
        if (file) {
            if (isBatchMode) {
                showNotification('批量模式不支持图片', 'warning');
                DOMElements.imageInput.value = '';
            } else {
                sendMessage();
            }
        }
    });
}
if (DOMElements.batchBtn) {
    DOMElements.batchBtn.addEventListener('click', () => {
        if (typeof toggleBatchMode === 'function') {
            toggleBatchMode();
        } else {
            showNotification('批量模式功能未定义', 'error');
        }
    });
}


function _applyCollapseState(on) {
    document.body.classList.toggle('bottom-collapse-mode', on);
    const csToggle = document.getElementById('bottom-collapse-cs-toggle');
    if (csToggle) csToggle.classList.toggle('active', on);
    if (!on) {
        const panel = document.getElementById('collapsed-extras-panel');
        if (panel) panel.style.display = 'none';
        const expandBtn = document.getElementById('collapse-expand-btn');
        if (expandBtn) expandBtn.classList.remove('open');
    }
}

window._toggleBottomCollapse = function() {
    const isOn = !document.body.classList.contains('bottom-collapse-mode');
    if (typeof settings !== 'undefined') settings.bottomCollapseMode = isOn;
    _applyCollapseState(isOn);
    if (typeof throttledSaveData === 'function') throttledSaveData();
    if (typeof showNotification === 'function')
        showNotification(isOn ? '底部栏已收纳 — 点击 ⌃ 展开更多' : '已退出收纳模式', 'success', 2000);
};

window.toggleCollapsedExtras = function() {
    const panel = document.getElementById('collapsed-extras-panel');
    const btn = document.getElementById('collapse-expand-btn');
    if (!panel) return;
    const willOpen = panel.style.display === 'none' || panel.style.display === '';
    panel.style.display = willOpen ? 'block' : 'none';
    if (btn) btn.classList.toggle('open', willOpen);

    function wireExtra(extraId, primaryId) {
        const extra = document.getElementById(extraId);
        const primary = document.getElementById(primaryId);
        if (extra && primary && !extra._linked) {
            extra._linked = true;
            extra.addEventListener('click', (e) => { e.stopPropagation(); primary.click(); });
        }
    }
    wireExtra('combo-btn-extra', 'combo-btn');
    wireExtra('batch-btn-extra', 'batch-btn');
};

window.exitCollapseMode = function() {
    if (typeof settings !== 'undefined') settings.bottomCollapseMode = false;
    _applyCollapseState(false);
    if (typeof throttledSaveData === 'function') throttledSaveData();
    if (typeof showNotification === 'function') showNotification('已退出收纳模式', 'success', 2000);
};

(function initCollapseMode() {
    function tryApply() {
        if (typeof settings !== 'undefined') {
            if (settings.bottomCollapseMode) _applyCollapseState(true);
        } else {
            setTimeout(tryApply, 300);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryApply);
    } else {
        setTimeout(tryApply, 400);
    }
})();
}