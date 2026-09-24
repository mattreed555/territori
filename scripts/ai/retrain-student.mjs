// Enrich training with saved teacher choices on student-visited states. No API.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{data:{type:'string',multiple:true},baseline:{type:'string'},out:{type:'string'}}});
if(!v.data?.length||!v.baseline||!v.out)throw Error('Use repeated --data paths, --baseline model.json, --out directory');
const load=await loadModules(),{finalizedDecisions}=await load('ai/dataset'),{trainPolicy,evaluatePolicy}=await load('ai/training'),{validateModel}=await load('ai/policy'),{TACTICAL_FEATURE_NAMES}=await load('ai/features');
const baseline=validateModel(JSON.parse(await fs.readFile(v.baseline))),events=[],datasets=[];
for(const path of v.data){const bytes=await fs.readFile(path);datasets.push({path,sha256:createHash('sha256').update(bytes).digest('hex')});events.push(...(path.endsWith('.gz')?gunzipSync(bytes):bytes).toString().trim().split('\n').map(JSON.parse));}
const rows=finalizedDecisions(events).filter(r=>r.source==='jev');
const testGameIds=baseline.training.testGameIds;
await fs.mkdir(v.out,{recursive:true});
const configs=[
 {name:'tactical-hard',softTargetMix:0,sharedPriorStrength:0},
 {name:'tactical-soft',softTargetMix:1,sharedPriorStrength:0},
 {name:'tactical-soft-prior',softTargetMix:1,sharedPriorStrength:.05},
 {name:'tactical-soft-prior-strong',softTargetMix:1,sharedPriorStrength:.2}
];
const results=[];
for(const config of configs){
 const fit=trainPolicy(rows,{...config,features:TACTICAL_FEATURE_NAMES,seed:511,epochs:60,testGameIds});
 validateModel(fit.model);await atomicJSON(`${v.out}/${config.name}.json`,fit.model);
 const report={...config,...fit.split,validation:fit.report,compactGzipBytes:gzipSync(JSON.stringify(fit.model)).length,samplesByStrategy:Object.fromEntries(Object.entries(fit.model.strategies).map(([s,w])=>[s,w.samples]))};results.push(report);console.log(JSON.stringify({name:config.name,...fit.report.overall}));
}
await atomicJSON(`${v.out}/comparison.json`,{purpose:'DEVELOPMENT model selection only. Original whole-game holdout retained; no acceptance data.',datasets,baselinePath:v.baseline,testGameIds,teacherDecisions:rows.length,baselineValidation:evaluatePolicy(rows.filter(r=>testGameIds.includes(r.gameId)),baseline),results});
