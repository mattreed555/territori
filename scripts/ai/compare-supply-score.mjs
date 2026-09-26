// Reproducible local development comparison against a frozen source commit.
import {loadModules} from './modules.mjs';
const ref=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(ref||''))throw Error('Pass prior full commit SHA');
const current=await loadModules(),prior=await loadModules({ref});
const {candidateAssets}=await current('ai/candidate-assets');
const {chooseIntentMove}=await current('ai/intent');
const {chooseIntentMove:choosePrior}=await prior('ai/intent');
const {seededRandom}=await current('ai/policy');
const {newGame,applyMove,score}=await current('game/rules');
const {STRATEGIES}=await current('game/strategies');
const names=Object.keys(STRATEGIES),rows=[];
for(let seed=2412;seed<=2413;seed++)for(const strategy of names)for(const candidateColor of ['blue','red']){
 let game=newGame(),pairs=0,priorPairs=0,previous=null;
 const random={blue:seededRandom(seed+names.indexOf(strategy)*101),red:seededRandom(seed+names.indexOf(strategy)*101+37)};
 while(!game.ended&&game.ply<160){
  const newSide=game.turn===candidateColor,chooser=newSide?chooseIntentMove:choosePrior;
  const move=chooser(game,strategy,candidateAssets.policy,candidateAssets.style,{strength:1,margin:1},.03,random[game.turn]);
  if(previous?.type==='place'&&move.type==='remove'&&move.to===previous.to){if(newSide)priorPairs++;else pairs++;}
  game=applyMove(game,move);previous=move;
 }
 const result=score(game.board);
 rows.push({seed,strategy,candidateColor,turns:game.ply,reason:game.ended||'truncated',winner:result.winner,candidatePoints:result.winner===candidateColor?1:result.winner===null?.5:0,ownImmediateRecaptures:pairs,priorImmediateRecaptures:priorPairs,territory:result.totals});
}
const sum=(key)=>rows.reduce((n,r)=>n+r[key],0);
console.log(JSON.stringify({ref,games:rows.length,points:sum('candidatePoints'),draws:rows.filter(r=>r.winner===null).length,truncated:rows.filter(r=>r.reason==='truncated').length,turns:sum('turns'),candidateRecaptured:sum('ownImmediateRecaptures'),priorRecaptured:sum('priorImmediateRecaptures'),byStrategy:Object.fromEntries(names.map(s=>[s,rows.filter(r=>r.strategy===s).reduce((n,r)=>n+r.candidatePoints,0)])),rows}));
