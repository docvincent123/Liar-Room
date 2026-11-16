import next from 'next';
import pg from 'pg';
import {createRuntime} from './runtime.mjs';
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL. See .env.example and README.md');
const dev=process.env.NODE_ENV!=='production';
const port=Number(process.env.PORT??3000);
const origin=process.env.APP_ORIGIN??'http://localhost:'+port;
if(!dev&&!process.env.APP_ORIGIN)throw new Error('APP_ORIGIN is required in production');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
const app=next({dev,hostname:'0.0.0.0',port});
await app.prepare();
const runtime=await createRuntime({pool,origin,handler:app.getRequestHandler()});
if(dev){
 const upgrade=app.getUpgradeHandler();
 runtime.http.on('upgrade',(req,socket,head)=>{if(req.url?.startsWith('/_next/'))upgrade(req,socket,head);});
}
runtime.http.listen(port,'0.0.0.0',()=>console.log('LIAR ROOM listening on port '+port));
let closing=false;
async function shutdown(){
 if(closing)return;closing=true;
 const forced=setTimeout(()=>process.exit(1),10000);forced.unref();
 await runtime.close();await app.close();await pool.end();clearTimeout(forced);process.exit(0);
}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
