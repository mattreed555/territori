// Exact-candidate teacher-state diagnostics; no API and no training.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {prepareLocalAgent} from './local-agent.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:Object.fromEntries(['run','model','style','out'].map(k=>[k,{type:'string'}]))});
if(!v.run||!v.model||!v.style||!v.out)throw Error('Use --run BATCH --model MODEL --style RESIDUAL --out DIRECTORY');
const hash=b=>createHash('sha256').update(b).digest('hex'),inputs={};
async function read(file,lines=false){const b=await fs.readFile(file);inputs[file]=hash(b);const t=file.endsWith('.gz')?gunzipSync(b).toString():b.toString();return lines?t.trim().split('\n').map(JSON.parse):JSON.parse(t);}
const provenance=await read(v.run+'/provenance.json'),model=await read(v.model),style=await read(v.style),metadata=provenance.localAgent;
if(!metadata?.intent)throw Error('Expected hybrid provenance');
const search=Object.fromEntries(Object.entries(metadata.search).filter(([k])=>k!=='version')),intent={strength:metadata.intent.strength,margin:metadata.intent.margin};
const prepared=await prepareLocalAgent({modelPath:v.model,stylePath:v.style,search,intent,epsilon:provenance.epsilon});assert.deepEqual(prepared.metadata,metadata);
const load=await loadModules(),{finalizedDecisions}=await load('ai/dataset'),{rankIntentMoves}=await load('ai/intent'),{moveId}=await load('game/rules'),{STRATEGIES}=await load('game/strategies');
const events=await read(v.run+'/decisions.jsonl.gz',true),rows=finalizedDecisions(events).filter(r=>r.source==='jev');
const ordinary=await read('experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl.gz',true),probes=await read('experiments/jev-replacement/20260924-style-06/probe/labels.jsonl.gz',true);
const train=[...ordinary.filter(r=>r.kind==='decision'&&model.training.trainGameIds.includes(r.gameId)),...probes.filter(r=>style.training.trainGroupIds.includes(r.groupId)).map(r=>r.decision)];
const context=(g,s)=>JSON.stringify([s,g.board,g.turn,g.supply,g.captured,g.finalRound,g.last,Object.entries(g.positions).sort()]),board=g=>JSON.stringify([g.board,g.turn,g.supply]);
const seen=new Set(train.map(r=>context(r.state,r.strategy))),seenBoards=new Set(train.map(r=>board(r.state))),observed=new Set(),measurements=[];
for(const row of rows){
 const result=rankIntentMoves(row.state,row.strategy,model,style,{...intent,search}),choice=result.ranked[0],rank=result.policyOrder.findIndex(m=>moveId(m)===moveId(row.chosenMove))+1;assert.ok(rank>0);
 const key=context(row.state,row.strategy),repeatedInBatch=observed.has(key);observed.add(key);
 measurements.push({id:row.id,gameId:row.gameId,strategy:row.strategy,teacherType:row.chosenMove.type,selectedType:choice.move.type,teacher:moveId(row.chosenMove),selected:moveId(choice.move),rank,agree:rank===1,teacherInSearchedBeam:result.ranked.some(r=>moveId(r.move)===moveId(row.chosenMove)),trainingContextOverlap:seen.has(key),trainingBoardOverlap:seenBoards.has(board(row.state)),repeatedInBatch,turnNumber:row.turnNumber,finalResult:row.finalResult});
}
const summary=rs=>({states:rs.length,agreement:rs.length?rs.filter(r=>r.agree).length/rs.length:null,meanTeacherRank:rs.length?rs.reduce((n,r)=>n+r.rank,0)/rs.length:null,teacherInSearchedBeam:rs.filter(r=>r.teacherInSearchedBeam).length});
const report={purpose:provenance.acceptance?'Agreement diagnostics on sealed acceptance teacher turns; not training, model selection or a substitute for complete strength/runtime gates':'Development agreement on teacher turns from fixed-hybrid matches, not an independent acceptance evaluation or new training',evaluationProtocol:provenance.acceptance?.sha256??null,candidate:metadata,inputs,teacher:summary(measurements),byStrategy:Object.fromEntries(Object.keys(STRATEGIES).map(s=>[s,summary(measurements.filter(r=>r.strategy===s))])),byTeacherMoveType:Object.fromEntries(['place','remove','shift'].map(t=>[t,summary(measurements.filter(r=>r.teacherType===t))])),excludingExactTrainingContexts:summary(measurements.filter(r=>!r.trainingContextOverlap)),excludingTrainingAndBatchRepeats:summary(measurements.filter(r=>!r.trainingContextOverlap&&!r.repeatedInBatch)),overlap:{trainingLabels:train.length,boardSupplyTurnStates:measurements.filter(r=>r.trainingBoardOverlap).length,fullDecisionContextStates:measurements.filter(r=>r.trainingContextOverlap).length,repeatedInBatch:measurements.filter(r=>r.repeatedInBatch).length},rankConvention:'One-based complete policy order: scored searched roots then unsearched moves in learned-prior order; not full-width minimax',paidCalls:0};
await fs.mkdir(v.out,{recursive:true});await atomicJSON(v.out+'/teacher-audit.json',report);await fs.writeFile(v.out+'/teacher-audit-choices.json.gz',gzipSync(JSON.stringify(measurements)));console.log(JSON.stringify(report));
