import {createServer} from 'node:http';
import {createHash,randomBytes,randomInt,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Server} from 'socket.io';
import {clean,ensure,newRoom,joinRoom,startRound,submitHint,resolveRound,tick,snapshot} from './game.mjs';
import {themes} from './riddles.mjs';
const hash=token=>createHash('sha256').update(token).digest('hex');
const makeToken=()=>randomBytes(32).toString('hex');
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode=()=>Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');
export async function createRuntime({pool,origin,handler}){
 await pool.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 const http=createServer(async(req,res)=>{
  if(req.url==='/healthz'){
   try{await pool.query('SELECT 1');res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"ok":true}');}
   catch{res.writeHead(503);res.end('Database unavailable');}return;
  }
  if(req.url==='/api/catalog'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'public, max-age=300'});
   res.end(JSON.stringify({themes,hintLimit:80,players:6,rounds:5}));return;
  }
  if(handler)return handler(req,res);
  res.writeHead(404);res.end();
 });
 const connections=new Map();
 const io=new Server(http,{maxHttpBufferSize:4096,serveClient:false,allowRequest:(req,done)=>{
  const ip=req.socket.remoteAddress??'unknown';
  const hits=(connections.get(ip)??0)+1;connections.set(ip,hits);
  done(null,hits<=120&&(!req.headers.origin||req.headers.origin===origin));
 }});
 const online=code=>[...io.sockets.sockets.values()].filter(s=>s.data.identity?.code===code).map(s=>s.data.identity.id);
 const load=async(code,client=pool)=>{
  const {rows}=await client.query('SELECT state FROM rooms WHERE code=$1 AND expires_at>now()',[code]);
  ensure(rows.length,'Кімнату не знайдено або термін її дії минув');return rows[0].state;
 };
 const publish=async(code)=>{
  try{
   const state=await load(code);
   for(const socket of io.sockets.sockets.values())if(socket.data.identity?.code===code)
    socket.emit('room:state',snapshot(state,socket.data.identity.id,online(code)));
  }catch(error){if(error.name!=='GameError')console.error('publish',error);}
 };
 const mutate=async(code,fn)=>{
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const {rows}=await client.query('SELECT state FROM rooms WHERE code=$1 AND expires_at>now() FOR UPDATE',[code]);
   ensure(rows.length,'Кімнату не знайдено або термін її дії минув');
   const state=rows[0].state;
   await fn(state,client);
   state.rev++;
   await client.query("UPDATE rooms SET state=$2::jsonb,updated_at=now(),expires_at=now()+interval '24 hours' WHERE code=$1",[code,JSON.stringify(state)]);
   await client.query('COMMIT');return state;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 };
 const attach=async(socket,code,id)=>{
  ensure(!socket.data.identity,'Ви вже у кімнаті. Спершу вийдіть із неї');
  socket.data.identity={code,id};await socket.join(code);
 };
 io.on('connection',socket=>{
  let budget=30,windowStart=Date.now();
  const bind=(event,fn)=>socket.on(event,async(data,ack)=>{
   if(typeof ack!=='function')return;
   if(Date.now()-windowStart>10000){budget=30;windowStart=Date.now();}
   if(--budget<0){ack({ok:false,error:'Забагато дій. Зачекай кілька секунд'});return;}
   try{const result=await fn(data??{});ack({ok:true,...result});}
   catch(error){
    if(error.name!=='GameError')console.error(event,error);
    ack({ok:false,error:error.name==='GameError'?error.message:'Помилка сервера. Спробуй ще раз'});
   }
  });
  const identity=()=>{
   ensure(socket.data.identity,'Спочатку увійди в кімнату');return socket.data.identity;
  };
  bind('room:create',async data=>{
   ensure(!socket.data.identity,'Ви вже у кімнаті');
   const name=clean(data.name,2,20,'Нік');
   const theme=clean(data.theme??'mixed',2,20,'Тема');
   ensure(data.practice===undefined||typeof data.practice==='boolean','Невірний режим');
   const token=makeToken(),id=randomUUID();
   let code;
   for(let attempt=0;attempt<5;attempt++){
    code=makeCode();const state=newRoom(code,{id,name},theme,!!data.practice);
    if(state.practice)for(let n=0;n<5;n++)joinRoom(state,{id:randomUUID(),name:['Бот Лис','Бот Ворон','Бот Кіт','Бот Вовк','Бот Сова'][n],bot:true});
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     await client.query('INSERT INTO rooms(code,state) VALUES ($1,$2::jsonb)',[code,JSON.stringify(state)]);
     await client.query('INSERT INTO sessions(token_hash,room_code,player_id) VALUES ($1,$2,$3)',[hash(token),code,id]);
     await client.query('COMMIT');break;
    }catch(error){await client.query('ROLLBACK');if(error.code!=='23505'||attempt===4)throw error;code=null;}
    finally{client.release();}
   }
   await attach(socket,code,id);await publish(code);
   return {token,code};
  });
  bind('room:join',async data=>{
   ensure(!socket.data.identity,'Ви вже у кімнаті');
   const code=clean(data.code,6,6,'Код').toUpperCase(),name=clean(data.name,2,20,'Нік');
   const id=randomUUID(),token=makeToken();
   await mutate(code,async(state,client)=>{
    ensure(!state.practice,'Тренувальна кімната лише для ведучого');
    joinRoom(state,{id,name});
    await client.query('INSERT INTO sessions(token_hash,room_code,player_id) VALUES ($1,$2,$3)',[hash(token),code,id]);
   });
   await attach(socket,code,id);await publish(code);return {token,code};
  });
  bind('room:resume',async data=>{
   ensure(!socket.data.identity,'Ви вже у кімнаті');
   const token=clean(data.token,64,64,'Сесія'),code=clean(data.code,6,6,'Код').toUpperCase();
   const {rows}=await pool.query('SELECT player_id FROM sessions WHERE token_hash=$1 AND room_code=$2',[hash(token),code]);
   ensure(rows.length,'Сесію не знайдено. Увійди знову');
   const state=await load(code);
   ensure(state.players.some(p=>p.id===rows[0].player_id),'Вас вилучено з кімнати');
   await attach(socket,code,rows[0].player_id);await publish(code);return {code};
  });
  bind('round:start',async()=>{
   const {code,id}=identity();await mutate(code,state=>startRound(state,id,online(code),Date.now(),randomInt));await publish(code);
  });
  bind('hint:submit',async data=>{
   const {code,id}=identity();await mutate(code,state=>submitHint(state,id,data.text));await publish(code);
  });
  bind('round:resolve',async data=>{
   const {code,id}=identity();await mutate(code,state=>resolveRound(state,id,data.answer,data.accusedId));await publish(code);
  });
  bind('room:kick',async data=>{
   const {code,id}=identity();
   await mutate(code,async(state,client)=>{
    ensure(id===state.hostId&&state.phase==='lobby','Вилучення доступне ведучому лише в лобі');
    ensure(typeof data.id==='string'&&data.id!==id,'Не можна вилучити себе');
    const player=state.players.find(p=>p.id===data.id);
    ensure(player&&!player.bot,'Гравця не знайдено');
    state.players=state.players.filter(p=>p.id!==data.id);
    await client.query('DELETE FROM sessions WHERE room_code=$1 AND player_id=$2',[code,data.id]);
   });
   for(const peer of io.sockets.sockets.values())if(peer.data.identity?.code===code&&peer.data.identity.id===data.id){
    peer.emit('session:revoked');peer.disconnect(true);
   }
   await publish(code);
  });
  socket.on('disconnect',()=>{if(socket.data.identity)void publish(socket.data.identity.code);});
 });
 let ticking=false;
 const timer=setInterval(async()=>{
  if(ticking)return;ticking=true;
  try{
   const {rows}=await pool.query("SELECT code FROM rooms WHERE expires_at>now() AND (state->>'deadline')::bigint <= $1 AND state->>'phase' IN ('hints','guess')",[Date.now()]);
   for(const {code} of rows){await mutate(code,state=>tick(state));await publish(code);}
  }catch(error){console.error('timer',error);}finally{ticking=false;}
 },1000);timer.unref();
 const cleanup=setInterval(()=>{
  connections.clear();
  pool.query('DELETE FROM rooms WHERE expires_at<now()').catch(error=>console.error('cleanup',error));
 },60000);cleanup.unref();
 return {http,io,close:async()=>{
  clearInterval(timer);clearInterval(cleanup);
  await new Promise(resolve=>io.close(resolve));
 }};
}
