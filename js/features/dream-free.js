/* ============================================================
   dream-free.js —— 梦角自由造句（字级版，不依赖标点分词）
   - 源句：customReplies
   - 存库：window.dreamFreeReplies
   - 配置：localStorage 键 'xavier-dreamfree-cfg'
   ============================================================ */
(function () {
  'use strict';

  const CFG_KEY = 'xavier-dreamfree-cfg';
  const DEFAULT_CFG = {
    enabled: true,
    prob: 25,
    style: 'mix',
    punctOn: true,
    punctPool: '。 ~ ！ ……',
    minLen: 5,
    maxLen: 30
  };

  function loadCfg() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      if (raw) return Object.assign({}, DEFAULT_CFG, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, DEFAULT_CFG);
  }
  function saveCfg(c) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
  }

  const HAN = /[\u4e00-\u9fff]/;
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const chance = p => Math.random() * 100 < p;

  const FILL_WORDS = ['想你', '抱抱', '亲亲', '嘿嘿', '哦', '呀', '啦', '嘛', '呢', '哼',
    '想你了', '最喜欢你', '晚安', '早安', '嘿嘿嘿', '哼哼', '呜呜', '嘻嘻', '好耶', '喵'];
  const SUFFIXES = ['呀', '啦', '哦', '呢', '嘛', '哟', '哈', '嘿嘿'];

  function validSource(s, cfg) {
    if (typeof s !== 'string') return false;
    const t = s.trim();
    if (!t) return false;
    if (t.length < cfg.minLen || t.length > cfg.maxLen) return false;
    if (t.indexOf('data:') === 0) return false;
    if (t.indexOf('|||') >= 0) return false;
    if (/[\uD800-\uDBFF]/.test(t)) return false;
    const hanN = (t.match(/[\u4e00-\u9fff]/g) || []).length;
    return hanN >= 3;
  }

  // 手法 0：语气词式（字级）
  function styleTone(text) {
    const t = String(text || '').trim();
    if (!t || t.length < 3) return null;
    const r = Math.random();
    if (r < 0.5) {
      return t + rand(SUFFIXES);
    } else if (r < 0.8) {
      const cut = 1 + Math.floor(Math.random() * 2);
      const base = t.slice(0, Math.max(2, t.length - cut));
      return base + rand(SUFFIXES);
    } else {
      const pos = 1 + Math.floor(Math.random() * Math.max(1, t.length - 1));
      return t.slice(0, pos) + rand(FILL_WORDS.slice(0, 8)) + t.slice(pos);
    }
  }

  // 手法 1：撤回式（砍后半句，字级）
  function styleRecall(text) {
    const t = String(text || '').trim().replace(/[，。！？、…～\s]+$/, '');
    if (t.length < 4) return null;
    const keepRatio = 0.4 + Math.random() * 0.4;
    let keepLen = Math.max(3, Math.floor(t.length * keepRatio));
    if (keepLen >= t.length) keepLen = t.length - 1;
    if (keepLen < 3) return null;
    const out = t.slice(0, keepLen);
    if (Math.random() < 0.5) return out + '……';
    return out + rand(SUFFIXES);
  }

  // 手法 2：换词式（从别的源句借 2-3 个字替换原句一段）
  function styleCutFill(text, pool) {
    const t = String(text || '').trim();
    if (t.length < 4) return null;
    let donor = null;
    for (let i = 0; i < 8; i++) {
      const d = rand(pool || []);
      if (d && d !== text && String(d).length >= 3) { donor = String(d); break; }
    }
    if (!donor) return null;
    const hanOnly = donor.replace(/[^\u4e00-\u9fff]/g, '');
    if (hanOnly.length < 2) return null;
    let segLen = 2 + Math.floor(Math.random() * 2);
    if (segLen > hanOnly.length) segLen = hanOnly.length;
    const start = Math.floor(Math.random() * (hanOnly.length - segLen + 1));
    const borrowed = hanOnly.slice(start, start + segLen);
    const replStart = Math.floor(Math.random() * Math.max(1, t.length - segLen));
    const out = t.slice(0, replStart) + borrowed + t.slice(replStart + segLen);
    if (out === t || out.length < 3) return null;
    return out;
  }

  const END_PUNCT_OK = /[。．！？!?~～…，、,.;；:：）)”’"]/;
  function endPunctPool(cfg) {
    if (!cfg.punctOn) return null;
    const raw = String(cfg.punctPool || '').trim();
    if (!raw) return ['。', '。', '。', '~', '！', '……'];
    let arr = raw.split(/[\s|]+/).filter(Boolean);
    arr = arr.filter(x => x.length <= 6).slice(0, 20);
    return arr.length ? arr : ['。'];
  }
  function withEndPunct(txt, cfg) {
    const pool = endPunctPool(cfg);
    if (!pool || !txt) return txt;
    if (END_PUNCT_OK.test(txt.charAt(txt.length - 1))) return txt;
    return txt + rand(pool);
  }

  function getSourcePool() {
    try {
      if (typeof customReplies !== 'undefined' && Array.isArray(customReplies)) {
        return customReplies.filter(s => typeof s === 'string' && s.trim());
      }
    } catch (e) {}
    return [];
  }

  let lastSrc = '';

  function build() {
    const cfg = loadCfg();
    if (!cfg.enabled) return null;
    if (!chance(cfg.prob)) return null;

    const pool = getSourcePool();
    if (!pool.length) return null;

    const valid = pool.filter(s => validSource(s, cfg));
    if (!valid.length) return null;

    let source = null;
    for (let t = 0; t < 8; t++) {
      const s = rand(valid);
      if (s !== lastSrc) { source = s; break; }
    }
    if (!source) source = rand(valid);

    let style = cfg.style;
    if (style === 'mix') style = Math.floor(Math.random() * 3);

    let out = null;
    if (style === 0) out = styleTone(source);
    else if (style === 1) out = styleRecall(source);
    else out = styleCutFill(source, valid);

    out = (out || '').trim();
    if (!out) return null;

    out = withEndPunct(out, cfg);
    lastSrc = source;
    return out;
  }

  function save(txt) {
    if (!txt || typeof txt !== 'string') return false;
    try {
      if (typeof window.dreamFreeReplies === 'undefined' || !Array.isArray(window.dreamFreeReplies)) {
        window.dreamFreeReplies = [];
      }
      const normFn = (typeof normalizeStringStrict === 'function')
        ? normalizeStringStrict
        : (s => String(s || '').trim());
      const norm = normFn(txt);
      if (window.dreamFreeReplies.some(r => normFn(r) === norm)) {
        return false;
      }
      window.dreamFreeReplies.push(txt);
      if (typeof throttledSaveData === 'function') throttledSaveData();
      if (typeof renderReplyLibrary === 'function') {
        const modal = document.getElementById('custom-replies-modal');
        if (modal && modal.style.display !== 'none') renderReplyLibrary();
      }
      return true;
    } catch (e) { return false; }
  }

  window.DreamFree = {
    build,
    save,
    loadCfg,
    saveCfg,
    DEFAULT_CFG
  };
})();