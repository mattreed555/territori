// Bounded, sequential teacher collection. Requires a durably committed lease.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {openMeter, atomicJSON} from './budget.mjs';
import {prepareLocalAgent} from './local-agent.mjs';
import {checkAcceptance,checkAcceptanceReservation} from './acceptance.mjs';
const {values:v}=parseArgs({options:{...Object.fromEntries(['run-id','out','ledger','teacher-url','games','seed','max-turns','source-commit','mode','model','epsilon','search','style','intent','protocol'].map(k=>[k,{type:'string'}])),'dry-run':{type:'boolean'}}});
const runId=v['run-id'], directory=v.out, games=Number(v.games||10), seed=Number(v.seed||511), maxTurns=Number(v['max-turns']||160);
if(!runId||!directory||!v.ledger||!v['teacher-url']||!v['source-commit'])throw Error('Required: --run-id --out --ledger --teacher-url --source-commit');
if(![games,seed,maxTurns].every(Number.isSafeInteger)||games<1||maxTurns<1)throw Error('Invalid numeric argument');
const endpoint=new URL(v['teacher-url']);
if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search)throw Error('Use a credential-free HTTPS teacher endpoint');
const load=await loadModules();
const {STRATEGIES}=await load('game/strategies'), {simulateGame}=await load('ai/simulator'), {RULESET}=await load('ai/dataset');
const {legalMoves,moveId,nextPositionKey}=await load('game/rules'), {seededRandom}=await load('ai/policy');
const mode=v.mode||'jev-vs-jev',epsilon=Number(v.epsilon||.03);
if(!['jev-vs-jev','local-vs-jev'].includes(mode)||!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw Error('Invalid mode or epsilon');
if(mode==='local-vs-jev'&&games%10!==0)throw Error('Local/Jev batches require multiples of ten for balanced colors and strategies');
const search=v.search?JSON.parse(v.search):null;
const intent=v.intent?JSON.parse(v.intent):null;
if((v.model||v.style||v.intent||v.search)&&mode!=='local-vs-jev')throw Error('Local options require local-vs-jev');
if((v.intent&&intent===null)||(v.search&&search===null))throw Error('Expected explicit options object, not null');
const prepared=mode==='local-vs-jev'?await prepareLocalAgent({modelPath:v.model,stylePath:v.style,search,intent,epsilon}):null;
const strategies=Object.keys(STRATEGIES), random=seededRandom(seed);
for(let i=strategies.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[strategies[i],strategies[j]]=[strategies[j],strategies[i]];}
// Each five-game block covers all strategies in both colors; subsequent blocks rotate opponents.
const matchups=Array.from({length:games},(_,i)=>({blue:strategies[i%5],red:mode==='local-vs-jev'?strategies[i%5]:strategies[(i+1+Math.floor(i/5))%5]}));
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const provenance={runId,seed,mode,epsilon,localAgent:prepared?.metadata??null,search:prepared?.metadata.search??null,searchSourceSha256:prepared?.metadata.sourceHashes['lib/ai/search.ts']??null,modelSha256:prepared?.metadata.modelSha256??null,ruleset:RULESET,sourceCommit:v['source-commit'],promptSha256:await hash('lib/game/jev.ts'),strategiesSha256:await hash('lib/game/strategies.ts'),maxTurns,matchups,seedScope:'matchup order and local epsilon sampling (seed + game index); provider decisions are not seeded',purpose:'training/development validation, not independent acceptance evaluation',teacherEndpoint:endpoint.href,startedAt:new Date().toISOString()};
const acceptance=v.protocol?await checkAcceptance(v.protocol,provenance):null;
if(acceptance){provenance.purpose='independent-acceptance';provenance.acceptance=acceptance.metadata;}
if(v['dry-run']){console.log(JSON.stringify({dryRun:true,paidCalls:0,budgetValidated:false,provenance}));process.exit(0);}
if(acceptance)checkAcceptanceReservation(JSON.parse(await fs.readFile(v.ledger,'utf8')),acceptance);
await fs.mkdir(directory,{recursive:true});
const meter=await openMeter({ledgerFile:v.ledger,journalFile:path.join(directory,'usage.jsonl'),runId});
const file=await fs.open(path.join(directory,'decisions.jsonl'),'wx');
await atomicJSON(path.join(directory,'provenance.json'),provenance);
const results=[];let activeGameId='',failure=null;
const teacher={source:'jev',choose:(game,strategy)=>meter.request(async()=>{
  const body={board:game.board,turn:game.turn,supply:game.supply,captured:game.captured,finalRound:game.finalRound,last:game.last,strategy,repetitionCounts:Object.fromEntries(legalMoves(game).map(m=>[moveId(m),game.positions[nextPositionKey(game,m)]||0]))};
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`Teacher HTTP ${response.status}`);
  return response.json();
},{gameId:activeGameId,turnNumber:game.ply+1,strategy,player:game.turn})};
try {
  for(let i=0;i<games;i++){
    activeGameId=`${runId}:${i}`;
    const localColor=Math.floor(i/5)%2===0?'blue':'red',localRandom=seededRandom(seed+i);
    const local={source:'local',choose:async(game,strategy)=>({move:prepared.choose(game,strategy,localRandom)})};
    const agents=mode==='jev-vs-jev'?{blue:teacher,red:teacher}:{blue:localColor==='blue'?local:teacher,red:localColor==='red'?local:teacher};
    const result=await simulateGame({gameId:activeGameId,players:matchups[i],agents,maxTurns,write:async e=>{await file.write(JSON.stringify(acceptance?{...e,evaluationProtocol:acceptance.metadata.sha256}:e)+'\n');await file.sync();}});
    results.push({...result,players:matchups[i],localColor:mode==='local-vs-jev'?localColor:null});
    await atomicJSON(path.join(directory,'games.json'),results);
    console.log(JSON.stringify({game:i+1,players:matchups[i],...result.result}));
  }
} catch(error) {failure=error.message;process.exitCode=1;console.error(failure);}
finally {
  await file.close();
  const usage=await meter.close();
  await atomicJSON(path.join(directory,'summary.json'),{finishedAt:new Date().toISOString(),completed:results.filter(r=>r.result.status==='completed').length,truncated:results.filter(r=>r.result.status==='truncated').length,requestedGames:games,failure,...usage});
  console.log(JSON.stringify(usage));
}
