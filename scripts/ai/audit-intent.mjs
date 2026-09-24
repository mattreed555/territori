// Offline authored-intent ablation on saved, grouped DEVELOPMENT labels.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['policy','style','out'].map(k=>[k,{type:'string'}]))});
if(!v.policy||!v.style||!v.out)throw Error('Use --policy FILE --style FILE --out DIR');
const load=await loadModules(),{rankIntentMoves,INTENT_VERSION}=await load('ai/intent'),{moveFeatures}=await load('ai/features'),{moveId}=await load('game/rules'),{STRATEGIES}=await load('game/strategies');
const hashes={},hash=b=>createHash('sha256').update(b).digest('hex');
async function read(file,lines=false){const b=await fs.readFile(file);hashes[file]=hash(b);const t=file.endsWith('.gz')?gunzipSync(b).toString():b.toString();return lines?t.trim().split('\n').map(JSON.parse):JSON.parse(t);}
const policy=await read(v.policy),style=await read(v.style),original=await read('experiments/jev-replacement/20260924-style-06/probe/labels.jsonl.gz',true),repeat=await read('experiments/jev-replacement/20260924-shift-10/probe/labels.jsonl.gz',true),split=await read('experiments/jev-replacement/20260924-shift-10/positions.json');
const probes=[...original,...repeat.filter(w=>w.repeat===0).map(w=>w.label)],test=new Set([...style.training.testGroupIds,...split.testGroupIds]),strategies=Object.keys(STRATEGIES),features=['territoryGain','opponentTerritoryLost','ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','place','remove','shift','repetitionCount'],all=[],reports=[];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const summary=rs=>({states:rs.length,agreement:mean(rs.map(r=>Number(r.teacher===r.local))),meanTeacherRank:mean(rs.map(r=>r.rank)),meanTacticalConcession:mean(rs.map(r=>r.concession))});
for(const strength of [0,.5,1,2]){
 const rows=[];for(const p of probes){const d=p.decision,t=performance.now(),r=rankIntentMoves(d.state,d.strategy,policy,style,{strength,margin:1}),ms=performance.now()-t,chosen=r.ranked[0];
  rows.push({positionId:p.positionId,groupId:p.groupId,heldOut:test.has(p.groupId),strategy:d.strategy,teacher:moveId(d.chosenMove),local:moveId(chosen.move),teacherType:d.chosenMove.type,localType:chosen.move.type,rank:r.policyOrder.findIndex(m=>moveId(m)===moveId(d.chosenMove))+1,concession:Math.max(...r.ranked.map(x=>x.searchValue))-chosen.searchValue,intentScore:chosen.intentScore,features:moveFeatures(d.state,chosen.move,features),ms});
 }
 const report={strength,margin:1,sets:{}};
 for(const [name,rs] of Object.entries({all:rows,heldOut:rows.filter(r=>r.heldOut),train:rows.filter(r=>!r.heldOut)})){
  const ids=[...new Set(rs.map(r=>r.positionId))],pairs=[];for(let a=0;a<5;a++)for(let b=a+1;b<5;b++)pairs.push({a:strategies[a],b:strategies[b],different:ids.filter(id=>rs.find(r=>r.positionId===id&&r.strategy===strategies[a]).local!==rs.find(r=>r.positionId===id&&r.strategy===strategies[b]).local).length,positions:ids.length});
  report.sets[name]={...summary(rs),byStrategy:Object.fromEntries(strategies.map(s=>{const bucket=rs.filter(r=>r.strategy===s);return [s,{...summary(bucket),features:Object.fromEntries(features.map((f,j)=>[f,mean(bucket.map(r=>r.features[j]))])),usefulFluidShifts:bucket.filter(r=>r.strategy==='Fluid'&&r.localType==='shift'&&r.intentScore===1).length}];})),byTeacherType:Object.fromEntries(['place','remove','shift'].map(t=>[t,summary(rs.filter(r=>r.teacherType===t))])),pairs};
 }
 const times=rows.map(r=>r.ms).sort((a,b)=>a-b);report.latency={p95ms:times[Math.ceil(.95*times.length)-1],maxMs:times.at(-1),environment:`${process.version} unthrottled server Node; NOT mobile gate`};reports.push(report);all.push({strength,rows});
 console.log(JSON.stringify({strength,heldOut:report.sets.heldOut,latency:report.latency}));
}
await fs.mkdir(v.out,{recursive:true});
for(const path of ['lib/ai/intent.ts','lib/ai/style.ts','lib/ai/search.ts','scripts/ai/audit-intent.mjs'])hashes[path]=hash(await fs.readFile(path));
await atomicJSON(`${v.out}/audit.json`,{purpose:'Explicit AUTHORED strategy-intent experiment, not distillation evidence or acceptance',intentVersion:INTENT_VERSION,hashes,testGroups:[...test],reports});
await fs.writeFile(`${v.out}/choices.json.gz`,gzipSync(JSON.stringify(all)));
