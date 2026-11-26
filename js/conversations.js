(() => {
    'use strict';

    const $ = id => document.getElementById(id);
    const key = 'multiCharacterConversations';
    const timers = new Map();
    const replyGeneration = new Map();
    const drafts = new Map();
    let data, page, thread, title, screen, writing = Promise.resolve();
    let active = null;
    let defaultBackground = '';
    let listVisible = false;
    let listScreen = false;
    const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
    const primary = () => data?.roles[0];
    const role = id => data?.roles.find(item => item.id === id);
    const current = () => role(data?.selected) || primary();
    const group = id => data?.groups.find(item => item.id === id);
    const conversation = id => role(id) || group(id);
    const isPrimary = id => primary()?.id === id;
    const name = item => item?.members ? item.name : (isPrimary(item?.id) ? settings.partnerName : item?.name) || '梦角';
    const avatar = item => isPrimary(item?.id) ? settings.partnerAvatar || DOMElements.partner.avatar.querySelector('img')?.getAttribute('src') || '' : item?.avatar || '';
    const history = item => isPrimary(item.id) ? messages : item.messages;
    const storedUnread = item => Number.isSafeInteger(item.unread) && item.unread > 0 ? item.unread : 0;
    const unreadCount = item => isPrimary(item.id) ? (window.HomeShell?.nativeUnreadCount?.() || 0) : storedUnread(item);
    const bg = item => item?.background || defaultBackground;
    const notice = (message, type = 'info') => showNotification(message, type);
    const fail = error => { console.error('[消息]', error); notice('操作未完成，请重试。', 'error'); };

    function el(tag, className, value) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (value !== undefined) element.textContent = value;
        return element;
    }

    function button(label, action, className = 'xv-action') {
        const element = el('button', className, label);
        element.type = 'button';
        element.addEventListener('click', () => Promise.resolve().then(action).catch(fail));
        return element;
    }

    function imageBadge(item) {
        const badge = el('span', 'xv-avatar');
        badge.setAttribute('aria-hidden', 'true');
        const src = avatar(item);
        if (src) {
            const img = el('img');
            img.src = src;
            img.alt = '';
            badge.append(img);
        } else if (item?.members) badge.textContent = '群';
        else badge.append(el('i', 'fas fa-user'));
        return badge;
    }

    function persist() {
        const snapshot = JSON.parse(JSON.stringify(data));
        writing = writing.catch(() => {}).then(() => localforage.setItem(getStorageKey(key), snapshot));
        return writing;
    }

    async function init() {
        defaultBackground = await localforage.getItem(getStorageKey('chatBackground')) || safeGetItem(getStorageKey('chatBackground')) || '';
        data = await localforage.getItem(getStorageKey(key));
        const originalCreatedAt = sessionList.find(item => item.id === SESSION_ID)?.createdAt;
        if (data?.roles?.length) {
            const original = role(SESSION_ID);
            if (originalCreatedAt && original && original.createdAt !== originalCreatedAt) {
                original.createdAt = originalCreatedAt;
                await persist();
            }
            return;
        }
        const base = {id: SESSION_ID, createdAt: originalCreatedAt || Date.now(), pinned: false};
        const others = await Promise.all(sessionList.filter(item => item.id !== SESSION_ID).map(async item => {
            const prefix = APP_PREFIX + item.id + '_';
            const [profile, record, image, background] = await Promise.all(
                ['chatSettings', 'chatMessages', 'partnerAvatar', 'chatBackground'].map(suffix => localforage.getItem(prefix + suffix))
            );
            return {
                id: item.id, name: profile?.partnerName || item.name, avatar: image || profile?.partnerAvatar || '',
                createdAt: item.createdAt || Date.now(), messages: record || [], background: background || '', pinned: false
            };
        }));
        data = {roles: [base, ...others], selected: base.id, groups: [], removed: []};
        await persist();
    }

    function mount() {
        if (page || !data) return;
        page = el('section', 'hs-page xv-page');
        page.id = 'xv-messages';
        page.hidden = true;
        document.body.append(page);
        screen = el('div', 'hs-content');
        page.append(screen);
        document.addEventListener('visibilitychange', markActiveRead);
        page.addEventListener('pointerdown', event => {
            if (event.target.closest('.xv-menu, .xv-create-toggle')) return;
            const menu = page.querySelector('.xv-menu');
            if (menu) menu.hidden = true;
            page.querySelector('.xv-create-toggle')?.setAttribute('aria-expanded', 'false');
        });
        title = el('div', '', '');
        title.id = 'xv-chat-title';
        title.hidden = true;
        document.querySelector('.header-inner').append(title);
        thread = el('div', 'chat-container');
        thread.id = 'xv-thread';
        thread.hidden = true;
        thread.setAttribute('role', 'log');
        document.querySelector('.main-chat-area').prepend(thread);
        const more = $('hs-chat-more');
        if (more) {
            more.setAttribute('aria-label', '会话设置');
            more.setAttribute('aria-controls', 'xv-conversation-settings');
            more.removeAttribute('aria-haspopup');
            more.title = '会话设置';
        }
        const hooks = {
            'hs-chat-more': () => openSettings(conversation(active)),
            'send-btn': sendDraft,
            'continue-reply-btn': () => {
                closeReplyMenu();
                const item = conversation(active);
                const ids = item.members || [item.id];
                schedule(item, [ids[Math.floor(Math.random() * ids.length)]]);
            },
            shutUpBtn: () => {
                closeReplyMenu();
                stop(active);
                notice(group(active) ? '已打断群内回复' : '已打断对方回复');
            }
        };
        for (const [id, handler] of Object.entries(hooks)) {
            $(id)?.addEventListener('click', event => {
                if (!active || (id !== 'hs-chat-more' && isPrimary(active))) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                Promise.resolve().then(handler).catch(fail);
            }, true);
        }
        DOMElements.imageInput.addEventListener('change', event => {
            if (!active || isPrimary(active)) return;
            event.stopImmediatePropagation();
            sendDraft().catch(fail);
        }, true);
        $('stats-function')?.addEventListener('click', event => {
            if (data.roles.length < 2) return;
            event.stopImmediatePropagation();
            openStats();
        }, true);
        $('session-manager-btn')?.addEventListener('click', event => {
            event.stopImmediatePropagation();
            openManager();
        }, true);
        const general = $('cs-panel-chat');
        if (general) {
            const caption = el('p', 'xv-hint');
            caption.id = 'xv-primary-label';
            general.prepend(caption);
        }
    }

    function show(route) {
        if (!page) return;
        listVisible = route === 'messages';
        const generalLabel = $('xv-primary-label');
        if (generalLabel) generalLabel.textContent = data.roles.length > 1 ? '总设置管理：' + name(primary()) : '';
        page.hidden = !listVisible;
        if (route !== 'chat') closeThread();
        if (listVisible) renderList();
    }

    function header(label, back) {
        screen.replaceChildren();
        const top = el('header', 'xv-top');
        if (back) {
            const go = button('‹', back, '');
            go.setAttribute('aria-label', '返回');
            top.append(go);
        }
        top.append(el('h1', '', label));
        screen.append(top);
        return top;
    }

    function time(value) {
        const date = new Date(value);
        if (!value || !Number.isFinite(+date)) return '';
        return date.toDateString() === new Date().toDateString()
            ? date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})
            : date.toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric'});
    }

    function latest(item) {
        return history(item).findLast(message => isVisibleChatMessage(message));
    }

    function preview(item, message) {
        if (!message) return '还没有消息';
        if (message.type === 'memory-match-result' && message.memoryMatchResult) {
            const {mode, outcome} = message.memoryMatchResult;
            return [mode, outcome].filter(Boolean).join(' · ') || '[翻牌结果]';
        }
        if (message.type === 'system' && /^\s*</.test(message.text || '')) {
            const template = el('template');
            template.innerHTML = message.text;
            const music = template.content.querySelector('.mi-card');
            if (music) {
                if (music.dataset.miFrom === 'me') return '你发出了一起听邀请';
                const title = music.querySelector('.mi-title')?.textContent.trim();
                return title || name(item) + (music.matches('.mi-reserve') ? ' 预订了下一首' : ' 想和你一起听');
            }
            const avatarCard = template.content.querySelector('.ip-avatar-card');
            if (avatarCard) {
                const title = avatarCard.querySelector('.ip-avatar-card-head')?.textContent || '';
                return name(item) + (title.includes('给你') ? ' 给你换了个新头像' : ' 换了头像');
            }
            if (template.content.firstElementChild) return '[互动卡片]';
        }
        const content = isStickerMessage(message) ? '[表情包]' : message.image ? '[图片]' : message.type === 'voice' ? '[语音]' : message.text || '[消息]';
        if (!item.members || !message.sender || message.sender === 'system') return content;
        return (message.sender === 'user' ? settings.myName || '我' : message.author || message.sender) + '：' + content;
    }

    function renderList() {
        if (!screen || !listVisible) return;
        listScreen = true;
        const top = header('消息');
        const menu = el('div', 'xv-menu');
        menu.id = 'xv-create-menu';
        menu.hidden = true;
        const setMenu = open => {
            menu.hidden = !open;
            plus.setAttribute('aria-expanded', String(open));
        };
        const plus = button('', () => setMenu(menu.hidden), 'xv-create-toggle');
        plus.append(el('i', 'fas fa-plus'));
        plus.setAttribute('aria-label', '新建');
        plus.setAttribute('aria-controls', menu.id);
        plus.setAttribute('aria-expanded', 'false');
        const options = [
            ['创建角色', 'fa-user-plus', createRole],
            ['创建群聊', 'fa-users', () => pickMembers(null, renderList)]
        ];
        for (const [label, icon, action] of options) {
            const entry = button('', () => { setMenu(false); return action(); }, 'xv-menu-entry');
            entry.append(el('i', 'fas ' + icon), el('span', '', label));
            menu.append(entry);
        }
        top.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || menu.hidden) return;
            setMenu(false);
            plus.focus();
        });
        top.append(plus, menu);
        const list = el('div', 'xv-list');
        const items = [...data.roles, ...data.groups].map(item => ({item, last: latest(item)}));
        items.sort((a, b) => Number(b.item.pinned) - Number(a.item.pinned) ||
            (new Date(b.last?.timestamp || b.item.createdAt) - new Date(a.last?.timestamp || a.item.createdAt)));
        for (const {item, last} of items) {
            const row = button('', () => openThread(item), 'xv-row');
            if (item.pinned) row.dataset.pinned = '';
            const copy = el('span', 'xv-copy');
            copy.append(el('strong', '', name(item)), el('small', '', preview(item, last)));
            const portrait = el('span', 'xv-row-avatar');
            portrait.append(imageBadge(item));
            const count = unreadCount(item);
            if (count) {
                const badge = el('span', 'hs-badge xv-unread', count > 99 ? '99+' : count);
                badge.setAttribute('role', 'img');
                badge.setAttribute('aria-label', count + ' 条未读消息');
                portrait.append(badge);
            }
            row.append(portrait, copy, el('small', '', time(last?.timestamp)));
            list.append(row);
        }
        screen.append(list);
    }

    async function createRole() {
        const {root, body} = detail('xv-create-role', '创建角色');
        const input = field(body, '梦角名称', 'text', '');
        input.maxLength = 80;
        body.append(button('创建', async () => {
            const name = input.value.trim();
            if (!name) return notice('请输入梦角名称。', 'warning');
            const created = {id: uid(), name, avatar: '', messages: [], createdAt: Date.now(), pinned: false};
            data.roles.push(created);
            await persist();
            hideModal(root);
            openThread(created);
        }, 'xv-action xv-primary'));
        showModal(root);
    }

    function pickMembers(item, back, place = screen) {
        if (place === screen) {
            listScreen = false;
            header('选择群成员', back);
        }
        const selected = new Set();
        const minimum = item ? 1 : 2;
        const available = data.roles.filter(candidate => !item?.members.includes(candidate.id))
            .sort((a, b) => name(a).localeCompare(name(b), 'zh-CN'));
        const list = el('div', 'xv-list');
        const confirmMembers = button('确定（0）', async () => {
            if (selected.size < minimum) return;
            const ids = [...selected];
            const joined = ids.map(id => name(role(id)));
            if (item) {
                item.members.push(...ids);
                await append(item, {sender: null, text: '你邀请' + joined.join('、') + '加入了群聊'});
                back();
                return;
            }
            const created = {
                id: uid(), name: [settings.myName || '我', ...joined.slice(0, 2)].join('、'),
                members: ids, messages: [], createdAt: Date.now(), pinned: false
            };
            data.groups.push(created);
            await append(created, {sender: null, text: '你邀请' + joined.join('、') + '加入了群聊'});
            openThread(created);
        }, 'xv-action xv-primary');
        confirmMembers.disabled = true;
        for (const candidate of available) {
            const label = el('label', 'xv-row');
            const check = el('input');
            check.type = 'checkbox';
            check.addEventListener('change', () => {
                if (check.checked) selected.add(candidate.id);
                else selected.delete(candidate.id);
                confirmMembers.textContent = '确定（' + selected.size + '）';
                confirmMembers.disabled = selected.size < minimum;
            });
            label.append(check, imageBadge(candidate), el('span', '', name(candidate)));
            list.append(label);
        }
        if (available.length < minimum) list.prepend(el('p', 'xv-hint', item ? '所有梦角都已在群中。' : '至少需要两位梦角。请先创建角色。'));
        place.append(list, confirmMembers);
    }

    function closeReplyMenu() {
        $('continue-sub-btns')?.classList.remove('active');
        $('chat-media-panel').hidden = true;
        $('chat-media-toggle').setAttribute('aria-expanded', 'false');
        $('user-sticker-picker')?.classList.remove('active');
    }

    function openThread(item) {
        if (!item) return;
        if (active && active !== item.id) closeThread();
        active = item.id;
        DOMElements.messageInput.value = drafts.get(item.id) || '';
        DOMElements.messageInput.style.height = '';
        closeReplyMenu();
        currentReplyTo = null;
        updateReplyPreview();
        window.HomeShell.navigate('chat');
        if (!isPrimary(item.id)) {
            document.body.dataset.xvThread = item.members ? 'group' : 'single';
            title.hidden = thread.hidden = false;
            renderTitle(item);
            renderThread();
            scrollThreadToEnd();
            markActiveRead();
        }
        applyThreadBackground();
    }

    function renderTitle(item) {
        title.replaceChildren(imageBadge(item), el('span', '', name(item)));
    }

    function closeThread() {
        if (!active) return;
        drafts.set(active, DOMElements.messageInput.value);
        DOMElements.messageInput.value = '';
        DOMElements.messageInput.style.height = '';
        closeReplyMenu();
        active = null;
        delete document.body.dataset.xvThread;
        title.hidden = thread.hidden = true;
        applyThreadBackground();
    }

    function applyThreadBackground() {
        const value = bg(conversation(active));
        if (value) applyBackground(value);
        else {
            document.documentElement.style.removeProperty('--chat-bg-image');
            document.body.classList.remove('with-background');
        }
    }

    function renderThread() {
        const item = conversation(active);
        if (!item || isPrimary(item.id)) return;
        const nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 110;
        const typing = !item.members && timers.get(item.id)?.size && settings.typingIndicatorEnabled;
        const fragment = new DocumentFragment();
        const spacer = el('div', 'xv-chat-spacer');
        fragment.append(spacer);
        const entries = item.messages.filter(isVisibleChatMessage);
        const lastSender = {current: null};
        const view = {
            group: Boolean(item.members),
            author(message) {
                const sender = item.members ? role(message.roleId) : item;
                return sender ? {name: name(sender), avatar: avatar(sender)} :
                    {name: message.author || message.sender, avatar: message.avatar};
            },
            systemText: message => preview(item, message)
        };
        if (!entries.length) fragment.append(el('p', 'system-message', '说点什么，让对话开始吧'));
        entries.forEach((entry, index) => {
            fragment.append(createMessageFragment(entry, entries[index - 1], entries[index + 1], lastSender, view));
        });
        if (typing) {
            const indicator = el('div', 'typing-indicator xv-typing');
            indicator.setAttribute('role', 'status');
            const badge = imageBadge(item);
            badge.className = 'typing-indicator-avatar';
            const dots = el('div', 'typing-dots');
            dots.setAttribute('aria-hidden', 'true');
            dots.append(el('div', 'typing-dot'), el('div', 'typing-dot'), el('div', 'typing-dot'));
            indicator.append(badge, el('span', 'typing-indicator-label', name(item) + ' 正在输入'), dots);
            fragment.append(indicator);
        }
        thread.replaceChildren(fragment);
        if (nearBottom) scrollThreadToEnd();
    }

    function scrollThreadToEnd() {
        thread.scrollTo({top: thread.scrollHeight, behavior: 'instant'});
    }

    function markActiveRead() {
        const item = conversation(active);
        if (document.hidden || document.body.dataset.hsPage !== 'chat' || !item || isPrimary(item.id) ||
            window.HomeShell?.isViewingConversation?.(item.id) === false || !storedUnread(item)) return;
        item.unread = 0;
        window.HomeShell?.refreshUnread?.();
        persist().catch(fail);
    }

    async function append(item, message) {
        if (conversation(item.id) !== item) return;
        const entry = {id: uid(), timestamp: new Date().toISOString(), type: 'normal', ...message};
        item.messages.push(entry);
        const shown = window.HomeShell?.isViewingConversation?.(item.id) ??
            (active === item.id && document.body.dataset.hsPage === 'chat' && !document.hidden);
        if (!shown && window.HomeShell?.isIncoming?.(entry)) {
            item.unread = storedUnread(item) + 1;
            window.HomeShell.refreshUnread?.();
        }
        window.HomeShell?.onConversationMessage?.(entry, describeMessage(entry, item));
        if (active === item.id) renderThread();
        if (listVisible && listScreen) renderList();
        await persist();
    }

    function describeMessage(message, item = primary()) {
        if (!item) return null;
        return {id: item.id, name: name(item), avatar: avatar(item), text: preview(item, message)};
    }

    async function sendDraft() {
        const item = conversation(active);
        const input = DOMElements.messageInput;
        const imageInput = DOMElements.imageInput;
        const text = input.value.trim();
        const file = imageInput.files[0];
        if (!item || (!text && !file)) return;
        const generation = replyGeneration.get(item.id);
        imageInput.value = '';
        if (file && (!file.type.startsWith('image/') || file.size > MAX_IMAGE_SIZE)) {
            notice('请选择不超过 5 MB 的图片。', 'warning');
            return;
        }
        const image = file ? await optimizeImage(file) : '';
        if (active === item.id && input.value.trim() === text) {
            input.value = '';
            input.style.height = '';
        }
        if (conversation(item.id) !== item) return;
        await append(item, {sender: 'user', text, image});
        if (active === item.id) scrollThreadToEnd();
        playSound('send');
        if (replyGeneration.get(item.id) === generation) schedule(item, item.members || [item.id]);
    }

    function schedule(item, ids) {
        const pending = timers.get(item.id) || new Map();
        timers.set(item.id, pending);
        const low = Math.max(0, Number(settings.replyDelayMin) || 0);
        const high = Math.max(low, Number(settings.replyDelayMax) || low);
        let disabled = [];
        try { disabled = JSON.parse(localStorage.getItem('disabledReplyItems') || '[]'); } catch {}
        const pool = customReplies.filter(text => typeof text === 'string' && text.trim() && !disabled.includes(text));
        for (const id of ids) {
            if (!role(id)) continue;
            clearTimeout(pending.get(id));
            const timer = setTimeout(() => {
                pending.delete(id);
                if (!pending.size) timers.delete(item.id);
                const speaker = role(id);
                if (!speaker || conversation(item.id) !== item) return;
                for (const message of item.messages) if (message.sender === 'user') message.status = 'read';
                const text = pool[Math.floor(Math.random() * pool.length)] || '我在听。';
                const partnerEmotion = window.MomentStatus?.pickReplyEmotion?.();
                append(item, {sender: name(speaker), roleId: id, author: name(speaker), avatar: avatar(speaker), text, partnerEmotion}).catch(fail);
                const stickers = window.StickerAssets?.available(id) || [];
                if (stickers.length && Math.random() < 0.2) {
                    append(item, {sender: name(speaker), roleId:id, author:name(speaker), avatar:avatar(speaker),
                        image:stickers[Math.floor(Math.random() * stickers.length)], type:'sticker', isSticker:true}).catch(fail);
                }
                if (active === item.id) playSound('message');
            }, low + Math.random() * (high - low));
            pending.set(id, timer);
        }
        if (active === item.id) renderThread();
    }

    function sendFromComposer(message, id = active) {
        const item = conversation(id);
        if (!item || isPrimary(item.id)) return false;
        const generation = replyGeneration.get(item.id);
        append(item, message).then(() => {
            if (conversation(item.id) !== item) return;
            if (active === item.id) scrollThreadToEnd();
            playSound('send');
            if (replyGeneration.get(item.id) === generation) schedule(item, item.members || [item.id]);
        }).catch(fail);
        return true;
    }

    function stop(id, member) {
        if (!member) replyGeneration.set(id, (replyGeneration.get(id) || 0) + 1);
        const pending = timers.get(id);
        if (!pending) return;
        if (member) {
            clearTimeout(pending.get(member));
            pending.delete(member);
        } else {
            for (const timer of pending.values()) clearTimeout(timer);
            pending.clear();
        }
        if (!pending.size) timers.delete(id);
        if (active === id) renderThread();
    }

    function modal(id, label) {
        let root = $(id);
        if (!root) {
            root = el('div', 'modal');
            root.id = id;
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'true');
            root.append(el('div', 'modal-content'));
            document.body.append(root);
        }
        root.setAttribute('aria-label', label);
        const content = root.firstElementChild;
        content.replaceChildren(el('div', 'modal-title', label));
        const body = el('div', 'xv-settings');
        content.append(body, button('关闭', () => hideModal(root)));
        return {root, body};
    }

    function detail(id, label) {
        let root = $(id);
        if (!root) {
            root = el('section', 'modal hs-settings-detail xv-detail');
            root.id = id;
            root.append(el('div', 'modal-content'));
            root.addEventListener('keydown', event => {
                if (event.key !== 'Escape') return;
                event.stopPropagation();
                hideModal(root);
            });
            document.body.append(root);
        }
        root.setAttribute('aria-label', label);
        const back = button('‹', () => hideModal(root), 'hs-setting-back');
        back.setAttribute('aria-label', '返回上一级');
        const bar = el('header', 'hs-setting-top');
        bar.append(back, el('span', '', label));
        const body = el('div', 'xv-settings');
        root.firstElementChild.replaceChildren(bar, body);
        return {root, body};
    }

    function field(body, label, type, value) {
        const wrapper = el('label', '', label);
        const input = el('input');
        input.type = type;
        if (type === 'file') input.accept = 'image/*';
        else input.value = value;
        wrapper.append(input);
        body.append(wrapper);
        return input;
    }

    function openSettings(item) {
        if (!item) return;
        const grouped = Boolean(item.members);
        const {root, body} = detail('xv-conversation-settings', grouped ? '群聊设置' : '单聊设置');
        if (grouped) {
            const members = el('div', 'xv-members' + (settings.myAvatarShape === 'square' ? ' xv-square' : ''));
            const me = {name: settings.myName || '我', avatar: settings.myAvatar};
            for (const member of [me, ...item.members.map(role).filter(Boolean)]) {
                const cell = el('div', 'xv-member');
                cell.append(imageBadge(member), el('span', '', name(member)));
                members.append(cell);
            }
            const cell = el('div', 'xv-member');
            const add = button('+', () => {
                const picker = detail('xv-add-members', '选择群成员');
                pickMembers(item, () => { hideModal(picker.root); openSettings(item); }, picker.body);
                showModal(picker.root);
            }, 'xv-avatar');
            add.setAttribute('aria-label', '添加群成员');
            cell.append(add, el('span', '', '添加成员'));
            members.append(cell);
            body.append(members);
        }
        body.append(el('h2', '', '基本设置'));
        const nickname = field(body, grouped ? '群名称' : '名称', 'text', name(item));
        nickname.maxLength = 80;
        const photo = field(body, grouped ? '群头像' : '头像', 'file');
        let removeAvatar = false;
        if (grouped && item.avatar) {
            const preview = imageBadge(item);
            photo.parentElement.prepend(preview);
            const reset = button('恢复默认群头像', () => {
                removeAvatar = true;
                photo.value = '';
                preview.remove();
                reset.hidden = true;
            });
            body.append(reset);
        }
        body.append(el('h2', '', '对话设置'));
        const syncPin = () => {
            pin.setAttribute('aria-checked', String(item.pinned));
            pin.classList.toggle('active', item.pinned);
        };
        const pin = button('', async () => {
            if (pin.disabled) return;
            pin.disabled = true;
            item.pinned = !item.pinned;
            syncPin();
            try { await persist(); }
            catch (error) { item.pinned = !item.pinned; syncPin(); throw error; }
            finally { pin.disabled = false; }
        }, 'setting-pill-row xv-pin');
        pin.setAttribute('role', 'switch');
        const track = el('span', 'setting-pill-switch');
        track.setAttribute('aria-hidden', 'true');
        track.append(el('span', 'setting-pill-knob'));
        pin.append(el('span', 'setting-pill-label', '置顶聊天'), track);
        syncPin();
        body.append(pin, button('聊天选项', () => window.HomeShell.openChatDisplay()));
        const background = field(body, '聊天背景', 'file');
        body.append(el('p', 'xv-hint', item.background ? '当前使用会话专属背景。' : '当前使用总设置中的默认背景。'));
        if (item.background) body.append(button('恢复默认背景', async () => {
            item.background = '';
            await persist();
            applyThreadBackground();
            openSettings(item);
        }));
        body.append(button('保存设置', async () => {
            const value = nickname.value.trim();
            if (!value) return notice('名称不能为空。', 'warning');
            const [nextAvatar, nextBg] = await Promise.all([
                photo?.files[0] ? optimizeImage(photo.files[0], 320) : null,
                background.files[0] ? optimizeImage(background.files[0], 1280) : null
            ]);
            if (conversation(item.id) !== item) return;
            if (isPrimary(item.id)) await updatePrimary(value, nextAvatar ?? avatar(item));
            else {
                item.name = value;
                if (nextAvatar) item.avatar = nextAvatar;
                else if (removeAvatar) item.avatar = '';
            }
            if (nextBg) item.background = nextBg;
            if (active === item.id) renderTitle(item);
            await persist();
            applyThreadBackground();
            window.HomeShell.refresh();
            hideModal(root);
        }, 'xv-action xv-primary'));
        body.append(el('h2', '', '其他设置'));
        body.append(button('清空聊天记录', async () => {
            if (!confirm('清空「' + name(item) + '」的聊天记录？会话和设置会保留。')) return;
            stop(item.id);
            if (isPrimary(item.id)) {
                clearTimeout(window._pendingReplyTimer);
                window._pendingReplyTimer = null;
                window.cancelPartnerReply?.();
                messages = [];
                window.HomeShell?.setNativeUnread?.();
                displayedMessageCount = HISTORY_BATCH_SIZE;
                renderMessages();
                await saveData();
            } else {
                item.messages = [];
                item.unread = 0;
                window.HomeShell?.refreshUnread?.();
                await persist();
                renderThread();
            }
            hideModal(root);
        }, 'xv-action xv-danger'));
        if (grouped) body.append(button('解散群聊', async () => {
            if (!confirm('解散「' + name(item) + '」？群聊及其聊天记录将被移除。')) return;
            removeGroup(item.id);
            await persist();
            hideModal(root);
            window.HomeShell.navigate('messages');
        }, 'xv-action xv-danger'));
        showModal(root);
    }

    async function updatePrimary(value, photo) {
        settings.partnerName = value;
        settings.partnerAvatar = photo;
        localStorage.setItem('partnerName', value);
        localStorage.removeItem('partnerAvatar');
        updateAvatar(DOMElements.partner.avatar, photo);
        updateUI();
        renderMessages();
        await saveData();
    }

    function removeGroup(id) {
        stop(id);
        drafts.delete(id);
        data.groups = data.groups.filter(item => item.id !== id);
        window.HomeShell?.refreshUnread?.();
    }

    function openManager() {
        const {root, body} = detail('xv-manage', '会话管理');
        for (const item of data.roles) {
            const row = el('div', 'xv-row');
            const copy = el('span', 'xv-copy');
            copy.append(el('strong', '', name(item)));
            if (item.createdAt) {
                const date = new Date(item.createdAt);
                if (Number.isFinite(+date)) {
                    const created = el('time', 'xv-meta', '创建于 ' + date.toLocaleDateString('zh-CN'));
                    created.dateTime = date.toISOString();
                    copy.append(created);
                }
            }
            if (isPrimary(item.id)) copy.append(el('small', '', '总设置管理的梦角'));
            row.append(imageBadge(item), copy);
            if (data.roles.length > 1) row.append(button('删除角色', () => deleteRole(item), 'xv-action xv-danger'));
            body.append(row);
        }
        showModal(root);
    }

    async function deleteRole(item) {
        if (data.roles.length < 2 || !role(item.id)) return;
        const affected = data.groups.filter(group => group.members.includes(item.id));
        const descriptions = affected.map(group => group.name + (group.members.length === 2 ? '（将解散）' : '（移除该成员）'));
        if (!confirm('删除「' + name(item) + '」及其单聊记录？' +
            (descriptions.length ? '\n受影响的群聊：\n' + descriptions.join('\n') : ''))) return;
        const promote = isPrimary(item.id);
        data.removed ||= [];
        data.removed.push({id: item.id, name: name(item)});
        stop(item.id);
        if (promote) {
            clearTimeout(window._pendingReplyTimer);
            window._pendingReplyTimer = null;
            window.cancelPartnerReply?.();
        }
        for (const group of affected) {
            if (group.members.length === 2) removeGroup(group.id);
            else {
                stop(group.id, item.id);
                group.members = group.members.filter(id => id !== item.id);
            }
        }
        data.roles = data.roles.filter(candidate => candidate.id !== item.id);
        if (data.selected === item.id) data.selected = primary().id;
        if (promote) {
            const next = primary();
            messages = next.messages || [];
            const count = storedUnread(next);
            window.HomeShell?.setNativeUnread?.(count ? messages.filter(window.HomeShell.isIncoming).slice(-count) : []);
            delete next.unread;
            displayedMessageCount = HISTORY_BATCH_SIZE;
            await updatePrimary(next.name, next.avatar || '');
            delete next.messages;
        }
        drafts.delete(item.id);
        window.HomeShell?.refreshUnread?.();
        await persist();
        show('settings');
        window.HomeShell.refresh();
        openManager();
    }

    function groupStats(item) {
        const me = { label: (settings.myName || '我') + '（我）', total: 0 };
        const members = new Map(item.members.map(id => [id, {
            label: role(id) ? name(role(id)) : '已移除成员', total: 0
        }]));
        const membersByName = new Map();
        for (const member of members.values()) {
            membersByName.set(member.label, membersByName.has(member.label) ? null : member);
        }
        const former = new Map();
        const entries = history(item).filter(countsAsChatMessage);
        for (const message of entries) {
            let person = me;
            if (message.sender !== 'user') {
                const label = message.author || message.sender;
                person = message.roleId ? members.get(message.roleId) : membersByName.get(label);
                if (!person) {
                    const key = message.roleId || label;
                    if (!former.has(key)) former.set(key, { label, total: 0 });
                    person = former.get(key);
                }
            }
            person.total++;
        }
        return { total: entries.length, people: [me, ...members.values(), ...former.values()] };
    }

    function openStats() {
        const {root, body} = modal('xv-message-stats', '消息统计');
        body.append(el('h3', 'xv-stats-heading', '群聊'));
        if (!data.groups.length) body.append(el('p', 'xv-hint', '还没有群聊'));
        for (const item of data.groups) {
            const {total, people} = groupStats(item);
            const details = el('details', 'xv-stats-group');
            details.open = item.id === active || data.groups.length === 1;
            const summary = el('summary');
            summary.append(el('strong', '', name(item)), el('span', 'xv-hint', `共 ${total} 条`));
            const list = el('ul', 'xv-stats-members');
            for (const person of people) {
                const row = el('li');
                row.append(el('span', '', person.label), el('span', 'xv-hint', `${person.total} 条`));
                list.append(row);
            }
            details.append(summary, list);
            body.append(details);
        }

        body.append(el('h3', 'xv-stats-heading', '单聊'));
        for (const item of data.roles) {
            const entries = history(item).filter(countsAsChatMessage);
            const sent = entries.filter(message => message.sender === 'user').length;
            const row = el('div', 'xv-stats-single');
            row.append(el('strong', '', name(item)), el('span', 'xv-hint', `发出 ${sent} 条 · 收到 ${entries.length - sent} 条`));
            body.append(row);
        }
        showModal(root);
    }

    function mountRelationship(container) {
        if (!data || data.roles.length < 2) return;
        const wrapper = el('label', '', '首页梦角');
        const select = el('select');
        for (const item of data.roles) {
            const option = el('option', '', name(item));
            option.value = item.id;
            select.append(option);
        }
        select.value = current().id;
        select.onchange = () => {
            data.selected = select.value;
            checkPartnerDailyMood();
            window.HomeShell.refresh();
            persist().catch(fail);
        };
        wrapper.append(select);
        container.prepend(wrapper);
    }

    function choose(label) {
        if (!data || data.roles.length === 1) return Promise.resolve(primary() ? {id: primary().id, name: name(primary())} : null);
        return new Promise(resolve => {
            const {root, body} = modal('xv-choose-role', label);
            root.querySelector('.modal-content > button').onclick = () => resolve(null);
            for (const item of data.roles) {
                const choice = button('', () => {
                    hideModal(root);
                    resolve({id: item.id, name: name(item)});
                }, 'xv-row');
                choice.append(imageBadge(item), el('span', '', name(item)));
                body.append(choice);
            }
            showModal(root);
        });
    }

    function addToSingle(id, message) {
        const item = id ? role(id) : primary();
        if (!item) return;
        if (isPrimary(item.id)) {
            addMessage({id: Date.now() + Math.random(), timestamp: new Date(), type: 'normal', ...message});
            return;
        }
        append(item, {...message, roleId: message.sender === 'user' ? undefined : item.id}).catch(fail);
    }

    window.XavierConversations = {
        init, mount, show, openNative: () => openThread(primary()), mountRelationship,
        homeProfile: () => current() ? {...settings, partnerName: name(current()), partnerAvatar: avatar(current())} : settings,
        homeKey: value => current()?.id && current().id !== SESSION_ID ? value + ':' + current().id : value,
        defaultBackgroundChanged: value => { defaultBackground = value; applyThreadBackground(); },
        onNativeMessage: () => { if (listVisible && listScreen) renderList(); },
        otherUnreadCount: () => {
            if (!data) return 0;
            return [...data.roles.slice(1), ...data.groups].reduce((sum, item) => sum + storedUnread(item), 0);
        },
        describeMessage,
        openById: id => { const item = conversation(id); if (!item) return false; openThread(item); return true; },
        isViewingAdditionalConversation: () => Boolean(active && !isPrimary(active)),
        profiles: () => data?.roles.map(item => ({id: item.id, name: name(item), avatar: avatar(item)})) || [],
        primaryId: () => primary()?.id,
        homeId: () => current()?.id,
        openConversationId: () => active,
        profile: id => role(id) ? {id, name: name(role(id)), avatar: avatar(role(id))} : null,
        updateAppearance: async (id, kind, value) => {
            const item = role(id);
            if (!item) return;
            if (isPrimary(id)) await updatePrimary(kind === 'name' ? value : name(item), kind === 'avatar' ? value : avatar(item));
            else {
                item[kind === 'avatar' ? 'avatar' : 'name'] = value;
                await persist();
                if (active === id) { renderTitle(item); renderThread(); }
            }
            window.HomeShell?.refresh();
            if (listVisible && listScreen) renderList();
        },
        activeId: () => active && role(active) ? active : current()?.id,
        choose, addToSingle, sendFromComposer
    };
})();
