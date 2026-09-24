// Offline matched-state augmentation. Never calls Jev or reads a credential.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{data:{type:'string',multiple:true},probes:{type:'string'},baseline:{type:'string'},out:{type:'string'}}});
if(!v.data?.length||!v.probes||!v.baseline||!v.out)throw Error('Use --data played.jsonl.gz [--data ...] --probes labels.jsonl.gz --baseline model.json --out directory');
const load=await loadModules(),{trainingDecisions,trainingGroup}=await load('ai/training-data'),{trainPolicy,evaluatePolicy,splitByGameIds}=await load('ai/training'),{validateModel,seededRandom}=await load('ai/policy'),{TACTICAL_FEATURE_NAMES,moveFeatures}=await load('ai/features'),{rankSearchMoves,SEARCH_VERSION}=await load('ai/search'),{moveId}=await load('game/rules'),{STRATEGIES}=await load('game/strategies');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),datasets=[];
async function read(path){const bytes=await fs.readFile(path);datasets.push({path,sha256:hash(bytes)});return (path.endsWith('.gz')?gunzipSync(bytes):bytes).toString().trim().split('\n').map(JSON.parse);}
const events=[];for(const file of v.data)events.push(...await read(file));
const probes=await read(v.probes),rows=trainingDecisions(events,probes).filter(r=>r.source==='jev');
const bytes=await fs.readFile(v.baseline),baseline=validateModel(JSON.parse(bytes));
// Keep every original holdout game out of training, including its probe labels.
// Hold out two additional random-trace groups, chosen with a fixed seed before fits.
const playedGroups=new Set(trainingDecisions(events).map(trainingGroup));
const fresh=[...new Set(probes.map(p=>p.groupId))].filter(id=>!playedGroups.has(id)&&!baseline.training.trainGameIds.includes(id)&&!baseline.training.testGameIds.includes(id)).sort();
const random=seededRandom(2407);for(let i=fresh.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[fresh[i],fresh[j]]=[fresh[j],fresh[i]];}
const testGameIds=[...baseline.training.testGameIds,...fresh.slice(0,2)];
const split=splitByGameIds(rows,testGameIds),testSet=new Set(testGameIds);
const ordinaryValidation=split.test.filter(r=>!r.splitGroupId),probeValidation=split.test.filter(r=>r.splitGroupId);
const key=r=>JSON.stringify([r.state.board,r.state.turn,r.state.supply,r.state.captured,r.state.finalRound,r.state.positions]);
const trainingKeys=new Set(split.train.map(key));
const configs=[
 {name:'probe-soft-prior-strong',softTargetMix:1,sharedPriorStrength:.2},
 {name:'probe-soft-prior',softTargetMix:1,sharedPriorStrength:.05},
 {name:'probe-hard-prior',softTargetMix:0,sharedPriorStrength:.05}
];
await fs.mkdir(v.out,{recursive:true});
const models=[{name:'frozen-baseline',model:baseline}];
for(const config of configs){
 const fit=trainPolicy(rows,{...config,features:TACTICAL_FEATURE_NAMES,seed:511,epochs:60,testGameIds});
 validateModel(fit.model);await atomicJSON(`${v.out}/${config.name}.json`,fit.model);models.push({name:config.name,model:fit.model});
}
const measures=['territoryGain','ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','centerDistance','place','remove','shift'];
const strategies=Object.keys(STRATEGIES),diagnostics=[],results=[];
const positions=[...new Set(probes.map(p=>p.positionId))];
for(const {name,model} of models){
 const linear={ordinaryValidation:evaluatePolicy(ordinaryValidation,model),probeValidation:evaluatePolicy(probeValidation,model),ordinaryNovelContexts:evaluatePolicy(ordinaryValidation.filter(r=>!trainingKeys.has(key(r))),model),probeNovelContexts:evaluatePolicy(probeValidation.filter(r=>!trainingKeys.has(key(r))),model)};
 for(const priorWeight of [.75,3]){
  const details=[];
  for(const p of probes){const d=p.decision,search=rankSearchMoves(d.state,d.strategy,model,{priorWeight}),choice=search.ranked[0].move;
   details.push({positionId:p.positionId,groupId:p.groupId,heldOut:testSet.has(p.groupId),repeatedTrainingContext:trainingKeys.has(key(d)),strategy:d.strategy,teacher:moveId(d.chosenMove),local:moveId(choice),teacherType:d.chosenMove.type,localType:choice.type,teacherRank:search.policyOrder.findIndex(m=>moveId(m)===moveId(d.chosenMove))+1,teacherFeatures:moveFeatures(d.state,d.chosenMove,measures),localFeatures:moveFeatures(d.state,choice,measures),searchValue:search.ranked[0].searchValue,expandedForSafety:search.expandedForSafety});}
  const summary=rs=>({states:rs.length,agreementPercent:rs.length?100*rs.filter(r=>r.teacher===r.local).length/rs.length:null,averageTeacherRank:rs.length?rs.reduce((s,r)=>s+r.teacherRank,0)/rs.length:null});
  const sets={all:details,heldOut:details.filter(r=>r.heldOut),heldOutNovel:details.filter(r=>r.heldOut&&!r.repeatedTrainingContext),train:details.filter(r=>!r.heldOut)};
  const commonState={};
  for(const [set,rs] of Object.entries(sets)){
   const ids=positions.filter(id=>strategies.every(s=>rs.some(r=>r.positionId===id&&r.strategy===s)));
   const pairwise=[];for(let a=0;a<strategies.length;a++)for(let b=a+1;b<strategies.length;b++){
    const paired=ids.map(id=>strategies.slice(a,a+1).concat(strategies[b]).map(s=>rs.find(r=>r.positionId===id&&r.strategy===s)));
    pairwise.push({a:strategies[a],b:strategies[b],positions:ids.length,teacherDifferent:paired.filter(([a,b])=>a.teacher!==b.teacher).length,localDifferent:paired.filter(([a,b])=>a.local!==b.local).length});
   }
   commonState[set]={overall:summary(rs),byStrategy:Object.fromEntries(strategies.map(s=>[s,summary(rs.filter(r=>r.strategy===s))])),byTeacherMoveType:Object.fromEntries(['place','remove','shift'].map(t=>[t,summary(rs.filter(r=>r.teacherType===t))])),pairwise,meanFeatures:Object.fromEntries(strategies.map(s=>{const selected=rs.filter(r=>r.strategy===s);return [s,Object.fromEntries(['teacherFeatures','localFeatures'].map(field=>[field,Object.fromEntries(measures.map((f,j)=>[f,selected.length?selected.reduce((n,r)=>n+r[field][j],0)/selected.length:null]))]))];}))};
  }
  diagnostics.push({name,priorWeight,details});
  results.push({name,priorWeight,modelSha256:hash(JSON.stringify(model)),compressedModelBytes:gzipSync(JSON.stringify(model)).length,linear,commonState});
  console.log(JSON.stringify({name,priorWeight,ordinary:linear.ordinaryValidation.overall,probeLinear:linear.probeValidation.overall,probeSearch:commonState.heldOut.overall,pairDifferences:commonState.heldOut.pairwise.map(p=>p.localDifferent)}));
 }
}
// Board-context overlap is reported in addition to group separation. Similar/opening
// states can recur in distinct legal games; do not call this an independent test.
const sourceHash={};for(const path of ['lib/ai/training-data.ts','lib/ai/training.ts','lib/ai/search.ts','scripts/ai/train-probe.mjs'])sourceHash[path]=hash(await fs.readFile(path));
await atomicJSON(`${v.out}/comparison.json`,{purpose:'DEVELOPMENT model selection, not independent acceptance or game strength',datasets,baseline:{path:v.baseline,sha256:hash(bytes)},sourceHash,searchVersion:SEARCH_VERSION,seed:511,epochs:60,split:{trainGroups:split.trainGameIds,testGroups:testGameIds,trainRows:split.train.length,testRows:split.test.length,trainProbeRows:split.train.filter(r=>r.splitGroupId).length,testProbeRows:probeValidation.length,ordinaryValidationRows:ordinaryValidation.length,validationRepeatedTrainingContexts:split.test.filter(r=>trainingKeys.has(key(r))).length},limitations:['Only twenty targeted probe positions; multiple positions share a source game','Original holdout is repeatedly used for development, never acceptance','Counterfactual labels have no game outcome','No repeated same-strategy teacher responses to separate provider variability','Model selection cannot establish distinct styles from isolated move differences'],results});
await fs.writeFile(`${v.out}/choices.json.gz`,gzipSync(JSON.stringify(diagnostics)));
