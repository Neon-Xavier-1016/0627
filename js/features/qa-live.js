/* 主动问答：预设题与手写分支，不使用语义模型。数据按会话保存。 */
(function () {
    'use strict';
    const MIN = 60000;
    const CATEGORIES = {daily:'日常',like:'偏好',sweet:'亲昵',fun:'假设',deep:'认真聊聊'};
    const choice = (id,cat,text,options) => ({id,cat,text,type:'choice',options:options.map(([text,reply])=>({text,reply}))});
    const text = (id,cat,question) => ({id,cat,text:question,type:'text',options:[]});
    // 原创预设；选项的回应与选项绑定，避免答非所问。
    const PRESETS = [
        choice('s1','daily','现在想让我怎么陪你？',[['聊一会儿','好，你说，我听着。'],['一起发呆','那就一起待着，什么也不做。'],['抱抱就好','过来，给你一个很长的抱抱。']]),
        choice('s2','daily','今天的电量还剩多少？',[['满格！','那分我一点你的好心情吧。'],['一半左右','那我们慢慢来，给自己留点力气。'],['快没电了','今天已经很努力了，先休息一下。']]),
        text('s3','daily','今天有没有一件小事，让你偷偷开心了一下？'),
        text('s4','daily','如果给今天起个名字，你想叫它什么？'),
        choice('s5','daily','现在可以一起吃点东西，你想选什么？',[['甜的','那给你留最甜的一口。'],['热乎乎的','好，一起慢慢吃，别烫到。'],['你决定','那这次交给我，下次换你。']]),
        text('s6','daily','现在抬头看看，你第一眼看见的是什么？'),
        choice('s7','like','一起出门的话，今天更想去哪？',[['散步','好，今天没有目的地，陪你走走。'],['逛小店','你慢慢挑，我在旁边陪着。'],['待在家','也好，把今天留给我们。']]),
        text('s8','like','有没有一首歌，你最近特别想让我听？'),
        choice('s9','like','下雨的时候，你更喜欢哪一种？',[['听雨声','那就安静听一会儿，我陪你。'],['窝在被子里','给你把被角掖好。'],['撑伞出去','伞往你那边偏一点，我们慢慢走。']]),
        text('s10','like','最近最想尝试的一件新鲜事是什么？'),
        choice('s11','sweet','如果现在能见面，第一件事想做什么？',[['抱住你','我也会先伸手，稳稳接住你。'],['盯着你看','好，让你看个够，我不躲。'],['装作很淡定','那我先走过来，牵住你的手。']]),
        text('s12','sweet','今天有没有哪个瞬间，突然想到我？'),
        choice('s13','sweet','今天想听我说哪句话？',[['我在呢','我在呢。你想说话的时候，我就听着。'],['想你了','想你了，所以忍不住来找你。'],['你做得很好','你已经做得很好了，也可以对自己温柔一点。']]),
        text('s14','sweet','如果留一张小纸条给我，你会写什么？'),
        choice('s15','fun','如果我们一起变成猫，你想干什么？',[['晒太阳','那给你留一块最暖和的位置。'],['到处探险','好，尾巴别走丢了，我跟着你。'],['窝在一起睡觉','那今天谁也别来打扰我们。']]),
        text('s16','fun','如果明天突然多出一个休息日，你想怎么过？'),
        choice('s17','fun','如果有一扇门能带我们去一个地方，你想去哪里？',[['海边','那一起等一场海边的日落。'],['山里','我们慢慢走，把风景都看够。'],['第一次见面的地方','那我想再认真认识你一次。']]),
        text('s18','fun','给我们的小日子设计一个节日，你想庆祝什么？'),
        text('s19','deep','什么时候，你最希望有人认真听你说话？'),
        choice('s20','deep','遇到不开心的事，你希望我先怎么做？',[['先听我说','好，我先听，不急着给建议。'],['陪我安静一下','那我陪你，不催你说出来。'],['和我一起想办法','好，我们一件一件来，不用独自扛着。']])
    ];
    const $ = id => document.getElementById(id);
    const esc = value => String(value == null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const copy = value => JSON.parse(JSON.stringify(value));
    const uid = () => 'lq_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
    const dayKey = now => new Date(now).toLocaleDateString('en-CA');
    const time = ts => new Date(ts).toLocaleString('zh-CN',{hour12:false});
    const say = s => typeof showNotification==='function'?showNotification(s,'info'):alert(s);
    const fresh = () => ({version:1,questions:[],disabled:[],favorites:[],recent:[],history:[],pending:null,next:null,lastAt:0,day:'',dailyCount:0,migrated:false,settings:{enabled:true,frequency:'normal',categories:['daily','like','sweet','fun']}});
    let activeQuestionId=null;
    const drafts=new Map();
    let state=null,key='',serial=Promise.resolve(),shown='',tab='system',editing=null,lastInputAt=0,started=false;
    function pool(s) {
        return [...PRESETS,...s.questions].filter(q=>s.settings.categories.includes(q.cat)&&!s.disabled.includes(q.id));
    }
    function pick(s,random=Math.random) {
        const all=pool(s), available=all.filter(q=>!s.recent.includes(q.id));
        const source=available.length?available:all;
        return source.length?copy(source[Math.floor(random()*source.length)]):null;
    }
    function arm(s,now,first=false) {
        const q=pick(s);
        const ranges={quiet:[60,120],normal:[25,60],active:[15,35]};
        const [min,max]=first?[3,8]:(ranges[s.settings.frequency]||ranges.normal);
        s.next=q?{question:q,at:now+(min+Math.random()*(max-min))*MIN}:null;
    }
    function issue(s,q,now,depth=0,author) {
        author ||= window.XavierConversations?.profile(window.XavierConversations.homeId());
        const r={id:uid(),question:copy(q),askedAt:now,status:'pending',answer:'',reply:'',depth,partnerId:author?.id,partnerName:author?.name};
        s.pending=r;s.next=null;s.lastAt=now;
        s.recent=[q.id,...s.recent.filter(id=>id!==q.id)].slice(0,10);
        return r;
    }
    function advance(s,now) {
        if(s.day!==dayKey(now)){s.day=dayKey(now);s.dailyCount=0;}
        if(!s.settings.enabled)return null;
        const cap={quiet:1,normal:2,active:4}[s.settings.frequency]||2;
        const roles = window.XavierConversations?.profiles() || [];
        if (roles.length > 1) {
            s.roleSchedule ||= {};
            const roleIds = new Set(roles.map(role => role.id));
            for (const id of Object.keys(s.roleSchedule)) if (!roleIds.has(id)) delete s.roleSchedule[id];
            for (const role of roles) {
                if (!s.roleSchedule[role.id]) {
                    const slot = {...s};
                    arm(slot, now, true);
                    s.roleSchedule[role.id] = {next: slot.next, day:s.day, count:0};
                }
                const slot = s.roleSchedule[role.id];
                if (slot.day !== s.day) { slot.day = s.day; slot.count = 0; }
                if (slot.next && !pool(s).some(question => question.id === slot.next.question.id)) {
                    const next = {...s};
                    arm(next, now);
                    slot.next = next.next;
                }
            }
            if (s.pending) return null;
            const due = roles.map(role => ({role, slot:s.roleSchedule[role.id]}))
                .filter(({slot}) => slot.count < cap && slot.next?.at <= now)
                .sort((a,b) => a.slot.next.at - b.slot.next.at)[0];
            if (!due) return null;
            const record = issue(s, due.slot.next.question, due.slot.next.at, 0, due.role);
            due.slot.count++;
            const next = {...s};
            arm(next, now);
            due.slot.next = next.next;
            return record;
        }
        if (s.pending || s.dailyCount>=cap)return null;
        if(!s.next){arm(s,now,true);return null;}
        if(s.next.at>now)return null;
        // 关闭的题目或分类不能被旧排期重新发出来。
        if(!pool(s).some(q=>q.id===s.next.question.id)){arm(s,now);return null;}
        const r=issue(s,s.next.question,s.next.at);s.dailyCount++;return r;
    }
    async function legacyQuestionTexts(){
        const legacy=await localforage.getItem(getStorageKey('qaData'));
        const old=legacy?.questionLibrary;
        return Array.isArray(old)?[...new Set(old.filter(q=>typeof q==='string').map(q=>q.trim()).filter(Boolean))]:[];
    }
    function transaction(change) {
        const task=serial.then(async()=>{
            const nextKey=getStorageKey('qaLiveData');
            let base=state;
            if(!base||key!==nextKey){
                const saved=await localforage.getItem(nextKey);
                base=saved?{...fresh(),...saved,settings:{...fresh().settings,...saved.settings}}:fresh();
            }
            const next=copy(base);
            if(!next.migrated){
                const known=new Set([...PRESETS,...next.questions].map(q=>q.text));
                for(const question of await legacyQuestionTexts()){
                    if(!known.has(question))next.questions.push(text(uid(),'daily',question));
                }
                next.migrated=true;
            }
            const result=change?change(next):null;
            if(!state||key!==nextKey||change||!base.migrated)await localforage.setItem(nextKey,next);
            if(key!==nextKey){shown='';activeQuestionId=null;drafts.clear();$('qa-live-notice')?.remove();if($('qa-question-modal'))hideModal($('qa-question-modal'));}
            state=next;key=nextKey;return result;
        });
        serial=task.catch(()=>{});return task;
    }
    function safeError(e){console.warn('[主动问答]',e);say(e.message||'保存失败，请重试。');}
    function replyCards(){
        try {return typeof drawReplyCards==='function'?(drawReplyCards(2)||[]).join('  '):'';}catch(e){return '';}
    }
    function answer(s,id,index,written,cards,now,random=Math.random){
        const r=s.pending;if(!r||r.id!==id)throw Error('这道问题已处理，请查看记录。');
        if(r.question.type==='choice'){
            const option=r.question.options[index];if(!option)throw Error('请选择一个答案。');
            r.answer=option.text;r.reply=[option.reply||'好，我记下你的选择了。',cards].filter(Boolean).join('\n\n');
        }else{
            if(!written.trim())throw Error('先写一点想对 Ta 说的话吧。');
            r.answer=written.trim().slice(0,2000);r.reply=['嗯，你写的我有认真看。',cards||'谢谢你愿意告诉我。'].join('\n\n');
        }
        r.status='answered';r.answeredAt=now;
        r.followUpOffered=r.depth<2 && random()<0.3;
        s.history.unshift(r);s.history=s.history.slice(0,25);s.pending=null;arm(s,now);
        return copy(r);
    }
    function currentRecord(id,snapshot){return state?.pending?.id===id?state.pending:state?.history.find(r=>r.id===id)||snapshot;}
    function cardHTML(r,available=true,interactive=false){
        if(!r)return '<div class="ql-muted">问题记录暂不可用。</div>';
        const q=r.question,ready=available&&state?.pending?.id===r.id;
        let html=`<div class="ql-top">${esc(r.partnerName || settings.partnerName || 'Ta')} · 突然想问你 <span>${esc(time(r.askedAt))}</span></div><div class="ql-question">${esc(q.text)}</div>`;
        if(r.status==='pending'){
            if(interactive)html+=`<div class="ql-actions">${q.type==='choice'?q.options.map((o,i)=>`<button data-ql="answer" data-id="${r.id}" data-index="${i}" ${ready?'':'disabled'}>${esc(o.text)}</button>`).join(''):`<textarea data-ql-answer="${r.id}" maxlength="2000" placeholder="输入你的回答…" ${ready?'':'disabled'}>${esc(drafts.get(r.id)||'')}</textarea><button data-ql="answer" data-id="${r.id}" ${ready?'':'disabled'}>提交</button>`}</div><div class="ql-actions"><button class="ql-soft" data-ql="skip" data-id="${r.id}" ${ready?'':'disabled'}>跳过</button></div>`;
            else html+=`<div class="ql-muted">Ta 在等你的回答</div><div class="ql-actions"><button data-ql="open-question" data-id="${r.id}">打开问题</button></div>`;
        }else if(r.status==='skipped')html+='<div class="ql-muted">这题先放一放，等下次想聊的时候。</div>';
        else{
            html+=`<div class="ql-my">你：${esc(r.answer)}</div><div class="ql-reply">${esc(r.reply)}</div>`;
            if(interactive&&r.followUpOffered&&!r.finished&&!r.continued&&r.depth<2)html+=`<div class="ql-invite"><p>我还想问你一个，可以吗？</p><div class="ql-actions"><button data-ql="continue" data-id="${r.id}">好呀</button><button class="ql-soft" data-ql="question-close">下次再聊</button></div></div>`;
        }
        if(state?.history.some(record=>record.id===r.id)){
            const id=esc(r.id);
            html+=`<div class="ql-actions ql-history-actions">
                ${!interactive&&r.status==='answered'?`<button data-ql="open-question" data-id="${id}">回看这次问答</button>`:''}
                <button data-ql="repeat" data-id="${id}">再聊一次</button>
                ${r.status==='answered'?`<button data-ql="edit-reply" data-id="${id}">编辑 TA 的留言</button>`:''}
                <button class="ql-delete-record" data-ql="delete-record" data-id="${id}">删除这条记录</button>
            </div>`;
        }
        html+=`<button class="ql-star ql-soft" data-ql="favorite" data-question="${q.id}">${state?.favorites.includes(q.id)?'★ 已收藏问题':'☆ 收藏问题'}</button>`;
        return html;
    }
    function showReplyEditor(button,id){
        const record=state.history.find(r=>r.id===id&&r.status==='answered');
        if(!record)throw Error('这条留言已不存在。');
        const card=button.closest('#qa-question-body, .ql-item');
        const existing=card.querySelector('.ql-reply-editor textarea');
        if(existing){existing.focus();return;}
        const reply=card.querySelector('.ql-reply');
        const editor=document.createElement('div');
        editor.className='ql-reply-editor';
        editor.innerHTML=`<label>TA 的留言<textarea maxlength="4000"></textarea></label><div class="ql-actions">
            <button type="button" data-ql="save-reply" data-id="${esc(id)}">保存留言</button>
            <button type="button" data-ql="cancel-reply">取消</button>
        </div>`;
        const input=editor.querySelector('textarea');
        input.value=record.reply||'';
        reply.hidden=true;
        reply.after(editor);
        input.focus();
    }
    function redrawHistory(){
        const body=$('qa-live-body');
        if($('qa-live-modal').style.display==='flex'){
            const offset=body.scrollTop;
            renderManager();
            body.scrollTop=offset;
        }
        if(activeQuestionId)openQuestion(activeQuestionId);
    }
    function openQuestion(id){
        mount();
        const snapshot=typeof messages!=='undefined'?messages.find(m=>m.type==='qa-live'&&m.qaRecordId===id)?.qaSnapshot:null;
        const r=currentRecord(id,snapshot);if(!r){say('这次互动已被清理。');return;}
        activeQuestionId=id;shown=id;$('qa-live-notice')?.remove();
        const name=r.partnerName || settings.partnerName || 'Ta';
        const avatar=r.partnerId ? window.XavierConversations?.profile(r.partnerId)?.avatar || '' : settings.partnerAvatar || '';
        $('ql-question-person').textContent=name;
        $('ql-question-avatar').innerHTML=avatar?`<img src="${esc(avatar)}" alt="">`:'💭';
        $('ql-question-type').textContent=r.question.type==='choice'?'选择题':'文字题';
        $('qa-question-body').innerHTML=cardHTML(r,true,true);
        showModal($('qa-question-modal'));
    }
    async function closeQuestion(){
        const id=activeQuestionId;
        if(id&&state?.history.some(r=>r.id===id&&r.status==='answered'&&!r.finished))await transaction(s=>{const r=s.history.find(r=>r.id===id);if(r)r.finished=true;});
        hideModal($('qa-question-modal'));activeQuestionId=null;refresh();
    }
    function refresh(){
        document.querySelectorAll('[data-ql-record]').forEach(node=>{
            const r=currentRecord(node.dataset.qlRecord,null);if(r)node.innerHTML=cardHTML(r);
        });
        if(typeof messages!=='undefined'){
            messages.forEach(msg=>{if(msg.type==='qa-live'){const r=currentRecord(msg.qaRecordId,null);if(r)msg.qaSnapshot=copy(r);}});
            if(typeof throttledSaveData==='function')throttledSaveData();
        }
        const button=$('qa-live-home');if(button){const pending=state?.pending;button.textContent=pending?'💭 Ta 的问题等你回答 · 问题库与记录':'💭 主动问答 · 问题库与记录';}
    }
    function homeReady(){return !document.hidden&&(!$('welcome-animation')||getComputedStyle($('welcome-animation')).display==='none');}
    function busy(){
        if(!homeReady()||Date.now()-lastInputAt<20000)return true;
        if(document.querySelector('#incoming-letter-popup, #envelope-reply-popup, #decision-notice, #qa-popup'))return true;
        const el=document.activeElement;if(el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))return true;
        return [...document.querySelectorAll('.modal')].some(el=>getComputedStyle(el).display!=='none');
    }
    function notify(){
        const r=state?.pending;if(!r||!homeReady()||shown===r.id||window.HomeShell?.isChat()||busy())return;
        openQuestion(r.id);
    }
    async function tick(){
        if(!homeReady())return;
        // 已计划的问题只补一题；等停止输入、关闭弹窗后再呈现。
        if(!state||key!==getStorageKey('qaLiveData')||!busy())await transaction(s=>advance(s,Date.now()));
        if(state?.pending)notify();
    }
    function mount(){
        if($('qa-live-modal'))return;
        const style=document.createElement('style');
        style.textContent=`
        .ql-chat-card,.ql-notice{box-sizing:border-box;background:var(--secondary-bg);color:var(--text-primary);border:1px solid var(--border-color);border-radius:18px;padding:16px;overflow-wrap:anywhere}
        .ql-chat-card{width:calc(100% - 28px);max-width:430px;margin:14px auto;box-shadow:0 4px 18px rgba(var(--accent-color-rgb),.06);animation:qlIn .25s ease}
        .ql-top{font-size:11px;color:var(--text-secondary);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.ql-top span{font-size:10px;opacity:.7}.ql-question{font-size:15px;line-height:1.8;margin:12px 0;font-weight:600}
        .ql-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.ql-chat-card button,.ql-notice button,#qa-live-modal button{font:inherit;font-size:12px;border:1px solid var(--border-color);border-radius:11px;padding:8px 12px;cursor:pointer;background:var(--primary-bg);color:var(--text-primary)}
        .ql-chat-card button:hover,#qa-live-modal button[aria-pressed=true]{border-color:var(--accent-color);background:rgba(var(--accent-color-rgb),.12)}.ql-chat-card button:disabled{opacity:.45;cursor:default}.ql-chat-card .ql-soft,.ql-notice .ql-soft{font-size:11px;color:var(--text-secondary);background:transparent}.ql-star{margin-top:6px}
        .ql-my{font-size:13px;padding:10px 12px;border-radius:10px;background:var(--primary-bg);line-height:1.8;white-space:pre-wrap}.ql-reply{font-size:14px;line-height:1.9;white-space:pre-wrap;margin:12px 0}.ql-muted{font-size:12px;color:var(--text-secondary);line-height:1.8;white-space:pre-wrap}
        .ql-notice{position:fixed;z-index:8150;bottom:82px;left:50%;transform:translateX(-50%);width:88%;max-width:340px;box-shadow:0 8px 30px #0003}.ql-notice p{font-size:13px;line-height:1.7}
        #qa-live-modal{z-index:2300}#qa-live-modal .ql-shell{width:94%;max-width:550px;padding:0;max-height:90vh;max-height:90dvh;display:flex;flex-direction:column;overflow:hidden;background:var(--secondary-bg)}
        #qa-live-modal .ql-head{padding:16px 18px;display:flex;justify-content:space-between;align-items:center;background:rgba(var(--accent-color-rgb),.08);gap:10px}#qa-live-modal h3{margin:0;font-size:16px}#qa-live-body{overflow-y:auto;padding:16px 18px;min-height:0;overscroll-behavior:contain}
        .ql-reply:empty,.ql-reply[hidden]{display:none}
        .ql-reply-editor{margin:12px 0}.ql-reply-editor textarea{display:block;width:100%;margin-top:6px;resize:vertical}
        #qa-live-modal .ql-delete-record,#qa-question-modal .ql-delete-record{color:var(--danger-color,#b34a54)}
        #qa-live-modal .ql-item{border:1px solid var(--border-color);border-radius:14px;padding:13px;margin:10px 0;overflow-wrap:anywhere}#qa-live-modal .ql-item p{white-space:pre-wrap;line-height:1.8;font-size:14px;margin:8px 0}
        .ql-chat-card textarea,#qa-live-modal textarea,#qa-live-modal input[type=text],#qa-live-modal select{box-sizing:border-box;width:100%;font:inherit;font-size:14px;color:var(--text-primary);border:1px solid var(--border-color);border-radius:10px;padding:10px;background:var(--primary-bg)}.ql-chat-card textarea,#qa-live-modal textarea{min-height:85px;resize:vertical;line-height:1.8}#qa-live-modal label{display:block;font-size:13px;margin:12px 0 6px;line-height:1.8}#qa-live-modal input[type=checkbox]{accent-color:var(--accent-color)}
        #qa-live-home{width:100%;padding:13px;border:1px solid var(--border-color);border-radius:13px;color:var(--accent-color);background:rgba(var(--accent-color-rgb),.06);font:inherit;font-size:13px;cursor:pointer;margin-bottom:12px}.ql-chat-card button:focus-visible,#qa-live-modal button:focus-visible{outline:2px solid var(--accent-color);outline-offset:2px}

        #qa-question-modal{z-index:2400}#qa-question-modal .ql-question-shell{padding:0;width:92%;max-width:480px;max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:24px;background:var(--secondary-bg)}
        .ql-question-head{display:flex;align-items:center;gap:10px;padding:18px 20px;border-bottom:1px solid var(--border-color);background:rgba(var(--accent-color-rgb),.06);flex-shrink:0}#ql-question-avatar{width:40px;height:40px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--primary-bg);flex-shrink:0}#ql-question-avatar img{width:100%;height:100%;object-fit:cover}#ql-question-person{font-size:16px}#ql-question-type{font-size:10px;border-radius:20px;padding:4px 9px;background:rgba(var(--accent-color-rgb),.09);color:var(--accent-color)}
        #qa-question-modal button{font:inherit;font-size:13px;background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:11px 15px;color:var(--text-primary);cursor:pointer}#qa-question-modal button:disabled{opacity:.45;cursor:wait}#qa-question-modal [data-ql=question-close]{margin-left:auto;border:0;background:var(--primary-bg)}.ql-question-head [data-ql=question-close]{width:34px;height:34px;padding:0!important;border-radius:50%!important;font-size:24px!important}
        #qa-question-body{padding:20px;overflow-y:auto;min-height:0;overscroll-behavior:contain}#qa-question-body .ql-top{display:none}#qa-question-body .ql-question{font-size:19px;line-height:1.7;margin:4px 0 20px}#qa-question-body .ql-actions{gap:10px}#qa-question-body textarea{box-sizing:border-box;width:100%;min-height:100px;font:inherit;font-size:15px;line-height:1.8;color:var(--text-primary);background:var(--primary-bg);border:1px solid var(--border-color);border-radius:15px;padding:14px;resize:vertical}#qa-question-body textarea:focus{outline:2px solid rgba(var(--accent-color-rgb),.35);outline-offset:2px}
        #qa-question-body [data-ql=answer]{flex:1 1 100%;text-align:left;padding:14px 16px}#qa-question-body textarea+[data-ql=answer]{text-align:center;background:var(--accent-color);color:var(--secondary-bg)}#qa-question-body .ql-invite{border-top:1px dashed var(--border-color);margin-top:18px;padding-top:12px}#qa-question-body .ql-invite p{font-size:14px;color:var(--accent-color)}#qa-question-body .ql-invite button{flex:1}#qa-question-body .ql-soft{font-size:12px;color:var(--text-secondary)}#qa-question-body .ql-star{border:0;background:transparent;padding-left:0}#qa-question-body .ql-invite [data-ql=continue]{background:rgba(var(--accent-color-rgb),.12);color:var(--accent-color);border-color:var(--accent-color)}
        @keyframes qlIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.ql-chat-card{animation:none}}`;
        document.head.appendChild(style);
        const modal=document.createElement('div');modal.id='qa-live-modal';modal.className='modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','ql-title');
        modal.innerHTML='<div class="modal-content ql-shell"><div class="ql-head"><h3 id="ql-title">主动问答 · 问题库</h3><button data-ql="close">关闭</button></div><div id="qa-live-body"></div></div>';
        document.body.appendChild(modal);
        const questionModal=document.createElement('div');questionModal.id='qa-question-modal';questionModal.className='modal';
        questionModal.setAttribute('role','dialog');questionModal.setAttribute('aria-modal','true');questionModal.setAttribute('aria-labelledby','ql-question-person');
        questionModal.innerHTML='<div class="modal-content ql-question-shell"><div class="ql-question-head"><div id="ql-question-avatar"></div><strong id="ql-question-person"></strong><span id="ql-question-type"></span><button data-ql="question-close" aria-label="关闭问答">×</button></div><div id="qa-question-body"></div></div>';
        document.body.appendChild(questionModal);
        questionModal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeQuestion().catch(safeError);}});
        questionModal.addEventListener('click',e=>{if(e.target===questionModal)closeQuestion().catch(safeError);});
        questionModal.addEventListener('input',e=>{if(e.target.dataset.qlAnswer)drafts.set(e.target.dataset.qlAnswer,e.target.value);});

        document.addEventListener('input',()=>{lastInputAt=Date.now();},true);
        document.addEventListener('click',e=>{
            const b=e.target.closest('[data-ql]');if(!b)return;
            e.preventDefault();e.stopPropagation();b.disabled=true;
            action(b).catch(safeError).finally(()=>{b.disabled=false;});
        });
    }
    function attachHome(content){
        if(content.querySelector('#qa-live-home'))return;
        const button=document.createElement('button');button.id='qa-live-home';button.type='button';button.textContent='💭 主动问答 · 问题库与记录';
        button.onclick=()=>openManager().catch(safeError);content.querySelector('.qa-home-grid')?.before(button);
    }
    async function openManager(view=tab){mount();await transaction();tab=view;editing=null;renderManager();showModal($('qa-live-modal'));}
    function renderEditor(){
        const q=editing==='new'?text('','daily',''):state.questions.find(q=>q.id===editing);if(!q){editing=null;return renderManager();}
        $('qa-live-body').innerHTML=`<button data-ql="editor-back">← 返回问题库</button><label>问题内容<input id="ql-edit-text" type="text" maxlength="300" value="${esc(q.text)}"></label><label>分类<select id="ql-edit-cat">${Object.entries(CATEGORIES).map(([k,v])=>`<option value="${k}" ${q.cat===k?'selected':''}>${v}</option>`).join('')}</select></label><label>题型<select id="ql-edit-type"><option value="text" ${q.type==='text'?'selected':''}>自由文字回答</option><option value="choice" ${q.type==='choice'?'selected':''}>单选 · 2～4 项</option></select></label><label>选择题选项（文字题可留空）<textarea id="ql-edit-options" maxlength="4000" placeholder="每行：选项 | Ta 的回应（回应可不填）">${esc((q.options||[]).map(o=>o.text+' | '+(o.reply||'')).join('\n'))}</textarea></label><div class="ql-muted">例如：一起发呆 | 那就一起安静待着。<br>文字题继续从现有字卡库抽回应。</div><div class="ql-actions"><button data-ql="save-question">保存问题</button></div>`;
    }
    function renderManager(){
        if(editing)return renderEditor();
        const s=state;
        const tabs={system:'系统问题',custom:'我的问题',favorites:'收藏问题',history:'互动记录',settings:'频率设置'};
        let html=`<div class="ql-actions">${Object.entries(tabs).map(([k,v])=>`<button data-ql="tab" data-tab="${k}" aria-pressed="${tab===k}">${v}</button>`).join('')}</div>`;
        if(s.pending)html+=`<div class="ql-item"><div class="ql-muted">Ta 有个问题还在等你</div><p>${esc(s.pending.question.text)}</p><button data-ql="locate">打开问题回答</button></div>`;
        if(tab==='settings'){
            html+=`<label><input type="checkbox" id="ql-enabled" ${s.settings.enabled?'checked':''}> 允许 Ta 主动问我</label><label>陪伴频率<select id="ql-frequency"><option value="quiet" ${s.settings.frequency==='quiet'?'selected':''}>安静一点 · 每天最多 1 次</option><option value="normal" ${s.settings.frequency==='normal'?'selected':''}>偶尔问问 · 每天最多 2 次</option><option value="active" ${s.settings.frequency==='active'?'selected':''}>多陪我聊聊 · 每天最多 4 次</option></select></label><div class="ql-muted">没有待答题时，首次随机等待 3～8 分钟；后续按档位间隔触发。<br>正在输入、打开弹窗时暂缓提醒。离线期间最多留一道题。<br>早期问答保存在互动记录入口，调查问卷照常保留。</div><label>允许主动抽取的分类</label>${Object.entries(CATEGORIES).map(([k,v])=>`<label><input type="checkbox" data-ql-cat="${k}" ${s.settings.categories.includes(k)?'checked':''}> ${v}${k==='deep'?'（默认关闭）':''}</label>`).join('')}<div class="ql-actions"><button data-ql="save-settings">保存设置</button></div>`;
        }else if(tab==='history'){
            html+='<div class="ql-muted">保留最近 25 次互动；收藏的是问题，保存在问题库中。</div><div class="ql-actions"><button data-ql="legacy">查看早期问答与未完成回应</button></div>';
            html+=s.history.length?s.history.map(r=>`<div class="ql-item">${cardHTML(r)}</div>`).join(''):'<p class="ql-muted">还没有互动记录。等 Ta 来找你，或挑一道喜欢的问题开始。</p>';
        }else{
            if(tab==='custom')html+='<div class="ql-actions"><button data-ql="new">＋ 添加问题</button><button data-ql="import">批量导入文字题</button></div>';
            const all=tab==='system'?PRESETS:tab==='custom'?s.questions:[...PRESETS,...s.questions].filter(q=>s.favorites.includes(q.id));
            html+=all.length?all.map(q=>`<div class="ql-item"><div class="ql-muted">${esc(CATEGORIES[q.cat]||'日常')} · ${q.type==='choice'?'单选':'文字题'}${s.disabled.includes(q.id)?' · 已停用':''}${!s.settings.categories.includes(q.cat)?' · 分类未开启':''}</div><p>${esc(q.text)}</p>${q.type==='choice'?`<div class="ql-muted">${q.options.map(o=>esc(o.text)).join(' / ')}</div>`:''}<div class="ql-actions"><button data-ql="ask" data-question="${q.id}">聊这题</button><button data-ql="favorite" data-question="${q.id}">${s.favorites.includes(q.id)?'★ 已收藏':'☆ 收藏'}</button><button data-ql="toggle" data-question="${q.id}">${s.disabled.includes(q.id)?'启用':'停用'}</button>${s.questions.some(x=>x.id===q.id)?`<button data-ql="edit" data-question="${q.id}">编辑</button><button data-ql="delete" data-question="${q.id}">删除</button>`:''}</div></div>`).join(''):'<p class="ql-muted">这里还没有问题。</p>';
        }
        $('qa-live-body').innerHTML=html;
    }
    function locate(){
        hideModal($('qa-live-modal'));if($('qa-modal'))hideModal($('qa-modal'));if($('advanced-modal'))hideModal($('advanced-modal'));if($('settings-modal'))hideModal($('settings-modal'));
        const r=state?.pending;if(r)openQuestion(r.id);
    }
    async function action(button){
        const a=button.dataset.ql,id=button.dataset.id,qid=button.dataset.question;
        if(a==='question-close'){await closeQuestion();return;}
        if(a==='open-question'){openQuestion(id);return;}
        if(a==='edit-reply'){showReplyEditor(button,id);return;}
        if(a==='cancel-reply'){
            const editor=button.closest('.ql-reply-editor');
            editor.previousElementSibling.hidden=false;
            const editButton=editor.parentElement.querySelector('[data-ql="edit-reply"]');
            editor.remove();editButton?.focus();return;
        }
        if(a==='save-reply'){
            const reply=button.closest('.ql-reply-editor').querySelector('textarea').value.trim();
            await transaction(s=>{
                const record=s.history.find(r=>r.id===id&&r.status==='answered');
                if(!record)throw Error('这条留言已不存在。');
                record.reply=reply;
            });
            refresh();redrawHistory();return;
        }
        if(a==='delete-record'){
            if(!confirm('删除这次问答记录？'))return;
            await transaction(s=>{s.history=s.history.filter(r=>r.id!==id);});
            if(typeof messages!=='undefined'){
                for(let i=messages.length-1;i>=0;i--){
                    if(messages[i].type==='qa-live'&&messages[i].qaRecordId===id)messages.splice(i,1);
                }
            }
            if(activeQuestionId===id){activeQuestionId=null;hideModal($('qa-question-modal'));}
            refresh();redrawHistory();return;
        }
        if(a==='legacy'){hideModal($('qa-live-modal'));showModal($('qa-modal'));if(typeof _qaRenderHisView==='function')_qaRenderHisView();return;}
        if(a==='close'){hideModal($('qa-live-modal'));return;}
        if(a==='dismiss'){$('qa-live-notice')?.remove();return;}
        if(a==='locate'){locate();return;}
        if(a==='tab'){tab=button.dataset.tab;editing=null;renderManager();return;}
        if(a==='new'||a==='edit'){editing=a==='new'?'new':qid;renderManager();return;}
        if(a==='editor-back'){editing=null;renderManager();return;}
        if(a==='import'){
            $('qa-live-body').innerHTML='<button data-ql="editor-back">← 返回</button><label>每行一道文字题<textarea id="ql-import" maxlength="50000" placeholder="今天有什么开心的小事？\n最近想去哪走走？"></textarea></label><div class="ql-actions"><button data-ql="save-import">导入</button><button data-ql="prefill-legacy">带入旧题库</button></div>';return;
        }
        if(a==='prefill-legacy'){
            const input=$('ql-import');
            const legacy=await legacyQuestionTexts();
            if(!input.isConnected)return;
            const known=new Set([...PRESETS,...state.questions].map(q=>q.text));
            for(const line of input.value.split(/\r?\n/))known.add(line.trim());
            const missing=legacy.filter(q=>!known.has(q));
            if(!missing.length){say('没有尚未列出的旧题目。');return;}
            input.value=[input.value.trimEnd(),...missing].filter(Boolean).join('\n');
            input.focus();return;
        }
        if(a==='save-import'){
            const lines=$('ql-import').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!lines.length)throw Error('每行写一道问题。');
            await transaction(s=>{const known=new Set([...PRESETS,...s.questions].map(q=>q.text));lines.forEach(t=>{if(t.length>300)throw Error('每道问题最多 300 字。');if(!known.has(t)){s.questions.push(text(uid(),'daily',t));known.add(t);}});});tab='custom';renderManager();return;
        }
        if(a==='save-question'){
            const title=$('ql-edit-text').value.trim(),cat=$('ql-edit-cat').value,type=$('ql-edit-type').value;
            if(!title)throw Error('请填写问题。');
            const options=$('ql-edit-options').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const parts=line.split('|');return {text:parts.shift().trim(),reply:parts.join('|').trim()};});
            if(type==='choice'&&(options.length<2||options.length>4||options.some(o=>!o.text)))throw Error('单选题需要 2～4 个非空选项。');
            await transaction(s=>{const q={id:editing==='new'?uid():editing,text:title,cat,type,options:type==='choice'?options:[]};const i=s.questions.findIndex(x=>x.id===q.id);if(i<0)s.questions.push(q);else s.questions[i]=q;});editing=null;tab='custom';renderManager();return;
        }
        if(a==='save-settings'){
            const enabled=$('ql-enabled').checked,frequency=$('ql-frequency').value,categories=[...document.querySelectorAll('[data-ql-cat]')].filter(n=>n.checked).map(n=>n.dataset.qlCat);
            if(enabled&&!categories.length)throw Error('至少开启一个分类，或关闭主动提问。');
            await transaction(s=>{s.settings={enabled,frequency,categories};arm(s,Date.now(),true);});renderManager();say('主动问答设置已保存。');return;
        }
        if(a==='favorite'||a==='toggle'||a==='delete'){
            if(a==='delete'&&!confirm('删除这道自定义问题？已发生的互动记录会保留。'))return;
            await transaction(s=>{const list=a==='favorite'?s.favorites:s.disabled,i=list.indexOf(qid);if(a==='delete'){s.questions=s.questions.filter(q=>q.id!==qid);s.favorites=s.favorites.filter(x=>x!==qid);s.disabled=s.disabled.filter(x=>x!==qid);}else if(i<0)list.push(qid);else list.splice(i,1);});
            refresh();if($('qa-live-modal').style.display==='flex')renderManager();if(activeQuestionId)openQuestion(activeQuestionId);return;
        }
        if(a==='answer'){
            const node=button.closest('#qa-question-body, .ql-chat-card, .ql-item');const input=node?.querySelector('textarea');
            const written=input?.value||'',cards=replyCards();
            await transaction(s=>answer(s,id,Number(button.dataset.index),written,cards,Date.now()));
            drafts.delete(id);
            if(typeof saveQaData==='function')saveQaData();$('qa-live-notice')?.remove();refresh();if($('qa-live-modal').style.display==='flex')renderManager();if(activeQuestionId)openQuestion(activeQuestionId);return;
        }
        if(a==='skip'){
            await transaction(s=>{if(s.pending?.id!==id)return;const r=s.pending;r.status='skipped';s.history.unshift(r);s.history=s.history.slice(0,25);s.pending=null;arm(s,Date.now());});drafts.delete(id);hideModal($('qa-question-modal'));activeQuestionId=null;$('qa-live-notice')?.remove();refresh();if($('qa-live-modal').style.display==='flex')renderManager();if(activeQuestionId)openQuestion(activeQuestionId);return;
        }
        if(a==='finish'){await transaction(s=>{const r=s.history.find(r=>r.id===id);if(r)r.finished=true;});refresh();if($('qa-live-modal').style.display==='flex')renderManager();if(activeQuestionId)openQuestion(activeQuestionId);return;}
        if(a==='ask'||a==='continue'||a==='repeat'){
            await transaction(s=>{
                if(s.pending)throw Error('先回答或跳过 Ta 当前的问题吧。');
                let depth=0,q,author;
                if(a==='continue'){
                    const previous=s.history.find(r=>r.id===id);if(!previous||previous.depth>=2||previous.finished||!previous.followUpOffered)throw Error('这次先聊到这里吧。');
                    if(previous.continued)throw Error('这轮已经继续问过了，看看新问题吧。');
                    author = previous.partnerId ? {id:previous.partnerId,name:previous.partnerName} : undefined;
                    depth=previous.depth+1;q=pick(s);if(!q)throw Error('没有可用问题，去问题库开启一些吧。');previous.continued=true;
                }else if(a==='repeat'){
                    q=s.history.find(r=>r.id===id)?.question;
                }else q=[...PRESETS,...s.questions].find(q=>q.id===qid);
                if(!q)throw Error('找不到这道问题。');return copy(issue(s,q,Date.now(),depth,author));
            });refresh();locate();return;
        }
    }
    window.QALive={attachHome,open:view=>openManager(view).catch(safeError),handlesAuto:()=>!!state};
    const timer=setInterval(async()=>{
        if(started)return;
        try{getStorageKey('qaLiveData');if(!homeReady())return;started=true;mount();await transaction();await tick();refresh();clearInterval(timer);
            setInterval(()=>tick().catch(e=>console.warn('[主动问答]',e)),15000);
            document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick().catch(safeError);});
        }catch(e){started=false;console.warn('[主动问答初始化]',e);}
    },1000);
})();
