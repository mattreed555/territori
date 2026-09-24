import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{newGame,applyMove,legalMoves,legalValueSuccessors,neighbors,territory,score,moveId,nextPositionKey}=await load('game/rules'),{TACTICAL_FEATURE_NAMES,moveFeatures,legalMoveFeatures}=await load('ai/features'),{seededRandom}=await load('ai/policy'),{searchValue}=await load('ai/search');
test('fast terminal values preserve territory and connected-area tiebreak results',()=>{
 const random=seededRandom(945);let ties=0;
 for(let run=0;run<2000;run++){
  const g=newGame();g.ended=run%2?'supply':'repetition';
  g.board=g.board.map(()=>[null,'blue','red'][Math.floor(random()*3)]);
  const result=score(g.board);if(result.totals.blue===result.totals.red)ties++;
  for(const color of ['blue','red'])assert.equal(searchValue(g,color),result.winner===color?10000:result.winner===null?0:-10000);
 }
 assert.ok(ties>10);
 const empty=newGame();empty.ended='repetition';assert.equal(searchValue(empty,'blue'),0);
});
test('batched features exactly match single-move values through varied legal states',()=>{
 const random=seededRandom(2409);let checked=0;
 for(let run=0;run<3;run++){
  let game=newGame();
  for(let ply=0;ply<55&&!game.ended;ply++){
   if(ply%5===0){const before=JSON.stringify(game),rows=legalMoveFeatures(game,TACTICAL_FEATURE_NAMES);
    assert.deepEqual(rows.map(r=>moveId(r.move)),legalMoves(game).map(moveId));
    for(const row of rows){assert.deepEqual(row.values,moveFeatures(game,row.move,TACTICAL_FEATURE_NAMES));checked++;}
    assert.equal(JSON.stringify(game),before);
   }
   const moves=legalMoves(game);game=applyMove(game,moves[Math.floor(random()*moves.length)]);
  }
 }
 assert.ok(checked>1000);
 const game=newGame(),before=legalMoveFeatures(game,TACTICAL_FEATURE_NAMES);
 const next=applyMove(game,{type:'place',to:0});Object.assign(game,next);
 assert.notDeepEqual(legalMoveFeatures(game,TACTICAL_FEATURE_NAMES),before);
 assert.throws(()=>legalMoveFeatures(game,['unknown-feature']));
});
test('leaf value states retain exact full-transition outcomes including repetition and final round',()=>{
 const random=seededRandom(941);let checked=0;
 for(let run=0;run<4;run++){
  let g=newGame();
  for(let ply=0;ply<80&&!g.ended;ply++){
   const leaves=[...legalValueSuccessors(g)];assert.deepEqual(leaves.map(x=>moveId(x.move)),legalMoves(g).map(moveId));
   for(const leaf of leaves){const full=applyMove(g,leaf.move);assert.deepEqual(leaf.state,{board:full.board,supply:full.supply,ended:full.ended});checked++;}
   g=applyMove(g,leaves[Math.floor(random()*leaves.length)].move);
  }
 }
 assert.ok(checked>10000);
 let g=applyMove(newGame(),{type:'place',to:0});g=applyMove(g,{type:'place',to:63});
 g.positions[nextPositionKey(g,{type:'shift',from:0,to:1})]=2;
 assert.equal([...legalValueSuccessors(g)].find(x=>x.move.type==='shift'&&x.move.to===1).state.ended,'repetition');
 g.finalRound=true;g.turn='red';assert.ok([...legalValueSuccessors(g)].every(x=>x.state.ended==='supply'));
 g.ended='supply';assert.deepEqual([...legalValueSuccessors(g)],[]);
});
test('internal adjacency cache cannot be mutated through public neighbors and keeps custom sizes',()=>{
 const returned=neighbors(0);returned.push(63);returned.length=0;
 assert.deepEqual(neighbors(0),[8,1]);
 for(const size of [2,3,8,9]){
  const board=Array(size*size).fill(null);board[0]='blue';
  const expected=board.map((c,i)=>c||([size,1].includes(i)?'blue':null));
  assert.deepEqual(territory(board,size),expected);
 }
});
