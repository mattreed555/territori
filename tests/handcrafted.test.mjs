import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{chooseHandcraftedMove,rankHandcraftedMoves}=await load('ai/handcrafted');
const {newGame,applyMove,legalMoves,moveId,score,nextPositionKey}=await load('game/rules');
const {seededRandom}=await load('ai/policy');
const {STRATEGIES}=await load('game/strategies');

test('five local strategies pick legal moves without a trained model or network',()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network access');};
 try{for(const s of Object.keys(STRATEGIES)){
  let g=newGame();for(let i=0;i<12;i++){const m=chooseHandcraftedMove(g,s);assert.ok(legalMoves(g).some(x=>moveId(x)===moveId(m)));g=applyMove(g,m);}
 }}finally{globalThis.fetch=original;}
});
test('winning terminal choices survive style and exploration',()=>{
 const g=newGame();g.turn='red';g.supply={blue:0,red:1};g.finalRound=true;g.board[0]='blue';g.board[63]='red';
 for(const s of Object.keys(STRATEGIES))for(let i=0;i<8;i++){
  const m=chooseHandcraftedMove(g,s,1,()=>i/8);
  assert.equal(score(applyMove(g,m).board,applyMove(g,m).captured).winner,'red');
 }
});
test('full-width safety defers a known terminal loss and repeat endings remain legal',async()=>{
 const {positions}=JSON.parse(gunzipSync(await fs.readFile(new URL('../experiments/jev-replacement/20260924-style-06/positions.json.gz',import.meta.url))));
 const losing=positions.find(p=>p.category==='shift-defers-visible-terminal-loss').state;
 for(const s of Object.keys(STRATEGIES)){
  const r=rankHandcraftedMoves(losing,s);
  assert.equal(r.ranked[0].move.type,'shift');assert.ok(r.ranked[0].searchValue>-10000);
 }
 const g=newGame();g.board[0]='blue';g.board[63]='red';g.supply.blue=1;
 const result=rankHandcraftedMoves(g,'Balanced');assert.ok(result.searched>0);
 const shift={type:'shift',from:0,to:1};g.positions[nextPositionKey(g,shift)]=2;
 const r=rankHandcraftedMoves(g,'Fluid');assert.ok(r.ranked.some(x=>moveId(x.move)===moveId(shift)));
 assert.equal(applyMove(g,shift).ended,'repetition');
});
test('known Aggressive–Balanced seed does not feed repeated immediate captures',()=>{
 let g=newGame(),previous=null,pairs=0;
 const random={blue:seededRandom(2816),red:seededRandom(2853)};
 while(!g.ended&&g.ply<160){
  const move=chooseHandcraftedMove(g,g.turn==='blue'?'Aggressive':'Balanced',.03,random[g.turn]);
  if(previous?.type==='place'&&move.type==='remove'&&previous.to===move.to)pairs++;
  g=applyMove(g,move);previous=move;
 }
 assert.ok(g.ended);assert.equal(pairs,0);
});
