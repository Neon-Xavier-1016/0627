// ═══════════════════════════════════════════════════════════════════
//  Q&A 模块 —— 完整版
//  字卡回应统一规则：多张字卡用 3 个空格拼接成一段
// ═══════════════════════════════════════════════════════════════════

// ─────────── 常量 ───────────
const QA_QUESTION_PRESETS = [
    '你第一次心动是什么时候？','如果有一天我不在了，你会怎么办？','如果变成动物，你想让我变成什么？',
    '你还记得我们第一次说话吗？','你觉得我最大的缺点是什么？','你今天最想我的瞬间是什么时候？',
    '你最想和我一起做什么事？','有没有什么话一直想对我说但没说出口？','你觉得我们像什么？',
    '如果只能记住关于我的一件事，你会记住什么？','你最怕我做什么？','如果给你一个机会重新认识我，你会怎么做？',
    '你觉得我们之间最珍贵的瞬间是什么？','你最喜欢我笑起来还是认真的时候？','如果我变成一只猫，你会怎么办？',
    '你最想收到我送的什么礼物？','如果我明天要离开一年，你会对我说什么？','你觉得我们像哪部电影里的关系？',
    '你有什么瞒着我的小秘密吗？','你希望我为你改变什么吗？'
];

const QA_QUESTION_SEED = [
    '今天有没有想我？',
    '你最喜欢我哪一点？',
    '如果我们去旅行，你最想去哪里？',
    '你觉得我像什么动物？'
];

const QA_PERSONA_QUESTIONS = [
    { id: 'p1', q: '希望 Ta 怎么称呼你？',   ph: '例如：小名、昵称…' },
    { id: 'p2', q: '你对自己的描述',         ph: '一句话介绍自己' },
    { id: 'p3', q: '你最喜欢的三样东西',     ph: '例如：猫、下雨天、抹茶拿铁' },
    { id: 'p4', q: '你最不喜欢的三样东西',   ph: '例如：吵闹、香菜、迟到' },
    { id: 'p5', q: '你希望 Ta 记得的小习惯', ph: '例如：喜欢抱着杯子睡觉' },
    { id: 'p6', q: '你想让 Ta 知道的一件事', ph: '写下来吧' },
    { id: 'p7', q: '你希望 Ta 怎么哄你',     ph: '例如：不说话就抱抱' },
    { id: 'p8', q: '随便说点什么',           ph: '任何你想说的…' }
];

const QA_YES_VARIANTS = ['是', '嗯，是', '是啊', '对', '嗯…是', '是的呢'];
const QA_NO_VARIANTS  = ['否', '不是', '才没有', '没有啦', '不', '嗯…不是'];
const QA_WEEK_MS      = 7 * 24 * 60 * 60 * 1000;
const QA_CARD_SEP     = '   ';   // ★ 字卡之间的分隔：3 个空格

// ─────────── 数据层 ───────────
let qaData = null;

function _qaDefaultData() {
    return {
        persona: {
            completed: false,
            answers: {},
            evaluation: { cards: [], text: '', evaluatedAt: null, pendingUpdateAt: null, lastModifiedAt: null }
        },
        hisQuestions: {
            history: [], weekStart: null, weekQuota: 3, askedThisWeek: 0, lastAnsweredAt: null,
            usedQuestionIds: [], currentQuestion: null, pendingQuestion: null, pendingResponse: null
        },
        myQuestions: { history: [], currentPending: null },
        yesNo: { history: [] },
        recentCards: [],
        questionLibrary: []
    };
}

async function loadQaData() {
    const saved = await localforage.getItem(getStorageKey('qaData'));
    qaData = saved ? { ..._qaDefaultData(), ...saved } : _qaDefaultData();

    const def = _qaDefaultData();
    ['persona', 'hisQuestions', 'myQuestions', 'yesNo'].forEach(k => {
        if (!qaData[k]) qaData[k] = def[k];
    });
    if (!qaData.persona.evaluation) qaData.persona.evaluation = def.persona.evaluation;
    if (!Array.isArray(qaData.recentCards)) qaData.recentCards = [];
    if (!Array.isArray(qaData.persona.evaluation.cards)) qaData.persona.evaluation.cards = [];
    if (typeof qaData.persona.evaluation.text !== 'string') qaData.persona.evaluation.text = '';
    if (!Array.isArray(qaData.questionLibrary)) qaData.questionLibrary = [];

    _qaMigrateOldGroup();
    _qaSeedQuestionLibrary();
    return qaData;
}

function saveQaData() {
    localforage.setItem(getStorageKey('qaData'), qaData);
}

function _qaMigrateOldGroup() {
    if (!window.customReplyGroups) return;
    const idx = customReplyGroups.findIndex(g => g.isQaQuestions);
    if (idx < 0) return;
    const old = customReplyGroups[idx];
    (old.items || []).forEach(t => {
        if (typeof t === 'string' && !qaData.questionLibrary.includes(t)) {
            qaData.questionLibrary.push(t);
        }
    });
    customReplyGroups.splice(idx, 1);
    if (typeof throttledSaveData === 'function') throttledSaveData();
    saveQaData();
    console.log('✅ 已迁移旧 Q&A 分组 → questionLibrary');
}

function _qaSeedQuestionLibrary() {
    if (!qaData.questionLibrary.length && !qaData._qaLibSeeded) {
        qaData._qaLibSeeded = true;
        qaData.questionLibrary = [...QA_QUESTION_SEED];
        saveQaData();
        console.log('✅ Q&A 问题库已播种', QA_QUESTION_SEED.length, '条');
    }
}

// ─────────── 抽卡 & 抽题 ───────────
function drawReplyCards(count) {
    if (!qaData) return null;

    const disabledItems = (typeof _getDisabledItemsSet === 'function') ? _getDisabledItemsSet() : new Set();
    const recent = new Set(qaData.recentCards || []);

    const filterFn = (allowRecent) => customReplies.filter(item => {
        if (disabledItems.has(item)) return false;
        const g = customReplyGroups.find(grp => grp.items?.includes(item));
        if (g?.disabled) return false;
        if (!allowRecent && recent.has(item)) return false;
        return true;
    });

    let pool = filterFn(false);
    let usedFallback = false;
    if (!pool.length) { pool = filterFn(true); usedFallback = true; }
    if (!pool.length) return null;

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);
    if (!usedFallback) {
        qaData.recentCards = [...picked, ...qaData.recentCards].slice(0, 5);
    } else {
        qaData.recentCards = picked.slice(0, 5);
    }
    return picked;
}

function drawQuestion() {
    if (!qaData) return null;
    const lib = qaData.questionLibrary || [];
    const used = new Set(qaData.hisQuestions.usedQuestionIds);

    if (lib.length) {
        const avail = lib.filter(t => !used.has(t));
        const source = avail.length ? avail : lib;
        return source[Math.floor(Math.random() * source.length)];
    }

    const presetAvail = QA_QUESTION_PRESETS.filter(t => !used.has(t));
    if (presetAvail.length) return presetAvail[Math.floor(Math.random() * presetAvail.length)];
    return null;
}

function _qaGeneratePersonaEval() {
    const cards = drawReplyCards(_qaRandInt(8, 12));
    const list = cards || ['（梦角暂时想不出话）'];
    qaData.persona.evaluation.cards = list;
    qaData.persona.evaluation.text = list.join(QA_CARD_SEP);
    qaData.persona.evaluation.evaluatedAt = Date.now();
}

// ─────────── 小工具 ───────────
function _qaEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => (
        {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
    ));
}
function _qaRandRange(min, max) { return Math.random() * (max - min) + min; }
function _qaRandInt(min, max)   { return Math.floor(_qaRandRange(min, max + 1)); }

function _qaBindBacks(content) {
    if (!content) return;
    content.querySelectorAll('.qa-back-btn').forEach(btn => {
        btn.removeAttribute('onclick');
        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); _qaRenderHome(); };
    });
}

// ★ 统一：把字卡数组渲染成一段话
function _qaCardsParagraph(cards) {
    const list = (cards && cards.length) ? cards : ['（梦角暂时想不出话）'];
    const text = list.join(QA_CARD_SEP);
    return `<div class="qa-persona-eval-text" style="margin-top:6px;padding:12px 14px;font-size:13px;line-height:2;white-space:pre-wrap;">${_qaEsc(text)}</div>`;
}

// ─────────── 状态检查 ───────────
function checkAllQaStatus() {
    if (!qaData) return false;
    const now = Date.now();
    let changed = false;
    const pops = [];

    const pq = qaData.hisQuestions.pendingQuestion;
    if (pq && pq.replyTime <= now) {
        qaData.hisQuestions.pendingQuestion = null;
        qaData.hisQuestions.currentQuestion = { question: pq.question, askedAt: now };
        pops.push({ type: 'his-ask', emoji: '💭', title: '梦角想问你', sub: 'Ta 有问题想问你，去回答一下吧~' });
        changed = true;
    }

    const pr = qaData.hisQuestions.pendingResponse;
    if (pr && pr.replyTime <= now) {
        const cards = drawReplyCards(_qaRandInt(1, 5));
        qaData.hisQuestions.pendingResponse = null;
        qaData.hisQuestions.history.unshift({
            id: 'hq_' + Date.now(), question: pr.question, answer: pr.answer,
            cards: cards || ['（梦角暂时想不出话）'], answeredAt: Date.now()
        });
        if (qaData.hisQuestions.history.length > 25) qaData.hisQuestions.history.length = 25;
        qaData.hisQuestions.lastAnsweredAt = Date.now();
        qaData.hisQuestions.askedThisWeek++;
        pops.push({ type: 'his-reply', emoji: '💬', title: '梦角回应了你', sub: 'Ta 看了你的回答，快去看看吧~' });
        changed = true;
    }

    const mp = qaData.myQuestions.currentPending;
    if (mp && mp.replyTime <= now) {
        const cards = drawReplyCards(_qaRandInt(1, 5));
        qaData.myQuestions.history.unshift({
            id: 'mq_' + Date.now(), question: mp.question,
            cards: cards || ['（梦角暂时想不出话）'], askedAt: mp.askedAt, answeredAt: Date.now()
        });
        if (qaData.myQuestions.history.length > 25) qaData.myQuestions.history.length = 25;
        qaData.myQuestions.currentPending = null;
        pops.push({ type: 'mine-reply', emoji: '✨', title: '梦角回答了你的问题', sub: 'Ta 回答了你的提问，快去看看吧~' });
        changed = true;
    }

    qaData.yesNo.history.forEach(batch => {
        if (batch.status === 'pending' && batch.replyTime <= now) {
            batch.status = 'replied';
            batch.answers = batch.questions.map(() => {
                const yes = Math.random() < 0.5;
                if (Math.random() < 0.8) return yes ? '是' : '否';
                return yes ? QA_YES_VARIANTS[Math.floor(Math.random() * QA_YES_VARIANTS.length)]
                           : QA_NO_VARIANTS[Math.floor(Math.random() * QA_NO_VARIANTS.length)];
            });
            pops.push({ type: 'yn-reply', emoji: '✓', title: '问一句有回应啦', sub: `Ta 回答了你的 ${batch.questions.length} 道问题` });
            changed = true;
        }
    });

    const ev = qaData.persona.evaluation;
    if (ev.pendingUpdateAt && ev.pendingUpdateAt <= now) {
        _qaGeneratePersonaEval();
        ev.pendingUpdateAt = null;
        pops.push({ type: 'persona-update', emoji: '🪪', title: '梦角写好了对你的印象', sub: 'Ta 重新看了看你，有了新的想法~' });
        changed = true;
    }

    if (changed) {
        saveQaData();
        if (typeof playSound === 'function') playSound('message');
        pops.forEach(p => showQaPopup(p));
    }
    return changed;
}

// ─────────── 弹窗 ───────────
function showQaPopup({ type, emoji, title, sub }) {
    const existing = document.getElementById('qa-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'qa-popup';
    popup.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:20px;padding:18px 20px;z-index:8000;max-width:320px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,0.18);display:flex;flex-direction:column;gap:12px;animation:slideUpNotif 0.4s cubic-bezier(0.22,1,0.36,1);';
    popup.innerHTML = `
        <style>@keyframes slideUpNotif{from{opacity:0;transform:translateX(-50%) translateY(24px) scale(0.9)}60%{transform:translateX(-50%) translateY(-4px) scale(1.02)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}</style>
        <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:26px;">${emoji}</span>
            <div>
                <div style="font-size:14px;font-weight:700;color:var(--text-primary);">${title}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;opacity:0.8;">${sub}</div>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <button onclick="document.getElementById('qa-popup').remove();" style="flex:1;padding:8px 0;border-radius:12px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;">稍后查看</button>
            <button onclick="document.getElementById('qa-popup').remove();window._qaOpenAndRoute && window._qaOpenAndRoute('${type}');" style="flex:2;padding:8px 0;border-radius:12px;border:none;background:var(--accent-color);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">立即查看 →</button>
        </div>`;
    document.body.appendChild(popup);
    setTimeout(() => { if (popup.parentNode) popup.remove(); }, 8000);
}

// ─────────── 主界面 ───────────
function _qaRenderHome() {
    if (!qaData) return;
    const content = document.getElementById('qa-modal-content');
    if (!content) return;
    const personaReady = qaData.persona?.completed === true;

    content.innerHTML = `
        <div class="modal-title"><i class="fas fa-comments"></i><span>Q & A</span></div>
        <div class="qa-home-grid">
            <div class="qa-home-card" data-target="his-question">
                <div class="qa-home-card-icon">💭</div>
                <div class="qa-home-card-body">
                    <div class="qa-home-card-title">他的问题</div>
                    <div class="qa-home-card-sub">梦角来问你</div>
                </div>
                <div class="qa-home-card-badge" id="qa-badge-his"></div>
            </div>
            <div class="qa-home-card" data-target="my-question">
                <div class="qa-home-card-icon">✨</div>
                <div class="qa-home-card-body">
                    <div class="qa-home-card-title">我的问题</div>
                    <div class="qa-home-card-sub">你来问梦角</div>
                </div>
                <div class="qa-home-card-badge" id="qa-badge-mine"></div>
            </div>
            <div class="qa-home-card" data-target="yes-no">
                <div class="qa-home-card-icon">📝</div>
                <div class="qa-home-card-body">
                    <div class="qa-home-card-title">问一句</div>
                    <div class="qa-home-card-sub">是 / 否，快速确认</div>
                </div>
                <div class="qa-home-card-badge" id="qa-badge-yn"></div>
            </div>
            <div class="qa-home-card ${personaReady ? '' : 'qa-home-card-locked'}" data-target="persona">
                <div class="qa-home-card-icon">🪪</div>
                <div class="qa-home-card-body">
                    <div class="qa-home-card-title">人设卡</div>
                    <div class="qa-home-card-sub">${personaReady ? '关于我的一切' : '先回答几个问题吧'}</div>
                </div>
                <div class="qa-home-card-badge" id="qa-badge-persona"></div>
            </div>
        </div>
        <div class="modal-buttons">
            <button class="modal-btn modal-btn-secondary" id="qa-home-close">关闭</button>
        </div>
    `;

    content.querySelector('#qa-home-close').onclick = () => {
        if (typeof hideModal === 'function') hideModal(document.getElementById('qa-modal'));
    };
    content.querySelectorAll('.qa-home-card').forEach(card => {
        card.onclick = () => _qaRouteTo(card.dataset.target);
    });
    _qaUpdateBadges();
}

function _qaUpdateBadges() {
    if (!qaData) return;

    const his = qaData.hisQuestions;
    const hisBadge = document.getElementById('qa-badge-his');
    if (hisBadge) {
        if (his.currentQuestion) hisBadge.innerHTML = '<span class="qa-badge-dot"></span>';
        else if (his.pendingQuestion || his.pendingResponse) hisBadge.innerHTML = '<span class="qa-badge-spin"></span>';
        else hisBadge.innerHTML = '';
    }

    const mine = qaData.myQuestions;
    const mineBadge = document.getElementById('qa-badge-mine');
    if (mineBadge) {
        if (mine.currentPending) mineBadge.innerHTML = '<span class="qa-badge-spin"></span>';
        else mineBadge.innerHTML = '';
    }

    const yn = qaData.yesNo;
    const ynBadge = document.getElementById('qa-badge-yn');
    if (ynBadge) {
        const hasPending = yn.history.some(b => b.status === 'pending');
        const hasNew = yn.history.some(b => b.status === 'replied' && !b.viewed);
        if (hasNew) ynBadge.innerHTML = '<span class="qa-badge-dot"></span>';
        else if (hasPending) ynBadge.innerHTML = '<span class="qa-badge-spin"></span>';
        else ynBadge.innerHTML = '';
    }
}

// ─────────── 路由 ───────────
function _qaRouteTo(target) {
    if (!qaData) {
        if (typeof showNotification === 'function') showNotification('数据加载中…', 'warning');
        return;
    }
    if (target === 'his-question' && !qaData.persona.completed) {
        if (typeof showNotification === 'function') showNotification('先回答几个基础问题，让梦角更了解你 ✦', 'info');
        _qaRenderPersonaQuestionnaire();
        return;
    }
    if (target === 'persona') {
        if (qaData.persona.completed) _qaRenderPersonaDisplay();
        else _qaRenderPersonaQuestionnaire();
        return;
    }
    if (target === 'his-question') _qaRenderHisView();
    else if (target === 'my-question') _qaRenderMineView();
    else if (target === 'yes-no') _qaRenderYnView();
}

// ─────────── 他的问题 ───────────
function _qaRenderHisView() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const his = qaData.hisQuestions;

    let stateHtml = '';
    if (his.currentQuestion) {
        stateHtml = `
            <div class="qa-state-card qa-state-active">
                <div class="qa-state-label">💭 梦角问你</div>
                <div class="qa-question-text">${_qaEsc(his.currentQuestion.question)}</div>
            </div>
            <textarea class="qa-answer-input" id="qa-his-answer" placeholder="写下你的回答..." rows="3"></textarea>
            <button class="modal-btn modal-btn-primary" id="qa-his-submit" style="width:100%;margin-top:10px;">发送回答</button>`;
    } else if (his.pendingResponse) {
        stateHtml = `
            <div class="qa-state-card qa-state-waiting">
                <div class="qa-state-label">💬 等 Ta 回应</div>
                <div class="qa-dot-spinner"><span></span><span></span><span></span></div>
                <div class="qa-wait-hint">Ta 正在想怎么回复你…</div>
            </div>`;
    } else if (his.pendingQuestion) {
        stateHtml = `
            <div class="qa-state-card qa-state-waiting">
                <div class="qa-state-label">💭 等 Ta 来问</div>
                <div class="qa-dot-spinner"><span></span><span></span><span></span></div>
                <div class="qa-wait-hint">Ta 正在想一个问题问你…</div>
            </div>`;
    } else {
        const canUrge = _qaCanUrgeHis();
        stateHtml = `
            <div class="qa-state-card">
                <div class="qa-state-label">💭 让 Ta 问你</div>
                <div class="qa-wait-hint" style="margin-top:6px;">让梦角来问你一个问题<br><span style="opacity:0.6;font-size:11px;">Ta 会在 2-8 小时内来问你</span></div>
            </div>
            <button class="modal-btn modal-btn-primary" id="qa-his-urge" style="width:100%;margin-top:10px;" ${canUrge ? '' : 'disabled'}>
                ${canUrge ? '催一题' : '本周已问完'}
            </button>`;
    }

    // ★ 字卡合并成一段
    const historyHtml = his.history.length ? his.history.map(h => `
        <div class="qa-history-item">
            <div class="qa-history-q">💭 ${_qaEsc(h.question)}</div>
            <div class="qa-history-a">我：${_qaEsc(h.answer)}</div>
            ${_qaCardsParagraph(h.cards)}
        </div>
    `).join('') : '<div class="qa-empty">还没有记录</div>';

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>他的问题</span>
        </div>
        <div class="qa-subview-body">
            ${stateHtml}
            <div class="qa-history-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span>历史记录（${his.history.length}）</span>
                <button class="qa-eval-edit-btn" id="qa-manage-lib" type="button" style="font-size:11px;">
                    📚 管理问题库 →
                </button>
            </div>
            ${historyHtml}
        </div>`;

    _qaBindBacks(content);
    const urgeBtn = content.querySelector('#qa-his-urge');
    if (urgeBtn) urgeBtn.onclick = _qaUrgeHis;
    const submitBtn = content.querySelector('#qa-his-submit');
    if (submitBtn) submitBtn.onclick = _qaSubmitHisAnswer;
    const libBtn = content.querySelector('#qa-manage-lib');
    if (libBtn) libBtn.onclick = _qaOpenMyQuestionLibrary;
}

function _qaCanUrgeHis() {
    const his = qaData.hisQuestions;
    if (his.currentQuestion || his.pendingQuestion || his.pendingResponse) return false;
    const now = Date.now();
    if (!his.weekStart || now - his.weekStart > QA_WEEK_MS) {
        his.weekStart = now;
        his.askedThisWeek = 0;
        his.weekQuota = 3 + (Math.random() < 0.5 ? 1 : 0);
        saveQaData();
    }
    return his.askedThisWeek < his.weekQuota;
}

function _qaUrgeHis() {
    const q = drawQuestion();
    if (!q) {
        if (typeof showNotification === 'function') showNotification('问题库空了，去管理问题库添加吧', 'warning');
        return;
    }
    const replyTime = Date.now() + (2 + Math.random() * 6) * 60 * 60 * 1000;
    qaData.hisQuestions.pendingQuestion = { question: q, replyTime };
    saveQaData();
    if (typeof showNotification === 'function') showNotification('已催，Ta 会在 2-8 小时内来问你', 'success');
    _qaRenderHisView();
}

function _qaSubmitHisAnswer() {
    const input = document.getElementById('qa-his-answer');
    if (!input || !qaData) return;
    const answer = input.value.trim();
    if (!answer) {
        if (typeof showNotification === 'function') showNotification('回答不能为空', 'warning');
        return;
    }
    const cq = qaData.hisQuestions.currentQuestion;
    if (!cq) return;

    const replyTime = Date.now() + (15 + Math.random() * 45) * 60 * 1000;
    qaData.hisQuestions.pendingResponse = { question: cq.question, answer, replyTime };
    qaData.hisQuestions.currentQuestion = null;
    if (!qaData.hisQuestions.usedQuestionIds.includes(cq.question)) {
        qaData.hisQuestions.usedQuestionIds.push(cq.question);
    }
    saveQaData();
    if (typeof showNotification === 'function') showNotification('已发送，等 Ta 回应~', 'success');
    _qaRenderHisView();
}

// ─────────── 我的问题 ───────────
function _qaRenderMineView() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const mine = qaData.myQuestions;

    let stateHtml = '';
    if (mine.currentPending) {
        stateHtml = `
            <div class="qa-state-card qa-state-waiting">
                <div class="qa-state-label">✨ 等 Ta 回答</div>
                <div class="qa-question-text" style="margin-top:10px;">${_qaEsc(mine.currentPending.question)}</div>
                <div class="qa-dot-spinner" style="margin-top:14px;"><span></span><span></span><span></span></div>
                <div class="qa-wait-hint">Ta 正在思考你的问题…</div>
            </div>`;
    } else {
        stateHtml = `
            <div class="qa-state-card">
                <div class="qa-state-label">✨ 问 Ta 一个问题</div>
                <textarea class="qa-answer-input" id="qa-mine-input" placeholder="写下你想问的..." rows="3" style="margin-top:10px;"></textarea>
            </div>
            <button class="modal-btn modal-btn-primary" id="qa-mine-submit" style="width:100%;margin-top:10px;">发出</button>`;
    }

    // ★ 字卡合并成一段
    const historyHtml = mine.history.length ? mine.history.map(h => `
        <div class="qa-history-item">
            <div class="qa-history-q">✨ ${_qaEsc(h.question)}</div>
            ${_qaCardsParagraph(h.cards)}
        </div>
    `).join('') : '<div class="qa-empty">还没有记录</div>';

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>我的问题</span>
        </div>
        <div class="qa-subview-body">
            ${stateHtml}
            <div class="qa-history-title">已回答（${mine.history.length}）</div>
            ${historyHtml}
        </div>`;

    _qaBindBacks(content);
    const submitBtn = content.querySelector('#qa-mine-submit');
    if (submitBtn) submitBtn.onclick = _qaSubmitMineQuestion;
}

function _qaSubmitMineQuestion() {
    const input = document.getElementById('qa-mine-input');
    if (!input || !qaData) return;
    const q = input.value.trim();
    if (!q) {
        if (typeof showNotification === 'function') showNotification('问题不能为空', 'warning');
        return;
    }
    const replyTime = Date.now() + (15 + Math.random() * 105) * 60 * 1000;
    qaData.myQuestions.currentPending = { question: q, askedAt: Date.now(), replyTime };
    saveQaData();
    if (typeof showNotification === 'function') showNotification('已发出，等 Ta 回答~', 'success');
    _qaRenderMineView();
}

// ─────────── 人设卡 ───────────
function _qaRenderPersonaQuestionnaire() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const p = qaData.persona;
    const isEdit = p.completed === true;

    const formHtml = QA_PERSONA_QUESTIONS.map(q => {
        const val = p.answers[q.id] || '';
        return `
            <div class="qa-persona-q">
                <div class="qa-persona-q-label">${_qaEsc(q.q)}</div>
                <textarea class="qa-answer-input" data-qid="${q.id}" placeholder="${_qaEsc(q.ph)}" rows="2">${_qaEsc(val)}</textarea>
            </div>`;
    }).join('');

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>人设卡 · ${isEdit ? '修改回答' : '初次填写'}</span>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;opacity:0.8;">
            认真回答这 8 个问题，让梦角更了解你 ✦
        </div>
        <div class="qa-persona-form" style="display:flex;flex-direction:column;gap:14px;">
            ${formHtml}
        </div>
        <button class="modal-btn modal-btn-primary" id="qa-persona-submit" style="width:100%;margin-top:16px;">
            ${isEdit ? '保存修改' : '提交'}
        </button>`;

    _qaBindBacks(content);
    content.querySelector('#qa-persona-submit').onclick = _qaSubmitPersonaQuestionnaire;
}

function _qaSubmitPersonaQuestionnaire() {
    if (!qaData) return;
    const inputs = document.querySelectorAll('#qa-modal-content textarea[data-qid]');
    const answers = {};
    let filled = 0;
    inputs.forEach(el => {
        const v = el.value.trim();
        answers[el.dataset.qid] = v;
        if (v) filled++;
    });
    if (filled === 0) {
        if (typeof showNotification === 'function') showNotification('至少回答一个问题吧~', 'warning');
        return;
    }

    const wasCompleted = qaData.persona.completed;
    qaData.persona.answers = answers;
    qaData.persona.completed = true;
    qaData.persona.evaluation.lastModifiedAt = Date.now();

    if (wasCompleted) {
        const delayMs = (30 + Math.random() * 150) * 60 * 1000;
        qaData.persona.evaluation.pendingUpdateAt = Date.now() + delayMs;
        if (typeof showNotification === 'function') showNotification('已保存，Ta 会在 30分钟-3小时内更新对你的印象 ✦', 'success');
    } else {
        _qaGeneratePersonaEval();
        if (typeof showNotification === 'function') showNotification('已提交，梦角写下了对你的印象 ✦', 'success');
    }
    saveQaData();
    _qaRenderPersonaDisplay();
}

function _qaRenderPersonaDisplay() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const p = qaData.persona;
    const ev = p.evaluation;

    const answersHtml = QA_PERSONA_QUESTIONS.map(q => {
        const val = p.answers[q.id] || '（未回答）';
        return `
            <div class="qa-history-item">
                <div class="qa-history-q">${_qaEsc(q.q)}</div>
                <div class="qa-history-a">${_qaEsc(val)}</div>
            </div>`;
    }).join('');

    let evalText = ev.text || '';
    if (!evalText && ev.cards && ev.cards.length) {
        evalText = ev.cards.join(QA_CARD_SEP);
        ev.text = evalText;
    }
    const evalHtml = evalText
        ? `<div class="qa-persona-eval-text">${_qaEsc(evalText)}</div>`
        : '<div class="qa-empty">梦角还在写…</div>';

    const pending = ev.pendingUpdateAt && ev.pendingUpdateAt > Date.now();
    const pendingHint = pending
        ? `<div style="font-size:11px;color:var(--text-secondary);opacity:0.7;margin-top:8px;"><span class="qa-badge-spin" style="vertical-align:-2px;margin-right:4px;"></span>梦角正在更新对你的印象…</div>`
        : '';

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>人设卡</span>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
            <button class="modal-btn modal-btn-secondary" id="qa-persona-edit" style="font-size:12px;padding:6px 14px;">
                <i class="fas fa-pen"></i> 修改回答
            </button>
        </div>
        <div class="qa-history-title">关于我的一切</div>
        <div class="qa-subview-body" style="margin-bottom:18px;">${answersHtml}</div>
        <div class="qa-history-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>Ta 眼中的我</span>
            <button class="qa-eval-edit-btn" id="qa-eval-edit" type="button"><i class="fas fa-pen" style="font-size:10px;margin-right:3px;"></i>编辑</button>
        </div>
        <div id="qa-eval-wrap" style="margin-top:4px;">${evalHtml}</div>
        ${pendingHint}
    `;

    _qaBindBacks(content);
    content.querySelector('#qa-persona-edit').onclick = () => _qaRenderPersonaQuestionnaire();
    content.querySelector('#qa-eval-edit').onclick = _qaEditPersonaEval;
}

function _qaEditPersonaEval() {
    const wrap = document.getElementById('qa-eval-wrap');
    if (!wrap || !qaData) return;
    const ev = qaData.persona.evaluation;
    const cur = ev.text || (ev.cards || []).join(QA_CARD_SEP);

    wrap.innerHTML = `
        <textarea class="qa-answer-input" id="qa-eval-input" rows="6" style="width:100%;box-sizing:border-box;line-height:1.9;">${_qaEsc(cur)}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
            <button class="modal-btn modal-btn-secondary" id="qa-eval-cancel" style="font-size:12px;padding:6px 14px;">取消</button>
            <button class="modal-btn modal-btn-primary" id="qa-eval-save" style="font-size:12px;padding:6px 14px;">保存</button>
        </div>
    `;

    document.getElementById('qa-eval-cancel').onclick = () => _qaRenderPersonaDisplay();
    document.getElementById('qa-eval-save').onclick = () => {
        const v = document.getElementById('qa-eval-input').value.trim();
        qaData.persona.evaluation.text = v;
        saveQaData();
        if (typeof showNotification === 'function') showNotification('✓ 已保存', 'success');
        _qaRenderPersonaDisplay();
    };
}

// ─────────── 问一句 ───────────
function _qaRenderYnView() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const yn = qaData.yesNo;

    const pendingBatch = yn.history.find(b => b.status === 'pending');
    if (pendingBatch) { _qaRenderYnWaiting(pendingBatch); return; }
    const newBatch = yn.history.find(b => b.status === 'replied' && !b.viewed);
    if (newBatch) { _qaRenderYnResult(newBatch); return; }
    _qaRenderYnInput();
}

function _qaRenderYnInput() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const yn = qaData.yesNo;

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>问一句</span>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;opacity:0.8;">
            写下 1-10 道是非题，梦角会在 2-5 分钟内回答 ✦
        </div>
        <div id="qa-yn-inputs"></div>
        <button class="modal-btn modal-btn-secondary" id="qa-yn-add" style="width:100%;margin-top:6px;">
            <i class="fas fa-plus"></i> 添加一道
        </button>
        <button class="modal-btn modal-btn-primary" id="qa-yn-submit" style="width:100%;margin-top:10px;">发出</button>
        <div class="qa-history-title">历史记录（${yn.history.filter(b => b.status === 'replied').length}）</div>
        <div id="qa-yn-history"></div>
    `;

    _qaBindBacks(content);

    const inputWrap = content.querySelector('#qa-yn-inputs');
    let items = [''];

    function renderInputs() {
        inputWrap.innerHTML = items.map((v, i) => `
            <div class="qa-yn-input-row">
                <div class="qa-yn-num">${i + 1}</div>
                <input type="text" class="qa-answer-input" data-idx="${i}" value="${_qaEsc(v)}" placeholder="例如：是不是很晚睡觉？" style="flex:1;padding:10px 12px;">
                ${items.length > 1 ? `<button class="qa-yn-remove" type="button" data-remove="${i}"><i class="fas fa-times"></i></button>` : ''}
            </div>
        `).join('');
        inputWrap.querySelectorAll('input').forEach(inp => {
            inp.oninput = e => { items[parseInt(e.target.dataset.idx)] = e.target.value; };
        });
        inputWrap.querySelectorAll('[data-remove]').forEach(btn => {
            btn.onclick = () => { items.splice(parseInt(btn.dataset.remove), 1); renderInputs(); };
        });
    }
    renderInputs();

    content.querySelector('#qa-yn-add').onclick = () => {
        if (items.length >= 10) {
            if (typeof showNotification === 'function') showNotification('最多 10 道', 'warning');
            return;
        }
        items.push('');
        renderInputs();
        setTimeout(() => {
            const last = inputWrap.querySelectorAll('input')[items.length - 1];
            if (last) last.focus();
        }, 60);
    };

    content.querySelector('#qa-yn-submit').onclick = () => {
        const questions = items.map(s => s.trim()).filter(Boolean);
        if (!questions.length) {
            if (typeof showNotification === 'function') showNotification('至少写一道题', 'warning');
            return;
        }
        _qaSubmitYesNo(questions);
    };

    const historyWrap = content.querySelector('#qa-yn-history');
    const replied = yn.history.filter(b => b.status === 'replied');
    if (!replied.length) {
        historyWrap.innerHTML = '<div class="qa-empty">还没有记录</div>';
    } else {
        historyWrap.innerHTML = replied.map(batch => `
            <div class="qa-history-item" style="margin-bottom:10px;">
                ${batch.questions.map((q, i) => `
                    <div class="qa-yn-history-row">
                        <span class="qa-q">${_qaEsc(q)}</span>
                        <span class="qa-a">${_qaEsc((batch.answers && batch.answers[i]) || '—')}</span>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }
}

function _qaSubmitYesNo(questions) {
    const replyTime = Date.now() + (2 + Math.random() * 3) * 60 * 1000;
    qaData.yesNo.history.unshift({
        id: 'yn_' + Date.now(), questions, answers: null,
        submittedAt: Date.now(), replyTime, status: 'pending', viewed: false
    });
    if (qaData.yesNo.history.length > 25) qaData.yesNo.history.length = 25;
    saveQaData();
    if (typeof showNotification === 'function') showNotification('已发出，等 Ta 回应~', 'success');
    _qaRenderYnView();
}

function _qaRenderYnWaiting(batch) {
    const content = document.getElementById('qa-modal-content');
    if (!content) return;
    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>问一句</span>
        </div>
        <div class="qa-state-card qa-state-waiting">
            <div class="qa-state-label">📝 等 Ta 回应</div>
            <div class="qa-dot-spinner"><span></span><span></span><span></span></div>
            <div class="qa-wait-hint">已发出 ${batch.questions.length} 道题<br>Ta 会在 2-5 分钟内回答</div>
        </div>
    `;
    _qaBindBacks(content);
}

function _qaRenderYnResult(batch) {
    const content = document.getElementById('qa-modal-content');
    if (!content) return;

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>问一句 · 回应</span>
        </div>
        <div id="qa-yn-result-list" style="display:flex;flex-direction:column;gap:10px;"></div>
        <button class="modal-btn modal-btn-secondary" id="qa-yn-done" style="width:100%;margin-top:16px;">知道了</button>
    `;
    _qaBindBacks(content);

    const list = content.querySelector('#qa-yn-result-list');
    list.innerHTML = batch.questions.map((q, i) => {
        const a = (batch.answers && batch.answers[i]) || '—';
        const isSoft = a.length > 1;
        return `
            <div class="qa-yn-result-item" data-i="${i}">
                <div class="qa-yn-result-q">${_qaEsc(q)}</div>
                <div class="qa-yn-result-a ${isSoft ? 'soft' : ''}">${_qaEsc(a)}</div>
            </div>`;
    }).join('');

    list.querySelectorAll('.qa-yn-result-item').forEach((el, i) => {
        setTimeout(() => el.classList.add('show'), 400 + i * 600);
    });

    content.querySelector('#qa-yn-done').onclick = () => {
        batch.viewed = true;
        saveQaData();
        _qaRenderYnInput();
    };
}

// ═══════════════════════════════════════════════════════════════════
//  Q&A 问题库子 tab
// ═══════════════════════════════════════════════════════════════════

// ① 注入 tab 到回复库配置
(function _qaInjectLibTab() {
    const tryInject = () => {
        const cfg = window.LIBRARY_CONFIG || (typeof LIBRARY_CONFIG !== 'undefined' ? LIBRARY_CONFIG : null);
        if (!cfg || !cfg.reply) { setTimeout(tryInject, 60); return; }
        const tabs = cfg.reply.tabs;
        if (!tabs.find(t => t.id === 'qaQuestions')) {
            tabs.push({ id: 'qaQuestions', name: 'Q&A 问题库', mode: 'card' });
            console.log('✅ Q&A 问题库 tab 已注入');
        }
    };
    tryInject();
})();

// ② 拦截 renderReplyLibrary
(function _qaPatchRenderReplyLibrary() {
    const tryPatch = () => {
        const fn = window.renderReplyLibrary || (typeof renderReplyLibrary !== 'undefined' ? renderReplyLibrary : null);
        if (typeof fn !== 'function') { setTimeout(tryPatch, 60); return; }
        if (window._qaPatchedRenderRL) return;
        window._qaPatchedRenderRL = true;
        const orig = fn;
        window.renderReplyLibrary = function() {
            try {
                if (typeof currentSubTab !== 'undefined' && currentSubTab === 'qaQuestions') {
                    return _qaRenderQaLibTab();
                }
            } catch (e) {}
            return orig.apply(this, arguments);
        };
    };
    tryPatch();
})();

// ③ Q&A 问题库 tab 渲染
function _qaRenderQaLibTab() {
    if (!qaData) {
        const _l = document.getElementById('custom-replies-list');
        if (_l) _l.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary);">加载中…</div>';
        if (typeof loadQaData === 'function') {
            loadQaData().then(() => _qaRenderQaLibTab()).catch(e => {
                console.error('loadQaData 失败:', e);
                if (_l) _l.innerHTML = '<div style="padding:40px;text-align:center;color:#f66;">加载失败，刷新试试</div>';
            });
        }
        return;
    }
    const list = document.getElementById('custom-replies-list');
    const titleEl = document.getElementById('cr-modal-title');
    const subTabs = document.getElementById('cr-sub-tabs');
    const toolbar = document.getElementById('batch-ops-toolbar');
    const addBtn = document.getElementById('add-custom-reply');
    const annPanel = document.getElementById('announcement-panel');

    if (titleEl) titleEl.textContent = '回复库管理';
    if (annPanel) annPanel.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    if (addBtn) addBtn.style.display = 'none';
    if (!list) return;

    list.style.display = '';
    if (subTabs) subTabs.style.display = '';

    if (subTabs) {
        subTabs.querySelectorAll('.reply-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.id === 'qaQuestions');
        });
    }

    const qs = qaData?.questionLibrary || [];

    list.innerHTML = `
        <div style="padding:16px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.7;">
                这里的问题会用于「Q&A · 他的问题」<br>
                梦角会随机挑一道来问你。问题越具体，越像 Ta 在了解你 ✦
            </div>
            <div id="qa-lib-list"></div>
            <div style="display:flex;gap:8px;margin-top:14px;">
                <button class="modal-btn modal-btn-primary" id="qa-lib-add" style="flex:1;">
                    <i class="fas fa-plus"></i> 添加
                </button>
                <button class="modal-btn modal-btn-secondary" id="qa-lib-batch" style="flex:1;">
                    <i class="fas fa-layer-group"></i> 批量
                </button>
                <button class="modal-btn modal-btn-secondary" id="qa-lib-clear" style="flex:1;color:#ef4444;border-color:rgba(239,68,68,0.3);">
                    <i class="fas fa-trash"></i> 清空
                </button>
            </div>
        </div>
    `;

    const inner = list.querySelector('#qa-lib-list');

    if (!qs.length) {
        inner.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--text-secondary);opacity:0.6;">
                <i class="fas fa-comment-dots" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.4;"></i>
                还没有问题<br>
                <span style="font-size:11px;opacity:0.7;">点下方按钮添加第一条吧</span>
            </div>
        `;
    } else {
        inner.innerHTML = qs.map((q, i) => `
            <div class="rl-card" style="margin-bottom:7px;">
                <div style="flex:1;min-width:0;">
                    <span style="font-size:13px;color:var(--text-primary);line-height:1.6;">${_qaEsc(q)}</span>
                    <span style="display:inline-flex;align-items:center;gap:3px;padding:1px 7px 1px 5px;border-radius:10px;font-size:10px;background:#7C5CFF18;color:#7C5CFF;border:1px solid #7C5CFF30;margin-top:5px;margin-left:6px;">
                        <span style="width:5px;height:5px;border-radius:50%;background:#7C5CFF;"></span>#${i+1}
                    </span>
                </div>
                <div class="rl-card-actions" style="opacity:1;">
                    <button class="rl-act-btn" data-edit="${i}" title="编辑"><i class="fas fa-pen"></i></button>
                    <button class="rl-act-btn danger" data-del="${i}" title="删除"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');

        inner.querySelectorAll('[data-edit]').forEach(b => {
            b.onclick = () => {
                const i = parseInt(b.dataset.edit);
                const cur = qaData.questionLibrary[i];
                const nv = prompt('修改问题：', cur);
                if (nv !== null && nv.trim()) {
                    qaData.questionLibrary[i] = nv.trim();
                    saveQaData();
                    _qaRenderQaLibTab();
                    if (typeof showNotification === 'function') showNotification('✓ 已修改', 'success');
                }
            };
        });
        inner.querySelectorAll('[data-del]').forEach(b => {
            b.onclick = () => {
                const i = parseInt(b.dataset.del);
                if (!confirm('删除这个问题？')) return;
                qaData.questionLibrary.splice(i, 1);
                saveQaData();
                _qaRenderQaLibTab();
                if (typeof showNotification === 'function') showNotification('已删除', 'success');
            };
        });
    }

    list.querySelector('#qa-lib-add').onclick = () => {
        const v = prompt('输入新问题：', '');
        if (v && v.trim()) {
            qaData.questionLibrary.push(v.trim());
            saveQaData();
            _qaRenderQaLibTab();
            if (typeof showNotification === 'function') showNotification('✓ 已添加', 'success');
        }
    };
    list.querySelector('#qa-lib-batch').onclick = window._qaBatchAddQuestions;
    list.querySelector('#qa-lib-clear').onclick = window._qaClearAllQuestions;
}

// ④ 跳到 Q&A 问题库 tab
function _qaOpenMyQuestionLibrary() {
    if (typeof hideModal === 'function') hideModal(document.getElementById('qa-modal'));

    setTimeout(() => {
        const entry = document.getElementById('custom-replies-function');
        if (entry) entry.click();

        setTimeout(() => {
            document.querySelectorAll('.sidebar-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.major === 'reply');
            });
            try {
                if (typeof currentMajorTab !== 'undefined') window.currentMajorTab = 'reply';
                if (typeof currentSubTab !== 'undefined') window.currentSubTab = 'qaQuestions';
            } catch (e) {}
            _qaRenderQaLibTab();

            if (typeof showNotification === 'function') {
                showNotification('已跳转到「Q&A 问题库」✦', 'success');
            }
        }, 350);
    }, 200);
}

// ─────────── 入口 & 弹窗路由 ───────────
async function openQaModal() {
    const modal = document.getElementById('qa-modal');
    if (!modal) { console.error('❌ qa-modal 不存在'); return; }

    if (typeof showModal === 'function') showModal(modal);
    else modal.style.display = 'flex';

    try { await loadQaData(); } catch (e) { console.error('❌ loadQaData:', e); qaData = _qaDefaultData(); }
    try { checkAllQaStatus(); } catch (e) { console.error('❌ checkAllQaStatus:', e); }
    try { _qaRenderHome(); } catch (e) { console.error('❌ _qaRenderHome:', e); }
}

window._qaOpenAndRoute = function(type) {
    const map = {
        'his-ask': 'his-question', 'his-reply': 'his-question',
        'mine-reply': 'my-question', 'yn-reply': 'yes-no',
        'persona-update': 'persona'
    };
    const target = map[type];
    openQaModal().then(() => { if (target) _qaRouteTo(target); });
};

// ─────────── 挂载 ───────────
window.openQaModal         = openQaModal;
window.loadQaData          = loadQaData;
window.saveQaData          = saveQaData;
window.drawReplyCards      = drawReplyCards;
window.drawQuestion        = drawQuestion;
window.checkAllQaStatus    = checkAllQaStatus;
window.showQaPopup         = showQaPopup;
window._qaRouteTo          = _qaRouteTo;
window._qaRenderHome       = _qaRenderHome;
window._qaUpdateBadges     = _qaUpdateBadges;
window._qaRenderYnView     = _qaRenderYnView;
window._qaRenderQaLibTab   = _qaRenderQaLibTab;
window._qaOpenMyQuestionLibrary = _qaOpenMyQuestionLibrary;
window._qaRenderPersonaView = function() {
    if (!qaData) return;
    if (qaData.persona.completed) _qaRenderPersonaDisplay();
    else _qaRenderPersonaQuestionnaire();
};

// ─────────── 批量添加 ───────────
window._qaBatchAddQuestions = function() {
    if (!qaData) { alert('数据还没加载好，稍后再试'); return; }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';

    const panel = document.createElement('div');
    panel.style.cssText = `
        background:var(--secondary-bg);border-radius:22px;padding:24px;
        width:92%;max-width:420px;max-height:88vh;
        display:flex;flex-direction:column;
        box-shadow:0 24px 80px rgba(0,0,0,.45);
        animation:qaPopIn 0.22s cubic-bezier(.34,1.56,.64,1);
    `;

    panel.innerHTML = `
        <style>@keyframes qaPopIn{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}</style>
        <div style="flex-shrink:0;font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">
            批量添加问题
        </div>
        <div style="flex-shrink:0;font-size:12px;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
            每行一条，自动去重
        </div>
        <div style="flex:1;overflow-y:auto;min-height:0;">
            <textarea id="qa-batch-input" rows="10" placeholder="在此粘贴问题，每行一条…&#10;例如：&#10;今天有没有想我？&#10;你最喜欢我哪一点？&#10;如果我们去旅行，你最想去哪里？" style="
                width:100%;box-sizing:border-box;padding:12px 14px;
                border:1.5px solid var(--border-color);border-radius:13px;
                background:var(--primary-bg);color:var(--text-primary);
                font-size:13px;font-family:var(--font-family);outline:none;resize:vertical;
                line-height:1.7;transition:border 0.18s;
            "></textarea>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:6px;">
                <span id="qa-batch-count">0 条</span>
            </div>
        </div>
        <div style="flex-shrink:0;padding-top:14px;display:flex;gap:10px;">
            <button id="qa-batch-cancel" style="flex:1;padding:12px;border:1.5px solid var(--border-color);border-radius:13px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">取消</button>
            <button id="qa-batch-confirm" style="flex:2;padding:12px;border:none;border-radius:13px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--font-family);">添加</button>
        </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const ta = panel.querySelector('#qa-batch-input');
    const countEl = panel.querySelector('#qa-batch-count');
    ta.addEventListener('input', () => {
        const lines = ta.value.split('\n').filter(l => l.trim());
        countEl.textContent = `${lines.length} 条`;
    });
    ta.addEventListener('focus', e => { e.target.style.borderColor = 'var(--accent-color)'; });
    ta.addEventListener('blur', e => { e.target.style.borderColor = 'var(--border-color)'; });

    setTimeout(() => ta.focus(), 80);

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    panel.querySelector('#qa-batch-cancel').onclick = close;

    panel.querySelector('#qa-batch-confirm').onclick = () => {
        const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) {
            if (typeof showNotification === 'function') showNotification('至少输入一条', 'warning');
            return;
        }
        if (!Array.isArray(qaData.questionLibrary)) qaData.questionLibrary = [];
        let added = 0, skipped = 0;
        lines.forEach(v => {
            const norm = v.replace(/\s+/g, '');
            const dup = qaData.questionLibrary.some(q => q.replace(/\s+/g, '') === norm);
            if (dup) { skipped++; return; }
            qaData.questionLibrary.push(v);
            added++;
        });
        saveQaData();
        close();
        _qaRenderQaLibTab();
        if (typeof showNotification === 'function') {
            showNotification(`✓ 添加 ${added} 条${skipped ? `，跳过 ${skipped} 条重复` : ''}`, 'success');
        }
    };
};

// ─────────── 清空 ───────────
window._qaClearAllQuestions = function() {
    if (!qaData) return;
    const n = (qaData.questionLibrary || []).length;
    if (!n) {
        if (typeof showNotification === 'function') showNotification('问题库本来就是空的', 'info');
        return;
    }
    if (!confirm(`确定要删除全部 ${n} 条问题吗？\n\n此操作不可恢复`)) return;
    qaData.questionLibrary = [];
    saveQaData();
    _qaRenderQaLibTab();
    if (typeof showNotification === 'function') showNotification(`已清空 ${n} 条问题`, 'success');
};

// ─────────── 预加载 ───────────
setTimeout(() => {
    if (!qaData && typeof loadQaData === 'function') {
        loadQaData().catch(e => console.warn('qaData 预加载失败', e));
    }
}, 1500);

console.log('✅ Q&A 模块已加载');
// ═══════════════════════════════════════════════════════════════════
//  历史记录 · 字卡段落 + 可编辑（选择编辑"我的话"或"梦角的话"）
// ═══════════════════════════════════════════════════════════════════

function _qaCardsText(h) {
    if (h.cardsText != null) return h.cardsText;
    if (h.cards && h.cards.length) return h.cards.join(QA_CARD_SEP);
    return '（梦角暂时想不出话）';
}

// 字卡段落（纯展示）
function _qaCardsBlock(h, idx) {
    return `
        <div class="qa-cards-block" data-idx="${idx}" style="margin-top:6px;">
            <div class="qa-persona-eval-text" style="padding:12px 14px;font-size:13px;line-height:2;white-space:pre-wrap;">${_qaEsc(_qaCardsText(h))}</div>
        </div>
    `;
}

// 编辑按钮 HTML（问题行右侧）
function _qaEditBtnHTML(idx) {
    return `
        <button class="qa-eval-edit-btn qa-edit-toggle" type="button" data-idx="${idx}" style="flex-shrink:0;font-size:11px;padding:2px 8px;">
            <i class="fas fa-pen" style="font-size:9px;margin-right:2px;"></i>编辑
        </button>
    `;
}

// ─── 编辑选择浮层 ───
function _qaShowEditPicker(anchorBtn, onPick) {
    const old = document.getElementById('qa-edit-picker');
    if (old) old.remove();

    const rect = anchorBtn.getBoundingClientRect();
    const picker = document.createElement('div');
    picker.id = 'qa-edit-picker';
    picker.style.cssText = `
        position:fixed;
        top:${Math.min(rect.bottom + 4, window.innerHeight - 100)}px;
        right:${Math.max(window.innerWidth - rect.right, 8)}px;
        background:var(--secondary-bg);
        border:1px solid var(--border-color);
        border-radius:10px;
        box-shadow:0 6px 24px rgba(0,0,0,0.22);
        padding:4px;
        z-index:99999;
        min-width:130px;
        animation:qaPickerIn 0.12s ease;
    `;
    picker.innerHTML = `
        <style>
            @keyframes qaPickerIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
            .qa-picker-item {
                width:100%;padding:8px 12px;border:none;background:transparent;
                text-align:left;font-size:13px;color:var(--text-primary);
                cursor:pointer;border-radius:7px;font-family:var(--font-family);
                display:flex;align-items:center;gap:8px;transition:background 0.12s;
            }
            .qa-picker-item:hover { background:rgba(var(--accent-color-rgb),0.1); }
        </style>
        <button class="qa-picker-item" data-pick="my">
            <i class="fas fa-user" style="font-size:11px;color:var(--accent-color);width:14px;"></i>
            我的话
        </button>
        <button class="qa-picker-item" data-pick="cards">
            <i class="fas fa-heart" style="font-size:11px;color:var(--accent-color);width:14px;"></i>
            梦角的话
        </button>
    `;
    document.body.appendChild(picker);

    picker.querySelectorAll('.qa-picker-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            picker.remove();
            onPick(item.dataset.pick);
        };
    });

    setTimeout(() => {
        const closeHandler = (e) => {
            if (!picker.contains(e.target) && e.target !== anchorBtn) {
                picker.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 30);
}

// ─── 编辑"我的话" ───
function _qaEditMyText(content, list, i, field, afterSave) {
    const h = list[i];
    const cur = h[field] || '';
    const el = content.querySelector(`[data-my-text-idx="${i}"]`);
    if (!el) return;

    // 提取前缀（如 "我：" 或 "✨ "）保留
    const prefix = el.dataset.prefix || '';

    el.innerHTML = `
        ${prefix}
        <textarea class="qa-answer-input" rows="3" style="width:100%;box-sizing:border-box;line-height:1.7;font-size:13px;margin-top:4px;">${_qaEsc(cur)}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
            <button class="modal-btn modal-btn-secondary qa-my-cancel" style="font-size:12px;padding:6px 14px;">取消</button>
            <button class="modal-btn modal-btn-primary qa-my-save" style="font-size:12px;padding:6px 14px;">保存</button>
        </div>
    `;
    const ta = el.querySelector('textarea');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    el.querySelector('.qa-my-cancel').onclick = () => afterSave();
    el.querySelector('.qa-my-save').onclick = () => {
        list[i][field] = ta.value;
        saveQaData();
        if (typeof showNotification === 'function') showNotification('✓ 已保存', 'success');
        afterSave();
    };
}

// ─── 编辑"梦角的话"（字卡）───
function _qaEditCards(content, list, i, afterSave) {
    const h = list[i];
    const cur = _qaCardsText(h);
    const block = content.querySelector(`.qa-cards-block[data-idx="${i}"]`);
    if (!block) return;

    block.innerHTML = `
        <textarea class="qa-answer-input" rows="4" style="width:100%;box-sizing:border-box;line-height:1.9;font-size:13px;">${_qaEsc(cur)}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
            <button class="modal-btn modal-btn-secondary qa-cards-cancel" style="font-size:12px;padding:6px 14px;">取消</button>
            <button class="modal-btn modal-btn-primary qa-cards-save" style="font-size:12px;padding:6px 14px;">保存</button>
        </div>
    `;
    const ta = block.querySelector('textarea');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    block.querySelector('.qa-cards-cancel').onclick = () => afterSave();
    block.querySelector('.qa-cards-save').onclick = () => {
        list[i].cardsText = ta.value;
        saveQaData();
        if (typeof showNotification === 'function') showNotification('✓ 已保存', 'success');
        afterSave();
    };
}

// ─── 绑定编辑按钮 ───
function _qaBindCardsEdit(content, list, afterSave, myField) {
    content.querySelectorAll('.qa-edit-toggle').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const i = parseInt(btn.dataset.idx);
            if (!list[i]) return;

            _qaShowEditPicker(btn, (pick) => {
                if (pick === 'my') {
                    _qaEditMyText(content, list, i, myField, afterSave);
                } else {
                    _qaEditCards(content, list, i, afterSave);
                }
            });
        };
    });
}

// ─────────── 覆盖：他的问题 ───────────
function _qaRenderHisView() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const his = qaData.hisQuestions;

    let stateHtml = '';
    if (his.currentQuestion) {
        stateHtml = `
            <div class="qa-state-card qa-state-active">
                <div class="qa-state-label">💭 梦角问你</div>
                <div class="qa-question-text">${_qaEsc(his.currentQuestion.question)}</div>
            </div>
            <textarea class="qa-answer-input" id="qa-his-answer" placeholder="写下你的回答..." rows="3"></textarea>
            <button class="modal-btn modal-btn-primary" id="qa-his-submit" style="width:100%;margin-top:10px;">发送回答</button>`;
    } else if (his.pendingResponse) {
        stateHtml = `
            <div class="qa-state-card qa-state-waiting">
                <div class="qa-state-label">💬 等 Ta 回应</div>
                <div class="qa-dot-spinner"><span></span><span></span><span></span></div>
                <div class="qa-wait-hint">Ta 正在想怎么回复你…</div>
            </div>`;
    } else if (his.pendingQuestion) {
        stateHtml = `
            <div class="qa-state-card qa-state-waiting">
                <div class="qa-state-label">💭 等 Ta 来问</div>
                <div class="qa-dot-spinner"><span></span><span></span><span></span></div>
                <div class="qa-wait-hint">Ta 正在想一个问题问你…</div>
            </div>`;
    } else {
        const canUrge = _qaCanUrgeHis();
        stateHtml = `
            <div class="qa-state-card">
                <div class="qa-state-label">💭 让 Ta 问你</div>
                <div class="qa-wait-hint" style="margin-top:6px;">让梦角来问你一个问题<br><span style="opacity:0.6;font-size:11px;">Ta 会在 2-8 小时内来问你</span></div>
            </div>
            <button class="modal-btn modal-btn-primary" id="qa-his-urge" style="width:100%;margin-top:10px;" ${canUrge ? '' : 'disabled'}>
                ${canUrge ? '催一题' : '本周已问完'}
            </button>`;
    }

    const historyHtml = his.history.length ? his.history.map((h, i) => `
        <div class="qa-history-item">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div class="qa-history-q" style="flex:1;min-width:0;">💭 ${_qaEsc(h.question)}</div>
                ${_qaEditBtnHTML(i)}
            </div>
            <div class="qa-history-a" data-my-text-idx="${i}" data-prefix="我：">我：${_qaEsc(h.answer)}</div>
            ${_qaCardsBlock(h, i)}
        </div>
    `).join('') : '<div class="qa-empty">还没有记录</div>';

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>他的问题</span>
        </div>
        <div class="qa-subview-body">
            ${stateHtml}
            <div class="qa-history-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span>历史记录（${his.history.length}）</span>
                <button class="qa-eval-edit-btn" id="qa-manage-lib" type="button" style="font-size:11px;">
                    📚 管理问题库 →
                </button>
            </div>
            ${historyHtml}
        </div>`;

    _qaBindBacks(content);
    _qaBindCardsEdit(content, his.history, _qaRenderHisView, 'answer');

    const urgeBtn = content.querySelector('#qa-his-urge');
    if (urgeBtn) urgeBtn.onclick = _qaUrgeHis;
    const submitBtn = content.querySelector('#qa-his-submit');
    if (submitBtn) submitBtn.onclick = _qaSubmitHisAnswer;
    const libBtn = content.querySelector('#qa-manage-lib');
    if (libBtn) libBtn.onclick = _qaOpenMyQuestionLibrary;
}

// ─────────── 覆盖：我的问题 ───────────
function _qaRenderMineView() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const mine = qaData.myQuestions;

    let stateHtml = '';
    if (mine.currentPending) {
        stateHtml = `
            <div class="qa-state-card qa-state-waiting">
                <div class="qa-state-label">✨ 等 Ta 回答</div>
                <div class="qa-question-text" style="margin-top:10px;">${_qaEsc(mine.currentPending.question)}</div>
                <div class="qa-dot-spinner" style="margin-top:14px;"><span></span><span></span><span></span></div>
                <div class="qa-wait-hint">Ta 正在思考你的问题…</div>
            </div>`;
    } else {
        stateHtml = `
            <div class="qa-state-card">
                <div class="qa-state-label">✨ 问 Ta 一个问题</div>
                <textarea class="qa-answer-input" id="qa-mine-input" placeholder="写下你想问的..." rows="3" style="margin-top:10px;"></textarea>
            </div>
            <button class="modal-btn modal-btn-primary" id="qa-mine-submit" style="width:100%;margin-top:10px;">发出</button>`;
    }

    const historyHtml = mine.history.length ? mine.history.map((h, i) => `
        <div class="qa-history-item">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div class="qa-history-q" style="flex:1;min-width:0;" data-my-text-idx="${i}" data-prefix="✨ ">✨ ${_qaEsc(h.question)}</div>
                ${_qaEditBtnHTML(i)}
            </div>
            ${_qaCardsBlock(h, i)}
        </div>
    `).join('') : '<div class="qa-empty">还没有记录</div>';

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>我的问题</span>
        </div>
        <div class="qa-subview-body">
            ${stateHtml}
            <div class="qa-history-title">已回答（${mine.history.length}）</div>
            ${historyHtml}
        </div>`;

    _qaBindBacks(content);
    _qaBindCardsEdit(content, mine.history, _qaRenderMineView, 'question');

    const submitBtn = content.querySelector('#qa-mine-submit');
    if (submitBtn) submitBtn.onclick = _qaSubmitMineQuestion;
}

window._qaRenderHisView = _qaRenderHisView;
window._qaRenderMineView = _qaRenderMineView;

console.log('✅ 历史记录 · 编辑可选择"我的话"或"梦角的话"');

// ═══════════════════════════════════════════════════════════════════
//  历史记录 · 删除按钮（他的问题 / 我的问题 / 问一句）
// ═══════════════════════════════════════════════════════════════════

function _qaCardsText(h) {
    if (h.cardsText != null) return h.cardsText;
    if (h.cards && h.cards.length) return h.cards.join(QA_CARD_SEP);
    return '（梦角暂时想不出话）';
}

function _qaCardsBlock(h, idx) {
    return `
        <div class="qa-cards-block" data-idx="${idx}" style="margin-top:6px;">
            <div class="qa-persona-eval-text" style="padding:12px 14px;font-size:13px;line-height:2;white-space:pre-wrap;">${_qaEsc(_qaCardsText(h))}</div>
        </div>
    `;
}

// 历史条目右上角按钮组：编辑 + 删除
function _qaHistoryActionsHTML(idx) {
    return `
        <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="qa-eval-edit-btn qa-edit-toggle" type="button" data-idx="${idx}" style="font-size:11px;padding:2px 8px;">
                <i class="fas fa-pen" style="font-size:9px;margin-right:2px;"></i>编辑
            </button>
            <button class="qa-eval-edit-btn qa-del-toggle" type="button" data-idx="${idx}" style="font-size:11px;padding:2px 8px;color:#ef4444;">
                <i class="fas fa-trash" style="font-size:9px;"></i>
            </button>
        </div>
    `;
}

// ─── 编辑选择浮层 ───
function _qaShowEditPicker(anchorBtn, onPick) {
    const old = document.getElementById('qa-edit-picker');
    if (old) old.remove();

    const rect = anchorBtn.getBoundingClientRect();
    const picker = document.createElement('div');
    picker.id = 'qa-edit-picker';
    picker.style.cssText = `
        position:fixed;
        top:${Math.min(rect.bottom + 4, window.innerHeight - 100)}px;
        right:${Math.max(window.innerWidth - rect.right, 8)}px;
        background:var(--secondary-bg);
        border:1px solid var(--border-color);
        border-radius:10px;
        box-shadow:0 6px 24px rgba(0,0,0,0.22);
        padding:4px;
        z-index:99999;
        min-width:130px;
    `;
    picker.innerHTML = `
        <button class="qa-picker-item" data-pick="my" style="width:100%;padding:8px 12px;border:none;background:transparent;text-align:left;font-size:13px;color:var(--text-primary);cursor:pointer;border-radius:7px;font-family:var(--font-family);display:flex;align-items:center;gap:8px;">
            <i class="fas fa-user" style="font-size:11px;color:var(--accent-color);width:14px;"></i>我的话
        </button>
        <button class="qa-picker-item" data-pick="cards" style="width:100%;padding:8px 12px;border:none;background:transparent;text-align:left;font-size:13px;color:var(--text-primary);cursor:pointer;border-radius:7px;font-family:var(--font-family);display:flex;align-items:center;gap:8px;">
            <i class="fas fa-heart" style="font-size:11px;color:var(--accent-color);width:14px;"></i>梦角的话
        </button>
    `;
    document.body.appendChild(picker);

    picker.querySelectorAll('.qa-picker-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            picker.remove();
            onPick(item.dataset.pick);
        };
    });

    setTimeout(() => {
        const closeHandler = (e) => {
            if (!picker.contains(e.target) && e.target !== anchorBtn) {
                picker.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 30);
}

function _qaEditMyText(content, list, i, field, afterSave) {
    const h = list[i];
    const cur = h[field] || '';
    const el = content.querySelector(`[data-my-text-idx="${i}"]`);
    if (!el) return;
    const prefix = el.dataset.prefix || '';

    el.innerHTML = `
        ${prefix}
        <textarea class="qa-answer-input" rows="3" style="width:100%;box-sizing:border-box;line-height:1.7;font-size:13px;margin-top:4px;">${_qaEsc(cur)}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
            <button class="modal-btn modal-btn-secondary qa-my-cancel" style="font-size:12px;padding:6px 14px;">取消</button>
            <button class="modal-btn modal-btn-primary qa-my-save" style="font-size:12px;padding:6px 14px;">保存</button>
        </div>
    `;
    const ta = el.querySelector('textarea');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    el.querySelector('.qa-my-cancel').onclick = () => afterSave();
    el.querySelector('.qa-my-save').onclick = () => {
        list[i][field] = ta.value;
        saveQaData();
        if (typeof showNotification === 'function') showNotification('✓ 已保存', 'success');
        afterSave();
    };
}

function _qaEditCards(content, list, i, afterSave) {
    const h = list[i];
    const cur = _qaCardsText(h);
    const block = content.querySelector(`.qa-cards-block[data-idx="${i}"]`);
    if (!block) return;

    block.innerHTML = `
        <textarea class="qa-answer-input" rows="4" style="width:100%;box-sizing:border-box;line-height:1.9;font-size:13px;">${_qaEsc(cur)}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
            <button class="modal-btn modal-btn-secondary qa-cards-cancel" style="font-size:12px;padding:6px 14px;">取消</button>
            <button class="modal-btn modal-btn-primary qa-cards-save" style="font-size:12px;padding:6px 14px;">保存</button>
        </div>
    `;
    const ta = block.querySelector('textarea');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    block.querySelector('.qa-cards-cancel').onclick = () => afterSave();
    block.querySelector('.qa-cards-save').onclick = () => {
        list[i].cardsText = ta.value;
        saveQaData();
        if (typeof showNotification === 'function') showNotification('✓ 已保存', 'success');
        afterSave();
    };
}

// 绑定：编辑 + 删除
function _qaBindHistoryActions(content, list, afterSave, myField) {
    content.querySelectorAll('.qa-edit-toggle').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const i = parseInt(btn.dataset.idx);
            if (!list[i]) return;
            _qaShowEditPicker(btn, (pick) => {
                if (pick === 'my') _qaEditMyText(content, list, i, myField, afterSave);
                else _qaEditCards(content, list, i, afterSave);
            });
        };
    });

    content.querySelectorAll('.qa-del-toggle').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const i = parseInt(btn.dataset.idx);
            if (!list[i]) return;
            if (!confirm('删除这条记录？')) return;
            list.splice(i, 1);
            saveQaData();
            if (typeof showNotification === 'function') showNotification('已删除', 'success');
            afterSave();
        };
    });
}

// ─────────── 他的问题 ───────────
function _qaRenderHisView() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const his = qaData.hisQuestions;

    let stateHtml = '';
    if (his.currentQuestion) {
        stateHtml = `
            <div class="qa-state-card qa-state-active">
                <div class="qa-state-label">💭 梦角问你</div>
                <div class="qa-question-text">${_qaEsc(his.currentQuestion.question)}</div>
            </div>
            <textarea class="qa-answer-input" id="qa-his-answer" placeholder="写下你的回答..." rows="3"></textarea>
            <button class="modal-btn modal-btn-primary" id="qa-his-submit" style="width:100%;margin-top:10px;">发送回答</button>`;
    } else if (his.pendingResponse) {
        stateHtml = `
            <div class="qa-state-card qa-state-waiting">
                <div class="qa-state-label">💬 等 Ta 回应</div>
                <div class="qa-dot-spinner"><span></span><span></span><span></span></div>
                <div class="qa-wait-hint">Ta 正在想怎么回复你…</div>
            </div>`;
    } else if (his.pendingQuestion) {
        stateHtml = `
            <div class="qa-state-card qa-state-waiting">
                <div class="qa-state-label">💭 等 Ta 来问</div>
                <div class="qa-dot-spinner"><span></span><span></span><span></span></div>
                <div class="qa-wait-hint">Ta 正在想一个问题问你…</div>
            </div>`;
    } else {
        const canUrge = _qaCanUrgeHis();
        stateHtml = `
            <div class="qa-state-card">
                <div class="qa-state-label">💭 让 Ta 问你</div>
                <div class="qa-wait-hint" style="margin-top:6px;">让梦角来问你一个问题<br><span style="opacity:0.6;font-size:11px;">Ta 会在 2-8 小时内来问你</span></div>
            </div>
            <button class="modal-btn modal-btn-primary" id="qa-his-urge" style="width:100%;margin-top:10px;" ${canUrge ? '' : 'disabled'}>
                ${canUrge ? '催一题' : '本周已问完'}
            </button>`;
    }

    const historyHtml = his.history.length ? his.history.map((h, i) => `
        <div class="qa-history-item">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div class="qa-history-q" style="flex:1;min-width:0;">💭 ${_qaEsc(h.question)}</div>
                ${_qaHistoryActionsHTML(i)}
            </div>
            <div class="qa-history-a" data-my-text-idx="${i}" data-prefix="我：">我：${_qaEsc(h.answer)}</div>
            ${_qaCardsBlock(h, i)}
        </div>
    `).join('') : '<div class="qa-empty">还没有记录</div>';

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>他的问题</span>
        </div>
        <div class="qa-subview-body">
            ${stateHtml}
            <div class="qa-history-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span>历史记录（${his.history.length}）</span>
                <button class="qa-eval-edit-btn" id="qa-manage-lib" type="button" style="font-size:11px;">
                    📚 管理问题库 →
                </button>
            </div>
            ${historyHtml}
        </div>`;

    _qaBindBacks(content);
    _qaBindHistoryActions(content, his.history, _qaRenderHisView, 'answer');

    const urgeBtn = content.querySelector('#qa-his-urge');
    if (urgeBtn) urgeBtn.onclick = _qaUrgeHis;
    const submitBtn = content.querySelector('#qa-his-submit');
    if (submitBtn) submitBtn.onclick = _qaSubmitHisAnswer;
    const libBtn = content.querySelector('#qa-manage-lib');
    if (libBtn) libBtn.onclick = _qaOpenMyQuestionLibrary;
}

// ─────────── 我的问题 ───────────
function _qaRenderMineView() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const mine = qaData.myQuestions;

    let stateHtml = '';
    if (mine.currentPending) {
        stateHtml = `
            <div class="qa-state-card qa-state-waiting">
                <div class="qa-state-label">✨ 等 Ta 回答</div>
                <div class="qa-question-text" style="margin-top:10px;">${_qaEsc(mine.currentPending.question)}</div>
                <div class="qa-dot-spinner" style="margin-top:14px;"><span></span><span></span><span></span></div>
                <div class="qa-wait-hint">Ta 正在思考你的问题…</div>
            </div>`;
    } else {
        stateHtml = `
            <div class="qa-state-card">
                <div class="qa-state-label">✨ 问 Ta 一个问题</div>
                <textarea class="qa-answer-input" id="qa-mine-input" placeholder="写下你想问的..." rows="3" style="margin-top:10px;"></textarea>
            </div>
            <button class="modal-btn modal-btn-primary" id="qa-mine-submit" style="width:100%;margin-top:10px;">发出</button>`;
    }

    const historyHtml = mine.history.length ? mine.history.map((h, i) => `
        <div class="qa-history-item">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div class="qa-history-q" style="flex:1;min-width:0;" data-my-text-idx="${i}" data-prefix="✨ ">✨ ${_qaEsc(h.question)}</div>
                ${_qaHistoryActionsHTML(i)}
            </div>
            ${_qaCardsBlock(h, i)}
        </div>
    `).join('') : '<div class="qa-empty">还没有记录</div>';

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>我的问题</span>
        </div>
        <div class="qa-subview-body">
            ${stateHtml}
            <div class="qa-history-title">已回答（${mine.history.length}）</div>
            ${historyHtml}
        </div>`;

    _qaBindBacks(content);
    _qaBindHistoryActions(content, mine.history, _qaRenderMineView, 'question');

    const submitBtn = content.querySelector('#qa-mine-submit');
    if (submitBtn) submitBtn.onclick = _qaSubmitMineQuestion;
}

// ─────────── 问一句 ───────────
function _qaRenderYnInput() {
    const content = document.getElementById('qa-modal-content');
    if (!content || !qaData) return;
    const yn = qaData.yesNo;

    content.innerHTML = `
        <div class="qa-subview-head">
            <button class="qa-back-btn" type="button"><i class="fas fa-arrow-left"></i></button>
            <span>问一句</span>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;opacity:0.8;">
            写下 1-10 道是非题，梦角会在 2-5 分钟内回答 ✦
        </div>
        <div id="qa-yn-inputs"></div>
        <button class="modal-btn modal-btn-secondary" id="qa-yn-add" style="width:100%;margin-top:6px;">
            <i class="fas fa-plus"></i> 添加一道
        </button>
        <button class="modal-btn modal-btn-primary" id="qa-yn-submit" style="width:100%;margin-top:10px;">发出</button>
        <div class="qa-history-title">历史记录（${yn.history.filter(b => b.status === 'replied').length}）</div>
        <div id="qa-yn-history"></div>
    `;

    _qaBindBacks(content);

    const inputWrap = content.querySelector('#qa-yn-inputs');
    let items = [''];

    function renderInputs() {
        inputWrap.innerHTML = items.map((v, i) => `
            <div class="qa-yn-input-row">
                <div class="qa-yn-num">${i + 1}</div>
                <input type="text" class="qa-answer-input" data-idx="${i}" value="${_qaEsc(v)}" placeholder="例如：是不是很晚睡觉？" style="flex:1;padding:10px 12px;">
                ${items.length > 1 ? `<button class="qa-yn-remove" type="button" data-remove="${i}"><i class="fas fa-times"></i></button>` : ''}
            </div>
        `).join('');
        inputWrap.querySelectorAll('input').forEach(inp => {
            inp.oninput = e => { items[parseInt(e.target.dataset.idx)] = e.target.value; };
        });
        inputWrap.querySelectorAll('[data-remove]').forEach(btn => {
            btn.onclick = () => { items.splice(parseInt(btn.dataset.remove), 1); renderInputs(); };
        });
    }
    renderInputs();

    content.querySelector('#qa-yn-add').onclick = () => {
        if (items.length >= 10) {
            if (typeof showNotification === 'function') showNotification('最多 10 道', 'warning');
            return;
        }
        items.push('');
        renderInputs();
        setTimeout(() => {
            const last = inputWrap.querySelectorAll('input')[items.length - 1];
            if (last) last.focus();
        }, 60);
    };

    content.querySelector('#qa-yn-submit').onclick = () => {
        const questions = items.map(s => s.trim()).filter(Boolean);
        if (!questions.length) {
            if (typeof showNotification === 'function') showNotification('至少写一道题', 'warning');
            return;
        }
        _qaSubmitYesNo(questions);
    };

    // 历史（带删除）
    const historyWrap = content.querySelector('#qa-yn-history');
    // 保存原始 index 引用
    const replied = [];
    yn.history.forEach((b, idx) => {
        if (b.status === 'replied') replied.push({ batch: b, realIdx: idx });
    });

    if (!replied.length) {
        historyWrap.innerHTML = '<div class="qa-empty">还没有记录</div>';
    } else {
        historyWrap.innerHTML = replied.map(({ batch, realIdx }) => `
            <div class="qa-history-item" style="margin-bottom:10px;">
                <div style="display:flex;justify-content:flex-end;margin-bottom:6px;">
                    <button class="qa-eval-edit-btn qa-yn-del" type="button" data-idx="${realIdx}" style="font-size:11px;padding:2px 8px;color:#ef4444;">
                        <i class="fas fa-trash" style="font-size:9px;"></i>
                    </button>
                </div>
                ${batch.questions.map((q, i) => `
                    <div class="qa-yn-history-row">
                        <span class="qa-q">${_qaEsc(q)}</span>
                        <span class="qa-a">${_qaEsc((batch.answers && batch.answers[i]) || '—')}</span>
                    </div>
                `).join('')}
            </div>
        `).join('');

        historyWrap.querySelectorAll('.qa-yn-del').forEach(btn => {
            btn.onclick = () => {
                const i = parseInt(btn.dataset.idx);
                if (!confirm('删除这条记录？')) return;
                qaData.yesNo.history.splice(i, 1);
                saveQaData();
                if (typeof showNotification === 'function') showNotification('已删除', 'success');
                _qaRenderYnInput();
            };
        });
    }
}

window._qaRenderHisView = _qaRenderHisView;
window._qaRenderMineView = _qaRenderMineView;
window._qaRenderYnInput = _qaRenderYnInput;

console.log('✅ 历史记录 · 可删除');