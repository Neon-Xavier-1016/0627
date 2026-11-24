/* 一起翻牌：记忆牌与随机牌，支持单人和轮流翻牌。 */
(function () {
    'use strict';

    const minute = 60000;
    const outgoingExpiry = 5 * minute;
    const storageName = 'memoryMatchInvites';
    const modes = {
        memory: {name:'记忆牌', columns:4, pairs:8, chances:3, previewMs:4000, hint:'先看牌 4 秒，有 3 次试错机会。'},
        random: {name:'随机牌', columns:6, pairs:18, chances:null, previewMs:0, hint:'直接盲翻，找齐 18 对。'},
        race: {name:'记忆竞速', columns:4, pairs:8, chances:null, previewMs:4000, hint:'各翻一副牌，翻错可以继续，先找齐 8 对的人获胜。'}
    };
    const fallbackFaces = ['🌙','⭐','🍓','☕','🐾','🎧','🎀','🫧','🍋','🪴','🐈','🦋','🌷','🍩','🐚','🧸','🪁','🎨'];
    const resultLines = {
        win: ['最后一对也找到了，好厉害。','藏得这么好的牌，也被你记住了。','这局翻得真漂亮，我要给你鼓掌。'],
        loss: ['没关系，休息一下，想玩的时候再来。','有几张真的很容易记混，这局就先到这里吧。','试了这么多张也很棒，下次我们慢慢找。']
    };
    const pick = items => items[Math.floor(Math.random() * items.length)];
    const minutes = (min, max) => (min + Math.random() * (max - min)) * minute;
    const $ = id => document.getElementById(id);
    const label = () => settings.partnerName || 'TA';
    const partnerUnavailable = () => /(不舒服|睡着|睡觉|忙碌|没心情|心情不好|很累|离线)/.test(settings.partnerStatus || '');

    let sessionKey = '', invites, modal, body, mode = '', game = null;
    let selectedMode = 'memory', incomingMode = 'memory', completedRounds = 0;
    const stepTimers = new Map();
    let outgoingDeadline = 0;

    function saveInvites() {
        try { localStorage.setItem(sessionKey, JSON.stringify(invites)); } catch (_) {}
    }

    function nextInvite(stage, timing = window.GameInvites.timing()) {
        return timing ? Date.now() + minutes(...timing[stage]) : 0;
    }

    function syncInviteFrequency() {
        const frequency = window.GameInvites.frequency();
        const timing = window.GameInvites.timing(frequency);
        if (invites.frequency !== frequency) {
            invites.frequency = frequency;
            invites.next = nextInvite('initial', timing);
            invites.retry = invites.retryUntil = 0;
            saveInvites();
        }
        return timing;
    }

    function useSession() {
        if (!SESSION_ID) return false;
        const key = getStorageKey(storageName);
        if (key === sessionKey) return true;
        clearSteps();
        if (modal && isOpen()) hideModal(modal);
        game = null;
        mode = '';
        selectedMode = 'memory';
        completedRounds = 0;
        sessionKey = key;
        let saved;
        try { saved = JSON.parse(localStorage.getItem(key)); } catch (_) {}
        invites = {
            enabled: saved?.enabled !== false,
            frequency: saved?.frequency || 'normal',
            next: Number(saved?.next) || nextInvite('initial'),
            retry: Number(saved?.retry) || 0,
            retryUntil: Number(saved?.retryUntil) || 0,
            retryMode: Object.hasOwn(modes, saved?.retryMode) ? saved.retryMode : 'memory',
            history: Array.isArray(saved?.history) ? saved.history.slice(0,8) : []
        };
        saveInvites();
        return true;
    }

    function isOpen() { return modal?.style.display === 'flex' && !modal._hideTimeout; }

    function mount() {
        if (modal) return;
        const style = document.createElement('style');
        style.textContent = [
            '#memory-match-modal{z-index:2750}',
            '#memory-match-modal .memory-match-shell{box-sizing:border-box;width:min(92vw,420px);padding:16px;border-radius:20px;max-height:88dvh;overflow:auto;background:var(--secondary-bg);color:var(--text-primary)}',
            '.memory-match-head,.memory-match-actions,.memory-match-stats{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
            '.memory-match-head{justify-content:space-between;margin-bottom:12px}.memory-match-head h2{font-size:17px;margin:0}',
            '#memory-match-modal button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation;border:1px solid var(--border-color);border-radius:10px;background:var(--primary-bg);padding:7px 11px}',
            '#memory-match-modal button:focus-visible{outline:2px solid var(--accent-color);outline-offset:2px}',
            '#memory-match-modal .memory-match-primary{background:var(--accent-color);color:var(--primary-bg);border-color:transparent}',
            '#memory-match-modal button[aria-pressed=true]{border-color:var(--accent-color);background:rgba(var(--accent-color-rgb),.15)}',
            '.memory-match-menu,.memory-match-result{display:grid;align-content:center;justify-items:center;gap:14px;min-height:208px;text-align:center;padding:16px 0}',
            '.memory-match-menu,.memory-match-history-view{box-sizing:border-box;height:min(335px,65dvh);overflow:auto}',
            '.memory-match-history-view{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:12px 0}',
            '.memory-match-menu .memory-match-actions,.memory-match-result .memory-match-actions{justify-content:center}',
            '.memory-match-mode{display:grid;gap:2px;min-width:92px}.memory-match-mode small,.memory-match-history small{color:var(--text-secondary);font-size:11px}',
            '.memory-match-menu p,.memory-match-result p{margin:0;line-height:1.6}.memory-match-menu p,.memory-match-offer{font-size:12px;color:var(--text-secondary)}',
            '.memory-match-result strong{display:block;min-width:100px;padding:8px 20px;border-radius:10px;font-size:28px;line-height:1.25;background:var(--border-color);color:var(--text-primary)}',
            '.memory-match-result strong[data-won=true]{background:var(--accent-color);color:var(--primary-bg)}.memory-match-result-reply{max-width:29ch;overflow-wrap:anywhere}',
            '.memory-match-history{display:grid;align-content:start;gap:8px;list-style:none;padding:0 4px 2px 0;margin:0;width:100%;min-height:0;overflow:auto;overscroll-behavior:contain}.memory-match-history li{border:1px solid var(--border-color);border-radius:10px;padding:8px 10px}.memory-match-history p{margin:4px 0;overflow-wrap:anywhere}',
            '.memory-match-hearts{display:inline-flex;gap:3px;color:#d74958;font-size:16px;line-height:1}.memory-match-hearts .is-spent{color:var(--text-secondary);opacity:.62}',
            '.memory-match-race{display:grid;gap:12px;min-height:min(500px,76dvh)}',
            '.memory-match-race-side{min-width:0}.memory-match-race-side+.memory-match-race-side{border-top:1px solid var(--border-color);padding-top:12px}',
            '#memory-match-modal .memory-match-race .memory-match-status{min-height:0;margin:6px 0;text-align:center;font-size:12px}',
            '.memory-match-race .memory-match-grid{gap:4px;margin:6px auto 0}',
            '#memory-match-partner-grid{width:min(100%,176px,25dvh)}#memory-match-round.memory-match-race #memory-match-player-grid{width:min(100%,216px,30dvh)}',
            '#memory-match-modal #memory-match-partner-grid .memory-match-card{font-size:clamp(12px,4vw,18px);padding:2px;border:1px solid var(--border-color);border-radius:8px;cursor:default}',
            '#memory-match-modal #memory-match-partner-grid .memory-match-card.is-face-up{border-color:var(--accent-color)}',
            '.memory-match-racer{padding:8px 10px;border-radius:10px;border:1px solid var(--border-color);background:var(--primary-bg)}',
            '.memory-match-racer-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}.memory-match-racer-head strong{overflow-wrap:anywhere}',
            '.memory-match-racer progress{display:block;width:100%;height:7px;margin-top:6px;accent-color:var(--accent-color)}',
            '#memory-match-modal button:disabled{cursor:default;opacity:.5}',
            '#memory-match-modal .memory-match-stats{justify-content:space-between;font-size:12px;color:var(--text-secondary)}',
            '#memory-match-modal .memory-match-status{min-height:2.6em;margin:8px 0;font-size:13px;line-height:1.45}',
            '.memory-match-grid{display:grid;grid-template-columns:repeat(var(--memory-match-columns,4),minmax(0,1fr));gap:6px;margin:8px 0 12px}',
            '.memory-match-grid[data-mode=random]{gap:4px}',
            '#memory-match-modal .memory-match-card{display:grid;place-items:center;aspect-ratio:1;min-width:0;padding:3px;overflow:hidden;font:inherit;font-size:clamp(16px,5vw,24px);color:var(--accent-color);background:rgba(var(--accent-color-rgb),.12)}',
            '#memory-match-modal .memory-match-card.is-face-up{background:var(--primary-bg);border-color:var(--accent-color)}',
            '#memory-match-modal .memory-match-card.is-matched{background:var(--primary-bg);opacity:.48}',
            '#memory-match-modal .memory-match-card[aria-disabled=true]{cursor:default}',
            '.memory-match-card img{width:100%;height:100%;object-fit:contain;grid-area:1/1}',
            '.memory-match-card span{grid-area:1/1}',
            '.memory-match-setting{display:flex;align-items:center;gap:7px;margin-top:14px;font-size:12px;color:var(--text-secondary)}',
            '.memory-match-setting input{accent-color:var(--accent-color)}'
        ].join('\n');
        document.head.append(style);

        modal = document.createElement('div');
        modal.id = 'memory-match-modal';
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'memory-match-title');
        modal.innerHTML = '<div class="modal-content memory-match-shell"><div class="memory-match-head"><h2 id="memory-match-title">一起翻牌</h2><button type="button" data-action="close" aria-label="关闭">×</button></div><div id="memory-match-body"></div></div>';
        body = modal.querySelector('#memory-match-body');
        modal.addEventListener('click', handleClick);
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        });
        modal.addEventListener('change', event => {
            if (event.target.id !== 'memory-match-auto') return;
            invites.enabled = event.target.checked;
            if (invites.enabled && invites.next <= Date.now()) invites.next = nextInvite('initial');
            if (!invites.enabled) invites.retry = invites.retryUntil = 0;
            saveInvites();
        });
        document.body.append(modal);
    }

    function actionButton(action, text, primary = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = action;
        button.textContent = text;
        if (primary) button.className = 'memory-match-primary';
        return button;
    }

    function showPrompt(text, buttons, withSetting = false) {
        body.replaceChildren();
        const panel = document.createElement('div');
        panel.className = 'memory-match-menu';
        const message = document.createElement('p');
        message.textContent = text;
        const actions = document.createElement('div');
        actions.className = 'memory-match-actions';
        actions.append(...buttons);
        panel.append(message, actions);
        body.append(panel);
        if (withSetting) {
            const setting = document.createElement('label');
            setting.className = 'memory-match-setting';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = 'memory-match-auto';
            input.checked = invites.enabled;
            setting.append(input, '允许 TA 主动邀请');
            panel.append(setting);
        }
        return panel;
    }

    function showMenu() {
        mode = 'menu';
        const solo = actionButton('solo', '自己玩');
        solo.disabled = selectedMode === 'race';
        const panel = showPrompt(modes[selectedMode].hint, [actionButton('invite', '邀请他', true), solo], true);
        const selector = document.createElement('div');
        selector.className = 'memory-match-actions';
        selector.setAttribute('role', 'group');
        selector.setAttribute('aria-label', '选择翻牌模式');
        for (const [key, rules] of Object.entries(modes)) {
            const button = actionButton('select-mode', rules.name);
            button.className = 'memory-match-mode';
            button.dataset.mode = key;
            button.setAttribute('aria-pressed', String(key === selectedMode));
            const size = document.createElement('small');
            size.textContent = rules.columns + '×' + rules.columns;
            button.append(size);
            selector.append(button);
        }
        panel.prepend(selector);
        panel.append(actionButton('history', '最近记录'));
    }

    function showHistory() {
        mode = 'history';
        body.replaceChildren();
        const view = document.createElement('div');
        view.className = 'memory-match-history-view';
        const list = document.createElement('ul');
        list.className = 'memory-match-history';
        if (!invites.history.length) {
            const empty = document.createElement('li');
            empty.textContent = '还没有完成的对局。';
            list.append(empty);
        }
        for (const round of invites.history) {
            const item = document.createElement('li');
            const heading = document.createElement('small');
            heading.textContent = (modes[round.mode]?.name || '翻牌') + ' · ' + (round.won ? '胜利' : '失败') + ' · ' + (round.solo ? '单人' : '一起玩');
            const reply = document.createElement('p');
            reply.textContent = (round.partner || label()) + '：' + round.reply;
            item.append(heading, reply);
            list.append(item);
        }
        view.append(actionButton('menu', '返回翻牌'), list);
        body.append(view);
    }

    function open() {
        if (!useSession()) return;
        mount();
        if (isOpen()) return;
        showMenu();
        showModal(modal, body.querySelector('[aria-pressed="true"]'));
    }

    function close() {
        clearSteps();
        game = null;
        completedRounds = 0;
        mode = '';
        if (modal && isOpen()) hideModal(modal);
        if (document.activeElement && modal?.contains(document.activeElement)) $('chat-media-toggle')?.focus();
    }

    function clearSteps() {
        outgoingDeadline = 0;
        stepTimers.forEach(timer => clearTimeout(timer));
        stepTimers.clear();
    }

    function runLater(callback, delay, lane = 'main') {
        clearTimeout(stepTimers.get(lane));
        const key = sessionKey;
        const timer = setTimeout(() => {
            stepTimers.delete(lane);
            if (!isOpen() || !useSession() || key !== sessionKey) return;
            callback();
        }, delay);
        stepTimers.set(lane, timer);
    }

    function deferRegularInvite() {
        invites.next = nextInvite('regular');
        saveInvites();
    }

    function expireOutgoingInvite() {
        if (mode !== 'waiting' || !outgoingDeadline || Date.now() < outgoingDeadline) return false;
        clearSteps();
        mode = 'reply';
        showPrompt('邀请已过时，' + label() + ' 没有回应。', [actionButton('close', '好')]);
        return true;
    }

    function invitePartner() {
        if (mode === 'waiting' || mode === 'incoming') return;
        const replay = mode === 'result';
        if (!replay || !game.offer) completedRounds = 0;
        const chosenMode = selectedMode;
        invites.retry = invites.retryUntil = 0;
        deferRegularInvite();
        mode = 'waiting';
        outgoingDeadline = Date.now() + outgoingExpiry;
        showPrompt('在等 ' + label() + ' 回应…', []);
        runLater(expireOutgoingInvite, outgoingExpiry, 'invite-expiry');
        runLater(() => {
            if (expireOutgoingInvite() || mode !== 'waiting') return;
            const response = Math.random();
            const unavailable = partnerUnavailable();
            if (!unavailable && response >= .95) return;
            clearSteps();
            if (unavailable || response < .13) {
                mode = 'reply';
                const reply = replay ? '刚才玩得很开心，不过我想先歇一下。' : '今天状态不太好，这次就先不玩啦。';
                showPrompt(label() + '：' + reply, [actionButton('close', '好')]);
            } else if (response < .32) {
                mode = 'reply';
                const timing = syncInviteFrequency();
                if (invites.enabled && timing && Math.random() < .55) {
                    const now = Date.now();
                    invites.retry = now + minutes(...timing.retry);
                    invites.retryUntil = now + timing.retryWindow * minute;
                    invites.retryMode = chosenMode;
                    saveInvites();
                }
                showPrompt(label() + '：稍后再玩好吗？', [actionButton('close', '好')]);
            } else {
                startGame(chosenMode, false);
            }
        }, 850);
    }

    function checkInvite() {
        if (!useSession() || document.hidden) return;
        if (isOpen() && expireOutgoingInvite()) return;
        const timing = syncInviteFrequency();
        if (!invites.enabled || !timing) return;
        if (document.body.dataset.hsPage !== 'chat') return;
        const now = Date.now();
        if (invites.retryUntil && now > invites.retryUntil) {
            invites.retry = invites.retryUntil = 0;
            saveInvites();
        }
        const retry = invites.retry > 0 && now >= invites.retry;
        if (partnerUnavailable() || (!retry && now < invites.next) || mode === 'game') return;
        if (document.activeElement?.matches('input,textarea,select,[contenteditable=true]')) return;
        if (document.querySelector('#hs-banner,#qa-popup,#decision-notice,#incoming-letter-popup,#envelope-reply-popup,dialog[open]')) return;
        if ([...document.querySelectorAll('.modal')].some(item => getComputedStyle(item).display !== 'none')) return;
        incomingMode = retry ? invites.retryMode : pick(Object.keys(modes));
        invites.retry = invites.retryUntil = 0;
        deferRegularInvite();
        mount();
        mode = 'incoming';
        showPrompt(label() + (retry ? '：现在有空啦，一起玩' : ' 想和你一起玩') + modes[incomingMode].name + '。', [
            actionButton('accept', '接受', true),
            actionButton('close', '拒绝')
        ]);
        showModal(modal, body.querySelector('[data-action="accept"]'));
    }

    function shuffle(list) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    function startGame(key, solo) {
        const rules = modes[key];
        selectedMode = key;
        const first = !solo && key !== 'race' && Math.random() < .5 ? 'partner' : 'me';
        const images = shuffle([...new Set(stickerLibrary.filter(src => typeof src === 'string' && src.trim()))]).slice(0, rules.pairs);
        const faces = fallbackFaces.slice(0, rules.pairs).map((symbol, pair) => ({pair, symbol, image: images[pair]}));
        const board = () => ({
            cards: shuffle(faces.flatMap(face => [{face, matched:false},{face, matched:false}])),
            seen: new Map(), opened: [], misses: 0, pairs: 0
        });
        game = {
            ...board(), key, rules, solo, turn: first,
            opponent: key === 'race' ? board() : null,
            preview: Boolean(rules.previewMs), locked: Boolean(rules.previewMs), status: ''
        };
        mode = 'game';
        if (game.preview) game.status = '先看 4 秒，记住相同牌的位置。';
        renderGame();
        if (!game.preview) {
            beginTurn();
            return;
        }
        // 预览时 TA 只记住一部分牌，之后再靠实际翻牌补充记忆。
        if (!solo) {
            const partnerBoard = game.opponent || game;
            const memorySize = game.opponent ? 12 : 10;
            for (const index of shuffle(partnerBoard.cards.map((_, index) => index)).slice(0, memorySize)) {
                partnerBoard.seen.set(index, partnerBoard.cards[index].face.pair);
            }
        }
        runLater(() => {
            game.preview = false;
            game.locked = false;
            beginTurn();
            if (game.opponent) beginRaceOpponent();
        }, rules.previewMs);
    }

    function renderGame() {
        body.innerHTML = '<div id="memory-match-round"><div class="memory-match-stats"><span id="memory-match-pairs"></span><span id="memory-match-chances"></span></div><p id="memory-match-status" class="memory-match-status" role="status"></p></div>';
        const round = $('memory-match-round');
        const playerGrid = makeGrid(game, false);
        if (game.opponent) {
            round.className = 'memory-match-race';
            const partnerSide = document.createElement('section');
            const playerSide = document.createElement('section');
            partnerSide.className = playerSide.className = 'memory-match-race-side';
            const activity = document.createElement('p');
            activity.id = 'memory-match-race-activity';
            activity.className = 'memory-match-status';
            activity.setAttribute('role','status');
            partnerSide.append(raceProgressRow('partner',label()),activity,makeGrid(game.opponent,true));
            playerSide.append(raceProgressRow('player','你'),$('memory-match-status'),playerGrid);
            round.replaceChildren(partnerSide,playerSide);
            updateOpponentBoard();
        } else round.append(playerGrid);
        updateGame();
    }

    function makeGrid(board, spectator) {
        const grid = document.createElement('div');
        grid.className = 'memory-match-grid';
        grid.id = spectator ? 'memory-match-partner-grid' : 'memory-match-player-grid';
        grid.setAttribute('role','group');
        const owner = spectator ? label() + ' 的牌面' : '你的牌面';
        grid.setAttribute('aria-label', owner + '，共 ' + board.cards.length + ' 张牌');
        grid.dataset.mode = game.key;
        grid.style.setProperty('--memory-match-columns', game.rules.columns);
        board.cards.forEach((_,index) => {
            const cell = spectator ? document.createElement('div') : actionButton('flip', '');
            if (spectator) cell.setAttribute('role','img');
            else cell.dataset.index = index;
            cell.className = 'memory-match-card';
            cell.append(document.createElement('span'));
            grid.append(cell);
        });
        return grid;
    }

    function raceProgressRow(id, name) {
        const row = document.createElement('div');
        row.className = 'memory-match-racer';
        row.innerHTML = '<div class="memory-match-racer-head"><strong></strong><span data-count></span></div><progress></progress>';
        row.id = 'memory-match-racer-' + id;
        row.querySelector('strong').textContent = name;
        row.querySelector('progress').setAttribute('aria-label', name + ' 的配对进度');
        return row;
    }

    function showHearts(container, remaining, total) {
        container.className = 'memory-match-hearts';
        container.setAttribute('role','img');
        container.setAttribute('aria-label','剩余 ' + remaining + ' 颗红心');
        while (container.children.length < total) {
            const heart = document.createElement('span');
            heart.setAttribute('aria-hidden','true');
            container.append(heart);
        }
        [...container.children].forEach((heart,index) => {
            heart.textContent = index < remaining ? '♥' : '♡';
            heart.classList.toggle('is-spent', index >= remaining);
        });
    }

    function updateRaceProgress() {
        const {pairs} = game.rules;
        for (const [id, board] of [['player',game],['partner',game.opponent]]) {
            const row = $('memory-match-racer-' + id);
            row.querySelector('[data-count]').textContent = board.pairs + ' / ' + pairs + ' 对';
            const progress = row.querySelector('progress');
            progress.max = pairs;
            progress.value = board.pairs;
        }
        $('memory-match-race-activity').textContent = game.opponent.status || (label() + ' 正在记牌…');
    }

    function updateGame() {
        if (game.opponent) updateRaceProgress();
        else {
            $('memory-match-pairs').textContent = '已配对 ' + game.pairs + ' / ' + game.rules.pairs;
            const chances = $('memory-match-chances');
            chances.hidden = game.rules.chances === null;
            if (!chances.hidden) showHearts(chances, game.rules.chances - game.misses, game.rules.chances);
        }
        $('memory-match-status').textContent = game.status;
        updateCards($('memory-match-player-grid'),game,game.preview,!game.locked && game.turn === 'me');
    }

    function updateOpponentBoard() {
        updateCards($('memory-match-partner-grid'),game.opponent,false,false);
    }

    function updateCards(grid, board, preview, playable) {
        Array.from(grid.children).forEach((cell,index) => {
            const card = board.cards[index];
            const visible = preview || card.matched || board.opened.includes(index);
            cell.classList.toggle('is-face-up', visible);
            cell.classList.toggle('is-matched', card.matched);
            if (cell.tagName === 'BUTTON') cell.setAttribute('aria-disabled', String(visible || !playable));
            cell.setAttribute('aria-label', '第 ' + (index+1) + ' 张，' + (visible ? ('图案 ' + (card.face.pair+1) + (card.matched ? '，已配对' : '')) : '未翻开'));
            const symbol = cell.firstChild;
            symbol.textContent = visible ? card.face.symbol : '✦';
            let image = cell.querySelector('img');
            if (visible && card.face.image && !image && !card.face.imageFailed) {
                image = new Image();
                image.alt = '';
                image.draggable = false;
                image.addEventListener('error', () => {
                    card.face.imageFailed = true;
                    image.remove();
                    symbol.hidden = false;
                }, {once:true});
                image.addEventListener('load', () => { symbol.hidden = !image.hidden; }, {once:true});
                image.src = card.face.image;
                cell.append(image);
            }
            if (image) image.hidden = !visible;
            symbol.hidden = Boolean(visible && image?.complete && image.naturalWidth);
        });
    }

    function beginTurn(previous = '') {
        const partner = game.turn === 'partner';
        game.status = previous + (partner ? label() + ' 正在找牌…' : '轮到你了，翻两张牌。');
        updateGame();
        if (partner) runLater(partnerFlip, thinkingTime());
    }

    function thinkingTime() {
        if (game.opponent) return Math.round(1350 + Math.random() * 1300);
        return Math.round(1500 + Math.random() * 4300);
    }

    function secondChoiceTime() {
        return game.opponent ? Math.round(650 + Math.random() * 400) : Math.round(900 + Math.random() * 500);
    }

    function choosePartnerCard(board, rememberChance) {
        const available = board.cards.map((_,index) => index).filter(index => !board.cards[index].matched && !board.opened.includes(index));
        let remembered = [];
        if (board.opened.length) {
            const first = board.seen.get(board.opened[0]);
            remembered = available.filter(index => board.seen.get(index) === first);
        } else {
            const known = available.filter(index => board.seen.has(index));
            remembered = known.filter(index => known.some(other => other !== index && board.seen.get(other) === board.seen.get(index)));
        }
        // TA 只用自己的记忆找牌，竞速时也会偶尔把位置记错。
        if (remembered.length && Math.random() < rememberChance) return pick(remembered);
        if (board === game.opponent) {
            if (remembered.length) {
                const mistaken = available.filter(index => !remembered.includes(index));
                if (mistaken.length) return pick(mistaken);
            }
            const unseen = available.filter(index => !board.seen.has(index));
            if (unseen.length) return pick(unseen);
        }
        return pick(available);
    }

    function partnerFlip() {
        flip(choosePartnerCard(game, .87));
        if (game.opened.length === 1) runLater(partnerFlip, secondChoiceTime());
    }

    function beginRaceOpponent(previous = '') {
        game.opponent.status = previous + label() + ' 正在想下一张。';
        updateRaceProgress();
        updateOpponentBoard();
        runLater(raceOpponentFlip, thinkingTime(), 'partner');
    }

    function raceOpponentFlip() {
        const board = game.opponent;
        reveal(board, choosePartnerCard(board, .90));
        updateOpponentBoard();
        if (board.opened.length === 1) {
            board.status = label() + ' 已翻开一张，正在找另一张。';
            updateRaceProgress();
            runLater(raceOpponentFlip, secondChoiceTime(), 'partner');
            return;
        }
        board.status = label() + ' 翻开了第二张。';
        updateRaceProgress();
        runLater(resolveRaceOpponentPair, 550, 'partner');
    }

    function resolveRaceOpponentPair() {
        const board = game.opponent;
        const matched = scorePair(board);
        if (board.pairs === game.rules.pairs) {
            finish(false);
            return;
        }
        beginRaceOpponent(matched ? '配对成功。' : '这次记错了。');
    }

    function reveal(board, index) {
        board.opened.push(index);
        board.seen.set(index, board.cards[index].face.pair);
    }

    function flip(index) {
        const card = game.cards[index];
        if (!card || game.locked || card.matched || game.opened.includes(index)) return;
        reveal(game, index);
        if (game.opened.length === 2) {
            game.locked = true;
            updateGame();
            runLater(resolvePair, game.key === 'random' ? 620 : 800);
        } else {
            if (game.turn === 'me') game.status = '再翻一张，找相同的图案。';
            updateGame();
        }
    }

    function scorePair(board) {
        const [first, second] = board.opened.map(index => board.cards[index]);
        const matched = first.face.pair === second.face.pair;
        if (matched) {
            first.matched = second.matched = true;
            board.pairs++;
        } else board.misses++;
        board.opened = [];
        return matched;
    }

    function resolvePair() {
        const matched = scorePair(game);
        const outOfChances = game.rules.chances !== null && game.misses >= game.rules.chances;
        if (game.pairs === game.rules.pairs || outOfChances) {
            finish(game.pairs === game.rules.pairs);
            return;
        }
        const previous = matched ? '配对成功。' : (game.turn === 'partner' ? label() + ' 记错了。' : '这两张不一样。');
        game.locked = false;
        game.turn = game.solo || game.opponent || game.turn === 'partner' ? 'me' : 'partner';
        beginTurn(previous);
    }

    function finish(won) {
        if (mode !== 'game') return;
        clearSteps();
        completedRounds++;
        const partner = label();
        const reply = pick(won ? resultLines.win : resultLines.loss);
        const offer = !game.solo && invites.enabled && window.GameInvites.timing() &&
            !partnerUnavailable() && completedRounds < 3 && Math.random() < .55;
        invites.history = [{mode:game.key,solo:game.solo,won,partner,reply}, ...invites.history].slice(0,8);
        saveInvites();
        game.offer = offer;
        mode = 'result';
        if (!game.solo) {
            const user = settings.myName || '我';
            const outcome = game.key === 'race' ? (won ? user : partner) + '赢了'
                : won ? user + '和' + partner + '赢了' : '这局没能配对成功';
            const summary = { mode: game.rules.name, outcome, partner, reply, won };
            addMessage({
                id: Date.now() + Math.random(),
                sender: 'system',
                type: 'memory-match-result',
                timestamp: new Date(),
                text: [summary.mode, outcome, partner + '：' + reply].join('\n'),
                memoryMatchResult: summary
            });
        }

        const result = document.createElement('div');
        result.className = 'memory-match-result';
        const heading = document.createElement('strong');
        heading.dataset.won = String(won);
        heading.textContent = won ? '胜利' : '失败';
        const line = document.createElement('p');
        line.className = 'memory-match-result-reply';
        line.textContent = partner + '：' + reply;
        result.append(heading, line);
        if (offer) {
            const invitation = document.createElement('p');
            invitation.className = 'memory-match-offer';
            invitation.textContent = partner + ' 想再和你玩一局。';
            result.append(invitation);
        }
        const actions = document.createElement('div');
        actions.className = 'memory-match-actions';
        actions.append(actionButton('replay','再来一局',true),actionButton('close','返回聊天'));
        result.append(actions);
        body.replaceChildren(result);
        actions.firstElementChild.focus();
    }

    function handleClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            if (event.target === modal && mode !== 'game') close();
            return;
        }
        if (!useSession() || !isOpen()) return;
        switch (button.dataset.action) {
            case 'close': close(); break;
            case 'select-mode':
                selectedMode = button.dataset.mode;
                showMenu();
                body.querySelector('[aria-pressed="true"]').focus();
                break;
            case 'history': showHistory(); break;
            case 'menu': showMenu(); break;
            case 'invite': if (mode === 'menu') invitePartner(); break;
            case 'solo':
                if (mode === 'menu') {
                    completedRounds = 0;
                    startGame(selectedMode, true);
                }
                break;
            case 'accept':
                if (mode === 'incoming') {
                    completedRounds = 0;
                    startGame(incomingMode, false);
                }
                break;
            case 'replay':
                if (mode === 'result') {
                    if (game.solo) startGame(game.key, true);
                    else invitePartner();
                }
                break;
            case 'flip': if (mode === 'game' && game.turn === 'me') flip(Number(button.dataset.index)); break;
        }
    }

    $('chat-memory-match-btn')?.addEventListener('click', open);
    window.addEventListener('game-invite-frequency-change', () => {
        if (useSession()) syncInviteFrequency();
    });
    setInterval(checkInvite, 8000);
    document.addEventListener('visibilitychange', checkInvite);
})();

