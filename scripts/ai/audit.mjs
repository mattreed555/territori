// Development-only dataset, leakage, imitation, and server-latency audit.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['data','model','out'].map(k=>[k,{type:'string'}]))});
if(!v.data||!v.model||!v.out)throw Error('Required: --data --model --out');
const load=await loadModules(),{finalizedDecisions}=await load('ai/dataset'),{evaluatePolicy}=await load('ai/training'),{validateModel,rankMoves}=await load('ai/policy');
const raw=await fs.readFile(v.data),bytes=v.data.endsWith('.gz')?gunzipSync(raw):raw,events=bytes.toString().trim().split('\n').map(JSON.parse),rows=finalizedDecisions(events);
const modelBytes=await fs.readFile(v.model),model=validateModel(JSON.parse(modelBytes));
const trainIds=new Set(model.training.trainGameIds),validationIds=new Set(model.training.testGameIds);
const train=rows.filter(r=>trainIds.has(r.gameId)),validation=rows.filter(r=>validationIds.has(r.gameId));
if(!train.length||!validation.length||[...trainIds].some(id=>validationIds.has(id)))throw Error('Missing or overlapping split');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const boardKey=r=>digest([r.state.board,r.state.turn,r.state.supply]);
const inputKey=r=>digest([r.strategy,r.state.board,r.state.turn,r.state.supply,r.state.captured,r.state.finalRound,r.state.last,Object.entries(r.state.positions).sort()]);
const overlap=key=>{const seen=new Set(train.map(key));return validation.filter(r=>seen.has(key(r)));};
const boardOverlap=overlap(boardKey),contextOverlap=overlap(inputKey),overlapIds=new Set(contextOverlap.map(r=>r.id));
const counts=(data,key)=>data.reduce((o,r)=>{const k=key(r);o[k]=(o[k]||0)+1;return o;},{});
const phase=r=>r.turnNumber<=16?'opening':r.turnNumber<=40?'middle':'late';
const durations=[];
// Warm up independently of recorded measurements; this is NOT the mobile gate.
for(const row of validation.slice(0,10))rankMoves(row.state,row.strategy,model);
for(const row of validation){const start=performance.now();rankMoves(row.state,row.strategy,model);durations.push(performance.now()-start);}
durations.sort((a,b)=>a-b);
const results=events.filter(e=>e.kind==='result');
const usage=rows.reduce((sum,r)=>({inputTokens:sum.inputTokens+(r.teacher?.usage?.input_tokens||0),outputTokens:sum.outputTokens+(r.teacher?.usage?.output_tokens||0)}),{inputTokens:0,outputTokens:0});
await atomicJSON(v.out,{
  purpose:'Development validation only. Not an independent acceptance evaluation or strength claim.',
  dataSha256:createHash('sha256').update(bytes).digest('hex'),modelSha256:createHash('sha256').update(modelBytes).digest('hex'),
  games:results.length,resultsByStatus:counts(results,r=>r.result.status),endReasons:counts(results,r=>r.result.reason),
  turnCounts:results.map(r=>r.result.turns),decisions:rows.length,byStrategy:counts(rows,r=>r.strategy),byStrategyAndColor:counts(rows,r=>r.strategy+':'+r.state.turn),byMoveType:counts(rows,r=>r.chosenMove.type),byPhase:counts(rows,phase),usage,
  trainGames:[...trainIds],validationGames:[...validationIds],trainDecisions:train.length,validationDecisions:validation.length,
  overlap:{boardSupplyTurnStates:boardOverlap.length,fullDecisionContextStates:contextOverlap.length,fullContextIncludes:'strategy, board, turn, supplies, captured, finalRound, last move, sorted repetition history; ignores ply'},
  validation:evaluatePolicy(validation,model),validationExcludingExactTrainingContexts:evaluatePolicy(validation.filter(r=>!overlapIds.has(r.id)),model),
  validationByPhase:Object.fromEntries(['opening','middle','late'].map(p=>[p,evaluatePolicy(validation.filter(r=>phase(r)===p),model)])),
  runtime:{environment:`Node ${process.version}, ${process.platform}/${process.arch}, unthrottled server; not a mobile-class measurement`,samples:durations.length,p50ms:durations[Math.floor(durations.length*.5)],p95ms:durations[Math.min(durations.length-1,Math.ceil(durations.length*.95)-1)],maxMs:durations.at(-1),modelBytes:modelBytes.length,modelGzipBytes:gzipSync(modelBytes).length},
  acceptance:{independentMatchGames:0,mobileGateMeasured:false,stylesValidated:false,ready:false}
});
console.log(`Wrote ${v.out}`);
