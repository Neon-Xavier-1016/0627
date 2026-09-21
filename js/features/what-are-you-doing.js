/* ============================================================
 * 你在干嘛 · 吃饭了吗 + 此刻心情 + 在做什么
 * ============================================================ */
(function () {
    'use strict';

    /* ============================================================
     * 一、吃饭了吗 —— 数据池
     * ============================================================ */

    const BREAKFAST_DISHES = [
        '煎饼果子','鸡蛋灌饼','馄饨','奶黄包','豆沙包','小笼包','拉面','蛋挞','米饭','面条',
        '馒头','白粥','小米粥','南瓜粥','皮蛋瘦肉粥','青菜粥','红枣粥','葱油饼','手抓饼','葱花鸡蛋饼',
        '土豆丝饼','韭菜盒子','茶叶蛋','水煮蛋','煎荷包蛋','蒸水蛋','油条','蒸饺','煎饺','烧麦',
        '米粉','河粉','吐司','全麦面包','培根','香肠','可颂','华夫饼','燕麦片','酸奶',
        '水果沙拉','芝士片','薯饼','玉米片','红糖发糕','麻团','豆浆','豆腐脑','锅贴','芝麻包',
        '芋泥包','蒸红薯','蒸玉米','蒸山药','南瓜饼'
    ];

    const LUNCH_DINNER_DISHES = [
        '鱼香肉丝','卤猪肉','卤牛肉','酸菜鱼头汤','番茄牛腩汤','牛肉萝卜汤','老母鸡汤','青椒炒肉','香辣烤翅','烤全鸡',
        '炸茄盒','炸酥肉','梅菜扣肉','粉蒸肉','炒胡萝卜','炒莴笋','酸辣土豆丝','包菜炒粉丝','清炒上海青','西红柿炒鸡蛋',
        '孜然羊肉','香辣土豆鸡翅','咖喱鸡','三杯鸡','可乐鸡翅','土豆炒牛肉','孜然牛肉','小炒黄牛肉','红烧排骨','香辣小酥肉',
        '土豆炒肉片','水煮肉片','肉末茄子','糖醋里脊','木须肉','炒粉条','红烧肉','宫保鸡丁','清蒸鲈鱼','芹菜炒肉',
        '蒜苔炒肉','爆炒猪肝','香干炒肉','油焖大虾','麻婆豆腐','蒜蓉西兰花','手撕包菜','清炒油麦菜','凉拌黄瓜','凉拌木耳',
        '家常豆腐','清炒冬瓜','冬瓜排骨汤','紫菜蛋花汤','玉米排骨汤'
    ];

    const SPECIALS = {
        hotpot:        { name: '火锅', emoji: '🍲' },
        instantnoodle: { name: '泡面', emoji: '🍜' }
    };

    const EAT_TEXTS = {
        breakfast: [
            '吃得很快，边穿鞋边往嘴里塞，差点迟到',
            '还没完全醒，慢慢地嚼，眼睛都没睁开',
            '站着吃的，几口就解决了',
            '难得坐下来好好吃，还发了会儿呆',
            '吃了一半就放下了，好像没什么胃口'
        ],
        lunch: [
            '吃得挺香，光盘了',
            '边吃边刷手机，慢慢悠悠',
            '随便扒拉两口，没什么胃口',
            '和同事一起吃的，聊得挺开心',
            '外卖到了凉了一半，将就吃了'
        ],
        dinner: [
            '吃得很满足，今天没亏待自己',
            '一个人吃的，有点安静',
            '边看剧边吃，吃了很久',
            '吃得有点撑，现在瘫着了',
            '简单吃了点，不太饿'
        ]
    };

    const SPECIAL_TEXTS = {
        hotpot: [
            '热气腾腾的，吃出一身汗',
            '一个人吃的，锅底是辣的，心里是空的',
            '吃得特别久，边涮边想事情',
            '和朋友一起吃的，很热闹',
            '吃到最后有点撑，剩了一点'
        ],
        instantnoodle: [
            '加班太晚了，随手泡了一碗',
            '没什么胃口，随便垫一下',
            '加了蛋和火腿肠，认真对待了一下',
            '蹲在厨房吃的，边刷手机',
            '吃完意犹未尽，又泡了一盒'
        ]
    };

    const REMIND_TEXTS = [
        '{名字}还没吃{餐}呢，我替你提醒 Ta 了',
        '{名字}还没动筷子，已经帮你说过一声啦',
        'Ta 的{餐}还没着落，我催过 Ta 了'
    ];

    const FORGOT_TEXTS = [
        '{名字}好像把{餐}给忘了……',
        '{名字}今天没顾上吃{餐}，有点心疼',
        '{餐}被{名字}跳过了，等会儿得说说 Ta',
        '{名字}的{餐}不知道去哪儿了',
        '看来今天太忙，{名字}连{餐}都没顾上'
    ];

    const WINDOWS = {
        breakfast: { start: 7 * 60,       end: 10 * 60 + 30 },
        lunch:     { start: 11 * 60 + 30, end: 14 * 60 },
        dinner:    { start: 17 * 60 + 30, end: 19 * 60 }
    };

    const MEAL_NAME  = { breakfast: '早饭', lunch: '午饭', dinner: '晚饭' };
    const MEAL_EMOJI = { breakfast: '🌅', lunch: '🍱', dinner: '🌙' };

    /* ============================================================
     * 二、此刻心情 —— 数据池
     * ============================================================ */

    const MOOD_POOL = [
        { mood: '平静',   emoji: '🌿', color: '#8fbf8f', texts: [
            '窗外有风，心里什么都没想',
            '什么都没做，也不觉得浪费',
            '呼吸很稳，时间过得很慢',
            '坐着发呆，挺好的',
            '心是软的，没什么波澜'
        ]},
        { mood: '开心',   emoji: '☀️', color: '#C58AFF', texts: [
            '莫名其妙地心情好',
            '嘴角压不下去，也不知道在高兴什么',
            '今天什么都顺，连红灯都变绿',
            '想找人分享，第一个想到你',
            '笑得有点傻，但停不下来'
        ]},
        { mood: '想你',   emoji: '💭', color: '#FF8AEC', texts: [
            '看到你头像的时候愣了一下',
            '突然很想听见你的声音',
            '明明才分开一会儿',
            '手机拿起来又放下，想找你说话',
            '心空了一块，是你不在的那块'
        ]},
        { mood: '疲惫',   emoji: '😮‍💨', color: '#8a9aad', texts: [
            '骨头都是软的，什么都不想干',
            '眼睛酸，脑子转不动',
            '只想找个地方躺着，谁也别叫',
            '一整天的力气都用完了',
            '累到连叹气都懒'
        ]},
        { mood: '心不在焉', emoji: '🌫️', color: '#a8a8a8', texts: [
            '一下午都在神游',
            '看着屏幕，其实什么也没看进去',
            '别人说话我要听两遍',
            '心飘到很远的地方去了',
            '手在做事，魂不在身上'
        ]},
        { mood: '期待',   emoji: '✨', color: '#8AFFE8', texts: [
            '有什么好事要发生的感觉',
            '心里痒痒的，坐不太住',
            '总觉得今天会有惊喜',
            '数着时间等一件事',
            '心里揣着一只小兔子'
        ]},
        { mood: '发呆',   emoji: '🫧', color: '#8fb8cc', texts: [
            '盯着一处看了很久，什么都没想',
            '时间好像在打盹',
            '脑袋空的，但很舒服',
            '不知道自己在想什么，也不想想',
            '一晃神，半小时就过去了'
        ]},
        { mood: '安心',   emoji: '🕯️', color: '#d8a878', texts: [
            '一切都刚刚好',
            '心是踏实的，落在地上',
            '没有什么担心的',
            '暖洋洋的，像晒过太阳',
            '就这样待着，很好'
        ]},
        { mood: '有点丧', emoji: '🌧️', color: '#9a90b8', texts: [
            '没什么特别的原因，就是提不起劲',
            '灰蒙蒙的，像今天的天气',
            '不想说话，也不想被打扰',
            '心里堵着点什么，又说不清',
            '安静地难过，也不为谁'
        ]},
        { mood: '焦躁',   emoji: '🔥', color: '#d88878', texts: [
            '坐也不是站也不是',
            '心里有团火，找不到出口',
            '什么都觉得烦',
            '想砸点东西，又没理由',
            '时间过得太慢，慢得让人烦'
        ]},
        { mood: '温柔',   emoji: '🌸', color: '#e8a8bc', texts: [
            '看什么都觉得可爱',
            '心里软软的，像化了的糖',
            '想对全世界都好一点',
            '想起你的时候，眼睛弯弯的',
            '风都变得温柔了'
        ]},
        { mood: '空空的', emoji: '🌌', color: '#708090', texts: [
            '什么都没想，也什么都不想做',
            '心里像空了一块',
            '像房间没开灯',
            '有点寂寞，但说不上来',
            '就这么空着，也挺好'
        ]}
    ];

    /* ============================================================
     * 三、通用工具
     * ============================================================ */

    const STORE_KEY      = 'wyd_data';
    const MOOD_STORE_KEY = 'wyd_mood_data';

    function todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    function nowMin() {
        const fake = localStorage.getItem('wyd_fake_min');
        if (fake !== null) return parseInt(fake, 10);
        const d = new Date();
        return d.getHours() * 60 + d.getMinutes();
    }

    function nowHour() { return Math.floor(nowMin() / 60); }

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function pickN(arr, n) {
        const copy = arr.slice(); const out = [];
        for (let i = 0; i < n && copy.length; i++) {
            out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
        }
        return out;
    }
    function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
    function fmtTime(min) {
        return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
    }
    function getPartnerName() {
        try {
            return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
        } catch (e) { return '梦角'; }
    }

    function hexToRgba(hex, alpha) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function cardSleeping(text) {
        return `
        <div class="wyd-card wyd-card-sleep">
            <div class="wyd-sleep-emoji">🌙</div>
            <div class="wyd-sleep-text">${text}</div>
        </div>`;
    }

    /* ============================================================
     * 四、揭晓状态
     * ============================================================ */

    function isRevealed(tab) {
        try { return localStorage.getItem('wyd_revealed_' + tab) === todayStr(); }
        catch (e) { return false; }
    }

    function markRevealed(tab) {
        try { localStorage.setItem('wyd_revealed_' + tab, todayStr()); }
        catch (e) {}
    }

    function renderAskPlaceholder(tab) {
        const map = {
            eat:   { icon: '🍚', line1: '今天还没问过 Ta 吃了什么',  line2: '点下方按钮，问一下 Ta' },
            mood:  { icon: '💭', line1: '今天还没问过 Ta 的心情',    line2: '点下方按钮，问一下 Ta' },
            where: { icon: '📍', line1: '今天还没问过 Ta 在做什么',  line2: '点下方按钮，问一下 Ta' }
        };
        const h = map[tab] || map.eat;
        return `
        <div class="wyd-card wyd-card-empty" style="text-align:center;padding:42px 16px;">
            <div style="font-size:40px;margin-bottom:14px;opacity:.75;">${h.icon}</div>
            <div style="font-size:13.5px;color:var(--text-secondary);line-height:1.8;letter-spacing:.3px;">
                ${h.line1}<br>
                <span style="font-size:12px;opacity:.65;">${h.line2}</span>
            </div>
        </div>`;
    }

    /* ============================================================
     * 五、和 where.js 联动
     * ============================================================ */

    function isPartnerSleeping() {
        try {
            if (!window.WydWhere || typeof window.WydWhere.loadPlan !== 'function') return false;
            const plan = window.WydWhere.loadPlan();
            if (!plan || !plan.visits) return false;

            const t = nowMin();
            for (const v of plan.visits) {
                if (t >= v.start && t < v.end) return v.phase === 'sleep';
            }
        } catch (e) {}
        return false;
    }

    /* ============================================================
     * 六、吃饭逻辑
     * ============================================================ */

    function randTimeInWindow(type) {
        const w = WINDOWS[type];
        return randInt(w.start, w.end);
    }

    function rollBreakfast() {
        const eat = Math.random() >= 0.2;
        if (!eat) return { eat: false, dishes: [], eatTime: null, special: null, textIdx: 0 };
        return {
            eat: true,
            dishes: pickN(BREAKFAST_DISHES, randInt(1, 2)),
            eatTime: randTimeInWindow('breakfast'),
            special: null,
            textIdx: randInt(0, 4)
        };
    }

    function rollLunchOrDinner(type, excludeDishes) {
        const eat = Math.random() >= 0.2;
        if (!eat) return { eat: false, dishes: [], eatTime: null, special: null, textIdx: 0 };

        if (Math.random() < 0.05) {
            const key = Math.random() < 0.5 ? 'hotpot' : 'instantnoodle';
            return {
                eat: true,
                dishes: [SPECIALS[key].name],
                eatTime: randTimeInWindow(type),
                special: key,
                textIdx: randInt(0, 4)
            };
        }

        let pool = LUNCH_DINNER_DISHES;
        if (type === 'dinner' && excludeDishes && excludeDishes.length) {
            const filtered = pool.filter(d => !excludeDishes.includes(d));
            if (filtered.length >= 2) pool = filtered;
        }
        return {
            eat: true,
            dishes: pickN(pool, randInt(2, 4)),
            eatTime: randTimeInWindow(type),
            special: null,
            textIdx: randInt(0, 4)
        };
    }

    function initToday() {
        const b = rollBreakfast();
        const l = rollLunchOrDinner('lunch', []);
        const d = rollLunchOrDinner('dinner', l.dishes);

        const notEatingCount = [b, l, d].filter(m => !m.eat).length;
        if (notEatingCount === 3) {
            const idx = randInt(0, 2);
            if (idx === 0) {
                b.eat = true;
                b.dishes = pickN(BREAKFAST_DISHES, randInt(1, 2));
                b.eatTime = randTimeInWindow('breakfast');
                b.textIdx = randInt(0, 4);
            } else if (idx === 1) {
                Object.assign(l, rollLunchOrDinner('lunch', []));
            } else {
                Object.assign(d, rollLunchOrDinner('dinner', l.dishes));
            }
        }

        return {
            date: todayStr(),
            meals: { breakfast: b, lunch: l, dinner: d }
        };
    }

    function loadToday() {
        let data = null;
        try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
        if (!data || data.date !== todayStr()) {
            data = initToday();
            try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}

            // 新增：如果今天有火锅，清掉 where plan（下次打开"在做什么"会重新生成并联动）
            const hasHotpot = ['lunch', 'dinner'].some(k =>
                data.meals[k] && data.meals[k].eat && data.meals[k].special === 'hotpot'
            );
            if (hasHotpot) {
                try { localStorage.removeItem('wyd_where_plan'); } catch (e) {}
            }
        }
        return data;
    }

    function getStage() {
        const t = nowMin();
        if (t < 7 * 60) return 'sleeping';
        if (t < 11 * 60 + 30) return 'breakfastOnly';
        if (t < 17 * 60 + 30) return 'breakfastLunch';
        return 'allThree';
    }

    function cardFull(type, meal) {
        const emoji = MEAL_EMOJI[type];
        const name  = MEAL_NAME[type];
        const time  = fmtTime(meal.eatTime);

        let dishesHtml = '';
        if (meal.special) {
            dishesHtml = `<div class="wyd-dishes">${SPECIALS[meal.special].emoji} ${SPECIALS[meal.special].name}</div>`;
        } else {
            const d = meal.dishes;
            if (d.length <= 2) {
                dishesHtml = `<div class="wyd-dishes">${d.join(' · ')}</div>`;
            } else {
                dishesHtml = `<div class="wyd-dishes">${d.slice(0, 2).join(' · ')}<br>${d.slice(2).join(' · ')}</div>`;
            }
        }

        const textPool = meal.special ? SPECIAL_TEXTS[meal.special] : EAT_TEXTS[type];
        const eatText  = textPool[meal.textIdx] || textPool[0];

        return `
        <div class="wyd-card">
            <div class="wyd-card-head">
                <span class="wyd-card-title">${emoji} ${name}</span>
                <span class="wyd-card-time">${time} 已吃</span>
            </div>
            ${dishesHtml}
            <div class="wyd-card-text">${eatText}</div>
        </div>`;
    }

    function cardEmpty(type, meal, state) {
        const emoji = MEAL_EMOJI[type];
        const name  = MEAL_NAME[type];
        const pname = getPartnerName();
        let text, tag;

        if (state === 'pending') {
            text = pick(REMIND_TEXTS).replace(/\{名字\}/g, pname).replace(/\{餐\}/g, name);
            tag  = '还没吃';
        } else {
            text = pick(FORGOT_TEXTS).replace(/\{名字\}/g, pname).replace(/\{餐\}/g, name);
            tag  = '已过饭点';
        }

        return `
        <div class="wyd-card wyd-card-empty">
            <div class="wyd-card-head">
                <span class="wyd-card-title">${emoji} ${name}</span>
                <span class="wyd-card-time">${tag}</span>
            </div>
            <div class="wyd-card-text">${text}</div>
        </div>`;
    }

    function renderMeal(type, meal) {
        const t = nowMin();
        const w = WINDOWS[type];

        if (!meal.eat) {
            if (t < w.end) return cardEmpty(type, meal, 'pending');
            return cardEmpty(type, meal, 'missed');
        }
        if (t < meal.eatTime) return cardEmpty(type, meal, 'pending');
        return cardFull(type, meal);
    }

    function renderEat() {
        const box = document.getElementById('wyd-meals-container');
        if (!box) return;

        if (isPartnerSleeping()) {
            box.innerHTML = cardSleeping('Ta 还没醒，今天还没开始呢');
            return;
        }

        const data  = loadToday();
        const stage = getStage();

        let html = '';
        html += renderMeal('breakfast', data.meals.breakfast);
        if (stage !== 'breakfastOnly') html += renderMeal('lunch', data.meals.lunch);
        if (stage === 'allThree')      html += renderMeal('dinner', data.meals.dinner);
        box.innerHTML = html;
    }

    /* ============================================================
     * 七、心情逻辑
     * ============================================================ */

    function loadMoodData() {
        let data = null;
        try { data = JSON.parse(localStorage.getItem(MOOD_STORE_KEY) || 'null'); } catch (e) {}
        if (!data || data.date !== todayStr()) {
            data = { date: todayStr(), moods: {} };
            try { localStorage.setItem(MOOD_STORE_KEY, JSON.stringify(data)); } catch (e) {}
        }
        return data;
    }

    function saveMoodData(data) {
        try { localStorage.setItem(MOOD_STORE_KEY, JSON.stringify(data)); } catch (e) {}
    }

    function ensureMoodForHour(hour) {
        const data = loadMoodData();
        if (data.moods[hour]) return data.moods[hour];
        const mood = pick(MOOD_POOL);
        const entry = {
            mood: mood.mood,
            emoji: mood.emoji,
            textIdx: randInt(0, mood.texts.length - 1),
            ts: Date.now()
        };
        data.moods[hour] = entry;
        saveMoodData(data);
        return entry;
    }

    /**
     * renderMood(generate)
     *   generate = true  → 记录当前小时的心情（如果是新的一小时），然后渲染
     *   generate = false → 只渲染已记录的心情
     */
    function renderMood(generate) {
        const box = document.getElementById('wyd-meals-container');
        if (!box) return;

        if (isPartnerSleeping()) {
            box.innerHTML = cardSleeping('Ta 还没醒，今天的心情还没开始呢');
            return;
        }

        if (generate) {
            ensureMoodForHour(nowHour());
        }

        const data  = loadMoodData();
        const hours = Object.keys(data.moods).map(Number).sort((a, b) => a - b);

        if (hours.length === 0) {
            box.innerHTML = renderAskPlaceholder('mood');
            return;
        }

        let html = '';
        hours.forEach(hour => {
            const e    = data.moods[hour];
            const mood = MOOD_POOL.find(m => m.mood === e.mood) || MOOD_POOL[0];
            const text = mood.texts[e.textIdx] || mood.texts[0];
            const range = String(hour).padStart(2, '0') + ':00 - ' +
                          String((hour + 1) % 24).padStart(2, '0') + ':00';
            const color = mood.color || '#999';
            html += `
            <div class="wyd-card wyd-mood-card" style="background:${hexToRgba(color, 0.06)};border-color:${hexToRgba(color, 0.22)};border-left:3px solid ${color};">
                <div class="wyd-card-head">
                    <span class="wyd-card-title" style="color:${color};">${e.emoji} ${range}</span>
                    <span class="wyd-card-time" style="color:${hexToRgba(color, 0.75)};">${e.mood}</span>
                </div>
                <div class="wyd-card-text">${text}</div>
            </div>`;
        });

        box.innerHTML = html;
    }

    /* ============================================================
     * 八、在做什么（委托给 where.js）
     * ============================================================ */

    function renderWhere(generate) {
        if (window.WydWhere && typeof window.WydWhere.render === 'function') {
            window.WydWhere.render(generate);
        } else {
            const box = document.getElementById('wyd-meals-container');
            if (box) box.innerHTML = cardSleeping('地图模块还没加载');
        }
    }

    /* ============================================================
     * 九、Tab 与按钮
     * ============================================================ */

    const TAB_META = {
        eat:   { btn: 'Ta 吃了没',    toast: '吃了没' },
        mood:  { btn: 'Ta 的心情',    toast: '的心情' },
        where: { btn: 'Ta 在做什么',  toast: '在做什么' }
    };

    let currentTab = 'eat';

    function updateBottomBtn() {
        const btn = document.getElementById('wyd-ask-btn');
        if (!btn) return;
        const meta = TAB_META[currentTab];
        if (meta) btn.textContent = meta.btn;
    }

    /** 切换 tab / 打开时渲染：如果今天还没揭晓过，显示占位符 */
    function render() {
        const box = document.getElementById('wyd-meals-container');
        if (!box) return;

        if (!isRevealed(currentTab)) {
            box.innerHTML = renderAskPlaceholder(currentTab);
            updateBottomBtn();
            return;
        }

        if (currentTab === 'eat')        renderEat();
        else if (currentTab === 'mood')  renderMood(false);
        else if (currentTab === 'where') renderWhere(false);
        else                             box.innerHTML = cardSleeping('这个功能还在路上 ✦');
        updateBottomBtn();
    }

    /** 点击底部按钮：揭晓 + 生成当前数据 */
    function handleAsk() {
        const pname = getPartnerName();
        const meta  = TAB_META[currentTab];

        markRevealed(currentTab);

        if (currentTab === 'eat') {
            renderEat();
        } else if (currentTab === 'mood') {
            renderMood(true);      // 记录当前小时
        } else if (currentTab === 'where') {
            renderWhere(true);     // 定位到当前地点
        }

        const box = document.getElementById('wyd-meals-container');
        if (box) {
            box.classList.remove('wyd-revealing');
            void box.offsetWidth;
            box.classList.add('wyd-revealing');
        }

        toast('已经帮你问过' + pname + meta.toast + '啦 ✦');
    }

    /* ============================================================
     * 十、Toast
     * ============================================================ */

    function toast(msg) {
        let el = document.getElementById('wyd-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'wyd-toast';
            el.className = 'wyd-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 2200);
    }

    /* ============================================================
     * 十一、初始化
     * ============================================================ */

    window.openWYD = function () {
        render();
        showModal(document.getElementById('wyd-modal'));
    };
    /* ============================================================
     * 十三、导出给 where.js 使用
     * ============================================================ */
    window.WydMeal = {
        ensureToday: function () { return loadToday(); },
        getToday: function () {
            try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
            catch (e) { return null; }
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.wyd-tab').forEach(tab => {
            if (tab.classList.contains('disabled')) return;
            tab.addEventListener('click', () => {
                if (tab.dataset.tab === currentTab) return;
                document.querySelectorAll('.wyd-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                render();
            });
        });

        const btn = document.getElementById('wyd-ask-btn');
        if (btn) btn.addEventListener('click', handleAsk);

        // 跨零点自动刷新
        let lastDate = todayStr();
        setInterval(() => {
            const now = todayStr();
            if (now !== lastDate) {
                lastDate = now;
                render();
            }
        }, 60 * 1000);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            const now = todayStr();
            if (now !== lastDate) {
                lastDate = now;
                render();
            }
        });
    });

    /* ============================================================
     * 十二、样式注入
     * ============================================================ */

    const css = `
    .wyd-tabs{display:flex;gap:6px;padding:14px 16px 10px;border-bottom:1px solid var(--border-color);flex-shrink:0;}
    .wyd-tab{flex:1;padding:9px 6px;border-radius:12px;border:1px solid transparent;background:transparent;
        font-size:12.5px;font-family:var(--font-family);color:var(--text-secondary);cursor:pointer;
        transition:all .2s;white-space:nowrap;}
    .wyd-tab.active{background:rgba(var(--accent-color-rgb),0.12);color:var(--accent-color);
        font-weight:600;border-color:rgba(var(--accent-color-rgb),0.25);}
    .wyd-tab.disabled{color:var(--text-secondary);opacity:.4;cursor:not-allowed;}

    .wyd-body{
        height:420px;
        max-height:62vh;
        overflow-y:auto;
        -webkit-overflow-scrolling:touch;
        padding:14px 16px;
        display:flex;
        flex-direction:column;
        gap:12px;
        background:var(--primary-bg);
        box-sizing:border-box;
    }

    .wyd-footer{display:flex;gap:8px;padding:12px 16px;
        border-top:1px solid var(--border-color);background:var(--secondary-bg);
        padding-bottom:max(12px,env(safe-area-inset-bottom,0px));
        flex-shrink:0;}

    .wyd-footer .modal-btn{height:44px;display:flex;align-items:center;justify-content:center;padding:0 20px;}
    .wyd-footer #wyd-ask-btn{flex:1;}

    .wyd-card{background:var(--secondary-bg);border:1px solid var(--border-color);
        border-radius:14px;padding:14px 16px;flex-shrink:0;}
    .wyd-card-empty{border-style:dashed;background:transparent;opacity:.9;}
    .wyd-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
    .wyd-card-title{font-size:14px;font-weight:600;color:var(--text-primary);}
    .wyd-card-time{font-size:11px;color:var(--text-secondary);letter-spacing:.3px;}
    .wyd-dishes{font-size:13.5px;color:var(--accent-color);line-height:1.7;font-weight:500;margin-bottom:8px;}
    .wyd-card-text{font-size:13px;color:var(--text-secondary);line-height:1.6;}
    .wyd-card-sleep{text-align:center;padding:28px 16px;}
    .wyd-sleep-emoji{font-size:36px;margin-bottom:10px;opacity:.85;}
    .wyd-sleep-text{font-size:13px;color:var(--text-secondary);letter-spacing:.3px;}

    .wyd-toast{position:fixed;left:50%;bottom:100px;transform:translate(-50%,20px);
        background:rgba(0,0,0,0.82);color:#fff;font-size:13px;padding:10px 18px;border-radius:20px;
        opacity:0;pointer-events:none;transition:all .3s;z-index:9999;font-family:var(--font-family);
        max-width:80vw;text-align:center;}
    .wyd-toast.show{opacity:1;transform:translate(-50%,0);}

    #wyd-meals-container.wyd-revealing{animation:wyd-reveal .42s cubic-bezier(.22,.9,.3,1);}
    @keyframes wyd-reveal{
        0%   {opacity:0;transform:translateY(10px);}
        60%  {opacity:1;transform:translateY(-2px);}
        100% {opacity:1;transform:translateY(0);}
    }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
})();