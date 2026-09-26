/** Local rules-based bot. Legacy trained models are not used in this path. */
import {isCapturable,legalSuccessors,legalValueSuccessors,moveId,neighbors,other,score,type Game,type Move} from '../game/rules';
import {STRATEGIES,type Strategy} from '../game/strategies';
import {replyEvaluator,searchValue} from './search';

export const HANDCRAFTED_VERSION=1;
const WIN=10000,BEAM=18,TACTICAL_TIE=.5;

function preference(game:Game,next:Game,move:Move,strategy:Strategy):number {
 const color=game.turn,enemy=other(color),at=move.to;
 const ns=neighbors(at),friends=ns.filter(i=>next.board[i]===color).length,foes=ns.filter(i=>next.board[i]===enemy).length;
 const before=score(game.board,game.captured),after=score(next.board,next.captured);
 const growth=(after.totals[color]-before.totals[color])/8;
 const reach=move.type==='place'?Math.min(1,neighbors(at).filter(i=>game.board[i]===null).length/4):0;
 switch(strategy){
  case 'Aggressive':return Math.min(1,(move.type==='remove'?.8:0)+.3*foes+.15*friends);
  case 'Cautious':return Math.max(-1,Math.min(1,.35*friends-.4*Math.max(0,foes-friends)+growth));
  case 'Expansive':return Math.max(-1,Math.min(1,growth+.15*reach-.15*Math.max(0,foes-friends)));
  case 'Fluid':return Math.max(-1,Math.min(1,(move.type==='shift'?.4:0)+growth+.2*friends-.2*Math.max(0,foes-friends)));
  case 'Balanced':return Math.max(-1,Math.min(1,growth+.15*friends+.2*(move.type==='remove'?1:0)));
 }
}

export function rankHandcraftedMoves(game:Game,strategy:Strategy){
 if(!Object.hasOwn(STRATEGIES,strategy))throw Error('Unknown strategy');
 const roots=[...legalSuccessors(game)].map(({move,game:next})=>{
  const immediate=searchValue(next,game.turn);
  // A plainly capturable fresh stone has an exact, cheap reply bound. Use it
  // in root proposal so high temporary control does not hide safe moves.
  let proposal=immediate;
  if(move.type==='place'&&!next.ended&&isCapturable(next.board,move.to)){
   const board=[...next.board];board[move.to]=null;
   proposal=Math.min(proposal,searchValue({board,supply:next.supply,captured:{...next.captured,[game.turn]:next.captured[game.turn]+1},ended:null},game.turn));
  }
  return {move,next,immediate,proposal};
 });
 if(!roots.length)throw Error('No legal moves');
 // Choose the beam from the rules-derived one-ply value, never a trained prior.
 const ordered=[...roots].sort((a,b)=>b.proposal-a.proposal||moveId(a.move).localeCompare(moveId(b.move)));
 const selected=new Set(ordered.slice(0,BEAM).map(r=>moveId(r.move)));
 for(const r of roots)if(r.next.ended)selected.add(moveId(r.move));
 // A few moves of each kind remain visible even when placements dominate.
 for(const type of ['remove','shift'] as const)for(const r of ordered.filter(x=>x.move.type===type).slice(0,3))selected.add(moveId(r.move));
 const evaluate=(r:typeof roots[number])=>{
  let worst=r.immediate,worstReply:Move|null=null;
  const valueOfReply=replyEvaluator(r.next,game.turn);
  for(const child of legalValueSuccessors(r.next)){
   const value=valueOfReply(child.state,child.move);
   if(worstReply===null||value<worst){worst=value;worstReply=child.move;}
  }
  return {move:r.move,searchValue:worst,worstReply,preference:preference(game,r.next,r.move,strategy)};
 };
 let ranked=roots.filter(r=>selected.has(moveId(r.move))).map(evaluate);
 // Never accept a visible forced loss merely because the bounded beam missed
 // the only deferral. Terminal wins were already included above.
 if(ranked.every(r=>r.searchValue===-WIN)&&ranked.length<roots.length){
  ranked.push(...roots.filter(r=>!selected.has(moveId(r.move))).map(evaluate));
 }
 const best=Math.max(...ranked.map(r=>r.searchValue));
 ranked.sort((a,b)=>{
  const ae=a.searchValue>=best-TACTICAL_TIE&&(best<WIN||a.searchValue===WIN);
  const be=b.searchValue>=best-TACTICAL_TIE&&(best<WIN||b.searchValue===WIN);
  return Number(be)-Number(ae)|| (ae&&be?b.preference-a.preference:0)||b.searchValue-a.searchValue||moveId(a.move).localeCompare(moveId(b.move));
 });
 return {ranked,roots:roots.length,searched:ranked.length};
}

export function chooseHandcraftedMove(game:Game,strategy:Strategy,epsilon=0,random:()=>number=Math.random):Move{
 if(!Number.isFinite(epsilon)||epsilon<0||epsilon>1)throw Error('Invalid randomness');
 const {ranked}=rankHandcraftedMoves(game,strategy),best=Math.max(...ranked.map(r=>r.searchValue));
 const close=ranked.filter(r=>r.searchValue>=best-TACTICAL_TIE&&(best<WIN||r.searchValue===WIN));
 return epsilon>0&&random()<epsilon?close[Math.floor(random()*close.length)].move:ranked[0].move;
}
