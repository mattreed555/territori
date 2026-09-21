import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadModules} from '../scripts/ai/modules.mjs';
const load=await loadModules(),{newGame,applyMove,legalMoves,moveId}=await load('game/rules'),{FEATURE_NAMES,TACTICAL_FEATURE_NAMES,moveFeatures}=await load('ai/features'),{captureOutcome}=await load('game/jev'),{recordDecision}=await load('ai/dataset'),{teacherTargets,trainPolicy}=await load('ai/training'),{validateModel}=await load('ai/policy');
test('opt-in tactical features agree with teacher reply analysis and preserve baseline defaults',()=>{
 assert.equal(FEATURE_NAMES.length,21);assert.equal(TACTICAL_FEATURE_NAMES.length,31);
 let game=applyMove(newGame(),{type:'place',to:0});game=applyMove(game,{type:'place',to:28});
 for(const move of legalMoves(game)){
  const f=Object.fromEntries(TACTICAL_FEATURE_NAMES.map((n,i)=>[n,moveFeatures(game,move,TACTICAL_FEATURE_NAMES)[i]])),reply=captureOutcome(game,move);
  assert.equal(f.captureReplyAvailable,Number(reply!==null));
  if(reply)assert.equal(f.captureReplyOwnGain,reply.myNetTerritoryGain);
  assert.deepEqual(moveFeatures(game,move),moveFeatures(game,move,TACTICAL_FEATURE_NAMES).slice(0,21));
 }
 const f=Object.fromEntries(TACTICAL_FEATURE_NAMES.map((n,i)=>[n,moveFeatures(game,{type:'place',to:27},TACTICAL_FEATURE_NAMES)[i]]));
 assert.equal(f.movedStoneExposed,1);assert.equal(f.captureReplyWastesStone,1);
});
test('soft targets preserve one-hot defaults, normalize valid probabilities, and reject corrupt labels',()=>{
 const game=newGame(),row=recordDecision('test',game,'Balanced',{type:'place',to:0},'jev');
 assert.equal(teacherTargets(row)[0],1);assert.equal(teacherTargets(row).reduce((a,b)=>a+b),1);
 row.teacher={model:'test',answer:{probabilities:Object.fromEntries(legalMoves(game).map(m=>[moveId(m),1/64]))}};
 assert.equal(teacherTargets(row,1)[1],1/64);assert.equal(teacherTargets(row,.5)[0],.5+.5/64);
 assert.throws(()=>teacherTargets(row,2));
 for(const id of Object.keys(row.teacher.answer.probabilities))row.teacher.answer.probabilities[id]=.99/64;
 assert.ok(Math.abs(teacherTargets(row,1)[1]-1/64)<1e-12);
 for(const id of Object.keys(row.teacher.answer.probabilities))row.teacher.answer.probabilities[id]=.5/64;
 assert.throws(()=>teacherTargets(row,1),/mass/);
 row.teacher.answer.probabilities.place_0=-1;assert.throws(()=>teacherTargets(row,1),/invalid/);
});
test('tactical/soft models validate and old hard-label training remains supported',()=>{
 const rows=[];for(let i=0;i<2;i++){const g=newGame();rows.push(recordDecision('game'+i,g,'Balanced',{type:'place',to:27},'jev',{model:'test',answer:{probabilities:Object.fromEntries(legalMoves(g).map(m=>[moveId(m),Number(m.to===27)]))}}));}
 const fit=trainPolicy(rows,{epochs:2,features:TACTICAL_FEATURE_NAMES,softTargetMix:.5});validateModel(fit.model);
 assert.equal(fit.model.training.softTargetMix,.5);assert.equal(fit.model.features.length,31);
 const old=trainPolicy(rows,{epochs:2});validateModel(old.model);assert.equal(old.model.training.softTargetMix,undefined);
 assert.throws(()=>validateModel({...old.model,features:['__proto__']}));
 assert.throws(()=>validateModel({...old.model,features:[['territoryGain']]}));
});
