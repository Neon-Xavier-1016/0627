(function () {
    'use strict';

    const places = [
        { label: '家', emoji: '🏠' }, { label: '学校', emoji: '🏫' },
        { label: '公司', emoji: '🏢' }, { label: '医院', emoji: '🏥' },
        { label: '公园', emoji: '🌳' }
    ];
    const responses = {
        happy: ['看你开心，我也跟着开心了。', '这份开心可以多留一会儿。'],
        excited: ['光看你的消息，我都跟着期待起来了。', '快让我也沾一点你的兴奋。'],
        peace: ['这样平平淡淡的也挺舒服。', '那就一起安安静静待会儿。'],
        sad: ['我在这儿，想说的话可以慢慢说。', '今天要是不好过，就先歇一会儿。'],
        tired: ['先把手里的事放一放，歇口气吧。', '今天已经很努力了，别硬撑。'],
        angry: ['我听着呢，想吐槽就说。', '生气也没关系，先把自己照顾好。'],
        love: ['刚好，我也在想你。', '看到这条，我想离你再近一点。'],
        busy: ['你忙你的，有空再回来就好。', '记得给自己留一点喘气的时间。'],
        sleepy: ['困了就去眯一会儿，我等你。', '那先睡吧，醒了再说。'],
        lonely: ['我陪你待会儿。', '要是想找个人听你说话，我在。'],
        cool: ['看出来了，今天走的是酷酷路线。', '行，今天的潇洒劲儿分我一点。'],
        cute: ['好，给你抱一会儿。', '就知道你这招对我有用。']
    };
    const questions = {
        mood: ['你现在心情怎么样？', '这会儿过得还好吗？'],
        place: ['你现在在哪里呀？', '这会儿在哪儿呢？'],
        both: ['想知道你在哪儿，也想知道你今天过得怎么样。', '现在在哪里呀？心情还好吗？']
    };

    const pick = array => array[Math.floor(Math.random() * array.length)];
    const byId = id => document.getElementById(id);
    const dateOf = value => formatDateStr(new Date(value));
    const day = () => dateOf(Date.now());
    const chat = () => typeof messages === 'undefined' ? [] : messages;
    const partner = () => settings.partnerName || '对方';
    const key = () => getStorageKey('momentStatus');
    const minute = 60_000;
    const mealShareChance = .45;

    function prefs() {
        try { return JSON.parse(localStorage.getItem(key()) || '{}') || {}; }
        catch { return {}; }
    }

    function store(patch) {
        try {
            localStorage.setItem(key(), JSON.stringify({ ...prefs(), ...patch }));
            return true;
        } catch { return false; }
    }

    function dailyLimit(value, fallback) {
        return Number.isInteger(value) ? Math.min(14, Math.max(0, value)) : fallback;
    }

    function el(tag, text, className) {
        const node = document.createElement(tag);
        if (text) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function button(text, handler, primary = false) {
        const node = el('button', text, 'modal-btn modal-btn-' + (primary ? 'primary' : 'secondary'));
        node.type = 'button';
        node.onclick = handler;
        return node;
    }

    function id() {
        return Date.now() + Math.random();
    }

    function publish(sender, type, text, data) {
        const message = { id: id(), sender, type, text, timestamp: new Date(), statusMoment: data };
        if (sender === 'user') message.status = 'sent';
        addMessage(message);
        return message;
    }

    function answerText(data) {
        return [data.note, data.mood && ('心情：' + data.mood.label), data.place && ('地点：' + data.place.label), data.meal].filter(Boolean).join('\n');
    }

    function emotionLine(label, tagged) {
        const line = el('div', '', 'status-moment-emotion');
        if (tagged) line.append(el('span', '情绪：', 'status-moment-emotion-label'));
        line.append(el('b', label));
        return line;
    }

    function appendEmotion(bubble, label) {
        const caption = el('div', '', 'status-moment-reply-emotion');
        caption.append(emotionLine(label, true));
        bubble.append(caption);
    }

    // A burst of replies gradually uses fewer labels until the conversation pauses.
    const defaultEmotionRate = 70;
    const emotionOdds = [70, 60, 45, 30, 20];
    let emotionSession, emotionStreak = 0, lastEmotionAt = 0;

    function savedEmotionRate() {
        const rate = prefs().emotionRate;
        return Number.isInteger(rate) ? Math.max(0, Math.min(100, rate)) : defaultEmotionRate;
    }

    function updateEmotionSettingLabel() {
        const range = byId('moment-emotion-rate'), output = byId('moment-emotion-rate-value');
        if (range && output) output.value = range.value + '%';
    }

    function syncEmotionSetting() {
        const range = byId('moment-emotion-rate');
        if (!range || !SESSION_ID) return;
        range.value = String(savedEmotionRate());
        updateEmotionSettingLabel();
    }

    function bindEmotionSetting() {
        const range = byId('moment-emotion-rate');
        if (!range) return;
        range.addEventListener('input', updateEmotionSettingLabel);
        range.addEventListener('change', () => {
            if (SESSION_ID && store({ emotionRate: Number(range.value) })) return;
            syncEmotionSetting();
            showNotification('情绪标签概率保存失败', 'warning');
        });
    }
    function pickReplyEmotion() {
        const now = Date.now();
        if (emotionSession !== SESSION_ID || now - lastEmotionAt >= 10 * minute) emotionStreak = 0;
        emotionSession = SESSION_ID;
        const odds = emotionOdds[Math.min(emotionStreak, emotionOdds.length - 1)] / defaultEmotionRate;
        if (Math.random() * 100 >= savedEmotionRate() * odds) return undefined;
        const mood = window.WydMeal?.currentMood?.();
        if (!mood?.label) return undefined;
        lastEmotionAt = now;
        emotionStreak++;
        return mood.label;
    }

    function renderCard(data) {
        const card = el('div', '', 'status-moment-card');
        const both = data.mood && data.place;
        if (both) card.append(el('strong', '此刻状态'));
        if (data.mood) {
            const mood = emotionLine(data.mood.label, both || data.note);
            if (both) {
                card.append(mood);
                if (data.note) card.append(el('p', '留言：' + data.note));
            } else {
                card.append(data.note ? el('p', data.note) : el('strong', '心情'), el('hr'), mood);
            }
        }
        if (data.place) {
            if (!both) card.append(el('strong', '地点'));
            card.append(el('hr'));
            const map = el('div', '', 'status-moment-map'), pin = el('span', '📍', 'status-moment-pin');
            pin.setAttribute('aria-hidden', 'true');
            map.append(pin, el('b', [data.place.emoji, data.place.label].filter(Boolean).join(' ')));
            card.append(map);
        }
        if (data.meal) card.append(el('strong', '刚吃了这些'), el('hr'), el('p', data.meal));
        return card;
    }

    function renderMessage(message) {
        return message.type === 'status-moment' && message.statusMoment ? renderCard(message.statusMoment) : null;
    }

    let ui, draft, request, tab, session, returnFocus;

    function init() {
        bindEmotionSetting();
        const entry = byId('chat-moment-status-btn');
        if (!entry) return;
        const modal = el('div', '', 'modal');
        modal.id = 'moment-status-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'moment-status-title');
        const content = el('div', '', 'modal-content');
        const head = el('div', '', 'status-moment-head'), title = el('div', '此刻状态', 'modal-title');
        title.id = 'moment-status-title';
        const close = button('×', dismiss);
        close.classList.add('status-moment-close');
        close.setAttribute('aria-label', '关闭此刻状态');
        head.append(title, close);
        const tabs = el('div', '', 'status-moment-tabs');
        const body = el('div', '', 'status-moment-body');
        const footer = el('div', '', 'status-moment-footer');
        const back = button('上一步', () => changeStep('mood'));
        const send = button('发送', submit, true);
        footer.append(back, send);
        content.append(head, tabs, body, footer);
        modal.append(content);
        document.body.append(modal);
        ui = { modal, title, tabs, body, back, send, close };
        entry.onclick = () => open();
        modal.onclick = event => { if (event.target === modal) dismiss(); };
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.stopPropagation(); dismiss(); }
        });
        setInterval(tick, 45 * 1000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    }

    function dismiss() {
        const target = returnFocus;
        draft = request = returnFocus = null;
        ui.modal.inert = true;
        hideModal(ui.modal);
        if (target?.isConnected) target.focus({ preventScroll: true });
    }

    function open(question = null) {
        if (!ui || !SESSION_ID) return;
        session = SESSION_ID;
        request = question;
        returnFocus = question ? document.activeElement : byId('chat-media-toggle');
        ui.modal.inert = false;
        ui.modal.classList.toggle('is-answering', Boolean(question));
        ui.title.textContent = question ? ({ mood: '心情怎么样', place: '此刻在哪里', both: '回此刻状态' })[question.ask] : '此刻状态';
        draft = { mood: null, place: null, note: '' };
        tab = question?.ask === 'place' ? 'place' : 'mood';
        render();
        showModal(ui.modal, ui.close);
    }

    function changeStep(next) {
        tab = next;
        render(true);
        ui.body.querySelector('button')?.focus();
    }

    function optionsGrid(items, chosen, onChange) {
        const grid = el('div', '', 'status-moment-grid');
        items.forEach(item => {
            const tile = el('button');
            tile.type = 'button';
            tile.setAttribute('aria-pressed', String(item === chosen));
            tile.append(el('span', item.emoji, 'status-moment-emoji'), el('span', item.label));
            tile.onclick = () => {
                grid.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
                tile.setAttribute('aria-pressed', 'true');
                onChange(item);
                syncFooter();
            };
            grid.append(tile);
        });
        return grid;
    }

    function field(tag, label, length) {
        const node = el(tag, '', 'modal-input status-moment-field');
        node.placeholder = label;
        node.maxLength = length;
        node.setAttribute('aria-label', label);
        return node;
    }

    function renderPicker() {
        const mood = tab === 'mood';
        const items = mood ? getAllMoodOptions().map(item => ({
            key: item.key, label: item.label, emoji: item.kaomoji
        })) : [...places, ...(prefs().places || [])];
        const current = draft[tab];
        const same = item => mood ? item.key === current?.key : item.label === current?.label;
        if (request) ui.body.append(el('p', request.text, 'status-moment-caption'));
        ui.body.append(optionsGrid(items, items.find(same), item => { draft[tab] = item; }));
        const custom = el('details', '', 'status-moment-form');
        const input = field('input', mood ? '心情名称' : '地点名称', 24);
        const emoji = field('input', mood ? '表情（选填）' : '地点表情（默认 📍）', 12);
        const error = el('p', '', 'status-moment-error');
        error.setAttribute('role', 'status');
        custom.append(el('summary', mood ? '＋ 自定义心情' : '＋ 添加地点'), input);
        custom.append(emoji);
        custom.append(button('添加并选中', () => {
            const name = input.value.trim();
            if (!name) { error.textContent = '请填写名称。'; return; }
            if (session !== SESSION_ID) { dismiss(); return; }
            let item = items.find(option => option.label === name);
            if (!item && mood) {
                const added = createCustomMoodOption(name, emoji.value.trim() || '💭');
                item = { key: added.key, label: added.label, emoji: added.kaomoji };
            } else if (!mood && (!item || (!places.includes(item) && emoji.value.trim()))) {
                const customPlaces = prefs().places || [];
                item = { label: name, emoji: emoji.value.trim() || '📍' };
                const updated = customPlaces.some(place => place.label === name)
                    ? customPlaces.map(place => place.label === name ? item : place) : [...customPlaces, item];
                if (!store({ places: updated })) {
                    error.textContent = '地点保存失败。';
                    return;
                }
            }
            draft[tab] = item;
            render();
        }), error);
        ui.body.append(custom);
        if (mood) {
            const note = field('textarea', '想说的话（选填）', 240);
            note.value = draft.note;
            note.oninput = () => { draft.note = note.value; };
            ui.body.append(note);
        }
    }

    function limitControl(setting, name, labelText, fallback) {
        const row = el('div', '', 'status-moment-rate');
        const label = el('label', labelText);
        label.htmlFor = name;
        const range = el('input');
        range.id = name;
        range.type = 'range';
        range.min = '0';
        range.max = '14';
        range.value = String(dailyLimit(prefs()[setting], fallback));
        const output = el('output');
        output.setAttribute('for', name);
        const sync = () => { output.textContent = range.value === '0' ? '关闭' : range.value + ' 次'; };
        range.oninput = sync;
        range.onchange = () => {
            if (!store({ [setting]: Number(range.value) })) {
                range.value = String(dailyLimit(prefs()[setting], fallback));
                sync();
                showNotification('频率设置保存失败', 'warning');
            }
        };
        sync();
        row.append(label, range, output);
        return row;
    }

    function renderHistory() {
        ui.body.append(
            limitControl('rate', 'moment-status-rate', '每天询问上限', 3),
            limitControl('locationRate', 'moment-location-rate', '对方每天分享地点', 1)
        );
        const remaining = { shared: 25, asked: 25 };
        const records = chat().filter(item => item.type === 'status-moment' && item.sender === 'user' && item.statusMoment)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .filter(item => {
                const source = item.statusMoment.requestId ? 'asked' : 'shared';
                if (!remaining[source]) return false;
                remaining[source] -= 1;
                return true;
            });
        if (!records.length) { ui.body.append(el('p', '这里还没有状态记录。', 'status-moment-caption')); return; }
        const list = el('div', '', 'status-moment-history');
        records.forEach(item => {
            const entry = el('article');
            const meta = el('div', '', 'status-moment-history-meta');
            meta.append(el('span', item.statusMoment.requestId ? '他主动问的' : '我主动发的', 'status-moment-history-source'),
                el('time', new Date(item.timestamp).toLocaleString('zh-CN')));
            entry.append(meta, renderCard(item.statusMoment));
            list.append(entry);
        });
        ui.body.append(list);
    }

    function syncFooter() {
        const both = request?.ask === 'both';
        ui.back.hidden = !both || tab !== 'place';
        ui.send.hidden = tab === 'history';
        ui.send.textContent = both && tab === 'mood' ? '下一步' : '发送';
        ui.send.disabled = !draft[tab] || Boolean(both && tab === 'place' && !draft.mood);
    }

    function render(animate = false) {
        ui.tabs.replaceChildren();
        const available = request ? (request.ask === 'both' ? [['mood','心情'],['place','地点']] : [])
            : [['mood','心情'],['place','地点'],['history','记录']];
        ui.tabs.hidden = !available.length;
        available.forEach(([value, label], index) => {
            const selector = button(request?.ask === 'both' ? (index + 1) + ' · ' + label : label,
                () => changeStep(value));
            selector.setAttribute('aria-pressed', String(tab === value));
            if (request) selector.disabled = true;
            ui.tabs.append(selector);
        });
        ui.body.replaceChildren();
        ui.body.scrollTop = 0;
        ui.body.classList.remove('is-stepping');
        if (animate) { void ui.body.offsetWidth; ui.body.classList.add('is-stepping'); }
        if (tab === 'history') renderHistory();
        else renderPicker();
        syncFooter();
    }

    function submit() {
        if (!draft) return;
        if (session !== SESSION_ID || (request && request.date !== day())) { dismiss(); return; }
        const both = request?.ask === 'both';
        if (!draft[tab]) return;
        if (both && tab === 'mood') { changeStep('place'); return; }
        if (both && !draft.mood) return;
        const data = both ? { mood: draft.mood, place: draft.place, note: draft.note.trim() }
            : tab === 'mood' ? { mood: draft.mood, note: draft.note.trim() } : { place: draft.place };
        if (request) data.requestId = request.id;
        draft[tab] = null;
        ui.send.disabled = true;
        const sent = publish('user', 'status-moment', answerText(data), data);
        if (data.mood) recordSharedMood(sent.timestamp, data.mood.key, data.note || '');
        dismiss();
        if (typeof playSound === 'function') playSound('send');
        const moodReplies = responses[data.mood?.key];
        const moodReply = moodReplies ? pick(moodReplies) : data.mood ? '嗯，我在听。你想说的时候，我都在。' : '';
        const placeReply = data.place ? '知道你在哪儿了，等你有空我们再聊。' : '';
        scheduleChatReply(sent, [moodReply, placeReply].filter(Boolean).join(' '));
    }

    let firstSeen = Date.now(), lastSession;
    const scheduleGap = cap => Math.max(30, 600 / cap) * minute;
    function tick() {
        if (!SESSION_ID || document.visibilityState !== 'visible' || !document.body.classList.contains('hs-enabled') ||
            window.MemoryMatch?.isPlayingTogether()) return;
        const now = Date.now();
        if (lastSession !== SESSION_ID) { lastSession = SESSION_ID; firstSeen = now; }
        const saved = prefs(), today = day();
        const state = saved.activity?.date === today ? saved.activity : { date: today, asked: 0, shares: [] };
        const meal = window.WydMeal?.currentMeal?.();
        if (meal && !state.shares.includes(meal.key)) {
            state.shares.push(meal.key);
            if (store({ activity: state }) && Math.random() < mealShareChance) {
                window.WydMeal.revealMeal();
                publish(partner(), 'status-moment', meal.dishes, { meal: meal.dishes });
                return;
            }
        }
        if (now - firstSeen < 4 * minute) return;
        const locationCap = dailyLimit(saved.locationRate, 1);
        if (locationCap && (state.locations || 0) < locationCap
            && now - firstSeen >= 12 * minute && now - (state.lastLocationAt || 0) >= scheduleGap(locationCap)) {
            const place = window.WydWhere?.currentLocation?.();
            if (place?.label && place.label !== state.lastLocation) {
                state.locations = (state.locations || 0) + 1;
                state.lastLocation = place.label;
                state.lastLocationAt = now;
                if (store({ activity: state })) {
                    window.WydMeal?.revealLocation?.();
                    publish(partner(), 'status-moment', answerText({ place }), { place });
                }
                return;
            }
        }
        const cap = dailyLimit(saved.rate, 3);
        if (!cap || state.asked >= cap || now - (state.lastAskAt || state.last || 0) < scheduleGap(cap) || dialogOpen()) return;
        const input = byId('message-input');
        if (document.activeElement === input && input.value.trim()) return;
        const shared = chat().filter(item => item.type === 'status-moment' && item.sender === 'user'
            && !item.statusMoment?.requestId && dateOf(item.timestamp) === today);
        const moodWeight = shared.some(item => item.statusMoment?.mood) ? 1 : 5;
        const placeWeight = shared.some(item => item.statusMoment?.place) ? 1 : 5;
        const bothWeight = Math.min(moodWeight, placeWeight) * .65;
        const draw = Math.random() * (moodWeight + placeWeight + bothWeight);
        const ask = draw < moodWeight ? 'mood' : draw < moodWeight + placeWeight ? 'place' : 'both';
        state.asked += 1;
        state.lastAskAt = now;
        if (store({ activity: state })) issueQuestion(ask);
    }

    function dialogOpen() {
        return [...document.querySelectorAll('.modal')].some(modal => getComputedStyle(modal).display !== 'none');
    }

    function issueQuestion(ask) {
        open({ id: id(), date: day(), ask, text: pick(questions[ask]) });
    }

    function testQuestion(ask = 'mood') {
        if (!ui || !SESSION_ID) throw new Error('请等网页载入完成。');
        if (!Object.hasOwn(questions, ask)) throw new Error('请选择 mood、place 或 both。');
        if (dialogOpen()) throw new Error('请先关闭当前弹窗。');
        issueQuestion(ask);
    }

    const legacyReplies = new Set([
        ...Object.values(responses).flat(),
        '嗯，我在听。你想说的时候，我都在。',
        '知道你在哪儿了，等你有空我们再聊。'
    ]);
    function isLegacyReply(text) {
        const placeReply = '知道你在哪儿了，等你有空我们再聊。';
        return legacyReplies.has(text) ||
            (text.endsWith(' ' + placeReply) && legacyReplies.has(text.slice(0, -placeReply.length).trim()));
    }

    window.MomentStatus = { renderMessage, appendEmotion, pickReplyEmotion, syncEmotionSetting, testQuestion, isLegacyReply };
    document.addEventListener('DOMContentLoaded', init, { once: true });
})();
