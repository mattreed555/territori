import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {prepareLocalAgent} from '../scripts/ai/local-agent.mjs';
import {loadModules} from '../scripts/ai/modules.mjs';
import {pipelineHashes,validateProtocol,checkAcceptance,checkAcceptanceReservation,summarizeAcceptance} from '../scripts/ai/acceptance.mjs';
const modelPath='experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json',stylePath='experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json';
const agent=await prepareLocalAgent({modelPath,stylePath,intent:{strength:1,margin:1}});
const load=await loadModules(),{RULESET}=await load('ai/dataset'),{trainPolicy}=await load('ai/training'),{trainStyle}=await load('ai/style-training');
const names=['Aggressive','Cautious','Expansive','Fluid','Balanced'];
const base={version:1,status:'sealed',id:'test-acceptance',candidateSourceCommit:'1'.repeat(40),sealedAt:'2026-01-01T00:00:00Z',targets:{completed:200,perStrategy:40,perStrategyColor:20,overallScore:.5,perStrategyScore:.4},capNano:3250000000,maxTurns:160,teacherModel:'jev-1.13.0',teacherEndpoint:'https://territori.matthew-l-reed.chatgpt.site/api/robot',ruleset:RULESET,handling:'all-attempts-reported-no-retries-no-refits-no-retrospective-relabel',candidate:agent.metadata,pipelineHashes:await pipelineHashes(),batches:Array.from({length:10},(_,i)=>({runId:`acceptance-${i}`,games:20,seed:260925000+i*1000,capNano:400000000}))};
const provenance={runId:base.batches[0].runId,mode:'local-vs-jev',seed:base.batches[0].seed,sourceCommit:'2'.repeat(40),startedAt:'2026-09-24T13:00:00Z',ruleset:RULESET,maxTurns:160,teacherEndpoint:base.teacherEndpoint,localAgent:agent.metadata,epsilon:.03,promptSha256:base.pipelineHashes['lib/game/jev.ts'],strategiesSha256:base.pipelineHashes['lib/game/strategies.ts'],matchups:Array.from({length:20},(_,i)=>({blue:names[i%5],red:names[i%5]}))};
test('protocol rejects changed gates, duplicate batches and overlapping random streams',()=>{
 assert.equal(validateProtocol(base),base);
 for(const change of [p=>p.targets.perStrategy=20,p=>p.batches[1].runId=p.batches[0].runId,p=>p.batches[1].seed=p.batches[0].seed+19,p=>p.candidate.epsilon=.1,p=>p.capNano=4250000000]){const p=structuredClone(base);change(p);assert.throws(()=>validateProtocol(p));}
});
test('acceptance preflight seals exact candidate, code, seeds, endpoint and color schedule',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'territori-protocol-')),file=path.join(tmp,'protocol.json');
 try{
  await fs.writeFile(file,JSON.stringify(base));const checked=await checkAcceptance(file,provenance);assert.equal(checked.metadata.games,20);
  for(const change of [p=>p.seed++,p=>p.localAgent.intent.strength=0,p=>p.teacherEndpoint='https://example.invalid',p=>p.matchups[0].red='Fluid',p=>p.startedAt='2025-01-01T00:00:00Z']){const p=structuredClone(provenance);change(p);await assert.rejects(checkAcceptance(file,p));}
  const tampered=structuredClone(base);tampered.pipelineHashes['lib/game/jev.ts']='0'.repeat(64);await fs.writeFile(file,JSON.stringify(tampered));await assert.rejects(checkAcceptance(file,provenance));
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
test('acceptance budget enforces protocol totals, order, purpose and unresolved charges',()=>{
 const metadata={sha256:'a'.repeat(64),runId:base.batches[0].runId},acceptance={protocol:base,metadata};
 const session={id:metadata.runId,status:'reserved',purpose:'evaluation',protocolSha256:metadata.sha256,capNano:400000000};
 assert.equal(checkAcceptanceReservation({sessions:[session]},acceptance).spentBeforeNano,0);
 for(const s of [{...session,purpose:'training'},{...session,protocolSha256:'wrong'},{...session,capNano:400000001}])assert.throws(()=>checkAcceptanceReservation({sessions:[s]},acceptance));
 const second={protocol:base,metadata:{...metadata,runId:base.batches[1].runId}},next={...session,id:second.metadata.runId};
 assert.throws(()=>checkAcceptanceReservation({sessions:[next]},second));
 const prior={...session,status:'closed',uncertain:false,spentUpperNano:300000000};assert.equal(checkAcceptanceReservation({sessions:[prior,next]},second).spentBeforeNano,300000000);
 assert.throws(()=>checkAcceptanceReservation({sessions:[{...prior,uncertain:true},next]},second));
 assert.throws(()=>checkAcceptanceReservation({sessions:[{...prior,spentUpperNano:3000000000},next]},second));
});
test('collector acceptance dry run never opens budget/output and failures cannot be relabeled',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'territori-accept-dry-')),file=path.join(tmp,'protocol.json'),out=path.join(tmp,'missing');
 try{
  await fs.writeFile(file,JSON.stringify(base));
  const args=['scripts/ai/collect.mjs','--protocol',file,'--run-id',base.batches[0].runId,'--out',out,'--ledger',path.join(tmp,'no-ledger'),'--teacher-url',base.teacherEndpoint,'--source-commit','2'.repeat(40),'--mode','local-vs-jev','--model',modelPath,'--style',stylePath,'--intent','{"strength":1,"margin":1}','--games','20','--seed',String(base.batches[0].seed),'--dry-run'];
  const r=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.paidCalls,0);assert.equal(report.budgetValidated,false);assert.equal(report.provenance.purpose,'independent-acceptance');await assert.rejects(fs.stat(out));
  args[args.indexOf('--seed')+1]='2414';const bad=spawnSync(process.execPath,args,{encoding:'utf8'});assert.notEqual(bad.status,0);await assert.rejects(fs.stat(out));
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
test('strength gate requires every verified game/color and never claims deployment readiness',()=>{
 const batches=base.batches.map(b=>({runId:b.runId,verified:true,failure:null,results:Array.from({length:20},(_,i)=>({gameId:`${b.runId}:${i}`,strategy:names[i%5],localColor:Math.floor(i/5)%2?'red':'blue',winner:null,status:'completed',reason:'supply',turns:50}))}));
 const r=summarizeAcceptance(base,batches);assert.equal(r.overall.score,.5);assert.equal(r.complete,true);assert.equal(r.strengthPass,true);assert.equal(r.readyForDeployment,false);
 assert.equal(summarizeAcceptance(base,batches.slice(0,1)).strengthPass,false);
 const unverified=structuredClone(batches);unverified[0].verified=false;assert.equal(summarizeAcceptance(base,unverified).strengthPass,false);
 const losing=structuredClone(batches);for(const b of losing)for(const r of b.results)if(r.strategy==='Fluid')r.winner=r.localColor==='red'?'blue':'red';assert.equal(summarizeAcceptance(base,losing).strengthPass,false);
 const failed=structuredClone(batches);failed[0].results[0].status='aborted';const f=summarizeAcceptance(base,failed);assert.equal(f.overall.aborted,1);assert.equal(f.complete,false);
 assert.throws(()=>summarizeAcceptance(base,[batches[0],batches[0]]));
});
test('tagged independent decisions cannot train linear or residual policies',()=>{
 assert.throws(()=>trainPolicy([{evaluationProtocol:'sealed',source:'jev'}]),/evaluation-only/);
 assert.throws(()=>trainStyle([{decision:{evaluationProtocol:'sealed'}}],[]),/cannot train/);
});
