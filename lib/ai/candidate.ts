import {chooseHandcraftedMove,HANDCRAFTED_VERSION} from './handcrafted';
import type { Game } from '../game/rules';
import type {Strategy} from '../game/strategies';

// Experimental until independent strength and mobile/browser gates pass.
export const CANDIDATE_ID='capture-points-v2-handcrafted-search1';
export function createCandidate() {
 if(HANDCRAFTED_VERSION!==1)throw Error('Local AI version mismatch. Reload the page.');
 return {id:CANDIDATE_ID,choose:(game:Game,strategy:Strategy,epsilon:number,random:()=>number=Math.random)=>chooseHandcraftedMove(game,strategy,epsilon,random)};
}
