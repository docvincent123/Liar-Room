'use client';
import {useEffect,useId,useRef,useState} from 'react';
const INKS=['#b46b4c','#698278','#8a7397','#b68c4f','#667e9b','#a45e65'];
export function Portrait({color='#b46b4c',variant=0,className=''}){
 const key=useId().replaceAll(':','');
 return <svg className={className} viewBox="0 0 240 270" fill="none" aria-hidden="true">
  <defs><linearGradient id={key+'body'} x1="48" y1="20" x2="192" y2="250" gradientUnits="userSpaceOnUse"><stop stopColor="#fff4d8"/><stop offset=".3" stopColor={color}/><stop offset=".75" stopColor={color}/><stop offset="1" stopColor="#291720"/></linearGradient><linearGradient id={key+'gold'} x1="70" y1="15" x2="165" y2="200" gradientUnits="userSpaceOnUse"><stop stopColor="#fff5d0"/><stop offset=".45" stopColor="#be9a60"/><stop offset="1" stopColor="#655039"/></linearGradient><radialGradient id={key+'eye'}><stop stopColor="#c7d7bc"/><stop offset=".6" stopColor="#6c8a72"/><stop offset="1" stopColor="#1c302e"/></radialGradient></defs>
  <ellipse cx="120" cy="248" rx="74" ry="12" fill="#100d14" opacity=".3"/>
  <path d="m35 90 2-65 52 38h62l52-38 2 65-14 95-35 44-36 22-36-22-35-44Z" fill={'url(#'+key+'body)'} stroke="#382a29" strokeWidth="2"/>
  <path d="m38 29 18 60 30-24m116-36-18 60-30-24" fill="#24242a" stroke={'url(#'+key+'gold)'} strokeWidth="4"/>
  <path d="M51 92q69-42 138 0l-6 59-47-16-16 26-16-26-47 16Z" fill="#24242a"/>
  <path d="M58 96q25-14 48 9-20 29-44 11Zm124 0q-25-14-48 9 20 29 44 11Z" fill="#f5e5c6"/>
  <ellipse cx={variant%2?86:84} cy="108" rx="9" ry="12" fill={'url(#'+key+'eye)'}/><ellipse cx={variant%2?154:156} cy="108" rx="9" ry="12" fill={'url(#'+key+'eye)'}/>
  <path d="m85 102-2 13m72-13 2 13" stroke="#11171a" strokeWidth="4" strokeLinecap="round"/><circle cx="82" cy="104" r="2.5" fill="white"/><circle cx="154" cy="104" r="2.5" fill="white"/>
  <path d={variant%2?'m54 88 50 8m82-8-50 8':'m54 83 50 15m82-15-50 15'} stroke={'url(#'+key+'gold)'} strokeWidth="5" strokeLinecap="round"/>
  <path d="m120 132-17 40 17 12 17-12Z" fill="#fff1d2" opacity=".55"/><path d="m103 172 17 9 17-9-17 18Z" fill="#34272c"/>
  <path d="M83 193q37 27 74 0" stroke="#3a2630" strokeWidth="5" strokeLinecap="round"/><path d="M95 205q25 10 50 0" stroke="#f5d1a0" strokeOpacity=".6" strokeWidth="2"/>
  <path d="m48 104 13 72 37 45m94-117-13 72-37 45" stroke="#fff6df" strokeOpacity=".27" strokeWidth="2"/>
  <path d="m120 47 8 13-8 13-8-13Z" fill={'url(#'+key+'gold)'}/>
 </svg>;
}
export function Tilt({as:Tag='div',className='',children,style,...props}){
 const node=useRef(null),frame=useRef(0);
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 function move(event){
  if(event.pointerType!=='mouse'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const box=event.currentTarget.getBoundingClientRect();
  const x=Math.max(-1,Math.min(1,(event.clientX-box.left)/box.width*2-1));
  const y=Math.max(-1,Math.min(1,(event.clientY-box.top)/box.height*2-1));
  cancelAnimationFrame(frame.current);
  frame.current=requestAnimationFrame(()=>{
   if(!node.current)return;
   node.current.style.setProperty('--rx',(-y*8)+'deg');
   node.current.style.setProperty('--ry',(x*10)+'deg');
   node.current.style.setProperty('--shine-x',((x+1)*50)+'%');
   node.current.style.setProperty('--shine-y',((y+1)*50)+'%');
  });
 }
 function reset(){cancelAnimationFrame(frame.current);if(node.current){node.current.style.setProperty('--rx','0deg');node.current.style.setProperty('--ry','0deg');}}
 return <Tag ref={node} className={'tilt '+className} style={style} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} onBlur={reset} {...props}>{children}</Tag>;
}
export function CardBack({small=false}){
 return <span className={'card-back-art '+(small?'compact':'')} aria-hidden="true"><span className="back-inner"><span className="back-corner">L / R</span><div className="back-diamond"><span>?</span></div><span className="back-word">TRUST NO ONE</span><span className="back-corner bottom">L / R</span></span></span>;
}
export function DeckScene(){
 const [turned,setTurned]=useState(null);
 const names=['Ворон','Лис','Кіт','Вовк','Сова'];
 return <div className="deck-scene" aria-label="Демонстраційні картки ролей"><div className="table-halo"/><div className="table-rim"/><span className="table-lettermark" aria-hidden="true">L / R</span><div className="deck-hand">{names.map((name,index)=><Tilt as="button" type="button" key={name} className={'demo-card '+(turned===index?'is-flipped':'')} style={{'--slot':index-2,'--ink':INKS[index]}} onClick={()=>setTurned(turned===index?null:index)} aria-label={'Демонстраційна картка '+name} aria-pressed={turned===index}><div className="card-rotor"><div className="card-face card-cover"><CardBack/></div><div className="card-face card-identity" aria-hidden={turned!==index}><span className="card-corner">{index===1?'J':'A'}<small>♦</small></span><Portrait color={INKS[index]} variant={index}/><span className="identity-title">{index===1?'БРЕХУН':'ПРАВДИВИЙ'}</span><span className="identity-name">{name}</span><span className="card-corner opposite">♦</span></div></div></Tilt>)}</div><div className="table-chip chip-one" aria-hidden="true">150</div><div className="table-chip chip-two" aria-hidden="true">LR</div><div className="deck-caption"><span className="live-spark"/> Натисни на карту. Перевір інтуїцію.<small>Демонстрація ролей · у грі ролі таємні</small></div></div>;
}
export function TableSeats({players,hostId,me,onInvite}){
 return <div className="friends-table"><div className="felt-center" aria-hidden="true"><span>LIAR<br/>ROOM</span><small>KEEP YOUR FRIENDS CLOSE.</small></div><div className="seat-grid">{Array.from({length:6},(_,index)=>{
 const p=players[index];
 return <Tilt key={p?.id??'empty'+index} className={'seat-card '+(!p?'empty':'')} style={{'--ink':INKS[index]}}>
 {p?<><span className="seat-number">0{index+1}</span><Portrait color={INKS[index]} variant={index}/><strong>{p.name}{p.id===me?' · ти':''}</strong><span className="seat-role">{p.id===hostId?'♛ Ведучий':p.bot?'Бот · тренування':p.online?'● На місці':'○ Повертається…'}</span></>:<button className="invite-seat" onClick={onInvite} aria-label={'Запросити друга на місце '+(index+1)}><span>+</span><strong>Твій друг</strong><small>Запросити за кодом</small></button>}
 </Tilt>;
 })}</div></div>;
}
export function SecretRole({open,onToggle,role,secret}){
 return <div className={'secret-card role-card-wrap '+(open?'revealed':'')}>
 <button className="role-flip-button" onClick={onToggle} aria-expanded={open} aria-label={open?'Сховати роль':'Показати роль'}>
 <span className="role-rotor"><span className="role-side role-back"><CardBack small/><span className="role-prompt">ТВОЯ ТАЄМНА РОЛЬ<small>Натисни, щоб перевернути</small></span></span><span className="role-side role-front" aria-hidden={!open}>{open&&<><span className="role-symbol">{role==='liar'?'♦':'♤'}</span><span className="role-reveal-title">{role==='liar'?'Ти — брехун':'Ти — правдивий'}</span><span className="role-secret-label">{role==='liar'?'ТВОЯ ХИБНА ЛЕГЕНДА':'ПРАВИЛЬНА ВІДПОВІДЬ'}</span><strong>{secret}</strong><small>Натисни, щоб сховати</small></>}</span></span></button>
 <p className="role-privacy">Лише для твоїх очей. Інші бачать тільки твою підказку.</p></div>;
}
