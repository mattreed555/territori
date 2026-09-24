// All 25 ordered strategy pairings with BOTH players local. No API.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{...Object.fromEntries(['policy','style','out','seed'].map(k=>[k,{type:'string'}])),verify:{type:'boolean'}}});
if(!v.policy||!v.style||!v.out)throw Error('Use --policy MODEL --style MODEL --out PREFIX [--seed N] [--verify]');
const load=await loadModules(),{chooseIntentMove,INTENT_VERSION}=await load('ai/intent'),{validateModel,seededRandom}=await load('ai/policy'),{validateStyleModel}=await load('ai/style'),{STRATEGIES}=await load('game/strategies'),{simulateGame}=await load('ai/simulator'),{recordDecision,recordResult}=await load('ai/dataset'),{newGame,applyMove,moveId}=await load('game/rules');
const hash=b=>createHash('sha256').update(b).digest('hex'),policyBytes=await fs.readFile(v.policy),styleBytes=await fs.readFile(v.style),policy=validateModel(JSON.parse(policyBytes)),style=validateStyleModel(JSON.parse(styleBytes)),sourceSha256=hash(await fs.readFile('lib/ai/intent.ts'));
await fs.mkdir(path.dirname(v.out),{recursive:true});
if(v.verify){
 const report=JSON.parse(await fs.readFile(v.out+'.json')),bytes=await fs.readFile(v.out+'.jsonl.gz'),events=gunzipSync(bytes).toString().trim().split('\n').map(JSON.parse);
 assert.equal(report.policySha256,hash(policyBytes));assert.equal(report.styleSha256,hash(styleBytes));assert.equal(report.sourceSha256,sourceSha256);assert.equal(report.intentVersion,INTENT_VERSION);
 assert.equal(report.results.length,25);assert.equal(new Set(report.results.map(r=>r.gameId)).size,25);assert.ok(events.every(e=>report.results.some(r=>r.gameId===e.gameId)));
 let decisions=0;for(const r of report.results){let g=newGame(),finished=false;const random={blue:seededRandom(r.seeds.blue),red:seededRandom(r.seeds.red)};
  assert.notEqual(r.status,'aborted');
  for(const e of events.filter(e=>e.gameId===r.gameId)){
   assert.equal(finished,false);
   if(e.kind==='decision'){
    assert.deepEqual(e,recordDecision(r.gameId,g,r.players[g.turn],e.chosenMove,'local',null));
    const move=chooseIntentMove(g,r.players[g.turn],policy,style,report.options,report.epsilon,random[g.turn]);assert.equal(moveId(move),moveId(e.chosenMove));g=applyMove(g,move);decisions++;
   }else{assert.deepEqual(e,recordResult(r.gameId,g));for(const [k,value] of Object.entries(e.result))assert.deepEqual(r[k],value);if(!g.ended)assert.equal(g.ply,report.maxTurns);finished=true;}
  }assert.ok(finished);
 }
 const result={games:25,decisions,allStatesChoicesAndOutcomesReproduced:true,policySha256:hash(policyBytes),styleSha256:hash(styleBytes),sourceSha256,datasetSha256:hash(bytes),paidCalls:0};await atomicJSON(v.out+'-integrity.json',result);console.log(JSON.stringify(result));
}else{
 const seed=Number(v.seed||2412);if(!Number.isSafeInteger(seed))throw Error('Invalid seed');
 const names=Object.keys(STRATEGIES),events=[],results=[],options={strength:1,margin:1},epsilon=.03,maxTurns=160;
 for(const [a,blue] of names.entries())for(const [b,red] of names.entries()){
  const gameId=`${path.basename(v.out)}:${a}:${b}`,players={blue,red},seeds={blue:seed+a*10007+b*101,red:seed+a*10007+b*101+37},agents={};
  for(const color of ['blue','red']){const random=seededRandom(seeds[color]);agents[color]={source:'local',choose:async(game,strategy)=>({move:chooseIntentMove(game,strategy,policy,style,options,epsilon,random)})};}
  try{const result=await simulateGame({gameId,players,agents,maxTurns,write:async e=>{events.push(e);}});results.push({gameId,players,seeds,...result.result});}
  catch(e){results.push({gameId,players,seeds,status:'aborted',error:e.message});}
 }
 const complete=results.filter(r=>r.status==='completed'),summary={games:25,completed:complete.length,aborted:results.filter(r=>r.status==='aborted').length,truncated:results.filter(r=>r.status==='truncated').length,repetitionEnds:complete.filter(r=>r.reason==='repetition').length,meanTurns:complete.reduce((n,r)=>n+r.turns,0)/complete.length,maxTurns:Math.max(...results.map(r=>r.turns||0))};
 const moveTypes=Object.fromEntries(names.map(s=>[s,Object.fromEntries(['place','remove','shift'].map(t=>[t,events.filter(e=>e.kind==='decision'&&e.strategy===s&&e.chosenMove.type===t).length]))]));
 await atomicJSON(v.out+'.json',{purpose:'Free all-pairing local-only smoke test, not Jev strength or independent style validation',intentVersion:INTENT_VERSION,policySha256:hash(policyBytes),styleSha256:hash(styleBytes),sourceSha256,seed,options,epsilon,maxTurns,summary,moveTypes,results});await fs.writeFile(v.out+'.jsonl.gz',gzipSync(events.map(e=>JSON.stringify(e)).join('\n')+'\n'));console.log(JSON.stringify({summary,moveTypes}));
}
