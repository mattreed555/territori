// Reconcile every paid call, quantify repeat noise, fit only predeclared pass zero.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON,chargeForUsage} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['dir','old-probes','policy','style'].map(k=>[k,{type:'string'}]))});
if(Object.values(v).length!==4)throw Error('Use --dir DIRECTORY --old-probes LABELS.gz --policy POLICY --style STYLE');
const load=await loadModules(),{newGame,applyMove,moveId}=await load('game/rules'),{recordRepeatedCounterfactual}=await load('ai/repeated-probe'),{teacherTargets}=await load('ai/training'),{trainStyle}=await load('ai/style-training'),{validateStyleModel,rankStyledMoves}=await load('ai/style'),{validateModel}=await load('ai/policy'),{STRATEGIES}=await load('game/strategies'),{moveFeatures}=await load('ai/features');
const hashes={},hash=b=>createHash('sha256').update(b).digest('hex');
async function read(file,jsonl=false){const b=await fs.readFile(file);hashes[file]=hash(b);const raw=file.endsWith('.gz')?gunzipSync(b).toString():b.toString();return jsonl?raw.trim().split('\n').map(JSON.parse):JSON.parse(raw);}
const {positions,testGroupIds:newTest}=await read(`${v.dir}/positions.json`),traces=await read(`${v.dir}/random-traces.jsonl.gz`,true),wrappers=await read(`${v.dir}/probe/labels.jsonl.gz`,true),journal=await read(`${v.dir}/probe/usage.jsonl.gz`,true),summary=await read(`${v.dir}/probe/summary.json`);
const oldProbes=await read(v['old-probes'],true),policy=validateModel(await read(v.policy)),oldStyle=validateStyleModel(await read(v.style)),strategies=Object.keys(STRATEGIES);
for(const p of positions){const trace=traces.find(t=>t.id===p.groupId);assert.ok(trace);let g=newGame();for(const m of trace.moves.slice(0,p.state.ply))g=applyMove(g,m);assert.deepEqual(g,p.state);}
const requests=journal.filter(e=>e.kind==='request'),usage=journal.filter(e=>e.kind==='usage');
assert.equal(summary.uncertain,false);assert.equal(summary.failure,null);assert.equal(wrappers.length,120);assert.equal(requests.length,120);assert.equal(usage.length,120);assert.equal(journal.filter(e=>e.kind==='uncertain').length,0);
let costNano=0,inputTokens=0,outputTokens=0;const seen=new Set(),distributions=new Map();
for(const [i,w] of wrappers.entries()){
 const d=w.label.decision,p=positions.find(p=>p.id===w.label.positionId);assert.ok(p);assert.deepEqual(w,recordRepeatedCounterfactual(p,d.strategy,d.chosenMove,d.teacher,w.repeat));assert.ok(!seen.has(w.id));seen.add(w.id);
 assert.equal(requests[i].call,i+1);assert.equal(usage[i].call,i+1);assert.deepEqual(requests[i].context,{positionId:p.id,groupId:p.groupId,strategy:d.strategy,player:p.state.turn,repeat:w.repeat});
 assert.equal(moveId(d.chosenMove),d.teacher.answer.choice);assert.deepEqual(usage[i].usage,d.teacher.usage);assert.equal(usage[i].model,d.teacher.model);assert.equal(usage[i].costNano,chargeForUsage(d.teacher));
 costNano+=usage[i].costNano;inputTokens+=usage[i].usage.input_tokens;outputTokens+=usage[i].usage.output_tokens;distributions.set(w.id,teacherTargets(d,1));
}
assert.equal(summary.calls,120);assert.equal(summary.spentUpperNano,costNano);assert.equal(summary.inputTokens,inputTokens);assert.equal(summary.outputTokens,outputTokens);
const tv=(a,b)=>a.reduce((s,p,i)=>s+Math.abs(p-b[i]),0)/2,lookup=(id,s,r)=>wrappers.find(w=>w.label.positionId===id&&w.label.decision.strategy===s&&w.repeat===r),mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
const repeatRows=positions.flatMap(p=>strategies.map(s=>{const a=lookup(p.id,s,0),b=lookup(p.id,s,1);assert.ok(a&&b);return {positionId:p.id,strategy:s,choiceChanged:moveId(a.label.decision.chosenMove)!==moveId(b.label.decision.chosenMove),tv:tv(distributions.get(a.id),distributions.get(b.id))};}));
const between=[];for(let a=0;a<5;a++)for(let b=a+1;b<5;b++){
 const rows=positions.map(p=>{const x=lookup(p.id,strategies[a],0),y=lookup(p.id,strategies[b],0);return {different:moveId(x.label.decision.chosenMove)!==moveId(y.label.decision.chosenMove),tv:tv(distributions.get(x.id),distributions.get(y.id))};});
 between.push({a:strategies[a],b:strategies[b],positions:rows.length,different:rows.filter(r=>r.different).length,meanTV:mean(rows.map(r=>r.tv))});
}
const teacher=Object.fromEntries(strategies.map(s=>{const ws=wrappers.filter(w=>w.label.decision.strategy===s);return [s,{responses:ws.length,types:Object.fromEntries(['place','remove','shift'].map(t=>[t,ws.filter(w=>w.label.decision.chosenMove.type===t).length])),meanShiftProbability:mean(ws.map(w=>w.label.decision.legalMoves.reduce((n,m,i)=>n+(m.type==='shift'?distributions.get(w.id)[i]:0),0))),repeatChoiceChanges:repeatRows.filter(r=>r.strategy===s&&r.choiceChanged).length,repeatMeanTV:mean(repeatRows.filter(r=>r.strategy===s).map(r=>r.tv))}];}));
const probes=[...oldProbes,...wrappers.filter(w=>w.repeat===0).map(w=>w.label)],testGroupIds=[...oldStyle.training.testGroupIds,...newTest],test=new Set(testGroupIds);
assert.equal(new Set(probes.map(p=>p.positionId)).size,32);assert.equal(testGroupIds.length,test.size);assert.ok(testGroupIds.every(g=>!policy.training.trainGameIds.includes(g)));
const model=trainStyle(probes,testGroupIds,{ridge:.1});await atomicJSON(`${v.dir}/style-ridge-0.1.json`,model);
const models={base:null,previous:oldStyle,refit:model},measures=['ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','place','remove','shift'],rows=[];
for(const [name,style] of Object.entries(models))for(const p of probes){
 const d=p.decision,r=rankStyledMoves(d.state,d.strategy,policy,style||oldStyle,{weight:style?.5:0,margin:1}),move=r.ranked[0].move;
 rows.push({model:name,positionId:p.positionId,groupId:p.groupId,domain:positions.some(x=>x.id===p.positionId)?'targeted-shift':'original',heldOut:test.has(p.groupId),strategy:d.strategy,teacher:moveId(d.chosenMove),local:moveId(move),teacherType:d.chosenMove.type,localType:move.type,rank:r.policyOrder.findIndex(m=>moveId(m)===moveId(d.chosenMove))+1,teacherFeatures:moveFeatures(d.state,d.chosenMove,measures),localFeatures:moveFeatures(d.state,move,measures)});
}
const summarize=rs=>({states:rs.length,agreement:mean(rs.map(r=>Number(r.teacher===r.local))),meanRank:mean(rs.map(r=>r.rank))});
const evaluation={};for(const name of Object.keys(models)){
 const selected=rows.filter(r=>r.model===name&&r.heldOut);
 const ids=[...new Set(selected.map(r=>r.positionId))],pairs=[];
 for(let a=0;a<5;a++)for(let b=a+1;b<5;b++){const pairsAt=ids.map(id=>[a,b].map(i=>selected.find(r=>r.positionId===id&&r.strategy===strategies[i])));pairs.push({a:strategies[a],b:strategies[b],positions:ids.length,localDifferent:pairsAt.filter(([x,y])=>x.local!==y.local).length});}
 evaluation[name]={...summarize(selected),byDomain:Object.fromEntries(['original','targeted-shift'].map(d=>[d,summarize(selected.filter(r=>r.domain===d))])),byStrategy:Object.fromEntries(strategies.map(s=>[s,{...summarize(selected.filter(r=>r.strategy===s)),localShifts:selected.filter(r=>r.strategy===s&&r.localType==='shift').length,teacherShifts:selected.filter(r=>r.strategy===s&&r.teacherType==='shift').length,localFeatureMeans:Object.fromEntries(measures.map((f,j)=>[f,mean(selected.filter(r=>r.strategy===s).map(r=>r.localFeatures[j]))]))}])),byTeacherType:Object.fromEntries(['place','remove','shift'].map(t=>[t,summarize(selected.filter(r=>r.teacherType===t))])),pairs};
}
for(const f of ['scripts/ai/analyze-repeat-probe.mjs','lib/ai/repeated-probe.ts','lib/ai/style-training.ts','lib/ai/style.ts','lib/ai/search.ts'])hashes[f]=hash(await fs.readFile(f));
await fs.writeFile(`${v.dir}/choices.json.gz`,gzipSync(JSON.stringify(rows)));
await atomicJSON(`${v.dir}/analysis.json`,{purpose:'DEVELOPMENT targeted shifts and repeat controls; not acceptance or representative action frequencies',hashes,integrity:{labels:120,positions:12,positionsReplayed:true,usageAndChoicesReconciled:true,costNano,inputTokens,outputTokens,finalResultsInvented:0},teacher,repeatRows,betweenStrategies:between,split:{passUsedForTraining:0,trainPositions:model.training.positions,testPositions:12,testGroupIds},configuration:{ridge:.1,weight:.5,margin:1},compressedStyleBytes:gzipSync(JSON.stringify(model)).length,evaluation});
console.log(JSON.stringify({integrity:{costNano,inputTokens,outputTokens},teacher,evaluation}));
