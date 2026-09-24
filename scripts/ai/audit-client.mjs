// Offline application adapter audit. This is NOT browser or mobile evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{out:{type:'string'},verify:{type:'boolean'},'bundle-only':{type:'boolean'}}});
if(!v.out)throw Error('Use --out DIR [--verify | --bundle-only]');
await fs.mkdir(v.out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
if(v['bundle-only']){
 const dir='dist/client',files=[];
 for(const p of (await fs.readdir(dir,{recursive:true})).filter(p=>p.endsWith('.js')).sort()){
  const b=await fs.readFile(path.join(dir,p));files.push({path:p,bytes:b.length,gzipBytes:gzipSync(b).length,sha256:hash(b)});
 }
 await atomicJSON(`${v.out}/app-bundle-after.json`,{files,totalBytes:files.reduce((s,f)=>s+f.bytes,0),totalGzipBytes:files.reduce((s,f)=>s+f.gzipBytes,0)});
 console.log(JSON.stringify({files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),gzipBytes:files.reduce((s,f)=>s+f.gzipBytes,0)}));
}else{
 const load=await loadModules(),{prepareLocalPlayer}=await load('ai/local-player'),{seededRandom}=await load('ai/policy');
 const {newGame,applyMove,legalMoves,moveId}=await load('game/rules'),{STRATEGIES}=await load('game/strategies'),{recordDecision,recordResult}=await load('ai/dataset');
 const strategies=Object.keys(STRATEGIES),settings={engine:'candidate',epsilon:.03,model:null};
 const events=[],games=[],originalFetch=globalThis.fetch;let networkCalls=0;
 globalThis.fetch=()=>{networkCalls++;throw Error('Network forbidden in local adapter audit');};
 try{
  const bot=await prepareLocalPlayer(settings,strategies);
  for(const strategy of strategies)for(const mode of ['bots','simulated-human']){
   const index=games.length,seed=241500+index,humanSeed=912+index,random=seededRandom(seed),humanRandom=seededRandom(humanSeed);
   let g=newGame();const gameId=`client-14-${index}`;
   while(!g.ended&&g.ply<160){
    const moves=legalMoves(g),human=mode==='simulated-human'&&g.turn==='blue';
    const move=human?moves[Math.floor(humanRandom()*moves.length)]:bot.choose(g,strategy,random);
    assert.ok(moves.some(m=>moveId(m)===moveId(move)));
    // Human-simulation records are separate from teacher/local training events.
    if(human)events.push({kind:'simulated-human',gameId,state:structuredClone(g),move});
    else events.push({...recordDecision(gameId,g,strategy,move,'local'),localPolicy:{id:bot.id,epsilon:settings.epsilon}});
    g=applyMove(g,move);
   }
   assert.ok(g.ended,'Unfinished local game');const result=recordResult(gameId,g);events.push(result);
   games.push({gameId,strategy,mode,seed,humanSeed,...result.result});
  }
  // Neither missing code nor invalid assets may turn into a remote request.
  await assert.rejects(prepareLocalPlayer(settings,strategies,async()=>{throw Error('missing code chunk');}),/No API fallback/);
  assert.equal(networkCalls,0);
 }finally{globalThis.fetch=originalFetch;}
 const text=events.map(e=>JSON.stringify(e)).join('\n')+'\n',bytes=Buffer.from(text),hashes={};
 for(const file of ['app/page.tsx','app/training/page.tsx','lib/ai/local-player.ts','lib/ai/candidate.ts','lib/ai/candidate-assets.ts','lib/ai/settings.ts','lib/ai/intent.ts','lib/ai/search.ts','scripts/ai/audit-client.mjs'])hashes[file]=hash(await fs.readFile(file));
 const evidence={purpose:'Seeded Node audit of the adapter used by the normal game; NOT UI/browser/mobile/acceptance evidence',games:games.length,completed:games.filter(g=>g.status==='completed').length,decisions:events.filter(e=>e.kind==='decision').length,simulatedHumanMoves:events.filter(e=>e.kind==='simulated-human').length,networkCalls,aborted:0,truncated:0,repetition:games.filter(g=>g.reason==='repetition').length,eventsSha256:hash(bytes),hashes};
 if(v.verify){
  assert.equal(gunzipSync(await fs.readFile(`${v.out}/games.jsonl.gz`)).toString(),text);
  assert.deepEqual(JSON.parse(await fs.readFile(`${v.out}/games.json`)),games);
  assert.deepEqual(JSON.parse(await fs.readFile(`${v.out}/adapter-audit.json`)),evidence);
  console.log(JSON.stringify({verified:true,...evidence}));
 }else{
  await fs.writeFile(`${v.out}/games.jsonl.gz`,gzipSync(bytes));
  await atomicJSON(`${v.out}/games.json`,games);await atomicJSON(`${v.out}/adapter-audit.json`,evidence);
  console.log(JSON.stringify(evidence));
 }
}
