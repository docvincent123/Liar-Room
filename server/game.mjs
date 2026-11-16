import { riddles, themes } from './riddles.mjs';
export const HINT_LIMIT=80;
export const ROUNDS=5;
export function ensure(ok,message){if(!ok){const error=new Error(message);error.name='GameError';throw error;}}
export function clean(value,min,max,label='Текст'){
 ensure(typeof value==='string',label+': потрібен текст');
 const text=value.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/gu,'').trim();
 ensure([...text].length>=min && [...text].length<=max,label+': від '+min+' до '+max+' символів');
 return text;
}
export function normalize(s){return s.normalize('NFKC').toLocaleLowerCase('uk').replace(/[’'ʼ`]/gu,'').replace(/[^\p{L}\p{N}]/gu,'');}
export function newRoom(code,host,theme,practice,now=Date.now()){
 ensure(themes.some(t=>t.id===theme),'Невідома тема');
 return {code,theme,practice,hostId:host.id,players:[{...host,score:0}],phase:'lobby',round:0,used:[],hints:{},roles:{},deadline:null,result:null,rev:1,createdAt:now};
}
export function joinRoom(room,player){
 ensure(room.phase==='lobby','Гра вже почалася');
 ensure(room.players.length<6,'У кімнаті вже шестеро');
 ensure(!room.players.some(p=>p.name.toLocaleLowerCase('uk')===player.name.toLocaleLowerCase('uk')),'Цей нік уже зайнято');
 room.players.push({...player,score:0});
}
export function startRound(room,actor,online,now=Date.now(),choose=n=>Math.floor(Math.random()*n)){
 ensure(actor===room.hostId,'Лише ведучий може почати раунд');
 ensure(room.phase==='lobby'||(room.phase==='reveal'&&room.round<ROUNDS),'Зараз не можна почати раунд');
 ensure(room.players.length===6,'Потрібні ведучий і п’ятеро гравців');
 ensure(room.players.every(p=>p.bot||online.includes(p.id)),'Дочекайтеся повернення всіх гравців');
 const pool=riddles.filter(q=>(room.theme==='mixed'||q.theme===room.theme)&&!room.used.includes(q.id));
 // Single-topic decks contain 4 puzzles: reuse only after exhausting the deck.
 const candidates=pool.length?pool:riddles.filter(q=>room.theme==='mixed'||q.theme===room.theme);
 const puzzle=candidates[choose(candidates.length)];
 const viewers=room.players.filter(p=>p.id!==room.hostId);
 room.liarId=viewers[choose(5)].id;
 room.roles=Object.fromEntries(viewers.map(p=>[p.id,p.id===room.liarId?'liar':'truth']));
 room.puzzleId=puzzle.id;room.used.push(puzzle.id);room.round++;room.hints={};room.result=null;
 room.phase='hints';room.deadline=now+120000;
 let i=0;
 for(const p of viewers) if(p.bot) room.hints[p.id]=(p.id===room.liarId?puzzle.lies:puzzle.hints)[i++%4];
 if(Object.keys(room.hints).length===5){room.phase='guess';room.deadline=now+90000;}
}
export function submitHint(room,actor,value,now=Date.now()){
 ensure(room.phase==='hints'&&now<room.deadline,'Час підказок завершено');
 ensure(room.roles[actor],'Ведучий не надсилає підказок');
 ensure(!room.hints[actor],'Підказку вже надіслано');
 const hint=clean(value,2,HINT_LIMIT,'Підказка');
 const puzzle=riddles.find(q=>q.id===room.puzzleId);
 const normalized=normalize(hint);
 ensure(!puzzle.aliases.some(a=>normalized.includes(normalize(a))),'Не називай правильну відповідь прямо');
 room.hints[actor]=hint;
 if(Object.keys(room.hints).length===5){room.phase='guess';room.deadline=now+90000;}
}
export function resolveRound(room,actor,answer,accusedId,now=Date.now(),timeout=false){
 ensure(actor===room.hostId,'Лише ведучий завершує раунд');
 ensure(room.phase==='guess','Зараз не час відповідати');
 ensure(timeout||now<room.deadline,'Час відповіді завершено');
 if(!timeout){ensure(room.players.some(p=>p.id===accusedId&&p.id!==room.hostId),'Обери підозрюваного');answer=clean(answer,1,100,'Відповідь');}
 const puzzle=riddles.find(q=>q.id===room.puzzleId);
 const solved=!timeout&&puzzle.aliases.some(a=>normalize(a)===normalize(answer));
 const caught=!timeout&&accusedId===room.liarId;
 const gains={};
 for(const p of room.players){
  const delta=p.id===room.hostId?(solved?100:0)+(caught?100:0):p.id===room.liarId?(caught?0:150):(solved?100:0);
  p.score+=delta;gains[p.id]=delta;
 }
 room.result={solved,caught,answer:puzzle.answer,submitted:timeout?'Час вийшов':answer,liarId:room.liarId,accusedId:timeout?null:accusedId,gains};
 room.phase='reveal';room.deadline=null;
}
export function tick(room,now=Date.now()){
 if(room.deadline&&now>=room.deadline){
  if(room.phase==='hints'){room.phase='guess';room.deadline=now+90000;return true;}
  if(room.phase==='guess'){resolveRound(room,room.hostId,'',null,now,true);return true;}
 }
 return false;
}
export function snapshot(room,actor,online=[]){
 const puzzle=riddles.find(q=>q.id===room.puzzleId);
 const role=actor===room.hostId?'host':room.roles[actor]??null;
 return {code:room.code,theme:room.theme,practice:room.practice,hostId:room.hostId,me:actor,role,phase:room.phase,round:room.round,maxRounds:ROUNDS,rev:room.rev,deadline:room.deadline,serverTime:Date.now(),
 players:room.players.map(p=>({id:p.id,name:p.name,score:p.score,bot:!!p.bot,online:p.bot||online.includes(p.id),submitted:!!room.hints[p.id]})),
 // Hints stay hidden until collection finishes, preventing copycat hints.
 hints:room.phase==='hints'?{[actor]:room.hints[actor]??null}:room.hints,
 question:puzzle?.question??null,
 secret:room.phase==='hints'||room.phase==='guess'?(role==='truth'?puzzle?.answer:role==='liar'?puzzle?.decoy:null):null,
 result:room.phase==='reveal'?room.result:null};
}
