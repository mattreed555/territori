// Local-only fixed-seed development check on the same capture-points rules.
import {loadModules} from './modules.mjs';
const ref='78a9ecc6b47948a86ee5563942d64aa9f0d4623b';
const current=await loadModules(),old=await loadModules({ref});
const {chooseHandcraftedMove}=await current('ai/handcrafted');
const {chooseIntentMove}=await old('ai/intent'),{candidateAssets}=await old('ai/candidate-assets');
const {seededRandom}=await current('ai/policy');
const {newGame,applyMove,score,territory}=await current('game/rules');
const {STRATEGIES}=await current('game/strategies');
const names=Object.keys(STRATEGIES),rows=[];
function agent(kind,game,strategy,random){return kind==='new'?chooseHandcraftedMove(game,strategy,.03,random):chooseIntentMove(game,strategy,candidateAssets.policy,candidateAssets.style,{strength:1,margin:1},.03,random);}
for(const kind of ['old','new'])for(const seed of [2412,2413])for(const [a,blue] of names.entries())for(const [b,red] of names.entries()){
 let game=newGame(),pairs=0,empty=0,prior=null,occupied=new Set(),peak=0;
 const random={blue:seededRandom(seed+a*10007+b*101),red:seededRandom(seed+a*10007+b*101+37)};
 while(!game.ended&&game.ply<160){
  const before=game,move=agent(kind,game,game.turn==='blue'?blue:red,random[game.turn]);
  game=applyMove(game,move);
  if(prior?.move.type==='place'&&move.type==='remove'&&prior.move.to===move.to){pairs++;if(game.board.every((c,i)=>c===prior.before.board[i]))empty++;}
  if(move.type==='place')occupied.add(move.to);
  peak=Math.max(peak,territory(game.board).filter(Boolean).length);
  prior={move,before};
 }
 const result=score(game.board,game.captured);
 rows.push({kind,seed,blue,red,pairs,empty,occupied:occupied.size,peak,turns:game.ply,reason:game.ended||'truncated',points:result.points,territory:result.totals,stones:{blue:25-game.supply.blue-game.captured.blue,red:25-game.supply.red-game.captured.red},winner:result.winner});
}
const summarize=kind=>{const v=rows.filter(r=>r.kind===kind),avg=k=>v.reduce((n,r)=>n+r[k],0)/v.length;return {games:v.length,truncated:v.filter(r=>r.reason==='truncated').length,pairs:v.reduce((n,r)=>n+r.pairs,0),empty:v.reduce((n,r)=>n+r.empty,0),meanOccupied:avg('occupied'),meanPeakControl:avg('peak'),meanTurns:avg('turns'),draws:v.filter(r=>r.winner===null).length,meanFinalControlled:v.reduce((n,r)=>n+r.territory.blue+r.territory.red,0)/v.length,meanFinalStones:v.reduce((n,r)=>n+r.stones.blue+r.stones.red,0)/v.length};};
const target=rows.filter(r=>r.blue==='Aggressive'&&r.red==='Balanced'||r.blue==='Balanced'&&r.red==='Aggressive').map(r=>({kind:r.kind,seed:r.seed,blue:r.blue,red:r.red,pairs:r.pairs,points:r.points,turns:r.turns}));
// Same-style head-to-head, both colors, deterministic independent streams.
const head=[];for(const seed of [2412,2413])for(const strategy of names)for(const newColor of ['blue','red']){
 let g=newGame(),pairs={new:0,old:0},prior=null;
 const random={blue:seededRandom(seed+names.indexOf(strategy)*101),red:seededRandom(seed+names.indexOf(strategy)*101+37)};
 while(!g.ended&&g.ply<160){const kind=g.turn===newColor?'new':'old',move=agent(kind,g,strategy,random[g.turn]);if(prior?.move.type==='place'&&move.type==='remove'&&prior.move.to===move.to)pairs[prior.kind]++;g=applyMove(g,move);prior={move,kind};}
 head.push({seed,strategy,newColor,points:score(g.board,g.captured).winner===newColor?1:score(g.board,g.captured).winner===null?.5:0,pairs,turns:g.ply,reason:g.ended||'truncated'});
}
console.log(JSON.stringify({ref,summary:{old:summarize('old'),new:summarize('new')},target,head:{games:head.length,newPoints:head.reduce((n,r)=>n+r.points,0),newRecaptured:head.reduce((n,r)=>n+r.pairs.new,0),oldRecaptured:head.reduce((n,r)=>n+r.pairs.old,0),byStrategy:Object.fromEntries(names.map(s=>[s,head.filter(r=>r.strategy===s).reduce((n,r)=>n+r.points,0)])),rows:head}}));
