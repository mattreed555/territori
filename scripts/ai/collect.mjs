// Bounded, sequential teacher collection. Requires a durably committed lease.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {openMeter, atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['run-id','out','ledger','teacher-url','games','seed','max-turns','source-commit'].map(k=>[k,{type:'string'}]))});
const runId=v['run-id'], directory=v.out, games=Number(v.games||10), seed=Number(v.seed||511), maxTurns=Number(v['max-turns']||160);
if(!runId||!directory||!v.ledger||!v['teacher-url']||!v['source-commit'])throw Error('Required: --run-id --out --ledger --teacher-url --source-commit');
if(![games,seed,maxTurns].every(Number.isSafeInteger)||games<1||maxTurns<1)throw Error('Invalid numeric argument');
const endpoint=new URL(v['teacher-url']);
if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search)throw Error('Use a credential-free HTTPS teacher endpoint');
const load=await loadModules();
const {STRATEGIES}=await load('game/strategies'), {simulateGame}=await load('ai/simulator'), {RULESET}=await load('ai/dataset');
const {legalMoves,moveId,nextPositionKey}=await load('game/rules'), {seededRandom}=await load('ai/policy');
const strategies=Object.keys(STRATEGIES), random=seededRandom(seed);
for(let i=strategies.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[strategies[i],strategies[j]]=[strategies[j],strategies[i]];}
// Each five-game block covers all strategies in both colors; subsequent blocks rotate opponents.
const matchups=Array.from({length:games},(_,i)=>({blue:strategies[i%5],red:strategies[(i+1+Math.floor(i/5))%5]}));
await fs.mkdir(directory,{recursive:true});
const meter=await openMeter({ledgerFile:v.ledger,journalFile:path.join(directory,'usage.jsonl'),runId});
const file=await fs.open(path.join(directory,'decisions.jsonl'),'wx');
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const provenance={runId,seed,ruleset:RULESET,sourceCommit:v['source-commit'],promptSha256:await hash('lib/game/jev.ts'),strategiesSha256:await hash('lib/game/strategies.ts'),maxTurns,matchups,seedScope:'matchup order only; provider decisions are not seeded',purpose:'training/development validation, not independent acceptance evaluation',teacherEndpoint:endpoint.href,startedAt:new Date().toISOString()};
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
    const result=await simulateGame({gameId:activeGameId,players:matchups[i],agents:{blue:teacher,red:teacher},maxTurns,write:async e=>{await file.write(JSON.stringify(e)+'\n');await file.sync();}});
    results.push({...result,players:matchups[i]});
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
