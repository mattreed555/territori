import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, newGame, applyMove, territory, score, isCapturable, legalMoves, neighbors, coordinate } from '../lib/game/rules.ts';
const normal = newGame;

test('8x8 coordinates and edges never wrap', () => {
 assert.equal(newGame().board.length,64); assert.equal(coordinate(63),'H8');
 assert.deepEqual(neighbors(7),[15,6]); assert.deepEqual(neighbors(56),[48,57]);
 assert.equal(legalMoves(newGame()).length,64);
});
test('captures require a strict local majority, excluding target and diagonals', () => {
 const b=normal().board;b[27]='red';
 assert.equal(isCapturable(b,27),false); // 0 versus 0, no remote capture
 b[18]='blue';assert.equal(isCapturable(b,27),false); // diagonal
 b[19]='blue';assert.equal(isCapturable(b,27),true); // 1 versus 0
 b[28]='red';assert.equal(isCapturable(b,27),false); // tie
 b[26]='blue';assert.equal(isCapturable(b,27),true); // 2 versus 1
 b[35]='red';assert.equal(isCapturable(b,27),false); // 2 versus 2
 assert.equal(isCapturable(b,0),false);
 const edge=normal().board;edge[7]='red';edge[8]='blue';assert.equal(isCapturable(edge,7),false);
 edge[6]='blue';assert.equal(isCapturable(edge,7),true);
});
test('capture is one chosen enemy only, permanent, and never automatic', () => {
 let g=normal();g.board[27]='red';g.board[28]='red';g.board[19]='blue';g.supply={blue:24,red:23};
 g=applyMove(g,{type:'place',to:26});assert.equal(g.board[27],'red'); // newly threatened, still present
 g.turn='blue';assert.throws(()=>applyMove(g,{type:'remove',to:19}));
 const next=applyMove(g,{type:'remove',to:27});assert.equal(next.board[27],null);assert.equal(next.board[28],'red');
 assert.equal(next.captured.red,1);assert.equal(next.supply.red,23);
});
test('ties prevent capture and shifts must be adjacent and empty', () => {
 const g=normal();g.board[27]='blue';g.board[28]='blue';g.board[19]='red';g.turn='red';
 assert.throws(()=>applyMove(g,{type:'remove',to:27}));
 g.turn='blue';assert.throws(()=>applyMove(g,{type:'shift',from:27,to:28}));assert.throws(()=>applyMove(g,{type:'shift',from:27,to:36}));
 assert.equal(applyMove(g,{type:'shift',from:28,to:29}).board[29],'blue');
});
test('territory stays local; competing influence is neutral regardless of numbers', () => {
 const b=normal().board;b[26]='blue';b[28]='red';b[19]='blue';
 const t=territory(b);assert.equal(t[27],null);assert.equal(t[26],'blue');assert.equal(t[25],'blue');assert.equal(t[63],null);
});
test('last unused stone triggers an equal-turn finish despite losses', () => {
 let g=normal();g.board[28]='red';g.supply={blue:1,red:24};g.captured.blue=24;
 g=applyMove(g,{type:'place',to:27});assert.equal(g.finalRound,true);assert.equal(g.ended,null);
 g=applyMove(g,{type:'remove',to:27});assert.equal(g.ended,'supply');assert.equal(g.captured.blue,25);assert.deepEqual(legalMoves(g),[]);
 const red=normal();red.turn='red';red.supply.red=1;red.captured.red=24;
 assert.equal(applyMove(red,{type:'place',to:27}).ended,'supply');
});
test('third occurrence ends a shifting loop; captures with new supplies do not repeat', () => {
 let g=applyMove(normal(),{type:'place',to:9});g=applyMove(g,{type:'place',to:54});
 for(let i=0;i<2;i++){g=applyMove(g,{type:'shift',from:9,to:10});g=applyMove(g,{type:'shift',from:54,to:53});g=applyMove(g,{type:'shift',from:10,to:9});g=applyMove(g,{type:'shift',from:53,to:54});}
 assert.equal(g.ended,'repetition');
 g=normal();g.board[28]='red';g.supply.red=24;
 for(let i=0;i<4;i++){g=applyMove(g,{type:'place',to:27});g=applyMove(g,{type:'remove',to:27});assert.equal(g.ended,null);}
});
test('connected territory breaks tied totals', () => {
 const b=Array(100).fill(null);b[11]='blue';b[13]='blue';b[71]='red';b[79]='red';
 const s=score(b,10);assert.deepEqual(s.totals,{blue:9,red:9});assert.deepEqual(s.largest,{blue:9,red:5});assert.equal(s.winner,'blue');
});
test('empty opening alternates immediately; normal actions are available from the start', () => {
 let g=newGame();assert.deepEqual(g.supply,{blue:25,red:25});assert.equal(g.board.every(c=>c===null),true);
 g=applyMove(g,{type:'place',to:27});assert.equal(g.turn,'red');assert.equal(g.ply,1);assert.deepEqual(g.supply,{blue:24,red:25});
 assert.equal(legalMoves(g).some(m=>m.type==='remove'),false); // lone stone safe without attackers
 g=applyMove(g,{type:'place',to:28});assert.equal(g.turn,'blue');assert.equal(g.ply,2);
 assert.ok(legalMoves(g).some(m=>m.type==='remove'&&m.to===28));
 assert.ok(legalMoves(g).some(m=>m.type==='shift'&&m.from===27));
 g=applyMove(g,{type:'remove',to:28});assert.equal(g.turn,'red');assert.equal(g.captured.red,1);assert.equal(g.supply.red,24);
});
