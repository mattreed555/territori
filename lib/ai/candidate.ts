import { candidateAssets } from './candidate-assets';
import { chooseIntentMove, INTENT_VERSION } from './intent';
import { validateModel } from './policy';
import { validateStyleModel } from './style';
import { SEARCH_VERSION } from './search';
import { STRATEGIES, type Strategy } from '../game/strategies';
import type { Game } from '../game/rules';

// Experimental until independent strength and mobile/browser gates pass.
export const CANDIDATE_ID='hybrid-search2-intent1-residual08-v1';
export function createCandidate(assets:unknown=candidateAssets) {
 try {
  const a=assets as {policy:unknown;style:unknown};
  const policy=validateModel(a?.policy),style=validateStyleModel(a?.style);
  if(INTENT_VERSION!==1 || SEARCH_VERSION!==2 || Object.keys(STRATEGIES).some(s=>!policy.strategies[s as Strategy]))throw new Error('Incomplete candidate');
  return {id:CANDIDATE_ID,choose:(game:Game,strategy:Strategy,epsilon:number,random:()=>number=Math.random)=>chooseIntentMove(game,strategy,policy,style,{strength:1,margin:1,search:{policyBeam:12,staticBeam:8,priorWeight:.75}},epsilon,random)};
 } catch {
  throw new Error('Local AI models are missing or incompatible. Reload the page or choose Jev explicitly in the AI lab. No API fallback was used.');
 }
}
