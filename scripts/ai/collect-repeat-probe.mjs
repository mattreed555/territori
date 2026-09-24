// Two interleaved passes of identical inputs, no retries or invented outcomes.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {openMeter,atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['positions','out','ledger','run-id','teacher-url','source-commit'].map(k=>[k,{type:'string'}]))});
if(Object.values(v).length!==6)throw Error('Required: --positions --out --ledger --run-id --teacher-url --source-commit');
const endpoint=new URL(v['teacher-url']);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search)throw Error('Use a credential-free HTTPS endpoint');
const load=await loadModules(),{STRATEGIES}=await load('game/strategies'),{legalMoves,moveId,nextPositionKey}=await load('game/rules'),{recordRepeatedCounterfactual}=await load('ai/repeated-probe');
const bytes=await fs.readFile(v.positions),{positions,repeats}=JSON.parse(bytes);
if(positions.length!==12||new Set(positions.map(p=>p.id)).size!==12||new Set(positions.map(p=>p.groupId)).size!==12||repeats!==2)throw Error('Twelve unique groups and two repeats required');
for(const p of positions)recordRepeatedCounterfactual(p,'Balanced',legalMoves(p.state)[0],{model:'preflight',answer:null},0);
await fs.mkdir(v.out,{recursive:true});const file=await fs.open(`${v.out}/labels.jsonl`,'wx');
let meter;try{meter=await openMeter({ledgerFile:v.ledger,journalFile:`${v.out}/usage.jsonl`,runId:v['run-id']});}catch(e){await file.close();throw e;}
const hash=async path=>createHash('sha256').update(await fs.readFile(path)).digest('hex');let completed=0,failure=null;
try{
 await atomicJSON(`${v.out}/provenance.json`,{runId:v['run-id'],sourceCommit:v['source-commit'],positionsSha256:createHash('sha256').update(bytes).digest('hex'),collectorSha256:await hash('scripts/ai/collect-repeat-probe.mjs'),promptSha256:await hash('lib/game/jev.ts'),strategiesSha256:await hash('lib/game/strategies.ts'),purpose:'DEVELOPMENT repeated counterfactuals; no played outcomes. Pass zero alone may train; both passes remain grouped by source.',endpoint:endpoint.href,requestedLabels:120,startedAt:new Date().toISOString()});
 for(let repeat=0;repeat<repeats;repeat++)for(const p of positions)for(const strategy of Object.keys(STRATEGIES)){
  const game=p.state,context={positionId:p.id,groupId:p.groupId,strategy,player:game.turn,repeat};
  const response=await meter.request(async()=>{
   const body={board:game.board,turn:game.turn,supply:game.supply,captured:game.captured,finalRound:game.finalRound,last:game.last,strategy,repetitionCounts:Object.fromEntries(legalMoves(game).map(m=>[moveId(m),game.positions[nextPositionKey(game,m)]||0]))};
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`Teacher HTTP ${r.status}`);return r.json();
  },context);
  const label=recordRepeatedCounterfactual(p,strategy,response.move,response.teacher,repeat);
  await file.write(JSON.stringify(label)+'\n');await file.sync();completed++;
 }
}catch(e){failure=e.message;process.exitCode=1;console.error(failure);}
finally{await file.close();const usage=await meter.close();await atomicJSON(`${v.out}/summary.json`,{completed,requestedLabels:120,failure,...usage});console.log(JSON.stringify({completed,failure,...usage}));}
