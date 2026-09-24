import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{intentPreference,INTENT_FEATURES,rankIntentMoves,chooseIntentMove}=await load('ai/intent'),{rankStyledMoves,chooseStyledMove}=await load('ai/style'),{seededRandom}=await load('ai/policy'),{newGame,applyMove,legalMoves,moveId,score}=await load('game/rules'),{STRATEGIES}=await load('game/strategies');
const policy=JSON.parse(await fs.readFile(new URL('../experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json',import.meta.url))),style=JSON.parse(await fs.readFile(new URL('../experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json',import.meta.url)));
test('authored intent is bounded and Fluid rewards improvements, not empty shifts or loops',()=>{
 const f=overrides=>INTENT_FEATURES.map(k=>overrides[k]||0);
 assert.equal(intentPreference('Fluid',f({shift:1})),0);
 assert.equal(intentPreference('Fluid',f({shift:1,ownExposureChange:-1})),1);
 assert.equal(intentPreference('Fluid',f({shift:1,ownExposureChange:-1,repetitionCount:1})),0);
 assert.equal(intentPreference('Fluid',f({territoryGain:4})),0);
 assert.ok(intentPreference('Cautious',f({ownExposureChange:-1}))>intentPreference('Cautious',f({ownExposureChange:1})));
 assert.ok(intentPreference('Aggressive',f({remove:1}))>0);assert.ok(intentPreference('Expansive',f({spreadChange:8}))>0);
 assert.equal(intentPreference('Balanced',f({territoryGain:5})),0);
 const random=seededRandom(2411);for(let i=0;i<100;i++)for(const s of Object.keys(STRATEGIES)){const n=intentPreference(s,INTENT_FEATURES.map(()=>random()*10-5));assert.ok(n>=-1&&n<=1);}
 assert.throws(()=>intentPreference('Fluid',[]));assert.throws(()=>intentPreference('Other',f({})));assert.throws(()=>intentPreference('Fluid',INTENT_FEATURES.map(()=>NaN)));
});
test('zero strength reproduces the learned style and preserves seeded exploration',()=>{
 let game=applyMove(newGame(),{type:'place',to:27});game=applyMove(game,{type:'place',to:28});
 for(const strategy of Object.keys(STRATEGIES)){
  assert.deepEqual(rankIntentMoves(game,strategy,policy,style,{strength:0}).policyOrder,rankStyledMoves(game,strategy,policy,style,{weight:.5,margin:1}).policyOrder);
  assert.deepEqual(chooseIntentMove(game,strategy,policy,style,{strength:0},1,seededRandom(41)),chooseStyledMove(game,strategy,policy,style,{weight:.5,margin:1},1,seededRandom(41)));
 }
});
test('intent maintains complete legal ordering, tactical floor and clear failures',()=>{
 const random=seededRandom(2411);let g=newGame();
 for(let ply=0;ply<40&&!g.ended;ply++){
  if(ply%10===0)for(const strategy of Object.keys(STRATEGIES)){
   const r=rankIntentMoves(g,strategy,policy,style,{strength:2,margin:.5}),best=Math.max(...r.ranked.map(r=>r.searchValue));
   assert.deepEqual([...r.policyOrder.map(moveId)].sort(),legalMoves(g).map(moveId).sort());assert.ok(r.ranked[0].searchValue>=best-.5);
   const move=chooseIntentMove(g,strategy,policy,style,{strength:2,margin:.5},1,()=>.9);assert.ok(r.ranked.find(r=>moveId(r.move)===moveId(move)).intentEligible);
  }
  const legal=legalMoves(g);g=applyMove(g,legal[Math.floor(random()*legal.length)]);
 }
 for(const options of [{strength:3},{strength:-1},{margin:2},{strenght:1},null])assert.throws(()=>rankIntentMoves(g,'Fluid',policy,style,options));
 assert.throws(()=>chooseIntentMove(g,'Fluid',policy,style,{},2));g.ended='supply';assert.throws(()=>chooseIntentMove(g,'Fluid',policy,style));
});
test('intent preserves terminal wins and full-width loss deferral for every strategy',async()=>{
 const end=newGame();end.turn='red';end.supply={blue:0,red:1};end.finalRound=true;end.board[0]='blue';end.board[63]='red';
 const {positions}=JSON.parse(gunzipSync(await fs.readFile(new URL('../experiments/jev-replacement/20260924-style-06/positions.json.gz',import.meta.url))));
 const g=positions.find(p=>p.category==='shift-defers-visible-terminal-loss').state;
 for(const s of Object.keys(STRATEGIES)){
  for(const epsilon of [0,1])assert.equal(score(applyMove(end,chooseIntentMove(end,s,policy,style,{strength:2},epsilon,()=>.1)).board).winner,'red');
  const r=rankIntentMoves(g,s,policy,style,{strength:2});assert.equal(r.expandedForSafety,true);assert.equal(r.ranked[0].move.type,'shift');assert.ok(r.ranked[0].searchValue>-10000);
 }
});
