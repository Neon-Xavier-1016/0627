/* ============================================================
 * music-invite.js v16
 * 新增：
 *  - TA 随机切歌（默认 5% 概率，可在 settings.musicSwitchProb 调整）
 *  - 尊重 settings.musicInviteEnabled 开关（关闭后永不邀请）
 *  - 用户输入"听歌"关键词 → 8% 概率 TA 邀请听歌
 * 修复：
 *  - 按钮虚线在主题切换时闪烁（transition 排除 border-color）
 * 保留 v14 修复：
 *  - safePlay 吞掉 AbortError
 *  - 预订仅一起听时触发
 *  - ended 后 150ms 覆盖 nextSong 播放预订
 * ============================================================ */
(function () {
'use strict';
if (window.__musicInviteLoaded) return;
window.__musicInviteLoaded = true;

/* ───────────── 工具 ───────────── */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const rand = a => a[Math.floor(Math.random() * a.length)];
const randRange = (min, max) => min + Math.random() * (max - min);

function S() {
  const s = (window.settings || (typeof settings !== 'undefined' ? settings : {}));
  if (!window.settings) window.settings = s;
  return s;
}
const partnerName = () => S().partnerName || 'TA';
const myName = () => S().myName || '我';

function getMessages() {
  if (window.messages && Array.isArray(window.messages)) return window.messages;
  if (typeof messages !== 'undefined' && Array.isArray(messages)) return messages;
  return null;
}
function saveNow() {
  try { if (typeof throttledSaveData === 'function') throttledSaveData(); } catch(e) {}
}
function addMsg(m) {
  if (typeof window.addMessage === 'function') return window.addMessage(m);
  try { return addMessage(m); } catch(e) { return null; }
}
function sysMsg(text) {
  return addMsg({ id: Date.now() + Math.random(), sender: 'system', type: 'system',
    text, timestamp: new Date() });
}
function inMsg(text, isMe) {
  return addMsg({ id: Date.now() + Math.random(),
    sender: isMe ? 'user' : partnerName(),
    type: 'normal', text, timestamp: new Date(),
    status: isMe ? 'sent' : 'received' });
}

/* ───────────── 安全播放 ───────────── */
function safePlay(a) {
  if (!a) return;
  if (a.__miLastPlay && typeof a.__miLastPlay.catch === 'function') {
    a.__miLastPlay.catch(() => {});
  }
  let p;
  try { p = a.play(); } catch(e) { return; }
  if (p && typeof p.catch === 'function') {
    a.__miLastPlay = p;
    p.catch(() => {});
  }
}

/* ───────────── 全局状态 ───────────── */
let listeningWith = null;
let _reservedTrack = null;
let _taSwitchTimer = null;   // 🆕 TA 随机切歌定时器

const cooldown = {};
const cdOk = (k, ms) => !cooldown[k] || Date.now() - cooldown[k] >= ms;
const setCD = k => { cooldown[k] = Date.now(); };

/* ───────────── 歌池 ───────────── */
let _songs = [];
let _loading = false;
async function loadSongs() {
  if (_loading) return _songs;
  _loading = true;
  try {
    if (typeof localforage === 'undefined') return _songs;
    const keys = await localforage.keys();
    const key = keys.find(k => /customSongs$/.test(k));
    if (!key) return _songs;
    const arr = await localforage.getItem(key);
    if (Array.isArray(arr)) {
      _songs = arr.filter(s => s && s.url && /^https?:/i.test(s.url))
        .map(s => ({ name: s.title || '未知歌曲', url: s.url }));
    }
  } catch(e) {}
  finally { _loading = false; }
  return _songs;
}
loadSongs();

/* ───────────── 播放器控制 ───────────── */
function openPlayer() {
  const player = $('player');
  if (!player) return;
  player.classList.add('visible');
  if (player.classList.contains('collapsed')) player.classList.remove('collapsed');
  const fv = player.querySelector('.full-view');
  if (fv) fv.style.display = '';
  const mv = $('mini-view');
  if (mv) mv.style.display = '';
}

function playUrl(url, name) {
  const a = $('audio');
  if (!a) return false;
  try {
    a.src = url;
    safePlay(a);
    const t = $('music-title');
    if (t && name) t.textContent = name;
    openPlayer();
    setTimeout(openPlayer, 80);
    return true;
  } catch(e) { return false; }
}

function playUrlDirect(url, name) {
  const a = $('audio');
  if (!a) return false;
  try {
    a.src = url;
    safePlay(a);
    const t = $('music-title');
    if (t && name) t.textContent = name;
    openPlayer();
    if (listeningWith) listeningWith.name = name;
    return true;
  } catch(e) { return false; }
}

/* ───────────── TA 随机切歌 ───────────── */
function scheduleTaSwitch() {
  if (_taSwitchTimer) { clearTimeout(_taSwitchTimer); _taSwitchTimer = null; }
  if (!listeningWith) return;
  // 随机延迟：30 秒 ~ 3 分钟后检查一次
  const delay = randRange(30 * 1000, 3 * 60 * 1000);
  _taSwitchTimer = setTimeout(() => {
    _taSwitchTimer = null;
    maybeTaSwitchSong();
  }, delay);
}

async function maybeTaSwitchSong() {
  if (!listeningWith) return;

  // 冷却：3 分钟内最多切一次
  if (!cdOk('taSwitch', 3 * 60 * 1000)) {
    scheduleTaSwitch();
    return;
  }

  await loadSongs();
  if (!_songs.length) return;

  // 概率（默认 5%，可在 settings.musicSwitchProb 调整）
  const prob = S().musicSwitchProb ?? 5;
  if (Math.random() * 100 >= prob) {
    scheduleTaSwitch();
    return;
  }

  setCD('taSwitch');

  const curName = ($('music-title')?.textContent || '').trim();
  let pool = _songs.filter(s => s.name !== curName);
  if (!pool.length) pool = _songs;
  const track = rand(pool);

  const msgs = [
    '换一首吧，这首听腻了。',
    '我给你换首歌。',
    '这首不太想听了，切一首。',
    '来，换首别的听听。',
    '让我切一首。'
  ];
  inMsg(rand(msgs), false);

  setTimeout(() => {
    playUrlDirect(track.url, track.name);
    if (listeningWith) listeningWith.name = track.name;
    sysMsg('🎧 ' + partnerName() + ' 切到了《' + track.name + '》');
    scheduleTaSwitch(); // 切完再安排下一次
  }, 800 + Math.random() * 500);
}

/* ───────────── 一起听状态 ───────────── */
function setListening(on, trackName, force) {
  if (on) {
    if (listeningWith && listeningWith.timer) clearTimeout(listeningWith.timer);
    listeningWith = { name: trackName, timer: null };
    const exitDelay = force
      ? 3000
      : randRange(10 * 60 * 1000, 40 * 60 * 1000);
    listeningWith.timer = setTimeout(() => {
      if (listeningWith) {
        sysMsg('🎧 ' + partnerName() + ' 离开了一起听');
        setListening(false);
      }
    }, exitDelay);

    scheduleTaSwitch();                    // ✅ 开始一起听时安排切歌
  } else {
    if (listeningWith && listeningWith.timer) clearTimeout(listeningWith.timer);
    listeningWith = null;
    _reservedTrack = null;

    if (_taSwitchTimer) {                  // ✅ 结束一起听时清掉切歌定时器
      clearTimeout(_taSwitchTimer);
      _taSwitchTimer = null;
    }
  }
  updateBadge();
}

function updateBadge() {
  const fv = document.querySelector('.full-view');
  if (!fv) return;
  const existing = $('mi-listening-badge');
  if (!listeningWith) {
    if (existing) try { existing.remove(); } catch(e) {}
    return;
  }
  if (existing) return;
  const b = document.createElement('div');
  b.id = 'mi-listening-badge';
  b.className = 'mi-listening-badge';
  b.innerHTML = '<span class="mi-listening-dot"></span>正在和 ' + esc(partnerName()) + ' 一起听';
  const progress = fv.querySelector('.progress-wrapper');
  if (progress && progress.parentNode) {
    progress.parentNode.insertBefore(b, progress);
  } else {
    const ti = fv.querySelector('.track-info');
    if (ti) ti.parentNode.insertBefore(b, ti.nextSibling); else fv.appendChild(b);
  }
}

/* ───────────── 卡片 HTML ───────────── */
let cardSeq = 0;

function cardHTML(track, fromMe, state, tagText, fixedCid) {
  const cid = fixedCid || ('mi_' + Date.now().toString(36) + (++cardSeq));
  const who = fromMe ? myName() : partnerName();
  const action = fromMe ? '邀请你一起听' : '想和你一起听';
  const tagHTML = tagText ? '<div class="mi-corner-tag">' + esc(tagText) + '</div>' : '';
  let footer = '';
  if (state === 'reply') {
    footer = '<div class="mi-btns">'
      + '<button type="button" class="mi-btn mi-reject">拒绝</button>'
      + '<button type="button" class="mi-btn mi-later">稍后</button>'
      + '<button type="button" class="mi-btn mi-join mi-primary">接受</button>'
      + '</div>';
  } else if (state === 'pending') {
    footer = '<div class="mi-pending"><span class="mi-pending-dot"></span>等待 ' + esc(partnerName()) + ' 回应…</div>';
  } else if (state === 'done-ta') {
    footer = '<div class="mi-state-tag mi-state-done">🎧 ' + esc(partnerName()) + ' 接受了</div>';
  } else if (state === 'later-ta') {
    footer = '<div class="mi-state-tag">' + esc(partnerName()) + ' 稍后听</div>';
  } else if (state === 'reject-ta') {
    footer = '<div class="mi-state-tag">' + esc(partnerName()) + ' 拒绝了</div>';
  } else if (state === 'done-me') {
    footer = '<div class="mi-state-tag mi-state-done">🎧 已一起听</div>';
  } else if (state === 'later-me') {
    footer = '<div class="mi-state-tag">已稍后</div>';
  } else if (state === 'reject-me') {
    footer = '<div class="mi-state-tag">已拒绝</div>';
  }
  const extraCls = (state === 'done-ta' || state === 'done-me') ? ' mi-done'
                 : (state === 'later-ta' || state === 'later-me') ? ' mi-skip'
                 : (state === 'reject-ta' || state === 'reject-me') ? ' mi-rejected'
                 : '';
  const doneAttr = (state === 'reply') ? '' : ' data-mi-done="1"';
  return '<div class="mi-card' + extraCls + '"'
    + ' data-mi-id="' + cid + '"'
    + ' data-mi-url="' + esc(track.url) + '"'
    + ' data-mi-name="' + esc(track.name) + '"'
    + ' data-mi-from="' + (fromMe ? 'me' : 'ta') + '"'
    + doneAttr
    + '>'
    + tagHTML
    + '<div class="mi-head"><span class="mi-ico">♪</span>'
    +   '<span class="mi-title">' + esc(who) + ' ' + action + '</span></div>'
    + '<div class="mi-track"><span class="mi-q">《</span>'
    +   '<span class="mi-track-name">' + esc(track.name) + '</span><span class="mi-q">》</span></div>'
    + footer
    + '</div>';
}

function reserveCardHTML(track, cid) {
  return '<div class="mi-card mi-reserve"'
    + ' data-mi-id="' + cid + '"'
    + ' data-mi-url="' + esc(track.url) + '"'
    + ' data-mi-name="' + esc(track.name) + '"'
    + ' data-mi-reserve="1">'
    + '<div class="mi-head"><span class="mi-ico">♪</span>'
    +   '<span class="mi-title">' + esc(partnerName()) + ' 预订了下一首</span></div>'
    + '<div class="mi-track"><span class="mi-q">《</span>'
    +   '<span class="mi-track-name">' + esc(track.name) + '</span><span class="mi-q">》</span></div>'
    + '<div class="mi-state-tag mi-reserve-tip">将在当前歌结束后自动播放</div>'
    + '</div>';
}

/* ───────────── 卡片状态持久化 ───────────── */
function persistCardState(cid, fromMe, track, state, tagText) {
  const arr = getMessages();
  if (!arr) return;
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i];
    if (m && m.type === 'system' && typeof m.text === 'string'
        && m.text.indexOf('data-mi-id="' + cid + '"') !== -1) {
      m.text = cardHTML(track, fromMe, state, tagText || '', cid);
      saveNow();
      return;
    }
  }
}

function updateCardDom(card, state) {
  if (!card) return;
  card.dataset.miDone = '1';
  const footer = card.querySelector('.mi-btns, .mi-pending, .mi-state-tag');
  if (footer) {
    let html = '';
    if (state === 'done-ta') html = '<div class="mi-state-tag mi-state-done">🎧 ' + esc(partnerName()) + ' 接受了</div>';
    else if (state === 'later-ta') html = '<div class="mi-state-tag">' + esc(partnerName()) + ' 稍后听</div>';
    else if (state === 'reject-ta') html = '<div class="mi-state-tag">' + esc(partnerName()) + ' 拒绝了</div>';
    else if (state === 'done-me') html = '<div class="mi-state-tag mi-state-done">🎧 已一起听</div>';
    else if (state === 'later-me') html = '<div class="mi-state-tag">已稍后</div>';
    else if (state === 'reject-me') html = '<div class="mi-state-tag">已拒绝</div>';
    if (html) footer.outerHTML = html;
  }
  card.classList.remove('mi-done', 'mi-skip', 'mi-rejected');
  if (state === 'done-ta' || state === 'done-me') card.classList.add('mi-done');
  else if (state === 'later-ta' || state === 'later-me') card.classList.add('mi-skip');
  else if (state === 'reject-ta' || state === 'reject-me') card.classList.add('mi-rejected');
}

/* ───────────── TA 邀请我 ───────────── */
async function taInviteMe(isReInvite, force) {
  // ✅ 关键：开关关闭时，非 force 永不邀请
  if (!force && S().musicInviteEnabled === false) return null;

  await loadSongs();
  if (!_songs.length) return null;
  if (!force && !cdOk('taInvite', 8 * 60 * 1000)) return null;
  if (!force) setCD('taInvite');
  const track = rand(_songs);
  sysMsg(cardHTML(track, false, 'reply', isReInvite ? '再次邀请' : ''));
  return track;
}

/* ───────────── 我邀请 TA ───────────── */
function meInviteTa() {
  // ✅ 已经在一起听 → 提示并中止
  if (listeningWith) {
    if (typeof showNotification === 'function')
      showNotification(partnerName() + '已经在一起听歌了', 'info', 2000);
    return;
  }

  const a = $('audio');
  if (!a || !a.src) {
    if (typeof showNotification === 'function')
      showNotification('请先播放一首歌再邀请', 'info', 2000);
    return;
  }
  const name = ($('music-title')?.textContent || '').trim() || '这首歌';
  const track = { url: a.src, name };
  const cid = 'mi_' + Date.now().toString(36) + (++cardSeq);
  sysMsg(cardHTML(track, true, 'pending', '', cid));

  const delay = randRange(5 * 1000, 60 * 1000);
  setTimeout(() => taRespondToInvite(track, cid), delay);
}

function taRespondToInvite(track, cid, forceState) {
  const s = S();
  const pA = (s.musicAcceptProb ?? 70) / 100;
  const pL = (s.musicLaterProb  ?? 20) / 100;
  let state;
  if (forceState) state = forceState;
  else {
    const r = Math.random();
    state = r < pA ? 'accept' : r < pA + pL ? 'later' : 'reject';
  }
  const finalState = state === 'accept' ? 'done-ta'
                    : state === 'later' ? 'later-ta' : 'reject-ta';

  const card = document.querySelector('.mi-card[data-mi-id="' + cid + '"]');
  if (card) updateCardDom(card, finalState);
  persistCardState(cid, true, track, finalState);

  const pools = {
    accept: ['好呀，一起听。', '嗯，我陪你听。', '好啊，正想听这首。'],
    later:  ['等一下，待会儿听。', '稍后再听吧。', '先忙会儿，稍后。'],
    reject: ['这次先不听了。', '改天吧。', '换个时间吧。']
  };
  const pool = (typeof window.getInteractPool === 'function')
    ? window.getInteractPool('一起听·' + state, pools[state]) : pools[state];

  setTimeout(() => {
    inMsg(rand(pool), false);
    if (state === 'accept') {
      playUrl(track.url, track.name);
      setListening(true, track.name);
    } else if (state === 'later') {
      if (Math.random() < 0.6) {
        const laterDelay = randRange(2 * 60 * 1000, 15 * 60 * 1000);
        setTimeout(() => taJoinNow(track), laterDelay);
      }
    } else if (state === 'reject') {
      if (Math.random() < 0.3) {
        const rejoinDelay = randRange(5 * 60 * 1000, 30 * 60 * 1000);
        setTimeout(() => taJoinNow(track), rejoinDelay);
      }
    }
  }, 400 + Math.random() * 600);
}

function taJoinNow(track) {
  if (!track) return;
  if (listeningWith && listeningWith.name === track.name) return;
  inMsg('我也来陪你听。', false);
  setTimeout(() => {
    playUrl(track.url, track.name);
    setListening(true, track.name);
    sysMsg('🎧 ' + partnerName() + ' 加入了你一起听《' + track.name + '》');
  }, 700 + Math.random() * 500);
}

function maybeTaAutoJoin(track) {
  if (listeningWith) return;
  // 冷却从 15 分钟缩到 5 分钟，配合短延迟更合理
  if (!cdOk('autoJoin', 5 * 60 * 1000)) return;
  const prob = (S().musicAutoJoinProb ?? 5);   // 默认改成 5%
  if (Math.random() * 100 >= prob) return;
  setCD('autoJoin');

  // 延迟改为 10 秒 ~ 3 分钟，落在大多数歌的时长之内
  const delay = randRange(10 * 1000, 3 * 60 * 1000);
  setTimeout(() => {
    const a = $('audio');
    if (!a || a.paused) return;
    const curName = ($('music-title')?.textContent || '').trim();
    if (curName !== track.name) return;   // 中途切歌就放弃
    taJoinNow(track);
  }, delay);
}

/* ───────────── TA 预订下一首 ───────────── */
async function taReserveNext(force) {
  await loadSongs();
  if (!_songs.length) return null;
  if (!force && !listeningWith) return null;

  if (!force) {
    if (!cdOk('reserve', 8 * 60 * 1000)) return null;
    const prob = S().musicReserveProb ?? 25;
    if (Math.random() * 100 >= prob) return null;
    setCD('reserve');
  }

  const curName = ($('music-title')?.textContent || '').trim();
  let pool = _songs.filter(s => s.name !== curName);
  if (!pool.length) pool = _songs;
  const track = rand(pool);

  const cid = 'mi_rsv_' + Date.now().toString(36) + (++cardSeq);
  _reservedTrack = { url: track.url, name: track.name, cid };

  sysMsg(reserveCardHTML(track, cid));
  if (typeof showNotification === 'function')
    showNotification(partnerName() + ' 预订了下一首：《' + track.name + '》', 'info', 3000);
  return track;
}

/* ───────────── 歌曲结束 → 播放预订 ───────────── */
function attachEndedListener() {
  const a = $('audio');
  if (!a || a.__miEndedHooked) return;
  a.__miEndedHooked = true;
  a.addEventListener('ended', function () {
    if (!_reservedTrack) return;
    const t = _reservedTrack;
    _reservedTrack = null;
    setTimeout(() => {
      playUrlDirect(t.url, t.name);
      document.querySelectorAll('.mi-card.mi-reserve:not([data-mi-done="1"])').forEach(c => {
        if (c.getAttribute('data-mi-url') === t.url) {
          c.dataset.miDone = '1';
          const tip = c.querySelector('.mi-reserve-tip');
          if (tip) { tip.textContent = '🎧 已自动播放'; tip.classList.add('mi-state-done'); }
        }
      });
      if (typeof showNotification === 'function')
        showNotification('播放TA预订的：《' + t.name + '》', 'info', 3000);
    }, 150);
  });
}

/* ───────────── 我响应 TA ───────────── */
function handleJoin(card) {
  const cid = card.getAttribute('data-mi-id');
  const url = card.getAttribute('data-mi-url');
  const name = card.getAttribute('data-mi-name') || '这首歌';
  const track = { url, name };
  openPlayer();
  const ok = playUrl(url, name);
  updateCardDom(card, 'done-me');
  persistCardState(cid, false, track, 'done-me');
  if (ok) {
    setListening(true, name);
    sysMsg('你接受了 ' + partnerName() + ' 的邀请，一起听《' + name + '》');
  } else sysMsg('播放失败');
}

function handleLater(card) {
  const cid = card.getAttribute('data-mi-id');
  const url = card.getAttribute('data-mi-url');
  const name = card.getAttribute('data-mi-name') || '这首歌';
  const track = { url, name };
  updateCardDom(card, 'later-me');
  persistCardState(cid, false, track, 'later-me');
  inMsg('那等下次再听吧。', false);
  if (Math.random() < 0.5) {
    const delay = randRange(2 * 60 * 1000, 15 * 60 * 1000);
    setTimeout(() => taInviteMe(true), delay);
  }
}

function handleReject(card) {
  const cid = card.getAttribute('data-mi-id');
  const url = card.getAttribute('data-mi-url');
  const name = card.getAttribute('data-mi-name') || '这首歌';
  const track = { url, name };
  updateCardDom(card, 'reject-me');
  persistCardState(cid, false, track, 'reject-me');
  inMsg('好的，那这次就算了。', false);
  if (Math.random() < 0.3) {
    const delay = randRange(5 * 60 * 1000, 30 * 60 * 1000);
    setTimeout(() => taInviteMe(true), delay);
  }
}

/* ───────────── 全局点击 ───────────── */
document.addEventListener('click', function (e) {
  const t = e.target;
  if (!t.closest) return;
  const c = t.closest('.mi-card');
  if (!c) return;

  if (c.dataset.miReserve === '1') {
    e.preventDefault(); e.stopPropagation();
    if (c.dataset.miDone === '1') return;
    const url = c.getAttribute('data-mi-url');
    const name = c.getAttribute('data-mi-name');
    if (url) playUrlDirect(url, name);
    c.dataset.miDone = '1';
    if (_reservedTrack && _reservedTrack.url === url) _reservedTrack = null;
    const tip = c.querySelector('.mi-reserve-tip');
    if (tip) { tip.textContent = '🎧 已播放'; tip.classList.add('mi-state-done'); }
    return;
  }

  if (c.dataset.miFrom !== 'ta' || c.dataset.miDone === '1') return;
  if (t.closest('.mi-join'))        { e.preventDefault(); e.stopPropagation(); handleJoin(c); }
  else if (t.closest('.mi-later'))  { e.preventDefault(); e.stopPropagation(); handleLater(c); }
  else if (t.closest('.mi-reject')) { e.preventDefault(); e.stopPropagation(); handleReject(c); }
}, true);

/* ───────────── ♪ 按钮 ───────────── */
function injectBtn() {
  if ($('mi-player-invite-btn')) return;
  const fv = document.querySelector('.full-view');
  if (!fv) return;
  const camera = $('upload-cover-btn');
  if (!camera || !camera.parentNode) return;

  const btn = document.createElement('button');
  btn.id = 'mi-player-invite-btn';
  btn.type = 'button';
  btn.className = 'mi-player-invite-btn';
  btn.title = '邀请TA一起听';
  btn.textContent = '♪';

  const handler = function (e) {
    e.preventDefault(); e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    try { meInviteTa(); } catch (err) { console.error('[music-invite]', err); }
    return false;
  };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
  btn.addEventListener('touchend', handler, { passive: false });
  camera.parentNode.appendChild(btn);
}

/* ───────────── audio.play 监听 ───────────── */
function attachPlayListener() {
  const a = $('audio');
  if (!a || a.__miHooked) return;
  a.__miHooked = true;
  a.addEventListener('play', function () {
    try {
      const url = a.src;
      if (!url || !/^https?:/i.test(url)) return;
      const name = ($('music-title')?.textContent || '').trim() || '这首歌';
      if (!listeningWith) maybeTaAutoJoin({ url, name });
      if (listeningWith) {
        setTimeout(() => { taReserveNext(); }, 1500 + Math.random() * 3000);
        scheduleTaSwitch();                // ✅ 每次开始播放都重新安排切歌
      }
    } catch(e) {}
  });
}

/* ───────────── 播放器关闭监听 ───────────── */
function attachPlayerCloseWatcher() {
  const player = $('player');
  if (!player || player.__miCloseHooked) return;
  player.__miCloseHooked = true;
  try {
    let closeTimer = null;
    const mo = new MutationObserver(() => {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        const visible = player.classList.contains('visible');
        if (!visible && listeningWith) {
          setListening(false);
          sysMsg('你关闭了播放器，一起听结束');
        }
      }, 600);
    });
    mo.observe(player, { attributes: true, attributeFilter: ['class'] });
  } catch(e) {}
}

/* ───────────── 关键词监听：用户输入"听歌" ───────────── */
function attachKeywordListeners() {
  const inp = $('message-input');
  const sendBtn = $('send-btn');
  if (!inp || !sendBtn || inp.__miKwHooked) return;
  inp.__miKwHooked = true;

  function checkKeyword() {
    try {
      const s = S();
      // 开关关闭时不触发
      if (s.musicInviteEnabled === false) return;
      const text = inp.value || '';
      if (!text || text.indexOf('听歌') === -1) return;

      // 关键词冷却 3 分钟，防止连续刷
      if (!cdOk('keywordInvite', 3 * 60 * 1000)) return;
      // 8% 概率
      if (Math.random() >= 0.08) return;
      setCD('keywordInvite');

      // 延迟 1.5-3.5 秒后 TA 发起邀请（force 绕过 taInvite 内部冷却）
      setTimeout(() => {
        taInviteMe(false, true);
      }, 1500 + Math.random() * 2000);
    } catch(e) {}
  }

  // 捕获阶段读取输入（在 sendMessage 清空输入框之前）
  sendBtn.addEventListener('click', checkKeyword, true);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) checkKeyword();
  }, true);
}

/* ───────────── 包装 simulateReply ───────────── */
function wrapReply() {
  if (typeof window.simulateReply !== 'function') return false;
  if (window.simulateReply.__miWrapped) return true;
  const orig = window.simulateReply;
  window.simulateReply = function () {
    const r = orig.apply(this, arguments);
    setTimeout(() => {
      try {
        const s = S();
        // ✅ 开关关闭时直接跳过
        if (s.musicInviteEnabled === false) return;
        const prob = (s.musicInviteProb ?? 8);
        const cdMs = (s.musicInviteCooldown ?? 10 * 60 * 1000);
        if (!cdOk('invite', cdMs)) return;
        if (Math.random() * 100 >= prob) return;
        setCD('invite');
        taInviteMe(false);
      } catch(e) {}
    }, 1800);
    return r;
  };
  window.simulateReply.__miWrapped = true;
  return true;
}

/* ───────────── 样式 ───────────── */
function injectStyles() {
  if ($('mi-styles')) return;
  const st = document.createElement('style');
  st.id = 'mi-styles';
  st.textContent = `
.system-message:has(.mi-card){padding:0;text-align:left;background:transparent;border:none;max-width:100%}
.mi-card{position:relative;display:flex;flex-direction:column;gap:10px;padding:16px 16px 14px;background:var(--secondary-bg,#fff);border:1px solid var(--border-color,rgba(0,0,0,.08));border-radius:16px;text-align:left;color:var(--text-primary,#222);width:280px;max-width:100%;margin:8px auto;box-shadow:0 3px 16px rgba(0,0,0,.06);box-sizing:border-box}
.mi-corner-tag{position:absolute;top:-8px;right:12px;font-size:10px;padding:2px 8px;border-radius:8px;background:var(--accent-color,#7c5cff);color:#fff;font-weight:600}
.mi-head{display:flex;align-items:center;gap:8px}
.mi-ico{width:24px;height:24px;border-radius:50%;background:rgba(128,128,128,0.15);color:var(--text-secondary,#888);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;font-weight:700}
.mi-title{font-size:12.5px;font-weight:500;color:var(--text-secondary,#888)}
.mi-track{text-align:center;padding:6px 0 4px;display:flex;align-items:center;justify-content:center;gap:2px;flex-wrap:wrap}
.mi-track-name{font-size:15px;font-weight:700;color:var(--accent-color,#7c5cff);word-break:break-word}
.mi-q{font-size:14px;color:var(--accent-color,#7c5cff);opacity:.5}
.mi-btns{display:flex;gap:6px;margin-top:2px}
.mi-btn{flex:1;min-width:0;padding:8px 0;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition: color .15s, opacity .15s, border-color .15s;border:1px solid var(--border-color,rgba(0,0,0,.1));background:transparent;color:var(--text-secondary,#666);white-space:nowrap}
.mi-btn:active{transform:scale(.97)}
.mi-primary{background:var(--accent-color,#7c5cff);color:#fff;border-color:transparent}
.mi-card.mi-done,.mi-card.mi-skip,.mi-card.mi-rejected{opacity:.7}
.mi-pending{display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 0;font-size:12.5px;color:var(--text-secondary,#888)}
.mi-pending-dot{width:6px;height:6px;border-radius:50%;background:var(--accent-color,#7c5cff);animation:miPulse 1.2s ease-in-out infinite}
@keyframes miPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.4}}
.mi-state-tag{text-align:center;padding:6px 0;font-size:12.5px;color:var(--text-secondary,#888);font-weight:500}
.mi-state-done{color:var(--accent-color,#7c5cff);font-weight:600}

.mi-card.mi-reserve{
  background:linear-gradient(135deg,rgba(var(--accent-color-rgb,124,92,255),.05),transparent);
  border-style:dashed;cursor:pointer;transition:transform .15s;
}
.mi-card.mi-reserve:active{transform:scale(.98)}
.mi-card.mi-reserve .mi-reserve-tip{font-size:11.5px;color:var(--accent-color,#7c5cff);opacity:.85;letter-spacing:.3px;}
.mi-card.mi-reserve[data-mi-done="1"]{opacity:.6;cursor:default;}

.mi-listening-badge{
  display:flex;align-items:center;justify-content:center;gap:5px;
  margin:0 auto 10px;padding:5px 14px;width:fit-content;border-radius:99px;
  background:rgba(var(--accent-color-rgb,124,92,255),.1);
  color:var(--accent-color,#7c5cff);font-size:12px;font-weight:600;letter-spacing:.3px;
}
.mi-listening-dot{width:6px;height:6px;border-radius:50%;background:currentColor;animation:miDot 1.4s ease-in-out infinite;}
@keyframes miDot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.5}}

.mi-player-invite-btn{
  position:absolute!important;
  top:12px!important;
  left:48px!important;
  width:24px!important;
  height:24px!important;
  border-radius:50%!important;
  border:1px dashed var(--border-color)!important;
  background:none!important;
  box-shadow:none!important;
  color:var(--text-secondary,#999)!important;
  cursor:pointer;
  font-size:13px;
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:20;
  padding:0;
  touch-action:manipulation;
  pointer-events:auto;
  font-family:inherit;
  line-height:1;
  /* ✅ 只过渡 color / opacity，避免主题切换时虚线闪烁 */
  transition: color .15s, opacity .15s;
  opacity:.7;
}
.mi-player-invite-btn:hover,
.mi-player-invite-btn:active{
  background:none!important;
  border-color:var(--accent-color,#7c5cff)!important;
  box-shadow:none!important;
  color:var(--accent-color,#7c5cff)!important;
  opacity:1;
}
`;
  document.head.appendChild(st);
}

/* ───────────── 初始化 ───────────── */
let _booted = false;
function boot() {
  if (_booted) return;
  _booted = true;
  injectStyles();
  wrapReply();
  injectBtn();
  attachPlayListener();
  attachEndedListener();
  attachPlayerCloseWatcher();
  attachKeywordListeners();
  updateBadge();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
setTimeout(boot, 800);
setTimeout(boot, 2500);

(function watch() {
  let timer = null;
  try {
    const mo = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        try { injectBtn(); } catch(e) {}
        try { updateBadge(); } catch(e) {}
        try { attachPlayerCloseWatcher(); } catch(e) {}
        try { attachKeywordListeners(); } catch(e) {}
      }, 400);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch(e) {}
})();

/* ───────────── 对外 API ───────────── */
window.MusicInvite = {
  songs: () => _songs.slice(),
  reloadSongs: loadSongs,
  isListening: () => !!listeningWith,
  stopListening: () => setListening(false),

  changeSong: (url, name) => playUrlDirect(url, name),

  reserveNext: () => taReserveNext(false),
  reserveNextForce: () => taReserveNext(true),

  getReserved: () => _reservedTrack ? { ..._reservedTrack } : null,
  clearReserved: () => { _reservedTrack = null; console.log('✅ 已清空待播放预订'); },

  trigger: {
    invite: (force) => taInviteMe(false, force),
    taJoin: () => {
      const a = $('audio');
      if (!a || !a.src) { alert('请先播放一首歌'); return; }
      const name = ($('music-title')?.textContent || '').trim() || '这首歌';
      taJoinNow({ url: a.src, name });
    },
    forceListening: () => {
      const a = $('audio');
      const name = a && a.src ? ($('music-title')?.textContent || '').trim() || '测试歌' : '测试歌';
      if (a && a.src) playUrlDirect(a.src, name);
      setListening(true, name, true);
      sysMsg('🎧 ' + partnerName() + ' 加入了你一起听《' + name + '》');
    },
    taAccept: (cid) => {
      const card = cid
        ? document.querySelector('.mi-card[data-mi-id="' + cid + '"]')
        : document.querySelector('.mi-card[data-mi-from="me"]:not([data-mi-done="1"])');
      if (!card) { console.warn('未找到待回应的邀请卡片'); return; }
      const url = card.getAttribute('data-mi-url');
      const name = card.getAttribute('data-mi-name');
      taRespondToInvite({ url, name }, card.getAttribute('data-mi-id'), 'accept');
    },
    playReservedNow: () => {
      if (!_reservedTrack) { console.warn('当前没有待播放的预订'); return; }
      const t = _reservedTrack;
      _reservedTrack = null;
      playUrlDirect(t.url, t.name);
      document.querySelectorAll('.mi-card.mi-reserve:not([data-mi-done="1"])').forEach(c => {
        if (c.getAttribute('data-mi-url') === t.url) {
          c.dataset.miDone = '1';
          const tip = c.querySelector('.mi-reserve-tip');
          if (tip) { tip.textContent = '🎧 已播放'; tip.classList.add('mi-state-done'); }
        }
      });
      console.log('🎵 立即播放预订 →', t.name);
    },
    /* 手动测试关键词触发（无视概率/冷却） */
    forceKeywordInvite: () => {
      taInviteMe(false, true).then(t => console.log('🎧 已强制触发关键词邀请 →', t?.name));
    },
    /* 🆕 手动测试随机切歌（无视概率/冷却） */
    forceSwitch: () => {
      if (!listeningWith) { console.warn('当前不在一起听状态，无法切歌'); return; }
      delete cooldown.taSwitch;
      const old = S().musicSwitchProb;
      S().musicSwitchProb = 100;
      maybeTaSwitchSong().then(() => { S().musicSwitchProb = old; });
    }
  },

  debug: {
    btnExists: () => !!$('mi-player-invite-btn'),
    songCount: async () => { await loadSongs(); return _songs.length; },
    clearCooldowns: () => {
      Object.keys(cooldown).forEach(k => delete cooldown[k]);
      console.log('✅ 已清空所有冷却');
    },
    /* 查看当前开关状态 */
    inviteEnabled: () => S().musicInviteEnabled !== false,
    /* 查看切歌概率 */
    switchProb: () => S().musicSwitchProb ?? 5
  }
};
})();