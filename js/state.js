/**
 * state.js - Application State Variables & DOM Elements
 * 应用状态变量与DOM元素引用
 * NOTE: This must be loaded after the DOM is ready (or wrapped in DOMContentLoaded)
 */
// ============================================================
// 📦 应用数据注册表 (完整版)
// 包含：核心、氛围、功能、新特性等所有数据
// ============================================================
window.APP_DATA_REGISTRY = [
    // --- 1. 核心数据 ---
    { 
        id: 'messages', 
        name: '聊天记录', 
        icon: 'fa-comments', 
        core: true, 
        backup: true,
        getValue: () => typeof messages !== 'undefined' ? messages : [],
        setValue: (v) => { if(typeof messages !== 'undefined') messages = v; },
        onImport: (d) => { if(typeof messages !== 'undefined') messages = d.map(m => ({...m, timestamp: new Date(m.timestamp)})); }
    },
    { 
        id: 'settings', 
        name: '外观与设置', 
        icon: 'fa-sliders-h', 
        core: true, 
        backup: true,
        getValue: () => typeof settings !== 'undefined' ? settings : {},
        setValue: (v) => { if(typeof settings !== 'undefined') settings = v; },
        onImport: (d) => { if(typeof settings !== 'undefined') Object.assign(settings, d); }
    },

    // --- 2. 回复与表情 ---
    /*{ 
        id: 'customReplies', 
        name: '字卡回复库', 
        icon: 'fa-reply', 
        backup: true,
        getValue: () => typeof customReplies !== 'undefined' ? customReplies : [],
        setValue: (v) => { if(typeof customReplies !== 'undefined') customReplies = v; }
    },
    { 
        id: 'customEmojis', 
        name: '自定义 Emoji', 
        icon: 'fa-smile', 
        backup: true,
        getValue: () => typeof customEmojis !== 'undefined' ? customEmojis : [],
        setValue: (v) => { if(typeof customEmojis !== 'undefined') customEmojis = v; }
    },
    { 
        id: 'stickerLibrary', 
        name: '表情包库', 
        icon: 'fa-sticky-note', 
        backup: true,
        getValue: () => typeof stickerLibrary !== 'undefined' ? stickerLibrary : [],
        setValue: (v) => { if(typeof stickerLibrary !== 'undefined') stickerLibrary = v; }
    },
    { 
        id: 'myStickerLibrary', 
        name: '我的收藏表情', 
        icon: 'fa-folder-open', 
        backup: true,
        getValue: () => typeof myStickerLibrary !== 'undefined' ? myStickerLibrary : [],
        setValue: (v) => { if(typeof myStickerLibrary !== 'undefined') myStickerLibrary = v; }
    },

    // --- 3. 氛围感配置 (分组) ---
    { 
        id: 'customPokes', 
        name: '拍一拍', 
        icon: 'fa-hand-point-up', 
        backup: true, 
        group: 'atmosphere',
        getValue: () => typeof customPokes !== 'undefined' ? customPokes : [],
        setValue: (v) => { if(typeof customPokes !== 'undefined') customPokes = v; }
    },
    { 
        id: 'customStatuses', 
        name: '对方状态', 
        icon: 'fa-user-circle', 
        backup: true, 
        group: 'atmosphere',
        getValue: () => typeof customStatuses !== 'undefined' ? customStatuses : [],
        setValue: (v) => { if(typeof customStatuses !== 'undefined') customStatuses = v; }
    },
    { 
        id: 'customMottos', 
        name: '顶部格言', 
        icon: 'fa-quote-right', 
        backup: true, 
        group: 'atmosphere',
        getValue: () => typeof customMottos !== 'undefined' ? customMottos : [],
        setValue: (v) => { if(typeof customMottos !== 'undefined') customMottos = v; }
    },
    { 
        id: 'customIntros', 
        name: '开场动画', 
        icon: 'fa-film', 
        backup: true, 
        group: 'atmosphere',
        getValue: () => typeof customIntros !== 'undefined' ? customIntros : [],
        setValue: (v) => { if(typeof customIntros !== 'undefined') customIntros = v; }
    },
    // 虚拟组：氛围感
    { 
        id: 'atmosphere', 
        name: '氛围感配置', 
        icon: 'fa-magic', 
        isVirtual: true, 
        children: ['customPokes', 'customStatuses', 'customMottos', 'customIntros'] 
    },*/

    // --- 4. 功能数据 ---
    { 
        id: 'anniversaries', 
        name: '重要日', 
        icon: 'fa-heart', 
        backup: true,
        getValue: () => typeof anniversaries !== 'undefined' ? anniversaries : [],
        setValue: (v) => { if(typeof anniversaries !== 'undefined') anniversaries = v; }
    },
    { 
        id: 'calendarEvents', 
        name: '心情与日历', 
        icon: 'fa-calendar-alt', 
        backup: true,
        getValue: () => typeof calendarEvents !== 'undefined' ? calendarEvents : [],
        setValue: (v) => { if(typeof calendarEvents !== 'undefined') calendarEvents = v; }
    },
   /* { 
        id: 'partnerPersonas', 
        name: '群聊成员', 
        icon: 'fa-users', 
        backup: true,
        getValue: () => typeof partnerPersonas !== 'undefined' ? partnerPersonas : [],
        setValue: (v) => { if(typeof partnerPersonas !== 'undefined') partnerPersonas = v; }
    },*/
    
    // --- 5. 月经系统 (包含关怀消息和周期记录) ---
    { 
        id: 'periodCareMessages', 
        name: '月经关怀文案', 
        icon: 'fa-heart', 
        backup: true,
        getValue: () => typeof periodCareMessages !== 'undefined' ? periodCareMessages : {},
        setValue: (v) => { if(typeof periodCareMessages !== 'undefined') periodCareMessages = v; }
    },
    { 
        id: 'periodRecords', 
        name: '月经周期记录', 
        icon: 'fa-calendar-check', 
        backup: true,
        getValue: () => typeof periodRecords !== 'undefined' ? periodRecords : [],
        setValue: (v) => { if(typeof periodRecords !== 'undefined') periodRecords = v; }
    },
    { 
        id: 'periodSettings', 
        name: '月经设置', 
        icon: 'fa-cog', 
        backup: true,
        getValue: () => typeof periodSettings !== 'undefined' ? periodSettings : {},
        setValue: (v) => { if(typeof periodSettings !== 'undefined') periodSettings = v; }
    },

    // --- 6. 新功能 (根据 HTML 补充) ---
    // 注意：请确保你的 JS 代码中定义了这些变量，如果没有定义，它们会被忽略
    { 
        id: 'envelopeData', 
        name: '留言板', 
        icon: 'fa-solid fa-thumbtack', 
        backup: true,
        getValue: () => typeof envelopeData !== 'undefined' ? envelopeData : [],
        setValue: (v) => { if(typeof envelopeData !== 'undefined') envelopeData = v; }
    },
    { 
        id: 'moodDiaryData', 
        name: '心晴手账', 
        icon: 'fa-cloud-sun', 
        backup: true,
        getValue: () => typeof moodDiaryData !== 'undefined' ? moodDiaryData : [],
        setValue: (v) => { if(typeof moodDiaryData !== 'undefined') moodDiaryData = v; }
    },
    { 
        id: 'divinationHistory', 
        name: '占卜记录', 
        icon: 'fa-moon', 
        backup: true,
        getValue: () => typeof divinationHistory !== 'undefined' ? divinationHistory : [],
        setValue: (v) => { if(typeof divinationHistory !== 'undefined') divinationHistory = v; }
    },

    // --- 7. 外观主题 ---
    { 
        id: 'savedBackgrounds', 
        name: '背景图集', 
        icon: 'fa-image', 
        backup: true,
        getValue: () => typeof savedBackgrounds !== 'undefined' ? savedBackgrounds : [],
        setValue: (v) => { if(typeof savedBackgrounds !== 'undefined') savedBackgrounds = v; }
    },
    { 
        id: 'customThemes', 
        name: '自定义主题', 
        icon: 'fa-palette', 
        backup: true,
        getValue: () => typeof customThemes !== 'undefined' ? customThemes : [],
        setValue: (v) => { if(typeof customThemes !== 'undefined') customThemes = v; }
    },
    { 
        id: 'themeSchemes', 
        name: '主题方案', 
        icon: 'fa-swatchbook', 
        backup: true,
        getValue: () => typeof themeSchemes !== 'undefined' ? themeSchemes : [],
        setValue: (v) => { if(typeof themeSchemes !== 'undefined') themeSchemes = v; }
    },
    { 
        id: 'wishingPoolData',
        name: '许愿池', 
        icon: 'fa-star', 
        backup: true, 
        getValue: () => typeof wishingPoolData !== 'undefined' ? wishingPoolData : [], 
        setValue: (v) => { if(typeof wishingPoolData !== 'undefined') wishingPoolData = v; } 
    },

];

// ============================================================
// 📦 全局数据访问器 (解决变量作用域问题)
// ============================================================
window.APP_DATA = {
    // Getter: 获取数据
    get(id) {
        try {
            // 尝试从全局作用域获取
            if (typeof window[id] !== 'undefined') return window[id];
            // 直接返回变量引用 (需要在下面手动映射)
            return this._values[id]?.();
        } catch(e) { 
            console.warn('无法获取数据:', id);
            return null; 
        }
    },
    
    // Setter: 设置数据
    set(id, value) {
        try {
            if (typeof window[id] !== 'undefined') {
                window[id] = value;
            }
            // 调用 setter
            this._setters[id]?.(value);
        } catch(e) {
            console.warn('无法设置数据:', id);
        }
    },
    
    // 变量映射表 (核心：直接引用变量)
    _values: {
        'messages': () => typeof messages !== 'undefined' ? messages : [],
        'settings': () => typeof settings !== 'undefined' ? settings : {},
        'customReplies': () => typeof customReplies !== 'undefined' ? customReplies : [],
        'customEmojis': () => typeof customEmojis !== 'undefined' ? customEmojis : [],
        'stickerLibrary': () => typeof stickerLibrary !== 'undefined' ? stickerLibrary : [],
        'myStickerLibrary': () => typeof myStickerLibrary !== 'undefined' ? myStickerLibrary : [],
        'anniversaries': () => typeof anniversaries !== 'undefined' ? anniversaries : [],
        'calendarEvents': () => typeof calendarEvents !== 'undefined' ? calendarEvents : [],
        'periodCareMessages': () => typeof periodCareMessages !== 'undefined' ? periodCareMessages : [],
        'partnerPersonas': () => typeof partnerPersonas !== 'undefined' ? partnerPersonas : [],
        'customPokes': () => typeof customPokes !== 'undefined' ? customPokes : [],
        'customStatuses': () => typeof customStatuses !== 'undefined' ? customStatuses : [],
        'customMottos': () => typeof customMottos !== 'undefined' ? customMottos : [],
        'customIntros': () => typeof customIntros !== 'undefined' ? customIntros : [],
        'savedBackgrounds': () => typeof savedBackgrounds !== 'undefined' ? savedBackgrounds : [],
        'customThemes': () => typeof customThemes !== 'undefined' ? customThemes : [],
        'themeSchemes': () => typeof themeSchemes !== 'undefined' ? themeSchemes : [],
        // 新功能：请根据你的实际变量名添加
        'envelopeData': () => typeof envelopeData !== 'undefined' ? envelopeData : [],
        'moodDiaryData': () => typeof moodDiaryData !== 'undefined' ? moodDiaryData : [],
        'divinationHistory': () => typeof divinationHistory !== 'undefined' ? divinationHistory : [],
    },
    
    _setters: {
        'messages': (v) => { if(typeof messages !== 'undefined') messages = v; },
        'settings': (v) => { if(typeof settings !== 'undefined') settings = v; },
        'customReplies': (v) => { if(typeof customReplies !== 'undefined') customReplies = v; },
        'customEmojis': (v) => { if(typeof customEmojis !== 'undefined') customEmojis = v; },
        'stickerLibrary': (v) => { if(typeof stickerLibrary !== 'undefined') stickerLibrary = v; },
        'myStickerLibrary': (v) => { if(typeof myStickerLibrary !== 'undefined') myStickerLibrary = v; },
        'anniversaries': (v) => { if(typeof anniversaries !== 'undefined') anniversaries = v; },
        'calendarEvents': (v) => { if(typeof calendarEvents !== 'undefined') calendarEvents = v; },
        'periodCareMessages': (v) => { if(typeof periodCareMessages !== 'undefined') periodCareMessages = v; },
        'partnerPersonas': (v) => { if(typeof partnerPersonas !== 'undefined') partnerPersonas = v; },
        'customPokes': (v) => { if(typeof customPokes !== 'undefined') customPokes = v; },
        'customStatuses': (v) => { if(typeof customStatuses !== 'undefined') customStatuses = v; },
        'customMottos': (v) => { if(typeof customMottos !== 'undefined') customMottos = v; },
        'customIntros': (v) => { if(typeof customIntros !== 'undefined') customIntros = v; },
        'savedBackgrounds': (v) => { if(typeof savedBackgrounds !== 'undefined') savedBackgrounds = v; },
        'customThemes': (v) => { if(typeof customThemes !== 'undefined') customThemes = v; },
        'themeSchemes': (v) => { if(typeof themeSchemes !== 'undefined') themeSchemes = v; },
        'envelopeData': (v) => { if(typeof envelopeData !== 'undefined') envelopeData = v; },
        'moodDiaryData': (v) => { if(typeof moodDiaryData !== 'undefined') moodDiaryData = v; },
        'divinationHistory': (v) => { if(typeof divinationHistory !== 'undefined') divinationHistory = v; },
    }
};

// 更新辅助函数
//window._getRegVal = (id) => window.APP_DATA.get(id);
//window._setRegVal = (id, val) => window.APP_DATA.set(id, val);
window._getRegVal = (id) => {
    const reg = window.APP_DATA_REGISTRY.find(r => r.id === id);
    return reg?.getValue ? reg.getValue() : null;
};

window._setRegVal = (id, val) => {
    const reg = window.APP_DATA_REGISTRY.find(r => r.id === id);
    if (reg?.setValue) {
        reg.setValue(val);
    } else if (reg?.onImport) {
        reg.onImport(val);
    }
};


        let SESSION_ID = null;
        let autoSendTimer = null;
        let wishingPoolData = []; 
        // 日程数据
        let calendarEvents = [];
        let sessionList = [];
        let messages = [];
        let settings = {   
            homeShortcutsCustomEnabled: false,
            homeShortcutsSelected: ['advanced']
        };
        let partnerPersonas = []; 
        let showPartnerNameInChat = false; 
        let readNoReplyTimer = null; 
        let isBatchMode = false;
        //let batchMessages = [];
        let currentReplyTo = null;
        let lastCoinResult = null;
        let currentNoteMessageId = null;
        let savedBackgrounds = [];
        let saveTimeout;
        let displayedMessageCount = 20;
        const HISTORY_BATCH_SIZE = 20;
        let isLoadingHistory = false;
        let isBatchFavoriteMode = false;
        let selectedMessages = [];
        let customReplies = [];
        let customPokes = [];
        let customStatuses = [];
        let customMottos = [];
        let customIntros = []; 
        let currentMajorTab = 'reply'; 
        let currentSubTab = 'custom';  
        let currentReplyTab = 'custom';
        let customEmojis = [];
        let anniversaries = [];
        let stickerLibrary = []; 
        let myStickerLibrary = []; 
        let currentAnniversaryType = 'anniversary';
        let customThemes = [];
        let themeSchemes = []; 
        const DOMElements = {
            html: document.documentElement,
            chatContainer: document.getElementById('chat-container'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            attachmentBtn: document.getElementById('attachment-btn'),
            imageInput: document.getElementById('image-input'),
            themeToggle: document.getElementById('theme-toggle'),
            //batchBtn: document.getElementById('batch-btn'),
            continueBtn: document.getElementById('continue-btn'),
            comboBtn: document.getElementById('combo-btn'),
            coinTossOverlay: document.getElementById('coin-toss-overlay'),
            animatedCoin: document.getElementById('animated-coin'),
            coinResultText: document.getElementById('coin-result-text'),
            cancelCoinResult: document.getElementById('cancel-coin-result'),
            sendCoinResult: document.getElementById('send-coin-result'),
            typingIndicator: document.getElementById('typing-indicator'),
            emptyState: document.getElementById('empty-state'),
            welcomeAnimation: document.getElementById('welcome-animation'),
            //batchPreview: document.getElementById('batch-preview'),
            shutUpBtn: document.getElementById('shutUpBtn'), // 新增
            replyPreviewContainer: document.getElementById('reply-preview-container'),
            pagination: document.getElementById('pagination'),
            prevPage: document.getElementById('prev-page'),
            nextPage: document.getElementById('next-page'),
            pageInfo: document.getElementById('page-info'),
            editModal: {
                modal: document.getElementById('edit-modal'),
                title: document.getElementById('edit-modal-title'),
                input: document.getElementById('name-input'),
                cancel: document.getElementById('cancel-edit'),
                save: document.getElementById('save-name')
            },
            avatarModal: {
                modal: document.getElementById('avatar-modal'),
                title: document.getElementById('avatar-modal-title'),
                input: document.getElementById('avatar-input'),
                cancel: document.getElementById('cancel-avatar'),
                save: document.getElementById('save-avatar')
            },
            noteModal: {
                modal: document.getElementById('note-modal'),
                input: document.getElementById('note-input'),
                cancel: document.getElementById('cancel-note'),
                save: document.getElementById('save-note')
            },
            pokeModal: {
                modal: document.getElementById('poke-modal'),
                input: document.getElementById('poke-input'),
                cancel: document.getElementById('cancel-poke'),
                save: document.getElementById('send-poke')
            },
            settingsModal: {
                modal: document.getElementById('settings-modal'),
                settingsBtn: document.getElementById('settings-btn'),
                cancel: document.getElementById('cancel-settings')
            },
            favoritesModal: {
                modal: document.getElementById('stats-modal'),
                favoritesBtn: document.getElementById('group-chat-btn'),
                list: document.getElementById('favorites-list'),
                cancel: document.getElementById('close-stats')
            },
            statsModal: {
                modal: document.getElementById('stats-modal'),
                content: document.getElementById('stats-content'),
                closeBtn: document.getElementById('close-stats')
            },
            sessionModal: {
                modal: document.getElementById('session-modal'),
               // managerBtn: document.getElementById('session-manager-btn'),
                list: document.getElementById('session-list'),
                createBtn: document.getElementById('create-new-session'),
                cancelBtn: document.getElementById('cancel-session')
            },
            fortuneModal: {
                modal: document.getElementById('fortune-lenormand-modal'),
                content: document.getElementById('fortune-content'),
                shareBtn: document.getElementById('share-fortune'),
                closeBtn: document.getElementById('close-fortune')
            },
            customRepliesModal: {
                modal: document.getElementById('custom-replies-modal'),
                list: document.getElementById('custom-replies-list'),
                addBtn: document.getElementById('add-custom-reply'),
                closeBtn: document.getElementById('close-custom-replies')
            },
            backgroundInput: document.getElementById('background-input'),
            importInput: document.getElementById('import-input'),
            partner: {
                name: document.getElementById('partner-name'),
                avatarContainer: document.getElementById('partner-avatar-container'), 
                avatar: document.getElementById('partner-avatar'),
                status: document.getElementById('partner-status').querySelector('span')
            },
            me: {
                name: document.getElementById('my-name'),
                avatarContainer: document.getElementById('my-avatar-container'), 
                avatar: document.getElementById('my-avatar'),
                statusContainer: document.getElementById('my-status-container'),
                statusText: document.getElementById('my-status-text')
            },
            anniversaryModal: {
                modal: document.getElementById('anniversary-modal'),
                closeBtn: document.getElementById('close-anniversary-modal'),
                saveBtn: document.getElementById('save-ann-btn'),
                addBtn: document.getElementById('open-ann-add-btn'),
                dateInput: document.getElementById('ann-input-date'),
                nameInput: document.getElementById('ann-input-name'),
                displayArea: document.getElementById('anniversary-display'),
                daysElement: document.getElementById('anniversary-days'),
                dateShowElement: document.getElementById('anniversary-date-show'),
                list: document.getElementById('ann-list-container'),
                typeHint: document.getElementById('ann-type-desc')
            },            
            anniversaryAnimation: {
                modal: document.getElementById('anniversary-animation'),
                title: document.getElementById('anniversary-animation-title'),
                days: document.getElementById('anniversary-animation-days'),
                message: document.getElementById('anniversary-animation-message'),
                closeBtn: document.getElementById('close-anniversary-animation')
            },
            appearanceModal: {
                modal: document.getElementById('appearance-modal'),
                closeBtn: document.getElementById('close-appearance')
            },
            chatModal: {
                modal: document.getElementById('chat-modal'),
                closeBtn: document.getElementById('close-chat')
            },
            advancedModal: {
                modal: document.getElementById('advanced-modal'),
                closeBtn: document.getElementById('close-advanced')
            },
            dataModal: {
                modal: document.getElementById('data-modal'),
                closeBtn: document.getElementById('close-data')
            },
            wishingPoolModal: {
                modal: document.getElementById('wishing-pool-modal'),
                grid: document.getElementById('wish-pool-grid'),
                closeBtn: document.getElementById('close-wishing-pool')
            },
            wishEditModal: {
                modal: document.getElementById('wish-edit-modal'),
                title: document.getElementById('wish-edit-title'),
                imgArea: document.getElementById('wish-img-upload-area'),
                imgPreview: document.getElementById('wish-img-preview'),
                imgInput: document.getElementById('wish-img-input'),
                priceInput: document.getElementById('wish-price-input'),
                myNoteInput: document.getElementById('wish-my-note-input'),
                saveBtn: document.getElementById('wish-edit-save'),
                cancelBtn: document.getElementById('wish-edit-cancel')
            },

        };
// 月经系统变量
let periodRecords = [];
let lastPeriodReminderCheck = null;
let periodSettings = {
    averageCycleLength: 28,
    lastCalculation: null,
};

// 月经关怀消息
let periodCareMessages = {
    approaching: [],
    during: [],
    delayed: []
};
