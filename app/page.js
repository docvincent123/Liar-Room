'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {io} from 'socket.io-client';
const THEMES=[
 {id:'mixed',name:'Мікс',icon:'✳',description:'Усе впереміш. Нікому не довіряй.',color:'#d6ff62'},
 {id:'detective',name:'Детектив',icon:'◈',description:'Шукай докази. Сумнівайся в кожному.',color:'#f9b75e'},
 {id:'horror',name:'Темна кімната',icon:'☾',description:'Трохи моторошно. Дуже підозріло.',color:'#bbabff'},
 {id:'medicine',name:'Медицина',icon:'✚',description:'Тут навіть пульс може видати брехуна.',color:'#7edcce'},
 {id:'cinema',name:'Кіно',icon:'▷',description:'Твій улюблений фільм. Чужа версія.',color:'#ff94b8'},
 {id:'logic',name:'Логіка',icon:'⌘',description:'Думай двічі. Вір один раз.',color:'#8ebeff'}
];
const PRODUCTS=[
 {id:'fox',tag:'КОСМЕТИКА',title:'Нічний лис',price:'49 ₴',detail:'Маска й колір профілю',icon:'◈',color:'#ff9271'},
 {id:'noir',tag:'НАБІР ЗАГАДОК',title:'Справа № 13',price:'99 ₴',detail:'Концепт додаткового детективного набору',icon:'⌕',color:'#bbabff'},
 {id:'pro',tag:'ПІДПИСКА',title:'Host PRO',price:'149 ₴ / міс.',detail:'План: власні набори, брендинг та історія ігор',icon:'✳',color:'#d6ff62'}
];
function Mask({color='#d6ff62',variant=0,className=''}){
 return <svg className={className} viewBox="0 0 240 270" fill="none" aria-hidden="true">
  <path d="M25 44 62 13l58 22 58-22 37 31-14 137-42 53-39 23-39-23-42-53Z" fill={color}/>
  <path d="m62 13 11 71-48-40m153-31-11 71 48-40" stroke="#171819" strokeWidth="5" strokeLinejoin="round"/>
  <path d={variant%2?'m50 103 54 20-14 17-35-8Zm140 0-54 20 14 17 35-8Z':'m48 112 52-13-9 36-37-4Zm144 0-52-13 9 36 37-4Z'} fill="#171819"/>
  <path d="m120 129-12 36h24l-12-36Z" fill="#171819" opacity=".45"/>
  <path d="M85 185q35 30 70 0M99 208l-4 13m50-13 4 13" stroke="#171819" strokeWidth="6" strokeLinecap="round"/>
  <path d="m32 48 16 125 39 51m115-176-16 125-39 51" stroke="#fff" strokeOpacity=".25" strokeWidth="3"/>
 </svg>;
}
function MiniAvatar({name,index=0,color}){
 const colors=['#d6ff62','#bbabff','#ffb377','#87d9cc','#ff91b2','#8ebeff'];
 return <span className="avatar" style={{background:(color??colors[index%6])+'18'}}><Mask color={color??colors[index%6]} variant={index}/><span className="sr-only">{name}</span></span>;
}
function Modal({title,children,onClose}){
 const close=useRef(null);
 useEffect(()=>{const previous=document.activeElement;close.current?.focus();const key=e=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);previous?.focus();};},[onClose]);
 return <div className="modal-backdrop" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const focusable=[...e.currentTarget.querySelectorAll('button, input, select, a[href]')].filter(el=>!el.disabled);
  const first=focusable[0],last=focusable.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }}><button ref={close} className="icon-button modal-close" onClick={onClose} aria-label="Закрити">×</button><div className="eyebrow">LIAR ROOM / BETA</div><h2>{title}</h2>{children}</section></div>;
}
export default function Home(){
 const [tab,setTab]=useState('home'),[room,setRoom]=useState(null),[status,setStatus]=useState('connecting');
 const [name,setName]=useState(''),[code,setCode]=useState(''),[theme,setTheme]=useState('mixed');
 const [dialog,setDialog]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[hint,setHint]=useState(''),[answer,setAnswer]=useState(''),[accused,setAccused]=useState('');
 const [secret,setSecret]=useState(false),[now,setNow]=useState(Date.now()),[broadcast,setBroadcast]=useState(false),[skin,setSkin]=useState(null);
 const socket=useRef(null),offset=useRef(0),pending=useRef(false),activeCode=useRef(null);
 useEffect(()=>{
  const query=new URLSearchParams(window.location.search).get('room');
  if(query){setCode(query.toUpperCase().slice(0,6));setDialog('join');}
  setName(localStorage.getItem('liar-name')??'');
  const client=io({autoConnect:false,reconnection:true,reconnectionDelay:1000,reconnectionDelayMax:5000});
  socket.current=client;
  client.on('connect',()=>{
   setStatus('online');setError('');
   let saved;try{saved=JSON.parse(sessionStorage.getItem('liar-session')??'null');}catch{sessionStorage.removeItem('liar-session');}
   if(saved?.token)client.timeout(8000).emit('room:resume',saved,(err,res)=>{
    if(err){setError('Не вдалося відновити сесію. Перепідключись.');return;}
    if(!res?.ok){sessionStorage.removeItem('liar-session');setRoom(null);setError(res?.error??'Не вдалося відновити сесію');}
   });
  });
  client.on('connect_error',()=>setStatus('offline'));
  client.on('disconnect',()=>setStatus('offline'));
  client.on('room:state',state=>{
   offset.current=state.serverTime-Date.now();
   setRoom(previous=>previous?.code===state.code&&previous.rev>state.rev?previous:state);
   if(activeCode.current!==state.code){activeCode.current=state.code;setTab('play');setDialog(null);}
  });
  client.on('session:revoked',()=>{sessionStorage.removeItem('liar-session');activeCode.current=null;setRoom(null);setTab('home');setError('Ведучий вилучив тебе з кімнати');});
  client.connect();
  const timer=setInterval(()=>setNow(Date.now()),250);
  return()=>{clearInterval(timer);client.disconnect();};
 },[]);
 useEffect(()=>{setHint('');setAnswer('');setAccused('');setSecret(false);},[room?.round,room?.code]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
 async function action(event,data={}){
  if(pending.current)return null;
  if(!socket.current?.connected){setError('З’єднання втрачено. Дочекайся відновлення');return null;}
  pending.current=true;setBusy(true);setError('');
  return new Promise(resolve=>socket.current.timeout(10000).emit(event,data,(err,res)=>{
   pending.current=false;setBusy(false);
   if(err||!res?.ok){setError(err?'Відповідь сервера затримується. Стан оновиться після відновлення зв’язку.':res?.error??'Не вдалося виконати дію');resolve(null);}
   else resolve(res);
  }));
 }
 async function enter(kind){
  const res=await action(kind==='join'?'room:join':'room:create',{name,code:code.toUpperCase(),theme,practice:kind==='practice'});
  if(res){sessionStorage.setItem('liar-session',JSON.stringify({code:res.code,token:res.token}));localStorage.setItem('liar-name',name);window.history.replaceState(null,'','?room='+res.code);setDialog(null);}
 }
 function leave(){
  if(room&&!window.confirm('Вийти з кімнати? Місце залишиться зайнятим. Повернутися можна, відкривши цю вкладку без очищення сесії.'))return;
  // Preserve bearer token so leaving the view does not permanently orphan a seat.
  socket.current?.disconnect();activeCode.current=null;setRoom(null);setTab('home');setDialog(null);
  window.history.replaceState(null,'','/');setStatus('offline');
 }
 function forgetSession(){
  sessionStorage.removeItem('liar-session');socket.current?.disconnect();socket.current?.connect();activeCode.current=null;setRoom(null);setDialog(null);setTab('home');window.history.replaceState(null,'','/');
 }
 async function invite(){
  const link=window.location.origin+'/?room='+room.code;
  try{await navigator.clipboard.writeText(link);setNotice('Посилання скопійовано. Надішли його друзям');}
  catch{setNotice('Код кімнати: '+room.code+'. Друзі можуть ввести його на головній');}
 }
 const online=status==='online',isHost=room?.role==='host',themeData=THEMES.find(t=>t.id===(room?.theme??theme));
 const countdown=room?.deadline?Math.max(0,Math.ceil((room.deadline-now-offset.current)/1000)):null;
 const minutes=countdown!==null?Math.floor(countdown/60)+':'+String(countdown%60).padStart(2,'0'):null;
 const ranks=room?[...room.players].sort((a,b)=>b.score-a.score):[];
 const modalClose=useCallback(()=>setDialog(null),[]);
 return <div className={'shell '+(broadcast&&room?'broadcast':'')}>
  <aside className="sidebar">
   <a className="brand" href="/" onClick={e=>{e.preventDefault();setTab('home');}} aria-label="LIAR ROOM — головна"><span className="brand-icon">◈</span><span>LIAR<span className="brand-light">ROOM</span><small>TRUST IS A TRAP.</small></span></a>
   <div className="nav-label">ІГРОВИЙ ПРОСТІР</div>
   <nav aria-label="Головна навігація">
    {[['home','⌂','Головна'],['play','◈','Кімната'],['themes','▦','Теми загадок'],['shop','◇','Магазин'],['rules','?','Як грати']].map(([id,icon,label])=><button key={id} className={'nav-item '+(tab===id?'active':'')} onClick={()=>{setTab(id);setError('');}}><span>{icon}</span>{label}{id==='shop'&&<small>SOON</small>}{id==='play'&&room&&<i className="dot"/>}</button>)}
   </nav>
   <div className="sidebar-bottom"><div className="beta-card"><span>✦ НЕ ДОВІРЯЙ НАВІТЬ ДРУЗЯМ</span><p>Найкраща брехня звучить як хороша підказка.</p><button onClick={()=>setTab('rules')}>Зрозуміти правила ↗</button></div><span className="made-by">LEMVORILAB <b>×</b> PARTY GAMES</span><small className="version">MVP 0.1 · Українська</small></div>
  </aside>
  <main>
   <header className="topbar"><div className="breadcrumb">ІГРИ <span>/</span> LIAR ROOM <span className="badge">BETA</span></div><div className="top-actions"><span className={'connection '+(online?'connected':'')}><i className="dot"/>{online?'На зв’язку':status==='connecting'?'З’єднуємося…':'Немає з’єднання'}</span>{!online&&<button className="text-button" onClick={()=>socket.current?.connect()}>Повторити</button>}<button className="profile-button" onClick={()=>setDialog('profile')} aria-label="Профіль">{(name||'?').slice(0,1).toUpperCase()}</button></div></header>
   {error&&<div className="alert error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Приховати помилку">×</button></div>}
   {notice&&<div className="alert notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Приховати повідомлення">×</button></div>}
   <div className="content">
   {(tab==='home'||(tab==='play'&&!room))&&<>
    <section className="hero">
     <div className="hero-copy"><div className="eyebrow"><span className="mini-line"/>СОЦІАЛЬНА ГРА НА ДОВІРУ</div><h1>УСІ МАЮТЬ<br/>ПІДКАЗКУ.<br/><em>ОДИН БРЕШЕ.</em></h1><p>П’ятеро знають більше за тебе.<br/>Четверо допоможуть. Один заведе не туди.<br/><strong>Кому ти повіриш?</strong></p><div className="hero-actions"><button className="button primary" onClick={()=>{if(room){setTab('play');return;}setDialog('create');}}>{room?'До своєї кімнати':'Створити кімнату'} <span>↗</span></button><button className="button secondary" onClick={()=>setDialog('join')}>У мене є код</button></div><button className="practice-link" onClick={()=>room?setTab('play'):setDialog('practice')}>▷ Спробувати з ботами <span>без компанії</span></button></div>
     <div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="art-cross cross-one">+</span><span className="art-cross cross-two">+</span><span className="art-caption">EXHIBIT 001 / THE LIAR</span><div className="floating-note note-one"><span className="note-dot"/> «Та я точно знаю…»</div><Mask className="hero-mask back-mask" color="#aaa0df"/><Mask className="hero-mask front-mask" color="#d6ff62" variant={1}/><div className="floating-note note-two"><span>✕</span> ПІДОЗРІЛО ПЕРЕКОНЛИВО</div><span className="art-number">01 / 05</span></div>
    </section>
    <div className="feature-strip"><div><b>06</b><span>гравців у кімнаті</span></div><div><b>01</b><span>брехун серед друзів</span></div><div><b>80</b><span>символів на підказку</span></div><div className="strip-last"><span className="free-mark">✳</span><span>Грай безкоштовно<br/><strong>Прямо в браузері</strong></span></div></div>
    <section className="section"><div className="section-heading"><div><div className="eyebrow">ОБЕРИ НАСТРІЙ ВЕЧОРА</div><h2>У кожної брехні своя тема.</h2></div><button className="text-button" onClick={()=>setTab('themes')}>Усі теми ↗</button></div><div className="theme-grid">{THEMES.slice(1,5).map((t,i)=><button className="theme-card" key={t.id} onClick={()=>{setTheme(t.id);setDialog('create');}} style={{'--card-color':t.color}}><div className="theme-art"><span className="theme-symbol">{t.icon}</span><span className="theme-index">0{i+1}</span><span className="theme-art-lines"/></div><div className="theme-info"><h3>{t.name}<span>↗</span></h3><p>{t.description}</p><small>БЕЗКОШТОВНО · 4 ЗАГАДКИ</small></div></button>)}</div></section>
    <section className="bottom-banner"><span className="banner-symbol">↗</span><div><h3>Не треба бути стрімером.</h3><p>Друзі, колеги, підписники — збирай своїх. Потрібні лише браузер і код кімнати.</p></div><button className="button secondary" onClick={()=>setTab('rules')}>Як це працює?</button></section>
   </>}
   {tab==='themes'&&<section className="section page-section"><div className="eyebrow">КАТАЛОГ / 20 ЗАГАДОК</div><h1 className="page-title">Обери свою<br/><em>територію брехні.</em></h1><p className="muted">Усі базові теми доступні безкоштовно. У тематичній грі п’ята загадка повторюється після вичерпання набору.</p><div className="theme-grid all-themes">{THEMES.map((t,i)=><button key={t.id} className="theme-card" onClick={()=>{setTheme(t.id);setDialog('create');}} style={{'--card-color':t.color}}><div className="theme-art"><span className="theme-symbol">{t.icon}</span><span className="theme-index">0{i+1}</span></div><div className="theme-info"><h3>{t.name}<span>↗</span></h3><p>{t.description}</p><small>{t.id==='mixed'?'20 ЗАГАДОК':'4 ЗАГАДКИ'} · БЕЗКОШТОВНО</small></div></button>)}</div></section>}
   {tab==='shop'&&<section className="section page-section"><div className="eyebrow">МАГАЗИН / КОНЦЕПТ МОНЕТИЗАЦІЇ</div><h1 className="page-title">Стиль коштує.<br/><em>Перемога — твоя.</em></h1><p className="muted">Жодних платних переваг. Нижче — заплановані товари й орієнтовні ціни. Оплата ще недоступна.</p><div className="shop-grid">{PRODUCTS.map(p=><article key={p.id} className="product" style={{'--card-color':p.color}}><div className="product-art">{p.id==='fox'?<Mask color={p.color} variant={1}/>:<span>{p.icon}</span>}<small>PREVIEW / 0{PRODUCTS.indexOf(p)+1}</small></div><div className="product-info"><span className="eyebrow">{p.tag}</span><h2>{p.title}</h2><p>{p.detail}</p><div className="product-price">{p.price}<small>ПЛАНОВА ЦІНА</small></div><button className="button secondary" onClick={()=>{if(p.id==='fox'){setSkin(skin?null:p.color);setNotice(skin?'Стандартну маску повернено':'Маску приміряно локально. Це безкоштовний перегляд');}else setDialog(p.id);}}>{p.id==='fox'?(skin?'Зняти маску':'Приміряти безкоштовно'):'Що буде всередині?'} ↗</button></div></article>)}</div><div className="info-panel">✳ Базові кімнати, усі поточні загадки та тренування завжди доступні в цьому MVP. Жодних реальних покупок або підписок не створюється.</div></section>}
   {tab==='rules'&&<section className="section page-section rules-page"><div className="eyebrow">ПРАВИЛА / НА 60 СЕКУНД</div><h1 className="page-title">Довіряй інтуїції.<br/><em>Перевіряй друзів.</em></h1><div className="rules-grid">{[
    ['01','Зберіть шістьох','Один створює кімнату й стає ведучим. Ще п’ятеро приєднуються за кодом. Для гри достатньо браузера; голосовий зв’язок організуйте самі.'],
    ['02','Отримайте ролі','Четверо правдивих бачать правильну відповідь. Один брехун бачить хибну легенду та має звучати переконливо. Ведучий бачить лише загадку.'],
    ['03','Дайте підказки','Кожен надсилає одну підказку: від 2 до 80 символів за 2 хвилини. Прямо називати відповідь не можна. Підказки відкриються разом або після таймера.'],
    ['04','Назвіть брехуна','У ведучого є 90 секунд, щоб ввести відповідь і звинуватити одного гравця. Це одне фінальне рішення. Потім усі бачать результат.']
   ].map(([n,title,body])=><article className="rule" key={n}><span>{n}</span><h3>{title}</h3><p>{body}</p></article>)}</div><div className="score-rules"><h2>Очки без фокусів.</h2><div><b>+150</b><p>Брехуну, якщо ведучий звинуватив іншого або не встиг.</p></div><div><b>+100</b><p>Кожному правдивому, якщо загадку розв’язано.</p></div><div><b>+200</b><p>Максимум ведучому: 100 за відповідь і 100 за викриття.</p></div></div><p className="muted">Матч — 5 раундів. Ведучий не змінюється. Рахунок накопичується в кімнаті. Брехун може отримати очки одночасно з правдивими, якщо відповідь правильна, але звинувачення хибне. Тренування позначається окремо: боти дають заготовлені підказки.</p><button className="button primary" onClick={()=>room?setTab('play'):setDialog('create')}>Погнали грати ↗</button></section>}
   {tab==='play'&&room&&<section className="room-page">
    <div className="room-heading"><div><div className="eyebrow">{room.practice?'ТРЕНУВАННЯ З БОТАМИ':'ПРИВАТНА КІМНАТА'} / {themeData?.name}</div><h1>Кімната <button className="room-code" onClick={invite} title="Скопіювати запрошення">{room.code} ↗</button></h1></div><div className="room-buttons">{isHost&&<button className="button secondary small" onClick={()=>setBroadcast(!broadcast)}>{broadcast?'Звичайний вигляд':'Режим ефіру'}</button>}<button className="text-button" onClick={leave}>Вийти ↗</button></div></div>
    <div className="room-layout"><div className="room-main">
    {room.phase==='lobby'&&<div className="game-panel lobby-panel"><span className="eyebrow">ЗБІР ПІДОЗРЮВАНИХ</span><Mask className="lobby-mask" color="#d6ff62"/><h2>Хтось із вас<br/>зараз брехатиме.</h2><p className="muted">{room.practice?'Ти — ведучий. П’ять ботів уже готові.':room.players.length+'/6 у кімнаті. Надішли код друзям.'}</p>{!room.practice&&<button className="button secondary" onClick={invite}>Скопіювати запрошення ↗</button>}{isHost?<button className="button primary" disabled={busy||!online||room.players.length!==6||room.players.some(p=>!p.online)} onClick={()=>action('round:start')}>Почати перший раунд →</button>:<div className="waiting">◌ Очікуємо на ведучого</div>}<small className="muted">Ведучий + 5 гравців · 5 раундів</small></div>}
    {(room.phase==='hints'||room.phase==='guess')&&<div className="game-panel"><div className="round-top"><span className="eyebrow">РАУНД {room.round} / {room.maxRounds}</span><span className={'timer '+(countdown<15?'urgent':'')}>◷ {minutes}</span></div><div className="phase-label">{room.phase==='hints'?'ЗБИРАЄМО ПІДКАЗКИ':'ЧАС ЗРОБИТИ ВИБІР'}</div><h2 className="question">{room.question}</h2>
    {!isHost&&<div className={'secret-card '+(secret?'revealed':'')}><div><span className="eyebrow">ТВОЯ ТАЄМНА РОЛЬ</span><h3>{secret?(room.role==='liar'?'Ти — брехун 😈':'Ти — правдивий'):'Лише для твоїх очей'}</h3>{secret&&<p>{room.role==='liar'?'Твоя хибна легенда: ':'Правильна відповідь: '}<strong>{room.secret}</strong></p>}</div><button className="button secondary small" onClick={()=>setSecret(!secret)}>{secret?'Сховати':'Показати'}</button></div>}
    {room.phase==='hints'&&(isHost?<div className="waiting"><span className="spinner"/>Гравці готують підказки · {room.players.filter(p=>p.submitted).length}/5<p>Підказки відкриються одночасно. Обговорюй, але не поспішай вірити.</p></div>:room.hints[room.me]?<div className="info-panel">✓ Твою підказку прийнято: «{room.hints[room.me]}»<p>Чекаємо на інших. Редагувати підказку вже не можна.</p></div>:<form className="hint-form" onSubmit={async e=>{e.preventDefault();await action('hint:submit',{text:hint});}}><label htmlFor="hint">Твоя підказка</label><textarea id="hint" maxLength={160} value={hint} onChange={e=>setHint([...e.target.value].slice(0,80).join(''))} placeholder={room.role==='liar'?'Звучить правдиво. Веде не туди.':'Допоможи, але не називай відповідь прямо.'} required/><div className="form-bottom"><span>{[...hint].length}/80 символів</span><button className="button primary" disabled={busy||!online||[...hint.trim()].length<2}>Надіслати ↗</button></div></form>)}
    {room.phase==='guess'&&<><div className="clue-grid">{room.players.filter(p=>p.id!==room.hostId).map((p,i)=><button key={p.id} className={'clue '+(accused===p.id?'selected':'')} disabled={!isHost} onClick={()=>setAccused(p.id)}><div className="clue-person"><MiniAvatar name={p.name} index={i}/><strong>{p.name}</strong>{accused===p.id&&<span className="suspect-mark">ПІДОЗРА</span>}</div><p>«{room.hints[p.id]??'Не встиг надіслати підказку'}»</p></button>)}</div>{isHost?<form className="answer-form" onSubmit={e=>{e.preventDefault();action('round:resolve',{answer,accusedId:accused});}}><label htmlFor="answer">Твоя відповідь</label><input id="answer" value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={100} placeholder="Що це може бути?" required/><p className="muted">{accused?'Підозрюваний: '+room.players.find(p=>p.id===accused)?.name:'Натисни на підказку, щоб обрати брехуна.'} Рішення остаточне.</p><button className="button primary full" disabled={busy||!online||!accused||!answer.trim()}>Відповісти й викрити брехуна ↗</button></form>:<div className="waiting">◌ Ведучий обирає відповідь і підозрюваного.</div>}</>}
    </div>}
    {room.phase==='reveal'&&room.result&&<div className="game-panel reveal-panel"><span className="eyebrow">РАУНД {room.round} / {room.maxRounds} · РОЗКРИТТЯ</span><Mask className="reveal-mask" color={room.result.caught?'#d6ff62':'#ff94b8'} variant={1}/><h2>{room.result.caught?'Брехуна викрито.':'Брехун вийшов сухим.'}</h2><p className="reveal-name">{room.players.find(p=>p.id===room.result.liarId)?.name}</p><div className="result-answer"><span>ПРАВИЛЬНА ВІДПОВІДЬ</span><strong>{room.result.answer}</strong><p>Відповідь ведучого: «{room.result.submitted}» {room.result.solved?'✓':'✕'}</p><p>Звинувачення: {room.players.find(p=>p.id===room.result.accusedId)?.name??'Не обрано'}</p></div><div className="round-gains">{ranks.map((p,i)=><div key={p.id}><MiniAvatar name={p.name} index={i}/><strong>{p.name}</strong><span>+{room.result.gains[p.id]}</span></div>)}</div>{room.round<room.maxRounds?(isHost?<button className="button primary full" disabled={busy||!online||room.players.some(p=>!p.online)} onClick={()=>action('round:start')}>Наступний раунд →</button>:<div className="waiting">Чекаємо на наступний раунд</div>):<><div className="match-winner"><span>МАТЧ ЗАВЕРШЕНО</span><h3>{ranks.filter(p=>p.score===ranks[0].score).map(p=>p.name).join(', ')} 🏆</h3><p>{ranks[0].score} очок · {ranks.filter(p=>p.score===ranks[0].score).length>1?'спільна перемога':'переможець матчу'}</p></div><button className="button primary full" onClick={forgetSession}>На головну →</button></>}</div>}
    </div><aside className="players-panel"><div className="panel-heading"><h3>За столом</h3><span>{room.players.length}/6</span></div>{room.players.map((p,i)=><div className="player" key={p.id}><MiniAvatar name={p.name} index={i} color={p.id===room.me?skin:null}/><div><strong>{p.name}{p.id===room.me?' (ти)':''}</strong><small>{p.id===room.hostId?'Ведучий':p.bot?'Бот · тренування':p.online?'У кімнаті':'Перепідключається…'}</small></div><span className="player-score">{p.score}<small>очок</small></span>{isHost&&room.phase==='lobby'&&p.id!==room.hostId&&!p.bot&&<button className="kick-button" aria-label={'Вилучити '+p.name} onClick={()=>action('room:kick',{id:p.id})}>×</button>}</div>)}{Array.from({length:6-room.players.length},(_,i)=><div className="empty-seat" key={i}><span>+</span>Вільне місце</div>)}<div className="room-tip"><span>✳ ПАМ’ЯТАЙ</span><p>{room.practice?'Боти користуються заготовленими підказками. Для повної гри запроси п’ятьох друзів.':'Підказки — не докази. Найвпевненіший голос може брехати.'}</p></div><div className="room-status"><i className="dot"/>{online?'Стан збережено на сервері':'З’єднання відновлюється'}</div></aside></div>
   </section>}
   </div>
   <footer><span>© {new Date().getFullYear()} LIAR ROOM · LemvoriLab</span><span>П’ять підказок. Нуль гарантій.</span></footer>
  </main>
  {dialog&&<Modal title={dialog==='create'?'Збираємо своїх.':dialog==='join'?'Тебе вже чекають.':dialog==='practice'?'Розігрій інтуїцію.':dialog==='profile'?'Твій профіль.':dialog==='pro'?'Ведучий на максимум.':'Справа № 13.'} onClose={modalClose}>
   {['create','join','practice'].includes(dialog)?<form onSubmit={e=>{e.preventDefault();enter(dialog);}}><p className="muted">{dialog==='join'?'Введи нік і шестисимвольний код від ведучого.':dialog==='practice'?'Ти — ведучий, п’ять ботів — підозрювані. Очки зберігаються лише в цій кімнаті.':'Створи безкоштовну кімнату й запроси ще п’ятьох.'}</p>{room?<div className="info-panel">Ти вже у кімнаті {room.code}.<button className="button secondary full" type="button" onClick={()=>{setTab('play');setDialog(null);}}>Повернутися до гри</button></div>:<><label htmlFor="nickname">Твій нік</label><input id="nickname" value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={20} placeholder="Наприклад, Михайло" required autoComplete="nickname"/>{dialog==='join'?<><label htmlFor="roomcode">Код кімнати</label><input className="code-input" id="roomcode" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6))} minLength={6} maxLength={6} placeholder="ABC234" required autoComplete="off"/></>:<><label htmlFor="theme">Тема загадок</label><select id="theme" value={theme} onChange={e=>setTheme(e.target.value)}>{THEMES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></>}<button className="button primary full" disabled={busy||!online}>{busy?'Зачекай…':dialog==='join'?'Приєднатися →':dialog==='practice'?'Почати тренування →':'Створити кімнату →'}</button><small className="muted form-note">Без реєстрації та оплати. Нік видно учасникам кімнати.</small></>}</form>:dialog==='profile'?<><p className="muted">Поточний нік: <strong>{name||'Ще не обрано'}</strong>. Обрати інший можна перед новою грою. Сесія зберігається в цій вкладці.</p><button className="button secondary full" onClick={()=>{socket.current?.connect();setDialog(null);}}>Відновити поточну кімнату</button><button className="text-button full" onClick={()=>{if(window.confirm('Забути сесію? Повернутися на зайняте місце буде неможливо.'))forgetSession();}}>Забути сесію та почати заново</button><p className="muted">MVP без облікових записів. Ніки, підказки й рахунок зберігаються до 24 годин неактивності кімнати. Платіжні дані не збираються.</p></>:<><p className="muted">{dialog==='pro'?'Плануємо власні набори загадок, брендинг кімнати й історію матчів. Базова гра залишиться безкоштовною.':'Плануємо окремий детективний набір із пов’язаними справами та новими загадками.'}</p><div className="info-panel">Це концепт майбутнього товару. Функції ще не реалізовані. Оплату не підключено, придбати або оформити підписку зараз не можна.</div><button className="button secondary full" onClick={modalClose}>Зрозуміло</button></>}
   {error&&<p className="modal-error" role="alert">{error}</p>}
  </Modal>}
 </div>;
}
