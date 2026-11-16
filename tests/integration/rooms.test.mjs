import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {io as connect} from 'socket.io-client';
import {createRuntime} from '../../server/runtime.mjs';
let pool,runtime,url;
const sockets=[],codes=[];
const emit=(socket,event,data={})=>socket.timeout(5000).emitWithAck(event,data);
function waitState(socket,predicate){
 if(socket.latest&&predicate(socket.latest))return Promise.resolve(socket.latest);
 return new Promise((resolve,reject)=>{
  const listener=state=>{if(predicate(state)){clearTimeout(timer);socket.off('room:state',listener);resolve(state);}};
  const timer=setTimeout(()=>{socket.off('room:state',listener);reject(new Error('State update timed out'));},5000);
  socket.on('room:state',listener);
 });
}
async function client(){
 const socket=connect(url,{transports:['websocket'],forceNew:true,reconnection:false,autoConnect:false});
 sockets.push(socket);socket.latest=null;socket.on('room:state',state=>{socket.latest=state;});
 await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect();});
 return socket;
}
before(async()=>{
 assert.ok(process.env.DATABASE_URL,'Set DATABASE_URL to an isolated test PostgreSQL database');
 pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 runtime=await createRuntime({pool,origin:'http://localhost:3000'});
 await new Promise(resolve=>runtime.http.listen(0,'127.0.0.1',resolve));
 url='http://127.0.0.1:'+runtime.http.address().port;
});
after(async()=>{
 for(const socket of sockets)socket.disconnect();
 if(codes.length)await pool.query('DELETE FROM rooms WHERE code=ANY($1::text[])',[codes]);
 if(runtime)await runtime.close();if(pool)await pool.end();
});
test('six real sockets: private roles, concurrent hints, scoring, forged actions, resume, persistent state',async()=>{
 const host=await client();
 const created=await emit(host,'room:create',{name:'Host',theme:'logic'});
 assert.equal(created.ok,true);codes.push(created.code);
 const viewers=[];
 for(let n=0;n<5;n++){
  const viewer=await client();const joined=await emit(viewer,'room:join',{name:'Player '+n,code:created.code});
  assert.equal(joined.ok,true);viewers.push({socket:viewer,...joined});
 }
 const extra=await client();
 assert.equal((await emit(extra,'room:join',{name:'Extra',code:created.code})).ok,false);
 assert.equal((await emit(viewers[0].socket,'round:start')).ok,false);
 assert.equal((await emit(host,'round:start')).ok,true);
 await Promise.all(viewers.map(v=>waitState(v.socket,s=>s.phase==='hints')));
 const states=viewers.map(v=>v.socket.latest);
 assert.equal(states.filter(s=>s.role==='liar').length,1);
 assert.equal(states.filter(s=>s.role==='truth').length,4);
 assert.equal(host.latest.secret,null);assert.equal(host.latest.result,null);assert.equal(host.latest.liarId,undefined);
 const liar=states.find(s=>s.role==='liar');
 const truthful=states.find(s=>s.role==='truth');
 const answer=truthful.secret;
 assert.notEqual(liar.secret,answer);
 assert.equal((await emit(viewers[0].socket,'hint:submit',{text:'x'.repeat(81)})).ok,false);
 assert.equal((await emit(viewers[0].socket,'hint:submit',{text:answer})).ok,false);
 assert.equal((await emit(host,'hint:submit',{text:'Host cheating'})).ok,false);
 const results=await Promise.all(viewers.map((v,n)=>emit(v.socket,'hint:submit',{text:'Обережна підказка '+n})));
 assert.ok(results.every(r=>r.ok));
 await waitState(host,s=>s.phase==='guess');
 assert.equal(host.latest.phase,'guess');assert.equal(Object.keys(host.latest.hints).length,5);
 assert.equal((await emit(viewers[0].socket,'round:resolve',{answer,accusedId:liar.me})).ok,false);
 assert.equal((await emit(host,'round:resolve',{answer,accusedId:liar.me})).ok,true);
 assert.equal(host.latest.result.caught,true);assert.equal(host.latest.result.solved,true);
 assert.equal(host.latest.players.find(p=>p.id===host.latest.me).score,200);
 assert.equal((await emit(host,'round:resolve',{answer,accusedId:liar.me})).ok,false);
 const persisted=(await pool.query('SELECT state FROM rooms WHERE code=$1',[created.code])).rows[0].state;
 assert.equal(persisted.phase,'reveal');assert.equal(persisted.players.find(p=>p.id===host.latest.me).score,200);
 const oldId=host.latest.me;host.disconnect();
 const resumed=await client();assert.equal((await emit(resumed,'room:resume',created)).ok,true);
 assert.equal(resumed.latest.me,oldId);assert.equal(resumed.latest.players.find(p=>p.id===oldId).score,200);
 const intruder=await client();
 assert.equal((await emit(intruder,'room:resume',{code:created.code,token:'0'.repeat(64)})).ok,false);
 assert.equal((await emit(intruder,'round:start')).ok,false);
});
test('practice is playable alone; bot roles never leak to host before reveal',async()=>{
 const host=await client();const created=await emit(host,'room:create',{name:'Solo',theme:'mixed',practice:true});
 assert.equal(created.ok,true);codes.push(created.code);
 assert.equal((await emit(host,'round:start')).ok,true);assert.equal(host.latest.phase,'guess');
 assert.equal(host.latest.players.filter(p=>p.bot).length,5);
 assert.equal(host.latest.secret,null);assert.equal(host.latest.liarId,undefined);
 const suspect=host.latest.players.find(p=>p.bot).id;
 assert.equal((await emit(host,'round:resolve',{answer:'Не знаю',accusedId:suspect})).ok,true);
 assert.equal(host.latest.phase,'reveal');
});
test('origin rejection and lobby kicking invalidate a removed player session',async()=>{
 const rejected=connect(url,{transports:['websocket'],forceNew:true,reconnection:false,autoConnect:false,extraHeaders:{Origin:'https://untrusted.invalid'}});
 sockets.push(rejected);
 await new Promise((resolve,reject)=>{rejected.once('connect_error',resolve);rejected.once('connect',()=>reject(new Error('Untrusted origin accepted')));rejected.connect();});
 const host=await client();const created=await emit(host,'room:create',{name:'KickHost',theme:'mixed'});codes.push(created.code);
 const viewer=await client();const joined=await emit(viewer,'room:join',{code:created.code,name:'Removed'});
 const id=viewer.latest.me;assert.equal((await emit(viewer,'room:kick',{id:host.latest.me})).ok,false);
 assert.equal((await emit(host,'room:kick',{id})).ok,true);
 const retry=await client();assert.equal((await emit(retry,'room:resume',joined)).ok,false);
});
test('server restart recovers PostgreSQL game state and bearer session',async()=>{
 const host=await client();const created=await emit(host,'room:create',{name:'Restart',theme:'logic',practice:true});
 codes.push(created.code);await emit(host,'round:start');
 const oldId=host.latest.me,oldQuestion=host.latest.question;
 for(const socket of sockets)socket.disconnect();
 await runtime.close();
 runtime=await createRuntime({pool,origin:'http://localhost:3000'});
 await new Promise(resolve=>runtime.http.listen(0,'127.0.0.1',resolve));
 url='http://127.0.0.1:'+runtime.http.address().port;
 const resumed=await client();assert.equal((await emit(resumed,'room:resume',created)).ok,true);
 assert.equal(resumed.latest.me,oldId);assert.equal(resumed.latest.question,oldQuestion);assert.equal(resumed.latest.phase,'guess');
});
