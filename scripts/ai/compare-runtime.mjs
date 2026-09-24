// Interleaved, exact-output comparison against an immutable LOCAL Git revision.
// Shared-host Node timing is not a calibrated mobile-class measurement.
import fs from 'node:fs/promises';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{ref:{type:'string'},out:{type:'string'}}});
if(!v.ref||!v.out)throw Error('Use --ref FULL_LOCAL_SHA --out DIR');
const hash=b=>createHash('sha256').update(b).digest('hex'),inputs={};
async function read(p){const b=await fs.readFile(p);inputs[p]=hash(b);return JSON.parse(gunzipSync(b));}
const targeted=await read('experiments/jev-replacement/20260924-style-06/positions.json.gz');
const varied=await read('experiments/jev-replacement/20260924-varied-12/positions.json.gz');
const positions=[...targeted.positions,...varied.filter((_,i)=>i%5===0)];
const current=await loadModules(),reference=await loadModules({ref:v.ref});
const modules={};
for(const [kind,load] of Object.entries({reference,current}))modules[kind]={...(await load('ai/intent')),...(await load('ai/candidate-assets'))};
const {STRATEGIES}=await current('game/strategies'),rows=[];
let compared=0;
for(let round=-1;round<3;round++)for(let index=0;index<positions.length;index++)for(const strategy of Object.keys(STRATEGIES)){
 const p=positions[index],order=(index+round)%2?['current','reference']:['reference','current'],pair={};
 for(const kind of order){
  const m=modules[kind],t=performance.now(),r=m.rankIntentMoves(p.state,strategy,m.candidateAssets.policy,m.candidateAssets.style,{strength:1,margin:1}),ms=performance.now()-t;
  pair[kind]={round,positionId:p.id,strategy,kind,ms,outputHash:hash(JSON.stringify(r)),expandedForSafety:r.expandedForSafety,nodes:r.nodes};
  if(round>=0)rows.push(pair[kind]);
 }
 assert.equal(pair.current.outputHash,pair.reference.outputHash,`Policy changed at ${p.id} ${strategy}`);compared++;
}
function summary(rows){const a=rows.map(r=>r.ms).sort((a,b)=>a-b);return {samples:a.length,medianMs:a[Math.floor(a.length/2)],p95ms:a[Math.ceil(a.length*.95)-1],maxMs:a.at(-1)};}
const summaries=Object.fromEntries(['reference','current'].map(kind=>{const sub=rows.filter(r=>r.kind===kind);return [kind,{all:summary(sub),safetyFallback:summary(sub.filter(r=>r.expandedForSafety)),normal:summary(sub.filter(r=>!r.expandedForSafety))}];}));
const sourceHashes={};for(const p of ['lib/game/rules.ts','lib/ai/search.ts','lib/ai/candidate.ts','lib/ai/candidate-assets.ts','scripts/ai/modules.mjs','scripts/ai/compare-runtime.mjs'])sourceHashes[p]=hash(await fs.readFile(p));
const report={purpose:'Interleaved Node fixed-policy parity/performance, NOT browser/mobile/acceptance',referenceLocalCommit:v.ref,environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,constrainedCPU:false},selection:'All20 targeted positions plus every fifth of319 scheduled synthetic states; no timing-based selection',positions:positions.length,strategies:5,warmupRounds:1,measuredRounds:3,fullOutputComparisons:compared,differences:0,inputs,sourceHashes,summaries};
await fs.mkdir(v.out,{recursive:true});await atomicJSON(`${v.out}/interleaved.json`,report);await fs.writeFile(`${v.out}/interleaved-rows.json.gz`,gzipSync(JSON.stringify(rows)));
console.log(JSON.stringify(report));
