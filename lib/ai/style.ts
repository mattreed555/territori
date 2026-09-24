/** Optional, learned strategy contrast among tactically close searched moves. */
import { moveId, type Game, type Move } from '../game/rules';
import { STRATEGIES, type Strategy } from '../game/strategies';
import { FEATURE_VERSION, FEATURES, moveFeatures } from './features';
import { RULESET } from './dataset';
import type { PolicyModel } from './policy';
import { rankSearchMoves, chooseSearchMove, type SearchOptions } from './search';

export type StyleModel = {
  kind:'matched-style'; version:1; ruleset:string; featureVersion:number;
  features:string[]; scale:number[]; weights:Record<Strategy,number[]>;
  training:{trainGroupIds:string[];testGroupIds:string[];positions:number;ridge:number;probabilityFloor:number};
};
export function validateStyleModel(value:unknown):StyleModel {
  const m=value as StyleModel, names=Object.keys(STRATEGIES);
  if(!m || m.kind!=='matched-style' || m.version!==1 || m.ruleset!==RULESET || m.featureVersion!==FEATURE_VERSION ||
    !Array.isArray(m.features) || !m.features.length || new Set(m.features).size!==m.features.length || m.features.some(f=>!Object.hasOwn(FEATURES,f)) ||
    !Array.isArray(m.scale) || m.scale.length!==m.features.length || m.scale.some(s=>!Number.isFinite(s)||s<=0) ||
    !m.weights || Object.keys(m.weights).length!==names.length || names.some(s=>!Array.isArray(m.weights[s as Strategy]) || m.weights[s as Strategy].length!==m.features.length || m.weights[s as Strategy].some(w=>!Number.isFinite(w))))throw new Error('Invalid matched-style model');
  const t=m.training;
  if(!t || ![t.trainGroupIds,t.testGroupIds].every(ids=>Array.isArray(ids)&&ids.length>0&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&id.length>0)) || t.trainGroupIds.some(id=>t.testGroupIds.includes(id)) || !Number.isSafeInteger(t.positions)||t.positions<1 || !Number.isFinite(t.ridge)||t.ridge<=0 || !Number.isFinite(t.probabilityFloor)||t.probabilityFloor<=0||t.probabilityFloor>=1)throw new Error('Invalid matched-style training metadata');
  return m;
}
export function styleScore(game:Game,move:Move,strategy:Strategy,model:StyleModel) {
  return moveFeatures(game,move,model.features).reduce((s,x,j)=>s+x/model.scale[j]*model.weights[strategy][j],0);
}
export type StyleOptions={margin?:number;weight?:number;search?:SearchOptions};
export function rankStyledMoves(game:Game,strategy:Strategy,policy:PolicyModel,style:StyleModel,options:StyleOptions={}) {
  if(!options || typeof options!=='object' || Array.isArray(options) || Object.keys(options).some(k=>!['margin','weight','search'].includes(k)))throw new Error('Unknown style options');
  const {margin=1,weight=1,search={}}=options;
  if(!Number.isFinite(margin)||margin<0||margin>2||!Number.isFinite(weight)||weight<0||weight>3)throw new Error('Invalid style margin or weight');
  const result=rankSearchMoves(game,strategy,policy,search);
  if(weight===0||!result.ranked.length)return {...result,styleOptions:{margin,weight},eligibleMoves:result.ranked.length};
  const bestValue=Math.max(...result.ranked.map(r=>r.searchValue));
  const eligible=(r:typeof result.ranked[number])=>r.searchValue>=bestValue-margin && (bestValue<10000||r.searchValue===10000);
  const scores=result.ranked.map(r=>({r,raw:styleScore(game,r.move,strategy,style)}));
  // Center within this position before tanh: arbitrary state-only logit offsets
  // must not saturate every move and erase a learned relative preference.
  const center=scores.reduce((s,x)=>s+x.raw,0)/scores.length;
  const ranked=scores.map(({r,raw})=>({...r,styleResidual:raw-center,score:r.score+weight*Math.tanh(raw-center),eligible:eligible(r)}))
    .sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score||moveId(a.move).localeCompare(moveId(b.move)));
  const searched=new Set(ranked.map(r=>moveId(r.move)));
  return {...result,ranked,policyOrder:[...ranked.map(r=>r.move),...result.policyOrder.filter(m=>!searched.has(moveId(m)))],styleOptions:{margin,weight},eligibleMoves:ranked.filter(r=>r.eligible).length};
}
export function chooseStyledMove(game:Game,strategy:Strategy,policy:PolicyModel,style:StyleModel,options:StyleOptions={},epsilon=0,random:()=>number=Math.random):Move {
  if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw new Error('Randomness must be between 0 and 1');
  if(options.weight===0){rankStyledMoves(game,strategy,policy,style,options);return chooseSearchMove(game,strategy,policy,options.search,epsilon,random);}
  const result=rankStyledMoves(game,strategy,policy,style,options);
  if(!result.ranked.length)throw new Error('No legal moves');
  const bestValue=Math.max(...result.ranked.map(r=>r.searchValue));
  const close=result.ranked.filter(r=>r.searchValue>=bestValue-Math.min(1,result.styleOptions.margin)&&(bestValue<10000||r.searchValue===10000));
  return epsilon>0&&random()<epsilon?close[Math.floor(random()*close.length)].move:result.ranked[0].move;
}
