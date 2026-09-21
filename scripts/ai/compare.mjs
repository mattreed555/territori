// Four predeclared candidates on the same development split; never acceptance data.
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {loadModules} from './modules.mjs';
import {atomicJSON} from './budget.mjs';
const {values:v}=parseArgs({options:{data:{type:'string'},out:{type:'string'},shared:{type:'boolean'}}});
if(!v.data||!v.out)throw Error('Use --data dataset.jsonl.gz --out directory');
const load=await loadModules(),{finalizedDecisions}=await load('ai/dataset'),{trainPolicy,splitGames}=await load('ai/training'),{FEATURE_NAMES,TACTICAL_FEATURE_NAMES,moveFeatures}=await load('ai/features'),{rankMoves}=await load('ai/policy'),{STRATEGIES}=await load('game/strategies'),{moveId}=await load('game/rules');
const raw=await fs.readFile(v.data),bytes=v.data.endsWith('.gz')?gunzipSync(raw):raw,rows=finalizedDecisions(bytes.toString().trim().split('\n').map(JSON.parse));
await fs.mkdir(v.out,{recursive:true});
const configs=v.shared?[
 {name:'baseline-hard',features:FEATURE_NAMES,softTargetMix:0,sharedPriorStrength:0},
 {name:'baseline-soft-prior',features:FEATURE_NAMES,softTargetMix:1,sharedPriorStrength:.05},
 {name:'tactical-hard-prior',features:TACTICAL_FEATURE_NAMES,softTargetMix:0,sharedPriorStrength:.05},
 {name:'tactical-soft-prior',features:TACTICAL_FEATURE_NAMES,softTargetMix:1,sharedPriorStrength:.05},
 {name:'tactical-soft-prior-strong',features:TACTICAL_FEATURE_NAMES,softTargetMix:1,sharedPriorStrength:.2},
]:[{name:'baseline-hard',features:FEATURE_NAMES,softTargetMix:0},{name:'baseline-soft',features:FEATURE_NAMES,softTargetMix:1},{name:'tactical-hard',features:TACTICAL_FEATURE_NAMES,softTargetMix:0},{name:'tactical-soft',features:TACTICAL_FEATURE_NAMES,softTargetMix:1}];
const seed=511,testFraction=.5,epochs=60,split=splitGames(rows,seed,testFraction),comparisons=[];
// Shared states, exactly the same for every strategy; this is a local-policy diagnostic,
// not a claim about faithful reproduction of the teacher's strategy intent.
const seen=new Set(),states=split.test.filter(r=>{const k=JSON.stringify([r.state.board,r.state.turn,r.state.supply]);if(seen.has(k))return false;seen.add(k);return true;}).filter((_,i)=>i%4===0);
for(const config of configs){
 const fit=trainPolicy(rows,{seed,testFraction,epochs,features:config.features,softTargetMix:config.softTargetMix,sharedPriorStrength:config.sharedPriorStrength||0});
 await atomicJSON(`${v.out}/${config.name}.json`,fit.model);
 const modelBytes=Buffer.from(JSON.stringify(fit.model)),timings=[],choices={},style={};
 for(const strategy of Object.keys(STRATEGIES)){
  const selected=states.map(row=>{const start=performance.now(),move=rankMoves(row.state,strategy,fit.model)[0].move;timings.push(performance.now()-start);return {id:moveId(move),type:move.type,features:moveFeatures(row.state,move,TACTICAL_FEATURE_NAMES)};});
  choices[strategy]=selected.map(x=>x.id);
  const measures=['territoryGain','ownExposureChange','spreadChange','ownGroupChange','captureReplyOwnGain','movedStoneExposed'];
  style[strategy]={states:states.length,actions:selected.reduce((a,x)=>(a[x.type]=(a[x.type]||0)+1,a),{}),meanFeatures:Object.fromEntries(measures.map(n=>[n,selected.reduce((s,x)=>s+x.features[TACTICAL_FEATURE_NAMES.indexOf(n)],0)/selected.length]))};
 }
 const strategies=Object.keys(STRATEGIES),pairwise=[];
 for(let i=0;i<strategies.length;i++)for(let j=i+1;j<strategies.length;j++){const a=strategies[i],b=strategies[j];pairwise.push({a,b,states:states.length,differentMoves:choices[a].filter((id,k)=>id!==choices[b][k]).length});}
 timings.sort((a,b)=>a-b);
 const result={name:config.name,softTargetMix:config.softTargetMix,sharedPriorStrength:config.sharedPriorStrength||0,features:config.features,...fit.split,validation:fit.report,modelCompactGzipBytes:gzipSync(modelBytes).length,serverLatency:{samples:timings.length,p95ms:timings[Math.ceil(.95*timings.length)-1],maxMs:timings.at(-1),environment:`Node ${process.version} Linux/x64, unthrottled; not the mobile gate`},commonStateDiagnostic:{note:'Same held-out positions for all local strategies, not teacher-matched strategy validation.',stateIds:states.map(r=>r.id),style,pairwise}};
 comparisons.push(result);console.log(JSON.stringify({name:config.name,agreement:fit.report.overall.agreementPercent,rank:fit.report.overall.averageTeacherRank,p95:result.serverLatency.p95ms}));
}
const masses=rows.map(r=>Object.values(r.teacher.answer.probabilities).reduce((a,b)=>a+b,0));
const coverage=data=>Object.fromEntries(Object.keys(STRATEGIES).map(strategy=>{const r=data.filter(r=>r.strategy===strategy);return [strategy,{states:r.length,chosenTypes:r.reduce((o,r)=>(o[r.chosenMove.type]=(o[r.chosenMove.type]||0)+1,o),{}),legalCaptureStates:r.filter(r=>r.legalMoves.some(m=>m.type==='remove')).length}];}));
await atomicJSON(`${v.out}/comparison.json`,{purpose:'Development/model selection only; no independent acceptance games used',datasetSha256:createHash('sha256').update(bytes).digest('hex'),teacherProbabilityMass:{min:Math.min(...masses),max:Math.max(...masses),normalizedRows:masses.filter(s=>Math.abs(s-1)>1e-6).length,rule:'Renormalize mass within 1% of one; reject missing legal keys, invalid values, or larger discrepancies'},coverage:{train:coverage(split.train),validation:coverage(split.test)},seed,testFraction,epochs,trainGameIds:split.trainGameIds,validationGameIds:split.testGameIds,comparisons});
