import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {prepareLocalAgent} from '../scripts/ai/local-agent.mjs';
import {loadModules} from '../scripts/ai/modules.mjs';
const modelPath='experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json',stylePath='experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json';
const load=await loadModules(),{newGame,applyMove,legalMoves,moveId}=await load('game/rules'),{seededRandom,chooseLocalMove}=await load('ai/policy'),{chooseSearchMove}=await load('ai/search'),{chooseIntentMove}=await load('ai/intent'),{STRATEGIES}=await load('game/strategies');
const model=JSON.parse(await fs.readFile(modelPath)),style=JSON.parse(await fs.readFile(stylePath));
test('collector adapter preserves linear/search/hybrid choices and seeded randomness',async()=>{
 const configs=[{}, {search:{}}, {stylePath,intent:{strength:0,margin:1}},{stylePath,intent:{strength:1,margin:1}}];
 const positions=[];let game=newGame();const random=seededRandom(912);for(let ply=0;ply<30;ply++){if(ply%10===0)positions.push(game);const moves=legalMoves(game);game=applyMove(game,moves[Math.floor(random()*moves.length)]);}
 for(const config of configs){const agent=await prepareLocalAgent({modelPath,...config,epsilon:.2});for(const strategy of Object.keys(STRATEGIES)){const a=seededRandom(919),b=seededRandom(919);for(const g of positions){const expected=config.intent?chooseIntentMove(g,strategy,model,style,{...config.intent,search:{}},.2,b):config.search?chooseSearchMove(g,strategy,model,{},.2,b):chooseLocalMove(g,strategy,model,.2,b);assert.equal(moveId(agent.choose(g,strategy,a)),moveId(expected));}}
  assert.match(agent.metadata.modelSha256,/^[a-f0-9]{64}$/);if(config.intent){assert.equal(agent.metadata.intent.authored,true);assert.equal(agent.metadata.intent.learnedStyleWeight,.5);assert.ok(agent.metadata.sourceHashes['lib/ai/intent.ts']);assert.match(agent.metadata.styleSha256,/^[a-f0-9]{64}$/);}
 }
});
test('collector rejects invalid hybrid configuration before budget or network work',async()=>{
 for(const config of [{intent:{}},{stylePath},{stylePath,intent:{strength:3}},{stylePath,intent:{margin:2}},{stylePath,intent:{search:{}}},{search:[]},{search:{unknown:1}},{epsilon:NaN}])await assert.rejects(prepareLocalAgent({modelPath,...config}));
});
test('collector dry-run records exact hybrid and neither opens ledger nor creates output',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'territori-dry-'));
 try{
  const output=path.join(tmp,'never-created'),args=['scripts/ai/collect.mjs','--run-id','offline-test','--out',output,'--ledger',path.join(tmp,'missing-ledger.json'),'--teacher-url','https://example.invalid/api/robot','--source-commit','test-source','--mode','local-vs-jev','--model',modelPath,'--style',stylePath,'--intent','{"strength":1,"margin":1}','--games','10','--seed','2413','--dry-run'];
  const result=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const report=JSON.parse(result.stdout);assert.equal(report.paidCalls,0);assert.equal(report.budgetValidated,false);assert.equal(report.provenance.localAgent.kind,'learned-search-style-authored-intent');assert.equal(report.provenance.localAgent.intent.strength,1);assert.equal(report.provenance.matchups.length,10);await assert.rejects(fs.stat(output));
  const i=args.indexOf('--intent')+1;args[i]='null';const bad=spawnSync(process.execPath,args,{encoding:'utf8'});assert.notEqual(bad.status,0);await assert.rejects(fs.stat(output));
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
test('metered-batch verifier replays hybrid choices and rejects changed provenance (mock teacher, no API)',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'territori-replay-'));
 try{
  const {recordDecision,recordResult}=await load('ai/dataset'),agent=await prepareLocalAgent({modelPath,stylePath,intent:{strength:1,margin:1},epsilon:.03});
  const gameId='mock:0',events=[],journal=[],random=seededRandom(53);let game=newGame(),calls=0;
  for(let i=0;i<12;i++){
   const local=game.turn==='blue',move=local?agent.choose(game,'Fluid',random):legalMoves(game)[0];
   const teacher=local?null:{model:'jev-1.13.0',answer:{choice:moveId(move)},usage:{input_tokens:100,output_tokens:1}};
   events.push(recordDecision(gameId,game,'Fluid',move,local?'local':'jev',teacher));
   if(teacher){calls++;journal.push({kind:'request',call:calls,context:{gameId,turnNumber:game.ply+1,strategy:'Fluid',player:game.turn}},{kind:'usage',call:calls,usage:teacher.usage,model:teacher.model,costNano:4200});}
   game=applyMove(game,move);
  }events.push(recordResult(gameId,game));
  const provenance={runId:'mock',seed:53,mode:'local-vs-jev',epsilon:.03,localAgent:agent.metadata,matchups:[{blue:'Fluid',red:'Fluid'}]};
  await fs.writeFile(path.join(tmp,'decisions.jsonl.gz'),gzipSync(events.map(e=>JSON.stringify(e)).join('\n')));await fs.writeFile(path.join(tmp,'usage.jsonl.gz'),gzipSync(journal.map(e=>JSON.stringify(e)).join('\n')));
  await fs.writeFile(path.join(tmp,'summary.json'),JSON.stringify({uncertain:false,completed:0,truncated:1,calls,spentUpperNano:calls*4200,inputTokens:calls*100,outputTokens:calls}));await fs.writeFile(path.join(tmp,'provenance.json'),JSON.stringify(provenance));
  const args=['scripts/ai/verify-session.mjs','--run',tmp,'--model',modelPath,'--style',stylePath],result=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const report=JSON.parse(await fs.readFile(path.join(tmp,'integrity.json')));assert.equal(report.localPolicy.choicesReplayed,6);assert.equal(report.localPolicy.exact,true);
  provenance.localAgent.intent.version=999;await fs.writeFile(path.join(tmp,'provenance.json'),JSON.stringify(provenance));const changed=spawnSync(process.execPath,args,{encoding:'utf8'});assert.notEqual(changed.status,0,'Changed implementation version must not claim exact replay');
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
