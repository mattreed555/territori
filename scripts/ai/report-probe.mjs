import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON,chargeForUsage} from './budget.mjs';
const {values:v}=parseArgs({options:{run:{type:'string'},positions:{type:'string'},model:{type:'string'}}});
if(!v.run||!v.positions||!v.model)throw Error('Use --run directory --positions positions.json.gz --model policy.json');
const load=await loadModules(),{STRATEGIES}=await load('game/strategies'),{recordCounterfactual}=await load('ai/counterfactual'),{moveFeatures}=await load('ai/features'),{teacherTargets}=await load('ai/training'),{validateModel}=await load('ai/policy'),{rankSearchMoves}=await load('ai/search'),{moveId}=await load('game/rules');
const positions=JSON.parse(gunzipSync(await fs.readFile(v.positions))).positions;
const lines=async file=>gunzipSync(await fs.readFile(file)).toString().trim().split('\n').map(JSON.parse);
const labels=await lines(`${v.run}/labels.jsonl.gz`),journal=await lines(`${v.run}/usage.jsonl.gz`),summary=JSON.parse(await fs.readFile(`${v.run}/summary.json`));
const model=validateModel(JSON.parse(await fs.readFile(v.model))),strategies=Object.keys(STRATEGIES),features=['territoryGain','opponentTerritoryLost','ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','place','remove','shift'];
const requests=journal.filter(e=>e.kind==='request'),usage=journal.filter(e=>e.kind==='usage');
assert.equal(summary.uncertain,false);assert.equal(journal.filter(e=>e.kind==='uncertain').length,0);assert.equal(labels.length,usage.length);assert.equal(labels.length,requests.length);
let cost=0,input=0,output=0;const checked=[],seen=new Set();
for(const [i,label] of labels.entries()){
 const p=positions.find(p=>p.id===label.positionId),d=label.decision,q=requests[i],u=usage[i];assert.ok(p);
 assert.deepEqual(label,recordCounterfactual(p,d.strategy,d.chosenMove,d.teacher));assert.equal(d.finalResult,null);
 const id=p.id+'@'+d.strategy;assert.ok(!seen.has(id));seen.add(id);
 assert.equal(q.call,i+1);assert.equal(u.call,i+1);assert.deepEqual(q.context,{positionId:p.id,groupId:p.groupId,strategy:d.strategy,player:p.state.turn});
 assert.equal(moveId(d.chosenMove),d.teacher.answer.choice);assert.deepEqual(u.usage,d.teacher.usage);assert.equal(u.model,d.teacher.model);assert.equal(u.costNano,chargeForUsage(d.teacher));cost+=u.costNano;input+=u.usage.input_tokens;output+=u.usage.output_tokens;
 const probabilities=teacherTargets(d,1),search=rankSearchMoves(p.state,d.strategy,model),local=search.ranked[0].move;
 const expected=features.map(()=>0);d.legalMoves.forEach((m,i)=>moveFeatures(p.state,m,features).forEach((x,j)=>expected[j]+=x*probabilities[i]));
 checked.push({positionId:p.id,groupId:p.groupId,category:p.category,strategy:d.strategy,teacher:moveId(d.chosenMove),local:moveId(local),type:d.chosenMove.type,features:moveFeatures(p.state,d.chosenMove,features),expectedFeatures:expected,localFeatures:moveFeatures(p.state,local,features),probabilities,policyRank:search.policyOrder.findIndex(m=>moveId(m)===moveId(d.chosenMove))+1});
}
assert.equal(cost,summary.spentUpperNano);assert.equal(input,summary.inputTokens);assert.equal(output,summary.outputTokens);assert.equal(labels.length,summary.calls);
const complete=positions.filter(p=>strategies.every(s=>seen.has(p.id+'@'+s))),rows=checked.filter(r=>complete.some(p=>p.id===r.positionId));
const mean=(rs,field)=>Object.fromEntries(features.map((name,j)=>[name,rs.reduce((s,r)=>s+r[field][j],0)/rs.length]));
const byStrategy=Object.fromEntries(strategies.map(strategy=>{const rs=rows.filter(r=>r.strategy===strategy);return [strategy,{positions:rs.length,agreement:rs.filter(r=>r.teacher===r.local).length/rs.length,meanPolicyRank:rs.reduce((s,r)=>s+r.policyRank,0)/rs.length,chosenTypes:Object.fromEntries(['place','remove','shift'].map(t=>[t,rs.filter(r=>r.type===t).length])),teacherMean:mean(rs,'features'),teacherProbabilityWeightedMean:mean(rs,'expectedFeatures'),localMean:mean(rs,'localFeatures')}];}));
const pairwise=[];for(let a=0;a<strategies.length;a++)for(let b=a+1;b<strategies.length;b++){
 const pairs=complete.map(p=>[rows.find(r=>r.positionId===p.id&&r.strategy===strategies[a]),rows.find(r=>r.positionId===p.id&&r.strategy===strategies[b])]);
 pairwise.push({a:strategies[a],b:strategies[b],positions:pairs.length,teacherDifferent:pairs.filter(([a,b])=>a.teacher!==b.teacher).length,localDifferent:pairs.filter(([a,b])=>a.local!==b.local).length,meanTeacherTotalVariation:pairs.reduce((s,[a,b])=>s+a.probabilities.reduce((n,p,i)=>n+Math.abs(p-b.probabilities[i]),0)/2,0)/pairs.length});
}
await atomicJSON(`${v.run}/analysis.json`,{purpose:'Common-state DEVELOPMENT probe, not match outcomes or acceptance',limitations:['Targeted twenty-position sample, not representative frequency estimates','One teacher response per strategy/state; no repeated same-strategy control for provider noise','Shift sampling proxy does not prove long-term optimality','All future splits must group source groupId, not strategy-specific decision.gameId'],integrity:{labels:labels.length,completePositions:complete.length,inputTokens:input,freeOutputTokens:output,costNano:cost,allUsageAndChoicesVerified:true,finalResultsInvented:0},byStrategy,pairwise,rows});
console.log(JSON.stringify({completePositions:complete.length,costNano:cost,types:Object.fromEntries(strategies.map(s=>[s,byStrategy[s].chosenTypes])),pairwise}));
