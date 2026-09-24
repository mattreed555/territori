import {recordCounterfactual,type ProbePosition} from './counterfactual';
import type {Strategy} from '../game/strategies';
import type {Move} from '../game/rules';
import type {TeacherMetadata} from './dataset';
/** Explicit repeat identity; old counterfactual trainers must not silently merge
 * these records. The nested label retains its exact teacher response and state.
 */
export function recordRepeatedCounterfactual(position:ProbePosition,strategy:Strategy,move:Move,teacher:TeacherMetadata,repeat:number){
 if(!Number.isSafeInteger(repeat)||repeat<0||repeat>1)throw new Error('Repeat must be zero or one');
 return {kind:'repeated-counterfactual' as const,version:1,id:`${position.id}@${strategy}@repeat-${repeat}`,repeat,label:recordCounterfactual(position,strategy,move,teacher)};
}
