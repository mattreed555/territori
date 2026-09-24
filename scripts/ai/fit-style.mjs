// Small predeclared ridge/weight grid on saved DEVELOPMENT common-state labels.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['probes','policy','split','out'].map(k=>[k,{type:'string'}]))});
if(Object.values(v).length!==4)throw Error('Use --probes labels.gz --policy policy.json --split comparison.json --out directory');
const load=await loadModules(),{trainStyle}=await load('ai/style-training'),{rankStyledMoves,styleScore}=await load('ai/style'),{rankSearchMoves}=await load('ai/search'),{teacherTargets}=await load('ai/training'),{moveFeatures}=await load('ai/features'),{STRATEGIES}=await load('game/strategies'),{moveId}=await load('game/rules'),{validateModel}=await load('ai/policy');
const hash=b=>createHash('sha256').update(b).digest('hex'),bytes=await fs.readFile(v.probes),probes=gunzipSync(bytes).toString().trim().split('\n').map(JSON.parse),policyBytes=await fs.readFile(v.policy),policy=validateModel(JSON.parse(policyBytes));
const split=JSON.parse(await fs.readFile(v.split)),groups=new Set(probes.map(p=>p.groupId)),testGroupIds=split.split.testGroups.filter(id=>groups.has(id)),test=new Set(testGroupIds);
if(testGroupIds.some(g=>policy.training.trainGameIds.includes(g)))throw Error('Base policy has seen a proposed style holdout group');
const strategies=Object.keys(STRATEGIES),positions=[...new Set(probes.map(p=>p.positionId))],measures=['ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','place','remove','shift'];
await fs.mkdir(v.out,{recursive:true});
const results=[],allChoices=[];
const baselineRows=probes.map(p=>{const d=p.decision,t=performance.now(),r=rankSearchMoves(d.state,d.strategy,policy);return {heldOut:test.has(p.groupId),matches:moveId(r.ranked[0].move)===moveId(d.chosenMove),rank:r.policyOrder.findIndex(m=>moveId(m)===moveId(d.chosenMove))+1,ms:performance.now()-t};});
const baseline=Object.fromEntries([false,true].map(heldOut=>{const rows=baselineRows.filter(r=>r.heldOut===heldOut),times=rows.map(r=>r.ms).sort((a,b)=>a-b);return [heldOut?'heldOut':'train',{states:rows.length,agreement:rows.filter(r=>r.matches).length/rows.length,rank:rows.reduce((s,r)=>s+r.rank,0)/rows.length,p95ms:times[Math.ceil(.95*times.length)-1],maxMs:times.at(-1)}];}));
for(const ridge of [.01,.1,1]){
 const style=trainStyle(probes,testGroupIds,{ridge});await atomicJSON(`${v.out}/style-ridge-${ridge}.json`,style);
 const contrasts=[];
 for(const id of positions){
  const rows=strategies.map(s=>probes.find(p=>p.positionId===id&&p.decision.strategy===s)),d=rows[0].decision;
  const logits=rows.map(p=>teacherTargets(p.decision,1).map(x=>Math.log(Math.max(x,style.training.probabilityFloor))));
  for(const a of logits){const m=a.reduce((s,x)=>s+x,0)/a.length;a.forEach((_,i)=>a[i]-=m);}
  for(let s=0;s<strategies.length;s++){
   const target=logits[s].map((x,i)=>x-logits.reduce((n,a)=>n+a[i],0)/logits.length),predicted=d.legalMoves.map(m=>styleScore(d.state,m,strategies[s],style)),center=predicted.reduce((a,b)=>a+b,0)/predicted.length;
   contrasts.push({positionId:id,heldOut:test.has(rows[0].groupId),strategy:strategies[s],mse:target.reduce((n,y,i)=>n+(predicted[i]-center-y)**2,0)/target.length,zeroMse:target.reduce((n,y)=>n+y*y,0)/target.length});
  }
 }
 for(const weight of [.5,1,2]){
  const rows=[];for(const p of probes){const d=p.decision,t0=performance.now(),out=rankStyledMoves(d.state,d.strategy,policy,style,{weight,margin:1}),ms=performance.now()-t0,move=out.ranked[0].move;
   rows.push({positionId:p.positionId,groupId:p.groupId,heldOut:test.has(p.groupId),strategy:d.strategy,teacher:moveId(d.chosenMove),local:moveId(move),teacherType:d.chosenMove.type,localType:move.type,rank:out.policyOrder.findIndex(m=>moveId(m)===moveId(d.chosenMove))+1,teacherFeatures:moveFeatures(d.state,d.chosenMove,measures),localFeatures:moveFeatures(d.state,move,measures),ms,expandedForSafety:out.expandedForSafety});}
  const summarize=rs=>({states:rs.length,agreement:rs.filter(r=>r.teacher===r.local).length/rs.length,rank:rs.reduce((s,r)=>s+r.rank,0)/rs.length});
  const reports={};for(const [name,rs] of Object.entries({all:rows,heldOut:rows.filter(r=>r.heldOut),train:rows.filter(r=>!r.heldOut)})){
   const ids=positions.filter(id=>rs.some(r=>r.positionId===id)),pairs=[];
   for(let a=0;a<5;a++)for(let b=a+1;b<5;b++){const pair=ids.map(id=>[a,b].map(s=>rs.find(r=>r.positionId===id&&r.strategy===strategies[s])));pairs.push({a:strategies[a],b:strategies[b],positions:ids.length,teacherDifferent:pair.filter(([a,b])=>a.teacher!==b.teacher).length,localDifferent:pair.filter(([a,b])=>a.local!==b.local).length});}
   const featureMeans=Object.fromEntries(strategies.map(s=>{const selected=rs.filter(r=>r.strategy===s);return [s,Object.fromEntries(['teacherFeatures','localFeatures'].map(field=>[field,Object.fromEntries(measures.map((f,j)=>[f,selected.reduce((n,r)=>n+r[field][j],0)/selected.length]))]))];}));
   reports[name]={...summarize(rs),byStrategy:Object.fromEntries(strategies.map(s=>[s,summarize(rs.filter(r=>r.strategy===s))])),byTeacherType:Object.fromEntries(['place','remove','shift'].map(t=>{const bucket=rs.filter(r=>r.teacherType===t);return [t,bucket.length?summarize(bucket):{states:0,agreement:null,rank:null}];})),pairs,featureMeans};
  }
  const contrastReport=Object.fromEntries([false,true].map(heldOut=>{const r=contrasts.filter(r=>r.heldOut===heldOut);return [heldOut?'heldOut':'train',{states:r.length,mse:r.reduce((s,r)=>s+r.mse,0)/r.length,zeroMse:r.reduce((s,r)=>s+r.zeroMse,0)/r.length}];}));
  const times=rows.map(r=>r.ms).sort((a,b)=>a-b);
  const result={ridge,weight,margin:1,compressedStyleBytes:gzipSync(JSON.stringify(style)).length,reports,contrastReport,serverLatency:{p95ms:times[Math.ceil(times.length*.95)-1],maxMs:times.at(-1),environment:`Node ${process.version}, unthrottled; NOT a mobile-class measurement`}};
  results.push(result);allChoices.push({ridge,weight,rows,contrasts});
  console.log(JSON.stringify({ridge,weight,validation:reports.heldOut.agreement,pairs:reports.heldOut.pairs.map(p=>p.localDifferent),contrast:contrastReport.heldOut}));
 }
}
const sourceHashes={};for(const f of ['lib/ai/style.ts','lib/ai/style-training.ts','lib/ai/search.ts','lib/ai/features.ts','lib/game/rules.ts','scripts/ai/fit-style.mjs'])sourceHashes[f]=hash(await fs.readFile(f));
await atomicJSON(`${v.out}/comparison.json`,{purpose:'DEVELOPMENT matched-state style experiment; not Jev strength or acceptance',probeSha256:hash(bytes),policyPath:v.policy,policySha256:hash(policyBytes),sourceHashes,testGroupIds,baseline,trainPositions:positions.filter(id=>!test.has(probes.find(p=>p.positionId===id).groupId)).length,heldOutPositions:positions.filter(id=>test.has(probes.find(p=>p.positionId===id).groupId)).length,limitations:['Only twenty targeted positions; provider noise is not separately estimated','Eight development holdout positions, no held-out teacher shifts','Style can rerank only the existing searched roots; root-beam omissions remain possible','Bounded one-point two-ply concession does not guarantee long-term strength'],results});
await fs.writeFile(`${v.out}/choices.json.gz`,gzipSync(JSON.stringify(allChoices)));
