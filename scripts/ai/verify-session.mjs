// Independently replay a completed metered game batch and reconcile every charge.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {chargeForUsage,atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{run:{type:'string'}}});if(!v.run)throw Error('Use --run batch-directory');
const load=await loadModules(),{newGame,applyMove,moveId}=await load('game/rules'),{recordResult,finalizedDecisions}=await load('ai/dataset');
const read=async name=>JSON.parse(await fs.readFile(path.join(v.run,name),'utf8'));
const readLines=async name=>gunzipSync(await fs.readFile(path.join(v.run,name+'.gz'))).toString().trim().split('\n').map(JSON.parse);
const events=await readLines('decisions.jsonl'),journal=await readLines('usage.jsonl'),summary=await read('summary.json'),provenance=await read('provenance.json');
const rows=finalizedDecisions(events),results=events.filter(e=>e.kind==='result'),requests=journal.filter(e=>e.kind==='request'),usage=journal.filter(e=>e.kind==='usage'),teacher=rows.filter(r=>r.source==='jev');
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
 for(const row of decisions){assert.deepEqual(row.state,game);game=applyMove(game,row.chosenMove);}
 assert.deepEqual(recordResult(result.gameId,game),result);
 games.push({id:result.gameId,turns:game.ply,result:result.result,trajectorySha256:createHash('sha256').update(JSON.stringify(decisions.map(r=>moveId(r.chosenMove)))).digest('hex')});
}
assert.equal(games.length,summary.completed+summary.truncated);
const countBy=(items,key)=>items.reduce((o,r)=>(o[key(r)]=(o[key(r)]||0)+1,o),{});
const report={purpose:'Exact replay/usage integrity check; not an independent strength evaluation',runId:provenance.runId,decisions:rows.length,teacherDecisions:teacher.length,allStatesAndResultsReplayed:true,allRequestsAndUsageMatched:true,inputTokens:input,outputTokens:output,costNano:cost,chosenTypesBySource:countBy(rows,r=>r.source+':'+r.chosenMove.type),uniqueTrajectories:new Set(games.map(g=>g.trajectorySha256)).size,games};
await atomicJSON(path.join(v.run,'integrity.json'),report);console.log(JSON.stringify({decisions:rows.length,calls:teacher.length,costNano:cost,uniqueTrajectories:report.uniqueTrajectories,chosenTypes:report.chosenTypesBySource}));
