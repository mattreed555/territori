import { moveId, type Game, type Move } from '../game/rules';
import { STRATEGIES, type Strategy } from '../game/strategies';
import { FEATURES, FEATURE_VERSION, legalMoveFeatures } from './features';
import { RULESET } from './dataset';
export type Weights={weights:number[];mean:number[];scale:number[];samples:number};
export type PolicyModel={version:1;ruleset:string;featureVersion:number;features:string[];strategies:Partial<Record<Strategy,Weights>>;training:{seed:number;trainGameIds:string[];testGameIds:string[];softTargetMix?:number;sharedPriorStrength?:number}};
export function validateModel(value:unknown):PolicyModel {
  const m=value as PolicyModel;
  if(!m || m.version!==1 || m.ruleset!==RULESET || m.featureVersion!==FEATURE_VERSION || !Array.isArray(m.features) || !m.features.length || new Set(m.features).size!==m.features.length || m.features.some(n=>typeof n!=='string'||!Object.hasOwn(FEATURES,n)) || !m.strategies || typeof m.strategies!=='object') throw new Error('Incompatible policy model');
  for(const [name,s] of Object.entries(m.strategies)) {
    if(!(name in STRATEGIES) || !s || ![s.weights,s.mean,s.scale].every(a=>Array.isArray(a)&&a.length===m.features.length&&a.every(Number.isFinite)) || s.scale.some(v=>v<=0))throw new Error(`Invalid weights for ${name}`);
  }
  if(!m.training || ![m.training.trainGameIds,m.training.testGameIds].every(ids=>Array.isArray(ids)&&ids.every(id=>typeof id==='string')) || m.training.trainGameIds.some(id=>m.training.testGameIds.includes(id)))throw new Error('Invalid training split metadata');
  if(!Object.keys(m.strategies).length)throw new Error('Model has no trained strategies');return m;
}
export function rankMoves(game:Game,strategy:Strategy,model:PolicyModel):{move:Move;score:number}[] {
  const fit=model.strategies[strategy];if(!fit)throw new Error(`No trained policy for ${strategy}`);
  return legalMoveFeatures(game,model.features).map(({move,values})=>({move,score:values.reduce((sum,x,j)=>sum+fit.weights[j]*(x-fit.mean[j])/fit.scale[j],0)})).sort((a,b)=>b.score-a.score || moveId(a.move).localeCompare(moveId(b.move)));
}
export function chooseLocalMove(game:Game,strategy:Strategy,model:PolicyModel,epsilon=0,random:()=>number=Math.random):Move {
  if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw new Error('Randomness must be between 0 and 1');
  const ranked=rankMoves(game,strategy,model);if(!ranked.length)throw new Error('No legal moves');
  return epsilon>0 && random()<epsilon ? ranked[Math.floor(random()*ranked.length)].move : ranked[0].move;
}
export function seededRandom(seed:number) { let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
