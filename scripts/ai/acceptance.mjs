// Predeclared, immutable evaluation constraints. No network or ledger writes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const ACCEPTANCE_PIPELINE=['docs/jev-replacement-goal.md','scripts/ai/collect.mjs','scripts/ai/acceptance.mjs','scripts/ai/budget.mjs','scripts/ai/local-agent.mjs','scripts/ai/modules.mjs','scripts/ai/verify-session.mjs','scripts/ai/report-acceptance.mjs','lib/ai/simulator.ts','lib/ai/dataset.ts','lib/game/jev.ts','lib/game/strategies.ts'];
export const STRATEGY_NAMES=['Aggressive','Cautious','Expansive','Fluid','Balanced'];
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export async function pipelineHashes(){return Object.fromEntries(await Promise.all(ACCEPTANCE_PIPELINE.map(async p=>[p,sha256(await fs.readFile(p))])));}
export function validateProtocol(p){
 assert.equal(p?.version,1,'Unsupported acceptance protocol');assert.equal(p.status,'sealed');
 assert.match(p.id,/^[a-z0-9-]+$/);assert.match(p.candidateSourceCommit,/^[a-f0-9]{40}$/);
 assert.ok(Number.isFinite(Date.parse(p.sealedAt)),'Invalid seal time');
 assert.deepEqual(p.targets,{completed:200,perStrategy:40,perStrategyColor:20,overallScore:.5,perStrategyScore:.4});
 assert.equal(p.maxTurns,160);assert.equal(p.teacherModel,'jev-1.13.0');
 assert.equal(p.teacherEndpoint,'https://territori.matthew-l-reed.chatgpt.site/api/robot');
 assert.equal(p.handling,'all-attempts-reported-no-retries-no-refits-no-retrospective-relabel');
 assert.ok(Number.isSafeInteger(p.capNano)&&p.capNano>0&&p.capNano<=3250000000);
 assert.equal(p.candidate?.kind,'learned-search-style-authored-intent');assert.equal(p.candidate.epsilon,.03);
 assert.equal(p.batches?.length,10);const ids=new Set(),seeds=new Set();
 for(const b of p.batches){
  assert.match(b.runId,/^[a-z0-9-]+$/);assert.ok(!ids.has(b.runId),'Duplicate batch');ids.add(b.runId);
  assert.equal(b.games,20);assert.ok(Number.isSafeInteger(b.seed)&&b.seed>=0&&b.seed+19<2**32);
  assert.ok(Number.isSafeInteger(b.capNano)&&b.capNano>0&&b.capNano<=400000000);
  for(let i=0;i<b.games;i++){assert.ok(!seeds.has(b.seed+i),'Overlapping local random streams');seeds.add(b.seed+i);}
 }
 for(const file of ACCEPTANCE_PIPELINE)assert.match(p.pipelineHashes?.[file]||'',/^[a-f0-9]{64}$/);
 return p;
}
export async function checkAcceptance(file,provenance){
 const bytes=await fs.readFile(file),p=validateProtocol(JSON.parse(bytes)),protocolSha256=sha256(bytes);
 const b=p.batches.find(b=>b.runId===provenance.runId);assert.ok(b,'Batch not in sealed schedule');
 assert.equal(provenance.mode,'local-vs-jev');assert.equal(provenance.seed,b.seed);assert.equal(provenance.matchups.length,b.games);
 assert.match(provenance.sourceCommit,/^[a-f0-9]{40}$/);assert.ok(Date.parse(provenance.startedAt)>=Date.parse(p.sealedAt),'Run predates protocol seal');
 assert.equal(provenance.maxTurns,p.maxTurns);assert.equal(provenance.teacherEndpoint,p.teacherEndpoint);
 assert.equal(provenance.ruleset,p.ruleset);assert.deepEqual(provenance.localAgent,p.candidate,'Frozen candidate changed');
 assert.deepEqual(await pipelineHashes(),p.pipelineHashes,'Sealed collection pipeline changed');
 assert.equal(provenance.promptSha256,p.pipelineHashes['lib/game/jev.ts']);assert.equal(provenance.strategiesSha256,p.pipelineHashes['lib/game/strategies.ts']);
 const counts={};provenance.matchups.forEach((m,i)=>{const c=Math.floor(i/5)%2===0?'blue':'red';assert.equal(m.blue,m.red,'Protocol uses same-strategy opponents');assert.ok(STRATEGY_NAMES.includes(m[c]));const k=m[c]+':'+c;counts[k]=(counts[k]||0)+1;});
 for(const s of STRATEGY_NAMES)for(const c of ['blue','red'])assert.equal(counts[s+':'+c],2,'Unbalanced scheduled batch');
 return {protocol:p,metadata:{id:p.id,sha256:protocolSha256,candidateSourceCommit:p.candidateSourceCommit,runId:b.runId,seed:b.seed,games:b.games,capNano:b.capNano}};
}
export function checkAcceptanceReservation(ledger,acceptance){
 const {protocol:p,metadata:m}=acceptance,b=p.batches.find(b=>b.runId===m.runId),session=ledger.sessions.find(s=>s.id===m.runId&&s.status==='reserved');
 assert.ok(session,'No acceptance reservation');assert.equal(session.purpose,'evaluation');assert.equal(session.protocolSha256,m.sha256);
 const prior=ledger.sessions.filter(s=>s.protocolSha256===m.sha256&&s!==session);
 assert.ok(prior.every(s=>s.status==='closed'&&s.uncertain===false),'Prior acceptance usage unresolved');
 assert.ok(!prior.some(s=>s.id===m.runId),'Cannot repeat a scheduled batch');
 assert.ok(prior.every(s=>Number.isSafeInteger(s.spentUpperNano)&&s.spentUpperNano>=0));
 const spent=prior.reduce((n,s)=>n+s.spentUpperNano,0);
 assert.ok(session.capNano<=b.capNano&&spent+session.capNano<=p.capNano,'Protocol budget exceeded');
 // Keep execution chronological, so successful games cannot be cherry-picked.
 const index=p.batches.findIndex(b=>b.runId===m.runId);
 assert.equal(prior.length,index,'Acceptance batches must run once in declared order');
 for(const b of p.batches.slice(0,index))assert.ok(prior.some(s=>s.id===b.runId));
 return {spentBeforeNano:spent,capNano:session.capNano};
}

export function acceptanceStats(rows){
 const done=rows.filter(r=>r.status==='completed'),n=done.length,points=done.reduce((n,r)=>n+(r.winner===r.localColor?1:r.winner===null?.5:0),0),score=n?points/n:null;
 const delta=n?Math.sqrt(Math.log(40)/(2*n)):null;
 return {completed:n,aborted:rows.filter(r=>r.status==='aborted').length,truncated:rows.filter(r=>r.status==='truncated').length,wins:done.filter(r=>r.winner===r.localColor).length,draws:done.filter(r=>r.winner===null).length,losses:done.filter(r=>r.winner!==null&&r.winner!==r.localColor).length,score,conservative95ScoreInterval:n?[Math.max(0,score-delta),Math.min(1,score+delta)]:null,meanTurns:n?done.reduce((n,r)=>n+r.turns,0)/n:null,maxTurns:n?Math.max(...done.map(r=>r.turns)):null,repetitionEnds:done.filter(r=>r.reason==='repetition').length};
}
export function summarizeAcceptance(protocol,batches){
 validateProtocol(protocol);const rows=[],ids=new Set();
 for(const b of batches){assert.ok(protocol.batches.some(p=>p.runId===b.runId));assert.ok(!ids.has(b.runId),'Duplicate batch report');ids.add(b.runId);if(b.verified)rows.push(...b.results);}
 const gameIds=new Set(rows.map(r=>r.gameId));assert.equal(gameIds.size,rows.length,'Duplicate game');
 const overall=acceptanceStats(rows),byStrategy=Object.fromEntries(STRATEGY_NAMES.map(s=>[s,acceptanceStats(rows.filter(r=>r.strategy===s))]));
 const byStrategyColor=Object.fromEntries(STRATEGY_NAMES.map(s=>[s,Object.fromEntries(['blue','red'].map(c=>[c,acceptanceStats(rows.filter(r=>r.strategy===s&&r.localColor===c))]))]));
 const complete=batches.length===10&&batches.every(b=>b.verified&&!b.failure&&b.results.length===20)&&overall.completed===200&&STRATEGY_NAMES.every(s=>byStrategy[s].completed===40&&['blue','red'].every(c=>byStrategyColor[s][c].completed===20));
 const strengthPass=complete&&overall.score>=.5&&STRATEGY_NAMES.every(s=>byStrategy[s].score>=.4);
 return {purpose:'Independent strength gate only; NOT full replacement readiness',protocolId:protocol.id,scheduledGames:200,batchesPresent:batches.length,unverifiedBatches:batches.filter(b=>!b.verified).map(b=>({runId:b.runId,error:b.error})),overall,byStrategy,byStrategyColor,complete,strengthPass,readyForDeployment:false,intervalMethod:'Two-sided Hoeffding bound, mean reward in [0,1], draws=.5; assumes independent runs. Report trajectory/context duplicates separately.',batches};
}
