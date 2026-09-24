import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{newGame,moveId,applyMove,score}=await load('game/rules'),{STRATEGIES}=await load('game/strategies'),{recordCounterfactual}=await load('ai/counterfactual'),{trainStyle}=await load('ai/style-training'),{rankStyledMoves,chooseStyledMove,validateStyleModel}=await load('ai/style'),{rankSearchMoves}=await load('ai/search');
const policy=JSON.parse(await fs.readFile(new URL('../experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json',import.meta.url)));
function fixture(group,distinct=true,flip=false){return Object.keys(STRATEGIES).map((strategy,s)=>{
 const state=newGame(),to=distinct?((s+Number(flip))%2?0:27):27;
 const label=recordCounterfactual({id:group+':p',groupId:group,origin:'test',category:'test',state},strategy,{type:'place',to},{model:'test',answer:null});
 label.decision.teacher.answer={probabilities:Object.fromEntries(label.decision.legalMoves.map(m=>[moveId(m),m.to===to?.8:.2/63]))};return label;
});}
test('matched style regression is deterministic, zero-sum and training-only',()=>{
 const train=fixture('train'),test=fixture('test'),config={ridge:.1};
 const a=trainStyle([...train,...test],['test'],config),b=trainStyle([...train,...fixture('test',true,true)],['test'],config);
 assert.deepEqual(a,b);assert.deepEqual(a,trainStyle([...train,...test],['test'],config));
 assert.ok(Object.values(a.weights).some(w=>w.some(v=>Math.abs(v)>.001)));
 for(let j=0;j<a.features.length;j++)assert.ok(Math.abs(Object.values(a.weights).reduce((s,w)=>s+w[j],0))<1e-9);
 const zero=trainStyle([...fixture('train',false),...test],['test']);
 assert.ok(Object.values(zero.weights).every(w=>w.every(v=>Math.abs(v)<1e-10)));
});
test('matched style requires complete same-state labels and validates models',()=>{
 const probes=[...fixture('train'),...fixture('test')],model=trainStyle(probes,['test']);
 assert.throws(()=>trainStyle(probes.slice(1),['test']));
 const altered=structuredClone(probes);altered[0].groupId='another';assert.throws(()=>trainStyle(altered,['test']));
 assert.throws(()=>trainStyle(probes,['unknown']));assert.throws(()=>trainStyle(probes,['test'],{ridge:0}));
 const bad=structuredClone(model);delete bad.weights.Fluid;assert.throws(()=>validateStyleModel(bad));
 assert.throws(()=>validateStyleModel({...model,scale:model.scale.map(()=>0)}));
 assert.throws(()=>validateStyleModel({...model,training:{...model.training,testGroupIds:['train']}}));
});
test('styled search keeps a complete legal ordering, tactical floor and terminal wins',()=>{
 const style=trainStyle([...fixture('train'),...fixture('test')],['test']);
 let g=applyMove(newGame(),{type:'place',to:27});g=applyMove(g,{type:'place',to:28});
 const base=rankSearchMoves(g,'Fluid',policy),off=rankStyledMoves(g,'Fluid',policy,style,{weight:0});
 assert.deepEqual(off.policyOrder,base.policyOrder);
 const styled=rankStyledMoves(g,'Fluid',policy,style,{weight:3,margin:.5});
 assert.equal(styled.policyOrder.length,base.policyOrder.length);assert.equal(new Set(styled.policyOrder.map(moveId)).size,styled.policyOrder.length);
 assert.ok(styled.ranked[0].searchValue>=Math.max(...base.ranked.map(r=>r.searchValue))-.5);
 const end=newGame();end.turn='red';end.supply={blue:0,red:1};end.finalRound=true;end.board[0]='blue';end.board[63]='red';
 for(const s of Object.keys(STRATEGIES))for(const epsilon of [0,1])assert.equal(score(applyMove(end,chooseStyledMove(end,s,policy,style,{weight:3},epsilon,()=>.1)).board).winner,'red');
 assert.throws(()=>rankStyledMoves(g,'Fluid',policy,style,{weight:4}));assert.throws(()=>rankStyledMoves(g,'Fluid',policy,style,{weigth:1}));
});
test('style cannot undo the full-width loss-deferring safety fallback',async()=>{
 const style=trainStyle([...fixture('train'),...fixture('test')],['test']);
 const positions=JSON.parse(gunzipSync(await fs.readFile(new URL('../experiments/jev-replacement/20260924-style-06/positions.json.gz',import.meta.url)))).positions;
 const g=positions.find(p=>p.category==='shift-defers-visible-terminal-loss').state;
 for(const s of Object.keys(STRATEGIES)){
  const r=rankStyledMoves(g,s,policy,style,{weight:3,margin:2});
  assert.equal(r.expandedForSafety,true);assert.equal(r.ranked[0].move.type,'shift');assert.ok(r.ranked[0].searchValue>-10000);
 }
});
