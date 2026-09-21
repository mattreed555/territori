import { decisionRequest } from '../game/jev';
import { legalMoves, moveId, nextPositionKey, type Game } from '../game/rules';
import type { Strategy } from '../game/strategies';
import type { TeacherMetadata } from './dataset';
export async function askJev(game:Game,strategy:Strategy,key:string,signal?:AbortSignal,repetitions?:Record<string,number>) {
  const counts=repetitions || Object.fromEntries(legalMoves(game).map(m=>[moveId(m),game.positions[nextPositionKey(game,m)]||0]));
  const {moves,body}=decisionRequest(game,strategy,counts);
  if(!moves.length)throw new Error('No legal moves');
  const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Jev request failed (${response.status})`);
  const data=await response.json() as {answers?:{move?:{choice?:string;[key:string]:unknown}};usage?:unknown;model?:string};
  const move=moves.find(m=>moveId(m)===data.answers?.move?.choice);if(!move)throw new Error('Jev returned an illegal move');
  // Preserve the entire answer object: confidence/score fields are optional and provider-defined.
  const teacher:TeacherMetadata={model:data.model||body.model,answer:data.answers?.move??null,response:data,...(data.usage?{usage:data.usage}:{})};
  return {move,teacher};
}
