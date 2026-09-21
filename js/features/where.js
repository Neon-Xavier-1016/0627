/* ============================================================
 * 你在干嘛 · 在做什么
 * 地图定位 + 每日行程 + 片段切分 + 火锅联动
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. 地点数据 ---------- */
  const PLACES = [
    { id: 'place1',  name: 'N109区',            x: 3.43,  y: 12.43, weight: 1, durationTier: 'short' },
    { id: 'place2',  name: '回溯II号',          x: 13.5,  y: 31.36, weight: 2, durationTier: 'short' },
    { id: 'place3',  name: '禁猎区',            x: 11.68, y: 39.91, weight: 8, durationTier: 'long' },
    { id: 'place4',  name: 'Philo花店',         x: 29.12, y: 35.02, weight: 8, durationTier: 'long' },
    { id: 'place5',  name: '临空图书馆',        x: 39.05, y: 38.6,  weight: 2, durationTier: 'short' },
    { id: 'place6',  name: '猎人协会',          x: 47.88, y: 43.31, weight: 8, durationTier: 'long' },
    { id: 'place7',  name: '猎人公寓',          x: 50,    y: 46.8,  weight: 8, isHome: true },
    { id: 'place8',  name: 'AKSO',              x: 45.69, y: 46.71, weight: 2, durationTier: 'short' },
    { id: 'place9',  name: 'Mr.selfdom',        x: 43.5,  y: 50.81, weight: 1, durationTier: 'short' },
    { id: 'place10', name: '寰飞商厦',          x: 58.54, y: 58.92, weight: 4, durationTier: 'long' },
    { id: 'place11', name: '遇见咖啡馆',        x: 54.82, y: 64.24, weight: 4, durationTier: 'mid' },
    { id: 'place12', name: '塔罗店',            x: 44.45, y: 72.53, weight: 4, durationTier: 'short' },
    { id: 'place13', name: '陶艺店',            x: 52.48, y: 80.56, weight: 4, durationTier: 'short' },
    { id: 'place14', name: '霓光植物园',        x: 56.64, y: 89.1,  weight: 2, durationTier: 'mid' },
    { id: 'place15', name: '星海游乐园',        x: 67.15, y: 51.42, weight: 2, durationTier: 'mid' },
    { id: 'place16', name: '新信岛',            x: 84.23, y: 77.85, weight: 2, durationTier: 'mid' },
    { id: 'place17', name: '临空滨海森林公园',  x: 59.71, y: 78.46, weight: 2, durationTier: 'long' },
    { id: 'place18', name: 'Twinkle潮玩店',     x: 51.68, y: 30.14, weight: 4, durationTier: 'short' },
    { id: 'place19', name: '蚁巢酒吧',          x: 21.9,  y: 48.28, weight: 2, durationTier: 'mid' },
    { id: 'place20', name: '花园别墅',          x: 34.74, y: 53.25, weight: 8, isHome: true }
  ];

  /* ---------- 2. 文案池（按档位补齐） ---------- */
  const ACTIONS = {
    place1: [
      { category: '工作中', texts: [
        '和暗点的人谈判中，气氛紧绷',
        '正在执行某个秘密任务',
        '处理一些不太方便公开的事务'
      ]},
      { category: '观察中', texts: [
        '观察周围的动静，保持警觉',
        '在人群中穿行，注意着每一个角落',
        '角落里坐着，视线一直没停'
      ]},
      { category: '休息中', texts: [
        '找了个安静的地方歇一会儿',
        '靠着墙闭眼休息几分钟',
        '买了杯东西坐下来缓一缓'
      ]},
      { category: '等待中', texts: [
        '在等什么人，时不时看表',
        '靠在栏杆上等消息',
        '无聊地踢着脚下的石子'
      ]}
    ],
    place2: [
      { category: '工作中', texts: [
        '试图修好飞船',
        '貌似来寻找芯核',
        '检查设备的运转情况'
      ]},
      { category: '检修中', texts: [
        '钻进舱底检查线路',
        '对着控制台敲敲打打',
        '擦拭着仪器外壳'
      ]},
      { category: '研究中', texts: [
        '盯着屏幕看数据',
        '翻着一本旧手册',
        '皱眉思考着什么'
      ]}
    ],
    place3: [
      { category: '工作中', texts: [
        '接到特令，进入禁猎区调查异能量波动的原因',
        '提前扫除大型流浪体，受了一点小伤',
        '发现森林中被人动过手脚的引力锚装置，寻找并解除引力锚',
        '发现芯核被暗点改造过的磁线，追查芯核改造痕迹',
        '独自追查暗点的线索'
      ]},
      { category: '追踪中', texts: [
        '跟着一只流浪体的痕迹深入林区',
        '在林间穿行，偶尔停下来辨认方向',
        '沿着异能量反应的方向追下去'
      ]},
      { category: '战斗后休息', texts: [
        '打完一场，靠着树喘口气',
        '检查装备，看有没有损耗',
        '简单处理一下伤口，准备继续'
      ]},
      { category: '观察中', texts: [
        '蹲在树后观察远处的动静',
        '躲在掩体后面记录着什么',
        '举起望远镜扫视前方'
      ]}
    ],
    place4: [
      { category: '看店中', texts: ['邱诺亚不在，待在花店里帮忙打理呢'] },
      { category: '照顾花材中', texts: [
        '给花浇水中，照顾的好像不是很好，是故意的吗？',
        '拿着小喷壶给月桂树喷水，明明那棵月桂树是耐旱植物、怕积水，还在不停地喷'
      ]},
      { category: '学习插花中', texts: ['拿花店的花学习插花中，邱诺亚发出尖锐爆鸣！'] },
      { category: '挑选花品中', texts: ['一排排看过去，挑选今天要用的花材'] },
      { category: '聊天中', texts: ['和邱诺亚谈论重要机密中'] },
      { category: '无所事事中', texts: ['无所事事地坐在花丛中发呆，整个人坐在一堆花里面，安安静静的，身上还飘着小光点'] }
    ],
    place5: [
      { category: '看书中', texts: ['看《深空猎人进阶指南》，一目十行看的飞快'] },
      { category: '找书中', texts: ['在旧馆纸质书架间穿行，手指拂过书脊上的标签慢慢找书'] },
      { category: '犯困中', texts: ['坐在窗边有点困，疯狂点头中'] },
      { category: '借书中', texts: [
        '在借阅台办手续',
        '拿着一摞书准备借走',
        '犹豫要不要再多借一本'
      ]}
    ],
    place6: [
      { category: '工作中', texts: [
        '出外勤打流浪体',
        '给年轻 Evolver 传授战斗技巧',
        '执行秘密任务，这次又假扮什么身份呢？',
        '暗中协调灾后救援，送伤员去中心医院、关注物资分配和儿童病房，忙的很呀'
      ]},
      { category: '会议中', texts: [
        '在会议室里开会',
        '听取上级的任务汇报',
        '和其他猎人讨论作战方案'
      ]},
      { category: '训练中', texts: [
        '在训练场练习射击',
        '陪新兵过过招',
        '自己也在体能训练'
      ]},
      { category: '整理文件中', texts: [
        '在整理任务报告',
        '核对伤员名单',
        '归档一批资料'
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
      { category: '吃饭中', texts: ['在吃自己的作战成果，好像还不错'] },
      { category: '发呆中', texts: [
        '坐在窗边发呆，什么也没想',
        '盯着某个角落看了很久',
        '手里拿着东西忘了放下'
      ]}
    ],
    place8: [
      { category: '看病中', texts: [
        '发烧了，貌似有点难受',
        '感冒了来拿一些药吃',
        '做身体检查中，好像很健康呢',
        '工作受伤了，来医院包扎',
        '看病中，很难受的样子'
      ]},
      { category: '陪诊中', texts: [
        '陪着朋友来看病',
        '在候诊区等着',
        '帮人跑上跑下拿单子'
      ]},
      { category: '拿药中', texts: [
        '在药房排队拿药',
        '和药师交代注意事项',
        '仔细看说明书'
      ]}
    ],
    place9: [
      { category: '购物中', texts: [
        '为自己置办新行头，能不能讨{user}欢心呢',
        '对着镜子试了好几件',
        '手里的袋子越来越沉'
      ]},
      { category: '试衣中', texts: [
        '在试衣间里对着镜子打量',
        '拿了几件反复比较',
        '出来照镜子确认合不合适'
      ]},
      { category: '闲逛中', texts: [
        '在店里随便看看',
        '对着橱窗里的东西发呆',
        '翻看着货架上的新品'
      ]}
    ],
    place10: [
      { category: '购物', texts: ['外出采购食材，周末准备自己下厨'] },
      { category: '看电影', texts: ['新出的电影，迫不及待购买电影票，是恐怖元素吗？'] },
      { category: '吃东西', texts: [
        '发现的新自助餐，老板的眼神不妙！',
        '犹豫吃什么中，谁家看着好吃就吃谁家'
      ]},
      { category: '无所事事中', texts: ['无所事事闲逛中，要看电影还是购物呢？'] },
      /* 火锅：仅供联动使用，不参与随机 */
      { category: '吃火锅', exclusive: true, texts: [
        '大吃兔咪火锅中，已经等了好久了，貌似只点了肉食呢'
      ]}
    ],
    place11: [
      { category: '喝咖啡', texts: [
        '等{user}回来中，{user}什么时候会出现在这里呢',
        '点了一杯热美式，喝到一半凉了，也没在意',
        '坐在吧台边，慢慢喝，眼睛时不时往门口瞟'
      ]},
      { category: '看书中', texts: [
        '在靠窗的位置翻书，阳光刚好落在书页上',
        '书翻了大半，咖啡早凉了，也没察觉',
        '看得很专注，偶尔抬头，像是在确认什么'
      ]},
      { category: '发呆中', texts: [
        '捧着杯子发呆，热气一点点散尽',
        '看着窗外的人来人往，不知道在想什么',
        '坐在角落里，安静得像一幅画'
      ]},
      { category: '写东西中', texts: [
        '在便签纸上写着什么，写完又揉掉重来',
        '低头写着东西，偶尔停下来喝一口咖啡',
        '像是在记录什么，笔尖停停走走'
      ]}
    ],
    place12: [
      { category: '算塔罗', texts: [
        '给{user}传讯中，很期待{user}的回复',
        '梦占中，{user}到底爱不爱我呀！',
        '为{user}占了一卦，正琢磨牌面'
      ]},
      { category: '洗牌中', texts: [
        '认真地洗着牌',
        '让来客抽一张',
        '把牌摊开等着选择'
      ]},
      { category: '解牌中', texts: [
        '对着牌面仔细解读',
        '把牌一张张摆开',
        '轻声说着牌面的含义'
      ]}
    ],
    place13: [
      { category: '陶艺中', texts: [
        '做一个{user}的形象，这样就可以每天都看到{user}了！',
        '捏着陶土，慢慢塑形',
        '袖子挽起来，认真地捏着'
      ]},
      { category: '上釉中', texts: [
        '给做好的陶坯上色',
        '认真挑选釉彩',
        '一层层刷着颜色'
      ]},
      { category: '等烧制中', texts: [
        '在窑前等着',
        '看着窑炉里的火光',
        '盯着时间，盼着快点好'
      ]}
    ],
    place14: [
      { category: '游玩中', texts: [
        '很悠闲，很想和{user}一起玩，想你',
        '莫名其妙又想到{user}，感觉很孤独',
        '玩的很开心，终于可以放松了！',
        '团建中，和大家一起感觉很放松'
      ]},
      { category: '看植物', texts: [
        '在温室里慢慢走，看各种花',
        '蹲下来拍一株多肉',
        '对着介绍牌研究植物名'
      ]},
      { category: '拍照中', texts: [
        '在花丛前留影',
        '拍了张照片想发给你',
        '找角度拍了好久'
      ]}
    ],
    place15: [
      { category: '游玩中', texts: [
        '很悠闲，很想和{user}一起玩，想你',
        '莫名其妙又想到{user}，感觉很孤独',
        '玩的很开心，终于可以放松了！',
        '团建中，和大家一起感觉很放松'
      ]},
      { category: '排队中', texts: [
        '排着队等一个项目',
        '人群里站了好久，看看手机',
        '队伍慢慢往前挪'
      ]},
      { category: '坐设施中', texts: [
        '在过山车上喊得很大声',
        '坐旋转木马，转得有点晕',
        '试了摩天轮，从高处看下来'
      ]},
      { category: '吃东西', texts: [
        '在路边买了个冰淇淋',
        '排了个棉花糖',
        '找了家小店坐下来歇一会儿'
      ]}
    ],
    place16: [
      { category: '度假中', texts: [
        '很悠闲，很想和{user}一起玩，想你',
        '莫名其妙又想到{user}，感觉很孤独',
        '玩的很开心，终于可以放松了！',
        '想起上次和你一起玩的日子，有点怀念'
      ]},
      { category: '海边散步', texts: [
        '沿着海岸线慢慢走',
        '赤脚踩在沙滩上',
        '海风很大，头发都吹乱了'
      ]},
      { category: '看日落', texts: [
        '找了个好位置等日落',
        '看着太阳一点点沉下去',
        '拍下天边的颜色'
      ]}
    ],
    place17: [
      { category: '游玩中', texts: [
        '很悠闲，很想和{user}一起玩，想你',
        '莫名其妙又想到{user}，感觉很孤独',
        '玩的很开心，终于可以放松了！',
        '团建中，和大家一起感觉很放松',
        '观察自然景观真让人放松'
      ]},
      { category: '散步中', texts: [
        '沿着步道慢慢走',
        '海风吹过来，很舒服',
        '踩着沙子走了一段'
      ]},
      { category: '看海', texts: [
        '坐在礁石上看海',
        '看着海浪一层层推上来',
        '盯着远处的地平线发呆'
      ]},
      { category: '拍照中', texts: [
        '举着手机拍风景',
        '拍了几张想发给你',
        '对着天空拍了一堆云'
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
      ]},
      { category: '聊天中', texts: [
        '和旁边的人聊得挺投机',
        '被拉去听人讲了个很长的事',
        '和同事吐槽了一晚上'
      ]},
      { category: '听音乐中', texts: [
        '听驻唱唱了一首老歌',
        '跟着节奏轻轻点头',
        '背景音乐刚好放到了喜欢的'
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

  /* ---------- 2.5 时长档位 & 通勤 & 概率 ---------- */
  const TIER_DURATION = {
    long:  [150, 240],
    mid:   [90, 150],
    short: [30, 90]
  };
  const TIER_ORDER = ['long', 'mid', 'short'];

  const NO_GOING_OUT_RATE = 0.17;
  const MID_HOME_RATE     = 0.15;
  const COMMUTE_MIN       = 15;
  const COMMUTE_MAX       = 30;

  const COMMUTE_TEXTS = [
    '在路上，耳机里放着歌',
    '车窗外的景一直往后退，没怎么看进去',
    '走过去的，路上风挺舒服',
    '打了个车，路上堵了一小会儿',
    '拐过几个街角，脑子里还在想刚才的事',
    '脚步不快，也不赶时间'
  ];

  const HOTPOT_TEXT = '大吃兔咪火锅中，已经等了好久了，貌似只点了肉食呢';

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

  function weightedPickFrom(list) {
    const total = list.reduce((s, p) => s + (p.weight || 1), 0);
    let r = Math.random() * total;
    for (const p of list) {
      r -= (p.weight || 1);
      if (r <= 0) return p;
    }
    return list[list.length - 1];
  }

  function getSettings() {
    const s = (typeof settings !== 'undefined') ? settings : {};
    return {
      leaveMin:  s.whereLeaveTime  ?? 11 * 60,
      returnMin: s.whereReturnTime ?? 19 * 60,
      wakeMin:   s.whereWakeTime   ?? 8 * 60
    };
  }

  /* ---- 3.1 吃饭数据（带 ensure） ---- */
  function loadMealData() {
    try {
      if (window.WydMeal && typeof window.WydMeal.ensureToday === 'function') {
        return window.WydMeal.ensureToday();
      }
      return JSON.parse(localStorage.getItem('wyd_data') || 'null');
    } catch (e) { return null; }
  }

  /* ---- 3.2 按剩余时间选择档位 ---- */
  function pickTierByRemaining(remaining) {
    const r = Math.random();
    if (remaining >= 240) {
      if (r < 0.55) return 'long';
      if (r < 0.85) return 'mid';
      return 'short';
    }
    if (remaining >= 150) {
      if (r < 0.5) return 'mid';
      return 'short';
    }
    if (remaining >= 90) {
      if (r < 0.3) return 'mid';
      return 'short';
    }
    return 'short';
  }

  function pickPlace(remaining, usedIds) {
    const tier = pickTierByRemaining(remaining);
    let pool = PLACES.filter(p => !p.isHome && !usedIds.has(p.id) && p.durationTier === tier);
    if (!pool.length) {
      for (const t of TIER_ORDER) {
        pool = PLACES.filter(p => !p.isHome && !usedIds.has(p.id) && p.durationTier === t);
        if (pool.length) break;
      }
    }
    if (!pool.length) return null;
    return weightedPickFrom(pool);
  }

  function pickShortPlace(usedIds) {
    const pool = PLACES.filter(p => !p.isHome && !usedIds.has(p.id) && p.durationTier === 'short');
    if (!pool.length) return null;
    return weightedPickFrom(pool);
  }

  /* ---- 3.3 外出行程 ---- */
  function buildOuting(home, leaveMin, returnMin) {
    const totalWindow = returnMin - leaveMin;
    const visits = [];
    const usedIds = new Set();
    let cursor = leaveMin;
    let remaining = totalWindow;
    let midHomeUsed = false;
    let isFirstStop = true;

    if (remaining < 45) return visits;

    while (remaining >= 50) {
      if (!isFirstStop) {
        const c = Math.min(randInt(COMMUTE_MIN, COMMUTE_MAX), remaining - 30);
        if (c < 10) break;
        visits.push({ placeId: null, start: cursor, end: cursor + c, phase: 'commute' });
        cursor += c;
        remaining -= c;
      }

      if (!isFirstStop && !midHomeUsed && remaining >= 120 && Math.random() < MID_HOME_RATE) {
        const maxDur = Math.min(120, remaining - 30);
        if (maxDur >= 60) {
          const dur = randInt(60, maxDur);
          visits.push({ placeId: home.id, start: cursor, end: cursor + dur, phase: 'home' });
          cursor += dur;
          remaining -= dur;
          midHomeUsed = true;
          isFirstStop = false;
          continue;
        }
      }

      const place = pickPlace(remaining, usedIds);
      if (!place) break;

      const [minD, maxD] = TIER_DURATION[place.durationTier] || TIER_DURATION.short;
      const maxDur = Math.min(maxD, remaining - 20);

      if (maxDur < minD) {
        const sp = pickShortPlace(usedIds);
        if (!sp) break;
        const [sMin, sMax] = TIER_DURATION.short;
        const sMaxDur = Math.min(sMax, remaining - 20);
        if (sMaxDur < sMin) break;
        const dur = randInt(sMin, sMaxDur);
        visits.push({ placeId: sp.id, start: cursor, end: cursor + dur, phase: 'out' });
        usedIds.add(sp.id);
        cursor += dur;
        remaining -= dur;
        isFirstStop = false;
        continue;
      }

      const dur = randInt(minD, maxDur);
      visits.push({ placeId: place.id, start: cursor, end: cursor + dur, phase: 'out' });
      usedIds.add(place.id);
      cursor += dur;
      remaining -= dur;
      isFirstStop = false;
    }

    return visits;
  }

  /* ---- 3.4 火锅联动 ---- */
  function applyHotpotLink(visits) {
    const mealData = loadMealData();
    if (!mealData || !mealData.meals) return visits;

    let result = visits.slice();

    ['lunch', 'dinner'].forEach(type => {
      const meal = mealData.meals[type];
      if (!meal || !meal.eat || meal.special !== 'hotpot') return;
      const eatT = meal.eatTime;
      if (!eatT) return;

      // 找包含 eatT 的 out visit
      let idx = -1;
      for (let i = 0; i < result.length; i++) {
        const v = result[i];
        if (v.phase !== 'out') continue;
        if (eatT >= v.start && eatT < v.end) { idx = i; break; }
      }
      if (idx < 0) return;

      const v = result[idx];
      const dur = v.end - v.start;

      if (dur <= 100) {
        result[idx] = Object.assign({}, v, {
          placeId: 'place10',
          hotpot: true
        });
        return;
      }

      // 切出 60 分钟
      const hotpotDur = 60;
      let hs = Math.round(eatT - hotpotDur / 2);
      let he = hs + hotpotDur;
      const minBefore = 20;
      if (hs < v.start + minBefore) { hs = v.start + minBefore; he = hs + hotpotDur; }
      if (he > v.end - minBefore)   { he = v.end - minBefore;   hs = he - hotpotDur; }

      if (hs < v.start || he > v.end) {
        result[idx] = Object.assign({}, v, {
          placeId: 'place10',
          hotpot: true
        });
        return;
      }

      const before = Object.assign({}, v, { end: hs });
      const hotpot = {
        placeId: 'place10',
        start: hs,
        end: he,
        phase: 'out',
        hotpot: true
      };
      const after = Object.assign({}, v, { start: he });

      result.splice(idx, 1, before, hotpot, after);
    });

    return result;
  }

  /* ---- 3.5 片段切分 ---- */
  function pickGroupForSegment(placeId, excludeCategory, isSleep) {
    let pool = (ACTIONS[placeId] || []).filter(g => !g.exclusive);
    if (!isSleep) pool = pool.filter(g => g.category !== '睡觉中');
    pool = pool.filter(g => g.category !== excludeCategory);
    if (!pool.length) {
      const fallback = (ACTIONS[placeId] || []).filter(g => !g.exclusive);
      return fallback.length ? pick(fallback) : null;
    }
    return pick(pool);
  }

  function pickText(pool, key, usedMap) {
    if (!usedMap[key]) usedMap[key] = [];
    const used = usedMap[key];
    const remain = pool.filter(t => !used.includes(t));
    const chosen = remain.length ? pick(remain) : pick(pool);
    used.push(chosen);
    if (used.length >= pool.length) used.length = 0;
    return chosen;
  }

  function mealKeyForMin(mid) {
    if (mid >= 7 * 60       && mid < 10 * 60 + 30) return 'breakfast';
    if (mid >= 11 * 60 + 30 && mid < 14 * 60)      return 'lunch';
    if (mid >= 17 * 60 + 30 && mid < 19 * 60)      return 'dinner';
    return null;
  }

  function splitVisitIntoSegments(visit, usedText) {
    if (visit.phase === 'sleep' || visit.phase === 'commute') return visit;

    const dur = visit.end - visit.start;
    if (dur < 60) return visit;

    const n = Math.max(2, Math.min(8, Math.round(dur / 50)));

    // 随机分段
    const durations = [];
    let remaining = dur;
    for (let i = 0; i < n - 1; i++) {
      const segsLeft = n - i;
      const avg = remaining / segsLeft;
      const target = Math.round(avg + (Math.random() - 0.5) * 24);
      const minForThis = 30;
      const maxForThis = remaining - (segsLeft - 1) * 30;
      const d = Math.max(minForThis, Math.min(maxForThis, target));
      durations.push(d);
      remaining -= d;
    }
    durations.push(remaining);

    const segments = [];
    let cursor = visit.start;
    let lastCat = null;
    const isSleep = visit.phase === 'sleep';

    // 火锅：全段吃火锅
    if (visit.hotpot) {
      for (let i = 0; i < n; i++) {
        segments.push({
          start: cursor,
          end: cursor + durations[i],
          category: '吃火锅',
          text: HOTPOT_TEXT
        });
        cursor += durations[i];
      }
      visit.segments = segments;
      return visit;
    }

    // 普通 visit：每段独立抽
    for (let i = 0; i < n; i++) {
      const segStart = cursor;
      const segEnd = cursor + durations[i];

      let group = pickGroupForSegment(visit.placeId, lastCat, isSleep);

      if (!group) {
        segments.push({
          start: segStart,
          end: segEnd,
          category: '在忙',
          text: '在忙自己的事'
        });
        cursor = segEnd;
        continue;
      }

      // 吃饭联动：当前段落在饭点，且对应餐未吃 → 避开"吃饭中"
      const mid = (segStart + segEnd) / 2;
      const mealKey = mealKeyForMin(mid);
      if (mealKey && group.category === '吃饭中') {
        const data = loadMealData();
        const meal = data && data.meals ? data.meals[mealKey] : null;
        if (meal && !meal.eat) {
          group = pickGroupForSegment(visit.placeId, '吃饭中', isSleep) || group;
        }
      }

      const textKey = visit.placeId + '::' + group.category + '@' + segStart;
      const text = pickText(group.texts, textKey, usedText);

      segments.push({
        start: segStart,
        end: segEnd,
        category: group.category,
        text: text
      });
      lastCat = group.category;
      cursor = segEnd;
    }

    visit.segments = segments;
    return visit;
  }

  /* ---- 3.6 主生成 ---- */
  function generatePlan() {
    // 触发吃饭数据生成（若未有）
    loadMealData();

    const homes = PLACES.filter(p => p.isHome);
    const home  = pick(homes);

    const cfg = getSettings();
    const wakeMin   = cfg.wakeMin   + randInt(-30, 30);
    const leaveMin  = cfg.leaveMin  + randInt(-30, 30);
    const returnMin = cfg.returnMin + randInt(-30, 30);

    const sleepHours  = randInt(8, 10);
    const rawSleepMin = wakeMin - sleepHours * 60;
    const crossNight  = rawSleepMin < 0;
    let sleepMin = crossNight ? rawSleepMin + 1440 : rawSleepMin;

    let visits = [];

    // 夜间段
    if (crossNight) {
      visits.push({ placeId: home.id, start: 0, end: wakeMin, phase: 'sleep' });
    } else {
      if (sleepMin > 0) {
        visits.push({ placeId: home.id, start: 0, end: sleepMin, phase: 'home' });
      }
      visits.push({ placeId: home.id, start: sleepMin, end: wakeMin, phase: 'sleep' });
    }

    // 白天
    const goOut = Math.random() > NO_GOING_OUT_RATE;

    if (!goOut) {
      visits.push({ placeId: home.id, start: wakeMin, end: 1440, phase: 'home' });
    } else {
      if (leaveMin > wakeMin) {
        visits.push({ placeId: home.id, start: wakeMin, end: leaveMin, phase: 'home' });
      }

      const outing = buildOuting(home, leaveMin, returnMin);
      outing.forEach(v => visits.push(v));

      const lastEnd = visits.length ? visits[visits.length - 1].end : returnMin;

      if (crossNight) {
        if (lastEnd < sleepMin) {
          visits.push({ placeId: home.id, start: lastEnd, end: sleepMin, phase: 'home' });
        }
        visits.push({ placeId: home.id, start: sleepMin, end: 1440, phase: 'sleep' });
      } else {
        visits.push({ placeId: home.id, start: lastEnd, end: 1440, phase: 'home' });
      }
    }

    // 火锅联动
    visits = applyHotpotLink(visits);

    // 先给每个 visit 抽一个 fallback category/text
    const usedText = {};
    visits.forEach(v => {
      if (v.phase === 'sleep') {
        v.category = '睡觉中';
        const pool = (ACTIONS[v.placeId] || [])
          .find(a => a.category === '睡觉中')?.texts || ['在睡觉'];
        v.text = pickText(pool, 'sleep|' + v.placeId, usedText);
        return;
      }
      if (v.phase === 'commute') {
        v.category = '在路上';
        v.text = pickText(COMMUTE_TEXTS, 'commute', usedText);
        return;
      }
      if (v.hotpot) {
        v.category = '吃火锅';
        v.text = HOTPOT_TEXT;
        return;
      }
      const pool = (ACTIONS[v.placeId] || []).filter(g => !g.exclusive);
      if (!pool.length) {
        v.category = '在忙';
        v.text = '在忙自己的事';
        return;
      }
      const group = pick(pool);
      v.category = group.category;
      v.text = pickText(
        group.texts,
        v.phase + '|' + v.placeId + '::' + group.category + '@' + v.start,
        usedText
      );
    });

    // 切片段
    visits = visits.map(v => splitVisitIntoSegments(v, usedText));

    return {
      date: todayStr(),
      homeId: home.id,
      leaveMin, returnMin, wakeMin, sleepMin,
      goOut,
      visits
    };
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
    if (!id) return null;
    return PLACES.find(p => p.id === id);
  }

  function getCurrentSegment(v) {
    if (!v.segments || !v.segments.length) return v;
    const t = nowMin();
    for (const s of v.segments) {
      if (t >= s.start && t < s.end) return s;
    }
    return v.segments[v.segments.length - 1];
  }

  function getPrevSegments(v) {
    if (!v.segments || !v.segments.length) return [];
    const t = nowMin();
    return v.segments.filter(s => s.end <= t);
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
      if (v.placeId && v.start <= t) seen.add(v.placeId);
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
  function renderWhere() {
    const box = document.getElementById('wyd-meals-container');
    if (!box) return;

    const plan = loadPlan();
    const cur  = currentVisit(plan);

    let html = buildMapHTML();

    // 当前卡片
    const placeName = cur.placeId ? (getPlace(cur.placeId)?.name || '未知') : '在路上';
    const curSeg    = getCurrentSegment(cur);
    const prevSegs  = getPrevSegments(cur);
    const cat       = curSeg.category || cur.category || '——';
    const txt       = (curSeg.text || cur.text || '').replace(/\{user\}/g, getUserName());

    let prevHint = '';
    if (prevSegs.length) {
      const cats = prevSegs.map(s => s.category).filter(Boolean);
      const uniq = [];
      let last = null;
      cats.forEach(c => { if (c !== last) { uniq.push(c); last = c; } });
      if (uniq.length) {
        prevHint = `<div class="wyd-where-prev-hint">之前在：${uniq.join(' · ')}</div>`;
      }
    }

    html += `<div class="wyd-where-card wyd-where-current">
      <div class="wyd-card-head">
        <span class="wyd-card-title">📍 ${placeName} · ${fmtHM(curSeg.start || cur.start)} 起</span>
      </div>
      <div class="wyd-where-category">${cat}</div>
      <div class="wyd-card-text">${txt}</div>
      ${prevHint}
    </div>`;

    // 已过去
    const t = nowMin();
    const passed = plan.visits.filter(v => v.end <= t && v !== cur);
    if (passed.length) {
      html += `<div class="wyd-where-timeline-title">今天去过</div>`;
      passed.forEach(v => {
        const pName = v.placeId ? (getPlace(v.placeId)?.name || '未知') : '在路上';

        let catHtml = '';
        let textHtml = '';

        if (v.segments && v.segments.length) {
          const cats = v.segments.map(s => s.category).filter(Boolean);
          const uniq = [];
          let last = null;
          cats.forEach(c => { if (c !== last) { uniq.push(c); last = c; } });
          catHtml = `<div class="wyd-where-category">${uniq.join(' · ')}</div>`;

          const texts = v.segments
            .map(s => (s.text || '').replace(/\{user\}/g, getUserName()))
            .filter(Boolean);
          textHtml = `<div class="wyd-card-text">${texts.slice(0, 2).join('　')}${texts.length > 2 ? '…' : ''}</div>`;
        } else {
          catHtml = v.category ? `<div class="wyd-where-category">${v.category}</div>` : '';
          textHtml = `<div class="wyd-card-text">${(v.text || '').replace(/\{user\}/g, getUserName())}</div>`;
        }

        html += `<div class="wyd-where-past-card">
          <div class="wyd-card-head">
            <span class="wyd-card-title">📍 ${pName} · ${fmtHM(v.start)}-${fmtHM(v.end)}</span>
            <span class="wyd-card-time">已过去</span>
          </div>
          ${catHtml}
          ${textHtml}
        </div>`;
      });
    }

    box.innerHTML = html;

    // 地图
    requestAnimationFrame(() => {
      _mapState.initialized = false;
      initMapTransform();
      bindMapEvents();
      renderMapPins(plan, cur.placeId);

      if (cur.placeId) {
        const place = getPlace(cur.placeId);
        if (place) centerOnPlace(place, false);
      }
    });
  }

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
    position:relative;width:100%;height:360px;border-radius:14px;overflow:hidden;
    background:var(--secondary-bg);border:1px solid var(--border-color);
    touch-action:none;user-select:none;flex-shrink:0;
  }
  .wyd-map-canvas{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform;}
  .wyd-map-img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none;pointer-events:none;}
  .wyd-map-pins{position:absolute;inset:0;pointer-events:none;}
  .wyd-map-pin{
    position:absolute;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;
    background:var(--accent-color);
    box-shadow:0 0 0 1.5px rgba(255,255,255,.7),0 1px 3px rgba(0,0,0,.35);
    opacity:.4;
  }
  .wyd-map-pin.current{
    width:11px;height:11px;margin:-5.5px 0 0 -5.5px;opacity:1;
    animation:wyd-pin-pulse 1.8s ease-out infinite;
  }
  @keyframes wyd-pin-pulse{
    0%  {box-shadow:0 0 0 1.5px rgba(255,255,255,.7),0 0 0 0 rgba(var(--accent-color-rgb),.7);}
    70% {box-shadow:0 0 0 1.5px rgba(255,255,255,.7),0 0 0 14px rgba(var(--accent-color-rgb),0);}
    100%{box-shadow:0 0 0 1.5px rgba(255,255,255,.7),0 0 0 0 rgba(var(--accent-color-rgb),0);}
  }
  .wyd-map-recenter{
    position:absolute;right:10px;bottom:10px;width:32px;height:32px;border-radius:50%;
    border:none;background:rgba(0,0,0,.55);color:#fff;display:none;
    align-items:center;justify-content:center;font-size:13px;cursor:pointer;z-index:3;
  }
  .wyd-map-zoom{position:absolute;right:10px;bottom:50px;display:flex;flex-direction:column;gap:4px;z-index:3;}
  .wyd-map-zoom button{
    width:28px;height:28px;border-radius:50%;border:none;background:rgba(0,0,0,.5);
    color:#fff;font-size:14px;cursor:pointer;
  }
  .wyd-where-card{
    background:var(--secondary-bg);border:1px solid var(--border-color);
    border-radius:14px;padding:14px 16px;flex-shrink:0;
  }
  .wyd-where-current{
    border-color:rgba(var(--accent-color-rgb),.3);
    background:rgba(var(--accent-color-rgb),.04);
  }
  .wyd-where-current .wyd-card-title{color:var(--accent-color);}
  .wyd-where-timeline-title{
    font-size:11px;color:var(--text-secondary);margin:10px 0 4px;
    opacity:.75;letter-spacing:.5px;
  }
  .wyd-where-past-card{
    background:var(--secondary-bg);border:1px solid var(--border-color);
    border-radius:14px;padding:12px 14px;flex-shrink:0;opacity:.68;margin-bottom:8px;
  }
  .wyd-where-past-card .wyd-card-title{color:var(--text-secondary);font-size:13px;}
  .wyd-where-past-card .wyd-card-text{font-size:12.5px;}
  .wyd-where-past-card .wyd-where-category{font-size:12.5px;opacity:.85;margin:4px 0 3px;}
  .wyd-where-category{
    font-size:13px;font-weight:600;color:var(--accent-color);margin:6px 0 4px;
  }
  .wyd-where-prev-hint{
    font-size:11px;color:var(--text-secondary);opacity:.7;
    margin-top:8px;padding-top:8px;
    border-top:1px dashed var(--border-color);
    letter-spacing:.3px;
  }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
})();