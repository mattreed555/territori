/** Opt-in authored strategy intent, NOT weights distilled from teacher labels.
 * The trained policy and learned residual remain intact underneath this layer.
 */
import {moveId,type Game,type Move} from '../game/rules';
import type {Strategy} from '../game/strategies';
import {moveFeatures} from './features';
import type {PolicyModel} from './policy';
import {rankStyledMoves,chooseStyledMove,type StyleModel} from './style';
import type {SearchOptions} from './search';

export const INTENT_VERSION=1;
export const INTENT_FEATURES=['territoryGain','opponentTerritoryLost','ownExposureChange','opponentExposureChange','ownGroupChange','spreadChange','movedStoneExposed','remove','shift','repetitionCount'];
/** Transparent, bounded preferences derived from the existing strategy wording.
 * Fluid earns a shift bonus only for a measurable immediate improvement and never
 * for revisiting a known position. Tactical eligibility is enforced separately.
 */
export function intentPreference(strategy:Strategy,values:number[]):number {
 if(values.length!==INTENT_FEATURES.length||values.some(x=>!Number.isFinite(x)))throw new Error('Invalid intent features');
 const [territory,lost,exposure,threats,group,spread,movedExposed,remove,shift,repeats]=values;
 switch(strategy){
  case 'Aggressive':return Math.tanh(.8*remove+.5*threats+.2*lost-.1*Math.max(0,exposure));
  case 'Cautious':return Math.tanh(-.7*exposure+.2*group-.2*movedExposed);
  case 'Expansive':return Math.tanh(.3*territory+.1*spread-.35*Math.max(0,exposure));
  case 'Fluid':return shift>0&&repeats===0&&(exposure<0||threats>0||group>0||territory>0)?1:0;
  case 'Balanced':return 0;
  default:throw new Error('Unknown intent strategy');
 }
}
export type IntentOptions={strength?:number;margin?:number;search?:SearchOptions};
export function rankIntentMoves(game:Game,strategy:Strategy,policy:PolicyModel,style:StyleModel,options:IntentOptions={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['strength','margin','search'].includes(k)))throw new Error('Unknown intent options');
 const {strength=1,margin=1,search={}}=options;
 if(!Number.isFinite(strength)||strength<0||strength>2||!Number.isFinite(margin)||margin<0||margin>1)throw new Error('Invalid intent strength or margin');
 const result=rankStyledMoves(game,strategy,policy,style,{weight:.5,margin,search});
 const bestValue=Math.max(...result.ranked.map(r=>r.searchValue));
 const ranked=result.ranked.map(r=>{
  const intentScore=strength===0?0:intentPreference(strategy,moveFeatures(game,r.move,INTENT_FEATURES));
  const intentEligible=r.searchValue>=bestValue-margin&&(bestValue<10000||r.searchValue===10000);
  return {...r,intentScore,intentEligible,score:r.score+strength*intentScore};
 }).sort((a,b)=>Number(b.intentEligible)-Number(a.intentEligible)||b.score-a.score||moveId(a.move).localeCompare(moveId(b.move)));
 const searched=new Set(ranked.map(r=>moveId(r.move)));
 return {...result,ranked,policyOrder:[...ranked.map(r=>r.move),...result.policyOrder.filter(m=>!searched.has(moveId(m)))],intent:{version:INTENT_VERSION,strength,margin}};
}
export function chooseIntentMove(game:Game,strategy:Strategy,policy:PolicyModel,style:StyleModel,options:IntentOptions={},epsilon=0,random:()=>number=Math.random):Move{
 if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw new Error('Randomness must be between zero and one');
 const result=rankIntentMoves(game,strategy,policy,style,options);
 if(!result.ranked.length)throw new Error('No legal moves');
 if(options.strength===0)return chooseStyledMove(game,strategy,policy,style,{weight:.5,margin:options.margin??1,search:options.search},epsilon,random);
 const close=result.ranked.filter(r=>r.intentEligible);
 return epsilon>0&&random()<epsilon?close[Math.floor(random()*close.length)].move:result.ranked[0].move;
}
