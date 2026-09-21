import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{trainPolicy,splitGames}=await load('ai/training'),{newGame,applyMove,legalMoves}=await load('game/rules'),{recordDecision}=await load('ai/dataset'),{validateModel}=await load('ai/policy');
function samples(){const out=[];for(let i=0;i<6;i++){let state=newGame();for(let turn=0;turn<4;turn++){const move=legalMoves(state).find(m=>m.type==='place');out.push(recordDecision('game'+i,state,turn%2?'Aggressive':'Balanced',move,'jev'));state=applyMove(state,move);}}return out;}
test('shared prior is deterministic, remains a standard tiny policy, and is opt-in',()=>{
 const rows=samples(),options={seed:9,epochs:3,sharedPriorStrength:.05};
 const a=trainPolicy(rows,options),b=trainPolicy(rows,options);assert.deepEqual(a.model,b.model);validateModel(a.model);
 assert.equal(a.model.training.sharedPriorStrength,.05);assert.ok(!a.model.strategies.Fluid);
 assert.deepEqual(trainPolicy(rows,{seed:9,epochs:3}).model,trainPolicy(rows,{seed:9,epochs:3,sharedPriorStrength:0}).model);
 assert.throws(()=>trainPolicy(rows,{sharedPriorStrength:-1}));
});
test('shared fitting never uses validation choices or probabilities',()=>{
 const rows=samples(),options={seed:9,epochs:3,sharedPriorStrength:.05},split=splitGames(rows,9),ids=new Set(split.testGameIds);
 const changed=rows.map(r=>ids.has(r.gameId)?{...r,chosenMove:r.legalMoves.at(-1),teacher:{model:'invalid-heldout',answer:{probabilities:{}}}}:r);
 assert.deepEqual(trainPolicy(rows,options).model,trainPolicy(changed,options).model);
});
