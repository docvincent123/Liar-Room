import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,joinRoom,startRound,submitHint,resolveRound,tick,snapshot,clean,normalize} from '../server/game.mjs';
import {riddles} from '../server/riddles.mjs';
function room(theme='logic'){
 const s=newRoom('ABC234',{id:'host',name:'Ведучий'},theme,false,0);
 for(let n=0;n<5;n++)joinRoom(s,{id:'p'+n,name:'Гравець '+n});
 return s;
}
const online=['host','p0','p1','p2','p3','p4'];
function start(s){startRound(s,'host',online,1000,()=>0);}
function guess(s){for(let n=0;n<5;n++)submitHint(s,'p'+n,'Безпечна підказка '+n,1100);}
test('exactly four truthful roles and one liar, no host role in viewers',()=>{
 const s=room();start(s);assert.equal(Object.values(s.roles).filter(r=>r==='truth').length,4);
 assert.equal(Object.values(s.roles).filter(r=>r==='liar').length,1);assert.equal(s.roles.host,undefined);
});
test('host snapshot has no answer, liar ID, role map, or puzzle object',()=>{
 const s=room();start(s);const wire=snapshot(s,'host',online);
 assert.equal(wire.secret,null);assert.equal(wire.liarId,undefined);assert.equal(wire.roles,undefined);
 assert.equal(wire.puzzleId,undefined);assert.equal(wire.result,null);
 assert.ok(!JSON.stringify(wire).includes(riddles.find(q=>q.id===s.puzzleId).answer));
});
test('truthful sees answer, liar sees decoy, players cannot see others hints during collection',()=>{
 const s=room();start(s);const q=riddles.find(q=>q.id===s.puzzleId);
 assert.equal(snapshot(s,s.liarId).secret,q.decoy);assert.equal(snapshot(s,'p1').secret,q.answer);
 submitHint(s,'p1','Обережна підказка',1100);
 assert.equal(snapshot(s,'p0').hints.p1,undefined);assert.equal(snapshot(s,'p1').hints.p1,'Обережна підказка');
});
test('full room, duplicate name, in-progress join and wrong theme are rejected',()=>{
 const s=room();assert.throws(()=>joinRoom(s,{id:'extra',name:'Зайвий'}));
 const other=newRoom('ABC234',{id:'host',name:'Ведучий'},'mixed',false);
 assert.throws(()=>joinRoom(other,{id:'p',name:'ведучий'}));
 start(s);assert.throws(()=>joinRoom(s,{id:'extra',name:'Інший'}));
 assert.throws(()=>newRoom('ABC234',{id:'h',name:'Host'},'invalid',false));
});
test('only host may start and all six must be connected',()=>{
 const s=room();assert.throws(()=>startRound(s,'p1',online));assert.throws(()=>startRound(s,'host',['host']));
 s.players.pop();assert.throws(()=>start(s));
});
test('hint limits, duplicate, host hint and direct answer are enforced server-side',()=>{
 const s=room();start(s);
 assert.throws(()=>submitHint(s,'host','Ні',1100));
 assert.throws(()=>submitHint(s,'p1','x'.repeat(81),1100));
 assert.throws(()=>submitHint(s,'p1',riddles.find(q=>q.id===s.puzzleId).answer,1100));
 submitHint(s,'p1','Підказка',1100);assert.throws(()=>submitHint(s,'p1','Інша підказка',1100));
 assert.throws(()=>submitHint(s,'p2','Занадто пізно',121001));
 assert.equal(clean('😀'.repeat(80),2,80).length,160);
});
test('all five hints advance to guessing and deadline is server-owned',()=>{
 const s=room();start(s);guess(s);assert.equal(s.phase,'guess');assert.equal(s.deadline,91100);
 assert.equal(Object.keys(snapshot(s,'host').hints).length,5);
});
test('correct answer + wrong accusation rewards truthful and liar independently',()=>{
 const s=room();start(s);guess(s);resolveRound(s,'host','ЯМА','p1',1200);
 assert.equal(s.result.solved,true);assert.equal(s.result.caught,false);
 assert.equal(s.players.find(p=>p.id===s.liarId).score,150);
 assert.equal(s.players.find(p=>p.id==='p1').score,100);
 assert.equal(s.players.find(p=>p.id==='host').score,100);
 assert.throws(()=>resolveRound(s,'host','яма','p0',1201));
});
test('wrong answer + caught liar awards host 100, nobody else',()=>{
 const s=room();start(s);guess(s);resolveRound(s,'host','Не знаю','p0',1200);
 assert.equal(s.result.caught,true);assert.equal(s.result.solved,false);
 assert.equal(s.players.find(p=>p.id==='host').score,100);
 assert.ok(s.players.filter(p=>p.id!=='host').every(p=>p.score===0));
});
test('correct answer and accusation award host 200; no double scoring',()=>{
 const s=room();start(s);guess(s);assert.throws(()=>resolveRound(s,'p1','яма','p0',1200));
 assert.throws(()=>resolveRound(s,'host','яма','host',1200));
 resolveRound(s,'host','Яма!','p0',1200);assert.equal(s.players[0].score,200);
 assert.equal(s.players[1].score,0);assert.equal(s.players[2].score,100);
 assert.equal(snapshot(s,'host').result.answer,'Яма');
});
test('timer handles incomplete hints and unattended host, awarding liar once',()=>{
 const s=room();start(s);assert.equal(tick(s,120999),false);assert.equal(tick(s,121000),true);
 assert.equal(s.phase,'guess');assert.equal(tick(s,211000),true);assert.equal(s.phase,'reveal');
 assert.equal(s.players[1].score,150);assert.equal(tick(s,999999),false);assert.equal(s.players[1].score,150);
});
test('five rounds only; no topic puzzle repeats within the match',()=>{
 const s=room();
 for(let n=0;n<5;n++){
  startRound(s,'host',online,1000,()=>0);guess(s);resolveRound(s,'host',riddles.find(q=>q.id===s.puzzleId).answer,s.liarId,1200);
 }
 assert.equal(new Set(s.used).size,5);assert.equal(s.round,5);
 assert.throws(()=>startRound(s,'host',online,1000,()=>0));
});
test('practice fills hints using bots and advances immediately',()=>{
 const s=room();s.practice=true;s.players.slice(1).forEach(p=>p.bot=true);
 startRound(s,'host',['host'],1000,()=>0);assert.equal(s.phase,'guess');assert.equal(Object.keys(s.hints).length,5);
 assert.equal(snapshot(s,'host').practice,true);
});
test('answer normalization handles Ukrainian apostrophes, punctuation and case',()=>{
 assert.equal(normalize(' ІМ’Я! '),normalize("ім'я"));assert.equal(normalize('Гаррі Поттер'),normalize('гаррі-поттер'));
 assert.throws(()=>clean({},2,20));assert.throws(()=>clean('  ',2,20));
});
