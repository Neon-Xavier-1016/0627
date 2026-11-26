/* 首页 / 聊天 / 设置：复用原 DOM，不刷新网页。 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let ready=false,page='home',config={},storageKey='',unread=[],activeNote=null,noteTimer=null,writing=Promise.resolve();
 let appliedWallpaper, syncHomeBackground;
 function currentWallpaperCrop(image = config.homeBackground) {
  const index = Array.isArray(config.homeBackgrounds) ? config.homeBackgrounds.indexOf(image) : -1;
  return index < 0 ? null : config.homeBackgroundCrops?.[index] || null;
 }
 function applyBackgroundCrops(){
  window.HomeImageCrop.apply($('hs-home'),currentWallpaperCrop());
  window.HomeImageCrop.apply($('hs-relation'),config.backgroundCrop);
  const preview=$('hs-home-glass-preview');
  if(preview)window.HomeImageCrop.apply(preview,currentWallpaperCrop());
 }
 const earlyMessages=[];
 const noteQueue=[];
 const noteEnterMs=280,noteHoldMs=5000,noteExitMs=240;
 const defaults=()=>({label:'我们在一起',date:'',annId:'',motto:'两颗缠绕的心，会走同一条路。',background:'',backgroundCrop:null,homeBackground:'',homeBackgrounds:[],homeBackgroundCrops:[],homeGlassTransparency:37,showRelation:true,showCountdown:true,showMotto:true,unread:[],lastRead:null});
 const list=()=>typeof messages!=='undefined'?messages:[];
 const incoming=m=>!!m.sender&&m.sender!=='user'&&m.sender!=='system'&&!['system','recall','call-event','qa-live','status-moment-question'].includes(m.type);
 const profile=()=>typeof settings!=='undefined'?settings:{};
 const validWallpaper=value=>/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);
 const glassTransparency=()=>Math.max(0,Math.min(100,Number(config.homeGlassTransparency)||0));
 const homeDarkness=()=>Math.max(0,Math.min(100,Number(config.homeNightDarkness??48)||0));
 function ordinal(date){const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date||'');if(!parts)return null;const [y,m,d]=parts.slice(1).map(Number),v=new Date(Date.UTC(y,m-1,d));return v.getUTCFullYear()===y&&v.getUTCMonth()===m-1&&v.getUTCDate()===d?v.getTime()/86400000:null;}
 function relation(date,now=new Date()){
  const start=ordinal(date);if(start===null)return null;
  const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000;
  const [y,m,d]=date.split('-').map(Number);let year=now.getFullYear();
  const yearly=year=>Date.UTC(year,m-1,Math.min(d,new Date(Date.UTC(year,m,0)).getUTCDate()))/86400000;
  let next=yearly(year);if(next<today||year<=y)next=yearly(Math.max(year+1,y+1));
  return {days:today-start,until:next-today,future:start>today};
 }
 function anniversariesList(){const all=[...(window.anniversaries||[]),...(typeof anniversaries!=='undefined'?anniversaries:[])];return all.filter((a,i)=>all.findIndex(b=>String(b.id)===String(a.id))===i);}
 function relationDate(){return anniversariesList().find(a=>String(a.id)===config.annId)?.date||config.date;}
 async function load(){
  const key=getStorageKey('homeShellData');if(key===storageKey)return;
  const saved=await localforage.getItem(key);config={...defaults(),...saved};storageKey=key;
  const ids=new Set(list().filter(m=>m.type!=='status-moment-question').map(m=>String(m.id)));unread=[...new Set([...(config.unread||[]),...list().filter(m=>incoming(m)&&saved?.lastRead&&new Date(m.timestamp).getTime()>saved.lastRead).map(m=>String(m.id)),...earlyMessages.map(m=>String(m.id))])].filter(id=>ids.has(id));
  if(!config.lastRead)config.lastRead=Date.now();
  clearNotes();
  noteQueue.push(...earlyMessages.filter(m=>ids.has(String(m.id))).map(m=>messageNotice(m)));
  earlyMessages.length=0;
 }
 function save(changes={}){
  const key=storageKey,current=config,unreadIds=[...unread];
  writing=writing.catch(()=>{}).then(async()=>{
   await localforage.setItem(key,{...current,...changes,unread:unreadIds});
   Object.assign(current,changes);
  });
  return writing;
 }
 function toast(s){if(typeof showNotification==='function')showNotification(s,'info');}
 function bottom(){const c=$('chat-container');return c&&c.scrollHeight-c.scrollTop-c.clientHeight<90;}
 function modalOpen(){return !!document.querySelector('dialog[open],.pd-overlay.show')||[...document.querySelectorAll('.modal')].some(m=>getComputedStyle(m).display!=='none');}
 function removeNote(){
  clearTimeout(noteTimer);noteTimer=null;
  activeNote?.remove();activeNote=null;
 }
 function clearNotes(){noteQueue.length=0;removeNote();}
 function setUnread(entries=[]){unread=entries.map(m=>String(m.id));config.lastRead=Date.now();save().catch(console.warn);badges();}
 function read(){setUnread();}
 function badges(){
  const total=unread.length+(window.XavierConversations?.otherUnreadCount?.()||0);
  for(const [id,count] of [['hs-chat-badge',total],['hs-preview-badge',unread.length]]){
   const n=$(id);if(n){n.textContent=count>99?'99+':count;n.hidden=!count;}
  }
  if($('hs-new-messages'))$('hs-new-messages').hidden=!(page==='chat'&&unread.length);
 }
 function navigate(next){
  if(!ready||!['home','messages','chat','settings'].includes(next))return;
  page=next;document.body.dataset.hsPage=next;
  window.XavierConversations?.show(next);
  if($('hs-nav'))$('hs-nav').hidden=next==='chat';
  if($('hs-chat-toolbar'))$('hs-chat-toolbar').hidden=next!=='chat';
  if($('hs-chat-more'))$('hs-chat-more').hidden=next!=='chat';
  $('hs-home').hidden=next!=='home';$('hs-settings').hidden=next!=='settings';
  if(next==='home')window.HomeSchedule.showHome();
  document.querySelectorAll('#hs-nav [data-hs-page]').forEach(b=>b.setAttribute('aria-current',b.dataset.hsPage===next?'page':'false'));
  update();badges();showNote();
  if(next==='chat'&&!window.XavierConversations?.isViewingAdditionalConversation()){
   scrollLatest();
   if(!document.hidden&&!modalOpen())read();
  }
 }
 const settingPages={'custom-replies-modal':'自定义回复','chat-modal':'聊天设置','appearance-modal':'外观设置','data-modal':'数据管理','session-modal':'会话管理','hs-chat-display':'聊天选项','xv-manage':'会话管理','xv-conversation-settings':'会话设置','xv-create-role':'创建角色','xv-add-members':'选择群成员'};
 let detailStack=[],detailReturn='settings';
 function clearDetails(){
  for(const id of detailStack){const node=$(id);if(node)node.style.display='none';}
  detailStack=[];document.body.classList.remove('hs-settings-detail-open');
 }
 function openSettingPage(modal){
  if(!detailStack.length)detailReturn=page;
  if(modal._hideTimeout){clearTimeout(modal._hideTimeout);modal._hideTimeout=null;}
  const existing=detailStack.indexOf(modal.id);
  if(existing>=0){for(const id of detailStack.slice(existing+1)){if($(id))$(id).style.display='none';}detailStack=detailStack.slice(0,existing+1);}
  else {const previous=$(detailStack.at(-1));if(previous)previous.style.display='none';detailStack.push(modal.id);}
  if(modal.style.display!=='flex')modal.style.display='flex';
  const content=modal.querySelector('.modal-content');if(content){content.style.opacity='1';content.style.transform='none';}
  document.body.classList.add('hs-settings-detail-open');
  if(modal.id==='data-modal')requestAnimationFrame(()=>{const back=modal.querySelector('#back-data');if(back){back.setAttribute('aria-label','返回上一级');back.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="22" height="22" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>';}});
 }
 function closeSettingPage(modal){
  const index=detailStack.indexOf(modal.id);if(index<0){modal.style.display='none';return;}
  for(const id of detailStack.slice(index)){if($(id))$(id).style.display='none';}
  detailStack=detailStack.slice(0,index);
  if(detailStack.length){const previous=$(detailStack.at(-1));if(previous)previous.style.display='flex';}
  else{document.body.classList.remove('hs-settings-detail-open');navigate(detailReturn);}
 }
 function settingBack(modal){
  if(modal.id==='appearance-modal'){
   const inner=$('appearance-panel-container');
   if(inner&&inner.style.display!=='none'&&typeof hideAppearancePanel==='function'){
    const fromHome=detailReturn==='home'&&$('appearance-panel-home-background')?.style.display==='block';
    hideAppearancePanel();
    if(!fromHome)return;
   }
  }
  closeSettingPage(modal);
 }
 function setupSettingsPages(){
  const grid=document.querySelector('#hs-settings .settings-grid');
  for(const id of ['custom-replies-function','chat-settings','appearance-settings','data-settings','hs-shortcut-session-manager-btn']){const item=$(id);if(grid&&item)grid.appendChild(item);}
  for(const [id,title] of Object.entries(settingPages)){
   const modal=$(id),content=modal?.querySelector('.modal-content');if(!content)continue;
   modal.classList.add('hs-settings-detail');
   if(id!=='data-modal'){
   const bar=document.createElement('div');bar.className='hs-setting-top';
   bar.innerHTML='<button type="button" aria-label="返回上一级" class="hs-setting-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg></button><span></span>';
   bar.querySelector('span').textContent=title;bar.querySelector('button').onclick=()=>settingBack(modal);content.prepend(bar);
   }
   for(const button of modal.querySelectorAll('.modal-buttons button')){
    if(['关闭','返回','取消'].includes(button.textContent.trim())&&button.id!=='create-new-session')button.classList.add('hs-obsolete-close');
   }
   const internal=$('appearance-panel-container')?.querySelector('button[onclick="hideAppearancePanel()"]');if(id==='appearance-modal'&&internal)internal.classList.add('hs-obsolete-close');
   modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();settingBack(modal);}});
   // 部分旧入口直接设置 display，统一转换成整页，仍保留原初始化逻辑。
   if(typeof MutationObserver!=='undefined')new MutationObserver(()=>{
    const visible=modal.style.display==='flex';
    if(visible&&!detailStack.includes(id))openSettingPage(modal);
    else if(!visible&&detailStack.at(-1)===id)closeSettingPage(modal);
   }).observe(modal,{attributes:true,attributeFilter:['style']});
  }
 }
 function routeModal(modal,opening){
  if(!ready||!modal)return false;
  if(settingPages[modal.id]){if(opening)openSettingPage(modal);else closeSettingPage(modal);return true;}
  if(modal.id==='settings-modal'||modal.id==='advanced-modal'){
   if(opening){clearDetails();navigate(modal.id==='settings-modal'?'settings':'home');}
   return true;
  }return false;
 }
 function avatar(node,src){if(node.dataset.src===src)return;node.dataset.src=src;node.innerHTML=src?`<img src="${esc(src)}" alt="">`:'<i class="fas fa-user"></i>';}
 function syncMotto(){
  const home=$('hs-motto');if(!home)return;
  const text=document.querySelector('.header-motto')?.textContent.trim()||'';
  home.textContent=text;home.hidden=!config.showMotto||!text;
 }
 function update(){
  if(!ready)return;
  const s=window.XavierConversations?.homeProfile()||profile();$('hs-names').textContent=(s.partnerName||'Ta')+' ＆ '+(s.myName||'我');
  avatar($('hs-my-avatar'),s.myAvatar||'');avatar($('hs-partner-avatar'),s.partnerAvatar||'');
  $('hs-relation-details').hidden=!config.showRelation;
  $('hs-relation').classList.toggle('hs-relation-simple',!config.showRelation);
  $('hs-countdown').hidden=!config.showCountdown;
  syncMotto();
  const info=relation(relationDate());
  $('hs-days').textContent=info?(info.future?'等待故事开始':`${config.label}已 ${info.days} 天`):'把我们的第一天记在这里';
  $('hs-countdown').textContent=info&&!info.future?`从 ${relationDate().replaceAll('-','.')} 到今天 · ${info.until===0?'今天是我们的周年纪念日':`距下一次周年还有 ${info.until} 天`}`:'点击卡片，设置起始日与专属背景';
  $('hs-relation').classList.toggle('hs-has-relation-image',!!config.background);
  $('hs-relation').style.backgroundImage=config.background?`linear-gradient(0deg,rgba(var(--secondary-bg-rgb),calc(.3 + .6 * var(--hs-glass-opacity))),rgba(var(--secondary-bg-rgb),calc(.45 * var(--hs-glass-opacity)))),url("${config.background}")`:'';
  const home=$('hs-home'),wallpaper=config.homeBackground;
  if(appliedWallpaper!==wallpaper){
   appliedWallpaper=wallpaper;
   if(validWallpaper(wallpaper))home.style.setProperty('--hs-wallpaper','url('+JSON.stringify(wallpaper)+')');
   else home.style.removeProperty('--hs-wallpaper');
  }
  const opacity=1-glassTransparency()/100;
  home.style.setProperty('--hs-glass-opacity',opacity);
  $('hs-nav')?.style.setProperty('--hs-glass-opacity',opacity);
  syncHomeBackground?.();
  applyBackgroundCrops();
  const now=new Date();$('hs-clock').textContent=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});$('hs-date').textContent=now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
  if($('theme-toggle'))$('theme-toggle').setAttribute('aria-pressed',String(!!s.isDarkMode));
 }
 function openChatDisplay(){
  const modal=$('hs-chat-display');
  if(!modal)return;
  modal.querySelectorAll('[role=switch]').forEach(button=>button.setAttribute('aria-checked',String(button.classList.contains('active'))));
  $('hs-game-invite-frequency').value=window.GameInvites.frequency();
  window.MomentStatus?.syncEmotionSetting?.();
  showModal(modal);
 }
 function setupChatDisplay(){
  const trigger=$('hs-chat-more'),modal=$('hs-chat-display'),close=$('hs-chat-display-close');
  if(!trigger||!modal||!close)return;
  const frequency=$('hs-game-invite-frequency');
  frequency.onchange=()=>{
   try{window.GameInvites.setFrequency(frequency.value);}
   catch{frequency.value=window.GameInvites.frequency();toast('游戏邀请频率保存失败，请重试。');}
  };
  const switches=[...modal.querySelectorAll('[role=switch]')];
  const syncSwitches=()=>switches.forEach(button=>button.setAttribute('aria-checked',String(button.classList.contains('active'))));
  const observer=new MutationObserver(syncSwitches);
  switches.forEach(button=>observer.observe(button,{attributes:true,attributeFilter:['class']}));
  trigger.onclick=openChatDisplay;
  close.onclick=()=>hideModal(modal);
 }
 function setupHomeMusic(){
  const audio=$('audio'),title=$('music-title'),subtitle=$('music-subtitle'),cover=$('vinyl-record-visual');
  const play=$('hs-music-play'),disc=$('hs-music-disc');
  const controls=[[$('hs-music-prev'),$('prev-btn')],[play,$('play-btn')],[$('hs-music-next'),$('next-btn')]];
  if(!audio||!title||!subtitle||!cover||controls.some(([from,to])=>!from||!to))return;
  controls.forEach(([from,to])=>{
   from.onclick=()=>{
    if(from===play&&typeof setFloatingMusicPlayer==='function')setFloatingMusicPlayer(true,true);
    to.click();
   };
  });
  const sync=()=>{
   const hasTrack=!!audio.getAttribute('src');
   const playing=hasTrack&&!audio.paused&&!audio.ended;
   $('hs-music-title').textContent=hasTrack?title.textContent:'暂无歌曲';
   const detail=subtitle.textContent.trim();
   $('hs-music-sub').textContent=hasTrack?detail:'';
   $('hs-music-sub').hidden=!hasTrack||!detail;
   play.setAttribute('aria-label',playing?'暂停':'播放');
   play.querySelector('i').className=playing?'fas fa-pause':'fas fa-play';
   disc.classList.toggle('is-playing',playing);
   disc.firstElementChild.style.backgroundImage=cover.style.backgroundImage;
   disc.classList.toggle('has-cover',!!cover.style.backgroundImage);
   controls.forEach(([from])=>{from.disabled=!hasTrack;});
  };
  const observer=new MutationObserver(sync);
  [title,subtitle].forEach(node=>observer.observe(node,{childList:true,characterData:true,subtree:true}));
  observer.observe(cover,{attributes:true,attributeFilter:['style']});
  observer.observe(audio,{attributes:true,attributeFilter:['src']});
  ['play','pause','ended','emptied','error'].forEach(event=>audio.addEventListener(event,sync));
  sync();
 }
 function setupAppPages(apps){
  const viewport=$('hs-apps'),indicators=$('hs-app-pages');
  const pageSize=8,pages=[],dots=[];
  for(let offset=0;offset<apps.length;offset+=pageSize){
   const grid=document.createElement('div');
   grid.className='hs-app-grid';
   grid.append(...apps.slice(offset,offset+pageSize));
   viewport.append(grid);
   pages.push(grid);

   const dot=document.createElement('button');
   dot.type='button';
   dot.setAttribute('aria-label','第 '+pages.length+' 页功能');
   dot.addEventListener('click',()=>{
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({left:grid.offsetLeft,behavior:reduceMotion?'instant':'smooth'});
   });
   indicators.append(dot);
   dots.push(dot);
  }
  let current=-1;
  function syncPage(){
   if(!viewport.clientWidth&&current>=0)return;
   const index=Math.min(pages.length-1,Math.max(0,Math.round(viewport.scrollLeft/(viewport.clientWidth||1))));
   if(current===index)return;
   current=index;
   dots.forEach((dot,i)=>{
    dot.setAttribute('aria-pressed',String(i===index));
    pages[i].inert=i!==index;
   });
  }
  viewport.addEventListener('scroll',syncPage,{passive:true});
  syncPage();
 }
 function onMessage(m,atBottom=bottom()){
  if(!ready){if(incoming(m))earlyMessages.push(m);return;}update();if(!incoming(m))return;
  const note=messageNotice(m);
  if(!isViewingNotice(note.id)){noteQueue.push(note);showNote();}
  const wasVisible=page==='chat'&&atBottom&&!document.hidden&&!modalOpen()&&!window.XavierConversations?.isViewingAdditionalConversation();
  if(wasVisible){read();return;}
  const id=String(m.id);
  if(unread.includes(id))return;
  unread.push(id);
  save().catch(console.warn);badges();
 }
 function messageNotice(m){
  const descriptor=window.XavierConversations?.describeMessage(m);
  if(descriptor)return descriptor;
  const member=typeof getGroupMemberForMessage==='function'?getGroupMemberForMessage(m.id):null;
  const src=member?member.avatar:($('partner-avatar')?.querySelector('img')?.getAttribute('src')||profile().partnerAvatar);
  return {name:member?.name||profile().partnerName||'Ta',avatar:src,text:isStickerMessage(m)?'[表情包]':m.image?'[图片]':m.type==='voice'?'[语音]':m.text};
 }
 function onConversationMessage(m,descriptor){
  if(!incoming(m)||isViewingNotice(descriptor.id))return;
  noteQueue.push(descriptor);showNote();
 }
 function isViewingNotice(id){
  if(page!=='chat'||document.hidden||modalOpen())return false;
  const conversations=window.XavierConversations;
  const primary=conversations?.primaryId()||'';
  const active=conversations?.openConversationId()||primary;
  return (id||primary)===active;
 }
 function closeViewsForNotice(){
  clearDetails();
  for(const modal of document.querySelectorAll('.modal')){
   if(getComputedStyle(modal).display==='none')continue;
   clearTimeout(modal._hideTimeout);modal._hideTimeout=null;
   modal.style.display='none';
  }
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  document.querySelectorAll('.pd-overlay.show .pd-close').forEach(button=>button.click());
 }
 function showNote(){
  if(!ready||document.hidden)return;
  if(activeNote&&isViewingNotice(activeNote.dataset.conversationId))removeNote();
  if(activeNote)return;
  while(noteQueue.length&&isViewingNotice(noteQueue[0]?.id))noteQueue.shift();
  if(!noteQueue.length)return;
  const {id,name,avatar:src,text}=noteQueue.shift();
  const b=document.createElement('button');b.id='hs-banner';b.type='button';b.setAttribute('aria-label','查看新消息');
  b.dataset.conversationId=id||'';
  b.innerHTML=`<span class="hs-notice-avatar" aria-hidden="true"></span><span><strong>${esc(name)}</strong><span class="hs-note-text">${esc(String(text||'发来了一条消息').slice(0,70))}</span></span><small>查看 →</small>`;
  const icon=b.querySelector('.hs-notice-avatar');
  avatar(icon,src||'');
  icon.querySelector('img')?.addEventListener('error',()=>avatar(icon,''),{once:true});
  let gesture=null, dragged=false;
  b.onclick=()=>{
   if(dragged||activeNote!==b||b.classList.contains('hs-note-exiting'))return;
   removeNote();
   closeViewsForNotice();
   const conversations=window.XavierConversations;
   if(!id||!conversations?.openById(id)){
    if(conversations?.primaryId())conversations.openNative();
    else navigate('chat');
   }
   showNote();
  };
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enterMs=reduceMotion?0:noteEnterMs,exitMs=reduceMotion?0:noteExitMs;
  b.style.setProperty('--hs-note-enter',enterMs+'ms');
  b.style.setProperty('--hs-note-exit',exitMs+'ms');
  activeNote=b;
  document.body.appendChild(b);
  const dismiss=()=>{
   if(activeNote!==b)return;
   clearTimeout(noteTimer);
   b.classList.remove('hs-note-dragging');
   b.classList.add('hs-note-exiting');
   noteTimer=setTimeout(()=>{removeNote();showNote();},exitMs);
  };
  const hold=ms=>{noteTimer=setTimeout(dismiss,ms);};
  b.addEventListener('pointerdown',event=>{
   if(gesture||!event.isPrimary||event.button!==0||b.classList.contains('hs-note-exiting'))return;
   dragged=false;
   b.classList.add('hs-note-settled');
   gesture={id:event.pointerId,x:event.clientX,y:event.clientY};
   clearTimeout(noteTimer);
   b.setPointerCapture(event.pointerId);
  });
  b.addEventListener('pointermove',event=>{
   if(gesture?.id!==event.pointerId)return;
   const offset=event.clientY-gesture.y;
   if(!dragged&&offset < -7 && -offset > Math.abs(event.clientX-gesture.x))dragged=true;
   if(!dragged)return;
   b.classList.add('hs-note-dragging');
   b.style.setProperty('--hs-note-offset',Math.min(0,offset)+'px');
  });
  const endGesture=event=>{
   if(gesture?.id!==event.pointerId)return;
   const lift=gesture.y-event.clientY;
   const swipe=event.type==='pointerup'&&lift>=36&&(dragged||lift>Math.abs(event.clientX-gesture.x));
   gesture=null;
   if(swipe){dragged=true;dismiss();return;}
   b.classList.remove('hs-note-dragging');
   b.style.removeProperty('--hs-note-offset');
   hold(noteHoldMs);
  };
  b.addEventListener('pointerup',endGesture);
  b.addEventListener('pointercancel',endGesture);
  b.addEventListener('lostpointercapture',endGesture);
  hold(enterMs+noteHoldMs);
 }
 function scrollLatest(){
  const chat=$('chat-container');
  if(chat)chat.scrollTo({top:chat.scrollHeight,behavior:'instant'});
 }
 function jumpLatest(){scrollLatest();read();}
 function editor(){
  const options=anniversariesList().filter(a=>ordinal(a.date)!==null);
  $('hs-edit-body').innerHTML=`
   <fieldset class="hs-display-options">
    <legend>首页显示</legend>
    <label><input id="hs-show-relation" type="checkbox" ${config.showRelation?'checked':''}> 显示关系天数</label>
    <fieldset id="hs-relation-options" aria-label="关系卡片附加内容">
     <label><input id="hs-show-countdown" type="checkbox" ${config.showCountdown?'checked':''}> 显示起始日期和周年倒计时</label>
     <label><input id="hs-show-motto" type="checkbox" ${config.showMotto?'checked':''}> 显示卡片标语</label>
    </fieldset>
   </fieldset>
   <label>关系名称<input id="hs-label-input" maxlength="16" value="${esc(config.label)}" placeholder="我们在一起 / 我们相识"></label><label>绑定已有重要日<select id="hs-ann-input"><option value="">单独设置起始日</option>${options.map(a=>`<option value="${esc(a.id)}" ${String(a.id)===config.annId?'selected':''}>${esc(a.name)} · ${esc(a.date)}</option>`).join('')}</select></label><label>起始日期<input id="hs-date-input" type="date" value="${esc(config.date||relationDate()||'')}"></label><p class="hs-hint">从起始日起计算已经过去的自然日，起始日为 0 天；2 月 29 日在平年以 2 月 28 日纪念。</p><p class="hs-hint">卡片标语与聊天顶部同步，可在「字卡库 → 氛围感 → 顶部格言」中管理。</p><label>专属背景<input id="hs-bg-input" type="file" accept="image/*"></label><button id="hs-adjust-card-bg" type="button">调整卡片取景</button><label><input id="hs-clear-bg" type="checkbox"> 恢复主题色背景</label><button id="hs-save" type="button">保存这张关系卡</button>`;
  window.XavierConversations?.mountRelationship($('hs-edit-body'));
  const showRelation=$('hs-show-relation');
  const syncOptions=()=>{$('hs-relation-options').disabled=!showRelation.checked;};
  showRelation.onchange=syncOptions;
  syncOptions();
  const editorKey=storageKey;
  const fileInput=$('hs-bg-input'),clearBackground=$('hs-clear-bg'),adjustBackground=$('hs-adjust-card-bg');
  const saveButton=$('hs-save');
  let draftBackground=config.background,draftCrop=config.backgroundCrop;
  const syncBackgroundActions=()=>{adjustBackground.disabled=!draftBackground||clearBackground.checked;};
  clearBackground.onchange=syncBackgroundActions;
  syncBackgroundActions();
  const adjustCard=async file=>{
   if(saveButton.disabled)return;
   saveButton.disabled=adjustBackground.disabled=fileInput.disabled=true;
   try{
    const source=file?await compress(file):draftBackground;
    const crop=await window.HomeImageCrop.edit(source,file?null:draftCrop,$('hs-relation'),'调整关系卡片取景');
    if(editorKey!==storageKey)throw Error('会话已切换，请重新选择图片。');
    if(crop){draftBackground=source;draftCrop=crop;clearBackground.checked=false;}
   }catch(error){toast(error.message||'无法调整图片，请重试。');}
   finally{saveButton.disabled=fileInput.disabled=false;syncBackgroundActions();}
  };
  adjustBackground.onclick=()=>adjustCard();
  fileInput.onchange=()=>{
   const file=fileInput.files[0];fileInput.value='';
   if(file)adjustCard(file);
  };
  saveButton.onclick=async()=>{
   const button=$('hs-save');button.disabled=true;
   try{
    const id=$('hs-ann-input').value,date=$('hs-date-input').value;
    const chosen=options.find(a=>String(a.id)===id);
    if((chosen?.date||date)&&ordinal(chosen?.date||date)===null)throw Error('请设置一个有效的起始日期。');
    if(editorKey!==storageKey)throw Error('会话已切换，请重新打开关系卡片。');
    await save({
     label:$('hs-label-input').value.trim()||'我们在一起',annId:id,date:chosen?.date||date,
     background:clearBackground.checked?'':draftBackground,backgroundCrop:clearBackground.checked?null:draftCrop,
     showRelation:showRelation.checked,showCountdown:$('hs-show-countdown').checked,showMotto:$('hs-show-motto').checked
    });
    update();hideModal($('hs-edit-modal'));
   }catch(e){toast(e.message||'保存失败，请重试。');}finally{button.disabled=false;}
  };showModal($('hs-edit-modal'));
 }
 async function compress(file){
  if(!file.type.startsWith('image/')||file.size>15*1024*1024)throw Error('请选择小于 15MB 的图片。');
  const url=URL.createObjectURL(file);
  try{const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('图片无法读取，请换成 JPG 或 PNG。'));img.src=url;});
   let scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');
   for(let i=0;i<7;i++){canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.78-i*.05);if(data.length*.75<=300*1024)return data;scale*=.8;}
   throw Error('图片压缩后仍过大，请换一张。');
  }finally{URL.revokeObjectURL(url);}
 }
 function setupHomeBackground(home){
  const entry=$('hs-home-background-entry'),panel=$('appearance-panel-home-background');
  const input=$('hs-home-wallpaper-file'),status=$('hs-home-wallpaper-status');
  const gallery=$('hs-home-background-gallery'),add=$('hs-home-background-add'),theme=$('hs-home-background-theme');
  const reset=$('hs-home-wallpaper-reset'),adjust=$('hs-home-wallpaper-adjust');
  const range=$('hs-home-glass-range'),value=$('hs-home-glass-value');
  const darkRange=$('hs-home-dark-range'),darkValue=$('hs-home-dark-value');
  const preview=$('hs-home-glass-preview');
  if(!entry||!panel)return;
  let busy=false,lastTap=null,lastImages,lastWallpaper;
  const open=()=>{
   if(modalOpen())return;
   showModal($('appearance-modal'));
   entry.click();
  };
  const previewGlass=()=>{
   const transparency=Number(range.value);
   value.textContent=transparency+'%';
   preview.style.setProperty('--hs-glass-opacity',1-transparency/100);
  };
  const previewDark=()=>{
   const darkness=Number(darkRange.value);
   darkValue.textContent=darkness+'%';
   for(const target of [home,preview])target.style.setProperty('--hs-night-darkness',darkness/100);
  };
  const select=async (wallpaper,file,editCrop=false)=>{
   if(busy)return;
   const activeKey=storageKey;
   busy=true;add.disabled=theme.disabled=reset.disabled=adjust.disabled=true;
   status.textContent='';
   try{
    const homeBackground=file?await compress(file):wallpaper;
    let crop=currentWallpaperCrop(homeBackground);
    if(file||editCrop){
     crop=await window.HomeImageCrop.edit(homeBackground,crop,home,'调整首页背景取景');
     if(!crop)return;
    }
    if(activeKey!==storageKey)throw Error('会话已切换，请重新选择图片。');
    const images=new Set(Array.isArray(config.homeBackgrounds)?config.homeBackgrounds:[]);
    if(validWallpaper(config.homeBackground))images.add(config.homeBackground);
    if(homeBackground)images.add(homeBackground);
    const homeBackgrounds=[...images];
    const homeBackgroundCrops=homeBackgrounds.map(image=>image===homeBackground?crop:currentWallpaperCrop(image));
    await save({homeBackground,homeBackgrounds,homeBackgroundCrops});
    update();
   }catch(error){status.textContent=error.message||'背景保存失败，请重试。';}
   finally{busy=false;add.disabled=theme.disabled=false;reset.disabled=adjust.disabled=!config.homeBackground;}
  };
  syncHomeBackground=()=>{
   const {homeBackground,homeBackgrounds}=config;
   if(lastImages!==homeBackgrounds||lastWallpaper!==homeBackground){
    lastImages=homeBackgrounds;lastWallpaper=homeBackground;
    const images=new Set(Array.isArray(homeBackgrounds)?homeBackgrounds.filter(validWallpaper):[]);
    if(validWallpaper(homeBackground))images.add(homeBackground);
    gallery.querySelectorAll('.hs-wallpaper-image').forEach(button=>button.remove());
    [...images].forEach((image,index)=>{
     const button=document.createElement('button'),thumbnail=new Image();
     button.type='button';button.className='bg-item hs-wallpaper-image';
     button.setAttribute('aria-label','首页背景 '+(index+1));
     button.setAttribute('aria-pressed',String(image===homeBackground));
     thumbnail.alt='';thumbnail.src=image;thumbnail.loading='lazy';
     button.appendChild(thumbnail);button.onclick=()=>select(image);
     gallery.appendChild(button);
    });
    theme.setAttribute('aria-pressed',String(!homeBackground));
    reset.disabled=adjust.disabled=busy||!homeBackground;
    if(validWallpaper(homeBackground))preview.style.setProperty('--hs-wallpaper','url('+JSON.stringify(homeBackground)+')');
    else preview.style.removeProperty('--hs-wallpaper');
   }
   if(range!==document.activeElement){range.value=String(glassTransparency());previewGlass();}
   if(darkRange!==document.activeElement){darkRange.value=String(homeDarkness());previewDark();}
  };
  const isBlank=event=>!event.target.closest('button,input,.hs-time,.hs-home-music,.hs-home-functions');
  home.addEventListener('dblclick',event=>{if(isBlank(event))open();});
  home.addEventListener('click',event=>{
   const touch=event.pointerType==='touch'||event.sourceCapabilities?.firesTouchEvents;
   if(!touch||!isBlank(event)){lastTap=null;return;}
   const {clientX:x,clientY:y,timeStamp:time}=event;
   if(lastTap&&time-lastTap.time<350&&Math.hypot(x-lastTap.x,y-lastTap.y)<32){
    lastTap=null;open();
   }else lastTap={x,y,time};
  });
  home.addEventListener('scroll',()=>{lastTap=null;},{passive:true});
  entry.onclick=()=>{
   status.textContent='';
   window.showAppearancePanel('home-background');
   syncHomeBackground();
   panel.querySelector('[aria-labelledby]')?.scrollIntoView({block:'nearest'});
   add.focus({preventScroll:true});
  };
  add.onclick=()=>input.click();
  input.onchange=()=>{
   const file=input.files[0];input.value='';
   if(file)select('',file);
  };
  theme.onclick=reset.onclick=()=>select('');
  adjust.onclick=()=>{if(config.homeBackground)select(config.homeBackground,null,true);};
  range.oninput=previewGlass;
  darkRange.oninput=previewDark;
  darkRange.onchange=async()=>{
   try{await save({homeNightDarkness:Number(darkRange.value)});update();}
   catch{toast('夜间调暗程度保存失败，请重试。');darkRange.value=String(homeDarkness());previewDark();}
  };
  range.onchange=async()=>{
   try{await save({homeGlassTransparency:Number(range.value)});update();}
   catch{toast('透明度保存失败，请重试。');range.value=String(glassTransparency());previewGlass();}
  };
 }
 function liftChatPanels(){
  const chat=document.querySelector('.main-chat-area');if(!chat)return;
  const keep=new Set(['history-loader','chat-container','xv-thread','empty-state','typing-indicator-wrapper']);
  for(const node of [...chat.children]){
   if(node.tagName!=='DIV'||keep.has(node.id)||node.classList.contains('input-area-wrapper'))continue;
   document.body.appendChild(node);
  }
 }
 function mount(){
  liftChatPanels();
  const style=document.createElement('style');style.textContent=`
  body.hs-enabled{--hs-nav-height:calc(65px + env(safe-area-inset-bottom,0px));padding-bottom:var(--hs-nav-height);box-sizing:border-box;height:100dvh}body.hs-enabled .input-area-wrapper{bottom:var(--hs-nav-height);padding-bottom:0}body.hs-enabled.immersive-mode .input-area-wrapper{bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)}body.hs-enabled[data-hs-page=home]>.header,body.hs-enabled[data-hs-page=settings]>.header,body.hs-enabled[data-hs-page=home]>.main-chat-area,body.hs-enabled[data-hs-page=settings]>.main-chat-area{display:none!important}
  body.hs-enabled[data-hs-page=chat]{--hs-nav-height:0px;padding-bottom:0}body.hs-enabled[data-hs-page=chat] .input-area-wrapper{bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)}
  #hs-nav[hidden],#hs-chat-toolbar[hidden]{display:none!important}#hs-chat-toolbar{display:flex;align-items:center;position:relative;flex:0 0 auto;color:var(--text-secondary);box-sizing:border-box}#hs-chat-back{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;border-radius:12px;background:transparent;color:var(--accent-color);cursor:pointer;touch-action:manipulation}#hs-chat-back svg{width:21px;height:21px}#hs-chat-back:hover{background:rgba(var(--accent-color-rgb),.08)}#hs-chat-back:focus-visible{outline:2px solid var(--accent-color);outline-offset:2px}
  body.hs-enabled[data-hs-page=chat] .header .header-inner{justify-content:flex-start;gap:9px;padding:10px 12px;min-height:0}
  body.hs-enabled[data-hs-page=chat] .header .user-info:has(> #my-avatar-container){display:none}
  body.hs-enabled[data-hs-page=chat] .header .user-info:has(> #partner-avatar-container){display:grid;grid-template-columns:40px minmax(0,1fr);grid-template-rows:auto auto;align-items:center;align-content:center;column-gap:10px;row-gap:3px;min-width:0;max-width:100%;text-align:left}
  body.hs-enabled[data-hs-page=chat] .header .user-info:has(> #partner-avatar-container)> #partner-avatar-container{grid-area:1 / 1 / 3 / 2;width:40px;height:40px}
  body.hs-enabled[data-hs-page=chat] .header .user-info:has(> #partner-avatar-container)> #partner-name{grid-area:1 / 2;align-self:end;max-width:100%;font-size:14px;line-height:1.2;text-align:left}
  body.hs-enabled[data-hs-page=chat] .header .user-info:has(> #partner-avatar-container)> #partner-status{grid-area:2 / 2;align-self:start;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11px;line-height:1.2;padding:0}
  body.hs-enabled[data-hs-page=chat] .header .user-info:has(> #partner-avatar-container)> #partner-status::before{content:"";display:inline-block;width:5px;height:5px;margin-right:5px;vertical-align:2px;border-radius:50%;background:currentColor}
  body.hs-enabled[data-hs-page=chat] .header .header-motto{display:none!important}
  #hs-chat-more[hidden]{display:none}
  body.hs-enabled[data-hs-page=chat] #hs-chat-more:not([hidden]){display:grid;place-items:center;order:3;margin-left:auto;flex:0 0 42px;height:42px;padding:0;border:0;border-radius:12px;background:transparent;color:var(--text-primary);cursor:pointer;touch-action:manipulation}
  #hs-chat-more svg{width:21px;height:21px}#hs-chat-more:hover{background:rgba(var(--accent-color-rgb),.1)}
  #hs-chat-more:focus-visible,#hs-chat-display button:focus-visible,.hs-music-controls button:focus-visible{outline:2px solid var(--accent-color);outline-offset:2px}
  #hs-chat-display>.modal-content{width:min(92%,420px);box-sizing:border-box}
  #hs-chat-display .setting-pill-row{width:100%;min-height:52px;font:inherit;color:var(--text-primary);text-align:left}
  #hs-chat-display .setting-pill-row:focus-visible{outline-offset:-3px}
  #hs-chat-display .setting-pill-label>span{display:block;margin-top:4px;line-height:1.4}
  #hs-chat-display .setting-pill-knob{display:block}
  #hs-game-invite-frequency{font:inherit;color:var(--text-primary);background:var(--primary-bg);border:1px solid var(--border-color);border-radius:10px;padding:6px 8px}
  #hs-settings #advanced-settings{display:none!important}#hs-relation [hidden]{display:none!important}
  #custom-replies-modal>.modal-content{box-sizing:border-box;width:94%;max-width:600px;min-width:0;overflow:hidden;max-height:90vh;max-height:90dvh;margin:0 auto;padding:0;flex-direction:column}
  #custom-replies-modal .modal-sidebar{box-sizing:border-box;display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:flex-start;width:100%;max-width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;padding:10px 12px;gap:8px;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scroll-padding-inline:12px;touch-action:pan-x;scrollbar-width:thin}
  #custom-replies-modal .modal-sidebar .sidebar-btn{flex:0 0 auto;white-space:nowrap}#custom-replies-modal .modal-main-view{box-sizing:border-box;flex:1 1 0;min-height:0;min-width:0;width:100%;max-width:100%;height:auto;overflow:hidden}#custom-replies-modal #imagepool-panel{box-sizing:border-box;min-width:0;max-width:100%;overflow-x:hidden;overflow-y:auto}#custom-replies-modal #cr-sub-tabs{box-sizing:border-box;max-width:100%;justify-content:flex-start;overflow-x:auto}#custom-replies-modal #cr-sub-tabs>*{flex:0 0 auto}
  #chat-modal .cs-card{box-sizing:border-box;max-width:100%;min-width:0}#chat-modal #time-format-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;max-width:100%;min-width:0;padding:8px;box-sizing:border-box}#chat-modal #time-format-options>.time-fmt-opt{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 5px;min-width:0;width:auto;max-width:100%;box-sizing:border-box;margin:0;transform:none}#chat-modal #time-format-options>.time-fmt-opt::after{display:none}#chat-modal #time-format-options>.time-fmt-opt>i{width:28px;height:28px;font-size:14px;flex:none}#chat-modal #time-format-options>.time-fmt-opt>span{font-size:12px;line-height:1.4;white-space:nowrap;flex:none;min-width:0;max-width:100%;letter-spacing:0}#chat-modal #time-format-options>.time-fmt-opt:last-child{grid-column:1/-1;flex-direction:row}
  #back-chat,#back-appearance{display:none!important}
  #custom-replies-modal .modal-main-view > [hidden],#custom-replies-modal #add-custom-reply[hidden]{display:none!important}
  #custom-replies-modal.hs-settings-detail .modal-buttons:has(> #add-custom-reply[hidden]){display:none!important}
  #custom-replies-modal :is(#imagepool-panel,#announcement-panel){padding-bottom:16px!important}
  #anniversary-modal .ann-list-container{flex:1 1 0;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:16px;gap:12px}#anniversary-modal .ann-item-card{flex:0 0 auto;min-height:118px;height:auto;box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;gap:10px;padding:16px 18px;overflow:visible}#anniversary-modal .ann-item-left{min-width:0;width:100%;flex:none}#anniversary-modal .ann-item-name{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;max-width:none;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;font-size:15px;line-height:1.6}#anniversary-modal .ann-item-card>.ann-item-left+div{width:100%;box-sizing:border-box;justify-content:flex-end;flex-wrap:wrap}#anniversary-modal .ann-item-right{margin-left:0;min-width:0;flex:1;max-width:100%;align-items:center}#anniversary-modal .ann-item-days{font-size:clamp(20px,6vw,30px);line-height:1.25;white-space:normal;overflow-wrap:anywhere}#anniversary-modal .ann-tag{flex-shrink:0}#anniversary-modal .ann-footer,#anniversary-modal #ann-card-toolbar{flex-shrink:0}
  #close-chat,#close-appearance,#close-data,#cancel-session,#close-custom-replies,#back-chat,#back-appearance{display:none!important}#chat-modal.hs-settings-detail .cs-footer,#appearance-modal.hs-settings-detail>.modal-content>.modal-buttons{display:none!important}
  #hs-settings .modal-title>i{display:none}#hs-settings .settings-grid{display:flex;flex-direction:column;gap:0;border-top:1px solid var(--border-color)}#hs-settings .settings-grid>.settings-card{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:0;width:100%;min-height:64px;box-sizing:border-box;padding:19px 4px;border:0;border-bottom:1px solid var(--border-color);border-radius:0;background:transparent;box-shadow:none;transform:none;cursor:pointer;text-align:left}#hs-settings .settings-grid>.settings-card>i,#hs-settings .settings-grid>.settings-card>svg{display:none}#hs-settings .settings-grid>.settings-card>span{font-size:15px;color:var(--text-primary);font-weight:400}#hs-settings .settings-grid>.settings-card::after{content:'›';font-size:24px;color:var(--text-secondary);opacity:.65}#hs-settings #hs-shortcut-session-manager-btn{display:flex;flex-direction:row;justify-content:space-between;gap:0}#hs-settings #hs-shortcut-session-manager-btn .hs-shortcut-icon{position:absolute;inset:0;width:100%;height:100%;opacity:0;z-index:1}#hs-settings #hs-shortcut-session-manager-btn{position:relative}
  body.hs-settings-detail-open #hs-nav{display:none!important}body.hs-settings-detail-open{padding-bottom:0}.modal.hs-settings-detail{inset:0!important;width:100%!important;height:100vh!important;height:100dvh!important;max-height:none!important;background:var(--primary-bg)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0!important;align-items:stretch!important;justify-content:stretch!important;animation:none!important}.modal.hs-settings-detail>.modal-content{position:relative;box-sizing:border-box;width:100%!important;max-width:none!important;min-width:0;height:100%!important;max-height:none!important;margin:0!important;padding:0 20px max(18px,env(safe-area-inset-bottom))!important;border:0!important;border-radius:0!important;box-shadow:none!important;transform:none!important;opacity:1!important;overflow-y:auto;overflow-x:hidden;animation:none!important;background:var(--primary-bg)}.hs-setting-top{display:flex;align-items:center;gap:8px;position:sticky;top:0;flex-shrink:0;z-index:30;min-height:52px;padding-top:env(safe-area-inset-top);background:var(--primary-bg);border-bottom:1px solid var(--border-color);margin-bottom:12px}.hs-setting-back{border:0;background:none;color:var(--accent-color);padding:0;width:38px;height:42px;display:grid;place-items:center;cursor:pointer;flex-shrink:0}.hs-setting-back svg{width:22px;height:22px}.hs-setting-top>span{font-size:16px;font-weight:500}.hs-settings-detail>.modal-content>.modal-title{display:none!important}.hs-obsolete-close{display:none!important}#custom-replies-modal.hs-settings-detail>.modal-content{display:flex;flex-direction:column;overflow:hidden;padding:0 0 env(safe-area-inset-bottom)!important}#custom-replies-modal.hs-settings-detail .hs-setting-top{padding-left:12px;padding-right:12px;margin-bottom:0}#chat-modal.hs-settings-detail .cs-header{display:block;padding:0 12px;background:var(--primary-bg)}#chat-modal.hs-settings-detail .cs-header-top{display:none}#chat-modal.hs-settings-detail .cs-tabs{position:static;display:flex;flex-wrap:nowrap;overflow-x:auto;flex-shrink:0;touch-action:pan-x}#chat-modal.hs-settings-detail .cs-tab{flex:0 0 auto}#session-modal.hs-settings-detail .session-list{min-height:0}#appearance-modal.hs-settings-detail #appearance-panel-container{max-width:760px;width:100%;margin:0 auto}#appearance-modal.hs-settings-detail #appearance-nav-grid{max-width:760px;width:100%;margin:0 auto}
  #hs-settings .settings-grid>.settings-card{flex:0 0 64px;height:64px;min-height:64px;max-height:64px;aspect-ratio:auto;padding:16px 4px!important}#hs-settings .settings-grid>.settings-card>span{text-align:left;flex:1}#hs-settings .settings-grid>.settings-card::after{flex:0 0 auto}
  #data-modal.hs-settings-detail{position:fixed!important;inset:0!important;align-items:stretch!important;justify-content:stretch!important;height:100vh!important;height:100dvh!important;width:100%!important;padding:0!important}#data-modal.hs-settings-detail>.modal-content{position:relative!important;display:flex!important;flex-direction:column!important;height:100%!important;max-height:100%!important;min-height:0!important;width:100%!important;max-width:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important;animation:none!important;transform:none!important;overflow:hidden!important}#data-modal.hs-settings-detail .dm-topbar{padding:env(safe-area-inset-top) 12px 0;min-height:52px;box-sizing:content-box;flex:0 0 auto;position:relative;top:auto;background:var(--primary-bg)}#data-modal.hs-settings-detail .dm-topbar-back{border:0;border-radius:0;background:transparent;color:var(--accent-color);height:42px;width:38px}#data-modal.hs-settings-detail .dm-body{flex:1 1 0;min-height:0;overflow-y:auto}#data-modal.hs-settings-detail .dm-topbar-close{display:none!important}#chat-modal.hs-settings-detail>.modal-content>.hs-setting-top{padding-left:12px;padding-right:12px;margin-bottom:0}
  .hs-page{position:absolute;inset:0 0 var(--hs-nav-height);overflow-y:auto;overscroll-behavior:contain;background:var(--primary-bg);color:var(--text-primary);padding:26px 20px 24px;box-sizing:border-box;z-index:10}.hs-page[hidden]{display:none!important}.hs-content{max-width:650px;margin:0 auto}
  #hs-relation{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;width:100%;padding:20px 16px;border-radius:24px;border:1px solid rgba(var(--accent-color-rgb),.1);background:linear-gradient(155deg,rgba(var(--accent-color-rgb),.08),var(--secondary-bg));background-size:cover,var(--hs-image-size,cover);background-position:center,var(--hs-image-position,center);background-origin:border-box;background-clip:border-box;background-repeat:no-repeat;text-align:center;color:var(--text-primary);box-shadow:0 15px 35px rgba(var(--accent-color-rgb),.07);cursor:pointer;font:inherit;min-height:210px}
  .hs-avatars{display:flex;justify-content:center}.hs-avatar{height:54px;width:54px;display:grid;place-items:center;border-radius:50%;background:var(--secondary-bg);border:2px solid #fff;overflow:hidden;box-shadow:0 5px 15px #0001}.hs-avatar:has(>img){background:transparent}.hs-avatar+ .hs-avatar{margin-left:-10px}.hs-avatar img{width:100%;height:100%;object-fit:cover}.hs-avatar i{font-size:25px;color:var(--accent-color)}#hs-names{display:block;font-size:15px;font-weight:500;letter-spacing:1px}#hs-days{display:block;font-size:20px;line-height:1.6;font-weight:600;margin:2px 0 5px}#hs-countdown,#hs-motto{display:block;font-size:11px;line-height:1.8;color:var(--text-secondary)}#hs-motto{margin-top:8px} #hs-relation.hs-relation-simple .hs-avatar{width:70px;height:70px} #hs-relation.hs-relation-simple .hs-avatar i{font-size:30px}
  :is(#hs-home,#hs-home-glass-preview,body.hs-enabled[data-hs-page=home] #hs-nav){
   --hs-glass-strength:var(--hs-glass-opacity,.63);
   --hs-glass:rgba(var(--secondary-bg-rgb),var(--hs-glass-strength));
   --hs-glass-filter:blur(calc(15px * var(--hs-glass-strength))) saturate(calc(1 + .18 * var(--hs-glass-strength)));
   --hs-glass-line:rgba(255,255,255,calc(.16 + .48 * var(--hs-glass-strength)));
   --hs-glass-shadow:0 8px 26px rgba(32,22,52,calc(.14 * var(--hs-glass-strength)));
   --hs-wallpaper-wash:rgba(var(--primary-bg-rgb),calc(.4 * var(--hs-glass-strength)));
  }
  html[data-theme=dark] :is(#hs-home,#hs-home-glass-preview,body.hs-enabled[data-hs-page=home] #hs-nav){
   --hs-glass-line:rgba(255,255,255,calc(.12 + .14 * var(--hs-glass-strength)));
   --hs-wallpaper-wash:rgba(0,0,0,var(--hs-night-darkness,.48));
  }
  #hs-home{
   bottom:0;padding:0;overflow:hidden;
   background:
    linear-gradient(var(--hs-wallpaper-wash),var(--hs-wallpaper-wash)) center / cover no-repeat,
    var(--hs-wallpaper, radial-gradient(ellipse at 6% 7%,rgba(var(--accent-color-rgb),.31),transparent 56%),
      radial-gradient(ellipse at 96% 52%,rgba(139,160,220,.35),transparent 60%)) var(--hs-image-position,center) / var(--hs-image-size,cover) no-repeat,
    var(--primary-bg);
  }
  #hs-home .hs-content{position:relative}
  .hs-time{text-align:center;margin:0 auto 20px}
  #hs-home-background-entry{font:inherit;color:var(--text-primary)}
  #hs-home-background-gallery{grid-template-columns:repeat(auto-fill,minmax(66px,74px));gap:14px}
  #hs-home-background-gallery .bg-item{padding:0;color:var(--text-secondary);background-color:var(--message-received-bg)}
  #hs-home-background-gallery .bg-item[aria-pressed=true]{border-color:var(--accent-color);box-shadow:0 0 0 2px rgba(var(--accent-color-rgb),.25)}
  #hs-home-background-gallery .bg-item:not(.bg-add-btn):not([aria-pressed=true]){border-color:rgba(var(--secondary-bg-rgb),.7)}
  #hs-home-background-theme{background-image:linear-gradient(145deg,rgba(var(--accent-color-rgb),.08),rgba(139,160,220,.48))}
  .hs-home-background-reset{text-align:center;margin:8px 0}
  .hs-home-background-reset .modal-btn{padding:6px 12px;font-size:12px}
  #hs-home-wallpaper-reset:disabled{opacity:.55;cursor:default}
  #hs-home-wallpaper-status:empty{display:none}
  #hs-home-glass-range,#hs-home-dark-range{min-width:0}
  #hs-home-glass-range:focus-visible,#hs-home-background-gallery button:focus-visible{outline:2px solid var(--accent-color);outline-offset:3px}
  #hs-home-glass-preview{
   display:grid;place-items:center;min-height:74px;border-radius:14px;
   background:
    linear-gradient(var(--hs-wallpaper-wash),var(--hs-wallpaper-wash)) center / cover,
    var(--hs-wallpaper,linear-gradient(115deg,rgba(var(--accent-color-rgb),.38),rgba(139,160,220,.43))) var(--hs-image-position,center) / var(--hs-image-size,cover) no-repeat;
  }
  #hs-home-glass-preview span{
   padding:9px 21px;border-radius:11px;color:var(--text-primary);font-size:12px;
  }
  #hs-clock{font-size:clamp(43px,11vw,68px);font-weight:400;font-variant-numeric:tabular-nums;letter-spacing:.06em;line-height:1.1}
  #hs-date{margin-top:6px;font-size:13px;color:var(--text-secondary);line-height:1.4}
  .hs-home-music,.hs-home-functions{margin-top:14px;border-radius:22px}
  #hs-home :is(#hs-relation,.hs-home-music,.hs-home-functions),#hs-home-glass-preview span,body.hs-enabled[data-hs-page=home] #hs-nav{
   border-color:var(--hs-glass-line);background-color:var(--hs-glass);
   box-shadow:var(--hs-glass-shadow);
   backdrop-filter:var(--hs-glass-filter);-webkit-backdrop-filter:var(--hs-glass-filter);
  }
  #hs-home :is(#hs-relation,.hs-home-music,.hs-home-functions),#hs-home-glass-preview span{border-style:solid;border-width:1px}
  #hs-home #hs-relation:not(.hs-has-relation-image){background-image:none}
  #hs-home #hs-apps .hs-shortcut-icon,#hs-home .hs-app-grid>.settings-item>i{
   background:rgba(var(--secondary-bg-rgb),calc(.12 + .64 * var(--hs-glass-strength)));
   box-shadow:none;
  }
  .hs-home-music{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:clamp(12px,4vw,25px);padding:12px clamp(12px,4vw,26px)}
  #hs-music-disc{display:grid;place-items:center;width:clamp(60px,18vw,96px);aspect-ratio:1;border-radius:50%;background:repeating-radial-gradient(circle at center,#232126 0 2px,#343137 3px 4px,#201e23 5px 6px);box-shadow:0 4px 11px #0003}
  #hs-music-disc>span{display:grid;place-items:center;width:57%;aspect-ratio:1;border-radius:50%;background:var(--accent-color) center/cover;color:#fff;font-size:13px}
  #hs-music-disc.has-cover i{display:none}
  #hs-music-disc.is-playing{animation:hs-disc-spin 7s linear infinite}
  @keyframes hs-disc-spin{to{transform:rotate(360deg)}}
  @media(prefers-reduced-motion:reduce){#hs-music-disc.is-playing{animation:none}}
  .hs-music-copy{text-align:center;min-width:0}
  #hs-music-title,#hs-music-sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #hs-music-title{font-size:15px;font-weight:600;color:var(--text-primary)}
  #hs-music-sub{font-size:12px;color:var(--text-secondary);margin-top:4px}
  .hs-music-controls{display:flex;justify-content:center;gap:clamp(4px,3vw,18px);margin-top:5px}
  .hs-music-controls button{width:42px;height:42px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--text-primary);cursor:pointer}
  .hs-music-controls #hs-music-play{background:rgba(var(--accent-color-rgb),.16)}
  .hs-music-controls button:hover:not(:disabled){background:rgba(var(--accent-color-rgb),.24)}
  .hs-music-controls button:disabled{opacity:.45;cursor:default}
  .hs-home-functions{padding:6px 4px 0}
  #hs-preview{width:100%;display:flex;gap:12px;align-items:center;border:1px solid var(--border-color);border-radius:20px;background:var(--secondary-bg);color:var(--text-primary);padding:15px;text-align:left;font:inherit;cursor:pointer}.hs-preview-copy{flex:1;min-width:0}#hs-preview-name{display:block;font-size:14px}#hs-preview-text{display:block;color:var(--text-secondary);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px}#hs-preview-time{font-size:11px;color:var(--text-secondary)}.hs-badge{background:#e66b7c;color:#fff;border-radius:12px;padding:1px 6px;font-size:10px}.hs-badge[hidden]{display:none!important}
  body.hs-enabled .header .header-actions{display:none!important}
  #hs-apps .hs-shortcut-icon{width:52px;height:52px;display:grid;place-items:center;padding:0;border:0;border-radius:18px;background:var(--secondary-bg);color:var(--accent-color);font-size:21px;margin:0;box-shadow:0 5px 18px rgba(var(--accent-color-rgb),.05);cursor:pointer}#hs-apps .hs-shortcut-icon i{width:auto;height:auto;border-radius:0;background:transparent;color:inherit;transform:none;font-size:21px;margin:0}#hs-settings .hs-shortcut-icon{border:0;background:transparent;color:var(--accent-color);padding:0;font:inherit;cursor:pointer}#hs-settings .hs-shortcut-icon i{font-size:24px}#hs-settings #hs-shortcut-session-manager-btn{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:0;cursor:pointer}
  #hs-apps{display:flex;position:relative;margin-top:24px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;scrollbar-width:none}
  #hs-apps::-webkit-scrollbar{display:none}
  .hs-app-grid{display:grid;flex:0 0 100%;min-width:0;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 7px;align-content:start;scroll-snap-align:start;scroll-snap-stop:always}
  .hs-app-grid>.settings-item{border:0;background:none;display:flex;flex-direction:column;text-align:center;gap:8px;margin:0;padding:8px 1px;min-width:0;position:relative;box-shadow:none}.hs-app-grid>.settings-item>i{width:52px;height:52px;display:grid;place-items:center;border-radius:18px;background:var(--secondary-bg);color:var(--accent-color);font-size:21px;margin:0;box-shadow:0 5px 18px rgba(var(--accent-color-rgb),.05)}.hs-app-grid>.settings-item>span:not(.env-badge){font-size:11px;line-height:1.5;color:var(--text-secondary)}#hs-apps .env-badge{right:8px!important;top:3px!important}#hs-app-pages{display:flex;justify-content:center;gap:8px;margin:20px 0}#hs-app-pages button{width:7px;height:7px;border:0;border-radius:6px;padding:0;background:var(--border-color)}#hs-app-pages button[aria-pressed=true]{width:24px;background:var(--accent-color)}
  #hs-nav{position:fixed;bottom:0;left:0;right:0;z-index:1200;height:var(--hs-nav-height);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box;background:var(--secondary-bg);border-top:1px solid var(--border-color);display:flex;justify-content:center}#hs-nav button{flex:1;max-width:230px;border:0;background:none;font:inherit;color:var(--text-secondary);display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;font-size:10px;position:relative;cursor:pointer}#hs-nav i{font-size:21px}#hs-nav [aria-current=page]{color:var(--accent-color)}#hs-nav .hs-badge{position:absolute;top:4px;left:calc(50% + 9px)}
  #hs-settings>.modal-content{max-width:650px;width:100%;margin:0 auto;max-height:none;padding:0;border:0;box-shadow:none;background:none;overflow:visible;opacity:1!important;transform:none!important}#hs-settings .modal-title{margin:12px 0 25px}#hs-settings #cancel-settings{display:none}#hs-settings .settings-grid{gap:14px}#hs-settings .settings-card{border-radius:20px;padding:22px 12px}.hs-page button:focus-visible,#hs-nav button:focus-visible{outline:2px solid var(--accent-color);outline-offset:3px}
  #hs-banner{position:fixed;top:max(14px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:92%;max-width:430px;z-index:100100;display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--secondary-bg);color:var(--text-primary);border:1px solid var(--border-color);border-radius:20px;box-shadow:0 8px 28px #0002;text-align:left;font:inherit;cursor:pointer;touch-action:none;user-select:none}
  #hs-banner{animation:hs-note-enter var(--hs-note-enter) cubic-bezier(.2,.75,.3,1) both}
  #hs-banner.hs-note-settled{animation:none}
  #hs-banner.hs-note-dragging{animation:none;transform:translate(-50%,var(--hs-note-offset,0px))}
  #hs-banner.hs-note-exiting{animation:hs-note-exit var(--hs-note-exit) ease-in both;pointer-events:none}
  @keyframes hs-note-enter{from{transform:translate(-50%,calc(-100% - max(14px,env(safe-area-inset-top)) - 30px));opacity:0}to{transform:translate(-50%,0);opacity:1}}
  @keyframes hs-note-exit{from{transform:translate(-50%,var(--hs-note-offset,0px));opacity:1}to{transform:translate(-50%,calc(-100% - max(14px,env(safe-area-inset-top)) - 30px));opacity:0}}
  .hs-notice-avatar{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border-radius:12px;overflow:hidden;background:var(--primary-bg);color:var(--accent-color)}
  .hs-notice-avatar img{display:block;width:100%;height:100%;object-fit:cover}
  #hs-banner>span:nth-child(2){flex:1;min-width:0}#hs-banner strong{font-size:13px}.hs-note-text{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:var(--text-secondary)}#hs-banner small{font-size:10px;color:var(--accent-color)}#hs-new-messages{position:fixed;right:15px;bottom:calc(var(--hs-nav-height) + 115px);z-index:1250;border:1px solid var(--border-color);border-radius:20px;background:var(--secondary-bg);color:var(--accent-color);padding:8px 13px;font:inherit;font-size:12px}
  #hs-edit-body .hs-display-options{min-width:0;margin:0 0 16px;padding:0 12px 8px;border:1px solid var(--border-color);border-radius:12px}
  #hs-edit-body .hs-display-options legend{padding:0 4px;font-size:13px}
  #hs-relation-options{min-width:0;margin:0;padding:0 0 0 14px;border:0}
  #hs-relation-options:disabled{opacity:.6}
  #hs-edit-body .hs-display-options input{accent-color:var(--accent-color)}
  #hs-edit-modal{z-index:2450}#hs-edit-modal .modal-content{max-width:420px}#hs-edit-body label{display:block;font-size:13px;margin:12px 0}#hs-edit-body input:not([type=checkbox]),#hs-edit-body select{box-sizing:border-box;width:100%;font:inherit;color:var(--text-primary);border:1px solid var(--border-color);border-radius:10px;padding:10px;background:var(--primary-bg)}#hs-edit-body button{font:inherit;padding:10px 15px;border:1px solid var(--border-color);border-radius:12px;background:var(--accent-color);color:var(--secondary-bg);cursor:pointer}.hs-hint{font-size:11px;color:var(--text-secondary);line-height:1.8}body.immersive-mode #hs-nav{display:none}body.hs-enabled.immersive-mode[data-hs-page=chat]{padding-bottom:0}
  html:not([data-theme=dark]) #hs-home :is(#hs-clock,#hs-date,#hs-names,#hs-days,#hs-countdown,#hs-motto,#hs-music-title,#hs-music-sub),
  html:not([data-theme=dark]) #hs-home .hs-app-grid>.settings-item>span:not(.env-badge),
  html:not([data-theme=dark]) body.hs-enabled[data-hs-page=home] #hs-nav button>span:not(.hs-badge){color:#000}
  .hs-home-functions #hs-apps{margin-top:0}
  .hs-home-functions #hs-app-pages{margin:10px 0 13px}
  @media(max-width:360px){.hs-page{padding:18px 13px}#hs-days{font-size:20px}#hs-relation{padding:18px 12px;min-height:190px}}
  `;document.head.appendChild(style);
  const home=document.createElement('section');
  home.id='hs-home';home.className='hs-page';home.setAttribute('aria-label','首页');
  home.innerHTML=`<div class="hs-content">
   <div class="hs-time"><div id="hs-clock"></div><div id="hs-date"></div></div>
   <button id="hs-relation" aria-label="编辑我们的关系卡">
    <span class="hs-avatars"><span class="hs-avatar" id="hs-partner-avatar"></span><span class="hs-avatar" id="hs-my-avatar"></span></span>
    <span id="hs-names"></span><span id="hs-relation-details"><strong id="hs-days"></strong><span id="hs-countdown"></span><span id="hs-motto"></span></span>
   </button>
   <section class="hs-home-music" aria-label="首页音乐播放器">
    <div id="hs-music-disc" aria-hidden="true"><span><i class="fas fa-music"></i></span></div>
    <div class="hs-music-copy">
     <div id="hs-music-title">暂无歌曲</div><div id="hs-music-sub" hidden></div>
     <div class="hs-music-controls">
      <button id="hs-music-prev" type="button" aria-label="上一首" disabled><i class="fas fa-step-backward" aria-hidden="true"></i></button>
      <button id="hs-music-play" type="button" aria-label="播放" disabled><i class="fas fa-play" aria-hidden="true"></i></button>
      <button id="hs-music-next" type="button" aria-label="下一首" disabled><i class="fas fa-step-forward" aria-hidden="true"></i></button>
     </div>
    </div>
   </section>
   <section class="hs-home-functions" aria-label="首页功能"><div id="hs-apps"></div><div id="hs-app-pages"></div></section>
  </div>`;
  const settingPage=document.createElement('section');settingPage.id='hs-settings';settingPage.className='hs-page';settingPage.hidden=true;settingPage.setAttribute('aria-label','设置');
  document.body.append(home,settingPage);
  const scheduleEntry=window.HomeSchedule.mount(home);
  setupHomeMusic();
  setupHomeBackground(home);
  const cropObserver=new ResizeObserver(applyBackgroundCrops);
  for(const target of [home,$('hs-relation'),$('hs-home-glass-preview')]){
   if(target)cropObserver.observe(target);
  }
  setupChatDisplay();
  const content=$('settings-modal')?.querySelector('.modal-content');if(content)settingPage.appendChild(content);
  let apps=[...document.querySelectorAll('#advanced-modal .settings-item-list > .settings-item')];
  for(const a of apps){a.setAttribute('role','button');a.tabIndex=0;a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();a.click();}});}
  apps.push(scheduleEntry);
  const moments=document.createElement('div');moments.id='hs-moments-entry';moments.className='settings-item';moments.tabIndex=0;moments.setAttribute('role','button');moments.innerHTML='<i class="fas fa-images"></i><span>朋友圈</span>';moments.onclick=()=>$('moments-entry-btn')?.click();moments.onkeydown=e=>{if(e.key==='Enter')moments.click();};apps.unshift(moments);
  const library=$('custom-replies-function');if(library){library.className='settings-card';settingPage.querySelector('.settings-grid')?.appendChild(library);apps=apps.filter(a=>a!==library);}
  // 直接移动原按钮，保留原监听器及其他模块缓存的 DOM 引用。
  function moveShortcut(id,label,target){
   const button=$(id);if(!button)return null;
   const tile=document.createElement('div');tile.id='hs-shortcut-'+id;tile.className=target==='settings'?'settings-card':'settings-item';
   button.classList.remove('action-btn');button.classList.add('hs-shortcut-icon');button.type='button';button.setAttribute('aria-label',label);
   const caption=document.createElement('span');caption.textContent=label;tile.append(button,caption);
   tile.addEventListener('click',event=>{if(!event.composedPath().includes(button))button.click();});
   if(target==='settings')settingPage.querySelector('.settings-grid')?.appendChild(tile);else apps.push(tile);
   return tile;
  }
  moveShortcut('theme-toggle','昼夜模式','home');
  moveShortcut('what-are-you-doing-btn','你在干嘛','home');
  moveShortcut('daily-greeting-btn','今日公告','home');
  moveShortcut('session-manager-btn','会话管理','settings');
  const order=['hs-shortcut-theme-toggle','hs-shortcut-daily-greeting-btn','hs-shortcut-what-are-you-doing-btn','anniversary-function','mood-function','qa-function','envelope-function','incoming-letter-function','hs-schedule-entry','decision-helper-function','message-cards-function','hs-moments-entry'];
  apps.sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):100)-(order.includes(b.id)?order.indexOf(b.id):100));setupAppPages(apps);
  const nav=document.createElement('nav');nav.id='hs-nav';nav.setAttribute('aria-label','主导航');nav.innerHTML=`<button data-hs-page="home"><i class="fas fa-home"></i><span>首页</span></button><button data-hs-page="messages"><i class="far fa-comment-dots"></i><span>消息</span><span class="hs-badge" id="hs-chat-badge" hidden></span></button><button data-hs-page="settings"><i class="fas fa-cog"></i><span>设置</span></button>`;document.body.appendChild(nav);
  const toolbar=document.createElement('div');toolbar.id='hs-chat-toolbar';toolbar.hidden=true;
  toolbar.innerHTML='<button id="hs-chat-back" type="button" aria-label="返回消息" title="返回消息"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg></button>';
  document.querySelector('.header .header-inner')?.prepend(toolbar);
  if($('hs-chat-back'))$('hs-chat-back').onclick=()=>navigate('messages');
  const newer=document.createElement('button');newer.id='hs-new-messages';newer.textContent='↓ 有新消息';newer.hidden=true;newer.onclick=jumpLatest;document.body.appendChild(newer);
  const edit=document.createElement('div');edit.id='hs-edit-modal';edit.className='modal';edit.innerHTML='<div class="modal-content"><div class="modal-title">我们的关系卡</div><div id="hs-edit-body"></div><div class="modal-buttons"><button class="modal-btn modal-btn-secondary" id="hs-edit-close">关闭</button></div></div>';document.body.appendChild(edit);$('hs-edit-close').onclick=()=>hideModal(edit);
  nav.onclick=e=>{const b=e.target.closest('[data-hs-page]');if(b)navigate(b.dataset.hsPage);};$('hs-relation').onclick=editor;
  $('chat-container')?.addEventListener('scroll',()=>{if(page==='chat'&&!window.XavierConversations?.isViewingAdditionalConversation()&&bottom()&&unread.length&&!modalOpen())read();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(page==='chat'&&!window.XavierConversations?.isViewingAdditionalConversation()&&bottom()&&!modalOpen())read();showNote();}});
  const chatRoot=document.querySelector('.main-chat-area');
  if(chatRoot&&typeof MutationObserver!=='undefined')new MutationObserver(liftChatPanels).observe(chatRoot,{childList:true});
  if($('advanced-settings')){$('advanced-settings').hidden=true;$('advanced-settings').setAttribute('aria-hidden','true');}
  const motto=document.querySelector('.header-motto');
  if(motto&&typeof MutationObserver!=='undefined')new MutationObserver(syncMotto).observe(motto,{childList:true,subtree:true,characterData:true});
  const sidebar=document.querySelector('#custom-replies-modal .modal-sidebar');
  if(sidebar)sidebar.addEventListener('click',event=>{
   const button=event.target.closest('.sidebar-btn');if(!button)return;
   requestAnimationFrame(()=>{
    const bar=sidebar.getBoundingClientRect(),item=button.getBoundingClientRect();
    if(item.left<bar.left)sidebar.scrollLeft-=bar.left-item.left+12;
    else if(item.right>bar.right)sidebar.scrollLeft+=item.right-bar.right+12;
   });
  });
  setupSettingsPages();
  window.XavierConversations?.mount();
  ready=true;document.body.classList.add('hs-enabled');navigate('home');
  document.documentElement.removeAttribute('data-hs-boot');
 }
 window.HomeShell={navigate,routeModal,onMessage,onConversationMessage,openChatDisplay,refresh:update,isChat:()=>!ready||page==='chat',
  isIncoming:incoming,isViewingConversation:isViewingNotice,nativeUnreadCount:()=>unread.length,refreshUnread:badges,setNativeUnread:setUnread};
 let booting=false;
 async function tryBoot(){
  if(ready||booting||typeof SESSION_ID==='undefined'||!SESSION_ID)return;
  try{
   getStorageKey('homeShellData');
   const welcome=$('welcome-animation');
   // 加载画面开始淡出时就准备首页，避免等它消失后再轮询。
   if(welcome&&!welcome.classList.contains('hidden')&&getComputedStyle(welcome).display!=='none')return;
   booting=true;await load();if(ready)return;mount();clearInterval(timer);bootObserver?.disconnect();
   setInterval(()=>{if(!document.hidden){load().then(()=>{update();badges();showNote();}).catch(console.warn);}},3000);
  }catch(e){console.warn('[首页]',e);}finally{booting=false;}
 }
 const welcome=$('welcome-animation');
 const bootObserver=welcome&&typeof MutationObserver!=='undefined'?new MutationObserver(tryBoot):null;
 bootObserver?.observe(welcome,{attributes:true,attributeFilter:['class','style']});
 const timer=setInterval(tryBoot,250);
 tryBoot();

})();
