import type { Game, Move } from '../game/rules';
import type { Strategy } from '../game/strategies';
import { finalizedDecisions, recordDecision, RULESET, type TeacherMetadata } from './dataset';
export type ProbePosition={id:string;groupId:string;origin:string;category:string;state:Game};
/** These labels describe alternatives at a saved state, NOT played trajectories.
 * Keep source-game grouping when splitting them later. Existing training readers
 * deliberately ignore this distinct event kind until an explicit adapter exists.
 */
export function recordCounterfactual(position:ProbePosition,strategy:Strategy,move:Move,teacher:TeacherMetadata) {
  if(!position.id||!position.groupId||!position.origin)throw new Error('Counterfactual provenance is required');
  const decision=recordDecision(`${position.id}@${strategy}`,position.state,strategy,move,'jev',teacher);
  finalizedDecisions([decision]); // Same counts, legal-move and ruleset validation.
  return {kind:'counterfactual' as const,version:1,ruleset:RULESET,positionId:position.id,groupId:position.groupId,origin:position.origin,category:position.category,decision};
}
