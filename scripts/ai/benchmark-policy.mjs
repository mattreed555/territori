// Repeatable Node benchmark and exact complete-policy fingerprint; no API.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['positions','policy','style','out','compare'].map(k=>[k,{type:'string'}]))});
if(!v.positions||!v.policy||!v.style||!v.out)throw Error('Use --positions positions.gz --policy model --style residual --out report [--compare before.json]');
await fs.mkdir(path.dirname(v.out),{recursive:true});
const load=await loadModules(),{rankSearchMoves}=await load('ai/search'),{rankStyledMoves}=await load('ai/style'),{rankIntentMoves}=await load('ai/intent'),{STRATEGIES}=await load('game/strategies');
const hash=b=>createHash('sha256').update(b).digest('hex'),inputs={};
async function read(path){const b=await fs.readFile(path);inputs[path]=hash(b);return JSON.parse(path.endsWith('.gz')?gunzipSync(b):b);}
const {positions}=await read(v.positions),policy=await read(v.policy),style=await read(v.style),rows=[];
for(let round=-1;round<3;round++)for(const p of positions)for(const strategy of Object.keys(STRATEGIES))for(const kind of ['search','styled','intent']){
 const start=performance.now(),r=kind==='search'?rankSearchMoves(p.state,strategy,policy):kind==='styled'?rankStyledMoves(p.state,strategy,policy,style,{weight:.5,margin:1}):rankIntentMoves(p.state,strategy,policy,style,{strength:1,margin:1}),ms=performance.now()-start;
 if(round>=0)rows.push({round,positionId:p.id,strategy,kind,ms,outputHash:hash(JSON.stringify(r)),expandedForSafety:r.expandedForSafety,roots:r.legalRootCount,nodes:r.nodes});
}
const summary=rs=>{const a=rs.map(r=>r.ms).sort((a,b)=>a-b);return {samples:a.length,medianMs:a[Math.floor(a.length/2)],p95ms:a[Math.ceil(a.length*.95)-1],maxMs:a.at(-1)};};
const summaries=Object.fromEntries(['search','styled','intent'].map(kind=>{const rs=rows.filter(r=>r.kind===kind);return [kind,{all:summary(rs),safetyFallback:summary(rs.filter(r=>r.expandedForSafety)),normal:summary(rs.filter(r=>!r.expandedForSafety))}];}));
let comparison=null;
if(v.compare){const before=JSON.parse(await fs.readFile(v.compare));if(JSON.stringify(before.inputs)!==JSON.stringify(inputs))throw Error('Benchmark inputs changed');
 const differences=rows.filter((r,i)=>{const b=before.rows[i];return !b||r.positionId!==b.positionId||r.strategy!==b.strategy||r.kind!==b.kind||r.round!==b.round||r.outputHash!==b.outputHash;});
 comparison={reference:v.compare,referenceSha256:hash(await fs.readFile(v.compare)),cases:rows.length,differences:differences.length,beforeSummaries:before.summaries};
 if(differences.length||before.rows.length!==rows.length)throw Error('Policy output changed; optimization failed parity');
}
const sourceHashes={};for(const path of ['lib/game/rules.ts','lib/game/jev.ts','lib/ai/features.ts','lib/ai/policy.ts','lib/ai/search.ts','lib/ai/style.ts','lib/ai/intent.ts','scripts/ai/benchmark-policy.mjs'])sourceHashes[path]=hash(await fs.readFile(path));
await atomicJSON(v.out,{purpose:'Node development performance/parity only, NOT mobile gate',environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,warmupRounds:1,measuredRounds:3},inputs,sourceHashes,summaries,comparison,rows});
console.log(JSON.stringify({summaries,comparison}));
