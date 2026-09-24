import { STRATEGIES, type Strategy } from '../game/strategies';
import { FEATURE_VERSION, moveFeatures } from './features';
import { RULESET } from './dataset';
import { recordCounterfactual } from './counterfactual';
import { trainingDecisions } from './training-data';
import { teacherTargets } from './training';
import { validateStyleModel, type StyleModel } from './style';

export const STYLE_FEATURES=['territoryGain','opponentTerritoryLost','ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','centerDistance','place','remove','shift','movedStoneSupport','captureReplyOwnGain','captureReplyOpponentLoss','captureReplyWastesStone'];
/** Ridge regression of teacher log-probability differences BETWEEN strategies on
 * identical positions. Common tactical preferences cancel instead of overwhelming
 * the small style signal. No game result is used or invented. Equal state weight.
 */
export function trainStyle(probes:ReturnType<typeof recordCounterfactual>[],testGroupIds:string[],{ridge=.1,probabilityFloor=.001,features=STYLE_FEATURES}={}) {
  if(probes.some(p=>p.decision.evaluationProtocol))throw new Error('Independent acceptance decisions cannot train a style model');
  if(!Number.isFinite(ridge)||ridge<=0||!Number.isFinite(probabilityFloor)||probabilityFloor<=0||probabilityFloor>=1)throw new Error('Invalid ridge/floor');
  trainingDecisions([],probes); // Validate all records, including held-out records.
  const strategies=Object.keys(STRATEGIES) as Strategy[],groups=[...new Set(probes.map(p=>p.groupId))].sort();
  if(!testGroupIds.length||new Set(testGroupIds).size!==testGroupIds.length||testGroupIds.some(id=>!groups.includes(id)))throw new Error('Invalid style holdout');
  const test=new Set(testGroupIds),positions=new Map<string,typeof probes>();
  for(const p of probes){const rows=positions.get(p.positionId)||[];rows.push(p);positions.set(p.positionId,rows);}
  for(const rows of positions.values()){
    if(rows.length!==strategies.length||new Set(rows.map(r=>r.decision.strategy)).size!==strategies.length)throw new Error('Each position needs exactly one label for every strategy');
    if(rows.some(r=>r.groupId!==rows[0].groupId||JSON.stringify(r.decision.state)!==JSON.stringify(rows[0].decision.state)))throw new Error('Matched labels must share source group and exact state');
  }
  const data=[...positions.values()].filter(rows=>!test.has(rows[0].groupId)).map(rows=>{
    const d=rows[0].decision,x=d.legalMoves.map(m=>moveFeatures(d.state,m,features));
    const mean=features.map((_,j)=>x.reduce((s,v)=>s+v[j],0)/x.length);
    x.forEach(v=>v.forEach((_,j)=>v[j]-=mean[j]));
    const logits=strategies.map(s=>teacherTargets(rows.find(p=>p.decision.strategy===s)!.decision,1).map(p=>Math.log(Math.max(p,probabilityFloor))));
    // Remove both position-only logit offsets and the common strategy average.
    logits.forEach(a=>{const mean=a.reduce((s,x)=>s+x,0)/a.length;a.forEach((_,i)=>a[i]-=mean);});
    const targets=logits.map(a=>a.map((v,i)=>v-logits.reduce((s,b)=>s+b[i],0)/logits.length));
    return {x,targets};
  });
  if(!data.length)throw new Error('No training positions');
  const n=features.length,scale=features.map((_,j)=>Math.sqrt(data.reduce((s,d)=>s+d.x.reduce((s,x)=>s+x[j]**2,0)/d.x.length,0)/data.length)||1);
  const a=Array.from({length:n},()=>Array(n).fill(0)),b=Array.from({length:n},()=>Array(strategies.length).fill(0));
  for(const d of data)for(const [i,raw] of d.x.entries()){
    const x=raw.map((v,j)=>v/scale[j]),weight=1/(data.length*d.x.length);
    for(let j=0;j<n;j++){for(let k=0;k<n;k++)a[j][k]+=weight*x[j]*x[k];for(let s=0;s<strategies.length;s++)b[j][s]+=weight*x[j]*d.targets[s][i];}
  }
  for(let j=0;j<n;j++)a[j][j]+=ridge;
  // Small positive-definite system; pivoted Gauss-Jordan solves all five RHS.
  const augmented=a.map((row,j)=>[...row,...b[j]]);
  for(let j=0;j<n;j++){
    let pivot=j;for(let k=j+1;k<n;k++)if(Math.abs(augmented[k][j])>Math.abs(augmented[pivot][j]))pivot=k;
    [augmented[j],augmented[pivot]]=[augmented[pivot],augmented[j]];
    const divisor=augmented[j][j];if(Math.abs(divisor)<1e-12)throw new Error('Singular style regression');
    augmented[j]=augmented[j].map(v=>v/divisor);
    for(let k=0;k<n;k++)if(k!==j){const factor=augmented[k][j];for(let c=0;c<n+strategies.length;c++)augmented[k][c]-=factor*augmented[j][c];}
  }
  const model:StyleModel={kind:'matched-style',version:1,ruleset:RULESET,featureVersion:FEATURE_VERSION,features,scale,weights:Object.fromEntries(strategies.map((s,i)=>[s,augmented.map(row=>row[n+i])])) as Record<Strategy,number[]>,training:{trainGroupIds:groups.filter(g=>!test.has(g)),testGroupIds,positions:data.length,ridge,probabilityFloor}};
  return validateStyleModel(model);
}
