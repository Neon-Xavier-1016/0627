(function () {
    'use strict';

    const entry = document.getElementById('chat-link-test-btn');
    const dialog = document.createElement('dialog');
    dialog.className = 'lt-dialog';
    dialog.setAttribute('aria-labelledby', 'lt-title');
    document.body.append(dialog);

    const storageKey = () => getStorageKey('linkTest');
    const blank = () => ({ questions: [], history: [] });
    const id = () => globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2);
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const partner = () => (typeof settings !== 'undefined' && settings?.partnerName) || '梦角';
    const defaultPartnerId = 'default';
    const historyLimit = 10;
    const previewLimit = 3;
    const button = (label, action, primary = false) =>
        `<button type="button" class="modal-btn modal-btn-${primary ? 'primary' : 'secondary'}" data-lt-action="${action}">${label}</button>`;
    let key, data, run, editingId, revealTimer, busy = false;
    let partnerId = defaultPartnerId;
    let partners = [];
    let overflowLists = new Map();

    function activePartner() {
        return partners.find(item => item.id === partnerId)?.name || partner();
    }

    function loadData(state) {
        partners = state.partners || [];
        if (!partners.some(item => item.id === partnerId)) partnerId = defaultPartnerId;
        data = partnerId === defaultPartnerId ? state : partners.find(item => item.id === partnerId);
    }

    function trimHistories(state) {
        const allPartners = state.partners || [];
        if (state.history.length <= historyLimit && allPartners.every(item => item.history.length <= historyLimit)) return state;
        return {
            ...state,
            history: state.history.slice(0, historyLimit),
            partners: allPartners.map(item => ({ ...item, history: item.history.slice(0, historyLimit) }))
        };
    }

    async function readSession() {
        const read = async () => {
            const stored = (await localforage.getItem(key)) || blank();
            const limited = trimHistories(stored);
            if (limited !== stored) await localforage.setItem(key, limited);
            return limited;
        };
        return navigator.locks?.request(key, read) ?? read();
    }

    function rating(correct, total, name) {
        const percentage = correct * 100 / total;
        const tiers = [
            [85, '灵魂共鸣', '你们的答案几乎完全重合，像共享同一段心事。'],
            [70, '默契十足', '大部分问题都答对了，你们的连接很稳。'],
            [50, '心有灵犀', `有不少重合的地方，${name}在认真记住你。`],
            [30, '还在靠近', '有些地方还需要慢慢了解彼此。'],
            [0, '连接微弱', '别急，连接是可以一点点建立起来的。']
        ];
        const [, level, hint] = tiers.find(([threshold]) => percentage >= threshold);
        return { percentage: Math.round(percentage * 10) / 10, level, hint };
    }

    function show(title, body, lists = new Map()) {
        clearTimeout(revealTimer);
        overflowLists = lists;
        dialog.innerHTML = `<header class="lt-header"><h2 id="lt-title" tabindex="-1">${title}</h2>
            <button type="button" class="lt-close" data-lt-action="close" aria-label="关闭">×</button></header>
            ${body}<p class="lt-feedback" role="status"></p>`;
        dialog.scrollTop = 0;
        dialog.querySelector('h2').focus();
    }

    function feedback(message) {
        dialog.querySelector('.lt-feedback').textContent = message;
    }

    async function update(change, wholeSession = false) {
        if (busy || key !== storageKey()) return false;
        busy = true;
        const save = async () => {
            const current = (await localforage.getItem(key)) || blank();
            let next;
            if (wholeSession || partnerId === defaultPartnerId) {
                next = change(current);
            } else {
                next = { ...current, partners: (current.partners || []).map(item => item.id === partnerId ? change(item) : item) };
            }
            const limited = trimHistories(next);
            await localforage.setItem(key, limited);
            loadData(limited);
        };
        try {
            await (navigator.locks?.request(key, save) ?? save());
            return true;
        } catch (error) {
            console.warn('[链接测试]', error);
            feedback('保存失败，请重试。');
            return false;
        } finally {
            busy = false;
        }
    }

    function previewList(items, renderItem, label, listId, lists) {
        const visible = items.slice(0, previewLimit).map(renderItem).join('');
        const remaining = items.length - previewLimit;
        if (remaining <= 0) return visible;
        const overflowId = 'lt-extra-' + listId;
        const expandLabel = `展开其余 ${remaining} ${label}`;
        lists.set(overflowId, { expandLabel, render: () => items.slice(previewLimit).map(renderItem).join('') });
        return visible + `<div id="${overflowId}" hidden></div>
            <button type="button" class="lt-more-toggle" data-lt-action="toggle-overflow" aria-expanded="false"
                aria-controls="${overflowId}">${expandLabel}</button>`;
    }

    function toggleOverflow(button) {
        const overflowId = button.getAttribute('aria-controls');
        const overflow = document.getElementById(overflowId);
        const list = overflowLists.get(overflowId);
        const expand = overflow.hidden;
        overflow.innerHTML = expand ? list.render() : '';
        overflow.hidden = !expand;
        button.setAttribute('aria-expanded', String(expand));
        button.textContent = expand ? '收起' : list.expandLabel;
    }

    function latestConnection(latest) {
        const name = activePartner();
        const score = latest && rating(latest.correct, latest.answers.length, name);
        return `<section class="lt-card lt-connection">
            <h3>与 <strong>${escape(name)}</strong> 的链接</h3>
            ${score ? `<div class="lt-connection-result">
                <b>${latest.correct}/${latest.answers.length}</b>
                <div><strong>${score.level}</strong><p class="lt-muted">${escape(score.hint)}</p></div>
            </div>` : '<p class="lt-muted">还没有测试记录。</p>'}</section>`;
    }

    function overview() {
        run = null;
        const lists = new Map();
        const latest = data.history[0];
        const count = data.questions.length;
        const counts = [...new Set([1, 3, 5, 8, 10, Math.min(count, 10)])]
            .filter(value => value > 0 && value <= count).sort((a, b) => a - b);
        const defaultCount = counts.includes(5) ? 5 : counts.at(-1);
        show('链接测试', `<div class="lt-overview">
            ${latestConnection(latest)}
            <section class="lt-summary">
                <div class="lt-row"><label for="lt-partner">答题对象</label>
                    <select id="lt-partner"><option value="default">${escape(partner())}</option>
                    ${partners.map(item => `<option value="${escape(item.id)}" ${item.id === partnerId ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}</select>
                    ${button('＋ 添加对象', 'new-partner')}</div>
                ${latest ? `<p class="lt-last-score">上次答对 <b>${latest.correct} / ${latest.answers.length}</b> 题 · ${rating(latest.correct, latest.answers.length, latest.partner).level}</p>` : ''}
                <p class="lt-muted">你出题，梦角逐题随机选择一个答案。</p>
                ${count ? `<div class="lt-row"><label>抽题数量
                    <select id="lt-count">${counts.map(n => `<option value="${n}" ${n === defaultCount ? 'selected' : ''}>${n} 题</option>`).join('')}</select>
                    </label>${button('开始测试', 'start', true)}</div>` : '<p>先添加一道题，就可以开始测试。</p>'}
            </section>
            <section class="lt-section lt-card">
                <div class="lt-section-heading"><h3>题库 <small>${count} 题</small></h3>
                    <div class="lt-row">${button('批量导入', 'import')}${button('＋ 出题', 'new', true)}</div></div>
                ${previewList(data.questions, q => `<article class="lt-list-item"><div><strong>${escape(q.question)}</strong>
                    <p class="lt-muted">正确答案 · ${escape(q.options[q.correct])}</p></div>
                    <div class="lt-row">
                    <button type="button" data-lt-action="edit" data-id="${escape(q.id)}">编辑</button>
                    <button type="button" data-lt-action="delete-question" data-id="${escape(q.id)}">删除</button>
                    </div></article>`, '道题', 'questions', lists)}
            </section>
            <section class="lt-section lt-card"><h3>测试记录</h3>
                ${data.history.length ? previewList(data.history, record => `<article class="lt-list-item"><div>
                    <strong>${escape(record.partner)} · ${record.correct}/${record.answers.length} 题</strong>
                    <p class="lt-muted">${escape(new Date(record.createdAt).toLocaleString('zh-CN'))}</p></div>
                    <div class="lt-row">
                    <button type="button" data-lt-action="result" data-id="${escape(record.id)}">查看</button>
                    <button type="button" data-lt-action="delete-result" data-id="${escape(record.id)}">删除</button>
                    </div></article>`, '条记录', 'history', lists) : '<p class="lt-muted">完成测试后，结果会出现在这里。</p>'}
            </section></div>`, lists);
    }

    function optionRow(text = '', checked = false) {
        return `<div class="lt-option-row">
            <input type="radio" name="lt-correct" ${checked ? 'checked' : ''}>
            <input type="text" name="option" maxlength="60" placeholder="填写选项" value="${escape(text)}">
            <button type="button" class="lt-option-remove" data-lt-action="remove-option" aria-label="删除选项">×</button>
        </div>`;
    }

    function syncOptions() {
        const rows = [...dialog.querySelectorAll('.lt-option-row')];
        rows.forEach((row, i) => {
            row.querySelector('[type="radio"]').setAttribute('aria-label', `将选项 ${i + 1} 设为正确答案`);
            row.querySelector('[name="option"]').setAttribute('aria-label', `选项 ${i + 1}`);
            row.querySelector('.lt-option-remove').disabled = rows.length <= 2;
        });
        dialog.querySelector('[data-lt-action="add-option"]').disabled = rows.length >= 6;
        if (!dialog.querySelector('[name="lt-correct"]:checked')) rows[0].firstElementChild.checked = true;
    }

    function editor(question) {
        editingId = question?.id;
        show(question ? '编辑题目' : '出一道题', `
            <form data-lt-form="question">
                <label class="lt-field">问题<input type="text" name="question" required maxlength="80"
                    placeholder="例如：我最喜欢哪种颜色？" value="${escape(question?.question)}"></label>
                <p class="lt-muted">填写 2–6 个选项，点左边的圆圈标出正确答案。</p>
                <div class="lt-options">${(question?.options || ['', '']).map((option, i) => optionRow(option, i === (question?.correct ?? 0))).join('')}</div>
                ${button('＋ 添加选项', 'add-option')}
                <footer class="lt-actions">${button('返回', 'back')}<button class="modal-btn modal-btn-primary" type="submit">保存题目</button></footer>
            </form>`);
        syncOptions();
    }

    function importEditor() {
        show('导入题库', `<form data-lt-form="import">
            <label class="lt-field">每行一题<textarea name="bulk" rows="6" required placeholder="我最喜欢的颜色  蓝色  绿色  粉色"></textarea></label>
            <p class="lt-muted">问题和各选项之间输入两个空格。第一个选项是正确答案，每题填 2–6 个选项。</p>
            <footer class="lt-actions">${button('返回', 'back')}<button class="modal-btn modal-btn-primary" type="submit">导入</button></footer>
        </form>`);
    }

    function validQuestion(question, options, correct) {
        return question && question.length <= 80 && options.length >= 2 && options.length <= 6 &&
            options.every(option => option && option.length <= 60) && new Set(options).size === options.length && correct >= 0;
    }

    function shuffled(items) {
        const result = [...items];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    function start() {
        const count = Number(dialog.querySelector('#lt-count')?.value);
        if (!count || count > data.questions.length) return;
        const answers = shuffled(data.questions).slice(0, count).map(question => {
            const options = shuffled(question.options);
            return {
                question: question.question, options, correct: options.indexOf(question.options[question.correct]),
                chosen: Math.floor(Math.random() * options.length)
            };
        });
        run = { id: id(), partner: activePartner(), createdAt: Date.now(), index: 0, answers,
            correct: answers.filter(answer => answer.chosen === answer.correct).length };
        questionStep();
    }

    function questionStep() {
        const answer = run.answers[run.index];
        const done = run.index + 1 === run.answers.length;
        show('默契问答', `<p class="lt-muted">${escape(run.partner)} · ${run.index + 1} / ${run.answers.length} 题</p>
            <progress value="${run.index + 1}" max="${run.answers.length}"></progress>
            <h3 class="lt-question">${escape(answer.question)}</h3>
            <ol class="lt-answers">${answer.options.map(option => `<li><span>${escape(option)}</span></li>`).join('')}</ol>
            <p class="lt-muted lt-correction" aria-live="polite">正在选择…</p>
            <footer class="lt-actions">${button('退出测试', 'back')}${button(done ? '查看结果' : '下一题', done ? 'finish' : 'next', true)}</footer>`);
        const advance = dialog.querySelector('[data-lt-action="next"], [data-lt-action="finish"]');
        advance.disabled = true;
        revealTimer = setTimeout(() => {
            const chosen = dialog.querySelectorAll('.lt-answers li')[answer.chosen];
            chosen.classList.add('lt-chosen');
            const badge = document.createElement('small');
            badge.textContent = '已选中';
            chosen.append(badge);
            dialog.querySelector('.lt-correction').textContent =
                `${run.partner}选了「${answer.options[answer.chosen]}」 · 正确答案「${answer.options[answer.correct]}」`;
            advance.disabled = false;
        }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 650);
    }

    function result(record) {
        const { percentage, level, hint } = rating(record.correct, record.answers.length, record.partner);
        show('测试结果', `<div class="lt-summary lt-result"><p>${escape(record.partner)}</p>
            <strong>${record.correct} / ${record.answers.length}</strong><p><b>${level}</b> · ${percentage}%</p>
            <p class="lt-muted">${escape(hint)}</p></div>
            ${record.answers.map((answer, i) => `<article class="lt-review"><h3>${i + 1}. ${escape(answer.question)}</h3>
                <p>${answer.chosen === answer.correct ? '答对了' : '选错了'} · 选择了 ${escape(answer.options[answer.chosen])}</p>
                <p class="lt-muted">正确答案 · ${escape(answer.options[answer.correct])}</p></article>`).join('')}
            <footer class="lt-actions">${button('返回链接测试', 'back', true)}</footer>`);
    }

    entry.addEventListener('click', async () => {
        if (dialog.open) return;
        key = storageKey();
        show('链接测试', '<p class="lt-muted">正在读取题库…</p>');
        dialog.showModal();
        dialog.querySelector('h2').focus();
        busy = true;
        try {
            loadData(await readSession());
            overview();
        } catch (error) {
            console.warn('[链接测试]', error);
            feedback('读取失败，请关闭后重试。');
        } finally {
            busy = false;
        }
    });
    function closeDialog() {
        dialog.close();
        clearTimeout(revealTimer);
        overflowLists.clear();
        data = run = null;
        partners = [];
        dialog.replaceChildren();
        document.getElementById('chat-media-toggle')?.focus();
    }
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        if (!busy) closeDialog();
    });
    dialog.addEventListener('change', async event => {
        if (event.target.id !== 'lt-partner' || busy) return;
        busy = true;
        try {
            const state = await readSession();
            partnerId = event.target.value;
            loadData(state);
            overview();
        } catch (error) {
            event.target.value = partnerId;
            feedback('读取失败，请重试。');
        } finally {
            busy = false;
        }
    });

    dialog.addEventListener('click', async event => {
        const target = event.target.closest('[data-lt-action]');
        if (!target || busy) return;
        const { ltAction: action, id: itemId } = target.dataset;
        switch (action) {
        case 'close': closeDialog(); break;
        case 'back': overview(); break;
        case 'toggle-overflow': toggleOverflow(target); break;
        case 'new': editor(); break;
        case 'new-partner':
            show('添加答题对象', `<form data-lt-form="partner"><label class="lt-field">名字
                <input type="text" name="partnerName" maxlength="32" required></label>
                <footer class="lt-actions">${button('返回', 'back')}<button class="modal-btn modal-btn-primary" type="submit">添加</button></footer></form>`);
            break;
        case 'edit': editor(data.questions.find(q => q.id === itemId)); break;
        case 'import': importEditor(); break;
        case 'add-option':
            dialog.querySelector('.lt-options').insertAdjacentHTML('beforeend', optionRow());
            syncOptions();
            dialog.querySelector('.lt-option-row:last-child [name="option"]').focus();
            break;
        case 'remove-option':
            target.closest('.lt-option-row').remove();
            syncOptions();
            break;
        case 'start': start(); break;
        case 'next': run.index++; questionStep(); break;
        case 'finish': {
            const { index, ...record } = run;
            if (await update(state => ({ ...state, history: [record, ...state.history] }))) result(record);
            break;
        }
        case 'result': result(data.history.find(record => record.id === itemId)); break;
        case 'delete-question':
        case 'delete-result': {
            const isQuestion = action === 'delete-question';
            const field = isQuestion ? 'questions' : 'history';
            if (window.confirm(isQuestion ? '删除这道题？' : '删除这次测试记录？') &&
                await update(state => ({ ...state, [field]: state[field].filter(item => item.id !== itemId) }))) overview();
            break;
        }
        }
    });

    dialog.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy) return;
        const form = event.target;
        if (form.dataset.ltForm === 'partner') {
            const name = form.elements.partnerName.value.trim();
            if (!name || [partner(), ...partners.map(item => item.name)].includes(name)) {
                feedback('请填写一个未使用的名字。');
                return;
            }
            const item = { ...blank(), id: id(), name };
            if (await update(state => ({ ...state, partners: [...(state.partners || []), item] }), true)) {
                partnerId = item.id;
                data = partners.find(role => role.id === item.id);
                overview();
            }
            return;
        }
        if (form.dataset.ltForm === 'import') {
            const lines = new FormData(form).get('bulk').trim().split(/\r?\n/).filter(line => line.trim());
            const items = lines.map(line => {
                const [question, ...options] = line.trim().split(/ {2,}/);
                return { id: id(), question, options, correct: 0 };
            });
            const invalid = items.findIndex(item => !validQuestion(item.question, item.options, item.correct));
            if (!items.length || invalid >= 0) {
                feedback(items.length ? `第 ${invalid + 1} 道题格式有误，请检查问题和选项。` : '请填写要导入的题目。');
                return;
            }
            if (await update(state => ({ ...state, questions: [...state.questions, ...items] }))) {
                overview();
                feedback(`已导入 ${items.length} 道题。`);
            }
            return;
        }
        const question = form.elements.question.value.trim();
        const options = Array.from(form.querySelectorAll('[name="option"]'), input => input.value.trim());
        const correct = Array.from(form.querySelectorAll('[name="lt-correct"]')).findIndex(input => input.checked);
        if (!validQuestion(question, options, correct)) {
            feedback('请填写题目和所有选项，选项内容不能重复。');
            return;
        }
        const item = { id: editingId || id(), question, options, correct };
        if (await update(state => ({ ...state, questions: editingId
            ? state.questions.map(q => q.id === editingId ? item : q) : [...state.questions, item] }))) overview();
    });
})();
