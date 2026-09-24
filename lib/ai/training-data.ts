import { finalizedDecisions, RULESET, type DatasetEvent, type Decision } from './dataset';
import { recordCounterfactual } from './counterfactual';

/** Training-only annotation. Original decision identities and outcomes stay intact. */
export type TrainingDecision = Decision & { splitGroupId?: string };
export const trainingGroup = (row: TrainingDecision) => row.splitGroupId ?? row.gameId;

/** Join played records and explicit counterfactuals without splitting a source game
 * across folds. Counterfactuals remain outcome-free; this is not an archival export.
 */
export function trainingDecisions(events: DatasetEvent[], probes: ReturnType<typeof recordCounterfactual>[] = []): TrainingDecision[] {
  const rows: TrainingDecision[] = finalizedDecisions(events);
  const seen = new Map<string, string>();
  for (const p of probes) {
    if (p.kind !== 'counterfactual' || p.version !== 1 || p.ruleset !== RULESET ||
      ![p.positionId,p.groupId,p.origin,p.category].every(v=>typeof v === 'string' && v.length > 0) || p.decision.source !== 'jev' ||
      !p.decision.teacher || p.decision.finalResult !== null) throw new Error('Invalid counterfactual training record');
    const d = p.decision;
    if (!d.teacher) throw new Error('Counterfactual teacher metadata is required');
    const expected = recordCounterfactual({id:p.positionId, groupId:p.groupId, origin:p.origin, category:p.category, state:d.state}, d.strategy, d.chosenMove, d.teacher);
    if (d.id !== expected.decision.id || d.gameId !== expected.decision.gameId) throw new Error('Invalid counterfactual identity');
    finalizedDecisions([d]);
    const serialized = JSON.stringify(p);
    if (seen.has(d.id)) {
      if (seen.get(d.id) !== serialized) throw new Error('Conflicting counterfactual record');
      continue;
    }
    if (rows.some(r => r.id === d.id)) throw new Error('Counterfactual identity collides with played decision');
    seen.set(d.id, serialized);
    rows.push({...d, splitGroupId:p.groupId});
  }
  return rows;
}
