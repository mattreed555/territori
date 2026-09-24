import { chooseLocalMove } from './policy';
import { validateSettings, type Settings } from './settings';
import type { Game, Move } from '../game/rules';
import type { Strategy } from '../game/strategies';

export type LocalPlayer={id:string;choose:(game:Game,strategy:Strategy,random?:()=>number)=>Move};
type CandidateModule=typeof import('./candidate');
/** Local-only boundary. Loading assets may fail; never contact Jev on failure. */
export async function prepareLocalPlayer(settings:Settings,strategies:Strategy[],loadCandidate:()=>Promise<CandidateModule>=()=>import('./candidate')):Promise<LocalPlayer> {
 const s=validateSettings(settings);
 if(s.engine==='jev')throw new Error('Jev is not a local engine');
 if(s.engine==='local'){
  const model=s.model;
  if(!model || strategies.some(strategy=>!model.strategies[strategy]))throw new Error('The loaded model does not cover these strategies. Load a complete model or choose Jev explicitly in the AI lab.');
  return {id:'uploaded-linear-v1',choose:(game,strategy,random=Math.random)=>chooseLocalMove(game,strategy,model,s.epsilon,random)};
 }
 try {
  const candidate=(await loadCandidate()).createCandidate();
  return {id:candidate.id,choose:(game,strategy,random=Math.random)=>candidate.choose(game,strategy,s.epsilon,random)};
 } catch(error) {
  throw new Error(`Local AI could not load. No API fallback was used. ${error instanceof Error?error.message:'Reload the page or open the AI lab.'}`);
 }
}
