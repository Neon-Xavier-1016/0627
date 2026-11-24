/* 帮我拿主意：纯前端、本地保存，按会话隔离。 */
(function () {
    'use strict';
    const NORMAL_LIMIT = 15, FAVORITE_LIMIT = 10;
    const MINUTE = 60000;
    let records = [], storageKey = '', chain = Promise.resolve();
    let activeId = null, filter = 'all', composing = false, draft = null, imageJobs = 0;
    let notified = new Set();
    const $ = id => document.getElementById(id);
    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const date = ts => new Date(ts).toLocaleString('zh-CN', {hour12:false});
    const message = text => typeof showNotification === 'function' ? showNotification(text, 'info') : alert(text);
    const homeReady = () => !document.hidden && (!$('welcome-animation') || getComputedStyle($('welcome-animation')).display === 'none');
    function library() {
        const pool = typeof customReplies !== 'undefined' ? customReplies : window._customReplies;
        return (Array.isArray(pool) ? pool : []).map(x => typeof x === 'string' ? x : x && (x.text || x.content || x.card)).filter(x => typeof x === 'string' && x.trim());
    }
    function createRecord(data, pool, now = Date.now(), random = Math.random) {
        if (!pool.length) throw new Error('先在现有字卡库里添加字卡，再来问问 Ta 吧。');
        const count = 2 + Math.floor(random() * 4);
        const cards = Array.from({length:count}, () => pool[Math.floor(random() * pool.length)]);
        return {
            id: 'decision_' + now + '_' + random().toString(36).slice(2,10),
            question: data.question, mode: data.mode, urgency: data.urgency,
            partnerId: data.recipient?.id, partnerName: data.recipient?.name,
            options: data.options.map(o => ({text:o.text, price:o.price || '', reason:o.reason || '', image:o.image || ''})),
            createdAt: now, replyAt: now + (5 + random() * ((data.urgency === 'urgent' ? 30 : 300) - 5)) * MINUTE,
            answer: data.mode === 'buy' ? (random() < 0.5 ? 'buy' : 'skip') : Math.floor(random() * data.options.length),
            partnerComment: cards.join('\n\n'), delivered:false, unread:false,
            favorite:false, reaction:'', closingComment:''
        };
    }
    // 等待中的普通记录不被自动清理；图片随整条记录一起释放。
    function trim(list) {
        let normal = list.filter(r => !r.favorite);
        const removable = normal.filter(r => r.delivered).sort((a,b) => a.createdAt - b.createdAt);
        while (normal.length > NORMAL_LIMIT && removable.length) {
            const oldest = removable.shift();
            list.splice(list.indexOf(oldest), 1);
            normal = list.filter(r => !r.favorite);
        }
        if (normal.length > NORMAL_LIMIT) throw new Error('已有 15 条等待答复的记录，请等一条答复、收藏或删除后再提问。');
        return list;
    }
    function settle(list, now) {
        let changed = false;
        list.forEach(r => {
            if (!r.delivered && now >= r.replyAt) {
                r.delivered = true; r.unread = true; changed = true;
            }
        });
        return changed;
    }
    // 所有读写串行执行；保存失败保留旧数据，不显示虚假的成功状态。
    function transact(change) {
        const task = chain.then(async () => {
            const key = getStorageKey('decisionHelperData');
            if (key !== storageKey) {
                records = (await localforage.getItem(key)) || [];
                storageKey = key; notified = new Set(); activeId = null;
                draft = null; composing = false;
                $('decision-notice')?.remove();
            }
            // 图片是不可变的 data URL，复用字符串，避免每次检查复制整库大图。
            const next = records.map(r => ({...r, options:r.options.map(o=>({...o}))}));
            const due = settle(next, Date.now());
            if (change) change(next);
            trim(next);
            if (due || change) await localforage.setItem(key, next);
            records = next;
        });
        chain = task.catch(() => {});
        return task;
    }
    function report(error) { console.warn('[帮我拿主意]', error); message(error.message || '保存失败，请重试。'); }
    function notify() {
        const unread = records.filter(r => r.unread);
        const badge = $('decision-entry-badge');
        if (badge) { badge.textContent = unread.length; badge.hidden = !unread.length; }
        if (!unread.length) { $('decision-notice')?.remove(); return; }
        if (!homeReady() || !unread.some(r => !notified.has(r.id))) return;
        unread.forEach(r => notified.add(r.id));
        $('decision-notice')?.remove();
        const notice = document.createElement('div');
        notice.id = 'decision-notice';
        // 来信提示在底部，本功能放在顶部，避免同时登录时相互遮住。
        notice.style.top = 'max(18px, env(safe-area-inset-top))';
        notice.style.bottom = 'auto';
        notice.innerHTML = `<strong>💭 Ta 帮你拿好主意了</strong><p>有 ${unread.length} 条答复等你查看</p><div><button data-later>稍后查看</button><button data-read>去看看</button></div>`;
        notice.querySelector('[data-later]').onclick = () => notice.remove();
        notice.querySelector('[data-read]').onclick = () => { notice.remove(); open(); };
        document.body.appendChild(notice);
    }
    async function check() {
        await transact();
        if ($('decision-helper-modal')?.style.display === 'flex' && !composing && !activeId) render();
        if ($('decision-helper-modal')?.style.display === 'flex' && activeId && $('dh-waiting') && records.find(r=>r.id===activeId)?.delivered) render();
        notify();
    }
    function mount() {
        if ($('decision-helper-modal')) return;
        const style = document.createElement('style');
        style.textContent = `
        #decision-helper-modal{z-index:2250}#decision-helper-modal .dh-shell{width:94%;max-width:560px;padding:0;display:flex;flex-direction:column;max-height:90vh;max-height:90dvh;overflow:hidden;background:var(--secondary-bg);color:var(--text-primary);border-radius:20px}
        #decision-helper-modal .dh-header{padding:18px 20px;background:rgba(var(--accent-color-rgb),.1);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0}
        #decision-helper-modal h3{font-size:17px;margin:0}#decision-helper-modal .dh-scroll{padding:16px 18px;overflow-y:auto;min-height:0;overscroll-behavior:contain}
        #decision-helper-modal button,#decision-notice button{font:inherit;font-size:13px;border:1px solid var(--border-color);border-radius:10px;background:var(--primary-bg);color:var(--text-primary);padding:9px 12px;cursor:pointer}
        #decision-helper-modal button:disabled{opacity:.45;cursor:wait}#decision-helper-modal .dh-primary,#decision-helper-modal button[aria-pressed=true],#decision-notice button[data-read]{background:var(--accent-color);color:var(--secondary-bg);border-color:var(--accent-color)}
        #decision-helper-modal .dh-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}#decision-helper-modal .dh-muted{font-size:12px;color:var(--text-secondary);line-height:1.7;white-space:pre-wrap}
        #decision-helper-modal .dh-card{border:1px solid var(--border-color);border-radius:14px;padding:14px;margin:12px 0;background:var(--primary-bg);overflow-wrap:anywhere}
        #decision-helper-modal .dh-card p{white-space:pre-wrap;line-height:1.8;margin:10px 0}#decision-helper-modal .dh-choice{border-left:3px solid var(--accent-color);padding-left:12px}
        #decision-helper-modal textarea,#decision-helper-modal input[type=text],#decision-helper-modal select{box-sizing:border-box;width:100%;font:inherit;font-size:14px;color:var(--text-primary);background:var(--primary-bg);border:1px solid var(--border-color);border-radius:10px;padding:10px;line-height:1.7}
        #decision-helper-modal textarea{resize:vertical;min-height:85px}#decision-helper-modal label{display:block;font-size:13px;line-height:1.8;margin-top:12px}#decision-helper-modal img{max-width:100%;max-height:220px;object-fit:contain;border-radius:10px;display:block;margin-top:8px}
        #decision-helper-modal .dh-preview{max-height:120px}#decision-helper-modal .dh-delete{color:#c45b60}#decision-helper-modal [hidden],#decision-entry-badge[hidden]{display:none!important}

        #decision-helper-modal .dh-option-card{padding:16px;border-radius:18px;background:var(--secondary-bg);box-shadow:0 3px 12px rgba(var(--accent-color-rgb),.04)}
        #decision-helper-modal .dh-option-heading{display:flex;align-items:center;gap:9px;font-size:14px;margin-bottom:2px}#decision-helper-modal .dh-option-number{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:rgba(var(--accent-color-rgb),.1);color:var(--accent-color);font-size:12px;font-weight:600;flex-shrink:0}
        #decision-helper-modal .dh-option-remove{margin-left:auto;padding:4px 8px;border:0;color:var(--text-secondary);background:transparent;font-size:11px}
        #decision-helper-modal .dh-option-fields{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px}#decision-helper-modal .dh-option-fields label{min-width:0}#decision-helper-modal .dh-field-hint{font-size:10px;color:var(--text-secondary);opacity:.8;margin-left:4px;font-weight:400}
        #decision-helper-modal .dh-option-card input[type=text],#decision-helper-modal .dh-option-card textarea{margin-top:6px;background:var(--primary-bg);border-radius:12px;font-size:13px}#decision-helper-modal textarea.dh-reason{min-height:76px}
        #decision-helper-modal .dh-upload{position:relative;overflow:hidden;display:inline-flex;align-items:center;margin:0;padding:8px 12px;border:1px dashed rgba(var(--accent-color-rgb),.45);border-radius:10px;color:var(--accent-color);font-size:12px;cursor:pointer}#decision-helper-modal .dh-upload input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}#decision-helper-modal .dh-upload:focus-within{outline:2px solid var(--accent-color);outline-offset:2px}
        #decision-helper-modal .dh-timing-label{font-size:13px;margin:20px 0 10px}#decision-helper-modal .dh-timing{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
        #decision-helper-modal button.dh-time-choice{display:flex;flex-direction:column;gap:8px;text-align:left;min-width:0;padding:14px 12px;border-radius:15px;background:var(--primary-bg);color:var(--text-primary);transition:border-color .18s,background .18s,box-shadow .18s}
        #decision-helper-modal button.dh-time-choice[aria-pressed=true]{background:rgba(var(--accent-color-rgb),.09);border-color:var(--accent-color);color:var(--text-primary);box-shadow:0 0 0 1px rgba(var(--accent-color-rgb),.12)}
        #decision-helper-modal .dh-time-top{display:flex;align-items:center;gap:6px;width:100%;font-size:13px}#decision-helper-modal .dh-time-symbol{color:var(--accent-color);font-size:16px}#decision-helper-modal .dh-time-dot{width:12px;height:12px;border:1px solid var(--border-color);border-radius:50%;margin-left:auto;box-sizing:border-box;flex-shrink:0}#decision-helper-modal [aria-pressed=true] .dh-time-dot{border:4px solid var(--accent-color);background:var(--secondary-bg)}
        #decision-helper-modal .dh-time-range{font-size:13px;font-weight:500;color:var(--accent-color)}#decision-helper-modal .dh-time-note{font-size:10px;line-height:1.6;color:var(--text-secondary)}#decision-helper-modal .dh-time-choice:focus-visible{outline:2px solid var(--accent-color);outline-offset:3px}
        #decision-helper-modal .dh-detail-price{font-size:14px;color:var(--accent-color);margin-top:6px;font-weight:600}#decision-helper-modal p.dh-detail-reason{font-size:13px;line-height:1.8}
        @media(max-width:360px){#decision-helper-modal .dh-option-fields,#decision-helper-modal .dh-timing{grid-template-columns:minmax(0,1fr)}}
        #decision-notice{position:fixed;bottom:max(85px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:85%;max-width:330px;box-sizing:border-box;z-index:8100;padding:18px;border-radius:18px;background:var(--secondary-bg);color:var(--text-primary);border:1px solid var(--border-color);box-shadow:0 8px 30px #0003}#decision-notice p{font-size:13px;color:var(--text-secondary)}#decision-notice>div{display:flex;gap:10px;justify-content:flex-end}`;
        document.head.appendChild(style);
        const modal = document.createElement('div');
        modal.id = 'decision-helper-modal'; modal.className = 'modal';
        modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','decision-title');
        modal.innerHTML = `<div class="modal-content dh-shell"><div class="dh-header"><h3 id="decision-title">帮我拿主意</h3><button type="button" data-action="close">关闭</button></div><div class="dh-scroll" id="decision-body"></div></div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', event => {
            const button = event.target.closest('[data-action]');
            if (button) act(button.dataset.action, button.dataset.id, button).catch(report);
        });
        modal.addEventListener('input', event => capture(event.target));
        modal.addEventListener('change', event => {
            if (event.target.matches('input[type=file]')) upload(event.target).catch(report);
            else capture(event.target);
        });
    }
    async function open() {
        mount(); await transact();
        if ($('advanced-modal') && typeof hideModal === 'function') hideModal($('advanced-modal'));
        activeId = null; composing = false; render(); showModal($('decision-helper-modal')); notify();
    }
    function render() {
        if (composing) return renderForm();
        if (activeId) return renderDetail();
        const normal = records.filter(r => !r.favorite).length;
        const favorites = records.filter(r => r.favorite).length;
        const list = records.filter(r => filter !== 'favorites' || r.favorite).slice().sort((a,b) => b.createdAt - a.createdAt);
        $('decision-body').innerHTML = `<div class="dh-muted">普通记录 ${normal}/15 · 收藏 ${favorites}/10<br>清理最早的普通已回复记录，收藏和等待中的问题会保留。</div>
            <div class="dh-row"><button data-action="filter" aria-pressed="${filter==='all'}">全部</button><button data-action="favorites" aria-pressed="${filter==='favorites'}">收藏</button><button class="dh-primary" data-action="compose">问问你 ＋</button></div>
            ${list.length ? list.map(r => `<div class="dh-card"><div class="dh-muted">${esc(date(r.createdAt))} · ${r.favorite?'★ 收藏 · ':''}${r.delivered?(r.unread?'● 新答复':(r.reaction?'已留下结尾':'已答复')):'Ta 正在帮你考虑'}</div><p>${esc(r.question)}</p><div class="dh-row"><button data-action="view" data-id="${r.id}">${r.delivered?'查看答复':'查看问题'}</button><button data-action="favorite" data-id="${r.id}">${r.favorite?'取消收藏':'收藏'}</button><button class="dh-delete" data-action="delete" data-id="${r.id}">删除</button></div></div>`).join('') : '<div class="dh-card dh-muted">还没有记录。把纠结的事情交给 Ta，一起拿个主意吧。</div>'}`;
    }
    const emptyOption = () => ({text:'', price:'', reason:'', image:''});
    function renderForm() {
        const mode = draft.mode;
        $('decision-body').innerHTML = `<button data-action="back">← 返回记录</button><div class="dh-row"><button data-action="mode-buy" aria-pressed="${mode==='buy'}">要不要买</button><button data-action="mode-pick" aria-pressed="${mode==='pick'}">帮我选选</button></div>
            <label>想问 ${esc(draft.recipient?.name || 'Ta')} 什么？<textarea id="dh-question" maxlength="500" placeholder="例如：这个包要不要买？">${esc(draft.question)}</textarea></label>
            ${draft.options.map((o,i)=>`<div class="dh-card dh-option-card"><div class="dh-option-heading"><span class="dh-option-number">${mode==='buy'?'♡':String(i+1).padStart(2,'0')}</span><strong>${mode==='buy'?'想买的物品':'备选 '+(i+1)}</strong>${mode==='pick'&&draft.options.length>2?`<button class="dh-option-remove" data-action="remove-option" data-id="${i}" aria-label="移除选项 ${i+1}">移除</button>`:''}</div><div class="dh-option-fields"><label>名称 <span class="dh-field-hint">必填</span><input type="text" data-option="${i}" data-field="text" maxlength="150" placeholder="它叫什么名字？" value="${esc(o.text)}"></label><label>价格 <span class="dh-field-hint">选填</span><input type="text" inputmode="decimal" data-option="${i}" data-field="price" maxlength="40" placeholder="例如：¥129" value="${esc(o.price)}"></label></div><label>纠结的原因 <span class="dh-field-hint">选填</span><textarea class="dh-reason" data-option="${i}" data-field="reason" maxlength="500" placeholder="哪里让你心动，又在犹豫什么？">${esc(o.reason)}</textarea></label><div class="dh-row"><label class="dh-upload">${o.image?'更换图片':'＋ 添加图片'}<input type="file" accept="image/*" data-image="${i}" ${imageJobs?'disabled':''}></label><span class="dh-muted">每项一张</span></div>${o.image?`<img class="dh-preview" src="${o.image}" alt="选项图片"><button data-action="remove-image" data-id="${i}">移除图片</button>`:''}</div>`).join('')}
            ${mode==='pick'&&draft.options.length<5?'<button data-action="add-option">＋ 添加选项</button>':''}
            <div class="dh-timing-label" id="dh-timing-label">多久想听到答案？</div><div class="dh-timing" role="group" aria-labelledby="dh-timing-label"><button type="button" class="dh-time-choice" data-action="urgency-urgent" aria-pressed="${draft.urgency==='urgent'}"><span class="dh-time-top"><span class="dh-time-symbol">◷</span><strong>有点着急</strong><span class="dh-time-dot" aria-hidden="true"></span></span><span class="dh-time-range">5～30 分钟</span><span class="dh-time-note">想早点听听你的主意</span></button><button type="button" class="dh-time-choice" data-action="urgency-relaxed" aria-pressed="${draft.urgency==='relaxed'}"><span class="dh-time-top"><span class="dh-time-symbol">☁</span><strong>慢慢考虑</strong><span class="dh-time-dot" aria-hidden="true"></span></span><span class="dh-time-range">5 分钟～5 小时</span><span class="dh-time-note">不着急，等你想好了告诉我</span></button></div>
            <p class="dh-muted">${imageJobs?'正在压缩图片…':'图片会自动压缩，每张不超过 200KB。'}<br>Ta 会随机帮你做选择，并从现有字卡库留下 2～5 张留言。<br>提交后问题、选项和图片锁定，答复送达后可编辑 Ta 的留言。</p><button class="dh-primary" data-action="submit" ${imageJobs?'disabled':''}>交给你拿主意</button>`;
    }
    function capture(el) {
        if (!composing || !draft) return;
        if (el.id === 'dh-question') draft.question = el.value;
        if (el.dataset.option !== undefined && ['text','price','reason'].includes(el.dataset.field || 'text')) draft.options[Number(el.dataset.option)][el.dataset.field || 'text'] = el.value;
    }
    function renderDetail() {
        const r = records.find(x => x.id === activeId);
        if (!r) { activeId = null; return render(); }
        const picked = r.mode === 'buy' ? (r.answer==='buy'?'买！':'先不买') : `我选第 ${r.answer+1} 个：${r.options[r.answer].text}`;
        $('decision-body').innerHTML = `<button data-action="back">← 返回记录</button><div class="dh-card"><div class="dh-muted">${esc(date(r.createdAt))} 提问 · ${r.urgency==='urgent'?'有点着急':'慢慢考虑'}</div><p><strong>${esc(r.question)}</strong></p>${r.options.map((o,i)=>`<div class="dh-card ${r.delivered&&r.mode==='pick'&&r.answer===i?'dh-choice':''}"><strong>${r.mode==='pick'?`${i+1}. `:''}${esc(o.text)}</strong>${o.price?`<div class="dh-detail-price">${esc(o.price)}</div>`:''}${o.reason?`<p class="dh-detail-reason"><span class="dh-muted">纠结的原因</span><br>${esc(o.reason)}</p>`:''}${o.image?`<img src="${o.image}" alt="${esc(o.text)}">`:''}</div>`).join('')}</div>
            ${r.delivered?`<div class="dh-card dh-choice"><div class="dh-muted">${esc(date(r.replyAt))} · ${esc(r.partnerName || 'Ta')} 的答复</div><p><strong>${esc(picked)}</strong></p><p>${esc(r.partnerComment)}</p><button data-action="edit-comment">编辑 Ta 的留言</button><div id="dh-comment-editor" hidden><label>Ta 的留言<textarea id="dh-partner-comment" maxlength="10000">${esc(r.partnerComment)}</textarea></label><div class="dh-row"><button data-action="save-comment">保存留言</button><button data-action="cancel-comment">取消</button></div></div></div>
            <div class="dh-card"><strong>给这次小商量留个结尾</strong><div class="dh-row"><button data-action="reaction-listen" aria-pressed="${r.reaction==='listen'}">听你的</button><button data-action="reaction-think" aria-pressed="${r.reaction==='think'}">我再想想</button></div><label>我的留言（可不填）<textarea id="dh-closing" maxlength="2000" placeholder="例如：已经买啦，很喜欢！">${esc(r.closingComment)}</textarea></label><div class="dh-row"><button class="dh-primary" data-action="save-closing">保存结尾</button><span class="dh-muted">${r.reaction?'已标记：'+(r.reaction==='listen'?'听你的':'我再想想'):'尚未标记'}</span></div><div class="dh-muted">这是你的结尾，Ta 不会再继续回复。</div></div>`:'<div id="dh-waiting" class="dh-card dh-muted">Ta 正在帮你考虑，答复送达后会在主页提醒你。<br>离开网页也没关系，回来后会补上到期答复。</div>'}
            <div class="dh-row"><button data-action="favorite" data-id="${r.id}">${r.favorite?'取消收藏':'收藏这次商量'}</button><button class="dh-delete" data-action="delete" data-id="${r.id}">删除记录</button></div>`;
    }
    async function update(id, fn) {
        await transact(list => { const r = list.find(x => x.id === id); if (!r) throw new Error('这条记录已被清理。'); fn(r,list); });
        render(); notify();
    }
    async function act(action, id, button) {
        if (imageJobs && ['close','back','mode-buy','mode-pick','add-option','remove-option','submit','remove-image'].includes(action)) return message('图片正在压缩，请稍等。');
        if (action==='close') { hideModal($('decision-helper-modal')); return; }
        if (action==='back') { if (composing && !confirm('返回会放弃本次未提交的内容，确定吗？')) return; composing=false; activeId=null; draft=null; render(); return; }
        if (action==='filter' || action==='favorites') { filter=action==='filter'?'all':'favorites'; render(); return; }
        if (action==='compose') { const recipient = await window.XavierConversations?.choose('选谁帮你拿主意'); if (window.XavierConversations && !recipient) return; composing=true; activeId=null; draft={recipient,question:'',mode:'buy',urgency:'relaxed',options:[emptyOption()]}; render(); return; }
        if (action.startsWith('mode-')) { const mode=action.slice(5); if (draft.mode!==mode) { if(draft.options.slice(1).some(o=>o.text||o.price||o.reason||o.image)&&!confirm('切换为单个物品会移除多余选项，确定吗？'))return; draft.mode=mode; draft.options=mode==='buy'?draft.options.slice(0,1):draft.options.concat(draft.options.length===1?[emptyOption()]:[]); } render(); return; }
        if (action==='add-option') { if(draft.options.length<5)draft.options.push(emptyOption()); render(); return; }
        if (action==='remove-option') { if(draft.options.length>2)draft.options.splice(Number(id),1); render(); return; }
        if (action==='remove-image') { draft.options[Number(id)].image=''; render(); return; }
        if (action==='urgency-urgent'||action==='urgency-relaxed') { draft.urgency=action.slice(8); render(); return; }
        if (action==='submit') {
            if(!draft.question.trim()||draft.options.some(o=>!o.text.trim())) return message('请填写问题和每个选项的名称。');
            button.disabled=true;
            try {
                const data={...draft,question:draft.question.trim(),options:draft.options.map(o=>({...o,text:o.text.trim(),price:(o.price||'').trim(),reason:(o.reason||'').trim()}))};
                const record=createRecord(data,library());
                await transact(list=>{list.push(record);trim(list);});
                composing=false;draft=null;activeId=record.id;render();notify(); message('已经交给 Ta，等 Ta 帮你拿主意吧。');
            } finally { button.disabled=false; }
            return;
        }
        if (action==='view') { await update(id,r=>{r.unread=false;}); activeId=id; render(); return; }
        if (action==='favorite') return update(id,(r,list)=>{
            if(!r.favorite&&list.filter(x=>x.favorite).length>=FAVORITE_LIMIT) throw new Error('收藏已满 10 条，请先取消一条收藏。');
            if(r.favorite&&list.filter(x=>!x.favorite).length>=NORMAL_LIMIT) throw new Error('普通记录已满 15 条，请先删除一条普通记录再取消收藏。');
            r.favorite=!r.favorite;
        });
        if (action==='delete') { if(!confirm('删除这次商量及其图片？删除后无法恢复。'))return; await transact(list=>{const i=list.findIndex(r=>r.id===id);if(i>=0)list.splice(i,1)}); if(activeId===id)activeId=null; render();notify();return; }
        if (action==='edit-comment') { $('dh-comment-editor').hidden=false;return; }
        if (action==='cancel-comment') { $('dh-comment-editor').hidden=true;return; }
        if (action==='save-comment') { const text=$('dh-partner-comment').value.trim();if(!text)return message('留言不能为空。');return update(activeId,r=>{if(r.delivered)r.partnerComment=text;}); }
        if (action==='reaction-listen'||action==='reaction-think') {
            const closing=$('dh-closing').value;
            return update(activeId,r=>{if(r.delivered){r.reaction=action==='reaction-listen'?'listen':'think';r.closingComment=closing;}});
        }
        if (action==='save-closing') {const text=$('dh-closing').value.trim();await update(activeId,r=>{if(r.delivered)r.closingComment=text;});message('结尾已保存。');}
    }
    async function compress(file) {
        if(!file.type.startsWith('image/'))throw new Error('请选择图片文件。');
        if(file.size>15*1024*1024)throw new Error('原图超过 15MB，请换一张小一些的图片。');
        const url=URL.createObjectURL(file);
        try {
            const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('图片无法读取，请换成 JPG、PNG 或 WebP。'));image.src=url;});
            let scale=Math.min(1,1000/Math.max(img.naturalWidth,img.naturalHeight));
            const canvas=document.createElement('canvas');
            for(let step=0;step<6;step++){
                canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
                const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
                const data=canvas.toDataURL('image/jpeg',Math.max(.4,.8-step*.08));
                if((data.length-data.indexOf(',')-1)*.75<=200*1024)return data;
                scale*=.75;
            }
            throw new Error('图片压缩后仍过大，请换一张图片。');
        } finally {URL.revokeObjectURL(url);}
    }
    async function upload(input) {
        const file=input.files[0];if(!file||!draft)return;
        const target=draft.options[Number(input.dataset.image)];
        imageJobs++;render();
        try {target.image=await compress(file);} finally {imageJobs--;if(composing)render();}
    }
    window.DecisionHelper = {open:()=>open().catch(report)};
    const timer=setInterval(()=>{
        try {
            if(typeof SESSION_ID==='undefined'||!SESSION_ID)return;
            getStorageKey('decisionHelperData');
            if(!homeReady())return;
            clearInterval(timer);mount();check().catch(report);
            setInterval(()=>check().catch(error=>console.warn('[帮我拿主意]',error)),15000);
            document.addEventListener('visibilitychange',()=>{if(!document.hidden)check().catch(report);});
        } catch(e) { /* 等待会话和主页初始化 */ }
    },500);
})();
