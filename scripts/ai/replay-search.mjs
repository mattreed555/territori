// Compare a new search implementation with saved local choices, without Jev calls.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['run','model','out'].map(k=>[k,{type:'string'}]))});
if(!v.run||!v.model||!v.out)throw Error('Use --run saved-batch --model weights.json --out report.json');
const load=await loadModules(),{chooseSearchMove,rankSearchMoves,SEARCH_VERSION}=await load('ai/search'),{validateModel,seededRandom}=await load('ai/policy'),{finalizedDecisions}=await load('ai/dataset'),{moveId}=await load('game/rules');
const bytes=await fs.readFile(`${v.run}/decisions.jsonl.gz`),rows=finalizedDecisions(gunzipSync(bytes).toString().trim().split('\n').map(JSON.parse)).filter(r=>r.source==='local'),provenance=JSON.parse(await fs.readFile(`${v.run}/provenance.json`)),model=validateModel(JSON.parse(await fs.readFile(v.model)));
if(provenance.mode!=='local-vs-jev')throw Error('Expected saved metered local-vs-Jev batch');
const options=provenance.search?Object.fromEntries(Object.entries(provenance.search).filter(([k])=>k!=='version')):{};
const differences=[];let total=0,expanded=0;
for(const gameId of [...new Set(rows.map(r=>r.gameId))]){
 const index=Number(gameId.split(':').at(-1));if(!Number.isSafeInteger(index))throw Error('Cannot recover game seed');
 const random=seededRandom(provenance.seed+index);
 for(const r of rows.filter(r=>r.gameId===gameId)){
  const chosen=chooseSearchMove(r.state,r.strategy,model,options,provenance.epsilon,random);total++;
  if(moveId(chosen)!==moveId(r.chosenMove))differences.push({id:r.id,before:moveId(r.chosenMove),after:moveId(chosen)});
  expanded+=Number(rankSearchMoves(r.state,r.strategy,model,options).expandedForSafety);
 }
}
const report={purpose:'Offline observed-state replay, not new match outcomes',searchVersion:SEARCH_VERSION,originalSearchVersion:provenance.search?.version,sourceDatasetSha256:createHash('sha256').update(bytes).digest('hex'),total,same:total-differences.length,expandedForSafety:expanded,differences};
await atomicJSON(v.out,report);console.log(JSON.stringify(report));
