import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),rules=await load('game/rules'),{validateModel,seededRandom}=await load('ai/policy'),{searchValue,rankSearchMoves,chooseSearchMove}=await load('ai/search');
const model=validateModel(JSON.parse(await fs.readFile(new URL('../experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json',import.meta.url),'utf8')));
const {newGame,applyMove,legalMoves,moveId,score}=rules;
test('a losing learned beam widens to find a shift that defers terminal loss',async()=>{
 const positions=JSON.parse(gunzipSync(await fs.readFile(new URL('../experiments/jev-replacement/20260924-style-06/positions.json.gz',import.meta.url)))).positions;
 const g=positions.find(p=>p.category==='shift-defers-visible-terminal-loss').state;
 for(const strategy of ['Aggressive','Cautious','Expansive','Fluid','Balanced']){
  const result=rankSearchMoves(g,strategy,model);
  assert.equal(result.expandedForSafety,true);assert.equal(result.ranked.length,legalMoves(g).length);
  assert.equal(result.ranked[0].move.type,'shift');assert.ok(result.ranked[0].searchValue>-10000);
 }
});
test('batched successor enumeration equals validated engine through seeded games',()=>{
 const random=seededRandom(2404);
 for(let game=0;game<4;game++){
  let g=newGame();
  for(let turn=0;turn<80&&!g.ended;turn++){
   const successors=[...rules.legalSuccessors(g)];
   assert.deepEqual(successors.map(s=>moveId(s.move)),legalMoves(g).map(moveId));
   for(const s of successors)assert.deepEqual(s.game,applyMove(g,s.move));
   g=successors[Math.floor(random()*successors.length)].game;
  }
 }
});
test('search includes every reply type and agrees with exhaustive two-ply reference',()=>{
 let g=applyMove(newGame(),{type:'place',to:27});g=applyMove(g,{type:'place',to:28});
 const before=JSON.stringify(g),output=rankSearchMoves(g,'Balanced',model,{policyBeam:0,priorWeight:0});
 assert.equal(output.policyOrder.length,legalMoves(g).length);
 assert.equal(output.ranked.length,legalMoves(g).length);
 for(const r of output.ranked){
  const next=applyMove(g,r.move),replies=legalMoves(next);
  const expected=replies.length?Math.min(...replies.map(m=>searchValue(applyMove(next,m),g.turn))):searchValue(next,g.turn);
  assert.equal(r.searchValue,expected);
 }
 assert.ok(output.ranked.some(r=>r.worstReply?.type==='place'));
 assert.equal(JSON.stringify(g),before);
});
test('terminal values use actual tiebreaks and both colors, not stone count',()=>{
 const g=newGame();g.board[0]='blue';g.ended='supply';
 assert.equal(searchValue(g,'blue'),10000);assert.equal(searchValue(g,'red'),-10000);
 g.board[63]='red';assert.equal(score(g.board).winner,null);assert.equal(searchValue(g,'blue'),0);
});
test('incremental leaf values and first worst replies match full-board reference on varied states',async()=>{
 const positions=JSON.parse(gunzipSync(await fs.readFile(new URL('../experiments/jev-replacement/20260924-varied-12/positions.json.gz',import.meta.url))));
 let roots=0;const kinds=new Set(),colors=new Set();
 for(const p of positions.filter((_,i)=>i%17===0)){
  const g=p.state,before=JSON.stringify(g),output=rankSearchMoves(g,'Balanced',model,{policyBeam:0,priorWeight:0});colors.add(g.turn);
  for(const r of output.ranked){
   const next=applyMove(g,r.move);let value=searchValue(next,g.turn),reply=null;
   for(const child of rules.legalValueSuccessors(next)){
    kinds.add(child.move.type);const n=searchValue(child.state,g.turn);
    if(reply===null||n<value){value=n;reply=child.move;}
   }
   assert.equal(r.searchValue,value);assert.deepEqual(r.worstReply,reply);roots++;
  }
  assert.equal(JSON.stringify(g),before,'evaluation must not mutate state');
 }
 assert.deepEqual([...colors].sort(),['blue','red']);assert.deepEqual([...kinds].sort(),['place','remove','shift']);assert.ok(roots>500);
});
test('Blue final placement includes the remaining Red turn and repetition endings',()=>{
 const g=newGame();g.board[0]='blue';g.board[63]='red';g.supply.blue=1;
 const result=rankSearchMoves(g,'Balanced',model,{policyBeam:0});
 for(const r of result.ranked.filter(r=>r.move.type==='place')){
  const next=applyMove(g,r.move);assert.equal(next.finalRound,true);assert.equal(next.ended,null);
  const children=[...rules.legalSuccessors(next)];assert.ok(children.every(c=>c.game.ended==='supply'));
  assert.equal(r.searchValue,Math.min(...children.map(c=>searchValue(c.game,'blue'))));
 }
 const move={type:'shift',from:0,to:1};g.positions[rules.nextPositionKey(g,move)]=2;
 const terminal=applyMove(g,move);assert.equal(terminal.ended,'repetition');
 assert.equal(rankSearchMoves(g,'Balanced',model,{policyBeam:1,staticBeam:0}).ranked.find(r=>moveId(r.move)===moveId(move)).searchValue,searchValue(terminal,'blue'));
});
test('terminal winning moves survive a tiny beam and epsilon cannot discard them',()=>{
 const g=newGame();g.turn='red';g.supply={blue:0,red:1};g.finalRound=true;g.board[0]='blue';g.board[63]='red';
 const config={policyBeam:1,staticBeam:0};
 const result=rankSearchMoves(g,'Balanced',model,config);
 assert.ok(result.ranked.length>1);assert.equal(result.ranked[0].searchValue,10000);
 const random=seededRandom(7);
 for(let i=0;i<12;i++)assert.equal(score(applyMove(g,chooseSearchMove(g,'Balanced',model,config,1,random)).board).winner,'red');
});
test('search rejects invalid options and finished games and is seeded reproducible',()=>{
 const g=newGame();assert.throws(()=>rankSearchMoves(g,'Balanced',model,{policyBeam:-1}));
 assert.throws(()=>rankSearchMoves(g,'Balanced',model,{priorWieght:3}));
 assert.throws(()=>rankSearchMoves(g,'Balanced',model,null));
 assert.throws(()=>rankSearchMoves(g,'Balanced',model,{priorWeight:Infinity}));
 assert.throws(()=>chooseSearchMove(g,'Balanced',model,{},2));
 const beam=rankSearchMoves(g,'Balanced',model,{policyBeam:1,staticBeam:0});
 assert.equal(beam.policyOrder.length,64);assert.equal(new Set(beam.policyOrder.map(moveId)).size,64);
 assert.equal(moveId(beam.policyOrder[0]),moveId(beam.ranked[0].move));
 assert.equal(moveId(chooseSearchMove(g,'Fluid',model,{},1,seededRandom(2))),moveId(chooseSearchMove(g,'Fluid',model,{},1,seededRandom(2))));
 g.ended='repetition';assert.throws(()=>chooseSearchMove(g,'Balanced',model),/No legal moves/);
});
