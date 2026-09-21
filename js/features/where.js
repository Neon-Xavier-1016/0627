/* ============================================================
 * 你在干嘛 · 在做什么
 * 地图定位 + 每日行程
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. 地点数据 ---------- */
  const PLACES = [
    { id: 'place1',  name: 'N109区',            x: 3.43,  y: 12.43, weight: 1 },
    { id: 'place2',  name: '回溯II号',          x: 13.5,  y: 31.36, weight: 2 },
    { id: 'place3',  name: '禁猎区',            x: 11.68, y: 39.91, weight: 8 },
    { id: 'place4',  name: 'Philo花店',         x: 29.12, y: 35.02, weight: 8 },
    { id: 'place5',  name: '临空图书馆',        x: 39.05, y: 38.6,  weight: 2 },
    { id: 'place6',  name: '猎人协会',          x: 47.88, y: 43.31, weight: 8 },
    { id: 'place7',  name: '猎人公寓',          x: 50,    y: 46.8,  weight: 8, isHome: true },
    { id: 'place8',  name: 'AKSO',              x: 45.69, y: 46.71, weight: 2 },
    { id: 'place9',  name: 'Mr.selfdom',        x: 43.5,  y: 50.81, weight: 1 },
    { id: 'place10', name: '寰飞商厦',          x: 58.54, y: 58.92, weight: 4 },
    { id: 'place11', name: '遇见咖啡馆',        x: 54.82, y: 64.24, weight: 4 },
    { id: 'place12', name: '塔罗店',            x: 44.45, y: 72.53, weight: 4 },
    { id: 'place13', name: '陶艺店',            x: 52.48, y: 80.56, weight: 4 },
    { id: 'place14', name: '霓光植物园',        x: 56.64, y: 89.1,  weight: 2 },
    { id: 'place15', name: '星海游乐园',        x: 67.15, y: 51.42, weight: 2 },
    { id: 'place16', name: '新信岛',            x: 84.23, y: 77.85, weight: 2 },
    { id: 'place17', name: '临空滨海森林公园',  x: 59.71, y: 78.46, weight: 2 },
    { id: 'place18', name: 'Twinkle潮玩店',     x: 51.68, y: 30.14, weight: 4 },
    { id: 'place19', name: '蚁巢酒吧',          x: 21.9,  y: 48.28, weight: 2 },
    { id: 'place20', name: '花园别墅',          x: 34.74, y: 53.25, weight: 8, isHome: true }
  ];

  /* ---------- 2. 文案池 ---------- */
  const ACTIONS = {
    place1: [
      { category: '工作中', texts: ['正在谈判中，貌似事态不妙'] }
    ],
    place2: [
      { category: '工作中', texts: ['试图修好飞船', '貌似来寻找芯核'] }
    ],
    place3: [
      { category: '工作中', texts: [
        '接到特令，进入禁猎区调查异能量波动的原因',
        '提前扫除大型流浪体，受了一点小伤',
        '发现森林中被人动过手脚的引力锚装置，寻找并解除引力锚',
        '发现芯核被暗点改造过的磁线，追查芯核改造痕迹',
        '独自追查暗点的线索'
      ]}
    ],
    place4: [
      { category: '看店中', texts: ['邱诺亚不在，待在花店里帮忙打理呢'] },
      { category: '照顾花材中', texts: [
        '给花浇水中，照顾的好像不是很好，是故意的吗？',
        '拿着小喷壶给月桂树喷水，明明那棵月桂树是耐旱植物、怕积水，还在不停地喷'
      ]},
      { category: '学习插花中', texts: ['拿花店的花学习插花中，邱诺亚发出尖锐爆鸣！'] },
      { category: '挑选花品中', texts: ['拿花店的花学习插花中，邱诺亚发出尖锐爆鸣！'] },
      { category: '聊天中', texts: ['和邱诺亚谈论重要机密中'] },
      { category: '无所事事中', texts: ['无所事事地坐在花丛中发呆，整个人坐在一堆花里面，安安静静的，身上还飘着小光点'] }
    ],
    place5: [
      { category: '看书中', texts: ['看《深空猎人进阶指南》，一目十行看的飞快'] },
      { category: '找书中', texts: ['在旧馆纸质书架间穿行，手指拂过书脊上的标签慢慢找书'] },
      { category: '犯困中', texts: ['坐在窗边有点困，疯狂点头中'] }
    ],
    place6: [
      { category: '工作中', texts: [
        '出外勤打流浪体',
        '给年轻 Evolver 传授战斗技巧',
        '执行秘密任务，这次又假扮什么身份呢？',
        '暗中协调灾后救援，送伤员去中心医院、关注物资分配和儿童病房，忙的很呀'
      ]}
    ],
    place7: [
      { category: '睡觉中', texts: [
        '睡的特别安稳，梦里会梦见什么呢？',
        '恢复能量中，不知道是生病了还是累了'
      ]},
      { category: '吃零食', texts: ['薯片吃个遍，胃口大得惊人'] },
      { category: '看电视', texts: [
        '窝在沙发上看，整个人往下一瘫，非常享受',
        '观看《早安临空》有{user}出镜的片段，这个是重播吗？',
        '观看黄金八点档中，期待下一期的播出'
      ]},
      { category: '做饭中', texts: ['进厨房大显身手，有没有成功呢？'] },
      { category: '做家务中', texts: ['整理家中，干完活一脸"我值得休息"的表情去零食架旁放松'] },
      { category: '睡前看书中', texts: ['生活仪式感拉满，睡前必翻几页书'] },
      { category: '洗漱中', texts: ['我爱洗澡皮肤好好'] },
      { category: '吃饭中', texts: ['在吃自己的作战成果，好像还不错'] }
    ],
    place8: [
      { category: '看病中', texts: [
        '发烧了，貌似有点难受',
        '感冒了来拿一些药吃',
        '做身体检查中，好像很健康呢',
        '工作受伤了，来医院包扎',
        '看病中，很难受的样子'
      ]}
    ],
    place9: [
      { category: '购物中', texts: ['为自己置办新行头，能不能讨{user}欢心呢'] }
    ],
    place10: [
      { category: '购物', texts: ['外出采购食材，周末准备自己下厨'] },
      { category: '看电影', texts: ['新出的电影，迫不及待购买电影票，是恐怖元素吗？'] },
      { category: '吃东西', texts: [
        '大吃兔咪火锅中，已经等了好久了，貌似只点了肉食呢',
        '发现的新自助餐，老板的眼神不妙！',
        '犹豫吃什么中，谁家看着好吃就吃谁家'
      ]},
      { category: '无所事事中', texts: ['无所事事闲逛中，要看电影还是购物呢？'] }
    ],
    place11: [
      { category: '喝咖啡', texts: ['等{user}回来中，{user}什么才时候会出现在这里呢'] }
    ],
    place12: [
      { category: '算塔罗', texts: [
        '给{user}传讯中，很期待{user}的回复',
        '梦占中，{user}到底爱不爱我呀！'
      ]}
    ],
    place13: [
      { category: '陶艺中', texts: ['做一个{user}的形象，这样就可以每天都看到{user}了！'] }
    ],
    place14: [
      { category: '游玩中', texts: [
        '很悠闲，很想和{user}一起玩，想你',
        '莫名其妙又想到{user}，感觉很孤独',
        '玩的很开心，终于可以放松了！',
        '团建中，和大家一起感觉很放松'
      ]}
    ],
    place15: [
      { category: '游玩中', texts: [
        '很悠闲，很想和{user}一起玩，想你',
        '莫名其妙又想到{user}，感觉很孤独',
        '玩的很开心，终于可以放松了！',
        '团建中，和大家一起感觉很放松'
      ]}
    ],
    place16: [
      { category: '度假中', texts: [
        '很悠闲，很想和{user}一起玩，想你',
        '莫名其妙又想到{user}，感觉很孤独',
        '玩的很开心，终于可以放松了！',
        '想起上次和你一起玩的日子，有点怀念'
      ]}
    ],
    place17: [
      { category: '游玩中', texts: [
        '很悠闲，很想和{user}一起玩，想你',
        '莫名其妙又想到{user}，感觉很孤独',
        '玩的很开心，终于可以放松了！',
        '团建中，和大家一起感觉很放松',
        '观察自然景观真让人放松'
      ]}
    ],
    place18: [
      { category: '购物中', texts: ['{user}新的周边一定要买到！'] },
      { category: '抓娃娃中', texts: ['想抓到{user}的娃娃，感觉家里娃娃还是不够'] }
    ],
    place19: [
      { category: '小酌中', texts: [
        '和同事团建中，大家都很开心',
        '有点想{user}了，这是借酒消愁吗？',
        '最近很适合喝酒，小酌一杯也不错'
      ]}
    ],
    place20: [
      { category: '睡觉中', texts: [
        '睡的特别安稳，梦里会梦见什么呢？',
        '恢复能量中，不知道是生病了还是累了'
      ]},
      { category: '吃零食', texts: ['薯片吃个遍，胃口大得惊人'] },
      { category: '看电视', texts: [
        '窝在沙发上看，整个人往下一瘫，非常享受',
        '观看《早安临空》有{user}出镜的片段，这个是重播吗？',
        '观看黄金八点档中，期待下一期的播出'
      ]},
      { category: '做饭中', texts: ['进厨房大显身手，有没有成功呢？'] },
      { category: '做家务中', texts: ['整理家中，干完活一脸"我值得休息"的表情去零食架旁放松'] },
      { category: '睡前看书中', texts: ['生活仪式感拉满，睡前必翻几页书'] },
      { category: '洗漱中', texts: ['我爱洗澡皮肤好好'] },
      { category: '吃饭中', texts: ['在吃自己的作战成果，好像还不错'] },
      { category: '插花中', texts: ['从一开始随便插到后来选瓶、思考构图、认真摆弄，成品越来越好看，期待{user}可以看到这个成果'] },
      { category: '运动中', texts: ['运动中，不能让{user}嫌弃了，但是好累'] },
      { category: '花园散步', texts: ['在花园溜达一圈，感觉好舒服（￣▽￣）'] }
    ]
  };

  /* ---------- 3. 行程生成 ---------- */
  const STORE_KEY = 'wyd_where_plan';

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function weightedPick(list, excludeId) {
    const pool = list.filter(p => p.id !== excludeId);
    if (!pool.length) return list[0];
    const total = pool.reduce((s, p) => s + (p.weight || 1), 0);
    let r = Math.random() * total;
    for (const p of pool) {
      r -= (p.weight || 1);
      if (r <= 0) return p;
    }
    return pool[pool.length - 1];
  }

  function getSettings() {
    const s = (typeof settings !== 'undefined') ? settings : {};
    return {
      leaveMin:  s.whereLeaveTime  ?? 11 * 60,
      returnMin: s.whereReturnTime ?? 19 * 60,
      wakeMin:   s.whereWakeTime   ?? 8 * 60
    };
  }

  function generatePlan() {
    const homes = PLACES.filter(p => p.isHome);
    const home  = pick(homes);

    const cfg = getSettings();

    const leaveMin  = cfg.leaveMin  + randInt(-30, 30);
    const returnMin = cfg.returnMin + randInt(-30, 30);
    const wakeMin   = cfg.wakeMin   + randInt(-30, 30);

    // 睡眠 8–10 小时随机
    const sleepHours = randInt(8, 10);
    const rawSleepMin = wakeMin - sleepHours * 60;
    const crossNight = rawSleepMin < 0;          // 跨夜（前晚入睡）
    let sleepMin = crossNight ? rawSleepMin + 1440 : rawSleepMin;

    // 中间地点：1–3 个
    const midCount = randInt(1, 3);
    const midPlaces = [];
    let lastId = null;
    for (let i = 0; i < midCount; i++) {
      const p = weightedPick(PLACES.filter(x => !x.isHome), lastId);
      if (p.id === lastId && PLACES.length > 2) { i--; continue; }
      midPlaces.push(p);
      lastId = p.id;
    }

    const span = returnMin - leaveMin;
    const visits = [];

    if (crossNight) {
      // 昨晚入睡 → 0:00 到 wakeMin 是睡觉
      visits.push({ placeId: home.id, start: 0, end: wakeMin, phase: 'sleep' });
    } else {
      // 当天凌晨入睡 → 0:00 到 sleepMin 是醒着
      if (sleepMin > 0) {
        visits.push({ placeId: home.id, start: 0, end: sleepMin, phase: 'home' });
      }
      visits.push({ placeId: home.id, start: sleepMin, end: wakeMin, phase: 'sleep' });
    }

    // 起床到出门在家
    if (leaveMin > wakeMin) {
      visits.push({ placeId: home.id, start: wakeMin, end: leaveMin, phase: 'home' });
    }

    // 中间外出
    let cursor = leaveMin;
    const each = Math.floor(span / midCount);

    midPlaces.forEach((p, i) => {
      const isLast = i === midCount - 1;
      const dur = isLast ? (returnMin - cursor) : each;
      visits.push({ placeId: p.id, start: cursor, end: cursor + dur, phase: 'out' });
      cursor += dur;
    });

    // 晚上回家
    if (crossNight) {
      if (returnMin < sleepMin) {
        visits.push({ placeId: home.id, start: returnMin, end: sleepMin, phase: 'home' });
      }
      visits.push({ placeId: home.id, start: sleepMin, end: 1440, phase: 'sleep' });
    } else {
      visits.push({ placeId: home.id, start: returnMin, end: 1440, phase: 'home' });
    }

    // 给每个 visit 抽文案
    const usedText = {};
    visits.forEach(v => {
      if (v.phase === 'sleep') {
        v.category = '睡觉中';
        const pool = ACTIONS[v.placeId]?.find(a => a.category === '睡觉中')?.texts || ['在睡觉'];
        const key = v.placeId + '::睡觉中';
        v.text = pickDistinct(pool, key, usedText);
        return;
      }
      const pool = ACTIONS[v.placeId] || [];
      if (!pool.length) {
        v.category = '在忙';
        v.text = '在忙自己的事';
        return;
      }
      const group = pick(pool);
      const key = v.placeId + '::' + group.category;
      v.category = group.category;
      v.text = pickDistinct(group.texts, key, usedText);
    });

    return {
      date: todayStr(),
      homeId: home.id,
      leaveMin, returnMin, wakeMin, sleepMin,
      visits
    };
  }

  function pickDistinct(pool, key, usedMap) {
    if (!usedMap[key]) usedMap[key] = [];
    const used = usedMap[key];
    const remain = pool.filter(t => !used.includes(t));
    const chosen = remain.length ? pick(remain) : pick(pool);
    used.push(chosen);
    if (used.length >= pool.length) used.length = 0;
    return chosen;
  }

  function loadPlan() {
    let plan = null;
    try { plan = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
    if (!plan || plan.date !== todayStr()) {
      plan = generatePlan();
      try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)); } catch (e) {}
    }
    return plan;
  }

  function nowMin() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function fmtHM(min) {
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' +
           String(min % 60).padStart(2, '0');
  }

  function currentVisit(plan) {
    const t = nowMin();
    for (const v of plan.visits) {
      if (t >= v.start && t < v.end) return v;
    }
    return plan.visits[plan.visits.length - 1];
  }

  function getPlace(id) {
    return PLACES.find(p => p.id === id);
  }

  /* ---------- 3.5 渲染时纠错：吃饭联动 ---------- */
  function seededIndex(seed, length) {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return Math.floor((x - Math.floor(x)) * length);
  }

  function loadMealData() {
    try { return JSON.parse(localStorage.getItem('wyd_data') || 'null'); }
    catch (e) { return null; }
  }

  function mealKeyForVisit(v) {
    const t = (v.start + v.end) / 2;
    if (t >= 7 * 60      && t < 10 * 60 + 30) return 'breakfast';
    if (t >= 11 * 60 + 30 && t < 14 * 60)     return 'lunch';
    if (t >= 17 * 60 + 30 && t < 19 * 60)     return 'dinner';
    return null;
  }

  function replaceVisitCategory(v, badCategory) {
    const pool = (ACTIONS[v.placeId] || []).filter(a => a.category !== badCategory);
    if (!pool.length) {
      return Object.assign({}, v, { category: '在忙', text: '在忙自己的事' });
    }
    const gi = seededIndex(v.start, pool.length);
    const group = pool[gi];
    const ti = seededIndex(v.start + 7, group.texts.length);
    return Object.assign({}, v, {
      category: group.category,
      text: group.texts[ti]
    });
  }

  function correctVisit(v) {
    if (v.category !== '吃饭中') return v;
    const key = mealKeyForVisit(v);
    if (!key) return replaceVisitCategory(v, '吃饭中');
    const data = loadMealData();
    const meal = data && data.meals ? data.meals[key] : null;
    if (!meal || !meal.eat) return replaceVisitCategory(v, '吃饭中');
    return v;
  }

  /* ---------- 4. 地图渲染 ---------- */
  const MAP_SRC = 'image/map.png';
  const MAP_W = 2500;
  const MAP_H = 2092;
  const MAP_RATIO = MAP_W / MAP_H;

  let _mapState = {
    scale: 1.35,
    tx: 0, ty: 0,
    minScale: 1,
    maxScale: 2,
    initialized: false
  };

  function buildMapHTML() {
    return `
    <div class="wyd-map-viewport" id="wyd-map-viewport">
      <div class="wyd-map-canvas" id="wyd-map-canvas">
        <img class="wyd-map-img" src="${MAP_SRC}" alt="map" draggable="false">
        <div class="wyd-map-pins" id="wyd-map-pins"></div>
      </div>
      <button class="wyd-map-recenter" id="wyd-map-recenter" title="回到当前位置">
        <i class="fas fa-location-crosshairs"></i>
      </button>
      <div class="wyd-map-zoom">
        <button id="wyd-map-zoom-in">+</button>
        <button id="wyd-map-zoom-out">−</button>
      </div>
    </div>
    `;
  }

  function renderMapPins(plan, currentPlaceId) {
    const pinsEl = document.getElementById('wyd-map-pins');
    if (!pinsEl) return;

    const t = nowMin();
    const seen = new Set();
    plan.visits.forEach(v => {
      if (v.start <= t) seen.add(v.placeId);
    });

    const cur = currentPlaceId;

    let html = '';
    PLACES.forEach(p => {
      if (!seen.has(p.id)) return;
      const isCur = p.id === cur;
      html += `<div class="wyd-map-pin ${isCur ? 'current' : ''}"
                    style="left:${p.x}%;top:${p.y}%"></div>`;
    });
    pinsEl.innerHTML = html;
  }

  function applyMapTransform() {
    const canvas = document.getElementById('wyd-map-canvas');
    if (!canvas) return;
    canvas.style.transform =
      `translate(${_mapState.tx}px, ${_mapState.ty}px) scale(${_mapState.scale})`;
  }

  function initMapTransform() {
    if (_mapState.initialized) return;
    const vp = document.getElementById('wyd-map-viewport');
    const cv = document.getElementById('wyd-map-canvas');
    if (!vp || !cv) return;

    const vw = vp.clientWidth;
    const vh = vw / MAP_RATIO;
    cv.style.width  = vw + 'px';
    cv.style.height = vh + 'px';

    _mapState.vw = vw;
    _mapState.vh = vh;
    _mapState.initialized = true;

    const scaledW = vw * _mapState.scale;
    const scaledH = vh * _mapState.scale;
    _mapState.tx = (vp.clientWidth  - scaledW) / 2;
    _mapState.ty = (vp.clientHeight - scaledH) / 2;
    applyMapTransform();
  }

  function centerOnPlace(place, animate = true) {
    const vp = document.getElementById('wyd-map-viewport');
    const cv = document.getElementById('wyd-map-canvas');
    if (!vp || !cv || !place) return;

    if (!_mapState.initialized) initMapTransform();

    const vw = _mapState.vw, vh = _mapState.vh;
    const scale = _mapState.scale;

    const px = place.x / 100 * vw * scale;
    const py = place.y / 100 * vh * scale;

    const cx = vp.clientWidth  / 2;
    const cy = vp.clientHeight / 2;

    let tx = cx - px;
    let ty = cy - py;

    const scaledW = vw * scale;
    const scaledH = vh * scale;
    const minTx = vp.clientWidth  - scaledW;
    const minTy = vp.clientHeight - scaledH;
    if (tx > 0) tx = 0;
    if (ty > 0) ty = 0;
    if (tx < minTx) tx = minTx;
    if (ty < minTy) ty = minTy;

    if (animate) {
      cv.style.transition = 'transform .42s cubic-bezier(.22,.9,.3,1)';
    } else {
      cv.style.transition = 'none';
    }

    _mapState.tx = tx;
    _mapState.ty = ty;
    applyMapTransform();

    if (animate) {
      setTimeout(() => { cv.style.transition = 'none'; }, 450);
    }

    const rec = document.getElementById('wyd-map-recenter');
    if (rec) rec.style.display = 'flex';
  }

  function bindMapEvents() {
    const vp = document.getElementById('wyd-map-viewport');
    const cv = document.getElementById('wyd-map-canvas');
    if (!vp || !cv) return;

    let dragging = false;
    let startX = 0, startY = 0, startTx = 0, startTy = 0;

    const onDown = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      dragging = true;
      startX = pt.clientX; startY = pt.clientY;
      startTx = _mapState.tx; startTy = _mapState.ty;
      cv.style.transition = 'none';
    };

    const onMove = (e) => {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - startX;
      const dy = pt.clientY - startY;

      let tx = startTx + dx;
      let ty = startTy + dy;

      const scaledW = _mapState.vw * _mapState.scale;
      const scaledH = _mapState.vh * _mapState.scale;
      const minTx = vp.clientWidth  - scaledW;
      const minTy = vp.clientHeight - scaledH;

      if (tx > 0) tx = 0;
      if (ty > 0) ty = 0;
      if (tx < minTx) tx = minTx;
      if (ty < minTy) ty = minTy;

      _mapState.tx = tx;
      _mapState.ty = ty;
      applyMapTransform();
      e.preventDefault();
    };

    const onUp = () => { dragging = false; };

    vp.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    vp.addEventListener('touchstart', onDown, { passive: true });
    vp.addEventListener('touchmove', onMove, { passive: false });
    vp.addEventListener('touchend', onUp);

    document.getElementById('wyd-map-zoom-in')?.addEventListener('click', () => {
      _mapState.scale = Math.min(_mapState.maxScale, _mapState.scale + 0.2);
      applyMapTransform();
    });
    document.getElementById('wyd-map-zoom-out')?.addEventListener('click', () => {
      _mapState.scale = Math.max(_mapState.minScale, _mapState.scale - 0.2);
      applyMapTransform();
    });

    document.getElementById('wyd-map-recenter')?.addEventListener('click', () => {
      const plan = loadPlan();
      const v = currentVisit(plan);
      const p = getPlace(v.placeId);
      if (p) centerOnPlace(p, true);
    });
  }

  /* ---------- 5. 渲染 ---------- */
  function renderWhere(generate) {
    const box = document.getElementById('wyd-meals-container');
    if (!box) return;

    const plan = loadPlan();
    const cur  = currentVisit(plan);
    const curFixed = correctVisit(cur);
    const curPlace = getPlace(cur.placeId);

    // 地图
    let html = buildMapHTML();

    // 当前时段卡片
    html += `<div class="wyd-where-card wyd-where-current">
      <div class="wyd-card-head">
        <span class="wyd-card-title">📍 ${curPlace.name} · ${fmtHM(curFixed.start)} 起</span>
      </div>
      <div class="wyd-where-category">${curFixed.category}</div>
      <div class="wyd-card-text">${(curFixed.text || '').replace(/\{user\}/g, getUserName())}</div>
    </div>`;

    // 已过去时段（不含当前），完整卡片
    const t = nowMin();
    const passed = plan.visits.filter(v => v.end <= t && v !== cur);
    if (passed.length) {
      html += `<div class="wyd-where-timeline-title">今天去过</div>`;
      passed.forEach(v => {
        const p = getPlace(v.placeId);
        if (!p) return;
        const vFixed = correctVisit(v);
        html += `<div class="wyd-where-past-card">
          <div class="wyd-card-head">
            <span class="wyd-card-title">📍 ${p.name} · ${fmtHM(vFixed.start)}-${fmtHM(vFixed.end)}</span>
            <span class="wyd-card-time">已过去</span>
          </div>
          ${vFixed.category ? `<div class="wyd-where-category">${vFixed.category}</div>` : ''}
          <div class="wyd-card-text">${(vFixed.text || '').replace(/\{user\}/g, getUserName())}</div>
        </div>`;
      });
    }

    box.innerHTML = html;

    // 初始化地图 + 定位
    requestAnimationFrame(() => {
      _mapState.initialized = false;
      initMapTransform();
      bindMapEvents();
      renderMapPins(plan, cur.placeId);

      if (generate) {
        setTimeout(() => centerOnPlace(curPlace, true), 60);
      } else {
        centerOnPlace(curPlace, false);
      }
    });
  }

  /* ---------- 6. 用户名 ---------- */
  function getUserName() {
    try {
      if (typeof settings !== 'undefined' && settings.myName) return settings.myName;
    } catch (e) {}
    return '你';
  }

  /* ---------- 7. 导出 ---------- */
  window.WydWhere = {
    render: renderWhere,
    PLACES,
    loadPlan,
    centerOnPlace
  };

  /* ---------- 8. 样式 ---------- */
  const css = `
  .wyd-map-viewport{
    position:relative;
    width:100%;
    height:360px;
    border-radius:14px;
    overflow:hidden;
    background:var(--secondary-bg);
    border:1px solid var(--border-color);
    touch-action:none;
    user-select:none;
    flex-shrink:0;
  }
  .wyd-map-canvas{
    position:absolute;
    top:0;left:0;
    transform-origin:0 0;
    will-change:transform;
  }
  .wyd-map-img{
    display:block;
    width:100%;height:100%;
    -webkit-user-drag:none;
    user-select:none;
    pointer-events:none;
  }
  .wyd-map-pins{
    position:absolute;inset:0;
    pointer-events:none;
  }
  .wyd-map-pin{
    position:absolute;
    width:7px;height:7px;
    margin:-3.5px 0 0 -3.5px;
    border-radius:50%;
    background:var(--accent-color);
    box-shadow:0 0 0 1.5px rgba(255,255,255,.7),0 1px 3px rgba(0,0,0,.35);
    opacity:.4;
  }
  .wyd-map-pin.current{
    width:11px;height:11px;
    margin:-5.5px 0 0 -5.5px;
    opacity:1;
    animation:wyd-pin-pulse 1.8s ease-out infinite;
  }
  @keyframes wyd-pin-pulse{
    0%  {box-shadow:0 0 0 1.5px rgba(255,255,255,.7),0 0 0 0 rgba(var(--accent-color-rgb),.7);}
    70% {box-shadow:0 0 0 1.5px rgba(255,255,255,.7),0 0 0 14px rgba(var(--accent-color-rgb),0);}
    100%{box-shadow:0 0 0 1.5px rgba(255,255,255,.7),0 0 0 0 rgba(var(--accent-color-rgb),0);}
  }
  .wyd-map-recenter{
    position:absolute;
    right:10px;bottom:10px;
    width:32px;height:32px;
    border-radius:50%;
    border:none;
    background:rgba(0,0,0,.55);
    color:#fff;
    display:none;
    align-items:center;justify-content:center;
    font-size:13px;
    cursor:pointer;
    z-index:3;
  }
  .wyd-map-zoom{
    position:absolute;
    right:10px;bottom:50px;
    display:flex;flex-direction:column;gap:4px;
    z-index:3;
  }
  .wyd-map-zoom button{
    width:28px;height:28px;
    border-radius:50%;
    border:none;
    background:rgba(0,0,0,.5);
    color:#fff;
    font-size:14px;
    cursor:pointer;
  }

  .wyd-where-card{
    background:var(--secondary-bg);
    border:1px solid var(--border-color);
    border-radius:14px;
    padding:14px 16px;
    flex-shrink:0;
  }
  .wyd-where-current{
    border-color:rgba(var(--accent-color-rgb),.3);
    background:rgba(var(--accent-color-rgb),.04);
  }
  .wyd-where-current .wyd-card-title{
    color:var(--accent-color);
  }

  .wyd-where-timeline-title{
    font-size:11px;
    color:var(--text-secondary);
    margin:10px 0 4px;
    opacity:.75;
    letter-spacing:.5px;
  }

  .wyd-where-past-card{
    background:var(--secondary-bg);
    border:1px solid var(--border-color);
    border-radius:14px;
    padding:12px 14px;
    flex-shrink:0;
    opacity:.68;
    margin-bottom:8px;
  }
  .wyd-where-past-card .wyd-card-title{
    color:var(--text-secondary);
    font-size:13px;
  }
  .wyd-where-past-card .wyd-card-text{
    font-size:12.5px;
  }
  .wyd-where-past-card .wyd-where-category{
    font-size:12.5px;
    opacity:.85;
    margin:4px 0 3px;
  }

  .wyd-where-category{
    font-size:13px;
    font-weight:600;
    color:var(--accent-color);
    margin:6px 0 4px;
  }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
})();