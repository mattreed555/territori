// Reproduce a saved local tournament's states, seeded choices and outcomes.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['run','candidate','baseline','style','out'].map(k=>[k,{type:'string'}]))});
if(!v.run||!v.candidate||!v.baseline)throw Error('Use --run tournament-prefix --candidate model --baseline model');
const load=await loadModules(),{newGame,applyMove,moveId}=await load('game/rules'),{recordDecision,recordResult}=await load('ai/dataset'),{validateModel,chooseLocalMove,seededRandom}=await load('ai/policy'),{chooseSearchMove,SEARCH_VERSION}=await load('ai/search'),{STRATEGIES}=await load('game/strategies');
const report=JSON.parse(await fs.readFile(v.run+'.json')),bytes=await fs.readFile(v.run+'.jsonl.gz'),events=gunzipSync(bytes).toString().trim().split('\n').map(JSON.parse);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const cb=await fs.readFile(v.candidate),bb=await fs.readFile(v.baseline);
assert.equal(hash(cb),report.candidateSha256);assert.equal(hash(bb),report.baselineSha256);
const candidate=validateModel(JSON.parse(cb)),baseline=validateModel(JSON.parse(bb));
const {validateStyleModel,chooseStyledMove}=await load('ai/style');
const {chooseIntentMove,INTENT_VERSION}=await load('ai/intent');
if(report.intent){assert.equal(report.intent.version,INTENT_VERSION);assert.equal(report.intent.sourceSha256,hash(await fs.readFile('lib/ai/intent.ts')));}
const styleBytes=v.style?await fs.readFile(v.style):null,style=styleBytes?validateStyleModel(JSON.parse(styleBytes)):null;
assert.equal(!!style,!!report.style,'Saved style requires its exact model');if(styleBytes)assert.equal(hash(styleBytes),report.style.modelSha256);
const config=c=>{if(!c)return null;assert.equal(c.version,SEARCH_VERSION);const {version,...options}=c;return options;};
const search=config(report.search),baselineSearch=config(report.baselineSearch),strategies=Object.keys(STRATEGIES);
assert.equal(report.results.filter(r=>r.status==='aborted').length,0,'Aborted games require separate failure analysis');
const expectedIds=new Set(report.results.map(r=>r.gameId));assert.equal(expectedIds.size,report.results.length);
assert.ok(events.every(e=>expectedIds.has(e.gameId)));
let decisions=0,results=0;
for(const r of report.results){
 let game=newGame(),seenResult=false;
 const agents=Object.fromEntries(['blue','red'].map((color,c)=>[color,{model:color===r.candidateColor?candidate:baseline,options:color===r.candidateColor?search:baselineSearch,random:seededRandom(report.seed+r.pair*101+strategies.indexOf(r.strategy)*10007+c*37)}]));
 for(const e of events.filter(e=>e.gameId===r.gameId)){
  assert.equal(seenResult,false,'Event after final result');
  if(e.kind==='decision'){
   assert.deepEqual(e,recordDecision(r.gameId,game,r.strategy,e.chosenMove,'local',null));
   const a=agents[game.turn],chosen=game.turn===r.candidateColor&&style?(report.intent?chooseIntentMove(game,r.strategy,a.model,style,{...report.intent.options,search:a.options||{}},report.epsilon,a.random):chooseStyledMove(game,r.strategy,a.model,style,{...report.style.options,search:a.options||{}},report.epsilon,a.random)):a.options?chooseSearchMove(game,r.strategy,a.model,a.options,report.epsilon,a.random):chooseLocalMove(game,r.strategy,a.model,report.epsilon,a.random);
   assert.equal(moveId(e.chosenMove),moveId(chosen));game=applyMove(game,chosen);decisions++;
  }else{
   assert.equal(e.kind,'result');const status=game.ended?'completed':'truncated';
   assert.deepEqual(e,recordResult(r.gameId,game,status));
   for(const [key,value] of Object.entries(e.result))assert.deepEqual(r[key],value);
   assert.equal(r.points,status==='completed'?(r.winner===r.candidateColor?1:r.winner===null?.5:0):null);
   seenResult=true;results++;
  }
 }
 assert.ok(seenResult);
}
const evidence={datasetSha256:hash(bytes),candidateSha256:hash(cb),baselineSha256:hash(bb),styleSha256:styleBytes?hash(styleBytes):null,searchVersion:SEARCH_VERSION,games:results,decisions,allStatesChoicesAndOutcomesReproduced:true,paidCalls:0};
if(report.intent)evidence.intent=report.intent;
await atomicJSON(v.out||v.run+'-integrity.json',evidence);console.log(JSON.stringify(evidence));
