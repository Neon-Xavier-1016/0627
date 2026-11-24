(function () {
    'use strict';

    const presets = [
        { name: '上班', color: '#5178b8' },
        { name: '上学', color: '#5d8a67' },
        { name: '去医院', color: '#ba587a' },
        { name: '出门办事', color: '#a57332' },
        { name: '约会', color: '#8865ad' }
    ];
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const pad = value => String(value).padStart(2, '0');
    const dateKey = date => [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
    const parseDate = value => new Date(value + 'T12:00:00');
    const dateLabel = date => (date.getMonth() + 1) + '月' + date.getDate() + '日';
    const todayKey = () => dateKey(new Date());
    const newId = () => globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2);
    const empty = () => ({
        categoryVersion: 1, entries: [], categories: presets.map((category, index) => ({ ...category, id: 'preset-' + index }))
    });
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const storageKey = () => getStorageKey('homeSchedule');
    const partnerName = () => (typeof settings !== 'undefined' && settings?.partnerName) || '梦角';
    const displayColor = value => /^#[a-f\d]{6}$/i.test(value) ? value : '#5178b8';
    const badge = {
        schedule: { glyph: '●', label: '日程' },
        anniversary: { glyph: '♥', label: '纪念日' },
        birthday: { glyph: '★', label: '生日' }
    };

    let home, track, panes, pageDots, inlineCalendar, dialog;
    let calendarVisible = false;
    let data = empty();
    let importantDays = [];
    let periods = [];
    let activeKey, refreshVersion = 0, observedDay;
    let selectedDay = todayKey();
    let month = parseDate(selectedDay);
    let view = 'month', returnToMonth = false, draft, busy = false;

    function normalizeData(saved) {
        if (!saved) return empty();
        if (saved.categoryVersion === 1) return saved;
        const data = empty();
        data.categories.push(...saved.categories.map((category, index) => ({ ...category, id: 'custom-' + index })));
        data.entries = saved.entries.map(entry => ({
            ...entry, categoryId: data.categories.find(category => category.name === entry.name)?.id
        }));
        return data;
    }

    function occursOn(item, day) {
        if (!item.date || day < item.date) return false;
        if (item.date === day) return true;
        return (item.type === 'anniversary' || item.type === 'birthday') && item.date.slice(5) === day.slice(5);
    }

    function itemsFor(day) {
        return [
            ...data.entries.filter(item => item.day === day).map(item => ({ ...item, kind: 'schedule' })),
            ...importantDays.filter(item => occursOn(item, day)).map(item => ({
                kind: item.type === 'birthday' ? 'birthday' : 'anniversary',
                name: item.name,
                detail: item.type === 'countdown' ? '来自重要日 · 倒数日' : '来自重要日'
            }))
        ];
    }

    async function refresh() {
        const version = ++refreshVersion;
        const key = storageKey();
        try {
            const [saved, dates, periodRecords] = await Promise.all([
                localforage.getItem(key),
                localforage.getItem(getStorageKey('anniversaries')),
                localforage.getItem('periodRecords')
            ]);
            if (version !== refreshVersion || key !== storageKey()) return;
            activeKey = key;
            data = normalizeData(saved);
            importantDays = Array.isArray(dates) ? dates : [];
            periods = Array.isArray(periodRecords) ? periodRecords.map(record => ({
                start: dateKey(new Date(record.startDate)),
                end: record.endDate ? dateKey(new Date(record.endDate)) : null
            })) : [];
            renderCalendars();
            observedDay = todayKey();
            return true;
        } catch (error) {
            console.warn('[日程]', error);
        }
    }

    function cell(day, inMonth, now) {
        const key = dateKey(day);
        const hasPeriod = periods.some(range => key >= range.start && key <= (range.end || now));
        const items = itemsFor(key);
        const kinds = [...new Set(items.map(item => item.kind))];
        const markers = kinds.map(kind =>
            '<span class="sc-mark sc-' + kind + '">' + badge[kind].glyph + '</span>').join('');
        const description = [dateLabel(day), key === now && '今天', hasPeriod && '经期',
            ...kinds.map(kind => badge[kind].label)].filter(Boolean).join('，');
        return '<button type="button" class="sc-day' + (inMonth ? '' : ' sc-outside') +
            '" data-sc-day="' + key + '" aria-label="' + description + '"' +
            (key === now ? ' aria-current="date"' : '') + ' aria-pressed="' + (key === selectedDay) + '">' +
            '<span class="sc-number' + (hasPeriod ? ' sc-period' : '') + '">' + day.getDate() + '</span>' +
            '<span class="sc-marks" aria-hidden="true">' + markers + '</span></button>';
    }

    function calendarMarkup() {
        const year = month.getFullYear();
        const monthIndex = month.getMonth();
        const offset = new Date(year, monthIndex, 1).getDay();
        const length = new Date(year, monthIndex + 1, 0).getDate();
        const now = todayKey();
        const total = Math.max(35, Math.ceil((offset + length) / 7) * 7);
        const cells = Array.from({ length: total }, (_, index) => {
            const day = new Date(year, monthIndex, index - offset + 1);
            return cell(day, day.getMonth() === monthIndex, now);
        }).join('');
        return `
            <div class="sc-month-bar">
                <h3 aria-live="polite">${year}年${monthIndex + 1}月</h3>
                <div class="sc-month-buttons">
                    <button type="button" data-sc-action="prev-month" aria-label="上个月">‹</button>
                    <button type="button" data-sc-action="next-month" aria-label="下个月">›</button>
                </div>
            </div>
            <div class="sc-grid">
                ${weekdays.map(day => '<span class="sc-weekday">' + day + '</span>').join('')}
                ${cells}
            </div>`;
    }

    function renderCalendars() {
        const targets = [inlineCalendar];
        if (dialog.open && view === 'month') targets.push(dialog.querySelector('.sc-modal-calendar'));
        const markup = calendarMarkup();
        for (const target of targets) {
            const action = target.contains(document.activeElement) && document.activeElement.dataset.scAction;
            target.innerHTML = markup;
            if (action) target.querySelector('[data-sc-action="' + action + '"]')?.focus();
        }
    }

    function syncScreen() {
        if (!track.clientWidth) return;
        const calendar = track.scrollLeft >= track.clientWidth / 2;
        if (calendar === calendarVisible) return;
        calendarVisible = calendar;
        panes[0].inert = calendar;
        panes[1].inert = !calendar;
        pageDots.querySelector('[data-sc-action="home"]').setAttribute('aria-pressed', String(!calendar));
        pageDots.querySelector('[data-sc-action="open-calendar"]').setAttribute('aria-pressed', String(calendar));
        if (calendar) refresh();
    }

    function showScreen(calendar, animate = true) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        track.scrollTo({
            left: calendar ? track.clientWidth : 0,
            behavior: animate && !reduceMotion ? 'smooth' : 'instant'
        });
        syncScreen();
    }

    function openDialog(nextView) {
        view = nextView;
        renderDialog();
        if (!dialog.open) dialog.showModal();
        dialog.querySelector('h2').focus();
    }

    function openDay(day) {
        returnToMonth = dialog.open && view === 'month';
        selectedDay = day;
        month = parseDate(day);
        renderCalendars();
        openDialog('day');
    }

    function action(label, key, style = '') {
        return '<button type="button" class="sc-button ' + style + '" data-sc-action="' + key + '">' + label + '</button>';
    }

    function categoryForm(category) {
        return `<form class="sc-custom-form">
            <label>名称<input name="category" placeholder="例如：接朋友" maxlength="32" required value="${escape(category?.name)}"></label>
            <label>颜色<input name="color" type="color" value="${displayColor(category?.color || '#8c6eb0')}"></label>
            <button type="submit" class="sc-button sc-primary">${category ? '保存类别' : '添加'}</button>
        </form>`;
    }

    function categoryMarkup(category) {
        const id = escape(category.id);
        const name = escape(category.name);
        const armed = draft.deleteCategory === category.id;
        return `<div class="sc-category" style="--sc-category:${displayColor(category.color)}" data-selected="${draft.categoryId === category.id}">
            <button type="button" class="sc-category-select" data-sc-action="category" data-id="${id}"
                aria-pressed="${draft.categoryId === category.id}" title="${name}">
                <span class="sc-category-swatch" aria-hidden="true"></span>
                <span class="sc-category-name">${name}</span>
            </button>
            <button type="button" class="sc-category-remove" data-sc-action="remove-category" data-id="${id}"
                aria-label="删除类别：${name}" aria-pressed="${armed}">${armed ? '×' : ''}</button>
        </div>`;
    }

    function renderDialog() {
        const dayTitle = dateLabel(parseDate(selectedDay));
        if (view === 'month') {
            dialog.innerHTML = '<h2 tabindex="-1">📅 日程</h2><div class="sc-modal-calendar">' +
                calendarMarkup() + '</div><div class="sc-actions">' + action('关闭', 'close') + '</div>';
            return;
        }
        if (view === 'day') {
            const items = itemsFor(selectedDay);
            const cards = items.map(item => {
                const type = badge[item.kind];
                const color = item.kind === 'schedule' ? ' style="--sc-category:' + displayColor(item.color) + '"' : '';
                const identifier = escape(item.id);
                const controls = item.kind === 'schedule' ? '<div class="sc-actions">' +
                    action('关闭', 'close') +
                    '<button type="button" class="sc-button sc-danger" data-sc-action="delete" data-id="' + identifier + '">删除</button>' +
                    '<button type="button" class="sc-button sc-primary" data-sc-action="edit" data-id="' + identifier + '">编辑</button></div>' : '';
                return `<article class="sc-record" ${color}>
                    <p><span class="sc-mark sc-${item.kind}" aria-hidden="true">${type.glyph}</span>
                        ${type.label}：<strong>${escape(item.name)}</strong></p>
                    <p class="sc-detail">详情：${escape(item.detail || '暂无详情')}</p>
                    ${item.partnerNote ? `<p class="sc-detail sc-partner-note"><strong>${escape(partnerName())}：</strong>${escape(item.partnerNote)}</p>` : ''}
                    ${controls}</article>`;
            }).join('');
            dialog.innerHTML = '<h2 tabindex="-1">' + dayTitle + '</h2>' + (cards || '<p class="sc-empty">这一天还没有日程</p>') +
                '<div class="sc-actions">' + (items.some(item => item.kind === 'schedule') ? '' : action('关闭', 'close')) +
                action('＋ 添加日程', 'add', 'sc-primary') + '</div>';
            return;
        }
        const editingCategory = data.categories.find(category => category.id === draft.editCategory);
        dialog.innerHTML = `
            <h2 tabindex="-1">${dayTitle}</h2>
            <div class="sc-edit-nav">
                <button type="button" data-sc-action="edit-back" aria-label="上一页" ${draft.page === 1 ? 'disabled' : ''}>‹</button>
                <strong id="sc-edit-page">第 ${draft.page} 页 · ${draft.page === 1 ? '日程' : '详情'}</strong>
                <button type="button" data-sc-action="edit-next" aria-label="下一页" ${draft.page === 2 ? 'disabled' : ''}>›</button>
            </div>
            ${draft.page === 1 ? `
                <div class="sc-categories">${data.categories.map(categoryMarkup).join('')}</div>
                ${editingCategory ? `<section class="sc-category-editor" aria-label="修改日程类别">
                    <div class="sc-category-editor-title"><strong>修改日程类别</strong>${action('取消修改', 'cancel-category')}</div>
                    ${categoryForm(editingCategory)}
                </section>` : `<details class="sc-custom">
                    <summary>＋ 自定义日程</summary>
                    ${categoryForm()}
                </details>`}` : `
                <label class="sc-detail-label" for="sc-detail-input">详情</label>
                <textarea id="sc-detail-input" rows="5" maxlength="2000" placeholder="写下这天要做什么…">${escape(draft.detail)}</textarea>
                <label class="sc-detail-label sc-partner-label" for="sc-partner-note">${escape(partnerName())}：</label>
                <textarea id="sc-partner-note" rows="2" maxlength="2000" placeholder="可以编辑留言">${escape(draft.partnerNote)}</textarea>
                <p class="sc-field-hint">自动留言由 2–4 张字卡组成，用空格隔开。</p>`}
            <div class="sc-actions">
                ${action('取消', 'cancel')}${action('保存', 'save', 'sc-primary')}
            </div>
            <p class="sc-error" role="alert"></p>`;
    }

    function startEdit(id) {
        const item = data.entries.find(entry => entry.id === id);
        draft = { ...item, name: item?.name || '', detail: item?.detail || '', page: 1 };
        openDialog('edit');
    }

    function focusCategory(action, id) {
        dialog.querySelector(`[data-sc-action="${action}"][data-id="${CSS.escape(id)}"]`)?.focus();
    }

    function selectCategory(category) {
        Object.assign(draft, { categoryId: category.id, name: category.name, color: category.color });
    }

    async function saveCategory(event) {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.target);
        const name = form.get('category').trim();
        const editId = draft.editCategory;
        const error = dialog.querySelector('.sc-error');
        if (!name || data.categories.some(category => category.id !== editId && category.name === name)) {
            error.textContent = name ? '已经有这个日程类别。' : '请输入日程类别名称。';
            return;
        }
        const category = { id: editId || newId(), name, color: displayColor(form.get('color')) };
        if (!await write(state => {
            if (state.categories.some(item => item.id !== category.id && item.name === name)) {
                throw new Error('Duplicate schedule category');
            }
            return {
                ...state,
                categories: editId ? state.categories.map(item => item.id === editId ? category : item) : [...state.categories, category],
                entries: state.entries.map(entry => entry.categoryId === category.id
                    ? { ...entry, name: category.name, color: category.color } : entry)
            };
        })) return;
        if (!editId || draft.categoryId === editId) selectCategory(category);
        draft.editCategory = undefined;
        renderDialog();
        focusCategory('category', category.id);
    }

    function setDeleteCategory(id) {
        draft.deleteCategory = id;
        dialog.querySelectorAll('.sc-category-remove').forEach(button => {
            const armed = button.dataset.id === id;
            button.setAttribute('aria-pressed', String(armed));
            button.textContent = armed ? '×' : '';
        });
    }

    async function removeCategory(id) {
        const category = data.categories.find(item => item.id === id);
        if (draft.deleteCategory !== id) {
            setDeleteCategory(id);
            return;
        }
        setDeleteCategory(undefined);
        if (!window.confirm(`删除「${category.name}」这个类别？已保存的日程会保留。`) ||
            !await write(state => ({ ...state, categories: state.categories.filter(item => item.id !== id) }))) return;
        if (draft.editCategory === id) draft.editCategory = undefined;
        const saved = data.entries.find(entry => entry.id === draft.id);
        if (draft.categoryId === id && saved?.categoryId !== id) {
            Object.assign(draft, { categoryId: undefined, name: '', color: '' });
        }
        renderDialog();
        dialog.querySelector('h2').focus();
    }

    async function write(change) {
        if (busy || activeKey !== storageKey()) return false;
        const key = activeKey;
        const save = async () => {
            const updated = change(normalizeData(await localforage.getItem(key)));
            await localforage.setItem(key, updated);
            if (key === storageKey()) {
                ++refreshVersion;
                data = updated;
                renderCalendars();
                return true;
            }
            return false;
        };
        busy = true;
        try {
            return await (navigator.locks?.request(key, save) ?? save());
        } catch (error) {
            console.warn('[日程保存]', error);
            const label = dialog.querySelector('.sc-error');
            if (label) label.textContent = '保存失败，请重试。';
            else if (typeof showNotification === 'function') showNotification('删除失败，请重试。', 'error');
            return false;
        } finally {
            busy = false;
        }
    }

    async function handleAction(event) {
        const day = event.target.closest('[data-sc-day]');
        if (day) {
            openDay(day.dataset.scDay);
            return;
        }
        const button = event.target.closest('[data-sc-action]');
        if (busy) return;
        if (dialog.open && view === 'edit' && draft.deleteCategory && button?.dataset.scAction !== 'remove-category') {
            setDeleteCategory(undefined);
        }
        if (!button) return;
        const { scAction: key, id } = button.dataset;
        switch (key) {
        case 'open-calendar': showScreen(true); break;
        case 'home': showScreen(false); break;
        case 'prev-month':
        case 'next-month':
            month = new Date(month.getFullYear(), month.getMonth() + (key === 'prev-month' ? -1 : 1), 1);
            renderCalendars();
            break;
        case 'close':
            if (view === 'day' && returnToMonth) openDialog('month');
            else dialog.close();
            break;
        case 'add':
        case 'edit': startEdit(id); break;
        case 'cancel': openDialog('day'); break;
        case 'category':
            selectCategory(data.categories.find(category => category.id === id));
            if (draft.editCategory === id) {
                dialog.querySelector('.sc-category-editor input[name="category"]').focus();
                break;
            }
            draft.editCategory = id;
            renderDialog();
            dialog.querySelector('.sc-category-editor input[name="category"]').focus();
            break;
        case 'cancel-category':
            draft.editCategory = undefined;
            renderDialog();
            break;
        case 'remove-category': await removeCategory(id); break;
        case 'edit-back':
        case 'edit-next':
            draft.page = key === 'edit-back' ? 1 : 2;
            renderDialog();
            dialog.querySelector(draft.page === 2 ? 'textarea' : 'h2').focus();
            break;
        case 'delete':
            if (window.confirm('删除这条日程？') && await write(state => ({
                ...state, entries: state.entries.filter(entry => entry.id !== id)
            }))) openDialog('day');
            break;
        case 'save': {
            if (!draft.name) {
                draft.page = 1;
                renderDialog();
                dialog.querySelector('.sc-error').textContent = '请选择一个日程类别，或添加自定义日程。';
                dialog.querySelector('.sc-category-select, .sc-custom summary')?.focus();
                break;
            }
            const entry = {
                id: draft.id || newId(),
                categoryId: draft.categoryId,
                day: selectedDay, name: draft.name, color: draft.color, detail: draft.detail.trim(),
                partnerNote: draft.partnerNote?.trim() ?? (draft.id ? '' : (window.MessageCards?.generateScheduleNote() || ''))
            };
            if (await write(state => {
                const category = state.categories.find(item => item.id === entry.categoryId);
                if (category) Object.assign(entry, { name: category.name, color: category.color });
                return { ...state, entries: [...state.entries.filter(item => item.id !== entry.id), entry] };
            })) openDialog('day');
            break;
        }
        }
    }

    function resetForSession() {
        if (!activeKey || activeKey === storageKey()) return;
        if (dialog.open) dialog.close();
        data = empty();
        importantDays = [];
        selectedDay = todayKey();
        month = parseDate(selectedDay);
    }

    function mount(homeNode) {
        home = homeNode;
        const firstScreen = home.querySelector('.hs-content');
        const secondScreen = document.createElement('div');
        secondScreen.className = 'hs-content sc-screen';
        secondScreen.innerHTML = `<header class="sc-screen-header"><h2>日历</h2></header>
            <section class="sc-calendar-card" aria-label="月历"><div class="sc-inline-calendar"></div>
            <div class="sc-legend"><span><b class="sc-schedule">●</b> 日程</span><span><b class="sc-anniversary">♥</b> 纪念日</span>
            <span><b class="sc-birthday">★</b> 生日</span><span><b class="sc-period-dot">●</b> 经期</span></div></section>`;
        pageDots = document.createElement('div');
        pageDots.className = 'sc-page-dots';
        pageDots.setAttribute('role', 'group');
        pageDots.setAttribute('aria-label', '首页分页');
        pageDots.innerHTML = `<button type="button" data-sc-action="home" aria-label="首页第一屏" aria-pressed="true"></button>
            <button type="button" data-sc-action="open-calendar" aria-label="首页第二屏 · 日历" aria-pressed="false"></button>`;
        track = document.createElement('div');
        track.className = 'sc-home-track';
        panes = [firstScreen, secondScreen].map((screen, index) => {
            const pane = document.createElement('div');
            pane.className = 'sc-home-pane';
            pane.inert = index !== 0;
            pane.append(screen);
            track.append(pane);
            return pane;
        });
        home.append(track, pageDots);
        track.addEventListener('scroll', syncScreen, { passive: true });
        inlineCalendar = secondScreen.querySelector('.sc-inline-calendar');

        dialog = document.createElement('dialog');
        dialog.className = 'sc-dialog';
        dialog.setAttribute('aria-label', '日程');
        document.body.append(dialog);
        home.addEventListener('click', handleAction);
        dialog.addEventListener('click', handleAction);
        dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
        dialog.addEventListener('input', event => {
            if (event.target.id === 'sc-detail-input') draft.detail = event.target.value;
            if (event.target.id === 'sc-partner-note') draft.partnerNote = event.target.value;
        });
        dialog.addEventListener('submit', saveCategory);

        const checkDate = () => {
            if (document.hidden) return;
            resetForSession();
            if (observedDay !== todayKey() || activeKey !== storageKey()) refresh();
        };
        document.addEventListener('visibilitychange', checkDate);
        window.addEventListener('pageshow', checkDate);
        setInterval(checkDate, 30000);
        renderCalendars();

        const entry = document.createElement('button');
        entry.type = 'button';
        entry.id = 'hs-schedule-entry';
        entry.className = 'settings-item';
        entry.innerHTML = '<i class="far fa-calendar-check" aria-hidden="true"></i><span>日程</span>';
        entry.addEventListener('click', async () => {
            if ((await refresh() || activeKey === storageKey()) && !home.hidden) openDialog('month');
            else if (typeof showNotification === 'function') showNotification('日程读取失败，请重试。', 'error');
        });
        return entry;
    }

    window.HomeSchedule = {
        mount,
        showHome() {
            showScreen(false, false);
            resetForSession();
            refresh();
        }
    };
})();
