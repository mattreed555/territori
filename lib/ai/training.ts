import { moveId } from '../game/rules';
import { STRATEGIES, type Strategy } from '../game/strategies';
import { FEATURE_NAMES, FEATURE_VERSION, moveFeatures } from './features';
import { RULESET, type Decision } from './dataset';
import { seededRandom, rankMoves, type PolicyModel, type Weights } from './policy';
import { trainingGroup, type TrainingDecision } from './training-data';
export function splitGames(rows:TrainingDecision[],seed=1,testFraction=.2) {
  if(!(testFraction>0&&testFraction<1))throw new Error('Test fraction must be between 0 and 1');
  const ids=[...new Set(rows.map(trainingGroup))].sort(),random=seededRandom(seed);
  if(ids.length<2)throw new Error('At least two separate games are required for a held-out test');
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  const testGameIds=ids.slice(0,Math.max(1,Math.min(ids.length-1,Math.round(ids.length*testFraction)))),test=new Set(testGameIds);
  return {train:rows.filter(r=>!test.has(trainingGroup(r))),test:rows.filter(r=>test.has(trainingGroup(r))),trainGameIds:ids.filter(id=>!test.has(id)),testGameIds};
}
/** Preserve an existing development holdout when adding student-state games. */
export function splitByGameIds(rows:TrainingDecision[],testGameIds:string[]) {
  const ids=[...new Set(rows.map(trainingGroup))].sort();
  if(!Array.isArray(testGameIds)||!testGameIds.length||new Set(testGameIds).size!==testGameIds.length||testGameIds.some(id=>typeof id!=='string'||!ids.includes(id))||testGameIds.length>=ids.length)throw new Error('Invalid explicit game holdout');
  const test=new Set(testGameIds);
  return {train:rows.filter(r=>!test.has(trainingGroup(r))),test:rows.filter(r=>test.has(trainingGroup(r))),trainGameIds:ids.filter(id=>!test.has(id)),testGameIds:[...testGameIds]};
}
/** Multinomial logistic regression over the legal moves in each state. No ML dependency. */
export function teacherTargets(row:Decision,mix=0):number[] {
  if(!Number.isFinite(mix)||mix<0||mix>1)throw new Error('Soft target mix must be 0–1');
  const ids=row.legalMoves.map(moveId),chosen=moveId(row.chosenMove),hard=ids.map(id=>Number(id===chosen));
  if(!ids.includes(chosen))throw new Error('Teacher choice is not legal');
  if(mix===0)return hard;
  const probabilities=(row.teacher?.answer as {probabilities?:Record<string,number>}|null)?.probabilities;
  if(!probabilities || Object.keys(probabilities).length!==ids.length || ids.some(id=>!Object.hasOwn(probabilities,id)||!Number.isFinite(probabilities[id])||probabilities[id]<0||probabilities[id]>1))throw new Error('Missing or invalid teacher probability distribution');
  const sum=ids.reduce((s,id)=>s+probabilities[id],0);
  // Recorded Jev 1.13 responses often total 0.99. Normalize this small missing
  // mass explicitly; reject materially incomplete distributions, never fill keys.
  if(Math.abs(sum-1)>.010000001)throw new Error('Teacher probability mass differs from one by more than 1%');
  return ids.map((id,i)=>(1-mix)*hard[i]+mix*probabilities[id]/sum);
}
export function trainPolicy(rows:TrainingDecision[],{seed=1,epochs=60,rate=.03,l2=.001,testFraction=.2,features=FEATURE_NAMES,softTargetMix=0,sharedPriorStrength=0,testGameIds=undefined as string[]|undefined}={}) {
  if(!Number.isInteger(epochs)||epochs<1||!Number.isFinite(rate)||rate<=0||!Number.isFinite(l2)||l2<0)throw new Error('Invalid training parameters');
  if(!Number.isFinite(softTargetMix)||softTargetMix<0||softTargetMix>1)throw new Error('Soft target mix must be 0–1');
  if(!Number.isFinite(sharedPriorStrength)||sharedPriorStrength<0)throw new Error('Shared prior strength must be nonnegative');
  const teacherRows=rows.filter(r=>r.source==='jev'),split=testGameIds===undefined?splitGames(teacherRows,seed,testFraction):splitByGameIds(teacherRows,testGameIds),random=seededRandom(seed);
  const model:PolicyModel={version:1,ruleset:RULESET,featureVersion:FEATURE_VERSION,features,strategies:{},training:{seed,trainGameIds:split.trainGameIds,testGameIds:split.testGameIds}};
  if(softTargetMix>0)model.training.softTargetMix=softTargetMix;
  function fitRows(rows:Decision[],random:()=>number,prior:Weights|null=null):Weights {
    const data=rows.map(r=>({x:r.legalMoves.map(m=>moveFeatures(r.state,m,features)),targets:teacherTargets(r,softTargetMix)}));
    if(!data.length)throw new Error('Cannot fit an empty training set');
    const mean=features.map(()=>0),scale=features.map(()=>0);let n=0;
    for(const row of data)for(const x of row.x){n++;x.forEach((v,j)=>mean[j]+=v);}
    mean.forEach((_,j)=>mean[j]/=n);
    for(const row of data)for(const x of row.x)x.forEach((v,j)=>scale[j]+=(v-mean[j])**2);
    scale.forEach((_,j)=>scale[j]=Math.sqrt(scale[j]/n)||1);
    for(const row of data)for(const x of row.x)x.forEach((v,j)=>x[j]=(v-mean[j])/scale[j]);
    // Convert the shared coefficients into this strategy's feature scaling.
    // The different means add a constant to every legal-move logit, so rankings
    // and softmax probabilities are unchanged. No extra runtime model is needed.
    const center=features.map((_,j)=>prior?prior.weights[j]*scale[j]/prior.scale[j]:0);
    const fit:Weights={weights:[...center],mean,scale,samples:data.length};
    for(let epoch=0;epoch<epochs;epoch++) {
      for(let i=data.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[data[i],data[j]]=[data[j],data[i]];}
      const step=rate/Math.sqrt(1+epoch/10);
      for(const row of data) {
        const logits=row.x.map(x=>x.reduce((sum,v,j)=>sum+v*fit.weights[j],0)),max=Math.max(...logits),exp=logits.map(v=>Math.exp(v-max)),sum=exp.reduce((a,b)=>a+b,0);
        const gradient=fit.weights.map((w,j)=>prior?l2*w+sharedPriorStrength*(w-center[j]):l2*w);
        row.x.forEach((x,i)=>x.forEach((v,j)=>gradient[j]+=(exp[i]/sum-row.targets[i])*v));
        fit.weights.forEach((w,j)=>fit.weights[j]=w-step*gradient[j]);
      }
    }
    return fit;
  }
  // Fit general tactics only on the training side of the whole-game split.
  // Separate RNG preserves the original path exactly when this is disabled.
  const prior=sharedPriorStrength>0?fitRows(split.train,seededRandom(seed^0x51a7)):null;
  if(prior)model.training.sharedPriorStrength=sharedPriorStrength;
  for(const strategy of Object.keys(STRATEGIES) as Strategy[]) {
    const rows=split.train.filter(r=>r.strategy===strategy);
    if(rows.length)model.strategies[strategy]=fitRows(rows,random,prior);
  }
  return {model,report:evaluatePolicy(split.test,model),split:{trainGames:split.trainGameIds.length,testGames:split.testGameIds.length,trainDecisions:split.train.length,testDecisions:split.test.length}};
}
export function evaluatePolicy(rows:Decision[],model:PolicyModel) {
  type Bucket={states:number;matches:number;rankSum:number};
  const total:Bucket={states:0,matches:0,rankSum:0},byStrategy:Record<string,Bucket>=Object.fromEntries(Object.keys(STRATEGIES).map(s=>[s,{states:0,matches:0,rankSum:0}])),byMoveType:Record<string,Bucket>=Object.fromEntries(['place','remove','shift'].map(s=>[s,{states:0,matches:0,rankSum:0}]));let unsupported=0;
  for(const r of rows.filter(r=>r.source==='jev')) {
    if(!model.strategies[r.strategy]){unsupported++;continue;}
    const ranked=rankMoves(r.state,r.strategy,model),rank=ranked.findIndex(x=>moveId(x.move)===moveId(r.chosenMove))+1;
    if(rank===0)throw new Error('Teacher choice missing from legal moves');
    for(const b of [total,byStrategy[r.strategy]??=( {states:0,matches:0,rankSum:0}),byMoveType[r.chosenMove.type]??=({states:0,matches:0,rankSum:0})]){b.states++;b.matches+=Number(rank===1);b.rankSum+=rank;}
  }
  const summary=(b:Bucket)=>({states:b.states,agreementPercent:b.states?100*b.matches/b.states:null,averageTeacherRank:b.states?b.rankSum/b.states:null});
  return {overall:summary(total),byStrategy:Object.fromEntries(Object.entries(byStrategy).map(([k,v])=>[k,summary(v)])),byTeacherMoveType:Object.fromEntries(Object.entries(byMoveType).map(([k,v])=>[k,summary(v)])),unsupportedStates:unsupported,tieBreaking:'score descending, then move ID; rank is one-based; epsilon=0'};
}
