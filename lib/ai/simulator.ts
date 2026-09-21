import { newGame, applyMove, type Color, type Game, type Move } from '../game/rules';
import type { Strategy } from '../game/strategies';
import {recordDecision,recordResult,type DatasetEvent,type TeacherMetadata} from './dataset';
export type Agent={source:'jev'|'local';choose:(game:Game,strategy:Strategy)=>Promise<{move:Move;teacher?:TeacherMetadata}>};
export async function simulateGame({gameId,players,agents,write,maxTurns=300}:{gameId:string;players:Record<Color,Strategy>;agents:Record<Color,Agent>;write:(event:DatasetEvent)=>Promise<void>;maxTurns?:number}) {
  if(!Number.isInteger(maxTurns)||maxTurns<1)throw new Error('Invalid turn limit');
  let game=newGame();
  try {
    while(!game.ended && game.ply<maxTurns) {
      const agent=agents[game.turn],strategy=players[game.turn],choice=await agent.choose(game,strategy);
      await write(recordDecision(gameId,game,strategy,choice.move,agent.source,choice.teacher||null));
      game=applyMove(game,choice.move);
    }
    const result=recordResult(gameId,game);await write(result);return result;
  } catch(error) {await write(recordResult(gameId,game,'aborted','agent-or-storage-error'));throw error;}
}
