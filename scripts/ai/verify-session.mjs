// Independently replay a completed metered game batch and reconcile every charge.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {chargeForUsage,atomicJSON} from './budget.mjs';
import {prepareLocalAgent} from './local-agent.mjs';
import {checkAcceptance} from './acceptance.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['run','model','style','protocol'].map(k=>[k,{type:'string'}]))});if(!v.run)throw Error('Use --run batch-directory [--model FILE --style FILE --protocol FILE]');
const load=await loadModules(),{newGame,applyMove,moveId}=await load('game/rules'),{recordResult,finalizedDecisions}=await load('ai/dataset');
const read=async name=>JSON.parse(await fs.readFile(path.join(v.run,name),'utf8'));
const readLines=async name=>gunzipSync(await fs.readFile(path.join(v.run,name+'.gz'))).toString().trim().split('\n').map(JSON.parse);
const rawEvents=await readLines('decisions.jsonl'),journal=await readLines('usage.jsonl'),summary=await read('summary.json'),provenance=await read('provenance.json');
if(provenance.acceptance){
 assert.ok(v.protocol,'Acceptance replay requires the original sealed protocol');
 const verified=await checkAcceptance(v.protocol,provenance);assert.deepEqual(verified.metadata,provenance.acceptance);assert.equal(provenance.purpose,'independent-acceptance');
 for(const e of rawEvents)assert.equal(e.evaluationProtocol,verified.metadata.sha256,'Untagged acceptance event');
}else{assert.ok(!v.protocol,'Cannot relabel development games as acceptance');assert.ok(rawEvents.every(e=>!e.evaluationProtocol));}
const events=rawEvents.map(({evaluationProtocol,...event})=>event);
const rows=finalizedDecisions(events),results=events.filter(e=>e.kind==='result'),requests=journal.filter(e=>e.kind==='request'),usage=journal.filter(e=>e.kind==='usage'),teacher=rows.filter(r=>r.source==='jev');
let localAgent=null,localChoicesReplayed=0;
const {seededRandom}=await load('ai/policy');
if(provenance.localAgent){
 if(!v.model)throw Error('This batch requires exact local policy replay: supply --model and, for hybrid, --style');
 const metadata=provenance.localAgent;
 const search=metadata.search?Object.fromEntries(Object.entries(metadata.search).filter(([k])=>k!=='version')):null;
 const intent=metadata.intent?{strength:metadata.intent.strength,margin:metadata.intent.margin}:null;
 localAgent=await prepareLocalAgent({modelPath:v.model,stylePath:v.style,search,intent,epsilon:provenance.epsilon});
 assert.deepEqual(localAgent.metadata,metadata,'Local model/config/source changed; cannot claim exact policy replay');
}else if(v.model||v.style)throw Error('Legacy batches lack exact local-agent metadata; use their separate compatibility replay');
assert.equal(journal.filter(e=>e.kind==='uncertain').length,0,'Cannot verify an uncertain session as exact');
assert.equal(teacher.length,requests.length);assert.equal(usage.length,teacher.length);assert.equal(summary.uncertain,false);
let cost=0,input=0,output=0;
for(let i=0;i<teacher.length;i++){
 const r=teacher[i],u=usage[i],q=requests[i];
 assert.equal(q.call,i+1);assert.equal(u.call,q.call);
 assert.deepEqual(q.context,{gameId:r.gameId,turnNumber:r.turnNumber,strategy:r.strategy,player:r.state.turn});
 assert.equal(moveId(r.chosenMove),r.teacher.answer.choice);
 assert.deepEqual(r.teacher.usage,u.usage);assert.equal(r.teacher.model,u.model);
 const charge=chargeForUsage(r.teacher);assert.equal(charge,u.costNano);
 cost+=charge;input+=u.usage.input_tokens;output+=u.usage.output_tokens;
}
assert.equal(cost,summary.spentUpperNano);assert.equal(input,summary.inputTokens);assert.equal(output,summary.outputTokens);assert.equal(summary.calls,teacher.length);
const games=[];
for(const result of results){
 let game=newGame();const decisions=rows.filter(r=>r.gameId===result.gameId);
 const index=Number(result.gameId.slice(provenance.runId.length+1));assert.ok(result.gameId.startsWith(provenance.runId+':')&&Number.isSafeInteger(index)&&index>=0&&index<provenance.matchups.length);
 const random=seededRandom(provenance.seed+index);
 for(const row of decisions){assert.deepEqual(row.state,game);assert.equal(row.strategy,provenance.matchups[index][game.turn]);if(localAgent){const localColor=Math.floor(index/5)%2===0?'blue':'red';assert.equal(row.source,game.turn===localColor?'local':'jev');}if(row.source==='local'&&localAgent){assert.equal(moveId(localAgent.choose(game,row.strategy,random)),moveId(row.chosenMove));localChoicesReplayed++;}game=applyMove(game,row.chosenMove);}
 assert.deepEqual(recordResult(result.gameId,game),result);
 games.push({id:result.gameId,turns:game.ply,result:result.result,trajectorySha256:createHash('sha256').update(JSON.stringify(decisions.map(r=>moveId(r.chosenMove)))).digest('hex')});
}
assert.equal(games.length,summary.completed+summary.truncated);
const countBy=(items,key)=>items.reduce((o,r)=>(o[key(r)]=(o[key(r)]||0)+1,o),{});
const report={purpose:'Exact replay/usage integrity check; not an independent strength evaluation',runId:provenance.runId,decisions:rows.length,teacherDecisions:teacher.length,allStatesAndResultsReplayed:true,allRequestsAndUsageMatched:true,localPolicy:localAgent?{metadata:localAgent.metadata,choicesReplayed:localChoicesReplayed,exact:true}:null,inputTokens:input,outputTokens:output,costNano:cost,chosenTypesBySource:countBy(rows,r=>r.source+':'+r.chosenMove.type),uniqueTrajectories:new Set(games.map(g=>g.trajectorySha256)).size,games};
await atomicJSON(path.join(v.run,'integrity.json'),report);console.log(JSON.stringify({decisions:rows.length,calls:teacher.length,costNano:cost,uniqueTrajectories:report.uniqueTrajectories,chosenTypes:report.chosenTypesBySource}));
