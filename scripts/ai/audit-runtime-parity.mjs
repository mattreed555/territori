// Confirm canonical transitions and teacher request bodies did not change.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{ref:{type:'string'},out:{type:'string'}}});
if(!v.ref||!v.out)throw Error('Use --ref FULL_LOCAL_SHA --out REPORT');
const current=await loadModules(),reference=await loadModules({ref:v.ref});
const rules=await current('game/rules'),oldRules=await reference('game/rules'),jev=await current('game/jev'),oldJev=await reference('game/jev'),{STRATEGIES}=await current('game/strategies');
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=['experiments/jev-replacement/20260924-style-06/positions.json.gz','experiments/jev-replacement/20260924-varied-12/positions.json.gz'];
const inputs={},sets=[];for(const p of files){const b=await fs.readFile(p);inputs[p]=hash(b);const x=JSON.parse(gunzipSync(b));sets.push(x.positions||x);}
let successors=0,requests=0;const requestHashes=[];
for(const p of sets.flat()){
 assert.deepEqual(rules.score(p.state.board),oldRules.score(p.state.board));
 const next=[...rules.legalSuccessors(p.state)],oldNext=[...oldRules.legalSuccessors(p.state)];assert.deepEqual(next,oldNext);successors+=next.length;
}
for(const p of sets[0])for(const strategy of Object.keys(STRATEGIES)){
 const request=jev.decisionRequest(p.state,strategy),before=oldJev.decisionRequest(p.state,strategy);assert.deepEqual(request,before);
 requestHashes.push({positionId:p.id,strategy,sha256:hash(JSON.stringify(request))});requests++;
}
const report={purpose:'Offline canonical rules and teacher request parity, no API calls',referenceLocalCommit:v.ref,inputs,states:sets.flat().length,successors,teacherRequests:requests,differences:0,requestHashes};
await atomicJSON(v.out,report);console.log(JSON.stringify({states:report.states,successors,teacherRequests:requests,differences:0}));
